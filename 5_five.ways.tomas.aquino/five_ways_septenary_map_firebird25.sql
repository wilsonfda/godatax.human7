/* ============================================================================
   Relational model - The Five Ways (Aquinas) x Septenary Constitution (Firebird 2.5)
   Extension of five_ways_model_firebird25.sql (this folder) and
   GDX_HUMAN/3_septenary.constitution/septenary_constitution_model_firebird25.sql

   Prerequisites: both of the scripts above already applied to the database
   (tables GDX_TA_WAY and GDX_PSY_SEPTENARY_LEVEL must exist for the FKs below).

   Why the Septenary Constitution and not the Chakras (kundalini) table:
   the Five Ways are pure philosophical/metaphysical argumentation (act and
   potency, efficient causation, contingency and necessity, degrees of being,
   final causality) -- a Western scholastic model of levels of BEING and
   reasoning, which pairs naturally with the Septenary Constitution (also a
   metaphysical model of levels of being/consciousness). The chakra system is
   primarily a model of embodied/energetic centers (yogic physiology), which
   has no natural counterpart for a step-by-step syllogistic proof; forcing a
   chakra correspondence here would be considerably weaker than the mapping
   below.

   Correspondence criterion: each way is related to the septenary level that
   best characterizes the FACULTY OF REASONING it exercises (not to the
   conclusion, since all five ways converge on the same conclusion -- "this
   everyone calls God" -- which would trivially map every row to level 7 and
   make the relation uninformative). Read together, the mapping below
   reproduces a well-documented observation about the Five Ways themselves:
   they run in an ascending order of abstraction, from reasoning about
   sensible motion (way 1) to recognizing intelligent purpose (way 5) --
   levels 4 -> 4 -> 5 -> 5 -> 6. Level 7 (Atmic Body/Spirit) is deliberately
   NOT assigned to any individual way in this table; it is the shared
   destination all five arguments reach, not a step in any one of them (see
   the closing note in section 2 below).

   This script creates:
     1) GDX_TA_WAY_SEPT_MAP - relation between a Way and a Septenary Level,
        with the justification for the correspondence
   ============================================================================ */

CREATE TABLE GDX_TA_WAY_SEPT_MAP (
  ID_MAPPING BIGINT NOT NULL,
  ID_WAY BIGINT NOT NULL,
  ID_SEPTENARY_LEVEL BIGINT NOT NULL,
  CORRESPONDENCE_JUSTIFICATION BLOB SUB_TYPE TEXT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20) DEFAULT 'SPECULATIVE' NOT NULL,
  CONSTRAINT PK_GDX_TA_WSM PRIMARY KEY (ID_MAPPING),
  CONSTRAINT FK_GDX_TA_WSM_WAY FOREIGN KEY (ID_WAY)
    REFERENCES GDX_TA_WAY(ID_WAY),
  CONSTRAINT FK_GDX_TA_WSM_LEVEL FOREIGN KEY (ID_SEPTENARY_LEVEL)
    REFERENCES GDX_PSY_SEPTENARY_LEVEL(ID_SEPTENARY_LEVEL),
  CONSTRAINT UQ_GDX_TA_WSM UNIQUE (ID_WAY, ID_SEPTENARY_LEVEL),
  CONSTRAINT CK_GDX_TA_WSM_CONF CHECK (CONFIDENCE_LEVEL IN ('HIGH','MEDIUM','LOW','SPECULATIVE'))
);

CREATE INDEX IX_GDX_TA_WSM_WAY ON GDX_TA_WAY_SEPT_MAP(ID_WAY);
CREATE INDEX IX_GDX_TA_WSM_LEVEL ON GDX_TA_WAY_SEPT_MAP(ID_SEPTENARY_LEVEL);

/* Firebird 2.5: generator and trigger for the surrogate key. */
CREATE SEQUENCE SEQ_GDX_TA_WSM;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_TA_WSM FOR GDX_TA_WAY_SEPT_MAP ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_MAPPING IS NULL) THEN
    NEW.ID_MAPPING = NEXT VALUE FOR SEQ_GDX_TA_WSM;
END^

SET TERM ; ^

/* ============================================================================
   DML - one row per way, in the order defined in five_ways_model_firebird25.sql
   (ID_WAY 1..5), linked to GDX_PSY_SEPTENARY_LEVEL (ID_SEPTENARY_LEVEL 1..7,
   see septenary_constitution_model_firebird25.sql).
   ============================================================================ */

-- Way 1 (Prima Via, Motion) -> Level 4, Lower Mental Body
INSERT INTO GDX_TA_WAY_SEPT_MAP (ID_WAY, ID_SEPTENARY_LEVEL, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (1, 4,
   'The argument reasons about concrete, observable change (motion/potency-to-act) in sensible bodies -- practical, this-worldly causal reasoning, the defining activity of the concrete/lower mental faculty, not yet an abstract judgment of value or an intuitive grasp of purpose.',
   'MEDIUM');

-- Way 2 (Secunda Via, Efficient Cause) -> Level 4, Lower Mental Body
INSERT INTO GDX_TA_WAY_SEPT_MAP (ID_WAY, ID_SEPTENARY_LEVEL, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (2, 4,
   'Like the first way, this argument reasons about an observable causal chain in the world of things (efficient causation) -- concrete cosmological reasoning about how effects follow from causes, still at the level of practical/concrete mind rather than abstract value-judgment.',
   'MEDIUM');

-- Way 3 (Tertia Via, Contingency/Necessity) -> Level 5, Higher Mental Body
INSERT INTO GDX_TA_WAY_SEPT_MAP (ID_WAY, ID_SEPTENARY_LEVEL, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (3, 5,
   'This argument no longer reasons about a single physical chain but about the abstract modal categories of contingency and necessity of being as such -- a judgment about the very identity/status of existence, characteristic of the abstract mind rather than concrete observation.',
   'MEDIUM');

-- Way 4 (Quarta Via, Gradation of Being) -> Level 5, Higher Mental Body
INSERT INTO GDX_TA_WAY_SEPT_MAP (ID_WAY, ID_SEPTENARY_LEVEL, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (4, 5,
   'The argument explicitly reasons from degrees of goodness, truth and nobility -- value-laden abstract judgment -- which is exactly the function attributed to the Higher Mental Body (values, long-term judgment, identity) in the Septenary Constitution reference table.',
   'HIGH');

-- Way 5 (Quinta Via, Teleological) -> Level 6, Buddhic Body
INSERT INTO GDX_TA_WAY_SEPT_MAP (ID_WAY, ID_SEPTENARY_LEVEL, CORRESPONDENCE_JUSTIFICATION, CONFIDENCE_LEVEL)
VALUES
  (5, 6,
   'Recognizing purpose/design/order in nature is an act of grasping meaning beyond mechanical description -- the defining function of the Buddhic level (intuition, existential meaning-making) rather than a further step of discursive/abstract reasoning.',
   'SPECULATIVE');

/* ============================================================================
   Note on level 7 (Atmic Body/Spirit): deliberately not assigned to any row
   above. All five ways converge on the same conclusion -- "this all men call
   God" -- which corresponds to level 7 as the shared destination/object of
   the whole Quinque Viae, not as a property of any single way's reasoning
   process. If a future need arises to record that convergence explicitly,
   the natural place is a note on GDX_TA_WAY itself (e.g. a
   SHARED_CONCLUSION_LEVEL reference), not a 6th row here, to avoid making
   every way trivially map to the same level.
   ============================================================================ */
