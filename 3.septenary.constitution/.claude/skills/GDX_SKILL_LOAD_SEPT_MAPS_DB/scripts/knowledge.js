/**
 * GDX_SKILL_LOAD_SEPT_MAPS_DB - fixed domain knowledge.
 *
 * Which septenary level a given psychometric variable (.sav column)
 * corresponds to, and WHY, is an interpretive/philosophical judgment call --
 * it cannot be derived mechanically from the database (same reasoning as
 * GDX_SKILL_LOAD_RLT_MODEL_DB/scripts/catalog.py, which this file mirrors in
 * spirit). This module is the single place that judgment call lives.
 *
 * Keyed by the .sav column name embedded in
 * GDX_PSY_VARIABLE.OPERATIONAL_DEFINITION (format ".sav column: <col> (...)")
 * for variables that came from a historical .sav file (GDX_SKILL_LOAD_RLT_MODEL_DB).
 * A variable onboarded through GDX_SKILL_NEW_STUDY / GDX_SKILL_RECORD_NEW_STUDY has
 * no .sav file behind it, so it is keyed by its own GDX_PSY_VARIABLE.NAME instead
 * (see resolveMappingKey() in load_sept_maps.js) -- e.g. "Recovery From Setbacks",
 * not a .sav-style column code.
 *
 * Each entry is either:
 *   { level: 1-7, confidence: 'HIGH'|'MEDIUM'|'LOW'|'SPECULATIVE',
 *     behavior: '...', justification: '...' }
 * or, for variables deliberately left out of the septenary mapping:
 *   { excluded: true, reason: '...' }
 *
 * To extend: when a new instrument/variable is added to the psychometrics
 * schema, run the skill once first -- it will list any .sav column with NO
 * entry here as UNKNOWN and refuse to guess. Add the column below with a
 * real judgment call (or an `excluded` entry with a real reason), then
 * re-run.
 */

module.exports = {
  // --- Hardiness (instrument 1) ---
  HARDcompromis: {
    level: 5, confidence: 'MEDIUM',
    behavior: 'Engagement with values and life purpose (not just the task)',
    justification: 'Commitment goes beyond the concrete - it is adherence to a meaning/identity',
  },
  HARDcontrole: {
    level: 4, confidence: 'HIGH',
    behavior: 'Belief in being able to influence everyday events',
    justification: 'Control is a concrete cognitive function - "I think, therefore I can act on this"',
  },
  HARDdesafio: {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Ability to draw meaning and growth from adversity',
    justification: 'Turning difficulty into meaning is an intuitive/meaning-making operation, beyond practical reasoning',
  },

  // --- Student Engagement Scale (instrument 2) ---
  ENGAGvigor: {
    level: 2, confidence: 'HIGH',
    behavior: 'Disposition, energy, willingness to invest effort in studying',
    justification: 'Vigor is by definition vital energy applied to an activity - a direct mapping',
  },
  ENGAGdedicac: {
    level: 5, confidence: 'MEDIUM',
    behavior: 'Enthusiasm, pride, meaning attributed to the student role',
    justification: '"Dedication" is an investment of identity, not just energy (vital)',
  },
  ENGAGabsorc: {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Flow state, losing track of time while studying',
    justification: 'Absorption/flow is described in the literature as a quasi-transcendent state of subject-activity unity - a classic correspondence with the Buddhic body',
  },

  // --- Career Adapt-Abilities Scale (instrument 3) ---
  ACpreocup: {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Future orientation with a sense of existential continuity',
    justification: '"Concern" here (Savickas) is an integrated temporal outlook - close to the intuitive perception of purpose',
  },
  ACcontrole: {
    level: 4, confidence: 'HIGH',
    behavior: 'Practical planning and decision-making about one\'s career',
    justification: 'Practical reasoning applied to a concrete goal (career)',
  },
  ACcuriosid: {
    level: 5, confidence: 'MEDIUM',
    behavior: 'Exploring alternatives, openness to possibilities',
    justification: 'Exploratory/abstract thinking, not tied to an immediate action',
  },
  ACconfianc: {
    level: 5, confidence: 'MEDIUM',
    behavior: 'Self-efficacy projected onto one\'s professional future',
    justification: 'Abstract self-judgment over time - the abstract mind',
  },

  // --- Satisfaction With Life Scale (instrument 4) ---
  SATISFVIDA: {
    level: 3, confidence: 'HIGH',
    behavior: 'Global affective evaluation of one\'s own life',
    justification: 'Satisfaction is an affective judgment - astral body (desire satisfied/unsatisfied)',
  },

  // --- Job Satisfaction Scale (instrument 5) ---
  SATISFTRAB: {
    level: 3, confidence: 'HIGH',
    behavior: 'Pleasure/displeasure with the occupational activity',
    justification: 'Same as life satisfaction - affect tied to a specific object (work)',
  },

  // --- Positivity Ratio Scale (instrument 6) ---
  EmocPos: {
    level: 2, confidence: 'MEDIUM',
    behavior: 'Positive energetic activation',
    justification: 'High-activation positive emotions (joy, interest) have a strong vital/energetic component',
  },
  EmocNeg: {
    level: 3, confidence: 'HIGH',
    behavior: 'Negative emotional repertoire (sadness, fear, anger, disgust, guilt, hatred...)',
    justification: 'Symmetric to EmocPos - the negative half of the same Positivity Ratio emotional core; pure emotional content (positive or negative) is exactly the astral body\'s domain',
  },

  // --- Personal Satisfaction (instrument 7) ---
  SatPes: {
    level: 3, confidence: 'HIGH',
    behavior: 'Subjective contentment with oneself',
    justification: 'Self-directed affect',
  },

  // --- Perceived Control of Life (instrument 8) ---
  CtrlVi: {
    level: 4, confidence: 'HIGH',
    behavior: 'Practical sense of mastery over one\'s own routine',
    justification: 'Concrete cognitive judgment about personal agency',
  },

  // --- Undocumented Organizational Block (instrument 10, hypothesis) ---
  // AnoOrg / SucProfFin / CondSocie are environment/context perceptions, not
  // a state of the individual's own consciousness -- see
  // SPSS_Septenary_Constitution_Mapping.md section 3.
  AnoOrg: { excluded: true, reason: 'Perception about the organization (anomie), not a state of consciousness of the individual - see SPSS_Septenary_Constitution_Mapping.md section 3.' },
  SucProfFin: { excluded: true, reason: 'External socioeconomic indicator, not an internal experience - see SPSS_Septenary_Constitution_Mapping.md section 3.' },
  CondSocie: { excluded: true, reason: 'Perception of social status - a context variable, not a level of consciousness - see SPSS_Septenary_Constitution_Mapping.md section 3.' },
  RealizPess: {
    level: 7, confidence: 'SPECULATIVE',
    behavior: 'Sense of ultimate fulfillment, purpose achieved',
    justification: 'The name and semantics ("personal fulfillment", high mean) suggest the highest level of meaning, beyond the abstract mind',
  },

  // --- Red Tape / Perceived Bureaucracy (instrument 11, hypothesis) ---
  RedTap: { excluded: true, reason: 'Judgment about the institutional environment (bureaucracy), not about oneself - see SPSS_Septenary_Constitution_Mapping.md section 3.' },

  // --- Orientação à Finalidade / OT-7 (instrument 12, hypothesis, metaphysical, no .sav file) ---
  // All seven dimensions are kept at the SAME septenary level (6, Buddhic Body) and the
  // SAME confidence (SPECULATIVE): the source documents (Orientacao_a_Finalidade_Trivium_
  // Quadrivium_OT7.pdf and the GDX H7ph book/article) anchor the WHOLE OT-7 construct in
  // Aquinas's Fifth Way (governance, order and finality) -- which five_ways_septenary_map_
  // firebird25.sql already maps to Level 6 with CONFIDENCE_LEVEL 'SPECULATIVE' -- and never
  // claim a distinct septenary level per Trivium/Quadrivium lens. Splitting them across
  // different levels would be an invention not supported by either source document.
  // NOTE: these keys are GDX_PSY_VARIABLE.NAME as actually stored in Firebird (English, since
  // 2026-10-09's catalog translation pass) -- lookups in load_sept_maps.js match against the
  // live DB value, so keep these in sync with the catalog if it is ever renamed again.
  'Clarity of Purpose (Grammar)': {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Naming and clearly describing the personal goal the person says they are trying to achieve (OT-7 Grammar item).',
    justification: 'The whole OT-7 construct is anchored in Aquinas\'s Fifth Way (governance, order and finality), already associated with Level 6 (Buddhic Body) in five_ways_septenary_map_firebird25.sql. Clear verbal articulation of a purpose is read here as an expression of that same intuition of meaning/finality, not as an independent correspondence path.',
  },
  'Coherence Between Means and Ends (Logic)': {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Assessing whether the person\'s recent actions are coherent with the stated goal (OT-7 Logic item).',
    justification: 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. Coherence between means and ends is read as the logical facet of that same teleological orientation, not a separate correspondence.',
  },
  'Expression of Purpose (Rhetoric)': {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'How the person communicates and justifies why the goal matters to them (OT-7 Rhetoric item).',
    justification: 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The ability to articulate the personal meaning of the purpose is read as the rhetorical facet of that same teleological orientation.',
  },
  'Proportion Between Resources and Goal (Arithmetic)': {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'How the person distributes time and effort in a way compatible with the goal (OT-7 Arithmetic item).',
    justification: 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The proportion between invested resources and the goal is read as the quantitative facet of that same teleological orientation.',
  },
  'Structure Among Goals, Values, and Actions (Geometry)': {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Alignment between the goal, the person\'s personal values, and their other responsibilities (OT-7 Geometry item).',
    justification: 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The structure/alignment among goals, values and actions is read as the relational facet of that same teleological orientation.',
  },
  'Rhythm and Continuity (Music)': {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Maintaining a sustainable pace of action, adjusting effort when perceived vitality changes (OT-7 Music item).',
    justification: 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The rhythm and continuity of actions are read as the temporal/cadenced facet of that same teleological orientation.',
  },
  'Cycles and Broader Context (Astronomy)': {
    level: 6, confidence: 'SPECULATIVE',
    behavior: 'Reassessing the goal when context, priorities, or conditions change (OT-7 Astronomy item).',
    justification: 'Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. Reassessing the goal across cycles and contexts is read as the cyclical/contextual facet of that same teleological orientation.',
  },
};
