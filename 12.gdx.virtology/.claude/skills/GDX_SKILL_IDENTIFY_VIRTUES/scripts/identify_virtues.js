#!/usr/bin/env node
/**
 * GDX_SKILL_IDENTIFY_VIRTUES
 *
 * The mirror image of GDX_SKILL_LINK_SUGGESTIONS: reads the real average
 * score of every psychometric variable that has a septenary-level mapping
 * (7.multidimensional.database's DW_FACT_PSY_VARIABLE_RESULT /
 * DW_DIM_VARIABLE), ranks them descending (the highest scores are read as
 * potential strengths already present), and for each one looks up a
 * corresponding virtue -- out of the 33 catalogued in
 * 12.gdx.virtology/Virtology_Knowledge_Base.md -- from the fixed judgment
 * call in scripts/virtue_knowledge.js.
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
const { virtueByPt, VARIABLE_VIRTUE_MAP } = require('./virtue_knowledge');

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

async function fetchHighestIndicators(fbDb, top, studyId) {
  const rows = await fbQuery(fbDb, `
    SELECT V.SAV_COLUMN AS SAV_COLUMN, V.NAME AS VARIABLE_NAME, L.NAME AS LEVEL_NAME,
           AVG(FR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT FR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = FR.ID_VARIABLE
    JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    JOIN DW_DIM_PERSON P ON P.ID_PERSON = FR.ID_PERSON
    WHERE FR.RAW_SCORE IS NOT NULL AND P.ID_STUDY = ?
    GROUP BY V.SAV_COLUMN, V.NAME, L.NAME
    ORDER BY AVG_SCORE DESC`, [studyId]);
  return rows.slice(0, top);
}

function buildReport(rows, meta) {
  const unresolved = [];
  const lines = [];

  lines.push('# GDX_HUMAN Virtology — Virtudes em Potencial');
  lines.push('');
  lines.push(`> Generated ${meta.timestamp} by \`GDX_SKILL_IDENTIFY_VIRTUES\`.`);
  lines.push(`> Study: **${meta.studyTitle}** (slug \`${meta.studySlug}\`, \`ID_STUDY=${meta.studyId ?? '(sample)'}\`) — every score below is this one study's own average, never blended with another study's participants.`);
  lines.push(`> Source: \`7.multidimensional.database\` (\`DW_FACT_PSY_VARIABLE_RESULT\` × \`DW_DIM_VARIABLE\` × \`DW_DIM_SEPTENARY_LEVEL\` × \`DW_DIM_PERSON\`)${meta.sample ? ' — **SAMPLE DATA, not a live read**' : ` — live read from ${meta.host}`}.`);
  lines.push('> Virtue catalog: `12.gdx.virtology/Virtology_Knowledge_Base.md` (33 virtudes, institutovirtudes.com.br).');
  lines.push('>');
  lines.push('> **Natureza deste documento:** o oposto de `GDX_SKILL_LINK_SUGGESTIONS` — ali, o score');
  lines.push('> mais baixo aponta um déficit e a virtude sugerida é um alvo de tratamento; aqui, o');
  lines.push('> score mais alto é lido como um recurso/força **já presente**, e a virtude apontada é');
  lines.push('> um potencial já manifestado nesta população — mesmo julgamento conceitual');
  lines.push('> (`virtue_knowledge.js`), não um achado estatístico ou clínico. Este comando não');
  lines.push('> escreve nenhum arquivo: o resultado é só o que aparece na tela.');
  lines.push('>');
  lines.push('> Este comando não avalia, por variável, se "score alto" é desejável (ex.: uma');
  lines.push('> variável de polo negativo, como emoções negativas, teria score alto lido como');
  lines.push('> ruim, não como força) — confira o campo "O que mede" de cada linha antes de');
  lines.push('> tratar automaticamente um score alto como algo positivo.');
  lines.push('');
  lines.push(`## As ${rows.length} virtudes em potencial (indicadores mais altos)`);
  lines.push('');
  lines.push('| Indicador (nível) | Score real | O que mede | Virtude em potencial | Por quê |');
  lines.push('|---|---|---|---|---|');

  for (const row of rows) {
    const savCol = (row.SAV_COLUMN || '').trim();
    const varName = (row.VARIABLE_NAME || savCol).trim();
    const levelName = (row.LEVEL_NAME || '').trim();
    const score = Number(row.AVG_SCORE).toFixed(2);
    const knowledge = VARIABLE_VIRTUE_MAP[savCol];

    if (!knowledge) {
      unresolved.push(savCol || varName);
      lines.push(`| ${varName} (${levelName}) | ${score} | — | **sem virtude identificada (revisar)** | \`${savCol}\` não está em \`virtue_knowledge.js\` — adicione uma entrada e rode de novo |`);
      continue;
    }

    const virtue = virtueByPt(knowledge.virtue);
    lines.push(`| ${varName} (${levelName}) | ${score} | ${knowledge.behavior} | **${virtue.pt}** (${virtue.en}, #${virtue.n}) | ${knowledge.justification} |`);
  }

  lines.push('');
  if (unresolved.length > 0) {
    lines.push(`## Indicadores sem virtude identificada (${unresolved.length})`);
    lines.push('');
    lines.push(`Sem entrada em \`virtue_knowledge.js\` ainda: ${unresolved.map((c) => `\`${c}\``).join(', ')}. Adicione o julgamento de qual virtude se aplica e rode a skill de novo — nenhuma virtude é adivinhada automaticamente.`);
    lines.push('');
  }

  lines.push('## Ressalvas');
  lines.push('');
  lines.push('1. Score alto aqui é um dado real do DW, mas a virtude apontada como "potencial" é uma correspondência conceitual, não uma prescrição clínica — mesmo padrão de honestidade metodológica de `SPSS_Septenary_Constitution_Mapping.md` e `GDX_SKILL_LINK_SUGGESTIONS`.');
  lines.push(`2. Amostra restrita a um único estudo (**${meta.studyTitle}**, N=${meta.maxN ?? '?'} participantes) — não generalizar os scores como normativos além dessa população.`);
  lines.push('3. Este comando é só leitura de tela: nenhum arquivo é gravado. Redirecione o stdout você mesmo (`> arquivo.md`) se precisar de um registro.');
  lines.push('4. Direção da escala não é avaliada por variável — para indicadores de polo negativo, "score alto" pode significar o oposto de uma força (ver nota acima).');

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

  if (args.sample) {
    console.log('[SAMPLE] using embedded synthetic data -- no Firebird connection.');
    rows = SAMPLE_ROWS.slice(0, args.top);
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
      rows = await fetchHighestIndicators(fbDb, args.top, studyId);
    } finally {
      fbDb.detach();
    }
  }

  if (rows.length === 0) {
    console.log('No rows with both a RAW_SCORE and a septenary level were found for this study -- has the DW ETL/GDX_SKILL_LOAD_NEW_STUDY_DW been run for it?');
    return;
  }

  const report = buildReport(rows, {
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
