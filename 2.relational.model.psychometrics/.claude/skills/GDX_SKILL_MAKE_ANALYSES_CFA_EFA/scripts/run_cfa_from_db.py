"""
AFC (Confirmatory Factor Analysis) - Career Adapt-Abilities Scale (CAAS)
Duarte, Fraga, Agostinho, Djalo, Lima, Paredes, Rafael & Soares, 2011.

DB-sourced twin of
../../../analyses.CFA/run_cfa_career_adaptability.py -- same 4-factor
correlated CFA model (Concern/Control/Curiosity/Confidence, 7 items each),
same fit indices / reliability / factor correlations / standardized loadings,
but the raw AC1-AC28 items come from a live Firebird database (via
fetch_career_adaptability_items.js, stage 1 of this skill) instead of the
.sav file. See that script and AFC_Career_Adaptability.md (same folder) for
the full write-up of the model itself.

Run from this skill's scripts/ folder, after stage 1:
    node fetch_career_adaptability_items.js
    pip install pandas numpy semopy
    python run_cfa_from_db.py
"""

import argparse
import os
from datetime import date

import numpy as np
import pandas as pd
from semopy import Model, calc_stats

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ITEMS_CSV = os.path.join(HERE, '..', 'data', 'career_adaptability_items.csv')
DEFAULT_DIMENSIONS_CSV = os.path.join(HERE, '..', 'data', 'career_adaptability_dimension_scores.csv')
DEFAULT_OUT_SQL = os.path.join(HERE, '..', 'output', '09_load_psychometric_properties_afc_career_adaptability_from_db.sql')

ID_INSTRUMENT = 3   # Career Adapt-Abilities Scale
ID_CONSTRUCT = 3    # Career Adaptability
METHOD_TAG = 'CFA (semopy 2.3.11, ML) - 4-factor model - sourced from Firebird DB'

CONCERN = [f'AC{i}' for i in range(1, 8)]
CONTROL = [f'AC{i}' for i in range(8, 15)]
CURIOSITY = [f'AC{i}' for i in range(15, 22)]
CONFIDENCE = [f'AC{i}' for i in range(22, 29)]
DIMENSIONS = {'Concern': CONCERN, 'Control': CONTROL, 'Curiosity': CURIOSITY, 'Confidence': CONFIDENCE}


def cronbach_alpha(items_df):
    k = items_df.shape[1]
    item_var = items_df.var(axis=0, ddof=1).sum()
    total_var = items_df.sum(axis=1).var(ddof=1)
    return (k / (k - 1)) * (1 - item_var / total_var)


def esc(x):
    return x.replace("'", "''")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--items-csv', default=DEFAULT_ITEMS_CSV)
    ap.add_argument('--dimensions-csv', default=DEFAULT_DIMENSIONS_CSV)
    ap.add_argument('--out-sql', default=DEFAULT_OUT_SQL)
    args = ap.parse_args()

    df = pd.read_csv(args.items_csv)
    dim_df = pd.read_csv(args.dimensions_csv).set_index('ID_APPLICATION')
    ac_cols = CONCERN + CONTROL + CURIOSITY + CONFIDENCE
    data = df[ac_cols].copy()
    n = len(data)
    assert data.isna().sum().sum() == 0, 'Unexpected missing values in AC1-AC28 (fetch script should have caught this)'

    # Sanity check: item grouping must reproduce the DB-precomputed dimension
    # scores (GDX_PSY_VARIABLE_RESULT) exactly -- same role the SPSS
    # ACpreocup/ACcontrole/ACcuriosid/ACconfianc cross-check plays in the
    # .sav-sourced script.
    app_ids = df['ID_APPLICATION'].values
    for name, cols in DIMENSIONS.items():
        computed = df[cols].mean(axis=1).values
        db_values = dim_df.loc[app_ids, name].values
        assert np.abs(computed - db_values).max() < 1e-3, (
            f'{name} grouping does not match GDX_PSY_VARIABLE_RESULT (DB dimension score)'
        )

    desc = f"""
    Concern =~ {' + '.join(CONCERN)}
    Control =~ {' + '.join(CONTROL)}
    Curiosity =~ {' + '.join(CURIOSITY)}
    Confidence =~ {' + '.join(CONFIDENCE)}
    """
    model = Model(desc)
    model.fit(data)
    stats = calc_stats(model)
    s = stats.iloc[0]

    order = model.vars['observed']
    sample_cov = data[order].cov(ddof=0).values
    sigma, _ = model.calc_sigma()
    diff = sample_cov - sigma
    p = sample_cov.shape[0]
    iu = np.tril_indices(p)
    rmr = float(np.sqrt(np.mean(diff[iu] ** 2)))
    d = np.sqrt(np.diag(sample_cov))
    corr_resid = diff / np.outer(d, d)
    srmr = float(np.sqrt(np.mean(corr_resid[iu] ** 2)))

    ins = model.inspect(std_est=True)
    load = ins[ins['op'] == '~']
    factors = list(DIMENSIONS.keys())
    cov = ins[ins['op'] == '~~']
    cov = cov[(cov['lval'] != cov['rval']) & cov['lval'].isin(factors) & cov['rval'].isin(factors)]

    alphas = {
        name: cronbach_alpha(df[cols]) for name, cols in [
            ('Concern', CONCERN), ('Control', CONTROL), ('Curiosity', CURIOSITY),
            ('Confidence', CONFIDENCE), ('Full scale (28 items)', ac_cols),
        ]
    }

    print(f'=== n={n} (from Firebird, GDX_PSY_ITEM_RESPONSE / GDX_PSY_INSTRUMENT_ITEM) ===')
    print('=== Fit indices ===')
    print(f"chi2={s['chi2']:.4f}  dof={s['DoF']:.0f}  chi2/dof={s['chi2']/s['DoF']:.4f}  p<0.001")
    print(f"CFI={s['CFI']:.4f}  GFI={s['GFI']:.4f}  AGFI={s['AGFI']:.4f}  NFI={s['NFI']:.4f}  TLI={s['TLI']:.4f}")
    print(f"RMSEA={s['RMSEA']:.4f}  RMR={rmr:.4f}  SRMR={srmr:.4f}")
    print(f"AIC={s['AIC']:.4f}  BIC={s['BIC']:.4f}  LogLik={s['LogLik']:.4f}")
    print('\n=== Cronbach alpha ===')
    for k, v in alphas.items():
        print(f'{k}: {v:.4f}')
    print('\n=== Factor correlations (standardized) ===')
    for _, r in cov.sort_values(['lval', 'rval']).iterrows():
        print(f"{r['lval']} <-> {r['rval']}: {r['Est. Std']:.4f}")
    print('\n=== Standardized loadings ===')
    for _, r in load.iterrows():
        print(f"{r['lval']} -> {r['rval']}: {r['Est. Std']:.4f}")

    calculated_at = date.today().isoformat()

    # --- Build the GDX_PSY_PSYCHOMETRIC_PROPERTY INSERT script ---
    lines = [
        '/* ============================================================================',
        '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
        '   Confirmatory Factor Analysis (CFA) results - Career Adapt-Abilities Scale (CAAS)',
        f'   Instrument: ID_INSTRUMENT={ID_INSTRUMENT} (Career Adapt-Abilities Scale, Duarte et al., 2011)',
        f'   Construct:  ID_CONSTRUCT={ID_CONSTRUCT} (Career Adaptability)',
        '   Model: 4 correlated first-order factors (Concern, Control, Curiosity, Confidence),',
        '   28 indicators (AC1-AC28), no cross-loadings, no correlated errors.',
        f'   Estimator: ML (semopy 2.3.11, objective=MLW). n={n} (no missing data in AC1-AC28).',
        '   Source: Firebird DB (GDX_PSY_ITEM_RESPONSE), not the .sav file --',
        '   see ../../../analyses.CFA/run_cfa_career_adaptability.py for the .sav-sourced original.',
        '   Generated by run_cfa_from_db.py.',
        '   ============================================================================ */',
        '',
        '-- ---- 1. Global model fit indices ----',
    ]

    fit_rows = [
        ('CHI_SQUARE', s['chi2'], f"Model chi-square (minimum discrepancy). DoF={s['DoF']:.0f}, p<0.001."),
        ('CHI_SQUARE_DF', s['DoF'], 'Degrees of freedom of the fitted model.'),
        ('CHI_SQUARE_P_VALUE', 0.0, 'p<0.001 (double-precision underflow at this chi2/df).'),
        ('CHI_SQUARE_DF_RATIO', s['chi2'] / s['DoF'], 'Normed chi-square (CMIN/DF); <3 acceptable, <2 good.'),
        ('RMR', rmr, 'Root Mean Square Residual (raw covariance residuals).'),
        ('SRMR', srmr, 'Standardized RMR; <=0.08 acceptable.'),
        ('GFI', s['GFI'], 'Goodness of Fit Index; >=0.90 conventionally acceptable.'),
        ('AGFI', s['AGFI'], 'Adjusted GFI; >=0.90 conventionally acceptable.'),
        ('NFI', s['NFI'], 'Normed Fit Index (Bentler-Bonett); >=0.90 acceptable.'),
        ('TLI', s['TLI'], 'Tucker-Lewis Index; >=0.90 acceptable.'),
        ('CFI', s['CFI'], 'Comparative Fit Index; >=0.90 acceptable, >=0.95 good.'),
        ('RMSEA', s['RMSEA'], 'Root Mean Square Error of Approximation; <=0.08 acceptable, <=0.06 good.'),
        ('AIC', s['AIC'], 'Akaike Information Criterion (comparative use only).'),
        ('BIC', s['BIC'], 'Bayesian Information Criterion (comparative use only).'),
        ('LOG_LIKELIHOOD', s['LogLik'], 'Model log-likelihood at convergence.'),
    ]
    for typ, val, ref in fit_rows:
        lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, '{}', '{}', {:.6f}, {}, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, typ, esc(METHOD_TAG), val, n, esc(ref), calculated_at
            )
        )

    lines += ['', "-- ---- 2. Internal consistency reliability (Cronbach alpha) ----"]
    for name, val in alphas.items():
        lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, 'CRONBACH_ALPHA', '{}', {:.6f}, {}, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, esc('Internal consistency - ' + name), val, n,
                esc('Cronbach\'s alpha computed directly from AC1-AC28 raw item responses (Firebird DB); not a CFA output.'),
                calculated_at,
            )
        )

    lines += ['', '-- ---- 3. Inter-factor correlations (standardized) ----']
    for _, r in cov.sort_values(['lval', 'rval']).iterrows():
        lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, 'FACTOR_CORRELATION', '{}', {:.6f}, {}, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, esc(r['lval'] + ' <-> ' + r['rval']), r['Est. Std'], n,
                esc('Standardized latent factor correlation (Psi matrix) from the fitted CFA.'),
                calculated_at,
            )
        )

    lines += ['', '-- ---- 4. Standardized factor loadings, item -> latent factor ----']
    for _, r in load.iterrows():
        lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, 'STD_FACTOR_LOADING', '{}', {:.6f}, {}, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, esc(r['lval'] + ' -> ' + r['rval']), r['Est. Std'], n,
                esc('Standardized loading (completely standardized solution) from the fitted CFA.'),
                calculated_at,
            )
        )

    os.makedirs(os.path.dirname(args.out_sql), exist_ok=True)
    with open(args.out_sql, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'\nWrote {args.out_sql} ({len(fit_rows) + len(alphas) + len(cov) + len(load)} INSERT statements).')


if __name__ == '__main__':
    main()
