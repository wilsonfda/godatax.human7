/* ============================================================================
   Relational model - Curvature Depth Index, latent space (Firebird 2.5)
   New module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_feature_space_model_firebird25.sql (F1)
   AND hypotheses_non_fingo_latent_representations_model_firebird25.sql (F2)
   already applied, AND F2_GDX_SKILL_LATENT_REPRESENTATIONS must have already
   produced at least one GDX_HNF_LATENT_RUN for the study in question -- this
   module has nothing to compute from otherwise. It also reads, but never
   writes, hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql
   (F4, original characteristics) for exactly one purpose: see
   GDX_HNF_CDIH_REFERENCE_SET.ID_ORIG_REFERENCE_SET below.

   This module implements this project's own F4-alternative layer -- the
   Curvature Depth Index computed in LATENT space: the same RMS-distance
   shape F4 (original characteristics) already established, applied to a
   fitted representation h(t) instead of the directly normalized profile
   z(t):

     CDIh(t) = sqrt( (1/k) * sum_j=1..k ( h_j(t) - h_j_ref )^2 )          unweighted

     CDIh_w(t) = sqrt( sum_j=1..k w_j * ( h_j(t) - h_j_ref )^2  /  sum_j w_j )   weighted,
                 w_j >= 0, sum_j w_j > 0 (w_j = 1 for every j reduces to the
                 unweighted formula above)

   k is GDX_HNF_LATENT_RUN.LATENT_DIMENSION_COUNT for the evaluated run; h_j(t)
   is GDX_HNF_LATENT_VALUE.COORDINATE_VALUE for that run, that dimension, that
   person.

   The algebraic shape is deliberately identical to CDIx/CDIx_w (this module
   reuses the exact same RMS arithmetic one layer down) -- its CONTENT is not:
   h is a fitted, model-dependent coordinate, never a directly observed or
   directly normalized measurement. CDIh=0 means coincidence with the
   reference on every included latent dimension of THAT SAME FITTED RUN; nothing
   here licenses a claim about "real" distance, curvature of a data manifold,
   psychological depth, or any physical notion of curved space. A smaller
   CDIh does not mean "better", "closer to normal", or a superior model --
   CDIx and CDIh are two different quantities in two different, generally
   non-comparable spaces, and this module never computes or implies a
   conversion between them.

   THE SINGLE MOST IMPORTANT CONSTRAINT IN THIS SCHEMA: every h_j(t) and every
   h_j_ref compared by one GDX_HNF_CDIH_RUN must come from the exact same
   fitted coordinate system -- the same GDX_HNF_LATENT_RUN (same method, same
   fitted parameters, same k). Re-fitting PCA/an autoencoder/UMAP on a
   different sample, a different k, or a different random seed produces a
   DIFFERENT coordinate system; two CDIh values computed under different
   ID_LATENT_RUN values are not directly comparable without a separate,
   explicit alignment/validation procedure this module does not implement.
   This is why, unlike F4 (original characteristics) -- where
   POPULATION_REFERENCE may legitimately be sourced from a different
   GDX_HNF_FEATURE_SPACE_RUN -- every reference basis below is pinned to the
   SAME ID_LATENT_RUN as the run being evaluated. GDX_HNF_CDIH_RUN_FEATURE
   does not exist as a separate concept the way GDX_HNF_CDI_RUN_FEATURE does;
   its role is played by GDX_HNF_CDIH_RUN_DIMENSION, keyed by
   GDX_HNF_LATENT_DIMENSION instead of GDX_HNF_FEATURE_DICTIONARY.

   Three reference bases (deliberately fewer than F4's four -- see each
   paragraph for why):

     - PERSONAL_BASELINE   a single person's own reference point, expressed in
                            the SAME latent run's coordinate system. Because a
                            single GDX_HNF_LATENT_RUN gives each person exactly
                            ONE h(t) coordinate (F2 already collapsed any
                            repeated session into one scalar before fitting --
                            see that module's own header), there is no "earliest
                            m sessions of h(t)" to average inside one run the
                            way F4 averages sessions of z(t). Instead, this
                            basis is built by projecting that SAME person's
                            already-computed, original-feature-space personal
                            baseline (ID_ORIG_REFERENCE_SET, a direct FK into
                            F4's own GDX_HNF_CDI_REFERENCE_SET,
                            REFERENCE_TYPE='PERSONAL_BASELINE') through the
                            evaluated run's own fitted linear projection:
                              h_ref = W^T (z_ref - mean_z)
                            exactly the PCA formula F2 already fits and stores
                            in GDX_HNF_LATENT_LOADING. This is only well-defined
                            for a METHOD='PCA' latent run -- an autoencoder or
                            UMAP embedding has no stored, reapplicable linear
                            (or invertible) map from an arbitrary reference
                            point to h-space, so PERSONAL_BASELINE is not
                            available for those two methods in this schema
                            today (documented limitation, never worked around
                            with an invented approximation). This is the direct
                            integration point with F4's own results this module
                            is required to honor rather than recompute.
     - LATENT_COHORT        the mean of h(t) actually realized, dimension by
                             dimension, across the evaluated run's own
                             complete-case person set -- computed from real
                             GDX_HNF_LATENT_VALUE rows every time, never assumed
                             to be exactly the zero vector (PCA centers its
                             TRAINING sample at 0, which need not equal the
                             mean of whichever complete-case subset a given CDI
                             run ends up evaluating).
     - POPULATION_REFERENCE  the same mean-of-h(t) computation as LATENT_COHORT,
                              but over an explicitly identified, named SUBSET of
                              the persons already embedded in that SAME run
                              (GDX_HNF_CDIH_REFERENCE_MEMBER below) -- e.g. one
                              phase, one site, one stratum of the same fitted
                              sample. Never a different GDX_HNF_LATENT_RUN (see
                              above); never silently identical to the full
                              complete-case set (that would collapse it into
                              LATENT_COHORT under a different label).

   INSTRUMENT_NORM has no latent-space counterpart and is intentionally absent
   from this schema's REFERENCE_TYPE domain: a published instrument manual
   documents norms for the instrument's own original items/scores, never for
   the coordinates of a model fitted inside this project -- there is no
   external authority to read a validated "latent norm" from, so this module
   does not invent a mechanism to hold one.

   Which latent run a reference set is pinned to, and that a run's own
   reference set shares that same ID_LATENT_RUN, are both business rules this
   DDL documents but cannot fully enforce with a single-row CHECK (a CHECK
   cannot compare two different tables' rows in Firebird 2.5) -- same
   documented limitation already accepted one layer down for weight-sum-must-
   be-positive in GDX_HNF_CDI_RUN_FEATURE/GDX_HNF_LATENT_RUN. The generating
   skill enforces both before any row is written, not this schema.

   Per-dimension traceability: unlike GDX_HNF_CDIH_VALUE, which stores only the
   aggregate scalar for a person, this module also stores the full
   per-dimension difference vector behind every CDIh value
   (GDX_HNF_CDIH_VALUE_DETAIL) -- same reasoning F4 (original characteristics)
   already applies to GDX_HNF_CDI_VALUE_DETAIL: a human must be able to recover
   which latent dimension moved, and by how much, not just the one scalar.

   Weighting (CDIh_w): weights are recorded per (run, dimension) in
   GDX_HNF_CDIH_RUN_DIMENSION.WEIGHT (default 1.0, i.e. unweighted). Same
   governance rule as F4: a weight must never be chosen simply to produce a
   desired CDIh value. A natural, defensible weight here (e.g. a PCA
   dimension's own EXPLAINED_VARIANCE_RATIO) is a legitimate candidate but is
   never defaulted automatically -- the generating skill always requires an
   explicit weighting decision, exactly as GDX_HNF_CDI_RUN_FEATURE requires
   today.

   Missing data: a person without a real GDX_HNF_LATENT_VALUE row on every
   dimension selected for a run, or without a dimension present in the chosen
   reference set, is excluded from that run entirely (INPUT_SELECTION =
   'COMPLETE_CASES', the only value this schema allows -- same convention as
   every other GDX_HNF_*_RUN table in this folder). Nothing here is ever
   imputed, zero-filled, or defaulted.

   Integration with the prior skills (F1/F2/F4-original), by design:
     - GDX_HNF_CDIH_RUN.ID_LATENT_RUN and GDX_HNF_CDIH_REFERENCE_SET.
       ID_LATENT_RUN are both direct FKs into GDX_HNF_LATENT_RUN(ID_LATENT_RUN)
       -- this module never re-reads 2.relational.model.psychometrics,
       6.cardiac.coherence, 7.multidimensional.database or 9.knowledge.graph
       directly, and never re-fits a latent representation on its own; F2 has
       already done that work. "Reading the relational/BI/graph sources" for
       this layer is therefore satisfied *transitively*, through an
       already-run F2 latent run, exactly like F2 and F3 are themselves
       satisfied transitively through F1.
     - GDX_HNF_CDIH_REFERENCE_SET.ID_ORIG_REFERENCE_SET is a direct FK into
       GDX_HNF_CDI_REFERENCE_SET(ID_REFERENCE_SET) (F4, original
       characteristics) -- the PERSONAL_BASELINE basis is never recomputed
       from scratch in latent space; it is always a projection of a baseline
       F4 already froze in original-feature space.
     - GDX_HNF_CDIH_RUN_DIMENSION/GDX_HNF_CDIH_VALUE/GDX_HNF_CDIH_VALUE_DETAIL
       reuse the exact same RMS-distance arithmetic GDX_HNF_CDI_RUN_FEATURE/
       GDX_HNF_CDI_VALUE/GDX_HNF_CDI_VALUE_DETAIL already establish one layer
       down -- this module never redefines what an RMS distance is, only
       applies it between an observed latent profile and a frozen latent
       reference instead of between an observed original-feature profile and
       a frozen original-feature reference.

   Surrogate keys: GDX_HNF_CDIH_REFERENCE_SET, GDX_HNF_CDIH_RUN and
   GDX_HNF_CDIH_VALUE use a BIGINT primary key assigned by a BEFORE INSERT
   trigger from a dedicated sequence whenever inserted with that column left
   NULL -- same convention as every module in this folder.
   GDX_HNF_CDIH_REFERENCE_VALUE, GDX_HNF_CDIH_RUN_DIMENSION,
   GDX_HNF_CDIH_VALUE_DETAIL and GDX_HNF_CDIH_REFERENCE_MEMBER are pure
   membership/detail tables and instead use a composite primary key with no
   sequence, same shape as GDX_HNF_CDI_REFERENCE_VALUE/GDX_HNF_CDI_RUN_FEATURE/
   GDX_HNF_CDI_VALUE_DETAIL (F4, original characteristics).

   Table prefix: every table below is GDX_HNF_CDIH_<ENTITY> -- the extra H
   segment (after CDI_) marks this layer as the h-space (latent) variant,
   keeping it unambiguous next to GDX_HNF_CDI_* (original characteristics),
   GDX_HNF_LATENT_* (F2) and GDX_HNF_FEATURE_* (F1), while staying within
   Firebird 2.5's 31-character identifier limit.

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table
   codes instead of the full table name, same reason and convention as every
   other schema in this folder:
     CDIH_REFERENCE_SET     -> HRSET
     CDIH_REFERENCE_VALUE    -> HRVAL
     CDIH_REFERENCE_MEMBER    -> HRMEM
     CDIH_RUN                   -> HCRUN
     CDIH_RUN_DIMENSION            -> HCDIM
     CDIH_VALUE                       -> HCVAL
     CDIH_VALUE_DETAIL                   -> HCDET

   This script only creates tables/sequences/triggers/indexes -- no DML. The
   companion compute script for this layer (reading GDX_HNF_LATENT_* and
   GDX_HNF_CDI_* and writing the GDX_HNF_CDIH_* rows below) is a later,
   separate deliverable of F4_CURV_DEPTH_KPI_LATENT_SPACE -- not part of this
   file.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_CDIH_REFERENCE_SET  (short code: HRSET)
   One row per constructed latent reference "center" (PERSONAL_BASELINE,
   LATENT_COHORT or POPULATION_REFERENCE), frozen once built and always
   expressed in exactly one GDX_HNF_LATENT_RUN's own coordinate system. Reused,
   unchanged, across however many GDX_HNF_CDIH_RUN rows compare against it.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDIH_REFERENCE_SET (
  ID_REFERENCE_SET BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  ID_LATENT_RUN BIGINT NOT NULL,
  REFERENCE_TYPE VARCHAR(30) NOT NULL,
  ID_SUBJECT BIGINT,
  ID_ORIG_REFERENCE_SET BIGINT,
  REFERENCE_LABEL VARCHAR(160) NOT NULL,
  SOURCE_PERSON_COUNT INTEGER,
  VALID_FROM TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  VALID_TO TIMESTAMP,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_HRSET PRIMARY KEY (ID_REFERENCE_SET),
  CONSTRAINT FK_GDX_HNF_HRSET_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_HRSET_LRUN FOREIGN KEY (ID_LATENT_RUN) REFERENCES GDX_HNF_LATENT_RUN(ID_LATENT_RUN),
  CONSTRAINT FK_GDX_HNF_HRSET_SUBJ FOREIGN KEY (ID_SUBJECT) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT FK_GDX_HNF_HRSET_ORIGRS FOREIGN KEY (ID_ORIG_REFERENCE_SET) REFERENCES GDX_HNF_CDI_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT CK_GDX_HNF_HRSET_TYPE CHECK (REFERENCE_TYPE IN ('PERSONAL_BASELINE','LATENT_COHORT','POPULATION_REFERENCE')),
  -- Only a PERSONAL_BASELINE has a single subject and a single origin reference set (the F4
  -- original-feature-space baseline it projects); LATENT_COHORT/POPULATION_REFERENCE describe a
  -- group, never one individual, and are computed directly from GDX_HNF_LATENT_VALUE, not
  -- projected from anything.
  CONSTRAINT CK_GDX_HNF_HRSET_SUBJ CHECK (
    (REFERENCE_TYPE = 'PERSONAL_BASELINE' AND ID_SUBJECT IS NOT NULL) OR
    (REFERENCE_TYPE <> 'PERSONAL_BASELINE' AND ID_SUBJECT IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_HRSET_ORIG CHECK (
    (REFERENCE_TYPE = 'PERSONAL_BASELINE' AND ID_ORIG_REFERENCE_SET IS NOT NULL) OR
    (REFERENCE_TYPE <> 'PERSONAL_BASELINE' AND ID_ORIG_REFERENCE_SET IS NULL)
  ),
  -- SOURCE_PERSON_COUNT only makes sense for LATENT_COHORT/POPULATION_REFERENCE (how many persons'
  -- own h(t) rows were averaged, dimension by dimension); a personal baseline is one projected
  -- point, not a counted sample.
  CONSTRAINT CK_GDX_HNF_HRSET_SPCNT CHECK (
    (REFERENCE_TYPE IN ('LATENT_COHORT','POPULATION_REFERENCE') AND SOURCE_PERSON_COUNT IS NOT NULL AND SOURCE_PERSON_COUNT > 0) OR
    (REFERENCE_TYPE = 'PERSONAL_BASELINE' AND SOURCE_PERSON_COUNT IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_HRSET_VALID CHECK (VALID_TO IS NULL OR VALID_TO > VALID_FROM)
);

CREATE INDEX IX_GDX_HNF_HRSET_STUDY ON GDX_HNF_CDIH_REFERENCE_SET(ID_STUDY);
CREATE INDEX IX_GDX_HNF_HRSET_LRUN ON GDX_HNF_CDIH_REFERENCE_SET(ID_LATENT_RUN);
CREATE INDEX IX_GDX_HNF_HRSET_SUBJ ON GDX_HNF_CDIH_REFERENCE_SET(ID_SUBJECT);
CREATE INDEX IX_GDX_HNF_HRSET_ORIGRS ON GDX_HNF_CDIH_REFERENCE_SET(ID_ORIG_REFERENCE_SET);

CREATE SEQUENCE SEQ_GDX_HNF_HRSET;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_HRSET FOR GDX_HNF_CDIH_REFERENCE_SET ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_REFERENCE_SET IS NULL) THEN
    NEW.ID_REFERENCE_SET = NEXT VALUE FOR SEQ_GDX_HNF_HRSET;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDIH_REFERENCE_VALUE  (short code: HRVAL)
   One row per (reference set, latent dimension): the frozen center h_j_ref,
   plus its own dispersion (when applicable, i.e. LATENT_COHORT/
   POPULATION_REFERENCE) and the sample size actually behind it. A dimension
   with no value for this reference set simply has no row here.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDIH_REFERENCE_VALUE (
  ID_REFERENCE_SET BIGINT NOT NULL,
  ID_LATENT_DIM BIGINT NOT NULL,
  REFERENCE_VALUE NUMERIC(18,6) NOT NULL,
  REFERENCE_DISPERSION NUMERIC(18,6),
  SAMPLE_SIZE INTEGER NOT NULL,
  CONSTRAINT PK_GDX_HNF_HRVAL PRIMARY KEY (ID_REFERENCE_SET, ID_LATENT_DIM),
  CONSTRAINT FK_GDX_HNF_HRVAL_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDIH_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT FK_GDX_HNF_HRVAL_DIM FOREIGN KEY (ID_LATENT_DIM) REFERENCES GDX_HNF_LATENT_DIMENSION(ID_LATENT_DIM),
  CONSTRAINT CK_GDX_HNF_HRVAL_SAMPLE CHECK (SAMPLE_SIZE > 0)
);

CREATE INDEX IX_GDX_HNF_HRVAL_DIM ON GDX_HNF_CDIH_REFERENCE_VALUE(ID_LATENT_DIM);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDIH_REFERENCE_MEMBER  (short code: HRMEM)
   One row per (reference set, person) -- REFERENCE_TYPE='POPULATION_REFERENCE'
   only. Records exactly which persons, already embedded by the SAME
   GDX_HNF_LATENT_RUN, were averaged into this reference's own
   GDX_HNF_CDIH_REFERENCE_VALUE rows -- without this, a population reference
   would be indistinguishable from (and unreproducible relative to) a
   LATENT_COHORT built over the full complete-case set.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDIH_REFERENCE_MEMBER (
  ID_REFERENCE_SET BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  CONSTRAINT PK_GDX_HNF_HRMEM PRIMARY KEY (ID_REFERENCE_SET, ID_PERSON),
  CONSTRAINT FK_GDX_HNF_HRMEM_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDIH_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT FK_GDX_HNF_HRMEM_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON)
);

CREATE INDEX IX_GDX_HNF_HRMEM_PERSON ON GDX_HNF_CDIH_REFERENCE_MEMBER(ID_PERSON);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDIH_RUN  (short code: HCRUN)
   One row per execution of this layer's compute script for one study, one
   latent run (the h(t) being evaluated) and one reference set (the h_ref it
   is evaluated against, pinned to that SAME latent run). A single latent run
   can be scored against many reference sets; a single reference set can be
   reused by many runs over time -- each pairing is its own independent,
   frozen snapshot, never updated in place.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDIH_RUN (
  ID_CDIH_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  ID_LATENT_RUN BIGINT NOT NULL,
  ID_REFERENCE_SET BIGINT NOT NULL,
  WEIGHTING VARCHAR(20) DEFAULT 'UNWEIGHTED' NOT NULL,
  INPUT_SELECTION VARCHAR(30) DEFAULT 'COMPLETE_CASES' NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  DIMENSION_COUNT INTEGER NOT NULL,
  PERSON_COUNT INTEGER NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_HCRUN PRIMARY KEY (ID_CDIH_RUN),
  CONSTRAINT FK_GDX_HNF_HCRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_HCRUN_LRUN FOREIGN KEY (ID_LATENT_RUN) REFERENCES GDX_HNF_LATENT_RUN(ID_LATENT_RUN),
  CONSTRAINT FK_GDX_HNF_HCRUN_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDIH_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT CK_GDX_HNF_HCRUN_WEIGHT CHECK (WEIGHTING IN ('UNWEIGHTED','WEIGHTED')),
  -- 'COMPLETE_CASES' is the only value this project allows here, permanently -- same convention as
  -- every other GDX_HNF_*_RUN table in this folder.
  CONSTRAINT CK_GDX_HNF_HCRUN_SEL CHECK (INPUT_SELECTION IN ('COMPLETE_CASES')),
  CONSTRAINT CK_GDX_HNF_HCRUN_DIMC CHECK (DIMENSION_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_HCRUN_PERSC CHECK (PERSON_COUNT > 0)
);

CREATE INDEX IX_GDX_HNF_HCRUN_STUDY ON GDX_HNF_CDIH_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_HCRUN_LRUN ON GDX_HNF_CDIH_RUN(ID_LATENT_RUN);
CREATE INDEX IX_GDX_HNF_HCRUN_RSET ON GDX_HNF_CDIH_RUN(ID_REFERENCE_SET);

CREATE SEQUENCE SEQ_GDX_HNF_HCRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_HCRUN FOR GDX_HNF_CDIH_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_CDIH_RUN IS NULL) THEN
    NEW.ID_CDIH_RUN = NEXT VALUE FOR SEQ_GDX_HNF_HCRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDIH_RUN_DIMENSION  (short code: HCDIM)
   Which GDX_HNF_LATENT_DIMENSION rows actually composed the compared vector
   for this run, in what order j=1..k, and under which weight w_j (1.0 for
   every row on an UNWEIGHTED run). Plays the same role GDX_HNF_CDI_RUN_FEATURE
   plays for F4 (original characteristics), keyed by latent dimension instead
   of by feature. WEIGHT >= 0 is enforced here; "every weight is zero" cannot
   be expressed as a single-row CHECK and is enforced by the generating skill.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDIH_RUN_DIMENSION (
  ID_CDIH_RUN BIGINT NOT NULL,
  DIMENSION_ORDER INTEGER NOT NULL,
  ID_LATENT_DIM BIGINT NOT NULL,
  WEIGHT NUMERIC(18,6) DEFAULT 1 NOT NULL,
  CONSTRAINT PK_GDX_HNF_HCDIM PRIMARY KEY (ID_CDIH_RUN, ID_LATENT_DIM),
  CONSTRAINT FK_GDX_HNF_HCDIM_RUN FOREIGN KEY (ID_CDIH_RUN) REFERENCES GDX_HNF_CDIH_RUN(ID_CDIH_RUN),
  CONSTRAINT FK_GDX_HNF_HCDIM_DIM FOREIGN KEY (ID_LATENT_DIM) REFERENCES GDX_HNF_LATENT_DIMENSION(ID_LATENT_DIM),
  CONSTRAINT UQ_GDX_HNF_HCDIM_ORDER UNIQUE (ID_CDIH_RUN, DIMENSION_ORDER),
  CONSTRAINT CK_GDX_HNF_HCDIM_WEIGHT CHECK (WEIGHT >= 0)
);

CREATE INDEX IX_GDX_HNF_HCDIM_DIM ON GDX_HNF_CDIH_RUN_DIMENSION(ID_LATENT_DIM);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDIH_VALUE  (short code: HCVAL)
   The computed CDIh(t) (or CDIh_w(t)) for one person within one run --
   always a real, fully computed, non-negative number. INPUT_SELECTION=
   'COMPLETE_CASES' on the parent run means this person already has a real
   GDX_HNF_LATENT_VALUE row on every dimension selected for this run AND the
   chosen reference set already has a value for every one of them.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDIH_VALUE (
  ID_CDIH_VALUE BIGINT NOT NULL,
  ID_CDIH_RUN BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  CDIH_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_HCVAL PRIMARY KEY (ID_CDIH_VALUE),
  CONSTRAINT FK_GDX_HNF_HCVAL_RUN FOREIGN KEY (ID_CDIH_RUN) REFERENCES GDX_HNF_CDIH_RUN(ID_CDIH_RUN),
  CONSTRAINT FK_GDX_HNF_HCVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_HCVAL UNIQUE (ID_CDIH_RUN, ID_PERSON),
  CONSTRAINT CK_GDX_HNF_HCVAL_NONNEG CHECK (CDIH_VALUE >= 0)
);

CREATE INDEX IX_GDX_HNF_HCVAL_RUN ON GDX_HNF_CDIH_VALUE(ID_CDIH_RUN);
CREATE INDEX IX_GDX_HNF_HCVAL_PERSON ON GDX_HNF_CDIH_VALUE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_HNF_HCVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_HCVAL FOR GDX_HNF_CDIH_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_CDIH_VALUE IS NULL) THEN
    NEW.ID_CDIH_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_HCVAL;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDIH_VALUE_DETAIL  (short code: HCDET)
   One row per (CDIh value, latent dimension): the real current/reference
   coordinates, their signed difference and the weight actually applied --
   the full per-dimension breakdown behind one CDIH_VALUE scalar. Same role
   GDX_HNF_CDI_VALUE_DETAIL plays for F4 (original characteristics).
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDIH_VALUE_DETAIL (
  ID_CDIH_VALUE BIGINT NOT NULL,
  ID_LATENT_DIM BIGINT NOT NULL,
  CURRENT_VALUE NUMERIC(18,6) NOT NULL,
  REFERENCE_VALUE NUMERIC(18,6) NOT NULL,
  DIFFERENCE NUMERIC(18,6) NOT NULL,
  WEIGHT NUMERIC(18,6) NOT NULL,
  CONSTRAINT PK_GDX_HNF_HCDET PRIMARY KEY (ID_CDIH_VALUE, ID_LATENT_DIM),
  CONSTRAINT FK_GDX_HNF_HCDET_VAL FOREIGN KEY (ID_CDIH_VALUE) REFERENCES GDX_HNF_CDIH_VALUE(ID_CDIH_VALUE),
  CONSTRAINT FK_GDX_HNF_HCDET_DIM FOREIGN KEY (ID_LATENT_DIM) REFERENCES GDX_HNF_LATENT_DIMENSION(ID_LATENT_DIM),
  CONSTRAINT CK_GDX_HNF_HCDET_WEIGHT CHECK (WEIGHT >= 0)
);

CREATE INDEX IX_GDX_HNF_HCDET_DIM ON GDX_HNF_CDIH_VALUE_DETAIL(ID_LATENT_DIM);

COMMIT;
