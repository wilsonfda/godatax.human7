/* ============================================================================
   Relational model - Chakras (Kundalini) x Septenary Constitution (Firebird 2.5)
   Extension of GDX_HUMAN/septenary.constitution/septenary_constitution_model_firebird25.sql

   Prerequisite: septenary_constitution_model_firebird25.sql already applied to the
   database (table GDX_PSY_SEPTENARY_LEVEL must exist for the FK below).

   Correspondence adopted: ascending ordinal. In the yogic tradition, the 7 chakras
   are described as an energetic ladder from the densest (base of the spine) to the
   subtlest (top of the head) - the same ascending logic (from the Physical Body to
   the Atmic Body/Spirit) used in the Septenary Constitution. That is why the chakra
   of order N is related to the septenary level of the same order N. This is a
   symbolic/interpretive correspondence (a yoga-theosophy syncretism common in
   Western esoteric literature), not an empirical finding.

   This script creates:
     1) GDX_PSY_CHAKRA - catalog of the 7 chakras, symbolic function and relation to
        GDX_PSY_SEPTENARY_LEVEL (field ID_SEPTENARY_LEVEL)
   ============================================================================ */

CREATE TABLE GDX_PSY_CHAKRA (
  ID_CHAKRA BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  SANSKRIT_NAME VARCHAR(60) NOT NULL,
  COMMON_NAME VARCHAR(60) NOT NULL,
  LOCATION VARCHAR(120),
  SYMBOLIC_COLOR VARCHAR(40),
  SYMBOLIC_ELEMENT VARCHAR(40),
  SEED_MANTRA VARCHAR(20),
  SYMBOLIC_FUNCTION VARCHAR(500) NOT NULL,
  ID_SEPTENARY_LEVEL BIGINT NOT NULL,
  SEPTENARY_LEVEL_JUSTIFICATION VARCHAR(500),
  CONSTRAINT PK_GDX_PSY_CHAKRA PRIMARY KEY (ID_CHAKRA),
  CONSTRAINT UQ_GDX_PSY_CHAKRA_ORDER UNIQUE (ORDER_NUM),
  CONSTRAINT UQ_GDX_PSY_CHAKRA_NAME UNIQUE (SANSKRIT_NAME),
  CONSTRAINT CK_GDX_PSY_CHAKRA_ORDER CHECK (ORDER_NUM BETWEEN 1 AND 7),
  CONSTRAINT FK_GDX_PSY_CHAKRA_LEVEL FOREIGN KEY (ID_SEPTENARY_LEVEL)
    REFERENCES GDX_PSY_SEPTENARY_LEVEL(ID_SEPTENARY_LEVEL)
);

CREATE INDEX IX_GDX_PSY_CHAKRA_LEVEL ON GDX_PSY_CHAKRA(ID_SEPTENARY_LEVEL);

/* Firebird 2.5: generator and trigger for the surrogate key. */
CREATE SEQUENCE SEQ_GDX_PSY_CHAKRA;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_PSY_CHAKRA FOR GDX_PSY_CHAKRA ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_CHAKRA IS NULL) THEN
    NEW.ID_CHAKRA = NEXT VALUE FOR SEQ_GDX_PSY_CHAKRA;
END^

SET TERM ; ^

/* ============================================================================
   DML - Catalog of the 7 chakras, related to GDX_PSY_SEPTENARY_LEVEL by ascending
   order (ID_SEPTENARY_LEVEL 1..7 as defined in
   septenary_constitution_model_firebird25.sql).
   ============================================================================ */

INSERT INTO GDX_PSY_CHAKRA
  (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LOCATION, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT,
   SEED_MANTRA, SYMBOLIC_FUNCTION, ID_SEPTENARY_LEVEL, SEPTENARY_LEVEL_JUSTIFICATION)
VALUES
  (1, 1, 'Muladhara', 'Root Chakra', 'Base of the spine/perineum', 'Red', 'Earth', 'LAM',
   'Survival, grounding, safety, basic bodily instincts',
   1, 'Corresponds to the Physical Body (level 1) - both govern the material/instinctive base of existence');

INSERT INTO GDX_PSY_CHAKRA
  (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LOCATION, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT,
   SEED_MANTRA, SYMBOLIC_FUNCTION, ID_SEPTENARY_LEVEL, SEPTENARY_LEVEL_JUSTIFICATION)
VALUES
  (2, 2, 'Svadhisthana', 'Sacral Chakra', 'Below the navel/sacral region', 'Orange', 'Water', 'VAM',
   'Vitality, pleasure, creative and procreative energy, basic emotional fluidity',
   2, 'Corresponds to the Vital/Etheric Body (level 2) - both govern the vital energy that sustains and moves the physical body');

INSERT INTO GDX_PSY_CHAKRA
  (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LOCATION, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT,
   SEED_MANTRA, SYMBOLIC_FUNCTION, ID_SEPTENARY_LEVEL, SEPTENARY_LEVEL_JUSTIFICATION)
VALUES
  (3, 3, 'Manipura', 'Solar Plexus Chakra', 'Solar plexus/stomach region', 'Yellow', 'Fire', 'RAM',
   'Personal will, self-esteem, power to act, emotions tied to the ego',
   3, 'Corresponds to the Astral Body (level 3) - both govern emotions, desires and the affective charge tied to personal identity');

INSERT INTO GDX_PSY_CHAKRA
  (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LOCATION, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT,
   SEED_MANTRA, SYMBOLIC_FUNCTION, ID_SEPTENARY_LEVEL, SEPTENARY_LEVEL_JUSTIFICATION)
VALUES
  (4, 4, 'Anahata', 'Heart Chakra', 'Center of the chest', 'Green', 'Air', 'YAM',
   'Love, compassion, relationship, bridge between the concrete/practical and the abstract/higher',
   4, 'Corresponds to the Lower Mental Body (level 4) - the first center where experience begins to be processed in a relational/concrete-cognitive way, not merely reactive');

INSERT INTO GDX_PSY_CHAKRA
  (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LOCATION, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT,
   SEED_MANTRA, SYMBOLIC_FUNCTION, ID_SEPTENARY_LEVEL, SEPTENARY_LEVEL_JUSTIFICATION)
VALUES
  (5, 5, 'Vishuddha', 'Throat Chakra', 'Throat', 'Blue', 'Ether/Space', 'HAM',
   'Communication, expression of personal truth, articulation of ideas and values',
   5, 'Corresponds to the Higher Mental Body (level 5) - expressing/articulating values and identity is a function of the abstract mind');

INSERT INTO GDX_PSY_CHAKRA
  (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LOCATION, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT,
   SEED_MANTRA, SYMBOLIC_FUNCTION, ID_SEPTENARY_LEVEL, SEPTENARY_LEVEL_JUSTIFICATION)
VALUES
  (6, 6, 'Ajna', 'Third Eye Chakra', 'Between the eyebrows', 'Indigo', 'Light/Mind', 'OM',
   'Intuition, perception beyond the senses, discernment, inner vision',
   6, 'Corresponds to the Buddhic Body (level 6) - intuition and direct perception of meaning, unmediated by reasoning, is the classic function attributed to both');

INSERT INTO GDX_PSY_CHAKRA
  (ID_CHAKRA, ORDER_NUM, SANSKRIT_NAME, COMMON_NAME, LOCATION, SYMBOLIC_COLOR, SYMBOLIC_ELEMENT,
   SEED_MANTRA, SYMBOLIC_FUNCTION, ID_SEPTENARY_LEVEL, SEPTENARY_LEVEL_JUSTIFICATION)
VALUES
  (7, 7, 'Sahasrara', 'Crown Chakra', 'Top of the head', 'Violet/White', 'Pure thought/Transcendence', '(silent)',
   'Union with the transcendent, pure consciousness, full spiritual realization',
   7, 'Corresponds to the Atmic Body/Spirit (level 7) - both represent the top of the ladder of consciousness, transcendent will and ultimate purpose');
