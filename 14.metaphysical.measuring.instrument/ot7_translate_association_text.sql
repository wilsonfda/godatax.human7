/* ============================================================================
   Translate to English the free-text LABEL/BEHAVIOR/JUSTIFICATION columns
   already loaded for the 7 OT-7 variables in GDX_PSY_SEPT_LEVEL_PSY_MAP and
   GDX_TA_WAY_SEPT_MAP. GDX_PSY_VARIABLE.NAME / GDX_PSY_INSTRUMENT.NAME
   themselves are left untouched (still Portuguese, out of scope -- these are
   catalog identity, not a Markdown document); only the association tables'
   own free-text snapshot columns change, which both tables' original design
   already allows to diverge from the live catalog (see their *_LABEL column
   comments in septenary_constitution_model_firebird25.sql /
   metaphysical_variable_way_map_firebird25.sql).
   ============================================================================ */

-- GDX_PSY_SEPT_LEVEL_PSY_MAP (7 rows, ID_VARIABLE 23..29)
UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Clarity of Purpose (Grammar)',
  RECORDED_BEHAVIOR = 'Naming and clearly describing the personal goal the person says they are trying to achieve (OT-7 Grammar item).',
  CORRESPONDENCE_JUSTIFICATION = 'The whole OT-7 construct is anchored in Aquinas''s Fifth Way (governance, order and finality), already associated with Level 6 (Buddhic Body) in five_ways_septenary_map_firebird25.sql. Clear verbal articulation of a purpose is read here as an expression of that same intuition of meaning/finality, not as an independent correspondence path.'
WHERE ID_VARIABLE = 23;

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Coherence Between Means and Ends (Logic)',
  RECORDED_BEHAVIOR = 'Assessing whether the person''s recent actions are coherent with the stated goal (OT-7 Logic item).',
  CORRESPONDENCE_JUSTIFICATION = 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. Coherence between means and ends is read as the logical facet of that same teleological orientation, not a separate correspondence.'
WHERE ID_VARIABLE = 24;

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Expression of Purpose (Rhetoric)',
  RECORDED_BEHAVIOR = 'How the person communicates and justifies why the goal matters to them (OT-7 Rhetoric item).',
  CORRESPONDENCE_JUSTIFICATION = 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The ability to articulate the personal meaning of the purpose is read as the rhetorical facet of that same teleological orientation.'
WHERE ID_VARIABLE = 25;

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Proportion Between Resources and Goal (Arithmetic)',
  RECORDED_BEHAVIOR = 'How the person distributes time and effort in a way compatible with the goal (OT-7 Arithmetic item).',
  CORRESPONDENCE_JUSTIFICATION = 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The proportion between invested resources and the goal is read as the quantitative facet of that same teleological orientation.'
WHERE ID_VARIABLE = 26;

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Structure Among Goals, Values, and Actions (Geometry)',
  RECORDED_BEHAVIOR = 'Alignment between the goal, the person''s personal values, and their other responsibilities (OT-7 Geometry item).',
  CORRESPONDENCE_JUSTIFICATION = 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The structure/alignment among goals, values and actions is read as the relational facet of that same teleological orientation.'
WHERE ID_VARIABLE = 27;

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Rhythm and Continuity (Music)',
  RECORDED_BEHAVIOR = 'Maintaining a sustainable pace of action, adjusting effort when perceived vitality changes (OT-7 Music item).',
  CORRESPONDENCE_JUSTIFICATION = 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The rhythm and continuity of actions are read as the temporal/cadenced facet of that same teleological orientation.'
WHERE ID_VARIABLE = 28;

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Cycles and Broader Context (Astronomy)',
  RECORDED_BEHAVIOR = 'Reassessing the goal when context, priorities, or conditions change (OT-7 Astronomy item).',
  CORRESPONDENCE_JUSTIFICATION = 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. Reassessing the goal across cycles and contexts is read as the cyclical/contextual facet of that same teleological orientation.'
WHERE ID_VARIABLE = 29;

-- GDX_TA_WAY_SEPT_MAP (7 rows, same ID_VARIABLE 23..29)
UPDATE GDX_TA_WAY_SEPT_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Clarity of Purpose (Grammar)',
  RECORDED_BEHAVIOR = 'Naming and clearly describing the personal goal the person says they are trying to achieve.',
  CORRESPONDENCE_JUSTIFICATION = 'The whole OT-7 construct is an interpretive extension of the Fifth Way; the Grammar lens observes the clear verbal formulation of that same purpose, not an independent argumentative way.'
WHERE ID_VARIABLE = 23;

UPDATE GDX_TA_WAY_SEPT_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Coherence Between Means and Ends (Logic)',
  RECORDED_BEHAVIOR = 'Assessing whether the person''s recent actions are coherent with the stated goal.',
  CORRESPONDENCE_JUSTIFICATION = 'Interpretive extension of the Fifth Way: the Logic lens observes coherence between means and ends within that same teleological orientation, not an independent argumentative way.'
WHERE ID_VARIABLE = 24;

UPDATE GDX_TA_WAY_SEPT_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Expression of Purpose (Rhetoric)',
  RECORDED_BEHAVIOR = 'How the person communicates and justifies why the goal matters to them.',
  CORRESPONDENCE_JUSTIFICATION = 'Interpretive extension of the Fifth Way: the Rhetoric lens observes the articulation of the personal meaning of the purpose within that same teleological orientation, not an independent argumentative way.'
WHERE ID_VARIABLE = 25;

UPDATE GDX_TA_WAY_SEPT_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Proportion Between Resources and Goal (Arithmetic)',
  RECORDED_BEHAVIOR = 'How the person distributes time and effort in a way compatible with the goal.',
  CORRESPONDENCE_JUSTIFICATION = 'Interpretive extension of the Fifth Way: the Arithmetic lens observes the proportion between invested resources and the goal within that same teleological orientation, not an independent argumentative way.'
WHERE ID_VARIABLE = 26;

UPDATE GDX_TA_WAY_SEPT_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Structure Among Goals, Values, and Actions (Geometry)',
  RECORDED_BEHAVIOR = 'Alignment between the goal, the person''s personal values, and their other responsibilities.',
  CORRESPONDENCE_JUSTIFICATION = 'Interpretive extension of the Fifth Way: the Geometry lens observes the structure/alignment among goals, values and actions within that same teleological orientation, not an independent argumentative way.'
WHERE ID_VARIABLE = 27;

UPDATE GDX_TA_WAY_SEPT_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Rhythm and Continuity (Music)',
  RECORDED_BEHAVIOR = 'Maintaining a sustainable pace of action, adjusting effort when perceived vitality changes.',
  CORRESPONDENCE_JUSTIFICATION = 'Interpretive extension of the Fifth Way: the Music lens observes the rhythm and continuity of actions within that same teleological orientation, not an independent argumentative way.'
WHERE ID_VARIABLE = 28;

UPDATE GDX_TA_WAY_SEPT_MAP SET
  INSTRUMENT_LABEL = 'Orientação à Finalidade (OT-7)',
  VARIABLE_LABEL = 'Cycles and Broader Context (Astronomy)',
  RECORDED_BEHAVIOR = 'Reassessing the goal when context, priorities, or conditions change.',
  CORRESPONDENCE_JUSTIFICATION = 'Interpretive extension of the Fifth Way: the Astronomy lens observes reassessing the goal across cycles and contexts within that same teleological orientation, not an independent argumentative way.'
WHERE ID_VARIABLE = 29;

COMMIT;
