"""
Empirical Challenger M2_2 Test Suite:
NIST OSCAL Profile Schema Validation & Merge Mode Integrity Testing.
Verifies boolean 'as-is: true' validity, alter structures, and parameter schemas.
"""
import pytest
from app.validation import validate_document, OSCALValidationError, _get_validator


@pytest.fixture
def minimal_profile_base():
    return {
        "profile": {
            "uuid": "e9c7d422-54a6-4dc5-b441-2a149cb240e1",
            "metadata": {
                "title": "Empirical Test Profile",
                "last-modified": "2026-08-31T18:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.0"
            },
            "imports": [
                {
                    "href": "catalogs/nist_sp_800_53.json",
                    "include-all": {}
                }
            ]
        }
    }


class TestM22SchemaAndMergeValidation:
    """Stress tests for Phase 2 OSCAL profile schema validation and merge behaviors."""

    @pytest.mark.asyncio
    async def test_as_is_boolean_true_passes_oscal_schema_validation(self, minimal_profile_base):
        """Verify that merge with 'as-is: true' is 100% valid against official NIST JSON Schema."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "as-is": True
        }

        # Must validate with zero errors
        await validate_document("profiles", profile_doc)

    @pytest.mark.asyncio
    async def test_as_is_object_fails_oscal_schema_validation(self, minimal_profile_base):
        """Verify that merge with 'as-is: {}' (the previous bug) FAILS validation as non-boolean."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "as-is": {}  # Object violates BooleanDatatype
        }

        with pytest.raises(OSCALValidationError) as exc_info:
            await validate_document("profiles", profile_doc)

        error_str = str(exc_info.value)
        assert "is not of type 'boolean'" in error_str or "as-is" in error_str

    @pytest.mark.asyncio
    async def test_flat_merge_mode_passes_oscal_schema_validation(self, minimal_profile_base):
        """Verify that merge with 'flat: {}' is valid per OSCAL schema."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["merge"] = {
            "combine": {"method": "merge"},
            "flat": {}
        }

        await validate_document("profiles", profile_doc)

    @pytest.mark.asyncio
    async def test_custom_group_merge_mode_passes_oscal_schema_validation(self, minimal_profile_base):
        """Verify that merge with custom groups is valid per OSCAL schema."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["merge"] = {
            "combine": {"method": "keep"},
            "custom": {
                "groups": [
                    {
                        "id": "grp-access-controls",
                        "title": "Access Control Hierarchy",
                        "insert-controls": [
                            {
                                "include-all": {},
                                "order": "keep"
                            }
                        ]
                    },
                    {
                        "id": "grp-audit-controls",
                        "title": "Audit & Accountability",
                        "insert-controls": [
                            {
                                "include-controls": [
                                    {"with-ids": ["au-1", "au-2", "au-6"]}
                                ],
                                "order": "ascending"
                            }
                        ]
                    }
                ]
            }
        }

        await validate_document("profiles", profile_doc)

    @pytest.mark.asyncio
    async def test_multiple_merge_modes_fails_integrity_validation(self, minimal_profile_base):
        """Verify that specifying multiple mutually exclusive merge modes (e.g. as-is AND flat) fails validation."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "as-is": True,
            "flat": {}
        }

        with pytest.raises(OSCALValidationError) as exc_info:
            await validate_document("profiles", profile_doc)

        assert "Profile merge must specify only one of flat, as-is, or custom" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_consolidated_alters_structure_passes_oscal_schema(self, minimal_profile_base):
        """Verify that 1:1 consolidated alters with additions, positions, and removals validate cleanly."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["modify"] = {
            "alters": [
                {
                    "control-id": "ac-1",
                    "adds": [
                        {
                            "position": "starting",
                            "parts": [
                                {
                                    "id": "ac-1_add_part_1",
                                    "name": "statement",
                                    "prose": "Pre-pended organization requirements statement."
                                }
                            ]
                        },
                        {
                            "position": "ending",
                            "parts": [
                                {
                                    "id": "ac-1_add_part_2",
                                    "name": "guidance",
                                    "prose": "Appended organization guidance statement."
                                }
                            ]
                        }
                    ],
                    "removes": [
                        {"by-id": "ac-1_smt_b"},
                        {"by-name": "legacy_guidance"},
                        {"by-item-name": "param"},
                        {"by-class": "deprecated"},
                        {"by-ns": "https://legacy.example.com"}
                    ]
                }
            ]
        }

        await validate_document("profiles", profile_doc)

    @pytest.mark.asyncio
    async def test_set_parameters_with_all_optional_fields_passes_oscal_schema(self, minimal_profile_base):
        """Verify that set-parameters with values vs select variants (mutually exclusive per NIST OSCAL) validate cleanly."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["modify"] = {
            "set-parameters": [
                {
                    "param-id": "ac-1_prm_1",
                    "class": "organization-defined",
                    "depends-on": "org_param_parent",
                    "label": "Review Frequency",
                    "usage": "Used in annual compliance review",
                    "values": ["annually", "quarterly"],
                    "guidelines": [
                        {"prose": "Organizations must review access controls at least quarterly."}
                    ],
                    "props": [
                        {"name": "scope", "value": "enterprise"}
                    ]
                },
                {
                    "param-id": "ac-1_prm_2",
                    "class": "organization-defined",
                    "label": "Notification Channel",
                    "usage": "Used for alert dispatching",
                    "select": {
                        "how-many": "one-or-more",
                        "choice": ["email", "sms", "webhook"]
                    },
                    "guidelines": [
                        {"prose": "Select one or more communication channels."}
                    ],
                    "props": [
                        {"name": "scope", "value": "security-team"}
                    ]
                }
            ]
        }

        await validate_document("profiles", profile_doc)

    @pytest.mark.asyncio
    async def test_set_parameters_with_both_values_and_select_passes_oscal_schema(self, minimal_profile_base):
        """Verify that specifying both 'values' and 'select' on the same parameter passes schema validation (US 2.17, DD-012)."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["modify"] = {
            "set-parameters": [
                {
                    "param-id": "ac-1_prm_multi",
                    "values": ["annually"],
                    "select": {
                        "how-many": "one",
                        "choice": ["annually", "quarterly"]
                    }
                }
            ]
        }

        await validate_document("profiles", profile_doc)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("invalid_method", ["invalid_method", "custom-merge", "OVERRIDE", ""])
    async def test_invalid_combine_method_fails_validation(self, minimal_profile_base, invalid_method):
        """Verify that combine.method must be one of ['use-first', 'merge', 'keep']."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["merge"] = {
            "combine": {"method": invalid_method},
            "as-is": True
        }

        with pytest.raises(OSCALValidationError):
            await validate_document("profiles", profile_doc)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("valid_method", ["use-first", "merge", "keep"])
    async def test_valid_combine_methods_pass_validation(self, minimal_profile_base, valid_method):
        """Verify that all three canonical OSCAL combine methods pass schema validation."""
        profile_doc = minimal_profile_base
        profile_doc["profile"]["merge"] = {
            "combine": {"method": valid_method},
            "as-is": True
        }

        await validate_document("profiles", profile_doc)

