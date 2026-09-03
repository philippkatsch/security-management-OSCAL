# Step 3: Detailed User Stories – Component Definition

* **Persona:** Alice (Compliance Officer / Lead Engineer)
* **Goal:** Structured capture of all reusable IT security components—software products, cloud services, hardware devices, network interconnections, policies, and procedures—along with their inherent compliance capabilities, technical interfaces, and organizational responsibilities, according to the NIST OSCAL Component Definition Model (v1.2.2). These component building blocks serve as pre-defined templates for System Security Plans (SSPs) in Stage 4.

---

## 1. Breakdown of User Stories

### US 3.1: Component Definition Document Creation & Inner View
> Implements [US 0.14](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create a new Component Definition document by entering only a document title and being immediately redirected to the in-place editing area (Inner View),  
> **so that** I can begin declaring components without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Dialog:** Clicking "New Component Definition" opens a simple dialog requiring only the document title. The system generates a `component-definition.uuid` automatically.
    *   **Direct Redirection:** After clicking "Create Document," the document is initialized in the backend with an empty `components[]` array and the user is redirected to the editing view (`/component-definitions/{uuid}?edit=true`).
    *   **Document Shell:** The initialized document contains `component-definition.uuid`, `metadata` (with `title`, `last-modified`, `version`, `oscal-version`), empty `components[]`, and no invalid empty arrays.
    *   **OSCAL Compliance:** The generated document validates against the official NIST OSCAL Component Definition JSON Schema (v1.2.2) via `POST /api/validate/component-definitions`.
    *   **UI Feedback & Modals:** Creation and error notifications use `react-hot-toast` and standard dialogs per [DD-032](../design_decisions/DD-032_ui_infrastructure.md).

### US 3.2: Component Declaration & OSCAL Type Classification
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create individual components within a Component Definition document and classify them according to standardized OSCAL component types,  
> **so that** every IT asset, service, policy, or procedure is categorized in a machine-readable, interoperable manner.
*   **Acceptance Criteria:**
    *   **Component CRUD:** The user can create, read, update, and delete components within the `components[]` array. Each component receives a unique `uuid` upon creation. Deletion requires confirmation via `useConfirm()` ([DD-032](../design_decisions/DD-032_ui_infrastructure.md)).
    *   **OSCAL Type Selection:** A dropdown selector offers all 11 standardized OSCAL `defined-component` types:
        *   `software` — Software applications, libraries, and firmware.
        *   `hardware` — Physical or virtual hardware devices.
        *   `service` — Cloud services, APIs, managed services, and SaaS offerings.
        *   `policy` — Organizational policies and directives.
        *   `physical` — Physical facilities (e.g., data centers, server rooms, cabling infrastructure).
        *   `process-procedure` — Documented processes, procedures, and operational runbooks.
        *   `plan` — Plans (e.g., contingency plans, incident response plans, continuity plans).
        *   `guidance` — Guidance documents, best practices, and implementation guides.
        *   `standard` — Standards, baselines, and configuration benchmarks.
        *   `validation` — Validation and certification records (e.g., FIPS 140-2, Common Criteria).
        *   `interconnection` — Network interconnections between systems or security domains.
    *   **Custom Types:** The type selector includes an "Other..." option that reveals a free-text input for custom component types (OSCAL: `allow-other="yes"`). SSP-only types (`this-system`, `system`) are excluded from standard choices.
    *   **No Status Field:** The component editor adheres strictly to the OSCAL metaschema: no `status` field is rendered or saved on `defined-component`.
    *   **Type-Specific UI Hints:** When `type="service"` or `type="software"` is selected, the Protocols & Port Ranges section (US 3.7) becomes prominently visible and auto-expanded. For `type="software"`, software properties (`software-identifier`, `software-name`, `software-version`) are suggested in the Standard Property Palette (US 3.4). For `type="validation"`, `validation-type` and `validation-reference` properties are highlighted.
    *   **Component UUID Uniqueness:** The system enforces uniqueness of `component.uuid` values across the document (OSCAL index constraint `oscal-index-system-component-uuid`).

### US 3.3: Component Core Identity Fields
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** define the core identity of each component including its title, description, purpose, and remarks,  
> **so that** every component has clear, human-readable documentation of its function and business context.
*   **Acceptance Criteria:**
    *   **Title (Required, `markup-line`):** A single-line rich text field for the component's human-readable name (e.g., "MongoDB Community Server"). Displayed prominently in the component header and the component table (US 3.15).
    *   **Description (Required, `markup-multiline`):** A multi-line rich text field for a detailed description of the component's function.
    *   **Purpose (Optional, `markup-line`):** A single-line rich text field for a concise summary of the component's technological or business purpose.
    *   **Remarks (Optional, `markup-multiline`):** A multi-line rich text field for additional commentary, implementation notes, or caveats.
    *   **Inline Editing in Detail Panel:** All fields are editable inline within the `EntityDetailPanel` (full-page mode per [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md)) when in edit mode.
    *   **Required Field Validation:** `title` and `description` are marked as required; the system prevents saving with empty values and displays inline validation error messages per [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).

### US 3.4: Standard OSCAL Component Properties (Property Palette)
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** assign standardized OSCAL properties (`props`) to components using a guided property palette (dropdowns, toggles, date pickers),  
> **so that** common technical and compliance metadata is captured consistently and machine-readably across all assets.
*   **Acceptance Criteria:**
    *   **Architecture & Deployment Properties (Toggles / Switches):**
        *   `implementation-point`: `internal` | `external` — toggle switch.
        *   `virtual`: `yes` | `no` — toggle switch.
        *   `public`: `yes` | `no` — toggle switch.
        *   `allows-authenticated-scan`: `yes` | `no` — toggle switch.
    *   **Versioning & Release Properties (Text / Date Picker):**
        *   `version` — Product version string (e.g., `15.2.1`).
        *   `patch-level` — Current patch level (e.g., `p3`).
        *   `release-date` — Release date rendered as an interactive date picker, validated as `YYYY-MM-DD` (OSCAL constraint `oscal-component-release-date-value-datatype`).
        *   `model` — Product model designation.
    *   **Asset Classification Properties (Dropdown with Custom Values):**
        *   `asset-type` with 12 standard values: `operating-system`, `database`, `web-server`, `dns-server`, `email-server`, `directory-server`, `pbx`, `firewall`, `router`, `switch`, `storage-array`, `appliance` + custom allow-other.
        *   `asset-id` — Organizational asset identifier (free text).
        *   `asset-tag` — Physical asset tag identifier (free text).
    *   **Software-Specific Properties (Conditional — shown when `type="software"`):**
        *   `software-identifier` — Machine-readable identifier (e.g., CPE, SWID tag).
        *   `software-name`, `software-version`, `software-patch-level` — Software identification fields.
    *   **Operating System Properties (Conditional):**
        *   `os-name` — Operating system name (e.g., "Ubuntu Linux").
        *   `os-version` — Operating system version (e.g., "22.04 LTS").
    *   **Network Segment Properties:**
        *   `vlan-id` — VLAN identifier.
        *   `network-id` — Network identifier.
    *   **Validation & Certification Properties (Conditional — shown when `type="validation"`):**
        *   `validation-type` — Type of validation (e.g., `fips-140-2`, `fips-140-3`, `common-criteria`).
        *   `validation-reference` — Validation certificate number or reference.
    *   **Other Standard Properties:**
        *   `label` — Display label for the component.
        *   `sort-id` — Sorting identifier for ordering components.
        *   `baseline-configuration-name` — Name of the baseline configuration applied.
        *   `function` — Functional description of the component's role.
    *   **Deprecation Warning:** `hardware-model` is flagged with a deprecation warning, directing users to use `model`.
    *   **OSCAL Namespace & Schema Purging:** All standard properties automatically use namespace `http://csrc.nist.gov/ns/oscal`. Empty optional property fields are purged prior to serialization per [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).

### US 3.5: Custom Properties & Free-Form Metadata
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** define arbitrary custom properties on components with full control over name, value, namespace, class, and group,  
> **so that** organization-specific metadata, certifications, and annotations can be captured beyond the OSCAL standard vocabulary.
*   **Acceptance Criteria:**
    *   **Free-Form Property Creation:** Adding custom `props[]` entries via `PropsEditor` with:
        *   `name` (required, `token`) — Property key (e.g., `eal-level`, `encryption-algorithm`, `data-classification`).
        *   `value` (required, `string`) — Property value (e.g., `EAL 4+`, `AES-256-GCM`, `confidential`).
        *   `ns` (optional, `uri`) — Custom namespace URI. Defaults to `http://csrc.nist.gov/ns/oscal` if omitted; custom namespace for organizational properties.
        *   `class` (optional, `token`) — Sub-classification within the property name.
        *   `group` (optional, `token`) — Grouping identifier for related properties.
        *   `uuid` (optional, auto-generated) — Unique identifier for the property instance.
        *   `remarks` (optional, `markup-multiline`) — Commentary on the property.
    *   **Autocomplete (`datalist`):** The `name` field provides suggestions for property names already used in the document or workspace.
    *   **Reorder & Delete:** Properties can be reordered and deleted individually with `useConfirm()` confirmation on batch actions.
    *   **Properties vs Parameters Separation:** In accordance with [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md), properties are static metadata annotations defined directly on components. No tag promotion or cascading property templates exist.

### US 3.6: Component Links & Dependency Declaration
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** declare typed links between components and to external resources,  
> **so that** dependency chains, data flows, and compliance evidence are transparently documented in the system architecture model.
*   **Acceptance Criteria:**
    *   **Link Creation:** Adding `links[]` entries with:
        *   `href` (required, `uri-reference`) — Target reference: internal `#uuid` fragment (component, capability, or back-matter resource), relative reference, or absolute URI.
        *   `rel` (optional, `token`) — Dropdown with OSCAL standard relation types:
            *   `depends-on` — Component depends on the referenced component for operation.
            *   `uses-service` — Component consumes the referenced service.
            *   `uses-network` — Component uses the network provided by the referenced component.
            *   `validation` — Link to a validation/certification component or resource.
            *   `proof-of-compliance` — Link to compliance evidence (e.g., audit report).
            *   `baseline-template` — Link to a baseline template document.
            *   `system-security-plan` — Link to an SSP that includes this component.
            *   Custom relation types are allowed (OSCAL: `allow-other="yes"`).
        *   `media-type` (optional, `string`) — MIME type of the linked resource.
        *   `resource-fragment` (optional, `string`) — Fragment identifier within the resource.
        *   `text` (optional, `markup-line`) — Human-readable link label/description.
    *   **Service-Specific Relations:** When `type="service"`, additional standard relation types `provided-by` and `used-by` are available.
    *   **Internal Component Picker:** Interactive picker allows selecting other components within the same document as link targets, generating `#uuid` href values.
    *   **Back-Matter Resource Picker:** Picker allows selecting `back-matter.resources[]` entries as link targets using `#uuid` fragment references (US 3.19).
    *   **Visual Dependency Indicators:** Links with `rel="depends-on"` or `rel="uses-service"` display visual connection badges in the Component Table (US 3.15) and Detail Panel per [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md).

### US 3.7: Service Protocol & Port Range Declaration
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** document the network protocols and port ranges offered by service and software components,  
> **so that** the technical communication structure and attack surface are transparently captured for security assessments and network architecture reviews.
*   **Acceptance Criteria:**
    *   **Protocol Definition:** Adding `protocols[]` entries on components (primarily for `type="service"` and `type="software"`) with:
        *   `name` (recommended, `string`) — Protocol identifier (e.g., `https`, `ssh`, `postgresql`, `mongodb`, `grpc`).
        *   `uuid` (optional, auto-generated) — Unique identifier for the protocol entry.
        *   `title` (optional, `markup-line`) — Human-readable protocol description.
    *   **Port Range Configuration:** Each protocol can have multiple `port-ranges[]` entries with:
        *   `start` (recommended, `non-negative-integer`) — Start port number (0–65535).
        *   `end` (recommended, `non-negative-integer`) — End port number (0–65535).
        *   `transport` (recommended, `token`) — Transport protocol: `TCP` or `UDP`.
    *   **Port Range Validation:** Live validation per [DD-014](../design_decisions/DD-014_live_ui_form_validation.md): warning if `start > end`, warning if `start`, `end`, or `transport` are omitted.
    *   **UI Hint — Type-Driven Visibility:** The Protocols section is visually highlighted and auto-expanded when component type is `service` or `software`.
    *   **Common Protocol Templates:** Quick-add preset buttons for common protocols (`HTTPS/443/TCP`, `SSH/22/TCP`, `HTTP/80/TCP`, `PostgreSQL/5432/TCP`, `MongoDB/27017/TCP`, `MySQL/3306/TCP`, `DNS/53/UDP`, `SMTP/25/TCP`) to accelerate data entry.
    *   **Schema Purging:** Empty `protocols[]` or `port-ranges[]` arrays are purged prior to serialization per [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).

### US 3.8: Role & Responsibility Assignment
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** bind organizational responsibilities directly to components using standardized and custom role identifiers linked to persons or teams defined in the document metadata,  
> **so that** responsible teams and individuals can be identified immediately during audits or security incidents.
*   **Acceptance Criteria:**
    *   **Responsible Role Assignment:** Adding `responsible-roles[]` entries on a component with:
        *   `role-id` (required, `token`) — Role identifier. Dropdown offers 9 OSCAL standard roles:
            *   **Operational Roles:** `asset-owner`, `asset-administrator`, `security-operations`, `network-operations`, `incident-response`, `help-desk`, `configuration-management`.
            *   **Production/Supply Roles:** `maintainer`, `provider`.
            *   Custom role IDs are allowed (OSCAL: `allow-other="yes"`).
        *   `party-uuids[]` (optional, `uuid[]`) — References to persons, teams, or organizations defined in `metadata.parties[]`. A party picker displays available parties from the document metadata.
        *   `props[]`, `links[]`, `remarks` (optional) — Supplementary metadata on role assignment.
    *   **Role Uniqueness:** Each `role-id` can appear at most once per component (OSCAL constraint: `is-unique` on `responsible-role/@role-id`). The UI prevents duplicate role assignments.
    *   **Role Description Tooltip:** Standard OSCAL role IDs display descriptive tooltips explaining the role's purpose.

### US 3.9: Control Implementation Sets
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create control implementation sets that link a component to one or more regulatory frameworks (catalogs or profiles),  
> **so that** the component's out-of-the-box security capabilities are documented per framework and can be reused as templates in System Security Plans (Stage 4).
*   **Acceptance Criteria:**
    *   **Control Implementation Set Creation:** Adding `control-implementations[]` entries on a component with:
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `source` (required, `uri-reference`) — Reference to the catalog or profile defining the controls being implemented.
        *   `description` (required, `markup-multiline`) — Narrative describing how the component supports the referenced framework controls.
    *   **Workspace Source Picker:** A dedicated workspace browser modal allows selecting from Catalogs (`/api/documents/catalogs`) and Profiles (`/api/documents/profiles`) in the current Reposol workspace, auto-populating `source`. Manual URI entry is supported as a fallback for external references.
    *   **Multiple Framework Support:** A single component can define multiple `control-implementations[]` sets, each targeting a different framework (e.g., BSI IT-Grundschutz, NIST SP 800-53 rev5, ISO 27001).
    *   **Set-Level Properties & Links:** Optional `props[]` and `links[]` for set-level metadata.
    *   **Minimum One Requirement:** Each `control-implementations` entry must contain at least one `implemented-requirements[]` entry (OSCAL: `min-occurs="1"`).

### US 3.10: Implemented Requirements Mapping
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** map individual controls from a referenced framework to the component and describe how each control is implemented out-of-the-box,  
> **so that** the component's built-in security capabilities are documented at the individual control level and can be pre-populated into SSPs.
*   **Acceptance Criteria:**
    *   **Implemented Requirement Entry:** Adding `implemented-requirements[]` within a `control-implementations` set with:
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `control-id` (required, `token`) — Identifier matching a control in the referenced `source` catalog or profile.
        *   `description` (required, `markup-multiline`) — Narrative description of how the component implements this control.
    *   **Hierarchical Control Picker:** A searchable control picker loads available controls from the referenced `source` catalog/profile (`/api/resolve/tree/{stage}/{docId}`), displaying control IDs, titles, and group hierarchy for guided selection.
    *   **Bulk Selection:** Users can multi-select controls from the picker to bulk-add multiple `implemented-requirements` with placeholder descriptions.
    *   **Properties & Links:** Optional `props[]`, `links[]`, and `remarks` per requirement.
    *   **Responsible Roles per Requirement:** Individual `responsible-roles[]` can be assigned at the implemented requirement level (with party picker and uniqueness enforcement).
    *   **Statement Uniqueness:** Each `statement-id` appears at most once within the same implemented requirement.

### US 3.11: Structured Statement-Level Implementation Detail
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** provide fine-grained implementation narratives at the individual control statement level using a structured editor,  
> **so that** complex multi-part controls are documented precisely, showing exactly which sub-requirements the component fulfills without manual JSON manipulation.
*   **Acceptance Criteria:**
    *   **Structured Statement Editor:** Replaces raw JSON textareas with a structured UI. Each statement entry contains:
        *   `statement-id` (required, `token`) — Identifier of the control statement part (e.g., `ac-7_smt.a`, `ac-7_smt.b`).
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `description` (required, `markup-multiline`) — Implementation narrative using `ProseWithParams` ([DD-013](../design_decisions/DD-013_universal_prose_with_params_integration.md)).
    *   **Statement Picker:** When the referenced control has multiple statements/parts, the UI loads statement IDs from the source catalog/profile for guided selection.
    *   **Statement Uniqueness:** Each `statement-id` appears at most once per implemented requirement (OSCAL constraint `oscal-unique-component-definition-implemented-requirement-statement`).
    *   **Statement-Level Metadata:** Each statement supports optional `responsible-roles[]`, `props[]`, `links[]`, and `remarks`.
    *   **Visual Hierarchy:** Statements render as nested card rows under their parent implemented requirement with distinct indentation and clear add/remove actions.
    *   **Schema Purging:** Empty `statements[]` arrays are purged before save per [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).

### US 3.12: Component Parameter Defaults (Simplified Set-Parameters)
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** define default parameter values at both the control implementation set level and the individual implemented requirement level using a simplified value-only editor,  
> **so that** the component ships with pre-configured security settings that can be inherited or overridden in System Security Plans.
*   **Acceptance Criteria:**
    *   **Simplified Value-Only Editor (DD-012 Scope Note):** Parameter defaults are managed using a simplified key-value editor rather than the full dual-mode ParameterCard:
        *   `param-id` (required, `token`) — Reference to a parameter defined in the source catalog/profile.
        *   `values[]` (required, `string[]`, minItems: 1) — Multi-value string input for one or more default values (e.g., `["5"]`, `["30"]`).
        *   `remarks` (optional, `markup-multiline`) — Commentary explaining default value selection.
    *   **Dual-Level Placement:** Set-parameters can be added at both:
        *   `control-implementations` level (set-wide defaults across all requirements in the framework).
        *   `implemented-requirements` level (control-specific parameter overrides).
    *   **Parameter Browser:** A parameter picker loads available parameters from the source catalog/profile, showing `param-id`, `label`, and choice guidelines.
    *   **Parameter Uniqueness:** Each `param-id` appears at most once within the same `set-parameters[]` array (OSCAL constraints).
    *   **Schema Purging:** Empty `set-parameters[]` and empty `values: []` arrays are strictly purged prior to serialization per [DD-014](../design_decisions/DD-014_live_ui_form_validation.md) to avoid `minItems: 1` schema validation failures.

### US 3.13: Capability Declaration & Component Aggregation
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** group related components into named capabilities that represent composite security functions,  
> **so that** higher-level security capabilities (e.g., "Identity & Access Management" or "Data Encryption at Rest") can be documented as aggregations of individual components.
*   **Acceptance Criteria:**
    *   **Capability Creation:** Adding `capabilities[]` entries at the document level with `uuid`, `name`, and `description`.
    *   **Incorporating Components:** Adding `incorporates-components[]` entries within a capability with `component-uuid` (referencing a component in the same document via a searchable picker) and `description`.
    *   **Component Uniqueness:** Each component can only be referenced once within the same capability.
    *   **Capability Detail Panel:** Capability editing opens in a slide-out `EntityDetailPanel` per [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md).
    *   **Capability-Level Control Implementations:** Capabilities support their own `control-implementations[]` independent of individual components, documenting composite compliance coverage.
    *   **Capability Properties & Links:** Support for optional `props[]`, `links[]`, and `remarks`.

### US 3.14: External Component Definition Import
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** import external OSCAL component definitions from vendors, other Reposol instances, or public repositories,  
> **so that** I can reuse pre-built component building blocks without manual re-entry.
*   **Acceptance Criteria:**
    *   **Import Declaration:** Adding `import-component-definitions[]` entries with `href` (absolute URL, relative path, or `#uuid` back-matter reference) and optional `remarks`.
    *   **File Upload:** Users can upload an external OSCAL component definition JSON file, stored in `back-matter.resources[]` and referenced via `#uuid`.
    *   **OSCAL Validation on Import:** Imported documents are validated against the official OSCAL component definition schema before acceptance.
    *   **Read-Only Browse Mode:** Users can inspect the components and capabilities of imported definitions in read-only mode.
    *   **Visual Distinction:** Imported definitions and components display an import badge 📥 in list views.

### US 3.15: Component Table & List Navigation (EntityTable)
> Implements [US 0.18](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** see all components declared in the current document in a structured table view with filtering, sorting, and search capabilities,  
> **so that** I can quickly navigate, search, and manage my component inventory.
*   **Acceptance Criteria:**
    *   **EntityTable Implementation (DD-021):** Main component view uses `EntityTable` with columns:
        *   Component Name (`title`, sortable, searchable).
        *   Type (`type` with icon badge, sortable, filterable via dropdown containing 11 standard types + custom).
        *   Version (derived from `props[name='version']`, sortable).
        *   Control Implementations (count of implementation sets, sortable).
        *   Purpose (truncated summary, searchable).
        *   Last Modified (date timestamp, sortable).
        *   *(Note: Status column is removed per OSCAL metaschema).*
    *   **Full-Text Search:** Debounced 300ms search across titles, descriptions, purpose, and property values.
    *   **Row Click Navigation:** Clicking a row opens the component in the full-page `EntityDetailPanel` ([DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md)).
    *   **Batch Operations:** Multi-select checkboxes enable batch deletion with confirmation modal via `useConfirm()` ([DD-032](../design_decisions/DD-032_ui_infrastructure.md)).
    *   **Empty State:** When no components exist, renders `EmptyState` component with "+ Add First Component" call-to-action ([DD-032](../design_decisions/DD-032_ui_infrastructure.md)).

### US 3.16: Document Overview & Metadata Management
> Implements [US 0.16](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** manage document-level metadata and inspect property analytics in clearly separated tabs in the Document Overview pane,  
> **so that** document metadata and inventory statistics are well-maintained without conflating properties with cascading templates.
*   **Acceptance Criteria:**
    *   **Document Overview Navigation:** The Document Overview pane displays horizontal tabs: **Overview**, **Components**, **Capabilities**, **Metadata**, and **JSON Source** (Entity List-Detail pattern per [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md)).
    *   **StandardMetadataTab (DD-004 §9, DD-011):** Renders shared metadata editor managing `metadata.title`, `metadata.version`, `metadata.oscal-version`, `metadata.last-modified`, `metadata.published`, `metadata.revisions[]`, `metadata.parties[]`, `metadata.roles[]`, `metadata.responsible-parties[]`, `metadata.document-ids[]`, and `metadata.remarks`.
    *   **Document Properties (`metadata.props`):** Managed within `StandardMetadataTab` exclusively for properties describing the document itself (e.g., `marking`, `publication-status`, `framework-identifier`).
    *   **Properties Dashboard Analytics (DD-011):** Overview displays document-type-aware analytics across `components[]` and `capabilities[]`:
        *   Global Header Properties (count in `metadata.props`).
        *   Element Properties (distinct property names across components/capabilities).
        *   Unique Keys (total distinct property keys in document).
        *   Total Assignments (total property occurrences across all components).
    *   **Component Inventory Summary:** Metric cards showing Total Components, Breakdown by Type (e.g., "3 software, 2 services, 1 policy"), Total Capabilities, and Total Control Implementation Sets.
    *   **No Tags Tab / No Tag Promotion:** The legacy "Tags Tab" and "Promote to Global Tag" button are abolished per [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md).

### US 3.17: In-Card Editing, Mode Toggle & Backend Draft Persistence
> Implements [US 0.17](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** edit component details inline in a cohesive card layout, switch seamlessly between View and Edit modes with the persistent Segmented Mode Toggle, and have unsaved drafts auto-saved in the backend,  
> **so that** editing is uniform, responsive, and resilient against accidental navigation or browser closure.
*   **Acceptance Criteria:**
    *   **Segmented Mode Toggle (`[ 👁️ View | ✏️ Edit ]`):** A persistent segmented control in `DocumentToolbar` ([DD-004 §4](../design_decisions/DD-004_editor_ux_patterns.md)).
        *   Selecting `👁️ View` auto-saves any active dirty draft silently in the background and switches the interface to Read-Only preview instantly (`reload({ silent: true })`).
        *   Selecting `✏️ Edit` activates inline editing (loading the active draft or creating one from the currently viewed published version).
        *   Synchronizes URL query parameter (`?edit=true` vs base path).
        *   The ambiguous "Exit button" is removed.
    *   **Backend Draft Auto-Save:** When `isDirty === true`, unsaved modifications are auto-saved to the backend every 30 seconds as `<uuid>_draft.json` ([DD-004 §4](../design_decisions/DD-004_editor_ux_patterns.md), [US 0.8](step0_global_requirements.md)). Client-side `localStorage` drafting is removed.
    *   **Edit-Mode Locking Rule:** During active editing (`isEditing === true`), `VersionDropdown` is locked displaying `📝 Draft (editing)` with a lock icon 🔒, disabling version switching to prevent data loss.
    *   **Discard Draft Action:** Discarding temporary draft changes is performed via `🗑️ Delete Draft` in `VersionDropdown` or through dirty-aware `⬅ Back` navigation confirmation with `useConfirm()`.
    *   **Cohesive Card Layout:** Detail panel groups fields into structured sections: Header, Standard Property Palette, Custom Properties (`PropsEditor`), Protocols, Roles, Control Implementations, and Links.

### US 3.18: Integrated Backend Versioning & Validation
> Implements [US 0.15](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** save, load, and delete versions of a Component Definition document directly in the backend,  
> **so that** version states are managed persistently, cross-device, and are visible to other users in the workspace.
*   **Acceptance Criteria:**
    *   **Stable Document UUID:** New versions are saved under the same document `uuid` as `{uuid}_v{version}.json`.
    *   **Publish Version Dialog:** "Publish Version" action opens the standardized dialog for version number and remarks, snapshotting the active draft into a published release.
    *   **Automatic Revision Tracking:** Saving a version automatically appends a new entry to `metadata.revisions[]` with version number, timestamp, OSCAL version, and remarks.
    *   **Version History Menu (`VersionDropdown`):** Integrated header selector listing active Draft and historical published version snapshots with timestamps, remarks, and `useConfirm()` deletion.
    *   **Schema Validation on Save:** Every published version is strictly validated against the official OSCAL Component Definition JSON Schema before persistence ([DD-002](../design_decisions/DD-002_oscal_validation_strategy.md)).

### US 3.19: Back-Matter & Resource Attachments
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** attach supporting resources (documents, diagrams, certificates, external references) to the Component Definition document via the `back-matter` section,  
> **so that** compliance evidence and supplementary documentation are bundled within the OSCAL document.
*   **Acceptance Criteria:**
    *   **Resource Management:** Adding `back-matter.resources[]` entries via `BackMatterEditor` with `uuid`, `title`, `description`, `citation`, `rlinks[]`, and optional `base64` embedded data ([DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md)).
    *   **File Upload:** Uploading files (PDFs, images, certificates, external OSCAL files) either as base64-encoded attachments or external references with `rlink` integrity hashes.
    *   **Cross-Referencing:** Resources in `back-matter` can be referenced from any `link.href` in the document using `#uuid` fragment references (e.g., `href: "#resource-uuid"` with `rel: "proof-of-compliance"`).
    *   **Resource Preview:** Inline preview for common file formats (PDF, images).

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create Document (US 3.1):** Alice navigates to Component Definitions in Reposol, clicks "New Component Definition," enters the title *"Reposol Platform Components,"* and is redirected immediately to the editing view (`/component-definitions/{uuid}?edit=true`).

2.  **Configure Document Metadata (US 3.16):** In the Document Overview, she navigates to the **Metadata** tab (`StandardMetadataTab`), sets `version` to `1.0.0`, adds herself as a party with role `document-author`, and defines document-level properties `marking` and `data-classification` in `metadata.props`.

3.  **Declare First Component (US 3.2, US 3.3):** She clicks "+ Add Component" and creates *AWS Cognito* with type `service`. In the `EntityDetailPanel`, she fills in the description ("Centralized identity and access management service providing OAuth 2.0 / OIDC authentication for the Reposol platform") and purpose ("User authentication and authorization"). *(Status section is absent per OSCAL metaschema).*

4.  **Set Standard Properties (US 3.4):** Using the Standard Property Palette, she toggles `implementation-point` = `external`, `public` = `yes`, `virtual` = `yes`, `allows-authenticated-scan` = `no`, sets `version` = `2.0`, `release-date` = `2026-01-15` (via date picker), and selects `asset-type` = `web-server`.

5.  **Add Custom Properties (US 3.5):** In the `PropsEditor` section, she adds custom properties: `eal-level` = `EAL 4+` and `encryption-algorithms` = `AES-256-GCM`.

6.  **Define Protocols & Ports (US 3.7):** Since Cognito is a `service`, the Protocols section is auto-expanded. She uses the quick-add template for `HTTPS/443/TCP` and adds title "OIDC/OAuth2 Endpoint".

7.  **Declare Additional Components (US 3.2, US 3.3):** She adds *Reposol Backend API* (`type=software`), *PostgreSQL Database* (`type=software`), and *Data Center Frankfurt* (`type=physical`), providing descriptions and purpose fields.

8.  **Link Dependencies (US 3.6):** Using the internal component picker, she adds a link from *Reposol Backend API* to *AWS Cognito* with `rel="uses-service"`, and a dependency to *PostgreSQL Database* with `rel="depends-on"`. Connection badges reflect in the `EntityTable` and detail cards.

9.  **Assign Roles (US 3.8):** On *AWS Cognito*, she selects standard roles `asset-owner` and `asset-administrator`, linking them to the DevOps team party defined in document metadata. On the Backend API, she assigns `maintainer` and `provider`.

10. **Attach Compliance Evidence (US 3.19):** She uploads the AWS Cognito SOC 2 Type II audit report as a back-matter resource and creates a link from the Cognito component with `rel="proof-of-compliance"` targeting `#resource-uuid`.

11. **Create Validation Component (US 3.2, US 3.4):** She creates a *FIPS 140-2 Validation* component with `type="validation"`, filling in `validation-type` = `fips-140-2` and `validation-reference` = `3456` in the Property Palette, and links it to Cognito with `rel="validation"`.

12. **Create Control Implementation Set (US 3.9):** On *AWS Cognito*, she clicks "Add Implementation Set" and uses the **Workspace Source Picker** to select the BSI IT-Grundschutz catalog from `/api/documents/catalogs`. She enters the set description: "AWS Cognito provides built-in identity and access management capabilities aligned with BSI IT-Grundschutz requirements."

13. **Map Implemented Requirements (US 3.10):** Using the **Hierarchical Control Picker**, she searches and bulk-selects `ac-7` (Unsuccessful Logon Attempts) and `ia-5` (Authenticator Management), writing clear implementation narratives for both.

14. **Add Statement-Level Detail (US 3.11):** For `ac-7`, she opens the **Structured Statement Editor** (no JSON textarea) and adds:
    *   `ac-7_smt.a`: "Cognito enforces a maximum of N consecutive invalid login attempts by a user within a configurable time period T."
    *   `ac-7_smt.b`: "Cognito automatically locks the account for a configurable duration and notifies the administrator upon exceeding the threshold."

15. **Set Parameter Defaults (US 3.12):** Using the **Simplified Set-Parameters Editor**, she assigns defaults for `ac-7_prm_1` (max attempts) = `["5"]` and `ac-7_prm_2` (lockout duration) = `["30"]` with rationale remarks.

16. **Group into Capability (US 3.13):** In the Capabilities tab, she creates capability "Identity & Access Management", incorporating *AWS Cognito* and a *Role-Based Access Control Policy* component via the slide-out detail panel.

17. **Import External Definition (US 3.14):** In the Overview, she imports an external vendor component definition describing AWS S3 security capabilities and browses its contents in read-only mode.

18. **Review in EntityTable (US 3.15):** She returns to the Components tab, filters by `type="service"`, checks protocol configurations, and verifies that version and control implementation count columns are populated.

19. **Publish Version (US 3.17, US 3.18):** She toggles the Segmented Mode Toggle to `[ 👁️ View ]` (auto-saving the draft silently), clicks "Publish Version," enters `1.0.0` with remarks "Initial component inventory for Reposol platform," and the document is validated against the OSCAL JSON schema and released with automatic revision tracking.

---

## 3. Functional Requirements for the System

- **OSCAL Component Type Classification:** Support for all 11 standardized OSCAL component types (`software`, `service`, `hardware`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `interconnection`) plus custom free-text types via "Other..." (US 3.2). No invalid SSP types or `status` fields.
- **Component Identity Management:** CRUD operations within `components[]` with required `title` and `description`, optional `purpose` and `remarks`, and live validation preventing empty required fields (US 3.3, [DD-014](../design_decisions/DD-014_live_ui_form_validation.md)).
- **Standard Property Palette:** Dedicated guided UI for OSCAL standard properties with 4 toggle switches (`implementation-point`, `virtual`, `public`, `allows-authenticated-scan`), date picker for `release-date` (`YYYY-MM-DD`), `asset-type` dropdown (12 standard values + custom), conditional software/validation/OS/network sections, and deprecation warning for `hardware-model` (US 3.4).
- **Custom Properties & Metadata:** Free-form `PropsEditor` for custom `props[]` with autocomplete suggestions and clear separation from dynamic parameters (US 3.5, [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md)).
- **Typed Link System:** Inter-component and resource linking with standard `rel` relation types, internal `#uuid` component picker, and back-matter `#resource-uuid` picker (US 3.6).
- **Service Protocol Architecture:** Protocol declaration with `name`, `title`, port range validation (`0 <= start <= end <= 65535`), transport selection (`TCP`/`UDP`), quick-add templates for common presets, and auto-expansion for `service`/`software` types (US 3.7).
- **Organizational Responsibility Binding:** Role assignment with 9 standard OSCAL roles + custom options, party picker from `metadata.parties[]`, and role uniqueness enforcement (US 3.8).
- **Multi-Framework Control Implementation:** Linking components to catalogs/profiles via Workspace Source Picker (US 3.9), hierarchical control picker with bulk selection (US 3.10), structured statement editor with `ProseWithParams` (US 3.11), and simplified value-only set-parameters editor with mandatory empty array purging (US 3.12, [DD-012](../design_decisions/DD-012_parameter_value_assignment_and_override_strategy.md), [DD-014](../design_decisions/DD-014_live_ui_form_validation.md)).
- **Capability Aggregation:** Grouping components into capabilities with `incorporates-components` references and capability-level control implementations in slide-out detail panels (US 3.13, [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md)).
- **External Definition Import:** Support for `import-component-definitions` with URI references, file upload into `back-matter.resources[]`, and read-only browsing (US 3.14).
- **EntityTable Navigation:** Table view with type filtering, full-text search, column sorting, batch deletion with `useConfirm()`, and `EmptyState` CTA (US 3.15, [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md), [DD-032](../design_decisions/DD-032_ui_infrastructure.md)).
- **Document Metadata & Analytics:** `StandardMetadataTab` for document metadata and `metadata.props`, alongside document-type-aware Properties Dashboard analytics (US 3.16, [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md)).
- **Editor UX & Draft Persistence:** Segmented Mode Toggle `[ 👁️ View | ✏️ Edit ]`, backend auto-save `<uuid>_draft.json` every 30s when dirty, edit-mode version locking, and clean draft deletion (US 3.17, [DD-004 §4](../design_decisions/DD-004_editor_ux_patterns.md), [US 0.17](step0_global_requirements.md)).
- **Backend Versioning & Schema Validation:** Snapshot persistence `{uuid}_v{version}.json`, automatic `metadata.revisions[]` tracking, and official OSCAL JSON schema validation on every save (US 3.18, [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md)).
- **Back-Matter Resource Management:** File attachments (base64 and `rlinks`) with citation metadata and internal cross-referencing (US 3.19, [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md)).

---

## 4. Functional Acceptance Criteria (Summary)

- [ ] A Component Definition document can be created with minimal input (title only) and immediately redirects to the editor (`/component-definitions/{uuid}?edit=true`) with a clean document shell (US 3.1).
- [ ] Components can be created, edited, and deleted with all 11 standard OSCAL types plus custom types ("Other..."), without `status` fields or SSP-only types (US 3.2).
- [ ] Component title and description are validated as required fields with live inline feedback in `EntityDetailPanel` (US 3.3).
- [ ] All standard OSCAL properties are assignable via the Standard Property Palette (4 toggles, release-date date picker, asset-type dropdown, conditional software/validation sections, deprecation warning for `hardware-model`) (US 3.4).
- [ ] Custom properties are freely managed in `PropsEditor` with autocomplete suggestions and no tag promotion concept (US 3.5).
- [ ] Typed links between components and resources can be declared with standard OSCAL relation types and internal component/resource pickers (US 3.6).
- [ ] Service protocols with port ranges (`0 <= start <= end <= 65535`, `TCP`/`UDP`) are editable with quick-add templates and auto-expansion for `service` components (US 3.7).
- [ ] Organizational roles with 9 OSCAL standard role IDs and party references can be assigned to components with uniqueness enforcement (US 3.8).
- [ ] Control implementation sets can be created linking components to catalogs/profiles via a Workspace Source Picker (US 3.9).
- [ ] Individual controls can be mapped as implemented requirements with narratives and a hierarchical, searchable control picker with bulk selection (US 3.10).
- [ ] Statement-level implementation detail is managed using a structured statement editor with `ProseWithParams` and empty array purging (US 3.11).
- [ ] Default parameter values are set at implementation set and requirement levels via a simplified value-only editor with mandatory empty array purging (US 3.12).
- [ ] Components can be aggregated into named capabilities with `incorporates-components` references in slide-out detail panels (US 3.13).
- [ ] External OSCAL component definitions can be imported via URI or file upload with schema validation and read-only browsing (US 3.14).
- [ ] An `EntityTable` provides type filtering, full-text search, column sorting, batch deletion with `useConfirm()`, and `EmptyState` CTA (US 3.15).
- [ ] Document Overview renders `StandardMetadataTab` (metadata + `metadata.props`) and Properties Dashboard analytics without a "Tags Tab" or "Promote" button (US 3.16).
- [ ] Persistent Segmented Mode Toggle `[ 👁️ View | ✏️ Edit ]` and backend draft auto-save (`<uuid>_draft.json` every 30s) replace `localStorage` and the "Exit button" (US 3.17).
- [ ] Document versions can be published, loaded, and deleted with automatic revision tracking, edit-mode version locking, and schema validation on save (US 3.18).
- [ ] Back-matter resources can be attached via upload or URL, embedded as base64 or linked via `rlinks`, and cross-referenced from any link (US 3.19).
- [ ] All document payloads serialize without empty arrays (`minItems: 1`), passing `POST /api/validate/component-definitions` with zero schema errors.
