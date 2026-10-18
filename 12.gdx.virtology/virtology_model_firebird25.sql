/* ============================================================================
   Relational model - Virtology (Firebird 2.5)
   New module: 12.gdx.virtology

   Prerequisite: 2.relational.model.psychometrics/psychometrics_model_firebird25.sql
   already applied (GDX_PSY_VARIABLE must exist for the FK below).

   Until this script, Virtology's knowledge lived only in code -- the 33
   virtues and the variable<->virtue judgment calls were hand-written in two
   duplicate copies of scripts/virtue_knowledge.js (one in
   .claude/skills/GDX_SKILL_LINK_SUGGESTIONS/, one in
   .claude/skills/GDX_SKILL_IDENTIFY_VIRTUES/), never written to Firebird or
   Neo4j. GDX_SKILL_LIST_ASSOCIATIONS's report explicitly calls this out as
   the one source in the framework that is CODE, not DATABASE, with no
   confidence field of any kind.

   This script creates the DATABASE-backed equivalent of that same
   information, mirroring the shape already established by the other
   catalog + "_MAP" association table pairs in this project
   (GDX_PSY_CHAKRA / GDX_PSY_CHAKRA_VAR_MAP, GDX_TA_WAY / GDX_TA_WAY_SEPT_MAP):

     1) GDX_VT_VIRTUE - catalog of the 33 virtues (institutovirtudes.com.br/
        manual, see 12.gdx.virtology/Virtology_Knowledge_Base.md section 5),
        in the manual's own order.
     2) GDX_VT_VARIABLE_VIRTUE_MAP - one row per psychometric variable that
        has a suggested virtue, carrying ID_VARIABLE (FK to GDX_PSY_VARIABLE,
        nullable for the same reason every other "_MAP" table's FK is
        nullable: the free-text SAV_COLUMN/VARIABLE_LABEL preserve the
        correspondence even if the FK can't yet be resolved), the virtue
        (ID_VIRTUE, FK, NOT NULL), the recorded behavior, and BOTH existing
        justifications side by side:
          - JUSTIFICATION_DEFICIT   -- the "low score -> antidote" framing
            from GDX_SKILL_LINK_SUGGESTIONS's virtue_knowledge.js.
          - JUSTIFICATION_STRENGTH  -- the "high score -> already present"
            framing from GDX_SKILL_IDENTIFY_VIRTUES's virtue_knowledge.js.
        Both copies already agree on behavior/virtue for every variable
        (GDX_SKILL_LIST_ASSOCIATIONS's sync check confirms this); only the
        justification prose differs by design, so both are kept rather than
        collapsing to one and losing the other.

   This table DOES get a CONFIDENCE_LEVEL column, same shape as the other
   three "_MAP" tables (VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL, CHECK
   IN HIGH/MEDIUM/LOW/SPECULATIVE) -- added for structural consistency with
   its siblings, even though the source code (virtue_knowledge.js) never
   recorded one. Every row below is therefore set to the schema's own
   default, 'SPECULATIVE', rather than inventing a higher grade that was
   never actually assigned; re-grading any of them is a deliberate,
   separate judgment call for later (e.g. via the skill that will write to
   this table), not something this load does on its own.

   It DOES get the same three confirmation-tracking columns added to those
   three tables by
   14.metaphysical.measuring.instrument/confirmation_fields_association_maps_firebird25.sql
   -- NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION -- so this
   fourth "_MAP" table stays structurally consistent with its three
   siblings even though it did not exist yet when that script ran. Same
   semantics: NUMBER_CONFIRMATIONS counts independent corroborations (not
   confidence), CONFIRMATION_BY/NAME_INSTITUTION hold only the most recent
   confirmer. The 17 rows below are treated the same way that script's
   companion DML treated every pre-existing row in the other three tables:
   as already confirmed once, by the person who recorded the correspondence
   in virtue_knowledge.js in the first place.

   Note on special characters: the source .js files write justification
   prose with a Unicode em dash ("--" rendered as one glyph). Every DML
   script in this project that already stores free-text judgment calls in a
   BLOB SUB_TYPE TEXT column (five_ways_septenary_map_firebird25.sql,
   metaphysical_variable_way_map_firebird25.sql, GDX_SKILL_LOAD_SEPT_MAPS_DB's
   loads) spells that same pause as a plain ASCII double-hyphen ("--")
   instead, to stay encoding-safe across environments. The same substitution
   is applied below -- wording is otherwise verbatim from virtue_knowledge.js.
   ============================================================================ */

CREATE TABLE GDX_VT_VIRTUE (
  ID_VIRTUE BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  NAME_PT VARCHAR(60) NOT NULL,
  NAME_EN VARCHAR(60) NOT NULL,
  CONSTRAINT PK_GDX_VT_VIRTUE PRIMARY KEY (ID_VIRTUE),
  CONSTRAINT UQ_GDX_VT_VIRTUE_ORDER UNIQUE (ORDER_NUM),
  CONSTRAINT UQ_GDX_VT_VIRTUE_NAME_PT UNIQUE (NAME_PT),
  CONSTRAINT CK_GDX_VT_VIRTUE_ORDER CHECK (ORDER_NUM BETWEEN 1 AND 33)
);

/* Firebird 2.5: generator and trigger for the surrogate key. */
CREATE SEQUENCE SEQ_GDX_VT_VIRTUE;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_VT_VIRTUE FOR GDX_VT_VIRTUE ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_VIRTUE IS NULL) THEN
    NEW.ID_VIRTUE = NEXT VALUE FOR SEQ_GDX_VT_VIRTUE;
END^

SET TERM ; ^

COMMIT;

/* ============================================================================
   DML - the 33 virtues, in the manual's own order (ID_VIRTUE = ORDER_NUM,
   same explicit-id convention used by chakras_model_firebird25.sql's 7-row
   catalog load).
   ============================================================================ */

INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (1, 1, 'Humildade', 'Humility');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (2, 2, 'Individuação', 'Individuation');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (3, 3, 'Brandura', 'Gentleness');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (4, 4, 'Eternidade', 'Eternity');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (5, 5, 'Perdão', 'Forgiveness');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (6, 6, 'Exemplo Positivo', 'Positive Example');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (7, 7, 'Igualdade', 'Equality');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (8, 8, 'Fraternidade', 'Fraternity');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (9, 9, 'Aceitação', 'Acceptance');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (10, 10, 'Perseverança', 'Perseverance');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (11, 11, 'Otimismo', 'Optimism');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (12, 12, 'Paciência', 'Patience');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (13, 13, 'Reconciliação', 'Reconciliation');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (14, 14, 'Fé', 'Faith');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (15, 15, 'Tudo Somos Um', 'We Are All One');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (16, 16, 'Ajuda ao Próximo', 'Helping Others');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (17, 17, 'Amor ao Próximo', 'Love for Others');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (18, 18, 'Gratidão', 'Gratitude');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (19, 19, 'Verdade', 'Truth');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (20, 20, 'Bom Humor', 'Good Humor');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (21, 21, 'Honestidade', 'Honesty');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (22, 22, 'Não Julgamento', 'Non-judgment');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (23, 23, 'Pureza de Coração', 'Purity of Heart');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (24, 24, 'Abnegação', 'Abnegation');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (25, 25, 'Pagar o Mal com o Bem', 'Repay Evil with Good');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (26, 26, 'Honrar a Família', 'Honor Family');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (27, 27, 'Desapego', 'Detachment');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (28, 28, 'Busca do Melhoramento', 'Pursuit of Improvement');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (29, 29, 'Cuidado com o Corpo', 'Body Care');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (30, 30, 'Flexibilidade', 'Flexibility');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (31, 31, 'Utilidade', 'Utility');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (32, 32, 'Amor à Natureza e aos Animais', 'Love of Nature and Animals');
INSERT INTO GDX_VT_VIRTUE (ID_VIRTUE, ORDER_NUM, NAME_PT, NAME_EN) VALUES (33, 33, 'Responsabilidade', 'Responsibility');

COMMIT;

/* ============================================================================
   GDX_VT_VARIABLE_VIRTUE_MAP - psychometric variable <-> virtue correspondence
   ============================================================================ */

CREATE TABLE GDX_VT_VARIABLE_VIRTUE_MAP (
  ID_MAPPING BIGINT NOT NULL,
  ID_VIRTUE BIGINT NOT NULL,
  ID_VARIABLE BIGINT,
  SAV_COLUMN VARCHAR(60) NOT NULL,
  VARIABLE_LABEL VARCHAR(150),
  RECORDED_BEHAVIOR BLOB SUB_TYPE TEXT NOT NULL,
  JUSTIFICATION_DEFICIT BLOB SUB_TYPE TEXT NOT NULL,
  JUSTIFICATION_STRENGTH BLOB SUB_TYPE TEXT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL,
  NUMBER_CONFIRMATIONS INTEGER DEFAULT 0 NOT NULL,
  CONFIRMATION_BY VARCHAR(160),
  NAME_INSTITUTION VARCHAR(160),
  CONSTRAINT PK_GDX_VT_VARIABLE_VIRTUE_MAP PRIMARY KEY (ID_MAPPING),
  CONSTRAINT UQ_GDX_VT_VVM_SAV UNIQUE (SAV_COLUMN),
  CONSTRAINT FK_GDX_VT_VVM_VIRTUE FOREIGN KEY (ID_VIRTUE)
    REFERENCES GDX_VT_VIRTUE(ID_VIRTUE),
  CONSTRAINT FK_GDX_VT_VVM_VARIABLE FOREIGN KEY (ID_VARIABLE)
    REFERENCES GDX_PSY_VARIABLE(ID_VARIABLE),
  CONSTRAINT CK_GDX_VT_VVM_CONF CHECK (CONFIDENCE_LEVEL IN ('HIGH','MEDIUM','LOW','SPECULATIVE'))
);

CREATE INDEX IX_GDX_VT_VVM_VIRTUE ON GDX_VT_VARIABLE_VIRTUE_MAP(ID_VIRTUE);
CREATE INDEX IX_GDX_VT_VVM_VARIABLE ON GDX_VT_VARIABLE_VIRTUE_MAP(ID_VARIABLE);

/* Firebird 2.5: generator and trigger for the surrogate key. */
CREATE SEQUENCE SEQ_GDX_VT_VVM;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_VT_VVM FOR GDX_VT_VARIABLE_VIRTUE_MAP ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_MAPPING IS NULL) THEN
    NEW.ID_MAPPING = NEXT VALUE FOR SEQ_GDX_VT_VVM;
END^

SET TERM ; ^

COMMIT;

/* ============================================================================
   DML - the 17 variable<->virtue correspondences currently in
   virtue_knowledge.js (both copies agree on ID_VIRTUE/behavior; only the two
   justification columns differ, kept side by side -- see header comment).
   ID_VARIABLE values below were resolved live against DW_DIM_VARIABLE x
   GDX_PSY_VARIABLE on 2026-10-15 (ID_STUDY=1, "Predictors of Adaptability to
   Military Higher Education").
   ============================================================================ */

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (1, 10, 4, 'ENGAGvigor', 'Vigor (Engagement)',
   'Disposition and energy to invest effort in studying',
   'Low vigor is depletion of sustained energy -- Perseverance is the practice of maintaining effort despite wear, a direct antidote for the drop in disposition',
   'High vigor is sustained energy already in action -- a sign that Perseverance, the practice of maintaining effort despite wear, is already a resource present in this population', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (2, 18, 13, 'EmocPos', 'Positive Emotions',
   'Repertoire of positive emotions (joy, interest, hope)',
   'It is the instrument''s own theoretical basis (Positivity Ratio / Fredrickson, broaden-and-build): gratitude is the most documented lever for raising positive emotion',
   'It is the instrument''s own theoretical basis (Positivity Ratio / Fredrickson, broaden-and-build): an already-high positive repertoire suggests Gratitude, its most documented lever, is already being exercised', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (3, 18, 14, 'EmocNeg', 'Negative Emotions',
   'Repertoire of negative emotions (sadness, fear, anger)',
   'Same broaden-and-build logic: cultivating gratitude shifts the emotional repertoire away from the negative pole, rather than suppressing it directly',
   'Same broaden-and-build theoretical basis as the instrument -- but unlike EmocPos, this variable is on the negative pole: a high score here is not a strength, it is the mechanical reading of the ranking. See the report''s caveat about scale direction before treating it as a potential', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (4, 9, 11, 'SATISFVIDA', 'Satisfaction With Life (index)',
   'Global affective evaluation of one''s own life',
   'Satisfaction with life as a whole depends on accepting life as it is today, not just changing circumstances -- Acceptance attacks the root of the negative global judgment',
   'High life satisfaction is the affective portrait of already accepting life as it is -- a sign that Acceptance is already present and sustaining that positive global evaluation', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (5, 31, 12, 'SATISFTRAB', 'Job Satisfaction (index)',
   'Pleasure/displeasure with the occupational activity',
   'Job satisfaction is strongly tied to the sense of being useful/contributing -- Utility is the most direct axis for rebuilding that bond',
   'High job satisfaction is strongly tied to the sense of already being useful/contributing -- a sign that Utility is already a lived axis, not just a desired one', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (6, 9, 15, 'SatPes', 'Personal Satisfaction (index)',
   'Subjective contentment with oneself',
   'Low personal contentment is, in practice, insufficient self-acceptance',
   'High subjective contentment with oneself is, in practice, self-acceptance already in exercise', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (7, 33, 2, 'HARDcontrole', 'Control (Hardiness)',
   'Belief in being able to influence everyday events',
   'Low perceived control improves by training the active assumption of responsibility over what is actually within the person''s reach',
   'High belief in being able to influence everyday events reflects someone who already takes active Responsibility over what is within their reach', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (8, 33, 16, 'CtrlVi', 'Perceived Control of Life (index)',
   'Practical sense of mastery over one''s own routine',
   'Same reasoning as HARDcontrole -- mastery of the routine is a direct exercise of personal responsibility',
   'Same reasoning as HARDcontrole -- already-demonstrated mastery of the routine is a direct and already-present exercise of personal Responsibility', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (9, 33, 8, 'ACcontrole', 'Control (Career Adaptability)',
   'Practical planning and decision-making about one''s career',
   'Low career control calls for the same antidote: actively taking responsibility for concrete decisions',
   'Practical planning and decision-making already active about the career are Responsibility in action, not just in intention', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (10, 14, 1, 'HARDcompromis', 'Commitment (Hardiness)',
   'Engagement with values and life purpose (not just the task)',
   'Commitment is adherence to a meaning/identity that transcends the immediate task -- Faith is the axis that sustains this kind of long-term engagement',
   'High engagement with values and life purpose indicates a Faith already sustaining that long-term commitment', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (11, 14, 5, 'ENGAGdedicac', 'Dedication (Engagement)',
   'Enthusiasm, pride, and meaning attributed to the student role',
   '"Dedication" is an investment of identity, not just energy -- it needs something to believe in beyond the immediate outcome, which is the core of Faith',
   'Enthusiasm and meaning already attributed to the student role show an investment of identity sustained by something beyond the immediate outcome -- the already-active core of Faith', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (12, 11, 10, 'ACconfianc', 'Confidence (Career Adaptability)',
   'Self-efficacy projected onto the professional future',
   'Confidence in one''s own future is, by definition, a sustained positive expectation -- the core of Optimism',
   'High confidence in one''s own professional future is, by definition, an already-sustained positive expectation -- Optimism in exercise', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (13, 30, 9, 'ACcuriosid', 'Curiosity (Career Adaptability)',
   'Exploring alternatives, openness to possibilities',
   'Low curiosity is, in practice, rigidity in the face of the unknown -- Flexibility is the direct antidote',
   'High curiosity is openness already demonstrated to alternatives and to the unknown -- Flexibility already in practice', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (14, 15, 6, 'ENGAGabsorc', 'Absorption (Engagement)',
   'Flow state, losing track of time while studying',
   'The literature describes absorption/flow as a dissolution of the subject-object boundary -- resonating directly with this virtue''s theme of unity/interconnection',
   'High absorption/flow is the already-lived dissolution of the subject-object boundary described in the literature -- resonating directly with an already-present experience of this virtue''s theme of unity', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (15, 28, 3, 'HARDdesafio', 'Challenge (Hardiness)',
   'Ability to draw meaning and growth from adversity',
   'It is literally the virtue''s definition: facing difficulty as an opportunity for growth, echoing Frankl (purpose), cited by Virtology itself',
   'A high ability to draw meaning and growth from adversity is, literally, the Pursuit of Improvement already in practice', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (16, 4, 7, 'ACpreocup', 'Concern (Career Adaptability)',
   'Future orientation with a sense of existential continuity',
   '"Concern" in Savickas''s sense is an integrated temporal outlook -- the virtue that explicitly deals with a perspective beyond the immediate is the closest match',
   'An already-high future orientation with a sense of existential continuity indicates an already-present integrated temporal outlook -- the same beyond-the-immediate perspective central to this virtue', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

INSERT INTO GDX_VT_VARIABLE_VIRTUE_MAP
  (ID_MAPPING, ID_VIRTUE, ID_VARIABLE, SAV_COLUMN, VARIABLE_LABEL, RECORDED_BEHAVIOR, JUSTIFICATION_DEFICIT, JUSTIFICATION_STRENGTH,
   CONFIDENCE_LEVEL, NUMBER_CONFIRMATIONS, CONFIRMATION_BY, NAME_INSTITUTION)
VALUES
  (17, 2, 20, 'RealizPess', 'Personal Fulfillment (hypothesis)',
   'Sense of ultimate fulfillment, purpose achieved',
   'Maximal personal fulfillment is the direct psychological correlate of the Jungian process of individuation -- becoming a fully integrated Self',
   'An already-high sense of personal fulfillment is the direct psychological correlate of an Individuation process already underway -- the Self already on its way to integration', 'SPECULATIVE', 1, 'WFDA', 'Nova Acropole Lisboa');

COMMIT;
