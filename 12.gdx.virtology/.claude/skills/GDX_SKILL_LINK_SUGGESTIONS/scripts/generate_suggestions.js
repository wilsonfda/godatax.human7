#!/usr/bin/env node
/**
 * GDX_SKILL_TREATMENT_SUGGESTIONS
 *
 * Reads the real average score of every psychometric variable that has a
 * septenary-level mapping (7.multidimensional.database's
 * DW_FACT_PSY_VARIABLE_RESULT / DW_DIM_VARIABLE), ranks them by how much of a
 * deficit each one represents (the neediest indicators first), and for each
 * one looks up a suggested virtue -- out of the 33 catalogued in
 * 12.gdx.virtology/Virtology_Knowledge_Base.md -- from GDX_VT_VARIABLE_VIRTUE_MAP
 * joined to GDX_VT_VIRTUE in Firebird (12.gdx.virtology/virtology_model_firebird25.sql),
 * reading the JUSTIFICATION_DEFICIT column (this skill's deficit/antidote framing).
 *
 * 2026-10-18: "neediest" is no longer always "lowest raw score". Most
 * variables are POSITIVE polarity (low score = deficit), but a NEGATIVE one
 * (e.g. Negative Emotions) has it backwards -- a HIGH score is the deficit.
 * GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY (variable_virtue_map_polarity_firebird25.sql)
 * records this per variable; rankByDeficit() reads it and ranks accordingly.
 *
 * 2026-10-15: switched from requiring scripts/virtue_knowledge.js (a
 * code-only, hand-written JS map) to this live DB read -- the table is now
 * the source of truth for this skill. virtue_knowledge.js still exists (two
 * copies, one per sibling skill) only because GDX_SKILL_LIST_ASSOCIATIONS's
 * code-vs-database sync check still reads both of them directly; it is no
 * longer required by this script.
 *
 * This is a read-only skill: it never writes to Firebird or Neo4j. Its only
 * output is a timestamped Markdown report in 12.gdx.virtology/.
 *
 * Usage:
 *   node generate_suggestions.js --study <slug> [--top N] [--sample] [--dry-run] [--intake-dir <path>]
 *
 *   --study <slug>  REQUIRED. Same slug GDX_SKILL_NEW_STUDY/GDX_SKILL_MAKE_DASHBOARS_DW/
 *                   GDX_SKILL_LOAD_NEW_STUDY_DW use for new_study_intake/<slug>/intake.json --
 *                   resolves to GDX_PSY_STUDY.ID_STUDY, and every ranked indicator is this one
 *                   study's own average, never blended with another study's participants.
 *   --top N         how many of the lowest-scoring indicators to report (default 8)
 *   --sample        use embedded synthetic data, no DB connection (offline test) -- a missing
 *                   intake.json is not an error in this mode, same as the other --study skills
 *   --dry-run       print the report to the console only, do not write the file
 *   --intake-dir    override the default new_study_intake/<slug>/ location
 */

const fs = require('fs');
const path = require('path');
const Firebird = require('node-firebird');

const OUT_DIR = path.join(__dirname, '..', '..', '..', '..'); // .claude/skills/<name>/scripts -> 12.gdx.virtology

function parseArgs(argv) {
  const args = { top: 8, sample: false, dryRun: false, study: null, intakeDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--top') args.top = parseInt(argv[++i], 10);
    else if (argv[i] === '--sample') args.sample = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
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
 * relative to this script (12.gdx.virtology/.claude/skills/GDX_SKILL_TREATMENT_SUGGESTIONS/scripts)
 * -- same depth/pattern as the other --study-scoped skills' resolveIntakePath(). */
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

// Synthetic virtue-map data for --sample (no DB connection), covering exactly
// the SAV_COLUMNs used in SAMPLE_ROWS above -- values mirror the real rows in
// GDX_VT_VARIABLE_VIRTUE_MAP (virtology_model_firebird25.sql) as of 2026-10-15.
// All POSITIVE polarity -- none of SAMPLE_ROWS is a negative-pole variable
// (see polarityOf()/rankByDeficit() below for how a NEGATIVE row would rank).
const SAMPLE_VIRTUE_MAP = {
  ENGAGabsorc: { behavior: 'Flow state, losing track of time while studying', virtuePt: 'Tudo Somos Um', virtueEn: 'We Are All One', virtueOrder: 15, justification: 'The literature describes absorption/flow as a dissolution of the subject-object boundary -- resonating directly with this virtue\'s theme of unity/interconnection', polarity: 'POSITIVE' },
  HARDdesafio: { behavior: 'Ability to draw meaning and growth from adversity', virtuePt: 'Busca do Melhoramento', virtueEn: 'Pursuit of Improvement', virtueOrder: 28, justification: 'It is literally the virtue\'s definition: facing difficulty as an opportunity for growth, echoing Frankl (purpose), cited by Virtology itself', polarity: 'POSITIVE' },
  ENGAGvigor: { behavior: 'Disposition and energy to invest effort in studying', virtuePt: 'Perseverança', virtueEn: 'Perseverance', virtueOrder: 10, justification: 'Low vigor is depletion of sustained energy -- Perseverance is the practice of maintaining effort despite wear, a direct antidote for the drop in disposition', polarity: 'POSITIVE' },
  EmocPos: { behavior: 'Repertoire of positive emotions (joy, interest, hope)', virtuePt: 'Gratidão', virtueEn: 'Gratitude', virtueOrder: 18, justification: 'It is the instrument\'s own theoretical basis (Positivity Ratio / Fredrickson, broaden-and-build): gratitude is the most documented lever for raising positive emotion', polarity: 'POSITIVE' },
  ACpreocup: { behavior: 'Future orientation with a sense of existential continuity', virtuePt: 'Eternidade', virtueEn: 'Eternity', virtueOrder: 4, justification: '"Concern" in Savickas\'s sense is an integrated temporal outlook -- the virtue that explicitly deals with a perspective beyond the immediate is the closest match', polarity: 'POSITIVE' },
  SATISFVIDA: { behavior: 'Global affective evaluation of one\'s own life', virtuePt: 'Aceitação', virtueEn: 'Acceptance', virtueOrder: 9, justification: 'Satisfaction with life as a whole depends on accepting life as it is today, not just changing circumstances -- Acceptance attacks the root of the negative global judgment', polarity: 'POSITIVE' },
  ACcuriosid: { behavior: 'Exploring alternatives, openness to possibilities', virtuePt: 'Flexibilidade', virtueEn: 'Flexibility', virtueOrder: 30, justification: 'Low curiosity is, in practice, rigidity in the face of the unknown -- Flexibility is the direct antidote', polarity: 'POSITIVE' },
  HARDcontrole: { behavior: 'Belief in being able to influence everyday events', virtuePt: 'Responsabilidade', virtueEn: 'Responsibility', virtueOrder: 33, justification: 'Low perceived control improves by training the active assumption of responsibility over what is actually within the person\'s reach', polarity: 'POSITIVE' },
};

/** Reads the variable<->virtue correspondence live from GDX_VT_VARIABLE_VIRTUE_MAP
 * joined to GDX_VT_VIRTUE, keyed by SAV_COLUMN -- the DB-backed replacement
 * for virtue_knowledge.js's VARIABLE_VIRTUE_MAP. Returns a plain object,
 * same shape as SAMPLE_VIRTUE_MAP above, reading JUSTIFICATION_DEFICIT (this
 * skill's deficit/antidote framing -- GDX_SKILL_IDENTIFY_VIRTUES reads
 * JUSTIFICATION_STRENGTH instead). Also carries SCALE_POLARITY (added by
 * variable_virtue_map_polarity_firebird25.sql) -- see rankByDeficit() for how
 * it changes which end of the score range counts as the deficit. */
async function fetchVirtueMap(fbDb) {
  const rows = await fbQuery(fbDb, `
    SELECT M.SAV_COLUMN AS SAV_COLUMN, M.RECORDED_BEHAVIOR AS RECORDED_BEHAVIOR,
           M.JUSTIFICATION_DEFICIT AS JUSTIFICATION_DEFICIT, M.SCALE_POLARITY AS SCALE_POLARITY,
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
      justification: r.JUSTIFICATION_DEFICIT,
      polarity: r.SCALE_POLARITY,
    };
  }
  return map;
}

/** A variable with no row in virtueMap yet has no recorded polarity either --
 * defaults to POSITIVE (the common case, and the ranking this skill always
 * used before SCALE_POLARITY existed), since there is no judgment call to
 * read it from. Never guessed as NEGATIVE. */
function polarityOf(virtueMap, savCol) {
  const knowledge = virtueMap[savCol];
  return knowledge && knowledge.polarity === 'NEGATIVE' ? 'NEGATIVE' : 'POSITIVE';
}

/** Fetches every variable's average score for the study, unordered -- ranking
 * now happens in rankByDeficit() below, once each row's polarity is known,
 * not here in SQL (a plain ASC sort would silently treat a negative-pole
 * variable's HIGH score, its actual deficit, as its best score). */
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

/** Ranks every row by how much of a deficit it represents, then returns the
 * neediest `top`. For a POSITIVE-polarity variable a LOW raw score is the
 * deficit (unchanged from before this column existed); for a NEGATIVE one a
 * HIGH raw score is the deficit -- so its need score is the raw score
 * negated, putting it in the same ascending order as every POSITIVE row. */
function rankByDeficit(rows, virtueMap, top) {
  const ranked = rows.map((row) => {
    const savCol = (row.SAV_COLUMN || '').trim();
    const polarity = polarityOf(virtueMap, savCol);
    const avgScore = Number(row.AVG_SCORE);
    const needScore = polarity === 'NEGATIVE' ? -avgScore : avgScore;
    return { ...row, POLARITY: polarity, NEED_SCORE: needScore };
  });
  ranked.sort((a, b) => a.NEED_SCORE - b.NEED_SCORE);
  return ranked.slice(0, top);
}

function buildReport(rows, virtueMap, meta) {
  const unresolved = [];
  const lines = [];

  lines.push('# GDX_HUMAN Virtology — Treatment Suggestions');
  lines.push('');
  lines.push(`> Generated ${meta.timestamp} by \`GDX_SKILL_TREATMENT_SUGGESTIONS\`.`);
  lines.push(`> Study: **${meta.studyTitle}** (slug \`${meta.studySlug}\`, \`ID_STUDY=${meta.studyId ?? '(sample)'}\`) — every score below is this one study's own average, never blended with another study's participants.`);
  lines.push(`> Source: \`7.multidimensional.database\` (\`DW_FACT_PSY_VARIABLE_RESULT\` × \`DW_DIM_VARIABLE\` × \`DW_DIM_SEPTENARY_LEVEL\` × \`DW_DIM_PERSON\`)${meta.sample ? ' — **SAMPLE DATA, not a live read**' : ` — live read from ${meta.host}`}.`);
  lines.push('> Virtue catalog: `GDX_VT_VIRTUE` × `GDX_VT_VARIABLE_VIRTUE_MAP` (Firebird, `12.gdx.virtology/virtology_model_firebird25.sql`) — 33 virtues, institutovirtudes.com.br.');
  lines.push('>');
  lines.push('> **Nature of this document:** a qualitative/interpretive reading, in the same spirit as');
  lines.push('> `SPSS_Septenary_Constitution_Mapping.md` — "which virtue counters this deficit" is a');
  lines.push('> conceptual judgment call (`GDX_VT_VARIABLE_VIRTUE_MAP.JUSTIFICATION_DEFICIT`), not a');
  lines.push('> statistical or clinical finding.');
  lines.push('>');
  lines.push('> **Polarity-aware ranking.** Not every variable shares the same direction: for a');
  lines.push('> NEGATIVE-polarity indicator (`GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY`, e.g. Negative');
  lines.push('> Emotions), a HIGH score is the deficit, not a low one -- the opposite of every');
  lines.push('> POSITIVE-polarity indicator. The ranking below already accounts for this per row (see the');
  lines.push('> Polarity column), so "lowest" here means *neediest*, not always *smallest number*. A');
  lines.push('> variable with no recorded correspondence yet has no recorded polarity either and defaults');
  lines.push('> to POSITIVE -- never guessed as NEGATIVE.');
  lines.push('');
  lines.push(`## The ${rows.length} neediest psychometric indicators`);
  lines.push('');
  lines.push('| Indicator (level) | Real score | Polarity | What it measures | Suggested virtue | Why |');
  lines.push('|---|---|---|---|---|---|');

  for (const row of rows) {
    const savCol = (row.SAV_COLUMN || '').trim();
    const varName = (row.VARIABLE_NAME || savCol).trim();
    const levelName = (row.LEVEL_NAME || '').trim();
    const score = Number(row.AVG_SCORE).toFixed(2);
    const polarity = row.POLARITY || polarityOf(virtueMap, savCol);
    const polarityCell = polarity === 'NEGATIVE' ? 'negative (high = deficit)' : 'positive (low = deficit)';
    const knowledge = virtueMap[savCol];

    if (!knowledge) {
      unresolved.push(savCol || varName);
      lines.push(`| ${varName} (${levelName}) | ${score} | ${polarityCell} | — | **no suggestion (review)** | \`${savCol}\` is not in \`GDX_VT_VARIABLE_VIRTUE_MAP\` — add a row and run again |`);
      continue;
    }

    lines.push(`| ${varName} (${levelName}) | ${score} | ${polarityCell} | ${knowledge.behavior} | **${knowledge.virtuePt}** (${knowledge.virtueEn}, #${knowledge.virtueOrder}) | ${knowledge.justification} |`);
  }

  lines.push('');
  if (unresolved.length > 0) {
    lines.push(`## Indicators with no suggestion (${unresolved.length})`);
    lines.push('');
    lines.push(`No row yet in \`GDX_VT_VARIABLE_VIRTUE_MAP\`: ${unresolved.map((c) => `\`${c}\``).join(', ')}. Add the judgment call for which virtue applies and run the skill again — no suggestion is ever guessed automatically.`);
    lines.push('');
  }

  lines.push('## Caveats');
  lines.push('');
  lines.push('1. The low (or, for a negative-polarity row, high) score here is real DW data, but the virtue suggested as "treatment" is a conceptual correspondence, not a clinical prescription — the same methodological honesty standard as `SPSS_Septenary_Constitution_Mapping.md`.');
  lines.push(`2. Sample restricted to a single study (**${meta.studyTitle}**, N=${meta.maxN ?? '?'} participants) — do not generalize the scores as normative beyond this population.`);
  lines.push('3. This report is a snapshot of the moment it ran; re-run the skill after any update to `godatax_human_dw_etl_firebird25.sql` to reflect new data.');
  lines.push('4. Polarity (`SCALE_POLARITY`) is a recorded judgment call, not inferred from the variable\'s name or distribution — a newly-mapped variable defaults to POSITIVE until whoever records its `GDX_VT_VARIABLE_VIRTUE_MAP` row (`GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR`) sets it explicitly.');

  return lines.join('\n') + '\n';
}

function timestampForFilename(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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
    rows = rankByDeficit(SAMPLE_ROWS, virtueMap, args.top);
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
      rows = rankByDeficit(allRows, virtueMap, args.top);
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

  if (args.dryRun) {
    console.log('[DRY RUN] report printed above, no file written.');
    return;
  }

  const fileName = `Treatment_Suggestions_${args.study}_${timestampForFilename(now)}.md`;
  const filePath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(filePath, report, 'utf8');
  console.log(`Written: ${filePath}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
