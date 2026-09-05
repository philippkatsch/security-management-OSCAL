# DD-036: SSP Architecture — Baseline Resolution, 4-Tier Parameter Cascade, Security Inheritance, and Component Linkages

## Status: Accepted
## Date: 2026-09-01
## Decision Makers: Development Team

> **Related Decisions:**
> - [DD-002](DD-002_oscal_validation_strategy.md): OSCAL Validation Strategy (Levels L0–L3)
> - [DD-004](DD-004_editor_ux_patterns.md): Editor UX Patterns (Drafts, Mode Toggle, Undo/Redo)
> - [DD-007](DD-007_base64_embedded_attachments_strategy.md): Base64 Embedded Attachments & Back-Matter
> - [DD-009](DD-009_parameter_strategy.md): Parameter Strategy across Lifecycle Stages
> - [DD-011](DD-011_properties_vs_parameters_separation.md): Properties vs Parameters Separation
> - [DD-012](DD-012_parameter_value_assignment_and_override_strategy.md): Parameter Value Assignment & Override Strategy
> - [DD-014](DD-014_live_ui_form_validation.md): Empty Array Purging Strategy
> - [DD-021](DD-021_entity_list_detail_editor_pattern.md): Entity List-Detail Editor Pattern
> - [DD-028](DD-028_backend_resolution_engine.md): Backend Resolution Engine
> - [DD-029](DD-029_document_actions_pattern.md): Centralized Document Actions Layer
> - [DD-030](DD-030_unified_control_editor.md): Unified Control Editor & Stage Adapters

---

## Context

In the NIST OSCAL lifecycle, the **System Security Plan (SSP)** (Step 4) represents the authoritative implementation document for a specific information system. It bridges the governance baseline defined in Catalogs (Step 1) and Profiles (Step 2) with the technical/procedural components defined in Component Definitions (Step 3), creating an auditable, machine-readable compliance artifact.

The official NIST OSCAL SSP v1.2.2 schema (`oscal_ssp_schema.json`) enforces strict constraints (`additionalProperties: false`, `minItems: 1` on arrays, specific required properties) and introduces advanced concepts:
1. **Direct Catalog and Profile Baseline Imports**: An SSP may import tailored baselines (Profiles) or directly import standard Catalogs.
2. **4-Tier Parameter Override Cascade**: Parameter values can be assigned at four distinct scoping levels with cascading inheritance.
3. **Component-Centric Control Implementation**: In OSCAL SSP, `implemented-requirement` does NOT have a top-level `description`; all implementation narratives MUST reside within `by-components[].description`.
4. **Root System Component (`this-system`)**: A dedicated component representing the system as a whole to anchor organizational/policy controls.
5. **Symmetric Security Inheritance**: Common control providers export capabilities and responsibilities; consumer systems inherit capabilities and document satisfaction of shared responsibilities.
6. **Deterministic FIPS-199 Categorization**: High-water mark calculation across NIST SP 800-60 information types.
7. **Client-Side Embedded Back-Matter**: Architecture and boundary diagrams embedded as Base64 resources linked via fragment URIs (`#resource-uuid`).

---

## Decisions

### 1. Baseline Resolution Architecture (Profile & Catalog Support)

The SSP baseline resolution engine supports both **Profile** and **direct Catalog** baseline imports:
- **`import-profile.href` Resolution**:
  - If `href` points to a Profile (e.g. `../profiles/{uuid}.json`), `resolution_service.py` executes `resolve_profile(workspace_id, profile_id)`.
  - If `href` points to a Catalog (e.g. `../catalogs/{uuid}.json`), the engine loads the catalog controls and groups directly without throwing a 404/resolution failure.
  - If `href` is an external URI or a `#resource-uuid` fragment, the engine follows the reference or falls back gracefully while preserving schema validity.
- **Backend Endpoints**:
  - `GET /api/resolve/ssp/{id}`: Returns the resolved SSP control tree with active parameter values and implementation status annotations.
  - `GET /api/resolve/tree/ssps/{id}`: Returns hierarchical navigation nodes and flat control lists for the UI sidebar.
  - `POST /api/resolve/ssp/preview`: Accepts an in-memory SSP payload and returns the resolved control tree in real time during live editing sessions.

---

### 2. 4-Tier Parameter Cascading Resolution Order & Fallback Matrix

Parameter values in an SSP are evaluated according to a deterministic 4-tier precedence hierarchy:

```
[ Tier 1: Component Override ]
    └── by-components[].set-parameters (or statements[].by-components[].set-parameters)
            │ (if not set, falls back to)
            ▼
[ Tier 2: Control Override ]
    └── implemented-requirements[].set-parameters
            │ (if not set, falls back to)
            ▼
[ Tier 3: SSP Global Default ]
    └── control-implementation.set-parameters
            │ (if not set, falls back to)
            ▼
[ Tier 4: Baseline Default ]
    └── Profile modify.set-parameters / Catalog param.values
```

#### Precedence & Merging Rules:
1. **Component-Specific Overrides (Tier 1)**: Take highest precedence for that specific component's implementation narrative.
2. **Control-Specific Overrides (Tier 2)**: Apply to all components implementing that control, unless overridden at Tier 1.
3. **SSP Global Overrides (Tier 3)**: Apply across all controls in the SSP, unless overridden at Tier 2 or Tier 1.
4. **Baseline Defaults (Tier 4)**: Fallback values originating from the underlying Profile tailoring or source Catalog definitions.

#### UI & Prose Rendering:
- The UI exposes a **Cascade Visualizer** for each parameter displaying:
  - **Active Effective Value** (bold chip).
  - **Origin Level Badge**: `[Component Override]`, `[Control Level]`, `[SSP Global]`, `[Profile Baseline]`, or `[Catalog Default]`.
  - **Inherited Fallback Value**: Shows what value will apply if the current level override is removed via "Revert Override".
- **Universal `ProseWithParams` Substitution**: Control requirement prose placeholders (`<insert type="param" id-ref="param_id"/>` or `{{ insert: param, param_id }}`) resolve dynamically to the active cascading value.

---

### 3. OSCAL SSP v1.2.2 Assembly & Metaschema Conformity

To ensure 100% compliance with NIST OSCAL SSP Schema v1.2.2:
- **`implemented-requirement` Narrative Location**:
  - The schema for `implemented-requirement` specifies `required: ["uuid", "control-id"]` and does **NOT** contain a `description` field.
  - All implementation prose MUST be stored in `by-components[].description`.
  - The SSP editor enforces that every `implemented-requirement` contains at least one `by-components` entry (`minItems: 1`). If no technical component is selected, it defaults to the `this-system` component.
- **System Components Required Fields**:
  - In an SSP, `system-component` requires: `uuid`, `type`, `title`, `description`, and `status: { state: string }`.
  - Allowed types include `this-system`, `system`, `software`, `hardware`, `service`, `policy`, `physical`, `process-procedure`, `plan`, `guidance`, `standard`, `validation`, `network`, `interconnection`, and custom strings.
- **System Characteristics Required Fields**:
  - Requires `system-ids` (array, `minItems: 1`, each with `id`), `system-name`, `description`, `system-information` (with `information-types`), `status`, and `authorization-boundary` (with `description`).
- **System Implementation Required Fields**:
  - Requires `users` array (minItems: 1) and `components` array (minItems: 1).
- **Inventory Items Schema**:
  - `inventory-item` requires `uuid` and `description` (it does NOT contain a `title` field).
  - Contains `implemented-components[]` linking to declared `system-component` UUIDs.
- **Leveraged Authorizations Schema**:
  - Requires `uuid`, `title`, `party-uuid` (referencing `metadata.parties[]`), and `date-authorized` (ISO 8601 date `YYYY-MM-DD`).

---

### 4. Root System Component (`this-system`) & Component Definition Import

- **`this-system` Auto-Initialization**:
  - On SSP creation, the system auto-generates exactly one component with `type="this-system"`, `status: { state: "operational" }`, and title matching the system name.
  - This component acts as the anchor for organizational, managerial, and system-wide controls (e.g., `ac-1`, `at-1`, `ps-1`).
- **Component Definition (CDEF) Import**:
  - Users can import pre-defined components from Stage 3 Component Definitions in the workspace.
  - Importing copies title, description, purpose, standard properties, protocols, and pre-existing control implementation narratives into the SSP.
  - The imported component sets `links: [{ "rel": "imported-from", "href": "../component-definitions/{cdef_uuid}.json" }]` for end-to-end traceability.

---

### 5. Symmetric Security Inheritance Model

Security inheritance is modeled symmetrically between Common Control Providers and Leveraging Consumers:

#### A. Consumer Side (`inherited` & `satisfied`):
- For controls implemented by an external service provider (e.g. AWS, Azure, shared IT), the `by-component` entry references a `type="system"` component linked to a `leveraged-authorization`:
  - **`inherited[]`**: Documents capabilities inherited directly from the provider (`uuid`, `provided-uuid`, `description`, `props`, `links`).
  - **`satisfied[]`**: Documents how the customer fulfills shared responsibilities imposed by the provider (`uuid`, `responsibility-uuid`, `description`, `props`, `links`, `remarks`).

#### B. Provider Side (`export`):
- For SSPs describing systems that export security capabilities to downstream tenant systems:
  - **`export.provided[]`**: Declares capabilities provided to leveraging systems (`uuid`, `description`).
  - **`export.responsibilities[]`**: Declares customer responsibilities that leveraging systems must satisfy (`uuid`, `provided-uuid`, `description`).

---

### 6. FIPS-199 High-Water Mark Calculation Engine

- The system implements an automated, deterministic High-Water Mark calculation based on NIST SP 800-60 and FIPS-199:
  - For each declared `information-type`, the active impact level (selected if present, else base) is evaluated across Confidentiality, Integrity, and Availability.
  - High-Water Mark values are computed as:
    $$\text{HWM}_C = \max_{t} (\text{Impact}_C(t)), \quad \text{HWM}_I = \max_{t} (\text{Impact}_I(t)), \quad \text{HWM}_A = \max_{t} (\text{Impact}_A(t))$$
    where $\text{High} > \text{Moderate} > \text{Low}$.
  - System Sensitivity Level is computed as $\max(\text{HWM}_C, \text{HWM}_I, \text{HWM}_A)$.
- The UI provides real-time conflict detection and an "Apply High-Water Mark Suggestion" button that updates `security-impact-level` and `security-sensitivity-level`.

---

### 7. Base64 Diagram Back-Matter Storage (DD-007 Integration)

- All visual diagrams (`authorization-boundary.diagrams[]`, `network-architecture.diagrams[]`, `data-flow.diagrams[]`) are processed client-side via `FileReader.readAsDataURL()`.
- The binary image payload is stored in `back-matter.resources[]` with a unique UUID and `base64: { value, media-type, filename }`.
- Diagram assemblies link to these resources via `links: [{ "rel": "diagram", "href": "#" + resource_uuid }]`.
- On rendering, the UI resolves `#resource-uuid` against `back-matter.resources` to reconstruct the inline image preview without any server upload directory dependency.

---

### 8. Document Actions & Stage Adapter Architecture

- **Centralized Document Actions (`ssp-actions.ts`)**:
  - In accordance with DD-029, all SSP mutations are dispatched through typed domain action functions in `ssp-actions.ts` (e.g. `addImplementedRequirement`, `updateByComponent`, `setSSPCascadeParam`, `addSystemComponent`, `importCDEFComponent`, `addLeveragedAuthorization`, `addSystemUser`, `addInventoryItem`, `setFipsImpactLevels`).
  - Dispatched via `useDocumentActions()`, ensuring automated Immer immutability, undo/redo history tracking, and type safety.
- **Polymorphic Stage Adapter (`SSPAdapter.tsx`)**:
  - In accordance with DD-030, `SSPAdapter.tsx` implements the stage adapter interface for `UnifiedControlEditor`.
  - Exposes by-components editing, statement-level mapping, parameter cascade overrides, origination tagging, and inheritance controls.

---

### 9. Pre-Serialization Empty Array Purging (DD-014 Integration)

- NIST OSCAL SSP Schema v1.2.2 enforces `minItems: 1` on all array definitions (`set-parameters: []`, `props: []`, `links: []`, `values: []`, `statements: []`, `by-components: []`).
- Prior to saving or validating, the document is processed through `remove_empty_arrays` (both on frontend save dispatch and backend `document_routes.py`), stripping all empty optional arrays to ensure zero false-positive schema validation errors.

---

## Consequences

- **100% Schema Conformity**: Generated SSP documents strictly pass NIST OSCAL SSP Schema v1.2.2 validation (`oscal_ssp_schema.json` with `additionalProperties: false`).
- **Complete Lifecycle Integration**: Seamlessly connects Catalog controls, Profile tailoring, and Component Definition implementations into an auditable System Security Plan.
- **Predictable Parameter Cascading**: Eliminates ambiguity in parameter resolution across global, control, component, and statement scopes.
- **Robust Security Inheritance**: Enables transparent documentation of cloud shared responsibility models.
- **High Testability & Maintainability**: Pure action functions and polymorphic adapters allow isolated unit testing and clean separation of concerns.
