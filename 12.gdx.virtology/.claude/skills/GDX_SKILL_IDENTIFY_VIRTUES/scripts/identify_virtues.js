#!/usr/bin/env node
/**
 * GDX_SKILL_IDENTIFY_VIRTUES
 *
 * The mirror image of GDX_SKILL_LINK_SUGGESTIONS: reads the real average
 * score of every psychometric variable that has a septenary-level mapping
 * (7.multidimensional.database's DW_FACT_PSY_VARIABLE_RESULT /
 * DW_DIM_VARIABLE), ranks them by how much of a strength each one
 * represents (the strongest indicators first), and for each one looks up a
 * corresponding virtue -- out of the 33 catalogued in
 * 12.gdx.virtology/Virtology_Knowledge_Base.md -- from GDX_VT_VARIABLE_VIRTUE_MAP
 * joined to GDX_VT_VIRTUE in Firebird (12.gdx.virtology/virtology_model_firebird25.sql),
 * reading the JUSTIFICATION_STRENGTH column (this skill's strength/already-present framing).
 *
 * 2026-10-18: "strongest" is no longer always "highest raw score". Most
 * variables are POSITIVE polarity (high score = strength), but a NEGATIVE
 * one (e.g. Negative Emotions) has it backwards -- a LOW score is the
 * strength. GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY
 * (variable_virtue_map_polarity_firebird25.sql) records this per variable;
 * rankByStrength() reads it and ranks accordingly -- the same mechanism
 * GDX_SKILL_LINK_SUGGESTIONS uses for the opposite (deficit) framing.
 *
 * 2026-10-15: switched from requiring scripts/virtue_knowledge.js (a
 * code-only, hand-written JS map) to this live DB read -- the table is now
 * the source of truth for this skill. virtue_knowledge.js still exists (two
 * copies, one per sibling skill) only because GDX_SKILL_LIST_ASSOCIATIONS's
 * code-vs-database sync check still reads both of them directly; it is no
 * longer required by this script.
 *
 * This is a read-only skill: it never writes to Firebird or Neo4j, and
 * (unlike GDX_SKILL_LINK_SUGGESTIONS) it never writes a file at all -- the
 * result is printed to the screen only.
 *
 * Usage:
 *   node identify_virtues.js --study <slug> [--top N] [--sample] [--intake-dir <path>]
 *
 *   --study <slug>  REQUIRED. Same slug GDX_SKILL_NEW_STUDY/GDX_SKILL_MAKE_DASHBOARS_DW/
 *                   GDX_SKILL_LOAD_NEW_STUDY_DW/GDX_SKILL_LINK_SUGGESTIONS use for
 *                   new_study_intake/<slug>/intake.json -- resolves to GDX_PSY_STUDY.ID_STUDY,
 *                   and every ranked indicator is this one study's own average, never blended
 *                   with another study's participants.
 *   --top N         how many of the highest-scoring indicators to report (default 3)
 *   --sample        use embedded synthetic data, no DB connection (offline test) -- a missing
 *                   intake.json is not an error in this mode, same as the other --study skills
 *   --intake-dir    override the default new_study_intake/<slug>/ location
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

function parseArgs(argv) {
  const args = { top: 3, sample: false, study: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--top') args.top = parseInt(argv[++i], 10);
    else if (argv[i] === '--sample') args.sample = true;
    else if (argv[i] === '--study') args.study = argv[++i];
    else if (argv[i] === '--intake-dir') args.intakeDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.study) {
    throw new Error(
      '--study <slug> is required. Pass the same slug GDX_SKILL_NEW_STUDY used for ' +
      'new_study_intake/<slug>/intake.json -- every ranked indicator is scoped to that one study.'
    );
  }
  return args;
}

/** GDX_HUMAN/0.new.instrument/new_study_intake/<slug>/intake.json, resolved
 * relative to this script (12.gdx.virtology/.claude/skills/GDX_SKILL_IDENTIFY_VIRTUES/scripts)
 * -- same depth/pattern as GDX_SKILL_LINK_SUGGESTIONS's resolveIntakePath(). */
function resolveIntakePath(args) {
  if (args.intakeDir) return path.join(args.intakeDir, 'intake.json');
  return path.join(__dirname, '..', '..', '..', '..', '..',
    '0.new.instrument', 'new_study_intake', args.study, 'intake.json');
}

function loadIntake(args) {
  const intakePath = resolveIntakePath(args);
  if (!fs.existsSync(intakePath)) return null;
  return JSON.parse(fs.readFileSync(intakePath, 'utf8'));
}

/** Resolves --study's slug to GDX_PSY_STUDY.ID_STUDY via the intake's
 * study.title -- same lookup the other --study-scoped skills use. */
async function resolveStudyId(fbDb, studyTitle, studySlug) {
  const rows = await fbQuery(fbDb, 'SELECT FIRST 1 ID_STUDY FROM GDX_PSY_STUDY WHERE TITLE = ?', [studyTitle]);
  if (rows.length === 0) {
    throw new Error(
      `Study "${studyTitle}" (slug "${studySlug}") not found in GDX_PSY_STUDY. Run ` +
      `GDX_SKILL_RECORD_NEW_STUDY and GDX_SKILL_LOAD_NEW_STUDY_DW for this study first.`
    );
  }
  return rows[0].ID_STUDY;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env, fill it in, and export the vars first.`);
  }
  return v;
}

function fbConnect(options) {
  return new Promise((resolve, reject) => Firebird.attach(options, (err, db) => (err ? reject(err) : resolve(db))));
}
function fbQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result))));
}

// Synthetic data for --sample, shaped like a real high-score slice of
// DW_FACT_PSY_VARIABLE_RESULT / DW_DIM_VARIABLE / DW_DIM_SEPTENARY_LEVEL --
// illustrative only, not a live read.
const SAMPLE_ROWS = [
  { SAV_COLUMN: 'RealizPess', VARIABLE_NAME: 'Personal Fulfillment', LEVEL_NAME: 'Causal Body', AVG_SCORE: 4.62, N: 423 },
  { SAV_COLUMN: 'ENGAGdedicac', VARIABLE_NAME: 'Dedication', LEVEL_NAME: 'Higher Mental Body', AVG_SCORE: 4.55, N: 423 },
  { SAV_COLUMN: 'ACconfianc', VARIABLE_NAME: 'Confidence', LEVEL_NAME: 'Lower Mental Body', AVG_SCORE: 4.41, N: 423 },
  { SAV_COLUMN: 'SATISFVIDA', VARIABLE_NAME: 'Satisfaction With Life', LEVEL_NAME: 'Astral Body', AVG_SCORE: 4.30, N: 423 },
  { SAV_COLUMN: 'HARDcompromis', VARIABLE_NAME: 'Commitment', LEVEL_NAME: 'Buddhic Body', AVG_SCORE: 4.22, N: 423 },
];

// Synthetic virtue-map data for --sample (no DB connection), covering exactly
// the SAV_COLUMNs used in SAMPLE_ROWS above -- values mirror the real rows in
// GDX_VT_VARIABLE_VIRTUE_MAP (virtology_model_firebird25.sql) as of 2026-10-15.
// All POSITIVE polarity -- none of SAMPLE_ROWS is a negative-pole variable
// (see polarityOf()/rankByStrength() below for how a NEGATIVE row would rank).
const SAMPLE_VIRTUE_MAP = {
  RealizPess: { behavior: 'Sense of ultimate fulfillment, purpose achieved', virtuePt: 'Individuação', virtueEn: 'Individuation', virtueOrder: 2, justification: 'An already-high sense of personal fulfillment is the direct psychological correlate of an Individuation process already underway -- the Self already on its way to integration', polarity: 'POSITIVE' },
  ENGAGdedicac: { behavior: 'Enthusiasm, pride, and meaning attributed to the student role', virtuePt: 'Fé', virtueEn: 'Faith', virtueOrder: 14, justification: 'Enthusiasm and meaning already attributed to the student role show an investment of identity sustained by something beyond the immediate outcome -- the already-active core of Faith', polarity: 'POSITIVE' },
  ACconfianc: { behavior: 'Self-efficacy projected onto the professional future', virtuePt: 'Otimismo', virtueEn: 'Optimism', virtueOrder: 11, justification: 'High confidence in one\'s own professional future is, by definition, an already-sustained positive expectation -- Optimism in exercise', polarity: 'POSITIVE' },
  SATISFVIDA: { behavior: 'Global affective evaluation of one\'s own life', virtuePt: 'Aceitação', virtueEn: 'Acceptance', virtueOrder: 9, justification: 'High life satisfaction is the affective portrait of already accepting life as it is -- a sign that Acceptance is already present and sustaining that positive global evaluation', polarity: 'POSITIVE' },
  HARDcompromis: { behavior: 'Engagement with values and life purpose (not just the task)', virtuePt: 'Fé', virtueEn: 'Faith', virtueOrder: 14, justification: 'High engagement with values and life purpose indicates a Faith already sustaining that long-term commitment', polarity: 'POSITIVE' },
};

/** Reads the variable<->virtue correspondence live from GDX_VT_VARIABLE_VIRTUE_MAP
 * joined to GDX_VT_VIRTUE, keyed by SAV_COLUMN -- the DB-backed replacement
 * for virtue_knowledge.js's VARIABLE_VIRTUE_MAP. Returns a plain object,
 * same shape as SAMPLE_VIRTUE_MAP above, reading JUSTIFICATION_STRENGTH
 * (this skill's strength/already-present framing -- GDX_SKILL_LINK_SUGGESTIONS
 * reads JUSTIFICATION_DEFICIT instead). Also carries SCALE_POLARITY (added by
 * variable_virtue_map_polarity_firebird25.sql) -- see rankByStrength() for
 * how it changes which end of the score range counts as the strength. */
async function fetchVirtueMap(fbDb) {
  const rows = await fbQuery(fbDb, `
    SELECT M.SAV_COLUMN AS SAV_COLUMN, M.RECORDED_BEHAVIOR AS RECORDED_BEHAVIOR,
           M.JUSTIFICATION_STRENGTH AS JUSTIFICATION_STRENGTH, M.SCALE_POLARITY AS SCALE_POLARITY,
           V.NAME_PT AS VIRTUE_NAME_PT, V.NAME_EN AS VIRTUE_NAME_EN, V.ORDER_NUM AS VIRTUE_ORDER_NUM
    FROM GDX_VT_VARIABLE_VIRTUE_MAP M
    JOIN GDX_VT_VIRTUE V ON V.ID_VIRTUE = M.ID_VIRTUE`);
  const map = {};
  for (const r of rows) {
    map[r.SAV_COLUMN] = {
      behavior: r.RECORDED_BEHAVIOR,
      virtuePt: r.VIRTUE_NAME_PT,
      virtueEn: r.VIRTUE_NAME_EN,
      virtueOrder: r.VIRTUE_ORDER_NUM,
      justification: r.JUSTIFICATION_STRENGTH,
      polarity: r.SCALE_POLARITY,
    };
  }
  return map;
}

/** A variable with no row in virtueMap yet has no recorded polarity either --
 * defaults to POSITIVE (the common case, and the ranking this skill always
 * used before SCALE_POLARITY existed), since there is no judgment call to
 * read it from. Never guessed as NEGATIVE. Identical to the sibling helper
 * in GDX_SKILL_LINK_SUGGESTIONS/scripts/generate_suggestions.js. */
function polarityOf(virtueMap, savCol) {
  const knowledge = virtueMap[savCol];
  return knowledge && knowledge.polarity === 'NEGATIVE' ? 'NEGATIVE' : 'POSITIVE';
}

/** Fetches every variable's average score for the study, unordered -- ranking
 * now happens in rankByStrength() below, once each row's polarity is known,
 * not here in SQL (a plain DESC sort would silently treat a negative-pole
 * variable's HIGH score, its actual deficit, as its biggest strength). */
async function fetchAllIndicators(fbDb, studyId) {
  return fbQuery(fbDb, `
    SELECT V.SAV_COLUMN AS SAV_COLUMN, V.NAME AS VARIABLE_NAME, L.NAME AS LEVEL_NAME,
           AVG(FR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT FR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = FR.ID_VARIABLE
    JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = FR.ID_PERSON
    WHERE FR.RAW_SCORE IS NOT NULL AND P.ID_STUDY = ?
    GROUP BY V.SAV_COLUMN, V.NAME, L.NAME`, [studyId]);
}

/** Ranks every row by how much of a strength it represents, then returns the
 * strongest `top`. For a POSITIVE-polarity variable a HIGH raw score is the
 * strength (unchanged from before this column existed); for a NEGATIVE one a
 * LOW raw score is the strength -- so its strength score is the raw score
 * negated, putting it in the same descending order as every POSITIVE row. */
function rankByStrength(rows, virtueMap, top) {
  const ranked = rows.map((row) => {
    const savCol = (row.SAV_COLUMN || '').trim();
    const polarity = polarityOf(virtueMap, savCol);
    const avgScore = Number(row.AVG_SCORE);
    const strengthScore = polarity === 'NEGATIVE' ? -avgScore : avgScore;
    return { ...row, POLARITY: polarity, STRENGTH_SCORE: strengthScore };
  });
  ranked.sort((a, b) => b.STRENGTH_SCORE - a.STRENGTH_SCORE);
  return ranked.slice(0, top);
}

function buildReport(rows, virtueMap, meta) {
  const unresolved = [];
  const lines = [];

  lines.push('# GDX_HUMAN Virtology — Virtudes em Potencial');
  lines.push('');
  lines.push(`> Generated ${meta.timestamp} by \`GDX_SKILL_IDENTIFY_VIRTUES\`.`);
  lines.push(`> Study: **${meta.studyTitle}** (slug \`${meta.studySlug}\`, \`ID_STUDY=${meta.studyId ?? '(sample)'}\`) — every score below is this one study's own average, never blended with another study's participants.`);
  lines.push(`> Source: \`7.multidimensional.database\` (\`DW_FACT_PSY_VARIABLE_RESULT\` × \`DW_DIM_VARIABLE\` × \`DW_DIM_SEPTENARY_LEVEL\` × \`DW_DIM_PERSON\`)${meta.sample ? ' — **SAMPLE DATA, not a live read**' : ` — live read from ${meta.host}`}.`);
  lines.push('> Virtue catalog: `GDX_VT_VIRTUE` × `GDX_VT_VARIABLE_VIRTUE_MAP` (Firebird, `12.gdx.virtology/virtology_model_firebird25.sql`) — 33 virtudes, institutovirtudes.com.br.');
  lines.push('>');
  lines.push('> **Natureza deste documento:** o oposto de `GDX_SKILL_LINK_SUGGESTIONS` — ali, o score');
  lines.push('> mais baixo aponta um déficit e a virtude sugerida é um alvo de tratamento; aqui, o');
  lines.push('> score mais alto é lido como um recurso/força **já presente**, e a virtude apontada é');
  lines.push('> um potencial já manifestado nesta população — mesmo julgamento conceitual');
  lines.push('> (`GDX_VT_VARIABLE_VIRTUE_MAP.JUSTIFICATION_STRENGTH`), não um achado estatístico ou');
  lines.push('> clínico. Este comando não escreve nenhum arquivo: o resultado é só o que aparece na tela.');
  lines.push('>');
  lines.push('> **Ranking consciente de polaridade.** Nem toda variável tem a mesma direção: para um');
  lines.push('> indicador de polaridade NEGATIVA (`GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY`, ex.: Emoções');
  lines.push('> Negativas), um score BAIXO é a força, não um score alto -- o oposto de todo indicador de');
  lines.push('> polaridade POSITIVA. O ranking abaixo já leva isso em conta por linha (veja a coluna');
  lines.push('> Polaridade), então "mais alto" aqui significa *mais força*, não sempre *maior número*. Uma');
  lines.push('> variável sem correspondência registrada ainda não tem polaridade registrada e assume');
  lines.push('> POSITIVA por padrão -- nunca adivinhada como NEGATIVA.');
  lines.push('');
  lines.push(`## As ${rows.length} virtudes em potencial (indicadores mais fortes)`);
  lines.push('');
  lines.push('| Indicador (nível) | Score real | Polaridade | O que mede | Virtude em potencial | Por quê |');
  lines.push('|---|---|---|---|---|---|');

  for (const row of rows) {
    const savCol = (row.SAV_COLUMN || '').trim();
    const varName = (row.VARIABLE_NAME || savCol).trim();
    const levelName = (row.LEVEL_NAME || '').trim();
    const score = Number(row.AVG_SCORE).toFixed(2);
    const polarity = row.POLARITY || polarityOf(virtueMap, savCol);
    const polarityCell = polarity === 'NEGATIVE' ? 'negativa (baixo = força)' : 'positiva (alto = força)';
    const knowledge = virtueMap[savCol];

    if (!knowledge) {
      unresolved.push(savCol || varName);
      lines.push(`| ${varName} (${levelName}) | ${score} | ${polarityCell} | — | **sem virtude identificada (revisar)** | \`${savCol}\` não está em \`GDX_VT_VARIABLE_VIRTUE_MAP\` — adicione uma linha e rode de novo |`);
      continue;
    }

    lines.push(`| ${varName} (${levelName}) | ${score} | ${polarityCell} | ${knowledge.behavior} | **${knowledge.virtuePt}** (${knowledge.virtueEn}, #${knowledge.virtueOrder}) | ${knowledge.justification} |`);
  }

  lines.push('');
  if (unresolved.length > 0) {
    lines.push(`## Indicadores sem virtude identificada (${unresolved.length})`);
    lines.push('');
    lines.push(`Sem linha em \`GDX_VT_VARIABLE_VIRTUE_MAP\` ainda: ${unresolved.map((c) => `\`${c}\``).join(', ')}. Adicione o julgamento de qual virtude se aplica e rode a skill de novo — nenhuma virtude é adivinhada automaticamente.`);
    lines.push('');
  }

  lines.push('## Ressalvas');
  lines.push('');
  lines.push('1. Score alto (ou, numa linha de polaridade negativa, baixo) aqui é um dado real do DW, mas a virtude apontada como "potencial" é uma correspondência conceitual, não uma prescrição clínica — mesmo padrão de honestidade metodológica de `SPSS_Septenary_Constitution_Mapping.md` e `GDX_SKILL_LINK_SUGGESTIONS`.');
  lines.push(`2. Amostra restrita a um único estudo (**${meta.studyTitle}**, N=${meta.maxN ?? '?'} participantes) — não generalizar os scores como normativos além dessa população.`);
  lines.push('3. Este comando é só leitura de tela: nenhum arquivo é gravado. Redirecione o stdout você mesmo (`> arquivo.md`) se precisar de um registro.');
  lines.push('4. Polaridade (`SCALE_POLARITY`) é um julgamento registrado, não inferido do nome ou da distribuição da variável — uma variável recém-mapeada assume POSITIVA até que quem registra sua linha em `GDX_VT_VARIABLE_VIRTUE_MAP` (`GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR`) a defina explicitamente.');

  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv);
  const now = new Date();

  const intake = loadIntake(args);
  let studyTitle = intake && intake.study && intake.study.title;
  if (!studyTitle) {
    if (args.sample) {
      studyTitle = 'Sample Study';
      console.log(`No intake.json found for study slug "${args.study}" -- using a generic title in --sample mode.`);
    } else {
      throw new Error(
        `intake.json not found for study slug "${args.study}". Run GDX_SKILL_NEW_STUDY (and ` +
        `GDX_SKILL_RECORD_NEW_STUDY / GDX_SKILL_LOAD_NEW_STUDY_DW) for this study first, or pass ` +
        `--intake-dir if it lives somewhere else, or --sample to try the report without a study.`
      );
    }
  }

  let rows;
  let host = null;
  let fbDb = null;
  let studyId = null;

  let virtueMap;

  if (args.sample) {
    console.log('[SAMPLE] using embedded synthetic data -- no Firebird connection.');
    virtueMap = SAMPLE_VIRTUE_MAP;
    rows = rankByStrength(SAMPLE_ROWS, virtueMap, args.top);
  } else {
    const fbOptions = {
      host: requireEnv('GDX_HUMAN_FB_HOST'),
      port: parseInt(requireEnv('GDX_HUMAN_FB_PORT'), 10),
      database: requireEnv('GDX_HUMAN_FB_DATABASE'),
      user: requireEnv('GDX_HUMAN_FB_USER'),
      password: requireEnv('GDX_HUMAN_FB_PASSWORD'),
      lowercase_keys: false,
      blobAsText: true,
    };
    host = fbOptions.host;
    console.log(`Connecting to Firebird ${fbOptions.host}:${fbOptions.port}${fbOptions.database} ...`);
    fbDb = await fbConnect(fbOptions);
    try {
      studyId = await resolveStudyId(fbDb, studyTitle, args.study);
      console.log(`Resolved study "${studyTitle}" (slug "${args.study}") -> ID_STUDY=${studyId}.`);
      virtueMap = await fetchVirtueMap(fbDb);
      const allRows = await fetchAllIndicators(fbDb, studyId);
      rows = rankByStrength(allRows, virtueMap, args.top);
    } finally {
      fbDb.detach();
    }
  }

  if (rows.length === 0) {
    console.log('No rows with both a RAW_SCORE and a septenary level were found for this study -- has the DW ETL/GDX_SKILL_LOAD_NEW_STUDY_DW been run for it?');
    return;
  }

  const report = buildReport(rows, virtueMap, {
    timestamp: now.toISOString(),
    sample: args.sample,
    host,
    studyTitle,
    studySlug: args.study,
    studyId,
    maxN: Math.max(...rows.map((r) => Number(r.N))),
  });

  console.log('\n' + report);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
