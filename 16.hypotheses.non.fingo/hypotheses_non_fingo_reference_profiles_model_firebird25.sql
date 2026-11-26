/* ============================================================================
   Relational model - Reference profiles: three bases and the dual-index pairing (Firebird 2.5)
   Module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_feature_space_model_firebird25.sql (F1) AND
   hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql (F4, original
   characteristics) already applied, AND F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS
   must have already produced at least one GDX_HNF_CDI_REFERENCE_SET and at
   least one GDX_HNF_CDI_RUN for the study in question -- this module has
   nothing to annotate or pair otherwise.

   This module implements F4_REFERENCE_PROFILES: this project's own layer for
   the question every CDI value ultimately depends on -- "distance to WHAT?".
   It does not recompute a reference center or a CDI value (both already
   belong to F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS and its own
   GDX_HNF_CDI_REFERENCE_SET/GDX_HNF_CDI_REFERENCE_VALUE/GDX_HNF_CDI_RUN/
   GDX_HNF_CDI_VALUE); it ANNOTATES and PAIRS what that layer already froze, to
   make the three reference bases and their governance distinctions auditable
   as first-class rows rather than free-text notes:

     - personal baseline        one person's own mean/median of earliest m
                                 real sessions of z(t) -- ALREADY fully built
                                 and stored by GDX_HNF_CDI_REFERENCE_SET/
                                 GDX_HNF_CDI_REFERENCE_VALUE with
                                 REFERENCE_TYPE='PERSONAL_BASELINE', and the
                                 per-session/per-feature worked breakdown is
                                 already recoverable from GDX_HNF_CDI_VALUE_
                                 DETAIL. This module adds nothing structural
                                 here -- the generating script's own reporting
                                 path reads those tables back; see "What this
                                 module intentionally does NOT add" below.
     - population reference      a group distribution, possibly stratified by
                                 age, protocol, site or another legitimate
                                 covariate -- ALREADY built and stored by the
                                 same two tables with REFERENCE_TYPE=
                                 'STUDY_COHORT' or 'POPULATION_REFERENCE', but
                                 with NO structured place to record WHICH
                                 stratification defined the group beyond a
                                 free-text NOTES field and a plain person
                                 count. GDX_HNF_REFPROF_STRATUM (below) is that
                                 structured place.
     - normative reference       values taken from an instrument's own manual
                                 or validation study -- ALREADY built and
                                 stored with REFERENCE_TYPE='INSTRUMENT_NORM',
                                 but with no structured place to record WHICH
                                 manual, instrument version, validation
                                 population or unit kind (a percentile, a raw
                                 interval, an ordinal category -- not
                                 automatically comparable to one another)
                                 backs it, nor the transformation that brings
                                 it into the common z(t) space. GDX_HNF_REFPROF_
                                 NORM_SOURCE (below) is that structured place.

   The fourth structural addition is the one piece of real, new computation
   this module is responsible for -- the "two parallel indices" pairing: for
   the SAME evaluated GDX_HNF_FEATURE_SPACE_RUN (the same frozen z(t), the
   same frozen mu/sigma -- see "Separation between normalization and
   reference" below), a person's displacement from their OWN history
   (CDIpersonal, a GDX_HNF_CDI_RUN scored against a PERSONAL_BASELINE
   reference set) and their displacement from a chosen group
   (CDIpopulation, a GDX_HNF_CDI_RUN scored against a STUDY_COHORT or
   POPULATION_REFERENCE reference set) answer two distinct questions and are
   never fused into one number without separate justification:

     CDIpersonal(t)   = dRMS( z(t), z_base )          already computed and
     CDIpopulation(t) = dRMS( z(t), z_pop-ref )       frozen by two separate,
                                                       independent GDX_HNF_
                                                       CDI_RUN rows

   GDX_HNF_REFPROF_DUAL_RUN/GDX_HNF_REFPROF_DUAL_VALUE (below) pair those two
   already-frozen runs by person and freeze both scalars side by side, in
   the exact same spirit (and largely the same shape) as this folder's own
   GDX_HNF_CDI_COMPARE_RUN/GDX_HNF_CDI_COMPARE_VALUE (which pairs CDIx against
   CDIh, the original-vs-latent-space comparison, one layer up) -- except this
   module pairs two runs that live in the SAME space (original characteristics)
   but differ in WHICH reference basis they were scored against. Deliberately,
   and for the same reason this project's comparison layer never stores a
   fused scalar for CDIx/CDIh, GDX_HNF_REFPROF_DUAL_VALUE has no "combined" or
   "average" column: the two indices "podem coexistir, porem nao devem ser
   fundidos sem justificativa" -- they can coexist, but must not be merged
   without justification.

   Separation between normalization and reference (governance principle, not
   a new table): standardizing z(t) (mu/sigma, frozen once by
   GDX_HNF_FEATURE_SPACE_RUN in F1) and choosing what a CDI value is measured
   AGAINST (the reference center, frozen once by GDX_HNF_CDI_REFERENCE_SET in
   F4) are two independent decisions. It is entirely legitimate to standardize
   a feature by population parameters yet compare the result to a personal
   mean of earlier, equally standardized sessions -- but redefining mu/sigma
   on every session would introduce a moving comparison point and destroy any
   longitudinal reading, exactly as GDX_HNF_FEATURE_SPACE_RUN's own frozen-
   parameters convention already guards against one layer down. This module's
   own contribution to that guarantee: GDX_HNF_REFPROF_DUAL_RUN's two paired
   CDI runs (ID_PERSONAL_CDI_RUN, ID_POPULATION_CDI_RUN) must be scored against
   the exact SAME GDX_HNF_FEATURE_SPACE_RUN (the same ID_INPUT_FEATURE_RUN on
   both GDX_HNF_CDI_RUN rows) -- otherwise the two halves of the pairing would
   silently rest on two different frozen standardizations, and the comparison
   would not be measuring what it claims to measure. A CHECK constraint cannot
   compare columns of two different GDX_HNF_CDI_RUN rows read through two FKs
   in Firebird 2.5 (the same documented limitation already accepted one layer
   down for GDX_HNF_CDI_RUN_FEATURE's weight-sum-must-be-positive rule and for
   GDX_HNF_CDIH_RUN's own latent-run pinning) -- the generating skill enforces
   this before any row is written, not this DDL.

   What this module intentionally does NOT add:
     - No duplicate of GDX_HNF_CDI_REFERENCE_SET/GDX_HNF_CDI_REFERENCE_VALUE.
       The personal-baseline, study-cohort and population-reference centers
       themselves stay exactly where F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS
       already freezes them; this module only attaches structured provenance
       (stratification, norm source) to specific rows of that same table by
       FK, and never writes a z_j_ref value of its own.
     - No duplicate of GDX_HNF_CDI_VALUE/GDX_HNF_CDI_VALUE_DETAIL. The
       per-person CDIpersonal/CDIpopulation scalars and their own per-feature
       difference vectors stay exactly where that same skill already freezes
       them; GDX_HNF_REFPROF_DUAL_VALUE only COPIES the two already-real
       scalars side by side for a chosen pair of runs, the same posture
       GDX_HNF_CDI_COMPARE_VALUE already takes toward GDX_HNF_CDI_VALUE/
       GDX_HNF_CDIH_VALUE one layer up.
     - No table for the worked multivariate baseline illustration (this
       project's own design-document section "8.2"): that walkthrough --
       three sessions of several indicators averaged into one baseline vector,
       then compared to a fourth observation -- is nothing more than one
       PERSONAL_BASELINE GDX_HNF_CDI_REFERENCE_SET/GDX_HNF_CDI_REFERENCE_VALUE
       plus one GDX_HNF_CDI_RUN/GDX_HNF_CDI_VALUE_DETAIL already scored against
       it. This module's own (pending) compute script reports that existing
       data; it does not persist a second copy of it.
     - No catalog/lookup table restating, in rows, the three-bases-and-their-
       senses comparison (which basis answers which question) -- that is
       fixed documentation, already carried by GDX_HNF_CDI_REFERENCE_SET.
       REFERENCE_TYPE's own CHECK domain and by this header and this skill's
       own SKILL.md; turning it into a seeded data table would duplicate
       documentation as data for no computational benefit.

   Integration with the prior skills in this folder, by design:
     - GDX_HNF_REFPROF_STRATUM.ID_REFERENCE_SET and GDX_HNF_REFPROF_NORM_SOURCE.
       ID_REFERENCE_SET are both direct FKs into GDX_HNF_CDI_REFERENCE_SET
       (F4, original characteristics) -- never a new reference-center table.
     - GDX_HNF_REFPROF_DUAL_RUN.ID_PERSONAL_CDI_RUN and
       ID_POPULATION_CDI_RUN are both direct FKs into GDX_HNF_CDI_RUN (F4,
       original characteristics) -- never a recomputation of either CDI run.
     - GDX_HNF_REFPROF_DUAL_VALUE.CDI_PERSONAL_VALUE/CDI_POPULATION_VALUE are
       copies of real GDX_HNF_CDI_VALUE.CDI_VALUE rows, exactly as GDX_HNF_
       CDI_COMPARE_VALUE already copies GDX_HNF_CDI_VALUE/GDX_HNF_CDIH_VALUE
       one layer up.
     - This module never re-reads 2.relational.model.psychometrics,
       6.cardiac.coherence, 7.multidimensional.database or 9.knowledge.graph
       directly, and never re-normalizes a feature or re-derives a reference
       center on its own -- F1 and F4 (original characteristics) have already
       done that work. "Reading the relational/BI/graph sources" for this
       layer is therefore satisfied *transitively*, through already-run F1 and
       F4 outputs, the same posture F2/F3/F4-latent/F4-compare already take.

   Which REFERENCE_TYPE a GDX_HNF_REFPROF_STRATUM or GDX_HNF_REFPROF_NORM_SOURCE
   row may attach to, and which REFERENCE_TYPE each half of a GDX_HNF_REFPROF_
   DUAL_RUN pairing must resolve to, are business rules this DDL documents but
   cannot fully enforce with a single-row CHECK (reading GDX_HNF_CDI_REFERENCE_
   SET.REFERENCE_TYPE through a FK is a cross-table read) -- same documented
   limitation already accepted throughout this folder's own schemas. The
   generating skill enforces all of the following before any row is written:
     - a GDX_HNF_REFPROF_STRATUM row's own ID_REFERENCE_SET must resolve to
       REFERENCE_TYPE IN ('STUDY_COHORT','POPULATION_REFERENCE');
     - a GDX_HNF_REFPROF_NORM_SOURCE row's own ID_REFERENCE_SET must resolve
       to REFERENCE_TYPE='INSTRUMENT_NORM';
     - a GDX_HNF_REFPROF_DUAL_RUN's ID_PERSONAL_CDI_RUN must resolve, through
       GDX_HNF_CDI_RUN.ID_REFERENCE_SET, to REFERENCE_TYPE='PERSONAL_BASELINE',
       and its ID_POPULATION_CDI_RUN must resolve to REFERENCE_TYPE IN
       ('STUDY_COHORT','POPULATION_REFERENCE');
     - both halves of that same pairing must share the exact same
       GDX_HNF_CDI_RUN.ID_INPUT_FEATURE_RUN and the exact same ID_STUDY as the
       GDX_HNF_REFPROF_DUAL_RUN row itself.

   Surrogate keys: GDX_HNF_REFPROF_DUAL_RUN and GDX_HNF_REFPROF_DUAL_VALUE use
   a BIGINT primary key assigned by a BEFORE INSERT trigger from a dedicated
   sequence whenever inserted with that column left NULL -- same convention as
   every *_RUN/*_VALUE table in this folder. GDX_HNF_REFPROF_STRATUM and
   GDX_HNF_REFPROF_NORM_SOURCE are pure annotation tables keyed directly by the
   reference set they describe and use no sequence of their own, same shape as
   GDX_HNF_CDI_REFERENCE_VALUE.

   Table prefix: every table below is GDX_HNF_REFPROF_<ENTITY>, same GDX_HNF_
   convention as this folder's other schemas, with a REFPROF_ segment so this
   layer's own tables group together and stay unambiguous next to
   GDX_HNF_FEATURE_*, GDX_HNF_LATENT_*, GDX_HNF_DISTANCE_*, GDX_HNF_CDI_* and
   GDX_HNF_CDIH_*.

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table
   codes instead of the full table name, to stay within Firebird 2.5's
   31-character identifier limit -- same reason and convention as this
   folder's other schemas:
     REFPROF_STRATUM       -> RPSTR
     REFPROF_NORM_SOURCE     -> RPNRM
     REFPROF_DUAL_RUN           -> RPDRUN
     REFPROF_DUAL_VALUE            -> RPDVAL

   This script only creates tables/sequences/triggers/indexes -- no DML. The
   companion compute script for this layer (reading GDX_HNF_CDI_* back and
   writing the GDX_HNF_REFPROF_* rows below) is a later, separate deliverable
   of F4_REFERENCE_PROFILES -- not part of this file.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_REFPROF_STRATUM  (short code: RPSTR)
   One row per (reference set, stratifying variable): structured provenance
   for a STUDY_COHORT/POPULATION_REFERENCE basis -- WHICH covariate (age band,
   protocol, site, measurement phase, or another legitimate stratifier) and
   which level/value of it defined the group a given reference set's own mean
   was computed over. A reference set with no deliberate stratification (the
   full complete-case sample of one run, unstratified) simply has no row here
   -- this table is never populated with an invented stratifier to make a
   reference "look" stratified.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_REFPROF_STRATUM (
  ID_REFERENCE_SET BIGINT NOT NULL,
  STRATUM_VARIABLE VARCHAR(80) NOT NULL,
  STRATUM_VALUE VARCHAR(160) NOT NULL,
  CONSTRAINT PK_GDX_HNF_RPSTR PRIMARY KEY (ID_REFERENCE_SET, STRATUM_VARIABLE),
  CONSTRAINT FK_GDX_HNF_RPSTR_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDI_REFERENCE_SET(ID_REFERENCE_SET)
);

CREATE INDEX IX_GDX_HNF_RPSTR_VAR ON GDX_HNF_REFPROF_STRATUM(STRATUM_VARIABLE);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_REFPROF_NORM_SOURCE  (short code: RPNRM)
   One row per reference set (REFERENCE_TYPE='INSTRUMENT_NORM' only):
   structured provenance for a normative basis -- which instrument and
   version, which manual or validation study, which population the norm was
   itself validated on, which unit kind it is expressed in (a percentile, a
   raw interval, an ordinal category and a standard score are NOT
   automatically comparable to one another -- see this module's own header),
   and the transformation that carries it into the common z(t) space.
   TRANSFORMATION_NOTES is mandatory: an instrument norm this project cannot
   explain how to bring into the comparison space is not usable as a
   reference, per this project's "never invent missing data" rule applied to
   provenance, not just to values.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_REFPROF_NORM_SOURCE (
  ID_REFERENCE_SET BIGINT NOT NULL,
  INSTRUMENT_NAME VARCHAR(160) NOT NULL,
  INSTRUMENT_VERSION VARCHAR(60),
  SOURCE_DOCUMENT VARCHAR(250) NOT NULL,
  NORM_POPULATION VARCHAR(250),
  LANGUAGE_OR_CULTURE VARCHAR(80),
  NORM_UNIT_KIND VARCHAR(30) NOT NULL,
  TRANSFORMATION_NOTES BLOB SUB_TYPE TEXT NOT NULL,
  CONSTRAINT PK_GDX_HNF_RPNRM PRIMARY KEY (ID_REFERENCE_SET),
  CONSTRAINT FK_GDX_HNF_RPNRM_RSET FOREIGN KEY (ID_REFERENCE_SET) REFERENCES GDX_HNF_CDI_REFERENCE_SET(ID_REFERENCE_SET),
  CONSTRAINT CK_GDX_HNF_RPNRM_UNIT CHECK (NORM_UNIT_KIND IN ('PERCENTILE','RAW_INTERVAL','ORDINAL_CATEGORY','STANDARD_SCORE','OTHER'))
);

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_REFPROF_DUAL_RUN  (short code: RPDRUN)
   One row per execution of this layer's pairing script for one study, one
   GDX_HNF_CDI_RUN scored against a PERSONAL_BASELINE reference set
   (CDIpersonal) and one GDX_HNF_CDI_RUN scored against a STUDY_COHORT or
   POPULATION_REFERENCE reference set (CDIpopulation) -- both evaluated
   against the exact same GDX_HNF_FEATURE_SPACE_RUN (see this module's own
   header, "Separation between normalization and reference"). Re-pairing the
   same two source runs always creates a new row here, never an update in
   place, exactly like every other *_RUN table in this folder.
   EXCLUDED_PERSONAL_ONLY_COUNT / EXCLUDED_POPULATION_ONLY_COUNT record, by
   count, every person present in exactly one of the two source runs' own
   complete-case sets -- never silently dropped without being counted.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_REFPROF_DUAL_RUN (
  ID_DUAL_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  ID_PERSONAL_CDI_RUN BIGINT NOT NULL,
  ID_POPULATION_CDI_RUN BIGINT NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  PAIRED_PERSON_COUNT INTEGER NOT NULL,
  EXCLUDED_PERSONAL_ONLY_COUNT INTEGER DEFAULT 0 NOT NULL,
  EXCLUDED_POPULATION_ONLY_COUNT INTEGER DEFAULT 0 NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_RPDRUN PRIMARY KEY (ID_DUAL_RUN),
  CONSTRAINT FK_GDX_HNF_RPDRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_RPDRUN_PCDI FOREIGN KEY (ID_PERSONAL_CDI_RUN) REFERENCES GDX_HNF_CDI_RUN(ID_CDI_RUN),
  CONSTRAINT FK_GDX_HNF_RPDRUN_QCDI FOREIGN KEY (ID_POPULATION_CDI_RUN) REFERENCES GDX_HNF_CDI_RUN(ID_CDI_RUN),
  -- The two halves of a pairing must be two DIFFERENT GDX_HNF_CDI_RUN rows; which REFERENCE_TYPE
  -- each one resolves to (PERSONAL_BASELINE vs. STUDY_COHORT/POPULATION_REFERENCE) and that both
  -- share the same ID_INPUT_FEATURE_RUN and the same ID_STUDY as this row are enforced by the
  -- generating skill -- see this module's own header for why a single-row CHECK cannot express them.
  CONSTRAINT CK_GDX_HNF_RPDRUN_DISTINCT CHECK (ID_PERSONAL_CDI_RUN <> ID_POPULATION_CDI_RUN),
  CONSTRAINT CK_GDX_HNF_RPDRUN_PAIRC CHECK (PAIRED_PERSON_COUNT > 0),
  CONSTRAINT CK_GDX_HNF_RPDRUN_EXCP CHECK (EXCLUDED_PERSONAL_ONLY_COUNT >= 0),
  CONSTRAINT CK_GDX_HNF_RPDRUN_EXCQ CHECK (EXCLUDED_POPULATION_ONLY_COUNT >= 0)
);

CREATE INDEX IX_GDX_HNF_RPDRUN_STUDY ON GDX_HNF_REFPROF_DUAL_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_RPDRUN_PCDI ON GDX_HNF_REFPROF_DUAL_RUN(ID_PERSONAL_CDI_RUN);
CREATE INDEX IX_GDX_HNF_RPDRUN_QCDI ON GDX_HNF_REFPROF_DUAL_RUN(ID_POPULATION_CDI_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_RPDRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_RPDRUN FOR GDX_HNF_REFPROF_DUAL_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_DUAL_RUN IS NULL) THEN
    NEW.ID_DUAL_RUN = NEXT VALUE FOR SEQ_GDX_HNF_RPDRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_REFPROF_DUAL_VALUE  (short code: RPDVAL)
   One row per (dual run, person) present in BOTH source runs: that person's
   own real CDIpersonal (copied from the personal-baseline GDX_HNF_CDI_VALUE)
   and real CDIpopulation (copied from the study-cohort/population-reference
   GDX_HNF_CDI_VALUE), side by side. Deliberately has NO merged, averaged or
   otherwise "combined" column -- this module's own header, and this
   project's own design document, are explicit that the two indices answer
   different questions and must not be fused without separate justification
   this schema does not supply on its own.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_REFPROF_DUAL_VALUE (
  ID_DUAL_VALUE BIGINT NOT NULL,
  ID_DUAL_RUN BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  CDI_PERSONAL_VALUE NUMERIC(18,8) NOT NULL,
  CDI_POPULATION_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_RPDVAL PRIMARY KEY (ID_DUAL_VALUE),
  CONSTRAINT FK_GDX_HNF_RPDVAL_RUN FOREIGN KEY (ID_DUAL_RUN) REFERENCES GDX_HNF_REFPROF_DUAL_RUN(ID_DUAL_RUN),
  CONSTRAINT FK_GDX_HNF_RPDVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_RPDVAL UNIQUE (ID_DUAL_RUN, ID_PERSON),
  CONSTRAINT CK_GDX_HNF_RPDVAL_PERS_NONNEG CHECK (CDI_PERSONAL_VALUE >= 0),
  CONSTRAINT CK_GDX_HNF_RPDVAL_POP_NONNEG CHECK (CDI_POPULATION_VALUE >= 0)
);

CREATE INDEX IX_GDX_HNF_RPDVAL_RUN ON GDX_HNF_REFPROF_DUAL_VALUE(ID_DUAL_RUN);
CREATE INDEX IX_GDX_HNF_RPDVAL_PERSON ON GDX_HNF_REFPROF_DUAL_VALUE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_HNF_RPDVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_RPDVAL FOR GDX_HNF_REFPROF_DUAL_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_DUAL_VALUE IS NULL) THEN
    NEW.ID_DUAL_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_RPDVAL;
END^

SET TERM ; ^

COMMIT;
