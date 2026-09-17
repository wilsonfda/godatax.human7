# -*- coding: utf-8 -*-
"""
GDX_SKILL_LOAD_RLT_MODEL_DB - step 1: dynamic SQL generation.

Reads the current .sav file and (re)generates the 8 load scripts
(01_load_study.sql .. 08_adjust_sequences.sql) that populate the
GDX_PSY_* tables defined in psychometrics_model_firebird25.sql, following
the mapping documented in SPSS_to_Firebird_Mapping.md.

The per-person DATA (who answered what) is always re-read from the .sav file
given on the command line -- this is the "dynamic" part. The instrument/
construct/variable/item CATALOG (which columns belong to which scale, the
translated item wording) is fixed domain knowledge from catalog.py, because
it cannot be derived from the .sav alone (see SPSS_to_Firebird_Mapping.md
section 1: the .sav carries no column labels).

Usage:
    python generate_load_scripts.py [--sav PATH] [--out-dir PATH]

Defaults match the current GDX_HUMAN layout:
    --sav      GDX_HUMAN/1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav
    --out-dir  GDX_HUMAN/2.relational.model.psychometrics
"""
import argparse
import math
import os
import sys

import pyreadstat

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalog

REPO_ROOT_HINT = os.path.join("GDX_HUMAN", "1.output.ibm.spss.statistics")
DEFAULT_SAV = os.path.join("GDX_HUMAN", "1.output.ibm.spss.statistics", "PLANILHAPOSDOC11SET SO CADETES.sav")
DEFAULT_OUT = os.path.join("GDX_HUMAN", "2.relational.model.psychometrics")


def esc(s):
    return str(s).replace("'", "''")


def fnum(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return round(float(v), 4)


def load_sav(path):
    if not os.path.isfile(path):
        raise SystemExit(f"ERROR: .sav file not found at: {path}")
    df, meta = pyreadstat.read_sav(path)
    return df


def validate_columns(df):
    """Cross-check the .sav's actual columns against what catalog.py expects.
    Never silently drops or invents mappings -- surfaces mismatches so a human
    can update catalog.py before data is loaded with an incomplete/wrong
    mapping."""
    expected = catalog.expected_columns()
    actual = set(df.columns)

    missing = sorted(expected - actual)
    extra = sorted(actual - expected)

    if missing:
        print("WARNING: columns the catalog expects but the .sav does NOT have "
              "(they will be skipped): " + ", ".join(missing))
    if extra:
        print("WARNING: columns found in the .sav that the catalog does NOT know "
              "about (they will be IGNORED -- update catalog.py if they matter): "
              + ", ".join(extra))
    if missing or extra:
        print("Proceeding, but review SPSS_to_Firebird_Mapping.md / catalog.py "
              "before trusting the generated load scripts.")
    return missing, extra


def generate(df, out_dir):
    items, column_to_item = catalog.build_items()
    column_to_variable = {v[2]: vid for vid, v in catalog.VARIABLES.items()}

    os.makedirs(out_dir, exist_ok=True)

    # 01 - GDX_PSY_STUDY
    with open(os.path.join(out_dir, "01_load_study.sql"), "w", encoding="utf-8") as f:
        f.write("""/* ============================================================================
   Data load - GDX_PSY_STUDY
   Generated dynamically by GDX_SKILL_LOAD_RLT_MODEL_DB from the current .sav.
   Prerequisite: psychometrics_model_firebird25.sql already applied.
   Application order: 01 (this) -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08.
   ============================================================================ */

INSERT INTO GDX_PSY_STUDY (ID_STUDY, TITLE, OBJECTIVE, METHOD, STATUS)
VALUES (1, 'Predictors of Adaptability to Military Higher Education',
        'Identify psychological predictors (hardiness, engagement, positivity, satisfaction) of career adaptability in officer cadets.',
        'Self-report questionnaire battery administered to cadets at the Military Academy (Portugal); data processed in SPSS.',
        'COMPLETED');
""")

    # 02 - catalog tables
    with open(os.path.join(out_dir, "02_load_instrument_catalog.sql"), "w", encoding="utf-8") as f:
        f.write("""/* ============================================================================
   Data load - Catalog (GDX_PSY_PHENOMENON, GDX_PSY_CONSTRUCT, GDX_PSY_INSTRUMENT,
   GDX_PSY_INSTRUMENT_CONSTRUCT, GDX_PSY_VARIABLE)
   Generated dynamically by GDX_SKILL_LOAD_RLT_MODEL_DB (catalog.py) -- IDs are
   fixed explicitly so scripts 03-07 can reference them.
   ============================================================================ */

""")
        for cid, (name, desc) in catalog.CONSTRUCTS.items():
            f.write(f"INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES ({cid}, '{esc(name)}', '{esc(desc)}');\n")
        f.write("\n")
        for cid, (name, desc) in catalog.CONSTRUCTS.items():
            f.write(f"INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) "
                    f"VALUES ({cid}, '{esc(name)}', 'PSYCHOMETRIC_SPSS', '{esc(desc)}');\n")
        f.write("\n")
        for cid in catalog.CONSTRUCTS:
            f.write(f"INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) "
                    f"VALUES ({cid}, {cid}, 'OPERATIONALIZES');\n")
        f.write("\n")
        for iid, inst in catalog.INSTRUMENTS.items():
            f.write(f"INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) "
                    f"VALUES ({iid}, '{esc(inst['name'])}', '{esc(inst['version'])}', '{esc(inst['type'])}', '{esc(inst['desc'])}', 1);\n")
        f.write("\n")
        for iid in catalog.INSTRUMENTS:
            f.write(f"INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES ({iid}, {iid}, 1);\n")
        f.write("\n")
        for vid, (cid, name, col, desc) in catalog.VARIABLES.items():
            f.write(f"INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) "
                    f"VALUES ({vid}, {cid}, '{esc(name)}', '{esc(desc)}', "
                    f"'.sav column: {esc(col)} (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');\n")

    # 03 - items
    with open(os.path.join(out_dir, "03_load_instrument_items.sql"), "w", encoding="utf-8") as f:
        f.write("""/* ============================================================================
   Data load - GDX_PSY_INSTRUMENT_ITEM
   Generated dynamically by GDX_SKILL_LOAD_RLT_MODEL_DB (catalog.py).
   Items with no known wording (ef16-ef18, an1-an11, red1-red5) get a
   placeholder statement -- see SPSS_to_Firebird_Mapping.md sections 3 and 6.
   ============================================================================ */

""")
        for iid, it in items.items():
            f.write(f"INSERT INTO GDX_PSY_INSTRUMENT_ITEM (ID_ITEM, ID_INSTRUMENT, ITEM_ORDER, STATEMENT_TEXT, RESPONSE_TYPE, REQUIRED) "
                    f"VALUES ({iid}, {it['instrument']}, {it['order']}, '{esc(it['statement'])}', '{it['type']}', 1); "
                    f"-- .sav column: {it['column']}\n")

    # 04 - persons + participants (dynamic: one row per respondent currently in the .sav)
    with open(os.path.join(out_dir, "04_load_persons_participants.sql"), "w", encoding="utf-8") as f:
        f.write("""/* ============================================================================
   Data load - GDX_PSY_PERSON + GDX_PSY_STUDY_PARTICIPANT
   Generated dynamically by GDX_SKILL_LOAD_RLT_MODEL_DB from the current .sav
   (one row per respondent actually present in the file at generation time).
   ID_PERSON = original .sav ID (not sequence-generated), for 1:1 traceability.
   ============================================================================ */

""")
        for _, row in df.iterrows():
            pid = int(row["ID"])
            f.write(f"INSERT INTO GDX_PSY_PERSON (ID_PERSON, NAME, EXTERNAL_IDENTIFIER) "
                    f"VALUES ({pid}, 'Participant {pid}', 'SPSS-{pid}');\n")
        f.write("\n")
        for _, row in df.iterrows():
            pid = int(row["ID"])
            ano = row.get("ano")
            if ano is None or (isinstance(ano, float) and math.isnan(ano)):
                group = "Curricular year: NOT REPORTED"
            else:
                group = f"Curricular year: {int(ano)}"
            f.write(f"INSERT INTO GDX_PSY_STUDY_PARTICIPANT (ID_STUDY, ID_PERSON, ANONYMOUS_CODE, EXPERIMENTAL_GROUP, CONSENT) "
                    f"VALUES (1, {pid}, 'SPSS-{pid}', '{esc(group)}', 1);\n")

    # 05 - applications
    with open(os.path.join(out_dir, "05_load_applications.sql"), "w", encoding="utf-8") as f:
        f.write("""/* ============================================================================
   Data load - GDX_PSY_APPLICATION
   Generated dynamically. One "umbrella" application per person currently in
   the .sav, covering the full battery in a single session.
   ============================================================================ */

""")
        for _, row in df.iterrows():
            pid = int(row["ID"])
            f.write(f"INSERT INTO GDX_PSY_APPLICATION (ID_APPLICATION, ID_STUDY, ID_PERSON, ID_INSTRUMENT, CONTEXT, STATUS) "
                    f"VALUES ({pid}, 1, {pid}, 1, 'Full battery - Predictors of Adaptability to Military Higher Education', 'COMPLETED');\n")

    # 06 - item responses (bulk, dynamic)
    n_resp = 0
    with open(os.path.join(out_dir, "06_load_item_responses.sql"), "w", encoding="utf-8") as f:
        f.write("""/* ============================================================================
   Data load - GDX_PSY_ITEM_RESPONSE (raw item-by-item responses)
   Generated dynamically from the current .sav; missing cells are omitted.
   ============================================================================ */

""")
        for _, row in df.iterrows():
            pid = int(row["ID"])
            for column, iid in column_to_item.items():
                if column not in df.columns:
                    continue
                val = fnum(row[column])
                if val is None:
                    continue
                f.write(f"INSERT INTO GDX_PSY_ITEM_RESPONSE (ID_APPLICATION, ID_ITEM, NUMERIC_VALUE) VALUES ({pid}, {iid}, {val});\n")
                n_resp += 1

    # 07 - variable results (bulk, dynamic)
    n_res = 0
    with open(os.path.join(out_dir, "07_load_variable_results.sql"), "w", encoding="utf-8") as f:
        f.write("""/* ============================================================================
   Data load - GDX_PSY_VARIABLE_RESULT (scores computed per dimension)
   Generated dynamically from the current .sav's 21 pre-computed score columns.
   ============================================================================ */

""")
        for _, row in df.iterrows():
            pid = int(row["ID"])
            for column, vid in column_to_variable.items():
                if column not in df.columns:
                    continue
                val = fnum(row[column])
                if val is None:
                    continue
                f.write(f"INSERT INTO GDX_PSY_VARIABLE_RESULT (ID_APPLICATION, ID_VARIABLE, RAW_SCORE) VALUES ({pid}, {vid}, {val});\n")
                n_res += 1

    # 08 - sequence adjustment
    max_person_id = int(df["ID"].max())
    with open(os.path.join(out_dir, "08_adjust_sequences.sql"), "w", encoding="utf-8") as f:
        f.write(f"""/* ============================================================================
   Sequence adjustment after loading with explicit IDs (scripts 01-07).
   Generated dynamically -- RESTART values reflect the current .sav's max ID.
   ============================================================================ */

ALTER SEQUENCE SEQ_GDX_PSY_PERSON RESTART WITH {max_person_id};
ALTER SEQUENCE SEQ_GDX_PSY_APPLICATION RESTART WITH {max_person_id};
ALTER SEQUENCE SEQ_GDX_PSY_INSTRUMENT RESTART WITH {max(catalog.INSTRUMENTS)};
ALTER SEQUENCE SEQ_GDX_PSY_CONSTRUCT RESTART WITH {max(catalog.CONSTRUCTS)};
ALTER SEQUENCE SEQ_GDX_PSY_PHENOMENON RESTART WITH {max(catalog.CONSTRUCTS)};
ALTER SEQUENCE SEQ_GDX_PSY_VARIABLE RESTART WITH {max(catalog.VARIABLES)};
ALTER SEQUENCE SEQ_GDX_PSY_ITEM RESTART WITH {max(items)};
""")

    return dict(persons=df.shape[0], items=len(items), variables=len(catalog.VARIABLES),
                responses=n_resp, variable_results=n_res)


def main():
    parser = argparse.ArgumentParser(description="Dynamically generate the GDX_PSY_* load scripts from the .sav file.")
    parser.add_argument("--sav", default=DEFAULT_SAV, help="Path to the .sav file")
    parser.add_argument("--out-dir", default=DEFAULT_OUT, help="Folder to write the 01-08 .sql files into")
    args = parser.parse_args()

    df = load_sav(args.sav)
    validate_columns(df)
    stats = generate(df, args.out_dir)

    print(f"OK - load scripts written to {args.out_dir}")
    print(f"persons={stats['persons']} items={stats['items']} variables={stats['variables']} "
          f"item_responses={stats['responses']} variable_results={stats['variable_results']}")


if __name__ == "__main__":
    main()
