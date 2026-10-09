# GDX_HUMAN — Conceptual Associations Between Perspectives

> Generated 2026-10-09T21:41:23.973Z by `GDX_SKILL_LIST_ASSOCIATIONS`.
> Scope: the whole framework — **not** per study. Every row below is catalog/reference data (or code), the same for any study.
> Source: DDL from `3.septenary.constitution`, `4.kundalini.chakras`, `5.five.ways.tomas.aquino`, `2.relational.model.psychometrics`, `7.multidimensional.database` — live read from localhost, plus the two `virtue_knowledge.js` files in `12.gdx.virtology` (those never touch Firebird).
>
> **Two kinds of association, by design, never silently mixed:**
> - **DATABASE (Firebird):** exists as a real table row, most with a `CONFIDENCE_LEVEL` column (`HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`) filled in by whoever wrote the load.
> - **CODE:** lives only in `.js` files inside `12.gdx.virtology`'s skills, was never persisted to Firebird or Neo4j, and has no confidence field at all.
> This command does not judge whether a correspondence is "correct" — it only lists what has already been decided somewhere in the framework, with the justification that already existed, and flags where the decision has no recorded confidence level.

## 1. Kundalini Chakras ↔ Septenary Constitution

Source: `GDX_PSY_CHAKRA` (4.kundalini.chakras) × `GDX_PSY_SEPTENARY_LEVEL` (3.septenary.constitution) — **DATABASE**, 7 of 7 chakras.

**Note:** this table has no `CONFIDENCE_LEVEL` column (unlike the following two) — the load script's header (`chakras_model_firebird25.sql`) treats the whole correspondence as "symbolic/interpretive, not an empirical finding," with no per-row grade.

| Order | Chakra | Septenary Level | Justification |
|---|---|---|---|
| 1 | Muladhara (Root Chakra) | #1 Physical Body | Corresponds to the Physical Body (level 1) - both govern the material/instinctive base of existence |
| 2 | Svadhisthana (Sacral Chakra) | #2 Vital/Etheric Body | Corresponds to the Vital/Etheric Body (level 2) - both govern the vital energy that sustains and moves the physical body |
| 3 | Manipura (Solar Plexus Chakra) | #3 Astral Body | Corresponds to the Astral Body (level 3) - both govern emotions, desires and the affective charge tied to personal identity |
| 4 | Anahata (Heart Chakra) | #4 Lower Mental Body | Corresponds to the Lower Mental Body (level 4) - the first center where experience begins to be processed in a relational/concrete-cognitive way, not merely reactive |
| 5 | Vishuddha (Throat Chakra) | #5 Higher Mental Body | Corresponds to the Higher Mental Body (level 5) - expressing/articulating values and identity is a function of the abstract mind |
| 6 | Ajna (Third Eye Chakra) | #6 Buddhic Body | Corresponds to the Buddhic Body (level 6) - intuition and direct perception of meaning, unmediated by reasoning, is the classic function attributed to both |
| 7 | Sahasrara (Crown Chakra) | #7 Atmic Body/Spirit | Corresponds to the Atmic Body/Spirit (level 7) - both represent the top of the ladder of consciousness, transcendent will and ultimate purpose |

## 2. The Five Ways (Aquinas) ↔ Septenary Constitution

Source: `GDX_TA_WAY_SEPT_MAP` (5.five.ways.tomas.aquino) × `GDX_PSY_SEPTENARY_LEVEL` — **DATABASE**, 5 of 5 ways.

| Way | Septenary Level | Confidence | Justification |
|---|---|---|---|
| 1. Prima Via (Argument from Motion) | #4 Lower Mental Body | MEDIUM | The argument reasons about concrete, observable change (motion/potency-to-act) in sensible bodies -- practical, this-worldly causal reasoning, the defining activity of the concrete/lower mental faculty, not yet an abstract judgment of value or an intuitive grasp of purpose. |
| 2. Secunda Via (Argument from Efficient Cause) | #4 Lower Mental Body | MEDIUM | Like the first way, this argument reasons about an observable causal chain in the world of things (efficient causation) -- concrete cosmological reasoning about how effects follow from causes, still at the level of practical/concrete mind rather than abstract value-judgment. |
| 3. Tertia Via (Argument from Contingency (Possibility and Necessity)) | #5 Higher Mental Body | MEDIUM | This argument no longer reasons about a single physical chain but about the abstract modal categories of contingency and necessity of being as such -- a judgment about the very identity/status of existence, characteristic of the abstract mind rather than concrete observation. |
| 4. Quarta Via (Argument from the Gradation of Being) | #5 Higher Mental Body | HIGH | The argument explicitly reasons from degrees of goodness, truth and nobility -- value-laden abstract judgment -- which is exactly the function attributed to the Higher Mental Body (values, long-term judgment, identity) in the Septenary Constitution reference table. |
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | SPECULATIVE | Recognizing purpose/design/order in nature is an act of grasping meaning beyond mechanical description -- the defining function of the Buddhic level (intuition, existential meaning-making) rather than a further step of discursive/abstract reasoning. |

**Note:** level 7 (Atmic Body/Spirit) was deliberately left without an associated way — the 5 ways converge on the same conclusion ("this all men call God"), so mapping any way to level 7 would make the relation trivial/uninformative (see the comment in `five_ways_septenary_map_firebird25.sql`).

Confidence distribution: HIGH=1, MEDIUM=3, LOW=0, SPECULATIVE=1.

## 2b. Metaphysical Variables ↔ The Five Ways (Aquinas)

Source: `GDX_TA_WAY_SEPT_MAP` (same table as Section 2, extended by `metaphysical_variable_way_map_firebird25.sql`) — **DATABASE**, 7 concrete instrument/variable↔way correspondence(s), in addition to Section 2's 5 conceptual rows.

| Way | Septenary Level | Instrument | Variable | What it measures | Confidence | Justification |
|---|---|---|---|---|---|---|
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | Purpose Orientation (OT-7) | Clarity of Purpose (Grammar) | Naming and clearly describing the personal goal the person says they are trying to achieve. | SPECULATIVE | The whole OT-7 construct is an interpretive extension of the Fifth Way; the Grammar lens observes the clear verbal formulation of that same purpose, not an independent argumentative way. |
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | Purpose Orientation (OT-7) | Coherence Between Means and Ends (Logic) | Assessing whether the person's recent actions are coherent with the stated goal. | SPECULATIVE | Interpretive extension of the Fifth Way: the Logic lens observes coherence between means and ends within that same teleological orientation, not an independent argumentative way. |
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | Purpose Orientation (OT-7) | Expression of Purpose (Rhetoric) | How the person communicates and justifies why the goal matters to them. | SPECULATIVE | Interpretive extension of the Fifth Way: the Rhetoric lens observes the articulation of the personal meaning of the purpose within that same teleological orientation, not an independent argumentative way. |
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | Purpose Orientation (OT-7) | Proportion Between Resources and Goal (Arithmetic) | How the person distributes time and effort in a way compatible with the goal. | SPECULATIVE | Interpretive extension of the Fifth Way: the Arithmetic lens observes the proportion between invested resources and the goal within that same teleological orientation, not an independent argumentative way. |
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | Purpose Orientation (OT-7) | Structure Among Goals, Values, and Actions (Geometry) | Alignment between the goal, the person's personal values, and their other responsibilities. | SPECULATIVE | Interpretive extension of the Fifth Way: the Geometry lens observes the structure/alignment among goals, values and actions within that same teleological orientation, not an independent argumentative way. |
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | Purpose Orientation (OT-7) | Rhythm and Continuity (Music) | Maintaining a sustainable pace of action, adjusting effort when perceived vitality changes. | SPECULATIVE | Interpretive extension of the Fifth Way: the Music lens observes the rhythm and continuity of actions within that same teleological orientation, not an independent argumentative way. |
| 5. Quinta Via (Argument from the Governance of the World (Teleological)) | #6 Buddhic Body | Purpose Orientation (OT-7) | Cycles and Broader Context (Astronomy) | Reassessing the goal when context, priorities, or conditions change. | SPECULATIVE | Interpretive extension of the Fifth Way: the Astronomy lens observes reassessing the goal across cycles and contexts within that same teleological orientation, not an independent argumentative way. |

## 3. Psychometric Variables ↔ Septenary Constitution

Source: `GDX_PSY_SEPT_LEVEL_PSY_MAP` (3.septenary.constitution) × `GDX_PSY_SEPTENARY_LEVEL`, cross-referenced with `DW_DIM_VARIABLE` (7.multidimensional.database) just to bring in the real `SAV_COLUMN` — **DATABASE**, 26 cataloged correspondences.

| Septenary Level | Instrument | Variable (.sav) | What it measures | Confidence | Justification |
|---|---|---|---|---|---|
| #1 Physical Body | Burnout Scale (hypothesis, ef1-ef18) | — (not yet reconciled with the catalog) | Exhaustion, fatigue, drop in objective performance | LOW | Exhaustion first manifests as a collapse of physical/bodily energy - a physical symptom before an emotional one |
| #2 Vital/Etheric Body | Engagement Scale | `ENGAGvigor` | Disposition, energy, willingness to invest effort in studying | HIGH | Vigor is by definition vital energy applied to an activity - a direct mapping |
| #2 Vital/Etheric Body | Positivity Ratio Scale | `EmocPos` | Positive energetic activation | MEDIUM | High-activation emotions (joy, interest) have a strong vital/energetic component |
| #3 Astral Body | Satisfaction With Life Scale | `SATISFVIDA` | Global affective evaluation of one's own life | HIGH | Satisfaction is an affective judgment - astral body (desire satisfied/unsatisfied) |
| #3 Astral Body | Job Satisfaction Scale | `SATISFTRAB` | Pleasure/displeasure with the occupational activity | HIGH | Same as life satisfaction - affect tied to a specific object (work) |
| #3 Astral Body | Positivity Ratio Scale | — (not yet reconciled with the catalog) | Emotional repertoire (joy, gratitude, sadness, fear, anger...) | HIGH | Pure emotional core - this is literally the measure of the astral body |
| #3 Astral Body | Personal Satisfaction (Diener, 1995) | `SatPes` | Subjective contentment with oneself | HIGH | Self-directed affect |
| #3 Astral Body | Positivity Ratio Scale | `EmocNeg` | Negative emotional repertoire (sadness, fear, anger, disgust, guilt, hatred...) | HIGH | Symmetric to EmocPos - the negative half of the same Positivity Ratio emotional core; pure emotional content (positive or negative) is exactly the astral body's domain |
| #4 Lower Mental Body | Hardiness | `HARDcontrole` | Belief in being able to influence everyday events | HIGH | Control is a concrete cognitive function - "I think, therefore I can act on this" |
| #4 Lower Mental Body | Perceived Control of Life (Inglehart, 1998) | `CtrlVi` | Practical sense of mastery over one's own routine | HIGH | Concrete cognitive judgment about personal agency |
| #4 Lower Mental Body | Career Adapt-Abilities Scale | `ACcontrole` | Practical planning and decision-making about one's career | HIGH | Practical reasoning applied to a concrete goal (career) |
| #5 Higher Mental Body | Hardiness | `HARDcompromis` | Engagement with values and life purpose (not just the task) | MEDIUM | Commitment goes beyond the concrete - it is adherence to a meaning/identity |
| #5 Higher Mental Body | Engagement Scale | `ENGAGdedicac` | Enthusiasm, pride, meaning attributed to the student role | MEDIUM | "Dedication" is an investment of identity, not just energy (vital) |
| #5 Higher Mental Body | Career Adapt-Abilities Scale | `ACconfianc` | Self-efficacy projected onto one's professional future | MEDIUM | Abstract self-judgment over time - the abstract mind |
| #5 Higher Mental Body | Career Adapt-Abilities Scale | `ACcuriosid` | Exploring alternatives, openness to possibilities | MEDIUM | Exploratory/abstract thinking, not tied to an immediate action |
| #6 Buddhic Body | Engagement Scale | `ENGAGabsorc` | Flow state, losing track of time while studying | SPECULATIVE | Absorption/flow is described in the literature as a quasi-transcendent state of subject-activity unity - a classic correspondence with the Buddhic body |
| #6 Buddhic Body | Hardiness | `HARDdesafio` | Ability to draw meaning and growth from adversity | SPECULATIVE | Turning difficulty into meaning is an intuitive/meaning-making operation, beyond practical reasoning |
| #6 Buddhic Body | Career Adapt-Abilities Scale | `ACpreocup` | Future orientation with a sense of existential continuity | SPECULATIVE | "Concern" here (Savickas) is an integrated temporal outlook - close to the intuitive perception of purpose |
| #6 Buddhic Body | Purpose Orientation (OT-7) | — (metaphysical instrument, no .sav) | Naming and clearly describing the personal goal the person says they are trying to achieve (OT-7 Grammar item). | SPECULATIVE | The whole OT-7 construct is anchored in Aquinas's Fifth Way (governance, order and finality), already associated with Level 6 (Buddhic Body) in five_ways_septenary_map_firebird25.sql. Clear verbal articulation of a purpose is read here as an expression of that same intuition of meaning/finality, not as an independent correspondence path. |
| #6 Buddhic Body | Purpose Orientation (OT-7) | — (metaphysical instrument, no .sav) | Assessing whether the person's recent actions are coherent with the stated goal (OT-7 Logic item). | SPECULATIVE | Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. Coherence between means and ends is read as the logical facet of that same teleological orientation, not a separate correspondence. |
| #6 Buddhic Body | Purpose Orientation (OT-7) | — (metaphysical instrument, no .sav) | How the person communicates and justifies why the goal matters to them (OT-7 Rhetoric item). | SPECULATIVE | Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The ability to articulate the personal meaning of the purpose is read as the rhetorical facet of that same teleological orientation. |
| #6 Buddhic Body | Purpose Orientation (OT-7) | — (metaphysical instrument, no .sav) | How the person distributes time and effort in a way compatible with the goal (OT-7 Arithmetic item). | SPECULATIVE | Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The proportion between invested resources and the goal is read as the quantitative facet of that same teleological orientation. |
| #6 Buddhic Body | Purpose Orientation (OT-7) | — (metaphysical instrument, no .sav) | Alignment between the goal, the person's personal values, and their other responsibilities (OT-7 Geometry item). | SPECULATIVE | Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The structure/alignment among goals, values and actions is read as the relational facet of that same teleological orientation. |
| #6 Buddhic Body | Purpose Orientation (OT-7) | — (metaphysical instrument, no .sav) | Maintaining a sustainable pace of action, adjusting effort when perceived vitality changes (OT-7 Music item). | SPECULATIVE | Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. The rhythm and continuity of actions are read as the temporal/cadenced facet of that same teleological orientation. |
| #6 Buddhic Body | Purpose Orientation (OT-7) | — (metaphysical instrument, no .sav) | Reassessing the goal when context, priorities, or conditions change (OT-7 Astronomy item). | SPECULATIVE | Same anchor as the whole OT-7 construct in the Fifth Way (order and finality) -> Level 6. Reassessing the goal across cycles and contexts is read as the cyclical/contextual facet of that same teleological orientation. |
| #7 Atmic Body/Spirit | Block an1-an11 (undocumented, hypothesis) | `RealizPess` | Sense of ultimate fulfillment, purpose achieved | SPECULATIVE | The name and semantics ("personal fulfillment", high mean = 4.03) suggest the highest level of meaning, beyond the abstract mind |

Confidence distribution: HIGH=9, MEDIUM=5, LOW=1, SPECULATIVE=11.

## 4. Psychometric Variables ↔ Virtues (Virtology) — CODE, not Database

Source: `virtue_knowledge.js`, duplicated (by design) in `12.gdx.virtology/.claude/skills/GDX_SKILL_LINK_SUGGESTIONS/scripts/` and `.../GDX_SKILL_IDENTIFY_VIRTUES/scripts/` — **CODE, never written to Firebird or Neo4j**. No confidence column: `HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE` is implicit nowhere, unlike the three sections above.

For each variable, the same virtue association is used in both skills — only the `justification` changes meaning: **deficit/antidote** (low score, `GDX_SKILL_LINK_SUGGESTIONS`) vs. **strength already present** (high score, `GDX_SKILL_IDENTIFY_VIRTUES`). When the same variable also appears in Section 3, its septenary level is shown — the only point in the framework where all three perspectives (Septenary, Psychometrics, Virtology) meet on the same row.

| Variable (.sav) | What it measures | Septenary Level (Section 3) | Virtue | Justification (deficit → antidote) | Justification (strength → already present) |
|---|---|---|---|---|---|
| `ACconfianc` | Self-efficacy projected onto the professional future | #5 Higher Mental Body | Otimismo (Optimism) | Confidence in one's own future is, by definition, a sustained positive expectation — the core of Optimism | High confidence in one's own professional future is, by definition, an already-sustained positive expectation — Optimism in exercise |
| `ACcontrole` | Practical planning and decision-making about one's career | #4 Lower Mental Body | Responsabilidade (Responsibility) | Low career control calls for the same antidote: actively taking responsibility for concrete decisions | Practical planning and decision-making already active about the career are Responsibility in action, not just in intention |
| `ACcuriosid` | Exploring alternatives, openness to possibilities | #5 Higher Mental Body | Flexibilidade (Flexibility) | Low curiosity is, in practice, rigidity in the face of the unknown — Flexibility is the direct antidote | High curiosity is openness already demonstrated to alternatives and to the unknown — Flexibility already in practice |
| `ACpreocup` | Future orientation with a sense of existential continuity | #6 Buddhic Body | Eternidade (Eternity) | "Concern" in Savickas's sense is an integrated temporal outlook — the virtue that explicitly deals with a perspective beyond the immediate is the closest match | An already-high future orientation with a sense of existential continuity indicates an already-present integrated temporal outlook — the same beyond-the-immediate perspective central to this virtue |
| `CtrlVi` | Practical sense of mastery over one's own routine | #4 Lower Mental Body | Responsabilidade (Responsibility) | Same reasoning as HARDcontrole — mastery of the routine is a direct exercise of personal responsibility | Same reasoning as HARDcontrole — already-demonstrated mastery of the routine is a direct and already-present exercise of personal Responsibility |
| `ENGAGabsorc` | Flow state, losing track of time while studying | #6 Buddhic Body | Tudo Somos Um (We Are All One) | The literature describes absorption/flow as a dissolution of the subject-object boundary — resonating directly with this virtue's theme of unity/interconnection | High absorption/flow is the already-lived dissolution of the subject-object boundary described in the literature — resonating directly with an already-present experience of this virtue's theme of unity |
| `ENGAGdedicac` | Enthusiasm, pride, and meaning attributed to the student role | #5 Higher Mental Body | Fé (Faith) | "Dedication" is an investment of identity, not just energy — it needs something to believe in beyond the immediate outcome, which is the core of Faith | Enthusiasm and meaning already attributed to the student role show an investment of identity sustained by something beyond the immediate outcome — the already-active core of Faith |
| `ENGAGvigor` | Disposition and energy to invest effort in studying | #2 Vital/Etheric Body | Perseverança (Perseverance) | Low vigor is depletion of sustained energy — Perseverance is the practice of maintaining effort despite wear, a direct antidote for the drop in disposition | High vigor is sustained energy already in action — a sign that Perseverance, the practice of maintaining effort despite wear, is already a resource present in this population |
| `EmocNeg` | Repertoire of negative emotions (sadness, fear, anger) | #3 Astral Body | Gratidão (Gratitude) | Same broaden-and-build logic: cultivating gratitude shifts the emotional repertoire away from the negative pole, rather than suppressing it directly | Same broaden-and-build theoretical basis as the instrument — but unlike EmocPos, this variable is on the negative pole: a high score here is not a strength, it is the mechanical reading of the ranking. See the report's caveat about scale direction before treating it as a potential |
| `EmocPos` | Repertoire of positive emotions (joy, interest, hope) | #2 Vital/Etheric Body | Gratidão (Gratitude) | It is the instrument's own theoretical basis (Positivity Ratio / Fredrickson, broaden-and-build): gratitude is the most documented lever for raising positive emotion | It is the instrument's own theoretical basis (Positivity Ratio / Fredrickson, broaden-and-build): an already-high positive repertoire suggests Gratitude, its most documented lever, is already being exercised |
| `HARDcompromis` | Engagement with values and life purpose (not just the task) | #5 Higher Mental Body | Fé (Faith) | Commitment is adherence to a meaning/identity that transcends the immediate task — Faith is the axis that sustains this kind of long-term engagement | High engagement with values and life purpose indicates a Faith already sustaining that long-term commitment |
| `HARDcontrole` | Belief in being able to influence everyday events | #4 Lower Mental Body | Responsabilidade (Responsibility) | Low perceived control improves by training the active assumption of responsibility over what is actually within the person's reach | High belief in being able to influence everyday events reflects someone who already takes active Responsibility over what is within their reach |
| `HARDdesafio` | Ability to draw meaning and growth from adversity | #6 Buddhic Body | Busca do Melhoramento (Pursuit of Improvement) | It is literally the virtue's definition: facing difficulty as an opportunity for growth, echoing Frankl (purpose), cited by Virtology itself | A high ability to draw meaning and growth from adversity is, literally, the Pursuit of Improvement already in practice |
| `RealizPess` | Sense of ultimate fulfillment, purpose achieved | #7 Atmic Body/Spirit | Individuação (Individuation) | Maximal personal fulfillment is the direct psychological correlate of the Jungian process of individuation — becoming a fully integrated Self | An already-high sense of personal fulfillment is the direct psychological correlate of an Individuation process already underway — the Self already on its way to integration |
| `SATISFTRAB` | Pleasure/displeasure with the occupational activity | #3 Astral Body | Utilidade (Utility) | Job satisfaction is strongly tied to the sense of being useful/contributing — Utility is the most direct axis for rebuilding that bond | High job satisfaction is strongly tied to the sense of already being useful/contributing — a sign that Utility is already a lived axis, not just a desired one |
| `SATISFVIDA` | Global affective evaluation of one's own life | #3 Astral Body | Aceitação (Acceptance) | Satisfaction with life as a whole depends on accepting life as it is today, not just changing circumstances — Acceptance attacks the root of the negative global judgment | High life satisfaction is the affective portrait of already accepting life as it is — a sign that Acceptance is already present and sustaining that positive global evaluation |
| `SatPes` | Subjective contentment with oneself | #3 Astral Body | Aceitação (Acceptance) | Low personal contentment is, in practice, insufficient self-acceptance | High subjective contentment with oneself is, in practice, self-acceptance already in exercise |

**Sync check:** the two `virtue_knowledge.js` copies agree on every variable (`behavior` and `virtue` identical) — only the justification prose differs, as intended by design.

## 5. Perspectives With No Conceptual Association Recorded Yet

- **6.cardiac.coherence:** no table or column links `GDX_CC_*` to `GDX_PSY_SEPTENARY_LEVEL`, `GDX_PSY_CHAKRA`, `GDX_TA_WAY`, or to the virtues. The only existing link (`GDX_CC_PERSON.ID_PERSON -> DW_DIM_PERSON.ID_PERSON`) is person identity across modules, not a conceptual correspondence between perspectives.
- **Virtology (12.gdx.virtology) ↔ Septenary Constitution / Chakras / Five Ways:** there is no direct association between a virtue and a septenary level/chakra/way — the only bridge today runs through the psychometric variable (Section 4), and only when that same variable is also in Section 3.
- **Psychometric variables with no virtue:** any `SAV_COLUMN` that appears in Section 3 but not in `virtue_knowledge.js` has no virtue associated — this is reported by `GDX_SKILL_IDENTIFY_VIRTUES`/`GDX_SKILL_LINK_SUGGESTIONS` as "no virtue identified (review)" when that variable's score lands in the top/bottom of the ranking, not listed here row by row.

## Summary

| Perspective pair | # of associations | Where it lives |
|---|---|---|
| Chakras ↔ Septenary Constitution | 7 | Firebird — `GDX_PSY_CHAKRA` |
| Five Ways ↔ Septenary Constitution | 5 | Firebird — `GDX_TA_WAY_SEPT_MAP` |
| Metaphysical Variables ↔ Five Ways | 7 | Firebird — `GDX_TA_WAY_SEPT_MAP` |
| Psychometrics ↔ Septenary Constitution | 26 | Firebird — `GDX_PSY_SEPT_LEVEL_PSY_MAP` |
| Psychometrics ↔ Virtues (Virtology) | 17 | Code — `virtue_knowledge.js` (×2 copies) |
| **Total cataloged associations** | **62** | 45 in the database + 17 in code only |

## Caveats

1. None of the associations here is a statistical or empirical finding — all are interpretive judgments recorded by whoever wrote the load (Firebird) or the file (code), with the same methodological honesty standard as `SPSS_Septenary_Constitution_Mapping.md`.
2. The three Firebird tables don't share the same rigor: only `GDX_TA_WAY_SEPT_MAP` and `GDX_PSY_SEPT_LEVEL_PSY_MAP` have a per-row `CONFIDENCE_LEVEL`; `GDX_PSY_CHAKRA` has none.
3. The Virtue association never went through a "capture knowledge → design schema → load into the database" step like the others — it remains code-only, manually duplicated across two skills.
4. This command is read-only: it never writes to Firebird or Neo4j. The generated `.md` file is the only side effect.
