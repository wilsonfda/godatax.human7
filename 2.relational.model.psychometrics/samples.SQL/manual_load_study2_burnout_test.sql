/* ============================================================================
   Data load - GDX_PSY_STUDY
   "Análise de Estudo 2 — Teste de Burnout".
   Reuses the existing Maslach Burnout Inventory - Student Survey instrument
   (ID_INSTRUMENT=9, ID_CONSTRUCT=9) verbatim -- no new GDX_PSY_INSTRUMENT/
   GDX_PSY_CONSTRUCT/GDX_PSY_VARIABLE/GDX_PSY_INSTRUMENT_ITEM rows are created
   by this script (GDX_SKILL_NEW_STUDY only applies to studies that introduce
   a genuinely new instrument; this one doesn't).

   CORRECTED 2026-10-17: this script originally hardcoded ID_STUDY=2 (not left
   to the SEQ_GDX_PSY_STUDY trigger), on the assumption that the sequence was
   still at 0 and the next insert would otherwise collide with the existing
   ID_STUDY=1 row. That assumption no longer holds -- this script was never
   actually run, and ID_STUDY=2 was since taken by "Purpose Orientation (OT-7)
   - Exploratory Pilot Study", loaded through the normal GDX_SKILL_RECORD_NEW_STUDY
   pipeline (which lets the trigger assign the next free id; the sequence is
   confirmed advancing correctly -- ids 2 through 10 are all taken by later
   studies as of this correction). Hardcoding ID_STUDY=2 here now would either
   fail outright (duplicate PK) or, worse, silently target the wrong row if
   ever run against a differently-sequenced database. Fixed to omit ID_STUDY
   and let the trigger assign it, same as every other GDX_PSY_STUDY insert in
   this project.

   METHOD is intentionally omitted (left NULL): no real design/sample/
   procedure description was given for this field yet -- add it later with a
   plain UPDATE once decided, rather than inventing one now.
   Next step after this row exists: GDX_SKILL_LOAD_NEW_STUDY_ANSWERS to
   enroll participants and load their MBI-SS responses against this study.
   ============================================================================ */

INSERT INTO GDX_PSY_STUDY (TITLE, OBJECTIVE, STATUS)
VALUES ('Análise de Estudo 2 — Teste de Burnout',
        'Identificar quando/se uma pessoa está em estado de estresse (burnout).',
        'PLANNED');
