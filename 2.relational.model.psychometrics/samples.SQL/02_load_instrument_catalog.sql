/* ============================================================================
   Data load - Catalog (GDX_PSY_PHENOMENON, GDX_PSY_CONSTRUCT, GDX_PSY_INSTRUMENT,
   GDX_PSY_INSTRUMENT_CONSTRUCT, GDX_PSY_VARIABLE)
   Generated dynamically by GDX_SKILL_LOAD_RLT_MODEL_DB (catalog.py) -- IDs are
   fixed explicitly so scripts 03-07 can reference them.
   ============================================================================ */

INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (1, 'Hardiness', 'Resilient personality traits: commitment, control and challenge.');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (2, 'Academic Engagement', 'Vigor, dedication and absorption in the student role.');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (3, 'Career Adaptability', 'Concern, control, curiosity and confidence in career (Savickas/CAAS).');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (4, 'Satisfaction With Life', 'Global cognitive appraisal of one''s own life.');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (5, 'Job Satisfaction', 'Affective evaluation of the occupational experience.');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (6, 'Positivity Ratio', 'Balance between positive and negative emotions (Fredrickson).');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (7, 'Personal Satisfaction', 'Subjective contentment with oneself (single item).');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (8, 'Perceived Control of Life', 'Sense of freedom/control over one''s own life (single item).');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (9, 'Academic Burnout (hypothesis)', 'HYPOTHESIS: academic exhaustion/disengagement - unconfirmed, no computed score in the .sav.');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (10, 'Undocumented Organizational Block (hypothesis)', 'HYPOTHESIS: perceptions of organizational anomie, success, social standing and personal fulfillment.');
INSERT INTO GDX_PSY_PHENOMENON (ID_PHENOMENON, NAME, DESCRIPTION) VALUES (11, 'Red Tape / Perceived Bureaucracy (hypothesis)', 'HYPOTHESIS: perception of institutional bureaucracy/rigidity.');

INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (1, 'Hardiness', 'PSYCHOMETRIC_SPSS', 'Resilient personality traits: commitment, control and challenge.');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (2, 'Academic Engagement', 'PSYCHOMETRIC_SPSS', 'Vigor, dedication and absorption in the student role.');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (3, 'Career Adaptability', 'PSYCHOMETRIC_SPSS', 'Concern, control, curiosity and confidence in career (Savickas/CAAS).');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (4, 'Satisfaction With Life', 'PSYCHOMETRIC_SPSS', 'Global cognitive appraisal of one''s own life.');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (5, 'Job Satisfaction', 'PSYCHOMETRIC_SPSS', 'Affective evaluation of the occupational experience.');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (6, 'Positivity Ratio', 'PSYCHOMETRIC_SPSS', 'Balance between positive and negative emotions (Fredrickson).');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (7, 'Personal Satisfaction', 'PSYCHOMETRIC_SPSS', 'Subjective contentment with oneself (single item).');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (8, 'Perceived Control of Life', 'PSYCHOMETRIC_SPSS', 'Sense of freedom/control over one''s own life (single item).');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (9, 'Academic Burnout (hypothesis)', 'PSYCHOMETRIC_SPSS', 'HYPOTHESIS: academic exhaustion/disengagement - unconfirmed, no computed score in the .sav.');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (10, 'Undocumented Organizational Block (hypothesis)', 'PSYCHOMETRIC_SPSS', 'HYPOTHESIS: perceptions of organizational anomie, success, social standing and personal fulfillment.');
INSERT INTO GDX_PSY_CONSTRUCT (ID_CONSTRUCT, NAME, DOMAIN, DEFINITION) VALUES (11, 'Red Tape / Perceived Bureaucracy (hypothesis)', 'PSYCHOMETRIC_SPSS', 'HYPOTHESIS: perception of institutional bureaucracy/rigidity.');

INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (1, 1, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (2, 2, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (3, 3, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (4, 4, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (5, 5, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (6, 6, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (7, 7, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (8, 8, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (9, 9, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (10, 10, 'OPERATIONALIZES');
INSERT INTO GDX_PSY_PHENOMENON_CONSTRUCT (ID_PHENOMENON, ID_CONSTRUCT, RELATION_TYPE) VALUES (11, 11, 'OPERATIONALIZES');

INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (1, 'Hardiness', '1989 / adapt. 2004', 'LIKERT_SCALE', 'Authors: Bartone, Ursano, Wright & Ingraham, 1989; adapt. Mallar & Capitao, 2004. Hardiness scale (30 items, 1-5 Likert).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (2, 'Student Engagement Scale', '2002', 'LIKERT_SCALE', 'Authors: Schaufeli, Martinez, Marques Pinto, Salanova & Bakker, 2002. Academic engagement scale (14 items, 1-5 Likert).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (3, 'Career Adapt-Abilities Scale', '2011', 'LIKERT_SCALE', 'Authors: Duarte, Fraga, Agostinho, Djalo, Lima, Paredes, Rafael & Soares, 2011. Career Adapt-Abilities Scale (28 items, 1-5 Likert).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (4, 'Satisfaction With Life Scale', '1985', 'LIKERT_SCALE', 'Authors: Diener, Emmons, Larson & Griffin, 1985. Satisfaction With Life Scale (5 items, 1-5 Likert).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (5, 'Job Satisfaction Scale', '2000', 'LIKERT_SCALE', 'Authors: Judge & Klinger, 2000. Job satisfaction scale (5 items, 1-5 Likert).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (6, 'Positivity Ratio Scale', '2009 / adapt. 2010', 'LIKERT_SCALE', 'Authors: Fredrickson, 2009; De Sousa, Goncalves & Rosinha, 2010. Positivity Ratio (20 items, 0-4 scale).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (7, 'Personal Satisfaction', '1995', 'SINGLE_ITEM', 'Authors: Diener, 1995. Single item on personal satisfaction (1-5 Likert).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (8, 'Perceived Control of Life', '1998', 'SINGLE_ITEM', 'Authors: Inglehart, 1998. Single item on perceived control over life (1-5 Likert).', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (9, 'Maslach Burnout Inventory - Student Survey (hypothesis - unconfirmed)', '2009 (hypothesis)', 'LIKERT_SCALE', 'Authors (hypothesis): Maroco & Tecedeiro, 2009. UNCONFIRMED HYPOTHESIS (see SPSS_to_Firebird_Mapping.md section 3): the summary table documents 15 items, but the .sav has 18 columns ef1-ef18; items ef16-ef18 have no known wording; no dimension score is computed in the .sav.', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (10, 'Undocumented Organizational Block (hypothesis - an1-an11)', 'unknown (hypothesis)', 'LIKERT_SCALE', 'UNCONFIRMED HYPOTHESIS (see SPSS_to_Firebird_Mapping.md section 3): the name, author and item wording for an1-an11 do not appear in the summary table or the pptx; hypothesized sub-dimensions: AnoOrg, SucProfFin, CondSocie, RealizPess.', 1);
INSERT INTO GDX_PSY_INSTRUMENT (ID_INSTRUMENT, NAME, VERSION, TYPE, DESCRIPTION, ACTIVE) VALUES (11, 'Red Tape / Perceived Bureaucracy (hypothesis - red1-red5)', 'unknown (hypothesis)', 'LIKERT_SCALE', 'UNCONFIRMED HYPOTHESIS (see SPSS_to_Firebird_Mapping.md section 3): the name matches RedTap but the scale/author/item wording for red1-red5 is undocumented.', 1);

INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (1, 1, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (2, 2, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (3, 3, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (4, 4, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (5, 5, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (6, 6, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (7, 7, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (8, 8, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (9, 9, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (10, 10, 1);
INSERT INTO GDX_PSY_INSTRUMENT_CONSTRUCT (ID_INSTRUMENT, ID_CONSTRUCT, WEIGHT) VALUES (11, 11, 1);

INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (1, 1, 'Commitment (Hardiness)', 'Commitment dimension of the Hardiness scale.', '.sav column: HARDcompromis (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (2, 1, 'Control (Hardiness)', 'Control dimension of the Hardiness scale.', '.sav column: HARDcontrole (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (3, 1, 'Challenge (Hardiness)', 'Challenge dimension of the Hardiness scale.', '.sav column: HARDdesafio (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (4, 2, 'Vigor (Engagement)', 'Vigor dimension of Academic Engagement.', '.sav column: ENGAGvigor (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (5, 2, 'Dedication (Engagement)', 'Dedication dimension of Academic Engagement.', '.sav column: ENGAGdedicac (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (6, 2, 'Absorption (Engagement)', 'Absorption dimension of Academic Engagement.', '.sav column: ENGAGabsorc (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (7, 3, 'Concern (Career Adaptability)', 'Concern dimension of Career Adaptability.', '.sav column: ACpreocup (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (8, 3, 'Control (Career Adaptability)', 'Control dimension of Career Adaptability.', '.sav column: ACcontrole (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (9, 3, 'Curiosity (Career Adaptability)', 'Curiosity dimension of Career Adaptability.', '.sav column: ACcuriosid (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (10, 3, 'Confidence (Career Adaptability)', 'Confidence dimension of Career Adaptability.', '.sav column: ACconfianc (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (11, 4, 'Satisfaction With Life (index)', 'Single index of Satisfaction With Life.', '.sav column: SATISFVIDA (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (12, 5, 'Job Satisfaction (index)', 'Single index of Job Satisfaction.', '.sav column: SATISFTRAB (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (13, 6, 'Positive Emotions', 'Mean of the positive RP items (1,4,8,11,12,13,14,15,16,19).', '.sav column: EmocPos (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (14, 6, 'Negative Emotions', 'Mean of the negative RP items (2,3,5,6,7,9,10,17,18,20).', '.sav column: EmocNeg (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (15, 7, 'Personal Satisfaction (index)', 'Single index of Personal Satisfaction.', '.sav column: SatPes (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (16, 8, 'Perceived Control of Life (index)', 'Single index of Perceived Control of Life.', '.sav column: CtrlVi (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (17, 10, 'Organizational Anomie (hypothesis)', 'HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed.', '.sav column: AnoOrg (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (18, 10, 'Professional/Financial Success (hypothesis)', 'HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed.', '.sav column: SucProfFin (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (19, 10, 'Social Standing (hypothesis)', 'HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed.', '.sav column: CondSocie (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (20, 10, 'Personal Fulfillment (hypothesis)', 'HYPOTHESIS: sub-dimension of block an1-an11, name/author unconfirmed.', '.sav column: RealizPess (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
INSERT INTO GDX_PSY_VARIABLE (ID_VARIABLE, ID_CONSTRUCT, NAME, DESCRIPTION, OPERATIONAL_DEFINITION, VARIABLE_TYPE, MEASUREMENT_LEVEL) VALUES (21, 11, 'Red Tape (index, hypothesis)', 'HYPOTHESIS: index of perceived bureaucracy derived from red1-red5.', '.sav column: RedTap (mean of the dimension''s items, 0-5)', 'PSYCHOLOGICAL', 'INTERVAL');
