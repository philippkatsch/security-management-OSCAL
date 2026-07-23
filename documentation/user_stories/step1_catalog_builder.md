# Step 1: Detailed User Stories – Catalog Builder

* **Persona:** Alice (Compliance Officer / Framework Developer)
* **Goal:** Creation of a rich, standard-compliant, and machine-readable security catalog with hierarchical control structures, assessment objectives, mappings, and validation rules for parameters.

---

## 1. Breakdown of User Stories

### US 1.1: Catalog Metadata & Organizational Elements (Metadata)
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** capture complete metadata, versions, and organizational elements (roles, parties, locations, actions) for a security catalog,  
> **so that** the validity of the rulebook and the participating actors are declared in a schema-compliant and machine-readable manner.
*   **Acceptance Criteria:**
    *   Capturing of title, version, OSCAL version, and publication timestamp (`published`).
    *   **Document Identifiers:** Management of `document-ids` (e.g., DOI, ISBN) with schema and identifier.
    *   **Role Management:** Adding, editing, and deleting roles (`roles`) with ID, title, short name (`short-name`), description, custom properties, and links.
    *   **Party Management (Parties):** Creation of persons or organizations with full OSCAL fields: name, type (person/org), short name, email addresses, telephone numbers (`telephone-numbers`), addresses (`addresses` with address lines, city, state, postal code, country), external identifiers (`external-ids` with schema), location links (`location-uuids`), and organizational membership (`member-of-organizations`).
    *   **Locations (Locations):** Capturing with UUID, title, full address, email addresses, telephone numbers, URLs, custom properties, and links.
    *   **Global Metadata Assignment:** Linking parties to roles (`responsible-parties`) at the catalog level, including properties, links, and remarks.
    *   **Audit Actions (Actions):** Capturing metadata actions (`actions`) such as approvals or reviews with UUID, type, system URI, date, and responsible parties.

### US 1.2: Setting up a Group Hierarchy & Group Details
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** create a hierarchically nested group structure (classes, security domains) and manage their details,  
> **so that** the controls are logically ordered, grouped by topic, and documented in detail.
*   **Acceptance Criteria:**
    *   Creation of main groups and arbitrarily deeply nested subgroups.
    *   Assignment of unique IDs for groups (e.g., `ac`, `ac-ia`).
    *   Subsequent moving and reordering of groups in the editor.
    *   **Group Editing (Props, Links, Parts):** Each group can be edited in the detail pane when selected. This includes modifying the ID and title, assigning properties/tags (`props`), adding links (`links`), and capturing description texts (`parts`).
    *   **Premium Group Details Interface:** The Group Editor pane features a premium glassmorphic header banner, a structured metadata grid (with visual metrics for Family ID, controls, sub-groups, and total controls), and a unified list table layout matching the Document Overview aesthetics. The Controls table lists only the direct/main controls of the group (excluding nested control enhancements/sub-controls, which are accessed when selecting a specific control).
    *   **ProseWithParams in Group Parts:** Alle Gruppen-Beschreibungstexte (`parts` im `PartsEditor` des `GroupEditor`) sind mit `ProseWithParams` ausgestattet.
    *   **Add-Parameter & Callback in Gruppen-Prose:** Beim Bearbeiten von Gruppen-Texten steht der Button „🏷️ Add Parameter“ mit Caret-relativer Positionierung zur Verfügung.
    *   **onNewParam für Gruppen-Parameter:** Klick auf „➕ Define New Parameter...“ im Dropdown eines Gruppen-Textfeldes legt automatisch einen neuen Gruppen-Parameter in `group.params` an und scrollt die Ansicht sanft zur Card „Group Parameters“ im `GroupEditor`.

### US 1.3: Control Statements, Parts & Enhancements — Creation and Inline Editing
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** create security requirements (controls) with structured prose elements and sub-controls (enhancements) **and edit all components directly inline**,  
> **so that** the precise target specifications are declared in a detailed and hierarchical manner and I can make changes at any time.
*   **Acceptance Criteria:**
    *   Creation of main controls with IDs and unique requirement texts (statements).
    *   **Inline Editing of Statement Parts:** The structured sub-parts of a statement (e.g., `a.`, `b.`, `c.`) are rendered individually as editable text fields. New sub-parts can be added, existing ones edited, and deleted.
    *   **Inline Editing of all Prose Parts:** Guidance, Discussion, Example, Information, Overview, Assessment Method, and other parts (`parts`) can be edited directly in the editor as free text.
    *   Definition of nested control enhancements (sub-controls) with their own ID and statement. In the main control's detail view, these enhancements are shown as a compact, collapsible overview table listing only IDs and Titles (collapsed by default). Selecting an enhancement navigates directly to its specific detail editor.
    *   **Class Attribute:** The `class` attribute of a control (e.g., `SP800-53`, `custom`) can be set and modified via an input field.
    *   **Icon Taxonomy & Visual Consistency:** The gear icon (`⚙️`) is reserved exclusively for Parameter-related elements and actions (e.g., `⚙️ Add Parameter`, `⚙️ Parameters`). Advanced settings toggles for parts, sub-parts/items, subcontrols, links, and property badges consistently use the wrench icon (`🔧`).
    *   **Universal Parameter Insertion (⚙️ Add Parameter):** Every prose entry field — including top-level statements/parts and all nested sub-parts/items (e.g., `a.`, `b.`, `c.`) in both Catalog and Profile modes — features a `⚙️` (Add Parameter) button to trigger caret-relative parameter placeholder insertion.

### US 1.4: Parameter Definitions, Constraints & Interactive Value Assignment
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** add, delete, and fully configure placeholders (parameters) in controls via the visual interface — including default values, choice lists, and validation rules,  
> **so that** downstream implementers (e.g., in profiles or SSPs) can only enter valid values, and I can fully parameterize the catalog without using JSON mode.
*   **Acceptance Criteria:**
    *   **Parameter CRUD & Creation:** Parameters can be added (`➕ Add Parameter`) and deleted (`🗑`) in control, group, or catalog views.
    *   **Top-Row Essential Field Layout:** `ParameterCard` presents a clean 1-line top row displaying Parameter ID (top left in blue), Label, and Assigned Value (in green when set), with action buttons (`✏️ Edit`, `↩ Revert`).
    *   **Editor Hierarchy:** Expanding the card exposes essential core fields (ID & Value assignment, Label & Usage) in the primary section, and optional metadata (Class, Depends On, Choice options configuration, Constraints, Guidelines, Links, Properties) in a secondary section.
    *   **Prose Parameter Badging & Tooltips:** Embedded parameter placeholders in control prose render as blue Chips (`[Label]` if unset, green value if set). Hovering displays `Parameter: <id>`, `Status`, and `Guidance` in English; clicking smooth-scrolls to the Parameter Card.
    *   **Overview Parameters Scope Section:** The Parameters tab in DocumentOverview clearly distinguishes Global Catalog Parameters (`catalog.params`) from Group and Control parameters, explaining parameter inheritance across scopes.
    *   **ProseWithParams in Parameter-Metadaten:** Die Felder `usage` (Parameter-Verwendungszweck) und `guidelines.prose` (Ausfüllhilfen & Leitlinien) innerhalb der `ParameterCard` nutzen `ProseWithParams`.
    *   **Querverweise zwischen Parametern:** In `usage` und `guidelines.prose` können über den „Add Parameter“-Button Platzhalter anderer Parameter (z. B. für Parameter-Abhängigkeiten `depends-on` oder erläuternde Referenzen) per Caret-relativer Auswahl eingefügt werden.

### US 1.5: Definition of Assessment Objectives & Assessment Methods
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** document concrete assessment objectives and recommended assessment methods for auditors directly on the control,  
> **so that** auditors know later how and according to which criteria the compliance of the control must be verified.
*   **Acceptance Criteria:**
    *   Linking of structured assessment objectives (`objectives`) to controls.
    *   Assignment of standardized assessment methods (e.g., `examine` for document review, `interview` for interviews, `test` for technical tests).
    *   **ProseWithParams für Objectives & Methods:** Die Freitextfelder für Prüfziele (`objectives`) und Empfohlene Prüfmethoden (`examine`, `interview`, `test`) im Katalog-Editor sind mit `ProseWithParams` integriert.
    *   **Parameter-Einbindung in Prüfanweisungen:** Framework-Entwickler können Parameter direkt in Prüfziele und Prüfanweisungen einbetten, um dynamische Werte (z. B. Stichprobengrößen oder Prüffrequenzen) standardkonform zu deklarieren.

### US 1.6: Framework Mapping (Cross-References)
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** define references and mappings to other industry standards,  
> **so that** regulatory equivalences can be mapped automatically (cross-framework compliance).
*   **Acceptance Criteria:**
    *   Assignment of cross-links to controls (e.g., mapping from RESS control to ISO 27001 or BSI IT-Grundschutz).
    *   Machine-readable declaration of the link relationship (`rel="mapping"`).
- **Scope Limitation:** This feature handles inline cross-references within a catalog document (as a `link` with `rel="mapping"`). For independent cross-framework mapping documents (OSCAL `mapping-collection`), see [Step 8: Control Mapping](step8_control_mapping.md).

### US 1.7: Dual-Mode Editor (Visual vs. JSON/YAML)
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** seamlessly switch between a graphical input mask and the direct source code view (JSON/YAML),  
> **so that** I can comfortably edit visually as well as perform advanced manual schema adjustments without data loss.
*   **Acceptance Criteria:**
    *   Synchronous switching between the graphical editor and raw code view.
    *   No data or formatting loss during automatic synchronization.
    *   **Schema Validation in Dual-Mode:** Switching back to the visual view or saving triggers a JSON validation against the official NIST OSCAL Catalog schema (located locally under `reposol/backend/app/schemas/`) and visualizes any errors directly.
    *   Exported documents are 100% compliant with the official OSCAL Catalog schema.

### US 1.8: Integrated Catalog Versioning in the Backend
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** manage versions of a catalog in the backend while adhering to strict OSCAL compliance,  
> **so that** version states are saved persistently and compliantly.
*   **Acceptance Criteria:**
    *   Applies the global versioning pattern **US 0.P2** fully (schema validation, version synchronization, error feedback, drawer, read-only history).
    *   **Catalog-specific:** The document is validated against the official NIST OSCAL Catalog schema.
    *   **Revision Sync:** Upon saving, `catalog.metadata.revisions[]` is automatically updated (in accordance with US 0.7).

### US 1.9: Simplified Catalog Creation & Direct Editing (Inner View)
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** be able to create a new catalog by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can configure the structure and metadata directly within the editing area without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New Catalog" opens a simple dialog that requires only the entry of the document title.
    *   **Direct Redirection:** After clicking "Create Document," the catalog is initialized in the backend and the user is redirected immediately to the editing view (`/catalog/{uuid}?edit=true`).
    *   **In-place Configuration:** All further settings (groups, controls, metadata) are performed directly in this inner view.
    *   **Import Catalog Content:** In edit mode, the Document Overview contains the "Import Source" tab, which allows importing content from a registry template or a web URL (JSON) directly into the current catalog (preserving the original UUID). After a successful import, the content is automatically saved as a version in the backend, and the editor switches to the catalog's read-only view.

### US 1.10: Document Overview & Property Management in the Catalog
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** manage the catalog's metadata and properties in clearly separated views within the Document Overview,  
> **so that** I have a clear, OSCAL-correct overview of document metadata vs. property usage across controls and groups.
*   **Acceptance Criteria:**
    *   **Sidebar Navigation (per US 0.13 & DD-011):** The sidebar provides separate navigation items for `ℹ️ Metadata`, `🏷️ Properties`, and `⚙️ Parameters`, each rendering a dedicated view in the right main pane.
    *   **Metadata View (ℹ️ Metadata):** Shows the MetadataEditor (title, version, OSCAL version, roles, parties, locations, document-ids, remarks, revisions). Does NOT display control/group property aggregations.
    *   **Properties View (🏷️ Properties):** Contains:
        *   **Properties Dashboard:** An overview metric bar showing 4 key metrics: **Global Header Properties** (`metadata.props` count), **Element Properties** (unique properties used across tree elements), **Unique Keys** (total distinct property names in the document), and **Total Assignments** (total property occurrences in the tree).
    *   **Unified Property Cards & Tooltips:** Property cards display `🏷️ Header Property` (with tooltip explaining `metadata.props` header storage and inline editability) or `🏷️ Property` (with tooltip explaining tree element storage).
    *   **Add Header Property Button:** In edit mode (`isEditing`), the action button is labeled `➕ Add Header Property` with tooltip clarifying that it creates a document-level property in `metadata.props`.
    *   **Unified Icon Taxonomy (Option A):** 
        *   `🏷️` reserved strictly for **Properties** (sidebar tab, Property Hub cards, property pills, Add Property buttons).
        *   `⚙️` reserved strictly for **Parameters** (sidebar tab, Add Parameter button).
        *   `🔧` reserved for **Property Advanced Settings** (`PropsEditor.jsx` wrench popup).
> **Note (2026-07-22):** Standardized button label to `➕ Add Header Property` and added hover tooltips explaining Header Property vs. Element Property behavior.

### US 1.11: Detailed Editability of Controls & Exit Button in the Catalog
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** edit all components of a control and its enhancements inline in a single cohesive detail card and save edits using an exit button,  
> **so that** the operation is consistent and error-resistant.
    *   **In-Card Properties Editor:** In edit mode, the header area (ID, title) and properties area are combined into a single cohesive card (gray background with border). All property pills feature a prefix `🏷️` icon. Action buttons (`🔧` Advanced Settings and `🗑️` Delete) cleanly fade in onHover with `auto` container width (no CSS 28px clipping). The `🔧` wrench icon has uniform, neutral styling across all property pills, highlighting only when clicked open. Input widths for `id`, `class`, `name`, and `value` are sized dynamically with comfortable padding so control IDs (e.g. `GC.3.1.1`), class categories, placeholder texts, and short keys are never truncated.
    *   **Suggestions for Property Names:** When entering local or global properties, an autocompletion list (`datalist`) suggests all property keys already used in the catalog (e.g., `sort-id`, `label`).
    *   **Exit Button with Backend Drafting:** The "Cancel" button is replaced by an "Exit" button. This closes the editor and redirects to the read-only view (Catalog Viewer). Unsaved drafts are stored in `localStorage` so that they can be restored or discarded upon re-entering the catalog.

### US 1.12: Full Editability of All OSCAL Control Elements
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** create, edit, and delete **all** OSCAL-compliant components of a control (links, back-matter, properties) in the catalog editor,  
> **so that** I can maintain the catalog entirely through the visual interface without having to fall back on the raw JSON mode.
*   **Acceptance Criteria:**
    *   **Links Management:** Each control provides an area for adding, editing, and deleting links (`links`). For each link, `href` (URL or internal reference), `text` (description), and `rel` (relationship type, e.g., `reference`, `related`, `mapping`) can be maintained.
    *   **Back-Matter & Resources:** In the Document Overview, there is an area to manage back-matter resources (`back-matter.resources`). Resources support all OSCAL fields: title, description, properties, document IDs, **citations** (`citation` with text, props, and links), **resource links** (`rlinks` with href, media-type, and optional integrity hashes), and **embedded Base64 attachments** (`base64` with filename, media-type, and content). Resources can be added, edited, and deleted.
    *   **Linking to Resources:** When creating a link with `rel="reference"` on a control, the UI offers a dropdown selection of all existing back-matter resources to easily and accurately link the resource UUID.
    *   **Roles and Responsibilities:** According to the official OSCAL standard, controls in a catalog do not support direct assignments of `responsible-roles` (these belong to the implementation level in the SSP). Therefore, the tool supports the management of roles at the global metadata level of the document, not directly at the control level.
    *   **Full Parity with Profile Editor:** All control components editable in the Profile Editor (Step 2) (title, ID, class, properties, links, parts, parameters, enhancements) are also editable in the Catalog Editor — the Catalog Editor is the primary source, the Profile Editor only modifies.

### US 1.13: Interactive Parameter Inserts in Prose (Inserts)
> **As a** Compliance Officer (Alice)  
> **I want to** insert parameter placeholders at the push of a button when editing requirement texts (prose),  
> **so that** the text modules of the catalog are dynamically and standard-compliantly linked with the parameter definitions.
*   **Acceptance Criteria:**
    *   **Insert Placeholder:** In the prose input field (textarea) for statements, guidance, or discussion, there is an `➕ Insert Parameter` button at the cursor position.
    *   **Selection Dropdown:** The button opens a dropdown menu of all parameters defined in the catalog or control.
    *   **Insert Tag Rendering:** After selection, a placeholder tag (e.g., `{{ insert: param, param-id }}`) is inserted into the text. In the read-only view, the current value of the parameter is rendered at this position (or a placeholder if not set).
    *   **OSCAL-compliant Storage:** When serializing to JSON/XML, the placeholder is stored as a standard-compliant `<insert type="param" id-ref="param-id"/>` element and is converted back to the editor format when loaded.

### US 1.14: Drag-and-Drop Reordering of Groups & Controls in the Sidebar
> **As a** Compliance Officer and Framework Developer (Alice)  
> **I want to** move groups and controls in the catalog sidebar using drag-and-drop — both in their order within the same hierarchy level and between different groups (hierarchy change),  
> **so that** I can intuitively and efficiently reorder the structure of my catalog without relying on context menu buttons.
*   **Acceptance Criteria:**
    *   **Drag Handle:** In edit mode, each group and control in the sidebar displays a visual drag handle (e.g., `⠿` icon) to start a drag operation.
    *   **Seamless Targeting (Midpoint Partitioning):** When dragging over the sidebar, there are no dead zones or dropouts. The drop position is calculated based on the midpoints between elements. Placing an item directly into the gap that opens up is reliably possible.
    *   **Smooth Gap Opening (Accordion Spacing):** When dragging between elements (reordering), a gap gently slides open at the insertion point to make room for the element.
    *   **Dropping inside a Group without Gap:** When moving over the center of a group, no gap opens. Instead, the target group is visually highlighted (dashed outline + glow) to indicate the hierarchy change.
    *   **Collision-Free Ghost Element:** The floating ghost element (bearing the name of the dragged object) is positioned offset from the cursor (e.g., shifted down-right) so it doesn't obscure the target object and text.
    *   **Same Level — Reordering:** An element can be moved up or down within its current peer list (e.g., controls within a group or root groups at the top level).
    *   **Hierarchy Change:** A control can be dragged and dropped from one group into another group (or to the root level). A group can be moved into another group as a subgroup or dragged to the root level.
    *   **Edit Mode Only:** Drag-and-drop is only active when the user is in edit mode. In view mode, elements are not draggable.
    *   **Undo-Capable:** Each drag-and-drop operation creates a new undo history entry, allowing the relocation to be undone (Ctrl+Z).
    *   **No External Dependency:** The implementation is done using a robust pointer-based (PointerEvents) custom implementation for maximum reliability with React re-renders.

### US 1.15: Mehrebenen-Parameterverwaltung und -referenzierung (Katalog-, Gruppen- und Kontrollebene)
> **Als** Framework-Entwickler (Alice)  
> **möchte ich** Parameter auf Katalog-, Gruppen- und Kontrollebene definieren, verwalten und in Prose-Texten referenzieren können,  
> **damit** ich redundante Parameterdefinitionen vermeiden und Parameter auf der passenden hierarchischen Ebene deklarieren kann.
*   **Akzeptanzkriterien:**
    *   **Katalogweite Parameter (Catalog-Level):** Ein neuer Tab `⚙️ Parameters` in der Dokumentenübersicht (DocumentOverview) im Katalog-Modus ermöglicht das Hinzufügen, Bearbeiten und Löschen von globalen Parametern.
    *   **Gruppenweite Parameter (Group-Level):** Eine aufklappbare Section "Group Parameters" im GroupEditor erlaubt das Verwalten von Parametern für alle Kontrollen dieser Gruppe und ihrer Untergruppen.
    *   **Parameter-Dropdown-Gruppierung:** Beim Klick auf `🏷️ Add Parameter` in Prose-Feldern werden alle verfügbaren Parameter (Katalog, Gruppe, Kontrolle) hierarchisch gruppiert im Dropdown angezeigt (🌐 Catalog → 📁 Group → 🎯 Control).
    *   **Parameter-Auflösung in Prose:** Im Read-Only-Modus sowie in Prose-Texten werden Parameter aller Ebenen korrekt aufgelöst und angezeigt.
    *   **Profil-Überschreibung (Profile Mode):** Im Profil-Modus können alle Parameter (auch Katalog- und Gruppen-Parameter) über die ID überschrieben (`set-parameters`) und gerendert werden.

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create Catalog (US 1.9):** Alice clicks on "New Catalog", enters the title *"Reposol Enterprise Security Standard (RESS)"* and is redirected immediately to the editing view `/catalog/{uuid}?edit=true`.
2.  **Configure Metadata & Global Tags (US 1.10):** In the right main pane (Document Overview) under *Metadata*, she enters version `1.0.0`. Under *Tags*, she defines a global property `risk-party`.
3.  **Build Group Structure (US 1.2):** She creates the main group *"Access Control"* (`ac`) and the subgroup *"Identification and Authentication"* (`ac-ia`) in the left sidebar.
4.  **Declare Controls & Enhancements (US 1.3, US 1.11):** She creates control `ac-2` (*Account Management*) with a statement. In the combined detail view, she assigns the global tag `risk-party` with the value `Platform-Engineering` (supported by autocompletion suggestions). She adds the sub-control `ac-2.1` (*Automated System Account Management*).
5.  **Secure Parameters (US 1.4):** 
    *   She defines parameter `ac-2_prm_1` (review frequency) with the default value `"90 days"` and enforces the value format `^[0-9]+ (days|months)$` via a regex constraint.
    *   She configures `ac-2_prm_2` (inactivity action) as a single choice (Disable, Delete, Warn).
    *   She configures `ac-2_prm_3` (MFA method) as a multi-choice.
6.  **Set Assessment Instructions & Mappings (US 1.5, US 1.6):** She adds an objective to `ac-2` with the methods `examine`, `interview`, and `test` as well as references to ISO 27001 (A.9.2.1).
7.  **Versioning (US 1.8):** She clicks "Save Version", enters version number `1.0.0` with the note "Initial Creation". The state is saved in the backend as `<uuid>_v1.0.0.json` and `catalog.metadata.revisions[]` is automatically updated.
8.  **Exit (US 1.11):** She clicks "Exit", exits edit mode, and views the completed read-only view of the catalog.

---

## 3. Functional Requirements for the System

- **Complete Metadata:** Capturing all OSCAL metadata elements including parties, locations, roles, actions, and document IDs (US 1.1).
- **Hierarchical Structure:** Creation of infinitely nested groups for structuring control sets (US 1.2).
- **Control Enhancements:** Support for nested sub-controls (`controls` within `controls`) with their own IDs (US 1.3).
- **Inline Editing of all Prose Elements:** Statement sub-parts (a, b, c), guidance, discussion, and other parts can be edited directly in the editor as text fields (US 1.3).
- **Parameterization & Validation:** Definition of parameters with default assignments, choice lists (`select.choice`), regex constraints, and interactive CRUD via the visual interface (US 1.4).
- **Parameter Inserts in Prose:** Insertion of standard-compliant parameter references (`insert type="param"`) in prose texts via a visual button (US 1.13).
- **Audit Preparation (Objectives & Methods) & Mappings:** Assessment objectives, standardized test methods, and cross-framework mappings (US 1.5, US 1.6).
- **Synchronous Dual-Mode Editor:** Synchronous switching between the graphical editor interface and the raw JSON/YAML mode without data loss (US 1.7).
- **Integrated Versioning with Schema Validation:** Versioning in accordance with US 0.P2 with NIST Catalog schema validation and revision sync (US 1.8).
- **Document Overview & Tag Control:** Centralized management of metadata and tag promotion in the right main pane (US 1.10).
- **Combined Card Layout & Draft Recovery:** Cohesive detail editing card for header/properties, autocompletion for keys, and `localStorage`-based draft recovery upon exit (US 1.11).
- **Full Control Editing:** Links, back-matter resources (including citations, Base64 attachments, hashes) and responsible roles can be maintained via the visual interface — full parity with the Profile Editor (US 1.12).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] The editor allows capturing complete metadata (title, version, OSCAL version, published, document IDs, parties, locations, actions) (US 1.1).
- [x] A user can create, nest, and move groups and subgroups (US 1.2).
- [x] Controls can be created with structured prose parts (statements, guidance, discussion) and sub-controls (enhancements) (US 1.3).
- [x] Statement sub-parts (a, b, c) can be individually edited inline, added, and deleted (US 1.3).
- [x] All prose parts (guidance, discussion, etc.) can be edited directly inline as free text (US 1.3).
- [x] The class attribute of a control can be set via an input field (US 1.3).
- [x] Parameters support default values, choice lists (single/multi), regex-based validation rules, and interactive CRUD (US 1.4).
- [x] The catalog creator can create assessment objectives (objectives) and recommended assessment methods (examine/interview/test) (US 1.5).
- [x] The editor allows adding cross-links to external standards (US 1.6).
- [x] The switcher between the graphical mask and JSON text synchronizes changes error-free in both directions and validates against the official NIST schema (US 1.7).
- [x] Catalogs are exported 100% compliant with the official OSCAL Catalog schema (US 1.7).
- [x] Versioning with NIST schema validation, revision sync, and reference to US 0.P2 (US 1.8).
- [x] Catalog creation redirects the user directly to the in-place editor (US 1.9).
- [x] The Document Overview clearly displays metadata and tags (including used tags & promotion) (US 1.10).
- [x] Edited controls are displayed in a cohesive card, and drafts are cached locally upon exit (US 1.11).
- [x] Links on controls can be created, edited, and deleted (href, text, rel) (US 1.12).
- [x] Back-matter resources including citations, Base64 attachments, and rlink hashes can be managed in the Document Overview (US 1.12).
- [x] Responsible roles can be assigned at the document metadata level per OSCAL spec (US 1.12).
- [x] The Catalog Editor offers full editing parity with the Profile Editor for all OSCAL control elements (US 1.12).
- [x] Users can insert parameter placeholders (`insert type="param"`) interactively via a button at the cursor position in prose elements (US 1.13).
- [x] In the read-only view, parameter inserts are correctly rendered as text or as selectable value badges (US 1.13).
- [x] Catalog-level, Group-level, and Control-level parameters can be defined and managed visually, resolved properly in prose, and overridden in Profiles (US 1.15).
