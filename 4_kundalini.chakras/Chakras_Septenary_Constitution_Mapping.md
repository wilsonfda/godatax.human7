# GDX_HUMAN — Relation Between the 7 Chakras (Kundalini) and the Septenary Constitution

> Generated on 2026-09-10, based on:
> - `GDX_HUMAN/kundalini.chakras/chakras_model_firebird25.sql` (DDL/DML of the `GDX_PSY_CHAKRA` table)
> - `GDX_HUMAN/septenary.constitution/septenary_constitution_model_firebird25.sql` (DDL/DML of the `GDX_PSY_SEPTENARY_LEVEL` table)
> - `GDX_HUMAN/relational.model.psychometrics/SPSS_Septenary_Constitution_Mapping.md` (reference table of the 7 levels)
>
> **Nature of this document:** just like the SPSS × Septenary Constitution mapping, this is an interpretive/symbolic reading — not an empirical finding. It relates two distinct traditions (the chakra system of tantric yoga and the septenary constitution of Theosophy) that are already frequently syncretized in Western esoteric literature (e.g., C.W. Leadbeater, *The Chakras*, 1927), but whose exact correspondence varies between authors. The criterion adopted here is the simplest and most commonly cited: **ascending ordinal correspondence** — the chakra of order N governs the same level of consciousness as the body/principle of order N in the septenary constitution, from the densest (base) to the subtlest (crown).

## 1. The 7 chakras (reference)

| # | Sanskrit name | Common name | Location | Symbolic color | Element | Seed mantra |
|---|---|---|---|---|---|---|
| 1 | Muladhara | Root Chakra | Base of the spine/perineum | Red | Earth | LAM |
| 2 | Svadhisthana | Sacral Chakra | Below the navel/sacral region | Orange | Water | VAM |
| 3 | Manipura | Solar Plexus Chakra | Solar plexus/stomach region | Yellow | Fire | RAM |
| 4 | Anahata | Heart Chakra | Center of the chest | Green | Air | YAM |
| 5 | Vishuddha | Throat Chakra | Throat | Blue | Ether/Space | HAM |
| 6 | Ajna | Third Eye Chakra | Between the eyebrows | Indigo | Light/Mind | OM |
| 7 | Sahasrara | Crown Chakra | Top of the head | Violet/White | Pure thought/Transcendence | (silent) |

## 2. Relation table — Chakra × Septenary Level

| Chakra | Symbolic function | Septenary level (`GDX_PSY_SEPTENARY_LEVEL`) | Justification for the correspondence |
|---|---|---|---|
| **Muladhara** (Root) | Survival, grounding, safety, basic bodily instincts | 1 — Physical Body | Both govern the material/instinctive base of existence |
| **Svadhisthana** (Sacral) | Vitality, pleasure, creative and procreative energy, basic emotional fluidity | 2 — Vital/Etheric Body | Both govern the vital energy that sustains and moves the physical body |
| **Manipura** (Solar Plexus) | Personal will, self-esteem, power to act, emotions tied to the ego | 3 — Astral Body | Both govern emotions, desires and the affective charge tied to personal identity |
| **Anahata** (Heart) | Love, compassion, relationship, bridge between the concrete/practical and the abstract/higher | 4 — Lower Mental Body | The first center where experience begins to be processed in a relational/concrete-cognitive way, not merely reactive |
| **Vishuddha** (Throat) | Communication, expression of personal truth, articulation of ideas and values | 5 — Higher Mental Body | Expressing/articulating values and identity is a function of the abstract mind |
| **Ajna** (Third Eye) | Intuition, perception beyond the senses, discernment, inner vision | 6 — Buddhic Body | Intuition and direct perception of meaning, unmediated by reasoning, is the classic function attributed to both |
| **Sahasrara** (Crown) | Union with the transcendent, pure consciousness, full spiritual realization | 7 — Atmic Body/Spirit | Both represent the top of the ladder of consciousness, transcendent will and ultimate purpose |

## 3. Where this is stored in the schema

| Concept | Table/column |
|---|---|
| Catalog of the 7 chakras | `GDX_PSY_CHAKRA` (`SANSKRIT_NAME`, `COMMON_NAME`, `LOCATION`, `SYMBOLIC_COLOR`, `SYMBOLIC_ELEMENT`, `SEED_MANTRA`, `SYMBOLIC_FUNCTION`) |
| Chakra → septenary level link | `GDX_PSY_CHAKRA.ID_SEPTENARY_LEVEL` (FK to `GDX_PSY_SEPTENARY_LEVEL.ID_SEPTENARY_LEVEL`) |
| Justification for the correspondence | `GDX_PSY_CHAKRA.SEPTENARY_LEVEL_JUSTIFICATION` |
| Catalog of the 7 septenary levels (prerequisite) | `GDX_PSY_SEPTENARY_LEVEL`, created in `GDX_HUMAN/septenary.constitution/septenary_constitution_model_firebird25.sql` |

The relation is 1:1 by construction (each chakra has exactly one `ID_SEPTENARY_LEVEL`, in the same 1–7 order), unlike the SPSS × Septenary Constitution relation (`GDX_PSY_SEPT_LEVEL_PSYCHOMETRIC_MAP`), which is N:1 (several psychometric instruments/dimensions can point to the same level).

## 4. Methodological caveats

1. The ordinal correspondence (chakra N ↔ level N) is the most common and simplest reading between the two traditions, but it is **not consensual** — some authors place, for example, Svadhisthana as the seat of the emotions (instead of Manipura), or treat Anahata as the true threshold between personality and soul (instead of the 4th, lower-mental level). This table chose the ordinal reading because it is the most structurally defensible (same count, same direction dense→subtle), not because it is the only possible one.
2. Just like the SPSS mapping, this is a study/organization tool within GoDataX, not a scientific or doctrinal claim.
3. No empirical (biometric, physiological) data relates the chakras to the psychometric variables of the `.sav` study — the bridge is always made through the septenary level as an intermediate layer common to both relation tables (`GDX_PSY_SEPT_LEVEL_PSYCHOMETRIC_MAP` and `GDX_PSY_CHAKRA`).
