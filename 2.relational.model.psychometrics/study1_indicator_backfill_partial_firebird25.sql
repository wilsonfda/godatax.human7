/* ============================================================================
   Partial GDX_PSY_INDICATOR / GDX_PSY_INDICATOR_ITEM backfill for Study 1
   ("Predictors of Adaptability to Military Higher Education") (Firebird 2.5)

   Background: SPSS_to_Firebird_Mapping.md (2.relational.model.psychometrics)
   already documented, back in 2026-09, that this study's first load
   deliberately skipped the GDX_PSY_INDICATOR / GDX_PSY_INDICATOR_ITEM layer --
   "GDX_PSY_VARIABLE_RESULT is recommended for the first load ... evolving to
   GDX_PSY_INDICATOR/GDX_PSY_INDICATOR_RESULT later once the reverse items are
   confirmed with the scale's author." That confirmation never happened for
   most of this study's instruments -- see §6 gaps 1, 3, 4 of that document.

   This script resolves that "later" for the SUBSET of variables where no
   judgment call needs to be invented: either the exact item-to-variable
   split is already in that same document (Positivity Ratio), or the
   instrument maps 1:1 onto a single variable so there is no split to get
   wrong (Satisfaction With Life, Job Satisfaction, Personal Satisfaction,
   Perceived Control of Life) -- and the published source instrument itself
   is not reverse-keyed (see each block's comment below for the citation).

   REVERSED is set to 0 everywhere here specifically because these five
   instruments' own literature (Diener 1985; Judge & Klinger 2000;
   Fredrickson 2009; Diener 1995; Inglehart 1998) documents no reverse-keyed
   items -- NOT because reversal was checked against this dataset itself
   (which SPSS_to_Firebird_Mapping.md §6.4 explicitly says cannot be done
   without the original scoring key).

   ------------------------------------------------------------------------
   Deliberately NOT included (needs the original scoring key before any row
   can be written without inventing a judgment call -- same gap
   SPSS_to_Firebird_Mapping.md §6 items 1/3/4 already flagged and left open):

     - Hardiness (Ha1-Ha30 -> Commitment/Control/Challenge): which items
       belong to which of the 3 dimensions, AND which are reverse-scored,
       are both unknown ("needs the original author's scoring key").
     - Student Engagement Scale (En1-En14 -> Vigor/Dedication/Absorption):
       same problem, the item-to-dimension split itself is not documented
       anywhere this project can read today.
     - Career Adapt-Abilities Scale (AC1-AC28 -> Concern/Control/Curiosity/
       Confidence): same problem.
     - "Undocumented Organizational Block" (an1-an11 -> AnoOrg/SucProfFin/
       CondSocie/RealizPess): the scale itself has no known author or item
       wording, let alone a dimension split.
     - Red Tape (red1-red5 -> RedTap): single-index like the five included
       below, so item membership is unambiguous (all 5), but this scale is
       not a cited published instrument anywhere in this project's sources --
       no literature basis to assert REVERSED=0 the way the five below have.

   None of these six is addressed here. Backfilling them responsibly needs
   either the original "ESCALA PESQUISA PORTUGAL AMAN 2012.pptx" (no longer
   in this repository per SPSS_to_Firebird_Mapping.md's own header) or direct
   confirmation from the study's author.
   ============================================================================ */

SET TERM ^ ;

/* ---- Satisfaction With Life Scale (Diener, Emmons, Larson & Griffin, 1985) ----
   Single index, all 5 items (SV1-SV5, ID_INSTRUMENT=4) -> SATISFVIDA
   (ID_VARIABLE=11). The published SWLS has no reverse-keyed items. */
EXECUTE BLOCK AS
DECLARE VARIABLE ID BIGINT;
BEGIN
  INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, MEASUREMENT_UNIT, DIRECTION, MIN_VALUE, MAX_VALUE)
    VALUES (11, 'Satisfaction With Life (score)', 'Sum of the 5 items feeding this dimension (Diener et al., 1985 -- no reverse-keyed items in the published scale).', 'COMPOSITE_SUM', 'LIKERT_POINT', 'POSITIVE', 5, 25)
    RETURNING ID_INDICATOR INTO :ID;
  INSERT INTO GDX_PSY_INDICATOR_ITEM (ID_INDICATOR, ID_ITEM, WEIGHT, REVERSED)
    SELECT :ID, ID_ITEM, 1, 0 FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = 4;
END^

/* ---- Job Satisfaction Scale (Judge & Klinger, 2000) ----
   Single index, all 5 items (ST1-ST5, ID_INSTRUMENT=5) -> SATISFTRAB
   (ID_VARIABLE=12). Same non-reversed single-index family as SWLS. */
EXECUTE BLOCK AS
DECLARE VARIABLE ID BIGINT;
BEGIN
  INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, MEASUREMENT_UNIT, DIRECTION, MIN_VALUE, MAX_VALUE)
    VALUES (12, 'Job Satisfaction (score)', 'Sum of the 5 items feeding this dimension (Judge & Klinger, 2000 -- no reverse-keyed items in the published scale).', 'COMPOSITE_SUM', 'LIKERT_POINT', 'POSITIVE', 5, 25)
    RETURNING ID_INDICATOR INTO :ID;
  INSERT INTO GDX_PSY_INDICATOR_ITEM (ID_INDICATOR, ID_ITEM, WEIGHT, REVERSED)
    SELECT :ID, ID_ITEM, 1, 0 FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = 5;
END^

/* ---- Positivity Ratio Scale (Fredrickson, 2009; De Sousa, Goncalves & Rosinha, 2010) ----
   RP1-RP20 (ID_INSTRUMENT=6) splits into two variables, with the exact item
   numbers already on record in SPSS_to_Firebird_Mapping.md §2:
     Positive Emotions -> EmocPos (ID_VARIABLE=13): RP items 1,4,8,11,12,13,14,15,16,19
     Negative Emotions -> EmocNeg (ID_VARIABLE=14): RP items 2,3,5,6,7,9,10,17,18,20
   A frequency-of-emotion checklist (0=Not at all .. 4=Very much) -- no item
   is reverse-keyed in Fredrickson's method; "reversal" is not a concept that
   applies here the way it does for an agree/disagree Likert scale. */
EXECUTE BLOCK AS
DECLARE VARIABLE ID BIGINT;
BEGIN
  INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, MEASUREMENT_UNIT, DIRECTION, MIN_VALUE, MAX_VALUE)
    VALUES (13, 'Positive Emotions (score)', 'Sum of the 10 items feeding this dimension (Fredrickson, 2009 broaden-and-build positivity ratio; item numbers per SPSS_to_Firebird_Mapping.md).', 'COMPOSITE_SUM', 'LIKERT_POINT', 'POSITIVE', 0, 40)
    RETURNING ID_INDICATOR INTO :ID;
  INSERT INTO GDX_PSY_INDICATOR_ITEM (ID_INDICATOR, ID_ITEM, WEIGHT, REVERSED)
    SELECT :ID, ID_ITEM, 1, 0 FROM GDX_PSY_INSTRUMENT_ITEM
    WHERE ID_INSTRUMENT = 6 AND ITEM_ORDER IN (1,4,8,11,12,13,14,15,16,19);
END^

EXECUTE BLOCK AS
DECLARE VARIABLE ID BIGINT;
BEGIN
  INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, MEASUREMENT_UNIT, DIRECTION, MIN_VALUE, MAX_VALUE)
    VALUES (14, 'Negative Emotions (score)', 'Sum of the 10 items feeding this dimension (Fredrickson, 2009 broaden-and-build positivity ratio; item numbers per SPSS_to_Firebird_Mapping.md). DIRECTION is POSITIVE in the ordinary "higher number = more of the named thing" sense -- see GDX_VT_VARIABLE_VIRTUE_MAP.SCALE_POLARITY = NEGATIVE on this same variable for the separate "is a high score desirable" question.', 'COMPOSITE_SUM', 'LIKERT_POINT', 'POSITIVE', 0, 40)
    RETURNING ID_INDICATOR INTO :ID;
  INSERT INTO GDX_PSY_INDICATOR_ITEM (ID_INDICATOR, ID_ITEM, WEIGHT, REVERSED)
    SELECT :ID, ID_ITEM, 1, 0 FROM GDX_PSY_INSTRUMENT_ITEM
    WHERE ID_INSTRUMENT = 6 AND ITEM_ORDER IN (2,3,5,6,7,9,10,17,18,20);
END^

/* ---- Personal Satisfaction (Diener, 1995) ----
   Single item (ID_INSTRUMENT=7) -> SatPes (ID_VARIABLE=15). A single item
   has nothing to reverse relative to. */
EXECUTE BLOCK AS
DECLARE VARIABLE ID BIGINT;
BEGIN
  INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, MEASUREMENT_UNIT, DIRECTION, MIN_VALUE, MAX_VALUE)
    VALUES (15, 'Personal Satisfaction (score)', 'The single item feeding this dimension (Diener, 1995).', 'SINGLE_ITEM', 'LIKERT_POINT', 'POSITIVE', 1, 5)
    RETURNING ID_INDICATOR INTO :ID;
  INSERT INTO GDX_PSY_INDICATOR_ITEM (ID_INDICATOR, ID_ITEM, WEIGHT, REVERSED)
    SELECT :ID, ID_ITEM, 1, 0 FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = 7;
END^

/* ---- Perceived Control of Life (Inglehart, 1998) ----
   Single item (ID_INSTRUMENT=8) -> CtrlVi (ID_VARIABLE=16). */
EXECUTE BLOCK AS
DECLARE VARIABLE ID BIGINT;
BEGIN
  INSERT INTO GDX_PSY_INDICATOR (ID_VARIABLE, NAME, DESCRIPTION, INDICATOR_TYPE, MEASUREMENT_UNIT, DIRECTION, MIN_VALUE, MAX_VALUE)
    VALUES (16, 'Perceived Control of Life (score)', 'The single item feeding this dimension (Inglehart, 1998).', 'SINGLE_ITEM', 'LIKERT_POINT', 'POSITIVE', 1, 5)
    RETURNING ID_INDICATOR INTO :ID;
  INSERT INTO GDX_PSY_INDICATOR_ITEM (ID_INDICATOR, ID_ITEM, WEIGHT, REVERSED)
    SELECT :ID, ID_ITEM, 1, 0 FROM GDX_PSY_INSTRUMENT_ITEM WHERE ID_INSTRUMENT = 8;
END^

SET TERM ; ^

COMMIT;
