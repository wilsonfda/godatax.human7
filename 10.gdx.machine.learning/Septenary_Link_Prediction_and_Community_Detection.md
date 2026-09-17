# GDX_HUMAN Machine Learning on the Knowledge Graph — Two Candidate Models

> Written 2026-09-10. Location: `GDX_HUMAN/10.gdx.machine.learning/`
>
> This document details the two graph machine-learning approaches proposed
> for the knowledge graph built by `GDX_SKILL_GODATAX_HUMAN7_BY_SPU`
> (`9.knowledge.graph/`) — a Neo4j property graph mirroring the full
> `GDX_HUMAN` relational schema (folders 2–7: psychometrics, septenary
> constitution, kundalini/chakras, Aquinas's Five Ways, cardiac coherence,
> and the DW). Neither model has been implemented yet; this is the design
> document to work from when one is.

## Why the graph, and not the relational tables, is the right substrate

Both models below need one thing the relational schema doesn't give directly:
a numeric representation of a node's position in the *whole* network of
relationships around it — not just its own columns, but who it connects to,
and who those connect to. That is exactly what a **graph embedding** computes,
and it only makes sense on top of the graph shape the knowledge-graph skill
already built: `GDX_PSY_VARIABLE` sits between `GDX_PSY_CONSTRUCT`,
`GDX_PSY_SEPTENARY_LEVEL` (via `GDX_PSY_SEPT_LEVEL_PSY_MAP`), and
`GDX_PSY_VARIABLE_RESULT`/`DW_FACT_PSY_VARIABLE_RESULT`, all at once — a
relational query can join across that, but an embedding *encodes* it as a
single vector per node, which is the input both models below actually need.

Both are designed to run with **Neo4j Graph Data Science (GDS)**, the
plugin/library that ships with Neo4j Aura (including the free tier used by
this project) and operates directly on the graph written by
`GDX_SKILL_GODATAX_HUMAN7_BY_SPU` — no separate export/ETL into a
Python/pandas pipeline is required for the embedding step itself, though the
classifier stage of Model 1 does need a small amount of Python (or GDS's own
pipeline API) on top.

---

## Model 1 — Link Prediction for `GDX_PSY_SEPT_LEVEL_PSY_MAP`

### The problem this solves

`3.septenary.constitution`'s `GDX_SKILL_LOAD_SEPT_MAPS_DB` skill already
keeps `GDX_PSY_SEPT_LEVEL_PSY_MAP` in sync with `GDX_PSY_INSTRUMENT`/
`GDX_PSY_VARIABLE` — but **only** for variables a human has already made a
judgment call on, hardcoded in that skill's `scripts/knowledge.js`. As of
2026-09-10 that is 19 mappings, one per variable that has been manually
assigned a septenary level, a chakra correspondence, and a written
justification. Every new instrument or variable added to the psychometrics
schema needs the same manual judgment call before it can appear in any of
the septenary/chakra/five-ways cross-perspective views (the DW, the
dashboards in `8.gdx.dashboards`, or the knowledge graph itself).

Link prediction reframes that judgment call as a **supervised learning
problem over the graph**: given the 19 existing
`(GDX_PSY_VARIABLE) —[FK_GDX_PSY_SLPM_LEVEL]→ (GDX_PSY_SEPTENARY_LEVEL)`
edges as positive examples, and every non-existent
`(variable, level)` pair as a candidate, predict which candidate pairs are
*most likely* to be a correct — but currently missing — edge.

### How it works, step by step

1. **Feature extraction via graph embedding.** Run a node-embedding
   algorithm (Neo4j GDS's `node2vec` or `fastRP` are the two supported
   directly by GDS; `fastRP` is the cheaper, deterministic-enough choice for
   a graph this size — a few thousand nodes) over the whole in-scope
   subgraph: `GDX_PSY_VARIABLE`, `GDX_PSY_CONSTRUCT`, `GDX_PSY_INSTRUMENT`,
   `GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_CHAKRA`, `GDX_TA_WAY`, and the
   existing `GDX_PSY_SEPT_LEVEL_PSY_MAP` / `GDX_TA_WAY_SEPT_MAP` mapping
   edges. Each node gets a fixed-length vector (typically 64–128 dimensions)
   that encodes its neighborhood structure — two variables that sit under
   the same construct, or the same instrument, end up with similar vectors
   even before any level is assigned.
2. **Build the training set.** Positive examples = the 19 existing
   `GDX_PSY_VARIABLE → GDX_PSY_SEPTENARY_LEVEL` edges. Negative examples =
   sampled `(variable, level)` pairs with no edge (GDS's link-prediction
   pipeline does this sampling automatically, balancing positives/negatives).
   Each training example's feature vector is a combination (Hadamard product
   or concatenation, both supported by GDS) of the variable's and the
   level's embedding vectors.
3. **Train a binary classifier.** GDS's built-in link-prediction pipeline
   trains a logistic regression or random-forest classifier on those
   feature vectors, with the usual train/test split and, given only 19
   positives, **k-fold cross-validation is mandatory here, not optional** —
   see the caveat below.
4. **Score every candidate pair.** For every `GDX_PSY_VARIABLE` that has
   *no* existing `GDX_PSY_SEPT_LEVEL_PSY_MAP` row (i.e. every variable
   `GDX_SKILL_LOAD_SEPT_MAPS_DB` currently reports as `UNKNOWN`), score all 7
   candidate levels and rank them by predicted probability.
5. **Human review, not auto-write.** The output is a ranked suggestion list
   (`variable → top-3 candidate levels, with scores`), not a direct write to
   `GDX_PSY_SEPT_LEVEL_PSY_MAP`. A person adds the accepted suggestion to
   `knowledge.js` (with its own justification, same as today), and
   `GDX_SKILL_LOAD_SEPT_MAPS_DB` loads it exactly as it does now. The model
   accelerates the judgment call; it does not replace it.

### The honest caveat: 19 labeled examples is a small training set

This is the central risk of Model 1, not a minor footnote. With 19 positive
examples spread across 7 classes (levels), several levels have only 1–3
supporting examples (see `GoDataX_Human_7_DW.md` §2's level-by-level
breakdown: Atmic/Spirit has exactly 1 mapped variable). A classifier trained
on this little data can trivially overfit or learn spurious correlations
(e.g. "variables from instrument X always map to level Y" when X only ever
had one variable mapped so far). Mitigations, in order of how much they
change the outcome:

- **Cross-validate and report the confidence interval, not just a point
  score** — GDS's pipeline supports this natively; never trust a single
  train/test split with this few examples.
- **Treat low-confidence predictions as "no suggestion," not a weak guess.**
  A threshold (e.g. only surface predictions above 0.7 probability) keeps
  the tool from manufacturing false confidence on levels it has barely seen.
- **Grow the label set before trusting the model**, not the other way
  around. Every time `GDX_SKILL_LOAD_SEPT_MAPS_DB` gets a new hand-made
  judgment call added to `knowledge.js`, that is a new training example —
  re-run the embedding + training step periodically as the label set grows,
  the same way the DW ETL is re-run when new mappings land.
- Given the small-N risk, this model is best understood as a **triage aid**
  (rank candidates so a human reviews the top 3, not all 7) rather than a
  classifier trusted to be right unsupervised.

---

## Model 2 — Community Detection / Clustering Across the Septenary, Chakra, and Cardiac-Coherence Lenses

### The problem this solves

`8.gdx.dashboards`'s heatmaps (charts 3, 5, 6 in
`Dashboards_DW_Explanation.md`) already show, by hand-picked grouping,
*which instruments concentrate at one septenary level versus spread across
several* — e.g. the three satisfaction-family instruments (Job/Personal/Life
Satisfaction) all land purely on the Astral level, while Career
Adapt-Abilities Scale spreads across Lower Mental, Higher Mental, and
Buddhic. That observation was made by reading a heatmap. Community
detection asks the same kind of question **without a predefined grouping
key** (level, chakra, or way) — it lets the graph's own connectivity decide
what clusters together, and then those clusters can be *compared against*
the septenary/chakra/five-ways labels to see whether the philosophical
framework's groupings agree with a purely structural one, or diverge from
it in an interesting way.

### How it works, step by step

1. **Run a community-detection algorithm** over the same in-scope subgraph
   as Model 1 (variables, constructs, instruments, and their mapping edges
   to levels/chakras/ways), using Neo4j GDS's `louvain` (fast, well-suited
   to this graph's size, and produces a hierarchy of communities at
   different resolutions) or `labelPropagation` (simpler, faster, good for a
   sanity-check second opinion against Louvain's result). Both are
   unsupervised — **no labeled training data required**, which sidesteps
   Model 1's small-N problem entirely.
2. **Inspect the resulting communities.** Each node (variable, construct,
   instrument) gets a community ID. Group by community and look at which
   `GDX_PSY_SEPTENARY_LEVEL` / `GDX_PSY_CHAKRA` / `GDX_TA_WAY` labels appear
   inside each one.
3. **Compare structural clusters to the philosophical labels.** Three
   readable outcomes, each interesting for a different reason:
   - **A community matches a level/chakra almost exactly** → the
     philosophical grouping and the data's own connectivity agree; this is
     a form of external validation for that part of the septenary mapping.
   - **A community spans several levels** → either those levels are more
     related than the septenary model treats them as being, or the
     instruments/constructs feeding those variables happen to be built in a
     way that entangles them (a data artifact, not a metaphysical one) —
     the graph alone can't tell you which, but it tells you *where* to look.
   - **A level's variables split across multiple communities** → that level
     may be internally heterogeneous (grouping together psychologically
     distinct constructs under one philosophical umbrella) — a concrete,
     checkable version of the caveat `Dashboards_DW_Explanation.md` chart 2
     already raises about the Vital/Etheric and Buddhic levels being the
     project's own **least-certain** mappings (`SPECULATIVE` /
     `MEDIUM` confidence in `SPSS_Septenary_Constitution_Mapping.md`).
4. **Extend to people, once more cardiac-coherence data exists.** The same
   technique applied to `DW_DIM_PERSON` nodes (using their
   `DW_FACT_PSY_VARIABLE_RESULT` and, once populated for more than the
   current single participant, `DW_FACT_CC_HRV_WINDOW` edges) would cluster
   *people* by their combined psychometric + physiological profile, rather
   than clustering variables — this is the natural way to eventually answer
   the open question `Dashboards_DW_Explanation.md` chart 4 flags: whether
   people who register as `STRESSED` in cardiac-coherence sessions actually
   score differently on constructs like Hardiness than people who register
   `RELAXED`. That extension needs more participants with both data sources
   before it produces anything statistically meaningful (today only
   `SPSS-784` has both).

### The honest caveat: clusters are structural, not causal or diagnostic

Community detection groups nodes by **how densely they're connected in this
specific graph** — which is itself a product of how the relational schema
was designed (which instrument's constructs point to which variables, which
variables got a `GDX_PSY_SEPT_LEVEL_PSY_MAP` row at all) as much as it is a
reflection of anything psychological. A cluster crossing two septenary
levels is a *prompt to investigate*, not a finding that the septenary model
is wrong — the investigation has to go back to the actual construct
definitions and instrument content (the same kind of manual reasoning
`SPSS_Septenary_Constitution_Mapping.md` already documents) to tell a real
insight apart from a schema artifact.

---

## Model comparison

| | Model 1 — Link Prediction | Model 2 — Community Detection |
|---|---|---|
| **Question it answers** | "Which septenary level should this *new* variable most likely map to?" | "Do variables/instruments naturally group the way the septenary/chakra/five-ways framework says they should?" |
| **Learning type** | Supervised (needs labeled positive examples) | Unsupervised (no labels needed) |
| **Training data available today** | 19 mapped variables — small, uneven across the 7 levels | None needed — runs on the graph as-is |
| **Main risk** | Overfitting / false confidence from too few examples | Structural clusters conflated with psychological/metaphysical meaning |
| **Output** | Ranked level suggestions per unmapped variable, for human review | Cluster assignments per node, for human interpretation against existing labels |
| **Where it plugs in** | Feeds candidate rows into `GDX_SKILL_LOAD_SEPT_MAPS_DB`'s `knowledge.js` review step | A new read-only analysis (could become a 7th dashboard chart type in `8.gdx.dashboards`) |
| **GDS algorithm** | `fastRP` (embeddings) + built-in link-prediction pipeline | `louvain` (primary) + `labelPropagation` (cross-check) |

## Suggested order of implementation

Community detection (Model 2) first: it needs no labeled data, runs
immediately on the graph `GDX_SKILL_GODATAX_HUMAN7_BY_SPU` already
populates, and its output is a direct, low-risk extension of the
cross-perspective reading `8.gdx.dashboards`'s heatmaps already do by hand.
Link prediction (Model 1) is more valuable long-term — it is the piece that
would actually reduce manual work in `GDX_SKILL_LOAD_SEPT_MAPS_DB` — but it
is only trustworthy once the labeled set grows past today's 19 examples, so
it is the better second step, revisited as more mappings accumulate.
