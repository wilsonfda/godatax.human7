/* ============================================================================
   GoDataX Human 7 DW - ETL (Firebird 2.5)
   Location: GDX_HUMAN/7_multidimensional.database/

   Loads godatax_human_dw_model_firebird25.sql (this same folder) from the
   five OLTP schemas already applied/loaded in this database:
     GDX_PSY_*  (2_relational.model.psychometrics)
     GDX_PSY_SEPTENARY_LEVEL / GDX_PSY_SEPT_LEVEL_PSY_MAP (3_septenary.constitution)
     GDX_PSY_CHAKRA (4_kundalini.chakras)
     GDX_TA_*   (5_five.ways.tomas.aquino)
     GDX_CC_*   (6_cardiac.coherence)

   Why plain SQL and not a host-language script: source and target live in
   the SAME Firebird database (godatax.human) -- this is a same-database
   star-schema build, not a cross-database migration, so INSERT/SELECT (plus
   two small PSQL reconciliation blocks where Firebird 2.5 has no better tool)
   is both simpler and more transparent than routing the data through an
   external process.

   Apply order: run this file top to bottom, once, after
   godatax_human_dw_model_firebird25.sql. Every INSERT/SELECT is idempotent-
   safe to inspect (SELECT-only) but NOT safe to re-run blindly (the fact/
   dimension tables have no "already loaded" guard) -- if you need to reload,
   truncate the DW_* tables first (never the GDX_PSY_*, GDX_CC_* or GDX_TA_*
   source tables).
   ============================================================================ */

/* ----------------------------------------------------------------------------
   1) DW_DIM_DATE -- generated calendar, 2020-01-01..2030-12-31, plus the
      reserved DATE_KEY = -1 "no date" member used by every psychometric fact
      (the .sav carries no calendar date, only person + study).
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_DATE (DATE_KEY, FULL_DATE, YEAR_NUM, MONTH_NUM, DAY_NUM, WEEKDAY_NUM)
VALUES (-1, NULL, NULL, NULL, NULL, NULL);

SET TERM ^ ;
EXECUTE BLOCK AS
DECLARE VARIABLE D DATE;
BEGIN
  D = DATE '2020-01-01';
  WHILE (D <= DATE '2030-12-31') DO
  BEGIN
    INSERT INTO DW_DIM_DATE (DATE_KEY, FULL_DATE, YEAR_NUM, MONTH_NUM, DAY_NUM, WEEKDAY_NUM)
    VALUES (EXTRACT(YEAR FROM :D) * 10000 + EXTRACT(MONTH FROM :D) * 100 + EXTRACT(DAY FROM :D),
            :D, EXTRACT(YEAR FROM :D), EXTRACT(MONTH FROM :D), EXTRACT(DAY FROM :D), EXTRACT(WEEKDAY FROM :D));
    D = D + 1;
  END
END^
SET TERM ; ^

/* ----------------------------------------------------------------------------
   2) DW_DIM_PERSON -- the single central person dimension. Source: ONLY
      GDX_PSY_PERSON (+ GDX_PSY_STUDY_PARTICIPANT/GDX_PSY_STUDY for
      descriptive attributes). GDX_CC_PERSON is intentionally NOT a source
      here (see the model script's header).
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_PERSON (ID_PERSON, EXTERNAL_IDENTIFIER, ANONYMOUS_CODE, CURRICULAR_GROUP, ID_STUDY, STUDY_TITLE)
SELECT
  P.ID_PERSON,
  P.EXTERNAL_IDENTIFIER,
  SP.ANONYMOUS_CODE,
  SP.EXPERIMENTAL_GROUP,
  SP.ID_STUDY,
  ST.TITLE
FROM GDX_PSY_PERSON P
LEFT JOIN GDX_PSY_STUDY_PARTICIPANT SP ON SP.ID_PERSON = P.ID_PERSON
LEFT JOIN GDX_PSY_STUDY ST ON ST.ID_STUDY = SP.ID_STUDY;

/* ----------------------------------------------------------------------------
   3) DW_DIM_INSTRUMENT, DW_DIM_CONSTRUCT -- straight copies.
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, ACTIVE)
SELECT ID_INSTRUMENT, NAME, VERSION, TYPE, ACTIVE FROM GDX_PSY_INSTRUMENT;

INSERT INTO DW_DIM_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN)
SELECT ID_CONSTRUCT, NAME, DOMAIN FROM GDX_PSY_CONSTRUCT;

/* ----------------------------------------------------------------------------
   4) DW_DIM_SEPTENARY_LEVEL -- straight copy (metaphysical, folder 3).
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
SELECT ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION
FROM GDX_PSY_SEPTENARY_LEVEL;

/* ----------------------------------------------------------------------------
   5) DW_DIM_CHAKRA -- straight copy (energetic, folder 4).
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_CHAKRA (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT, ID_SEPTENARY_LEVEL)
SELECT ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT, ID_SEPTENARY_LEVEL
FROM GDX_PSY_CHAKRA;

/* ----------------------------------------------------------------------------
   6) DW_DIM_FIVE_WAY -- copy + resolved septenary level (metaphysical, folder 5).
      GDX_TA_WAY_SEPT_MAP is N:1 by design (a way could get a second mapping
      row later); FIRST 1 keeps this load deterministic if that ever happens.
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_FIVE_WAY (ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, CONCLUSION, ID_SEPTENARY_LEVEL)
SELECT
  W.ID_WAY, W.ORDER_NUM, W.LATIN_NAME, W.ENGLISH_NAME, W.ARGUMENT_TYPE, W.CONCLUSION,
  (SELECT FIRST 1 M.ID_SEPTENARY_LEVEL FROM GDX_TA_WAY_SEPT_MAP M WHERE M.ID_WAY = W.ID_WAY)
FROM GDX_TA_WAY W;

/* ----------------------------------------------------------------------------
   7) DW_DIM_VARIABLE -- the hinge dimension. Base copy first (instrument
      resolved via the GDX_PSY_INSTRUMENT_CONSTRUCT bridge, FIRST 1 since it
      is 1:1 in this dataset; SAV_COLUMN parsed out of OPERATIONAL_DEFINITION,
      format ".sav column: <col> (mean of the dimension's items, 0-5)").
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_VARIABLE (ID_VARIABLE, NAME, SAV_COLUMN, ID_CONSTRUCT, ID_INSTRUMENT)
SELECT
  V.ID_VARIABLE,
  V.NAME,
  CASE WHEN POSITION('.sav column: ' IN V.OPERATIONAL_DEFINITION) > 0 THEN
    CASE WHEN POSITION(' (' IN SUBSTRING(V.OPERATIONAL_DEFINITION FROM 14)) > 0 THEN
      SUBSTRING(V.OPERATIONAL_DEFINITION FROM 14 FOR POSITION(' (' IN SUBSTRING(V.OPERATIONAL_DEFINITION FROM 14)) - 1)
    ELSE
      SUBSTRING(V.OPERATIONAL_DEFINITION FROM 14)
    END
  ELSE NULL END,
  V.ID_CONSTRUCT,
  (SELECT FIRST 1 IC.ID_INSTRUMENT FROM GDX_PSY_INSTRUMENT_CONSTRUCT IC WHERE IC.ID_CONSTRUCT = V.ID_CONSTRUCT)
FROM GDX_PSY_VARIABLE V;

/* Reconciliation: GDX_PSY_SEPT_LEVEL_PSY_MAP was populated (see
   3_septenary.constitution) before the GDX_PSY_VARIABLE catalog existed, so
   its ID_VARIABLE column is NULL for every row -- only the free-text
   VARIABLE_LABEL ("<dimension> -> <.sav column>") carries the link. Resolve
   it here, for the DW copy only; the OLTP table itself is left untouched. */
SET TERM ^ ;
EXECUTE BLOCK AS
DECLARE VARIABLE VAR_ID BIGINT;
DECLARE VARIABLE SAV_COL VARCHAR(60);
DECLARE VARIABLE LEVEL_ID BIGINT;
DECLARE VARIABLE CONF VARCHAR(20);
BEGIN
  FOR SELECT ID_VARIABLE, SAV_COLUMN FROM DW_DIM_VARIABLE WHERE SAV_COLUMN IS NOT NULL
    INTO :VAR_ID, :SAV_COL
  DO BEGIN
    LEVEL_ID = NULL;
    CONF = NULL;
    SELECT FIRST 1 ID_SEPTENARY_LEVEL, CONFIDENCE_LEVEL
      FROM GDX_PSY_SEPT_LEVEL_PSY_MAP
      WHERE VARIABLE_LABEL CONTAINING ('-> ' || :SAV_COL)
      INTO :LEVEL_ID, :CONF;

    IF (LEVEL_ID IS NOT NULL) THEN
      UPDATE DW_DIM_VARIABLE SET ID_SEPTENARY_LEVEL = :LEVEL_ID, SEPT_LEVEL_CONFIDENCE = :CONF
      WHERE ID_VARIABLE = :VAR_ID;
  END
END^
SET TERM ; ^

/* ----------------------------------------------------------------------------
   8) DW_DIM_ITEM -- straight copy.
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_ITEM (ID_ITEM, ID_INSTRUMENT, ITEM_ORDER, RESPONSE_TYPE)
SELECT ID_ITEM, ID_INSTRUMENT, ITEM_ORDER, RESPONSE_TYPE FROM GDX_PSY_INSTRUMENT_ITEM;

/* ----------------------------------------------------------------------------
   9) DW_DIM_DEVICE -- straight copy (physiological, folder 6).
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_DEVICE (DEVICE_ID, MANUFACTURER, MODEL_NAME, DEVICE_TYPE, FIRMWARE_VERSION)
SELECT DEVICE_ID, MANUFACTURER, MODEL_NAME, DEVICE_TYPE, FIRMWARE_VERSION FROM GDX_CC_DEVICE;

/* ----------------------------------------------------------------------------
   10) DW_DIM_SESSION -- only sessions whose ID_PERSON already exists in
       DW_DIM_PERSON are loaded (enforces the "GDX_PSY_PERSON is the single
       central person table" rule instead of silently FK-violating or
       inventing a placeholder person). Anything skipped is listed by the
       diagnostic SELECT right after.
   ---------------------------------------------------------------------------- */
INSERT INTO DW_DIM_SESSION (SESSION_ID, ID_PERSON, DEVICE_ID, SIGNAL_TYPE, PROTOCOL_NAME, BODY_POSITION, ALGORITHM_NAME, STARTED_AT, ENDED_AT)
SELECT S.SESSION_ID, S.ID_PERSON, S.DEVICE_ID, S.SIGNAL_TYPE, S.PROTOCOL_NAME, S.BODY_POSITION, S.ALGORITHM_NAME, S.STARTED_AT, S.ENDED_AT
FROM GDX_CC_SESSION S
WHERE EXISTS (SELECT 1 FROM DW_DIM_PERSON P WHERE P.ID_PERSON = S.ID_PERSON);

-- Diagnostic: sessions skipped because their ID_PERSON has no match in
-- GDX_PSY_PERSON. Run this by hand after the ETL and investigate before
-- assuming the cardiac fact is complete.
-- SELECT S.SESSION_ID, S.ID_PERSON FROM GDX_CC_SESSION S
--   WHERE NOT EXISTS (SELECT 1 FROM DW_DIM_PERSON P WHERE P.ID_PERSON = S.ID_PERSON);

/* ----------------------------------------------------------------------------
   11) DW_FACT_PSY_ITEM_RESPONSE
   ---------------------------------------------------------------------------- */
INSERT INTO DW_FACT_PSY_ITEM_RESPONSE (ID_PERSON, ID_ITEM, ID_INSTRUMENT, ID_APPLICATION, NUMERIC_VALUE)
SELECT A.ID_PERSON, R.ID_ITEM, I.ID_INSTRUMENT, R.ID_APPLICATION, R.NUMERIC_VALUE
FROM GDX_PSY_ITEM_RESPONSE R
JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = R.ID_APPLICATION
JOIN GDX_PSY_INSTRUMENT_ITEM I ON I.ID_ITEM = R.ID_ITEM;

/* ----------------------------------------------------------------------------
   12) DW_FACT_PSY_VARIABLE_RESULT
   ---------------------------------------------------------------------------- */
INSERT INTO DW_FACT_PSY_VARIABLE_RESULT (ID_PERSON, ID_VARIABLE, ID_APPLICATION, RAW_SCORE, STANDARDIZED_SCORE, PERCENTILE)
SELECT A.ID_PERSON, VR.ID_VARIABLE, VR.ID_APPLICATION, VR.RAW_SCORE, VR.STANDARDIZED_SCORE, VR.PERCENTILE
FROM GDX_PSY_VARIABLE_RESULT VR
JOIN GDX_PSY_APPLICATION A ON A.ID_APPLICATION = VR.ID_APPLICATION;

/* ----------------------------------------------------------------------------
   13) DW_FACT_CC_HRV_WINDOW -- same "person must already be in DW_DIM_PERSON"
       rule as step 10 (a window's session was already filtered there, so
       joining DW_DIM_SESSION instead of GDX_CC_SESSION directly is what
       enforces it here).
   ---------------------------------------------------------------------------- */
INSERT INTO DW_FACT_CC_HRV_WINDOW
  (ID_PERSON, SESSION_ID, DATE_KEY, WINDOW_SECONDS, VALID_BEAT_COUNT, MEAN_RR_MS, MEAN_HEART_RATE_BPM,
   RMSSD_MS, SDNN_MS, RESPIRATORY_RATE, COHERENCE_INDEX, ARTIFACT_PERCENTAGE, PROTOCOL_PHASE, STRESS_CLASS)
SELECT
  DS.ID_PERSON, W.SESSION_ID,
  EXTRACT(YEAR FROM W.WINDOW_STARTED_AT) * 10000 + EXTRACT(MONTH FROM W.WINDOW_STARTED_AT) * 100 + EXTRACT(DAY FROM W.WINDOW_STARTED_AT),
  W.WINDOW_SECONDS, W.VALID_BEAT_COUNT, W.MEAN_RR_MS, W.MEAN_HEART_RATE_BPM,
  W.RMSSD_MS, W.SDNN_MS, W.RESPIRATORY_RATE, W.COHERENCE_INDEX, W.ARTIFACT_PERCENTAGE, W.PROTOCOL_PHASE, W.STRESS_CLASS
FROM GDX_CC_HRV_WINDOW W
JOIN DW_DIM_SESSION DS ON DS.SESSION_ID = W.SESSION_ID;

COMMIT;

/* ----------------------------------------------------------------------------
   Post-load sanity counts -- run by hand and compare against the source
   tables (e.g. DW_DIM_PERSON should equal COUNT(*) FROM GDX_PSY_PERSON;
   DW_DIM_VARIABLE rows with ID_SEPTENARY_LEVEL NOT NULL should equal the
   number of GDX_PSY_SEPT_LEVEL_PSY_MAP rows whose SAV column matched one of
   the 21 GDX_PSY_VARIABLE rows -- currently 16 of 18, since two mapping rows
   reference things that are not GDX_PSY_VARIABLE columns at all: the
   Burnout "Emotional Exhaustion" row (no computed score exists in the .sav,
   see SPSS_to_Firebird_Mapping.md section 3) and the RP "Positive/Negative
   Emotions" combined row (its label lists two columns, EmocPos / EmocNeg,
   which are already covered individually by two other mapping rows).
   ---------------------------------------------------------------------------- */
-- SELECT COUNT(*) FROM DW_DIM_PERSON;
-- SELECT COUNT(*) FROM DW_DIM_VARIABLE WHERE ID_SEPTENARY_LEVEL IS NOT NULL;
-- SELECT COUNT(*) FROM DW_FACT_PSY_ITEM_RESPONSE;
-- SELECT COUNT(*) FROM DW_FACT_PSY_VARIABLE_RESULT;
-- SELECT COUNT(*) FROM DW_FACT_CC_HRV_WINDOW;
