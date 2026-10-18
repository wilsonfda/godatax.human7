# GDX_HUMAN Knowledge Graph — Link Prediction Suggestions

> Generated 2026-10-15T22:49:56.536Z by `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`.
> Study: **Humility in Metaphysics** (slug `humildade-na-metafisica`, `ID_STUDY=3`) — the graph itself is shared catalog data (not study-scoped); this confirms the study's export exists.
> Source: Neo4j only (`9.knowledge.graph`'s knowledge graph) — this run never connected to Firebird.
> Design spec: `10.gdx.machine.learning/Septenary_Link_Prediction_and_Community_Detection.md` (Model 1).
>
> **Triage aid, not an auto-write.** These are ranked suggestions for human review — the
> accepted level suggestion still needs to be added to `GDX_SKILL_LOAD_SEPT_MAPS_DB`'s
> knowledge.js (or run through `GDX_SKILL_ASSOCIATE_CONSTRUCT_DIMENSIOS`), and the accepted
> virtue suggestion through `GDX_SKILL_ASSOCIATES_VIRTUE_TO_CONSTRUCTOR` -- each with its own
> justification, the same as every existing mapping. Nothing here writes to
> `GDX_PSY_SEPT_LEVEL_PSY_MAP` or `GDX_VT_VARIABLE_VIRTUE_MAP` automatically.

## Method

- **Embeddings:** Neo4j GDS FastRP, 32 dimensions, over the catalog subgraph (variables, constructs, instruments, septenary levels, chakras, Five Ways, Virtology virtues, and their mapping edges) — 36 variable nodes, 7 level nodes, 33 virtue nodes.
- **Training set (level):** 29 real `MAPS_TO_LEVEL` positive edges (materialized from `GDX_PSY_SEPT_LEVEL_PSY_MAP`) + 29 sampled non-edges, Hadamard-product features, a logistic regression trained in-process (see this file's header for why the classifier runs here instead of via `gds.beta.pipeline.linkPrediction.predict` — a real platform bug in that step's relationship-endpoint write-back was found and worked around, not a design preference).
- **Training set (virtue):** 21 real `MAPS_TO_VIRTUE` positive edges (materialized from `GDX_VT_VARIABLE_VIRTUE_MAP`) + 21 sampled non-edges — same embeddings, features, and classifier design as the level task above, trained and scored independently (own positives, own sampled negatives; a variable can be unmapped on one target and mapped on the other).
- **Independent validation, level (GDS's own pipeline, same features, different code path):** AUCPR test=0.7778, validation avg=0.7500.
- **Independent validation, virtue (GDS's own pipeline, same features, different code path):** AUCPR test=0.7500, validation avg=0.7500.
- **Small-N caveat:** 29 positive examples across 7 levels and 21 positive examples across 33 virtues are both small training sets — several levels/virtues have only 1-3 (or 0) supporting examples. Treat every score below as a triage rank, not a confident classification (same caveat the design doc raises for the original 19-example baseline).

## Ranked level suggestions for 7 unmapped variable(s)

### Organizational Anomie (hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4283 |
| 2 | Higher Mental Body (level 5) | 0.4160 |
| 3 | Lower Mental Body (level 4) | 0.3335 |

### Professional/Financial Success (hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4283 |
| 2 | Higher Mental Body (level 5) | 0.4160 |
| 3 | Lower Mental Body (level 4) | 0.3335 |

### Social Standing (hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4283 |
| 2 | Higher Mental Body (level 5) | 0.4160 |
| 3 | Lower Mental Body (level 4) | 0.3335 |

### Red Tape (index, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Atmic Body/Spirit (level 7) | 0.4121 |
| 2 | Astral Body (level 3) | 0.3865 |
| 3 | Physical Body (level 1) | 0.3266 |

### Goal-Directed Action (OT-7, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Higher Mental Body (level 5) | 0.3898 |
| 2 | Physical Body (level 1) | 0.3558 |
| 3 | Atmic Body/Spirit (level 7) | 0.3527 |

### Self-Regulation (OT-7, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Higher Mental Body (level 5) | 0.3898 |
| 2 | Physical Body (level 1) | 0.3558 |
| 3 | Atmic Body/Spirit (level 7) | 0.3527 |

### Adaptive Persistence (OT-7, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Higher Mental Body (level 5) | 0.3898 |
| 2 | Physical Body (level 1) | 0.3558 |
| 3 | Atmic Body/Spirit (level 7) | 0.3527 |

## Ranked virtue suggestions for 15 unmapped variable(s)

### Organizational Anomie (hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.3739 |
| 2 | Otimismo (Optimism, #11) | 0.3722 |
| 3 | Fé (Faith, #14) | 0.3637 |

### Professional/Financial Success (hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.3739 |
| 2 | Otimismo (Optimism, #11) | 0.3722 |
| 3 | Fé (Faith, #14) | 0.3637 |

### Social Standing (hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.3739 |
| 2 | Otimismo (Optimism, #11) | 0.3722 |
| 3 | Fé (Faith, #14) | 0.3637 |

### Red Tape (index, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Utilidade (Utility, #31) | 0.3745 |
| 2 | Individuação (Individuation, #2) | 0.3110 |
| 3 | Brandura (Gentleness, #3) | 0.2705 |

### Emotional Exhaustion

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.4092 |
| 2 | Flexibilidade (Flexibility, #30) | 0.3905 |
| 3 | Responsabilidade (Responsibility, #33) | 0.3773 |

### Clarity of Purpose (Grammar)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4822 |
| 2 | Eternidade (Eternity, #4) | 0.4816 |
| 3 | Gratidão (Gratitude, #18) | 0.4121 |

### Coherence Between Means and Ends (Logic)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4987 |
| 2 | Eternidade (Eternity, #4) | 0.4653 |
| 3 | Gratidão (Gratitude, #18) | 0.3820 |

### Expression of Purpose (Rhetoric)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4765 |
| 2 | Eternidade (Eternity, #4) | 0.4622 |
| 3 | Gratidão (Gratitude, #18) | 0.3708 |

### Proportion Between Resources and Goal (Arithmetic)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4828 |
| 2 | Eternidade (Eternity, #4) | 0.4555 |
| 3 | Gratidão (Gratitude, #18) | 0.3660 |

### Structure Among Goals, Values, and Actions (Geometry)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Eternidade (Eternity, #4) | 0.4776 |
| 2 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4746 |
| 3 | Gratidão (Gratitude, #18) | 0.3931 |

### Rhythm and Continuity (Music)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.5137 |
| 2 | Eternidade (Eternity, #4) | 0.5062 |
| 3 | Humildade (Humility, #1) | 0.4073 |

### Cycles and Broader Context (Astronomy)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4796 |
| 2 | Eternidade (Eternity, #4) | 0.4774 |
| 3 | Gratidão (Gratitude, #18) | 0.4086 |

### Goal-Directed Action (OT-7, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Aceitação (Acceptance, #9) | 0.3094 |
| 2 | Perseverança (Perseverance, #10) | 0.3052 |
| 3 | Fé (Faith, #14) | 0.2902 |

### Self-Regulation (OT-7, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Aceitação (Acceptance, #9) | 0.3094 |
| 2 | Perseverança (Perseverance, #10) | 0.3052 |
| 3 | Fé (Faith, #14) | 0.2902 |

### Adaptive Persistence (OT-7, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Aceitação (Acceptance, #9) | 0.3094 |
| 2 | Perseverança (Perseverance, #10) | 0.3052 |
| 3 | Fé (Faith, #14) | 0.2902 |
