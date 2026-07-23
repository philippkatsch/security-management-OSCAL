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

### 4. Draft Auto-Save
- Auto-save to backend every 30 seconds during editing
- Saved as `<uuid>_draft.json`
- Drafts are automatically loaded by the backend API if they exist (overriding the older published version data).
- Exit button replaces Cancel — saves draft and navigates to read view

### 5. Version Management
- Drawer-based version history (right sidebar)
- "Save Version" dialog with version number input + optional remarks
- Old versions are read-only
- `metadata.version` auto-synchronized with the entered version number
- `metadata.revisions[]` auto-updated on each version save

### 6. Cross-Domain Visual Consistency (see DD-001)
- Control detail views in Catalog and Profile editors are unified into a single polymorphic component, `ControlDetailView` (see [DD-008](file:///c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/documentation/design_decisions/DD-008_unified_control_detail_editor.md))
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











## Consequences
- Consistent UX across catalog and profile editors
- Users can always fall back to JSON mode for unsupported fields
- Draft recovery prevents data loss on accidental navigation
- Visual changes to control detail rendering only need to be made in one place
- Clear visibility of active profile merge structuring mode prevents user confusion regarding custom grouping versus original catalog structure.

