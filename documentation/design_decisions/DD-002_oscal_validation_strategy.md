# DD-002: OSCAL Validation Strategy

## Status: Accepted
## Date: 2026-07-17
## Decision Makers: Development Team

## Context
The backend currently generates simplified JSON Schemas programmatically via `make_oscal_schema()` in `validation.py`. Official NIST OSCAL JSON Schemas (v1.1.2) already exist locally under `reposol/backend/app/schemas/` but are NOT used.

This means:
- Validation misses many valid OSCAL fields (e.g., `metadata.revisions`, `metadata.actions`, full party details)
- Validation may accept documents that fail official NIST validation
- Users get false confidence in schema conformity

## Decision
Switch validation to use the official NIST OSCAL JSON Schemas:
- `oscal_catalog_schema.json` for catalogs (Step 1)
- `oscal_profile_schema.json` for profiles (Step 2)
- `oscal_component-definition_schema.json` for component definitions (Step 3)
- `oscal_ssp_schema.json` for system security plans (Step 4)
- `oscal_assessment-plan_schema.json` for assessment plans (Step 5)
- `oscal_assessment-results_schema.json` for assessment results (Step 6)
- `oscal_plan-of-action-and-milestones_schema.json` for POA&Ms (Step 7)
- `oscal_mapping_schema.json` for mapping collections (Step 8)
- Continue using `jsonschema` library but validate against official schemas
- Keep cross-reference validation (SSP → Profile/Component existence checks) as supplementary validation

### Multi-Level Validation Framework

| Level | Name | When | What | Blocking? |
|---|---|---|---|---|
| L0 | Client-Side Live | On keystroke | Datatype checks (dates, UUIDs, emails per DD-014), field-length limits, regex constraints | Non-blocking (inline warnings) |
| L1 | Structural Schema | On save | Official NIST JSON Schema validation per document type | Blocking (400 error) |
| L2 | Internal Referential | On save | UUID cross-references within same document (finding→observation, poam-item→risk). See DD-017. | Blocking hard error |
| L3 | Cross-Document | On save | Import URIs resolve, referenced UUIDs exist in parent documents, stale detection. See DD-016. | Non-blocking warning |

### Cross-References
See also: DD-014, DD-016, DD-017.

## Error Reporting
Use `jsonschema.ValidationError` properties for detailed feedback:
- `error.absolute_path` → JSON path (e.g., `catalog.metadata.roles[0].title`)
- `error.message` → Human-readable error description
- `error.schema_path` → Which schema rule failed
- Return structured error array to frontend for field-level highlighting

## Consequences
- Validation becomes stricter — some existing documents may fail
- Validation now covers all 8 document types with 4 validation levels
- `additionalProperties: false` in NIST schemas means custom/non-standard fields will be rejected
- Profile `local-controls` preprocessing must run BEFORE validation (already handled by `preprocess_profile_for_saving()`)
- Performance: Larger schemas take slightly longer to validate, but this is negligible for single-document validation
