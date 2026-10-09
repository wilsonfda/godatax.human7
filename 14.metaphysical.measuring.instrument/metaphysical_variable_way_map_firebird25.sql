/* ============================================================================
   Metaphysical variables/instruments x Five Ways (Firebird 2.5)
   Extension of GDX_TA_WAY_SEPT_MAP (5.five.ways.tomas.aquino/five_ways_septenary_map_firebird25.sql)

   Design decision: metaphysical instruments/variables ("Dimensoes Metafisicas",
   "Macro Variaveis Metafisicas") are NOT new tables. They reuse the existing
   GDX_PSY_INSTRUMENT / GDX_PSY_VARIABLE catalog, tagged with
   VARIABLE_TYPE = 'METAPHYSICS' (GDX_PSY_VARIABLE.VARIABLE_TYPE is a free
   VARCHAR(40) with no CHECK constraint -- no DDL change needed there).

   What DOES need a DDL change is GDX_TA_WAY_SEPT_MAP: it only linked a Way to
   a Septenary Level (conceptual mapping, 5 rows, one per Way). To also record
   which instrument/variable/behavior sits at that intersection, this script
   adds the same INSTRUMENT_LABEL/VARIABLE_LABEL/RECORDED_BEHAVIOR free-text
   pattern already used by GDX_PSY_SEPT_LEVEL_PSY_MAP
   (3.septenary.constitution/septenary_constitution_model_firebird25.sql).

   Two deliberate deviations from the GDX_PSY_SEPT_LEVEL_PSY_MAP pattern:

   1) INSTRUMENT_LABEL / VARIABLE_LABEL / RECORDED_BEHAVIOR are NULLABLE here
      (NOT NULL there). GDX_TA_WAY_SEPT_MAP already has 5 rows (the original
      Way<->Level philosophical correspondence) with no instrument/variable
      context -- making these NOT NULL would require fabricating placeholder
      text for them. NULL on those 5 rows means "pure conceptual mapping, no
      concrete instrument attached yet".

   2) UQ_GDX_TA_WSM is redefined from (ID_WAY, ID_SEPTENARY_LEVEL) to
      (ID_WAY, ID_SEPTENARY_LEVEL, VARIABLE_LABEL). The original constraint
      allowed only one row per Way (correct when the table only expressed the
      conceptual mapping), which would block attaching more than one
      metaphysical variable to the same Way. Firebird treats NULL as distinct
      in a unique index, so the 5 original rows (VARIABLE_LABEL NULL) keep
      working unchanged.
   ============================================================================ */

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  ADD ID_INSTRUMENT BIGINT,
  ADD INSTRUMENT_LABEL VARCHAR(160),
  ADD ID_VARIABLE BIGINT,
  ADD VARIABLE_LABEL VARCHAR(150),
  ADD RECORDED_BEHAVIOR BLOB SUB_TYPE TEXT;

COMMIT;

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  ADD CONSTRAINT FK_GDX_TA_WSM_INSTRUMENT FOREIGN KEY (ID_INSTRUMENT)
    REFERENCES GDX_PSY_INSTRUMENT(ID_INSTRUMENT);

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  ADD CONSTRAINT FK_GDX_TA_WSM_VARIABLE FOREIGN KEY (ID_VARIABLE)
    REFERENCES GDX_PSY_VARIABLE(ID_VARIABLE);

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  DROP CONSTRAINT UQ_GDX_TA_WSM;

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  ADD CONSTRAINT UQ_GDX_TA_WSM UNIQUE (ID_WAY, ID_SEPTENARY_LEVEL, VARIABLE_LABEL);

COMMIT;

CREATE INDEX IX_GDX_TA_WSM_INSTRUMENT ON GDX_TA_WAY_SEPT_MAP(ID_INSTRUMENT);
CREATE INDEX IX_GDX_TA_WSM_VARIABLE ON GDX_TA_WAY_SEPT_MAP(ID_VARIABLE);

COMMIT;
