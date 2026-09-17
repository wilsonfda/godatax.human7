/* ============================================================================
   Relational model - The Five Ways (Quinque Viae) of Thomas Aquinas (Firebird 2.5)

   Source: Thomas Aquinas, Summa Theologica, Part I, Question 2, Article 3
   ("Whether God exists?"). The five arguments (cosmological x3, gradation of
   being, teleological) by which Aquinas holds God's existence can be
   demonstrated by natural reason from observed effects.

   This script creates:
     1) GDX_TA_WAY - catalog of the 5 ways, with premise, metaphysical
        principle, reasoning, and the conclusion each way reaches about God
   ============================================================================ */

CREATE TABLE GDX_TA_WAY (
  ID_WAY BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  LATIN_NAME VARCHAR(60) NOT NULL,
  ENGLISH_NAME VARCHAR(100) NOT NULL,
  ARGUMENT_TYPE VARCHAR(60) NOT NULL,
  PREMISE VARCHAR(1000) NOT NULL,
  METAPHYSICAL_PRINCIPLE VARCHAR(1000) NOT NULL,
  REASONING BLOB SUB_TYPE TEXT NOT NULL,
  CONCLUSION VARCHAR(500) NOT NULL,
  SOURCE_REFERENCE VARCHAR(300) NOT NULL,
  CONSTRAINT PK_GDX_TA_WAY PRIMARY KEY (ID_WAY),
  CONSTRAINT UQ_GDX_TA_WAY_ORDER UNIQUE (ORDER_NUM),
  CONSTRAINT UQ_GDX_TA_WAY_NAME UNIQUE (LATIN_NAME),
  CONSTRAINT CK_GDX_TA_WAY_ORDER CHECK (ORDER_NUM BETWEEN 1 AND 5)
);

/* Firebird 2.5: generator and trigger for the surrogate key. */
CREATE SEQUENCE SEQ_GDX_TA_WAY;

SET TERM ^ ;

CREATE TRIGGER BI_GDX_TA_WAY FOR GDX_TA_WAY ACTIVE BEFORE INSERT POSITION 0 AS
BEGIN
  IF (NEW.ID_WAY IS NULL) THEN
    NEW.ID_WAY = NEXT VALUE FOR SEQ_GDX_TA_WAY;
END^

SET TERM ; ^

/* ============================================================================
   DML - The 5 ways, in the order Aquinas presents them.
   ============================================================================ */

INSERT INTO GDX_TA_WAY
  (ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, PREMISE, METAPHYSICAL_PRINCIPLE,
   REASONING, CONCLUSION, SOURCE_REFERENCE)
VALUES
  (1, 1, 'Prima Via', 'Argument from Motion', 'COSMOLOGICAL',
   'Some things in the world are evidently in motion (in the Aristotelian sense: any change from potency to act, not only local movement).',
   'Whatever is in motion is moved by another; nothing can move itself from potentiality to actuality except by something already in actuality.',
   'If the mover is itself moved, it too must be moved by another, and that by another again. This series cannot regress to infinity, for then there would be no first mover, and consequently no subsequent mover, and no motion at all -- which contradicts what is observed.',
   'Therefore there must be a First Mover, itself unmoved by anything -- "and this everyone understands to be God."',
   'Summa Theologica I, Q.2, Art.3, corpus (1st way)');

INSERT INTO GDX_TA_WAY
  (ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, PREMISE, METAPHYSICAL_PRINCIPLE,
   REASONING, CONCLUSION, SOURCE_REFERENCE)
VALUES
  (2, 2, 'Secunda Via', 'Argument from Efficient Cause', 'COSMOLOGICAL',
   'In the world of sensible things we find an order of efficient causes: nothing is observed to be the efficient cause of itself.',
   'Nothing can be its own efficient cause, for it would then have to exist prior to itself, which is impossible.',
   'To take away the cause is to take away the effect; so if there were no first efficient cause, there would be no intermediate causes and no final (present) effect. An infinite regress of efficient causes, with no first cause, is therefore impossible.',
   'Therefore it is necessary to admit a First Efficient Cause -- "to which everyone gives the name of God."',
   'Summa Theologica I, Q.2, Art.3, corpus (2nd way)');

INSERT INTO GDX_TA_WAY
  (ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, PREMISE, METAPHYSICAL_PRINCIPLE,
   REASONING, CONCLUSION, SOURCE_REFERENCE)
VALUES
  (3, 3, 'Tertia Via', 'Argument from Contingency (Possibility and Necessity)', 'COSMOLOGICAL',
   'Things in nature are found to be possible to be and not to be (contingent): they are generated and they corrupt, so at some time they exist and at some time they do not.',
   'If everything were merely contingent (able not to exist), then at some point in time nothing at all would have existed -- and from nothing, nothing begins to exist -- so nothing would exist even now, which is observably false.',
   'Therefore not all beings are merely contingent; something must exist necessarily. Every necessary being either has the cause of its necessity from another or not; an infinite regress of necessary beings each caused by another is impossible, just as with efficient causes.',
   'Therefore we must posit something that is necessary in itself, not receiving its necessity from another, but rather causing necessity in other things -- "this all men speak of as God."',
   'Summa Theologica I, Q.2, Art.3, corpus (3rd way)');

INSERT INTO GDX_TA_WAY
  (ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, PREMISE, METAPHYSICAL_PRINCIPLE,
   REASONING, CONCLUSION, SOURCE_REFERENCE)
VALUES
  (4, 4, 'Quarta Via', 'Argument from the Gradation of Being', 'ONTOLOGICAL/AXIOLOGICAL (degrees of perfection)',
   'Among beings some are found to be more good, more true, more noble, and so on, than others -- perfections admit of degrees ("more and less").',
   '"More and less" are predicated of different things according as they more or less resemble something that is the maximum of that quality (e.g. a thing is hotter the more it resembles that which is hottest); and per Aristotle, the maximum in any genus is the cause of everything in that genus.',
   'So there must be something which is truest, best, noblest, and consequently most fully being, since (per Aristotle, Metaphysics II) things are true to the degree that they have being.',
   'Therefore there must be something which is to all beings the cause of their being, their goodness, and every other perfection -- "and this we call God."',
   'Summa Theologica I, Q.2, Art.3, corpus (4th way)');

INSERT INTO GDX_TA_WAY
  (ID_WAY, ORDER_NUM, LATIN_NAME, ENGLISH_NAME, ARGUMENT_TYPE, PREMISE, METAPHYSICAL_PRINCIPLE,
   REASONING, CONCLUSION, SOURCE_REFERENCE)
VALUES
  (5, 5, 'Quinta Via', 'Argument from the Governance of the World (Teleological)', 'TELEOLOGICAL',
   'We observe that things which lack intelligence, such as natural bodies, act for an end: they act always, or nearly always, in the same way so as to achieve what is best, which shows they do not act by chance but by design.',
   'Whatever lacks intelligence cannot move toward an end unless directed by some being endowed with knowledge and intelligence, as an arrow is directed by an archer.',
   'Since natural, non-intelligent bodies consistently act toward an end (their proper good), and cannot do so by themselves, they must be directed by an intelligent being.',
   'Therefore some intelligent being exists by whom all natural things are directed to their end -- "and this being we call God."',
   'Summa Theologica I, Q.2, Art.3, corpus (5th way)');
