# DD-012: Parameter Value Assignment, Selection UI, and Profile Override Strategy

## Status: Proposed
## Date: 2026-07-21
## Decision Makers: Development Team

## Context
OSCAL security controls contain parameters (`param`) that define dynamic placeholders in security requirement statements. In Reposol, parameters can be defined in Catalogs (at catalog, group, or control level) and tailored in Profiles (`modify.set-parameters`).

Previously, parameter editing lacked explicit architectural rules for:
1. **Catalog vs. Profile UX Parity:** How parameter value fields, choice selection dropdowns, and validation constraint displays function across `mode="catalog"` and `mode="profile"`.
2. **Dual-Mode Choice Dropdown & `values[]` Synchronization:** How selecting an item from `select.choice` maps to the OSCAL `values[]` array vs custom value entry.
3. **OSCAL Schema Serialization & Purging Strategy:** OSCAL JSON schema requires `minItems: 1` for arrays (`values`, `select.choice`, `set-parameters`). Empty arrays (`values: []`, `set-parameters: []`) cause schema validation failures.
4. **Resolution Engine Merging Rules:** How `profile-resolver.js` merges `modify.set-parameters` override objects with source catalog parameters during `resolveProfileSync()`.

## Decisions

### 1. Parameter Card & Editor UX in Catalog vs. Profile Modes
We extend `ParameterEditor.jsx` and `ControlDetailView.jsx` to use a polymorphic data binding adapter:

- **Catalog Mode (`mode="catalog"`):**
  - Parameter changes directly mutate the source parameter object (`catalog.params`, `group.params`, or `control.params`).
  - Edits to default values update `param.values`.
  - Edits to selection rules update `param.select` (`how-many` and `choice[]`).
  - Edits to constraints or guidelines update `param.constraints[]` and `param.guidelines[]`.

- **Profile Mode (`mode="profile"`):**
  - Parameters display resolved values from the underlying catalog as baseline defaults.
  - Edits to parameter attributes do NOT mutate the catalog parameter; instead, they generate or update an entry in `profile.modify.set-parameters[]` matching `param-id`.
  - Visual indicators clearly distinguish overridden fields (e.g. `[Overridden]` badge) and provide a "Revert to Default" action.

### 2. Dual-Mode Synchronization: Choice Dropdown (`select.choice`) vs. `values[]`
Parameter value input rendering adapts dynamically to parameter metadata:

- **Single-Choice (`select.how-many: "one"`):**
  - Renders a single-select dropdown (`<select>`) populated with `select.choice[]` options plus a `"Custom Value..."` option.
  - Selecting a choice updates `values: [selectedChoice]`.
  - Selecting `"Custom Value..."` reveals a text input field, allowing free-text entry which serializes to `values: [customInputValue]`.

- **Multi-Choice (`select.how-many: "one-or-more"`):**
  - Renders a multi-select checkbox group or multi-select dropdown with options from `select.choice[]`.
  - Selecting options updates `values: [choice1, choice2, ...]`.

- **Free-Text Parameter (No `select`):**
  - Renders a debounced text input control.
  - Single value input maps to `values: [inputValue]`.
  - Comma-separated or tag-style input maps to multi-element string array `values: ["val1", "val2"]`.

- **Synchronization Rule:**
  Changing `select.choice` in catalog mode retains existing `values` if the value is in `choice[]`; if not, `values` falls back to `[choice[0]]`. In profile mode, choice selection sets `set-parameters[].values = [selectedValue]`.

### 3. Serialization and `remove_empty_arrays` Purging Strategy
To guarantee 100% NIST OSCAL schema compliance (`minItems: 1` constraint):

- **Catalog Serialization:**
  - If a parameter's `values` array is empty (or whitespace-only string), the `values` key is removed from `param` prior to serialization.
  - Empty `choice`, `constraints`, or `guidelines` arrays are purged.

- **Profile `set-parameters` Serialization:**
  - If a parameter override sets `values` to empty/default (via "Revert to Default"), `values` is removed from that parameter's override object in `modify.set-parameters[]`.
  - If all override fields for a `param-id` are reverted to default, the entire entry is removed from `modify.set-parameters[]`.
  - Prior to profile JSON serialization, a global purge helper (`remove_empty_arrays`) cleans empty `set-parameters` arrays (`"set-parameters": []`) and empty nested arrays.

### 4. Profile Resolution Engine (`profile-resolver.js`) Override Merging Rules
During `resolveProfileSync()`, when compiling the resolved catalog:

1. **Parameter Lookup & Indexing:**
   - The engine builds an override map from `profile.modify.set-parameters[]` indexed by `param-id`.

2. **Attribute Override Order:**
   - For each parameter in the resolved catalog/control:
     - **`values`:** If `set-param.values` exists, it replaces `param.values`. If `set-param.values` is absent, `param.values` remains unchanged from the source catalog.
     - **`select`:** If `set-param.select` exists, it replaces `param.select`.
     - **`label` & `usage`:** If `set-param.label` / `usage` exist, they override `param.label` / `param.usage`.
     - **`constraints` & `guidelines`:** If `set-param.constraints` / `guidelines` exist, they override or merge with source constraints/guidelines.

3. **Prose Placeholder Resolution (`{{ insert: param, param_id }}`):**
   - When resolving prose parts, `<insert type="param" id-ref="param_id"/>` or `{{ insert: param, param_id }}` evaluates using the merged parameter's active `values[0]`.
   - If `values` is empty/undefined, the engine renders `param.label` surrounded by brackets `[Param Label]` as a fallback placeholder.

### 5. Clear Visual UX Structure: Essential Top-Row Fields vs. Optional Metadata
To provide maximum clarity and efficiency when expanding a parameter card:
- **Top Row (Core Essential Fields / Hauptfelder):**
  - **Top Left:** Parameter ID (`param-id` / `id`) input (editable in catalog mode, editable for new profile parameters, disabled with badge for inherited catalog parameters in profile mode).
  - **Top Right:** Parameter Value Assignment (free-text `values[]` input or choice selection dropdown/checkboxes if `select.choice` exists).
  - High-prominence, distinct container highlighting essential fields.
- **Secondary Row (Label & Usage):** Parameter Label/Title (`label`) and Usage Description (`usage`). The `usage` description field is rendered using `ProseWithParams`, enabling parameter cross-referencing and caret-relative parameter insertion.
- **Collapsible / Grouped Section (⚙️ Advanced & Optional Metadata):** Optional metadata fields (Class, Depends On, Choice options configuration, Regex Constraints, Guidelines, Links, and Properties) are clearly categorized and separated under an optional section. The `guidelines.prose` field within Guidelines is also rendered using `ProseWithParams`.

### 6. Profile-Level Parameter Creation (`➕ Add Parameter`)
Profile authors are permitted to add new parameters (`➕ Add Parameter`) directly within the Profile Tailoring editor (`mode="profile"`):
- Adding a parameter creates a new `set-parameter` entry in `profile.modify['set-parameters']` with a unique ID (e.g. `param-1`), editable label, usage, and value assignment.
- The new profile parameter is immediately registered in the active control's parameter list and can be inserted into custom control prose modifications (`{{ insert: param, param_id }}`).

### 7. Prose Parameter Badging & Guidance Tooltips
Embedded parameter placeholders (`{{ insert: param, param_id }}`) in control prose render visually as classic blue Chips (`.control-param-insert`):
- **Unset Parameters:** Displayed with square brackets `[Label or ID]`.
- **Set Parameters:** Displayed directly in green (`color: #059669`, `background: rgba(16, 185, 129, 0.15)`).
- **On-Hover Tooltip:** Displays Parameter header (`Parameter: <param_id>`), Status (`Status: Set ("value")` / `Status: Unset`), and Guidance prose if available.
- **Click-to-Scroll:** Clicking a parameter chip smooth-scrolls directly to the corresponding `#param-card-<id>`.

### 8. DocumentOverview Parameters Tab Scope Differentiation (Catalog vs. Profile Mode)
The Parameters tab in `DocumentOverview.jsx` provides explicit visual context explaining the fundamental architectural difference between Catalog and Profile mode:
- **Catalog Mode (`mode="catalog"`):** Manages root-level Global Parameters (`catalog.params`). It highlights that Global parameters inherit across all groups and controls, while Group and Control parameters are managed in their respective sections.
- **Profile Mode (`mode="profile"`):** Acts as a **Central Profile Directory / Parameter Overrides Hub (`profile.modify['set-parameters']`)**. In Profile mode, the directory exclusively lists parameters that have actually been modified, customized, or custom-created in the profile, eliminating clutter from unmodified catalog defaults. These modified parameters are grouped into distinct visual sub-sections by baseline scope (`🌐 Global`, `📁 Group`, `🎯 Control`, `➕ Custom`).

### 9. Profile Parameter Removal (`alters.removes`) & Restoration Strategy
In accordance with the OSCAL Profile Metaschema (`remove.by-id` targeting `param`):
- **Catalog Default Parameter Deletion in Profiles:** Clicking the delete trashcan (`🗑`) on an inherited catalog default parameter in profile mode generates a `remove` entry under `profile.modify.alters` for the control (e.g. `{ "by-id": "param_id" }`).
- **Transparent Removed Visual State:** In profile edit mode, removed catalog parameters are NOT hidden; instead, they are rendered in an explicit grayed-out "Removed" state (strikethrough ID, red `Removed` badge, and a `↩ Restore` button).
- **Restoration:** Clicking `↩ Restore` removes the parameter's `by-id` entry from `alter.removes`, returning the parameter to its default active catalog baseline state.

### 10. Referenced Parameter Deletion Prevention
To prevent orphan parameter references and broken prose placeholders:
- A parameter (whether custom or catalog-default) CANNOT be deleted if it is currently in use.
- Deletion is strictly blocked and an informative alert is displayed if:
  1. The parameter ID is referenced in control statement prose (`{{ insert: param, ID }}` or `[ID]`) in either the Profile document or the source Catalog document (`catalogDocument`).
  2. The parameter ID is declared as a dependency (`depends-on`) by another parameter.

## Consequences

- **Architectural & Visual Clarity:** Establishes explicit visual separation in `ParameterCard` between assigning parameter values vs. adapting parameter definitions/metadata.
- **Zero Schema Failures:** Eliminates `minItems: 1` validation errors across Catalog and Profile documents by enforcing automatic purging of empty arrays.
- **UI Parity:** Provides unified rendering components in `ControlDetailView.jsx` and `ParameterEditor.jsx` for both catalog creation and profile baseline tailoring.
- **Predictable Resolution:** Standardized merging logic in `profile-resolver.js` ensures resolved catalogs accurately reflect baseline overrides.
- **OSCAL Compliant Removal & Deletion Safety:** Fully supports catalog parameter removal via `alter.removes` while guaranteeing deletion safety against referenced parameters.
