# Step 3: Detailed User Stories – Component Definition

* **Persona:** Alice (Compliance Officer / Lead Engineer)
* **Goal:** Structured capture of all reusable IT security components—software products, cloud services, hardware devices, network interconnections, policies, and procedures—along with their inherent compliance capabilities, technical interfaces, and organizational responsibilities, according to the NIST OSCAL Component Definition Model (v1.2.2). These component building blocks serve as pre-defined templates for System Security Plans (SSPs) in Stage 4.

---

## 1. Breakdown of User Stories

### US 3.1: Component Definition Document Creation & Inner View
> Implements [US 0.P1](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create a new Component Definition document by entering only a document title and being immediately redirected to the in-place editing area (Inner View),  
> **so that** I can begin declaring components without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Dialog:** Clicking "New Component Definition" opens a simple dialog requiring only the document title. The system generates a `component-definition.uuid` automatically.
    *   **Direct Redirection:** After clicking "Create Document," the document is initialized in the backend with an empty `components[]` array and the user is redirected to the editing view (`/component-definition/{uuid}?edit=true`).
    *   **Document Shell:** The initialized document contains `component-definition.uuid`, `metadata` (with `title`, `last-modified`, `version`, `oscal-version`), empty `components[]`, empty `capabilities[]`, and no `import-component-definitions[]`.
    *   **OSCAL Compliance:** The generated document validates against the official NIST OSCAL Component Definition JSON Schema (v1.2.2).

### US 3.2: Component Declaration & OSCAL Type Classification
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create individual components within a Component Definition document and classify them according to standardized OSCAL component types,  
> **so that** every IT asset, service, policy, or procedure is categorized in a machine-readable, interoperable manner.
*   **Acceptance Criteria:**
    *   **Component CRUD:** The user can create, read, update, and delete components within the `components[]` array. Each component receives a unique `uuid` upon creation.
    *   **OSCAL Type Selection:** A dropdown or selector offers all 11 standardized OSCAL component types:
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
    *   **Custom Types:** The type field allows custom values beyond the standard enumeration (OSCAL: `allow-other="yes"`), entered via a free-text input.
    *   **Type-Specific UI Hints:** When `type="service"` is selected, the Protocols & Port Ranges section (US 3.7) becomes prominently visible and auto-expanded. For `type="software"`, the `software-identifier` property is suggested in the properties section (US 3.4). For `type="validation"`, the `validation-type` and `validation-reference` properties are highlighted.
    *   **Component UUID Uniqueness:** The system enforces uniqueness of `component.uuid` values across the document (OSCAL index constraint `oscal-index-system-component-uuid`).

### US 3.3: Component Core Identity Fields
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** define the core identity of each component including its title, description, purpose, and remarks,  
> **so that** every component has clear, human-readable documentation of its function and business context.
*   **Acceptance Criteria:**
    *   **Title (Required, `markup-line`):** A single-line rich text field for the component's human-readable name (e.g., "MongoDB Community Server"). Displayed prominently in the component header and the component table (US 3.15).
    *   **Description (Required, `markup-multiline`):** A multi-line rich text field for a detailed description of the component's function (e.g., "MongoDB is a source-available, cross-platform document-oriented database program. Classified as a NoSQL database program, MongoDB uses JSON-like documents with optional schemas.").
    *   **Purpose (Optional, `markup-line`):** A single-line rich text field for a concise summary of the component's technological or business purpose (e.g., "Provides a NoSQL database service").
    *   **Remarks (Optional, `markup-multiline`):** A multi-line rich text field for additional commentary, implementation notes, or caveats.
    *   **Inline Editing:** All fields are editable inline within the component detail card when in edit mode.
    *   **Required Field Validation:** `title` and `description` are marked as required; the system prevents saving a component without these two fields and displays validation hints.

### US 3.4: Standard OSCAL Component Properties
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** assign standardized OSCAL properties (`props`) to components using guided input controls (dropdowns, toggles, date pickers),  
> **so that** common technical and compliance metadata is captured consistently and machine-readably across all assets.
*   **Acceptance Criteria:**
    *   **Architecture & Deployment Properties (Toggle/Dropdown):**
        *   `implementation-point`: `internal` | `external` — whether the component is within or outside the system boundary.
        *   `virtual`: `yes` | `no` — whether the component is virtualized.
        *   `public`: `yes` | `no` — whether the component is publicly accessible.
        *   `allows-authenticated-scan`: `yes` | `no` — whether the component permits authenticated vulnerability scans.
    *   **Versioning & Release Properties (Text/Date Input):**
        *   `version` — Product version string (e.g., `15.2.1`).
        *   `patch-level` — Current patch level (e.g., `p3`).
        *   `release-date` — Release date (validated as `date` data type, OSCAL constraint `oscal-component-release-date-value-datatype`, e.g., `2026-01-15`). Rendered as a date picker in the UI.
        *   `model` — Product model designation.
    *   **Asset Classification Properties (Dropdown with Custom Values):**
        *   `asset-type` with standard values: `operating-system`, `database`, `web-server`, `dns-server`, `email-server`, `directory-server`, `pbx`, `firewall`, `router`, `switch`, `storage-array`, `appliance` (OSCAL: `allow-other="yes"` for custom types).
        *   `asset-id` — Organizational asset identifier (free text).
        *   `asset-tag` — Physical asset tag identifier (free text).
    *   **Software-Specific Properties (Conditional — shown when `type="software"`):**
        *   `software-identifier` — Machine-readable software identifier (e.g., CPE, SWID tag).
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
    *   **Deprecated Properties:** `hardware-model` is shown with a deprecation warning, directing users to use `model` instead.
    *   **Physical Location Reference:** `physical-location` property value must reference a valid `metadata.location.uuid` (OSCAL index constraint).
    *   **Inherited UUID:** `inherited-uuid` property value is validated as UUID data type (OSCAL constraint `oscal-component-inherited-uuid-value-datatype`).
    *   **OSCAL Namespace:** All standard properties use the default namespace `http://csrc.nist.gov/ns/oscal`. The namespace is set automatically and is not user-editable for standard properties.

### US 3.5: Custom Properties & Free-Form Metadata
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** define arbitrary custom properties on components with full control over name, value, namespace, class, and group,  
> **so that** organization-specific metadata, certifications, and tags can be captured beyond the OSCAL standard vocabulary.
*   **Acceptance Criteria:**
    *   **Free-Form Property Creation:** Adding custom `props[]` entries with:
        *   `name` (required, `token`) — Property key (e.g., `eal-level`, `encryption-algorithm`, `data-classification`).
        *   `value` (required, `string`) — Property value (e.g., `EAL 4+`, `AES-256-GCM`, `confidential`).
        *   `ns` (optional, `uri`) — Custom namespace URI. Defaults to `http://csrc.nist.gov/ns/oscal` if omitted; for organization-specific properties, a custom namespace should be set (e.g., `https://example.com/ns/reposol`).
        *   `class` (optional, `token`) — Sub-classification within the property name (e.g., `symmetric` for an `encryption-algorithm` property).
        *   `group` (optional, `token`) — Grouping identifier for related properties (e.g., `crypto` to group all cryptography-related props).
        *   `uuid` (optional, auto-generated) — Unique identifier for the property instance.
        *   `remarks` (optional, `markup-multiline`) — Commentary on the property.
    *   **Autocomplete (`datalist`):** The `name` field provides suggestions for property names already used in the current document or across other component definitions in the workspace.
    *   **Reorder & Delete:** Properties can be reordered via drag-and-drop and deleted individually.
    *   **Tag Promotion:** Properties used across multiple components can be promoted to global document-level tags (see US 3.16).

### US 3.6: Component Links & Dependency Declaration
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** declare typed links between components and to external resources,  
> **so that** dependency chains, data flows, and compliance evidence are transparently documented in the system architecture model.
*   **Acceptance Criteria:**
    *   **Link Creation:** Adding `links[]` entries with:
        *   `href` (required, `uri-reference`) — Target reference. Can be:
            *   An internal `#uuid` fragment referencing another component, capability, or back-matter resource within the same document.
            *   A relative reference to another OSCAL document.
            *   An absolute URI to an external resource.
        *   `rel` (optional, `token`) — Relationship type from the OSCAL standard vocabulary:
            *   `depends-on` — This component depends on the referenced component for operation.
            *   `uses-service` — This component consumes the referenced service component.
            *   `uses-network` — This component uses the network provided by the referenced network component.
            *   `validation` — Link to a validation/certification component or resource (e.g., FIPS 140-2 validation record).
            *   `proof-of-compliance` — Link to compliance evidence (e.g., audit report, SOC 2 certificate).
            *   `baseline-template` — Link to a baseline template document.
            *   `system-security-plan` — Link to an SSP that includes this component.
            *   Custom relation types are allowed (OSCAL: `allow-other="yes"`).
        *   `media-type` (optional, `string`) — MIME type of the linked resource (e.g., `application/json`, `application/pdf`).
        *   `resource-fragment` (optional, `string`) — Fragment identifier within the resource.
        *   `text` (optional, `markup-line`) — Human-readable link label/description.
    *   **Service-Specific Relations:** When the component `type="service"`, additional standard relation types are available:
        *   `provided-by` — Indicates who provides this service.
        *   `used-by` — Indicates who consumes this service.
    *   **Internal Component Picker:** A component picker allows selecting other components within the same document as link targets, auto-generating `#uuid` href values.
    *   **Back-Matter Resource Picker:** A resource picker allows selecting `back-matter.resources[]` entries as link targets using `#uuid` fragment references (see US 3.19).
    *   **Visual Dependency Indicators:** Links with `rel="depends-on"` or `rel="uses-service"` display visual connection indicators between components in the sidebar tree or table view.

### US 3.7: Service Protocol & Port Range Declaration
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** document the network protocols and port ranges offered by service and software components,  
> **so that** the technical communication structure and attack surface are transparently captured for security assessments and network architecture reviews.
*   **Acceptance Criteria:**
    *   **Protocol Definition:** Adding `protocols[]` entries on components (primarily for `type="service"` and `type="software"`) with:
        *   `name` (recommended, `string`) — Protocol identifier (e.g., `https`, `ssh`, `postgresql`, `mongodb`, `grpc`).
        *   `uuid` (optional, auto-generated) — Unique identifier for the protocol entry. OSCAL issues a WARNING-level diagnostic if this is missing.
        *   `title` (optional, `markup-line`) — Human-readable protocol description (e.g., "Primary daemon process for the MongoDB system." or "HTTPS with TLS 1.3 for REST API").
    *   **Port Range Configuration:** Each protocol can have multiple `port-ranges[]` entries with:
        *   `start` (recommended, `non-negative-integer`) — Start port number (e.g., `443`). OSCAL warns if missing.
        *   `end` (recommended, `non-negative-integer`) — End port number (e.g., `443` for single port, `8443` for a range). OSCAL warns if missing.
        *   `transport` (recommended, `token`) — Transport protocol: `TCP` or `UDP`.
    *   **Port Range Validation:** Warning if `start > end`. Warning if `start`, `end`, or `transport` are omitted (per OSCAL best practice diagnostics).
    *   **UI Hint — Type-Driven Visibility:** The Protocols section is visually highlighted and auto-expanded when the component type is `service`. For non-service types, it is collapsed but still accessible.
    *   **Common Protocol Templates:** Quick-add buttons for common protocol presets (e.g., "HTTPS/443/TCP", "SSH/22/TCP", "PostgreSQL/5432/TCP") to speed up data entry.

### US 3.8: Role & Responsibility Assignment
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** bind organizational responsibilities directly to components using standardized and custom role identifiers linked to persons or teams defined in the document metadata,  
> **so that** responsible teams and individuals can be identified immediately during audits or security incidents.
*   **Acceptance Criteria:**
    *   **Responsible Role Assignment:** Adding `responsible-roles[]` entries on a component with:
        *   `role-id` (required, `token`) — Role identifier. The UI offers a dropdown with OSCAL standard roles:
            *   **Operational Roles:** `asset-owner`, `asset-administrator`, `security-operations`, `network-operations`, `incident-response`, `help-desk`, `configuration-management`.
            *   **Production/Supply Roles:** `maintainer`, `provider`.
            *   Custom role IDs are allowed (OSCAL: `allow-other="yes"`).
        *   `party-uuids[]` (optional, `uuid[]`) — References to persons, teams, or organizations defined in `metadata.parties[]`. A party picker displays available parties from the document metadata.
        *   `props[]` (optional) — Additional properties on the role assignment.
        *   `links[]` (optional) — Links associated with the role (e.g., link to an escalation procedure).
        *   `remarks` (optional, `markup-multiline`) — Commentary on the role assignment.
    *   **Role Uniqueness:** Each `role-id` can only appear once per component (OSCAL constraint: `is-unique` on `responsible-role/@role-id`). The UI prevents duplicate role assignments.
    *   **Role Description Tooltip:** Standard OSCAL role IDs display descriptive tooltips explaining the role's purpose.

### US 3.9: Control Implementation Sets
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** create control implementation sets that link a component to one or more regulatory frameworks (catalogs or profiles),  
> **so that** the component's out-of-the-box security capabilities are documented per framework and can be reused as templates in System Security Plans (Stage 4).
*   **Acceptance Criteria:**
    *   **Control Implementation Set Creation:** Adding `control-implementations[]` entries on a component with:
        *   `uuid` (required, auto-generated) — Unique identifier for the implementation set.
        *   `source` (required, `uri-reference`) — Reference to the catalog or profile that defines the controls being implemented. This is the critical link connecting the component's capabilities to a specific framework (e.g., BSI Grundschutz, NIST SP 800-53 rev5, ISO 27001).
        *   `description` (required, `markup-multiline`) — Description of how the component supports the referenced set of controls (e.g., "MongoDB control implementations for NIST SP 800-53 revision 5.").
    *   **Source Picker:** A picker/browser allows selecting from catalogs and profiles available in the current Reposol workspace. The selected document's URI is stored as the `source` value. The user can also enter an external URI manually.
    *   **Multiple Framework Support:** A single component can have multiple `control-implementations[]` entries, each linked to a different framework (e.g., one for BSI IT-Grundschutz, another for NIST SP 800-53 rev5). This enables cross-framework compliance documentation.
    *   **Set-Level Properties & Links:** Each control implementation set supports optional `props[]` and `links[]` for additional metadata.
    *   **Minimum One Requirement:** Each `control-implementations` entry must contain at least one `implemented-requirements[]` entry (OSCAL: `min-occurs="1"`).

### US 3.10: Implemented Requirements Mapping
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** map individual controls from a referenced framework to the component and describe how each control is implemented out-of-the-box,  
> **so that** the component's built-in security capabilities are documented at the individual control level and can be pre-populated into SSPs.
*   **Acceptance Criteria:**
    *   **Implemented Requirement Entry:** Adding `implemented-requirements[]` within a `control-implementations` set with:
        *   `uuid` (required, auto-generated) — Unique identifier.
        *   `control-id` (required, `token`) — The identifier of the control being implemented (e.g., `ac-7`, `sc-8.1`, `sa-4.9`, `app.1.1`, `sys.2.1`). This must match a control ID defined in the referenced `source` catalog or profile.
        *   `description` (required, `markup-multiline`) — Narrative description of how the component implements this control (e.g., "MongoDB supports TLS 1.x to encrypt data in transit, preventing unauthorized disclosure or changes to information during transmission. To implement TLS, set the PEMKeyFile option in the configuration file /etc/mongod.conf to the certificate file's path and restart the component.").
    *   **Control Picker:** A searchable control picker loads the available controls from the referenced `source` catalog/profile, displaying control IDs, titles, and group hierarchy to facilitate accurate selection.
    *   **Bulk Selection:** The user can select multiple controls at once and add them as implemented requirements with placeholder descriptions to be filled in later.
    *   **Properties & Links:** Each implemented requirement supports optional `props[]`, `links[]`, and `remarks` for supplementary metadata and evidence references.
    *   **Responsible Roles per Requirement:** Individual `responsible-roles[]` can be assigned at the implemented requirement level (overriding or supplementing component-level roles from US 3.8).
    *   **Role Uniqueness per Requirement:** Each `role-id` appears at most once per implemented requirement (OSCAL constraint).
    *   **Statement Uniqueness per Requirement:** Each `statement-id` appears at most once within the same implemented requirement (OSCAL constraint).

### US 3.11: Statement-Level Implementation Detail
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** provide fine-grained implementation narratives at the individual control statement level,  
> **so that** complex multi-part controls are documented precisely, showing exactly which sub-requirements the component fulfills.
*   **Acceptance Criteria:**
    *   **Statement Entry:** Adding `statements[]` within an `implemented-requirement` with:
        *   `statement-id` (required, `token`) — The identifier of the control statement part (e.g., `ac-7_smt.a`, `ac-7_smt.b`, `sc-8.1_smt`).
        *   `uuid` (required, auto-generated) — Unique identifier for the statement implementation.
        *   `description` (required, `markup-multiline`) — Implementation narrative for this specific statement, describing how the component addresses this particular sub-requirement.
    *   **Statement Picker:** When a control has multiple statements/parts, the UI loads and displays the available statement IDs from the source catalog/profile for guided selection.
    *   **Statement Uniqueness:** Each `statement-id` appears at most once per implemented requirement (OSCAL constraint `oscal-unique-component-definition-implemented-requirement-statement`).
    *   **Statement-Level Metadata:** Each statement supports its own `responsible-roles[]`, `props[]`, `links[]`, and `remarks` — enabling per-statement responsibility assignment and evidence linking.
    *   **Visual Hierarchy:** Statements are displayed as nested items under their parent implemented requirement, clearly showing the control → requirement → statement hierarchy with indentation and visual grouping.

### US 3.12: Component Parameter Defaults (Set-Parameters)
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** define default parameter values at both the control implementation set level and the individual implemented requirement level,  
> **so that** the component ships with pre-configured security settings that can be inherited or overridden in System Security Plans.
*   **Acceptance Criteria:**
    *   **Set-Parameter on Control Implementation Set:** Adding `set-parameters[]` at the `control-implementations` level with:
        *   `param-id` (required, `token`) — Reference to a parameter defined in the source catalog/profile (e.g., `ac-7_prm_1`).
        *   `values[]` (required, `string[]`, min: 1) — One or more default values (e.g., `["5"]` for a lockout threshold, `["30"]` for a lockout duration in minutes).
        *   `remarks` (optional, `markup-multiline`) — Explanation of why this default was chosen.
    *   **Set-Parameter on Implemented Requirement:** Adding `set-parameters[]` at the individual `implemented-requirement` level for control-specific parameter values that apply only within the context of that single requirement.
    *   **Parameter Uniqueness:** Each `param-id` appears at most once within the same `set-parameters[]` array (OSCAL constraints `oscal-unique-component-definition-control-implementation-set-parameter` and `oscal-unique-component-definition-implemented-requirement-set-parameter`).
    *   **Parameter Browser:** A parameter picker loads the available parameters from the source catalog/profile, showing `param-id`, `label`, `select.choices`, and `constraints` to guide the user in setting appropriate values (see [DD-012](../design_decisions/DD-012_parameter_value_assignment_and_override_strategy.md)).
    *   **Inheritance Preview:** A visual indicator shows how these defaults will flow into SSPs (informational only at the component definition stage — actual inheritance is resolved in Stage 4).

### US 3.13: Capability Declaration & Component Aggregation
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** group related components into named capabilities that represent composite security functions,  
> **so that** higher-level security capabilities (e.g., "Identity & Access Management" or "Data Encryption at Rest") can be documented as aggregations of individual components.
*   **Acceptance Criteria:**
    *   **Capability Creation:** Adding `capabilities[]` entries at the document level with:
        *   `uuid` (required, auto-generated) — Unique capability identifier.
        *   `name` (required, `string`) — Short capability name (e.g., "Identity & Access Management").
        *   `description` (required, `markup-multiline`) — Description of the capability and how the grouped components work together.
    *   **Incorporating Components:** Adding `incorporates-components[]` entries within a capability:
        *   `component-uuid` (required, `uuid`) — Reference to a component defined in the same document. A component picker with search is provided.
        *   `description` (required, `markup-multiline`) — Description of how this component contributes to the capability (e.g., "Provides OAuth 2.0 / OIDC token-based authentication").
    *   **Component Uniqueness per Capability:** Each component can only be referenced once within the same capability (OSCAL constraint `oscal-unique-component-definition-capability-incorporates-component`).
    *   **Capability UUID Uniqueness:** Each capability UUID is unique across the document (OSCAL constraint `oscal-unique-component-definition-capability`).
    *   **Capability-Level Control Implementations:** Capabilities support their own `control-implementations[]` independent of (or in addition to) individual component control implementations. This allows documenting controls that are only satisfied by the combination of multiple components.
    *   **Capability Properties & Links:** Each capability supports optional `props[]`, `links[]`, and `remarks`.

### US 3.14: External Component Definition Import
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** import external OSCAL component definitions from vendors, other Reposol instances, or public repositories,  
> **so that** I can reuse pre-built component building blocks without manual re-entry.
*   **Acceptance Criteria:**
    *   **Import Declaration:** Adding `import-component-definitions[]` entries at the document level with:
        *   `href` (required, `uri-reference`) — One of:
            *   An absolute URI pointing to a network-resolvable OSCAL component definition (e.g., `https://vendor.example.com/oscal/component-definition.json`).
            *   A relative reference to a local file.
            *   A bare URI fragment (`#uuid`) pointing to a `back-matter` resource in this document.
        *   `remarks` (optional, `markup-multiline`) — Commentary on the import (e.g., "Official AWS Cognito component definition provided by AWS Security").
    *   **File Upload:** The user can upload an OSCAL component definition JSON file, which is stored in `back-matter.resources[]` and referenced via `#uuid`.
    *   **Import Validation:** The system validates that the imported document is a valid OSCAL component definition before accepting it.
    *   **Visual Indicator:** Imported component definitions are visually distinguished from locally declared components (e.g., with an import badge 📥 or different background).
    *   **Import Browsing:** The user can browse the contents of imported component definitions in read-only mode to review available components and capabilities before deciding which to use.

### US 3.15: Component Table & List Navigation
> Implements [US 0.P5](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** see all components declared in the current document in a structured table view with filtering, sorting, and search capabilities,  
> **so that** I can quickly navigate, search, and manage my component inventory.
*   **Acceptance Criteria:**
    *   **Table Columns:** The component table displays at minimum: Component Name (`title`), Type (`type`) with icon/badge, Purpose (truncated), Number of Control Implementation Sets, Version (from `props[name='version']`), and latest modification date.
    *   **Type Filter:** Filter components by OSCAL type (dropdown with all 11 standard types + any custom types present in the document).
    *   **Search:** Full-text search across component titles, descriptions, property values, and remarks.
    *   **Sorting:** Sortable by name (alphabetical), type, version, and number of control implementations.
    *   **Row Click Navigation:** Clicking a table row navigates to the component detail view / Inner View for that component.
    *   **Bulk Actions (Edit Mode):** In edit mode, multi-select checkboxes for bulk deletion of components.
    *   **Empty State:** When no components exist, a prominent empty-state message with a "Add First Component" call-to-action is displayed.

### US 3.16: Document Overview & Tag Management
> Implements [US 0.P3](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** manage document-level metadata and a tag system in the Document Overview pane when no specific component is selected,  
> **so that** the overall document and its global tag structure are well-maintained.
*   **Acceptance Criteria:**
    *   **Document Overview Pane:** When no component is selected in the left sidebar, the right main pane shows horizontal tabs: **Metadata** and **Tags**.
    *   **Metadata Tab:** Displays and allows editing of `metadata.title`, `metadata.version`, `metadata.oscal-version`, `metadata.last-modified`, `metadata.published`, `metadata.revisions[]`, `metadata.parties[]`, `metadata.roles[]`, and `metadata.responsible-parties[]`.
    *   **Tags Tab — Global Property Tags:** Tags (property name/value pairs) defined at the document level that can be applied consistently across all components.
    *   **Tags Tab — Used / Existing Tags:** List of all property keys (`prop/@name`) currently used across all components in the document, with occurrence count and a **Promote** button (edit mode) to elevate a locally used property key to a global tag.
    *   **Component Count Summary:** Dashboard-style overview showing total number of components, breakdown by type (e.g., "3 software, 2 services, 1 policy"), number of capabilities, and total number of control implementation sets.

### US 3.17: In-Card Editing & Draft Persistence
> Implements [US 0.P4](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** edit component details inline in a cohesive card layout and have unsaved changes cached locally,  
> **so that** data entry is uniform, and no work is lost on accidental navigation or browser closure.
*   **Acceptance Criteria:**
    *   **Cohesive Card Layout:** The component detail view in edit mode presents all fields in visually grouped sections within a structured card:
        *   **Header Section:** Title, type selector, description, purpose.
        *   **Properties Section:** Standard properties (toggles/dropdowns) and custom properties (free-form rows).
        *   **Protocols Section:** Protocol entries with port ranges (conditionally expanded for service components).
        *   **Roles Section:** Responsible role assignments with party picker.
        *   **Control Implementations Section:** Expandable control implementation sets with nested implemented requirements.
        *   **Links Section:** Link entries with relation type and target picker.
    *   **Edit / Read-Only Toggle:** A clear edit mode toggle switches between read-only presentation and editable form fields.
    *   **Exit Button with Draft Caching:** The Exit button ends editing and redirects to the read-only view. Unsaved changes are cached in `localStorage` for recovery on next visit.
    *   **Draft Indicator:** A visual indicator (e.g., badge 🟡 or "Unsaved Changes" label) shows when a component has unsaved local changes.
    *   **Discard Draft:** Option to explicitly discard cached changes and revert to the last persisted state.

### US 3.18: Integrated Backend Versioning
> Implements [US 0.P2](step0_global_requirements.md) with component-specific additions.
> **As a** Compliance Officer (Alice)  
> **I want to** save, load, and delete versions of a Component Definition document directly in the backend,  
> **so that** version states are managed persistently, cross-device, and are visible to other users in the workspace.
*   **Acceptance Criteria:**
    *   **No UUID Bumping:** A new version is saved under the same document `uuid`. The `component-definition.uuid` remains stable across versions.
    *   **Save Version:** The "Save Version" button opens a dialog for version number (e.g., `1.1.0`) and optional remarks. The file is persisted as `{uuid}_v{version}.json`.
    *   **Automatic Revision Tracking:** When saving a new version, a new entry is automatically added to `metadata.revisions[]`, containing the version number, the timestamp (`last-modified`), the OSCAL version, and the entered remarks.
    *   **Versions Drawer:** Clicking "Versions" shows the currently loaded version and opens a drawer listing all saved versions with:
        *   Version number and save timestamp.
        *   Remarks.
        *   Actions: **Load** (switch to this version), **Delete** (remove this version).
    *   **Table Default:** The component definition table shows the latest version by default.
    *   **OSCAL Validation on Save:** Each version is validated against the official OSCAL Component Definition JSON Schema before persistence (see [DD-002](../design_decisions/DD-002_oscal_validation_strategy.md)).

### US 3.19: Back-Matter & Resource Attachments
> **As a** Compliance Officer and Lead Engineer (Alice)  
> **I want to** attach supporting resources (documents, diagrams, certificates, external references) to the Component Definition document via the `back-matter` section,  
> **so that** compliance evidence and supplementary documentation are bundled within the OSCAL document.
*   **Acceptance Criteria:**
    *   **Resource Management:** Adding `back-matter.resources[]` entries with:
        *   `uuid` (required, auto-generated) — Unique resource identifier.
        *   `title` (optional, `markup-line`) — Resource title (e.g., "AWS Cognito SOC 2 Type II Report").
        *   `description` (optional, `markup-multiline`) — Resource description.
        *   `citation` (optional) — Bibliographic citation information with `text` and optional `props[]`/`links[]`.
        *   `rlinks[]` (optional) — Resource links with `href` (URI), `media-type` (MIME type), and optional `hashes[]` for integrity verification.
        *   `base64` (optional) — Base64-encoded embedded content for self-contained documents (see [DD-007](../design_decisions/DD-007_base64_embedded_attachments_strategy.md)).
    *   **File Upload:** Users can upload files (PDFs, images, certificates, OSCAL documents) which are either embedded as base64 or stored externally with an `rlink`.
    *   **Cross-Reference via Links:** Resources in `back-matter` can be referenced from any `link.href` in the document using `#uuid` fragment references (e.g., `"href": "#resource-uuid"` with `rel="proof-of-compliance"`).
    *   **Resource Preview:** Common file types (PDF, images) can be previewed inline in the UI.

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Create Document (US 3.1):** Alice navigates to the Component Definitions section in Reposol and clicks "New Component Definition." She enters the title *"Reposol Platform Components"* and is redirected immediately to the editing view.

2.  **Configure Document Metadata (US 3.16):** In the Document Overview pane (no component selected), she switches to the **Metadata** tab and sets `version` to `1.0.0`, adds herself as a party with role `document-author`, and creates global tags `owner` and `data-classification`.

3.  **Declare First Component (US 3.2, US 3.3):** She clicks "Add Component" and creates *AWS Cognito* with type `service`. In the detail card, she fills in the description ("Centralized identity and access management service providing OAuth 2.0 / OIDC authentication for the Reposol platform") and purpose ("User authentication and authorization").

4.  **Set Standard Properties (US 3.4):** She sets `implementation-point` = `external`, `public` = `yes`, `virtual` = `yes`, `version` = `2.0`, and `asset-type` = `web-server`.

5.  **Add Custom Properties (US 3.5):** She adds custom properties: `eal-level` = `EAL 4+` and `encryption-algorithms` = `AES-256-GCM`. She assigns the global tag `owner` with value `Platform-Engineering`.

6.  **Define Protocols & Ports (US 3.7):** Since Cognito is a `service`, the Protocols section is auto-expanded. She adds protocol `https` with title "OIDC/OAuth2 Endpoint" and port range `start=443, end=443, transport=TCP`.

7.  **Declare Additional Components (US 3.2, US 3.3):** She creates *Reposol Backend API* (`type=software`), *PostgreSQL Database* (`type=software`), and *Data Center Frankfurt* (`type=physical`). She fills in descriptions and purposes for each.

8.  **Link Dependencies (US 3.6):** She adds a link from *Reposol Backend API* to *AWS Cognito* with `rel="uses-service"`. She adds a dependency from the Backend API to *PostgreSQL Database* with `rel="depends-on"`.

9.  **Assign Roles (US 3.8):** She assigns `asset-owner` = "Platform-Engineering" and `asset-administrator` = "DevOps-Team" on *AWS Cognito*. On the Backend API, she assigns `maintainer` = "Backend-Dev-Team" and `provider` = "Internal Development".

10. **Attach Compliance Evidence (US 3.19):** She uploads the AWS Cognito SOC 2 Type II audit report as a back-matter resource and links it from the Cognito component with `rel="proof-of-compliance"`.

11. **Create Validation Component (US 3.2, US 3.4):** She creates a *FIPS 140-2 Validation* component with `type="validation"`, sets `validation-type` = `fips-140-2` and `validation-reference` = `3456`, and links it to Cognito with `rel="validation"`.

12. **Create Control Implementation Set (US 3.9):** On *AWS Cognito*, she creates a control implementation set linked to the BSI IT-Grundschutz catalog (selected from the workspace via the source picker). She describes: "AWS Cognito provides built-in identity and access management capabilities aligned with BSI IT-Grundschutz requirements."

13. **Map Implemented Requirements (US 3.10):** Within the set, she uses the control picker to add implemented requirements:
    *   `ac-7` (Unsuccessful Logon Attempts): "Cognito automatically locks accounts after configurable failed login attempts, enforcing rate limiting and progressive backoff."
    *   `ia-5` (Authenticator Management): "Cognito enforces configurable password complexity policies and supports multi-factor authentication (MFA) via TOTP and SMS."

14. **Add Statement-Level Detail (US 3.11):** For `ac-7`, she drills into statements:
    *   `ac-7_smt.a`: "Cognito enforces a maximum of N consecutive invalid login attempts by a user within a configurable time period T."
    *   `ac-7_smt.b`: "Cognito automatically locks the account for a configurable duration and notifies the administrator upon exceeding the threshold."

15. **Set Parameter Defaults (US 3.12):** She sets `ac-7_prm_1` (max attempts) = `5` and `ac-7_prm_2` (lockout duration) = `30` as component-level defaults, with remarks explaining that these are AWS-recommended production values.

16. **Group into Capability (US 3.13):** She creates a capability "Identity & Access Management" that incorporates both *AWS Cognito* ("Provides OAuth 2.0/OIDC authentication and MFA") and a *Role-Based Access Control Policy* component ("Defines the organizational RBAC matrix"). She adds a capability-level control implementation covering controls that require both components working together.

17. **Import External Definition (US 3.14):** She imports an external OSCAL component definition from a vendor URL that describes AWS S3 standard security capabilities, and reviews its contents in read-only mode.

18. **Review in Table View (US 3.15):** She switches to the component table, filters by type `service`, and verifies that all service components have protocols defined. She sorts by number of control implementations to identify components that still need security mapping.

19. **Save Version (US 3.18):** She clicks "Save Version," enters version `1.0.0` with remarks "Initial component inventory for Reposol platform," and the document is validated against the OSCAL schema and persisted with an automatic revision entry.

---

## 3. Functional Requirements for the System

- **OSCAL Component Type Classification:** Full support for all 11 OSCAL component types (`software`, `service`, `hardware`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `interconnection`) plus custom types (US 3.2).
- **Component Identity Management:** CRUD operations for components with required `title` and `description`, optional `purpose` and `remarks` (US 3.3).
- **Standard Property Palette:** Guided input for all OSCAL-standardized properties including architecture flags (`implementation-point`, `virtual`, `public`, `allows-authenticated-scan`), versioning fields (`version`, `patch-level`, `release-date`, `model`), asset classification (`asset-type`, `asset-id`, `asset-tag`), software-specific identifiers (`software-identifier`, `software-name`, `software-version`), OS properties (`os-name`, `os-version`), network properties (`vlan-id`, `network-id`), and validation properties (`validation-type`, `validation-reference`) (US 3.4).
- **Custom Properties & Tags:** Free-form property creation with full OSCAL property model support (`name`, `value`, `ns`, `class`, `group`, `uuid`, `remarks`) and autocomplete suggestions (US 3.5).
- **Typed Link System:** Component-to-component and component-to-resource linking with OSCAL standard relation types (`depends-on`, `uses-service`, `uses-network`, `validation`, `proof-of-compliance`, `baseline-template`, `system-security-plan`, `provided-by`, `used-by`) and custom relation types (US 3.6).
- **Service Protocol Architecture:** Protocol and port range declaration for service components with protocol name, title, port start/end, and transport type (`TCP`/`UDP`), including common protocol templates for fast entry (US 3.7).
- **Organizational Responsibility Binding:** Role assignment with OSCAL standard role IDs (`asset-owner`, `asset-administrator`, `security-operations`, `network-operations`, `incident-response`, `help-desk`, `configuration-management`, `maintainer`, `provider`) and party references from document metadata (US 3.8).
- **Multi-Framework Control Implementation:** Linking components to catalogs/profiles via `source` URI and documenting control coverage at three levels: control implementation set (US 3.9), individual implemented requirement (US 3.10), and fine-grained statement (US 3.11), with parameter defaults at both set and requirement levels (US 3.12).
- **Capability Aggregation:** Grouping components into named capabilities with `incorporates-components` references and independent capability-level control implementations (US 3.13).
- **OSCAL Interoperability:** Import of external OSCAL component definitions via `import-component-definitions` with URI, file upload, or back-matter reference (US 3.14).
- **Component Navigation:** Table view with type filtering, full-text search, and sorting for efficient component inventory management (US 3.15).
- **Document Management:** Metadata & tag management with promotion (US 3.16), inline editing with localStorage draft caching (US 3.17), backend versioning with automatic revision tracking and OSCAL validation (US 3.18), and back-matter resource management with file upload and cross-referencing (US 3.19).

---

## 4. Functional Acceptance Criteria (Summary)

- [ ] A Component Definition document can be created with minimal input (title only) and the user is redirected to the editor (US 3.1).
- [ ] Components can be created, edited, and deleted with all 11 OSCAL types plus custom types (US 3.2).
- [ ] Component title, description, purpose, and remarks can be edited inline with validation for required fields (US 3.3).
- [ ] All OSCAL-standardized properties can be assigned via guided input controls (dropdowns, toggles, date pickers) with type-conditional visibility (US 3.4).
- [ ] Custom properties with full OSCAL property model support (`name`, `value`, `ns`, `class`, `group`) can be freely added with autocomplete suggestions (US 3.5).
- [ ] Typed links between components and external resources can be declared with OSCAL standard relation types and internal component/resource pickers (US 3.6).
- [ ] Service protocols with port ranges (`start`, `end`, `transport`) can be documented on components, with common protocol templates for fast entry (US 3.7).
- [ ] Organizational roles with OSCAL standard role IDs and party references can be assigned to components with uniqueness enforcement (US 3.8).
- [ ] Control implementation sets can be created linking components to catalogs/profiles via a source picker, with at least one implemented requirement (US 3.9).
- [ ] Individual controls can be mapped as implemented requirements with narrative descriptions and a searchable control picker (US 3.10).
- [ ] Statement-level implementation detail can be provided for multi-part controls with per-statement roles and metadata (US 3.11).
- [ ] Default parameter values can be set at both the control implementation set and implemented requirement levels with a parameter browser (US 3.12).
- [ ] Components can be grouped into named capabilities with `incorporates-components` references and independent control implementations (US 3.13).
- [ ] External OSCAL component definitions can be imported via URI or file upload with validation and read-only browsing (US 3.14).
- [ ] A table view with type filtering, full-text search, sorting, and row-click navigation provides efficient component management (US 3.15).
- [ ] Document-level metadata and a global tag system can be managed in the Document Overview pane with tag promotion (US 3.16).
- [ ] Inline editing with draft caching in `localStorage` prevents data loss, with draft indicator and discard option (US 3.17).
- [ ] Document versions can be saved, loaded, and deleted with automatic revision tracking and OSCAL validation on each save (US 3.18).
- [ ] Back-matter resources can be attached via upload or URL, embedded as base64 or linked via `rlinks`, and cross-referenced from any link in the document (US 3.19).
- [ ] The generated document fully complies with the official NIST OSCAL Component Definition JSON Schema v1.2.2 (all stories).
