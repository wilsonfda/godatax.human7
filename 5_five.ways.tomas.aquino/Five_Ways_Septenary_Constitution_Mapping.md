# GDX_HUMAN — The Five Ways of Thomas Aquinas × Septenary Constitution

> Generated on 2026-09-10, based on:
> - `GDX_HUMAN/5_five.ways.tomas.aquino/five_ways_model_firebird25.sql` (DDL/DML of `GDX_TA_WAY`)
> - `GDX_HUMAN/5_five.ways.tomas.aquino/five_ways_septenary_map_firebird25.sql` (DDL/DML of `GDX_TA_WAY_SEPT_MAP`)
> - `GDX_HUMAN/3_septenary.constitution/septenary_constitution_model_firebird25.sql` (DDL/DML of `GDX_PSY_SEPTENARY_LEVEL`)
> - Thomas Aquinas, *Summa Theologica*, Part I, Question 2, Article 3 ("Whether God exists?")
>
> **Nature of this document:** like the other `*_Septenary_Constitution_Mapping.md` documents in `GDX_HUMAN`, this is an interpretive bridge, not an empirical or doctrinal claim. It relates a 13th-century scholastic philosophical argument (the *Quinque Viae*) to a 19th/20th-century esoteric model of consciousness (the Theosophical septenary constitution) that Aquinas never referenced and would not have recognized. The purpose is to organize these two bodies of content inside GoDataX under a shared structural lens (levels of being/reasoning), not to assert that Aquinas "meant" any of this.

## 1. `GDX_TA_WAY` — the 5 ways (reference)

| # | Latin name | English name | Argument type | Conclusion |
|---|---|---|---|---|
| 1 | Prima Via | Argument from Motion | Cosmological | First Mover, itself unmoved |
| 2 | Secunda Via | Argument from Efficient Cause | Cosmological | First Efficient Cause |
| 3 | Tertia Via | Argument from Contingency (Possibility and Necessity) | Cosmological | A being necessary in itself |
| 4 | Quarta Via | Argument from the Gradation of Being | Ontological/axiological (degrees of perfection) | The maximum being, cause of goodness/truth/perfection in all things |
| 5 | Quinta Via | Argument from the Governance of the World | Teleological | An intelligent being that directs all natural things to their end |

Each row also stores, in full, the **premise**, the **metaphysical principle** invoked, the step-by-step **reasoning**, and the exact **conclusion** wording, plus a `SOURCE_REFERENCE` pointing back to *Summa Theologica* I, Q.2, Art.3 — see the DML in `five_ways_model_firebird25.sql` for the full text of each field.

## 2. Why the Septenary Constitution, not the Chakras

Both `3_septenary.constitution/` and `4_kundalini.chakras/` already have a `GDX_PSY_*`-linked catalog table in `GDX_HUMAN`, so either was a structurally valid target for a second relation table. The choice was the **Septenary Constitution**, for one reason: the Five Ways are pure philosophical/metaphysical argumentation (act and potency, efficient causation, contingency and necessity, degrees of being, final causality) — a Western model of **levels of being and reasoning**. The Septenary Constitution is exactly that kind of model too (physical → vital → astral → lower mental → higher mental → buddhic → atmic), which gives a natural, non-forced correspondence. The chakra system, by contrast, is primarily a model of **embodied/energetic centers** (yogic physiology) — it has no natural counterpart for a step-by-step syllogistic proof; only two of the seven chakras (Ajna/intuition, Sahasrara/union with the transcendent) would have anything to map to, and the three cosmological ways (motion, efficient cause, contingency) would have no defensible chakra at all. Forcing that mapping would have been considerably weaker than the one below.

## 3. Relation table — Way × Septenary Level

| Way | Septenary level (`GDX_PSY_SEPTENARY_LEVEL`) | Justification | Confidence |
|---|---|---|---|
| **1. Prima Via** (Motion) | 4 — Lower Mental Body | Reasons about concrete, observable change (motion/potency-to-act) in sensible bodies — practical, this-worldly causal reasoning, not yet an abstract value-judgment or an intuitive grasp of purpose | MEDIUM |
| **2. Secunda Via** (Efficient Cause) | 4 — Lower Mental Body | Reasons about an observable causal chain in the world of things — concrete cosmological reasoning, still at the level of practical/concrete mind | MEDIUM |
| **3. Tertia Via** (Contingency/Necessity) | 5 — Higher Mental Body | Reasons about the abstract modal categories of contingency and necessity of being as such — a judgment about the very status of existence, characteristic of abstract mind rather than concrete observation | MEDIUM |
| **4. Quarta Via** (Gradation of Being) | 5 — Higher Mental Body | Explicitly reasons from degrees of goodness, truth and nobility — value-laden abstract judgment, exactly the function the Septenary reference table attributes to the Higher Mental Body (values, long-term judgment, identity) | HIGH |
| **5. Quinta Via** (Teleological) | 6 — Buddhic Body | Recognizing purpose/design/order in nature is an act of grasping meaning beyond mechanical description — the defining function of the Buddhic level (intuition, existential meaning-making) | SPECULATIVE |

Read top to bottom, the mapping traces an ascending line **4 → 4 → 5 → 5 → 6**, which reproduces a well-documented observation about the Five Ways themselves: they run in increasing order of abstraction, from reasoning about sensible motion (way 1) to recognizing intelligent purpose (way 5).

### Why level 7 (Atmic Body/Spirit) has no row

All five ways converge on the *same* conclusion — "this everyone calls God" / "this all men speak of as God" — which corresponds to level 7 as the **shared destination** of the whole *Quinque Viae*, not as a property of any single way's reasoning process. Assigning level 7 to any (or all) of the five rows would have been trivially true for every way and would have made the relation uninformative — the interesting structural claim is about the ways' differing *methods*, not their common *object*. If a future need arises to record that shared convergence explicitly, the natural place is a note on `GDX_TA_WAY` itself (e.g. a `SHARED_CONCLUSION_LEVEL` reference), not a 6th row in this relation table.

## 4. Where this is stored in the schema

| Concept | Table/column |
|---|---|
| Catalog of the 5 ways | `GDX_TA_WAY` (`LATIN_NAME`, `ENGLISH_NAME`, `ARGUMENT_TYPE`, `PREMISE`, `METAPHYSICAL_PRINCIPLE`, `REASONING`, `CONCLUSION`, `SOURCE_REFERENCE`) |
| Way → septenary level link | `GDX_TA_WAY_SEPT_MAP.ID_SEPTENARY_LEVEL` (FK to `GDX_PSY_SEPTENARY_LEVEL.ID_SEPTENARY_LEVEL`), `GDX_TA_WAY_SEPT_MAP.ID_WAY` (FK to `GDX_TA_WAY.ID_WAY`) |
| Justification for the correspondence | `GDX_TA_WAY_SEPT_MAP.CORRESPONDENCE_JUSTIFICATION` |
| Confidence of the correspondence | `GDX_TA_WAY_SEPT_MAP.CONFIDENCE_LEVEL` (`HIGH`/`MEDIUM`/`LOW`/`SPECULATIVE`) |
| Catalog of the 7 septenary levels (prerequisite) | `GDX_PSY_SEPTENARY_LEVEL`, created in `GDX_HUMAN/3_septenary.constitution/septenary_constitution_model_firebird25.sql` |

The relation is 1:1 by construction in this initial load (each way has exactly one mapping row), but the table itself is modeled N:1 (`UNIQUE (ID_WAY, ID_SEPTENARY_LEVEL)`, not a direct FK column on `GDX_TA_WAY`) — the same pattern used for `GDX_PSY_SEPT_LEVEL_PSYCHOMETRIC_MAP` — so a way could later be given a second mapping row (e.g. its own relation to level 7) without a schema change.

## 5. Methodological caveats

1. This is a **conceptual/qualitative** reading, not a historical or doctrinal claim about what Aquinas intended — the septenary constitution postdates him by roughly six centuries and belongs to a different intellectual tradition (19th-century Theosophy) entirely.
2. The MEDIUM/HIGH/SPECULATIVE confidence levels reflect how directly each way's stated reasoning matches the septenary level's own definition (see `3_septenary.constitution`'s reference table) — way 4 scores HIGH because its language (goodness, truth, nobility) is almost verbatim the Higher Mental Body's definition; way 5 scores SPECULATIVE because "recognizing design" as a Buddhic/intuitive act is a much freer interpretive leap than the others.
3. Ways 1 and 2 (both COSMOLOGICAL, both level 4) are argued identically in structure (observe an effect → deny self-causation → deny infinite regress → posit a first term) and were given the same level for that reason; if a future revision wants to differentiate them, the most defensible split would be by the metaphysical machinery each properly employs (motion/act-potency for way 1 vs. causation proper for way 2), not by level.
4. No empirical or textual evidence ties Aquinas's *Quinque Viae* to any theory of consciousness levels — the bridge, as with the SPSS and chakra mappings elsewhere in `GDX_HUMAN`, is a GoDataX organizational device, not a scholarly finding.
