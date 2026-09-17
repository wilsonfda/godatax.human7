#!/usr/bin/env node
/**
 * GDX_SKILL_TREATMENT_SUGGESTIONS
 *
 * Reads the real average score of every psychometric variable that has a
 * septenary-level mapping (7_multidimensional.database's
 * DW_FACT_PSY_VARIABLE_RESULT / DW_DIM_VARIABLE), ranks them ascending (the
 * lowest scores are read as the neediest indicators), and for each one looks
 * up a suggested virtue -- out of the 33 catalogued in
 * 12_gdx_virtology/Virtology_Knowledge_Base.md -- from the fixed judgment
 * call in scripts/virtue_knowledge.js.
 *
 * This is a read-only skill: it never writes to Firebird or Neo4j. Its only
 * output is a timestamped Markdown report in 12_gdx_virtology/.
 *
 * Usage:
 *   node generate_suggestions.js [--top N] [--sample] [--dry-run]
 *
 *   --top N     how many of the lowest-scoring indicators to report (default 8)
 *   --sample    use embedded synthetic data, no DB connection (offline test)
 *   --dry-run   print the report to the console only, do not write the file
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');
const { virtueByPt, VARIABLE_VIRTUE_MAP } = require('./virtue_knowledge');

const OUT_DIR = path.join(__dirname, '..', '..', '..', '..'); // .claude/skills/<name>/scripts -> 12_gdx_virtology

function parseArgs(argv) {
  const args = { top: 8, sample: false, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--top') args.top = parseInt(argv[++i], 10);
    else if (argv[i] === '--sample') args.sample = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
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
function fbQuery(db, sql) {
  return new Promise((resolve, reject) => db.query(sql, (err, result) => (err ? reject(err) : resolve(result))));
}

// Synthetic data for --sample, shaped like a real low-score slice of
// DW_FACT_PSY_VARIABLE_RESULT / DW_DIM_VARIABLE / DW_DIM_SEPTENARY_LEVEL --
// values loosely echo the real 2026-09-10 run (see chat history / dashboards)
// but are illustrative, not a live read.
const SAMPLE_ROWS = [
  { SAV_COLUMN: 'ENGAGabsorc', VARIABLE_NAME: 'Absorption', LEVEL_NAME: 'Buddhic Body', AVG_SCORE: 2.75, N: 423 },
  { SAV_COLUMN: 'HARDdesafio', VARIABLE_NAME: 'Challenge', LEVEL_NAME: 'Buddhic Body', AVG_SCORE: 2.81, N: 423 },
  { SAV_COLUMN: 'ENGAGvigor', VARIABLE_NAME: 'Vigor', LEVEL_NAME: 'Vital/Etheric Body', AVG_SCORE: 2.84, N: 423 },
  { SAV_COLUMN: 'EmocPos', VARIABLE_NAME: 'Positive Emotions', LEVEL_NAME: 'Vital/Etheric Body', AVG_SCORE: 2.86, N: 423 },
  { SAV_COLUMN: 'ACpreocup', VARIABLE_NAME: 'Concern', LEVEL_NAME: 'Buddhic Body', AVG_SCORE: 3.10, N: 423 },
  { SAV_COLUMN: 'SATISFVIDA', VARIABLE_NAME: 'Satisfaction With Life', LEVEL_NAME: 'Astral Body', AVG_SCORE: 3.61, N: 423 },
  { SAV_COLUMN: 'ACcuriosid', VARIABLE_NAME: 'Curiosity', LEVEL_NAME: 'Higher Mental Body', AVG_SCORE: 3.70, N: 423 },
  { SAV_COLUMN: 'HARDcontrole', VARIABLE_NAME: 'Control', LEVEL_NAME: 'Lower Mental Body', AVG_SCORE: 3.77, N: 423 },
];

async function fetchLowestIndicators(fbDb, top) {
  const rows = await fbQuery(fbDb, `
    SELECT V.SAV_COLUMN AS SAV_COLUMN, V.NAME AS VARIABLE_NAME, L.NAME AS LEVEL_NAME,
           AVG(FR.RAW_SCORE) AS AVG_SCORE, COUNT(*) AS N
    FROM DW_FACT_PSY_VARIABLE_RESULT FR
    JOIN DW_DIM_VARIABLE V ON V.ID_VARIABLE = FR.ID_VARIABLE
    JOIN DW_DIM_SEPTENARY_LEVEL L ON L.ID_SEPTENARY_LEVEL = V.ID_SEPTENARY_LEVEL
    WHERE FR.RAW_SCORE IS NOT NULL
    GROUP BY V.SAV_COLUMN, V.NAME, L.NAME
    ORDER BY AVG_SCORE ASC`);
  return rows.slice(0, top);
}

function buildReport(rows, meta) {
  const unresolved = [];
  const lines = [];

  lines.push('# GDX_HUMAN Virtology — Treatment Suggestions');
  lines.push('');
  lines.push(`> Generated ${meta.timestamp} by \`GDX_SKILL_TREATMENT_SUGGESTIONS\`.`);
  lines.push(`> Source: \`7_multidimensional.database\` (\`DW_FACT_PSY_VARIABLE_RESULT\` × \`DW_DIM_VARIABLE\` × \`DW_DIM_SEPTENARY_LEVEL\`)${meta.sample ? ' — **SAMPLE DATA, not a live read**' : ` — live read from ${meta.host}`}.`);
  lines.push('> Virtue catalog: `12_gdx_virtology/Virtology_Knowledge_Base.md` (33 virtudes, institutovirtudes.com.br).');
  lines.push('>');
  lines.push('> **Natureza deste documento:** leitura qualitativa/interpretativa, no mesmo espírito de');
  lines.push('> `SPSS_Septenary_Constitution_Mapping.md` — "qual virtude combate esse déficit" é um');
  lines.push('> julgamento conceitual (`virtue_knowledge.js`), não um achado estatístico ou clínico.');
  lines.push('> A lista das 33 virtudes veio de um fetch automático do site-fonte, não de leitura humana');
  lines.push('> linha a linha — ver a ressalva de confiabilidade em `Virtology_Knowledge_Base.md`.');
  lines.push('');
  lines.push(`## Os ${rows.length} indicadores psicométricos mais baixos`);
  lines.push('');
  lines.push('| Indicador (nível) | Score real | O que mede | Virtude sugerida | Por quê |');
  lines.push('|---|---|---|---|---|');

  for (const row of rows) {
    const savCol = (row.SAV_COLUMN || '').trim();
    const varName = (row.VARIABLE_NAME || savCol).trim();
    const levelName = (row.LEVEL_NAME || '').trim();
    const score = Number(row.AVG_SCORE).toFixed(2);
    const knowledge = VARIABLE_VIRTUE_MAP[savCol];

    if (!knowledge) {
      unresolved.push(savCol || varName);
      lines.push(`| ${varName} (${levelName}) | ${score} | — | **sem sugestão (revisar)** | \`${savCol}\` não está em \`virtue_knowledge.js\` — adicione uma entrada e rode de novo |`);
      continue;
    }

    const virtue = virtueByPt(knowledge.virtue);
    lines.push(`| ${varName} (${levelName}) | ${score} | ${knowledge.behavior} | **${virtue.pt}** (${virtue.en}, #${virtue.n}) | ${knowledge.justification} |`);
  }

  lines.push('');
  if (unresolved.length > 0) {
    lines.push(`## Indicadores sem sugestão (${unresolved.length})`);
    lines.push('');
    lines.push(`Sem entrada em \`virtue_knowledge.js\` ainda: ${unresolved.map((c) => `\`${c}\``).join(', ')}. Adicione o julgamento de qual virtude se aplica e rode a skill de novo — nenhuma sugestão é adivinhada automaticamente.`);
    lines.push('');
  }

  lines.push('## Ressalvas');
  lines.push('');
  lines.push('1. Score baixo aqui é um dado real do DW, mas a virtude sugerida como "tratamento" é uma correspondência conceitual, não uma prescrição clínica — mesmo padrão de honestidade metodológica de `SPSS_Septenary_Constitution_Mapping.md`.');
  lines.push('2. Amostra pequena (423 participantes, todos do mesmo estudo/instituição) — não generalizar os scores como normativos.');
  lines.push('3. Este relatório é uma fotografia do momento em que rodou; re-execute a skill depois de qualquer atualização de `godatax_human_dw_etl_firebird25.sql` para refletir dados novos.');

  return lines.join('\n') + '\n';
}

function timestampForFilename(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const now = new Date();

  let rows;
  let host = null;
  let fbDb = null;

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
      rows = await fetchLowestIndicators(fbDb, args.top);
    } finally {
      fbDb.detach();
    }
  }

  if (rows.length === 0) {
    console.log('No rows with both a RAW_SCORE and a septenary level were found -- has the DW ETL (godatax_human_dw_etl_firebird25.sql) been run?');
    return;
  }

  const report = buildReport(rows, {
    timestamp: now.toISOString(),
    sample: args.sample,
    host,
  });

  console.log('\n' + report);

  if (args.dryRun) {
    console.log('[DRY RUN] report printed above, no file written.');
    return;
  }

  const fileName = `Treatment_Suggestions_${timestampForFilename(now)}.md`;
  const filePath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(filePath, report, 'utf8');
  console.log(`Written: ${filePath}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
