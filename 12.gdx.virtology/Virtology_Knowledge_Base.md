# Virtology (Virtologia) — Knowledge Base

> Compiled 2026-09-10. Location: `GDX_HUMAN/12.gdx.virtology/`
>
> Source: [institutovirtudes.com.br/virtologia](https://institutovirtudes.com.br/virtologia/)
> and [institutovirtudes.com.br/manual](https://institutovirtudes.com.br/manual/), retrieved
> via automated web fetch on 2026-09-10. **This is a knowledge-capture document only** — no
> DDL, mapping, or schema work has been done yet. Original virtue names are kept in Portuguese
> (the source language) with an English gloss alongside, the same pattern used for `.sav`
> variable names elsewhere in `GDX_HUMAN`.
>
> **Reliability caveat:** both pages were retrieved through an automated fetch-and-summarize
> tool (a smaller/faster model reading the live page), not read directly by a person. Wording,
> ordering, and small details may not be perfectly verbatim — treat this document as a strong
> first draft of the source material, not a certified transcription. Verify against the
> original site (or a PDF/manual, if one exists) before this content is used to drive any
> schema, DDL, or DML.

## 1. What Virtology claims to be

Virtology (*Virtologia*) is presented as a "clínico-filosófica" (clinical-philosophical)
school founded by **Eduardo Casarotto**, described on the source site as an independent
researcher. Its central reframing: **"virtue" is redefined away from a moral/ethical concept
and recast as a neurological one** — in the site's own words, *"virtude é um conjunto de redes
neurais trabalhando numa configuração específica"* ("a virtue is a set of neural networks
working in a specific configuration"). Virtues are not character judgments; they are trainable
brain-circuit configurations, built through repetition until they operate automatically,
*"sem esforço, sem vigilância"* ("without effort, without vigilance").

This positions Virtology as a **neuroplasticity-based therapeutic method**: instead of
treating a symptom directly, it targets what it claims are the two upstream neural systems
that generate most non-organic psychological suffering (see §2), on the theory that changing
those systems changes everything downstream of them.

## 2. Theoretical basis — the two primitive systems

Virtology's model rests on two named neural systems, both framed as evolutionarily primitive
and largely unconscious:

### SNO — Sistema Neurofuncional do Orgulho (Neurofunctional Pride System)

Operates through the brain's reward circuit and the regions involved in self-referential
thinking. Claimed manifestations: power-seeking, vanity, need for approval, controlling
behavior, and — described as a paradox worth naming explicitly — **timidity**, framed as shame
about criticism rather than its opposite.

### SNE — Sistema Neurofuncional do Egoísmo (Neurofunctional Selfishness System)

Centers on the prefrontal cortex computing a cost-benefit trade-off between self and others.
The **temporoparietal junction** is described as the normal "brake" on this calculation; in
selfishness, that brake fails to engage. Claimed manifestations: aggression, addiction,
indifference, controlling behavior, and corruption.

Both systems are described as intersecting with, and partly explaining the energetic source
of, Freud's and Anna Freud's defense mechanisms — Virtology's stated position is that it
accepts the defense-mechanism framework but adds an account of *what powers it*.

## 3. The Lei do Fluxo (Law of Flow)

A formula presented as governing how a person perceives and reacts to any given event:

```
PRF = (I × E) × FA × PO × PS × LV
```

| Symbol | Portuguese | Meaning |
|---|---|---|
| **PRF** | Percepção, Reação, Fluxo | The outcome — how the event is perceived, reacted to, and processed |
| **E** | Estímulo | The stimulus — the event itself |
| **I** | Intensidade | Intensity — the personal weight/significance assigned to the event |
| **FA** | Faixa de Evolução | The person's current evolution level (see §4) |
| **PO** | Propulsores | Drives / underlying needs |
| **PS** | Personalidade | Personality — character structure and defense mechanisms |
| **LV** | Leis da Vida | "Life laws" — no further definition was found on either source page |

No worked numeric example or unit system was found for this formula on either page — it reads
as a conceptual/qualitative model of how the same external event produces different reactions
in different people, rather than a literally computable equation.

## 4. Faixas de Evolução (Evolution Levels)

Described as hierarchical modes of brain function: lower levels prioritize survival, security,
and status; higher levels enable purpose-driven living. The site states **levels cannot be
skipped** — advancement requires actually building the specific neural structures associated
with a level, not just intellectually understanding a higher one.

**Gap:** neither source page yielded an explicit table naming/numbering the individual Faixas
de Evolução (unlike the 33 virtues in §5, which are given as a complete, ordered list). If a
full breakdown of the levels exists, it lives in a manual/PDF not covered by these two pages.

## 5. The 33 Virtues (Virtologias)

Given as a complete, ordered list on `/manual/`. Portuguese name (source) with an English gloss:

| # | Portuguese | English gloss |
|---|---|---|
| 1 | Humildade | Humility |
| 2 | Individuação | Individuation |
| 3 | Brandura | Gentleness |
| 4 | Eternidade | Eternity |
| 5 | Perdão | Forgiveness |
| 6 | Exemplo Positivo | Positive Example |
| 7 | Igualdade | Equality |
| 8 | Fraternidade | Fraternity |
| 9 | Aceitação | Acceptance |
| 10 | Perseverança | Perseverance |
| 11 | Otimismo | Optimism |
| 12 | Paciência | Patience |
| 13 | Reconciliação | Reconciliation |
| 14 | Fé | Faith |
| 15 | Tudo Somos Um | We Are All One |
| 16 | Ajuda ao Próximo | Helping Others |
| 17 | Amor ao Próximo | Love for Others |
| 18 | Gratidão | Gratitude |
| 19 | Verdade | Truth |
| 20 | Bom Humor | Good Humor |
| 21 | Honestidade | Honesty |
| 22 | Não Julgamento | Non-judgment |
| 23 | Pureza de Coração | Purity of Heart |
| 24 | Abnegação | Abnegation / Self-denial |
| 25 | Pagar o Mal com o Bem | Repay Evil with Good |
| 26 | Honrar a Família | Honor Family |
| 27 | Desapego | Detachment |
| 28 | Busca do Melhoramento | Pursuit of Improvement |
| 29 | Cuidado com o Corpo | Body Care |
| 30 | Flexibilidade | Flexibility |
| 31 | Utilidade | Utility |
| 32 | Amor à Natureza e aos Animais | Love of Nature and Animals |
| 33 | Responsabilidade | Responsibility |

### Structural notes on the list

- **Humildade (#1) is explicitly foundational**: *"A humildade vem primeiro porque sem ela
  nenhuma das outras se sustenta"* ("Humility comes first because without it none of the
  others can be sustained.") — this is the one dependency relationship stated outright.
- **The ordering encodes dependency, not flat categories.** The manual presents the 33 as a
  sequence with each building on earlier ones, rather than as 33 independent, freestanding
  items — closer in spirit to how `5.five.ways.tomas.aquino`'s Five Ways build on each other
  than to `4.kundalini.chakras`'s seven independent, parallel centers.
- **Virtues #15–17** (Tudo Somos Um / Ajuda ao Próximo / Amor ao Próximo) were flagged by the
  source-page summary as forming a loosely-identified "upper tier" centered on interconnection
  and compassion — this is an interpretive grouping from the fetch, not a labeled tier on the
  page itself, and should be verified before being treated as authoritative.
- On the `/virtologia/` overview page (as opposed to `/manual/`), only 4 of the 33 were named
  directly in running text: **Humildade** (disconnects self-worth from social position),
  **Abnegação** (reweights another person's value in a decision), **Brandura**, and
  **Individuação** — consistent with, and a subset of, the full 33-item list from `/manual/`.

## 6. Clinical / therapeutic framing

- Virtology is positioned as **complementary to medical treatment** for conditions with a
  genetic/organic basis (schizophrenia, autism, bipolar disorder are named explicitly) — not a
  replacement for psychiatric care in those cases.
- For non-organic distress, the claim is that treating the underlying SNO/SNE configuration
  (rather than the symptom) is the more durable intervention.
- **One detailed case study** is presented on the overview page: a female prisoner, described
  as violent and suicidal, unable to receive visitors. After working through exercises in three
  virtues, the source states: *"dois meses depois, o vídeo gravado com ela mostrava outra
  pessoa"* ("two months later, the recorded video of her showed a different person").
- **Testimonials** from licensed psychologists who report having integrated the method into
  their practice are referenced on the overview page (no names or verifiable credentials were
  captured in this fetch).

## 7. Stated relationship to established psychology

The source explicitly positions Virtology relative to three well-known frameworks, rather than
presenting itself as unrelated to prior work:

- **Freud / Anna Freud** — defense mechanisms are accepted as a real and useful framework;
  Virtology's claimed contribution is explaining the neural *power source* behind them (SNO/SNE).
- **Maslow** — the hierarchy of needs is treated as broadly correct, with Virtology's claimed
  addition being an explanation of *why* people get stuck at a given level instead of advancing
  (tied to Faixas de Evolução, §4).
- **Viktor Frankl** — logotherapy's emphasis on purpose/meaning is accepted, with Virtology
  adding the claim that a person needs prior neurological readiness (an adequate Faixa de
  Evolução) before purpose-driven living becomes accessible, rather than purpose being available
  at any stage.

## 8. Open gaps — what would be needed before any schema/DDL work

If this framework is later added to `GDX_HUMAN` as a mapped layer (the way
`5.five.ways.tomas.aquino` was mapped to the septenary constitution), the following are missing
from what these two pages yielded and would need a primary source (PDF, book, direct
transcription) before the mapping could be done responsibly, the same standard applied to the
septenary/chakra/Five Ways mappings already in this project:

1. **A full Faixas de Evolução table** — names, count, and ordering of the levels themselves
   (only the concept, not the inventory, was found).
2. **A definition of Leis da Vida (LV)** in the Lei do Fluxo formula — referenced but not
   defined on either page.
3. **Confirmation of the #15–17 "upper tier" grouping** — this document flags it as an
   interpretation of the fetch, not a verified structural claim from the source.
4. **Any explicit virtue → neural-system (SNO/SNE) mapping** — the two systems are described
   as the *problem* virtues counteract, but neither page stated which of the 33 virtues map to
   SNO versus SNE versus both, information that would be the natural analogue of
   `GDX_PSY_SEPT_LEVEL_PSY_MAP`'s correspondence-with-justification pattern if this framework is
   ever related to the septenary constitution or the psychometric data.
