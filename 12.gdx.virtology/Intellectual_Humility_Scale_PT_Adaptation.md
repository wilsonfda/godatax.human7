# Comprehensive Intellectual Humility Scale — Portuguese (Brazil) Adaptation

> Compiled 2026-10-15. Location: `GDX_HUMAN/12.gdx.virtology/`
>
> **Original instrument, source, and permission:** Krumrei-Mancuso, E. J., & Rouse,
> S. V. (2016). *The development and validation of the Comprehensive Intellectual
> Humility Scale.* Journal of Personality Assessment, 98, 209–221.
> doi:[10.1080/00223891.2015.1068174](https://doi.org/10.1080/00223891.2015.1068174).
> Item text and scoring key retrieved verbatim from the authors' own distribution
> page (Pepperdine University, Seaver College of Social Science), which states:
> *"You are welcome to make use of this scale for research with citation to"* the
> reference above. Any use of this instrument (English or the translation below)
> must carry that same citation.
>
> **Why this document exists:** candidate psychometric instrument for
> **Humildade** (#1 in `GDX_VT_VIRTUE` — the one virtue the Virtology manual
> itself calls foundational, *"sem ela nenhuma das outras se sustenta"*), chosen
> because, unlike most of the other 32 virtues, intellectual humility already has
> an established, validated measure in the mainstream personality-assessment
> literature — so this is an adaptation of an existing instrument, not new item
> development from scratch.

## Status: DRAFT forward translation — not yet a validated instrument

This document contains a **first-pass forward translation** of the original
English items into Brazilian Portuguese, done to start the adaptation
conversation — it is **not** a validated Portuguese instrument yet, and this
skill/document does **not** create any `GDX_PSY_VARIABLE`, `GDX_PSY_INSTRUMENT`,
or `GDX_PSY_INSTRUMENT_CONSTRUCT` row. Same discipline as every other
correspondence in this framework: nothing here is treated as more certain than
it actually is.

Standard cross-cultural adaptation methodology (Beaton et al., 2000;
International Test Commission guidelines — the same standard this project's
other translated instruments, e.g. the `.sav`-sourced scales documented in
`2.relational.model.psychometrics/SPSS_to_Firebird_Mapping.md`, would be
expected to have gone through) calls for several steps **beyond** this draft
before it can be used to collect real data:

1. **Independent back-translation** — a second bilingual translator, blind to
   the English original, translates the Portuguese draft below back into
   English; divergences from the original items get flagged.
2. **Expert/bilingual committee reconciliation** — resolve back-translation
   divergences, check idiom and register (this draft targets general adult
   Brazilian Portuguese; if the target population is specifically military
   higher-education students, as in `ID_STUDY=1`, the committee should confirm
   the register fits that population too).
3. **Cognitive pretesting** — a small sample from the target population reads
   each item aloud and explains what they understood it to mean, to catch
   ambiguous translations before full data collection.
4. **Pilot data collection + psychometric validation** — once items are
   finalized, run them through this project's existing pipeline
   (`2.relational.model.psychometrics/.claude/skills/GDX_SKILL_MAKE_ANALYSES_CFA_EFA`)
   to confirm the four-factor structure replicates in Portuguese before treating
   any score as meaningful.

Only after step 4 would this become a real `GDX_PSY_INSTRUMENT` with
`GDX_PSY_VARIABLE` rows, onboardable via `GDX_SKILL_NEW_STUDY` /
`GDX_SKILL_RECORD_NEW_STUDY` like any other instrument in this project.

## Response format

5-point Likert, identical to the original: 1 = Discordo totalmente, 2 =
Discordo, 3 = Não concordo nem discordo, 4 = Concordo, 5 = Concordo totalmente.

Instructions (translated): *"Leia atentamente cada afirmação e indique o quanto
você concorda que ela é verdadeira para você."*

## Items — original English and Portuguese draft, by subscale

Items marked **†** are reverse-scored (as in the original — a *higher* raw
answer on these items reflects *lower* intellectual humility, so they are
reverse-coded before summing).

### 1. Independence of Intellect and Ego / Independência do Intelecto e do Ego (5 items)

| # | English (original) | Português (rascunho) |
|---|---|---|
| 16† | When someone disagrees with ideas that are important to me, it feels as though I'm being attacked. | Quando alguém discorda de ideias importantes para mim, sinto como se estivesse sendo atacado(a). |
| 17† | When someone contradicts my most important beliefs, it feels like a personal attack. | Quando alguém contradiz minhas crenças mais importantes, sinto isso como um ataque pessoal. |
| 18† | I tend to feel threatened when others disagree with me on topics that are close to my heart. | Tendo a me sentir ameaçado(a) quando outras pessoas discordam de mim sobre assuntos que me são caros. |
| 21† | When someone disagrees with ideas that are important to me, it makes me feel insignificant. | Quando alguém discorda de ideias importantes para mim, isso me faz sentir insignificante. |
| 22† | I feel small when others disagree with me on topics that are close to my heart. | Sinto-me diminuído(a) quando outras pessoas discordam de mim sobre assuntos que me são caros. |

### 2. Openness to Revising One's Viewpoint / Abertura para Revisar o Próprio Ponto de Vista (5 items)

| # | English (original) | Português (rascunho) |
|---|---|---|
| 6 | I have at times changed opinions that were important to me, when someone showed me I was wrong. | Já mudei, em algumas ocasiões, opiniões importantes para mim quando alguém me mostrou que eu estava errado(a). |
| 7 | I am willing to change my position on an important issue in the face of good reasons. | Estou disposto(a) a mudar minha posição sobre um assunto importante diante de boas razões. |
| 8 | I am open to revising my important beliefs in the face of new information. | Estou aberto(a) a rever minhas crenças importantes diante de novas informações. |
| 9 | I am willing to change my opinions on the basis of compelling reason. | Estou disposto(a) a mudar minhas opiniões com base em argumentos convincentes. |
| 10 | I'm willing to change my mind once it's made up about an important topic. | Estou disposto(a) a mudar de ideia mesmo depois de já ter me decidido sobre um assunto importante. |

### 3. Respect for Others' Viewpoints / Respeito pelos Pontos de Vista dos Outros (6 items)

| # | English (original) | Português (rascunho) |
|---|---|---|
| 11 | I respect that there are ways of making important decisions that are different from the way I make decisions. | Respeito que existam formas diferentes da minha de tomar decisões importantes. |
| 13 | I welcome different ways of thinking about important topics. | Eu acolho diferentes formas de pensar sobre assuntos importantes. |
| 14 | I can have great respect for someone, even when we don't see eye-to-eye on important topics. | Posso ter grande respeito por alguém, mesmo quando não concordamos em assuntos importantes. |
| 15 | Even when I disagree with others, I can recognize that they have sound points. | Mesmo quando discordo de outras pessoas, consigo reconhecer que elas têm argumentos válidos. |
| 19 | I can respect others, even if I disagree with them in important ways. | Consigo respeitar outras pessoas, mesmo discordando delas em aspectos importantes. |
| 20 | I am willing to hear others out, even if I disagree with them. | Estou disposto(a) a ouvir os outros até o fim, mesmo discordando deles. |

### 4. Lack of Intellectual Overconfidence / Ausência de Excesso de Confiança Intelectual (6 items)

| # | English (original) | Português (rascunho) |
|---|---|---|
| 1† | My ideas are usually better than other people's ideas. | Minhas ideias costumam ser melhores do que as ideias das outras pessoas. |
| 2† | For the most part, others have more to learn from me than I have to learn from them. | Na maior parte das vezes, os outros têm mais a aprender comigo do que eu tenho a aprender com eles. |
| 3† | When I am really confident in a belief, there is very little chance that belief is wrong. | Quando estou realmente confiante em uma crença, há muito pouca chance de que essa crença esteja errada. |
| 4† | I'd rather rely on my own knowledge about most topics than turn to others for expertise. | Prefiro confiar no meu próprio conhecimento sobre a maioria dos assuntos a recorrer a outras pessoas em busca de conhecimento especializado. |
| 5† | On important topics, I am not likely to be swayed by the viewpoints of others. | Em assuntos importantes, dificilmente mudo de ideia por causa do ponto de vista de outras pessoas. |
| 12† | Listening to perspectives of others seldom changes my important opinions. | Ouvir as perspectivas de outras pessoas raramente muda minhas opiniões importantes. |

## Scoring

Reverse-code every item marked **†** (i.e., `6 - raw_score` on the 1–5 scale),
then sum: either all 22 items for a total intellectual-humility score, or just
one subscale's items for that facet alone. Same rule as the original — internal
consistency was reported as sufficient for either approach.

## Translation notes / open questions for the reconciliation step

- Item 4: *"expertise"* was translated as *"conhecimento especializado"*
  (literally "specialized knowledge") rather than a loanword, to keep the
  register consistent with the rest of the scale — flag this for the
  bilingual committee; a more literal *"expertise"* (used as a loanword in
  Brazilian Portuguese too) is a defensible alternative.
- Gendered self-reference (*"disposto(a)"*, *"errado(a)"*, *"ameaçado(a)"*,
  *"diminuído(a)"*) follows the inclusive dual-form convention; confirm this
  matches the convention already used in this project's other `.sav`-sourced
  instruments before finalizing.
- No item required restructuring or splitting to preserve meaning in
  Portuguese — a good sign for construct equivalence, but this is a judgment
  call from a single draft pass, not a substitute for back-translation.

## Next steps

1. Independent back-translation of the Portuguese column above.
2. Bilingual committee reconciliation (flag the open questions above first).
3. Cognitive pretest with a small sample from the intended population.
4. Pilot data collection + CFA/EFA via `GDX_SKILL_MAKE_ANALYSES_CFA_EFA` to
   confirm the four-factor structure holds in Portuguese.
5. Only then: onboard as a real instrument (`GDX_SKILL_NEW_STUDY` /
   `GDX_SKILL_RECORD_NEW_STUDY`), and — if validated — link its resulting
   `GDX_PSY_VARIABLE` row(s) to `GDX_VT_VIRTUE` #1 (Humildade) in
   `GDX_VT_VARIABLE_VIRTUE_MAP`, the same way the other 17 variable↔virtue
   correspondences were recorded.
