/* ============================================================================
   Relational model - Environmental & Anomalous Phenomena (Firebird 2.5)
   New module: 15.environmental.anomalous.phenomena

   Prerequisite: 2.relational.model.psychometrics/psychometrics_model_firebird25.sql
   already applied (GDX_PSY_PERSON must exist for the FK on every table below).

   Source: four reference images under
   GDX_CTP_H7/GDX_DOCUMENTS/GDX_HUMAN/ph/ (tabelas.png, sensores_equipamentos.png,
   captacao.png, linha_tempo.png), describing an instrumented-monitoring pipeline
   for anomalous/environmental-phenomena investigation (locations, sensors,
   sessions, events, raw observations, media, analysis and interpretation),
   whose sensor timeline is meant to be correlated against a person's
   psychometric / physiological / cardiac-coherence data (linha_tempo.png:
   "Correlacionado com Dados Psicometricos - Fisiologicos - Coerencia Cardiaca").

   Naming: the four images use lower_snake_case table/column names and
   "<entity>_id" primary keys (e.g. "sensors.sensor_id"). Per explicit
   instruction, every identifier here instead follows the UPPERCASE,
   "ID_<ENTITY>"-prefixed convention already established by
   2.relational.model.psychometrics/psychometrics_model_firebird25.sql (e.g.
   ID_STUDY, ID_PERSON, ID_VARIABLE) -- never the images' own "<entity>_id"
   spelling. All 15 tables carry the GDX_PH_ prefix (Environmental/
   Phenomena), per instruction.

   GDX_PH_ prefix map to the four images' table names (all lowercase in the
   source images):
     GDX_PH_LOCATION              <- locations
     GDX_PH_SENSOR_TYPE           <- sensor_types
     GDX_PH_SENSOR                <- sensors
     GDX_PH_ENVIRONMENT_CONDITION <- environment_conditions
     GDX_PH_SESSION               <- sessions
     GDX_PH_EVENT                 <- events
     GDX_PH_MEDIA_FILE            <- media_files
     GDX_PH_EVENT_TAG             <- event_tags
     GDX_PH_OBSERVATION           <- observations
     GDX_PH_ANALYSIS_RESULT       <- analysis_results
     GDX_PH_INTERPRETATION        <- interpretations
     GDX_PH_SENSOR_CALIBRATION    <- sensor_calibration
     GDX_PH_USER                  <- users
     GDX_PH_REFERENCE_DATA        <- reference_data
     GDX_PH_EVENT_VAR_MAP         <- not in the source images; added per a
                                      later, separate instruction -- see its
                                      own header comment below for why it is
                                      keyed on GDX_PH_EVENT rather than
                                      GDX_PH_SESSION.

   ID_PERSON on every table: per explicit instruction, every GDX_PH_ table
   below carries a nullable ID_PERSON BIGINT with an FK to
   GDX_PSY_PERSON(ID_PERSON) -- applied uniformly across all 15 tables,
   including the pure catalog/configuration ones (GDX_PH_LOCATION,
   GDX_PH_SENSOR_TYPE, GDX_PH_SENSOR, GDX_PH_USER, GDX_PH_REFERENCE_DATA)
   where it is not strictly required by the data's own meaning -- the same
   way GDX_PSY_STUDY_PARTICIPANT/GDX_PSY_APPLICATION link participant data to
   GDX_PSY_PERSON elsewhere in this project, just extended here to the whole
   module rather than only to the session-level tables. Nullable everywhere
   (a sensor catalog row, a location, or a baseline/unattended session may
   have no single person associated), never NOT NULL.

   Naming collisions avoided vs. the images' own column names (both because
   several of these are SQL-adjacent words and because the images repeat the
   same generic column name, e.g. "type", "unit", "notes", "timestamp", across
   multiple otherwise-unrelated tables):
     - "type" -> LOCATION_TYPE / SESSION_TYPE (EVENT_TYPE and FILE_TYPE were
       already specific in the source images and are kept as-is).
     - "timestamp" -> MEASURED_AT (TIMESTAMP is a Firebird data type keyword;
       column reuses the same name already used for this purpose in
       GDX_PSY_STUDY.START_DATE-style fields elsewhere in this project).
     - analysis_results."interpretation" -> INTERPRETATION_NOTE, to not clash
       in meaning with the separate, more structured GDX_PH_INTERPRETATION
       table that already exists for the same concept.
     - reference_data."parameter"/"source" -> PARAMETER_NAME / SOURCE_REFERENCE.

   Auxiliary object names (PK/FK/UQ/CK/IX/SEQ/trigger) use the short per-table
   codes below instead of the full table name, to stay within Firebird 2.5's
   31-character identifier limit (GDX_PH_ENVIRONMENT_CONDITION alone is 28
   chars; SEQ_/BI_ prefixed on top of it would overflow):
     LOCATION              -> LOC
     SENSOR_TYPE            -> STYP
     SENSOR                 -> SEN
     ENVIRONMENT_CONDITION   -> ENVC
     SESSION                 -> SESS
     EVENT                   -> EVT
     MEDIA_FILE              -> MED
     EVENT_TAG               -> ETAG
     OBSERVATION             -> OBS
     ANALYSIS_RESULT         -> ANA
     INTERPRETATION          -> INTP
     SENSOR_CALIBRATION      -> CAL
     USER                    -> USR
     REFERENCE_DATA          -> REF
     EVENT_VAR_MAP           -> EVM

   Surrogate keys: every ID_* primary key is BIGINT, assigned by a
   BEFORE INSERT trigger from a dedicated sequence whenever a row is inserted
   with that column left NULL -- the same "never hardcode an id, let the
   trigger assign it" convention used by every module added after the
   original base schema (12.gdx.virtology/virtology_model_firebird25.sql,
   4.kundalini.chakras/chakras_model_firebird25.sql), which is what lets a
   loader script insert a parent row and immediately reuse its generated id
   for a child row in the same transaction via RETURNING ... INTO.

   CHECK-constrained enumerations below (LOCATION_TYPE, SENSOR.STATUS,
   MEDIA_FILE.FILE_TYPE, OBSERVATION.QUALITY_FLAG, INTERPRETATION.CATEGORY,
   INTERPRETATION.CONFIDENCE_LEVEL) are a judgment call made for this DDL,
   not given verbatim by the source images (which only show free-text
   examples, e.g. "question/stimulus/etc", "environmental/paranormal/etc").
   CONFIDENCE_LEVEL reuses the exact HIGH/MEDIUM/LOW/SPECULATIVE domain
   already used throughout this project's other "_MAP"/interpretation tables
   (e.g. GDX_VT_VARIABLE_VIRTUE_MAP). SESSION_TYPE and EVENT_TYPE are left as
   free VARCHAR with no CHECK (open-ended by design, matching the images'
   "baseline/experiment" and "question/stimulus/etc" wording, and mirroring
   how GDX_PSY_INSTRUMENT.TYPE is likewise an uncons trained free VARCHAR
   elsewhere in this project).

   This script only creates tables/sequences/triggers/indexes -- no DML.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   GDX_PH_LOCATION  (short code: LOC)  <- locations
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_LOCATION (
  ID_LOCATION BIGINT NOT NULL,
  ID_PERSON BIGINT,
  NAME VARCHAR(160) NOT NULL,
  LOCATION_TYPE VARCHAR(20) DEFAULT 'INDOOR' NOT NULL,
  LATITUDE NUMERIC(9,6),
  LONGITUDE NUMERIC(9,6),
  ALTITUDE NUMERIC(8,2),
  DESCRIPTION VARCHAR(1000),
  CONSTRAINT PK_GDX_PH_LOC PRIMARY KEY (ID_LOCATION),
  CONSTRAINT FK_GDX_PH_LOC_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT CK_GDX_PH_LOC_TYPE CHECK (LOCATION_TYPE IN ('INDOOR','OUTDOOR'))
);

CREATE INDEX IX_GDX_PH_LOC_PERSON ON GDX_PH_LOCATION(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_LOC;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_LOC FOR GDX_PH_LOCATION ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_LOCATION IS NULL) THEN
    NEW.ID_LOCATION = NEXT VALUE FOR SEQ_GDX_PH_LOC;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_SENSOR_TYPE  (short code: STYP)  <- sensor_types
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_SENSOR_TYPE (
  ID_SENSOR_TYPE BIGINT NOT NULL,
  ID_PERSON BIGINT,
  NAME VARCHAR(120) NOT NULL,
  DIMENSION VARCHAR(60) NOT NULL,
  UNIT VARCHAR(40),
  DESCRIPTION VARCHAR(500),
  CONSTRAINT PK_GDX_PH_STYP PRIMARY KEY (ID_SENSOR_TYPE),
  CONSTRAINT FK_GDX_PH_STYP_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_PH_STYP_NAME UNIQUE (NAME)
);

CREATE INDEX IX_GDX_PH_STYP_PERSON ON GDX_PH_SENSOR_TYPE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_STYP;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_STYP FOR GDX_PH_SENSOR_TYPE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_SENSOR_TYPE IS NULL) THEN
    NEW.ID_SENSOR_TYPE = NEXT VALUE FOR SEQ_GDX_PH_STYP;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_SENSOR  (short code: SEN)  <- sensors
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_SENSOR (
  ID_SENSOR BIGINT NOT NULL,
  ID_SENSOR_TYPE BIGINT NOT NULL,
  ID_LOCATION BIGINT,
  ID_PERSON BIGINT,
  NAME VARCHAR(160) NOT NULL,
  MODEL VARCHAR(120),
  MANUFACTURER VARCHAR(120),
  SERIAL_NUMBER VARCHAR(80),
  STATUS VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
  INSTALLATION_DATE DATE,
  CONSTRAINT PK_GDX_PH_SEN PRIMARY KEY (ID_SENSOR),
  CONSTRAINT FK_GDX_PH_SEN_TYPE FOREIGN KEY (ID_SENSOR_TYPE) REFERENCES GDX_PH_SENSOR_TYPE(ID_SENSOR_TYPE),
  CONSTRAINT FK_GDX_PH_SEN_LOC FOREIGN KEY (ID_LOCATION) REFERENCES GDX_PH_LOCATION(ID_LOCATION),
  CONSTRAINT FK_GDX_PH_SEN_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT CK_GDX_PH_SEN_STATUS CHECK (STATUS IN ('ACTIVE','INACTIVE','MAINTENANCE','RETIRED'))
);

CREATE INDEX IX_GDX_PH_SEN_TYPE ON GDX_PH_SENSOR(ID_SENSOR_TYPE);
CREATE INDEX IX_GDX_PH_SEN_LOC ON GDX_PH_SENSOR(ID_LOCATION);
CREATE INDEX IX_GDX_PH_SEN_PERSON ON GDX_PH_SENSOR(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_SEN;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_SEN FOR GDX_PH_SENSOR ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_SENSOR IS NULL) THEN
    NEW.ID_SENSOR = NEXT VALUE FOR SEQ_GDX_PH_SEN;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_ENVIRONMENT_CONDITION  (short code: ENVC)  <- environment_conditions
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_ENVIRONMENT_CONDITION (
  ID_ENVIRONMENT_CONDITION BIGINT NOT NULL,
  ID_LOCATION BIGINT NOT NULL,
  ID_PERSON BIGINT,
  MEASURED_AT TIMESTAMP NOT NULL,
  TEMPERATURE_C NUMERIC(6,2),
  HUMIDITY_PCT NUMERIC(5,2),
  PRESSURE_HPA NUMERIC(8,2),
  CO2_PPM NUMERIC(10,2),
  VOC_PPB NUMERIC(10,2),
  NOTES VARCHAR(1000),
  CONSTRAINT PK_GDX_PH_ENVC PRIMARY KEY (ID_ENVIRONMENT_CONDITION),
  CONSTRAINT FK_GDX_PH_ENVC_LOC FOREIGN KEY (ID_LOCATION) REFERENCES GDX_PH_LOCATION(ID_LOCATION),
  CONSTRAINT FK_GDX_PH_ENVC_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON)
);

CREATE INDEX IX_GDX_PH_ENVC_LOC ON GDX_PH_ENVIRONMENT_CONDITION(ID_LOCATION);
CREATE INDEX IX_GDX_PH_ENVC_PERSON ON GDX_PH_ENVIRONMENT_CONDITION(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_ENVC;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_ENVC FOR GDX_PH_ENVIRONMENT_CONDITION ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_ENVIRONMENT_CONDITION IS NULL) THEN
    NEW.ID_ENVIRONMENT_CONDITION = NEXT VALUE FOR SEQ_GDX_PH_ENVC;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_SESSION  (short code: SESS)  <- sessions
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_SESSION (
  ID_SESSION BIGINT NOT NULL,
  ID_LOCATION BIGINT NOT NULL,
  ID_PERSON BIGINT,
  START_TIME TIMESTAMP NOT NULL,
  END_TIME TIMESTAMP,
  SESSION_TYPE VARCHAR(30) DEFAULT 'EXPERIMENT' NOT NULL,
  DESCRIPTION VARCHAR(1000),
  OPERATOR VARCHAR(150),
  ENVIRONMENT_NOTES VARCHAR(1000),
  CONSTRAINT PK_GDX_PH_SESS PRIMARY KEY (ID_SESSION),
  CONSTRAINT FK_GDX_PH_SESS_LOC FOREIGN KEY (ID_LOCATION) REFERENCES GDX_PH_LOCATION(ID_LOCATION),
  CONSTRAINT FK_GDX_PH_SESS_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON)
);

CREATE INDEX IX_GDX_PH_SESS_LOC ON GDX_PH_SESSION(ID_LOCATION);
CREATE INDEX IX_GDX_PH_SESS_PERSON ON GDX_PH_SESSION(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_SESS;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_SESS FOR GDX_PH_SESSION ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_SESSION IS NULL) THEN
    NEW.ID_SESSION = NEXT VALUE FOR SEQ_GDX_PH_SESS;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_EVENT  (short code: EVT)  <- events
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_EVENT (
  ID_EVENT BIGINT NOT NULL,
  ID_SESSION BIGINT NOT NULL,
  ID_PERSON BIGINT,
  EVENT_TIME TIMESTAMP NOT NULL,
  EVENT_TYPE VARCHAR(30) NOT NULL,
  DESCRIPTION VARCHAR(1000),
  EXPECTED_RESPONSE VARCHAR(500),
  TAG VARCHAR(100),
  CONSTRAINT PK_GDX_PH_EVT PRIMARY KEY (ID_EVENT),
  CONSTRAINT FK_GDX_PH_EVT_SESS FOREIGN KEY (ID_SESSION) REFERENCES GDX_PH_SESSION(ID_SESSION),
  CONSTRAINT FK_GDX_PH_EVT_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON)
);

CREATE INDEX IX_GDX_PH_EVT_SESS ON GDX_PH_EVENT(ID_SESSION);
CREATE INDEX IX_GDX_PH_EVT_PERSON ON GDX_PH_EVENT(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_EVT;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_EVT FOR GDX_PH_EVENT ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_EVENT IS NULL) THEN
    NEW.ID_EVENT = NEXT VALUE FOR SEQ_GDX_PH_EVT;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_MEDIA_FILE  (short code: MED)  <- media_files
   Judgment call: ID_EVENT is NOT NULL (every media file documents one
   event, the diagram's primary arrow); ID_SENSOR is nullable (a handheld
   photo/video may not come from a registered GDX_PH_SENSOR row).
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_MEDIA_FILE (
  ID_MEDIA_FILE BIGINT NOT NULL,
  ID_EVENT BIGINT NOT NULL,
  ID_SENSOR BIGINT,
  ID_PERSON BIGINT,
  FILE_PATH VARCHAR(500) NOT NULL,
  FILE_TYPE VARCHAR(20) NOT NULL,
  THUMBNAIL_PATH VARCHAR(500),
  METADATA BLOB SUB_TYPE TEXT,
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_GDX_PH_MED PRIMARY KEY (ID_MEDIA_FILE),
  CONSTRAINT FK_GDX_PH_MED_EVT FOREIGN KEY (ID_EVENT) REFERENCES GDX_PH_EVENT(ID_EVENT),
  CONSTRAINT FK_GDX_PH_MED_SEN FOREIGN KEY (ID_SENSOR) REFERENCES GDX_PH_SENSOR(ID_SENSOR),
  CONSTRAINT FK_GDX_PH_MED_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT CK_GDX_PH_MED_FTYPE CHECK (FILE_TYPE IN ('AUDIO','VIDEO','IMAGE','DOCUMENT','OTHER'))
);

CREATE INDEX IX_GDX_PH_MED_EVT ON GDX_PH_MEDIA_FILE(ID_EVENT);
CREATE INDEX IX_GDX_PH_MED_SEN ON GDX_PH_MEDIA_FILE(ID_SENSOR);
CREATE INDEX IX_GDX_PH_MED_PERSON ON GDX_PH_MEDIA_FILE(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_MED;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_MED FOR GDX_PH_MEDIA_FILE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_MEDIA_FILE IS NULL) THEN
    NEW.ID_MEDIA_FILE = NEXT VALUE FOR SEQ_GDX_PH_MED;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_EVENT_TAG  (short code: ETAG)  <- event_tags
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_EVENT_TAG (
  ID_EVENT_TAG BIGINT NOT NULL,
  ID_EVENT BIGINT NOT NULL,
  ID_PERSON BIGINT,
  TAG VARCHAR(100) NOT NULL,
  CONSTRAINT PK_GDX_PH_ETAG PRIMARY KEY (ID_EVENT_TAG),
  CONSTRAINT FK_GDX_PH_ETAG_EVT FOREIGN KEY (ID_EVENT) REFERENCES GDX_PH_EVENT(ID_EVENT),
  CONSTRAINT FK_GDX_PH_ETAG_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_PH_ETAG_EVT_TAG UNIQUE (ID_EVENT, TAG)
);

CREATE INDEX IX_GDX_PH_ETAG_EVT ON GDX_PH_EVENT_TAG(ID_EVENT);
CREATE INDEX IX_GDX_PH_ETAG_PERSON ON GDX_PH_EVENT_TAG(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_ETAG;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_ETAG FOR GDX_PH_EVENT_TAG ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_EVENT_TAG IS NULL) THEN
    NEW.ID_EVENT_TAG = NEXT VALUE FOR SEQ_GDX_PH_ETAG;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_OBSERVATION  (short code: OBS)  <- observations
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_OBSERVATION (
  ID_OBSERVATION BIGINT NOT NULL,
  ID_EVENT BIGINT NOT NULL,
  ID_SENSOR BIGINT NOT NULL,
  ID_PERSON BIGINT,
  MEASURED_AT TIMESTAMP NOT NULL,
  VALUE_NUMERIC NUMERIC(18,6),
  VALUE_TEXT VARCHAR(500),
  UNIT VARCHAR(40),
  QUALITY_FLAG VARCHAR(20) DEFAULT 'OK' NOT NULL,
  METADATA BLOB SUB_TYPE TEXT,
  CONSTRAINT PK_GDX_PH_OBS PRIMARY KEY (ID_OBSERVATION),
  CONSTRAINT FK_GDX_PH_OBS_EVT FOREIGN KEY (ID_EVENT) REFERENCES GDX_PH_EVENT(ID_EVENT),
  CONSTRAINT FK_GDX_PH_OBS_SEN FOREIGN KEY (ID_SENSOR) REFERENCES GDX_PH_SENSOR(ID_SENSOR),
  CONSTRAINT FK_GDX_PH_OBS_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT CK_GDX_PH_OBS_QFLAG CHECK (QUALITY_FLAG IN ('OK','SUSPECT','INVALID'))
);

CREATE INDEX IX_GDX_PH_OBS_EVT ON GDX_PH_OBSERVATION(ID_EVENT);
CREATE INDEX IX_GDX_PH_OBS_SEN ON GDX_PH_OBSERVATION(ID_SENSOR);
CREATE INDEX IX_GDX_PH_OBS_PERSON ON GDX_PH_OBSERVATION(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_OBS;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_OBS FOR GDX_PH_OBSERVATION ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_OBSERVATION IS NULL) THEN
    NEW.ID_OBSERVATION = NEXT VALUE FOR SEQ_GDX_PH_OBS;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_ANALYSIS_RESULT  (short code: ANA)  <- analysis_results
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_ANALYSIS_RESULT (
  ID_ANALYSIS_RESULT BIGINT NOT NULL,
  ID_EVENT BIGINT NOT NULL,
  ID_PERSON BIGINT,
  ALGORITHM VARCHAR(120) NOT NULL,
  ANOMALY_SCORE NUMERIC(9,4),
  CORRELATED_SENSORS VARCHAR(500),
  RESULT_SUMMARY VARCHAR(1000),
  INTERPRETATION_NOTE VARCHAR(1000),
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_GDX_PH_ANA PRIMARY KEY (ID_ANALYSIS_RESULT),
  CONSTRAINT FK_GDX_PH_ANA_EVT FOREIGN KEY (ID_EVENT) REFERENCES GDX_PH_EVENT(ID_EVENT),
  CONSTRAINT FK_GDX_PH_ANA_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON)
);

CREATE INDEX IX_GDX_PH_ANA_EVT ON GDX_PH_ANALYSIS_RESULT(ID_EVENT);
CREATE INDEX IX_GDX_PH_ANA_PERSON ON GDX_PH_ANALYSIS_RESULT(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_ANA;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_ANA FOR GDX_PH_ANALYSIS_RESULT ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_ANALYSIS_RESULT IS NULL) THEN
    NEW.ID_ANALYSIS_RESULT = NEXT VALUE FOR SEQ_GDX_PH_ANA;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_INTERPRETATION  (short code: INTP)  <- interpretations
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_INTERPRETATION (
  ID_INTERPRETATION BIGINT NOT NULL,
  ID_ANALYSIS_RESULT BIGINT NOT NULL,
  ID_PERSON BIGINT,
  CATEGORY VARCHAR(30) NOT NULL,
  HYPOTHESIS VARCHAR(1000) NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL,
  UNIT VARCHAR(40),
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT PK_GDX_PH_INTP PRIMARY KEY (ID_INTERPRETATION),
  CONSTRAINT FK_GDX_PH_INTP_ANA FOREIGN KEY (ID_ANALYSIS_RESULT) REFERENCES GDX_PH_ANALYSIS_RESULT(ID_ANALYSIS_RESULT),
  CONSTRAINT FK_GDX_PH_INTP_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT CK_GDX_PH_INTP_CAT CHECK (CATEGORY IN ('ENVIRONMENTAL','PARANORMAL','EQUIPMENT_ARTIFACT','INCONCLUSIVE','OTHER')),
  CONSTRAINT CK_GDX_PH_INTP_CONF CHECK (CONFIDENCE_LEVEL IN ('HIGH','MEDIUM','LOW','SPECULATIVE'))
);

CREATE INDEX IX_GDX_PH_INTP_ANA ON GDX_PH_INTERPRETATION(ID_ANALYSIS_RESULT);
CREATE INDEX IX_GDX_PH_INTP_PERSON ON GDX_PH_INTERPRETATION(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_INTP;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_INTP FOR GDX_PH_INTERPRETATION ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_INTERPRETATION IS NULL) THEN
    NEW.ID_INTERPRETATION = NEXT VALUE FOR SEQ_GDX_PH_INTP;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_SENSOR_CALIBRATION  (short code: CAL)  <- sensor_calibration
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_SENSOR_CALIBRATION (
  ID_SENSOR_CALIBRATION BIGINT NOT NULL,
  ID_SENSOR BIGINT NOT NULL,
  ID_PERSON BIGINT,
  CALIBRATION_DATE TIMESTAMP NOT NULL,
  PARAMETERS BLOB SUB_TYPE TEXT,
  VALID_UNTIL TIMESTAMP,
  NOTES VARCHAR(1000),
  CONSTRAINT PK_GDX_PH_CAL PRIMARY KEY (ID_SENSOR_CALIBRATION),
  CONSTRAINT FK_GDX_PH_CAL_SEN FOREIGN KEY (ID_SENSOR) REFERENCES GDX_PH_SENSOR(ID_SENSOR),
  CONSTRAINT FK_GDX_PH_CAL_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON)
);

CREATE INDEX IX_GDX_PH_CAL_SEN ON GDX_PH_SENSOR_CALIBRATION(ID_SENSOR);
CREATE INDEX IX_GDX_PH_CAL_PERSON ON GDX_PH_SENSOR_CALIBRATION(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_CAL;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_CAL FOR GDX_PH_SENSOR_CALIBRATION ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_SENSOR_CALIBRATION IS NULL) THEN
    NEW.ID_SENSOR_CALIBRATION = NEXT VALUE FOR SEQ_GDX_PH_CAL;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_USER  (short code: USR)  <- users
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_USER (
  ID_USER BIGINT NOT NULL,
  ID_PERSON BIGINT,
  ROLE VARCHAR(60),
  EMAIL VARCHAR(160),
  CONSTRAINT PK_GDX_PH_USR PRIMARY KEY (ID_USER),
  CONSTRAINT FK_GDX_PH_USR_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_PH_USR_EMAIL UNIQUE (EMAIL)
);

CREATE INDEX IX_GDX_PH_USR_PERSON ON GDX_PH_USER(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_USR;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_USR FOR GDX_PH_USER ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_USER IS NULL) THEN
    NEW.ID_USER = NEXT VALUE FOR SEQ_GDX_PH_USR;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_REFERENCE_DATA  (short code: REF)  <- reference_data
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_REFERENCE_DATA (
  ID_REFERENCE_DATA BIGINT NOT NULL,
  ID_PERSON BIGINT,
  DIMENSION VARCHAR(60) NOT NULL,
  PARAMETER_NAME VARCHAR(120) NOT NULL,
  NORMAL_MIN NUMERIC(18,6),
  NORMAL_MAX NUMERIC(18,6),
  UNIT VARCHAR(40),
  SOURCE_REFERENCE VARCHAR(300),
  NOTES VARCHAR(1000),
  CONSTRAINT PK_GDX_PH_REF PRIMARY KEY (ID_REFERENCE_DATA),
  CONSTRAINT FK_GDX_PH_REF_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_PH_REF_DIM_PARAM UNIQUE (DIMENSION, PARAMETER_NAME)
);

CREATE INDEX IX_GDX_PH_REF_PERSON ON GDX_PH_REFERENCE_DATA(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_REF;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_REF FOR GDX_PH_REFERENCE_DATA ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_REFERENCE_DATA IS NULL) THEN
    NEW.ID_REFERENCE_DATA = NEXT VALUE FOR SEQ_GDX_PH_REF;
END^

SET TERM ; ^

COMMIT;


/* ----------------------------------------------------------------------------
   GDX_PH_EVENT_VAR_MAP  (short code: EVM)  <- not in the source images

   Association table: one row per interpretive correspondence between a
   specific GDX_PH_EVENT occurrence and a metaphysical/psychometric variable
   (GDX_PSY_VARIABLE, typically VARIABLE_TYPE='METAPHYSICS') and, optionally,
   the instrument that variable comes from (GDX_PSY_INSTRUMENT) -- "this
   anomalous event's recorded behavior reads as a correlate of construct X
   from instrument Y". Mirrors the shape of this project's other "_MAP"
   tables exactly, on request:
     - ID_INSTRUMENT/INSTRUMENT_LABEL and ID_VARIABLE/VARIABLE_LABEL, same
       nullable-FK + NOT NULL free-text-label pairing as
       GDX_PSY_CHAKRA_VAR_MAP (14.metaphysical.measuring.instrument/
       metaphysical_variable_chakra_map_firebird25.sql) -- the label
       preserves the correspondence even before (or without) resolving it
       to a real catalog row.
     - RECORDED_BEHAVIOR + CORRESPONDENCE_JUSTIFICATION (both BLOB SUB_TYPE
       TEXT, NOT NULL) and CONFIDENCE_LEVEL (HIGH/MEDIUM/LOW/SPECULATIVE,
       default SPECULATIVE) -- same columns/semantics as
       GDX_PSY_CHAKRA_VAR_MAP.
     - NUMBER_CONFIRMATIONS/CONFIRMATION_BY/NAME_INSTITUTION included from
       the start (not bolted on later via ALTER TABLE, since this table is
       brand new) -- same semantics as
       confirmation_fields_association_maps_firebird25.sql added to the
       other three "_MAP" tables: NUMBER_CONFIRMATIONS counts independent
       corroborations (default 0, never NULL), CONFIRMATION_BY/
       NAME_INSTITUTION record only the most recent confirmer and are
       nullable (an unconfirmed row has neither).

   Keyed on GDX_PH_EVENT, not GDX_PH_SESSION: a session can span many
   events over hours, but the correlation this table records -- an
   anomalous occurrence at a specific instant corresponding to a specific
   metaphysical variable -- is only meaningful at the same fine-grained,
   timestamped level GDX_PH_ANALYSIS_RESULT and GDX_PH_INTERPRETATION
   already use (both FK ID_EVENT, never ID_SESSION), which this table stays
   consistent with. A session-wide (not event-specific) correspondence can
   still be recorded by pointing at a single summary event for that session
   rather than requiring a second, session-level version of this table.

   ID_PERSON: nullable FK to GDX_PSY_PERSON, same as every other table in
   this module (see file header) -- the person the specific event/variable
   correspondence is about, when one applies.
   ---------------------------------------------------------------------------- */
CREATE TABLE GDX_PH_EVENT_VAR_MAP (
  ID_MAPPING BIGINT NOT NULL,
  ID_EVENT BIGINT NOT NULL,
  ID_INSTRUMENT BIGINT,
  INSTRUMENT_LABEL VARCHAR(160) NOT NULL,
  ID_VARIABLE BIGINT,
  VARIABLE_LABEL VARCHAR(150) NOT NULL,
  ID_PERSON BIGINT,
  RECORDED_BEHAVIOR BLOB SUB_TYPE TEXT NOT NULL,
  CORRESPONDENCE_JUSTIFICATION BLOB SUB_TYPE TEXT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL,
  NUMBER_CONFIRMATIONS INTEGER DEFAULT 0 NOT NULL,
  CONFIRMATION_BY VARCHAR(160),
  NAME_INSTITUTION VARCHAR(160),
  CONSTRAINT PK_GDX_PH_EVM PRIMARY KEY (ID_MAPPING),
  CONSTRAINT FK_GDX_PH_EVM_EVT FOREIGN KEY (ID_EVENT) REFERENCES GDX_PH_EVENT(ID_EVENT),
  CONSTRAINT FK_GDX_PH_EVM_INSTR FOREIGN KEY (ID_INSTRUMENT) REFERENCES GDX_PSY_INSTRUMENT(ID_INSTRUMENT),
  CONSTRAINT FK_GDX_PH_EVM_VAR FOREIGN KEY (ID_VARIABLE) REFERENCES GDX_PSY_VARIABLE(ID_VARIABLE),
  CONSTRAINT FK_GDX_PH_EVM_PERSON FOREIGN KEY (ID_PERSON) REFERENCES GDX_PSY_PERSON(ID_PERSON),
  CONSTRAINT UQ_GDX_PH_EVM_EVT_VAR UNIQUE (ID_EVENT, VARIABLE_LABEL),
  CONSTRAINT CK_GDX_PH_EVM_CONF CHECK (CONFIDENCE_LEVEL IN ('HIGH','MEDIUM','LOW','SPECULATIVE'))
);

CREATE INDEX IX_GDX_PH_EVM_EVT ON GDX_PH_EVENT_VAR_MAP(ID_EVENT);
CREATE INDEX IX_GDX_PH_EVM_INSTR ON GDX_PH_EVENT_VAR_MAP(ID_INSTRUMENT);
CREATE INDEX IX_GDX_PH_EVM_VAR ON GDX_PH_EVENT_VAR_MAP(ID_VARIABLE);
CREATE INDEX IX_GDX_PH_EVM_PERSON ON GDX_PH_EVENT_VAR_MAP(ID_PERSON);

CREATE SEQUENCE SEQ_GDX_PH_EVM;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PH_EVM FOR GDX_PH_EVENT_VAR_MAP ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_MAPPING IS NULL) THEN
    NEW.ID_MAPPING = NEXT VALUE FOR SEQ_GDX_PH_EVM;
END^

SET TERM ; ^

COMMIT;
