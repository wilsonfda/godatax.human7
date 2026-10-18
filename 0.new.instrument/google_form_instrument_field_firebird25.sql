/* ============================================================================
   Google Form output field for GDX_PSY_INSTRUMENT (Firebird 2.5)

   Extends: GDX_PSY_INSTRUMENT (2.relational.model.psychometrics/psychometrics_model_firebird25.sql)

   Purpose: GDX_SKILL_GENERATE_GOOGLE_FORM
   (0.new.instrument/.claude/skills/GDX_SKILL_GENERATE_GOOGLE_FORM) creates one
   real Google Form per study -- one page-break section per instrument -- and
   today only prints its result (edit link, share link, where
   google_form_map.json was written, and the post-creation instructions) to
   the terminal. This column gives that same output a permanent home next to
   the instrument it was generated for, instead of living only in a shell
   scrollback.

   GOOGLE_FORM_INFO - free text, no fixed shape: the exact block
     generate_google_form.js prints after a successful (non-dry-run) create --
     the form's edit URL, its responder/share URL, the google_form_map.json
     path, the questions-mapped counts, and the "send this link to
     participants / then run GDX_SKILL_LOAD_GOOGLE_FORM_ANSWERS" instructions.
     BLOB SUB_TYPE TEXT (same type already used for this table's INSTRUCTIONS
     column) because that whole block, plus any future form regenerated for
     the same instrument, must comfortably fit without a length cap.
     NULLABLE: an instrument with no Google Form generated for it yet has
     nothing to carry here.

   One form covers every instrument in a study (one section each), so the
   same block is written to every instrument row that form was generated for
   -- not split or paraphrased per instrument.
   ============================================================================ */

ALTER TABLE GDX_PSY_INSTRUMENT
  ADD GOOGLE_FORM_INFO BLOB SUB_TYPE TEXT;

COMMIT;
