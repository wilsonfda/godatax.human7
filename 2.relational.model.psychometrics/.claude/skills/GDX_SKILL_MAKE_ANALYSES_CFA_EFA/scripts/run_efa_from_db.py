"""
EFA (Exploratory Factor Analysis) + descriptive statistics - Career Adapt-Abilities Scale (CAAS)
Duarte, Fraga, Agostinho, Djalo, Lima, Paredes, Rafael & Soares, 2011.

DB-sourced twin of
../../../analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py -- same
4-factor common-factor extraction (sklearn.decomposition.FactorAnalysis,
maximum-likelihood-style, equivalent to Principal Axis Factoring) with
Varimax rotation, same dimension matching by highest mean |loading|, same
item-level loading/mean/SD, dimension-level mean/SD, KMO, Bartlett's test and
Pearson correlation between dimension scores -- but the raw AC1-AC28 items
and the dimension scores (Concern/Control/Curiosity/Confidence) come from a
live Firebird database (via fetch_career_adaptability_items.js, stage 1 of
this skill) instead of the .sav file. See that script and
EFA_Loadings_Means_SD_Career_Adaptability.md (same folder) for the full
write-up of the model itself.

Run from this skill's scripts/ folder, after stage 1:
    node fetch_career_adaptability_items.js
    pip install pandas numpy scipy scikit-learn
    python run_efa_from_db.py
"""

import argparse
import itertools
import os
from datetime import date

import numpy as np
import pandas as pd
from scipy.stats import chi2, pearsonr
from sklearn.decomposition import FactorAnalysis

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ITEMS_CSV = os.path.join(HERE, '..', 'data', 'career_adaptability_items.csv')
DEFAULT_DIMENSIONS_CSV = os.path.join(HERE, '..', 'data', 'career_adaptability_dimension_scores.csv')
DEFAULT_OUT_SQL = os.path.join(HERE, '..', 'output', '10_load_psychometric_properties_efa_means_sd_career_adaptability_from_db.sql')
DEFAULT_OUT_SQL_CORR = os.path.join(HERE, '..', 'output', '11_load_psychometric_properties_pearson_correlation_career_adaptability_from_db.sql')

ID_INSTRUMENT = 3   # Career Adapt-Abilities Scale
ID_CONSTRUCT = 3    # Career Adaptability
METHOD_TAG = 'EFA (sklearn FactorAnalysis, ML extraction, Varimax rotation) - 4-factor model - sourced from Firebird DB'

DIMENSIONS = {
    'Concern': [f'AC{i}' for i in range(1, 8)],
    'Control': [f'AC{i}' for i in range(8, 15)],
    'Curiosity': [f'AC{i}' for i in range(15, 22)],
    'Confidence': [f'AC{i}' for i in range(22, 29)],
}


def esc(x):
    return x.replace("'", "''")


def varimax(phi, gamma=1.0, max_iter=50, tol=1e-6):
    """Kaiser varimax orthogonal rotation (SVD form). phi: (n_items, n_factors) loadings."""
    p, k = phi.shape
    rotation = np.eye(k)
    d = 0.0
    for _ in range(max_iter):
        lam = phi @ rotation
        u, s, vt = np.linalg.svd(
            phi.T @ (lam ** 3 - (gamma / p) * lam @ np.diag(np.diag(lam.T @ lam)))
        )
        rotation = u @ vt
        d_new = np.sum(s)
        if d_new < d * (1 + tol):
            break
        d = d_new
    return phi @ rotation


def kmo_bartlett(data):
    corr = data.corr().values
    p = corr.shape[0]
    n = len(data)

    corr_inv = np.linalg.inv(corr)
    diag = np.sqrt(np.diag(corr_inv))
    partial = -corr_inv / np.outer(diag, diag)
    np.fill_diagonal(partial, 0.0)
    off_corr = corr - np.eye(p)

    sum_r2 = np.sum(off_corr ** 2)
    sum_partial2 = np.sum(partial ** 2)
    kmo_total = sum_r2 / (sum_r2 + sum_partial2)

    sign, logdet = np.linalg.slogdet(corr)
    chi_square = -(n - 1 - (2 * p + 5) / 6) * logdet
    dof = p * (p - 1) / 2
    p_value = chi2.sf(chi_square, dof)
    return kmo_total, chi_square, dof, p_value


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--items-csv', default=DEFAULT_ITEMS_CSV)
    ap.add_argument('--dimensions-csv', default=DEFAULT_DIMENSIONS_CSV)
    ap.add_argument('--out-sql', default=DEFAULT_OUT_SQL)
    ap.add_argument('--out-sql-corr', default=DEFAULT_OUT_SQL_CORR)
    args = ap.parse_args()

    df = pd.read_csv(args.items_csv)
    dim_scores_df = pd.read_csv(args.dimensions_csv).set_index('ID_APPLICATION')
    ac_cols = [c for cols in DIMENSIONS.values() for c in cols]
    data = df[ac_cols].copy()
    assert data.isna().sum().sum() == 0, 'Unexpected missing values in AC1-AC28 (fetch script should have caught this)'
    n = len(data)
    app_ids = df['ID_APPLICATION'].values
    dim_scores_df = dim_scores_df.loc[app_ids].reset_index(drop=True)

    # Sanity check: item grouping must reproduce the DB-precomputed dimension
    # scores (GDX_PSY_VARIABLE_RESULT) exactly.
    for name, cols in DIMENSIONS.items():
        computed = df[cols].mean(axis=1).values
        assert np.abs(computed - dim_scores_df[name].values).max() < 1e-3, (
            f'{name} grouping does not match GDX_PSY_VARIABLE_RESULT (DB dimension score)'
        )

    kmo_total, bartlett_chi2, bartlett_dof, bartlett_p = kmo_bartlett(data)

    fa = FactorAnalysis(n_components=4, rotation=None, random_state=0)
    fa.fit(data.values)
    raw_loadings = fa.components_.T  # (n_items, n_factors)
    rotated = varimax(raw_loadings)
    loadings = pd.DataFrame(rotated, index=ac_cols, columns=[f'Factor{i+1}' for i in range(4)])

    factor_ss = (loadings ** 2).sum(axis=0)          # sum of squared loadings per factor
    factor_prop_var = factor_ss / len(ac_cols)         # proportion of total variance per factor

    # Match each extracted factor to its CAAS dimension by highest mean |loading|
    # over that dimension's known items (grouping already validated above).
    factor_for_dimension = {}
    for name, cols in DIMENSIONS.items():
        mean_abs_loading = loadings.loc[cols].abs().mean(axis=0)
        factor_for_dimension[name] = mean_abs_loading.idxmax()
    assert len(set(factor_for_dimension.values())) == 4, 'Ambiguous factor-to-dimension mapping'

    item_stats = []
    for name, cols in DIMENSIONS.items():
        factor_col = factor_for_dimension[name]
        for item in cols:
            item_stats.append({
                'dimension': name,
                'item': item,
                'loading': loadings.loc[item, factor_col],
                'mean': data[item].mean(),
                'std': data[item].std(ddof=1),
            })
    item_stats = pd.DataFrame(item_stats)

    dim_stats = []
    for name, cols in DIMENSIONS.items():
        dim_scores = dim_scores_df[name]
        dim_stats.append({
            'dimension': name,
            'n_items': len(cols),
            'mean': dim_scores.mean(),
            'std': dim_scores.std(ddof=1),
        })
    dim_stats = pd.DataFrame(dim_stats)

    pearson_rows = []
    for a, b in itertools.combinations(DIMENSIONS.keys(), 2):
        r, p = pearsonr(dim_scores_df[a], dim_scores_df[b])
        pearson_rows.append({'dim_a': a, 'dim_b': b, 'r': r, 'p': p})
    pearson_rows = pd.DataFrame(pearson_rows)

    print(f'=== n={n} (from Firebird, GDX_PSY_ITEM_RESPONSE / GDX_PSY_VARIABLE_RESULT) ===')
    print('=== Sampling adequacy ===')
    print(f'KMO (overall) = {kmo_total:.4f}')
    print(f"Bartlett's test of sphericity: chi2={bartlett_chi2:.4f}  dof={bartlett_dof:.0f}  p={bartlett_p:.6g}")
    print('\n=== Variance explained per factor (dimension), Varimax-rotated ===')
    for name in DIMENSIONS:
        fcol = factor_for_dimension[name]
        print(f"{name} ({fcol}): SS loadings={factor_ss[fcol]:.4f}  % var={factor_prop_var[fcol]*100:.2f}%")
    print('\n=== Item-level factor loading, mean and standard deviation ===')
    for _, r in item_stats.iterrows():
        print(f"[{r['dimension']}] {r['item']}: loading={r['loading']:.4f}  mean={r['mean']:.4f}  sd={r['std']:.4f}")
    print('\n=== Dimension-level mean and standard deviation ===')
    for _, r in dim_stats.iterrows():
        print(f"{r['dimension']} ({r['n_items']:.0f} items): mean={r['mean']:.4f}  sd={r['std']:.4f}")
    print('\n=== Pearson correlation between dimension scores (manifest, not CFA latent) ===')
    for _, r in pearson_rows.iterrows():
        print(f"{r['dim_a']} <-> {r['dim_b']}: r={r['r']:.4f}  p={r['p']:.3g}  n={n}")

    calculated_at = date.today().isoformat()

    # --- Build the GDX_PSY_PSYCHOMETRIC_PROPERTY INSERT script ---
    lines = [
        '/* ============================================================================',
        '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
        '   Exploratory Factor Analysis (EFA) loadings + descriptive statistics',
        '   Career Adapt-Abilities Scale (CAAS)',
        f'   Instrument: ID_INSTRUMENT={ID_INSTRUMENT} (Career Adapt-Abilities Scale, Duarte et al., 2011)',
        f'   Construct:  ID_CONSTRUCT={ID_CONSTRUCT} (Career Adaptability)',
        '   Model: 4 factors (common-factor ML extraction, Varimax rotation),',
        '   28 indicators (AC1-AC28), factors matched to Concern/Control/Curiosity/Confidence',
        "   by highest mean |loading| over each dimension's known items.",
        f'   n={n} (no missing data in AC1-AC28).',
        '   Source: Firebird DB (GDX_PSY_ITEM_RESPONSE / GDX_PSY_VARIABLE_RESULT), not the .sav file --',
        '   see ../../../analyses.EFA/run_efa_loadings_means_sd_career_adaptability.py for the .sav-sourced original.',
        '   Generated by run_efa_from_db.py.',
        '   ============================================================================ */',
        '',
        '-- ---- 1. Sampling adequacy ----',
        'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
        "VALUES ({}, {}, 'KMO', '{}', {:.6f}, {}, '{}', '{}');".format(
            ID_INSTRUMENT, ID_CONSTRUCT, esc(METHOD_TAG), kmo_total, n,
            esc('Kaiser-Meyer-Olkin overall measure of sampling adequacy; >=0.80 meritorious.'), calculated_at,
        ),
        'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
        "VALUES ({}, {}, 'BARTLETT_CHI_SQUARE', '{}', {:.6f}, {}, '{}', '{}');".format(
            ID_INSTRUMENT, ID_CONSTRUCT, esc(METHOD_TAG), bartlett_chi2, n,
            esc(f"Bartlett's test of sphericity chi-square; dof={bartlett_dof:.0f}, p={bartlett_p:.3g}, rejects identity correlation matrix."),
            calculated_at,
        ),
    ]

    lines += ['', '-- ---- 2. Item-level EFA factor loadings, mean and standard deviation (AC1-AC28) ----']
    for _, r in item_stats.iterrows():
        for typ, val, ref in [
            ('EFA_FACTOR_LOADING', r['loading'], f"Varimax-rotated loading of {r['item']} on the {r['dimension']} factor."),
            ('ITEM_MEAN', r['mean'], f"Raw item mean, {r['item']} ({r['dimension']}), 1-5 Likert scale."),
            ('ITEM_STD_DEV', r['std'], f"Raw item standard deviation, {r['item']} ({r['dimension']})."),
        ]:
            lines.append(
                'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
                "VALUES ({}, {}, '{}', '{}', {:.6f}, {}, '{}', '{}');".format(
                    ID_INSTRUMENT, ID_CONSTRUCT, typ, esc(r['item'] + ' -> ' + r['dimension']), val, n, esc(ref), calculated_at
                )
            )

    lines += ['', '-- ---- 3. Dimension-level mean and standard deviation (Concern, Control, Curiosity, Confidence) ----']
    for _, r in dim_stats.iterrows():
        for typ, val, ref in [
            ('DIMENSION_MEAN', r['mean'], f"Mean of the {r['n_items']:.0f}-item {r['dimension']} dimension score (GDX_PSY_VARIABLE_RESULT), 1-5 scale."),
            ('DIMENSION_STD_DEV', r['std'], f"Standard deviation of the {r['dimension']} dimension score (GDX_PSY_VARIABLE_RESULT)."),
        ]:
            lines.append(
                'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
                "VALUES ({}, {}, '{}', '{}', {:.6f}, {}, '{}', '{}');".format(
                    ID_INSTRUMENT, ID_CONSTRUCT, typ, esc(r['dimension']), val, n, esc(ref), calculated_at
                )
            )

    os.makedirs(os.path.dirname(args.out_sql), exist_ok=True)
    with open(args.out_sql, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    total = 2 + len(item_stats) * 3 + len(dim_stats) * 2
    print(f'\nWrote {args.out_sql} ({total} INSERT statements).')

    # --- Separate incremental file: Pearson correlations between dimension scores.
    corr_lines = [
        '/* ============================================================================',
        '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
        '   Pearson linear correlation between the 4 Career Adapt-Abilities Scale dimension',
        '   scores (Concern, Control, Curiosity, Confidence) -- manifest/observed-score',
        '   correlation, NOT the CFA latent factor correlation already stored under',
        '   TYPE=FACTOR_CORRELATION (see 09_load_psychometric_properties_afc_career_adaptability_from_db.sql).',
        f'   Instrument: ID_INSTRUMENT={ID_INSTRUMENT} (Career Adapt-Abilities Scale, Duarte et al., 2011)',
        f'   Construct:  ID_CONSTRUCT={ID_CONSTRUCT} (Career Adaptability)',
        f'   n={n}. Source: Firebird DB. Generated by run_efa_from_db.py.',
        '   ============================================================================ */',
        '',
        '-- ---- 1. Pearson correlation between dimension scores (Concern, Control, Curiosity, Confidence) ----',
    ]
    for _, r in pearson_rows.iterrows():
        ref = (
            f"Pearson r between the manifest {r['dim_a']} and {r['dim_b']} dimension scores "
            f"(GDX_PSY_VARIABLE_RESULT); p={r['p']:.3g}. Not the CFA latent factor correlation (TYPE=FACTOR_CORRELATION)."
        )
        corr_lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, 'PEARSON_CORRELATION', '{}', {:.6f}, {}, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, esc(r['dim_a'] + ' <-> ' + r['dim_b']), r['r'], n, esc(ref), calculated_at
            )
        )
    os.makedirs(os.path.dirname(args.out_sql_corr), exist_ok=True)
    with open(args.out_sql_corr, 'w', encoding='utf-8') as f:
        f.write('\n'.join(corr_lines) + '\n')
    print(f'Wrote {args.out_sql_corr} ({len(pearson_rows)} INSERT statements).')


if __name__ == '__main__':
    main()
