# DD-008: Unified Control Detail Editor Component (`ControlDetailView`)

## Status: Accepted
## Date: 2026-07-19
## Decision Makers: Development Team

## Context
In Reposol, controls and subcontrols (enhancements) need to be viewed and edited in both the Catalog Builder (direct document mutation) and the Profile Tailoring editor (OSCAL-compliant alterations). Previously, these two views used duplicate rendering logic (`ControlDetail.jsx` and `ProfileDetailPanel.jsx`), causing visual inconsistencies, high maintenance overhead, and bugs in profile tailoring.

To solve this, we unified the detail panel into a single component: `ControlDetailView.jsx`. Since this is a central component, its architectural design, modes, and tailoring logic must be clearly documented.

## Decisions

### 1. Dual-Mode Architecture (Catalog vs. Profile)
The `ControlDetailView` component behaves as a polymorphic editor based on the `mode` prop:
- **`mode="catalog"` (Direct Mutation):**
  - Used when editing a Catalog.
  - Direct CRUD changes are dispatched to `onControlChange` (e.g., editing IDs, renaming titles, adding/deleting statements, editing parameters).
- **`mode="profile"` (OSCAL Alterations):**
  - Used when editing a Profile.
  - Controls are rendered using the resolved state, but modifications are serialized into the profile's `modify.alters` (for props, parts, links) and `modify.set-parameters` (for parameters) via `onProfileChange`.
- **`EnhancementsAccordion` Polymorphism:**
  - The `EnhancementsAccordion` component supports inline sub-control expansion in both Catalog (`mode="catalog"`) and Profile (`mode="profile"`) modes. In Profile mode, sub-control statements use `ProseWithParams` for caret-relative parameter insertion, and parameter overrides are mapped to `modify.set-parameters` referencing the sub-control's parameter ID.

### 2. State Mapping & Resolution for Profile Editing
Because the resolution engine (`resolveProfileSync`) filters out deleted items and resolves parameter overrides, the editor needs to reconstruct the edit-state to maintain visual traceability:
- **Properties (Tags):**
  - The editor retrieves original properties from `originalControl.props`.
  - Properties that are deleted are resolved by checking `alter.removes[].by-name`.
  - In Edit Mode, deleted properties are rendered with `opacity: 0.6` and `text-decoration: line-through` in the `PropsEditor`, with a `↺` restore button.
  - In View Mode and resolved preview, they are completely omitted.
- **Prose Parts (Statements/Guidance):**
  - The editor maps `originalControl.parts` to allow inline text editing.
  - Original statements removed via `alter.removes[].by-id` are rendered struck through with a `↺ Restore` action.
  - Newly added supplemental statements (defined in `alter.adds[]` at `ending`, `starting`, `before`, or `after` positions) are injected into the rendering tree and decorated with an `[Added]` badge.
  - Newly added statements allow custom name/type selection (dropdown) and custom ID configuration (text input).

### 3. Adapters & Callbacks Pattern
To keep the component reusable:
- Direct UI actions (like `PropsEditor` changes, links editing, parameter overrides) call unified handlers (`handlePropsChange`, `handleLinksChange`, `handleProseChange`).
- These handlers use the `mode` prop to determine whether to call `onControlChange` (catalog mode) or update the profile's alters via `updateAlter` and call `onProfileChange` (profile mode).
- Custom sub-component rendering (like inline enhancements in profiles) is injected via function callbacks (`renderEnhancementContent`).
- Sub-control prose text edits in Profile mode map to `modify.alters` on the sub-control ID, and parameter overrides map to `modify.set-parameters`.

## Consequences
- **Zero Visual Regression:** Catalogs and Profiles render controls using identical CSS styling (`section-container`, `header-card`, `badge`) and layout spacing.
- **Strict Compliance:** All profile edits are validated against the standard OSCAL rules for alters (e.g., adding tags as `adds`, deleting tags as `removes`, and preventing direct renaming of original statement IDs).
- **Maintainability:** Layout adjustments, typography, or new metadata fields for controls only need to be implemented once in `ControlDetailView.jsx`.
