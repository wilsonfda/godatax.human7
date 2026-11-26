# GDX_HUMAN Knowledge Graph — Link Prediction Suggestions

> Generated 2026-10-18T13:15:22.315Z by `GDX_SKILL_GODATAX_HUMAN7_LINK_PRED`.
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

- **Embeddings:** Neo4j GDS FastRP, 32 dimensions, over the catalog subgraph (variables, constructs, instruments, septenary levels, chakras, Five Ways, Virtology virtues, and their mapping edges) — 50 variable nodes, 7 level nodes, 33 virtue nodes.
- **Training set (level):** 29 real `MAPS_TO_LEVEL` positive edges (materialized from `GDX_PSY_SEPT_LEVEL_PSY_MAP`) + 29 sampled non-edges, Hadamard-product features, a logistic regression trained in-process (see this file's header for why the classifier runs here instead of via `gds.beta.pipeline.linkPrediction.predict` — a real platform bug in that step's relationship-endpoint write-back was found and worked around, not a design preference).
- **Training set (virtue):** 21 real `MAPS_TO_VIRTUE` positive edges (materialized from `GDX_VT_VARIABLE_VIRTUE_MAP`) + 21 sampled non-edges — same embeddings, features, and classifier design as the level task above, trained and scored independently (own positives, own sampled negatives; a variable can be unmapped on one target and mapped on the other).
- **Independent validation, level (GDS's own pipeline, same features, different code path):** AUCPR test=0.2500, validation avg=0.7708.
- **Independent validation, virtue (GDS's own pipeline, same features, different code path):** AUCPR test=0.7500, validation avg=0.7500.
- **Small-N caveat:** 29 positive examples across 7 levels and 21 positive examples across 33 virtues are both small training sets — several levels/virtues have only 1-3 (or 0) supporting examples. Treat every score below as a triage rank, not a confident classification (same caveat the design doc raises for the original 19-example baseline).

## Ranked level suggestions for 21 unmapped variable(s)

### Organizational Anomie (hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4210 |
| 2 | Higher Mental Body (level 5) | 0.4191 |
| 3 | Atmic Body/Spirit (level 7) | 0.3483 |

### Professional/Financial Success (hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4210 |
| 2 | Higher Mental Body (level 5) | 0.4191 |
| 3 | Atmic Body/Spirit (level 7) | 0.3483 |

### Social Standing (hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4210 |
| 2 | Higher Mental Body (level 5) | 0.4191 |
| 3 | Atmic Body/Spirit (level 7) | 0.3483 |

### Red Tape (index, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Atmic Body/Spirit (level 7) | 0.4089 |
| 2 | Astral Body (level 3) | 0.3883 |
| 3 | Physical Body (level 1) | 0.3366 |

### Goal-Directed Action (OT-7, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Higher Mental Body (level 5) | 0.4035 |
| 2 | Physical Body (level 1) | 0.3608 |
| 3 | Atmic Body/Spirit (level 7) | 0.3580 |

### Self-Regulation (OT-7, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Higher Mental Body (level 5) | 0.4035 |
| 2 | Physical Body (level 1) | 0.3608 |
| 3 | Atmic Body/Spirit (level 7) | 0.3580 |

### Adaptive Persistence (OT-7, hypothesis)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Higher Mental Body (level 5) | 0.4035 |
| 2 | Physical Body (level 1) | 0.3608 |
| 3 | Atmic Body/Spirit (level 7) | 0.3580 |

### Positive Well-Being (SEES)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Lower Mental Body (level 4) | 0.4719 |
| 2 | Atmic Body/Spirit (level 7) | 0.4172 |
| 3 | Vital/Etheric Body (level 2) | 0.3231 |

### Psychological Distress (SEES)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Atmic Body/Spirit (level 7) | 0.3809 |
| 2 | Lower Mental Body (level 4) | 0.3762 |
| 3 | Higher Mental Body (level 5) | 0.3744 |

### Fatigue (SEES)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Vital/Etheric Body (level 2) | 0.3698 |
| 2 | Atmic Body/Spirit (level 7) | 0.3352 |
| 3 | Higher Mental Body (level 5) | 0.3218 |

### Affective Valence (FS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Vital/Etheric Body (level 2) | 0.4063 |
| 2 | Physical Body (level 1) | 0.3410 |
| 3 | Atmic Body/Spirit (level 7) | 0.3159 |

### Physical Activity Enjoyment (PACES)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Atmic Body/Spirit (level 7) | 0.4007 |
| 2 | Vital/Etheric Body (level 2) | 0.3587 |
| 3 | Lower Mental Body (level 4) | 0.3570 |

### Perceived Recovery Status (PRS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Astral Body (level 3) | 0.4206 |
| 2 | Higher Mental Body (level 5) | 0.3615 |
| 3 | Vital/Etheric Body (level 2) | 0.3470 |

### Perceived Exertion (Borg RPE)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Lower Mental Body (level 4) | 0.4933 |
| 2 | Buddhic Body (level 6) | 0.4400 |
| 3 | Astral Body (level 3) | 0.3784 |

### Perceived Exertion (Borg CR10)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Astral Body (level 3) | 0.4432 |
| 2 | Higher Mental Body (level 5) | 0.3880 |
| 3 | Buddhic Body (level 6) | 0.3766 |

### Tension-Anxiety (POMS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4286 |
| 2 | Atmic Body/Spirit (level 7) | 0.3752 |
| 3 | Vital/Etheric Body (level 2) | 0.3675 |

### Depression-Dejection (POMS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Atmic Body/Spirit (level 7) | 0.4131 |
| 2 | Buddhic Body (level 6) | 0.4080 |
| 3 | Higher Mental Body (level 5) | 0.3781 |

### Anger-Hostility (POMS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4621 |
| 2 | Physical Body (level 1) | 0.4457 |
| 3 | Lower Mental Body (level 4) | 0.4189 |

### Vigor-Activity (POMS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4161 |
| 2 | Vital/Etheric Body (level 2) | 0.4140 |
| 3 | Physical Body (level 1) | 0.3718 |

### Fatigue-Inertia (POMS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Atmic Body/Spirit (level 7) | 0.4379 |
| 2 | Lower Mental Body (level 4) | 0.3683 |
| 3 | Higher Mental Body (level 5) | 0.3509 |

### Confusion-Bewilderment (POMS)

| Rank | Candidate level | Probability |
|---|---|---|
| 1 | Buddhic Body (level 6) | 0.4385 |
| 2 | Astral Body (level 3) | 0.4143 |
| 3 | Higher Mental Body (level 5) | 0.4056 |

## Ranked virtue suggestions for 29 unmapped variable(s)

### Organizational Anomie (hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.3912 |
| 2 | Responsabilidade (Responsibility, #33) | 0.3771 |
| 3 | Fé (Faith, #14) | 0.3650 |

### Professional/Financial Success (hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.3912 |
| 2 | Responsabilidade (Responsibility, #33) | 0.3771 |
| 3 | Fé (Faith, #14) | 0.3650 |

### Social Standing (hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.3912 |
| 2 | Responsabilidade (Responsibility, #33) | 0.3771 |
| 3 | Fé (Faith, #14) | 0.3650 |

### Red Tape (index, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Utilidade (Utility, #31) | 0.3682 |
| 2 | Individuação (Individuation, #2) | 0.3211 |
| 3 | Tudo Somos Um (We Are All One, #15) | 0.2873 |

### Emotional Exhaustion

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Individuação (Individuation, #2) | 0.4252 |
| 2 | Flexibilidade (Flexibility, #30) | 0.4163 |
| 3 | Responsabilidade (Responsibility, #33) | 0.4031 |

### Clarity of Purpose (Grammar)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4804 |
| 2 | Eternidade (Eternity, #4) | 0.4532 |
| 3 | Gratidão (Gratitude, #18) | 0.4105 |

### Coherence Between Means and Ends (Logic)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.5044 |
| 2 | Eternidade (Eternity, #4) | 0.4388 |
| 3 | Gratidão (Gratitude, #18) | 0.3778 |

### Expression of Purpose (Rhetoric)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4758 |
| 2 | Eternidade (Eternity, #4) | 0.4321 |
| 3 | Gratidão (Gratitude, #18) | 0.3679 |

### Proportion Between Resources and Goal (Arithmetic)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4878 |
| 2 | Eternidade (Eternity, #4) | 0.4271 |
| 3 | Gratidão (Gratitude, #18) | 0.3603 |

### Structure Among Goals, Values, and Actions (Geometry)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4792 |
| 2 | Eternidade (Eternity, #4) | 0.4564 |
| 3 | Gratidão (Gratitude, #18) | 0.3892 |

### Rhythm and Continuity (Music)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.5126 |
| 2 | Eternidade (Eternity, #4) | 0.4782 |
| 3 | Humildade (Humility, #1) | 0.3933 |

### Cycles and Broader Context (Astronomy)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.4796 |
| 2 | Eternidade (Eternity, #4) | 0.4511 |
| 3 | Gratidão (Gratitude, #18) | 0.4057 |

### Goal-Directed Action (OT-7, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Perseverança (Perseverance, #10) | 0.3241 |
| 2 | Aceitação (Acceptance, #9) | 0.3036 |
| 3 | Eternidade (Eternity, #4) | 0.3026 |

### Self-Regulation (OT-7, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Perseverança (Perseverance, #10) | 0.3241 |
| 2 | Aceitação (Acceptance, #9) | 0.3036 |
| 3 | Eternidade (Eternity, #4) | 0.3026 |

### Adaptive Persistence (OT-7, hypothesis)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Perseverança (Perseverance, #10) | 0.3241 |
| 2 | Aceitação (Acceptance, #9) | 0.3036 |
| 3 | Eternidade (Eternity, #4) | 0.3026 |

### Positive Well-Being (SEES)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Eternidade (Eternity, #4) | 0.3488 |
| 2 | Responsabilidade (Responsibility, #33) | 0.3312 |
| 3 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.3251 |

### Psychological Distress (SEES)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Responsabilidade (Responsibility, #33) | 0.4847 |
| 2 | Utilidade (Utility, #31) | 0.3444 |
| 3 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.3223 |

### Fatigue (SEES)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Gratidão (Gratitude, #18) | 0.4232 |
| 2 | Eternidade (Eternity, #4) | 0.3219 |
| 3 | Perseverança (Perseverance, #10) | 0.2788 |

### Affective Valence (FS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Fé (Faith, #14) | 0.3522 |
| 2 | Individuação (Individuation, #2) | 0.3264 |
| 3 | Gratidão (Gratitude, #18) | 0.3253 |

### Physical Activity Enjoyment (PACES)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Gratidão (Gratitude, #18) | 0.3351 |
| 2 | Fé (Faith, #14) | 0.3151 |
| 3 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.3018 |

### Perceived Recovery Status (PRS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Aceitação (Acceptance, #9) | 0.4656 |
| 2 | Humildade (Humility, #1) | 0.4340 |
| 3 | Fé (Faith, #14) | 0.3526 |

### Perceived Exertion (Borg RPE)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Eternidade (Eternity, #4) | 0.4912 |
| 2 | Responsabilidade (Responsibility, #33) | 0.4139 |
| 3 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.3986 |

### Perceived Exertion (Borg CR10)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Aceitação (Acceptance, #9) | 0.3733 |
| 2 | Responsabilidade (Responsibility, #33) | 0.3674 |
| 3 | Utilidade (Utility, #31) | 0.3335 |

### Tension-Anxiety (POMS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.3861 |
| 2 | Otimismo (Optimism, #11) | 0.3482 |
| 3 | Tudo Somos Um (We Are All One, #15) | 0.3148 |

### Depression-Dejection (POMS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Fé (Faith, #14) | 0.3679 |
| 2 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.3591 |
| 3 | Eternidade (Eternity, #4) | 0.3174 |

### Anger-Hostility (POMS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Humildade (Humility, #1) | 0.3922 |
| 2 | Busca do Melhoramento (Pursuit of Improvement, #28) | 0.3848 |
| 3 | Responsabilidade (Responsibility, #33) | 0.3723 |

### Vigor-Activity (POMS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Perseverança (Perseverance, #10) | 0.4133 |
| 2 | Eternidade (Eternity, #4) | 0.4104 |
| 3 | Humildade (Humility, #1) | 0.3740 |

### Fatigue-Inertia (POMS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Responsabilidade (Responsibility, #33) | 0.3922 |
| 2 | Individuação (Individuation, #2) | 0.3853 |
| 3 | Tudo Somos Um (We Are All One, #15) | 0.3322 |

### Confusion-Bewilderment (POMS)

| Rank | Candidate virtue | Probability |
|---|---|---|
| 1 | Gratidão (Gratitude, #18) | 0.4358 |
| 2 | Flexibilidade (Flexibility, #30) | 0.3829 |
| 3 | Perseverança (Perseverance, #10) | 0.3779 |
