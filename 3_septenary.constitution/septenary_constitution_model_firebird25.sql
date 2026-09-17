/* ============================================================================
   Relational model - Septenary Constitution x Psychometrics (Firebird 2.5)
   Extension of GDX_HUMAN/relational.model.psychometrics/psychometrics_model_firebird25.sql

   Source: GDX_HUMAN/relational.model.psychometrics/SPSS_Septenary_Constitution_Mapping.md
   (sections 1, 2 and 3 of that document)

   Prerequisite: psychometrics_model_firebird25.sql already applied to the database
   (tables GDX_PSY_INSTRUMENT and GDX_PSY_VARIABLE must exist for the FKs below).

   This script creates:
     1) GDX_PSY_SEPTENARY_LEVEL            - catalog of the 7 levels/bodies of consciousness
     2) GDX_PSY_SEPT_LEVEL_PSY_MAP - relation between Septenary Level <->
                                          Instrument/Variable (GDX_PSY_VARIABLE), with the
                                          recorded behavior and the justification for
                                          the correspondence

   Note: ID_INSTRUMENT and ID_VARIABLE in the mapping table are NULLABLE because, at
   the current stage (see SPSS_to_Firebird_Mapping.md), no catalog load
   (GDX_PSY_INSTRUMENT/GDX_PSY_VARIABLE) has been executed yet - the textual labels
   (INSTRUMENT_LABEL/VARIABLE_LABEL) preserve the original information from the .sav/
   summary table and can be reconciled with the formal catalog (ID_INSTRUMENT/
   ID_VARIABLE) once that load happens.
   ============================================================================ */

CREATE TABLE GDX_PSY_SEPTENARY_LEVEL (
  ID_SEPTENARY_LEVEL BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  NAME VARCHAR(60) NOT NULL,
  TECHNICAL_NAME VARCHAR(80),
  NATURE VARCHAR(40),
  CONSCIOUSNESS_FUNCTION VARCHAR(500),
  CONSTRAINT PK_GDX_PSY_SEPT_LEVEL PRIMARY KEY (ID_SEPTENARY_LEVEL),
  CONSTRAINT UQ_GDX_PSY_SEPT_LEVEL_ORDER UNIQUE (ORDER_NUM),
  CONSTRAINT UQ_GDX_PSY_SEPT_LEVEL_NAME UNIQUE (NAME),
  CONSTRAINT CK_GDX_PSY_SEPT_LEVEL_ORDER CHECK (ORDER_NUM BETWEEN 1 AND 7)
);

CREATE TABLE GDX_PSY_SEPT_LEVEL_PSY_MAP (
  ID_MAPPING BIGINT NOT NULL,
  ID_SEPTENARY_LEVEL BIGINT NOT NULL,
  ID_INSTRUMENT BIGINT,
  INSTRUMENT_LABEL VARCHAR(160) NOT NULL,
  ID_VARIABLE BIGINT,
  VARIABLE_LABEL VARCHAR(150) NOT NULL,
  RECORDED_BEHAVIOR BLOB SUB_TYPE TEXT NOT NULL,
  CORRESPONDENCE_JUSTIFICATION BLOB SUB_TYPE TEXT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL,
  CONSTRAINT PK_GDX_PSY_SLPM PRIMARY KEY (ID_MAPPING),
  CONSTRAINT FK_GDX_PSY_SLPM_LEVEL FOREIGN KEY (ID_SEPTENARY_LEVEL)
    REFERENCES GDX_PSY_SEPTENARY_LEVEL(ID_SEPTENARY_LEVEL),
  CONSTRAINT FK_GDX_PSY_SLPM_INSTRUMENT FOREIGN KEY (ID_INSTRUMENT)
    REFERENCES GDX_PSY_INSTRUMENT(ID_INSTRUMENT),
  CONSTRAINT FK_GDX_PSY_SLPM_VARIABLE FOREIGN KEY (ID_VARIABLE)
    REFERENCES GDX_PSY_VARIABLE(ID_VARIABLE),
  CONSTRAINT CK_GDX_PSY_SLPM_CONFIDENCE CHECK (CONFIDENCE_LEVEL IN ('HIGH','MEDIUM','LOW','SPECULATIVE'))
);

CREATE INDEX IX_GDX_PSY_SLPM_LEVEL ON GDX_PSY_SEPT_LEVEL_PSY_MAP(ID_SEPTENARY_LEVEL);
CREATE INDEX IX_GDX_PSY_SLPM_INSTRUMENT ON GDX_PSY_SEPT_LEVEL_PSY_MAP(ID_INSTRUMENT);
CREATE INDEX IX_GDX_PSY_SLPM_VARIABLE ON GDX_PSY_SEPT_LEVEL_PSY_MAP(ID_VARIABLE);

/* Firebird 2.5: generators and triggers for surrogate keys. */
CREATE SEQUENCE SEQ_GDX_PSY_SEPT_LEVEL;
CREATE SEQUENCE SEQ_GDX_PSY_SLPM;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PSY_SEPT_LEVEL FOR GDX_PSY_SEPTENARY_LEVEL ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_SEPTENARY_LEVEL IS NULL) THEN
    NEW.ID_SEPTENARY_LEVEL = NEXT VALUE FOR SEQ_GDX_PSY_SEPT_LEVEL;
END^

CREATE TRIGGER BI_GDX_PSY_SLPM FOR GDX_PSY_SEPT_LEVEL_PSY_MAP ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_MAPPING IS NULL) THEN
    NEW.ID_MAPPING = NEXT VALUE FOR SEQ_GDX_PSY_SLPM;
END^

SET TERM ; ^

/* ============================================================================
   DML - Catalog of the 7 levels (Septenary Constitution)
   Source: SPSS_Septenary_Constitution_Mapping.md, section 1
   IDs fixed explicitly (1-7) as a stable enumeration, referenced by the
   mapping table's FKs below.
   ============================================================================ */

INSERT INTO GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
VALUES (1, 1, 'Physical Body', 'Sthula Sharira', 'Dense, material', 'Concrete action, survival, objective performance');

INSERT INTO GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
VALUES (2, 2, 'Vital/Etheric Body', 'Prana/Linga Sharira', 'Energetic', 'Vitality, disposition, the vital energy that sustains physical life');

INSERT INTO GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
VALUES (3, 3, 'Astral Body', 'Kama Rupa', 'Emotional', 'Desires, emotions, affects, pleasure/displeasure');

INSERT INTO GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
VALUES (4, 4, 'Lower Mental Body', 'Concrete Manas', 'Concrete mind', 'Practical reasoning, everyday cognitive control, immediate planning');

INSERT INTO GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
VALUES (5, 5, 'Higher Mental Body', 'Abstract Manas', 'Abstract mind', 'Values, commitment, long-term judgment, identity');

INSERT INTO GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
VALUES (6, 6, 'Buddhic Body', 'Buddhi', 'Intuitive', 'Intuition, existential meaning, flow/absorption states, meaning-making');

INSERT INTO GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL, ORDER_NUM, NAME, TECHNICAL_NAME, NATURE, CONSCIOUSNESS_FUNCTION)
VALUES (7, 7, 'Atmic Body/Spirit', 'Atma', 'Spiritual', 'Transcendent will, ultimate purpose, full self-realization');

/* ============================================================================
   DML - Relation between Septenary Level <-> Instrument/Variable (with
   recorded behavior and correspondence justification)
   Source: SPSS_Septenary_Constitution_Mapping.md, section 2

   ID_INSTRUMENT / ID_VARIABLE are left NULL in this initial load (the
   GDX_PSY_INSTRUMENT/GDX_PSY_VARIABLE catalog has not been populated yet);
   INSTRUMENT_LABEL/VARIABLE_LABEL preserve the original names for future
   reconciliation.
   ============================================================================ */

-- Level 1 - Physical Body
INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (1, NULL, 'Burnout Scale (hypothesis, ef1-ef18)', NULL, 'Emotional Exhaustion (no computed column in the .sav)',
   'Exhaustion, fatigue, drop in objective performance',
   'Exhaustion first manifests as a collapse of physical/bodily energy - a physical symptom before an emotional one',
   'LOW');

-- Level 2 - Vital/Etheric Body
INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (2, NULL, 'Engagement Scale', NULL, 'Vigor -> ENGAGvigor',
   'Disposition, energy, willingness to invest effort in studying',
   'Vigor is by definition vital energy applied to an activity - a direct mapping',
   'HIGH');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (2, NULL, 'Positivity Ratio Scale', NULL, 'Positive Emotions (physiological: joy, interest) -> EmocPos (part)',
   'Positive energetic activation',
   'High-activation emotions (joy, interest) have a strong vital/energetic component',
   'MEDIUM');

-- Level 3 - Astral Body
INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (3, NULL, 'Satisfaction With Life Scale', NULL, 'Single index -> SATISFVIDA',
   'Global affective evaluation of one''s own life',
   'Satisfaction is an affective judgment - astral body (desire satisfied/unsatisfied)',
   'HIGH');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (3, NULL, 'Job Satisfaction Scale', NULL, 'Single index -> SATISFTRAB',
   'Pleasure/displeasure with the occupational activity',
   'Same as life satisfaction - affect tied to a specific object (work)',
   'HIGH');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (3, NULL, 'Positivity Ratio Scale', NULL, 'Positive/Negative Emotions -> EmocPos / EmocNeg',
   'Emotional repertoire (joy, gratitude, sadness, fear, anger...)',
   'Pure emotional core - this is literally the measure of the astral body',
   'HIGH');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (3, NULL, 'Personal Satisfaction (Diener, 1995)', NULL, 'Single item -> SatPes',
   'Subjective contentment with oneself',
   'Self-directed affect',
   'HIGH');

-- Level 4 - Lower Mental Body
INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (4, NULL, 'Hardiness', NULL, 'Control -> HARDcontrole',
   'Belief in being able to influence everyday events',
   'Control is a concrete cognitive function - "I think, therefore I can act on this"',
   'HIGH');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (4, NULL, 'Perceived Control of Life (Inglehart, 1998)', NULL, 'Single item -> CtrlVi',
   'Practical sense of mastery over one''s own routine',
   'Concrete cognitive judgment about personal agency',
   'HIGH');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (4, NULL, 'Career Adapt-Abilities Scale', NULL, 'Control -> ACcontrole',
   'Practical planning and decision-making about one''s career',
   'Practical reasoning applied to a concrete goal (career)',
   'HIGH');

-- Level 5 - Higher Mental Body
INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, NULL, 'Hardiness', NULL, 'Commitment -> HARDcompromis',
   'Engagement with values and life purpose (not just the task)',
   'Commitment goes beyond the concrete - it is adherence to a meaning/identity',
   'MEDIUM');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, NULL, 'Engagement Scale', NULL, 'Dedication -> ENGAGdedicac',
   'Enthusiasm, pride, meaning attributed to the student role',
   '"Dedication" is an investment of identity, not just energy (vital)',
   'MEDIUM');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, NULL, 'Career Adapt-Abilities Scale', NULL, 'Confidence -> ACconfianc',
   'Self-efficacy projected onto one''s professional future',
   'Abstract self-judgment over time - the abstract mind',
   'MEDIUM');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, NULL, 'Career Adapt-Abilities Scale', NULL, 'Curiosity -> ACcuriosid',
   'Exploring alternatives, openness to possibilities',
   'Exploratory/abstract thinking, not tied to an immediate action',
   'MEDIUM');

-- Level 6 - Buddhic Body
INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (6, NULL, 'Engagement Scale', NULL, 'Absorption -> ENGAGabsorc',
   'Flow state, losing track of time while studying',
   'Absorption/flow is described in the literature as a quasi-transcendent state of subject-activity unity - a classic correspondence with the Buddhic body',
   'SPECULATIVE');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (6, NULL, 'Hardiness', NULL, 'Challenge -> HARDdesafio',
   'Ability to draw meaning and growth from adversity',
   'Turning difficulty into meaning is an intuitive/meaning-making operation, beyond practical reasoning',
   'SPECULATIVE');

INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (6, NULL, 'Career Adapt-Abilities Scale', NULL, 'Concern -> ACpreocup',
   'Future orientation with a sense of existential continuity',
   '"Concern" here (Savickas) is an integrated temporal outlook - close to the intuitive perception of purpose',
   'SPECULATIVE');

-- Level 7 - Atmic Body/Spirit
INSERT INTO GDX_PSY_SEPT_LEVEL_PSY_MAP
  (ID_SEPTENARY_LEVEL, ID_INSTRUMENT, INSTRUMENT_LABEL, ID_VARIABLE, VARIABLE_LABEL,
   RECORDED_BEHAVIOR, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (7, NULL, 'Block an1-an11 (undocumented, hypothesis)', NULL, 'Personal Fulfillment -> RealizPess',
   'Sense of ultimate fulfillment, purpose achieved',
   'The name and semantics ("personal fulfillment", high mean = 4.03) suggest the highest level of meaning, beyond the abstract mind',
   'SPECULATIVE');
