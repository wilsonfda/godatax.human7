# GDX_HUMAN Knowledge Graph — Community Detection

> Generated 2026-09-19T00:01:08.059Z by `GDX_SKILL_GODATAX_HUMAN7_COMMUNITY_DETECT`.
> Study: **Predictors of Adaptability to Military Higher Education** (slug `1`, `ID_STUDY=1`) — the graph itself is shared catalog data (not study-scoped); this confirms the study's export exists.
> Source: Neo4j only (`9.knowledge.graph`'s knowledge graph) — this run never connected to Firebird.
> Design spec: `10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` (Model 2).
>
> **Structural, not causal.** These communities reflect how densely nodes are connected in
> *this* graph — itself a product of how the relational schema was built — not a psychological
> or clinical claim. A community spanning two levels is a prompt to investigate, not proof the
> septenary framework is wrong; the investigation goes back to the actual construct definitions.

## Method

- **Algorithm:** Neo4j GDS Louvain (primary, modularity-based), over the same catalog subgraph as Model 1 — variables, constructs, instruments, septenary levels, chakras, Five Ways, and their real mapping edges (no synthetic shortcut edge this time — see this file's header for why).
- **Cross-check:** Label Propagation run independently over the identical projection; for each Louvain community, the fraction of its members that also share one common Label Propagation community is reported as `lpaAgreement` — high agreement (near 1.0) means both unsupervised methods found the same structure, not just Louvain's own artifact.
- **98 nodes total, 14 non-trivial communities found** (size > 1; singleton communities omitted below — nodes with too few connections to cluster with anything are not a finding).

## Communities, read against the septenary/chakra labels

### Community 45 (11 members) — *(no septenary level in this community)*

- LPA agreement: 82%
- Instrument(s): Career Adapt-Abilities Scale
- Variable(s): Concern (Career Adaptability), Control (Career Adaptability), Curiosity (Career Adaptability), Confidence (Career Adaptability)

### Community 96 (10 members) — **matches Atmic Body/Spirit** / Sahasrara

- LPA agreement: 60%
- Instrument(s): Undocumented Organizational Block (hypothesis - an1-an11)
- Variable(s): Organizational Anomie (hypothesis), Professional/Financial Success (hypothesis), Social Standing (hypothesis), Personal Fulfillment (hypothesis)

### Community 37 (9 members) — *(no septenary level in this community)*

- LPA agreement: 100%
- Instrument(s): Student Engagement Scale
- Variable(s): Vigor (Engagement), Dedication (Engagement), Absorption (Engagement)

### Community 43 (9 members) — *(no septenary level in this community)*

- LPA agreement: 100%
- Instrument(s): Hardiness
- Variable(s): Commitment (Hardiness), Control (Hardiness), Challenge (Hardiness)

### Community 92 (9 members) — **matches Vital/Etheric Body** / Svadhisthana

- LPA agreement: 100%
- Instrument(s): Positivity Ratio Scale
- Variable(s): Positive Emotions, Negative Emotions

### Community 65 (8 members) — **matches Astral Body** / Manipura

- LPA agreement: 100%
- Instrument(s): Satisfaction With Life Scale
- Variable(s): Satisfaction With Life (index)

### Community 76 (7 members) — **matches Physical Body** / Muladhara

- LPA agreement: 100%
- Instrument(s): Maslach Burnout Inventory - Student Survey (hypothesis - unconfirmed)
- Variable(s): Emotional Exhaustion

### Community 82 (6 members) — **matches Lower Mental Body** / Anahata

- LPA agreement: 100%

### Community 84 (6 members) — **matches Higher Mental Body** / Vishuddha

- LPA agreement: 100%

### Community 66 (5 members) — *(no septenary level in this community)*

- LPA agreement: 100%
- Instrument(s): Job Satisfaction Scale
- Variable(s): Job Satisfaction (index)

### Community 69 (5 members) — *(no septenary level in this community)*

- LPA agreement: 100%
- Instrument(s): Personal Satisfaction
- Variable(s): Personal Satisfaction (index)

### Community 70 (5 members) — *(no septenary level in this community)*

- LPA agreement: 100%
- Instrument(s): Perceived Control of Life
- Variable(s): Perceived Control of Life (index)

### Community 86 (4 members) — **matches Buddhic Body** / Ajna

- LPA agreement: 100%

### Community 97 (4 members) — *(no septenary level in this community)*

- LPA agreement: 100%
- Instrument(s): Red Tape / Perceived Bureaucracy (hypothesis - red1-red5)
- Variable(s): Red Tape (index, hypothesis)

## Summary

- **7 community(ies) match exactly one septenary level** — structural evidence the septenary mapping and the graph's own connectivity agree there.
- **0 community(ies) span multiple levels** — worth a closer look at whether those levels are more related than the septenary model treats them as being, or whether the shared instrument/construct is entangling them structurally.
- **7 community(ies) have no septenary level at all** — instruments/variables whose constructs were never mapped (by design or not yet), grouped by their own instrument/construct structure alone.