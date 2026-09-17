/* ============================================================================
   GoDataX Human 7 DW - cross-schema FK: GDX_CC_PERSON -> DW_DIM_PERSON
   Location: GDX_HUMAN/7_multidimensional.database/

   Closes the gap noted in GoDataX_Human_7_DW.md section 7, item 1: until now,
   GDX_CC_SESSION.ID_PERSON was only FK-constrained to GDX_CC_PERSON, and
   nothing in the database stopped GDX_CC_PERSON from holding an ID_PERSON
   that has no counterpart in GDX_PSY_PERSON/DW_DIM_PERSON -- the "central
   person" rule (see the DW model script's header) was enforced only by the
   ETL's WHERE EXISTS filter at load time, not by the schema itself.

   This adds a real FOREIGN KEY from GDX_CC_PERSON.ID_PERSON to
   DW_DIM_PERSON.ID_PERSON: from this point on, a cardiac-coherence person
   can only be created (or kept) if that same ID_PERSON already exists in the
   central person dimension. DW_DIM_PERSON.ID_PERSON is a direct, unmodified
   copy of GDX_PSY_PERSON.ID_PERSON (see the ETL script, section 2) -- the FK
   is written against DW_DIM_PERSON specifically, as asked, not against
   GDX_PSY_PERSON directly.

   Prerequisites, in order:
     1) 2_relational.model.psychometrics/psychometrics_model_firebird25.sql
     2) 6_cardiac.coherence/gdx_coerencia_cardiaca_fb25_ddl.sql
     3) godatax_human_dw_model_firebird25.sql (this folder)
     4) godatax_human_dw_etl_firebird25.sql (this folder) -- DW_DIM_PERSON
        must already be loaded, or the ALTER TABLE below will fail validating
        existing GDX_CC_PERSON rows against an empty DW_DIM_PERSON.

   Note: this makes DW_DIM_PERSON a load-bearing table for the OLTP cardiac
   schema, not just a read-only copy for reporting -- re-running the DW ETL
   from an empty state (see GoDataX_Human_7_DW.md section 7, item 4) will
   need DW_DIM_PERSON reloaded before any GDX_CC_PERSON insert can succeed.
   ============================================================================ */

ALTER TABLE GDX_CC_PERSON
  ADD CONSTRAINT FK_GDX_CC_PERSON_DW_PERSON
  FOREIGN KEY (ID_PERSON) REFERENCES DW_DIM_PERSON (ID_PERSON);
