# DD-011: Properties vs. Parameters — Conceptual Separation and Metadata Page Restructuring

## Status: Proposed
## Date: 2026-07-20
## Decision Makers: Philip (Product Owner), Agent (Architect)

## Context

The current Metadata tab in the Document Overview conflates two concerns:
1. **Document-level metadata** (title, version, roles, parties, etc. + `metadata.props`)
2. **Aggregated property usage analysis** ("Properties Used in Controls & Groups") — a statistical overview of all `prop` name/value pairs used across controls and groups

This is confusing because OSCAL defines **Properties** and **Parameters** as fundamentally different concepts, and `metadata.props` does not cascade to controls. The "Add as global property" button incorrectly suggests that adding a property to `metadata.props` would define a template that applies to controls.

### OSCAL Properties (props) — Static Annotations
- Simple name/value pairs (`{ name, value, ns?, class?, uuid? }`)
- Describe/annotate the containing object (label, sort-id, status, marking)
- Defined **directly on each object** (control, group, part, param, metadata)
- NOT inserted into control text; NOT overridable in a cascade
- OSCAL does NOT define a "global property template" mechanism

### OSCAL Parameters (params) — Dynamic Placeholders
- Complex structure (`{ id, label, values[], select?, constraints?, guidelines? }`)
- Inserted into control text via `{{ insert: param, id-ref }}` / `<insert type="param" id-ref="..."/>`
- Support hierarchical inheritance (catalog → group → control)
- Overridable in profiles (`set-parameters`) and SSPs

## Decisions

### 1. Clear Conceptual Separation in the UI

The UI must clearly communicate that Properties and Parameters are different OSCAL concepts:

- **Properties** = metadata annotations on objects (static, descriptive)
- **Parameters** = dynamic placeholders in control text (overridable, inserted into prose)

These are presented in separate navigation sections and never conflated.

### 2. Metadata Tab: Document-Level Only

The **ℹ️ Metadata** sidebar item shows exclusively document-level metadata:
- MetadataEditor fields (title, version, OSCAL version, roles, parties, locations, document-ids, remarks, revisions)
- `metadata.props` as **"Document Properties"** — properties that describe the document itself (e.g., `marking`, `publication-status`, `generated-by`, `framework-identifier`)

The "Properties Used in Controls & Groups" aggregation is **removed from the Metadata tab**.

### 3. Separate "Properties" Sidebar Navigation Item

A dedicated **🏷️ Properties** sidebar item (as already specified in US 0.13) provides:

1. **Properties Dashboard Metrics:**
   - **Global Header Properties:** Number of properties declared in `metadata.props`
   - **Element Properties:** Number of distinct property names assigned across tree elements
   - **Unique Keys:** Total unique property keys in the document
   - **Total Assignments:** Total property occurrences assigned across all tree elements
2. **Unified Property Concept (Option A):** All properties across the document (both `metadata.props` header properties and tree element properties) are unified under the single **`🏷️` Property** identity. Artificial `🌐` and `🌳` sub-icons are removed for maximum UI simplicity and low cognitive load.
3. **Element Properties (PropsEditor) & Control Header:** All property badges/pills rendered across controls, groups, sub-controls, and parts in `PropsEditor.jsx` (both read-only and edit mode) feature a `🏷️` icon prefix. Action buttons (`🔧` Advanced Settings and `🗑️` Delete) cleanly fade in onHover with `auto` container width in CSS (eliminating the old 28px clipping bug). The `🔧` wrench icon features uniform, consistent styling across all property pills (highlighting only when clicked open). Input field widths for `id`, `class`, `name`, and `value` guarantee extra character padding.
4. **Unified Icon Taxonomy:**
   - **`🏷️` Properties:** Reserved exclusively for property-related tabs, cards, pills, and actions.
   - **`⚙️` Parameters:** Reserved exclusively for parameters (sidebar navigation, Add Parameter button).
   - **`🔧` Advanced Property Settings:** Replaces gear in `PropsEditor.jsx` for settings (`ns`, `class`, `remarks`).
   - **`ℹ️` Metadata:** Reserved exclusively for document metadata.

### 4. Removal of "Promote to Global Property" Concept

The "➕ Add as global property" button is removed because:
- Adding a property to `metadata.props` does NOT create a template or cascade
- `metadata.props` describes the *document*, not its controls
- Property names used on controls (like `label`, `sort-id`) are defined by the OSCAL spec, not by `metadata.props`

Instead, the Property Usage Overview provides **consistency insights** (which property names are used, with what frequency).

### 5. Property Name Suggestions Remain

The existing autocomplete functionality in `PropsEditor` (suggesting property names already used in the catalog) is retained and enhanced. This is a **tool-level convenience** that does not rely on `metadata.props` as a registry.

## Consequences

- **Clearer mental model:** Users understand that Properties annotate objects and Parameters fill in control text
- **OSCAL-correct behavior:** `metadata.props` is no longer misrepresented as a property template system
- **US 0.13 compliance:** The sidebar structure now matches the specified navigation items
- **Breaking change:** The "Promote to global property" button is removed; users who relied on `metadata.props` as a property registry will need to adapt
- **Migration:** Existing `metadata.props` entries that were "promoted" from controls remain valid OSCAL (they just don't cascade) — no data migration needed
