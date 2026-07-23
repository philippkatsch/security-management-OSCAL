# DD-013: Universal ProseWithParams Integration Pattern

## Status: Proposed
## Date: 2026-07-22
## Decision Makers: Development Team

## Context
Parameter insertion in OSCAL requirement text (`{{ insert: param, param_id }}` / `<insert type="param" id-ref="..."/>`) was initially implemented specifically for control statement textareas. However, OSCAL requirements and assessment specifications require parameter references across multiple editor contexts:
1. Control Statements & Sub-Control Enhancements (`ControlDetailView`, `EnhancementsAccordion`)
2. Group Description Parts (`GroupEditor`, `PartsEditor`)
3. Parameter Card Metadata (`ParameterCard` usage & guidelines fields)
4. Assessment Objectives & Assessment Methods (`DocumentEditor`, `AssessmentPlanEditor`)

To avoid fragmented implementations, a standardized polymorphic component interface and callback architecture is needed for `ProseWithParams`.

## Decisions

### 1. Polymorphic Component Architecture (`ProseWithParams`)
The `ProseWithParams` component acts as a wrapper around `DebouncedTextarea` and manages caret-relative popover positioning, parameter dropdown listing, and token insertion.

Standard Props Interface:
- `value`: Current prose text string.
- `onChange`: Callback function `(newValue) => void`.
- `availableParams`: Array of visible parameters in scope (hierarchically merged catalog, group, control, or plan params).
- `onNewParam`: Optional callback function `() => void` invoked when the user selects "➕ Define New Parameter...".
- `paramScope`: Scope indicator (`"control" | "group" | "catalog" | "assessment-plan"`).
- `placeholder`: Optional textarea placeholder text.
- `disabled`: Read-only / edit mode toggle flag.

### 2. Caret-Relative Popover Positioning
- The "Add Parameter" button calculates the current cursor position (line and column offsets) within the active textarea using a hidden mirror DOM node or textarea caret coordinates.
- The parameter selection dropdown opens floating directly adjacent to the caret position.
- Keyboard navigation (Arrow keys, Enter, Escape) and click-outside handling close the popover cleanly.

### 3. Domain Integration Map

| Editor Domain | Component | Scope of Available Params | `onNewParam` Callback Behavior |
|---|---|---|---|
| Control Statements | `ControlDetailView` / `PartsEditor` | Catalog + Group + Control + Profile (`set-parameters`) | Instantly create control/profile param (`set-parameters`) & scroll to `#param-card-section` |
| Sub-Controls | `EnhancementsAccordion` | Catalog + Group + Sub-Control + Profile | Instantly create sub-control param override & scroll to sub-control param card |
| Group Descriptions | `GroupEditor` / `PartsEditor` | Catalog + Group + Profile (`set-parameters`) | Instantly create group/profile param & scroll to `#group-parameters-card` |
| Parameter Metadata | `ParameterCard` | Catalog + Group + Control (excluding self) | Scroll to `+ Add Parameter` button at container level |
| Assessment Plan | `AssessmentPlanEditor` | Import SSP + Baseline Profile + AP Local | Scroll to `#ap-local-parameters` & append to `local-definitions` |

### 4. Insertion Token Standard
Selection of a parameter from the popover inserts `{{ insert: param, <param-id> }}` at the exact cursor index. During rendering in view mode, `formatProse()` resolves this token into an interactive parameter chip badge.

## Consequences
- Single, reusable parameter insertion UX across all 4 editor domains.
- Predictable scroll-and-create behavior when defining new parameters from any text field.
- Full compliance with documentation requirements R1–R4.
