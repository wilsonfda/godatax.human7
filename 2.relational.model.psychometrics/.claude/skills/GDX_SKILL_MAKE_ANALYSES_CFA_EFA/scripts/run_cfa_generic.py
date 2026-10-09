"""
CFA (Confirmatory Factor Analysis) -- generalized, model built dynamically
from structure.json's per-variable item grouping, honestly labeled CONFIRMED
or DISCOVERED per factor.

Unlike run_cfa_from_db.py (CAAS only, hardcoded AC1-7/8-14/15-21/22-28), this
script's model-building has always been generic: any instrument's structure.json
becomes an N-factor model, whatever N and whichever items happen to be. Most
variables across the other 8 multi-item instruments are DISCOVERED, not
exactly confirmed (best match ranges from strong, e.g. Satisfaction With Life
r=0.74-0.80, to weak, e.g. Positivity Ratio r=0.09-0.50 -- see structure.json),
but a variable CAN independently earn CONFIRMED status the same way CAAS's
grouping did (byte-for-byte reproduction of GDX_PSY_VARIABLE_RESULT) without
being CAAS itself -- e.g. MBI-SS's Emotional Exhaustion (ID_INSTRUMENT=9),
confirmed via items 1-5's exact mean once GDX_PSY_VARIABLE_RESULT existed for
it (see GDX_SKILL_LOAD_NEW_STUDY_ANSWERS's SCORE_FORMULAS and
GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/compute_variable_result.js). This script
used to refuse outright whenever every included variable was confirmed,
pointing at the CAAS-only dedicated script instead -- but that script can't
run for any OTHER instrument, so a newly-confirmed non-CAAS variable had
nowhere to go. It no longer refuses on that basis: every row is labeled
CONFIRMED or DISCOVERED (or a mix, for a model spanning both) via each
factor's own `confirmed` flag from structure.json, so nothing confirmed is
ever reported with the same hedging language as something merely discovered,
and nothing discovered is ever reported as if it were confirmed.

Building a CFA on an unconfirmed grouping is still meaningful (the fit
indices themselves tell you how well the discovered items cohere as a
measurement model -- that is exactly what CFA is for), but it must never be
reported as if it were a validated a priori theory.

Only variables with >=3 discovered items are included (fewer than 3
indicators is not a stable single-factor model); an instrument whose
variables lose too many items this way (e.g. Undocumented Organizational
Block: 3 of its 4 named variables ended up with 0 items once Organizational
Anomie claimed all 11) simply omits them, reported clearly, not silently. A
sample too small to fit ANY factor (n < item count + 1, needed for a
non-singular covariance matrix) is refused with a clear message instead of
letting semopy fail with an internal error.

Run from this skill's scripts/ folder, after stage 1:
    node analyze_instrument.js --instrument <ID>
    python run_cfa_generic.py --instrument <ID>
"""

import argparse
import json
import os
import re
from datetime import date

import numpy as np
import pandas as pd
from semopy import Model, calc_stats

HERE = os.path.dirname(os.path.abspath(__file__))
MIN_ITEMS_PER_FACTOR = 3


def esc(x):
    return str(x).replace("'", "''")


def safe_name(name, used):
    base = re.sub(r'[^A-Za-z0-9]+', '_', name).strip('_')
    if not base or base[0].isdigit():
        base = 'F_' + base
    candidate = base
    i = 2
    while candidate in used:
        candidate = f'{base}_{i}'
        i += 1
    used.add(candidate)
    return candidate


def cronbach_alpha(items_df):
    k = items_df.shape[1]
    if k < 2:
        return float('nan')
    item_var = items_df.var(axis=0, ddof=1).sum()
    total_var = items_df.sum(axis=1).var(ddof=1)
    return (k / (k - 1)) * (1 - item_var / total_var)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--instrument', type=int, required=True)
    ap.add_argument('--data-dir', default=os.path.join(HERE, '..', 'data'))
    ap.add_argument('--out-dir', default=os.path.join(HERE, '..', 'output'))
    ap.add_argument('--min-items', type=int, default=MIN_ITEMS_PER_FACTOR)
    args = ap.parse_args()

    items_csv = os.path.join(args.data_dir, f'instrument_{args.instrument}_items.csv')
    structure_json = os.path.join(args.data_dir, f'instrument_{args.instrument}_structure.json')
    with open(structure_json, encoding='utf-8') as f:
        structure = json.load(f)
    instrument_name = structure['instrument']['name']
    prefix = structure['instrument']['prefix']
    id_instrument = structure['instrument']['id']
    id_construct = structure['construct']['id']

    # A CONFIRMED variable (byte-for-byte reproduction of GDX_PSY_VARIABLE_RESULT -- see
    # analyze_instrument.js) gets the exact same CFA math as an unconfirmed/discovered one; the only
    # difference is how honestly each factor's rows are labeled below (per-variable, via v['confirmed']),
    # not whether the model can be fit at all. This used to refuse outright when every variable was
    # confirmed, on the theory that CAAS's own dedicated, hardcoded script (run_cfa_from_db.py) should
    # be used instead -- but that script is CAAS-only (ID_INSTRUMENT=3 hardcoded throughout), so any
    # OTHER instrument that later earns a confirmed variable (e.g. MBI-SS's Emotional Exhaustion) had
    # nowhere to go. This script's model-building was already fully generic (driven by structure.json,
    # not CAAS-specific), so it simply proceeds here instead of refusing.
    df = pd.read_csv(items_csv).set_index('ID_APPLICATION')

    included, excluded = [], []
    for v in structure['variables']:
        if len(v['items']) >= args.min_items:
            included.append(v)
        else:
            excluded.append((v['name'], len(v['items'])))

    if not included:
        raise SystemExit(
            f'Instrument {id_instrument} ("{instrument_name}"): no variable has >= {args.min_items} '
            f'discovered items -- nothing to build a CFA on. Excluded: {excluded}'
        )
    if excluded:
        print(f'Excluding from CFA (fewer than {args.min_items} discovered items): ' +
              ', '.join(f'{name} ({n} item(s))' for name, n in excluded))

    used_names = set()
    factor_map = {}   # semopy-safe name -> {var_name, cols, confirmed}
    for v in included:
        cols = [f'{prefix}{it["itemOrder"]}' for it in v['items']]
        fname = safe_name(v['name'], used_names)
        factor_map[fname] = {'var_name': v['name'], 'cols': cols, 'confirmed': v['confirmed']}

    n_confirmed = sum(1 for f in factor_map.values() if f['confirmed'])
    if n_confirmed == len(factor_map):
        grouping_tag = 'CONFIRMED grouping'
    elif n_confirmed == 0:
        grouping_tag = 'DISCOVERED grouping (not exactly confirmed)'
    else:
        grouping_tag = f'{n_confirmed}/{len(factor_map)} factor(s) CONFIRMED, rest DISCOVERED'

    all_cols = [c for f in factor_map.values() for c in f['cols']]
    data = df[all_cols].copy()
    n = len(data)
    assert data.isna().sum().sum() == 0, 'Unexpected missing values in item CSV'

    if n < len(all_cols) + 1:
        raise SystemExit(
            f'Instrument {id_instrument} ("{instrument_name}"): n={n} application(s) is not enough to fit '
            f'a CFA with {len(all_cols)} observed item(s) across {len(factor_map)} factor(s) -- a sample '
            f'covariance matrix needs at least {len(all_cols) + 1} observations to be non-singular. '
            f'Refusing rather than let semopy fail with an internal IndexError.'
        )

    desc_lines = [f"{fname} =~ {' + '.join(info['cols'])}" for fname, info in factor_map.items()]
    model_desc = '\n'.join(desc_lines)
    print(f'=== Instrument {id_instrument} ("{instrument_name}"): n={n}, {len(factor_map)}-factor CFA, {grouping_tag} ===')
    print(model_desc)

    model = Model(model_desc)
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
    factors = list(factor_map.keys())
    cov = ins[ins['op'] == '~~']
    cov = cov[(cov['lval'] != cov['rval']) & cov['lval'].isin(factors) & cov['rval'].isin(factors)]

    alphas = {info['var_name']: cronbach_alpha(data[info['cols']]) for info in factor_map.values()}
    alphas[f'Included items combined ({len(all_cols)} items, {len(factor_map)} factors)'] = cronbach_alpha(data[all_cols])

    print(f"\nFit: chi2={s['chi2']:.4f} dof={s['DoF']:.0f} chi2/dof={s['chi2']/s['DoF']:.4f}")
    print(f"CFI={s['CFI']:.4f} GFI={s['GFI']:.4f} AGFI={s['AGFI']:.4f} NFI={s['NFI']:.4f} TLI={s['TLI']:.4f}")
    print(f"RMSEA={s['RMSEA']:.4f} RMR={rmr:.4f} SRMR={srmr:.4f}")
    print('\nCronbach alpha:')
    for k, v in alphas.items():
        print(f'  {k}: {v:.4f}')
    print('\nFactor correlations (standardized):')
    for _, r in cov.sort_values(['lval', 'rval']).iterrows():
        print(f"  {factor_map[r['lval']]['var_name']} <-> {factor_map[r['rval']]['var_name']}: {r['Est. Std']:.4f}")
    print('\nStandardized loadings:')
    for _, r in load.iterrows():
        # semopy's inspect(): for "Factor =~ item", op='~' rows come back as
        # lval=item, rval=factor (verified against run_cfa_from_db.py's own
        # 'AC1 -> Concern' convention) -- NOT the other way around.
        print(f"  {r['lval']} -> {factor_map[r['rval']]['var_name']}: {r['Est. Std']:.4f}")

    calculated_at = date.today().isoformat()
    method_tag = f'CFA (semopy, ML) - {len(factor_map)}-factor, {grouping_tag}'
    assert len(method_tag) <= 120

    confirmed_caveat = (
        f'Item grouping independently proven to reproduce GDX_PSY_VARIABLE_RESULT exactly '
        f'(byte-for-byte, same standard as CAAS) -- see instrument_{id_instrument}_structure.json.'
    )
    discovered_caveat = (
        f'Item grouping discovered by item-correlation ranking against GDX_PSY_VARIABLE_RESULT, NOT '
        f'independently proven to reproduce it exactly -- see instrument_{id_instrument}_structure.json. '
        f'This fit reflects how well the discovered items cohere as a model, not a pre-registered a priori theory.'
    )

    def caveat_for(*var_names):
        """CONFIRMED caveat only if every named factor is itself confirmed; DISCOVERED (the more
        cautious claim) otherwise -- a stat spanning one confirmed and one unconfirmed factor (e.g. a
        cross-factor correlation) is only as trustworthy as its least-confirmed half."""
        infos = [f for f in factor_map.values() if f['var_name'] in var_names]
        return confirmed_caveat if infos and all(f['confirmed'] for f in infos) else discovered_caveat

    lines = [
        '/* ============================================================================',
        '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
        f'   Confirmatory Factor Analysis (CFA) - {esc(instrument_name)} - {grouping_tag}',
        f'   Instrument: ID_INSTRUMENT={id_instrument}  Construct: ID_CONSTRUCT={id_construct}',
        f'   Model: {len(factor_map)} factor(s): ' + ', '.join(
            f"{info['var_name']} ({len(info['cols'])} items, {'CONFIRMED' if info['confirmed'] else 'discovered'})"
            for info in factor_map.values()),
        (f'   Excluded (< {args.min_items} discovered items): ' + ', '.join(f'{nm} ({c})' for nm, c in excluded)) if excluded else '   All named variables included.',
        f'   n={n}. Generated by run_cfa_generic.py.',
        '   Each row below is labeled CONFIRMED or DISCOVERED per the factor(s) it involves --',
        '   see structure.json for exactly how a CONFIRMED grouping was independently proven.',
        '   ============================================================================ */',
        '',
        '-- ---- 1. Global model fit indices ----',
    ]

    def insert(typ, val, method, ref, caveat):
        method = str(method)[:120]
        ref = (str(ref) + ' ' + caveat)[:500]
        return (
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, '{}', '{}', {:.6f}, {}, '{}', '{}');".format(
                id_instrument, id_construct, typ, esc(method), val, n, esc(ref), calculated_at
            )
        )

    # Global fit indices describe the WHOLE model (all factors together), so they get the mixed/overall
    # grouping_tag's caveat: CONFIRMED only if every factor in the model is confirmed.
    global_caveat = caveat_for(*[info['var_name'] for info in factor_map.values()])
    fit_rows = [
        ('CHI_SQUARE', s['chi2'], f"Model chi-square. DoF={s['DoF']:.0f}."),
        ('CHI_SQUARE_DF', s['DoF'], 'Degrees of freedom of the fitted model.'),
        ('CHI_SQUARE_DF_RATIO', s['chi2'] / s['DoF'], 'Normed chi-square (CMIN/DF); <3 acceptable, <2 good.'),
        ('RMR', rmr, 'Root Mean Square Residual.'),
        ('SRMR', srmr, 'Standardized RMR; <=0.08 acceptable.'),
        ('GFI', s['GFI'], 'Goodness of Fit Index; >=0.90 conventionally acceptable.'),
        ('AGFI', s['AGFI'], 'Adjusted GFI; >=0.90 conventionally acceptable.'),
        ('NFI', s['NFI'], 'Normed Fit Index; >=0.90 acceptable.'),
        ('TLI', s['TLI'], 'Tucker-Lewis Index; >=0.90 acceptable.'),
        ('CFI', s['CFI'], 'Comparative Fit Index; >=0.90 acceptable, >=0.95 good.'),
        ('RMSEA', s['RMSEA'], 'Root Mean Square Error of Approximation; <=0.08 acceptable, <=0.06 good.'),
        ('AIC', s['AIC'], 'Akaike Information Criterion (comparative use only).'),
        ('BIC', s['BIC'], 'Bayesian Information Criterion (comparative use only).'),
        ('LOG_LIKELIHOOD', s['LogLik'], 'Model log-likelihood at convergence.'),
    ]
    for typ, val, ref in fit_rows:
        lines.append(insert(typ, val, method_tag, ref, global_caveat))

    lines += ['', '-- ---- 2. Internal consistency reliability (Cronbach alpha) ----']
    for name, val in alphas.items():
        # `name` is either one factor's var_name or the "Included items combined (...)" label -- only
        # the former maps to a factor_map entry, so the latter falls back to the global (mixed) caveat.
        row_caveat = caveat_for(name) if name in {f['var_name'] for f in factor_map.values()} else global_caveat
        lines.append(insert('CRONBACH_ALPHA', val, method_tag, f'Internal consistency - {name} (raw items, not a CFA output).', row_caveat))

    if len(factor_map) >= 2:
        lines += ['', '-- ---- 3. Inter-factor correlations (standardized) ----']
        for _, r in cov.sort_values(['lval', 'rval']).iterrows():
            a, b = factor_map[r['lval']]['var_name'], factor_map[r['rval']]['var_name']
            lines.append(insert('FACTOR_CORRELATION', r['Est. Std'], f'{a} <-> {b}', 'Standardized latent factor correlation (Psi matrix) from the fitted CFA.', caveat_for(a, b)))

    lines += ['', '-- ---- 4. Standardized factor loadings, item -> latent factor ----']
    for _, r in load.iterrows():
        var_name = factor_map[r['rval']]['var_name']
        lines.append(insert('STD_FACTOR_LOADING', r['Est. Std'], f"{r['lval']} -> {var_name}", 'Standardized loading (completely standardized solution) from the fitted CFA.', caveat_for(var_name)))

    slug = instrument_name.lower()
    slug = ''.join(c if c.isalnum() else '_' for c in slug).strip('_')[:40]
    out_sql = os.path.join(args.out_dir, f'cfa_instrument_{id_instrument}_{slug}.sql')
    os.makedirs(os.path.dirname(out_sql), exist_ok=True)
    with open(out_sql, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'\nWrote {out_sql} ({len(lines)} lines).')


if __name__ == '__main__':
    main()
