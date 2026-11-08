/* ============================================================================
   APPROVED field for every "_MAP" relationship/correspondence table
   (Firebird 2.5)

   Extends:
     1) GDX_PSY_SEPT_LEVEL_PSY_MAP (3.septenary.constitution/septenary_constitution_model_firebird25.sql)
     2) GDX_PSY_CHAKRA_VAR_MAP     (14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql)
     3) GDX_TA_WAY_SEPT_MAP        (5.five.ways.tomas.aquino/five_ways_septenary_map_firebird25.sql,
                                     extended by metaphysical_variable_way_map_firebird25.sql)
     4) GDX_VT_VARIABLE_VIRTUE_MAP (12.gdx.virtology/virtology_model_firebird25.sql)
     5) GDX_PH_EVENT_VAR_MAP       (15.environmental.anomalous.phenomena/environmental_anomalous_phenomena_model_firebird25.sql)

   Prerequisite: the five scripts above already applied to the database.

   Unlike confirmation_fields_association_maps_firebird25.sql (which only had
   to ALTER three of these tables, since GDX_VT_VARIABLE_VIRTUE_MAP and
   GDX_PH_EVENT_VAR_MAP already got NUMBER_CONFIRMATIONS/CONFIRMATION_BY/
   NAME_INSTITUTION baked into their own CREATE TABLE), APPROVED is brand new
   to all five -- none of them had it at creation time, so every one of them
   needs this same ALTER TABLE.

   Purpose: APPROVED records a human review/sign-off decision, separate from
   CONFIDENCE_LEVEL (a self-assessed grade on the correspondence itself) and
   NUMBER_CONFIRMATIONS (how many independent people corroborated it) --
   APPROVED is "has someone with authority to do so signed off on this row
   being correct/usable," a single yes/no gate. DEFAULT 0 (not approved) so
   any NEW row inserted after this script lands in a pending-review state
   until someone explicitly approves it; existing rows are backfilled to 1 by
   the companion DML script (approved_field_association_maps_dml_firebird25.sql).

   SMALLINT + CHECK IN (0,1), the same boolean-flag convention already used
   throughout this project (ACTIVE_FLAG, REQUIRED, CONSENT, REVERSED -- see
   godatax_human_full_ddl_no_gdx_ead_firebird25.sql) -- Firebird 2.5 has no
   native BOOLEAN type (that is Firebird 3.0+).
   ============================================================================ */

ALTER TABLE GDX_PSY_SEPT_LEVEL_PSY_MAP
  ADD APPROVED SMALLINT DEFAULT 0 NOT NULL;

ALTER TABLE GDX_PSY_SEPT_LEVEL_PSY_MAP
  ADD CONSTRAINT CK_GDX_PSY_SLPM_APPROVED CHECK (APPROVED IN (0,1));

COMMIT;

ALTER TABLE GDX_PSY_CHAKRA_VAR_MAP
  ADD APPROVED SMALLINT DEFAULT 0 NOT NULL;

ALTER TABLE GDX_PSY_CHAKRA_VAR_MAP
  ADD CONSTRAINT CK_GDX_PSY_CHAKRA_VM_APPROVED CHECK (APPROVED IN (0,1));

COMMIT;

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  ADD APPROVED SMALLINT DEFAULT 0 NOT NULL;

ALTER TABLE GDX_TA_WAY_SEPT_MAP
  ADD CONSTRAINT CK_GDX_TA_WSM_APPROVED CHECK (APPROVED IN (0,1));

COMMIT;

ALTER TABLE GDX_VT_VARIABLE_VIRTUE_MAP
  ADD APPROVED SMALLINT DEFAULT 0 NOT NULL;

ALTER TABLE GDX_VT_VARIABLE_VIRTUE_MAP
  ADD CONSTRAINT CK_GDX_VT_VVM_APPROVED CHECK (APPROVED IN (0,1));

COMMIT;

ALTER TABLE GDX_PH_EVENT_VAR_MAP
  ADD APPROVED SMALLINT DEFAULT 0 NOT NULL;

ALTER TABLE GDX_PH_EVENT_VAR_MAP
  ADD CONSTRAINT CK_GDX_PH_EVM_APPROVED CHECK (APPROVED IN (0,1));

COMMIT;
