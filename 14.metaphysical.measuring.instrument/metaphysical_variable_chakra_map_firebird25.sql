/* ============================================================================
   Variables/instruments (psychometric or metaphysical) x Kundalini Chakras
   (Firebird 2.5)
   New table for 4.kundalini.chakras/chakras_model_firebird25.sql
   (prerequisite: that script, and 2.relational.model.psychometrics/
   psychometrics_model_firebird25.sql, already applied -- GDX_PSY_CHAKRA,
   GDX_PSY_INSTRUMENT and GDX_PSY_VARIABLE must exist for the FKs below).

   Written in support of GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS
   (14.metaphysical.measuring.instrument/.claude/skills/), which lets a user
   attach a variable (psychometric or metaphysical, GDX_PSY_VARIABLE, any
   VARIABLE_TYPE) to a Septenary Level, a Way of Aquinas, or -- via this new
   table -- a Chakra.

   Design decision: GDX_PSY_CHAKRA (chakras_model_firebird25.sql) is a pure
   7-row catalog (one row per chakra, UNIQUE on ORDER_NUM/SANSKRIT_NAME) --
   unlike GDX_TA_WAY_SEPT_MAP, it was never itself a relation table, so it
   cannot safely be extended in place with nullable instrument/variable
   columns the way GDX_TA_WAY_SEPT_MAP was in
   metaphysical_variable_way_map_firebird25.sql (same folder). Instead this
   script adds a brand-new association table, GDX_PSY_CHAKRA_VAR_MAP, mirroring
   GDX_PSY_SEPT_LEVEL_PSY_MAP's column shape exactly
   (3.septenary.constitution/septenary_constitution_model_firebird25.sql) so
   the three association tables (Septenary, Way, Chakra) stay structurally
   consistent and a single skill can write to any of them with the same
   logic.

   ID_INSTRUMENT / ID_VARIABLE are NULLABLE (INSTRUMENT_LABEL/VARIABLE_LABEL
   are NOT NULL) -- same reasoning as GDX_PSY_SEPT_LEVEL_PSY_MAP: a
   correspondence can be recorded even before (or without) resolving it to a
   real catalog row, with the free-text label preserving the information for
   later reconciliation.
   ============================================================================ */

CREATE TABLE GDX_PSY_CHAKRA_VAR_MAP (
  ID_MAPPING BIGINT NOT NULL,
  ID_CHAKRA BIGINT NOT NULL,
  ID_INSTRUMENT BIGINT,
  INSTRUMENT_LABEL VARCHAR(160) NOT NULL,
  ID_VARIABLE BIGINT,
  VARIABLE_LABEL VARCHAR(150) NOT NULL,
  RECORDED_BEHAVIOR BLOB SUB_TYPE TEXT NOT NULL,
  CORRESPONDENCE_JUSTIFICATION BLOB SUB_TYPE TEXT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL,
  CONSTRAINT PK_GDX_PSY_CHAKRA_VM PRIMARY KEY (ID_MAPPING),
  CONSTRAINT FK_GDX_PSY_CHAKRA_VM_CHAKRA FOREIGN KEY (ID_CHAKRA)
    REFERENCES GDX_PSY_CHAKRA(ID_CHAKRA),
  CONSTRAINT FK_GDX_PSY_CHAKRA_VM_INSTRUMENT FOREIGN KEY (ID_INSTRUMENT)
    REFERENCES GDX_PSY_INSTRUMENT(ID_INSTRUMENT),
  CONSTRAINT FK_GDX_PSY_CHAKRA_VM_VARIABLE FOREIGN KEY (ID_VARIABLE)
    REFERENCES GDX_PSY_VARIABLE(ID_VARIABLE),
  CONSTRAINT UQ_GDX_PSY_CHAKRA_VM UNIQUE (ID_CHAKRA, VARIABLE_LABEL),
  CONSTRAINT CK_GDX_PSY_CHAKRA_VM_CONF CHECK (CONFIDENCE_LEVEL IN ('HIGH','MEDIUM','LOW','SPECULATIVE'))
);

CREATE INDEX IX_GDX_PSY_CHAKRA_VM_CHAKRA ON GDX_PSY_CHAKRA_VAR_MAP(ID_CHAKRA);
CREATE INDEX IX_GDX_PSY_CHAKRA_VM_INSTRUMENT ON GDX_PSY_CHAKRA_VAR_MAP(ID_INSTRUMENT);
CREATE INDEX IX_GDX_PSY_CHAKRA_VM_VARIABLE ON GDX_PSY_CHAKRA_VAR_MAP(ID_VARIABLE);

/* Firebird 2.5: generator and trigger for the surrogate key. */
CREATE SEQUENCE SEQ_GDX_PSY_CHAKRA_VM;

COMMIT;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PSY_CHAKRA_VM FOR GDX_PSY_CHAKRA_VAR_MAP ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_MAPPING IS NULL) THEN
    NEW.ID_MAPPING = NEXT VALUE FOR SEQ_GDX_PSY_CHAKRA_VM;
END^

SET TERM ; ^

COMMIT;
