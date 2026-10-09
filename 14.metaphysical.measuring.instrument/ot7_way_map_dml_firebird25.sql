/* ============================================================================
   DML - OT-7 variables x Five Ways (GDX_TA_WAY_SEPT_MAP)
   Extension data for metaphysical_variable_way_map_firebird25.sql (same folder).

   All seven OT-7 variables are linked to the SAME Way (5, Argument from the
   Governance of the World / Teleological) and the SAME Septenary Level (6,
   Buddhic Body) -- the only correspondence the source documents actually make
   (Orientacao_a_Finalidade_Trivium_Quadrivium_OT7.pdf and the GDX H7ph
   book/article anchor the WHOLE OT-7 construct in the Fifth Way; neither
   claims a distinct Way or level per Trivium/Quadrivium lens). Way 5 -> Level
   6 is the same pairing already in five_ways_septenary_map_firebird25.sql
   (CONFIDENCE_LEVEL 'SPECULATIVE' there too).

   IDs below are this database's actual ids after GDX_SKILL_RECORD_NEW_STUDY
   loaded new_study_intake/ot7-orientacao-finalidade/intake.json:
     ID_INSTRUMENT = 12 (Purpose Orientation (OT-7))
     ID_VARIABLE   = 23..29 (the 7 OT-7 variables, in item order)
     ID_WAY        = 5 (Argument from the Governance of the World / Teleological)
     ID_SEPTENARY_LEVEL = 6 (Buddhic Body)
   If re-running on a different database, resolve these by NAME first instead
   of reusing the literals.

   Catalog translated to English on 2026-10-09 (see
   0.new.instrument/new_study_intake/ot7-orientacao-finalidade/04_translate_catalog_to_english.sql)
   -- this file was rewritten to match so a fresh load from scratch never
   reintroduces the original Portuguese text.
   ============================================================================ */

INSERT INTO GDX_TA_WAY_SEPT_MAP
  (ID_WAY, ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL, RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6, 12, 'Purpose Orientation (OT-7)', 23, 'Clarity of Purpose (Grammar)',
   'Naming and clearly describing the personal goal the person says they are trying to achieve.',
   'The whole OT-7 construct is an interpretive extension of the Fifth Way; the Grammar lens observes the clear verbal formulation of that same purpose, not an independent argumentative way.',
   'SPECULATIVE');

INSERT INTO GDX_TA_WAY_SEPT_MAP
  (ID_WAY, ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL, RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6, 12, 'Purpose Orientation (OT-7)', 24, 'Coherence Between Means and Ends (Logic)',
   'Assessing whether the person''s recent actions are coherent with the stated goal.',
   'Interpretive extension of the Fifth Way: the Logic lens observes coherence between means and ends within that same teleological orientation, not an independent argumentative way.',
   'SPECULATIVE');

INSERT INTO GDX_TA_WAY_SEPT_MAP
  (ID_WAY, ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL, RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6, 12, 'Purpose Orientation (OT-7)', 25, 'Expression of Purpose (Rhetoric)',
   'How the person communicates and justifies why the goal matters to them.',
   'Interpretive extension of the Fifth Way: the Rhetoric lens observes the articulation of the personal meaning of the purpose within that same teleological orientation, not an independent argumentative way.',
   'SPECULATIVE');

INSERT INTO GDX_TA_WAY_SEPT_MAP
  (ID_WAY, ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL, RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6, 12, 'Purpose Orientation (OT-7)', 26, 'Proportion Between Resources and Goal (Arithmetic)',
   'How the person distributes time and effort in a way compatible with the goal.',
   'Interpretive extension of the Fifth Way: the Arithmetic lens observes the proportion between invested resources and the goal within that same teleological orientation, not an independent argumentative way.',
   'SPECULATIVE');

INSERT INTO GDX_TA_WAY_SEPT_MAP
  (ID_WAY, ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL, RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6, 12, 'Purpose Orientation (OT-7)', 27, 'Structure Among Goals, Values, and Actions (Geometry)',
   'Alignment between the goal, the person''s personal values, and their other responsibilities.',
   'Interpretive extension of the Fifth Way: the Geometry lens observes the structure/alignment among goals, values and actions within that same teleological orientation, not an independent argumentative way.',
   'SPECULATIVE');

INSERT INTO GDX_TA_WAY_SEPT_MAP
  (ID_WAY, ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL, RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6, 12, 'Purpose Orientation (OT-7)', 28, 'Rhythm and Continuity (Music)',
   'Maintaining a sustainable pace of action, adjusting effort when perceived vitality changes.',
   'Interpretive extension of the Fifth Way: the Music lens observes the rhythm and continuity of actions within that same teleological orientation, not an independent argumentative way.',
   'SPECULATIVE');

INSERT INTO GDX_TA_WAY_SEPT_MAP
  (ID_WAY, ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL, RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6, 12, 'Purpose Orientation (OT-7)', 29, 'Cycles and Broader Context (Astronomy)',
   'Reassessing the goal when context, priorities, or conditions change.',
   'Interpretive extension of the Fifth Way: the Astronomy lens observes reassessing the goal across cycles and contexts within that same teleological orientation, not an independent argumentative way.',
   'SPECULATIVE');

COMMIT;
