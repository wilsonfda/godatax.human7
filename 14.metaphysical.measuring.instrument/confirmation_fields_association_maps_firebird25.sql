/* ============================================================================
   Confirmation fields for the three association ("_MAP") tables (Firebird 2.5)

   Extends:
     1) GDX_PSY_SEPT_LEVEL_PSY_MAP (3.septenary.constitution/septenary_constitution_model_firebird25.sql)
     2) GDX_PSY_CHAKRA_VAR_MAP     (14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql)
     3) GDX_TA_WAY_SEPT_MAP        (5.five.ways.tomas.aquino/five_ways_septenary_map_firebird25.sql,
                                     extended by metaphysical_variable_way_map_firebird25.sql)

   Prerequisite: the three scripts above already applied to the database.

   Purpose: each row in these tables records a conceptual/interpretive
   correspondence (Septenary Level <-> Instrument/Variable, Chakra <->
   Instrument/Variable, Way of Aquinas <-> Septenary Level), originally
   carrying only CONFIDENCE_LEVEL (a self-assessed, speculative-to-high
   label). These three columns let that correspondence be independently
   corroborated:

     NUMBER_CONFIRMATIONS - how many times the correspondence has been
       independently confirmed. Defaults to 0 (no NULL rows: a row is
       either unconfirmed or carries a count).
     CONFIRMATION_BY - name of the person who gave the (most recent)
       confirmation. NULLABLE: unconfirmed rows have no confirmer.
     NAME_INSTITUTION - name of the institution the confirmer is
       affiliated with. NULLABLE for the same reason.

   All three columns are plain data, not used in joins/lookups, so no
   index is created for them (consistent with CONFIDENCE_LEVEL, which has
   none either).
   ============================================================================ */

ALTER TABLE GDX_PSY_SEPT_LEVEL_PSY_MAP
  ADD NUMBER_CONFIRMATIONS INTEGER DEFAULT 0 NOT NULL,
  ADD CONFIRMATION_BY VARCHAR(160),
  ADD NAME_INSTITUTION VARCHAR(160);

COMMIT;

ALTER TABLE GDX_PSY_CHAKRA_VAR_MAP
  ADD NUMBER_CONFIRMATIONS INTEGER DEFAULT 0 NOT NULL,
  ADD CONFIRMATION_BY VARCHAR(160),
  ADD NAME_INSTITUTION VARCHAR(160);

COMMIT;

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  ADD NUMBER_CONFIRMATIONS INTEGER DEFAULT 0 NOT NULL,
  ADD CONFIRMATION_BY VARCHAR(160),
  ADD NAME_INSTITUTION VARCHAR(160);

COMMIT;
