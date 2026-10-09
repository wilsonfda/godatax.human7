/* ============================================================================
   Data load - Behavioral correlates hypothesized by the OT-7 working doc
   (Orientacao_a_Finalidade_Trivium_Quadrivium_OT7.pdf, Step 3) for study #2
   "Purpose Orientation (OT-7) - Exploratory Pilot Study".

   These 3 patterns (goal-directed action, self-regulation, adaptive
   persistence) are NOT OT-7 items -- the source PDF gives no concrete
   question/scale for them, only loose prose "indicators". So, unlike the 7
   OT-7 dimension variables (02_new_instrument_01_*.sql), these are loaded
   WITHOUT any GDX_PSY_INSTRUMENT/GDX_PSY_INSTRUMENT_ITEM: catalog-only
   placeholders (construct + variable + indicator), pending a real
   measurement design. INDICATOR_TYPE = 'PENDING_MEASUREMENT' flags that.

   Linked to the SAME GDX_PSY_PHENOMENON as the OT-7 instrument itself
   (ID_PHENOMENON = 12, "Purpose Orientation (OT-7, hypothesis)") via
   GDX_PSY_PHENOMENON_CONSTRUCT with RELATION_TYPE = 'HYPOTHESIZED_CORRELATE'
   (not 'OPERATIONALIZES', since these don't define the phenomenon -- they
   are a separate behavioral layer the source doc proposes testing against
   OT-7 scores, "Layer C" in the PDF's Step 3 table).

   Safe to re-run: construct/variables are looked up by NAME first.
   ============================================================================ */

SET TERM ^ ;

EXECUTE BLOCK AS
DECLARE VARIABLE V_ID_CONSTRUCT BIGINT;
DECLARE VARIABLE V_ID_VARIABLE_1 BIGINT;
DECLARE VARIABLE V_ID_VARIABLE_2 BIGINT;
DECLARE VARIABLE V_ID_VARIABLE_3 BIGINT;
BEGIN
  SELECT ID_CONSTRUCT FROM GDX_PSY_CONSTRUCT WHERE NAME = 'Behavioral Patterns Associated with OT-7 (hypothesis)' INTO :V_ID_CONSTRUCT;
  IF (:V_ID_CONSTRUCT IS NULL) THEN
  BEGIN
    INSERT INTO GDX_PSY_CONSTRUCT (NAME, DOMAIN, DEFINITION)
      VALUES ('Behavioral Patterns Associated with OT-7 (hypothesis)', 'PSYCHOLOGICAL',
        'Three behavioral patterns that the OT-7 working document (Step 3) proposes as hypotheses of correlation with the seven OT-7 dimensions -- goal-directed action, self-regulation, and adaptive persistence. They are not part of the OT-7 instrument itself (no item/scale of their own has been defined for them yet); they are the behavioral layer ("Layer C") the document suggests observing alongside vitality (Layer A) and the OT-7 profile (Layer B), for future investigation of association -- never of causality.')
      RETURNING ID_CONSTRUCT INTO :V_ID_CONSTRUCT;
  END

  INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE)
    SELECT 12, :V_ID_CONSTRUCT, 'HYPOTHESIZED_CORRELATE'
    FROM RDB$DATABASE
    WHERE NOT EXISTS (SELECT 1 FROM GDX_PSY_PHENOMENON_CONSTRUCT WHERE ID_PHENOMENON = 12 AND ID_CONSTRUCT = :V_ID_CONSTRUCT);

  SELECT ID_VARIABLE FROM GDX_PSY_VARIABLE WHERE ID_CONSTRUCT = :V_ID_CONSTRUCT AND NAME = 'Goal-Directed Action (OT-7, hypothesis)' INTO :V_ID_VARIABLE_1;
  IF (:V_ID_VARIABLE_1 IS NULL) THEN
  BEGIN
    INSERT INTO GDX_PSY_VARIABLE (ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL)
      VALUES (:V_ID_CONSTRUCT, 'Goal-Directed Action (OT-7, hypothesis)',
        'Setting a goal and initiating coherent actions to move forward.',
        'Proposed indicators (no scale defined): stated goal, plan, actions initiated, and recorded progress. Base OT-7 dimensions: Grammar, Logic, Arithmetic, Geometry.',
        'PSYCHOLOGICAL', NULL)
      RETURNING ID_VARIABLE INTO :V_ID_VARIABLE_1;
    INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, DIRECTION)
      VALUES (:V_ID_VARIABLE_1, 'Goal-Directed Action (pending indicator)',
        'No item/scale defined yet by the source document -- only indicators described in free text.',
        'PENDING_MEASUREMENT', 'POSITIVE');
  END

  SELECT ID_VARIABLE FROM GDX_PSY_VARIABLE WHERE ID_CONSTRUCT = :V_ID_CONSTRUCT AND NAME = 'Self-Regulation (OT-7, hypothesis)' INTO :V_ID_VARIABLE_2;
  IF (:V_ID_VARIABLE_2 IS NULL) THEN
  BEGIN
    INSERT INTO GDX_PSY_VARIABLE (ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL)
      VALUES (:V_ID_CONSTRUCT, 'Self-Regulation (OT-7, hypothesis)',
        'Monitoring actions, comparing the course with the goal, and adjusting means or pace.',
        'Proposed indicators (no scale defined): tracking, reviews, pace, and adjustments in the face of change. Base OT-7 dimensions: Logic, Arithmetic, Geometry, Music, Astronomy.',
        'PSYCHOLOGICAL', NULL)
      RETURNING ID_VARIABLE INTO :V_ID_VARIABLE_2;
    INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, DIRECTION)
      VALUES (:V_ID_VARIABLE_2, 'Self-Regulation (pending indicator)',
        'No item/scale defined yet by the source document -- only indicators described in free text.',
        'PENDING_MEASUREMENT', 'POSITIVE');
  END

  SELECT ID_VARIABLE FROM GDX_PSY_VARIABLE WHERE ID_CONSTRUCT = :V_ID_CONSTRUCT AND NAME = 'Adaptive Persistence (OT-7, hypothesis)' INTO :V_ID_VARIABLE_3;
  IF (:V_ID_VARIABLE_3 IS NULL) THEN
  BEGIN
    INSERT INTO GDX_PSY_VARIABLE (ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL)
      VALUES (:V_ID_CONSTRUCT, 'Adaptive Persistence (OT-7, hypothesis)',
        'Maintaining sustainable effort, returning to the pursuit after interruptions, or adjusting strategy when necessary.',
        'Proposed indicators (no scale defined): continuity, re-engagement, strategy change, and context adaptation. Base OT-7 dimensions: Logic, Rhetoric, Arithmetic, Music, Astronomy.',
        'PSYCHOLOGICAL', NULL)
      RETURNING ID_VARIABLE INTO :V_ID_VARIABLE_3;
    INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, DIRECTION)
      VALUES (:V_ID_VARIABLE_3, 'Adaptive Persistence (pending indicator)',
        'No item/scale defined yet by the source document -- only indicators described in free text.',
        'PENDING_MEASUREMENT', 'POSITIVE');
  END
END^

SET TERM ; ^
