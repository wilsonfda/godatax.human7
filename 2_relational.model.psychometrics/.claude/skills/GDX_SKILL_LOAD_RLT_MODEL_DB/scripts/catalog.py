# -*- coding: utf-8 -*-
"""
Static domain-knowledge catalog for the "Predictors of Adaptability to Military
Higher Education" .sav dataset.

This catalog (instruments, constructs, variables, item wording) is NOT derivable
from the .sav file itself -- it comes from reading
GDX_HUMAN/1_output.ibm.spss.statistics/SCALES/ESCALA PESQUISA PORTUGAL AMAN 2012.pptx
and the scale summary Word doc (see
GDX_HUMAN/2_relational.model.psychometrics/SPSS_to_Firebird_Mapping.md for the
full reasoning and the documented gaps). It stays fixed across runs; only the
per-person data (generate_load_scripts.py) is re-read dynamically from the
current .sav file on every invocation.

Keep this file in sync with SPSS_to_Firebird_Mapping.md if the instrument
catalog is ever revised.
"""

## NOTE on 'version': GDX_PSY_INSTRUMENT.VERSION is VARCHAR(30) in
## psychometrics_model_firebird25.sql -- it must stay short (a year/edition
## tag), NOT the full author citation. Full authorship lives in 'desc'
## (VARCHAR(1000)/DESCRIPTION, which has plenty of room) as "Authors: ...".
## A prior revision of this catalog put the full citation in 'version' and
## that caused "string right truncation" errors when loading against a real
## database -- keep 'version' <= 30 chars.
INSTRUMENTS = {
    1: dict(name="Hardiness", version="1989 / adapt. 2004",
            type="LIKERT_SCALE",
            desc="Authors: Bartone, Ursano, Wright & Ingraham, 1989; adapt. Mallar & Capitao, 2004. "
                 "Hardiness scale (30 items, 1-5 Likert)."),
    2: dict(name="Student Engagement Scale", version="2002",
            type="LIKERT_SCALE",
            desc="Authors: Schaufeli, Martinez, Marques Pinto, Salanova & Bakker, 2002. "
                 "Academic engagement scale (14 items, 1-5 Likert)."),
    3: dict(name="Career Adapt-Abilities Scale", version="2011",
            type="LIKERT_SCALE",
            desc="Authors: Duarte, Fraga, Agostinho, Djalo, Lima, Paredes, Rafael & Soares, 2011. "
                 "Career Adapt-Abilities Scale (28 items, 1-5 Likert)."),
    4: dict(name="Satisfaction With Life Scale", version="1985",
            type="LIKERT_SCALE",
            desc="Authors: Diener, Emmons, Larson & Griffin, 1985. "
                 "Satisfaction With Life Scale (5 items, 1-5 Likert)."),
    5: dict(name="Job Satisfaction Scale", version="2000",
            type="LIKERT_SCALE",
            desc="Authors: Judge & Klinger, 2000. Job satisfaction scale (5 items, 1-5 Likert)."),
    6: dict(name="Positivity Ratio Scale", version="2009 / adapt. 2010",
            type="LIKERT_SCALE",
            desc="Authors: Fredrickson, 2009; De Sousa, Goncalves & Rosinha, 2010. "
                 "Positivity Ratio (20 items, 0-4 scale)."),
    7: dict(name="Personal Satisfaction", version="1995",
            type="SINGLE_ITEM", desc="Authors: Diener, 1995. Single item on personal satisfaction (1-5 Likert)."),
    8: dict(name="Perceived Control of Life", version="1998",
            type="SINGLE_ITEM", desc="Authors: Inglehart, 1998. Single item on perceived control over life (1-5 Likert)."),
    9: dict(name="Maslach Burnout Inventory - Student Survey (hypothesis - unconfirmed)",
            version="2009 (hypothesis)",
            type="LIKERT_SCALE",
            desc="Authors (hypothesis): Maroco & Tecedeiro, 2009. "
                 "UNCONFIRMED HYPOTHESIS (see SPSS_to_Firebird_Mapping.md section 3): "
                 "the summary table documents 15 items, but the .sav has 18 columns ef1-ef18; "
                 "items ef16-ef18 have no known wording; no dimension score is computed in the .sav."),
    10: dict(name="Undocumented Organizational Block (hypothesis - an1-an11)",
             version="unknown (hypothesis)",
             type="LIKERT_SCALE",
             desc="UNCONFIRMED HYPOTHESIS (see SPSS_to_Firebird_Mapping.md section 3): "
                  "the name, author and item wording for an1-an11 do not appear in the summary table or the pptx; "
                  "hypothesized sub-dimensions: AnoOrg, SucProfFin, CondSocie, RealizPess."),
    11: dict(name="Red Tape / Perceived Bureaucracy (hypothesis - red1-red5)",
             version="unknown (hypothesis)",
             type="LIKERT_SCALE",
             desc="UNCONFIRMED HYPOTHESIS (see SPSS_to_Firebird_Mapping.md section 3): "
                  "the name matches RedTap but the scale/author/item wording for red1-red5 is undocumented."),
}

# CONSTRUCT id == INSTRUMENT id (1:1 in this dataset)
CONSTRUCTS = {
    1: ("Hardiness", "Resilient personality traits: commitment, control and challenge."),
    2: ("Academic Engagement", "Vigor, dedication and absorption in the student role."),
    3: ("Career Adaptability", "Concern, control, curiosity and confidence in career (Savickas/CAAS)."),
    4: ("Satisfaction With Life", "Global cognitive appraisal of one's own life."),
    5: ("Job Satisfaction", "Affective evaluation of the occupational experience."),
    6: ("Positivity Ratio", "Balance between positive and negative emotions (Fredrickson)."),
    7: ("Personal Satisfaction", "Subjective contentment with oneself (single item)."),
    8: ("Perceived Control of Life", "Sense of freedom/control over one's own life (single item)."),
    9: ("Academic Burnout (hypothesis)", "HYPOTHESIS: academic exhaustion/disengagement - unconfirmed, no computed score in the .sav."),
    10: ("Undocumented Organizational Block (hypothesis)", "HYPOTHESIS: perceptions of organizational anomie, success, social standing and personal fulfillment."),
    11: ("Red Tape / Perceived Bureaucracy (hypothesis)", "HYPOTHESIS: perception of institutional bureaucracy/rigidity."),
}

# VARIABLE: id -> (id_construct, name, sav_column, description)
VARIABLES = {
    1: (1, "Commitment (Hardiness)", "HARDcompromis", "Commitment dimension of the Hardiness scale."),
    2: (1, "Control (Hardiness)", "HARDcontrole", "Control dimension of the Hardiness scale."),
    3: (1, "Challenge (Hardiness)", "HARDdesafio", "Challenge dimension of the Hardiness scale."),
    4: (2, "Vigor (Engagement)", "ENGAGvigor", "Vigor dimension of Academic Engagement."),
    5: (2, "Dedication (Engagement)", "ENGAGdedicac", "Dedication dimension of Academic Engagement."),
    6: (2, "Absorption (Engagement)", "ENGAGabsorc", "Absorption dimension of Academic Engagement."),
    7: (3, "Concern (Career Adaptability)", "ACpreocup", "Concern dimension of Career Adaptability."),
    8: (3, "Control (Career Adaptability)", "ACcontrole", "Control dimension of Career Adaptability."),
    9: (3, "Curiosity (Career Adaptability)", "ACcuriosid", "Curiosity dimension of Career Adaptability."),
    10: (3, "Confidence (Career Adaptability)", "ACconfianc", "Confidence dimension of Career Adaptability."),
    11: (4, "Satisfaction With Life (index)", "SATISFVIDA", "Single index of Satisfaction With Life."),
    12: (5, "Job Satisfaction (index)", "SATISFTRAB", "Single index of Job Satisfaction."),
    13: (6, "Positive Emotions", "EmocPos", "Mean of the positive RP items (1,4,8,11,12,13,14,15,16,19)."),
    14: (6, "Negative Emotions", "EmocNeg", "Mean of the negative RP items (2,3,5,6,7,9,10,17,18,20)."),
    15: (7, "Personal Satisfaction (index)", "SatPes", "Single index of Personal Satisfaction."),
    16: (8, "Perceived Control of Life (index)", "CtrlVi", "Single index of Perceived Control of Life."),
    17: (10, "Organizational Anomie (hypothesis)", "AnoOrg", "HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed."),
    18: (10, "Professional/Financial Success (hypothesis)", "SucProfFin", "HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed."),
    19: (10, "Social Standing (hypothesis)", "CondSocie", "HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed."),
    20: (10, "Personal Fulfillment (hypothesis)", "RealizPess", "HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed."),
    21: (11, "Red Tape (index, hypothesis)", "RedTap", "HYPOTHESIS: index of perceived bureaucracy derived from red1-red5."),
}

HARDINESS_ITEMS = [
 "I have spent most of my life doing things that aren't worthwhile.",
 "Planning ahead can help avoid most future problems.",
 "No matter how hard I try, it usually doesn't work out anyway.",
 "I don't like to change my daily routine.",
 "Listening to the voice of experience is always the best path.",
 "It doesn't matter how hard I work, since I'm not valued for it anyway.",
 "By working hard I will achieve my goals.",
 "Most of the things that happen in life had to happen.",
 "When I make plans, I am certain I will carry them out.",
 "It is exciting to learn something about myself.",
 "I have expectations about my work.",
 "If I'm working on a difficult task, I know when to ask for help.",
 "I don't answer a question until I am sure I have understood it.",
 "I like variety in my work.",
 "Most of the time, people listen carefully to what I have to say.",
 "Thinking of myself as a free person leads to frustration.",
 "Doing my best at work pays off in the end.",
 "My mistakes are hard to correct.",
 "It bothers me when my daily routine is interrupted.",
 "Most athletes and leaders are born, not developed.",
 "I usually wake up eager to get back to the things I left unfinished in my life.",
 "Sometimes I don't recognize my own thoughts.",
 "I respect rules because they guide me.",
 "I like it when things are uncertain and unpredictable.",
 "I cannot protect myself if someone wants to harm me.",
 "Changes in routine are important to me.",
 "Most days, life is interesting and stimulating.",
 "It is hard to imagine anyone being enthusiastic about work.",
 "What happens to me tomorrow depends on what I do today.",
 "Routine work is tedious.",
]
assert len(HARDINESS_ITEMS) == 30

ENGAGEMENT_ITEMS = [
 "When I study, I feel mentally strong.",
 "I can study for a long period of time.",
 "When I study I feel full of energy.",
 "When I am studying I feel strong and energetic.",
 "When I get up in the morning, I feel like going to class.",
 "I think my studies have meaning and purpose.",
 "My studies inspire me.",
 "I am enthusiastic about my studies.",
 "I am proud of my studies.",
 "I find my studies challenging.",
 "When I am studying, time \"flies\".",
 "When I am studying, I forget everything around me.",
 "I feel happy when I study intensely.",
 "I can get carried away by my studies.",
]
assert len(ENGAGEMENT_ITEMS) == 14

AC_ITEMS = [
 "Planning important things before starting",
 "Thinking about what my future will be like",
 "Understanding that today's choices influence my future",
 "Preparing myself for the future",
 "Becoming aware of the career choices I have to make",
 "Planning how to achieve my goals",
 "Being concerned about my career",
 "Keeping up my spirits",
 "Making decisions on my own",
 "Taking responsibility for my actions",
 "Standing up for my beliefs",
 "Relying on myself",
 "Doing what is best for me",
 "Finding the strength to carry on",
 "Exploring my surroundings",
 "Looking for opportunities to grow as a person",
 "Exploring alternatives before making a choice",
 "Being attentive to different ways of doing things",
 "Thoroughly analyzing issues that concern me",
 "Looking for information about the choices I have to make",
 "Being curious about new opportunities",
 "Performing tasks efficiently",
 "Being conscientious and doing things well",
 "Developing new skills",
 "Always giving my best",
 "Overcoming obstacles",
 "Solving problems",
 "Facing challenges",
]
assert len(AC_ITEMS) == 28

# Official Diener, Emmons, Larson & Griffin (1985) SWLS wording.
SV_ITEMS = [
 "In most ways my life is close to my ideal.",
 "The conditions of my life are excellent.",
 "I am completely satisfied with my life.",
 "So far I have gotten the important things I want in life.",
 "If I could live my life over, I would change nothing.",
]
assert len(SV_ITEMS) == 5

ST_ITEMS = [
 "I feel quite satisfied with my job.",
 "Most days I am enthusiastic about my job.",
 "Each work day seems like it will never end.",
 "In general, I like working here.",
 "I consider my job to be rather unpleasant.",
]
assert len(ST_ITEMS) == 5

RP_ITEMS = [
 "How amused, comical, or funny did you feel?",
 "How furious, irritated, or annoyed did you feel?",
 "How embarrassed, humiliated, or ridiculed did you feel?",
 "How amazed, awed, or surprised did you feel?",
 "How insolent, contemptuous, or scornful did you feel?",
 "How much disgust, revulsion, or repulsion did you feel?",
 "How self-conscious, embarrassed, or flushed did you feel?",
 "How grateful, appreciative, and thankful did you feel?",
 "How guilty or remorseful did you feel?",
 "How much hatred, distrust, or suspicion did you feel?",
 "How hopeful, optimistic, or encouraged did you feel?",
 "How inspired, uplifted, or enthusiastic did you feel?",
 "How interested, alert, or curious did you feel?",
 "How joyful, content, or happy did you feel?",
 "How much love, closeness, or trust did you feel?",
 "How proud, confident, and sure of yourself did you feel?",
 "How sad, discouraged, or unhappy did you feel?",
 "How scared, fearful, or afraid did you feel?",
 "How serene, satisfied, and calm did you feel?",
 "How stressed, nervous, or overwhelmed did you feel?",
]
assert len(RP_ITEMS) == 20

EF_ITEMS_KNOWN = [
 "My studies leave me emotionally exhausted.",
 "I feel \"wiped out\" at the end of a day at the Military Academy.",
 "I feel tired when I get up in the morning and think I have to face another day at the Military Academy.",
 "Studying or attending class leaves me tense.",
 "My studies leave me completely drained.",
 "I have been losing interest in my studies since I joined the Military Academy.",
 "I feel little enthusiasm about my studies.",
 "I feel increasingly cynical about the potential usefulness of my studies.",
 "I have doubts about the significance of my studies.",
 "I can effectively solve the problems that arise from my studies.",
 "I believe I participate positively in the classes I attend.",
 "I feel I am a good student.",
 "I feel stimulated when I achieve my academic goals.",
 "I have learned many interesting subjects during my course.",
 "During class, I feel I can keep up with the material effectively.",
]
assert len(EF_ITEMS_KNOWN) == 15
# ef16-ef18: no known wording (gap documented in SPSS_to_Firebird_Mapping.md section 3)

SATPES_STATEMENT = ("Rate how satisfied you feel with yourself, or in relation to your own person "
                     "(Personal satisfaction, Diener, 1995).")
CTRLVI_STATEMENT = ("Some people feel they have complete freedom of choice and control over their lives, "
                    "while others feel that what they do has no effect on what happens to them. Please use "
                    "the following scale to indicate the level of freedom of choice and control you feel "
                    "you have over how your life unfolds (Perceived Control of Life, Inglehart, 1998).")

GAP_STATEMENT = "[STATEMENT NOT IDENTIFIED - see GDX_HUMAN/2_relational.model.psychometrics/SPSS_to_Firebird_Mapping.md section 3/6]"


def build_items():
    """Returns (ITEMS dict, COLUMN_TO_ITEM dict). Rebuilt fresh each call so the
    generator can validate it against whatever columns are actually present in
    the current .sav."""
    items = {}
    item_id = 0

    def add_items(instrument_id, col_prefix, n, texts, response_type):
        nonlocal item_id
        for i in range(1, n + 1):
            item_id += 1
            col = f"{col_prefix}{i}"
            stmt = texts[i - 1] if texts and i - 1 < len(texts) and texts[i - 1] is not None else GAP_STATEMENT
            items[item_id] = dict(instrument=instrument_id, column=col, order=i, statement=stmt, type=response_type)

    add_items(1, "Ha", 30, HARDINESS_ITEMS, "LIKERT_5")
    add_items(2, "En", 14, ENGAGEMENT_ITEMS, "LIKERT_5")
    add_items(3, "AC", 28, AC_ITEMS, "LIKERT_5")
    add_items(4, "SV", 5, SV_ITEMS, "LIKERT_5")
    add_items(5, "ST", 5, ST_ITEMS, "LIKERT_5")
    add_items(6, "RP", 20, RP_ITEMS, "LIKERT_0_4")
    item_id += 1
    items[item_id] = dict(instrument=7, column="SatPes", order=1, statement=SATPES_STATEMENT, type="LIKERT_5")
    item_id += 1
    items[item_id] = dict(instrument=8, column="CtrlVi", order=1, statement=CTRLVI_STATEMENT, type="LIKERT_5")
    add_items(9, "ef", 18, EF_ITEMS_KNOWN + [None, None, None], "LIKERT_5")
    add_items(10, "an", 11, None, "LIKERT_5")
    add_items(11, "red", 5, None, "LIKERT_5")

    column_to_item = {v["column"]: k for k, v in items.items()}
    return items, column_to_item


def expected_columns():
    """All .sav columns this catalog knows how to map: ID, ano (context), the
    raw item columns, and the 21 pre-computed score columns."""
    items, _ = build_items()
    cols = {"ID", "ano"}
    cols.update(v["column"] for v in items.values())
    cols.update(v[2] for v in VARIABLES.values())
    return cols
