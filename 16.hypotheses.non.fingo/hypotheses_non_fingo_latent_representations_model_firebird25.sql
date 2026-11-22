/* ============================================================================
   Relational model - Latent Representations (Firebird 2.5)
   New module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_feature_space_model_firebird25.sql (this
   same folder) already applied, AND F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE
   (MFS, this folder's F1 skill) must have already produced at least one
   GDX_HNF_FEATURE_SPACE_RUN with NORMALIZATION_METHOD='ZSCORE' for the study
   in question -- this module has nothing to compute from otherwise.

   This module implements this project's own F2 layer -- "latent
   representations": mapping a per-person normalized feature vector z(t)
   (GDX_HNF_FEATURE_VALUE.NORMALIZED_VALUE, F1's own output) into a smaller,
   learned vector h(t) via a fitted function f_theta: R^n -> R^k, where n is
   the number of input features actually used and k (k << n) is the number of
   learned latent dimensions. Three concrete techniques populate this schema,
   all sharing the exact same GDX_HNF_LATENT_RUN / GDX_HNF_LATENT_DIMENSION /
   GDX_HNF_LATENT_VALUE shape:
     - PCA           (linear: h = W^T (z - mean_z), W^T W = I)
     - AUTOENCODER   (non-linear: h = f_theta(z), reconstruction z_hat =
                       g_phi(h), trained to minimize mean squared
                       reconstruction error)
     - UMAP          (non-linear neighborhood-preserving projection, typically
                       to k=2 for visualization)
   Only GDX_HNF_LATENT_LOADING is method-specific in practice: a fitted linear
   loading (the W matrix) only exists for PCA -- a non-linear encoder has no
   single fixed per-feature coefficient per latent dimension, so this table is
   never populated for AUTOENCODER or UMAP runs (never a fabricated/approximate
   "loading" standing in for something that doesn't exist for that method).

   This schema stores ONLY what F2_GDX_SKILL_LATENT_REPRESENTATIONS (this folder's
   F2 skill) computes and writes. Nothing here duplicates or redefines
   GDX_HNF_FEATURE_DICTIONARY/GDX_HNF_FEATURE_VALUE -- every row here points
   back at the F1 run and the specific input features it was computed from,
   rather than re-describing them.

   Integration with the prior skill (F1/MFS), by design:
     - GDX_HNF_LATENT_RUN.ID_INPUT_RUN is a direct FK into
       GDX_HNF_FEATURE_SPACE_RUN(ID_RUN) -- this module never re-reads
       2.relational.model.psychometrics, 6.cardiac.coherence,
       7.multidimensional.database or 9.knowledge.graph on its own. MFS has
       already read those sources, assembled x(t), and frozen z(t) into
       GDX_HNF_FEATURE_VALUE -- F2 consumes that result, not the lower-level
       sources a second time (same "later skills add their own tables on top
       of GDX_HNF_FEATURE_SPACE_RUN/GDX_HNF_FEATURE_VALUE" intent documented
       in this folder's F1 DDL file).
     - A person contributes at most ONE scalar per (feature, latent run) to
       the input matrix z, even when the underlying F1 run recorded several
       GDX_HNF_FEATURE_VALUE rows for that (person, feature) pair under
       different OBS_GRAIN_KEY values (this happens for the sparse
       physiological perspective -- a person with several cardiac-coherence
       sessions has one NORMALIZED_VALUE row per session for the same HRV
       feature code). F2_GDX_SKILL_LATENT_REPRESENTATIONS reduces that to one
       value per (person, feature) -- the mean of that person's own
       NORMALIZED_VALUE rows for that feature in that run -- before fitting
       any of the three methods, since PCA/an autoencoder/UMAP all require
       exactly one fixed-length vector per training sample (person). This
       reduction is a modeling step performed by the skill script, not
       something this schema represents directly; GDX_HNF_LATENT_VALUE's own
       grain is simply (latent dimension, person) -- one coordinate, already
       reduced.
     - Per this project's CLAUDE.md ("Never invent missing data"), a person
       missing a non-missing value on ANY feature selected for a given latent
       run is excluded from that run entirely (INPUT_SELECTION =
       'COMPLETE_CASES', the only policy this schema allows -- see its CHECK
       constraint below) -- never imputed, never zero-filled, so
       GDX_HNF_LATENT_VALUE.COORDINATE_VALUE is always a real, fitted number,
       with no analogous IS_MISSING flag needed on that table. Which persons
       were dropped, and which candidate features were excluded before
       fitting (e.g. a NOMINAL-scale feature, which these three methods take
       no sensible numeric input from), is reported in
       GDX_HNF_LATENT_RUN.NOTES by the generating skill, not represented as
       its own table -- same convention GDX_HNF_FEATURE_SPACE_RUN.NOTES
       already uses for this kind of free-text transparency.

   Per this project's epistemological rule (CLAUDE.md "Empirical finding !=
   interpretive reading"), every DIMENSION_LABEL this schema stores must stay
   a neutral, ordinal, non-interpretive machine label (e.g. 'PC1', 'LATENT_2',
   'UMAP_1') -- never a semantic name ("Resilience factor") assigned without
   separate validating analysis. This is enforced by the generating skill, not
   by a DB constraint (a CHECK cannot tell a neutral label from an
   interpretive one), so it is written here as a hard rule for any future
   writer of this table.

   Every run is a new, independently versioned snapshot, same discipline as
   GDX_HNF_FEATURE_SPACE_RUN: GDX_HNF_LATENT_RUN is never updated in place.
   Re-running this skill for the same input run and method (more participants,
   a different number of latent dimensions, a different random seed) produces
   a brand-new ID_LATENT_RUN row with its own GDX_HNF_LATENT_DIMENSION/
   GDX_HNF_LATENT_VALUE/GDX_HNF_LATENT_LOADING rows, so every past fit stays
   reproducible and auditable rather than silently overwritten.

   Surrogate keys: every ID_* primary key is BIGINT, assigned by a BEFORE
   INSERT trigger from a dedicated sequence whenever a row is inserted with
   that column left NULL -- same convention as every module added after the
   original base schema (12.gdx.virtology, 4.kundalini.chakras,
   15.environmental.anomalous.phenomena, this folder's own F1 schema). A pure
   membership/junction table (GDX_HNF_LATENT_RUN_FEATURE -- which input
   features were used, and in what order) instead uses a composite primary
   key with no sequence, same shape as GDX_HNF_FEATURE_RUN_MEMBER in the F1
   schema.

   Table prefix: every table below is GDX_HNF_<ENTITY>, same convention as
   this folder's F1 schema (see that file's own header for the full
   GDX_<DOMAIN>_<ENTITY> rationale shared across this project).

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table
   codes instead of the full table name, to stay within Firebird 2.5's
   31-character identifier limit -- same reason and convention as this
   folder's F1 schema:
     LATENT_RUN            -> LRUN
     LATENT_RUN_FEATURE     -> LRFT
     LATENT_DIMENSION         -> LDIM
     LATENT_VALUE               -> LVAL
     LATENT_LOADING                -> LLOD

   This script only creates tables/sequences/triggers/indexes -- no DML.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_LATENT_RUN  (short code: LRUN)
   One row per execution of F2_GDX_SKILL_LATENT_REPRESENTATIONS for one input F1
   run and one method (PCA / AUTOENCODER / UMAP). A single F1 run can have
   many latent runs on top of it (different methods, different k, a re-run
   with a different random seed) -- each its own independent, frozen snapshot.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_LATENT_RUN (
  ID_LATENT_RUN BIGINT NOT NULL,
  ID_INPUT_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  METHOD VARCHAR(20) NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  LATENT_DIMENSION_COUNT INTEGER NOT NULL,
  INPUT_FEATURE_COUNT INTEGER NOT NULL,
  PERSON_COUNT INTEGER NOT NULL,
  INPUT_SELECTION VARCHAR(30) DEFAULT 'COMPLETE_CASES' NOT NULL,
  METHOD_PARAMS BLOB SUB_TYPE TEXT NOT NULL,
  RECONSTRUCTION_LOSS NUMERIC(18,6),
  RANDOM_SEED INTEGER,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_LRUN PRIMARY KEY (ID_LATENT_RUN),
  CONSTRAINT FK_GDX_HNF_LRUN_INPUT FOREIGN KEY (ID_INPUT_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT FK_GDX_HNF_LRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT CK_GDX_HNF_LRUN_METHOD CHECK (METHOD IN ('PCA', 'AUTOENCODER', 'UMAP')),
  -- 'COMPLETE_CASES' is the only value this project allows here, permanently -- not just "the only
  -- one implemented yet". Per CLAUDE.md "Never invent missing data", a person missing a value on
  -- any selected input feature must be excluded from the run, never imputed to fill the matrix.
  CONSTRAINT CK_GDX_HNF_LRUN_SEL CHECK (INPUT_SELECTION IN ('COMPLETE_CASES')),
  CONSTRAINT CK_GDX_HNF_LRUN_DIMS CHECK (LATENT_DIMENSION_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_LRUN_FEATS CHECK (INPUT_FEATURE_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_LRUN_PERSONS CHECK (PERSON_COUNT > 0)
);

CREATE INDEX IX_GDX_HNF_LRUN_INPUT ON GDX_HNF_LATENT_RUN(ID_INPUT_RUN);
CREATE INDEX IX_GDX_HNF_LRUN_STUDY ON GDX_HNF_LATENT_RUN(ID_STUDY);

CREATE SEQUENCE SEQ_GDX_HNF_LRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_LRUN FOR GDX_HNF_LATENT_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_LATENT_RUN IS NULL) THEN
    NEW.ID_LATENT_RUN = NEXT VALUE FOR SEQ_GDX_HNF_LRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_LATENT_RUN_FEATURE  (short code: LRFT)
   Which GDX_HNF_FEATURE_DICTIONARY rows were actually used as input columns
   j=1..n of z(t) for one latent run, and in what order -- not every feature
   in the input F1 run is necessarily eligible (e.g. a NOMINAL-scale feature
   has no sensible numeric input for any of the three methods this schema
   supports), so this cannot be inferred from the input run's own
   GDX_HNF_FEATURE_RUN_MEMBER rows alone. A feature excluded from a given
   latent run simply has no row here -- the reason is reported in that run's
   own GDX_HNF_LATENT_RUN.NOTES, never silently unexplained.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_LATENT_RUN_FEATURE (
  ID_LATENT_RUN BIGINT NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  FEATURE_ORDER INTEGER NOT NULL,
  CONSTRAINT PK_GDX_HNF_LRFT PRIMARY KEY (ID_LATENT_RUN, ID_FEATURE),
  CONSTRAINT FK_GDX_HNF_LRFT_RUN FOREIGN KEY (ID_LATENT_RUN) REFERENCES GDX_HNF_LATENT_RUN(ID_LATENT_RUN),
  CONSTRAINT FK_GDX_HNF_LRFT_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_LRFT_ORDER UNIQUE (ID_LATENT_RUN, FEATURE_ORDER)
);

CREATE INDEX IX_GDX_HNF_LRFT_FEAT ON GDX_HNF_LATENT_RUN_FEATURE(ID_FEATURE);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_LATENT_DIMENSION  (short code: LDIM)
   One row per output dimension k of a latent run (h_1 .. h_k). DIMENSION_LABEL
   must stay a neutral, ordinal machine label (see file header) --
   EXPLAINED_VARIANCE_RATIO is populated ONLY for METHOD='PCA' (the one
   technique here with a well-defined per-component variance share); it stays
   NULL for AUTOENCODER/UMAP rather than a fabricated or approximated number.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_LATENT_DIMENSION (
  ID_LATENT_DIM BIGINT NOT NULL,
  ID_LATENT_RUN BIGINT NOT NULL,
  DIMENSION_ORDER INTEGER NOT NULL,
  DIMENSION_LABEL VARCHAR(60) NOT NULL,
  EXPLAINED_VARIANCE_RATIO NUMERIC(9,6),
  CONSTRAINT PK_GDX_HNF_LDIM PRIMARY KEY (ID_LATENT_DIM),
  CONSTRAINT FK_GDX_HNF_LDIM_RUN FOREIGN KEY (ID_LATENT_RUN) REFERENCES GDX_HNF_LATENT_RUN(ID_LATENT_RUN),
  CONSTRAINT UQ_GDX_HNF_LDIM_ORDER UNIQUE (ID_LATENT_RUN, DIMENSION_ORDER),
  CONSTRAINT CK_GDX_HNF_LDIM_EVR CHECK (EXPLAINED_VARIANCE_RATIO IS NULL OR (EXPLAINED_VARIANCE_RATIO >= 0 AND EXPLAINED_VARIANCE_RATIO <= 1))
);

CREATE SEQUENCE SEQ_GDX_HNF_LDIM;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_LDIM FOR GDX_HNF_LATENT_DIMENSION ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_LATENT_DIM IS NULL) THEN
    NEW.ID_LATENT_DIM = NEXT VALUE FOR SEQ_GDX_HNF_LDIM;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_LATENT_VALUE  (short code: LVAL)
   The fitted h_k(person) coordinate -- one row per (latent dimension,
   person). Always a real, fitted number: COMPLETE_CASES selection (see
   GDX_HNF_LATENT_RUN.INPUT_SELECTION) means a person only ever reaches this
   table after having a real, non-missing value on every input feature
   selected for this run, so there is no IS_MISSING flag here the way
   GDX_HNF_FEATURE_VALUE needs one -- a person either has a full row across
   every dimension of a given latent run, or (excluded upstream) has none at
   all.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_LATENT_VALUE (
  ID_LATENT_VALUE BIGINT NOT NULL,
  ID_LATENT_RUN BIGINT NOT NULL,
  ID_LATENT_DIM BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  COORDINATE_VALUE NUMERIC(18,6) NOT NULL,
  CONSTRAINT PK_GDX_HNF_LVAL PRIMARY KEY (ID_LATENT_VALUE),
  CONSTRAINT FK_GDX_HNF_LVAL_RUN FOREIGN KEY (ID_LATENT_RUN) REFERENCES GDX_HNF_LATENT_RUN(ID_LATENT_RUN),
  CONSTRAINT FK_GDX_HNF_LVAL_DIM FOREIGN KEY (ID_LATENT_DIM) REFERENCES GDX_HNF_LATENT_DIMENSION(ID_LATENT_DIM),
  CONSTRAINT FK_GDX_HNF_LVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_LVAL UNIQUE (ID_LATENT_DIM, ID_PERSON)
);

CREATE INDEX IX_GDX_HNF_LVAL_RUN ON GDX_HNF_LATENT_VALUE(ID_LATENT_RUN);
CREATE INDEX IX_GDX_HNF_LVAL_PERSON ON GDX_HNF_LATENT_VALUE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_HNF_LVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_LVAL FOR GDX_HNF_LATENT_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_LATENT_VALUE IS NULL) THEN
    NEW.ID_LATENT_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_LVAL;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_LATENT_LOADING  (short code: LLOD)
   The fitted W matrix entry (loading of one input feature on one latent
   dimension) -- PCA only. Never populated for METHOD='AUTOENCODER' or
   METHOD='UMAP': neither technique has a single fixed per-feature linear
   coefficient per output dimension, so there is nothing real to store here
   for them (never an approximated stand-in, per CLAUDE.md "Never invent
   missing data"). A large loading has no intrinsic psychological meaning on
   its own -- that interpretation, if any, is a separate, later analysis, not
   something this table asserts.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_LATENT_LOADING (
  ID_LOADING BIGINT NOT NULL,
  ID_LATENT_DIM BIGINT NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  LOADING_VALUE NUMERIC(18,6) NOT NULL,
  CONSTRAINT PK_GDX_HNF_LLOD PRIMARY KEY (ID_LOADING),
  CONSTRAINT FK_GDX_HNF_LLOD_DIM FOREIGN KEY (ID_LATENT_DIM) REFERENCES GDX_HNF_LATENT_DIMENSION(ID_LATENT_DIM),
  CONSTRAINT FK_GDX_HNF_LLOD_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_LLOD UNIQUE (ID_LATENT_DIM, ID_FEATURE)
);

CREATE INDEX IX_GDX_HNF_LLOD_FEAT ON GDX_HNF_LATENT_LOADING(ID_FEATURE);

CREATE SEQUENCE SEQ_GDX_HNF_LLOD;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_LLOD FOR GDX_HNF_LATENT_LOADING ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_LOADING IS NULL) THEN
    NEW.ID_LOADING = NEXT VALUE FOR SEQ_GDX_HNF_LLOD;
END^

SET TERM ; ^

COMMIT;
