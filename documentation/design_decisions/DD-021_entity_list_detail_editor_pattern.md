# DD-021: Entity List-Detail Editor Pattern

## Status: Proposed
## Date: 2026-07-27
## Decision Makers: Development Team

## Context
DD-004 and DD-008 define editor UX patterns for the tree-based Catalog (Step 1) and Profile (Step 2) editors. Steps 3-8 introduce a fundamentally different UI paradigm: entity-based list-detail editing. Components, SSP sections, assessment tasks, observations, risks, findings, POA&M items, and mapping entries all follow a pattern of: browse a filterable table → open a detail panel → edit fields inline → save. This pattern is undocumented, leading to inconsistent implementations across stages.

---

## Decisions

### 1. Three-Tier Architecture
Standardize the entity editing flow as:

```text
EntityTable (filterable, sortable, multi-select)
  → EntityDetailPanel (slide-out or expandable card)
    → InlineFieldEditors (contextual save per field/section)
```

Each tier is a reusable React component in `components/shared/entity/`:
- `EntityTable.jsx` — generic data table with standard behaviors
- `EntityDetailPanel.jsx` — configurable detail panel shell
- `EntityFieldGroup.jsx` — grouped inline editors with section headers

### 2. EntityTable Standard Behaviors
- **Column sorting**: Click column header to toggle asc/desc. Active sort indicated by arrow icon.
- **Full-text search**: Search input in table header, debounced 300ms, searches across all visible columns.
- **Filter dropdowns**: Per-column filter for status/type enums. Uses DD-020 StatusBadge for filter chips.
- **Row click**: Opens EntityDetailPanel (no full-page navigation for simple entities).
- **Checkbox column**: First column for multi-select. Shift+click for range selection.
- **Virtual scrolling**: Activate for lists > 100 items using `react-window` or equivalent.
- **Empty state**: Centered illustration + 'Create your first [entity]' CTA button.
- **Add button**: Primary action button in table header: '+ Add [Entity Type]'.

Column configuration is declarative per entity type:

```javascript
const componentColumns = [
  { key: 'title', label: 'Name', sortable: true, searchable: true },
  { key: 'type', label: 'Type', sortable: true, filterable: true, render: StatusBadge },
  { key: 'purpose', label: 'Purpose', searchable: true },
  { key: 'version', label: 'Version', sortable: true },
  { key: 'last-modified', label: 'Modified', sortable: true, type: 'date' },
];
```

### 3. EntityDetailPanel Modes
Three rendering modes, selected per entity type (not user-configurable):

| Mode | Description | Panel Width | Entity Types |
|---|---|---|---|
| **slide-out** | Right-side overlay panel | 40-50% viewport | Tasks, Activities, Observations, Log Entries, Maps |
| **accordion-expand** | Inline expansion below table row | Full table width | Simple entities: Links, Subjects, Evidence items |
| **full-page** | Route navigation to dedicated page | 100% | Complex entities: Components, SSP System Chars, POA&M Items |

Each mode shares:
- Header with entity title, type badge (DD-020), and action buttons (Edit/Delete/Duplicate)
- Close button (X) or back navigation
- DD-004 dual-mode (Visual + JSON) toggle available in slide-out and full-page modes

### 4. Batch Operations Framework
When ≥1 table rows are selected via checkboxes, a `BatchActionToolbar` appears:
- Fixed position at bottom of table viewport (sticky footer)
- Shows selected count: '{N} items selected'
- Standard actions: 'Delete Selected', 'Export Selected (JSON)'
- Entity-specific actions configured per entity type:
  - Risks: 'Set Status...', 'Set Priority...', 'Mark as False Positive'
  - Observations: 'Set Method...', 'Bulk Import (CSV/JSON)'
  - POA&M Items: 'Set Status...', 'Assign Responsible Party...'
  - Findings: 'Set Target Status...'
- 'Select All' / 'Deselect All' toggle in toolbar
- Confirmation dialog for destructive actions (delete)

### 5. Entity Type Configuration Map
Document which entity types use which modes:

| Step | Entity Type | Detail Mode | Batch Enabled | Primary Sort |
|---|---|---|---|---|
| 3 | Component | full-page | Yes (delete) | Name |
| 3 | Capability | slide-out | No | Name |
| 3 | Control Implementation Set | slide-out | No | Source |
| 4 | System User | slide-out | Yes (delete) | Title |
| 4 | Inventory Item | slide-out | Yes (delete) | Label |
| 4 | Implemented Requirement | full-page | No | Control ID |
| 4 | Leveraged Authorization | slide-out | No | Title |
| 5 | Task | slide-out | No | Title |
| 5 | Activity | slide-out | No | Title |
| 5 | Assessment Subject | accordion-expand | No | Type |
| 6 | Result Set | full-page | No | Start Date |
| 6 | Observation | slide-out | Yes (import, method) | Collected Date |
| 6 | Risk | slide-out | Yes (status, priority) | Priority |
| 6 | Finding | slide-out | Yes (target status) | Target ID |
| 6 | Remediation | accordion-expand | No | Lifecycle |
| 6 | Log Entry | accordion-expand | No | Start |
| 7 | POA&M Item | full-page | Yes (status) | Title |
| 7 | Risk (POA&M) | slide-out | Yes (status, priority) | Priority |
| 7 | Observation (POA&M) | slide-out | Yes | Collected Date |
| 8 | Mapping Collection | full-page | No | Title |
| 8 | Map | slide-out | Yes (delete) | Source ID |

### 6. Relationship to Existing DDs
- **DD-004** (Dual-mode editing, undo/redo, draft auto-save): Applies WITHIN the EntityDetailPanel. The detail panel inherits all DD-004 patterns.
- **DD-008** (ControlDetailView): Used when an entity REFERENCES controls. E.g., SSP `implemented-requirements` uses ControlDetailView in read-only mode to display the control, with `by-component` narrative editors below.
- **DD-017** (Shared Assessment Entities): Provides the specific card components (ObservationCard, RiskCard, FindingCard) that are embedded INSIDE the EntityDetailPanel for assessment entities.
- **DD-020** (Status Badges): All status columns and filter chips use the unified StatusBadge component.

---

## Consequences
- Consistent entity editing experience across Steps 3-8
- EntityTable is the single source of truth for list behavior, eliminating per-stage reimplementation
- Batch operations are standardized and predictable
- Adding a new entity type only requires defining a column configuration and selecting a detail mode
- The pattern is complementary to DD-004/DD-008, not a replacement
