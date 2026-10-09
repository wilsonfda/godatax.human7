/* ============================================================================
   Translate to English every GDX_PSY_* catalog field loaded for study #2
   "Orientação à Finalidade (OT-7)" -- study, phenomenon, both constructs,
   instrument, all 10 variables, all 10 indicators, all 7 instrument items,
   and all 42 item alternatives. Matched by primary key id (captured from a
   live read of the database right before writing this script), not by the
   old Portuguese NAME, since several UPDATEs would otherwise invalidate a
   later WHERE NAME = '<old text>' in the same script.
   ============================================================================ */

-- GDX_PSY_STUDY
UPDATE GDX_PSY_STUDY SET
  TITLE = 'Purpose Orientation (OT-7) - Exploratory Pilot Study',
  OBJECTIVE = 'Explore the OT-7 prototype as a case study of how a metaphysical concept (purpose orientation, anchored in Aquinas''s Fifth Way) can be decomposed into seven observable dimensions via the Trivium/Quadrivium, formulated into items, and investigated for psychometric properties, with no prior validation.',
  METHOD = 'Cross-sectional self-report, seven items (one per Trivium/Quadrivium dimension), 0-5 scale, response referring to the last 14 days and to a personal goal chosen by the respondent. Exploratory instrument, still with no norms, cutoffs, or reliability/validity evidence.'
WHERE ID_STUDY = 2;

-- GDX_PSY_PHENOMENON
UPDATE GDX_PSY_PHENOMENON SET
  NAME = 'Purpose Orientation (OT-7, hypothesis)',
  DESCRIPTION = 'Exploratory interpretive metaphysical phenomenon: how a person formulates a goal/purpose, relates actions and means to it, and revises it over time. Read from Aquinas''s Fifth Way (governance, order, and finality); does not constitute proof of an energy or metaphysical substance measured by science -- it is an interpretive lens proposed by the GoDataX Human 7 framework.'
WHERE ID_PHENOMENON = 12;

-- GDX_PSY_CONSTRUCT
UPDATE GDX_PSY_CONSTRUCT SET
  NAME = 'Purpose Orientation (OT-7, hypothesis)',
  DEFINITION = 'How a person sets a goal, relates actions and means to it, and revises it over time -- the most direct approximation, in the framework, of the idea of orientation toward an end. Perceived vitality is recorded as a separate psychological observable, not a metaphysical one.'
WHERE ID_CONSTRUCT = 12;

UPDATE GDX_PSY_CONSTRUCT SET
  NAME = 'Behavioral Patterns Associated with OT-7 (hypothesis)',
  DEFINITION = 'Three behavioral patterns that the OT-7 working document (Step 3) proposes as hypotheses of correlation with the seven OT-7 dimensions -- goal-directed action, self-regulation, and adaptive persistence. They are not part of the OT-7 instrument itself (no item/scale of their own has been defined for them yet); they are the behavioral layer ("Layer C") the document suggests observing alongside vitality (Layer A) and the OT-7 profile (Layer B), for future investigation of association -- never of causality.'
WHERE ID_CONSTRUCT = 13;

-- GDX_PSY_INSTRUMENT
UPDATE GDX_PSY_INSTRUMENT SET
  NAME = 'Purpose Orientation (OT-7)',
  DESCRIPTION = 'Experimental, NOT validated metaphysicometric prototype, proposed in Andrade, W. (2026), ''Purpose Orientation | OT-7 Working Model'' (GoDataX Human 7 working document, 2026-09-26), anchored in Aquinas''s Fifth Way (governance, order, and finality) and decomposed into seven lenses from the Trivium (grammar, logic, rhetoric) and Quadrivium (arithmetic, geometry, music, astronomy).',
  INSTRUCTIONS = 'Think of an important personal goal you tried to achieve in the last 14 days. Indicate how much each statement describes your experience during that period.'
WHERE ID_INSTRUMENT = 12;

-- GDX_PSY_VARIABLE (23-29: the 7 OT-7 dimensions)
UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Clarity of Purpose (Grammar)',
  DESCRIPTION = 'How the person names and clearly describes the goal they intend to achieve.',
  OPERATIONAL_DEFINITION = 'Response to OT-7 item 1 (Trivium - Grammar): ''I can clearly describe the goal I am trying to achieve.'''
WHERE ID_VARIABLE = 23;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Coherence Between Means and Ends (Logic)',
  DESCRIPTION = 'Whether the actions chosen by the person are coherent with the stated goal.',
  OPERATIONAL_DEFINITION = 'Response to OT-7 item 2 (Trivium - Logic): ''My recent actions are coherent with this goal.'''
WHERE ID_VARIABLE = 24;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Expression of Purpose (Rhetoric)',
  DESCRIPTION = 'How the person communicates and justifies the purpose they pursue.',
  OPERATIONAL_DEFINITION = 'Response to OT-7 item 3 (Trivium - Rhetoric): ''I can explain why this goal matters to me.'''
WHERE ID_VARIABLE = 25;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Proportion Between Resources and Goal (Arithmetic)',
  DESCRIPTION = 'How the person distributes time, effort, and vitality in relation to the goal.',
  OPERATIONAL_DEFINITION = 'Response to OT-7 item 4 (Quadrivium - Arithmetic): ''I distributed time and effort in a way compatible with this goal.'''
WHERE ID_VARIABLE = 26;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Structure Among Goals, Values, and Actions (Geometry)',
  DESCRIPTION = 'How goals, values, and actions relate/align with each other.',
  OPERATIONAL_DEFINITION = 'Response to OT-7 item 5 (Quadrivium - Geometry): ''I can align this goal with my values and my other responsibilities.'''
WHERE ID_VARIABLE = 27;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Rhythm and Continuity (Music)',
  DESCRIPTION = 'The rhythm of the person''s actions and its variation with perceived vitality.',
  OPERATIONAL_DEFINITION = 'Response to OT-7 item 6 (Quadrivium - Music): ''I maintain a sustainable pace and adjust my effort when my vitality changes.'''
WHERE ID_VARIABLE = 28;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Cycles and Broader Context (Astronomy)',
  DESCRIPTION = 'How the person''s orientation changes across cycles and contexts.',
  OPERATIONAL_DEFINITION = 'Response to OT-7 item 7 (Quadrivium - Astronomy): ''I reassess this goal when the context, priorities, or conditions change.'''
WHERE ID_VARIABLE = 29;

-- GDX_PSY_VARIABLE (30-32: the 3 behavioral correlates)
UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Goal-Directed Action (OT-7, hypothesis)',
  DESCRIPTION = 'Setting a goal and initiating coherent actions to move forward.',
  OPERATIONAL_DEFINITION = 'Proposed indicators (no scale defined): stated goal, plan, actions initiated, and recorded progress. Base OT-7 dimensions: Grammar, Logic, Arithmetic, Geometry.'
WHERE ID_VARIABLE = 30;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Self-Regulation (OT-7, hypothesis)',
  DESCRIPTION = 'Monitoring actions, comparing the course with the goal, and adjusting means or pace.',
  OPERATIONAL_DEFINITION = 'Proposed indicators (no scale defined): tracking, reviews, pace, and adjustments in the face of change. Base OT-7 dimensions: Logic, Arithmetic, Geometry, Music, Astronomy.'
WHERE ID_VARIABLE = 31;

UPDATE GDX_PSY_VARIABLE SET
  NAME = 'Adaptive Persistence (OT-7, hypothesis)',
  DESCRIPTION = 'Maintaining sustainable effort, returning to the pursuit after interruptions, or adjusting strategy when necessary.',
  OPERATIONAL_DEFINITION = 'Proposed indicators (no scale defined): continuity, re-engagement, strategy change, and context adaptation. Base OT-7 dimensions: Logic, Rhetoric, Arithmetic, Music, Astronomy.'
WHERE ID_VARIABLE = 32;

-- GDX_PSY_INDICATOR (1-7: the 7 OT-7 dimension scores)
UPDATE GDX_PSY_INDICATOR SET NAME = 'Clarity of Purpose (score)', DESCRIPTION = 'Raw response (0-5) to the OT-7 Grammar item.' WHERE ID_INDICATOR = 1;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Coherence Between Means and Ends (score)', DESCRIPTION = 'Raw response (0-5) to the OT-7 Logic item.' WHERE ID_INDICATOR = 2;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Expression of Purpose (score)', DESCRIPTION = 'Raw response (0-5) to the OT-7 Rhetoric item.' WHERE ID_INDICATOR = 3;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Proportion Between Resources and Goal (score)', DESCRIPTION = 'Raw response (0-5) to the OT-7 Arithmetic item.' WHERE ID_INDICATOR = 4;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Structure Among Goals, Values, and Actions (score)', DESCRIPTION = 'Raw response (0-5) to the OT-7 Geometry item.' WHERE ID_INDICATOR = 5;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Rhythm and Continuity (score)', DESCRIPTION = 'Raw response (0-5) to the OT-7 Music item.' WHERE ID_INDICATOR = 6;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Cycles and Broader Context (score)', DESCRIPTION = 'Raw response (0-5) to the OT-7 Astronomy item.' WHERE ID_INDICATOR = 7;

-- GDX_PSY_INDICATOR (8-10: the 3 behavioral correlates, still pending measurement)
UPDATE GDX_PSY_INDICATOR SET NAME = 'Goal-Directed Action (pending indicator)', DESCRIPTION = 'No item/scale defined yet by the source document -- only indicators described in free text.' WHERE ID_INDICATOR = 8;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Self-Regulation (pending indicator)', DESCRIPTION = 'No item/scale defined yet by the source document -- only indicators described in free text.' WHERE ID_INDICATOR = 9;
UPDATE GDX_PSY_INDICATOR SET NAME = 'Adaptive Persistence (pending indicator)', DESCRIPTION = 'No item/scale defined yet by the source document -- only indicators described in free text.' WHERE ID_INDICATOR = 10;

-- GDX_PSY_INSTRUMENT_ITEM (139-145: the 7 OT-7 items, matched by ITEM_ORDER)
UPDATE GDX_PSY_INSTRUMENT_ITEM SET STATEMENT_TEXT = 'I can clearly describe the goal I am trying to achieve.' WHERE ID_ITEM = 139;
UPDATE GDX_PSY_INSTRUMENT_ITEM SET STATEMENT_TEXT = 'My recent actions are coherent with this goal.' WHERE ID_ITEM = 140;
UPDATE GDX_PSY_INSTRUMENT_ITEM SET STATEMENT_TEXT = 'I can explain why this goal matters to me.' WHERE ID_ITEM = 141;
UPDATE GDX_PSY_INSTRUMENT_ITEM SET STATEMENT_TEXT = 'I distributed time and effort in a way compatible with this goal.' WHERE ID_ITEM = 142;
UPDATE GDX_PSY_INSTRUMENT_ITEM SET STATEMENT_TEXT = 'I can align this goal with my values and my other responsibilities.' WHERE ID_ITEM = 143;
UPDATE GDX_PSY_INSTRUMENT_ITEM SET STATEMENT_TEXT = 'I maintain a sustainable pace and adjust my effort when my vitality changes.' WHERE ID_ITEM = 144;
UPDATE GDX_PSY_INSTRUMENT_ITEM SET STATEMENT_TEXT = 'I reassess this goal when the context, priorities, or conditions change.' WHERE ID_ITEM = 145;

-- GDX_PSY_ITEM_ALTERNATIVE (6 per item x 7 items = 42 rows, same 6 labels every time)
UPDATE GDX_PSY_ITEM_ALTERNATIVE SET LABEL = 'Does not describe me' WHERE ID_ITEM IN (139,140,141,142,143,144,145) AND ALTERNATIVE_ORDER = 1;
UPDATE GDX_PSY_ITEM_ALTERNATIVE SET LABEL = 'Very little' WHERE ID_ITEM IN (139,140,141,142,143,144,145) AND ALTERNATIVE_ORDER = 2;
UPDATE GDX_PSY_ITEM_ALTERNATIVE SET LABEL = 'A little' WHERE ID_ITEM IN (139,140,141,142,143,144,145) AND ALTERNATIVE_ORDER = 3;
UPDATE GDX_PSY_ITEM_ALTERNATIVE SET LABEL = 'Partially' WHERE ID_ITEM IN (139,140,141,142,143,144,145) AND ALTERNATIVE_ORDER = 4;
UPDATE GDX_PSY_ITEM_ALTERNATIVE SET LABEL = 'Quite a lot' WHERE ID_ITEM IN (139,140,141,142,143,144,145) AND ALTERNATIVE_ORDER = 5;
UPDATE GDX_PSY_ITEM_ALTERNATIVE SET LABEL = 'Completely' WHERE ID_ITEM IN (139,140,141,142,143,144,145) AND ALTERNATIVE_ORDER = 6;

-- GDX_PSY_SEPT_LEVEL_PSY_MAP / GDX_TA_WAY_SEPT_MAP: INSTRUMENT_LABEL now follows the
-- catalog's new English NAME too (VARIABLE_LABEL/RECORDED_BEHAVIOR/CORRESPONDENCE_JUSTIFICATION
-- were already translated in a previous pass).
UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET INSTRUMENT_LABEL = 'Purpose Orientation (OT-7)' WHERE ID_VARIABLE BETWEEN 23 AND 29;
UPDATE GDX_TA_WAY_SEPT_MAP SET INSTRUMENT_LABEL = 'Purpose Orientation (OT-7)' WHERE ID_VARIABLE BETWEEN 23 AND 29;

COMMIT;
