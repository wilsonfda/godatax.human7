/* ============================================================================
   Relational model - Geometric curvature: visual depth and the scalar-curvature
   non-computation (Firebird 2.5)
   Module: 16.hypotheses.non.fingo

   Prerequisite: hypotheses_non_fingo_curvature_depth_index_model_firebird25.sql
   (F4, original characteristics) AND/OR
   hypotheses_non_fingo_curvature_depth_index_latent_model_firebird25.sql
   (F4-alternative, latent space) already applied, AND at least one
   GDX_HNF_CDI_RUN or GDX_HNF_CDIH_RUN already exists for the study in question --
   this module has nothing to scale otherwise.

   This module implements F5_GEOMETRIC_CURVATURE: this project's own layer for the
   question "is the Curvature Depth Index a geometric curvature?" -- and its own
   documented answer, NO. It separates two things this project's own design
   discussion is explicit about never conflating:

     (a) VISUAL DEPTH -- a deliberately simple, well-defined linear rescaling of
         an already-computed CDI value, used only to drive a graphic ("deeper"
         drawing for a larger CDI):

           profundidade_visual(t) = a * CDI(t),   a > 0

         `a` is a GRAPHIC GAIN, not a physical constant -- it fixes nothing about
         curvature, energy or geometry; it only controls how much a drawing's
         depth grows per unit of CDI. This module computes this, for real,
         because it is the one piece of section 9/9.1's own content that is
         actually well-defined and computable from data this project already
         has: an explicit linear transform of an explicit, already-frozen number.

     (b) SCALAR RIEMANNIAN CURVATURE -- the textbook quantity

           R(h) = g^(ab)(h) * R_(ab)(h)

         (R: scalar curvature; g^(ab): inverse metric components; R_(ab): Ricci
         tensor) IS established mathematics, but applying it to this project's
         own feature/latent space requires choosing coordinates, estimating a
         local structure AND metric, defining the regularity of a differentiable
         manifold, and validating statistical stability of all of that -- NONE of
         which this project's own pipeline (F1-F4, F4_REFERENCE_PROFILES) defines
         or fits anywhere. Training an autoencoder (F2's own latent space) does
         NOT automatically hand back an interpretable scalar curvature. This
         module therefore NEVER computes R(h) for real data -- doing so without a
         defined manifold/metric/connection would be exactly the kind of
         fabricated number this project's own "never invent missing data" rule
         forbids, dressed up as a sophisticated formula. Instead of silently
         omitting this fact, F5 records the refusal itself, per run, as an
         auditable row -- GDX_HNF_VISDEPTH_RUN.SCALAR_CURVATURE_COMPUTED is
         CHECKed to always equal 0, and SCALAR_CURVATURE_SCOPE_NOTE is a
         mandatory, non-empty explanation of why, so that a human reading this
         run's own row never has to take an absent column as evidence that
         curvature "was probably computed somewhere else" -- the schema itself
         makes the non-computation explicit and permanent.

   Why this separation matters (the governance point section 9's own discussion
   makes, echoed by the Einstein-as-analogy caution one sub-section later): a
   "deeper visual well" drawn from a larger CDI is a controlled graphic encoding,
   not evidence of curved space, consciousness, spiritual energy, or any
   equivalence between this project's statistical feature space and general
   relativity's physical space-time. The analogy (geodesic, curvature, "energy"
   carried from physics into this project's own vocabulary) is useful for
   imagining states and trajectories, but becomes misleading the moment it
   implies a causal or ontological equivalence it cannot support. This module's
   own job is to make exactly ONE part of that picture (the graphic rescaling)
   real and auditable, while making the OTHER part (a genuine scalar curvature)
   impossible to silently claim as done.

   Two CDI source kinds, matching the two spaces this folder's own F4 layer
   already computes a CDI in (never a third, invented source):
     - CDIX   original-characteristics CDI, GDX_HNF_CDI_RUN/GDX_HNF_CDI_VALUE
              (F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS)
     - CDIH   latent-space CDI, GDX_HNF_CDIH_RUN/GDX_HNF_CDIH_VALUE
              (F4_CURV_DEPTH_KPI_LATENT_SPACE)
   Exactly one of ID_CDI_RUN/ID_CDIH_RUN is set per GDX_HNF_VISDEPTH_RUN row,
   matching SOURCE_KIND -- enforced by the generating skill (a CHECK cannot
   express "the OTHER FK is NULL" together with "this FK's own target row
   belongs to the right table" across two different tables in Firebird 2.5; the
   single-row half of this rule -- exactly one of the two FK columns is non-NULL
   -- IS expressed below).

   The gain `a` (VISUAL_GAIN) is always explicit, never defaulted by this schema
   or by the generating skill -- same governance posture this folder's own
   GDX_HNF_CDI_RUN_FEATURE.WEIGHT already takes toward CDIx_w's weights ("a
   weight must never be chosen simply to produce a desired CDI value"): a gain
   must never be chosen simply to make a drawing look a particular way, and this
   schema only enforces the arithmetic constraint (a > 0), not that intent.

   Per-person traceability: GDX_HNF_VISDEPTH_VALUE stores BOTH the real source
   CDI value this run copied AND the resulting visual-depth value -- never only
   the rescaled number -- so a human can always recover exactly which real CDI
   this run started from, the same posture GDX_HNF_CDI_COMPARE_VALUE already
   takes toward the two real numbers it pairs one layer down.

   Integration with the prior skills in this folder, by design:
     - GDX_HNF_VISDEPTH_RUN.ID_CDI_RUN / ID_CDIH_RUN are direct FKs into
       GDX_HNF_CDI_RUN / GDX_HNF_CDIH_RUN (F4, both variants) -- this module never
       re-reads 2.relational.model.psychometrics, 6.cardiac.coherence,
       7.multidimensional.database or 9.knowledge.graph directly, and never
       recomputes CDIx/CDIh on its own; those two skills have already done that
       work. "Reading the relational/BI/graph sources" for F5 is therefore
       satisfied *transitively*, through an already-run F4 CDI/CDIh run, the same
       posture every later skill in this folder already takes one layer down.
     - GDX_HNF_VISDEPTH_VALUE.SOURCE_CDI_VALUE is a copy of a real GDX_HNF_CDI_
       VALUE.CDI_VALUE or GDX_HNF_CDIH_VALUE.CDIH_VALUE row, exactly as GDX_HNF_
       CDI_COMPARE_VALUE already copies both one layer up.
     - This module intentionally does NOT read GDX_HNF_REFPROF_DUAL_VALUE
       (F4_REFERENCE_PROFILES, CDIpersonal/CDIpopulation) -- section 9's own
       discussion names "CDI(t)" in the singular, the same quantity sections 6/7
       define; the personal/population dual-index pairing is a separate,
       later elaboration (section 8) this module does not fold in here.

   Surrogate keys: GDX_HNF_VISDEPTH_RUN and GDX_HNF_VISDEPTH_VALUE use a BIGINT
   primary key assigned by a BEFORE INSERT trigger from a dedicated sequence
   whenever inserted with that column left NULL -- same convention as every
   *_RUN/*_VALUE table in this folder.

   Table prefix: every table below is GDX_HNF_VISDEPTH_<ENTITY> -- "visual depth"
   is this module's own name for the one quantity it actually computes (9.1),
   kept unambiguous next to GDX_HNF_CDI_* / GDX_HNF_CDIH_* (F4) and GDX_HNF_REFPROF_*
   (F4_REFERENCE_PROFILES), while staying within Firebird 2.5's 31-character
   identifier limit.

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use short per-table codes
   instead of the full table name, same reason and convention as every other
   schema in this folder:
     VISDEPTH_RUN     -> VDRUN
     VISDEPTH_VALUE      -> VDVAL

   This script only creates tables/sequences/triggers/indexes -- no DML.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_VISDEPTH_RUN  (short code: VDRUN)
   One row per execution of this layer's compute script for one study, one
   already-computed CDI source (a GDX_HNF_CDI_RUN or a GDX_HNF_CDIH_RUN, never
   both) and one explicit graphic gain `a`. Re-running against the same source
   run and gain always creates a new row, never an update in place, exactly
   like every other *_RUN table in this folder.

   SCALAR_CURVATURE_COMPUTED is CHECKed to always equal 0 and
   SCALAR_CURVATURE_SCOPE_NOTE is mandatory and non-empty -- this layer never
   computes a true Riemannian scalar curvature (see file header); the schema
   itself makes that refusal explicit and permanent, not just a comment.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_VISDEPTH_RUN (
  ID_VISDEPTH_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  SOURCE_KIND VARCHAR(10) NOT NULL,
  ID_CDI_RUN BIGINT,
  ID_CDIH_RUN BIGINT,
  VISUAL_GAIN NUMERIC(18,6) NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  PERSON_COUNT INTEGER NOT NULL,
  SCALAR_CURVATURE_COMPUTED SMALLINT DEFAULT 0 NOT NULL,
  SCALAR_CURVATURE_SCOPE_NOTE BLOB SUB_TYPE TEXT NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_VDRUN PRIMARY KEY (ID_VISDEPTH_RUN),
  CONSTRAINT FK_GDX_HNF_VDRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_VDRUN_CDI FOREIGN KEY (ID_CDI_RUN) REFERENCES GDX_HNF_CDI_RUN(ID_CDI_RUN),
  CONSTRAINT FK_GDX_HNF_VDRUN_CDIH FOREIGN KEY (ID_CDIH_RUN) REFERENCES GDX_HNF_CDIH_RUN(ID_CDIH_RUN),
  CONSTRAINT CK_GDX_HNF_VDRUN_KIND CHECK (SOURCE_KIND IN ('CDIX','CDIH')),
  -- Exactly one of the two source FKs is set, matching SOURCE_KIND -- which one is checked here;
  -- that the referenced run also belongs to ID_STUDY is a cross-table rule the generating skill
  -- enforces (same documented limitation accepted throughout this folder's own schemas).
  CONSTRAINT CK_GDX_HNF_VDRUN_SRC CHECK (
    (SOURCE_KIND = 'CDIX' AND ID_CDI_RUN IS NOT NULL AND ID_CDIH_RUN IS NULL) OR
    (SOURCE_KIND = 'CDIH' AND ID_CDIH_RUN IS NOT NULL AND ID_CDI_RUN IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_VDRUN_GAIN CHECK (VISUAL_GAIN > 0),
  CONSTRAINT CK_GDX_HNF_VDRUN_PERSC CHECK (PERSON_COUNT > 0),
  -- The permanent refusal: this layer never claims to have computed a true scalar curvature.
  CONSTRAINT CK_GDX_HNF_VDRUN_NOCURV CHECK (SCALAR_CURVATURE_COMPUTED = 0)
);

CREATE INDEX IX_GDX_HNF_VDRUN_STUDY ON GDX_HNF_VISDEPTH_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_VDRUN_CDI ON GDX_HNF_VISDEPTH_RUN(ID_CDI_RUN);
CREATE INDEX IX_GDX_HNF_VDRUN_CDIH ON GDX_HNF_VISDEPTH_RUN(ID_CDIH_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_VDRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_VDRUN FOR GDX_HNF_VISDEPTH_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_VISDEPTH_RUN IS NULL) THEN
    NEW.ID_VISDEPTH_RUN = NEXT VALUE FOR SEQ_GDX_HNF_VDRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_VISDEPTH_VALUE  (short code: VDVAL)
   One row per (run, person): the real source CDI value this run copied
   (SOURCE_CDI_VALUE, from GDX_HNF_CDI_VALUE or GDX_HNF_CDIH_VALUE depending on
   the parent run's own SOURCE_KIND) and the resulting visual-depth value
   (VISUAL_DEPTH_VALUE = VISUAL_GAIN * SOURCE_CDI_VALUE) -- never only the
   rescaled number, so a human can always recover exactly which real CDI this
   run started from without re-reading the source table by hand.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_VISDEPTH_VALUE (
  ID_VISDEPTH_VALUE BIGINT NOT NULL,
  ID_VISDEPTH_RUN BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  SOURCE_CDI_VALUE NUMERIC(18,8) NOT NULL,
  VISUAL_DEPTH_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_VDVAL PRIMARY KEY (ID_VISDEPTH_VALUE),
  CONSTRAINT FK_GDX_HNF_VDVAL_RUN FOREIGN KEY (ID_VISDEPTH_RUN) REFERENCES GDX_HNF_VISDEPTH_RUN(ID_VISDEPTH_RUN),
  CONSTRAINT FK_GDX_HNF_VDVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_VDVAL UNIQUE (ID_VISDEPTH_RUN, ID_PERSON),
  CONSTRAINT CK_GDX_HNF_VDVAL_SRC_NONNEG CHECK (SOURCE_CDI_VALUE >= 0),
  CONSTRAINT CK_GDX_HNF_VDVAL_DEPTH_NONNEG CHECK (VISUAL_DEPTH_VALUE >= 0)
);

CREATE INDEX IX_GDX_HNF_VDVAL_RUN ON GDX_HNF_VISDEPTH_VALUE(ID_VISDEPTH_RUN);
CREATE INDEX IX_GDX_HNF_VDVAL_PERSON ON GDX_HNF_VISDEPTH_VALUE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_HNF_VDVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_VDVAL FOR GDX_HNF_VISDEPTH_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_VISDEPTH_VALUE IS NULL) THEN
    NEW.ID_VISDEPTH_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_VDVAL;
END^

SET TERM ; ^

COMMIT;


/* ============================================================================
   Addendum: section 9.3, "Como produzir a curva utilizando os dados reais?"
   ("How to produce the curve using real data?")

   Section 9.1 (above) already separates the VISUAL rescaling (profundidade_visual
   = a * CDI) from a true scalar curvature (never computed here). Section 9.3
   makes the SAME separation concrete for one specific illustrative curve shape
   -- a Gaussian dip, drawn so its single deepest point equals the real,
   negated CDI(t):

     y(s) = -CDI(t) * exp( -s^2 / (2 * sigma^2) )

   s: the curve's own drawing coordinate (a horizontal position ALONG THE
      DRAWING, never a real measured dimension of any person -- there is no
      GDX_HNF_* column anywhere that "s" corresponds to); sigma: a WIDTH design
      choice (how spread out the dip looks), exactly as much a graphic
      parameter as section 9.1's own gain `a`; CDI(t): the real, already-frozen
      CDIx or CDIh this run reads back, never recomputed here.

   The document's own worked illustration: a participant with CDIx(t) = 0.8
   plotted as y(s) = -0.8 * exp(-s^2/2) -- "isso produz uma depressao visual
   cujo ponto mais profundo corresponde a -0.8" ("this produces a visual
   depression whose deepest point equals -0.8"). Two separate operations,
   explicitly distinguished by the document itself:
     1. Cálculo do CDI (CDIx(t) = sqrt( (1/n) sum_j (z_j(t)-z_j_ref)^2 )) --
        already computed and frozen by F4_CURV_DEPTH_KPI_ORIG_CHARACTERISTICS/
        F4_CURV_DEPTH_KPI_LATENT_SPACE, never recomputed by this addendum.
     2. Representação gráfica do CDI (y(s) above) -- an illustrative curve
        shape, never a measurement, never a curvature.

   What is actually persisted, and why nothing more is: y(0) = -CDI(t) is the
   ONLY point on the curve a real, per-person number actually determines --
   plugging s=0 into the formula always returns exactly the negated CDI(t)
   regardless of sigma (e^0 = 1). sigma only controls how WIDE the dip looks
   away from that one real point; it changes no real quantity. So this
   addendum stores exactly the two real/parametric inputs that fully determine
   the curve for a person -- the run's own sigma (one design choice, shared by
   every person in the run) and that person's own real, negated CDI(t)
   (CURVE_MIN_VALUE) -- and nothing else. Sampling y(s) across a grid of s to
   actually draw the dip is a lightweight, deterministic, non-persisted
   computation this schema deliberately leaves to a rendering step (same
   posture every GRAPH skill in this folder already takes toward its own
   render-time-only statistics), never baked into stored rows here.

   Same permanent refusal as section 9.1's own GDX_HNF_VISDEPTH_RUN: this is
   still an illustrative curve, never a measurement of curvature. GDX_HNF_
   DEPTHCURVE_RUN.SCALAR_CURVATURE_COMPUTED carries the exact same CHECK (always
   0) and a mandatory SCALAR_CURVATURE_SCOPE_NOTE, for the exact same reason
   documented at the top of this file.

   Table prefix: GDX_HNF_DEPTHCURVE_<ENTITY>, kept unambiguous next to this same
   file's own GDX_HNF_VISDEPTH_* (section 9.1) while staying within Firebird
   2.5's 31-character identifier limit. Short codes: DEPTHCURVE_RUN -> DCRUN,
   DEPTHCURVE_VALUE -> DCVAL.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_HNF_DEPTHCURVE_RUN  (short code: DCRUN)
   One row per execution: one already-computed CDI source (a GDX_HNF_CDI_RUN
   or a GDX_HNF_CDIH_RUN, never both -- same exactly-one-FK shape as GDX_HNF_
   VISDEPTH_RUN above) and one explicit width `sigma`, never defaulted by this
   schema or by the generating skill, same governance posture this file's own
   VISUAL_GAIN already takes.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_DEPTHCURVE_RUN (
  ID_DEPTHCURVE_RUN BIGINT NOT NULL,
  ID_STUDY BIGINT NOT NULL,
  SOURCE_KIND VARCHAR(10) NOT NULL,
  ID_CDI_RUN BIGINT,
  ID_CDIH_RUN BIGINT,
  CURVE_SIGMA NUMERIC(18,6) NOT NULL,
  RUN_LABEL VARCHAR(160) NOT NULL,
  PERSON_COUNT INTEGER NOT NULL,
  SCALAR_CURVATURE_COMPUTED SMALLINT DEFAULT 0 NOT NULL,
  SCALAR_CURVATURE_SCOPE_NOTE BLOB SUB_TYPE TEXT NOT NULL,
  GENERATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  GENERATED_BY VARCHAR(120),
  NOTES BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_HNF_DCRUN PRIMARY KEY (ID_DEPTHCURVE_RUN),
  CONSTRAINT FK_GDX_HNF_DCRUN_STUDY FOREIGN KEY (ID_STUDY) REFERENCES GDX_PSY_STUDY(ID_STUDY),
  CONSTRAINT FK_GDX_HNF_DCRUN_CDI FOREIGN KEY (ID_CDI_RUN) REFERENCES GDX_HNF_CDI_RUN(ID_CDI_RUN),
  CONSTRAINT FK_GDX_HNF_DCRUN_CDIH FOREIGN KEY (ID_CDIH_RUN) REFERENCES GDX_HNF_CDIH_RUN(ID_CDIH_RUN),
  CONSTRAINT CK_GDX_HNF_DCRUN_KIND CHECK (SOURCE_KIND IN ('CDIX','CDIH')),
  -- Exactly one of the two source FKs is set, matching SOURCE_KIND -- same single-row CHECK
  -- GDX_HNF_VISDEPTH_RUN already uses above; that the referenced run also belongs to ID_STUDY is
  -- a cross-table rule the generating skill enforces (same documented limitation).
  CONSTRAINT CK_GDX_HNF_DCRUN_SRC CHECK (
    (SOURCE_KIND = 'CDIX' AND ID_CDI_RUN IS NOT NULL AND ID_CDIH_RUN IS NULL) OR
    (SOURCE_KIND = 'CDIH' AND ID_CDIH_RUN IS NOT NULL AND ID_CDI_RUN IS NULL)
  ),
  CONSTRAINT CK_GDX_HNF_DCRUN_SIGMA CHECK (CURVE_SIGMA > 0),
  CONSTRAINT CK_GDX_HNF_DCRUN_PERSC CHECK (PERSON_COUNT > 0),
  -- The permanent refusal: this addendum never claims to have computed a true scalar curvature.
  CONSTRAINT CK_GDX_HNF_DCRUN_NOCURV CHECK (SCALAR_CURVATURE_COMPUTED = 0)
);

CREATE INDEX IX_GDX_HNF_DCRUN_STUDY ON GDX_HNF_DEPTHCURVE_RUN(ID_STUDY);
CREATE INDEX IX_GDX_HNF_DCRUN_CDI ON GDX_HNF_DEPTHCURVE_RUN(ID_CDI_RUN);
CREATE INDEX IX_GDX_HNF_DCRUN_CDIH ON GDX_HNF_DEPTHCURVE_RUN(ID_CDIH_RUN);

CREATE SEQUENCE SEQ_GDX_HNF_DCRUN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_DCRUN FOR GDX_HNF_DEPTHCURVE_RUN ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_DEPTHCURVE_RUN IS NULL) THEN
    NEW.ID_DEPTHCURVE_RUN = NEXT VALUE FOR SEQ_GDX_HNF_DCRUN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_HNF_DEPTHCURVE_VALUE  (short code: DCVAL)
   One row per (run, person): the real source CDI value this run copied
   (SOURCE_CDI_VALUE) and the curve's own deepest point, CURVE_MIN_VALUE =
   -SOURCE_CDI_VALUE (the value y(s) takes at s=0, the only point on the curve
   a real number actually determines -- see file header). CURVE_MIN_VALUE is
   always <= 0 by construction (SOURCE_CDI_VALUE is always >= 0).
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_HNF_DEPTHCURVE_VALUE (
  ID_DEPTHCURVE_VALUE BIGINT NOT NULL,
  ID_DEPTHCURVE_RUN BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  SOURCE_CDI_VALUE NUMERIC(18,8) NOT NULL,
  CURVE_MIN_VALUE NUMERIC(18,8) NOT NULL,
  CONSTRAINT PK_GDX_HNF_DCVAL PRIMARY KEY (ID_DEPTHCURVE_VALUE),
  CONSTRAINT FK_GDX_HNF_DCVAL_RUN FOREIGN KEY (ID_DEPTHCURVE_RUN) REFERENCES GDX_HNF_DEPTHCURVE_RUN(ID_DEPTHCURVE_RUN),
  CONSTRAINT FK_GDX_HNF_DCVAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_HNF_DCVAL UNIQUE (ID_DEPTHCURVE_RUN, ID_PERSON),
  CONSTRAINT CK_GDX_HNF_DCVAL_SRC_NONNEG CHECK (SOURCE_CDI_VALUE >= 0),
  CONSTRAINT CK_GDX_HNF_DCVAL_MIN_NONPOS CHECK (CURVE_MIN_VALUE <= 0)
);

CREATE INDEX IX_GDX_HNF_DCVAL_RUN ON GDX_HNF_DEPTHCURVE_VALUE(ID_DEPTHCURVE_RUN);
CREATE INDEX IX_GDX_HNF_DCVAL_PERSON ON GDX_HNF_DEPTHCURVE_VALUE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_HNF_DCVAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_HNF_DCVAL FOR GDX_HNF_DEPTHCURVE_VALUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_DEPTHCURVE_VALUE IS NULL) THEN
    NEW.ID_DEPTHCURVE_VALUE = NEXT VALUE FOR SEQ_GDX_HNF_DCVAL;
END^

SET TERM ; ^

COMMIT;
