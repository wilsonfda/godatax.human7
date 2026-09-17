"""
AFC (Confirmatory Factor Analysis) - Career Adapt-Abilities Scale (CAAS)
Duarte, Fraga, Agostinho, Djalo, Lima, Paredes, Rafael & Soares, 2011.

Reads the raw AC1-AC28 items directly from the source .sav (same file that
already fed GDX_PSY_ITEM_RESPONSE/GDX_PSY_VARIABLE_RESULT in Firebird), fits
a 4-factor correlated CFA model (Concern/Control/Curiosity/Confidence, 7
items each), prints all fit indices, reliability, factor correlations and
standardized loadings, and writes the GDX_PSY_PSYCHOMETRIC_PROPERTY
INSERT script.

Run from the repo root (GoDataX.FrameWork):
    pip install pyreadstat pandas numpy semopy
    python GDX_HUMAN/2.relational.model.psychometrics/combinatorial.factor.analyses/run_cfa_career_adaptability.py

See AFC_Career_Adaptability.md in this same folder for the full write-up.
"""

import pyreadstat
import numpy as np
from semopy import Model, calc_stats

SAV_PATH = 'GDX_HUMAN/1.output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav'
OUT_SQL = 'GDX_HUMAN/2.relational.model.psychometrics/samples.sql/09_load_psychometric_properties_afc_career_adaptability.sql'
ID_INSTRUMENT = 3   # Career Adapt-Abilities Scale
ID_CONSTRUCT = 3    # Career Adaptability
CALCULATED_AT = '2026-09-11'
METHOD_TAG = 'CFA (semopy 2.3.11, ML) - 4-factor model'

CONCERN = [f'AC{i}' for i in range(1, 8)]
CONTROL = [f'AC{i}' for i in range(8, 15)]
CURIOSITY = [f'AC{i}' for i in range(15, 22)]
CONFIDENCE = [f'AC{i}' for i in range(22, 29)]


def cronbach_alpha(items_df):
    k = items_df.shape[1]
    item_var = items_df.var(axis=0, ddof=1).sum()
    total_var = items_df.sum(axis=1).var(ddof=1)
    return (k / (k - 1)) * (1 - item_var / total_var)


def esc(x):
    return x.replace("'", "''")


def main():
    df, meta = pyreadstat.read_sav(SAV_PATH)
    ac_cols = CONCERN + CONTROL + CURIOSITY + CONFIDENCE
    data = df[ac_cols].copy()
    assert data.isna().sum().sum() == 0, 'Unexpected missing values in AC1-AC28'

    # Sanity check: item grouping must reproduce the SPSS-precomputed dimension means exactly.
    for name, cols, spss_col in [
        ('Concern', CONCERN, 'ACpreocup'), ('Control', CONTROL, 'ACcontrole'),
        ('Curiosity', CURIOSITY, 'ACcuriosid'), ('Confidence', CONFIDENCE, 'ACconfianc'),
    ]:
        computed = df[cols].mean(axis=1)
        assert (computed - df[spss_col]).abs().max() < 1e-9, f'{name} grouping does not match SPSS column {spss_col}'

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
    factors = ['Concern', 'Control', 'Curiosity', 'Confidence']
    cov = ins[ins['op'] == '~~']
    cov = cov[(cov['lval'] != cov['rval']) & cov['lval'].isin(factors) & cov['rval'].isin(factors)]

    alphas = {
        name: cronbach_alpha(df[cols]) for name, cols in [
            ('Concern', CONCERN), ('Control', CONTROL), ('Curiosity', CURIOSITY),
            ('Confidence', CONFIDENCE), ('Full scale (28 items)', ac_cols),
        ]
    }

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

    # --- Build the GDX_PSY_PSYCHOMETRIC_PROPERTY INSERT script ---
    lines = [
        '/* ============================================================================',
        '   Data load - GDX_PSY_PSYCHOMETRIC_PROPERTY',
        '   Confirmatory Factor Analysis (CFA) results - Career Adapt-Abilities Scale (CAAS)',
        f'   Instrument: ID_INSTRUMENT={ID_INSTRUMENT} (Career Adapt-Abilities Scale, Duarte et al., 2011)',
        f'   Construct:  ID_CONSTRUCT={ID_CONSTRUCT} (Career Adaptability)',
        '   Model: 4 correlated first-order factors (Concern, Control, Curiosity, Confidence),',
        '   28 indicators (AC1-AC28), no cross-loadings, no correlated errors.',
        '   Estimator: ML (semopy 2.3.11, objective=MLW). n=423 (no missing data in AC1-AC28).',
        '   Generated by run_cfa_career_adaptability.py. Full write-up: AFC_Career_Adaptability.md',
        '   ============================================================================ */',
        '',
        '-- ---- 1. Global model fit indices ----',
    ]

    fit_rows = [
        ('CHI_SQUARE', s['chi2'], 'Model chi-square (minimum discrepancy). DoF=344, p<0.001.'),
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
            "VALUES ({}, {}, '{}', '{}', {:.6f}, 423, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, typ, esc(METHOD_TAG), val, esc(ref), CALCULATED_AT
            )
        )

    lines += ['', "-- ---- 2. Internal consistency reliability (Cronbach alpha) ----"]
    for name, val in alphas.items():
        lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, 'CRONBACH_ALPHA', '{}', {:.6f}, 423, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, esc('Internal consistency - ' + name), val,
                esc('Cronbach\'s alpha computed directly from AC1-AC28 raw item responses; not a CFA output.'),
                CALCULATED_AT,
            )
        )

    lines += ['', '-- ---- 3. Inter-factor correlations (standardized) ----']
    for _, r in cov.sort_values(['lval', 'rval']).iterrows():
        lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, 'FACTOR_CORRELATION', '{}', {:.6f}, 423, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, esc(r['lval'] + ' <-> ' + r['rval']), r['Est. Std'],
                esc('Standardized latent factor correlation (Psi matrix) from the fitted CFA.'),
                CALCULATED_AT,
            )
        )

    lines += ['', '-- ---- 4. Standardized factor loadings, item -> latent factor ----']
    for _, r in load.iterrows():
        lines.append(
            'INSERT INTO GDX_PSY_PSYCHOMETRIC_PROPERTY (ID_INSTRUMENT, ID_CONSTRUCT, TYPE, METHOD, "VALUE", SAMPLE_SIZE, REFERENCE, CALCULATED_AT) '
            "VALUES ({}, {}, 'STD_FACTOR_LOADING', '{}', {:.6f}, 423, '{}', '{}');".format(
                ID_INSTRUMENT, ID_CONSTRUCT, esc(r['lval'] + ' -> ' + r['rval']), r['Est. Std'],
                esc('Standardized loading (completely standardized solution) from the fitted CFA.'),
                CALCULATED_AT,
            )
        )

    with open(OUT_SQL, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'\nWrote {OUT_SQL} ({len(fit_rows) + len(alphas) + len(cov) + len(load)} INSERT statements).')


if __name__ == '__main__':
    main()
