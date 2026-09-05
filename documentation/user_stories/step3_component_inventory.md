# Step 3: Detailed User Stories – Component Definition & Inventory

* **Persona:** Alice (Compliance Officer / Lead Systems & Security Engineer)
* **Goal:** Structured capture and management of all reusable IT security components—software applications, cloud services, operating systems, hardware platforms, network interconnections, organizational policies, and standard procedures—along with their inherent compliance capabilities, technical service protocols, port ranges, parameter defaults, and framework control implementations according to the NIST OSCAL Component Definition Model (v1.2.2). These component definitions serve as authoritative, pre-packaged building blocks that are imported and instantiated into System Security Plans (SSPs) in Stage 4.
* **Lifecycle Position:** Stage 3 in the NIST OSCAL lifecycle (`Catalog` / `Profile` → **`Component Definition`** → `System Security Plan (SSP)` → `Assessment Plan (AP)` → `Assessment Results (AR)` → `POA&M` → `Control Mapping`). Bridges normative security controls with real-world system architecture before system-specific SSP assembly.

---

## 1. Breakdown of User Stories

### US 3.1: Component Definition Document Creation & Minimal Shell
> *Implements [US 0.14](step0_global_requirements.md) with component-definition specific initialization rules.*  
> *References DD-002, DD-014, DD-029, DD-032*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create a new Component Definition document by specifying only a document title in a streamlined dialog and be immediately redirected to the in-place editor (`/component-definitions/{uuid}?edit=true`),  
> **so that** I can rapidly begin declaring modular components without navigating complex preliminary setup wizards.

* **Acceptance Criteria:**
  * **Minimal Creation Dialog:** Clicking "New Component Definition" on `/component-definitions` opens a focused modal requesting only `metadata.title` (required string, non-empty) and optional initial `metadata.version` (defaults to `"1.0.0"`).
  * **Automatic Scaffold Generation:** Upon submission, the backend generates an authoritative document shell strictly conforming to `oscal_component_schema.json` (NIST OSCAL v1.2.2):
    * `component-definition.uuid`: newly minted RFC 4122 v4 UUID.
    * `metadata`: contains `title`, `published` (omitted until first publish), `last-modified` (ISO 8601 UTC timestamp), `version: "1.0.0"`, `oscal-version: "1.2.2"`, and empty arrays for `roles` and `parties`.
    * `components`: initialized as an empty array `[]` (valid at document creation; populated during editing).
    * Optional assemblies (`import-component-definitions`, `capabilities`, `back-matter`) are omitted or pruned prior to save to prevent schema violations.
  * **Direct Redirection & Mode Synchronization:** Alice is immediately redirected to `/component-definitions/{uuid}?edit=true`. The Segmented Mode Toggle defaults to `[ ✏️ Edit ]`, activating authoring controls across all tabs.
  * **View vs. Edit Mode:**
    * In **Edit Mode** (`✏️ Edit`, `?edit=true`): Alice sees prominent action buttons (`➕ Add Component`, `📥 Import Definition`, `💾 Save Draft`), inline editable cards, drag handles, and field deletion controls.
    * In **View Mode** (`👁️ View`): All inputs render as formatted static typography, edit buttons are hidden, and an informational badge displays `Read-Only Snapshot`.
  * **OSCAL Validation Baseline:** The newly initialized document passes schema validation against `reposol/backend/app/schemas/oscal_component_schema.json` via `POST /api/validate/component-definitions` with zero errors.

---

### US 3.2: Component Declaration & Standard OSCAL Type Classification
> *References DD-014, DD-021, DD-031*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create components and categorize them using official NIST OSCAL `defined-component` types or verified custom types,  
> **so that** technical assets, software packages, cloud services, and organizational policies are classified in a machine-readable, standards-compliant taxonomy.

* **Acceptance Criteria:**
  * **Component Creation:** Within the `components` tab, clicking `➕ Add Component` opens the component creation drawer. Each component receives an auto-generated RFC 4122 v4 `uuid` stored in `components[].uuid`.
  * **OSCAL Type Taxonomy:** A guided dropdown offers all 15 standardized OSCAL `defined-component` types recognized by NIST OSCAL v1.2.2:
    * `software` — Commercial software, open-source packages, applications, libraries, microservices, container images.
    * `hardware` — Physical servers, appliances, network devices, workstations.
    * `service` — Cloud managed services (SaaS, PaaS, IaaS), API endpoints, external platforms.
    * `policy` — Formal organizational policies and governance directives.
    * `physical` — Facilities, data center rooms, physical enclosures, biometric turnstiles.
    * `process-procedure` — Documented standard operating procedures (SOPs), runbooks, deployment guides.
    * `plan` — Formal plans (e.g., Disaster Recovery Plan, Incident Response Plan).
    * `guidance` — Security guidelines, implementation advisories, developer handbooks.
    * `standard` — Technical configuration standards, hardening benchmarks (e.g., CIS Benchmarks).
    * `validation` — Independent certifications and evaluation reports (e.g., FIPS 140-3, Common Criteria).
    * `interconnection` — Dedicated network links, VPN tunnels, cross-connect circuits between security boundaries.
  * **Custom Types ("Other..."):** Selecting "Other..." enables a free-text input for custom strings conforming to OSCAL `allow-other="yes"`. The system warns if the user attempts to enter SSP-exclusive types (`this-system` or `system`), explaining that those types are reserved for Stage 4 System Security Plans.
  * **Strict Metaschema Enforcement — No Status Field:** The component editor adheres strictly to the NIST OSCAL v1.2.2 Metaschema rule: **`status` is strictly forbidden on `defined-component`**. The UI contains no `status` inputs or states for Stage 3 components (`status` belongs exclusively to SSP `system-component` in Stage 4). Attempting to inject a `status` field triggers an immediate schema validation error.
  * **Type-Driven UI Adaptations:**
    * When `type="service"` or `type="software"`: The Protocols & Port Ranges card (US 3.7) auto-expands and highlights as recommended.
    * When `type="validation"`: The Property Palette emphasizes `validation-type` and `validation-reference` properties.
    * When `type="software"`: The Property Palette emphasizes `software-identifier` (CPE/SWID) and `software-version`.
  * **Badge Styling & Visualization:** In both View and Edit modes, components display distinct color-coded badges:
    * Blue chip for `software` and `service`.
    * Slate gray chip for `hardware` and `physical`.
    * Emerald chip for `policy`, `plan`, and `process-procedure`.
    * Amber chip for `validation` and `interconnection`.

---

### US 3.3: Component Core Identity Fields (Title, Description, Purpose, Remarks)
> *References DD-014, DD-021*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** specify the title, description, operational purpose, and remarks for each component,  
> **so that** every architectural asset has comprehensive, human-readable documentation of its operational role and security boundary.

* **Acceptance Criteria:**
  * **Title (`title`, required, `markup-line`):** Single-line rich input for the component's name (e.g., `"PostgreSQL Relational Database Server"`). Displayed as the primary heading in the component detail panel and in the `EntityTable`.
  * **Description (`description`, required, `markup-multiline`):** Multi-line markdown editor detailing the component's technical architecture, deployment topology, and core functionality.
  * **Purpose (`purpose`, optional, `markup-line`):** Concise statement summarizing why this component exists within the system architecture (e.g., `"Persistent relational data store for customer identity and transaction records."`).
  * **Remarks (`remarks`, optional, `markup-multiline`):** Supplementary commentary, operational caveats, or maintenance notes.
  * **Live Validation Feedback:** If `title` or `description` is blank in Edit Mode, the editor renders red outline borders and inline error text (`"Title is required by OSCAL schema"`), disabling the Save button until resolved per DD-014.
  * **View vs. Edit Display:**
    * In **Edit Mode**: Input fields provide rich text editing, character counters, and markdown syntax previews.
    * In **View Mode**: Rendered as sanitized HTML typography with markdown tables and bulleted lists.

---

### US 3.4: Standard OSCAL Component Property Palette
> *References DD-011, DD-014*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** configure standardized OSCAL component properties (`props[]`) using dedicated switches, dropdowns, and date pickers,  
> **so that** core technical characteristics are machine-readable and conform to the official NIST OSCAL namespace.

* **Acceptance Criteria:**
  * **Guided Property Palette:** The Component Editor provides a standardized "Property Palette" organized into four ergonomic card sections:
    1. **Architecture & Deployment Switches (Toggles):**
       * `implementation-point`: Toggle between `internal` (inside system perimeter) and `external` (third-party managed). Serialized as `{ "name": "implementation-point", "value": "internal" | "external", "ns": "http://csrc.nist.gov/ns/oscal" }`.
       * `virtual`: Toggle between `yes` (virtual machine, container, cloud resource) and `no` (bare-metal physical).
       * `public`: Toggle between `yes` (internet-facing endpoint) and `no` (private RFC 1918 subnet only).
       * `allows-authenticated-scan`: Toggle between `yes` and `no` indicating automated vulnerability scanner access.
    2. **Release & Versioning Details:**
       * `version`: Version string (e.g., `"15.4"`).
       * `patch-level`: Security patch designation (e.g., `"cumulative-update-202603"`).
       * `release-date`: Interactive date picker enforcing strict `YYYY-MM-DD` ISO format (`oscal-component-release-date-value-datatype`).
       * `model`: Hardware or appliance model designation (e.g., `"PowerEdge R750"`).
       * **Deprecation Notice:** If Alice selects legacy `hardware-model`, the UI displays an amber warning banner: *"hardware-model is deprecated in OSCAL v1.2.2; use model instead"* and offers an "Auto-Migrate to model" action.
    3. **Asset Classification & Identifiers:**
       * `asset-type`: Guided dropdown containing the 12 official OSCAL asset classifications: `operating-system`, `database`, `web-server`, `dns-server`, `email-server`, `directory-server`, `pbx`, `firewall`, `router`, `switch`, `storage-array`, `appliance`, plus custom value entry.
       * `asset-id`: Organizational asset inventory identifier (e.g., `"ASSET-DB-094"`).
       * `asset-tag`: Physical or CMDB barcode tag (e.g., `"TAG-CORP-48921"`).
    4. **Software & Validation Identifiers:**
       * `software-identifier`: Machine-readable Common Platform Enumeration (CPE 2.3) or SWID tag (e.g., `"cpe:2.3:a:postgresql:postgresql:15.4:*:*:*:*:*:*:*"`).
       * `validation-type`: For `type="validation"`, dropdown offering `fips-140-2`, `fips-140-3`, `common-criteria`, `fedramp`.
       * `validation-reference`: Certificate number or National Information Assurance Partnership (NIAP) reference.
  * **Namespace & Empty Array Discipline:** All palette properties automatically receive `ns: "http://csrc.nist.gov/ns/oscal"`. Properties with empty values are pruned from `components[].props[]` prior to serialization, preventing schema validation rejections.

---

### US 3.5: Custom Properties & Free-Form Metadata Management
> *Implements [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md) and [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** define arbitrary custom properties on components with full control over name, value, namespace, and classification,  
> **so that** organization-specific compliance metadata, tags, and operational constraints are preserved without violating schema rules.

* **Acceptance Criteria:**
  * **Custom Property Editor (`PropsEditor`):** In the "Custom Properties" tab of the component editor, Alice can add, edit, reorder, and remove `props[]` entries:
    * `name` (required, `token`): Property key (e.g., `"eal-level"`, `"encryption-at-rest"`, `"fips-mode"`). Autocomplete suggestions populated via `datalist` from existing workspace properties.
    * `value` (required, string): Property value (e.g., `"EAL 4+"`, `"AES-256-XTS"`, `"enabled"`).
    * `ns` (optional, URI): Organizational namespace URI (defaults to `http://csrc.nist.gov/ns/oscal` if omitted; custom e.g., `https://reposol.io/ns/custom`).
    * `class` (optional, `token`): Sub-classification categorization.
    * `group` (optional, `token`): Grouping identifier for clustering related properties.
    * `remarks` (optional, `markup-multiline`): Justification or context for the property.
  * **No Tag Promotion:** In strict adherence to DD-011, properties defined on components remain scoped exclusively to the component; there is no "Tag Promotion" concept in Component Definitions.
  * **Dirty State Tracking:** Modifying any custom property marks the document dirty (`isDirty = true`) and initiates local draft caching.

---

### US 3.6: Component Links & Dependency Declarations
> *References DD-014, DD-021*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** declare typed links between components and to external resources,  
> **so that** architectural dependency chains, data consumption relations, and evidence citations are formally documented.

* **Acceptance Criteria:**
  * **Link Declaration:** Adding `links[]` entries on a component with:
    * `href` (required, `uri-reference`): Target reference. Supports:
      * Internal component fragment (e.g., `"#comp-keycloak-auth"`).
      * Back-matter resource fragment (e.g., `"#res-fips-cert-3456"`).
      * Relative workspace reference (e.g., `"../catalogs/nist-sp-800-53-r5.json"`).
      * Absolute URI (e.g., `"https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"`).
    * `rel` (optional, `token`): Dropdown with official OSCAL relationship types:
      * `depends-on` — Component requires the target component to function (e.g., Web App depends on Database).
      * `uses-service` — Component consumes the target service (e.g., Application uses Keycloak IAM).
      * `uses-network` — Component traverses the target network/interconnection.
      * `validation` — Component is evaluated or certified by the target validation record.
      * `proof-of-compliance` — Component cites external audit evidence or artifact.
      * `baseline-template` — Link to an upstream component baseline.
      * `provided-by` / `used-by` — Service provider / consumer relationships.
      * Custom string option for enterprise relationship types.
    * `media-type` (optional, string): MIME type of the destination (e.g., `"application/pdf"`, `"application/json"`).
    * `text` (optional, `markup-line`): Human-readable link label.
  * **Internal Target Picker:** In Edit Mode, clicking the target selector displays a modal listing all other components defined within the current document, automatically inserting the `#<component-uuid>` fragment.
  * **Visual Dependency Graph:** In View Mode, components linked via `rel="depends-on"` or `rel="uses-service"` display interactive relationship chips that deep-link to the target component's card.

---

### US 3.7: Service Protocols & Port Range Declarations
> *References DD-014, DD-031*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** document the network service protocols, transport layers, and port ranges for software and service components,  
> **so that** network attack surfaces, cryptographic endpoints, and firewall requirements are explicitly captured for compliance reviews.

* **Acceptance Criteria:**
  * **Protocol Definition (`protocols[]`):** Adding protocol entries with:
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `name` (required, string): Protocol token (e.g., `"https"`, `"ssh"`, `"postgresql"`, `"tls"`, `"grpc"`).
    * `title` (optional, `markup-line`): Human-readable protocol title (e.g., `"PostgreSQL Database Wire Protocol over TLS 1.3"`).
  * **Port Range Configuration (`port-ranges[]`):** Each protocol supports multiple port range entries with:
    * `start` (required, non-negative integer): Minimum port number (0–65535).
    * `end` (required, non-negative integer): Maximum port number (0–65535). For single ports, `start === end` (e.g., `5432` to `5432`).
    * `transport` (required, enum): Dropdown strictly enforcing the two valid OSCAL transport values: `TCP` | `UDP`.
  * **Live Validation Constraints:**
    * Validates that `0 <= start <= 65535` and `0 <= end <= 65535`.
    * Validates that `start <= end`. If `start > end`, the UI highlights the inputs in red and renders: `"Start port cannot exceed end port"`.
    * Schema enforces transport is exactly `"TCP"` or `"UDP"`; lower-case values (`"tcp"`) are automatically uppercased before save.
  * **Quick-Add Protocol Presets:** In Edit Mode, Alice can click quick-add buttons to auto-populate common protocols:
    * `HTTPS`: name `"https"`, start `443`, end `443`, transport `TCP`.
    * `SSH`: name `"ssh"`, start `22`, end `22`, transport `TCP`.
    * `PostgreSQL`: name `"postgresql"`, start `5432`, end `5432`, transport `TCP`.
    * `DNS`: name `"dns"`, start `53`, end `53`, transport `UDP`.
  * **Empty Array Stripping:** If a protocol has no port ranges, or if the component has no protocols, the empty arrays are pruned before saving to satisfy `minItems: 1` constraints.

---

### US 3.8: Responsible Role & Party Assignment
> *References DD-014, DD-021*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** assign responsible operational and maintenance roles to components,  
> **so that** ownership, operational accountability, and incident escalation contacts are unambiguously defined.

* **Acceptance Criteria:**
  * **Role Assignment (`responsible-roles[]`):** Adding role assignments on a component with:
    * `role-id` (required, `token`): Identifier of the assigned role. Dropdown offers official OSCAL standard component roles:
      * `asset-owner` — Organizational owner accountable for component lifecycle.
      * `asset-administrator` — Technical administrator managing configuration.
      * `security-operations` — SOC team monitoring logs and alerts.
      * `network-operations` — NetOps team managing connectivity and firewalls.
      * `incident-response` — Primary contact for security incidents involving this asset.
      * `maintainer` — Team responsible for patching and software updates.
      * `provider` — Vendor or third-party cloud service provider.
      * Custom role entry supported.
    * `party-uuids[]` (optional, array of UUIDs): Multi-select picker referencing parties declared in `component-definition.metadata.parties[]`.
    * `props[]`, `links[]`, `remarks` (optional): Supplementary assignment metadata.
  * **Role Uniqueness Enforcement:** OSCAL Metaschema constraint `oscal-unique-component-definition-responsible-role`: each `role-id` can appear at most once per component. The UI prevents duplicate assignments of the same `role-id` on a single component.
  * **Party Resolution in View Mode:** In View Mode, party UUIDs are resolved to the party's human name, email address, and organization from `metadata.parties[]`.

---

### US 3.9: Control Implementation Sets & Source Framework Binding
> *References DD-003, DD-014, DD-028*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create control implementation sets that link components to source compliance frameworks (Catalogs or Profiles),  
> **so that** the component's out-of-the-box compliance coverage is documented against specific regulatory standards.

* **Acceptance Criteria:**
  * **Control Implementation Set (`control-implementations[]`):** Each component can define one or more implementation sets containing:
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `source` (required, `uri-reference`): URI pointing to the target Catalog or Profile (e.g., `"../catalogs/nist-sp-800-53-r5.json"`, `"https://csrc.nist.gov/oscal/catalogs/nist-sp-800-53-r5.json"`).
    * `description` (required, `markup-multiline`): Narrative explaining how the component implements controls from the specified framework.
    * `props[]`, `links[]`, `set-parameters[]` (optional): Set-level metadata and parameter defaults.
    * `implemented-requirements[]` (required array, `minItems: 1`): List of satisfied controls.
  * **Workspace Source Document Picker:** In Edit Mode, clicking "Select Framework Source" opens a workspace modal querying `GET /api/documents/catalogs` and `GET /api/documents/profiles`. Selecting a document automatically populates `source` with the relative path and extracts the framework title and control inventory.
  * **Multi-Framework Flexibility:** A single component (e.g., Keycloak) can have multiple `control-implementations` sets: one implementing NIST SP 800-53 Rev 5, another implementing BSI IT-Grundschutz, and a third implementing ISO/IEC 27001:2022.
  * **Source Existence Verification (DISC-03 Resolution):** The system validates that `source` points to an existing workspace catalog/profile or a valid remote URI. If the referenced file is missing, an amber warning badge indicates `"Unresolved framework source"`.

---

### US 3.10: Implemented Requirements & Hierarchical Control Mapping
> *References DD-014, DD-030*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** map specific security controls from the referenced framework to the component and document their implementation narratives,  
> **so that** auditors and downstream SSP builders know exactly which requirements are fulfilled by this asset.

* **Acceptance Criteria:**
  * **Implemented Requirement Creation (`implemented-requirements[]`):** Each requirement entry requires:
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `control-id` (required, `token`): Matching a valid control in the source framework (e.g., `"ac-2"`, `"ac-7"`, `"ia-5"`, `"sc-8"`).
    * `description` (required, `markup-multiline`): Comprehensive narrative describing how the component natively satisfies the control.
  * **Hierarchical Control Picker:** In Edit Mode, clicking `➕ Add Control Requirement` launches the Hierarchical Control Picker:
    * Queries the backend tree resolver (`GET /api/resolve/tree/{stage}/{docId}`) for the referenced source framework.
    * Renders controls organized by family (e.g., AC, AU, IA, SC) with real-time text search for control ID and title.
    * Allows **bulk selection** of multiple controls; submitting adds all selected controls with initial scaffolded descriptions.
  * **Control ID Integrity Verification (DISC-03 Resolution):** The editor verifies that entered `control-id` values actually exist in the referenced `source`. If Alice manually types an invalid ID (e.g., `"xx-99"`), an inline validation warning flags `"Control xx-99 not found in source framework"`.
  * **Control Requirement Uniqueness:** Within a given `control-implementations` set, each `control-id` can appear at most once. Attempting to add a duplicate control prompts the user to edit the existing requirement.

---

### US 3.11: Structured Statement-Level Implementation Narratives
> *Implements [DD-013](../design_decisions/DD-013_universal_prose_with_params_integration.md) and [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** break down control implementations into structured sub-statement narratives (`statements[]`),  
> **so that** multi-part security controls (e.g., `ac-7` part a and part b) are documented with sub-requirement precision.

* **Acceptance Criteria:**
  * **Structured Statement Editor (`statements[]`):** Under each implemented requirement, Alice can add individual statement items:
    * `statement-id` (required, `token`): Identifier of the statement sub-part (e.g., `"ac-7_smt_a"`, `"ac-7_smt_b"`).
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `description` (required, `markup-multiline`): Fine-grained implementation narrative using `ProseWithParams`.
    * `props[]`, `links[]`, `remarks` (optional): Statement-specific metadata.
  * **Guided Statement Picker:** When the parent control contains structured statement parts in the source catalog, the editor displays a dropdown of valid statement tokens (e.g., `a.`, `b.`, `c.`), automatically populating `statement-id`.
  * **Metaschema Uniqueness Rule:** Enforces `oscal-unique-component-definition-implemented-requirement-statement`: each `statement-id` appears at most once per implemented requirement.
  * **Empty Array Stripping:** Requirements with no sub-statements omit the `statements` key completely prior to serialization to avoid `minItems: 1` schema failures.

---

### US 3.12: Component Parameter Defaults (Simplified Set-Parameters)
> *Implements [DD-012](../design_decisions/DD-012_parameter_value_assignment_and_override_strategy.md) and [DD-014](../design_decisions/DD-014_live_ui_form_validation.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** establish default parameter values (`set-parameters[]`) on component control implementations,  
> **so that** pre-configured technical thresholds (e.g., session timeout, lockout duration) ship with the component and feed into Stage 4 SSP parameter cascade resolution.

* **Acceptance Criteria:**
  * **Simplified Value-Only Editor (DD-012):** Parameter defaults are managed using a streamlined key-value table:
    * `param-id` (required, `token`): Matching a parameter declared in the source framework (e.g., `"ac-7_prm_1"`).
    * `values` (required array of strings, `minItems: 1`): One or more default values (e.g., `["3"]` for invalid login attempts, `["15 minutes"]` for lockout duration).
    * `remarks` (optional, `markup-multiline`): Rationale for the chosen default.
  * **Dual-Level Placement:**
    * Set-Level: Defined in `control-implementations[].set-parameters[]` (applies framework-wide across all requirements).
    * Requirement-Level: Defined in `implemented-requirements[].set-parameters[]` (overrides set-level for that specific control).
  * **Guided Parameter Autocomplete:** Typing in `param-id` provides autocomplete suggestions from parameters defined in the source catalog/profile.
  * **Parameter Value Enforcement:** Prevents empty string values and strips empty `set-parameters` arrays before saving.

---

### US 3.13: Capability Packaging & Component Aggregation
> *References DD-021, DD-031*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** group related components into named capabilities (`capabilities[]`) representing composite security functions,  
> **so that** complex multi-component systems (e.g., "Zero Trust Identity Architecture") can be packaged and documented as a unified capability.

* **Acceptance Criteria:**
  * **Capability Declaration (`capabilities[]`):** In the "Capabilities" tab, Alice can create capability packages with:
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `name` (required, string): Descriptive capability title (e.g., `"Enterprise Identity & Access Management (IAM)"`).
    * `description` (required, `markup-multiline`): Architectural narrative detailing how the integrated components work together.
  * **Incorporating Components (`incorporates-components[]`):**
    * `component-uuid` (required, UUID): Reference to a component defined in the same document's `components[]` array.
    * `description` (required, `markup-multiline`): Description of the specific role this component plays within the capability.
  * **Referential Integrity Validation:** The system validates that `component-uuid` resolves to an existing component in `components[]`. If a component is deleted, the capability highlights the dangling reference in red.
  * **Capability-Level Control Implementations:** Capabilities support their own `control-implementations[]` array, allowing compliance narratives for composite capabilities that cannot be attributed to a single component alone.

---

### US 3.14: External Component Definition Import & Federation
> *References DD-016, DD-028*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** declare imports of external OSCAL component definitions (`import-component-definitions[]`),  
> **so that** vendor-provided component templates (e.g., AWS, Microsoft, Red Hat OSCAL libraries) can be linked into our enterprise repository.

* **Acceptance Criteria:**
  * **Import Declaration:** Adding `import-component-definitions[]` entries with:
    * `href` (required, `uri-reference`): Absolute URL (e.g., `"https://raw.githubusercontent.com/usnistgov/oscal-content/master/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_components.json"`), relative workspace path, or `#uuid` back-matter resource reference.
  * **Multi-Format Upload:** Alice can upload an external component definition JSON/YAML file directly, which is saved as a workspace artifact or embedded in `back-matter.resources[]`.
  * **Read-Only Inspection:** Clicking on an imported component definition displays its components and capabilities in a read-only drawer, allowing Alice to inspect vendor claims without mutating external files.

---

### US 3.15: Component Inventory Table & List Navigation (EntityTable)
> *Implements [US 0.18](step0_global_requirements.md) and [DD-021](../design_decisions/DD-021_entity_list_detail_editor_pattern.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** view and filter all components in a rich, sortable `EntityTable`,  
> **so that** I can rapidly locate components by type, protocol, or implementation status in large enterprise catalogs.

* **Acceptance Criteria:**
  * **Structured EntityTable Columns:**
    * **Title & Purpose:** Component `title` and first line of `purpose` or `description`.
    * **Type Badge:** Color-coded chip indicating component `type`.
    * **Protocols & Ports:** Summary pill displaying active protocols (e.g., `HTTPS (443)`, `SSH (22)`).
    * **Framework Coverage:** Counter showing number of control implementation sets and implemented requirements (e.g., `NIST SP 800-53 (18 controls)`).
    * **Actions:** Edit (`✏️`), Duplicate (`📋`), and Delete (`🗑️`) buttons.
  * **Real-Time Filtering & Search:**
    * Search bar filters dynamically across title, description, purpose, and property values.
    * Type filter multi-select dropdown allows isolating specific types (e.g., `service`, `software`).
  * **Batch Deletion with Confirmation:** Selecting multiple rows enables "Delete Selected". Deletion requires confirmation via `useConfirm()` dialog per DD-032.

---

### US 3.16: Document Metadata & Analytics Dashboard
> *Implements [US 0.16](step0_global_requirements.md) and [DD-011](../design_decisions/DD-011_properties_vs_parameters_separation.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** maintain document metadata, revision history, and inspect inventory analytics,  
> **so that** document provenance is tracked and repository health metrics are visible at a glance.

* **Acceptance Criteria:**
  * **Standard Metadata Tab:** Manages `metadata.title`, `metadata.version`, `metadata.last-modified`, `metadata.roles[]`, `metadata.parties[]`, and `metadata.remarks`.
  * **Properties Dashboard:** Visualizes document metrics:
    * Total Components count categorized by type (pie/bar chart).
    * Total Implemented Controls across all frameworks.
    * Network Service count and open port distributions.
    * Unique metadata properties assigned.

---

### US 3.17: Dual-Mode Editor Dynamics & Action Reducer Integration
> *Implements [DD-004](../design_decisions/DD-004_editor_ux_patterns.md), [DD-029](../design_decisions/DD-029_document_actions_pattern.md), and [US 0.17](step0_global_requirements.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** toggle smoothly between View and Edit modes with automatic draft persistence and full document action reducer integration,  
> **so that** my work is safeguarded against accidental loss and all mutations follow the centralized DD-029 architecture.

* **Acceptance Criteria:**
  * **Segmented Mode Toggle (`[ 👁️ View | ✏️ Edit ]`):** Located in the top navigation bar. Toggling instantly switches state and updates URL query param (`?edit=true`).
  * **Centralized Document Actions (DISC-07 Resolution):** All mutations in `ComponentPage.tsx` and child editors MUST dispatch action creators defined in `component-definition-actions.ts` (e.g., `addComponent`, `updateComponent`, `deleteComponent`, `addControlImplementation`, `addImplementedRequirement`, `addProtocol`, `setParameters`). Direct draft mutations bypassing DD-029 are strictly forbidden.
  * **Backend Draft Persistence (`useDraft`):** While in Edit Mode with unsaved modifications, the editor auto-saves a draft snapshot to `component-definitions/<uuid>_draft.json` every 30 seconds. A subtle status badge indicates `"Draft saved at HH:MM:SS"`.
  * **Unsaved Changes Warning:** Navigating away from an edited document with unsaved changes triggers a browser prompt preventing accidental navigation.

---

### US 3.18: Immutable Versioning & Official Schema Validation
> *Implements [US 0.15](step0_global_requirements.md) and [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** publish immutable version snapshots with automatic schema validation and revision history tracking,  
> **so that** formal releases of our component library are audit-proof and locked against tampering.

* **Acceptance Criteria:**
  * **Publish Version Dialog:** In Edit Mode, clicking "Publish Version" opens a dialog prompting for `version` (semantic version string, e.g., `"1.1.0"`) and `remarks` (release notes).
  * **Validation Gate:** The backend executes validation against `oscal_component_schema.json` via `POST /api/validate/component-definitions`. If errors exist, publishing is aborted and errors are displayed in the Validation Drawer.
  * **Revision History Tracking:** Upon successful publish:
    * An entry is prepended to `metadata.revisions[]` containing `version`, `published` (UTC ISO timestamp), `last-modified`, and `remarks`.
    * A permanent immutable snapshot is stored in the workspace as `{uuid}_v{version}.json`.
    * The editor deletes `<uuid>_draft.json` and switches the UI to View Mode.
  * **Version History Drawer:** Users can browse previous versions in read-only mode to review changes over time.

---

### US 3.19: Back-Matter Resource Attachments & Evidence Linking
> *Implements [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md).*  
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** attach supporting certificates, architecture diagrams, and vendor documents in `back-matter.resources[]`,  
> **so that** compliance evidence is bundled directly with the component definitions.

* **Acceptance Criteria:**
  * **Resource Attachment Management:** In the "Back-Matter" tab, Alice can add resources with:
    * `uuid` (required, auto-generated RFC 4122 v4 UUID).
    * `title` (required, string): E.g., `"FIPS 140-3 Cryptographic Module Validation Certificate"`.
    * `description` (optional, `markup-multiline`).
    * **Embedded Base64 (files ≤ 2MB):** Client-side `FileReader` encodes uploaded files (PDF, PNG, SVG, JSON) directly into `resource.base64.value` with `filename` and `media-type`.
    * **External Reference (`rlinks[]`, files > 2MB):** External URL with optional cryptographic hash (`SHA-256`, `SHA-512`).
  * **Cross-Referencing:** Any link on a component, protocol, or requirement can reference a resource via `#<resource-uuid>`. In View Mode, clicking the link opens the attachment preview modal.

---

### US 3.20: Downstream SSP Import Handshake & Preservation (DISC-01 & DISC-02 Resolution)
> *References DD-016, DD-028, DD-036*  
> **As a** Compliance Officer and System Owner (Alice)  
> **I want to** import component definitions into System Security Plans (Stage 4) with 100% preservation of control implementations, narratives, and parameter defaults,  
> **so that** security engineering work performed in Stage 3 seamlessly transfers into system authorization plans without manual data re-entry.

* **Acceptance Criteria:**
  * **Full Control Implementation Preservation (DISC-01 Resolution):** When a component is imported from Stage 3 into an SSP in Stage 4:
    * The SSP component receives all metadata, properties, protocols, and links.
    * Crucially, all `control-implementations[].implemented-requirements[]` defined on the Stage 3 component are mapped directly into the SSP's `control-implementation.implemented-requirements[].by-components[]` entries.
    * Statement narratives (`statements[].description`) and parameter default overrides (`set-parameters[]`) defined in Stage 3 are preserved in full.
  * **Source Provenance Link Tracking (DISC-02 Resolution):** The imported component in the SSP retains an explicit provenance link:
    * `{ "rel": "imported-from", "href": "../component-definitions/{cdef-uuid}.json#component-{cdef-comp-uuid}" }`.
    * This guarantees traceability between the instantiated system component in Stage 4 and its golden template in Stage 3.
  * **Status Lifecycle Injection:** Because `status` is forbidden on Stage 3 `defined-component` but required on Stage 4 `system-component`, the import handshake automatically injects `{ "status": { "state": "operational" } }` upon instantiation into the SSP.

---

## 2. Practitioner's Detailed Workflow & User Journey

### Persona
**Alice (Compliance Officer & Lead Systems Engineer)**, building the enterprise component repository for the Reposol Cloud Platform.

### Chronological Step-by-Step Narrative

1. **Document Initialization (US 3.1):**
   * Alice navigates to `/component-definitions` and clicks `➕ New Component Definition`.
   * She enters Title: `"Reposol Cloud Platform Component Catalog"`, initial Version: `"1.0.0"`.
   * She clicks "Create Document"; the backend provisions document `uuid: "cdef-8812-4f1a-b021-9988aa112233"`.
   * Alice is redirected to `/component-definitions/cdef-8812-4f1a-b021-9988aa112233?edit=true`. The Segmented Mode Toggle displays `[ ✏️ Edit ]`.

2. **Metadata & Organizational Ownership (US 3.16):**
   * Under the **Metadata** tab, Alice enters remarks: `"Production component inventory and security capabilities library for enterprise SaaS services."`.
   * In `roles`, she registers `role-id: "asset-owner"`, `title: "Cloud Infrastructure Lead"`.
   * In `parties`, she creates an organization party: `name: "Reposol Security Engineering"`, `email-addresses: ["security@reposol.io"]`.
   * She assigns the role in `responsible-parties`.

3. **Declaring Core Software Components (US 3.2, US 3.3):**
   * Alice switches to the **Components** tab and clicks `➕ Add Component`.
   * **Component 1 (Database):**
     * `title`: `"PostgreSQL Relational Database Engine"`
     * `type`: `"software"`
     * `purpose`: `"Primary transactional data store managing tenant configurations, audit events, and user profiles."`
     * `description`: `"PostgreSQL v15.4 running in high-availability streaming replication mode with WAL archiving to encrypted S3 buckets."`
     * She notes that no `status` field is present or requested, conforming to OSCAL metaschema constraints.

4. **Configuring Standard Properties (US 3.4, US 3.5):**
   * In the **Property Palette** for PostgreSQL:
     * Architecture switches: `implementation-point: "internal"`, `virtual: "yes"`, `public: "no"`, `allows-authenticated-scan: "yes"`.
     * Versioning: `version: "15.4"`, `release-date: "2023-08-10"`.
     * Asset classification: `asset-type: "database"`.
     * Software identifier: `software-identifier: "cpe:2.3:a:postgresql:postgresql:15.4:*:*:*:*:*:*:*"`.
   * In **Custom Properties**, Alice adds:
     * `name: "encryption-at-rest"`, `value: "AES-256-XTS"`, `ns: "https://reposol.io/ns/security"`.
     * `name: "tls-version"`, `value: "TLSv1.3"`.

5. **Configuring Service Protocols & Port Ranges (US 3.7):**
   * Under **Protocols & Port Ranges**, Alice clicks the preset button `PostgreSQL / 5432 / TCP`.
   * The editor populates:
     * `name`: `"postgresql"`
     * `title`: `"PostgreSQL Wire Protocol over Mutual TLS"`
     * `port-ranges`: `[{ "start": 5432, "end": 5432, "transport": "TCP" }]`.
   * She adds an auxiliary Prometheus metrics endpoint:
     * `name`: `"http-metrics"`, `port-ranges`: `[{ "start": 9187, "end": 9187, "transport": "TCP" }]`.

6. **Declaring Identity Management Service (US 3.2, US 3.6):**
   * Alice adds a second component:
     * `title`: `"Keycloak Identity & Access Management Service"`
     * `type`: `"service"`
     * `purpose`: `"Centralized OAuth2 / OpenID Connect identity provider handling MFA and SSO."`
     * `description`: `"Keycloak v23 clustered deployment providing identity federation and token generation."`
   * Protocols: `HTTPS / 443 / TCP` (`start: 443`, `end: 443`, `transport: "TCP"`).
   * In **Links**, Alice creates a dependency link:
     * `href`: `"#comp-postgres-uuid"`, `rel`: `"depends-on"`, `text`: `"Persists user accounts and session state to PostgreSQL"`.

7. **Binding Framework Sources & Control Implementations (US 3.9, US 3.10):**
   * On the **Keycloak** component, Alice navigates to **Control Implementations** and clicks `➕ Add Framework Source`.
   * Using the **Workspace Source Document Picker**, she selects the NIST SP 800-53 Rev 5 Catalog (`../catalogs/nist-sp-800-53-r5.json`).
   * The system populates `source` and Alice enters the implementation set description: `"Keycloak provides turnkey technical enforcement for access control and authentication requirements."`.
   * She clicks `➕ Add Controls` and uses the **Hierarchical Control Picker** to search and bulk-select:
     * `ac-2` (*Account Management*)
     * `ac-7` (*Unsuccessful Logon Attempts*)
     * `ia-5` (*Authenticator Management*)

8. **Authoring Structured Statements & Parameter Defaults (US 3.11, US 3.12):**
   * For control `ac-7` (*Unsuccessful Logon Attempts*), Alice configures:
     * Overall narrative: `"Keycloak enforces automatic brute-force lockout rules configured in the realm authentication flow."`.
     * **Statement Breakdown:**
       * `statement-id: "ac-7_smt_a"`: `"Keycloak automatically detects consecutive invalid password submissions per realm policy."`.
       * `statement-id: "ac-7_smt_b"`: `"Upon reaching threshold, the user account is locked for duration T and security alerts are emitted."`.
     * **Parameter Defaults (`set-parameters`):**
       * `param-id: "ac-7_prm_1"` (max invalid attempts), `values: ["3"]`.
       * `param-id: "ac-7_prm_2"` (lockout duration), `values: ["15 minutes"]`.

9. **Packaging an Operational Capability (US 3.13):**
   * Alice switches to the **Capabilities** tab and clicks `➕ Add Capability`.
   * `name`: `"Zero Trust Identity & Access Architecture"`
   * `description`: `"Unified identity federation, role-based access control, and credential management."`
   * She incorporates:
     * Keycloak IAM (`component-uuid: <keycloak-uuid>`, description: `"Authentication broker and token issuer"`).
     * PostgreSQL DB (`component-uuid: <postgres-uuid>`, description: `"Credential directory and session store"`).

10. **Evidence Attachment in Back-Matter (US 3.19):**
    * In the **Back-Matter** tab, Alice uploads the Keycloak FIPS evaluation certificate (`keycloak-fips-cert.pdf`).
    * The system encodes the 145 KB file to Base64 in `back-matter.resources[0].base64`.
    * On Keycloak, she adds a link: `href: "#" + resource_uuid`, `rel: "validation"`.

11. **Verification & Draft Auto-Save (US 3.17):**
    * Alice works for 20 minutes. Background auto-save writes to `component-definitions/cdef-8812-4f1a-b021-9988aa112233_draft.json` every 30 seconds.
    * She toggles to `[ 👁️ View ]` mode to inspect the formatted catalog cards, visual dependency pills, and protocol summaries.

12. **Immutable Version Release (US 3.18, US 3.20):**
    * Satisfied, Alice clicks `🚀 Publish Version`.
    * She enters Version: `"1.0.0"`, Remarks: `"Baseline enterprise component catalog for Reposol Cloud Services."`.
    * The backend runs schema validation against `oscal_component_schema.json` (0 errors), creates `metadata.revisions` entry, saves immutable snapshot `cdef-8812-4f1a-b021-9988aa112233_v1.0.0.json`, and deletes the working draft.
    * The component library is now ready for seamless, lossless import into Stage 4 System Security Plans!

---

## 3. Functional Requirements for the System

- **OSCAL Component Metaschema Compliance:** Strict enforcement of the NIST OSCAL v1.2.2 Component Definition schema. Components MUST NOT contain `status` or SSP-exclusive types (`this-system`, `system`) (US 3.1, US 3.2).
- **Comprehensive Component Taxonomy:** Full support for all 15 standardized OSCAL component types (`software`, `hardware`, `service`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `interconnection`, etc.) and open custom type extensibility (US 3.2).
- **Core Identity & Rich Prose Editing:** Mandatory `title` and `description` with live required-field validation; optional single-line `purpose` and multi-line `remarks` (US 3.3).
- **Standardized Property Palette:** Guided form controls for OSCAL standard properties (`implementation-point`, `virtual`, `public`, `allows-authenticated-scan`, `release-date` with ISO regex, `asset-type`, `software-identifier`) with automatic `http://csrc.nist.gov/ns/oscal` namespace assignment and deprecation warning for `hardware-model` (US 3.4).
- **Custom Properties & Isolation:** Free-form `PropsEditor` with autocomplete suggestions and strict isolation from runtime parameters per DD-011 (US 3.5).
- **Typed Inter-Component Links:** Relationship declaration with official OSCAL `rel` tokens, internal component picker, and back-matter resource fragment references (US 3.6).
- **Network Protocol & Port Range Engine:** Structured declaration of service endpoints with port range validation (`0 <= start <= end <= 65535`) and strict transport enum validation (`TCP` | `UDP`) (US 3.7).
- **Organizational Responsibility Binding:** Role assignments using standard OSCAL roles (`asset-owner`, `security-operations`, etc.) linked to `metadata.parties[]` with per-component role uniqueness enforcement (US 3.8).
- **Multi-Framework Control Implementation:** Source framework binding via Workspace Source Document Picker, supporting simultaneous implementations across multiple regulatory frameworks (US 3.9).
- **Hierarchical Control Mapping & Integrity:** Searchable, hierarchical control tree picker with bulk selection and source control ID existence verification resolving DISC-03 (US 3.10).
- **Structured Statement-Level Narratives:** Granular sub-statement editing (`statement-id`, `description`) with statement picker and `ProseWithParams` integration (US 3.11).
- **Pre-Configured Parameter Defaults:** Simplified value-only `set-parameters` editor at both framework and requirement levels, feeding the Stage 4 parameter cascade (US 3.12).
- **Capability Aggregation Engine:** Packaging components into higher-level capabilities with `incorporates-components` referential integrity checks (US 3.13).
- **External Definition Federation:** Importing and inspecting external vendor component definitions via URL or file upload (US 3.14).
- **EntityTable Exploration:** High-performance tabular navigation with type filters, full-text search, column sorting, and batch deletion with `useConfirm()` (US 3.15).
- **Dual-State UX & DD-029 Action Reducers:** Seamless View/Edit toggling, 30s backend draft auto-save, and 100% adherence to centralized document action reducers in `component-definition-actions.ts` resolving DISC-07 (US 3.17).
- **Immutable Version Snapshots:** Version tagging, revision history tracking in `metadata.revisions[]`, and NIST JSON schema validation before persistence (US 3.18).
- **Embedded Back-Matter Evidence:** Client-side Base64 embedding for files ≤2MB and cryptographic `rlinks` for larger external artifacts (US 3.19).
- **Downstream SSP Import Handshake:** Lossless transfer of component metadata, control implementations, statement narratives, and parameter defaults into Stage 4 SSP `by-components[]`, establishing provenance links `rel="imported-from"` resolving DISC-01 and DISC-02 (US 3.20).

---

## 4. Functional Acceptance Criteria (Summary)

- [x] **US 3.1:** A Component Definition document can be initialized with minimal input (title only) and immediately redirects to `/component-definitions/{uuid}?edit=true` with an authoritative schema-compliant shell.
- [x] **US 3.2:** All 15 standard OSCAL component types plus custom types are supported, while `status` and SSP-only types (`this-system`) are strictly prohibited per OSCAL metaschema.
- [x] **US 3.3:** Component `title` and `description` are validated as mandatory fields with live inline feedback; `purpose` and `remarks` are supported.
- [x] **US 3.4:** Standard OSCAL properties (`implementation-point`, `virtual`, `public`, `allows-authenticated-scan`, `release-date`, `asset-type`, `software-identifier`) are configurable via guided palettes with namespace enforcement and `hardware-model` deprecation warnings.
- [x] **US 3.5:** Custom properties (`props[]`) are managed via `PropsEditor` with autocomplete suggestions and strict separation from dynamic parameters (DD-011).
- [x] **US 3.6:** Typed links between components and resources can be declared with standard OSCAL relation types (`depends-on`, `uses-service`) and internal `#uuid` pickers.
- [x] **US 3.7:** Service protocols and port ranges are validated (`0 <= start <= end <= 65535`, `TCP` | `UDP`), supporting quick-add presets and empty-array purging.
- [x] **US 3.8:** Standard OSCAL responsible roles can be assigned with party linkage from `metadata.parties[]` and per-component role uniqueness enforcement.
- [x] **US 3.9:** Control implementation sets can be declared and bound to workspace Catalogs or Profiles via the Workspace Source Document Picker, supporting multi-framework compliance.
- [x] **US 3.10:** Implemented requirements can be mapped using a hierarchical, searchable control picker with bulk selection and control ID existence verification against the source framework.
- [x] **US 3.11:** Statement-level implementation narratives are editable via a structured editor with guided statement ID pickers and `ProseWithParams` integration.
- [x] **US 3.12:** Component parameter defaults (`set-parameters[]`) are configurable at set and requirement levels using a simplified value-only editor with empty array stripping.
- [x] **US 3.13:** Components can be aggregated into named capabilities with verified `incorporates-components` references and composite control implementations.
- [x] **US 3.14:** External OSCAL component definitions can be imported via URI or file upload with schema validation and read-only inspection.
- [x] **US 3.15:** `EntityTable` provides real-time search, multi-type filtering, column sorting, and batch deletion with `useConfirm()`.
- [x] **US 3.16:** Document overview provides standard metadata editing and inventory analytics without unauthorized tag promotion.
- [x] **US 3.17:** Segmented Mode Toggle `[ 👁️ View | ✏️ Edit ]` synchronizes URL query params, triggers 30s backend draft auto-saves (`<uuid>_draft.json`), and executes mutations exclusively via `component-definition-actions.ts`.
- [x] **US 3.18:** Immutable versions can be published with automatic `metadata.revisions[]` tracking and NIST OSCAL JSON schema validation.
- [x] **US 3.19:** Back-matter resources can be attached via client-side Base64 embedding (≤2MB) or external `rlinks` with cryptographic hashes.
- [x] **US 3.20:** Downstream SSP import preserves all control implementations, statement narratives, and parameter defaults into Stage 4 `by-components[]`, establishing provenance links (`rel="imported-from"`).
