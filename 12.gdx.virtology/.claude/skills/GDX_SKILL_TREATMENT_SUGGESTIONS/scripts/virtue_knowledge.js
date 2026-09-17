/**
 * Fixed judgment-call catalog for GDX_SKILL_TREATMENT_SUGGESTIONS -- same
 * pattern as 3.septenary.constitution's GDX_SKILL_LOAD_SEPT_MAPS_DB/scripts/
 * knowledge.js: which virtue is suggested for which psychometric variable,
 * and why, is an interpretive judgment call. It lives here, keyed by the
 * variable's .sav column (DW_DIM_VARIABLE.SAV_COLUMN), and nowhere else.
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
// resolved against VIRTUES above), justification (pt, why this virtue) }.
// A variable found in the DW but missing from this map is reported as
// "sem sugestao (revisar)" by generate_suggestions.js -- never guessed.
const VARIABLE_VIRTUE_MAP = {
  ENGAGvigor: {
    behavior: 'Disposição e energia para investir esforço nos estudos',
    virtue: 'Perseverança',
    justification: 'Vigor baixo é esgotamento da energia sustentada — Perseverança é o treino de manter esforço apesar do desgaste, antídoto direto para a queda de disposição',
  },
  EmocPos: {
    behavior: 'Repertório de emoções positivas (alegria, interesse, esperança)',
    virtue: 'Gratidão',
    justification: 'É a própria base teórica do instrumento (Positivity Ratio / Fredrickson, broaden-and-build): gratidão é a alavanca mais documentada para elevar emoção positiva',
  },
  EmocNeg: {
    behavior: 'Repertório de emoções negativas (tristeza, medo, raiva)',
    virtue: 'Gratidão',
    justification: 'Mesma lógica broaden-and-build: cultivar gratidão desloca o repertório emocional para longe do polo negativo, em vez de suprimi-lo diretamente',
  },
  SATISFVIDA: {
    behavior: 'Avaliação afetiva global da própria vida',
    virtue: 'Aceitação',
    justification: 'Satisfação com a vida como um todo depende de aceitar a vida como ela é hoje, não apenas de mudar circunstâncias — Aceitação ataca a raiz do julgamento global negativo',
  },
  SATISFTRAB: {
    behavior: 'Prazer/desprazer com a atividade ocupacional',
    virtue: 'Utilidade',
    justification: 'Satisfação no trabalho está fortemente ligada ao senso de ser útil/contribuir — Utilidade é o eixo mais direto para reconstruir esse vínculo',
  },
  SatPes: {
    behavior: 'Contentamento subjetivo consigo mesmo',
    virtue: 'Aceitação',
    justification: 'Contentamento pessoal baixo é, na prática, autoaceitação insuficiente',
  },
  HARDcontrole: {
    behavior: 'Crença em poder influenciar eventos cotidianos',
    virtue: 'Responsabilidade',
    justification: 'Controle percebido baixo melhora ao se treinar a tomada ativa de responsabilidade sobre o que de fato está ao alcance da pessoa',
  },
  CtrlVi: {
    behavior: 'Senso prático de domínio sobre a própria rotina',
    virtue: 'Responsabilidade',
    justification: 'Mesmo raciocínio de HARDcontrole — domínio da rotina é exercício direto de responsabilidade pessoal',
  },
  ACcontrole: {
    behavior: 'Planejamento e decisão prática sobre a carreira',
    virtue: 'Responsabilidade',
    justification: 'Controle de carreira baixo pede o mesmo antídoto: assumir responsabilidade ativa por decisões concretas',
  },
  HARDcompromis: {
    behavior: 'Engajamento com valores e propósito de vida (não só a tarefa)',
    virtue: 'Fé',
    justification: 'Comprometimento é adesão a um sentido/identidade que transcende a tarefa imediata — Fé é o eixo que sustenta esse tipo de engajamento de longo prazo',
  },
  ENGAGdedicac: {
    behavior: 'Entusiasmo, orgulho e sentido atribuído ao papel de estudante',
    virtue: 'Fé',
    justification: '"Dedicação" é investimento de identidade, não só de energia — precisa de algo para crer além do resultado imediato, o que é o núcleo da Fé',
  },
  ACconfianc: {
    behavior: 'Autoeficácia projetada sobre o futuro profissional',
    virtue: 'Otimismo',
    justification: 'Confiança no próprio futuro é, por definição, uma expectativa positiva sustentada — o núcleo do Otimismo',
  },
  ACcuriosid: {
    behavior: 'Exploração de alternativas, abertura a possibilidades',
    virtue: 'Flexibilidade',
    justification: 'Curiosidade baixa é, na prática, rigidez diante do desconhecido — Flexibilidade é o antídoto direto',
  },
  ENGAGabsorc: {
    behavior: 'Estado de flow, perder a noção do tempo estudando',
    virtue: 'Tudo Somos Um',
    justification: 'A literatura descreve absorção/flow como dissolução da fronteira sujeito-objeto — ressoa diretamente com o tema de unidade/interconexão desta virtude',
  },
  HARDdesafio: {
    behavior: 'Capacidade de extrair sentido e crescimento da adversidade',
    virtue: 'Busca do Melhoramento',
    justification: 'É literalmente a definição da virtude: encarar dificuldade como oportunidade de evolução, dialogando com Frankl (propósito), citado pela própria Virtologia',
  },
  ACpreocup: {
    behavior: 'Orientação de futuro com senso de continuidade existencial',
    virtue: 'Eternidade',
    justification: '"Preocupação" no sentido de Savickas é uma visão temporal integrada — a virtude que trata explicitamente de perspectiva além do imediato é a mais próxima',
  },
  RealizPess: {
    behavior: 'Senso de realização última, propósito alcançado',
    virtue: 'Individuação',
    justification: 'Realização pessoal máxima é o correlato psicológico direto do processo junguiano de individuação — tornar-se o Self plenamente integrado',
  },
};

module.exports = { VIRTUES, virtueByPt, VARIABLE_VIRTUE_MAP };
