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

## Consequences
- Consistent UX across catalog and profile editors
- Users can always fall back to JSON mode for unsupported fields
- Draft recovery prevents data loss on accidental navigation
- Visual changes to control detail rendering only need to be made in one place
