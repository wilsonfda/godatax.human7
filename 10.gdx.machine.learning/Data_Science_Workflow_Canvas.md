# Data Science Workflow Canvas — Model 1 & Model 2

> Written 2026-09-14. Location: `GDX_HUMAN/10.gdx.machine.learning/`
>
> Both canvases below use the `2 - Template 5 - Data Science Workflow Canvas`
> template from `GDX_STRATEGIC_DISCOVERY/`, filled in for the two graph
> machine-learning models scoped in
> [`Septenary_Link_Prediction_and_Community_Detection.md`](Septenary_Link_Prediction_and_Community_Detection.md)
> (that document is the full design spec — algorithms, caveats, honest
> small-N risk assessment; this one is the one-page-per-model canvas summary
> plus the explanation now published on the GoDataX website, blog post
> "GoDataX Human 7", section 07, directly below the knowledge-graph figure).

---

## Canvas — Model 1: Link Prediction

**Suggesting missing septenary-level mappings from the knowledge graph**

| # | Field | Content |
|---|---|---|
| 1 | **Problem Statement** | Most psychometric variables in the graph already have a `VARIABLE→LEVEL` mapping, but every new variable added lands as "UNKNOWN" and reviewing each one by hand against all 7 septenary levels doesn't scale. |
| 2 | **Outcomes/Predictions** | For every "UNKNOWN" `VARIABLE` node, a ranked top-3 list of candidate `SEPTENARY_LEVEL` targets with scores — not a single hard label. |
| 3 | **Data Acquisition** | The Human 7 knowledge graph itself: 55 relational tables as nodes, 70 foreign keys as edges, with the existing `VARIABLE→LEVEL` mappings as ground-truth positives. |
| 4 | **Modeling** | Neo4j GDS **FastRP** node embeddings (each node → a vector encoding its neighborhood) feed a classifier trained on existing mappings as positives vs. sampled non-edges as negatives. |
| 5 | **Model Evaluation** | Cross-validate against the existing labeled mappings and surface only high-confidence predictions. Treated as a triage aid that ranks candidates for human review, not a classifier that replaces the judgment call. |
| 6 | **Data Preparation** | Build FastRP embeddings for every `VARIABLE` and `SEPTENARY_LEVEL` node, then assemble the positive/sampled-negative edge training set from the existing mapping table. |

**✅ Activation:** Problem Statement → Data Acquisition → Data Prep → Modeling → Outcomes/Preds → Model Eval → **Human Review** (the accepted suggestion is added to `knowledge.js` with justification — the model suggests, a person decides).

---

## Canvas — Model 2: Community Detection

**Do structural clusters agree with the septenary / chakra framework?**

| # | Field | Content |
|---|---|---|
| 1 | **Problem Statement** | The septenary/chakra level assignments were built by hand, one mapping decision at a time. Is there any independent, structural evidence in the graph itself that those groupings hold together? |
| 2 | **Outcomes/Predictions** | No target label is predicted. The output is an unsupervised grouping of nodes into structural communities, to be compared visually against the existing septenary/chakra level colors. |
| 3 | **Data Acquisition** | The same Human 7 knowledge graph as Model 1 (55 nodes, 70 edges) — this pass runs with no labels used, so no mapping table is pulled in as training data. |
| 4 | **Modeling** | Neo4j GDS **Louvain** community detection: unsupervised, modularity-based clustering that groups densely-connected nodes into communities (Community X · Y · Z…). |
| 5 | **Model Evaluation** | **Match** — a community that is one solid level/chakra color validates that part of the mapping. **Mismatch** — a community spanning two levels, or a level split across two communities, is a prompt to revisit the construct definitions, not proof the framework is wrong. Clusters are structural, not causal. |
| 6 | **Data Preparation** | Reuse the same graph projection built for Model 1; no positive/negative edge sampling is needed since Louvain runs unsupervised on graph structure alone. |

**✅ Activation:** Problem Statement → Data Acquisition → Data Prep → Modeling → Outcomes/Preds → Model Eval, then color the resulting communities by septenary/chakra level and read off matches vs. mismatches.

---

## Where this is published

Both canvases above, in the same wording, are rendered as HTML on the
GoDataX website — `blog-details-ai-measuring-instrument-human-evolution.html`,
section 07 ("GoDataX Human 7 Knowledge Graph & Machine Learning"),
immediately below the knowledge-graph figure. The website version uses a
2×3 CSS grid styled to match the original template's layout (numbered
circles, title bar, colored Activation footer); the content of each cell
is unchanged from the tables above.

For the full algorithmic detail, the 19-example small-N caveat on Model 1,
and the "structural not causal" caveat on Model 2, see
[`Septenary_Link_Prediction_and_Community_Detection.md`](Septenary_Link_Prediction_and_Community_Detection.md).
