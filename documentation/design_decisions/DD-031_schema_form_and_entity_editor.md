# DD-031: Schema Form and Entity Editor

## Status: Accepted
## Date: 2026-08-10
## Decision Makers: Development Team

## Context
Across all 8 stages of the Reposol application, developers were manually constructing forms using raw `<input>`, `<select>`, and textareas. This approach led to boilerplate code, inconsistent validation, missing dirty/touched state handling, and brittle deeply-nested state updates for complex OSCAL objects.

## Decisions

### 1. The `EntityEditor` Component
We introduce the `EntityEditor` component as the definitive standard for all entity editing across the application (replacing the manual layout in `EntityDetailPanel`). It provides a generic, declarative way to render forms based on a configuration schema.

### 2. Field Components Framework
Standardized field components encapsulate accessible markup, styling, and validation:
- `TextField`: Standard text input.
- `SelectField`: Dropdown enumerations.
- `UUIDField`: Read-only or auto-generating identifier fields.
- `DateTimeField`: ISO-8601 date-time picker.
- `MarkdownField`: Debounced textarea for OSCAL prose.
- `ArrayField`: Dynamic list management for arrays of primitives or objects.

### 3. FormContext
A centralized `FormContext` wraps the `EntityEditor`, automatically tracking:
- `isDirty`: Whether the form has unsaved changes.
- `touched`: Which fields the user has interacted with.
- `errors`: Validation errors mapped to field paths.

### 4. FieldConfig Schema
Forms are no longer built imperatively. Instead, developers define a `FieldConfig` schema:
```typescript
const componentConfig: FieldConfig[] = [
  { name: 'title', type: 'text', label: 'Component Name', required: true },
  { name: 'type', type: 'select', options: ['software', 'hardware', 'service'] },
  { name: 'props.version', type: 'text', label: 'Version' }
];
```

### 5. Path-Based Nested Object Updates
Using dot-notation in the `FieldConfig` (e.g., `props.version`), the form engine utilizes Immer and lodash `set`/`get` internally to perform safe, immutable updates to deeply nested OSCAL properties without complex spread syntax.

## Consequences
- **Consistency**: All forms across the application look and behave identically.
- **Velocity**: Adding new entities or fields requires only editing a schema configuration array.
- **Reliability**: Complex nested updates are handled safely by the engine, eliminating bugs related to manual object spreading.
