/* ============================================================================
   Relational model - Curvature Depth Index, original characteristics (Firebird 2.5)
   New module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_feature_space_model_firebird25.sql (this
   same folder, F1's own DDL) already applied, AND
   F1_GDX_SKILL_MULTIDIMENSIONAL_FEATURE_SPACE (MFS) must have already produced
   at least one GDX_HNF_FEATURE_SPACE_RUN with NORMALIZATION_METHOD='ZSCORE'
   for the study in question -- both the profile being evaluated and every
   reference this module builds are read from that same frozen z(t).

   This module implements this project's own F4 layer -- the Curvature Depth
   Index computed directly on the original (not latent) characteristics: a
   single scalar that summarizes how far a person's observed, normalized
   profile z(t) sits from an explicit reference profile z_ref, under the same
   RMS-distance shape F3 already established one layer down:

     CDIx(t) = sqrt( (1/n) * sum_j=1..n ( z_j(t) - z_j_ref )^2 )          unweighted

     CDIx_w(t) = sqrt( sum_j=1..n w_j * ( z_j(t) - z_j_ref )^2  /  sum_j w_j )   weighted,
                 w_j >= 0, sum_j w_j > 0 (w_j = 1 for every j reduces to the
                 unweighted formula above)

   "Curvature Depth" is this project's own naming convention, inherited from a
   design discussion about visualizing a profile's distance from its
   reference as a "deeper" or "shallower" point in a graphic. The quantity
   itself is an ordinary RMS distance in a normalized feature space -- it is
   NOT the scalar curvature of a Riemannian manifold, NOT a measurement of
   consciousness, health, spiritual energy or virtue, and carries no fixed
   upper bound under a z-score input (an unbounded standardization): CDIx=0
   means coincidence with the reference on every included feature; a larger
   CDIx means a larger normalized displacement, never a "worse" condition by
   itself. Whether a given CDIx is large or small, stable or unstable, or
   related to any external outcome is an empirical question this module
   records the inputs for -- it never answers that question on its own.

   CDI is a DEVIATION INDEX AGAINST AN EXPLICIT REFERENCE -- this is what sets
   it apart from, and builds directly on top of, F3_GDX_SKILL_DISTANCE_
   SIMILARITY_PROFILES (which deliberately only ever compares pairs of
   OBSERVED profiles, never a profile against a fixed "center" -- see that
   skill's own SKILL.md/DDL header, "a materially different and more
   consequential design decision"). This module is exactly that later,
   separate, more consequential decision: it defines what "the center" is
   (GDX_HNF_CDI_REFERENCE_SET/GDX_HNF_CDI_REFERENCE_VALUE below), then reuses
   the same RMS-distance arithmetic F3 already validated, applied between one
   observed profile and that frozen reference instead of between two observed
   profiles.

   Four reference bases, matching this project's own governance distinctions
   for "distance of what, to what":
     - PERSONAL_BASELINE     the mean (or median) of ONE person's own earliest
                              m real sessions/observations of z(t), for a
                              protocol-frozen set of features. Quantifies
                              personal displacement over time. m is recorded
                              (BASELINE_SESSION_COUNT) and never silently
                              redefined once frozen -- a different m is a new
                              GDX_HNF_CDI_REFERENCE_SET row, never an update to
                              an existing one.
     - STUDY_COHORT           the mean of z(t) actually realized, feature by
                              feature, across the SAME input F1 run's own
                              complete-case sample a CDI run evaluates against
                              -- computed from real data every time, never
                              assumed to be exactly the zero vector even
                              though z-score normalization centers its own,
                              possibly larger, normalization sample at 0.
     - POPULATION_REFERENCE   the same mean-of-z(t) computation as
                              STUDY_COHORT, but sourced from a DIFFERENT,
                              explicitly identified GDX_HNF_FEATURE_SPACE_RUN
                              (a different study, a different time point, or a
                              deliberately drawn sub-sample) -- never silently
                              reused from the run being evaluated, since that
                              would collapse this into STUDY_COHORT under a
                              different label.
     - INSTRUMENT_NORM        values taken from an instrument's own manual or
                              validation study, supplied by a human (this
                              module has no automated source for this) and
                              recorded per feature in GDX_HNF_CDI_REFERENCE_VALUE
                              exactly as supplied. A feature with no validated
                              norm available is simply absent from this
                              reference set's own rows -- never filled in with
                              an arbitrary placeholder (this project's own rule
                              against inventing missing data forbids, in
                              particular, defaulting an unavailable norm to a
                              midpoint value as if it were a known ideal).

   Every reference is frozen once written (VALID_FROM/VALID_TO govern which
   reference set is "current" for governance purposes; nothing here is ever
   updated in place) -- redefining a reference's own mean/median on every new
   comparison would make the very displacement being measured disappear, the
   same principle GDX_HNF_NORMALIZATION_PARAM (F1) already applies to mu/sigma.

   Per this project's "Never invent missing data" rule: a feature selected for
   a CDI run that has no row in the chosen GDX_HNF_CDI_REFERENCE_VALUE is
   excluded from that run entirely, and a person missing a real value on any
   feature actually used by the run is excluded from it entirely
   (INPUT_SELECTION = 'COMPLETE_CASES', the only policy this schema allows --
   same convention as GDX_HNF_LATENT_RUN/GDX_HNF_DISTANCE_RUN in F2/F3) --
   never imputed, never zero-filled, never defaulted to a reference's own
   value (which would silently zero out exactly the difference being
   measured).

   Per-feature traceability: unlike GDX_HNF_DISTANCE_VALUE (F3), which stores
   only the aggregate distance for a pair, this module ALSO stores the full
   per-feature difference vector behind every CDI value
   (GDX_HNF_CDI_VALUE_DETAIL) -- summarizing a multivariate displacement into
   one scalar necessarily discards which features moved and in which
   direction, and recovering that is explicitly required for any honest
   reading of a CDI run (a human must be able to ask "what actually changed",
   not just "by how much").

   Weighting (CDIx_w): weights are recorded per (run, feature) in
   GDX_HNF_CDI_RUN_FEATURE.WEIGHT (default 1.0, i.e. unweighted). Per this
   project's own governance rule, a weight must never be chosen simply to
   produce a desired CDI value -- WEIGHT >= 0 is enforced here, but "all
   weights are zero" (which would make the index undefined, division by zero)
   cannot be expressed as a single-row CHECK and is enforced by the generating
   skill before any row is written, not by this DDL (same documented
   limitation GDX_HNF_DISTANCE_DIMENSION already notes for SPACE_KIND one
   layer down).

   Integration with the two prior skills (F1/MFS, F3), by design:
     - GDX_HNF_CDI_RUN.ID_INPUT_FEATURE_RUN and GDX_HNF_CDI_REFERENCE_SET.
       ID_INPUT_FEATURE_RUN are both direct FKs into
       GDX_HNF_FEATURE_SPACE_RUN(ID_RUN) -- this module never re-reads
       2.relational.model.psychometrics, 6.cardiac.coherence,
       7.multidimensional.database or 9.knowledge.graph directly, and never
       re-normalizes a feature on its own; F1 has already done that work and
       frozen z(t). "Reading the relational/BI/graph sources" for F4 is
       therefore satisfied *transitively*, through an already-run F1 ZSCORE
       run, exactly like F2 and F3 one layer down.
     - GDX_HNF_CDI_RUN_FEATURE/GDX_HNF_CDI_VALUE/GDX_HNF_CDI_VALUE_DETAIL reuse
       the exact same RMS-distance arithmetic GDX_HNF_DISTANCE_RUN(METRIC=
       'RMS') already validates one layer down in F3 -- this module never
       redefines what an RMS distance is, it only applies it between an
       observed profile and a frozen reference instead of between two
       observed profiles.
     - This module intentionally does NOT compute the latent-space CDI
       variant (CDIh, built the same way over F2's own h(t)) -- that is a
       separate, later extension of this same layer, with its own, different
       epistemological caveats (h is not a direct observation), not folded
       into this file.

   Surrogate keys: GDX_HNF_CDI_REFERENCE_SET and GDX_HNF_CDI_RUN and
   GDX_HNF_CDI_VALUE use a BIGINT primary key assigned by a BEFORE INSERT
   trigger from a dedicated sequence whenever inserted with that column left
   NULL -- same convention as every module added after the original base
   schema. GDX_HNF_CDI_REFERENCE_VALUE, GDX_HNF_CDI_RUN_FEATURE and
   GDX_HNF_CDI_VALUE_DETAIL are pure membership/detail tables and instead use
   a composite primary key with no sequence, same shape as
   GDX_HNF_FEATURE_RUN_MEMBER (F1) and GDX_HNF_DISTANCE_DIMENSION (F3).

   Table prefix: every table below is GDX_HNF_CDI_<ENTITY>, same GDX_HNF_
   convention as this folder's F1/F2/F3 schemas (see any of those files' own
   header for the full GDX_<DOMAIN>_<ENTITY> rationale shared across this
   project), with an extra CDI_ segment so this layer's own tables group
   together and stay unambiguous next to GDX_HNF_FEATURE_*, GDX_HNF_LATENT_*
   and GDX_HNF_DISTANCE_*.

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table
   codes instead of the full table name, to stay within Firebird 2.5's
   31-character identifier limit -- same reason and convention as this
   folder's F1/F2/F3 schemas:
     CDI_REFERENCE_SET     -> RSET
     CDI_REFERENCE_VALUE    -> RVAL
     CDI_RUN                  -> CRUN
     CDI_RUN_FEATURE            -> CFEAT
     CDI_VALUE                    -> CVAL
     CDI_VALUE_DETAIL                -> CDET

   This script only creates tables/sequences/triggers/indexes -- no DML.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_REFERENCE_SET  (short code: RSET)
   One row per constructed reference "center" (PERSONAL_BASELINE,
   STUDY_COHORT, POPULATION_REFERENCE or INSTRUMENT_NORM), frozen once built.
   A reference set is reused, unchanged, across however many GDX_HNF_CDI_RUN
   rows compare against it -- redefining it in place would silently alter
   every past CDI value that already pointed at it.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_REFERENCE_SET (
  ID_REFERENCE_SET BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  REFERENCE_TYPE VARCHAR(30) NOT NULL,
  ID_SUBJECT BIGINT,
  ID_INPUT_FEATURE_RUN BIGINT NOT NULL,
  REFERENCE_LABEL VARCHAR(160) NOT NULL,
  BASELINE_ESTIMATOR VARCHAR(10),
  BASELINE_SESSION_COUNT INTEGER,
  SOURCE_PERSON_COUNT INTEGER,
  VALID_FROM TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  VALID_TO TIMESTAMP,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_RSET PRIMARY KEY (ID_REFERENCE_SET),
  CONSTRAINT FK_GDX_HNF_RSET_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_RSET_SUBJECT FOREIGN KEY (ID_SUBJECT) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT FK_GDX_HNF_RSET_FRUN FOREIGN KEY (ID_INPUT_FEATURE_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT CK_GDX_HNF_RSET_TYPE CHECK (REFERENCE_TYPE IN ('PERSONAL_BASELINE','STUDY_COHORT','POPULATION_REFERENCE','INSTRUMENT_NORM')),
  -- Only a PERSONAL_BASELINE has a single subject; the other three bases describe a group or an
  -- external norm, never one individual (see file header, "distance of what, to what").
  CONSTRAINT CK_GDX_HNF_RSET_SUBJECT CHECK (
    (REFERENCE_TYPE = 'PERSONAL_BASELINE' AND ID_SUBJECT IS NOT NULL) OR
    (REFERENCE_TYPE <> 'PERSONAL_BASELINE' AND ID_SUBJECT IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_RSET_ESTIM CHECK (BASELINE_ESTIMATOR IS NULL OR BASELINE_ESTIMATOR IN ('MEAN','MEDIAN')),
  -- BASELINE_SESSION_COUNT/BASELINE_ESTIMATOR only make sense for a PERSONAL_BASELINE (how many of
  -- that one person's own earliest sessions were averaged, and how); a cohort/population/norm
  -- reference has no "session count" of its own in that sense.
  CONSTRAINT CK_GDX_HNF_RSET_BCOUNT CHECK (
    (REFERENCE_TYPE = 'PERSONAL_BASELINE' AND BASELINE_SESSION_COUNT IS NOT NULL AND BASELINE_SESSION_COUNT > 0 AND BASELINE_ESTIMATOR IS NOT NULL) OR
    (REFERENCE_TYPE <> 'PERSONAL_BASELINE' AND BASELINE_SESSION_COUNT IS NULL AND BASELINE_ESTIMATOR IS NULL)
  ),
  -- SOURCE_PERSON_COUNT only makes sense for STUDY_COHORT/POPULATION_REFERENCE (how many persons'
  -- own z(t) rows were averaged feature by feature); a personal baseline is one person's own
  -- history, and an instrument norm comes from the instrument's documentation, not a counted
  -- sample this project itself drew.
  CONSTRAINT CK_GDX_HNF_RSET_SPCOUNT CHECK (
    (REFERENCE_TYPE IN ('STUDY_COHORT','POPULATION_REFERENCE') AND SOURCE_PERSON_COUNT IS NOT NULL AND SOURCE_PERSON_COUNT > 0) OR
    (REFERENCE_TYPE IN ('PERSONAL_BASELINE','INSTRUMENT_NORM') AND SOURCE_PERSON_COUNT IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_RSET_VALID CHECK (VALID_TO IS NULL OR VALID_TO > VALID_FROM)
);

CREATE INDEX IX_GDX_HNF_RSET_STUDY ON GDX_HNF_CDI_REFERENCE_SET(ID_STUDY);
CREATE INDEX IX_GDX_HNF_RSET_SUBJECT ON GDX_HNF_CDI_REFERENCE_SET(ID_SUBJECT);
CREATE INDEX IX_GDX_HNF_RSET_FRUN ON GDX_HNF_CDI_REFERENCE_SET(ID_INPUT_FEATURE_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_RSET;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_RSET FOR GDX_HNF_CDI_REFERENCE_SET ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_REFERENCE_SET IS NULL) THEN
    NEW.ID_REFERENCE_SET = NEXT VALUE FOR SEQ_GDX_HNF_RSET;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_REFERENCE_VALUE  (short code: RVAL)
   One row per (reference set, feature): the frozen center z_j_ref this
   reference set offers for feature j, plus its own dispersion (when
   applicable) and the sample size actually behind it (which can legitimately
   vary feature by feature even within one reference set, e.g. a sparse
   physiological feature contributing fewer sessions than a dense
   psychometric one). A feature with no validated value for this reference
   type simply has no row here -- see file header on INSTRUMENT_NORM.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_REFERENCE_VALUE (
  ID_REFERENCE_SET BIGINT NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  REFERENCE_VALUE NUMERIC(18,6) NOT NULL,
  REFERENCE_DISPERSION NUMERIC(18,6),
  SAMPLE_SIZE INTEGER NOT NULL,
  CONSTRAINT PK_GDX_HNF_RVAL PRIMARY KEY (ID_REFERENCE_SET, ID_FEATURE),
  CONSTRAINT FK_GDX_HNF_RVAL_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDI_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT FK_GDX_HNF_RVAL_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT CK_GDX_HNF_RVAL_SAMPLE CHECK (SAMPLE_SIZE > 0)
);

CREATE INDEX IX_GDX_HNF_RVAL_FEAT ON GDX_HNF_CDI_REFERENCE_VALUE(ID_FEATURE);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_RUN  (short code: CRUN)
   One row per execution of this layer's compute script for one study, one
   input F1 run (the z(t) being evaluated) and one reference set (the z_ref
   it is evaluated against). A single input run can be scored against many
   reference sets (a personal baseline AND a study cohort, say), and a single
   reference set can be reused by many runs over time -- each pairing is its
   own independent, frozen snapshot, never updated in place.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_RUN (
  ID_CDI_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  ID_INPUT_FEATURE_RUN BIGINT NOT NULL,
  ID_REFERENCE_SET BIGINT NOT NULL,
  WEIGHTING VARCHAR(20) DEFAULT 'UNWEIGHTED' NOT NULL,
  INPUT_SELECTION VARCHAR(30) DEFAULT 'COMPLETE_CASES' NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  FEATURE_COUNT INTEGER NOT NULL,
  PERSON_COUNT INTEGER NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_CRUN PRIMARY KEY (ID_CDI_RUN),
  CONSTRAINT FK_GDX_HNF_CRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_CRUN_FRUN FOREIGN KEY (ID_INPUT_FEATURE_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT FK_GDX_HNF_CRUN_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDI_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT CK_GDX_HNF_CRUN_WEIGHT CHECK (WEIGHTING IN ('UNWEIGHTED','WEIGHTED')),
  -- 'COMPLETE_CASES' is the only value this project allows here, permanently -- same convention as
  -- GDX_HNF_LATENT_RUN (F2) and GDX_HNF_DISTANCE_RUN (F3). A person missing a real value on any
  -- feature selected for this run is excluded from it entirely, never imputed.
  CONSTRAINT CK_GDX_HNF_CRUN_SEL CHECK (INPUT_SELECTION IN ('COMPLETE_CASES')),
  CONSTRAINT CK_GDX_HNF_CRUN_FEATC CHECK (FEATURE_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_CRUN_PERSC CHECK (PERSON_COUNT > 0)
);

CREATE INDEX IX_GDX_HNF_CRUN_STUDY ON GDX_HNF_CDI_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_CRUN_FRUN ON GDX_HNF_CDI_RUN(ID_INPUT_FEATURE_RUN);
CREATE INDEX IX_GDX_HNF_CRUN_RSET ON GDX_HNF_CDI_RUN(ID_REFERENCE_SET);

CREATE SEQUENCE SEQ_GDX_HNF_CRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_CRUN FOR GDX_HNF_CDI_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_CDI_RUN IS NULL) THEN
    NEW.ID_CDI_RUN = NEXT VALUE FOR SEQ_GDX_HNF_CRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_RUN_FEATURE  (short code: CFEAT)
   Which GDX_HNF_FEATURE_DICTIONARY rows actually composed the compared vector
   for this run, in what order j=1..n, and under which weight w_j (1.0 for
   every row on an UNWEIGHTED run). Not inherited from the input F1 run's own
   GDX_HNF_FEATURE_RUN_MEMBER, because a CDI run can narrow that set further
   (e.g. to only the features the chosen reference set actually has a value
   for) -- same posture GDX_HNF_DISTANCE_DIMENSION already documents one layer
   down in F3. WEIGHT >= 0 is enforced here; "every weight is zero" (which
   would make the index undefined) cannot be expressed as a single-row CHECK
   and is enforced by the generating skill before any row is written.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_RUN_FEATURE (
  ID_CDI_RUN BIGINT NOT NULL,
  FEATURE_ORDER INTEGER NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  WEIGHT NUMERIC(18,6) DEFAULT 1 NOT NULL,
  CONSTRAINT PK_GDX_HNF_CFEAT PRIMARY KEY (ID_CDI_RUN, ID_FEATURE),
  CONSTRAINT FK_GDX_HNF_CFEAT_RUN FOREIGN KEY (ID_CDI_RUN) REFERENCES GDX_HNF_CDI_RUN(ID_CDI_RUN),
  CONSTRAINT FK_GDX_HNF_CFEAT_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_CFEAT_ORDER UNIQUE (ID_CDI_RUN, FEATURE_ORDER),
  CONSTRAINT CK_GDX_HNF_CFEAT_WEIGHT CHECK (WEIGHT >= 0)
);

CREATE INDEX IX_GDX_HNF_CFEAT_FEAT ON GDX_HNF_CDI_RUN_FEATURE(ID_FEATURE);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_VALUE  (short code: CVAL)
   The computed CDIx(t) (or CDIx_w(t)) for one person within one run --
   always a real, fully computed, non-negative number. INPUT_SELECTION=
   'COMPLETE_CASES' on the parent run means this person already has a real,
   non-missing value on every feature selected for this run AND the chosen
   reference set already has a value for every one of them, so there is no
   IS_MISSING flag here the way GDX_HNF_FEATURE_VALUE needs one.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_VALUE (
  ID_CDI_VALUE BIGINT NOT NULL,
  ID_CDI_RUN BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  CDI_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_CVAL PRIMARY KEY (ID_CDI_VALUE),
  CONSTRAINT FK_GDX_HNF_CVAL_RUN FOREIGN KEY (ID_CDI_RUN) REFERENCES GDX_HNF_CDI_RUN(ID_CDI_RUN),
  CONSTRAINT FK_GDX_HNF_CVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_CVAL UNIQUE (ID_CDI_RUN, ID_PERSON),
  CONSTRAINT CK_GDX_HNF_CVAL_NONNEG CHECK (CDI_VALUE >= 0)
);

CREATE INDEX IX_GDX_HNF_CVAL_RUN ON GDX_HNF_CDI_VALUE(ID_CDI_RUN);
CREATE INDEX IX_GDX_HNF_CVAL_PERSON ON GDX_HNF_CDI_VALUE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_HNF_CVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_CVAL FOR GDX_HNF_CDI_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_CDI_VALUE IS NULL) THEN
    NEW.ID_CDI_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_CVAL;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_CDI_VALUE_DETAIL  (short code: CDET)
   One row per (CDI value, feature): the real current/reference coordinates,
   their signed difference and the weight actually applied -- the full
   per-feature breakdown behind one CDI_VALUE scalar. Summarizing a
   multivariate displacement into one number discards which features moved
   and in which direction; this table is what lets a human recover that
   without re-deriving it from GDX_HNF_FEATURE_VALUE and
   GDX_HNF_CDI_REFERENCE_VALUE by hand.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_CDI_VALUE_DETAIL (
  ID_CDI_VALUE BIGINT NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  CURRENT_VALUE NUMERIC(18,6) NOT NULL,
  REFERENCE_VALUE NUMERIC(18,6) NOT NULL,
  DIFFERENCE NUMERIC(18,6) NOT NULL,
  WEIGHT NUMERIC(18,6) NOT NULL,
  CONSTRAINT PK_GDX_HNF_CDET PRIMARY KEY (ID_CDI_VALUE, ID_FEATURE),
  CONSTRAINT FK_GDX_HNF_CDET_VAL FOREIGN KEY (ID_CDI_VALUE) REFERENCES GDX_HNF_CDI_VALUE(ID_CDI_VALUE),
  CONSTRAINT FK_GDX_HNF_CDET_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT CK_GDX_HNF_CDET_WEIGHT CHECK (WEIGHT >= 0)
);

CREATE INDEX IX_GDX_HNF_CDET_FEAT ON GDX_HNF_CDI_VALUE_DETAIL(ID_FEATURE);

COMMIT;
