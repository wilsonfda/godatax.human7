/* ============================================================================
   Relational model - Temporal dynamics and evolution of a person (Firebird 2.5)
   Module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql
   (F4, original characteristics) already applied, AND at least one
   GDX_HNF_CDI_REFERENCE_SET already exists whose own GDX_HNF_CDI_REFERENCE_VALUE
   rows cover a feature set with more than one real session for the subject in
   question -- this module has nothing to build a trajectory from otherwise.

   This module implements F6_TEMPORAL_DYNAMICS_PERSON_EVOLUTION: for one real
   subject, a sequence of real, already-normalized observations across real
   sessions becomes a trajectory, and the already-validated RMS-distance shape
   this folder's own F4 layer established is evaluated AT EACH real session
   instead of once -- never a new distance formula, only the same one applied
   repeatedly along real time:

     gamma_i(t) = h_i(t)                              trajectory (a sequence of
                                                        real points, one per
                                                        real session)
     CDIx(t_s) = sqrt( (1/n) * sum_j ( z_j(t_s) - z_j_ref )^2 )   same RMS shape
                                                        as GDX_HNF_CDI_VALUE,
                                                        evaluated at session s
     DeltaCDI  = CDIx(t_after) - CDIx(t_before)        change in displacement
                                                        between two real,
                                                        adjacent sessions
     v(t)      = |DeltaCDI| / Delta_t                  a DISCRETE finite-
                                                        difference approximation
                                                        of ||d(gamma)/dt||_g,
                                                        never a true derivative

   What "gamma_i(t) = h_i(t)" becomes here, concretely: this project's own F2
   layer collapses every repeated session into exactly ONE latent coordinate
   per person before fitting (see hypotheses_non_fingo_latent_representations_
   model_firebird25.sql's own header) -- there is therefore no multi-session
   latent trajectory anywhere in this project's own data today. What DOES exist,
   real and multi-session, is GDX_HNF_FEATURE_VALUE itself (F1): a physiological
   feature with repeated administrations (e.g. a cardiac-coherence session)
   carries several real OBS_GRAIN_KEY rows for the same person, each with a
   real OBS_INSTANT. This module builds its trajectory in the ORIGINAL
   normalized feature space z(t) (never the latent h(t)) for exactly this
   reason: that is where this project's own real repeated-session data actually
   lives today. A future latent-space variant, if this project ever collapses
   sessions differently, is a separate, later extension -- not folded in here,
   same posture this folder's own F4-vs-F4-alternative split already takes.

   Velocity is a SCALAR rate of change of the already-aggregated CDIx(t) index
   itself (|DeltaCDI(t)| / Delta_t) -- NOT the vector velocity of the full
   underlying trajectory under some metric g on feature space, which the
   document's own v_i(t) = ||d(gamma_i(t))/dt||_g would require a separately
   defined g for (this module defines none beyond the RMS shape CDIx itself
   already is). It is also a DISCRETE approximation between two real,
   adjacent sessions, never a true derivative -- "quando existe
   diferenciabilidade" (when differentiability exists) is explicitly NOT
   assumed here; two discrete points do not establish a differentiable curve.
   A negative DeltaCDI means the person's own profile moved CLOSER to the
   chosen reference between those two sessions; it is never, by itself,
   evidence of improvement -- the same caution GDX_HNF_CDI_VALUE's own header
   already states for CDIx, now applied to its own change over time.

   Evolution and causal hypotheses (this project's own governance point,
   restated here because this module is exactly the layer that could tempt a
   causal reading): observing CDIx(t) rise or fall across real sessions shows
   a TEMPORAL ASSOCIATION, never an isolated cause. Sleep, expectation,
   maturation, test-repetition effects and environmental context can all
   explain a real change; attributing it to Virtology or any other
   intervention requires an appropriate design, a comparison condition and an
   assessment of bias this module does not, and cannot, supply on its own. Per
   this project's "never invent missing data" rule applied to causal claims as
   much as to numeric ones, GDX_HNF_TRAJECTORY_RUN.CAUSAL_CLAIM_MADE carries a
   CHECK that it always equals 0, and CAUSAL_CAVEAT_NOTE is a mandatory,
   non-empty column this module always fills with the same fixed explanation --
   the same structural-refusal pattern this folder's own F5_GEOMETRIC_CURVATURE
   already uses for SCALAR_CURVATURE_COMPUTED, applied here to causal
   attribution instead of to a physical curvature claim.

   Which reference a trajectory is measured against is reused, never rebuilt:
   GDX_HNF_TRAJECTORY_RUN.ID_REFERENCE_SET is a direct FK into this folder's own
   GDX_HNF_CDI_REFERENCE_SET (F4) -- this module never constructs a reference
   center of its own, the same separation of concerns F4_REFERENCE_PROFILES
   already enforces one layer up ("does NOT build a reference set's own center
   value -- that stays F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS's own job"). A
   study whose only existing reference sets do not cover the subject's own
   repeated-session features has nothing for this module to evaluate against
   until F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS is run again with a --feature
   filter that reaches those features -- this module does not work around that
   by inventing a reference inline.

   Session structure: this module requires every feature in its own trajectory
   feature set to share the EXACT SAME ordered sequence of real OBS_GRAIN_KEY
   values for the subject -- there is no project-wide, cross-feature notion of
   "session 1, 2, 3..." otherwise, and inventing one by assuming different
   features' sessions line up would not be a real session boundary. The
   generating skill selects, among all candidate features (those covered by
   the chosen reference AND with more than one real session for the subject),
   the single largest group that actually shares one common session sequence;
   it never merges two different session structures into one trajectory.

   Integration with the prior skills in this folder, by design:
     - GDX_HNF_TRAJECTORY_RUN.ID_INPUT_FEATURE_RUN and ID_REFERENCE_SET are
       direct FKs into GDX_HNF_FEATURE_SPACE_RUN (F1) and GDX_HNF_CDI_REFERENCE_
       SET (F4) respectively -- this module never re-reads
       2.relational.model.psychometrics, 6.cardiac.coherence,
       7.multidimensional.database or 9.knowledge.graph directly, and never
       re-normalizes a feature or rebuilds a reference center on its own.
       "Reading the relational/BI/graph sources" for F6 is therefore satisfied
       *transitively*, through an already-run F1 ZSCORE run and an already-built
       F4 reference set, the same posture every later skill in this folder
       already takes.
     - GDX_HNF_TRAJECTORY_POINT/GDX_HNF_TRAJECTORY_STEP reuse the exact same
       RMS-distance arithmetic GDX_HNF_CDI_VALUE (F4) already validates --
       this module never redefines what CDIx is, it only evaluates it once per
       real session instead of once per run.

   Surrogate keys: GDX_HNF_TRAJECTORY_RUN, GDX_HNF_TRAJECTORY_POINT and
   GDX_HNF_TRAJECTORY_STEP use a BIGINT primary key assigned by a BEFORE INSERT
   trigger from a dedicated sequence whenever inserted with that column left
   NULL -- same convention as every *_RUN table in this folder.
   GDX_HNF_TRAJECTORY_RUN_FEATURE is a pure membership table and instead uses a
   composite primary key with no sequence, same shape as GDX_HNF_CDI_RUN_FEATURE.

   Table prefix: every table below is GDX_HNF_TRAJECTORY_<ENTITY>, kept
   unambiguous next to GDX_HNF_CDI_* / GDX_HNF_CDIH_* (F4), GDX_HNF_REFPROF_*
   (F4_REFERENCE_PROFILES) and GDX_HNF_VISDEPTH_* / GDX_HNF_DEPTHCURVE_* (F5),
   while staying within Firebird 2.5's 31-character identifier limit.

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table
   codes instead of the full table name, same reason and convention as every
   other schema in this folder:
     TRAJECTORY_RUN           -> TRUN
     TRAJECTORY_RUN_FEATURE      -> TRF
     TRAJECTORY_POINT               -> TPT
     TRAJECTORY_STEP                   -> TSTEP

   This script only creates tables/sequences/triggers/indexes -- no DML.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_TRAJECTORY_RUN  (short code: TRUN)
   One row per execution: one real subject, one evaluated F1 run, one reused
   F4 reference set, and the real session count actually found. Re-running
   against the same inputs always creates a new row, never an update in place,
   exactly like every other *_RUN table in this folder.

   CAUSAL_CLAIM_MADE is CHECKed to always equal 0 and CAUSAL_CAVEAT_NOTE is
   mandatory and non-empty -- this module never attributes a real CDIx change
   to a cause (see file header); the schema itself makes that refusal explicit
   and permanent, not just a comment.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_TRAJECTORY_RUN (
  ID_TRAJECTORY_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  ID_SUBJECT BIGINT NOT NULL,
  ID_INPUT_FEATURE_RUN BIGINT NOT NULL,
  ID_REFERENCE_SET BIGINT NOT NULL,
  SESSION_COUNT INTEGER NOT NULL,
  FEATURE_COUNT INTEGER NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  CAUSAL_CLAIM_MADE SMALLINT DEFAULT 0 NOT NULL,
  CAUSAL_CAVEAT_NOTE BLOB SUB_TYPE TEXT NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_TRUN PRIMARY KEY (ID_TRAJECTORY_RUN),
  CONSTRAINT FK_GDX_HNF_TRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_TRUN_SUBJ FOREIGN KEY (ID_SUBJECT) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT FK_GDX_HNF_TRUN_FRUN FOREIGN KEY (ID_INPUT_FEATURE_RUN) REFERENCES GDX_HNF_FEATURE_SPACE_RUN(ID_RUN),
  CONSTRAINT FK_GDX_HNF_TRUN_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDI_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT CK_GDX_HNF_TRUN_SESSC CHECK (SESSION_COUNT >= 2),
  CONSTRAINT CK_GDX_HNF_TRUN_FEATC CHECK (FEATURE_COUNT > 0),
  -- The permanent refusal: this layer never claims a real CDIx change was caused by anything.
  CONSTRAINT CK_GDX_HNF_TRUN_NOCAUSAL CHECK (CAUSAL_CLAIM_MADE = 0)
);

CREATE INDEX IX_GDX_HNF_TRUN_STUDY ON GDX_HNF_TRAJECTORY_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_TRUN_SUBJ ON GDX_HNF_TRAJECTORY_RUN(ID_SUBJECT);
CREATE INDEX IX_GDX_HNF_TRUN_FRUN ON GDX_HNF_TRAJECTORY_RUN(ID_INPUT_FEATURE_RUN);
CREATE INDEX IX_GDX_HNF_TRUN_RSET ON GDX_HNF_TRAJECTORY_RUN(ID_REFERENCE_SET);

CREATE SEQUENCE SEQ_GDX_HNF_TRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_TRUN FOR GDX_HNF_TRAJECTORY_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_TRAJECTORY_RUN IS NULL) THEN
    NEW.ID_TRAJECTORY_RUN = NEXT VALUE FOR SEQ_GDX_HNF_TRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_TRAJECTORY_RUN_FEATURE  (short code: TRF)
   Which GDX_HNF_FEATURE_DICTIONARY rows actually composed the per-session CDIx
   vector for this run, in what order j=1..n -- same role GDX_HNF_CDI_RUN_
   FEATURE already plays one layer down, keyed by trajectory run instead of
   CDI run.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_TRAJECTORY_RUN_FEATURE (
  ID_TRAJECTORY_RUN BIGINT NOT NULL,
  FEATURE_ORDER INTEGER NOT NULL,
  ID_FEATURE BIGINT NOT NULL,
  CONSTRAINT PK_GDX_HNF_TRF PRIMARY KEY (ID_TRAJECTORY_RUN, ID_FEATURE),
  CONSTRAINT FK_GDX_HNF_TRF_RUN FOREIGN KEY (ID_TRAJECTORY_RUN) REFERENCES GDX_HNF_TRAJECTORY_RUN(ID_TRAJECTORY_RUN),
  CONSTRAINT FK_GDX_HNF_TRF_FEAT FOREIGN KEY (ID_FEATURE) REFERENCES GDX_HNF_FEATURE_DICTIONARY(ID_FEATURE),
  CONSTRAINT UQ_GDX_HNF_TRF_ORDER UNIQUE (ID_TRAJECTORY_RUN, FEATURE_ORDER)
);

CREATE INDEX IX_GDX_HNF_TRF_FEAT ON GDX_HNF_TRAJECTORY_RUN_FEATURE(ID_FEATURE);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_TRAJECTORY_POINT  (short code: TPT)
   One row per (run, real session): the real session's own grain/instant and
   the resulting CDIx(t_s), evaluated against the run's own reused reference.
   SESSION_ORDER is 1-based and reflects real chronological order (by
   OBS_INSTANT when present); it is never reassigned once written.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_TRAJECTORY_POINT (
  ID_TRAJECTORY_POINT BIGINT NOT NULL,
  ID_TRAJECTORY_RUN BIGINT NOT NULL,
  SESSION_ORDER INTEGER NOT NULL,
  OBS_GRAIN_KEY VARCHAR(60) NOT NULL,
  OBS_INSTANT TIMESTAMP,
  CDI_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_TPT PRIMARY KEY (ID_TRAJECTORY_POINT),
  CONSTRAINT FK_GDX_HNF_TPT_RUN FOREIGN KEY (ID_TRAJECTORY_RUN) REFERENCES GDX_HNF_TRAJECTORY_RUN(ID_TRAJECTORY_RUN),
  CONSTRAINT UQ_GDX_HNF_TPT_ORDER UNIQUE (ID_TRAJECTORY_RUN, SESSION_ORDER),
  CONSTRAINT CK_GDX_HNF_TPT_SESSORD CHECK (SESSION_ORDER > 0),
  CONSTRAINT CK_GDX_HNF_TPT_NONNEG CHECK (CDI_VALUE >= 0)
);

CREATE INDEX IX_GDX_HNF_TPT_RUN ON GDX_HNF_TRAJECTORY_POINT(ID_TRAJECTORY_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_TPT;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_TPT FOR GDX_HNF_TRAJECTORY_POINT ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_TRAJECTORY_POINT IS NULL) THEN
    NEW.ID_TRAJECTORY_POINT = NEXT VALUE FOR SEQ_GDX_HNF_TPT;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_TRAJECTORY_STEP  (short code: TSTEP)
   One row per (run, step between two real sessions): the real, signed
   DELTA_CDI (= CDIx(to) - CDIx(from) -- a negative value means movement TOWARD
   the chosen reference, never "improvement" by itself), the real elapsed time
   when both sessions have a real OBS_INSTANT, and the resulting discrete
   velocity when a positive elapsed time is available. TO_SESSION_ORDER must
   be strictly after FROM_SESSION_ORDER (a forward-in-time comparison); the
   generating skill writes one row per pair of real, CONSECUTIVE sessions by
   default -- this table does not require strict adjacency so a later,
   explicit non-adjacent "before vs. after" comparison can reuse it without a
   schema change, but that is not generated automatically today.

   VELOCITY is NULL whenever DELTA_T_SECONDS is NULL or not strictly positive
   -- never defaulted to 0 or fabricated from an assumed, unmeasured interval.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_TRAJECTORY_STEP (
  ID_TRAJECTORY_STEP BIGINT NOT NULL,
  ID_TRAJECTORY_RUN BIGINT NOT NULL,
  FROM_SESSION_ORDER INTEGER NOT NULL,
  TO_SESSION_ORDER INTEGER NOT NULL,
  DELTA_CDI NUMERIC(18,8) NOT NULL,
  DELTA_T_SECONDS NUMERIC(18,3),
  VELOCITY NUMERIC(18,8),
  CONSTRAINT PK_GDX_HNF_TSTEP PRIMARY KEY (ID_TRAJECTORY_STEP),
  CONSTRAINT FK_GDX_HNF_TSTEP_RUN FOREIGN KEY (ID_TRAJECTORY_RUN) REFERENCES GDX_HNF_TRAJECTORY_RUN(ID_TRAJECTORY_RUN),
  CONSTRAINT UQ_GDX_HNF_TSTEP_PAIR UNIQUE (ID_TRAJECTORY_RUN, FROM_SESSION_ORDER, TO_SESSION_ORDER),
  CONSTRAINT CK_GDX_HNF_TSTEP_ORDER CHECK (TO_SESSION_ORDER > FROM_SESSION_ORDER),
  CONSTRAINT CK_GDX_HNF_TSTEP_DT CHECK (DELTA_T_SECONDS IS NULL OR DELTA_T_SECONDS > 0),
  CONSTRAINT CK_GDX_HNF_TSTEP_VEL CHECK (VELOCITY IS NULL OR VELOCITY >= 0),
  -- A velocity is only ever recorded when a real, positive elapsed time was available to divide by.
  CONSTRAINT CK_GDX_HNF_TSTEP_VELDT CHECK (VELOCITY IS NULL OR DELTA_T_SECONDS IS NOT NULL)
);

CREATE INDEX IX_GDX_HNF_TSTEP_RUN ON GDX_HNF_TRAJECTORY_STEP(ID_TRAJECTORY_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_TSTEP;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_TSTEP FOR GDX_HNF_TRAJECTORY_STEP ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_TRAJECTORY_STEP IS NULL) THEN
    NEW.ID_TRAJECTORY_STEP = NEXT VALUE FOR SEQ_GDX_HNF_TSTEP;
END^

SET TERM ; ^

COMMIT;
