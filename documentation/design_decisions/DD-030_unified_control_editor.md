# DD-030: Unified Control Editor

**Supersedes DD-008**: This document replaces the obsolete `ControlDetailView` architecture.

## Status: Accepted
## Date: 2026-08-10
## Decision Makers: Development Team

## Context
Previously, viewing and editing controls was fragmented across three separate components: `CatalogControlEditor` (for direct mutations in Step 1), `ProfileControlOverlay` (for adapter-based alters in Step 2), and inline SSP editors (for implemented requirements in Step 4). This resulted in UI drift, duplicated rendering code, and complex maintenance. 

## Decisions

### 1. Unified Control Editor
We introduce a single `UnifiedControlEditor` component that handles all control rendering across Catalog, Profile, and SSP views.

### 2. Stage Adapter Pattern
The `UnifiedControlEditor` is completely polymorphic, driven by injected stage adapters that provide data mapping and mutation callbacks.
- **`CatalogAdapter`**: Maps direct inline edits to the underlying catalog document structure.
- **`ProfileAdapter`**: Maps edits to `modify.alters` and `modify.set-parameters` for tailoring.
- **`SSPAdapter`**: Maps implementation details to `implemented-requirements` and displays the resolved control in a read-only visual wrapper.

### 3. ControlEditorContext
To prevent massive prop-drilling through nested control properties, a `ControlEditorContext` is established. It provides stage-aware context to child components (e.g., statements, properties, enhancements), exposing current edit permissions, active adapters, and resolved parameter values.

### 4. Shared `ControlTree` Component
To navigate controls, a shared `ControlTree` UI component replaces the distinct `CatalogSidebar` and `ProfileSidebar`. 
- Powered by a `useControlTree` hook that interacts with the backend resolution endpoint (`get_control_tree`).
- Renders hierarchical groups and controls consistently across stages.
### 5. View Mode vs. Edit Mode Withdrawn & Removed Controls Handling
To maintain clean, distraction-free reading while preserving full authoring traceability:
- **View Mode (`👁️ View`)**: Withdrawn controls (`status: withdrawn`) and withdrawn groups in catalogs, as well as removed items in profiles (`alters.removes`), are **completely omitted / hidden** from navigation trees, group listings, and overview panels.
- **Edit Mode (`✏️ Edit`)**: Withdrawn and removed items are **visible** with explicit visual styling (dimmed/strikethrough text, `Withdrawn` status badge, withdrawal warning banner) and include action buttons such as `Restore Control` or `↺ Restore` to allow editors to inspect and reinstate them. Mutation actions like `Restore Control` are strictly omitted in View Mode.

## Consequences
- **Zero Visual Regression**: Controls always look identical whether you are writing them, tailoring them, or implementing them.
- **Clean Read-Only View**: Consumers inspecting catalogs or profiles see a clean, active baseline without visual clutter from withdrawn legacy elements.
- **Full Authoring Traceability**: Editors retain full visibility into deprecated or removed elements with one-click restore capabilities during editing sessions.
- **DRY Codebase**: Significant reduction in duplicated markup and styling logic.
- **Extensibility**: Adding a new stage (e.g., Assessment Plan objectives linking to controls) only requires writing a new adapter, not a new UI component.
