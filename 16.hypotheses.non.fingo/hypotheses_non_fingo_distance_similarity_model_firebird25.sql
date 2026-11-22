/* ============================================================================
   Relational model - Distance / Similarity between profiles (Firebird 2.5)
   New module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_feature_space_model_firebird25.sql (this
   same folder, F1's own DDL) already applied, AND
   F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS) must have already produced
   at least one GDX_HNF_FEATURE_SPACE_RUN with NORMALIZATION_METHOD='ZSCORE' for
   the study in question. Optionally, hypotheses_non_fingo_latent_representations_
   model_firebird25.sql (this folder, F2's own DDL) already applied AND
   F2_GDX_SKILL_LATENT_REPRESENTATIONS has already produced at least one
   GDX_HNF_LATENT_RUN, when a distance run is computed in the latent space
   instead of the original normalized feature space.

   This module implements this project's own F3 layer -- "distance and
   similarity between profiles": for any two per-person profile vectors u and v
   of the same dimension (either F1's own normalized z(t) or F2's own learned
   h(t)), three concrete, versioned metrics are computed and recorded between
   every pair of persons in a run's own complete-case sample:

     - EUCLIDEAN    dE(u,v)   = sqrt( sum_j (u_j - v_j)^2 )
     - RMS          dRMS(u,v) = sqrt( (1/n) * sum_j (u_j - v_j)^2 )
                               = dE(u,v) / sqrt(n)   (same ordering as dE for a
                               fixed n -- only the scale changes)
     - MAHALANOBIS  dM(u,v)   = sqrt( (u - v)^T * Sigma^-1 * (u - v) )
                               where Sigma is the sample covariance matrix of
                               the run's own complete-case profile vectors

   This schema stores ONLY what F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES (this
   folder's F3 skill) computes and writes. It never duplicates or redefines
   GDX_HNF_FEATURE_SPACE_RUN/GDX_HNF_FEATURE_VALUE (F1) or GDX_HNF_LATENT_RUN/
   GDX_HNF_LATENT_DIMENSION/GDX_HNF_LATENT_VALUE (F2) -- a distance run only
   ever points back at one of those two already-frozen snapshots and records
   which of their rows (features or latent dimensions) actually composed the
   compared vectors, never re-describing the vectors themselves.

   Integration with the two prior skills (F1/MFS, F2), by design:
     - GDX_HNF_DISTANCE_RUN.ID_INPUT_FEATURE_RUN is a direct FK into
       GDX_HNF_FEATURE_SPACE_RUN(ID_RUN) (SPACE_KIND='FEATURE_SPACE'), and
       GDX_HNF_DISTANCE_RUN.ID_INPUT_LATENT_RUN is a direct FK into
       GDX_HNF_LATENT_RUN(ID_LATENT_RUN) (SPACE_KIND='LATENT') -- exactly one
       of the two is populated per run (see CK_GDX_HNF_DRUN_PTR below). This
       module never re-reads 2.relational.model.psychometrics,
       6.cardiac.coherence, 7.multidimensional.database or 9.knowledge.graph on
       its own, and never re-fits a latent representation on its own -- F1 and
       F2 have already done that work and frozen it; F3 only ever compares
       vectors the two of them already produced. "Reading the relational/BI/
       graph sources" for F3 is therefore satisfied *transitively*, through an
       already-run F1 ZSCORE run (and, optionally, an already-run F2 latent
       run) -- same posture F2_GDX_SKILL_LATENT_REPRESENTATIONS's own DDL file
       already documents one layer down.
     - A distance run is always computed over exactly one input run's own
       complete-case sample for the dimensions actually selected for it (see
       GDX_HNF_DISTANCE_DIMENSION below) -- never a different selection per
       pair, so every pairwise distance in one run is directly comparable to
       every other pairwise distance in that same run.
     - Per this project's CLAUDE.md ("Never invent missing data"), a person
       missing a non-missing value on ANY dimension selected for a given
       distance run is excluded from that run entirely (INPUT_SELECTION =
       'COMPLETE_CASES', the only policy this schema allows -- same convention
       and CHECK constraint shape as GDX_HNF_LATENT_RUN.INPUT_SELECTION in F2)
       -- never imputed, never zero-filled.

   Why a run is pairwise between persons, never a distance to a single fixed
   reference profile: this layer (F3, "distance and similarity between
   profiles") is deliberately kept distinct from a later, separate skill that
   will compute a single scalar deviation index against an explicit reference
   baseline (individual, populational or normative) -- a materially different
   and more consequential design decision (what counts as "the center" a
   distance is measured from) that belongs to its own run type, its own schema,
   and its own explicit references, not folded into this one. F3 only ever
   answers "how far apart are these two observed profiles", nothing else.

   Mahalanobis and the covariance matrix: Sigma is estimated from the SAME
   complete-case sample a run's pairwise distances are computed over (the only
   policy this schema allows -- see CK_GDX_HNF_DRUN_COVSRC below), using the
   unbiased sample covariance (divisor person_count - 1). A covariance matrix
   estimated from few persons relative to the number of dimensions can be
   singular or near-singular, in which case its naive inverse is unusable --
   GDX_HNF_DISTANCE_RUN.COVARIANCE_REGULARIZATION records whether (and how)
   this was corrected before inversion (currently 'NONE' or
   'SHRINKAGE_DIAGONAL', a convex combination of Sigma with its own diagonal,
   weighted by REGULARIZATION_LAMBDA in [0,1]) rather than silently returning a
   degenerate or fabricated distance. CONDITION_NUMBER_BEFORE_REG/
   CONDITION_NUMBER_AFTER_REG are diagnostic only (never used to alter a
   distance value after the fact) so a human auditing a Mahalanobis run can see
   exactly how ill-conditioned the raw covariance estimate was. These three
   columns, and GDX_HNF_DISTANCE_COVARIANCE entirely, are only ever populated
   for METRIC='MAHALANOBIS' -- they stay NULL / have no rows for a EUCLIDEAN or
   RMS run, which needs no covariance estimate at all.

   Every run is a new, independently versioned snapshot, same discipline as
   GDX_HNF_FEATURE_SPACE_RUN/GDX_HNF_LATENT_RUN: GDX_HNF_DISTANCE_RUN is never
   updated in place. Re-running this skill for the same input run and metric
   (a different --feature/--dims selection, a different regularization choice)
   produces a brand-new ID_DISTANCE_RUN row with its own GDX_HNF_DISTANCE_
   DIMENSION/GDX_HNF_DISTANCE_COVARIANCE/GDX_HNF_DISTANCE_VALUE rows, so every
   past comparison stays reproducible and auditable rather than silently
   overwritten.

   Surrogate keys: GDX_HNF_DISTANCE_RUN and GDX_HNF_DISTANCE_VALUE use a BIGINT
   primary key assigned by a BEFORE INSERT trigger from a dedicated sequence
   whenever inserted with that column left NULL -- same convention as every
   module added after the original base schema. GDX_HNF_DISTANCE_DIMENSION and
   GDX_HNF_DISTANCE_COVARIANCE are pure membership/matrix-entry tables and
   instead use a composite primary key with no sequence, same shape as
   GDX_HNF_FEATURE_RUN_MEMBER (F1) and GDX_HNF_LATENT_RUN_FEATURE (F2).

   Table prefix: every table below is GDX_HNF_<ENTITY>, same convention as this
   folder's F1/F2 schemas (see either file's own header for the full
   GDX_<DOMAIN>_<ENTITY> rationale shared across this project).

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table
   codes instead of the full table name, to stay within Firebird 2.5's
   31-character identifier limit -- same reason and convention as this
   folder's F1/F2 schemas:
     DISTANCE_RUN         -> DRUN
     DISTANCE_DIMENSION    -> DDIM
     DISTANCE_COVARIANCE    -> DCOV
     DISTANCE_VALUE            -> DVAL

   This script only creates tables/sequences/triggers/indexes -- no DML.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_DISTANCE_RUN  (short code: DRUN)
   One row per execution of F3_GDX_SKILL_DISTANCE_SIMILARITY_PROFILES for one
   input run (an F1 feature-space run or an F2 latent run), one metric
   (EUCLIDEAN / RMS / MAHALANOBIS). A single input run can have many distance
   runs on top of it (different metrics, a different --feature/--dims
   selection, a different regularization choice for Mahalanobis) -- each its
   own independent, frozen snapshot.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_DISTANCE_RUN (
  ID_DISTANCE_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  SPACE_KIND VARCHAR(20) NOT NULL,
  ID_INPUT_FEATURE_RUN BIGINT,
  ID_INPUT_LATENT_RUN BIGINT,
  METRIC VARCHAR(20) NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  INPUT_SELECTION VARCHAR(30) DEFAULT 'COMPLETE_CASES' NOT NULL,
  DIMENSION_COUNT INTEGER NOT NULL,
  PERSON_COUNT INTEGER NOT NULL,
  PAIR_COUNT INTEGER NOT NULL,
  COVARIANCE_SOURCE VARCHAR(30),
  COVARIANCE_REGULARIZATION VARCHAR(20),
  REGULARIZATION_LAMBDA NUMERIC(18,8),
  CONDITION_NUMBER_BEFORE_REG NUMERIC(18,6),
  CONDITION_NUMBER_AFTER_REG NUMERIC(18,6),
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_DRUN PRIMARY KEY (ID_DISTANCE_RUN),
  CONSTRAINT FK_GDX_HNF_DRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_DRUN_FSPACE FOREIGN KEY (ID_INPUT_FEATURE_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT FK_GDX_HNF_DRUN_LATENT FOREIGN KEY (ID_INPUT_LATENT_RUN) REFERENCES GDX_HNF_LATENT_RUN(ID_LATENT_RUN),
  CONSTRAINT CK_GDX_HNF_DRUN_SPACE CHECK (SPACE_KIND IN ('FEATURE_SPACE','LATENT')),
  -- Exactly one of the two input-run pointers is populated, matching SPACE_KIND -- never both,
  -- never neither (see file header: a distance run always points at exactly one already-frozen
  -- F1 or F2 snapshot).
  CONSTRAINT CK_GDX_HNF_DRUN_PTR CHECK (
    (SPACE_KIND = 'FEATURE_SPACE' AND ID_INPUT_FEATURE_RUN IS NOT NULL AND ID_INPUT_LATENT_RUN IS NULL) OR
    (SPACE_KIND = 'LATENT' AND ID_INPUT_LATENT_RUN IS NOT NULL AND ID_INPUT_FEATURE_RUN IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_DRUN_METRIC CHECK (METRIC IN ('EUCLIDEAN','RMS','MAHALANOBIS')),
  -- 'COMPLETE_CASES' is the only value this project allows here, permanently -- not just "the
  -- only one implemented yet". Per CLAUDE.md "Never invent missing data", a person missing a
  -- value on any dimension selected for this run must be excluded from it, never imputed.
  CONSTRAINT CK_GDX_HNF_DRUN_SEL CHECK (INPUT_SELECTION IN ('COMPLETE_CASES')),
  CONSTRAINT CK_GDX_HNF_DRUN_DIMS CHECK (DIMENSION_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_DRUN_PERSONS CHECK (PERSON_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_DRUN_PAIRS CHECK (PAIR_COUNT >= 0),
  -- Covariance/regularization columns are populated if and only if METRIC='MAHALANOBIS' -- a
  -- EUCLIDEAN or RMS run needs no covariance estimate at all, so nothing here is left as an
  -- unused/fabricated placeholder for those runs.
  CONSTRAINT CK_GDX_HNF_DRUN_COVSRC CHECK (
    (METRIC = 'MAHALANOBIS' AND COVARIANCE_SOURCE = 'RUN_COMPLETE_CASE_SAMPLE') OR
    (METRIC <> 'MAHALANOBIS' AND COVARIANCE_SOURCE IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_DRUN_REG CHECK (
    (METRIC = 'MAHALANOBIS' AND COVARIANCE_REGULARIZATION IN ('NONE','SHRINKAGE_DIAGONAL')) OR
    (METRIC <> 'MAHALANOBIS' AND COVARIANCE_REGULARIZATION IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_DRUN_LAMBDA CHECK (
    (COVARIANCE_REGULARIZATION = 'SHRINKAGE_DIAGONAL' AND REGULARIZATION_LAMBDA IS NOT NULL AND REGULARIZATION_LAMBDA >= 0 AND REGULARIZATION_LAMBDA <= 1) OR
    (COVARIANCE_REGULARIZATION IN ('NONE') AND REGULARIZATION_LAMBDA IS NULL) OR
    (COVARIANCE_REGULARIZATION IS NULL AND REGULARIZATION_LAMBDA IS NULL)
  )
);

CREATE INDEX IX_GDX_HNF_DRUN_STUDY ON GDX_HNF_DISTANCE_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_DRUN_FSPACE ON GDX_HNF_DISTANCE_RUN(ID_INPUT_FEATURE_RUN);
CREATE INDEX IX_GDX_HNF_DRUN_LATENT ON GDX_HNF_DISTANCE_RUN(ID_INPUT_LATENT_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_DRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_DRUN FOR GDX_HNF_DISTANCE_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_DISTANCE_RUN IS NULL) THEN
    NEW.ID_DISTANCE_RUN = NEXT VALUE FOR SEQ_GDX_HNF_DRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_DISTANCE_DIMENSION  (short code: DDIM)
   Which dimension (an F1 feature or an F2 latent dimension, matching the run's
   own SPACE_KIND) occupies position j=1..n of every compared vector u/v in one
   distance run, and in what order. Not simply inherited from the input run's
   own GDX_HNF_FEATURE_RUN_MEMBER/GDX_HNF_LATENT_DIMENSION rows, because a
   distance run can narrow that set further (e.g. a psychometric-only subset of
   a mixed F1 run) -- so this cannot be inferred from the input run alone.
   Exactly one of ID_FEATURE/ID_LATENT_DIM is populated per row, matching the
   parent run's SPACE_KIND (enforced by the generating skill -- a CHECK here
   cannot see the parent row's own SPACE_KIND).
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_DISTANCE_DIMENSION (
  ID_DISTANCE_RUN BIGINT NOT NULL,
  DIMENSION_ORDER INTEGER NOT NULL,
  ID_FEATURE BIGINT,
  ID_LATENT_DIM BIGINT,
  CONSTRAINT PK_GDX_HNF_DDIM PRIMARY KEY (ID_DISTANCE_RUN, DIMENSION_ORDER),
  CONSTRAINT FK_GDX_HNF_DDIM_RUN FOREIGN KEY (ID_DISTANCE_RUN) REFERENCES GDX_HNF_DISTANCE_RUN(ID_DISTANCE_RUN),
  CONSTRAINT FK_GDX_HNF_DDIM_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT FK_GDX_HNF_DDIM_LDIM FOREIGN KEY (ID_LATENT_DIM) REFERENCES GDX_HNF_LATENT_DIMENSION(ID_LATENT_DIM),
  CONSTRAINT CK_GDX_HNF_DDIM_ONE CHECK (
    (ID_FEATURE IS NOT NULL AND ID_LATENT_DIM IS NULL) OR
    (ID_FEATURE IS NULL AND ID_LATENT_DIM IS NOT NULL)
  )
);

CREATE INDEX IX_GDX_HNF_DDIM_FEAT ON GDX_HNF_DISTANCE_DIMENSION(ID_FEATURE);
CREATE INDEX IX_GDX_HNF_DDIM_LDIM ON GDX_HNF_DISTANCE_DIMENSION(ID_LATENT_DIM);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_DISTANCE_COVARIANCE  (short code: DCOV)
   One row per (row_order <= col_order) entry of the n x n covariance matrix
   Sigma estimated from a run's own complete-case sample, and of the
   (possibly regularized) Sigma^-1 actually used by that run's own Mahalanobis
   formula -- upper triangle only (Sigma is symmetric, so the lower triangle
   carries no extra information). ROW_ORDER/COL_ORDER reference
   GDX_HNF_DISTANCE_DIMENSION.DIMENSION_ORDER for the same
   ID_DISTANCE_RUN. Only ever populated for METRIC='MAHALANOBIS' runs -- a
   EUCLIDEAN or RMS run has no rows here at all (see file header).
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_DISTANCE_COVARIANCE (
  ID_DISTANCE_RUN BIGINT NOT NULL,
  ROW_ORDER INTEGER NOT NULL,
  COL_ORDER INTEGER NOT NULL,
  COV_VALUE NUMERIC(18,8) NOT NULL,
  INV_COV_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_DCOV PRIMARY KEY (ID_DISTANCE_RUN, ROW_ORDER, COL_ORDER),
  CONSTRAINT FK_GDX_HNF_DCOV_RUN FOREIGN KEY (ID_DISTANCE_RUN) REFERENCES GDX_HNF_DISTANCE_RUN(ID_DISTANCE_RUN),
  CONSTRAINT CK_GDX_HNF_DCOV_ORDER CHECK (ROW_ORDER <= COL_ORDER)
);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_DISTANCE_VALUE  (short code: DVAL)
   The computed d(u,v) for one unordered pair of persons within one distance
   run -- one row per {person A, person B}, stored once with ID_PERSON_A <
   ID_PERSON_B (a distance is symmetric; the self-distance d(u,u)=0 is never
   stored, it carries no information). DISTANCE_VALUE is always a real, fully
   computed number -- INPUT_SELECTION='COMPLETE_CASES' on the parent run means
   both persons already have a real, non-missing value on every dimension
   selected for this run, so there is no IS_MISSING flag here the way
   GDX_HNF_FEATURE_VALUE needs one.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_DISTANCE_VALUE (
  ID_DISTANCE_VALUE BIGINT NOT NULL,
  ID_DISTANCE_RUN BIGINT NOT NULL,
  ID_PERSON_A BIGINT NOT NULL,
  ID_PERSON_B BIGINT NOT NULL,
  DISTANCE_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_DVAL PRIMARY KEY (ID_DISTANCE_VALUE),
  CONSTRAINT FK_GDX_HNF_DVAL_RUN FOREIGN KEY (ID_DISTANCE_RUN) REFERENCES GDX_HNF_DISTANCE_RUN(ID_DISTANCE_RUN),
  CONSTRAINT FK_GDX_HNF_DVAL_PA FOREIGN KEY (ID_PERSON_A) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT FK_GDX_HNF_DVAL_PB FOREIGN KEY (ID_PERSON_B) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_DVAL UNIQUE (ID_DISTANCE_RUN, ID_PERSON_A, ID_PERSON_B),
  CONSTRAINT CK_GDX_HNF_DVAL_ORDER CHECK (ID_PERSON_A < ID_PERSON_B),
  CONSTRAINT CK_GDX_HNF_DVAL_NONNEG CHECK (DISTANCE_VALUE >= 0)
);

CREATE INDEX IX_GDX_HNF_DVAL_RUN ON GDX_HNF_DISTANCE_VALUE(ID_DISTANCE_RUN);
CREATE INDEX IX_GDX_HNF_DVAL_PA ON GDX_HNF_DISTANCE_VALUE(ID_PERSON_A);
CREATE INDEX IX_GDX_HNF_DVAL_PB ON GDX_HNF_DISTANCE_VALUE(ID_PERSON_B);

CREATE SEQUENCE SEQ_GDX_HNF_DVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_DVAL FOR GDX_HNF_DISTANCE_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_DISTANCE_VALUE IS NULL) THEN
    NEW.ID_DISTANCE_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_DVAL;
END^

SET TERM ; ^

COMMIT;
