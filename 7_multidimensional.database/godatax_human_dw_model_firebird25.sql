/* ============================================================================
   GoDataX Human 7 DW - star schema (Firebird 2.5)
   Location: GDX_HUMAN/7_multidimensional.database/

   Purpose: a single analytical layer relating every perspective already
   modeled as separate OLTP schemas under GDX_HUMAN:
     - 2_relational.model.psychometrics -> GDX_PSY_*      (psychological/psychometric)
     - 3_septenary.constitution          -> GDX_PSY_SEPTENARY_LEVEL / GDX_PSY_SEPT_LEVEL_PSY_MAP  (metaphysical)
     - 4_kundalini.chakras               -> GDX_PSY_CHAKRA                                          (energetic)
     - 5_five.ways.tomas.aquino          -> GDX_TA_WAY / GDX_TA_WAY_SEPT_MAP                        (metaphysical)
     - 6_cardiac.coherence               -> GDX_CC_*                                                (physiological)

   Design decision (per explicit instruction): GDX_PSY_PERSON is the single,
   central person table for the whole DW. DW_DIM_PERSON is sourced from it
   ALONE -- there is no second/redundant person dimension for the cardiac
   coherence side. GDX_CC_PERSON is a separate OLTP table in its own schema,
   but for DW purposes GDX_CC_SESSION.ID_PERSON is treated as pointing into
   the SAME person space as GDX_PSY_PERSON.ID_PERSON (that is exactly why
   GDX_CC_PARTICIPANT/PARTICIPANT_ID were renamed to GDX_CC_PERSON/ID_PERSON
   earlier -- to make that shared key explicit). The ETL script
   (godatax_human_dw_etl_firebird25.sql) enforces this with a referential
   check before loading the cardiac fact, and skips/reports any
   GDX_CC_SESSION row whose ID_PERSON has no matching GDX_PSY_PERSON.

   Star schema shape:
     - Surrogate keys are NOT reinvented where the source already has a
       clean BIGINT primary key (DW_DIM_PERSON.ID_PERSON = GDX_PSY_PERSON.
       ID_PERSON, DW_DIM_VARIABLE.ID_VARIABLE = GDX_PSY_VARIABLE.ID_VARIABLE,
       etc.) -- reusing the source key avoids a redundant parallel ID space.
     - DW_DIM_DATE is the only generated dimension (no natural date PK in
       any source); DATE_KEY = -1 is the reserved "no date" member, used by
       fact rows that have no real calendar date (all psychometric facts --
       the .sav carries no timestamps, only person + study).
     - Every FACT table carries ID_PERSON directly (standard dimensional
       modeling practice, not redundancy: a fact's grain always includes its
       "who", and denormalizing that one FK onto the fact avoids forcing
       every query through an extra join to reach the person).
     - The metaphysical/energetic dimensions (DW_DIM_SEPTENARY_LEVEL,
       DW_DIM_CHAKRA, DW_DIM_FIVE_WAY) have NO fact of their own -- they are
       reached from the psychometric fact by walking DW_DIM_VARIABLE ->
       DW_DIM_SEPTENARY_LEVEL -> DW_DIM_CHAKRA / DW_DIM_FIVE_WAY. That single
       FK on DW_DIM_VARIABLE (not duplicated on the fact table) is what lets
       one query relate a psychometric score to "its" chakra and "its" way
       of Aquinas at once, without redundant copies of the level key.

   Prerequisites: all five OLTP scripts already applied AND loaded in the
   same database (this DW lives alongside its sources, not in a separate
   database -- see the ETL script's header for why).
   ============================================================================ */

/* ============================================================================
   DIMENSIONS
   ============================================================================ */

-- Central person dimension. Sourced ONLY from GDX_PSY_PERSON + GDX_PSY_STUDY_PARTICIPANT.
CREATE TABLE DW_DIM_PERSON (
  ID_PERSON BIGINT NOT NULL,
  EXTERNAL_IDENTIFIER VARCHAR(60),
  ANONYMOUS_CODE VARCHAR(60),
  CURRICULAR_GROUP VARCHAR(80),
  ID_STUDY BIGINT,
  STUDY_TITLE VARCHAR(200),
  CONSTRAINT PK_DW_DIM_PERSON PRIMARY KEY (ID_PERSON)
);

CREATE TABLE DW_DIM_INSTRUMENT (
  ID_INSTRUMENT BIGINT NOT NULL,
  NAME VARCHAR(160) NOT NULL,
  VERSION VARCHAR(30),
  TYPE VARCHAR(50),
  ACTIVE SMALLINT,
  CONSTRAINT PK_DW_DIM_INSTRUMENT PRIMARY KEY (ID_INSTRUMENT)
);

CREATE TABLE DW_DIM_CONSTRUCT (
  ID_CONSTRUCT BIGINT NOT NULL,
  NAME VARCHAR(120) NOT NULL,
  DOMAIN VARCHAR(60),
  CONSTRAINT PK_DW_DIM_CONSTRUCT PRIMARY KEY (ID_CONSTRUCT)
);

-- Metaphysical dimension (source: 3_septenary.constitution).
CREATE TABLE DW_DIM_SEPTENARY_LEVEL (
  ID_SEPTENARY_LEVEL BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  NAME VARCHAR(60) NOT NULL,
  TECHNICAL_NAME VARCHAR(80),
  NATURE VARCHAR(40),
  CONSCIOUSNESS_FUNCTION VARCHAR(500),
  CONSTRAINT PK_DW_DIM_SEPT_LEVEL PRIMARY KEY (ID_SEPTENARY_LEVEL)
);

-- Energetic dimension (source: 4_kundalini.chakras). FK to the metaphysical
-- dimension so a query can relate "chakra" and "septenary level" for free.
CREATE TABLE DW_DIM_CHAKRA (
  ID_CHAKRA BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  SANSKRIT_NAME VARCHAR(60) NOT NULL,
  COMMON_NAME VARCHAR(60) NOT NULL,
  SYMBOLIC_COLOR VARCHAR(40),
  SYMBOLIC_ELEMENT VARCHAR(40),
  ID_SEPTENARY_LEVEL BIGINT NOT NULL,
  CONSTRAINT PK_DW_DIM_CHAKRA PRIMARY KEY (ID_CHAKRA),
  CONSTRAINT FK_DW_DIM_CHAKRA_LEVEL FOREIGN KEY (ID_SEPTENARY_LEVEL)
    REFERENCES DW_DIM_SEPTENARY_LEVEL(ID_SEPTENARY_LEVEL)
);

-- Metaphysical dimension (source: 5_five.ways.tomas.aquino). FK to the same
-- septenary level dimension (N:1 -- several ways may share a level).
CREATE TABLE DW_DIM_FIVE_WAY (
  ID_WAY BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  LATIN_NAME VARCHAR(60) NOT NULL,
  ENGLISH_NAME VARCHAR(100) NOT NULL,
  ARGUMENT_TYPE VARCHAR(60),
  CONCLUSION VARCHAR(500),
  ID_SEPTENARY_LEVEL BIGINT,
  CONSTRAINT PK_DW_DIM_FIVE_WAY PRIMARY KEY (ID_WAY),
  CONSTRAINT FK_DW_DIM_WAY_LEVEL FOREIGN KEY (ID_SEPTENARY_LEVEL)
    REFERENCES DW_DIM_SEPTENARY_LEVEL(ID_SEPTENARY_LEVEL)
);

-- Psychometric variable/dimension. This is the hinge of the whole DW: it
-- carries the (optional) link into the metaphysical dimension, so the
-- psychometric fact reaches chakras/ways/levels through this ONE dimension,
-- with no extra FK duplicated on the fact table.
CREATE TABLE DW_DIM_VARIABLE (
  ID_VARIABLE BIGINT NOT NULL,
  NAME VARCHAR(150) NOT NULL,
  SAV_COLUMN VARCHAR(60),
  ID_CONSTRUCT BIGINT NOT NULL,
  ID_INSTRUMENT BIGINT,
  ID_SEPTENARY_LEVEL BIGINT,
  SEPT_LEVEL_CONFIDENCE VARCHAR(20),
  CONSTRAINT PK_DW_DIM_VARIABLE PRIMARY KEY (ID_VARIABLE),
  CONSTRAINT FK_DW_DIM_VAR_CONSTRUCT FOREIGN KEY (ID_CONSTRUCT)
    REFERENCES DW_DIM_CONSTRUCT(ID_CONSTRUCT),
  CONSTRAINT FK_DW_DIM_VAR_INSTRUMENT FOREIGN KEY (ID_INSTRUMENT)
    REFERENCES DW_DIM_INSTRUMENT(ID_INSTRUMENT),
  CONSTRAINT FK_DW_DIM_VAR_LEVEL FOREIGN KEY (ID_SEPTENARY_LEVEL)
    REFERENCES DW_DIM_SEPTENARY_LEVEL(ID_SEPTENARY_LEVEL)
);

CREATE TABLE DW_DIM_ITEM (
  ID_ITEM BIGINT NOT NULL,
  ID_INSTRUMENT BIGINT NOT NULL,
  ITEM_ORDER INTEGER,
  RESPONSE_TYPE VARCHAR(30),
  CONSTRAINT PK_DW_DIM_ITEM PRIMARY KEY (ID_ITEM),
  CONSTRAINT FK_DW_DIM_ITEM_INSTRUMENT FOREIGN KEY (ID_INSTRUMENT)
    REFERENCES DW_DIM_INSTRUMENT(ID_INSTRUMENT)
);

-- Physiological dimensions (source: 6_cardiac.coherence).
CREATE TABLE DW_DIM_DEVICE (
  DEVICE_ID BIGINT NOT NULL,
  MANUFACTURER VARCHAR(80),
  MODEL_NAME VARCHAR(80),
  DEVICE_TYPE VARCHAR(20),
  FIRMWARE_VERSION VARCHAR(40),
  CONSTRAINT PK_DW_DIM_DEVICE PRIMARY KEY (DEVICE_ID)
);

-- Session carries ID_PERSON directly (same central DW_DIM_PERSON) -- this is
-- how the physiological perspective enters the "no redundancy / one person
-- table" rule: there is no separate cardiac person dimension.
CREATE TABLE DW_DIM_SESSION (
  SESSION_ID BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  DEVICE_ID BIGINT NOT NULL,
  SIGNAL_TYPE VARCHAR(10),
  PROTOCOL_NAME VARCHAR(100),
  BODY_POSITION VARCHAR(20),
  ALGORITHM_NAME VARCHAR(100),
  STARTED_AT TIMESTAMP,
  ENDED_AT TIMESTAMP,
  CONSTRAINT PK_DW_DIM_SESSION PRIMARY KEY (SESSION_ID),
  CONSTRAINT FK_DW_DIM_SESS_PERSON FOREIGN KEY (ID_PERSON)
    REFERENCES DW_DIM_PERSON(ID_PERSON),
  CONSTRAINT FK_DW_DIM_SESS_DEVICE FOREIGN KEY (DEVICE_ID)
    REFERENCES DW_DIM_DEVICE(DEVICE_ID)
);

-- Generated calendar dimension. DATE_KEY = -1 is the reserved "no date"
-- member (used by all psychometric facts, which carry no calendar date).
CREATE TABLE DW_DIM_DATE (
  DATE_KEY INTEGER NOT NULL,
  FULL_DATE DATE,
  YEAR_NUM SMALLINT,
  MONTH_NUM SMALLINT,
  DAY_NUM SMALLINT,
  WEEKDAY_NUM SMALLINT,
  CONSTRAINT PK_DW_DIM_DATE PRIMARY KEY (DATE_KEY)
);

/* ============================================================================
   FACTS -- every numeric metric lives here, never in a dimension.
   ============================================================================ */

-- Grain: one row per (person, item) raw questionnaire response.
CREATE TABLE DW_FACT_PSY_ITEM_RESPONSE (
  FACT_ID BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  ID_ITEM BIGINT NOT NULL,
  ID_INSTRUMENT BIGINT NOT NULL,
  ID_APPLICATION BIGINT NOT NULL,
  NUMERIC_VALUE NUMERIC(12,4),
  CONSTRAINT PK_DW_FACT_PSY_RESP PRIMARY KEY (FACT_ID),
  CONSTRAINT UQ_DW_FACT_PSY_RESP UNIQUE (ID_PERSON, ID_ITEM),
  CONSTRAINT FK_DW_FPR_PERSON FOREIGN KEY (ID_PERSON) REFERENCES DW_DIM_PERSON(ID_PERSON),
  CONSTRAINT FK_DW_FPR_ITEM FOREIGN KEY (ID_ITEM) REFERENCES DW_DIM_ITEM(ID_ITEM),
  CONSTRAINT FK_DW_FPR_INSTRUMENT FOREIGN KEY (ID_INSTRUMENT) REFERENCES DW_DIM_INSTRUMENT(ID_INSTRUMENT)
);

-- Grain: one row per (person, variable) computed dimension score. This is
-- the fact that reaches every other perspective, via DW_DIM_VARIABLE's own
-- link to DW_DIM_SEPTENARY_LEVEL (-> DW_DIM_CHAKRA, DW_DIM_FIVE_WAY).
CREATE TABLE DW_FACT_PSY_VARIABLE_RESULT (
  FACT_ID BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  ID_VARIABLE BIGINT NOT NULL,
  ID_APPLICATION BIGINT NOT NULL,
  RAW_SCORE NUMERIC(14,4),
  STANDARDIZED_SCORE NUMERIC(14,4),
  PERCENTILE NUMERIC(6,2),
  CONSTRAINT PK_DW_FACT_PSY_VARRES PRIMARY KEY (FACT_ID),
  CONSTRAINT UQ_DW_FACT_PSY_VARRES UNIQUE (ID_PERSON, ID_VARIABLE),
  CONSTRAINT FK_DW_FVR_PERSON FOREIGN KEY (ID_PERSON) REFERENCES DW_DIM_PERSON(ID_PERSON),
  CONSTRAINT FK_DW_FVR_VARIABLE FOREIGN KEY (ID_VARIABLE) REFERENCES DW_DIM_VARIABLE(ID_VARIABLE)
);

-- Grain: one row per HRV/coherence window inside a cardiac coherence session.
CREATE TABLE DW_FACT_CC_HRV_WINDOW (
  FACT_ID BIGINT NOT NULL,
  ID_PERSON BIGINT NOT NULL,
  SESSION_ID BIGINT NOT NULL,
  DATE_KEY INTEGER NOT NULL,
  WINDOW_SECONDS INTEGER,
  VALID_BEAT_COUNT INTEGER,
  MEAN_RR_MS NUMERIC(10,3),
  MEAN_HEART_RATE_BPM NUMERIC(8,3),
  RMSSD_MS NUMERIC(10,3),
  SDNN_MS NUMERIC(10,3),
  RESPIRATORY_RATE NUMERIC(7,3),
  COHERENCE_INDEX NUMERIC(12,5),
  ARTIFACT_PERCENTAGE NUMERIC(6,3),
  PROTOCOL_PHASE VARCHAR(20),
  STRESS_CLASS VARCHAR(20),
  CONSTRAINT PK_DW_FACT_CC_HRV PRIMARY KEY (FACT_ID),
  CONSTRAINT FK_DW_FHW_PERSON FOREIGN KEY (ID_PERSON) REFERENCES DW_DIM_PERSON(ID_PERSON),
  CONSTRAINT FK_DW_FHW_SESSION FOREIGN KEY (SESSION_ID) REFERENCES DW_DIM_SESSION(SESSION_ID),
  CONSTRAINT FK_DW_FHW_DATE FOREIGN KEY (DATE_KEY) REFERENCES DW_DIM_DATE(DATE_KEY)
);

CREATE INDEX IX_DW_FPR_PERSON ON DW_FACT_PSY_ITEM_RESPONSE(ID_PERSON);
CREATE INDEX IX_DW_FPR_ITEM ON DW_FACT_PSY_ITEM_RESPONSE(ID_ITEM);
CREATE INDEX IX_DW_FVR_PERSON ON DW_FACT_PSY_VARIABLE_RESULT(ID_PERSON);
CREATE INDEX IX_DW_FVR_VARIABLE ON DW_FACT_PSY_VARIABLE_RESULT(ID_VARIABLE);
CREATE INDEX IX_DW_FHW_PERSON ON DW_FACT_CC_HRV_WINDOW(ID_PERSON);
CREATE INDEX IX_DW_FHW_SESSION ON DW_FACT_CC_HRV_WINDOW(SESSION_ID);
CREATE INDEX IX_DW_DIM_VAR_LEVEL ON DW_DIM_VARIABLE(ID_SEPTENARY_LEVEL);

/* Firebird 2.5: generators and triggers for the surrogate fact keys (dimension
   keys deliberately reuse the source system's own BIGINT key -- see header). */
CREATE SEQUENCE SEQ_DW_FACT_PSY_RESP;
CREATE SEQUENCE SEQ_DW_FACT_PSY_VARRES;
CREATE SEQUENCE SEQ_DW_FACT_CC_HRV;

SET TERM ^ ;

CREATE TRIGGER BI_DW_FACT_PSY_RESP FOR DW_FACT_PSY_ITEM_RESPONSE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.FACT_ID IS NULL) THEN NEW.FACT_ID = NEXT VALUE FOR SEQ_DW_FACT_PSY_RESP;
END^

CREATE TRIGGER BI_DW_FACT_PSY_VARRES FOR DW_FACT_PSY_VARIABLE_RESULT ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.FACT_ID IS NULL) THEN NEW.FACT_ID = NEXT VALUE FOR SEQ_DW_FACT_PSY_VARRES;
END^

CREATE TRIGGER BI_DW_FACT_CC_HRV FOR DW_FACT_CC_HRV_WINDOW ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.FACT_ID IS NULL) THEN NEW.FACT_ID = NEXT VALUE FOR SEQ_DW_FACT_CC_HRV;
END^

SET TERM ; ^
