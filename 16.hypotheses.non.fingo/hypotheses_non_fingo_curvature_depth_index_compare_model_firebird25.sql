/* ============================================================================
   Relational model - Curvature Depth Index comparison, two spaces (Firebird 2.5)
   Module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql
   (F4, original characteristics) AND
   hypotheses_non_fingo_curvature_depth_index_latent_model_firebird25.sql
   (F4-alternative, latent space) already applied, AND at least one
   GDX_HNF_CDI_RUN and at least one GDX_HNF_CDIH_RUN already exist for the
   study in question -- this module reads both back and never recomputes
   either index itself.

   This module implements F4_CURV_DEPTH_KPI_COMPARE_MODEL: a thin pairing
   layer between this project's two F4 outputs --

     CDIx(t)   written by F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS (original,
                normalized feature space z(t))
     CDIh(t)   written by F4_CURV_DEPTH_KPI_LATENT_SPACE (fitted latent
                space h(t))

   -- for every person present in BOTH a chosen GDX_HNF_CDI_RUN and a chosen
   GDX_HNF_CDIH_RUN of the SAME study. A person present in only one of the
   two runs is excluded from the pairing and counted, never imputed.

   This project's own design document introduces exactly this comparison
   (GoDataX_Human7ph_Matematica_Completo.docx, "7.1. Exemplo numerico
   completo e comparacao") with a single FICTITIOUS pair of numbers and the
   caption "Figura -- Comparacao puramente ficticia de indices em dois
   espacos; valores nao sao uma avaliacao de desempenho", concluding: the two
   indices "nao sao diretamente intercambiaveis" (not directly
   interchangeable) -- they live in different, generally non-comparable
   spaces and scales; a smaller or larger value in one space is never, by
   itself, evidence of improvement, anomaly, or algorithm superiority; "a
   comparacao adequada consiste em testar a estabilidade e a associacao de
   cada indicador a desfechos definidos externamente" (the appropriate
   comparison is to test stability and the ASSOCIATION of each indicator to
   externally defined outcomes). This module freezes the real, paired values
   that make that test possible; it never computes the association itself
   (Pearson r, ranks, representative persons) -- that is this module's own
   GRAPH sibling's job, computed at render time directly from the rows
   frozen here, the same posture every other GRAPH skill in this folder
   already takes toward lightweight, deterministic, non-persisted descriptive
   statistics (e.g. F3's own Pearson r between two real dimensions, computed
   live from already-frozen coordinates, never stored by F3 itself).

   No new index/score is computed here -- this module only PAIRS and FREEZES
   two already-computed scalars per person, plus the run-level bookkeeping
   (how many paired, how many excluded on each side) that would otherwise
   require re-reading both source runs in full every time a comparison is
   rendered.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_COMPARE_RUN  (short code: CCRUN)
   One row per execution of this module's compute script for one study, one
   chosen GDX_HNF_CDI_RUN and one chosen GDX_HNF_CDIH_RUN. Each pairing is its
   own independent, frozen snapshot, never updated in place -- re-running
   against the same two source runs always creates a new GDX_HNF_CDI_COMPARE_RUN
   row, exactly like every other *_RUN table in this folder.
   EXCLUDED_CDI_ONLY_COUNT / EXCLUDED_CDIH_ONLY_COUNT record, by count, every
   person present in exactly one of the two source runs -- never silently
   dropped without being counted (this project's "Never invent missing data"
   rule applies here as "never discard a mismatch without recording it").
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_COMPARE_RUN (
  ID_COMPARE_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  ID_CDI_RUN BIGINT NOT NULL,
  ID_CDIH_RUN BIGINT NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  PAIRED_PERSON_COUNT INTEGER NOT NULL,
  EXCLUDED_CDI_ONLY_COUNT INTEGER DEFAULT 0 NOT NULL,
  EXCLUDED_CDIH_ONLY_COUNT INTEGER DEFAULT 0 NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_CCRUN PRIMARY KEY (ID_COMPARE_RUN),
  CONSTRAINT FK_GDX_HNF_CCRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_CCRUN_CDI FOREIGN KEY (ID_CDI_RUN) REFERENCES GDX_HNF_CDI_RUN(ID_CDI_RUN),
  CONSTRAINT FK_GDX_HNF_CCRUN_CDIH FOREIGN KEY (ID_CDIH_RUN) REFERENCES GDX_HNF_CDIH_RUN(ID_CDIH_RUN),
  CONSTRAINT CK_GDX_HNF_CCRUN_PAIRC CHECK (PAIRED_PERSON_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_CCRUN_EXCCDI CHECK (EXCLUDED_CDI_ONLY_COUNT >= 0),
  CONSTRAINT CK_GDX_HNF_CCRUN_EXCCDIH CHECK (EXCLUDED_CDIH_ONLY_COUNT >= 0)
);

CREATE INDEX IX_GDX_HNF_CCRUN_STUDY ON GDX_HNF_CDI_COMPARE_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_CCRUN_CDI ON GDX_HNF_CDI_COMPARE_RUN(ID_CDI_RUN);
CREATE INDEX IX_GDX_HNF_CCRUN_CDIH ON GDX_HNF_CDI_COMPARE_RUN(ID_CDIH_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_CCRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_CCRUN FOR GDX_HNF_CDI_COMPARE_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_COMPARE_RUN IS NULL) THEN
    NEW.ID_COMPARE_RUN = NEXT VALUE FOR SEQ_GDX_HNF_CCRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_COMPARE_VALUE  (short code: CCVAL)
   One row per (compare run, person) present in BOTH source runs: that
   person's own real CDIx (copied from GDX_HNF_CDI_VALUE) and real CDIh
   (copied from GDX_HNF_CDIH_VALUE), side by side. Deliberately does NOT
   store a rank, a Pearson r, or a "representative person" flag -- those are
   lightweight, deterministic statistics of these two already-frozen numbers,
   computed by this module's GRAPH sibling at render time, never persisted
   (same posture F4's own GRAPH skills already take toward histogram
   mean/median and per-feature RMS contribution ranking).
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_COMPARE_VALUE (
  ID_COMPARE_VALUE BIGINT NOT NULL,
  ID_COMPARE_RUN BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  CDI_VALUE NUMERIC(18,8) NOT NULL,
  CDIH_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_CCVAL PRIMARY KEY (ID_COMPARE_VALUE),
  CONSTRAINT FK_GDX_HNF_CCVAL_RUN FOREIGN KEY (ID_COMPARE_RUN) REFERENCES GDX_HNF_CDI_COMPARE_RUN(ID_COMPARE_RUN),
  CONSTRAINT FK_GDX_HNF_CCVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_CCVAL UNIQUE (ID_COMPARE_RUN, ID_PERSON),
  CONSTRAINT CK_GDX_HNF_CCVAL_CDI_NONNEG CHECK (CDI_VALUE >= 0),
  CONSTRAINT CK_GDX_HNF_CCVAL_CDIH_NONNEG CHECK (CDIH_VALUE >= 0)
);

CREATE INDEX IX_GDX_HNF_CCVAL_RUN ON GDX_HNF_CDI_COMPARE_VALUE(ID_COMPARE_RUN);
CREATE INDEX IX_GDX_HNF_CCVAL_PERSON ON GDX_HNF_CDI_COMPARE_VALUE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_HNF_CCVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_CCVAL FOR GDX_HNF_CDI_COMPARE_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_COMPARE_VALUE IS NULL) THEN
    NEW.ID_COMPARE_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_CCVAL;
END^

SET TERM ; ^

COMMIT;
