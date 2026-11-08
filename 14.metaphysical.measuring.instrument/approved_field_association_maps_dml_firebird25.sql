/* ============================================================================
   DML - mark every existing association as approved (Firebird 2.5)
   Extension of approved_field_association_maps_firebird25.sql

   Every row that already existed in these five "_MAP" tables before the
   APPROVED column was added represents a correspondence already in active
   use throughout the project (read by GDX_SKILL_LIST_ASSOCIATIONS,
   GDX_SKILL_IDENTIFY_VIRTUES, GDX_SKILL_LINK_SUGGESTIONS, the dashboards,
   and the knowledge-graph export) -- i.e. already reviewed and relied on in
   practice, even though the APPROVED column itself didn't exist yet to say
   so explicitly. This script sets APPROVED = 1 on all of them. Any row
   inserted AFTER this script runs keeps the column's own DEFAULT 0 (pending
   review) unless whoever inserts it says otherwise.

   GDX_PH_EVENT_VAR_MAP has no rows yet (15.environmental.anomalous.phenomena
   has no DML loaded into it at the time this script was written) -- its
   UPDATE below is a no-op today, kept here so this script stays complete and
   correct once that module's data is loaded.
   ============================================================================ */

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP
  SET APPROVED = 1;

UPDATE GDX_PSY_CHAKRA_VAR_MAP
  SET APPROVED = 1;

UPDATE GDX_TA_WAY_SEPT_MAP
  SET APPROVED = 1;

UPDATE GDX_VT_VARIABLE_VIRTUE_MAP
  SET APPROVED = 1;

UPDATE GDX_PH_EVENT_VAR_MAP
  SET APPROVED = 1;

COMMIT;
