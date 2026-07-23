# Step 2: Detailed User Stories – Profile Tailoring

* **Persona:** Alice (Compliance Officer / Enterprise Architect)
* **Goal:** Creation of the organization-specific security baseline by mixing, filtering, fine-tuning, and compiling (resolving) requirements from various source frameworks.

---

## 1. Breakdown of User Stories

### US 2.1: Simplified Profile Creation & Direct Editing (Inner View)
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
        *   An `adds` entry with a new, unique ID (e.g., `<original-id>_modified`) and the new prose text. The insertion position references the original ID, so that the change appears at the same location, without `removes` deleting the added content as well.
        *   If the text is reverted to its original state, the corresponding entries are deleted in the background.
    *   **Visual Traceability (Edit vs. View Mode):** In Editor Mode, the original text that was replaced/removed via `alters.removes` is still displayed but clearly marked as struck through (durchgestrichen) and visually disabled, so the user can trace exactly what was modified. In View Mode (and in the final resolved profile), this removed text is completely hidden.
    *   **Structural Additions (`alters.adds`):** The system must allow users to add entirely new elements (`props`, `params`, `links`, or `parts` representing statements/guidance) to a control at positions `starting`, `ending`, `before`, or `after` (using a reference sibling `by-id`).
    *   **Strict Alters Boundaries (Schema Compliance):** The `alter` directive **cannot** and must not be used to add or remove subcontrols (enhancements). The backend resolution and the frontend editor enforce this constraint (subcontrol inclusions/exclusions are handled exclusively via `select-control` rules).
    *   **Reset Function (Revert):** Next to each modified text field, a "Reset" button is displayed, allowing the user to discard text changes and restore the original text of the catalog.
    *   **Recursive Resolution (Deep Alters):** The Profile Resolution Engine (`resolveProfileSync`) has been extended to recursively apply `adds` and `removes` to deeply nested paragraphs (sub-statements such as `ac-2_smt.a`) correctly across all levels and display them in the resolved rulebook. Even if an imported control originally did not have any textual statements/parts in the source catalog, profile changes (`adds`) must be applied correctly in the resolution engine (`resolveProfileSync` / `applyAltersToParts`) (i.e., new parts are created and added to the control object instead of the resolution aborting prematurely).
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
    *   **Selection of the Merge Directive:** The user can choose between `as-is` (default), `flat`, and `custom` in the GUI. When saving, `merge` contains exclusively the chosen directive; UI helper fields like `defaultStructure` are not saved in the OSCAL profile.
    *   **Creation of Custom Groups:** When `custom` is selected, the user can create, edit, and delete new groups with ID and title.
    *   **Nesting of Groups:** The GUI allows hierarchical nesting of groups (groups within groups).
    *   **Sorting Controls & Folders (Drag & Drop):** The user can drag & drop imported controls as well as entire categories/folders (marked with a `📁` symbol) from the control pool into a custom group in the sidebar. Since a control structurally can only occur once in the OSCAL catalog hierarchy, this assignment is exclusive (if a control is added to a group, it is automatically removed from all other groups).
    *   **Insert Controls and Sorting:** Within each custom group, `insert-controls` can be used to specify which controls are included. The sorting order can be configured via a dropdown as `keep` (original order), `ascending` (ascending by ID), or `descending` (descending by ID).
    *   **Include-All in Groups:** `insert-controls` supports both `include-all` (include all remaining controls) and `include-controls` with explicit IDs or `matching` patterns.
    *   **Group Metadata & Texts:** For each created group, custom properties/tags (`props`), reference links (`links`), and description texts (`parts`) can be defined in a GUI form.
    *   **Round-tripping:** The configured `custom` structure is correctly saved in the Profile JSON under `merge.custom` and converted back to the GUI state when the profile is reloaded.
    *   **Resolution & Preview:** The Resolved Catalog in the live preview reflects the configured group structure and its group metadata.

### US 2.8: Parameter Selection Rules, Validations, and Constraints (select & choice) in the GUI
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
    *   **Visual Traceability (Edit vs. View Mode):** Elements marked for deletion via `removes` are displayed as struck through (durchgestrichen) und visuell deaktiviert in Editor Mode to maintain full traceability of deletions. In View Mode, these elements are completely hidden.
    *   **Resolution Filtering:** During profile resolution, the resolution engine filters out all components of the control that match the selectors.
    *   **Round-tripping:** Correct saving and loading of `removes` directives in the Profile JSON.

### US 2.12: Collision and Merge Rules (merge.combine) in the GUI
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** define merge rules for conflicting control IDs via the GUI (`merge.combine`),  
> **so that** identical control definitions are cleanly merged or prioritized when importing from multiple catalogs.
*   **Acceptance Criteria:**
    *   **GUI Strategy Selection:** Choice of the combination strategy via a dropdown field in the merge area: `use-first` (use first definition), `merge` (merge definitions), or `keep` (keep all duplicates).
    *   **Collision Handling:** The resolution engine handles ID duplicates in accordance with the selected strategy.

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

## 4. Functional Acceptance Criteria (Summary)

- [x] A user can import multiple catalogs and profiles (US 2.1).
- [x] The editor supports explicit exclusion of controls via an exclusion list (US 2.2).
- [x] Parameter values can be overridden in the profile (US 2.3).
- [x] Textual modifications support insertion at `starting`, `ending`, `before`, and `after` positions as well as targeted deletion of elements (US 2.4).
- [x] The system allows the creation of local, company-specific controls via a managed catalog imported by the profile (US 2.5).
- [x] The application provides an integrated preview displaying the resolved profile (Resolved Catalog) (US 2.6).
- [x] The exported document matches the official OSCAL Profile schema (US 2.6).
- [x] The user can create custom groups via the UI and reorder controls into them (US 2.7).
- [x] The user can define selection constraints (value lists) for parameters (US 2.8).
- [x] The system supports wildcards (`matching`) when importing controls (US 2.9).
- [x] Roles can be defined and assigned to controls/parameters as responsible entities (US 2.10).
- [x] Entire structural components of a control can be removed by name/type (US 2.11).
- [x] Merge rules for ID duplicates with a merge strategy dropdown (`use-first`, `merge`, `keep`) are supported (US 2.12).
- [ ] Integrated profile versioning with NIST schema validation, revision sync, and reference to US 0.P2 (US 2.13).
- [ ] A resolved profile can be exported and saved as an independent, NIST Catalog-compliant validated catalog (US 2.18).
- [ ] Profile back-matter resources can be managed (US 2.19).
- [ ] `insert-controls` with sorting rules (keep/ascending/descending) are supported in custom merge (US 2.7).
- [ ] `with-child-controls` toggle when importing controls (US 2.2).
- [ ] `include-all` vs. `include-controls` toggle per imported catalog (US 2.14).

---

## 5. Detailed Description of US 2.13

### US 2.13: Integrated Profile Versioning in the Backend
> **As a** Compliance Officer (Alice)  
> **I want to** manage versions of a profile in the backend while adhering to strict OSCAL compliance,  
> **so that** version states are saved persistently and compliantly.
*   **Acceptance Criteria:**
    *   Applies the global versioning pattern **US 0.P2** fully (schema validation, version synchronization, error feedback, drawer, read-only history).
    *   **Profile-specific:** The document is validated against the official NIST OSCAL Profile schema.
    *   **Revision Sync:** Upon saving, `profile.metadata.revisions[]` is automatically updated (in accordance with US 0.7).

---

## US 2.14: Assignment in the Right Pane (Document Overview) & Default Structure in the Sidebar

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

---

### US 2.15: Detailed Editability of Controls (Title, IDs, Labels & Enhancements in-place)

> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** edit all components of a control and its enhancements directly inline in the right detail pane, without having to navigate through confusing subpages,  
> **so that** the structure remains flat and intuitive and all aspects of a control (including all enhancements) can be maintained in one place.

*   **Acceptance Criteria:**
    *   **Title Editing:** Clicking the control title (e.g., "Organizational Context" in the detail view) transforms it into a text input field to edit the title directly inline.
    *   **ID Editing:** Clicking the identifier/ID (e.g., the blue ID badge "GV.OC") opens an input field to adjust the control/category ID.
    *   **Edit Properties/Labels:** Properties (e.g., `label: Organizational Context (GV.OC)`) can be edited directly by clicking them or deleted/added via a button.
    *   **Manage Global Properties:**
        *   In the **Document Overview** area, there is a separate subtab **Global Tags** (next to *Metadata* and *Imported Catalogs*) where global properties/tags can be created, edited, and deleted centrally.
        *   In the control detail pane, a dropdown selection field **"+ Assign Global Tag..."** allows directly assigning one of these globally defined properties.
    *   **Control Enhancements completely in-place:**
        *   **No Separate Subpage:** Navigation/selection of enhancements as independent controls is completely deactivated. Clicking the ID badge or double-clicking the enhancement no longer redirects to a separate subpage.
        *   **In-Card Properties Editor:** Each enhancement card under **CONTROL ENHANCEMENTS** renders its own properties/tags directly inline (with the same features as main controls: double-click to edit, delete via `×`, add via `+ Custom Property` button, and assign via `+ Assign Global Tag...` dropdown).
        *   Titles, IDs, and prose of enhancements continue to be edited and deleted directly in-place.
        *   **Type Display for Subcategories:** Each enhancement card (subcategory) displays a type badge (e.g., `SUBCATEGORY` or the corresponding class value) left-aligned in the header (flowing next to ID and title) to visually clarify the hierarchical mapping analogously to the main controls (categories).
    *   **Conditional Title Display (Avoid Redundancy):** If the title of a control or enhancement is empty or exactly matches the ID, it is completely hidden in the read-only view (no redundant title next to the ID badge). Also, in edit mode, no distracting "(Click to add title...)" placeholder is displayed.
    *   **Structured & Labeled Fields in Edit Mode:**
        *   In edit mode, the ID and title/name of controls and enhancements are described with clear, hierarchical labels in uppercase letters (e.g., `CONTROL ID`, `CONTROL TITLE / NAME`) to ease orientation.
        *   To avoid a cluttered design with stacked boxes, the header area and the properties area (properties / tags) are combined in edit mode into **a single cohesive card** (gray background with border).
        *   **Type Badge Alignment of Category:** The type badge of the main control (category) is displayed at the right edge of the header area, while the type badges of subcategories flow left-aligned with the ID and title.
        *   **No Redundant Moving in the Detail Card:** The dropdown field for moving into groups is removed from the central editing card, as the reordering of controls is already controlled exclusively and clearly via the sidebar.
    *   **Suggestions for Property Names:** All custom property name fields (both global and local at the control and enhancement level) offer an autocompletion suggestion list (`datalist`) while typing, suggesting all property keys occurring in the imported catalog (e.g., `sort-id`, `label`, `risk-party` etc.) for quick selection.
    *   **Round-tripping & Resolution:** All changes are serialized in compliance with OSCAL in the profile under `modify.alters` (or directly in the local controls area).
    *   **Consistent Button Design & Exit Behavior:**
        *   The "Publish New Version" button is represented uniformly in the same format as "Save Draft" and other action buttons of the app (matching the standard theme instead of ad-hoc green).
        *   **Polymorphic ControlDetailView & Icon Taxonomy Consistency:** In both Catalog Mode and Profile Mode, `ControlDetailView` provides identical inline editing capabilities for control parts, sub-parts/items, and links, including the `🔧` Advanced Settings toggle button for optional attributes (`ns`, `class`, `title`, `props`, `links`).

---

### US 2.16: Extended Management of Tags and Existing Properties in the Document Overview

> **As a** Compliance Officer (Alice)  
> **I want to** clearly see already used properties/tags and their used values in the Document Overview and be able to add them directly to the global tags,  
> **so that** I can manage existing tags consistently and without erroneous manual typing for the entire document.

*   **Acceptance Criteria:**
    *   **Unified "Tags" Tab:** The "Global Tags" tab in the Document Overview is renamed to "Tags" and is available for both profiles and catalogs in read-only and edit modes.
    *   **Division of the Tags Area:** The area is divided into:
        *   **Global Property Tags:** The list of globally defined metadata properties, which can be added, edited, and deleted in edit mode, and are displayed read-only in view mode.
        *   **Used / Existing Tags:** A dynamically generated list of all tags actually used in controls/groups.
    *   **Dropdown of Used Values:** For each existing tag, next to its name and frequency (count), a dropdown field (`<select>`) is displayed listing all unique values already entered for this tag in the document.
    *   **Quick Promotion (Promote):** Next to each existing tag that is not yet present in the global properties, an `➕ Add as global property` button is displayed in edit mode. Clicking it adds this tag directly to the global properties list with a default value (or empty).

---

### US 2.17: Profile Parameter Overrides (`modify.set-parameters`) & Dropdown Value Selection

> **As an** Enterprise Architect (Alice)  
> **I want to** configure parameter overrides in the Profile Builder using interactive choice dropdowns and validated value inputs,  
> **so that** I can customize baseline parameters with explicit `modify.set-parameters` entries while maintaining clean fallback to catalog defaults and zero schema pollution.

*   **Acceptance Criteria:**
    *   **Profile Parameter Overrides (`set-parameters`):** Overriding a parameter in Profile mode creates or updates an entry in `profile.modify.set-parameters[]` matching the parameter's `param-id`. Supported override attributes include `values[]`, `label`, `select`, `constraints`, `guidelines`, `remarks`, and `usage`.
    *   **Dropdown Selection for Predefined Choices:** If the source parameter defines `select.choice` with `how-many: "one"`, a dropdown selection field (`<select>`) is rendered populated with `select.choice[]` options plus a "Custom Value..." option.
    *   **Multi-Choice Support:** If `select.how-many` is `"one-or-more"`, a multi-select checkbox group or multi-select dropdown is rendered. Selecting multiple options serializes as a multi-element string array in `set-parameters[].values`.
    *   **Dual-Mode Choice & Value Synchronization:** Selecting an option from the choice dropdown directly synchronizes with `set-parameters[].values = [selectedValue]`.
    *   **Catalog Fallback:** When a parameter has no override entry in `modify.set-parameters[]`, the Profile Resolution Engine (`profile-resolver.js` / `resolveProfileSync`) transparently falls back to the source catalog parameter's default `values[]` (or `select.choice` default).
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
    *   **Parity with Catalog Editor:** The back-matter management uses the same UI components as the Catalog Editor (cf. US 0.P5).

### US 2.20: Drag-to-Delete Target for Groups and Controls in the Sidebar (Full-Width & Dynamic)
> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want to** see a full-width Drag-to-Delete target (trash bin area) in the sidebar below the "Add Top-level Group" button, where I can drop dragged groups or controls,  
> **so that** I can delete them or unassign them directly via drag-and-drop, and instantly see what is being deleted when hovering over it.
*   **Acceptance Criteria:**
    *   **Trash Bin Area in the Sidebar (below the button):** The trash bin area is rendered as a separate, full-width area below the "Add Top-level Group" button (only in edit mode `canEdit`).
    *   **Dynamic Status Message on Dragover:**
        *   When no dragging is taking place, the area displays: `🗑️ Drag elements here to delete`.
        *   When dragging is active, the area displays by default: `🗑️ Drag here to delete...`.
        *   When a dragged element (group or control) is moved directly over the trash bin area (`dropIndicator?.id === 'trash'`), the text changes dynamically to indicate what will happen:
            *   For a group: `🗑️ Delete Group "{NAME}"`.
            *   For a control: `🗑️ Unassign "{NAME}"`.
    *   **Visual Feedback on Dragover:** When hovering over the area, it lights up red (red border, red background, box-shadow glow) and expands slightly.
    *   **Unassign / Delete via Drop:**
        *   If a **group** is dropped, the confirmation dialog to delete the group appears. After confirmation, it is deleted.
        *   If a **control** is dropped, its assignment is removed, returning it to the unassigned controls pool.

### US 2.21: Resolution of Back-Matter Resources in Profile Imports
> **As a** Compliance Officer (Alice)  
> **I want** profile imports that reference resources in the back-matter (e.g., `#resource-uuid`) to be resolved correctly via their `rlinks` and the local catalog registry,  
> **so that** imported controls from official NIST catalogs and baselines can be loaded and edited in the Profile Editor.
*   **Acceptance Criteria:**
    *   **Back-Matter Resolution:** If an import uses a fragment reference (e.g., `#uuid`), the Resolution Engine searches for the resource in the `back-matter`.
    *   **Registry Matching:** The Resolution Engine matches the filenames of the resource `rlinks` with the URLs of the catalogs imported / registered in Reposol.
    *   **Error-Free Loading:** After importing the NIST SP 800-53 Rev 5 Low Baseline, all controls are successfully loaded in the sidebar and edit view.

### US 2.22: Two-line Display of Prose Parts with ID Display (analogous to Catalogs)
> **As a** Compliance Officer (Alice)  
> **I want** the prose parts in the profile detail view and in the editor to also use the two-line display and additionally display the ID of the part,  
> **so that** I can instantly see which ID a paragraph has in the source catalog and trace modifications specifically.

*   **Acceptance Criteria:**
    *   **AC 1**: In profile detail view mode (read-only and edit in `ProfileDetailPanel.jsx`), each prose part is rendered in two lines.
    *   **AC 2**: The first line (header) displays the category badge (e.g., `[STATEMENT]`) left-aligned in `var(--color-success)` (green) and directly next to it the ID of the part (e.g., `ac-2_smt.a`), if present, in a small monospace font with a subtle background.
    *   **AC 3**: If the part was modified (`isModified`), the `Modified` badge is also displayed in this header (as before).
    *   **AC 4**: The second line displays the formatted prose text (in view mode) or the `DebouncedTextarea` (in edit mode).

### US 2.23: Visual Consistency of the Profile Control Detail View with the Catalog Editor through Shared Components

> **As a** Compliance Officer and Enterprise Architect (Alice)  
> **I want** the detail view of a control in the Profile Editor (right pane) to look and behave visually and interactively identically to the perfected Catalog detail view,  
> **so that** when switching between the Catalog and Profile editors, I experience the same consistent, high-quality user interface and do not have to get used to different layouts and interaction patterns.

*   **Acceptance Criteria:**
    *   **AC 1 — Shared Header (`ControlHeader`):** The header section (ID badge, title, optional class) in the profile detail area uses the same shared component as the Catalog Editor. In edit mode, `DebouncedInput` fields with auto-sizing are used (no click-to-edit with separate states).
    *   **AC 2 — Uniform Props/Tags Representation:** Properties/tags in the profile detail area use the shared `PropsEditor` component (with autocomplete suggestions and advanced fields support), rather than their own simplified badge representation.
    *   **AC 3 — Shared Read-Only Parts (`ReadOnlyParts`):** The prose parts display in view mode uses a single shared component for both Catalog and Profile. Profile-specific features (Modified badge, Reset button) are controlled via optional props.
    *   **AC 4 — Shared Enhancements Accordion (`EnhancementsAccordion`):** Control enhancements in the profile are displayed as a compact accordion (collapsed by default) with a count badge — identical to the Catalog view. The enhancement details are expandable.
    *   **AC 5 — Uniform Section Styling:** All sections (Header, Props, Parts, Parameters, Links, Enhancements) use the same CSS class `section-container` with `border-top` separators and consistent spacing in both Catalog and Profile.
    *   **AC 6 — Shared Prose Formatting:** The `formatProse()` function from `oscal-utils.js` is used in both contexts. The duplicated inline implementation in `ProfileDetailPanel` is removed.
    *   **AC 7 — Functional Links Editing:** The `LinksEditor` in the profile detail area has a functional `onChange` handler (instead of the current empty handler).
    *   **AC 8 — Profile-specific Logic Preserved:** The OSCAL modification logic (modify.alters, set-parameters, Reset, Modified badge) remains unchanged and is injected into the shared components via context-specific callbacks.
    *   **AC 9 — No Regression:** All existing Catalog and Profile functions (Undo/Redo, draft saving, versioning, Profile resolution, import sources, sidebar checkboxes) function unchanged after the transition.

### US 2.24: Enhancements Accordion Inline Expansion & Parameter Placement im Profil-Modus (Neu für R1)
> **Als** Enterprise Architect (Alice)  
> **möchte ich** im Profil-Editor bei aufgeklappten Sub-Controls (Enhancements) im `EnhancementsAccordion` Parameter direkt in Sub-Control-Prose einbinden sowie Parameter-Overrides und profil-spezifische Parameter auf Sub-Control-Ebene konfigurieren können,  
> **so that** ich Sub-Controls im Profil vollständig tailorieren kann, ohne den Kontext der Hauptkontrolle zu verlassen.
*   **Akzeptanzkriterien:**
    *   **Inline Expansion im Profil-Modus:** Sub-Controls im `EnhancementsAccordion` lassen sich im Profil-Bearbeitungsmodus inline aufklappen.
    *   **ProseWithParams in Sub-Control-Statements:** Sub-Control-Statements und Prose-Teile rendern mit `ProseWithParams` inklusive Caret-relativem „Add Parameter“-Button.
    *   **Parameter Placement & Overrides:** Unterhalb der Sub-Control-Statements werden konfigurierte Parameter und Overrides (`set-parameters`) des Sub-Controls dargestellt und bearbeitet.
    *   **Define New Parameter Callback:** Klick auf „➕ Define New Parameter...“ im Dropdown eines Sub-Control-Textfeldes scrollt sanft zum Parameterbereich des Sub-Controls und legt einen passenden Profil-Parameter-Override an.
    *   **OSCAL Alter Serialization:** Alle Text- und Parameteränderungen an Sub-Controls werden schema-konform in `modify.alters` bzw. `modify.set-parameters` im Profil serialisiert.

### US 2.25: Properties Overhaul im Profil-Editor (Löschen & Revert) (Neu für Schritt 2)
> **Als** Compliance Officer (Alice)  
> **möchte ich** geerbte Katalog-Properties im Profil-Editor löschen und verändern können und dabei volle Transparenz und Revert-Möglichkeiten haben,  
> **damit** ich fehlerhafte Änderungen rückgängig machen kann und immer weiß, welche Eigenschaften verändert oder gelöscht wurden.
*   **Akzeptanzkriterien:**
    *   **Visueller gelöschter Zustand:** Wenn eine Katalog-Property im Profil gelöscht wird (`alter.removes` mit `by-name`), bleibt sie im Editor sichtbar, wird ausgegraut, der Text wird durchgestrichen und sie erhält einen roten `Removed`-Badge.
    *   **Immer sichtbarer Restore-Button:** Anstelle des Hover-Effekts wird bei gelöschten Properties der `↩ Restore`-Button dauerhaft neben dem Badge angezeigt. Ein Klick darauf entfernt den `by-name` Eintrag aus `alter.removes`.
    *   **Revert to Default Button:** Wenn der Wert einer Katalog-Property modifiziert wurde (im Profil überschrieben, also in `alter.adds` vorhanden), wird ein `↩ Revert` Button angezeigt, der diese Änderung löscht und auf den Katalog-Standardwert zurücksetzt.
    *   **OSCAL-Konformität:** Änderungen an Properties werden in `modify.alters` mit `adds` (für neue/modifizierte Werte) und `removes` mit `by-name` (für Löschungen) persistiert.

### US 2.26: Object-Bound Targeted Modification Reverting & Pruning (Control, Group & Text Scope)
> **Als** Compliance Officer (Alice)  
> **möchte ich**, dass das Verwerfen und Bereinigen von Modifikationen (`modify.alters` und `modify.set-parameters`) im Profil-Editor stets zielgerichtet und objektbezogen erfolgt (auf Ebene von einzelnen Kontrollen, Sub-Controls, Textelementen, Gruppen oder Import-Quellen),  
> **damit** beim Abwählen, Entfernen oder Zurücksetzen von Objekten genau und ausschließlich die zu diesem spezifischen Objekt gehörenden Anpassungen verworfen werden.
*   **Akzeptanzkriterien:**
    *   **Objektbezogenes Control-Revert (Kontrollebene):** Wenn eine spezifische Kontrolle abgewählt, aus einer Gruppe entfernt oder aus dem Profil entnommen wird, prüft das System gezielt für genau diese Kontrolle (`control-id`), ob in `modify.alters` oder `modify.set-parameters` Anpassungen vorliegen, und entfernt ausschließlich diese spezifischen Einträge.
    *   **Objektbezogenes Sub-Control- & Text-Revert (Elementebene):** Wenn im Editor ein spezifisches Textelement (Statement, Sub-Statement, Guidance) oder eine Eigenschaft/Parameter einer Kontrolle zurückgesetzt wird (Revert), wird gezielt nur die dafür angelegte `adds`- bzw. `removes`-Modifikation in `modify.alters` für dieses konkrete Textelement/Objekt gelöscht.
    *   **Objektbezogenes Gruppen-Revert (Gruppenebene):** Wenn eine gesamte Gruppe oder Untergruppe gelöscht/abgewählt wird, ermittelt das System alle in dieser Gruppe enthaltenen Kontrollen und bereinigt zielgerichtet nur die Anpassungen dieser betroffenen Objektliste.
    *   **Objektbezogenes Import-Revert (Quellenebene):** Wird eine bestimmte Katalogquelle entfernt, werden exakt die Modifikationen verworfen, die sich auf die Kontrollen aus diesem spezifischen Katalog beziehen.
    *   **Keine pauschalen globalen Wipes:** Das System führt keine ungerichtete pauschale Bereinigung durch, sondern agiert stets event- und kontextgetrieben bezogen auf das jeweilige Zielobjekt.


### US 2.27: Interactive Merge Structuring Mode Selector (as-is / flat / custom) in the Profile UI
> **Als** Compliance Officer und Enterprise Architect (Alice)  
> **möchte ich** im Profil-Editor (im `SourcesPanel`) ein ultrakompaktes 2-Zeilen-Setup-Panel nutzen, dessen Dropdown-Boxen links exakt pixelgenau untereinander ausgerichtet sind,  
> **damit** das Interface absolut symmetrisch und visuell perfekt wirkt.
*   **Akzeptanzkriterien:**
    *   **Kombiniertes 2-Zeilen-Setup-Panel:**
        *   **Zeile 1:** `⚙️ Structuring Mode:` [ Dropdown `as-is` / `custom` / `flat` ]
        *   **Zeile 2:** `📥 Add Import:` [ Kombiniertes Dropdown mit Katalogen & Profilen ]
    *   **Pixelgenaue vertikale Ausrichtung:** Beide Labels (`⚙️ Structuring Mode:` und `📥 Add Import:`) besitzen eine feste identische Spaltenbreite (`width: 145px`, `flexShrink: 0`), wodurch die linken Kanten beider Auswahl-Dropdowns exakt untereinander ausgerichtet sind.
    *   **Gruppierte & Icon-versehene Optionen:** Im `Add Import:`-Dropdown sind verfügbare Kataloge (`📖`) und Profile (`⚙️`) mit optgruppen und Icons klar voneinander unterschieden.
    *   **Struktur-Knopf im `custom`-Modus:** 
        *   Im **`custom`**-Modus besitzt jede Katalog-Import-Karte den Knopf **`📥 Import Full Structure`** (übernimmt Ordnerstruktur & Kontrollen des Katalogs additiv).
        *   Im **`as-is`**- und **`flat`**-Modus sind Struktur-Klon-Knöpfe ausgeblendet.
    *   **Bereinigung beim Entfernen von Import-Quellen (`Remove`):** Wenn alle Import-Quellen entfernt werden, setzt sich `profile.merge` automatisch auf `{ 'as-is': true }` zurück und bereinigt `merge.custom.groups`.

### US 2.28: Profile Statement & Sub-item Addition (Streamlined UX & Engine Resolution)
> **Als** Compliance Officer (Alice)  
> **möchte ich** im Profil-Editor über einen fokussierten `➕ Sub-item`-Button auf Statement-Karten neue Unterelemente (`a.`, `b.`) erstellen und über den unter der Liste stehenden `➕ Add Statement`-Button neue Haupt-Statements ergänzen,  
> **damit** die Bedienung auf das Wesentliche reduziert und übersichtlich ist und bestehende Katalog-Statements beim Hinzufügen von Ergänzungen intakt bleiben.
*   **Akzeptanzkriterien:**
    *   **Unterelement-Hinzufügung (`➕ Sub-item`):** Jedes Statement im Profil-Editor verfügt über einen prominenten `➕ Sub-item`-Button. Klickt man darauf, wird ein neues Item mit `position: 'ending'` und `by-id: parentId` in `alter.adds` angelegt und sauber als Unterelement (z.B. `a.`, `b.`) im Zielstatement gerendert.
    *   **Haupt-Statement-Ergänzung (`➕ Add Statement`):** Unterhalb der Liste der Statements befindet sich der Button `➕ Add Statement` zum Anfügen neuer Top-Level-Statements (`position: 'ending'`).
    *   **Schlanke UX ohne Redundanz:** Der verwirrende `Add After`-Button auf einzelnen Statement-Karten entfällt, um Verwechslungen mit `Add Statement` zu vermeiden.
    *   **Keine unbeabsichtigte Rekursion bei globalen Adds:** Ohne `by-id` definierte `position: 'ending'`/`position: 'starting'`-Adds werden ausschließlich auf Top-Level-Ebene (`level === 0`) ausgewertet und nicht fälschlicherweise in Unterelemente verschachtelt.
    *   **Exakte Ersetzungsprüfung (Replacement Check):** Ein Add-Block wird vom Auflösungsmotor nur dann als Replacement (Textüberschreibung) eines Original-Statements behandelt, wenn die Original-ID explizit in `alter.removes` gelistet ist und der Add-Block ein Part mit derselben ID definiert.















