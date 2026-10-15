/**
 * Fixed judgment-call catalog for GDX_SKILL_TREATMENT_SUGGESTIONS -- same
 * pattern as 3.septenary.constitution's GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/
 * knowledge.js: which virtue is suggested for which psychometric variable,
 * and why, is an interpretive judgment call. It lives here, keyed by the
 * variable's .sav column (DW_DIM_VARIABLE.SAV_COLUMN), and nowhere else.
 *
 * Source for the 33 virtues: https://institutovirtudes.com.br/manual/ (see
 * 12.gdx.virtology/Virtology_Knowledge_Base.md for the full write-up).
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
// resolved against VIRTUES above), justification (pt, why this virtue) }.
// A variable found in the DW but missing from this map is reported as
// "sem sugestao (revisar)" by generate_suggestions.js -- never guessed.
const VARIABLE_VIRTUE_MAP = {
  ENGAGvigor: {
    behavior: 'Disposition and energy to invest effort in studying',
    virtue: 'Perseverança',
    justification: 'Low vigor is depletion of sustained energy — Perseverance is the practice of maintaining effort despite wear, a direct antidote for the drop in disposition',
  },
  EmocPos: {
    behavior: 'Repertoire of positive emotions (joy, interest, hope)',
    virtue: 'Gratidão',
    justification: "It is the instrument's own theoretical basis (Positivity Ratio / Fredrickson, broaden-and-build): gratitude is the most documented lever for raising positive emotion",
  },
  EmocNeg: {
    behavior: 'Repertoire of negative emotions (sadness, fear, anger)',
    virtue: 'Gratidão',
    justification: 'Same broaden-and-build logic: cultivating gratitude shifts the emotional repertoire away from the negative pole, rather than suppressing it directly',
  },
  SATISFVIDA: {
    behavior: "Global affective evaluation of one's own life",
    virtue: 'Aceitação',
    justification: 'Satisfaction with life as a whole depends on accepting life as it is today, not just changing circumstances — Acceptance attacks the root of the negative global judgment',
  },
  SATISFTRAB: {
    behavior: 'Pleasure/displeasure with the occupational activity',
    virtue: 'Utilidade',
    justification: 'Job satisfaction is strongly tied to the sense of being useful/contributing — Utility is the most direct axis for rebuilding that bond',
  },
  SatPes: {
    behavior: 'Subjective contentment with oneself',
    virtue: 'Aceitação',
    justification: 'Low personal contentment is, in practice, insufficient self-acceptance',
  },
  HARDcontrole: {
    behavior: 'Belief in being able to influence everyday events',
    virtue: 'Responsabilidade',
    justification: 'Low perceived control improves by training the active assumption of responsibility over what is actually within the person\'s reach',
  },
  CtrlVi: {
    behavior: "Practical sense of mastery over one's own routine",
    virtue: 'Responsabilidade',
    justification: 'Same reasoning as HARDcontrole — mastery of the routine is a direct exercise of personal responsibility',
  },
  ACcontrole: {
    behavior: "Practical planning and decision-making about one's career",
    virtue: 'Responsabilidade',
    justification: 'Low career control calls for the same antidote: actively taking responsibility for concrete decisions',
  },
  HARDcompromis: {
    behavior: 'Engagement with values and life purpose (not just the task)',
    virtue: 'Fé',
    justification: 'Commitment is adherence to a meaning/identity that transcends the immediate task — Faith is the axis that sustains this kind of long-term engagement',
  },
  ENGAGdedicac: {
    behavior: 'Enthusiasm, pride, and meaning attributed to the student role',
    virtue: 'Fé',
    justification: '"Dedication" is an investment of identity, not just energy — it needs something to believe in beyond the immediate outcome, which is the core of Faith',
  },
  ACconfianc: {
    behavior: 'Self-efficacy projected onto the professional future',
    virtue: 'Otimismo',
    justification: 'Confidence in one\'s own future is, by definition, a sustained positive expectation — the core of Optimism',
  },
  ACcuriosid: {
    behavior: 'Exploring alternatives, openness to possibilities',
    virtue: 'Flexibilidade',
    justification: 'Low curiosity is, in practice, rigidity in the face of the unknown — Flexibility is the direct antidote',
  },
  ENGAGabsorc: {
    behavior: 'Flow state, losing track of time while studying',
    virtue: 'Tudo Somos Um',
    justification: 'The literature describes absorption/flow as a dissolution of the subject-object boundary — resonating directly with this virtue\'s theme of unity/interconnection',
  },
  HARDdesafio: {
    behavior: 'Ability to draw meaning and growth from adversity',
    virtue: 'Busca do Melhoramento',
    justification: "It is literally the virtue's definition: facing difficulty as an opportunity for growth, echoing Frankl (purpose), cited by Virtology itself",
  },
  ACpreocup: {
    behavior: 'Future orientation with a sense of existential continuity',
    virtue: 'Eternidade',
    justification: '"Concern" in Savickas\'s sense is an integrated temporal outlook — the virtue that explicitly deals with a perspective beyond the immediate is the closest match',
  },
  RealizPess: {
    behavior: 'Sense of ultimate fulfillment, purpose achieved',
    virtue: 'Individuação',
    justification: 'Maximal personal fulfillment is the direct psychological correlate of the Jungian process of individuation — becoming a fully integrated Self',
  },
};

module.exports = { VIRTUES, virtueByPt, VARIABLE_VIRTUE_MAP };
