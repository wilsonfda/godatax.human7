/* ============================================================================
   Scale polarity for GDX_VT_VARIABLE_VIRTUE_MAP (Firebird 2.5)

   Extends: GDX_VT_VARIABLE_VIRTUE_MAP (12.gdx.virtology/virtology_model_firebird25.sql)

   Purpose: GDX_SKILL_LINK_SUGGESTIONS reads a study's lowest-scoring
   indicators as deficits, and GDX_SKILL_IDENTIFY_VIRTUES reads the
   highest-scoring ones as strengths already present -- both skills used to
   assume every variable shares the same polarity: high score = good, low
   score = a deficit. That assumption breaks for a negative-pole variable
   (e.g. "Negative Emotions" / EmocNeg): there, a HIGH score IS the deficit
   and a LOW score IS the already-present strength -- the opposite reading.
   Both reports already carried a prose caveat about this; this column lets
   the ranking itself respect it instead of leaving it to the reader.

   SCALE_POLARITY:
     POSITIVE (default) -- a high RAW_SCORE on this variable is desirable
       (the common case: Vigor, Confidence, Satisfaction With Life, etc.).
       GDX_SKILL_LINK_SUGGESTIONS reads a LOW score as the deficit;
       GDX_SKILL_IDENTIFY_VIRTUES reads a HIGH score as the strength.
     NEGATIVE -- a high RAW_SCORE on this variable is undesirable (e.g.
       Negative Emotions). GDX_SKILL_LINK_SUGGESTIONS reads a HIGH score as
       the deficit; GDX_SKILL_IDENTIFY_VIRTUES reads a LOW score as the
       strength -- inverted from the POSITIVE case.

   NOT NULL with a POSITIVE default so every pre-existing row keeps its
   current (correct, for 20 of the 21 rows already in this table) reading
   without a backfill. GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR now
   requires --scale-polarity explicitly on every new insert -- never left to
   the default silently, the same never-invent-the-judgment-call rule this
   table already applies to RECORDED_BEHAVIOR and both justification columns.
   ============================================================================ */

ALTER TABLE GDX_VT_VARIABLE_VIRTUE_MAP
  ADD SCALE_POLARITY VARCHAR(10) DEFAULT 'POSITIVE' NOT NULL;

COMMIT;

ALTER TABLE GDX_VT_VARIABLE_VIRTUE_MAP
  ADD CONSTRAINT CK_GDX_VT_VVM_POLARITY CHECK (SCALE_POLARITY IN ('POSITIVE', 'NEGATIVE'));

COMMIT;

/* The one known negative-pole row already in the table: EmocNeg (Negative
   Emotions) -- flagged in its own already-recorded JUSTIFICATION_STRENGTH
   text ("...this variable is on the negative pole: a high score here is not
   a strength, it is the mechanical reading of the ranking"). Every other
   existing row keeps the POSITIVE default. */
UPDATE GDX_VT_VARIABLE_VIRTUE_MAP SET SCALE_POLARITY = 'NEGATIVE' WHERE SAV_COLUMN = 'EmocNeg';

COMMIT;
