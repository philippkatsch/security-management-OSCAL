# Step 8: Detailed User Stories – Control Mapping (Mapping Collection)

* **Persona:** Alice (Compliance Officer / Framework Developer)
* **Goal:** Create, manage, and analyze OSCAL `mapping-collection` documents to establish and document semantic, functional, or syntactic relationships between different cybersecurity framework resources (catalogs or profiles), while thoroughly tracking provenance, confidence scoring, and gap analysis.

## 1. Breakdown of User Stories

### US 8.1: Mapping Document Creation & Inner View (US 0.14)
> **As a** Compliance Officer
> **I want to** create a new OSCAL `mapping-collection` document and access its inner workspace view
> **so that** I have a dedicated, isolated environment to define and review mappings between two or more security frameworks without interfering with other platform data.

### US 8.2: Mapping Provenance & Methodology Declaration
> **As a** Compliance Officer
> **I want to** define the `mapping-provenance` (JSON key `provenance`) at the document level
> **so that** I can declare the overarching `method` (`human`, `automation`, `hybrid`), `matching-rationale` (`syntactic`, `semantic`, `functional`), `status` (`complete`, `not-complete`, `draft`, `deprecated`, `superseded`), an extensive `mapping-description`, and the `responsible-parties` for the entire mapping exercise.

### US 8.3: Source & Target Resource Declaration
> **As a** Framework Developer
> **I want to** specify the `source-resource` and `target-resource` for each mapping entry within the `mappings` array
> **so that** I can explicitly define the baseline `type` (`catalog`, `profile`), its `href` URI, and the `ns` (namespace, default `http://csrc.nist.gov/ns/oscal`) being compared.

### US 8.4: Mapping Entry Creation with Relationship Types
> **As a** Compliance Officer
> **I want to** create individual `maps` defining exact relationships between source and target items
> **so that** I can categorize the mapping mathematically using one of the six allowed `relationship` tokens (`equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`).

### US 8.5: Source & Target Item References
> **As a** Framework Developer
> **I want to** select `sources` and `targets` for each map by linking to specific control or statement identifiers
> **so that** I can represent 1:1, 1:N, or N:1 mappings accurately, noting the `type` as either `control` or `statement`, and supplying the exact `id-ref`.

### US 8.6: Relationship Qualifiers
> **As a** Compliance Officer
> **I want to** add `qualifiers` to a map where direct mapping requires additional conditions
> **so that** I can specify the `subject` (`source`, `target`, `both`), `predicate` (`has-requirement`, `has-incompatibility`), `category` (`restricted`, `addressable`, `blocked`), and a detailed `description` of the condition.

### US 8.7: Confidence Scoring
> **As a** Framework Developer
> **I want to** assign a `confidence-score` at the `mapping-provenance`, `mapping`, or `map` level
> **so that** I can indicate the reliability of the mapping either via a category (`unspecified`, `high`, `medium`, `low`) or a precise decimal percentage (0.0 to 1.0).

### US 8.8: Coverage Tracking
> **As a** Compliance Officer
> **I want to** document the `coverage` of the mapping effort (0.0 to 1.0)
> **so that** I can clearly communicate what proportion of the framework was successfully mapped and the arbitrary `generation-method` used to calculate this metric.

### US 8.9: Gap Summary & Unmapped Controls
> **As a** Compliance Officer
> **I want to** define a `source-gap-summary` and `target-gap-summary` within a mapping
> **so that** I can list `unmapped-controls` that exist in one framework but lack any relationship in the other, ensuring transparent gap documentation.

### US 8.10: Automatic Gap Analysis & Coverage Report
> **As a** Framework Developer
> **I want to** view an automatically generated system report that compares my established `maps` against the resolved source/target frameworks
> **so that** I can visually identify unmapped controls and receive calculated coverage statistics to validate my manual gap summaries.

### US 8.11: Mapping Visualization (Matrix & Sankey Diagrams)
> **As a** Compliance Officer
> **I want to** visualize relationships between source and target frameworks using an interactive Matrix grid and a dynamic Sankey flow diagram with seamless view toggling
> **so that** I can easily present mapping topology, cross-framework control coverage, relationship types, and unmapped control gaps to external auditors and stakeholders.

### US 8.12: Mapping Overrides
> **As a** Framework Developer
> **I want to** be able to override the provenance defaults (`method`, `matching-rationale`, `status`) at the specific `mapping` or `map` level
> **so that** I can accommodate exceptions where a single map or mapping group was performed via `human` method when the overarching provenance was `automation`.

### US 8.13: Mapping Table & Navigation (US 0.18)
> **As a** Compliance Officer
> **I want to** use a sortable, filterable data table for all `maps` inside the `mapping-collection`
> **so that** I can search by source/target ID, filter by `relationship` type, or sort by `confidence-score` to efficiently manage hundreds or thousands of mapping entries.

### US 8.14: Document Overview & Tags (US 0.16)
> **As a** Compliance Officer
> **I want to** view document `metadata` including remarks, roles, and props (tags)
> **so that** I can easily label, search, and manage the `mapping-collection` lifecycle inside the platform workspace.

### US 8.15: In-Card Editing & Draft Persistence (US 0.17)
> **As a** Compliance Officer
> **I want to** edit mapping details within slide-out panels or expansion cards that auto-save drafts
> **so that** I can map complex statement relationships or write qualifier descriptions without fear of losing unsaved work if I navigate away.

### US 8.16: Integrated Backend Versioning (US 0.15)
> **As a** Framework Developer
> **I want to** explicitly publish new versions of the `mapping-collection`
> **so that** historical mappings are preserved and system-wide references to previous mapping iterations remain intact.

### US 8.17: Back-Matter & Resource Attachments
> **As a** Compliance Officer
> **I want to** attach supporting files, scripts, or methodology documents in the `back-matter`
> **so that** automated mapping tools, reference papers, or supplementary evidence used for the mapping exercise are directly bundled with the OSCAL file.

## 2. Workflow & User Journey

1. **Initialization:** Alice creates a new `mapping-collection` document. The system generates a `uuid` and requires basic `metadata` (title, version, last-modified).
2. **Methodology Declaration:** She fills out the mandatory `mapping-provenance` block, defining whether the effort is `human` or `automation`, the general `matching-rationale`, its current `status`, and assigning `responsible-parties`.
3. **Defining Mappings:** Alice adds a mapping block (`mappings`). She sets the `source-resource` (e.g., NIST SP 800-53 Catalog) and `target-resource` (e.g., ISO 27001 Catalog).
4. **Creating Maps:** Within the mapping block, she begins adding `maps`. For each map, she specifies:
   - The `relationship` (e.g., `intersects-with`).
   - The `sources` (`type`: `control`, `id-ref`: `ac-2`).
   - The `targets` (`type`: `control`, `id-ref`: `A.9.2.1`).
5. **Adding Depth:** Where needed, Alice defines `qualifiers` indicating conditions (e.g., source requires an additional component not found in the target), overrides the provenance defaults, and provides a `confidence-score`.
6. **Gap Summary:** After completing the mappings, she uses platform tooling to generate or manually enter `source-gap-summary` and `target-gap-summary`, declaring which controls explicitly have no mappings.
7. **Review & Publish:** She uses matrix visualizations to review the full relationship mapping, verifies her `coverage` metrics, and publishes the document version (DD-002 valid).

## 3. Functional Requirements

### 3.1 `mapping-collection` Root Requirements
*   **`uuid`**: Required (auto-generated).
*   **`metadata`**: Required (1..1).
*   **`mapping-provenance`** (JSON key: `provenance`): Required (1..1). Document-level defaults.
*   **`mappings`**: Required (1..*). Array of mappings between specific resources.
*   **`back-matter`**: Optional (0..1).

### 3.2 `mapping-provenance` Data Constraints
*   **`method`**: Required (flag). Allowed values: `human`, `automation`, `hybrid`.
*   **`matching-rationale`**: Required (flag). Allowed values: `syntactic`, `semantic`, `functional`.
*   **`status`**: Required (flag). Allowed values: `complete`, `not-complete`, `draft`, `deprecated`, `superseded`.
*   **`confidence-score`**: Optional (0..1). Evaluated as either:
    *   category: `unspecified`, `high`, `medium`, `low` (allows other).
    *   percentage: decimal `0.0` to `1.0`.
*   **`coverage`**: Optional (0..1). Decimal `0.0` to `1.0` with arbitrary `generation-method` string.
*   **`mapping-description`**: Required (1..1, markup-multiline).
*   **`responsible-parties`**: Optional (0..*).

### 3.3 `mapping` Entry Elements
*   **`uuid`**: Required.
*   **Overrides**: `method`, `matching-rationale`, `status` (Optional. If present, overrides provenance defaults).
*   **`source-resource`** / **`target-resource`**: Required (1..1).
    *   `type`: Required. Allowed values: `catalog`, `profile` (allows other).
    *   `href`: Required (uri-reference).
    *   `ns`: Optional (default `http://csrc.nist.gov/ns/oscal`).
*   **`maps`**: Required (1..*). Array of mappings.
*   **Gap Summaries**: `source-gap-summary` and `target-gap-summary` (Optional 0..1). Must contain `unmapped-controls` (1..*) containing `control-id` references.

### 3.4 `map` Level Constraints
*   **`uuid`**: Required.
*   **`relationship`**: Required (1..1, token). Allowed values: `equivalent-to`, `equal-to`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`.
*   **`sources`** / **`targets`**: Required (1..*).
    *   `type`: Required. Allowed values: `control`, `statement`.
    *   `id-ref`: Required (string).
*   **`qualifiers`**: Optional (0..*).
    *   `subject`: Required. Allowed values: `source`, `target`, `both`.
    *   `predicate`: Required. Allowed values: `has-requirement`, `has-incompatibility`.
    *   `category`: Required. Allowed values: `restricted`, `addressable`, `blocked`.
    *   `description`: Required (1..1, markup-multiline).

## 4. Functional Acceptance Criteria (Summary)

- [ ] **US 8.1: Mapping Document Creation & Inner View (US 0.14)**
  - [ ] **Validation:** The system mandates exactly one `metadata` and exactly one `mapping-provenance` block per document.
  - [ ] **Root Array:** The system ensures at least one entry exists in the `mappings` array before validation passes.

- [ ] **US 8.2: Mapping Provenance & Methodology Declaration**
  - [ ] **Provenance Enforcement:** The UI enforces selection of `method`, `matching-rationale`, and `status` from exact predefined OSCAL allowed lists.
  - [ ] **Description Editor:** The `mapping-description` field renders as a rich-text markup-multiline editor.

- [ ] **US 8.3: Source & Target Resource Declaration**
  - [ ] **Resource Reference Handling:** `source-resource` and `target-resource` must have a defined `type` (`catalog` or `profile`) and a valid `href` URI.

- [ ] **US 8.4: Mapping Entry Creation with Relationship Types**
  - [ ] **Relationship Enum:** `relationship` token must be strictly selected from the 6 allowed values (equivalent-to, equal-to, subset-of, superset-of, intersects-with, no-relationship).

- [ ] **US 8.5: Source & Target Item References**
  - [ ] **Multi-Item References:** `sources` and `targets` allow adding multiple items (1:N, N:1, N:M mappings supported).
  - [ ] **Type Enforcement:** The system enforces `type` (`control` or `statement`) for all `sources` and `targets`.

- [ ] **US 8.6: Relationship Qualifiers**
  - [ ] **Qualifiers Integration:** A map can accept multiple `qualifiers` with strict dropdowns for `subject`, `predicate`, and `category`.
  - [ ] **Description Requirement:** Every qualifier requires a markup-multiline `description`.

- [ ] **US 8.7: Confidence Scoring**
  - [ ] **Confidence Input:** `confidence-score` UI allows toggling between 'Category' mode (enum) and 'Percentage' mode (decimal 0.0 to 1.0 validation).

- [ ] **US 8.8: Coverage Tracking**
  - [ ] **Coverage Validation:** `coverage` UI restricts decimal inputs to `0.0-1.0` range.

- [ ] **US 8.9: Gap Summary & Unmapped Controls**
  - [ ] **Gap Logging:** `source-gap-summary` and `target-gap-summary` allow appending `unmapped-controls` lists.

- [ ] **US 8.10: Automatic Gap Analysis & Coverage Report**
  - [ ] **Visual Report:** The platform offers a visual report highlighting unmapped controls vs. defined maps.

- [ ] **US 8.11: Mapping Visualization (Matrix & Sankey Diagrams)**
  - [ ] **Matrix & Sankey View Toggle:** The system MUST provide a view mode switcher on the Stage 8 Mapping page allowing users to toggle between Matrix View and Sankey Flow Diagram view seamlessly.
  - [ ] **3-Column Topological Flow:** The Sankey diagram MUST render source controls on the left column, target controls on the right column, and flow links connecting them in the center.
  - [ ] **Color-Coded Relationship Flows:** Flow links MUST be color-coded according to the 6 relationship types (`equal-to`: purple, `equivalent-to`: green, `subset-of`: blue, `superset-of`: orange, `intersects-with`: yellow, `no-relationship`: red).
  - [ ] **Gap Representation:** Unmapped source and target controls MUST be visually represented in the Sankey diagram (e.g., dedicated gap node sections with distinct dashed or muted styling).
  - [ ] **Interactive Highlighting & Tooltips:** Hovering over any control node or flow link MUST highlight connected paths, dim unselected links, and display an interactive tooltip showing Source ID, Target ID, Relationship type, Confidence score, and Rationale.
  - [ ] **Filtering & Responsive Layout:** The Sankey diagram MUST respond to framework control filters (e.g., relationship filter) and fit within responsive container bounds without SVG clipping.

- [ ] **US 8.12: Mapping Overrides**
  - [ ] **Local Overrides:** The system MUST allow users to override `method`, `matching-rationale`, and `status` at the `mapping` or `map` level, overriding document-level provenance defaults.

- [ ] **US 8.13: Mapping Table & Navigation (US 0.18)**
  - [ ] **Table View:** A master mapping table supports filtering, search, and pagination (US 0.18).

- [ ] **US 8.14: Document Overview & Tags (US 0.16)**
  - [ ] **Document Overview:** Document adheres strictly to OSCAL strict validation (DD-002) for the `mapping-collection` schema, supporting root metadata tags and props.

- [ ] **US 8.15: In-Card Editing & Draft Persistence (US 0.17)**
  - [ ] **Slide-out Panels:** Uses slide-out panels (US 0.17 / DD-004) for detailed map configurations (qualifiers, local overrides).

- [ ] **US 8.16: Integrated Backend Versioning (US 0.15)**
  - [ ] **Versioning:** The system supports explicit publishing of new versions of the `mapping-collection`.

- [ ] **US 8.17: Back-Matter & Resource Attachments**
  - [ ] **Back-Matter Support:** Back-matter base64 attachment support is included (DD-007).

