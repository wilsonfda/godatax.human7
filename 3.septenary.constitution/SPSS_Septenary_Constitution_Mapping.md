# GDX_HUMAN — Relation Between SPSS Instruments/Variables and the Septenary Constitution

> Generated on 2026-09-10, based on:
> - `GDX_HUMAN/relational.model.psychometrics/SPSS_to_Firebird_Mapping.md` (instruments, dimensions and columns identified in the `.sav`)
> - `GDX_HUMAN/output.ibm.spss.statistics/PLANILHAPOSDOC11SET SO CADETES.sav` (original data)
>
> **Nature of this document:** an interpretive bridge between psychometrics (empirical, measurable data) and esoteric philosophy (the theoretical, non-empirical model of the "seven bodies"/seven levels of consciousness described in Theosophy — Blavatsky — and related traditions). This is not a statistical result nor a scientific validation; it is a qualitative reading of conceptual correspondence, for study purposes within GoDataX. Where the correspondence is strong, that is indicated; where it is speculative, that is indicated too.

## 1. The 7 levels of the septenary constitution (reference)

| # | Body/Principle | Nature | Function in consciousness |
|---|---|---|---|
| 1 | **Physical Body** (Sthula Sharira) | Dense, material | Concrete action, survival, objective performance |
| 2 | **Vital/Etheric Body** (Prana/Linga Sharira) | Energetic | Vitality, disposition, the energy that sustains physical life |
| 3 | **Astral Body** (Kama Rupa) | Emotional | Desires, emotions, affects, pleasure/displeasure |
| 4 | **Lower Mental Body** (concrete Manas) | Concrete mind | Practical reasoning, everyday cognitive control, immediate planning |
| 5 | **Higher Mental Body** (abstract Manas) | Abstract mind | Values, commitment, long-term judgment, identity |
| 6 | **Buddhic Body** (Buddhi) | Intuitive | Intuition, existential meaning, flow/absorption states, meaning-making |
| 7 | **Atmic Body/Spirit** (Atma) | Spiritual | Transcendent will, ultimate purpose, full self-realization |

## 2. Relation table — SPSS instruments/dimensions × level of consciousness

| Septenary level | Instrument (SPSS) | Dimension/computed column | Recorded behavior | Justification for the correspondence |
|---|---|---|---|---|
| **1. Physical** | Burnout Scale (hypothesis, `ef1`–`ef18`) | Emotional Exhaustion (no computed column in the `.sav`, see gap §3) | Exhaustion, fatigue, drop in objective performance | Exhaustion first manifests as a collapse of physical/bodily energy — a physical symptom before an emotional one |
| **2. Vital/Etheric** | Engagement Scale | Vigor → `ENGAGvigor` | Disposition, energy, willingness to invest effort in studying | "Vigor" is by definition vital energy applied to an activity — a direct mapping |
| **2. Vital/Etheric** | Positivity Ratio Scale | Positive Emotions (physiological: joy, interest) → `EmocPos` (part) | Positive energetic activation | High-activation emotions (joy, interest) have a strong vital/energetic component |
| **3. Astral** | Satisfaction With Life Scale | Single index → `SATISFVIDA` | Global affective evaluation of one's own life | Satisfaction is an affective judgment — astral body (desire satisfied/unsatisfied) |
| **3. Astral** | Job Satisfaction Scale | Single index → `SATISFTRAB` | Pleasure/displeasure with the occupational activity | Same as above — affect tied to a specific object (work) |
| **3. Astral** | Positivity Ratio Scale | Positive/Negative Emotions → `EmocPos` / `EmocNeg` | Emotional repertoire (joy, gratitude, sadness, fear, anger...) | Pure emotional core — this is literally the measure of the astral body |
| **3. Astral** | Personal Satisfaction (Diener, 1995) | Single item → `SatPes` | Subjective contentment with oneself | Self-directed affect |
| **4. Lower Mental** | Hardiness | Control → `HARDcontrole` | Belief in being able to influence everyday events | Control is a concrete cognitive function — "I think, therefore I can act on this" |
| **4. Lower Mental** | Perceived Control of Life (Inglehart, 1998) | Single item → `CtrlVi` | Practical sense of mastery over one's own routine | Concrete cognitive judgment about personal agency |
| **4. Lower Mental** | Career Adapt-Abilities Scale | Control → `ACcontrole` | Practical planning and decision-making about one's career | Practical reasoning applied to a concrete goal (career) |
| **5. Higher Mental** | Hardiness | Commitment → `HARDcompromis` | Engagement with values and life purpose (not just the task) | Commitment goes beyond the concrete — it is adherence to a meaning/identity |
| **5. Higher Mental** | Engagement Scale | Dedication → `ENGAGdedicac` | Enthusiasm, pride, meaning attributed to the student role | "Dedication" is an investment of identity, not just energy (vital) |
| **5. Higher Mental** | Career Adapt-Abilities Scale | Confidence → `ACconfianc` | Self-efficacy projected onto one's professional future | Abstract self-judgment over time — the abstract mind |
| **5. Higher Mental** | Career Adapt-Abilities Scale | Curiosity → `ACcuriosid` | Exploring alternatives, openness to possibilities | Exploratory/abstract thinking, not tied to an immediate action |
| **6. Buddhic (intuitive)** | Engagement Scale | Absorption → `ENGAGabsorc` | Flow state, losing track of time while studying | Absorption/flow is described in the literature as a quasi-transcendent state of subject-activity unity — a classic correspondence with the Buddhic body |
| **6. Buddhic (intuitive)** | Hardiness | Challenge → `HARDdesafio` | Ability to draw meaning and growth from adversity | Turning difficulty into meaning is an intuitive/meaning-making operation, beyond practical reasoning |
| **6. Buddhic (intuitive)** | Career Adapt-Abilities Scale | Concern → `ACpreocup` | Future orientation with a sense of existential continuity | "Concern" here (Savickas) is an integrated temporal outlook — close to the intuitive perception of purpose |
| **7. Atmic/Spirit** | Block `an1`–`an11` (undocumented, hypothesis) | Personal Fulfillment → `RealizPess` | Sense of ultimate fulfillment, purpose achieved | The name and semantics ("personal fulfillment", high mean = 4.03) suggest the highest level of meaning, beyond the abstract mind |

## 3. Not mapped to the 7 levels (contextual/environmental factors, not the individual's consciousness)

These blocks describe the **environment/organization**, not a principle of the individual's constitution — they are left out of the table because they are not a "body" or "level of consciousness" of the person, but rather external pressure on them:

| Block | Computed column | Why it is left out |
|---|---|---|
| `an1`–`an11` (partial) | `AnoOrg` (Organizational Anomie) | Perception about the organization, not a state of consciousness of the individual |
| `an1`–`an11` (partial) | `SucProfFin` (Professional/Financial Success) | External socioeconomic indicator, not an internal experience |
| `an1`–`an11` (partial) | `CondSocie` (Social Standing) | Perception of social status — a context variable |
| `red1`–`red5` | `RedTap` (Red Tape/perceived bureaucracy) | Judgment about the institutional environment, not about oneself |
| `ano` | — | Demographic variable (curricular year), not a psychological construct |

## 4. Methodological caveats

1. This relation is **conceptual/qualitative**, not derived from factor analysis or any statistical test — it should not be treated as an empirical finding of the original study (which is about adaptability to military higher education, with no reference whatsoever to the septenary constitution).
2. Several correspondences (especially levels 6 and 7) are the most speculative in the table, since they depend on theoretical interpretation of the constructs (e.g., "absorption"/flow as a Buddhic state) rather than direct measurement of "consciousness" in these terms.
3. The `ef` (Burnout) and `an` (undocumented) blocks used in this relation carry the same uncertainties already recorded in `SPSS_to_Firebird_Mapping.md` §3 — confirmation of authorship/structure is still pending.
4. If the goal is to formalize this in the `GDX_PSY_*` schema, the natural candidate is `GDX_PSY_CONSTRUCT` with a new domain (`DOMAIN = 'SEPTENARY_CONSTITUTION'`) and `GDX_PSY_CONSTRUCT.ID_PARENT_CONSTRUCT` pointing to the 7 levels as parent constructs, but this was not executed here (document is read-only/relational). **Update: this was later formalized differently, as two standalone tables (`GDX_PSY_SEPTENARY_LEVEL` and `GDX_PSY_SEPT_LEVEL_PSYCHOMETRIC_MAP`) rather than reusing `GDX_PSY_CONSTRUCT` — see `GDX_HUMAN/septenary.constitution/septenary_constitution_model_firebird25.sql`.**

## 5. Keeping the mapping in sync — `GDX_SKILL_LOAD_SEPT_MAPS_DB`

The table above documents the correspondence for the one historical `.sav`-based study loaded by
`GDX_SKILL_LOAD_RLT_MODEL_DB`. Later studies onboarded through the newer
`GDX_HUMAN/0.new.instrument/` pipeline reuse the same `GDX_PSY_SEPT_LEVEL_PSY_MAP` table, but are
loaded **one study at a time**, by `GDX_SKILL_LOAD_SEPT_MAPS_DB` (see its `SKILL.md`, in
`3.septenary.constitution/.claude/skills/GDX_SKILL_LOAD_SEPT_MAPS_DB/`):

```
GDX_SKILL_NEW_STUDY          -- interview -> new_study_intake/<slug>/intake.json
        |
        v
GDX_SKILL_RECORD_NEW_STUDY   -- generates + runs SQL -> GDX_PSY_STUDY/INSTRUMENT/VARIABLE/... rows exist
        |
        v
GDX_SKILL_LOAD_SEPT_MAPS_DB  -- node load_sept_maps.js --study <slug>
                                 reads that SAME intake.json, resolves its instruments/variables
                                 to their real GDX_PSY_INSTRUMENT/GDX_PSY_VARIABLE ids, and creates
                                 ONLY that study's GDX_PSY_SEPT_LEVEL_PSY_MAP rows
```

Two consequences of this study-scoped design, compared to the historical table above:

- **The identifying key changes for studies with no `.sav` file.** Section 2's table keys every
  correspondence by a `.sav` column code (`ENGAGvigor`, `HARDcontrole`, ...) because that study was
  loaded from an SPSS file. A study onboarded through `GDX_SKILL_NEW_STUDY` was never a `.sav` file,
  so `scripts/knowledge.js` keys its judgment calls by the variable's own `GDX_PSY_VARIABLE.NAME`
  instead (e.g. `"Recovery From Setbacks"`) — `load_sept_maps.js`'s `resolveMappingKey()` picks
  whichever form applies per variable.
- **A new study's mapping is additive, never a rescan.** `GDX_SKILL_LOAD_SEPT_MAPS_DB --study <slug>`
  only resolves and writes the instruments/variables listed in that slug's `intake.json` — it never
  touches `GDX_PSY_SEPT_LEVEL_PSY_MAP` rows belonging to any other study, and (as always) never
  writes to `GDX_PSY_SEPTENARY_LEVEL` or invents a level/justification that isn't already a real
  judgment call in `knowledge.js`.
