---
name: GDX_SKILL_CREATE_SPU_AGENT
description: Guides creating (or confirming) the Neo4j Aura Agent for GDX_HUMAN7's knowledge graph -- checks the target Aura instance is reachable, then shows the exact Name/Description/Prompt instruction (read live from 11.gdx.llm.agent.mcp/prompt.instruction.txt)/sharing scope to use, and asks whether an Agent with that name already exists. Neo4j Aura has no management API to list, read, or create an Agent's configuration (console-UI-only), so this skill verifies what it actually can (instance connectivity) and otherwise guides a human through the console steps -- it never fabricates an "already created" or "successfully created" result it cannot confirm. Use when the user asks to set up, verify, or recreate the project's Neo4j Aura Agent (the "1.e" step in 13.onboarding.env/on.bording.txt).
---

# GDX_SKILL_CREATE_SPU_AGENT

Before doing any real work, this skill checks that the logged-in Claude account's email is registered in `GDX_EAD_USERS` on `firebird.godatax.com` (see `_shared/account_gate/` and `GDX_HUMAN7_DEVELOPMENT_KIT.md` §11) — not registered tells you to register at the GoDataX.Com portal, and `firebird.godatax.com` unreachable stops with a no-connection error.

Mirrors step "1.e" of `13.onboarding.env/on.bording.txt` ("Clique em Agents, informe o Nome,
Description e no prompt instruction coloque as instrucoes encontradas em
...prompt.instruction.txt, escolha a opcao internal e pronto") as a runnable script, the same way
`OnBoard_GDXH7ph.ps1` turned the rest of that checklist into automation.

## Why this skill cannot just create (or read back) the Agent via API

Every other GDX_SKILL that talks to Neo4j (`GDX_SKILL_GODATAX_HUMAN7_BY_SPU`) does real work through
the Bolt driver, because graph nodes/relationships are genuinely API-accessible. **Neo4j Aura Agents
are not** — as of this writing, Aura has no management API to list, read, or create an Agent's
configuration (name, description, prompt instruction, sharing scope). That is a console-UI-only
feature (`https://console.neo4j.io` → an instance → Agents). The only Aura Agent API that exists lets
you *query* an agent that has already been explicitly "deployed externally" with its own
separately-generated API key — a paid, per-agent opt-in this skill cannot assume is set up, and even
that API only lets you ask the agent a question, not read back its own configuration.

Given that constraint, this skill does exactly what it honestly can:

1. **Verifies the underlying Neo4j Aura *database* instance is reachable** (`driver.verifyConnectivity()`
   — a real, API-backed check). This confirms the graph the Agent is supposed to sit on top of is up;
   it says nothing about the Agent itself, and the script says so explicitly.
2. **Prints the exact Name / Description / Prompt instruction / sharing scope to use** — the prompt is
   read live from `11.gdx.llm.agent.mcp/prompt.instruction.txt` (the single source of truth), never
   duplicated/hardcoded, so this skill can never drift from that file if it changes.
3. **Asks you, interactively**, whether an Agent with that exact name already exists in the console for
   this instance — the only way to answer that question today. If yes, it tells you there is nothing
   to do. If no, it prints the step-by-step console instructions to create it with the values just
   shown.

**Agent name already in use, per the live instance checked while building this skill:**
`GoDataX Human 7 Knowledge Graph Assistant` (the first line of `prompt.instruction.txt`, confirmed
against the `a6a03aab` / `GoDataXh7` instance). If your instance's Agent uses a different name, update
`AGENT_NAME` in `scripts/create_spu_agent.js` to match — this skill cannot discover that name for you
for the same console-API reason described above.

## Running it

```
cd 9.knowledge.graph/.claude/skills/GDX_SKILL_CREATE_SPU_AGENT/scripts
npm install                 # once, installs neo4j-driver
# copy ../.env.example to ../.env and fill in the NEO4J_* values (reuse the
# sibling GDX_SKILL_GODATAX_HUMAN7_BY_SPU's .env if you already have one),
# or export the vars directly
node create_spu_agent.js
```

The script asks one question in your terminal (`[y/n]`) — answer it based on what you actually see
in the console's Agents tab, not a guess.

## What it will never do

- **Never claims to have created or verified the Agent itself.** The only Agent-related fact this
  skill reports is literally your own typed `y`/`n` answer reflected back to you — it does not, and
  currently cannot, independently confirm either outcome via any API.
- **Never hardcodes or duplicates the prompt text.** It is always read live from
  `11.gdx.llm.agent.mcp/prompt.instruction.txt`; editing that file is how you change the prompt, not
  editing this skill.
- **Never hardcodes Neo4j credentials.** Connection comes from environment variables only (see
  `.env.example`) — per `CLAUDE.md`, this applies even as an "overridable default."
- **Never fails the whole run just because the instance connectivity check fails.** That check is a
  nice-to-have (confirms the graph is up); a failure there is reported as a warning and the
  console-guidance part of the script still runs.

## Files in this skill

- `scripts/create_spu_agent.js` — connectivity check + prompt readout + interactive y/n + console
  instructions (Node.js + `neo4j-driver`, no native client library required)
- `scripts/package.json`
- `.env.example` — connection variable template (no secrets)
