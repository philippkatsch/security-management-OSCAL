# DD-014: Live UI Form Field Validation & Real-Time Schema Guidance

## Status: Proposed
## Date: 2026-07-22
## Decision Makers: Development Team

## Context
Currently, OSCAL JSON Schema validation only triggers when explicitly clicking "Validate Schema" in Raw JSON mode or when saving non-draft documents. In Visual UI mode, form fields (such as `published` date, `email-addresses`, or UUIDs in `MetadataEditor`) allow users to enter arbitrary string values like `"asdf"`, which cause unexpected schema validation failures upon document save or JSON mode inspection.

## Decisions

### 1. Client-Side OSCAL Datatype Validation Utilities (`oscal-utils.js`)
Introduce client-side helper functions for checking standard OSCAL field constraints:
- `isValidIsoDateTime(str)`: Validates ISO 8601 timestamps (`YYYY-MM-DDTHH:MM:SSZ` or timezone offset format). Returns `true` if valid or if empty/falsy.
- `isValidEmail(str)`: Validates RFC 5322 email address format.
- `isValidUuid(str)`: Validates standard UUID v4 format (`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`).

### 2. Live Field Validation & Visual Guidance in `MetadataEditor`
- Add stateful field validation in `MetadataEditor` for `published`, `version`, `email-addresses`, and UUID fields.
- Show an inline error label and red border when an invalid format is entered.
- Automatically prune empty optional string fields (such as empty `published` date) from the metadata dictionary so that an empty string `""` is never sent to the backend schema validator.

### 3. Integrated Real-Time Pre-Save Sanitization
- In `handleFieldChange` within `MetadataEditor`, if an optional field (like `published`) is cleared, delete the key from the metadata object.

## Consequences
- Users get immediate visual feedback when entering dates, emails, or UUIDs in visual mode.
- Schema validation failures caused by accidental typos in visual form fields are eliminated at the source.
- Optional fields do not leave dangling empty strings `""` that violate strict schema regexes.
