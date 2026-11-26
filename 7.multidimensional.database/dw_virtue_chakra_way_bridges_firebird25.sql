/* ============================================================================
   DW extension - Virtue dimension + variable<->virtue/chakra/way bridges
   (Firebird 2.5)

   Extends: 7.multidimensional.database/godatax_human_dw_model_firebird25.sql
   (DW_DIM_VARIABLE, DW_DIM_CHAKRA, DW_DIM_FIVE_WAY must already exist).
   Written as a separate file rather than editing that already-applied model
   file in place, the same convention already used for every other extension
   to an already-loaded schema in this project (e.g.
   14.metaphysical.measuring.instrument/metaphysical_variable_chakra_map_firebird25.sql,
   metaphysical_variable_way_map_firebird25.sql,
   confirmation_fields_association_maps_firebird25.sql).

   Why this exists: GDX_SKILL_LOAD_NEW_STUDY_DW's bootstrapChakras()/
   bootstrapFiveWays() already load DW_DIM_CHAKRA/DW_DIM_FIVE_WAY as flat
   catalogs, and loadVariables() already reconciles DW_DIM_VARIABLE's single
   ID_SEPTENARY_LEVEL column from GDX_PSY_SEPT_LEVEL_PSY_MAP. There was no
   equivalent for the three other interpretive "_MAP" correspondence tables
   this project already has (GDX_VT_VARIABLE_VIRTUE_MAP, GDX_PSY_CHAKRA_VAR_MAP,
   GDX_TA_WAY_SEPT_MAP's variable extension) -- Virtology's 33 virtues had no
   DW dimension at all, and none of the three variable-level correspondences
   reached the DW.

   Why bridge tables, not three more single FK columns on DW_DIM_VARIABLE
   (mirroring ID_SEPTENARY_LEVEL): unlike septenary level, these three
   correspondences are genuinely many-to-many in the live data already --
   e.g. GDX_VT_VARIABLE_VIRTUE_MAP has the IPIP-VIA "Forgiveness" variable
   mapped to three different virtues (Perdao, Reconciliacao, Pagar o Mal com
   o Bem) and "Integrity/Honesty/Authenticity" mapped to three more (Verdade,
   Honestidade, Pureza de Coracao). A single ID_VIRTUE column on
   DW_DIM_VARIABLE (like ID_SEPTENARY_LEVEL's "take FIRST 1" reconciliation)
   would silently drop every mapping past the first for those variables. A
   proper many-to-many bridge table keeps every row.

   Table naming uses DW_BRIDGE_ (not DW_DIM_/DW_FACT_) to say plainly what
   these are -- pure dimension-to-dimension links, no measures of their own.
   GDX_SKILL_GODATAX_HUMAN7_BY_SPU's schema introspection (9.knowledge.graph)
   is updated in the same change to recognize this new prefix, so these
   tables are picked up by the knowledge-graph export exactly like every
   other DW_* table, with no further code change there.

   No surrogate key/sequence/trigger on the three bridge tables -- each uses
   a composite natural primary key (ID_VARIABLE, ID_<other>), the same
   plain-junction-table shape already used elsewhere in this project for a
   pure many-to-many link with no attributes of its own worth a surrogate id
   (e.g. GDX_PSY_INSTRUMENT_CONSTRUCT, GDX_PSY_STUDY_PARTICIPANT).

   Loaded by GDX_SKILL_LOAD_NEW_STUDY_DW (load_new_study_dw.js):
     - bootstrapVirtues()            -> DW_DIM_VIRTUE (global, bootstrap-once)
     - loadVariableVirtueBridge()    -> DW_BRIDGE_VARIABLE_VIRTUE
     - loadVariableChakraBridge()    -> DW_BRIDGE_VARIABLE_CHAKRA
     - loadVariableWayBridge()       -> DW_BRIDGE_VARIABLE_WAY
   All four are insert-if-missing and NOT scoped by study (same "global
   reference, bootstrapped once" treatment as DW_DIM_CHAKRA/DW_DIM_FIVE_WAY),
   since GDX_VT_VARIABLE_VIRTUE_MAP / GDX_PSY_CHAKRA_VAR_MAP /
   GDX_TA_WAY_SEPT_MAP are themselves catalog-level correspondences, not
   per-study data.
   ============================================================================ */


/* ----------------------------------------------------------------------------
   DW_DIM_VIRTUE  <- GDX_VT_VIRTUE (12.gdx.virtology)
   Same shape as DW_DIM_CHAKRA/DW_DIM_FIVE_WAY: reuses the OLTP table's own
   surrogate id as this dimension's key directly, no separate DW-only id.
   ---------------------------------------------------------------------------- */
CREATE TABLE DW_DIM_VIRTUE (
  ID_VIRTUE BIGINT NOT NULL,
  ORDER_NUM SMALLINT NOT NULL,
  NAME_PT VARCHAR(60) NOT NULL,
  NAME_EN VARCHAR(60) NOT NULL,
  CONSTRAINT PK_DW_DIM_VIRTUE PRIMARY KEY (ID_VIRTUE)
);

COMMIT;


/* ----------------------------------------------------------------------------
   DW_BRIDGE_VARIABLE_VIRTUE  <- GDX_VT_VARIABLE_VIRTUE_MAP
   SCALE_POLARITY copied through verbatim (POSITIVE/NEGATIVE) so a query can
   tell, without a join back to the OLTP, whether a high raw score on this
   variable reads as the virtue already present or as its deficit -- same
   reading GDX_SKILL_LINK_SUGGESTIONS/GDX_SKILL_IDENTIFY_VIRTUES apply.
   ---------------------------------------------------------------------------- */
CREATE TABLE DW_BRIDGE_VARIABLE_VIRTUE (
  ID_VARIABLE BIGINT NOT NULL,
  ID_VIRTUE BIGINT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20),
  SCALE_POLARITY VARCHAR(10),
  CONSTRAINT PK_DW_BRVV PRIMARY KEY (ID_VARIABLE, ID_VIRTUE),
  CONSTRAINT FK_DW_BRVV_VAR FOREIGN KEY (ID_VARIABLE) REFERENCES DW_DIM_VARIABLE(ID_VARIABLE),
  CONSTRAINT FK_DW_BRVV_VIRTUE FOREIGN KEY (ID_VIRTUE) REFERENCES DW_DIM_VIRTUE(ID_VIRTUE)
);

CREATE INDEX IX_DW_BRVV_VIRTUE ON DW_BRIDGE_VARIABLE_VIRTUE(ID_VIRTUE);

COMMIT;


/* ----------------------------------------------------------------------------
   DW_BRIDGE_VARIABLE_CHAKRA  <- GDX_PSY_CHAKRA_VAR_MAP
   ---------------------------------------------------------------------------- */
CREATE TABLE DW_BRIDGE_VARIABLE_CHAKRA (
  ID_VARIABLE BIGINT NOT NULL,
  ID_CHAKRA BIGINT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20),
  CONSTRAINT PK_DW_BRVC PRIMARY KEY (ID_VARIABLE, ID_CHAKRA),
  CONSTRAINT FK_DW_BRVC_VAR FOREIGN KEY (ID_VARIABLE) REFERENCES DW_DIM_VARIABLE(ID_VARIABLE),
  CONSTRAINT FK_DW_BRVC_CHAKRA FOREIGN KEY (ID_CHAKRA) REFERENCES DW_DIM_CHAKRA(ID_CHAKRA)
);

CREATE INDEX IX_DW_BRVC_CHAKRA ON DW_BRIDGE_VARIABLE_CHAKRA(ID_CHAKRA);

COMMIT;


/* ----------------------------------------------------------------------------
   DW_BRIDGE_VARIABLE_WAY  <- GDX_TA_WAY_SEPT_MAP (its ID_VARIABLE extension,
   see 14.metaphysical.measuring.instrument/metaphysical_variable_way_map_firebird25.sql)
   ---------------------------------------------------------------------------- */
CREATE TABLE DW_BRIDGE_VARIABLE_WAY (
  ID_VARIABLE BIGINT NOT NULL,
  ID_WAY BIGINT NOT NULL,
  CONFIDENCE_LEVEL VARCHAR(20),
  CONSTRAINT PK_DW_BRVW PRIMARY KEY (ID_VARIABLE, ID_WAY),
  CONSTRAINT FK_DW_BRVW_VAR FOREIGN KEY (ID_VARIABLE) REFERENCES DW_DIM_VARIABLE(ID_VARIABLE),
  CONSTRAINT FK_DW_BRVW_WAY FOREIGN KEY (ID_WAY) REFERENCES DW_DIM_FIVE_WAY(ID_WAY)
);

CREATE INDEX IX_DW_BRVW_WAY ON DW_BRIDGE_VARIABLE_WAY(ID_WAY);

COMMIT;
