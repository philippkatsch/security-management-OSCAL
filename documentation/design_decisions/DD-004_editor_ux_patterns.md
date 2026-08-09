# DD-004: Editor UX Patterns

## Status: Accepted
## Date: 2026-07-17
## Decision Makers: Development Team

## Context
The editors need consistent UX patterns for editing OSCAL documents across catalog and profile views.

## Decisions

### 1. Dual-Mode Editor (Visual + JSON)
- Every document supports both visual editing and raw JSON editing
- Switching modes synchronizes data bidirectionally
- JSON mode validates against the official NIST schema on mode switch
- No data loss during sync — unknown/custom fields are preserved

### 2. Inline Editing
- Control titles, IDs, and class attributes are edited in-place (click to edit)
- Properties/tags use a combined card layout with autocomplete
- Prose parts (statements, guidance) use debounced textareas (300ms)
- Parameter inserts in prose use `ProseWithParams` and are triggered by a dedicated 'Add Parameter' button next to prose edit actions. This applies universally across 4 editor domains:
  1. Control Statements & Sub-Control Enhancements (`ControlDetailView` & `EnhancementsAccordion`)
  2. Group Description Parts (`GroupEditor` & `PartsEditor`)
  3. Parameter Metadata (`ParameterCard` usage & guidelines fields)
  4. Assessment Objectives & Methods (`DocumentEditor` / `AssessmentPlanEditor`).
  In all 4 domains, clicking 'Add Parameter' opens a caret-relative popover selection dropdown inside the textarea with a 'Define New Parameter...' shortcut that triggers an `onNewParam` callback to scroll to and create a parameter at the corresponding scope.

### 3. Undo/Redo
- Manual history stack (not browser-native)
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo)
- History entries store the full document snapshot (simple but memory-safe for typical document sizes)

### 4. Draft Auto-Save & Mode Navigation (Toolbar UX)
- Auto-save to backend every 30 seconds during editing (`<uuid>_draft.json`).
- **Single Active Draft Rule**: Exactly one active draft exists per document (`<uuid>_draft.json`).
- **Draft Detection (Server-Truth)**: The `hasDraft` signal is derived exclusively from the version list returned by the backend (`versions.some(v => v.is_draft)`), **not** from the OSCAL `document-status` metadata property (which represents a separate lifecycle concept per DD-023). This ensures the Draft pill in `VersionDropdown` only appears when a `_draft.json` file actually exists on the server.
- **Segmented Mode Toggle (`[ 👁️ View | ✏️ Edit ]`)**: A persistent segmented control across all OSCAL document toolbars (`DocumentToolbar`).
  - Selecting `👁️ View` auto-saves any active draft silently in the background and switches the interface to Read-Only preview instantly (`reload({ silent: true })`).
  - While in `👁️ View` mode, the user can freely select and inspect historical published versions (`v1.0.0`, `v0.9.0`) or the active `📝 Draft` via the `VersionDropdown`.
  - Selecting `✏️ Edit` activates inline editing:
    - If a working `📝 Draft` already exists, the editor seamlessly loads that active `📝 Draft`.
    - If no draft exists, it initializes a new working `📝 Draft` based on whichever published version the user was currently inspecting.
  - Both transitions synchronize browser history/URL search parameters (`?edit=true` vs base path) via `window.history.replaceState`.
- **Edit-Mode Locking Rule**: When `isEditing === true`, the `VersionDropdown` is **locked** and always displays `📝 Draft (editing)` with a 🔒 indicator. The dropdown toggle is disabled — no version switching is possible during editing. This prevents accidental data loss from switching versions with unsaved edits. The dropdown fully unlocks when the user returns to `👁️ View` mode.
- **Unified Header Version Selector (`VersionDropdown`)**:
  - Located directly in the top header toolbar title area next to the document type badge.
  - Automatically displays **`📝 Draft`** whenever a working draft exists on the server (`_draft.json`).
  - When viewing a published version, displays that version badge (e.g., `v1.0.0`).
  - Contains a **`🗑️ Delete Draft`** button inside the draft menu item, allowing instant discarding of temporary draft edits (`<uuid>_draft.json`) and reverting to the last published active version.
  - Replaces the separate right-side "Version History" drawer button and standalone status selector.

### 5. Version Management
- Dropdown-based version selector integrated directly into the header toolbar (`VersionDropdown`).
- Opens a sleek menu listing the active **Draft** (if uncommitted changes exist) with a `🗑️ Delete Draft` action, and all historical published version snapshots (`v1.0.0`, `v0.9.0`, etc.) with timestamps and remarks.
- "Publish Version" action triggers version bump dialog with version number input + remarks, converting `📝 Draft` into a permanent published version and clearing `<uuid>_draft.json`.
- Historical published versions are read-only point-in-time snapshots.
- `metadata.version` auto-synchronized with the active version number; `metadata.revisions[]` auto-updated on each version save.

### 6. Cross-Domain Visual Consistency (see DD-001)
- Control detail views in Catalog and Profile editors are unified into a single polymorphic component, `ControlDetailView` (see [DD-008](DD-008_unified_control_detail_editor.md))
- Data mutation logic remains domain-specific (direct mutation for Catalog, modify.alters for Profile, resolved using adapters/callbacks)
- Prose formatting uses a single shared `formatProse()` utility from `oscal-utils.js`
- Section layout pattern: `section-container` class with `border-top` separators, consistent spacing
- Control enhancements (sub-controls) are rendered in both modes as a collapsed-by-default accordion containing a unified box/table list of ID and Title rows. Selecting a sub-control row navigates directly to its specific detail view instead of displaying full sub-control details inline.

### 7. Premium Group Details Editor
- Group overview page features a modern glassmorphic banner header (`.group-banner-header`), distinct metrics cards (`.premium-metric-card-styled`), and a unified box/table-based listing for sub-groups and controls that matches the Document Overview layout.
- The Controls listing contains only the direct controls of the group. Nested control enhancements (sub-controls) are not rendered in the group view list and are only visible inside the specific Control Detail view when a control is opened.
- Uses `flex-shrink: 0` on headers and metric grids to prevent flex layout squeezing when content overflows.

### 8. Interactive Merge Structuring Mode Selector in Profile Sources Panel
- The `SourcesPanel` combines mode selection and source imports into an **ultra-compact 2-row setup panel** directly below the header.
- Both label columns (`⚙️ Structuring Mode:` and `📥 Add Import:`) use exact fixed column widths (`width: 145px`, `flexShrink: 0`), guaranteeing pixel-perfect vertical alignment of the left edges of both select dropdowns.
- **Row 1**: Structuring Mode selection (`⚙️ Structuring Mode: as-is / custom / flat`).
- **Row 2**: Unified source import selection (**`📥 Add Import:`**). Contains a single combined dropdown listing both Catalogs (`📖`) and Profiles (`⚙️`) in clear optgroups with icons.
- Selecting `as-is` clears `profile.merge.custom` and sets `profile.merge = { "as-is": true }`, causing the profile sidebar to render the original catalog folder structures of all imported catalogs 1:1 dynamically. In `as-is` mode, structure cloning buttons are hidden from import cards since `as-is` automatically merges all imported catalog structures.
- Selecting `flat` sets `profile.merge = { flat: true }`, flattening all controls into a single unstructured list.
- Selecting `custom` enables custom group management under `profile.merge.custom`. In `custom` mode, each catalog import card renders a single clean button **`📥 Import Full Structure`** to copy a catalog's hierarchy into custom profile groups. Structure copying is **additive** (appends new catalog groups to existing custom groups without overwriting) and executes instantly without disruptive `window.confirm()` popups.
- **Import Baseline Cleanup**: When removing an import source via `Remove`, if 0 imports remain, `profile.merge` automatically resets to `{ "as-is": true }` and custom groups are cleared so no orphan groups linger in the left sidebar.

### 9. Editor Paradigm Classification

| Paradigm | Description | Steps |
|---|---|---|
| Tree + Detail | Sidebar tree navigation → control detail panel (DD-008) | 1, 2 |
| Multi-Card Sections | Tabbed/stacked card sections within a document | 4 (System Characteristics, Implementation) |
| Entity List-Detail | Table → slide-out/expand detail panel (DD-021) | 3, 5, 6, 7 |
| Matrix Editor | 2D grid with cell-level editing (DD-019) | 8 |
| Timeline Editor | Horizontal Gantt with dependency arrows (DD-022) | 5 (Tasks) |

Note: Dual-mode visual/JSON editing (§1), undo/redo (§3), draft auto-save (§4), and version management (§5) apply ACROSS all paradigms.

### 10. Memory-Efficient Undo/Redo for Large Documents
- For documents < 1MB: Continue using full document snapshots (current behavior per §3)
- For documents ≥ 1MB: Use structural diff patches (RFC 6902 JSON Patch format) instead of full snapshots
- Max 50 undo entries; older entries are discarded (FIFO)
- Large Base64 `back-matter.resources[]` content excluded from undo tracking (treated as immutable once attached)
- IndexedDB preferred over localStorage for draft storage when document > 5MB (localStorage has 5-10MB browser limits)
- Auto-save debounce interval increases from 30s to 120s for documents > 5MB

## Cross-References
- DD-008 (ControlDetailView, Steps 1-2)
- DD-020 (Status Badges)
- DD-021 (Entity List-Detail, Steps 3-8)
- DD-022 (Dashboard Components)
- DD-023 (Document Lifecycle)

## Consequences
- Consistent UX across catalog and profile editors
- Users can always fall back to JSON mode for unsupported fields
- Draft recovery prevents data loss on accidental navigation
- Visual changes to control detail rendering only need to be made in one place
- Clear visibility of active profile merge structuring mode prevents user confusion regarding custom grouping versus original catalog structure.

