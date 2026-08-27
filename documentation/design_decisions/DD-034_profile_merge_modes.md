# DD-034: Profile Merge Modes and OSCAL Compliance

## Status: Accepted
## Date: 2026-08-25
## Decision Makers: Development Team

## Context

OSCAL Profiles define how imported controls from source catalogs are structured in the resolved output catalog. The `merge` directive controls this structuring. Our implementation must be 100% OSCAL-compliant in the JSON output while providing a good user experience.

## OSCAL Specification Reference

Source: [OSCAL Profile Resolution Specification](https://pages.nist.gov/OSCAL/concepts/processing/profile-resolution/)
Local: `oscal-reference/OSCAL/src/specifications/profile-resolution/profile-resolution-specml-working.xml`

The merge directive has two parts:
1. **Combine** (`merge.combine.method`): How to handle duplicate controls from multiple imports
2. **Structuring** (`merge.flat` | `merge.as-is` | `merge.custom`): How to organize the output

## Decisions

### 1. Three Structuring Modes

#### `as-is` — Keep Original Structure
- Controls retain their original catalog group structure
- Groups and nesting are preserved exactly as in the source catalog
- If a control has a parent group, that group appears in the output with all non-control children intact
- **Use case:** "I want the original catalog structure, just with some controls removed"

#### `flat` — No Groups, No Nesting
Per OSCAL spec (`req-merge-flat`):
> "Profiles with the 'flat' merge directive MUST be resolved as unstructured catalogs, with no grouping or nesting of controls."

Implementation requirements:
- **All groups are removed** — the group structure is completely eliminated
- **All controls are extracted** to the top level of the catalog
- **Nested controls (enhancements)** are also pulled up — everything is on one level
- **Result:** `catalog.controls = [AC-1, AC-1(1), AC-1(2), AC-2, ...]` with no structure whatsoever
- **Flat merge CANNOT be combined with categories/groups.** If you need groups, use `as-is` or `custom`.

#### `custom` — Define Own Group Structure
Per OSCAL spec:
> "The custom element represents a custom arrangement or organization of controls in the resolution of a catalog."

- Profile authors define their own groups under `merge.custom.groups`
- Controls are assigned to groups via `insert-controls` directives
- Groups in `custom` mode are **new organizational containers** — they may match source catalog group IDs (inheriting metadata) or be entirely new
- **Use case:** "I want to reorganize controls by department instead of by NIST family"

### 2. Combine Methods

#### `use-first` (Default)
The first definition of a control (by ID) is used; subsequent duplicates are discarded.

#### `keep`
All definitions are kept, even if they produce duplicate IDs. This may result in invalid output but ensures no data is lost.

### 3. `with-child-controls` Removed from UI

Previously, a global `with-child-controls` checkbox controlled whether selecting a parent control automatically included its enhancements. This has been replaced by a **tree-structured Control Selection Dialog** where:
- Parent controls show their enhancements as collapsible children
- Users can select/deselect individual enhancements
- A "Select All" button per parent control includes/excludes all its enhancements

This approach is more transparent and universal (works for both BSI Grundschutz and NIST SP 800-53).

### 4. Local Controls (Reposol Extension)

OSCAL profiles **cannot** define their own controls — all controls must come from imported catalogs. Reposol provides a `local-controls` convenience feature that:
1. Accepts control definitions in the profile editor UI
2. **On save:** Extracts them into a separate OSCAL Catalog document and adds an import reference
3. **On load:** Reconstructs the `local-controls` field from the auto-generated catalog

The stored JSON is **100% OSCAL-compliant** — `local-controls` never appears in the persisted profile.

## Implementation

### Backend (`resolution_service.py`)
- `_flatten_all()`: Recursively extracts all controls (including nested enhancements) from groups, strips `controls` sub-arrays, returns flat list
- `_apply_custom_structure()`: Resolves custom group definitions by matching `insert-controls.include-controls.with-ids` against the flat controls map

### Frontend (`profile-resolver.ts`)
- Flat: `Array.from(flatControlsMap.values()).map(c => ({ ...c, controls: undefined }))`
- Custom: Recursive `resolveCustomGroup()` matching controls by ID
- As-is: Direct pass-through of merged groups/controls

## Consequences

- **OSCAL Compliance:** All three merge modes produce OSCAL-valid output catalogs
- **User Experience:** Descriptive labels and hints guide users to the correct merge mode
- **Extensibility:** Custom merge supports arbitrary group nesting and control assignment via drag-and-drop
