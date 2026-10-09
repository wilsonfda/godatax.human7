/**
 * Fixed judgment-call catalog for GDX_SKILL_IDENTIFY_VIRTUES -- a separate
 * copy of GDX_SKILL_LINK_SUGGESTIONS/scripts/virtue_knowledge.js's VIRTUES
 * list and variable -> virtue correspondence (same pattern the repo already
 * uses for per-skill knowledge files, e.g. 3.septenary.constitution's
 * GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/knowledge.js).
 *
 * Which of the 33 virtues a given psychometric variable corresponds to is
 * the same interpretive judgment call as GDX_SKILL_LINK_SUGGESTIONS -- kept
 * here so this skill has no runtime dependency on a sibling skill's folder.
 * Only the `justification` prose is written differently on purpose: this
 * skill reads a HIGH score as a potential strength already present, never
 * as a deficit needing an antidote. See "Keeping this in sync" in SKILL.md:
 * when a variable -> virtue pairing is added to one skill's map, mirror the
 * `behavior`/`virtue` fields (not necessarily the `justification`) into the
 * other's.
 *
 * Source for the 33 virtues: https://institutovirtudes.com.br/manual/ (see
 * 12.gdx.virtology/Virtology_Knowledge_Base.md for the full write-up and its
 * reliability caveat -- both were fetched via an automated tool, not read
 * verbatim by a person).
 *
 * Source for what each psychometric variable measures and which septenary
 * level it sits at: 3.septenary.constitution/SPSS_Septenary_Constitution_
 * Mapping.md, cross-checked against the live GDX_PSY_SEPT_LEVEL_PSY_MAP /
 * DW_DIM_VARIABLE data at runtime.
 */

// The 33 virtues, in the manual's own order. "Humildade" (#1) is explicitly
// foundational per the source: "sem ela nenhuma das outras se sustenta."
const VIRTUES = [
  { n: 1, pt: 'Humildade', en: 'Humility' },
  { n: 2, pt: 'Individuação', en: 'Individuation' },
  { n: 3, pt: 'Brandura', en: 'Gentleness' },
  { n: 4, pt: 'Eternidade', en: 'Eternity' },
  { n: 5, pt: 'Perdão', en: 'Forgiveness' },
  { n: 6, pt: 'Exemplo Positivo', en: 'Positive Example' },
  { n: 7, pt: 'Igualdade', en: 'Equality' },
  { n: 8, pt: 'Fraternidade', en: 'Fraternity' },
  { n: 9, pt: 'Aceitação', en: 'Acceptance' },
  { n: 10, pt: 'Perseverança', en: 'Perseverance' },
  { n: 11, pt: 'Otimismo', en: 'Optimism' },
  { n: 12, pt: 'Paciência', en: 'Patience' },
  { n: 13, pt: 'Reconciliação', en: 'Reconciliation' },
  { n: 14, pt: 'Fé', en: 'Faith' },
  { n: 15, pt: 'Tudo Somos Um', en: 'We Are All One' },
  { n: 16, pt: 'Ajuda ao Próximo', en: 'Helping Others' },
  { n: 17, pt: 'Amor ao Próximo', en: 'Love for Others' },
  { n: 18, pt: 'Gratidão', en: 'Gratitude' },
  { n: 19, pt: 'Verdade', en: 'Truth' },
  { n: 20, pt: 'Bom Humor', en: 'Good Humor' },
  { n: 21, pt: 'Honestidade', en: 'Honesty' },
  { n: 22, pt: 'Não Julgamento', en: 'Non-judgment' },
  { n: 23, pt: 'Pureza de Coração', en: 'Purity of Heart' },
  { n: 24, pt: 'Abnegação', en: 'Abnegation' },
  { n: 25, pt: 'Pagar o Mal com o Bem', en: 'Repay Evil with Good' },
  { n: 26, pt: 'Honrar a Família', en: 'Honor Family' },
  { n: 27, pt: 'Desapego', en: 'Detachment' },
  { n: 28, pt: 'Busca do Melhoramento', en: 'Pursuit of Improvement' },
  { n: 29, pt: 'Cuidado com o Corpo', en: 'Body Care' },
  { n: 30, pt: 'Flexibilidade', en: 'Flexibility' },
  { n: 31, pt: 'Utilidade', en: 'Utility' },
  { n: 32, pt: 'Amor à Natureza e aos Animais', en: 'Love of Nature and Animals' },
  { n: 33, pt: 'Responsabilidade', en: 'Responsibility' },
];

function virtueByPt(pt) {
  const v = VIRTUES.find((x) => x.pt === pt);
  if (!v) throw new Error(`Unknown virtue "${pt}" -- check spelling against VIRTUES in virtue_knowledge.js`);
  return v;
}

// variable.SAV_COLUMN -> { behavior (pt, "o que mede"), virtue (pt name,
// resolved against VIRTUES above), justification (pt, why a HIGH score
// here reads as this virtue already being a potential strength). A
// variable found in the DW but missing from this map is reported as "sem
// virtude identificada (revisar)" by identify_virtues.js -- never guessed.
const VARIABLE_VIRTUE_MAP = {
  ENGAGvigor: {
    behavior: 'Disposition and energy to invest effort in studying',
    virtue: 'Perseverança',
    justification: 'High vigor is sustained energy already in action — a sign that Perseverance, the practice of maintaining effort despite wear, is already a resource present in this population',
  },
  EmocPos: {
    behavior: 'Repertoire of positive emotions (joy, interest, hope)',
    virtue: 'Gratidão',
    justification: "It is the instrument's own theoretical basis (Positivity Ratio / Fredrickson, broaden-and-build): an already-high positive repertoire suggests Gratitude, its most documented lever, is already being exercised",
  },
  EmocNeg: {
    behavior: 'Repertoire of negative emotions (sadness, fear, anger)',
    virtue: 'Gratidão',
    justification: "Same broaden-and-build theoretical basis as the instrument — but unlike EmocPos, this variable is on the negative pole: a high score here is not a strength, it is the mechanical reading of the ranking. See the report's caveat about scale direction before treating it as a potential",
  },
  SATISFVIDA: {
    behavior: "Global affective evaluation of one's own life",
    virtue: 'Aceitação',
    justification: 'High life satisfaction is the affective portrait of already accepting life as it is — a sign that Acceptance is already present and sustaining that positive global evaluation',
  },
  SATISFTRAB: {
    behavior: 'Pleasure/displeasure with the occupational activity',
    virtue: 'Utilidade',
    justification: 'High job satisfaction is strongly tied to the sense of already being useful/contributing — a sign that Utility is already a lived axis, not just a desired one',
  },
  SatPes: {
    behavior: 'Subjective contentment with oneself',
    virtue: 'Aceitação',
    justification: 'High subjective contentment with oneself is, in practice, self-acceptance already in exercise',
  },
  HARDcontrole: {
    behavior: 'Belief in being able to influence everyday events',
    virtue: 'Responsabilidade',
    justification: 'High belief in being able to influence everyday events reflects someone who already takes active Responsibility over what is within their reach',
  },
  CtrlVi: {
    behavior: "Practical sense of mastery over one's own routine",
    virtue: 'Responsabilidade',
    justification: 'Same reasoning as HARDcontrole — already-demonstrated mastery of the routine is a direct and already-present exercise of personal Responsibility',
  },
  ACcontrole: {
    behavior: "Practical planning and decision-making about one's career",
    virtue: 'Responsabilidade',
    justification: 'Practical planning and decision-making already active about the career are Responsibility in action, not just in intention',
  },
  HARDcompromis: {
    behavior: 'Engagement with values and life purpose (not just the task)',
    virtue: 'Fé',
    justification: 'High engagement with values and life purpose indicates a Faith already sustaining that long-term commitment',
  },
  ENGAGdedicac: {
    behavior: 'Enthusiasm, pride, and meaning attributed to the student role',
    virtue: 'Fé',
    justification: 'Enthusiasm and meaning already attributed to the student role show an investment of identity sustained by something beyond the immediate outcome — the already-active core of Faith',
  },
  ACconfianc: {
    behavior: 'Self-efficacy projected onto the professional future',
    virtue: 'Otimismo',
    justification: 'High confidence in one\'s own professional future is, by definition, an already-sustained positive expectation — Optimism in exercise',
  },
  ACcuriosid: {
    behavior: 'Exploring alternatives, openness to possibilities',
    virtue: 'Flexibilidade',
    justification: 'High curiosity is openness already demonstrated to alternatives and to the unknown — Flexibility already in practice',
  },
  ENGAGabsorc: {
    behavior: 'Flow state, losing track of time while studying',
    virtue: 'Tudo Somos Um',
    justification: 'High absorption/flow is the already-lived dissolution of the subject-object boundary described in the literature — resonating directly with an already-present experience of this virtue\'s theme of unity',
  },
  HARDdesafio: {
    behavior: 'Ability to draw meaning and growth from adversity',
    virtue: 'Busca do Melhoramento',
    justification: 'A high ability to draw meaning and growth from adversity is, literally, the Pursuit of Improvement already in practice',
  },
  ACpreocup: {
    behavior: 'Future orientation with a sense of existential continuity',
    virtue: 'Eternidade',
    justification: 'An already-high future orientation with a sense of existential continuity indicates an already-present integrated temporal outlook — the same beyond-the-immediate perspective central to this virtue',
  },
  RealizPess: {
    behavior: 'Sense of ultimate fulfillment, purpose achieved',
    virtue: 'Individuação',
    justification: 'An already-high sense of personal fulfillment is the direct psychological correlate of an Individuation process already underway — the Self already on its way to integration',
  },
};

module.exports = { VIRTUES, virtueByPt, VARIABLE_VIRTUE_MAP };
