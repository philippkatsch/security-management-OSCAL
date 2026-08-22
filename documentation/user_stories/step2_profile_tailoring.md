# Step 2: Detailed User Stories – Profile Tailoring

* **Persona:** Alice (Compliance Officer / Enterprise Architect)
* **Goal:** Creation of the organization-specific security baseline by mixing, filtering, fine-tuning, and compiling (resolving) requirements from various source frameworks.

---

## 1. Breakdown of User Stories

### US 2.1: Simplified Profile Creation & Direct Editing (Inner View)
> *Implements [US 0.14](step0_global_requirements.md) with profile-specific additions.*
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** be able to create a new profile by initially entering only the title and being forwarded immediately to the in-place editor area (Inner View),  
> **so that** I can configure the sources, structures, and metadata directly within the editing area without cumbersome preliminary wizards.
*   **Acceptance Criteria:**
    *   **Minimal Creation Window:** Clicking "New Profile" opens a simple dialog that requires only the entry of the document title.
    *   **Direct Redirection:** After clicking "Create Document," the profile is initialized in the backend and the user is redirected immediately to the editing view (`/profile/{uuid}?edit=true`) of this new document.
    *   **In-place Configuration:** All further settings (imported catalogs, structuring, other metadata) are performed directly in this inner view.

### US 2.2: Live Tailoring via Sidebar Checkboxes (Inclusion & Exclusion)
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** select and deselect controls directly in the left sidebar,  
> **so that** I can define the profile's inclusion and exclusion rules directly within the navigation structure.
*   **Acceptance Criteria:**
    *   **Active by Default:** When a catalog is imported, all of its controls are active by default and selected in the sidebar checklist.
    *   **Visual Feedback upon Deselection (Exclusion):** If a control is deselected in the sidebar, it is immediately visually represented as inactive (grayed out).
    *   **Live Update of Profile Rules:** Selecting or deselecting a control automatically adds or removes the corresponding inclusion or exclusion rule in the background, without requiring a page reload.
    *   **Include Sub-Controls (`with-child-controls`):** For each imported catalog, the GUI provides a toggle "Automatically include sub-controls" (`with-child-controls` = `yes`/`no`). The default value is `yes`. If `no` is selected, sub-controls (enhancements) must be activated individually.

### US 2.3: Global Parameter Assignments (`set-parameters`)
> *References DD-012*
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** override default parameter values of the imported catalogs across all catalogs,  
> **so that** uniform security boundaries (e.g., password lengths, review periods) are declared.
*   **Acceptance Criteria:**
    *   Entry and tailoring of organization-specific parameter values (`set-parameters`).
    *   **Unified Profile Parameter Creation (`➕ Add Parameter` & `➕ Define New Parameter...`):** Profile authors can create custom parameters directly in profile mode from any text field or parameter card. Selecting "Define New Parameter" instantly creates a new parameter entry in `modify.set-parameters` (associated with the control or group scope), inserts the parameter placeholder, and smooth-scrolls to the parameter editor.
    *   **1-Line Header & Visual Hierarchy:** `ParameterCard` presents a clean 1-line top row displaying Parameter ID (in blue), Label, and Assigned Value (in green when set). Expanding the card separates essential fields (ID & Value, Label & Usage) from optional metadata.
    *   **Prose Badging & Tooltips:** Embedded parameter placeholders in control prose render as blue Chips (`[Label]` if unset, green value if set). Hovering displays `Parameter: <id>`, `Status`, and `Guidance` in English; clicking smooth-scrolls to the Parameter Card.
    *   **Central Profile Overrides Hub:** The Parameters tab in DocumentOverview centrally lists exclusively modified, customized, or newly created profile parameters (`set-parameters`), categorized into clear scope sub-sections (Global, Group, Control, Custom) to avoid clutter from unmodified catalog defaults.

### US 2.4: Context-Aware Modification Tab — Inline Editing of Control Text with Transparent OSCAL Mapping
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** edit the original control text directly inline in the modifications tab (by simply clicking and modifying),  
> **so that** the system automatically calculates and saves the corresponding OSCAL-compliant `adds` and `removes` (alters) in the background without me having to deal with the OSCAL format or insertion positions such as `before ID` / `starting`.
*   **Acceptance Criteria:**
    *   **Filtering by Selection:** The modifications tab only displays controls that were activated via checkbox in Tab 1 (Control Selection). Excluded controls do **not** appear here.
    *   **Inline Prose Editing:** The individual paragraphs of the control text (statements and sub-statements) are rendered as input fields/textareas. The user can click directly into the text and edit it.
    *   **Transparent OSCAL Alters Mapping:** As soon as the text of a paragraph is changed, the system automatically creates in the background:
        *   A `removes` entry for the ID of the modified paragraph (to remove the old text).
        *   An `adds` entry with a new, unique ID and the new prose text. The insertion position references the original ID, so that the change appears at the same location, without `removes` deleting the added content as well.
        *   If the text is reverted to its original state, the corresponding entries are deleted in the background.
    *   **Visual Traceability (Edit vs. View Mode):** In Editor Mode, the original text that was replaced/removed via `alters.removes` is still displayed but clearly marked as struck through and visually disabled, so the user can trace exactly what was modified. In View Mode, this removed text is completely hidden.
    *   **Structural Additions (`alters.adds`):** The system must allow users to add entirely new elements (`props`, `params`, `links`, or `parts` representing statements/guidance) to a control at positions `starting`, `ending`, `before`, or `after`.
    *   **Strict Alters Boundaries:** The `alter` directive **cannot** and must not be used to add or remove subcontrols (enhancements).
    *   **Reset Function (Revert):** Next to each modified text field, a "Reset" button is displayed, allowing the user to discard text changes.
    *   **Recursive Resolution (Deep Alters):** The Profile Resolution Engine recursively applies `adds` and `removes` to deeply nested paragraphs correctly across all levels.
    *   **Inline Parameter Override:** Parameter values can be adjusted and overridden directly under the corresponding control (`set-parameters`).

### US 2.5: Local Custom Controls via Managed Catalog Import (OSCAL-compliant)
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** create my own custom controls directly in the profile without having to create an external catalog,  
> **so that** purely internal company requirements (e.g., onboarding training) are part of the baseline.
*   **Acceptance Criteria:**
    *   The UI still allows the creation of custom controls with ID, title, statement, and parameters.
    *   The controls are not saved in the profile: Instead, the backend creates or updates a managed, OSCAL-compliant catalog with these controls.
    *   The profile references the managed catalog exclusively via a regular `imports` entry. The saved profile does not contain any non-standardized `local-controls` field. **Strict Rule:** Arbitrary custom control objects cannot be defined directly within the profile schema structure.

### US 2.6: Profile Resolution Engine & Preview
> *References DD-003*
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** compile the profile and display the resolved rulebook,  
> **so that** I can instantly check and validate the overall result.
*   **Acceptance Criteria:**
    *   Calculation of the final state (resolving imports, applying filters, parameter overrides, alters, and custom groupings).
    *   Display of the resolved profile in a live preview (according to the chosen grouping directive).
    *   **Double Validation:** Both the profile document itself (against the Profile schema) and the resolved profile (against the Catalog schema) are strictly validated against the official NIST OSCAL JSON schemas stored locally in the backend.

### US 2.7: High-Level Restructuring and Grouping (Merge Phase) in the GUI
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** define the profile's merge directive, sort imported controls into self-created groups, and enrich these groups with custom metadata and text,  
> **so that** the final baseline follows a tailored, company-internal structure.
*   **Acceptance Criteria:**
    *   **Selection of the Merge Directive:** The user can choose between `as-is`, `flat`, and `custom` in the GUI. When saving, `merge` contains exclusively the chosen directive.
    *   **Creation of Custom Groups:** When `custom` is selected, the user can create, edit, and delete new groups with ID and title.
    *   **Nesting of Groups:** The GUI allows hierarchical nesting of groups.
    *   **Sorting Controls & Folders:** The user can move imported controls as well as entire categories/folders from the control pool into a custom group. Assignment is exclusive.
    *   **Insert Controls and Sorting:** Within each custom group, `insert-controls` can be used to specify which controls are included. The sorting order can be configured.
    *   **Include-All in Groups:** `insert-controls` supports `include-all`, `include-controls`, and `exclude-controls`.
    *   **Group Metadata & Texts:** For each created group, class attributes, custom properties/tags, reference links, parameters, and description texts can be defined.
    *   **Round-tripping:** The configured `custom` structure is correctly saved in the Profile JSON.
    *   **Resolution & Preview:** The Resolved Catalog in the live preview reflects the configured group structure and its group metadata.

### US 2.8: Parameter Selection Rules, Validations, and Constraints (select & choice) in the GUI
> *References DD-012*
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** specify value ranges, selection constraints, and validation checks for control parameters via the UI (`select`, `choice`, `constraints`, and `guidelines`),  
> **so that** downstream System Security Plans (SSPs) can only configure compliant values and receive guidance.
*   **Acceptance Criteria:**
    *   **Selection Constraint:** Definition of a list of allowed values (`choice`) and the number of allowed selection values (`how-many` = `one` or `one-or-more`) in the profile's GUI parameter editor.
    *   **Validation Tests:** Entering programmatic expressions (`constraints.tests.expression`) and error messages in the GUI for automatic validation of values in the SSP.
    *   **Guidelines:** Storing completion aids and guidelines (`guidelines.prose`) for selecting the parameter value via the GUI.
    *   **Round-tripping & Serialization:** Correct loading, saving, and serialization of all `select`, `constraints`, and `guidelines` objects in the Profile JSON under `modify.set-parameters`.

### US 2.9: Dynamic Filtering via Pattern Matching (matching) in the GUI
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** filter imported controls dynamically via patterns and configure them in the UI (`matching`),  
> **so that** I do not have to enter each control individually by ID into the inclusion/exclusion list.
*   **Acceptance Criteria:**
    *   **GUI Input of Patterns:** The user can enter wildcard patterns (e.g., `ac-*` or `s1.1.*`) into an input field in the GUI's import area.
    *   **Resolution Engine Resolution:** The resolution engine (`resolveProfileSync`) resolves these patterns and automatically imports all matching controls of the source catalog.
    *   **Schema Validation:** Export and validation of the `matching` entries in the JSON format of the imports.

### US 2.10: Assignment of Global Roles and Responsibilities (responsible-parties) in Metadata
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** declare organization-specific roles and link parties via the profile's global metadata (`responsible-parties`),  
> **so that** uniformly defined roles and responsibilities can be referenced throughout the document lifecycle.
*   **Acceptance Criteria:**
    *   **Role Management:** Creation of global roles (e.g., "System Administrator") in the metadata section via a GUI form.
    *   **Metadata Linking:** Assigning persons/teams (`parties`) to these roles (`responsible-parties`) in the profile's metadata form.
    *   **Standard-compliant Structure:** Storing the role and responsibility assignment exclusively in the standard-compliant metadata section of the profile, not directly on controls or in `alters.adds` blocks (as the OSCAL standard designates control-level assignments only in the System Security Plan (SSP)).

### US 2.11: Advanced Deletion of Control Components (removes) in the GUI
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** flexibly remove specific components of a control via the UI (`removes`),  
> **so that** inapplicable content or unwanted references are cleaned up from the rulebook.
*   **Acceptance Criteria:**
    *   **GUI Deletion Selectors (`alters.removes`):** The user can select the type of selector when adding a deletion rule in the UI: ID (`by-id`), name (`by-name`), element type (`by-item-name` with selection from `param`, `prop`, `link`, `part`, `mapping`, `map`), class (`by-class`), or namespace (`by-ns`).
    *   **Complete Removal Support:** The user can remove any existing structural element (`props`, `params`, `links`, or `parts`) of a control compliantly using these selectors.
    *   **Visual Traceability (Edit vs. View Mode):** Elements marked for deletion via `removes` are displayed as struck through (strikethrough) and visually disabled in Editor Mode to maintain full traceability of deletions. In View Mode, these elements are completely hidden.
    *   **Resolution Filtering:** During profile resolution, the resolution engine filters out all components of the control that match the selectors.
    *   **Round-tripping:** Correct saving and loading of `removes` directives in the Profile JSON.

### US 2.12: Collision and Merge Rules (merge.combine) in the GUI
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** define merge rules for conflicting control IDs via the GUI (`merge.combine`),  
> **so that** identical control definitions are cleanly merged or prioritized when importing from multiple catalogs.
*   **Acceptance Criteria:**
    *   **GUI Strategy Selection:** Choice of the combination strategy via a dropdown field in the merge area: `use-first` (use first definition), `merge` (merge definitions), or `keep` (keep all duplicates).
    *   **Collision Handling:** The resolution engine handles ID duplicates in accordance with the selected strategy.

### US 2.13: Integrated Profile Versioning in the Backend
> *Implements [US 0.15](step0_global_requirements.md) with profile-specific additions.*
> **As a** Compliance Officer (Alice)  
> **I want to** manage versions of a profile in the backend while adhering to strict OSCAL compliance,  
> **so that** version states are saved persistently and compliantly.
*   **Acceptance Criteria:**
    *   Applies the global versioning pattern **US 0.15** fully (schema validation, version synchronization, error feedback, drawer, read-only history).
    *   **Profile-specific:** The document is validated against the official NIST OSCAL Profile schema.
    *   **Revision Sync:** Upon saving, `profile.metadata.revisions[]` is automatically updated (in accordance with US 0.7).

### US 2.14: Assignment in the Right Pane (Document Overview) & Default Structure in the Sidebar

> **As a** Compliance Officer (Alice)
> **I want to** configure the catalog imports (source assignment) and edit metadata in the right main pane (Document Overview), while configuring the group structure (Default Structure) clearly at the top of the sidebar,
> **so that** the operation is intuitively partitioned and changes to the sources immediately affect the control navigation live.

*   **Acceptance Criteria:**
    *   **Right Main Pane (Document Overview):**
        *   Displayed when no control is selected on the left (Document Overview active).
        *   **Baseline Summary Header:** A fixed dashboard at the top of the Document Overview continuously visualizes current statistics (number of controls, parameters, modifications).
        *   **Divided into 4 horizontal subtabs:** **Import Sources** (Imported Catalogs, shown only in edit mode), **Metadata**, **Tags**, and **Back-matter**.
        *   **Edit/View Mode:** Analogous to the Catalog Editor, there is a global edit/view mode ("✏️ Edit"). Configuring import sources is accessible exclusively in this mode.
        *   **Live Update of Imports:** Selecting a catalog in the checklist immediately loads it in the background and adds its controls to the sidebar. Deselecting immediately removes the catalog and its controls.
        *   **Import Mode Toggle:** For each imported catalog, the mode can be toggled between `include-all` (import all controls, default) and `include-controls` (import only selected controls by ID/pattern). The active mode is visually indicated.
    *   **Left Sidebar (Navigation & Default Structure):**
        *   **Default Structure Dropdown:** Positioned at the very top of the left sidebar. Allows selecting which imported catalog dictates the default folder structure (or `None (Flat List)`).
            *   **Automatic Source Selection:** If exactly **one** catalog is imported, it is automatically preselected as the `Default Structure` and its group structure is loaded.
            *   **Reset Behavior:** If a second catalog is added or all catalogs are deselected, the dropdown is automatically reset to `-- Choose Structure --` (empty).
            *   **Reversion Selection:** If multiple imported catalogs are reduced back to exactly one catalog, this remaining catalog is automatically preselected as the `Default Structure`.
        *   **Automatic Categorization:** Controls of the selected default-structure catalog are sorted into their respective standard categories. Controls from all other imported catalogs are automatically listed at the bottom under **Unassigned Controls**.
        *   **No Quick Setup Pop-ups:** Obsolete Quick Setup logic and intermediate pop-ups are removed. All structure and activity states are manipulated directly and live within the sidebar and the main pane.


### US 2.17: Profile Parameter Overrides (`modify.set-parameters`) & Dropdown Value Selection
> *References DD-012*

> **As a** lead enterprise architect (Alice)  
> **I want to** configure parameter overrides in the Profile Builder using interactive choice dropdowns and validated value inputs,  
> **so that** I can customize baseline parameters with explicit `modify.set-parameters` entries while maintaining clean fallback to catalog defaults and zero schema pollution.

*   **Acceptance Criteria:**
    *   **Profile Parameter Overrides (`set-parameters`):** Overriding a parameter in Profile mode creates or updates an entry in `profile.modify.set-parameters[]` matching the parameter's `param-id`. Supported override attributes include `values[]`, `label`, `class`, `select`, `constraints`, `guidelines`, `remarks`, `usage`, custom properties (`props`), and reference links (`links`).
    *   **Dropdown Selection for Predefined Choices:** If the source parameter defines `select.choice` with `how-many: "one"`, a dropdown selection field (`<select>`) is rendered populated with `select.choice[]` options plus a "Custom Value..." option.
    *   **Multi-Choice Support:** If `select.how-many` is `"one-or-more"`, a multi-select checkbox group or multi-select dropdown is rendered. Selecting multiple options serializes as a multi-element string array in `set-parameters[].values`.
    *   **Dual-Mode Choice & Value Synchronization:** Selecting an option from the choice dropdown directly synchronizes with `set-parameters[].values = [selectedValue]`.
    *   **Catalog Fallback:** When a parameter has no override entry in `modify.set-parameters[]`, the Profile Resolution Engine (`resolution_service.py` / `resolveProfileSync`) transparently falls back to the source catalog parameter's default `values[]` (or `select.choice` default).
    *   **Revert & Override Removal:** A "Revert to Default" action or clearing an override input removes the parameter's `param-id` entry from `modify.set-parameters[]` (or strips the `values` property if other modified attributes like `label` remain).
    *   **Catalog Parameter Removal in Profiles (`alters.removes`):** Inherited catalog default parameters can be removed in profile mode by clicking `🗑`. This generates a `{ "by-id": "param_id" }` removal entry under `profile.modify.alters` for the control.
    *   **Transparent Removed Visual State:** Removed catalog parameters remain visible in edit mode with a grayed-out card, strikethrough ID, red `Removed` badge, and a `↩ Restore` button to remove the `alter.removes` entry.
    *   **Referenced Parameter Deletion Prevention:** Parameter deletion (custom or catalog default) is strictly blocked and triggers an informative browser alert if the parameter ID is referenced in control statement prose (`{{ insert: param, ID }}` or `[ID]`) in either the profile or the source catalog document, or listed as a dependency (`depends-on`).
    *   **Empty Structure Purging:** Saving or serializing a profile automatically purges empty `set-parameters` arrays and empty `values` arrays within `set-parameters` objects, preventing schema validation failures (`minItems: 1`).
    *   **Regex & Constraint Validation:** Parameter values entered in profile mode are validated against regex test expressions (`constraints.tests.expression`). Violations trigger visual error highlights (red border) and display the constraint's `remarks` text below the input field.

### US 2.18: Profile Resolution Export
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** export a resolved profile (Resolved Profile) as an independent OSCAL catalog and save it in the system,  
> **so that** I can use the final, merged control selection as a stable, versionable baseline document for SSPs.
*   **Acceptance Criteria:**
    *   The Profile Resolution Engine (US 2.6) can save the result as a new catalog in the system.
    *   The exported catalog contains all resolved controls, parameter assignments, and modifications.
    *   **Catalog Schema Validation:** The exported catalog must be validated against the official NIST OSCAL Catalog Schema (located locally under `reposol/backend/app/schemas/`). It is only saved if it is fully compatible.
    *   The catalog is saved with its own UUID and versioning and appears in the catalog list.
    *   A reference to the source profile is documented in the metadata of the generated catalog.

### US 2.19: Profile Back-Matter and Resource Management
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** manage back-matter resources (`back-matter.resources`) in the profile editor,  
> **so that** reference documents, citations, and attachments can be stored directly within the profile document and referenced by controls.
*   **Acceptance Criteria:**
    *   **Resource CRUD:** In the Document Overview, there is a tab or section for managing back-matter resources. Resources can be added, edited, and deleted.
    *   **Full OSCAL Fields:** Support for all resource fields: UUID, title, description, properties, document IDs, citations (`citation`), resource links (`rlinks` with href, media-type, hashes), and embedded Base64 attachments.
    *   **Linking with Controls:** Controls can reference back-matter resources via `links` with `rel="reference"`. A dropdown offers all existing resources for selection.
    *   **Parity with Catalog Editor:** The back-matter management uses the same UI components as the Catalog Editor (cf. US 0.18).

### US 2.21: Resolution of Back-Matter Resources in Profile Imports
> **As a** Compliance Officer (Alice)  
> **I want to** resolve profile imports that reference resources in back-matter (e.g., `#resource-uuid`) correctly via their `rlinks` and the local catalog registry,  
> **so that** imported controls from official NIST catalogs and baselines can be loaded and edited in the Profile Editor.
*   **Acceptance Criteria:**
    *   **Back-Matter Resolution:** If an import uses a fragment reference (e.g., `#uuid`), the Resolution Engine searches for the resource in the `back-matter`.
    *   **Registry Matching:** The Resolution Engine matches the filenames of the resource `rlinks` with the URLs of the catalogs imported / registered in Reposol.
    *   **Error-Free Loading:** After importing the NIST SP 800-53 Rev 5 Low Baseline, all controls are successfully loaded in the sidebar and edit view.

### US 2.24: Enhancements Accordion Inline Expansion & Parameter Placement in Profile Mode (New for R1)
> **As a** lead enterprise architect (Alice)  
> **I want to** be able to embed parameters directly into sub-control prose when sub-controls (enhancements) are expanded in the `EnhancementsAccordion` in the profile editor, as well as configure parameter overrides and profile-specific parameters at the sub-control level,  
> **so that** I can fully tailor sub-controls in the profile without leaving the context of the main control.
*   **Acceptance Criteria:**
    *   **Inline Expansion in Profile Mode:** Sub-controls in the `EnhancementsAccordion` can be expanded inline in profile edit mode.
    *   **ProseWithParams in Sub-Control Statements:** Sub-control statements and prose parts render with `ProseWithParams` including a caret-relative "Add Parameter" button.
    *   **Parameter Placement & Overrides:** Configured parameters and overrides (`set-parameters`) of the sub-control are displayed and edited below the sub-control statements.
    *   **Define New Parameter Callback:** Clicking on "➕ Define New Parameter..." in the dropdown of a sub-control text field smoothly scrolls to the parameter area of the sub-control and creates a corresponding profile parameter override.
    *   **OSCAL Alter Serialization:** All text and parameter changes on sub-controls are serialized schema-compliantly in `modify.alters` or `modify.set-parameters` in the profile.

### US 2.25: Properties Overhaul in Profile Editor (Deletion & Revert) (New for Step 2)
> **As a** Compliance Officer (Alice)  
> **I want to** be able to delete and modify inherited catalog properties in the profile editor with full transparency and revert capabilities,  
> **so that** I can undo erroneous changes and always know which properties have been modified or deleted.
*   **Acceptance Criteria:**
    *   **Visual Deleted State:** If a catalog property is deleted in the profile (`alter.removes` with `by-name`), it remains visible in the editor, is grayed out, the text is struck through, and it receives a red `Removed` badge.
    *   **Always Visible Restore Button:** Instead of the hover effect, deleted properties permanently display the `↩ Restore` button next to the badge. Clicking it removes the `by-name` entry from `alter.removes`.
    *   **Revert to Default Button:** If the value of a catalog property was modified (overridden in the profile, i.e., present in `alter.adds`), a `↩ Revert` button is displayed, which deletes this modification and resets to the catalog default value.
    *   **OSCAL Conformity:** Changes to properties are persisted in `modify.alters` with `adds` (for new/modified values) and `removes` with `by-name` (for deletions).

### US 2.26: Object-Bound Targeted Modification Reverting & Pruning (Control, Group & Text Scope)
> **As a** Compliance Officer (Alice)  
> **I want to** discard and prune modifications in an object-bound manner (`modify.alters` and `modify.set-parameters`) in the profile editor (at the level of individual controls, sub-controls, text elements, groups, or import sources),  
> **so that** when deselecting, removing, or resetting objects, exactly and exclusively the modifications belonging to that specific object are discarded.
*   **Acceptance Criteria:**
    *   **Object-bound Control Revert (Control Level):** If a specific control is deselected, removed from a group, or taken out of the profile, the system checks specifically for this control (`control-id`) whether modifications exist in `modify.alters` or `modify.set-parameters`, and exclusively removes these specific entries.
    *   **Object-bound Sub-Control & Text Revert (Element Level):** If a specific text element (statement, sub-statement, guidance) or a property/parameter of a control is reset (reverted) in the editor, only the correspondingly created `adds` or `removes` modification in `modify.alters` for this concrete text element/object is targeted and deleted.
    *   **Object-bound Group Revert (Group Level):** If an entire group or subgroup is deleted/deselected, the system identifies all controls contained in this group and prunes in a targeted manner only the modifications of this affected list of objects.
    *   **Object-bound Import Revert (Source Level):** If a specific catalog source is removed, exactly the modifications that relate to the controls from this specific catalog are discarded.
    *   **No Blanket Global Wipes:** The system does not perform any undirected blanket pruning, but always acts event- and context-driven based on the respective target object.


### US 2.28: Profile Statement & Sub-item Addition (Streamlined UX & Engine Resolution)
> **As a** Compliance Officer (Alice)  
> **I want to** be able to create new sub-items (`a.`, `b.`) via a focused `➕ Sub-item` button on statement cards in the profile editor, and append new main statements via the `➕ Add Statement` button located below the list,  
> **so that** usability is reduced to the essentials and clear, and existing catalog statements remain intact when additions are appended.
*   **Acceptance Criteria:**
    *   **Sub-item Addition (`➕ Sub-item`):** Every statement in the profile editor features a prominent `➕ Sub-item` button. Clicking it creates a new item with `position: 'ending'` and `by-id: parentId` in `alter.adds` and cleanly renders it as a sub-item (e.g., `a.`, `b.`) in the target statement.
    *   **Main Statement Addition (`➕ Add Statement`):** Below the list of statements is the `➕ Add Statement` button for appending new top-level statements (`position: 'ending'`).
    *   **Streamlined UX without Redundancy:** The confusing `Add After` button on individual statement cards is removed to avoid mix-ups with `Add Statement`.
    *   **No Unintended Recursion on Global Adds:** `position: 'ending'`/`position: 'starting'` adds defined without `by-id` are exclusively evaluated at the top-level (`level === 0`) and not mistakenly nested inside sub-items.
    *   **Exact Replacement Check:** An add block is only treated by the resolution engine as a replacement (text overwrite) of an original statement if the original ID is explicitly listed in `alter.removes` and the add block defines a part with the same ID.

### US 2.30: Cascading Profile Imports (Profile from Profiles)
> **As a** lead enterprise architect (Alice)  
> **I want to** use existing baseline profiles (e.g., FedRAMP Moderate) as an import source for my new system profile and resolve them without recursion,  
> **so that** I can inherit and customize corporate baselines across multiple levels.
*   **Acceptance Criteria:**
    *   **Profile Selection in Import Dropdown:** In the `Add Import:` dropdown, existing profiles can be selected in addition to catalogs.
    *   **Cascading Resolution:** The Profile Resolution Engine recursively resolves profile imports and applies all cascaded `alters`, `set-parameters`, and `select-control` rules.

### US 2.31: Visual Baseline Comparison & Diff Viewer (Profile vs. Base Catalog)
> **As a** Compliance Officer (Alice)  
> **I want to** be able to call up a visual comparison (diff view) between the tailored profile and the imported base catalogs,  
> **so that** I can check and approve all added, modified, overridden, and excluded controls at a glance.
*   **Acceptance Criteria:**
    *   **Diff View:** A "🔍 Baseline Diff" tab in the profile editor compares the profile with the base catalogs.
    *   **Visual Highlighting:** Additions (green), deviations/modifications (blue), parameter overrides (yellow), and exclusions (red) are clearly listed.

---

## 2. Alice's Detailed Workflow & User Journey

1.  **Control Selection (Tab 1):** Alice creates the profile *"Reposol Corporate Baseline v2.0"*. She selects the *NIST SP 800-53 Rev 5 Catalog* and the *Industry Base Profile* as import baselines. Directly above the checklist of NIST controls, she activates "Import All" (Include All) and enters `pe-*` under exclusions. As a result, all physical controls in the checklist are immediately deselected. For the Industry Base Profile, she selects controls manually via checkbox.
2.  **Modifications (Tab 2):** In the second tab, Alice sees only the controls selected in Step 1. She makes detailed adjustments for these:
    *   She overrides parameter values (e.g., password length).
    *   She adds text at the beginning of the statement of `ac-2` and removes an invalid reference (alters).
    *   She defines local custom controls (e.g., `corp-sec-1`).
3.  **Restructuring (Tab 3):** In the third tab, Alice switches the merge directive to `custom`, creates a new group *"Corporate Access Policy"*, and assigns `ac-2` and `corp-sec-1` exclusively to this group.
4.  **Profile Resolution & Export:** She clicks **Resolve Profile**. The system generates the live preview of the resolved profile. Alice validates the document and exports it.

---

---

## 3. Functional Requirements for the System

- **Cascading Imports:** Support for importing catalogs and other profiles (`imports`) (US 2.1).
- **Advanced Filtering:** Exclusion (`exclude-controls`) and inclusion (`include-controls`) of control elements by IDs or type classes (US 2.2).
- **Centralized Parameter Management:** Setting global parameter values (`set-parameters`) including arrays of values (US 2.3).
- **Fine-Grained Modifications (`alters`):**
  - **Adds:** Adding parts, props, or parameters at `starting`, `ending`, `before`, and `after` positions (US 2.4).
  - **Removes:** Deletion of specific child elements of imported controls using selectors (e.g., `by-id`, `by-name`) (US 2.4).
- **Local Controls:** Definition of company-specific controls in a managed OSCAL catalog that is regularly imported by the profile (US 2.5).
- **Merge Directives and Grouping (Merge Phase):**
  - Selection of directive (`as-is`, `flat`, `custom`).
  - Graphical editor for defining groups, subgroups, and assigning imported controls (US 2.7).
- **Profile Resolution Engine:** Algorithm for resolving all imports, modifications, and custom groupings to display the profile as a structured, readable catalog (preview & validation) (US 2.6).
- **Parameter Constraints:** Defining selection constraints (`select` and `choice`) for parameters (US 2.8).
- **Pattern-based Filtering:** Support for wildcard patterns (`matching`) when importing controls (US 2.9).
- **Role and Responsibility Assignment:** Defining global roles and assigning responsibilities (`responsible-parties`) in the metadata section of the profile (US 2.10).
- **Advanced Removal:** Deleting elements by type/name (`removes.by-name`) (US 2.11).
- **Combination Rules:** Defining strategies in case of control collisions (`merge.combine`) (US 2.12).

---

---

## 4. Functional Acceptance Criteria (Summary)

- [ ] US 2.1: Simplified Profile Creation & Direct Editing (Inner View)
- [ ] US 2.2: Live Tailoring via Sidebar Checkboxes (Inclusion & Exclusion)
- [ ] US 2.3: Global Parameter Assignments (`set-parameters`)
- [ ] US 2.4: Context-Aware Modification Tab — Inline Editing of Control Text with Transparent OSCAL Mapping
- [ ] US 2.5: Local Custom Controls via Managed Catalog Import (OSCAL-compliant)
- [ ] US 2.6: Profile Resolution Engine & Preview
- [ ] US 2.7: High-Level Restructuring and Grouping (Merge Phase) in the GUI
- [ ] US 2.8: Parameter Selection Rules, Validations, and Constraints (select & choice) in the GUI
- [ ] US 2.9: Dynamic Filtering via Pattern Matching (matching) in the GUI
- [ ] US 2.10: Assignment of Global Roles and Responsibilities (responsible-parties) in Metadata
- [ ] US 2.11: Advanced Deletion of Control Components (removes) in the GUI
- [ ] US 2.12: Collision and Merge Rules (merge.combine) in the GUI
- [ ] US 2.13: Integrated Profile Versioning in the Backend
- [ ] US 2.14: Assignment in the Right Pane (Document Overview) & Default Structure in the Sidebar
- [ ] US 2.17: Profile Parameter Overrides (`modify.set-parameters`) & Dropdown Value Selection
- [ ] US 2.18: Profile Resolution Export
- [ ] US 2.19: Profile Back-Matter and Resource Management
- [ ] US 2.21: Resolution of Back-Matter Resources in Profile Imports
- [ ] US 2.24: Enhancements Accordion Inline Expansion & Parameter Placement in Profile Mode (New for R1)
- [ ] US 2.25: Properties Overhaul in Profile Editor (Deletion & Revert) (New for Step 2)
- [ ] US 2.26: Object-Bound Targeted Modification Reverting & Pruning (Control, Group & Text Scope)
- [ ] US 2.28: Profile Statement & Sub-item Addition (Streamlined UX & Engine Resolution)
- [ ] US 2.30: Cascading Profile Imports (Profile from Profiles)
- [ ] US 2.31: Visual Baseline Comparison & Diff Viewer (Profile vs. Base Catalog)
