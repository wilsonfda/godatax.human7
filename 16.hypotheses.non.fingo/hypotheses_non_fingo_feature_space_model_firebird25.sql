/* ============================================================================
   Relational model - Feature Space (Firebird 2.5)
   New module: 16.hypotheses.non.fingo

   Prerequisite: 2.relational.model.psychometrics/psychometrics_model_firebird25.sql
   already applied (GDX_PSY_PERSON and GDX_PSY_STUDY must exist for the FKs
   below -- same single person identity as every other module, per this
   repo's CLAUDE.md "Common thread: one person identity").

   This module implements this project's own multidimensional
   feature-space mathematical model: x(t) = [Psi, Phi, N, B, A, C, E, M], a
   per-person, per-session feature vector assembled from this project's
   existing relational/BI sources. This first module covers only what
   F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS, this folder's first
   skill) implements -- assembling x(t) and normalizing it (F1,
   "Normalizacao e comparabilidade"). Later skills (F2 latent representations, F3
   distance/similarity, F4 CDI, F6 temporal trajectories, F7 Knowledge
   Graph relations, F8 Virtology layer) will add their own tables on top of
   GDX_HNF_FEATURE_SPACE_RUN/GDX_HNF_FEATURE_VALUE rather than this file
   being extended to cover them -- see that skill's own SKILL.md.

   Why a NEW catalog instead of reusing GDX_PSY_VARIABLE/GDX_PSY_INDICATOR
   directly: those two tables already describe every psychometric
   characteristic, but x(t) = [Psi, Phi, N, B, A, C, E, M] is
   explicitly cross-domain -- physiological HRV fields (6.cardiac.coherence),
   environmental sensor readings (15.environmental.anomalous.phenomena) and
   future perspectives have no equivalent catalog row anywhere today, and a
   psychometric variable's own row has no place to record which *normalized*
   scale, run, or missing-data decision a given feature space used it under.
   GDX_HNF_FEATURE_DICTIONARY is therefore a thin, cross-domain pointer
   catalog (one row per eligible characteristic, whatever its source table
   really is) and GDX_HNF_FEATURE_SPACE_RUN/GDX_HNF_FEATURE_VALUE are where
   the assembled, normalized x(t)/z(t) vectors actually get recorded --
   nothing here duplicates or re-defines a psychometric variable, an HRV
   window, or any other table that already exists.

   SOURCE_ENTITY_ID/SOURCE_ENTITY_TYPE on GDX_HNF_FEATURE_DICTIONARY are a
   deliberate polymorphic pointer (documented, not a real FK): the sources
   a feature can point back to (GDX_PSY_VARIABLE, GDX_CC_HRV_WINDOW's own
   fixed numeric columns, a future GDX_PH_* sensor dimension, a Neo4j node
   property) are different tables in different schemas/databases, so a
   single typed FK is not possible. MFS's own script is
   what resolves this pointer back to a real row/column when it reads raw
   values; a human auditing the catalog reads SOURCE_SCHEMA + SOURCE_TABLE +
   SOURCE_COLUMN directly instead of following a constraint.

   Per this project's epistemological rule (CLAUDE.md "Empirical finding !=
   interpretive reading"): IS_METAPHYSICAL_INTERPRETATION on
   GDX_HNF_FEATURE_DICTIONARY defaults to 0 and must be set to 1 for any
   feature whose value is itself an interpretive/ontological label (a
   chakra, a Thomistic Way, a septenary level) rather than a direct
   measurement or an operationalized psychometric/physiological construct
   -- so a feature space can be filtered back down to "empirical only"
   without re-deriving that distinction every time. MFS never sets this
   flag to 1 on its own in this first version: it only catalogs
   measured/operationalized characteristics (Psi/Phi perspectives), never
   the metaphysical ontologies themselves (M) -- only measurements and
   operationalized variables are represented as features here, never a
   metaphysical category by itself.

   Surrogate keys: every ID_* (or HRV-window-style) primary key is BIGINT,
   assigned by a BEFORE INSERT trigger from a dedicated sequence whenever a
   row is inserted with that column left NULL -- same convention as every
   module added after the original base schema (12.gdx.virtology,
   4.kundalini.chakras, 15.environmental.anomalous.phenomena).

   Table prefix: every table below is GDX_HNF_<ENTITY>, "HNF" standing for
   "Hypotheses Non Fingo" (this folder's name, 16.hypotheses.non.fingo) --
   the same GDX_<DOMAIN>_<ENTITY> convention as GDX_PSY_* (psychometrics),
   GDX_CC_* (cardiac coherence), GDX_TA_* (Thomas Aquinas), GDX_VT_*
   (Virtology) and GDX_PH_* (environmental/anomalous phenomena) elsewhere in
   this project.

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table
   codes instead of the full table name, to stay within Firebird 2.5's
   31-character identifier limit (GDX_HNF_FEATURE_DICTIONARY alone is 26
   chars; SEQ_/BI_ prefixed on top of a constraint name built from it would
   overflow):
     PERSPECTIVE          -> PERS
     FEATURE_DICTIONARY    -> FDIC
     FEATURE_SPACE_RUN      -> FRUN
     FEATURE_RUN_MEMBER      -> FMEM
     FEATURE_VALUE            -> FVAL
     NORMALIZATION_PARAM       -> NPAR

   Perspective symbols are stored as ASCII codes (PSI, PHI, NEURO, BEHAVIOR,
   ENVIRONMENT, CONSCIOUSNESS, ENERGY, METAPHYSICS), not Greek glyphs (Psi,
   Phi) -- this project's Firebird database charset is not guaranteed to
   round-trip non-Latin-1 Unicode safely, and the glyphs add no information
   a stable ASCII code does not already carry. The Greek notation is used
   only in prose (this file's comments, the skill's own SKILL.md), never
   stored in the database.

   This script only creates tables/sequences/triggers/indexes -- no DML. The
   eight GDX_HNF_PERSPECTIVE rows are bootstrapped by MFS
   itself on first run (insert-if-missing), not by this DDL, to stay
   consistent with this project's "skills own their reference data inserts"
   pattern (e.g. DW_DIM_VIRTUE is bootstrapped by GDX_SKILL_LOAD_NEW_STUDY_DW,
   not by godatax_human_dw_model_firebird25.sql).
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_PERSPECTIVE  (short code: PERS)
   Catalog of this model's eight perspectives, x(t) = [Psi, Phi, N, B, A, C, E, M].
   Global reference dimension, bootstrapped once by MFS.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_PERSPECTIVE (
  ID_PERSPECTIVE BIGINT NOT NULL,
  SYMBOL_CODE VARCHAR(20) NOT NULL,
  NAME_PT VARCHAR(80) NOT NULL,
  NAME_EN VARCHAR(80) NOT NULL,
  DESCRIPTION VARCHAR(500),
  IS_DIRECTLY_OPERATIONALIZABLE SMALLINT DEFAULT 1 NOT NULL,
  CONSTRAINT PK_GDX_HNF_PERS PRIMARY KEY (ID_PERSPECTIVE),
  CONSTRAINT UQ_GDX_HNF_PERS_CODE UNIQUE (SYMBOL_CODE),
  CONSTRAINT CK_GDX_HNF_PERS_OPER CHECK (IS_DIRECTLY_OPERATIONALIZABLE IN (0,1))
);

CREATE SEQUENCE SEQ_GDX_HNF_PERS;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_PERS FOR GDX_HNF_PERSPECTIVE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_PERSPECTIVE IS NULL) THEN
    NEW.ID_PERSPECTIVE = NEXT VALUE FOR SEQ_GDX_HNF_PERS;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_FEATURE_DICTIONARY  (short code: FDIC)
   One row per characteristic eligible to enter a feature space, whatever its
   real source table is (GDX_PSY_VARIABLE, a fixed GDX_CC_HRV_WINDOW column,
   a future GDX_PH_* sensor reading, a Neo4j node property, ...). See the
   file header for why SOURCE_ENTITY_ID/SOURCE_ENTITY_TYPE are a documented
   pointer rather than a real FK, and why IS_METAPHYSICAL_INTERPRETATION
   exists.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_FEATURE_DICTIONARY (
  ID_FEATURE BIGINT NOT NULL,
  ID_PERSPECTIVE BIGINT NOT NULL,
  FEATURE_CODE VARCHAR(120) NOT NULL,
  NAME VARCHAR(200) NOT NULL,
  DESCRIPTION VARCHAR(1000),
  FEATURE_TYPE VARCHAR(30) NOT NULL,
  MEASUREMENT_UNIT VARCHAR(40),
  SCALE_DIRECTION VARCHAR(20) DEFAULT 'UNDEFINED' NOT NULL,
  MIN_VALUE NUMERIC(18,6),
  MAX_VALUE NUMERIC(18,6),
  IS_METAPHYSICAL_INTERPRETATION SMALLINT DEFAULT 0 NOT NULL,
  SOURCE_SCHEMA VARCHAR(60) NOT NULL,
  SOURCE_TABLE VARCHAR(60) NOT NULL,
  SOURCE_COLUMN VARCHAR(60),
  SOURCE_ENTITY_TYPE VARCHAR(60),
  SOURCE_ENTITY_ID BIGINT,
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_GDX_HNF_FDIC PRIMARY KEY (ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_FDIC_CODE UNIQUE (FEATURE_CODE),
  CONSTRAINT FK_GDX_HNF_FDIC_PERS FOREIGN KEY (ID_PERSPECTIVE) REFERENCES GDX_HNF_PERSPECTIVE(ID_PERSPECTIVE),
  CONSTRAINT CK_GDX_HNF_FDIC_TYPE CHECK (FEATURE_TYPE IN ('CONTINUOUS','ORDINAL','NOMINAL','TIME_SERIES_SUMMARY')),
  CONSTRAINT CK_GDX_HNF_FDIC_DIR CHECK (SCALE_DIRECTION IN ('HIGHER_BETTER','LOWER_BETTER','NEUTRAL','UNDEFINED')),
  CONSTRAINT CK_GDX_HNF_FDIC_META CHECK (IS_METAPHYSICAL_INTERPRETATION IN (0,1))
);

CREATE INDEX IX_GDX_HNF_FDIC_PERS ON GDX_HNF_FEATURE_DICTIONARY(ID_PERSPECTIVE);
CREATE INDEX IX_GDX_HNF_FDIC_SOURCE ON GDX_HNF_FEATURE_DICTIONARY(SOURCE_SCHEMA, SOURCE_TABLE);

CREATE SEQUENCE SEQ_GDX_HNF_FDIC;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_FDIC FOR GDX_HNF_FEATURE_DICTIONARY ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_FEATURE IS NULL) THEN
    NEW.ID_FEATURE = NEXT VALUE FOR SEQ_GDX_HNF_FDIC;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_FEATURE_SPACE_RUN  (short code: FRUN)
   One row per execution of MFS for one study. A new run
   is always a new row (never overwritten in place) so every past x(t)/z(t)
   assembly stays reproducible and auditable -- normalization parameters
   and references must be versioned and frozen, never silently redefined.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_FEATURE_SPACE_RUN (
  ID_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  OBSERVATION_GRAIN VARCHAR(30) NOT NULL,
  NORMALIZATION_METHOD VARCHAR(20) NOT NULL,
  FEATURE_COUNT INTEGER NOT NULL,
  PERSON_COUNT INTEGER NOT NULL,
  SOURCES_USED VARCHAR(200) NOT NULL,
  INCLUDED_GRAPH_FEATURES SMALLINT DEFAULT 0 NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_FRUN PRIMARY KEY (ID_RUN),
  CONSTRAINT FK_GDX_HNF_FRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT CK_GDX_HNF_FRUN_GRAIN CHECK (OBSERVATION_GRAIN IN ('APPLICATION','CC_SESSION','STUDY_LEVEL','CUSTOM_WINDOW')),
  CONSTRAINT CK_GDX_HNF_FRUN_NORM CHECK (NORMALIZATION_METHOD IN ('ZSCORE','MINMAX','ROBUST','NONE')),
  CONSTRAINT CK_GDX_HNF_FRUN_GRAPH CHECK (INCLUDED_GRAPH_FEATURES IN (0,1))
);

CREATE INDEX IX_GDX_HNF_FRUN_STUDY ON GDX_HNF_FEATURE_SPACE_RUN(ID_STUDY);

CREATE SEQUENCE SEQ_GDX_HNF_FRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_FRUN FOR GDX_HNF_FEATURE_SPACE_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_RUN IS NULL) THEN
    NEW.ID_RUN = NEXT VALUE FOR SEQ_GDX_HNF_FRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_FEATURE_RUN_MEMBER  (short code: FMEM)
   Which GDX_HNF_FEATURE_DICTIONARY rows were actually included in a given
   run, and at which position j in x(t) -- feature availability varies by
   study (not every study has cardiac-coherence data, for instance), so this
   cannot be inferred from the dictionary alone.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_FEATURE_RUN_MEMBER (
  ID_RUN BIGINT NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  FEATURE_ORDER INTEGER NOT NULL,
  CONSTRAINT PK_GDX_HNF_FMEM PRIMARY KEY (ID_RUN, ID_FEATURE),
  CONSTRAINT FK_GDX_HNF_FMEM_RUN FOREIGN KEY (ID_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT FK_GDX_HNF_FMEM_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_FMEM_ORDER UNIQUE (ID_RUN, FEATURE_ORDER)
);

CREATE INDEX IX_GDX_HNF_FMEM_FEAT ON GDX_HNF_FEATURE_RUN_MEMBER(ID_FEATURE);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_FEATURE_VALUE  (short code: FVAL)
   The assembled x_ij(t) (RAW_VALUE/RAW_VALUE_TEXT) and, after F1
   normalization, z_j(t) (NORMALIZED_VALUE) for one person, one feature, one
   observation instant/session (OBS_GRAIN_KEY) within one run. IS_MISSING is
   explicit and NORMALIZED_VALUE stays NULL for a missing raw value -- never
   imputed or zero-filled, per CLAUDE.md "Never invent missing data".
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_FEATURE_VALUE (
  ID_VALUE BIGINT NOT NULL,
  ID_RUN BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  OBS_GRAIN_KEY VARCHAR(60) NOT NULL,
  OBS_INSTANT TIMESTAMP,
  RAW_VALUE NUMERIC(18,6),
  RAW_VALUE_TEXT VARCHAR(200),
  NORMALIZED_VALUE NUMERIC(18,6),
  IS_MISSING SMALLINT DEFAULT 0 NOT NULL,
  MISSING_REASON VARCHAR(200),
  CONSTRAINT PK_GDX_HNF_FVAL PRIMARY KEY (ID_VALUE),
  CONSTRAINT FK_GDX_HNF_FVAL_RUN FOREIGN KEY (ID_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT FK_GDX_HNF_FVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT FK_GDX_HNF_FVAL_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_FVAL UNIQUE (ID_RUN, ID_PERSON, OBS_GRAIN_KEY, ID_FEATURE),
  CONSTRAINT CK_GDX_HNF_FVAL_MISSING CHECK (IS_MISSING IN (0,1))
);

CREATE INDEX IX_GDX_HNF_FVAL_PERSON ON GDX_HNF_FEATURE_VALUE(ID_PERSON);
CREATE INDEX IX_GDX_HNF_FVAL_FEAT ON GDX_HNF_FEATURE_VALUE(ID_FEATURE);
CREATE INDEX IX_GDX_HNF_FVAL_RUN ON GDX_HNF_FEATURE_VALUE(ID_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_FVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_FVAL FOR GDX_HNF_FEATURE_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_VALUE IS NULL) THEN
    NEW.ID_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_FVAL;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_NORMALIZATION_PARAM  (short code: NPAR)
   The frozen parameters (mean/std, min/max, or median/IQR, depending on
   METHOD) used to compute NORMALIZED_VALUE for one feature within one run.
   Kept separate from GDX_HNF_FEATURE_VALUE and never recomputed in place for
   an existing run -- redefining mu/sigma on every observation would make
   the very movement being measured disappear.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_NORMALIZATION_PARAM (
  ID_PARAM BIGINT NOT NULL,
  ID_RUN BIGINT NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  METHOD VARCHAR(20) NOT NULL,
  PARAM_1 NUMERIC(18,6) NOT NULL,
  PARAM_2 NUMERIC(18,6) NOT NULL,
  REFERENCE_SAMPLE VARCHAR(40) NOT NULL,
  SAMPLE_SIZE INTEGER NOT NULL,
  COMPUTED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_GDX_HNF_NPAR PRIMARY KEY (ID_PARAM),
  CONSTRAINT FK_GDX_HNF_NPAR_RUN FOREIGN KEY (ID_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT FK_GDX_HNF_NPAR_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_NPAR UNIQUE (ID_RUN, ID_FEATURE),
  CONSTRAINT CK_GDX_HNF_NPAR_METHOD CHECK (METHOD IN ('ZSCORE','MINMAX','ROBUST')),
  CONSTRAINT CK_GDX_HNF_NPAR_SAMPLE CHECK (REFERENCE_SAMPLE IN ('STUDY_SAMPLE','EXTERNAL_POPULATION','INSTRUMENT_NORM'))
);

CREATE INDEX IX_GDX_HNF_NPAR_FEAT ON GDX_HNF_NORMALIZATION_PARAM(ID_FEATURE);

CREATE SEQUENCE SEQ_GDX_HNF_NPAR;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_NPAR FOR GDX_HNF_NORMALIZATION_PARAM ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_PARAM IS NULL) THEN
    NEW.ID_PARAM = NEXT VALUE FOR SEQ_GDX_HNF_NPAR;
END^

SET TERM ; ^

COMMIT;
