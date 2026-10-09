/* ============================================================================
   Data load - GDX_PSY_STUDY
   Second study: "Análise de Estudo 2 — Teste de Burnout".
   Reuses the existing Maslach Burnout Inventory - Student Survey instrument
   (ID_INSTRUMENT=9, ID_CONSTRUCT=9) verbatim -- no new GDX_PSY_INSTRUMENT/
   GDX_PSY_CONSTRUCT/GDX_PSY_VARIABLE/GDX_PSY_INSTRUMENT_ITEM rows are created
   by this script (GDX_SKILL_NEW_STUDY only applies to studies that introduce
   a genuinely new instrument; this one doesn't).
   ID_STUDY=2 is set explicitly (not left to the SEQ_GDX_PSY_STUDY trigger):
   the existing study (ID_STUDY=1) was itself loaded with an explicit id,
   which never advanced the sequence (GEN_ID(SEQ_GDX_PSY_STUDY, 0) = 0 as of
   this write) -- letting the trigger auto-assign here would collide with the
   existing row's PK=1.
   METHOD is intentionally omitted (left NULL): no real design/sample/
   procedure description was given for this field yet -- add it later with a
   plain UPDATE once decided, rather than inventing one now.
   Next step after this row exists: GDX_SKILL_LOAD_NEW_STUDY_ANSWERS to
   enroll participants and load their MBI-SS responses against this study.
   ============================================================================ */

INSERT INTO GDX_PSY_STUDY (ID_STUDY, TITLE, OBJECTIVE, STATUS)
VALUES (2, 'Análise de Estudo 2 — Teste de Burnout',
        'Identificar quando/se uma pessoa está em estado de estresse (burnout).',
        'PLANNED');
