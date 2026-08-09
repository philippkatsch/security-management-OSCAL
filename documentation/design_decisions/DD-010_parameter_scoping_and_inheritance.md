# DD-010: Parameter Scoping and Inheritance in Catalogs and Profiles

## Status: Accepted
## Date: 2026-07-20
## Decision Makers: Development Team

> **Related Parameter Decisions:** This DD is part of the Parameter Architecture family:
> - [DD-009](DD-009_parameter_strategy.md): Lifecycle strategy — Profile vs. SSP vs. Component
> - **DD-010** (this): Scoping & Inheritance — Catalog → Group → Control hierarchy
> - [DD-011](DD-011_properties_vs_parameters_separation.md): Conceptual Separation — Properties (static metadata) vs. Parameters (dynamic placeholders)
> - [DD-012](DD-012_parameter_value_assignment_and_override_strategy.md): Value Assignment UX — Choice dropdowns, constraints, override rendering
> - [DD-013](DD-013_universal_prose_with_params_integration.md): Prose Integration — `ProseWithParams` component architecture

## Context
OSCAL allows parameter declarations at three hierarchical levels: Catalog-level, Group-level, and Control-level.
A parameter has a globally unique ID within the document. Any prose requirement can reference a parameter ID using `{{ insert: param, param-id }}`.
In our current implementation:
1. Only control-level parameters can be defined and managed.
2. In the prose editor's parameter insertion dropdown, only control-level parameters are visible, meaning catalog-level and group-level parameters cannot be inserted easily.
3. Group-level parameters are neither managed nor resolved during rendering.
4. Profiles can override parameters using `modify.set-parameters`, but this has only been tested and wired for control-level parameters.

We need a clear strategy on how to inherit, resolve, manage, and reference parameters across all three levels in both Catalog and Profile views.

---

## Decisions

> **Scope Note:** The parameter scoping hierarchy described in this DD (Catalog → Group → Control) applies specifically to **Catalog authoring (Step 1)** and **Profile tailoring (Step 2)**, where the hierarchical group/control tree structure exists. For Component Definitions (Step 3) and SSPs (Step 4), which use a flat component-based structure rather than a group hierarchy, parameter scoping follows the Component → Implemented Requirement → By-Component chain described in [DD-009](DD-009_parameter_strategy.md). For Assessment Plan local parameters (Step 5), see the Assessment Layer section in DD-009.

### 1. Unified Parameter Inheritance and Resolution
We will implement an inheritance-based parameter resolution map. For a given control `C`, the parameters visible to it are:
- Catalog parameters (fallback / lowest priority)
- Group parameters from all ancestor groups of `C` (medium priority)
- Control parameters of `C` (highest priority)

If a parameter ID is redefined at a lower level (e.g. control redefines a group-level parameter), the lower-level definition overrides the higher-level one.
This combined map of visible parameters will be used for:
- Resolving placeholders in prose rendering (Catalog and Profile views)
- Exposing parameters to the insertion dropdown in `ProseWithParams` and `PartsEditor`.

### 2. Grouped Parameter Insertion Dropdown
The parameter insertion dropdown in `ProseWithParams` will display all visible parameters grouped by their definition scope:
- `🌐 Catalog Parameters`
- `📁 Group Parameters`
- `🎯 Control Parameters (<control-id>)`

This allows users to easily reuse catalog-level or group-level parameters within their statements.

### 3. UI for Catalog-level and Group-level Parameter Management
We will introduce visual CRUD management interfaces for non-control parameters:
- **Catalog-level:** A new tab named `⚙️ Parameters` will be added to the catalog's `DocumentOverview` view. It will render the existing `ParameterEditor` component loaded with `catalog.params`.
- **Group-level:** An expandable `Group Parameters` card will be added to the `GroupEditor` view. Clicking it will reveal the `ParameterEditor` component loaded with the group's `params`.
- **`onNewParam` Callback Wireup:** When editing group prose in `GroupEditor` via `PartsEditor`, selecting 'Define New Parameter...' in the `ProseWithParams` dropdown invokes `onNewParam`, which appends a new parameter object to `group.params` and smooth-scrolls to the `Group Parameters` card.

Both views will reuse the robust `ParameterEditor` component, preserving schema compliance.

---

## Rationale
- **Redundancy Reduction:** Allowing catalog-level and group-level parameter definitions lets compliance officers specify common parameters once (like system review periods or organizational titles) and reference them across many controls.
- **Hierarchical Context:** Grouping parameters in the dropdown guides the user visually on where the parameter originates.
- **Component Reusability:** Reusing `ParameterEditor` minimizes bugs and maintains UI consistency across control, group, and catalog levels.

---

## Consequences
- Catalog and group JSON schemas will be fully populated with parameters under `.params`.
- Profiles can tailor any parameter from any scope by adding an override to `profile.modify.set-parameters` by referencing its ID.
- Resolving prose with parameters is now completely hierarchically scoped and fully aligned with NIST OSCAL specifications.
