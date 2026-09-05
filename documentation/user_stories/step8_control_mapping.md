# Step 8: Detailed User Stories – Control Mapping (Mapping Collection)

* **Persona:** Alice (Compliance Officer / Framework Developer / Enterprise Architect)
* **Goal:** Create, analyze, and publish authoritative cross-framework crosswalks using the official NIST OSCAL Mapping Collection (`mapping-collection`) model (v1.2.2). The document models formal set-theoretic relationships (`maps`) between security baseline resources (catalogs or profiles), captures overarching methodology and rationale (`provenance`), models conditional requirements (`qualifiers`), calculates quantitative confidence and coverage metrics, documents bidirectional compliance gaps (`source-gap-summary` / `target-gap-summary`), and provides interactive Matrix and Sankey visual flow analysis.
* **Lifecycle Position:** Stage 8 in the NIST OSCAL Governance Lifecycle. Establishes cross-framework crosswalks connecting security controls across disparate standards (such as NIST SP 800-53 Rev 5, ISO/IEC 27001:2022, CIS Controls v8, and BSI IT-Grundschutz). Downstream, enables cross-framework inheritance in Stage 3 Component Definitions, unified baseline tailoring in Stage 2 Profiles, and multi-standard compliance reporting in Stage 4 SSPs and Stage 6 Assessment Results.

---

## 1. Breakdown of User Stories

### US 8.1: Mapping Document Initialization & Workspace Inner View
> *Implements [US 0.14](step0_global_requirements.md), [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md), and [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Compliance Officer / Framework Developer (Alice)  
> **I want to** create a new `mapping-collection` document with required top-level metadata and an initialized default mapping entry,  
> **so that** I have a dedicated, schema-compliant workspace to model crosswalks between security frameworks.

* **Acceptance Criteria:**
  * **Minimal Creation Window:** Clicking "New Mapping Collection" in the directory opens a creation modal requiring document `title` (required, non-empty string) and optional initial source/target catalog references.
  * **Direct In-Place Redirection:** Upon submission, the document is initialized in the backend repository and the browser redirects immediately to `/mapping/{uuid}?edit=true` with the Overview & Provenance tab active.
  * **Root Schema Initialization:** The generated document strictly conforms to `oscal_mapping_schema.json` v1.2.2:
    * `mapping-collection.uuid`: Auto-generated RFC 4122 v4 UUID.
    * `mapping-collection.metadata`: Required metadata block containing `title`, `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`, `roles: []`, and `parties: []`.
    * `mapping-collection.provenance`: Initialized with default methodology fields:
      * `method: "human"`
      * `matching-rationale: "semantic"`
      * `status: "draft"`
      * `mapping-description: "Initial cross-framework mapping analysis."`
    * `mapping-collection.mappings`: Initialized as an array (`minItems: 1`) containing one default `mapping` object with auto-generated `uuid`, placeholder `source-resource`, placeholder `target-resource`, and empty `maps: []`.
  * **Metadata Management in Edit Mode:** In Edit Mode (`✏️ Edit`), Alice can edit `metadata.title`, increment semantic `metadata.version`, manage team parties (`metadata.parties[]`), assign responsible roles (`metadata.roles[]`), add properties (`metadata.props[]`), and capture document-level `metadata.remarks`.
  * **Read-Only View Mode Dynamics:** In View Mode (`👁️ View`), all text inputs, creation triggers, and deletion buttons are hidden; metadata displays as formatted text, status badges, and timestamp chips.
  * **Empty-Array Pruning:** On save, empty optional arrays (`props`, `roles`, `parties`) are stripped via `remove_empty_arrays()`, while mandatory `mappings` is preserved.

---

### US 8.2: Mapping Provenance & Overarching Methodology Declaration
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** define authoritative `provenance` metadata at the document level using official OSCAL schema fields,  
> **so that** external auditors understand the methodology, rationale, lifecycle status, and organizational owners governing the mapping exercise.

* **Acceptance Criteria:**
  * **Elimination of Arbitrary `props` Hack:** The system MUST store methodology, rationale, and status directly in official schema fields under `mapping-collection.provenance`. Injecting `props[name="method"]` or `props[name="rationale"]` is strictly prohibited.
  * **Mandatory Provenance Properties:**
    * `method`: Required flag field selected from official enum tokens:
      * `human` — Manual, expert-reviewed human crosswalk.
      * `automation` — Automated, algorithmic, or rule-based mapping engine.
      * `hybrid` — Combined automated matching with human verification.
      *(Non-standard values like `manual`, `automated`, `mixed` are strictly rejected by schema).*
    * `matching-rationale`: Required flag field selected from official enum tokens:
      * `syntactic` — Keyword, term, or structural exact matching.
      * `semantic` — Meaning, intent, and concept equivalence.
      * `functional` — Operational effect and security objective alignment.
    * `status`: Required flag field selected from official enum tokens:
      * `draft` (⚪ Neutral Gray) — Mapping in progress, incomplete.
      * `not-complete` (🟡 Amber) — Active mapping with known unresolved gaps.
      * `complete` (🟢 Green) — Finalized, reviewed, and published.
      * `deprecated` (🟠 Orange) — Superseded by a newer mapping version.
      * `superseded` (🔴 Red) — Obsolete, replaced by another framework crosswalk.
    * `mapping-description`: Required markup-multiline text explaining the scope, operational assumptions, and governance rules.
  * **Responsible Parties (`responsible-parties[]`):** Alice can link metadata parties and roles designating the lead framework architects and peer reviewers.
  * **Dual-State Presentation:** In Edit Mode, dropdown selectors and markdown editor for description. In View Mode, clean provenance summary card with method badge, rationale chip, and status pill.

---

### US 8.3: Quantitative Confidence Scoring & Coverage Metrics
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** document the confidence score and framework coverage percentage of the mapping,  
> **so that** stakeholders can mathematically evaluate the completeness and statistical certainty of the crosswalk.

* **Acceptance Criteria:**
  * **Confidence Scoring Architecture (`confidence-score`):**
    * Can be defined at `provenance`, `mapping`, or individual `map` levels.
    * Supports dual-mode input:
      1. **Categorical Mode:** Enum selection: `unspecified`, `high` (🟢 Green chip), `medium` (🟡 Amber chip), `low` (🔴 Red chip).
      2. **Percentage Mode:** Numeric decimal value between `0.0` and `1.0` (e.g., `0.95` rendered as `95% Confidence`).
    * The UI validates that percentage inputs fall strictly within `[0.0, 1.0]`.
  * **Coverage Metrics Architecture (`coverage`):**
    * Can be defined at `provenance` or `mapping` level.
    * Stored as a decimal value between `0.0` and `1.0` (e.g., `0.88` rendered as `88% Framework Coverage`).
    * Includes `generation-method: "arbitrary"` string attribute documenting how coverage was calculated (e.g., `"mapped_source_controls / total_source_controls"`).
  * **Visual Metric Cards:** The Overview tab renders visual progress rings displaying Coverage Percentage and an interactive Confidence Gauge.

---

### US 8.4: Source & Target Resource Binding & Verification
> *Implements [DD-016](../design_decisions/DD-016_cross_document_import_resolution.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** bind source and target resources to specific catalogs or profiles in the workspace with automatic context resolution,  
> **so that** controls and statements from both frameworks are dynamically available for mapping.

* **Acceptance Criteria:**
  * **Resource Reference Assembly:** Within each `mapping` in `mappings[]`, both `source-resource` and `target-resource` are mandatory.
  * **Mandatory Resource Fields:**
    * `type`: Required enum restricted to `catalog` or `profile` (allowing open string extensions).
    * `href`: Required URI reference pointing to a workspace document (e.g., `../catalogs/nist-sp800-53-r5.json`), document fragment, or canonical HTTPS URL.
    * `ns`: Optional namespace URI (default: `http://csrc.nist.gov/ns/oscal`).
  * **Workspace Document Browser Modal:** In Edit Mode, clicking "Browse Catalogs / Profiles..." opens a selection dialog listing available framework documents with title, version, control count, and publication date.
  * **Context Resolution & Live Preview:** When source and target resources are selected, the system verifies their existence and loads their control hierarchies into the client workspace for autocomplete and crosswalk rendering.
  * **Visual Resource Badges:** In View Mode, source displays as a blue pill badge (e.g., `Source: NIST SP 800-53 Rev 5 (Catalog)`) and target displays as a purple pill badge (e.g., `Target: ISO/IEC 27001:2022 (Catalog)`).

---

### US 8.5: Multi-Mapping Architecture (Array of Mappings)
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** create and manage multiple distinct framework comparisons within a single `mapping-collection` document,  
> **so that** an organization can publish a consolidated multi-standard crosswalk (e.g., NIST ➔ ISO and NIST ➔ CIS in one portable file).

* **Acceptance Criteria:**
  * **Array Support Enforcement:** The system MUST support `mapping-collection.mappings` as an array (`mapping[]`, `minItems: 1`). Hardcoding index `[0]` in UI components or document actions is strictly prohibited.
  * **Mapping Selector & Switcher:** The UI header and left sidebar feature a "Mapping Sets" switcher. Selecting a mapping set switches the active scope for all tables, matrix grids, and Sankey diagrams.
  * **Adding New Mapping Sets:** Alice can click "➕ Add Framework Mapping":
    * Prompts for unique Mapping UUID, Source Resource, Target Resource, and optional Mapping Description.
    * Appends a new `mapping` object to `mappings[]`.
  * **Mapping Set Deletion Safeguards:** If `mappings[]` contains only 1 entry, deletion is disabled with an explanatory tooltip (`At least one framework mapping is required`). If multiple exist, deletion requires confirmation and cleans up local state.
  * **Independent Gap Summaries:** Each `mapping` entry maintains its own dedicated `source-gap-summary` and `target-gap-summary`.

---

### US 8.6: Core Map Creation & Mathematical Set-Theoretic Relationships
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md) and NIST IR 8477.*  
> **As a** Compliance Officer (Alice)  
> **I want to** create individual `map` entries using the 6 canonical set-theoretic relationship tokens,  
> **so that** cross-framework equivalences and subsets are formally categorized with mathematical precision.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `mapping-collection.mappings[active_index].maps[]` (`minItems: 1`).
  * **Mandatory Map Properties:**
    * `uuid`: Auto-generated unique RFC 4122 v4 identifier.
    * `relationship`: Required token field strictly selected from the 6 canonical OSCAL v1.2.2 tokens.
    * `sources`: Required array (`minItems: 1`) of source items.
    * `targets`: Required array (`minItems: 1`) of target items.
  * **The 6 Canonical Relationship Tokens (NIST IR 8477 & OSCAL v1.2.2):**
    1. `equal-to` (🟣 Purple badge) — Exact, bidirectional semantic and functional identity.
    2. `equivalent-to` (🟢 Green badge) — Substantially identical in intent and effect, despite differing terminology.
    3. `subset-of` (🔵 Blue badge) — The source requirement is fully encompassed by the target requirement (target is broader).
    4. `superset-of` (🟠 Orange badge) — The source requirement encompasses the target requirement and imposes additional requirements (source is broader).
    5. `intersects-with` (🟡 Yellow badge) — Requirements overlap in some operational areas but each possesses distinct unshared requirements.
    6. `no-relationship` (🔴 Red badge) — Explicit declaration that no compliance or operational relationship exists between the selected controls.
    *(Omitting `no-relationship` or using non-standard tokens like `maps-to` is strictly prohibited and fails schema validation).*
  * **Dual-State Presentation:**
    * Edit Mode: Dropdown menu with color-coded relationship icons and formal mathematical descriptions.
    * View Mode: Distinct pill badges matching authoritative color styling.

---

### US 8.7: Source & Target Item References (1:1, 1:N, N:1, N:M Cardinality)
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** link multiple source and target controls or statements within a single map,  
> **so that** I can accurately represent 1:1, 1:N, N:1, and N:M cross-framework relationships.

* **Acceptance Criteria:**
  * **Mapping Item Assembly Structure:**
    * Elements of `sources[]` and `targets[]` must conform to the `mapping-item` schema.
    * `type`: Required enum restricted to `control` or `statement`.
    * `id-ref`: Required string token identifying the control ID (e.g., `ac-2`) or statement ID (e.g., `ac-2_smt_a`, `A.9.2.1`).
  * **Cardinality Flexibility:**
    * **1:1 Mapping:** Single source item mapped to single target item (e.g., `cm-8` ➔ `A.8.1.1`).
    * **1:N Mapping:** Single source item mapped to multiple target items (e.g., `ia-2` ➔ `A.9.4.2` and `A.9.4.3`).
    * **N:1 Mapping:** Multiple source items consolidated into one target item (e.g., `ac-2` and `ac-3` ➔ `A.9.1.1`).
    * **N:M Mapping:** Complex multi-control overlaps.
  * **Autocomplete via Datalist:** In Edit Mode, typing into the `id-ref` field presents real-time autocomplete suggestions populated from the resolved source and target framework control inventories, including control title and family previews.
  * **Validation Safeguard:** Attempting to save a map with empty `sources` or empty `targets` is blocked by client validation, satisfying schema `minItems: 1`.

---

### US 8.8: Mapping Qualifiers & Conditional Compatibility Constraints
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** attach structured `qualifiers` to a map when requirements have conditional caveats or incompatibilities,  
> **so that** compliance equivalences are not overstated and boundary conditions are explicitly documented.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `map.qualifiers[]` (`0..*`).
  * **Mandatory Qualifier Properties:**
    * `subject`: Required enum restricted to `source`, `target`, or `both`.
    * `predicate`: Required enum restricted to `has-requirement` or `has-incompatibility`.
    * `category`: Required enum restricted to `restricted`, `addressable`, or `blocked`.
    * `description`: Required markup-multiline explanation of the condition (e.g., `"Source control ac-2 requires automated inactive account deprovisioning within 90 days, which is not mandated by ISO 27001 A.9.2.1."`).
  * **Qualifier Editor Interface:** In the Map Detail drawer, Alice can click "➕ Add Qualifier" and configure all 4 mandatory properties via specialized dropdowns and markdown textarea.
  * **Visual Incompatibility Indicators:** Maps possessing qualifiers display a `⚠️ Qualified` badge in the master table and an amber warning icon in the Sankey and Matrix diagrams. Hovering displays the qualifier description in a tooltip.

---

### US 8.9: Local Provenance Overrides at Mapping and Map Levels
> *Implements [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** override document-level provenance defaults on specific mapping sets or individual maps,  
> **so that** exceptions (e.g., an automated rule verified by human analysis) are recorded with granular precision.

* **Acceptance Criteria:**
  * **Hierarchical Provenance Inheritance:** An individual `map` inherits methodology, rationale, and status from its parent `mapping`, which in turn inherits from the document-level `provenance`.
  * **Mapping-Level Overrides:** An individual `mapping` object can optionally declare `method`, `matching-rationale`, `status`, `confidence-score`, or `coverage`. If present, these values override document-level provenance for that mapping set.
  * **Map-Level Overrides:** An individual `map` object can optionally declare `matching-rationale`, `confidence-score`, or `coverage`.
  * **UI Visual Indication:** In Edit Mode, overridden fields display an "Inherited from Document (Default)" label with an "Override" toggle. When overridden, the field displays an "Overridden Locally" indicator chip.

---

### US 8.10: Bidirectional Gap Summaries & Unmapped Controls Tracking
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** declare and review `source-gap-summary` and `target-gap-summary` structures listing unmapped controls,  
> **so that** missing compliance coverage and orphaned security controls are transparently audited.

* **Acceptance Criteria:**
  * **Nesting Location:** Stored in `mapping.source-gap-summary` and `mapping.target-gap-summary` (`0..1`).
  * **Mandatory Gap Summary Properties:**
    * `uuid`: Auto-generated RFC 4122 v4 identifier.
    * `unmapped-controls`: Required array (`minItems: 1`) of control references.
  * **Bidirectional Gap Concept:**
    * `source-gap-summary`: Documents controls present in the Source framework that have NO relationship or satisfaction in the Target framework (e.g., NIST controls not covered by ISO).
    * `target-gap-summary`: Documents controls present in the Target framework that are not addressed by the Source framework.
  * **Gap Card Management:** In the Gap Analysis tab, Alice can manually add, edit, and delete unmapped control items, assigning control IDs and gap rationale remarks.
  * **Dedicated Gap Metric Banners:** The Gap tab visualizes two summary cards:
    * `Source Gaps: X Unmapped Controls` (🔴 Red)
    * `Target Gaps: Y Unmapped Controls` (🟣 Purple)

---

### US 8.11: Automated Gap Analysis & Coverage Calculation Engine
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** trigger an automated gap analysis that cross-checks defined maps against resolved source and target frameworks,  
> **so that** unmapped controls are automatically detected and gap summaries are generated without manual error.

* **Acceptance Criteria:**
  * **One-Click Gap Calculation ("⚡ Run Gap Analysis"):** In Edit Mode, Alice can click "Analyze Framework Gaps".
  * **Algorithmic Gap Detection:**
    1. The client resolves all control IDs declared in the source catalog/profile.
    2. It scans all `maps[].sources[].id-ref` tokens.
    3. Any source control ID absent from `sources[]` (or mapped exclusively with `relationship: "no-relationship"`) is identified as a source gap.
    4. Symmetrically, it scans all target controls and identifies target gaps absent from `targets[]`.
  * **Auto-Populate Action:** Alice can click "Sync Detected Gaps to Gap Summary". The system automatically populates `source-gap-summary.unmapped-controls` and `target-gap-summary.unmapped-controls` with the detected control tokens and updates the `coverage` decimal metric.
  * **Coverage Computation:** Computes `coverage = (total_source_controls - unmapped_source_controls) / total_source_controls`, rounding to two decimal places.

---

### US 8.12: Dual-Surface Visualization: Interactive Crosswalk Matrix Grid
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** inspect cross-framework relationships on an interactive 2D Matrix Grid,  
> **so that** I can rapidly identify clusters of overlap, sparse framework coverage, and unmapped intersections.

* **Acceptance Criteria:**
  * **Matrix Grid Layout:**
    * Rows represent Source Framework controls (hierarchically grouped by control family, e.g., `ac`, `ia`, `sc`).
    * Columns represent Target Framework controls (hierarchically grouped by domain, e.g., `A.9`, `A.13`).
  * **Cell Intersection Indicators:**
    * Intersection cells display colored relationship icons matching the 6 canonical tokens (🟣 `=`, 🟢 `≡`, 🔵 `⊂`, 🟠 `⊃`, 🟡 `∩`, 🔴 `≠`).
    * Empty cells represent unmapped intersections.
  * **Interactive Cell Inspection:**
    * Clicking an active intersection cell opens a slide-out Map Inspector displaying complete relationship metadata, qualifiers, confidence scores, and action buttons (`✏️ Edit Map`, `🗑️ Delete Map`).
    * In Edit Mode, clicking an empty cell prompts to "➕ Create Map between {Source_ID} and {Target_ID}".
  * **Responsive Grid Scrolling & Sticky Headers:** The matrix supports smooth horizontal and vertical scrolling with sticky row and column headers, ensuring control labels remain visible across large matrices.

---

### US 8.13: Dual-Surface Visualization: 3-Column Sankey Flow Diagram
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Compliance Officer / Enterprise Architect (Alice)  
> **I want to** visualize mapping topology and control flows using a dynamic 3-column Sankey diagram,  
> **so that** executive stakeholders and auditors can intuitively perceive how source controls distribute into target requirements.

* **Acceptance Criteria:**
  * **3-Column Topological Architecture:**
    * **Left Column:** Source Framework control nodes (rendered with source blue borders).
    * **Right Column:** Target Framework control nodes (rendered with target purple borders).
    * **Center Flow Area:** Curved Bézier flow paths connecting source nodes to target nodes.
  * **Color-Coded Flow Paths (DD-019):** Flow paths are colored according to relationship type:
    * `equal-to`: 🟣 Purple (#8B5CF6)
    * `equivalent-to`: 🟢 Green (#10B981)
    * `subset-of`: 🔵 Blue (#3B82F6)
    * `superset-of`: 🟠 Orange (#F97316)
    * `intersects-with`: 🟡 Amber (#F59E0B)
    * `no-relationship`: 🔴 Red (#EF4444)
  * **Visual Gap Node Representation:**
    * Unmapped source controls appear in a dedicated bottom section of the left column with dashed red borders and a muted `Unmapped` label.
    * Unmapped target controls appear symmetrically on the right column.
  * **Interactive Flow Highlighting & Tooltips:**
    * Hovering over any control node or flow path highlights connected paths, dims unselected paths, and displays an interactive tooltip with Source ID, Target ID, Relationship type, Confidence score, and Rationale.
    * Clicking a flow path selects that map in the Master Table.
  * **Responsive SVG Container:** The diagram scales responsively without SVG clipping or layout distortion.

---

### US 8.14: Visual Mode Switcher, Filtering & Real-Time Search
> *Implements [DD-019](../design_decisions/DD-019_mapping_visualization_strategy.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** switch seamlessly between Table, Matrix, and Sankey views with synchronized filters,  
> **so that** I can analyze mapping data through whichever visualization is optimal for my current task.

* **Acceptance Criteria:**
  * **Unified View Switcher (`[ 📋 Table | ▦ Matrix | 🔀 Sankey ]`):** Located prominently in the visualization toolbar. Switching views preserves active search queries, selected filters, and active mapping set.
  * **Relationship Multi-Select Filter:** Filter by one or more relationship tokens (e.g., show only `subset-of` and `intersects-with`).
  * **Real-Time Text Search:** Search input instantly filters both source and target control IDs and titles across Table, Matrix, and Sankey views.
  * **Unmapped Only Toggle:** A quick toggle switch `[ Unmapped Only ]` isolates gaps, hiding all established mappings to facilitate focused gap remediation.

---

### US 8.15: Master Mapping Data Table & Batch Operations
> *Implements [US 0.18](step0_global_requirements.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** manage all maps via a high-density, filterable, and sortable data table with batch actions,  
> **so that** I can efficiently navigate and manage hundreds or thousands of crosswalk entries.

* **Acceptance Criteria:**
  * **Master Data Table Columns:**
    * Checkbox selector for batch operations.
    * Source Control ID & Title (with link chips).
    * Relationship Badge (color-coded with canonical token).
    * Target Control ID & Title (with link chips).
    * Confidence Score (categorical chip or percentage).
    * Qualifiers Indicator (warning badge if present).
    * Actions (`✏️ Edit`, `🗑️ Delete`).
  * **Sorting & Pagination:** Columns support multi-directional sorting (by Source ID, Target ID, Relationship, Confidence). Configurable pagination (25, 50, 100 rows per page).
  * **Batch Deletion & Export:** In Edit Mode, selecting multiple rows allows batch deleting selected maps with a single confirmation prompt.
  * **Direct Row Click Drawer:** Clicking any row opens the slide-out Map Detail drawer for in-depth inspection without losing table pagination state.

---

### US 8.16: Dual-Mode View (`👁️ View`) vs Edit (`✏️ Edit`) & In-Card Authoring
> *Implements [US 0.17](step0_global_requirements.md) and [DD-004](../design_decisions/DD-004_draft_state_management.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** toggle between View and Edit modes with URL synchronization and in-card authoring,  
> **so that** I can review published crosswalks without risk of accidental modification.

* **Acceptance Criteria:**
  * **Segmented Mode Toggle (`[ 👁️ View | ✏️ Edit ]`):** Located in the top bar; synchronizes state to URL query parameter `?edit=true`.
  * **View Mode (`👁️ View`):** All form controls, autocomplete pickers, deletion triggers, and "Add Map" buttons are hidden. Data renders as clean cards, badges, and read-only tables.
  * **Edit Mode (`✏️ Edit`):** Activates inline input fields, autocomplete datalists, modal editors, and batch actions.
  * **Slide-Out Map Editor Panel:** In Edit Mode, authoring or editing a map takes place in a structured slide-out panel with live validation feedback before committing.

---

### US 8.17: Draft Persistence, Change Buffering & Dirty State Tracking
> *Implements [DD-004](../design_decisions/DD-004_draft_state_management.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** have local drafts auto-saved in the backend (`<uuid>_draft.json`) while mapping complex control hierarchies,  
> **so that** I am protected against accidental browser closure or connection loss.

* **Acceptance Criteria:**
  * **Auto-Save Draft Engine (`useDraft`):** Local mutations are buffered and written to `<uuid>_draft.json` in the background every 30 seconds when dirty.
  * **Visual Dirty Badge:** An amber "Unsaved Draft" indicator appears in the navigation bar when changes are pending.
  * **Navigation Safety Modal:** Attempting to navigate away or close the tab with unsaved changes triggers a confirmation dialog (`Discard unsaved changes or save draft?`).
  * **Draft Recovery Notification:** Upon opening a document with an active draft, the system displays a banner: `"Unsaved draft found. Restore draft or load saved version?"`.

---

### US 8.18: Integrated Backend Versioning & Schema Validation
> *Implements [US 0.15](step0_global_requirements.md) and [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** Framework Developer (Alice)  
> **I want to** publish formal versions of the `mapping-collection` document with schema validation and revision history tracking,  
> **so that** downstream consumers receive an immutable, audit-proof compliance crosswalk.

* **Acceptance Criteria:**
  * **Save Version Action:** Prompts for semantic version (e.g., `1.0.0`) and revision remarks.
  * **Schema Validation Gate:** Validates the payload against `oscal_mapping_schema.json` v1.2.2. If validation fails (e.g., invalid relationship token or missing required fields), save is blocked and actionable errors are displayed.
  * **Revision History Sync:** Appends a new revision entry to `metadata.revisions[]` recording version, timestamp, author party, and remarks.
  * **Version History Drawer:** Read-only historical version inspection and previous version restoration.

---

### US 8.19: Back-Matter Evidence Attachments & Crosswalk References
> *Implements [US 0.16](step0_global_requirements.md) and [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** embed crosswalk spreadsheets, mapping whitepapers, and scripts into `back-matter.resources[]` as Base64 strings,  
> **so that** supporting mapping artifacts are bundled directly inside the portable OSCAL JSON file.

* **Acceptance Criteria:**
  * **File Drop-Zone:** Back-Matter tab provides a drag-and-drop zone for `.xlsx`, `.csv`, `.pdf`, `.json` files.
  * **Client-Side Base64 Encoding:** Files are converted client-side into self-contained `resource` objects with RFC 4122 v4 UUID, title, MIME type, and Base64 content.
  * **Reference Linking:** Resources can be linked within map remarks and provenance notes via `#resource-uuid`.
  * **Offline Download & Preview:** In View Mode, clicking a resource link downloads or previews the decoded Base64 artifact offline.

---

### US 8.20: Clean Format Serialization & Multi-Format Export
> *Implements [US 0.15](step0_global_requirements.md).*  
> **As a** Compliance Officer (Alice)  
> **I want to** export the complete Mapping Collection in NIST OSCAL JSON, XML, or YAML format,  
> **so that** external automated compliance engines and crosswalk tools can ingest the mapping data.

* **Acceptance Criteria:**
  * **Export Trigger (`📥 Export`):** Top bar provides an export dropdown with options for JSON, XML, and YAML.
  * **Empty-Array Purging:** Runs `remove_empty_arrays()` before serialization to eliminate empty optional arrays (`props`, `qualifiers`) while preserving mandatory arrays (`mappings`, `maps`, `sources`, `targets`).
  * **100% Schema Conformity:** The generated document validates cleanly against NIST OSCAL Mapping Collection schema v1.2.2.
  * **Direct Download Delivery:** Initiates immediate browser download named `{title_slug}_mapping_v{version}.json` with MIME type `application/json`.

---

## 2. Alice's Detailed Workflow & User Journey

1. **Document Initialization (US 8.1):** Alice opens Reposol and clicks "New Mapping Collection". She enters the title *"NIST SP 800-53 Rev 5 to ISO/IEC 27001:2022 Enterprise Crosswalk"*. Upon creation, she is redirected to `/mapping/{uuid}?edit=true` with the Overview & Provenance tab active.
2. **Configure Authoritative Provenance & Methodology (US 8.2, US 8.3):** In the Provenance editor:
   * Sets `method` to `human` (manual expert crosswalk).
   * Sets `matching-rationale` to `semantic` (concept and operational intent equivalence).
   * Sets `status` to `draft` (⚪ Neutral Gray badge).
   * Inputs `mapping-description`: *"Authoritative crosswalk aligning NIST SP 800-53 Rev 5 Moderate baseline controls with ISO/IEC 27001:2022 Annex A controls for multinational banking compliance."*
   * Assigns herself as lead framework architect in `responsible-parties`.
   * Sets default `confidence-score` to category `high`.
3. **Declare Source & Target Framework Resources (US 8.4):** Alice configures the initial mapping set:
   * Source Resource: Selects type `catalog` and clicks "Browse Catalogs...". Selects *"NIST SP 800-53 Rev 5 Catalog"* (`../catalogs/nist-sp800-53-r5.json`).
   * Target Resource: Selects type `catalog` and selects *"ISO/IEC 27001:2022 Security Controls Catalog"* (`../catalogs/iso-27001-2022.json`).
   * The system resolves both framework contexts, populating control registries for live autocomplete and visualization.
4. **Create Canonical Maps with Mathematical Relationships (US 8.6, US 8.7):** Alice switches to the Mapping Table tab and begins adding maps:
   * **Map 1 (Equivalent-To):** Maps source control `cm-8` (*Information System Component Inventory*) to target control `A.8.1.1` (*Inventory of assets*). Sets `relationship` to `equivalent-to` (🟢 Green badge) with `confidence-score: 0.95`.
   * **Map 2 (Equal-To):** Maps source control `sc-7` (*Boundary Protection*) to target control `A.13.1.1` (*Network controls*). Sets `relationship` to `equal-to` (🟣 Purple badge).
   * **Map 3 (Subset-Of with Qualifier):** Maps source control `ac-2` (*Account Management*) to target control `A.9.2.1` (*User registration and de-registration*). Sets `relationship` to `subset-of` (🔵 Blue badge). She adds a qualifier (US 8.8):
     * Subject: `source`
     * Predicate: `has-requirement`
     * Category: `restricted`
     * Description: *"NIST ac-2 mandates automated inactive account disabling within 90 days, which is not required by ISO A.9.2.1."*
   * **Map 4 (1:N Intersects-With):** Maps source control `ia-2` (*Identification and Authentication*) to two target controls: `A.9.4.2` (*Password management system*) and `A.9.4.3` (*Password management system - MFA*). Sets `relationship` to `intersects-with` (🟡 Yellow badge).
5. **Add Local Mapping Overrides (US 8.9):** On Map 4 (`ia-2`), Alice overrides the default provenance: she sets local `matching-rationale` to `functional` (since password systems fulfill the functional goal of authentication) and sets `confidence-score` to `medium`.
6. **Run Automated Gap Analysis (US 8.10, US 8.11):** Alice switches to the Gap Analysis tab and clicks "⚡ Run Gap Analysis". The engine cross-checks all 20 NIST source controls against established maps. It identifies that NIST `ac-14` (*Permitted Actions without Identification or Authentication*) has no mapping in ISO 27001. Alice clicks "Sync Detected Gaps to Gap Summary", populating `source-gap-summary.unmapped-controls` with `ac-14` and updating `coverage` to `0.95` (95%).
7. **Inspect Crosswalk via Matrix Grid & Sankey Diagram (US 8.12, US 8.13, US 8.14):** Alice switches to the Visualizations tab:
   * **Matrix Grid:** Views the 2D crosswalk matrix. Rows show NIST families (`ac`, `cm`, `ia`, `sc`), columns show ISO clauses (`A.8`, `A.9`, `A.13`). Clicks cell `ac-2` × `A.9.2.1` to inspect the subset qualifier.
   * **Sankey Diagram:** Toggles to the Sankey view. Observes the 3-column flow: NIST controls on left, color-coded Bézier curves in center, ISO controls on right. Hovers over the green curve between `cm-8` and `A.8.1.1` to see tooltip details. Confirms `ac-14` is displayed in the dashed red unmapped gap section.
8. **Attach Reference Crosswalk Spreadsheet (US 8.19):** In the Back-Matter tab, Alice uploads `nist_iso_crosswalk_methodology_2026.xlsx`. The browser encodes the 1.8 MB file as Base64 into `back-matter.resources[]` with ID `#resource-crosswalk-excel`.
9. **Finalize Provenance, Save Version & Export (US 8.16, US 8.18, US 8.20):** Alice updates `provenance.status` to `complete` (🟢 Green). She clicks "Save Version", enters version `1.0.0` with remarks *"Initial Enterprise Crosswalk Published"*. The backend validates against `oscal_mapping_schema.json`, records the revision, and commits the clean JSON. Alice toggles to `👁️ View` mode to inspect the read-only view, then clicks `📥 Export JSON` to download the official OSCAL mapping document.

---

## 3. Functional Requirements for the System

- **Official Schema Alignment:** The backend schema and persistence layer strictly mandate compliance with `oscal_mapping_schema.json` v1.2.2. Non-standard root properties (such as `import-ssp` or `local-definitions`) are prohibited and rejected (US 8.1).
- **Official Provenance Structure:** Overarching methodology, rationale, and status are stored directly under `mapping-collection.provenance` without arbitrary `props[]` injections (US 8.2).
- **Enum Token Validation:**
  - `provenance.method`: Strictly restricted to `human`, `automation`, `hybrid` (US 8.2).
  - `provenance.matching-rationale`: Strictly restricted to `syntactic`, `semantic`, `functional` (US 8.2).
  - `provenance.status`: Strictly restricted to `complete`, `not-complete`, `draft`, `deprecated`, `superseded` (US 8.2).
  - `map.relationship`: Strictly restricted to the 6 canonical tokens: `equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship` (US 8.6).
- **Multi-Mapping Array Support:** The system natively supports `mappings` as an array of independent framework comparisons (`mapping[]`, `minItems: 1`), enabling multi-framework bundles without index `[0]` hardcoding (US 8.5).
- **Cardinality & Item Validation:** Maps support 1:1, 1:N, N:1, and N:M relationships with `sources` and `targets` containing typed items (`type: "control" | "statement"` and `id-ref`) (US 8.7).
- **Qualifier Constraints:** Qualifiers require all 4 mandatory fields: `subject` (`source`/`target`/`both`), `predicate` (`has-requirement`/`has-incompatibility`), `category` (`restricted`/`addressable`/`blocked`), and `description` (US 8.8).
- **Bidirectional Gap Calculation Engine:** The system calculates unmapped controls across source and target baselines, calculates percentage coverage (`0.0 - 1.0`), and serializes `source-gap-summary` and `target-gap-summary` with `minItems: 1` on `unmapped-controls` (US 8.10, US 8.11).
- **Dual-Surface Visualization Architecture:** Provides interactive Matrix Grid and 3-column Sankey Flow Diagram with synchronized filtering, color coding per relationship type, gap nodes, and interactive tooltips (US 8.12, US 8.13, US 8.14).
- **Draft Persistence & Empty-Array Purging:** Local and backend draft caching via `useDraft` (`<uuid>_draft.json`), paired with automatic pruning of empty optional arrays via `remove_empty_arrays()` on save (`minItems: 1` protection) (US 8.17, US 8.20).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] **US 8.1:** Mapping document creation initializes `mapping-collection` with valid metadata, default provenance, and initial mapping entry.
- [x] **US 8.2:** Provenance editor captures `method` (`human`, `automation`, `hybrid`), `matching-rationale` (`syntactic`, `semantic`, `functional`), `status`, and `mapping-description` directly in official schema fields without `props` hack.
- [x] **US 8.3:** Quantitative confidence scoring supports categorical chips or decimal percentages (0.0–1.0), and coverage tracks framework completeness.
- [x] **US 8.4:** Source and target resources bind to workspace catalogs or profiles with type enforcement and context resolution.
- [x] **US 8.5:** Multi-mapping architecture supports an array of independent framework mappings (`mappings[]`) with scope switcher.
- [x] **US 8.6:** Core map authoring strictly enforces the 6 canonical relationship tokens: `equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`.
- [x] **US 8.7:** Source and target item references support 1:1, 1:N, N:1, and N:M cardinality with control/statement autocomplete.
- [x] **US 8.8:** Relationship qualifiers capture conditional caveats with mandatory `subject`, `predicate`, `category`, and `description`.
- [x] **US 8.9:** Local provenance overrides allow individual mappings and maps to override document-level methodology defaults.
- [x] **US 8.10:** Bidirectional gap summaries document unmapped source and target controls in `source-gap-summary` and `target-gap-summary`.
- [x] **US 8.11:** Automated gap analysis engine detects unmapped controls algorithmically and computes quantitative coverage percentages.
- [x] **US 8.12:** Crosswalk Matrix Grid renders 2D framework intersections with color-coded relationship icons and cell inspection drawers.
- [x] **US 8.13:** 3-column Sankey flow diagram visualizes source-to-target control paths with color-coded Bézier links and unmapped gap nodes.
- [x] **US 8.14:** Visual mode switcher allows seamless toggling between Table, Matrix, and Sankey views with synchronized filtering and search.
- [x] **US 8.15:** Master mapping data table provides sorting, pagination, multi-select batch deletion, and direct row drawer inspection.
- [x] **US 8.16:** Segmented mode toggle (`[ 👁️ View | ✏️ Edit ]`) synchronizes URL state and protects published crosswalks from accidental edits.
- [x] **US 8.17:** Draft management auto-saves edits to `<uuid>_draft.json` and prevents accidental navigation loss.
- [x] **US 8.18:** Integrated versioning validates against `oscal_mapping_schema.json` and records revision history in `metadata.revisions[]`.
- [x] **US 8.19:** Back-matter supports Base64 spreadsheet attachments with offline preview and download capabilities.
- [x] **US 8.20:** Standalone export delivers 100% schema-valid JSON, XML, and YAML files with empty optional arrays purged.
