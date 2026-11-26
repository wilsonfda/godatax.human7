#!/usr/bin/env node
/**
 * GDX_SKILL_CREATE_SPU_AGENT
 *
 * Guides creating (or confirming) the Neo4j Aura Agent for GDX_HUMAN7's
 * knowledge graph -- the "Agents" console step already written down in
 * 13.onboarding.env/on.bording.txt ("1.e Clique em Agents, informe o Nome,
 * Description e no prompt instruction coloque as instrucoes encontradas
 * em ...prompt.instruction.txt, escolha a opcao internal e pronto").
 *
 * Why this script cannot just create/read the Agent via API, unlike every
 * other GDX_SKILL that talks to Neo4j: as of this writing, Neo4j Aura has
 * NO management API to list, read, or create an Agent's configuration
 * (name/description/prompt/sharing scope) -- that is console-UI-only
 * (https://console.neo4j.io). The only Aura Agent API that exists lets you
 * QUERY an agent that has *already* been explicitly deployed externally
 * with its own separately-generated API key -- a paid, per-agent opt-in,
 * not something this script can assume is set up. So this script:
 *
 *   1. Verifies the underlying Neo4j Aura DATABASE instance itself is
 *      reachable (a real, API-backed check this project's neo4j-driver
 *      dependency already supports) -- this is NOT a check of the Agent,
 *      just of the graph the Agent is supposed to sit on top of.
 *   2. Prints the exact Name / Description / Prompt instruction / sharing
 *      scope to use, with the prompt read live from
 *      11.gdx.llm.agent.mcp/prompt.instruction.txt (the single source of
 *      truth -- never duplicated/hardcoded here, so this script can never
 *      drift from that file).
 *   3. Asks you, interactively, whether an Agent with that exact name
 *      already exists in the console for this instance -- the only way to
 *      answer that question today, since there is no API to check it.
 *      If yes: tells you there is nothing to do. If no: prints the
 *      step-by-step console instructions to create it with the values
 *      just shown.
 *
 * Usage:
 *   node create_spu_agent.js
 *
 * Connection: entirely from environment variables (see ../.env.example).
 * Never hardcode credentials here (same rule as every other GDX_HUMAN skill).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const neo4j = require('neo4j-driver');
const { assertAccountRegistered, AccountNotRegisteredError, NoInternetConnectionError, AccountEmailUnknownError } = require('../../../../../_shared/account_gate/check_account_registration');

const AGENT_NAME = 'GoDataX Human 7 Knowledge Graph Assistant';
const AGENT_DESCRIPTION =
  'Answers questions about the GDX_HUMAN7 knowledge graph -- psychometric ' +
  'instruments, variables and indicators, cardiac coherence/HRV, the ' +
  'sevenfold Septenary Constitution, Thomas Aquinas\'s Five Ways, Kundalini ' +
  'chakras, and Virtology virtues -- grounded in the Neo4j graph built by ' +
  'GDX_SKILL_GODATAX_HUMAN7_BY_SPU (sibling skill, this same folder).';
const AGENT_SHARING_SCOPE = 'Internal';

// Single source of truth for the prompt text: never copy/duplicate it here.
const PROMPT_INSTRUCTION_PATH = path.resolve(
  __dirname, '..', '..', '..', '..', '..', '11.gdx.llm.agent.mcp', 'prompt.instruction.txt'
);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env in this folder ` +
      `(or reuse the sibling GDX_SKILL_GODATAX_HUMAN7_BY_SPU's .env), fill it in, and export the ` +
      `vars before running this script.`
    );
  }
  return v;
}

function readPromptInstruction() {
  if (!fs.existsSync(PROMPT_INSTRUCTION_PATH)) {
    throw new Error(
      `Could not find the prompt instruction file at ${PROMPT_INSTRUCTION_PATH}. This script reads ` +
      `it live rather than hardcoding a copy -- if the file moved, update PROMPT_INSTRUCTION_PATH ` +
      `in this script to match.`
    );
  }
  return fs.readFileSync(PROMPT_INSTRUCTION_PATH, 'utf8').trim();
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function checkInstanceReachable() {
  const uri = requireEnv('NEO4J_URI');
  const user = requireEnv('NEO4J_USERNAME');
  const password = requireEnv('NEO4J_PASSWORD');
  const database = requireEnv('NEO4J_DATABASE');
  const instanceName = process.env.AURA_INSTANCENAME || database;

  console.log(`Checking that the Neo4j Aura instance "${instanceName}" (${uri}) is reachable...`);
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  try {
    await driver.verifyConnectivity();
    console.log(`Connected. This confirms the underlying database is up -- it does NOT confirm ` +
                `anything about the Agent itself (Aura has no API for that, see below).`);
  } finally {
    await driver.close();
  }
  return instanceName;
}

async function main() {
  try {
    await assertAccountRegistered();
  } catch (err) {
    console.error(err.message);
    process.exit(
      err instanceof AccountNotRegisteredError ? 2 :
      err instanceof NoInternetConnectionError ? 3 :
      err instanceof AccountEmailUnknownError ? 4 : 1
    );
  }

  let instanceName = '(unknown -- connectivity check skipped or failed)';
  try {
    instanceName = await checkInstanceReachable();
  } catch (err) {
    console.warn(`WARNING: could not verify the Neo4j instance is reachable (${err.message}). ` +
                 `Continuing anyway -- this check is a nice-to-have, not a requirement for the ` +
                 `console-side steps below.`);
  }

  const promptInstruction = readPromptInstruction();

  console.log('\n' + '='.repeat(78));
  console.log('Neo4j Aura Agent -- configuration to use');
  console.log('='.repeat(78));
  console.log(`Target instance : ${instanceName}`);
  console.log(`Name            : ${AGENT_NAME}`);
  console.log(`Description     : ${AGENT_DESCRIPTION}`);
  console.log(`Sharing scope   : ${AGENT_SHARING_SCOPE}`);
  console.log('Prompt instruction (verbatim from 11.gdx.llm.agent.mcp/prompt.instruction.txt):');
  console.log('-'.repeat(78));
  console.log(promptInstruction);
  console.log('-'.repeat(78));

  const answer = await ask(
    `\nDoes an Agent named "${AGENT_NAME}" already exist under Agents for this instance in the ` +
    `Neo4j Aura console (https://console.neo4j.io)? [y/n] `
  );

  if (/^y/i.test(answer)) {
    console.log(
      `\nNo need to create it -- "${AGENT_NAME}" already exists. If you want to double-check its ` +
      `configuration matches what is shown above (e.g. after prompt.instruction.txt changed), open ` +
      `it in the console and compare by hand -- Aura has no API to diff this automatically.`
    );
    return;
  }

  console.log(`
No existing Agent confirmed -- here is how to create it:

  1. Go to https://console.neo4j.io and open the "${instanceName}" instance.
  2. In the left-hand menu, click Agents.
  3. Click "Create Agent" -> "Create from scratch".
  4. Select "${instanceName}" as the target instance.
  5. Name: ${AGENT_NAME}
  6. Description: ${AGENT_DESCRIPTION}
  7. Prompt instruction: paste the text shown above, verbatim (it is read
     live from 11.gdx.llm.agent.mcp/prompt.instruction.txt -- edit that file,
     not this script, if the prompt ever needs to change).
  8. Sharing scope: ${AGENT_SHARING_SCOPE}.
  9. Save.

This script cannot do steps 1-9 for you -- Neo4j Aura has no API to create
an Agent, only the console UI does this today.
`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
