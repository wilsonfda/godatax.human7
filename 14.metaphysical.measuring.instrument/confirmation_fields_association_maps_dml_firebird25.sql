/* ============================================================================
   DML - mark every existing association as confirmed once (Firebird 2.5)
   Extension of confirmation_fields_association_maps_firebird25.sql

   All rows that existed in the three association tables before the
   NUMBER_CONFIRMATIONS/CONFIRMATION_BY/NAME_INSTITUTION columns were added
   represent correspondences the user themself made/reviewed. This script
   sets NUMBER_CONFIRMATIONS = 1, CONFIRMATION_BY = 'WFDA' and
   NAME_INSTITUTION = 'Nova Acropole Lisboa' on all of them (one
   confirmation: the user's own association).
   ============================================================================ */

UPDATE GDX_PSY_SEPT_LEVEL_PSY_MAP
  SET NUMBER_CONFIRMATIONS = 1, CONFIRMATION_BY = 'WFDA', NAME_INSTITUTION = 'Nova Acropole Lisboa';

UPDATE GDX_PSY_CHAKRA_VAR_MAP
  SET NUMBER_CONFIRMATIONS = 1, CONFIRMATION_BY = 'WFDA', NAME_INSTITUTION = 'Nova Acropole Lisboa';

UPDATE GDX_TA_WAY_SEPT_MAP
  SET NUMBER_CONFIRMATIONS = 1, CONFIRMATION_BY = 'WFDA', NAME_INSTITUTION = 'Nova Acropole Lisboa';

COMMIT;
