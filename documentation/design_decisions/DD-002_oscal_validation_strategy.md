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
- `oscal_catalog_schema.json` (43KB) for catalogs
- `oscal_profile_schema.json` (54KB) for profiles
- Continue using `jsonschema` library but validate against official schemas
- Keep cross-reference validation (SSP → Profile/Component existence checks) as supplementary validation

## Error Reporting
Use `jsonschema.ValidationError` properties for detailed feedback:
- `error.absolute_path` → JSON path (e.g., `catalog.metadata.roles[0].title`)
- `error.message` → Human-readable error description
- `error.schema_path` → Which schema rule failed
- Return structured error array to frontend for field-level highlighting

## Consequences
- Validation becomes stricter — some existing documents may fail
- `additionalProperties: false` in NIST schemas means custom/non-standard fields will be rejected
- Profile `local-controls` preprocessing must run BEFORE validation (already handled by `preprocess_profile_for_saving()`)
- Performance: Larger schemas take slightly longer to validate, but this is negligible for single-document validation
