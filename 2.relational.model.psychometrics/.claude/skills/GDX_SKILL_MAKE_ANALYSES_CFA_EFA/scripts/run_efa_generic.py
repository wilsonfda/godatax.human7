"""
EFA (Exploratory Factor Analysis) + descriptive statistics -- generalized,
any instrument.

Generalizes run_efa_from_db.py (CAAS-only) to work off analyze_instrument.js's
output for ANY instrument. The key difference from the CAAS script: that
script's item->dimension grouping is HARDCODED (AC1-7=Concern, ...) because it
was independently verified to exactly reproduce GDX_PSY_VARIABLE_RESULT (see
run_cfa_from_db.py's sanity-check assertion). For every OTHER instrument,
analyze_instrument.js's structure.json shows NO item subset's plain mean
exactly reproduces the stored RAW_SCORE -- confidence varies a lot: e.g.
Satisfaction With Life's / Red Tape's discovered items correlate 0.74-0.86 with
their DB score, Positivity Ratio's only 0.09-0.50. Given that mixed, real
uncertainty, this script never claims a confirmatory (CFA) model for these --
CFA requires an a priori item->factor assignment we do not actually have
confirmed. Instead it runs a purely exploratory extraction (k factors = k
named GDX_PSY_VARIABLE rows this instrument owns), then labels each extracted
factor by its BEST correlation against a named variable's real DB score,
writing that correlation itself into the output (TYPE=FACTOR_MATCH_CORRELATION)
so a weak match (Positivity Ratio) is visibly distinguishable in the data from
a strong one (Satisfaction With Life), not hidden behind a label that implies
confirmation.

Run from this skill's scripts/ folder, after stage 1:
    node analyze_instrument.js --instrument <ID>
    python run_efa_generic.py --instrument <ID>
"""

import argparse
import itertools
import json
import os
from datetime import date

import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment
from scipy.stats import chi2, pearsonr
from sklearn.decomposition import FactorAnalysis

HERE = os.path.dirname(os.path.abspath(__file__))


def esc(x):
    return str(x).replace("'", "''")


def varimax(phi, gamma=1.0, max_iter=50, tol=1e-6):
    """Kaiser varimax orthogonal rotation (SVD form). Returns (rotated_loadings, rotation)."""
    p, k = phi.shape
    rotation = np.eye(k)
    if k == 1:
        return phi.copy(), rotation
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
    return phi @ rotation, rotation


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


def cronbach_alpha(items_df):
    k = items_df.shape[1]
    item_var = items_df.var(axis=0, ddof=1).sum()
    total_var = items_df.sum(axis=1).var(ddof=1)
    return (k / (k - 1)) * (1 - item_var / total_var)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--instrument', type=int, required=True)
    ap.add_argument('--data-dir', default=os.path.join(HERE, '..', 'data'))
    ap.add_argument('--out-dir', default=os.path.join(HERE, '..', 'output'))
    args = ap.parse_args()

    items_csv = os.path.join(args.data_dir, f'instrument_{args.instrument}_items.csv')
    scores_csv = os.path.join(args.data_dir, f'instrument_{args.instrument}_variable_scores.csv')
    structure_json = os.path.join(args.data_dir, f'instrument_{args.instrument}_structure.json')
    with open(structure_json, encoding='utf-8') as f:
        structure = json.load(f)
    instrument_name = structure['instrument']['name']
    id_instrument = structure['instrument']['id']

    df = pd.read_csv(items_csv).set_index('ID_APPLICATION')
    scores_df = pd.read_csv(scores_csv).set_index('ID_APPLICATION')
    item_cols = list(df.columns)
    n_items = len(item_cols)
    var_names = list(scores_df.columns)
    k = len(var_names)
    id_construct = structure['construct']['id']

    common_ids = df.index.intersection(scores_df.index)
    data = df.loc[common_ids, item_cols].copy()
    scores_df = scores_df.loc[common_ids]
    n = len(data)
    assert data.isna().sum().sum() == 0, 'Unexpected missing values in item CSV'
    any_confirmed = any(v['confirmed'] for v in structure['variables'])
    if any_confirmed:
        raise SystemExit(
            f'Instrument {id_instrument} has a CONFIRMED variable in structure.json -- use the '
            f'CAAS-style CFA+EFA scripts (hardcoded grouping) for that variable instead of this '
            f'generic, confirmation-agnostic EFA-only script.'
        )

    kmo_total, bartlett_chi2, bartlett_dof, bartlett_p = kmo_bartlett(data)

    fa = FactorAnalysis(n_components=k, rotation=None, random_state=0)
    fa.fit(data.values)
    raw_loadings = fa.components_.T
    rotated, rotation = varimax(raw_loadings)
    loadings = pd.DataFrame(rotated, index=item_cols, columns=[f'Factor{i+1}' for i in range(k)])

    factor_ss = (loadings ** 2).sum(axis=0)
    factor_prop_var = factor_ss / n_items

    # Factor scores consistent with the rotated loadings: sklearn's .transform()
    # gives scores for the UNrotated solution, so apply the same orthogonal
    # rotation matrix to them (valid because varimax is orthogonal: if
    # Loadings_rot = Loadings_raw @ R then Scores_rot = Scores_raw @ R).
    raw_scores = fa.transform(data.values)
    factor_scores = raw_scores @ rotation
    factor_scores = pd.DataFrame(factor_scores, index=data.index, columns=loadings.columns)

    # Best-effort factor <-> named-variable matching by score correlation
    # (Hungarian assignment on the |corr| matrix so no two variables claim the
    # same factor) -- NOT a claim that item membership is confirmed, only that
    # this factor's score tracks that variable's real DB score better than any
    # other extracted factor does.
    corr_matrix = np.zeros((k, k))
    for i, var in enumerate(var_names):
        for j, fcol in enumerate(loadings.columns):
            corr_matrix[i, j] = pearsonr(scores_df[var], factor_scores[fcol])[0]
    row_ind, col_ind = linear_sum_assignment(-np.abs(corr_matrix))
    factor_for_var = {var_names[i]: loadings.columns[j] for i, j in zip(row_ind, col_ind)}
    match_corr = {var_names[i]: corr_matrix[i, j] for i, j in zip(row_ind, col_ind)}

    alpha_full = cronbach_alpha(data)

    print(f'=== Instrument {id_instrument} ("{instrument_name}"): n={n}, {n_items} items, {k} named variable(s) ===')
    print('=== Sampling adequacy (whole instrument) ===')
    print(f'KMO = {kmo_total:.4f}   Bartlett chi2={bartlett_chi2:.4f} dof={bartlett_dof:.0f} p={bartlett_p:.3g}')
    print(f'Cronbach alpha (full {n_items}-item scale) = {alpha_full:.4f}')
    print('\n=== Factor <-> named-variable best-effort match (Hungarian on |corr|) ===')
    for var, fcol in factor_for_var.items():
        r = match_corr[var]
        flag = 'weak' if abs(r) < 0.5 else ('moderate' if abs(r) < 0.7 else 'strong')
        print(f'{var} <- {fcol}: r={r:.4f} ({flag} match) SS={factor_ss[fcol]:.4f} %var={factor_prop_var[fcol]*100:.2f}%')
    print('\n=== Item-level loadings on their matched factor, mean, SD ===')
    for item in item_cols:
        row = loadings.loc[item]
        best_fcol = row.abs().idxmax()
        print(f'{item}: loading(best)={row[best_fcol]:.4f} on {best_fcol}  mean={data[item].mean():.4f}  sd={data[item].std(ddof=1):.4f}')

    pearson_rows = []
    if k >= 2:
        print('\n=== Pearson correlation between named variables (manifest DB scores) ===')
        for a, b in itertools.combinations(var_names, 2):
            r, p = pearsonr(scores_df[a], scores_df[b])
            pearson_rows.append({'a': a, 'b': b, 'r': r, 'p': p})
            print(f'{a} <-> {b}: r={r:.4f} p={p:.3g}')

    calculated_at = date.today().isoformat()
    id_instrument_sql = id_instrument
    method_tag = (
        # METHOD is VARCHAR(120) in the schema -- keep this short; the full caveat
        # goes in each row's own REFERENCE (VARCHAR(500)) instead, per insert().
        f'EFA (sklearn FactorAnalysis, Varimax) - whole-instrument, {k}-factor exploratory (unconfirmed grouping)'
    )
    unconfirmed_caveat = (
        f'Item-to-variable membership NOT confirmed against GDX_PSY_VARIABLE_RESULT -- see '
        f'GDX_SKILL_MAKE_ANALYSES_CFA_EFA/data/instrument_{id_instrument}_structure.json. '
        f'Factor label is a best-effort match by extracted-factor-score correlation, not a validated model.'
    )
    assert len(method_tag) <= 120, f'METHOD exceeds VARCHAR(120): {len(method_tag)} chars'

    lines = [
        '/* ============================================================================',
        '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
        f'   Exploratory Factor Analysis (EFA) + descriptive statistics - {esc(instrument_name)}',
        f'   Instrument: ID_INSTRUMENT={id_instrument}',
        f'   Generated by run_efa_generic.py. n={n}. {n_items} items, {k} named variable(s).',
        '   NOTE: unlike the Career Adapt-Abilities Scale (ID_INSTRUMENT=3), no item subset for',
        '   this instrument was found to exactly reproduce its GDX_PSY_VARIABLE_RESULT score --',
        '   see structure.json for the discovery attempt and its discrepancies. This is a purely',
        '   exploratory extraction; factor-to-variable labels are best-effort correlation matches,',
        '   NOT a confirmed a priori measurement model. No CFA was run for this instrument.',
        '   ============================================================================ */',
        '',
        '-- ---- 1. Sampling adequacy + reliability (whole instrument) ----',
    ]

    fit_rows = [
        ('KMO', kmo_total, 'Kaiser-Meyer-Olkin overall measure of sampling adequacy; >=0.80 meritorious.'),
        ('BARTLETT_CHI_SQUARE', bartlett_chi2, f"Bartlett's test of sphericity chi-square; dof={bartlett_dof:.0f}, p={bartlett_p:.3g}."),
        ('CRONBACH_ALPHA', alpha_full, f'Internal consistency, full {n_items}-item scale (no subscale split -- membership unconfirmed).'),
    ]

    def insert(typ, val, method, ref):
        # METHOD/REFERENCE are VARCHAR(120)/VARCHAR(500) in the schema -- truncate
        # defensively rather than let a long instrument/variable name overflow and
        # abort the whole load partway through.
        method = str(method)[:120]
        ref = str(ref)[:500]
        return (
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, '{}', '{}', {:.6f}, {}, '{}', '{}');".format(
                id_instrument_sql, id_construct, typ, esc(method), val, n, esc(ref), calculated_at
            )
        )

    for typ, val, ref in fit_rows:
        lines.append(insert(typ, val, method_tag, f'{ref} {unconfirmed_caveat}'))

    lines += ['', '-- ---- 2. Best-effort factor <-> named-variable match strength ----']
    for var, fcol in factor_for_var.items():
        r = match_corr[var]
        lines.append(insert(
            'FACTOR_MATCH_CORRELATION', r, f'{var} <- {fcol}',
            f'Correlation between this exploratory factor\'s score and {var}\'s real GDX_PSY_VARIABLE_RESULT score; '
            f'the strength of this number IS the confidence in the label, not an assumed fact.'
        ))

    lines += ['', '-- ---- 3. Item-level EFA loading (on best-effort matched factor), mean, SD ----']
    fcol_to_var = {fcol: var for var, fcol in factor_for_var.items()}
    for item in item_cols:
        row = loadings.loc[item]
        best_fcol = row.abs().idxmax()
        matched_var = fcol_to_var.get(best_fcol, best_fcol)
        lines.append(insert('EFA_FACTOR_LOADING', row[best_fcol], f'{item} -> {matched_var}',
                             f'Varimax-rotated loading of {item} on the factor best-effort-matched to {matched_var}.'))
        lines.append(insert('ITEM_MEAN', data[item].mean(), f'{item} -> {matched_var}', f'Raw item mean, {item}.'))
        lines.append(insert('ITEM_STD_DEV', data[item].std(ddof=1), f'{item} -> {matched_var}', f'Raw item standard deviation, {item}.'))

    lines += ['', '-- ---- 4. Named-variable mean/SD (from GDX_PSY_VARIABLE_RESULT directly -- independent of item grouping) ----']
    for var in var_names:
        lines.append(insert('DIMENSION_MEAN', scores_df[var].mean(), var,
                             f'Mean of {var}, read directly from GDX_PSY_VARIABLE_RESULT (not recomputed from raw items).'))
        lines.append(insert('DIMENSION_STD_DEV', scores_df[var].std(ddof=1), var,
                             f'Standard deviation of {var}, read directly from GDX_PSY_VARIABLE_RESULT.'))

    slug = instrument_name.lower().replace(' ', '_').replace('/', '_')
    slug = ''.join(c for c in slug if c.isalnum() or c == '_')[:40]
    out_sql = os.path.join(args.out_dir, f'efa_instrument_{id_instrument}_{slug}.sql')
    os.makedirs(os.path.dirname(out_sql), exist_ok=True)
    with open(out_sql, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'\nWrote {out_sql} ({len(lines)} lines).')

    if pearson_rows:
        corr_lines = [
            '/* ============================================================================',
            '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
            f'   Pearson correlation between named variables - {esc(instrument_name)}',
            f'   Instrument: ID_INSTRUMENT={id_instrument}. Manifest/observed DB scores, not CFA latent.',
            f'   n={n}. Generated by run_efa_generic.py.',
            '   ============================================================================ */',
            '',
        ]
        for r in pearson_rows:
            corr_lines.append(insert('PEARSON_CORRELATION', r['r'], f"{r['a']} <-> {r['b']}",
                                      f"Pearson r between the manifest {r['a']} and {r['b']} DB scores; p={r['p']:.3g}."))
        out_corr = os.path.join(args.out_dir, f'efa_instrument_{id_instrument}_{slug}_pearson_correlation.sql')
        with open(out_corr, 'w', encoding='utf-8') as f:
            f.write('\n'.join(corr_lines) + '\n')
        print(f'Wrote {out_corr} ({len(corr_lines)} lines).')


if __name__ == '__main__':
    main()
