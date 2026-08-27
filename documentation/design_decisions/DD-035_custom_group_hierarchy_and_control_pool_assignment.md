# DD-035: Custom Group Hierarchy and Control Pool Assignment

## Status: Accepted
## Date: 2026-08-25
## Decision Makers: Development Team

## Context

In OSCAL Profiles, the `merge.custom` directive enables profile authors to reorganize controls imported from one or more catalogs into an organization-specific hierarchical structure (e.g., categorizing controls by organizational domain, operational department, or custom security baseline) rather than retaining the source catalog's original structure (`as-is`) or flattening the catalog (`flat`).

Prior to this decision, custom grouping in Reposol was limited to basic group creation within the MergeConfigurator panel without comprehensive drag-and-drop support, visual pool management, inline hierarchy editing in the sidebar navigation tree, or full integration with the Document Actions architecture (DD-029) and Backend Resolution Engine (DD-028).

To provide an intuitive, high-productivity tailoring experience that remains 100% compliant with the NIST OSCAL Profile Specification (v1.1.2), this design decision establishes the architecture for custom group lifecycles, dual-surface control assignment, virtual unassigned control state handling, and live resolution synchronization.

## OSCAL Specification Reference

- **Specification**: [NIST OSCAL Profile Model v1.1.2 - Profile Resolution](https://pages.nist.gov/OSCAL/concepts/processing/profile-resolution/)
- **Schema Reference**: `merge` -> `custom` -> `groups` (`group[]`) & `insert-controls` (`insert-controls[]`)
- **Control Inclusion**: `insert-controls[].include-controls[].with-ids`
- **Sorting Rule**: `insert-controls[].order` (`keep` | `ascending` | `descending`)

Under the OSCAL specification:
1. `merge.custom.groups` defines new or restructured organizational containers (`groups`), which may contain arbitrary nested sub-groups (`groups.groups`).
2. Controls are assigned to groups via `insert-controls` directives targeting control IDs from the imported catalogs.
3. Groups and controls must not contain virtual UI placeholders in persisted JSON.

## Decisions

### 1. Pure Profile Document Actions Architecture (`profile-actions.ts`)

In accordance with DD-029 (Document Actions Pattern), all mutations to the profile document structure—including custom groups, nesting, control assignment, and removal—must be implemented as pure action functions inside `src/lib/document-actions/profile-actions.ts` wrapped with standard action middleware. React components must never perform direct mutable mutations or inline `produce()` calls on profile objects.

The core action interface comprises:
- `addCustomGroup(draft, { title, id?, parentGroupId? })`: Appends a new custom group at the root or within a specified parent group.
- `updateCustomGroup(draft, { groupId, patch })`: Updates metadata fields (title, id, class, props, links, parts) of a custom group.
- `deleteCustomGroup(draft, { groupId, reassignToGroupId? })`: Removes a group; if `reassignToGroupId` is omitted, its controls return to the unassigned pool.
- `moveCustomGroup(draft, { sourceGroupId, targetGroupId?, position })`: Moves or nests a group relative to another group (`before`, `after`, `inside`).
- `assignControlToGroup(draft, { controlId, targetGroupId, order? })`: Adds `controlId` to the group's `insert-controls.include-controls.with-ids`, removing it from any other custom group to maintain exclusive assignment.
- `removeControlFromGroup(draft, { controlId, sourceGroupId? })`: Removes `controlId` from custom group `insert-controls`, returning it to the unassigned pool.
- `setCustomGroupOrder(draft, { groupId, order })`: Sets ordering mode (`keep`, `ascending`, `descending`) on the group's `insert-controls`.

### 2. Dual-Surface Control Assignment (Sidebar Tree & Dual-Tree Hierarchy Mapper)

Control assignment and tailoring are performed seamlessly across two coordinated UI surfaces without requiring disconnected modal popup dialogs:

1. **Sidebar Navigation Tree Surface (`ProfileSidebar.tsx` & `ControlTree.tsx`)**:
   - Renders the custom group hierarchy.
   - Allows drag-and-drop of individual controls directly from the `"📥 Unassigned Controls"` virtual node into any custom group node.
   - Allows dragging controls between custom groups in the tree.
   - Provides drop indicators (`before`, `inside`, `after`) and visual target highlighting.
   - Context menus provide quick actions: "Add Sub-Group", "Remove from Group", "Delete Group".

2. **Main View Surface (`SourcesPanel.tsx` - Unified Single-Surface Workbench)**:
   - Renders the structured, collapsible **Source Catalog Hierarchy Tree** (Source Catalog → Families/Groups → Controls) directly below the top import configuration bar, eliminating separate sub-tabs (`Import Sources` vs `Control Pool & Assignment`).
   - Replaces and obsoletes isolated modal selection popups (`ControlSelectionDialog`), unifying both import-level inclusion/exclusion and merge-level custom group assignment in a single, continuous workbench.
   - Each imported catalog node header directly provides controls for inclusion mode (`Include All` vs `Include Specific`), structure import (`📥 Import Full Structure`), and source removal (`🗑️ Remove Source`).
   - Provides instant search and filter controls (by keyword, source catalog, assignment status `Assigned` / `Unassigned`).
   - Node items display control ID, title, origin catalog badge, and current assignment status (`✓ Assigned → [Group Name]` vs `📥 Unassigned`).
   - Supports family/group-level bulk assignment (`Assign All in Group to...`).
   - Supports multi-select checkboxes across controls with a sticky batch action bar (`N controls selected → Assign to... / Unassign`).
   - Supports dragging control or group nodes directly onto target custom group drop zones in the left sidebar tree.

### 3. Virtual Unassigned Controls Lifecycle & Boundary Separation

Unassigned controls represent active imported controls that have not yet been assigned to any custom group in `merge.custom.groups`.

- **Derived State**: Unassigned controls are calculated as a pure derived set:
  $$\text{Unassigned Controls} = \text{Active Imported Controls} \setminus \bigcup_{g \in \text{groups}} \text{AssignedControls}(g)$$
- **Virtual Tree Node**: Rendered in the sidebar tree as a special collapsible section `"📥 Unassigned Controls (N)"` containing all unassigned control items.
- **Strict Boundary**: The unassigned container is a pure UI helper. It is:
  - **Never persisted** to the Profile JSON document.
  - **Never passed** in API payloads as a real group.
  - **Excluded** from live resolution and catalog export outputs.
  - Automatically hidden in Read-Only / View Mode and when the unassigned count is 0.

### 4. Custom Group Lifecycle, Inline Renaming & Arbitrary Nesting

- **Creation**: Users can add top-level groups via the `➕ Add Custom Group` button in the sidebar footer or sub-groups via the group node context menu (`📁 Add Sub-Group`).
- **Inline Renaming**: Group titles and IDs can be edited directly inline within the tree node (double-click / edit icon) with instant commit on Enter/Blur and cancel on Escape, as well as via the dedicated `GroupEditor.tsx`.
- **Arbitrary Nesting**: Groups support recursive children (`group.groups[]`). The backend and frontend resolvers traverse nested groups recursively.
- **Deletion**: Deleting a group triggers a confirmation dialog offering to either return assigned controls to the unassigned pool or reassign them to the parent group.

### 5. Strict NIST OSCAL Profile Schema v1.1.2 Serialization & Sanitization

Serialization guarantees 100% compliance with NIST OSCAL Profile Schema v1.1.2:
- Control assignments are stored canonically under:
  ```json
  "merge": {
    "custom": {
      "groups": [
        {
          "id": "sec-ops",
          "title": "Security Operations",
          "insert-controls": [
            {
              "order": "keep",
              "include-controls": [
                {
                  "with-ids": ["ac-1", "ac-2", "si-4"]
                }
              ]
            }
          ],
          "groups": []
        }
      ]
    }
  }
  ```
- **Sanitization on Save (`profile_service.py` & client serializer)**:
  - Empty `groups` arrays and empty `insert-controls` entries are purged.
  - Any transient UI properties (such as `_isVirtual`, `expanded`, `isPoolNode`) are stripped before validation and disk persistence.
  - Groups without explicit `insert-controls` or sub-groups are normalized cleanly.

### 6. Bidirectional Resolution Sync & Backend Engine Hardening

- **Live Debounced Sync (500ms)**: Profile changes trigger a debounced update to `POST /api/resolve/profile/preview` via `useProfileResolution`, providing live resolved catalog and control tree updates in under 500ms.
- **Case-Insensitive Resolution**: Backend `_apply_custom_structure()` in `resolution_service.py` performs case-insensitive normalization on control IDs to prevent casing mismatches between catalog sources and `with-ids` entries.
- **Sub-group Conflict Detection**: Backend verifies that controls assigned across nested custom groups do not cause cyclic dependencies or duplicate ID collisions. Orphaned custom group control references (referencing excluded or non-existent controls) are flagged in the `conflicts` report (`orphaned_custom_group_refs`).

## Alternatives Considered

1. **Persisting an explicit "unassigned" group in Profile JSON**:
   - *Rejected*: Violates OSCAL semantics; would create an unintended real group in exported catalogs and third-party OSCAL tools.
2. **Client-side only custom group resolution**:
   - *Rejected*: Violates DD-028 (Server-Side Resolution Architecture). Backend must remain the single authoritative source of truth for resolved catalogs.
3. **Single-surface assignment (only Card Grid or only Tree)**:
   - *Rejected*: Sub-optimal user experience. Compliance officers require tree DnD for quick single-control adjustments and the card grid for bulk catalog tailoring.

## Consequences

### Positive
- **100% OSCAL Compliance**: Strictly adheres to NIST OSCAL v1.1.2 schema with zero schema pollution.
- **Architectural Separation**: Clean separation between pure Immer actions (`profile-actions.ts`), derived UI state (unassigned node), and server-side resolution (`resolution_service.py`).
- **High Ergonomics**: Dual-surface DnD and inline editing streamline large-scale baseline structuring.
- **Predictable History**: All group and assignment changes automatically record undo/redo history.

### Negative / Tradeoffs
- Nested drag-and-drop in tree components requires precise bounding rect calculation for `before` / `inside` / `after` drop positioning.
- Derived unassigned control state must be memoized effectively to prevent unnecessary re-renders on large catalogs (1,000+ controls).

## Compliance & Schema Verification

- **Profile Schema Validation**: Verified against `oscal_profile_schema.json` via backend `validation.py`.
- **Resolved Catalog Schema Validation**: Verified against `oscal_catalog_schema.json` via `resolve_profile_inline`.
- **Automated Tests**: Unit tests in `profile-actions.test.ts` and E2E integration tests in Playwright covering group lifecycle, drag-and-drop, and resolution round-tripping.
