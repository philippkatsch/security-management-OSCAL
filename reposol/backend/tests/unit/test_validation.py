"""
Unit tests for app/validation.py covering:
- sanitize_patterns function directly
- validate_document schema validation for all stages
- SSP cross-reference validation (profile existence, duplicate control-ids, UUID checks)
- Profile merge choices validation
"""
import os
import json
import uuid
import pytest
from unittest.mock import patch
from jsonschema import ValidationError

from app.validation import (
    validate_document,
    sanitize_patterns,
    STAGE_ROOT_KEYS,
    SCHEMAS,
    OSCALValidationError
)

# ─────────────────────────────────────────────────────────────────────────────
# sanitize_patterns Unit Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_sanitize_patterns_xml_regex():
    schema = {"pattern": r"some\p{L}regex"}
    sanitized = sanitize_patterns(schema)
    assert sanitized["pattern"] == ".*"

def test_sanitize_patterns_uuid_relax():
    schema = {"pattern": "something[45]else[89ABab]foo"}
    sanitized = sanitize_patterns(schema)
    assert sanitized["pattern"] == "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

def test_sanitize_patterns_title_min_length():
    schema = {"title": {"type": "string"}}
    sanitized = sanitize_patterns(schema)
    assert sanitized["title"]["minLength"] == 1

def test_sanitize_patterns_recursive():
    schema = {
        "properties": {
            "title": {"type": "string"},
            "uuid": {
                "type": "string",
                "pattern": "something[45]else[89ABab]foo"
            }
        }
    }
    sanitized = sanitize_patterns(schema)
    assert sanitized["properties"]["title"]["minLength"] == 1
    assert sanitized["properties"]["uuid"]["pattern"] == "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"


# ─────────────────────────────────────────────────────────────────────────────
# Helpers for validate_document
# ─────────────────────────────────────────────────────────────────────────────

def make_valid_metadata():
    return {
        "title": "Test Document",
        "last-modified": "2026-06-25T12:00:00Z",
        "version": "1.0.0",
        "oscal-version": "1.1.2",
    }


def make_valid_doc(root_key, extra=None):
    doc_id = str(uuid.uuid4())
    if root_key == "system-security-plan":
        doc = {
            root_key: {
                "uuid": doc_id,
                "metadata": make_valid_metadata(),
                "import-profile": {"href": f"#{uuid.uuid4()}"},
                "system-characteristics": {
                    "system-ids": [{"id": "sys-1", "identifier-type": "https://fedramp.gov"}],
                    "system-name": "Test System",
                    "description": "Test System Description",
                    "system-information": {
                        "information-types": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "title": "Information Title",
                                "description": "Information Description"
                            }
                        ]
                    },
                    "status": {"state": "operational"},
                    "authorization-boundary": {
                        "description": "Boundary description"
                    }
                },
                "system-implementation": {
                    "users": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "role-ids": ["provider"]
                        }
                    ],
                    "components": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "type": "software",
                            "title": "Mock Component",
                            "description": "Mock Component Description",
                            "status": {"state": "operational"}
                        }
                    ]
                },
                "control-implementation": {
                    "description": "Control Implementation Description",
                    "implemented-requirements": []
                }
            }
        }
    else:
        doc = {
            root_key: {
                "uuid": doc_id,
                "metadata": make_valid_metadata(),
            }
        }
        if root_key == "profile":
            doc[root_key]["imports"] = [{"href": f"#{uuid.uuid4()}"}]
        elif root_key == "assessment-plan":
            doc[root_key]["import-ssp"] = {"href": f"#{uuid.uuid4()}"}
            doc[root_key]["reviewed-controls"] = {
                "control-selections": [
                    {
                        "include-all": {}
                    }
                ]
            }
        elif root_key == "assessment-results":
            doc[root_key]["import-ap"] = {"href": f"#{uuid.uuid4()}"}
            doc[root_key]["results"] = [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "Assessment Result Title",
                    "description": "Assessment Result Description",
                    "start": "2026-06-25T12:00:00Z",
                    "reviewed-controls": {
                        "control-selections": [
                            {
                                "include-all": {}
                            }
                        ]
                    }
                }
            ]
        elif root_key == "plan-of-action-and-milestones":
            doc[root_key]["import-ssp"] = {"href": f"#{uuid.uuid4()}"}
            doc[root_key]["poam-items"] = [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "POA&M Item Title",
                    "description": "POA&M Item Description"
                }
            ]

    if extra:
        for k, v in extra.items():
            if isinstance(v, dict) and k in doc[root_key]:
                doc[root_key][k].update(v)
            else:
                doc[root_key][k] = v
    return doc, doc_id


def write_profile_fixture(tmp_data_dir, profile_uuid):
    profiles_dir = os.path.join(tmp_data_dir, "profiles")
    os.makedirs(profiles_dir, exist_ok=True)
    profile_doc = {
        "profile": {
            "uuid": profile_uuid,
            "metadata": make_valid_metadata(),
            "imports": [{"href": "#test"}],
        }
    }
    path = os.path.join(profiles_dir, f"{profile_uuid}.json")
    with open(path, "w") as f:
        json.dump(profile_doc, f)
    return path


def write_component_fixture(tmp_data_dir, comp_uuid):
    comp_dir = os.path.join(tmp_data_dir, "component-definitions")
    os.makedirs(comp_dir, exist_ok=True)
    comp_doc = {
        "component-definition": {
            "uuid": comp_uuid,
            "metadata": make_valid_metadata(),
        }
    }
    path = os.path.join(comp_dir, f"{comp_uuid}.json")
    with open(path, "w") as f:
        json.dump(comp_doc, f)
    return path


# ─────────────────────────────────────────────────────────────────────────────
# validate_document - basic and schema validation tests
# ─────────────────────────────────────────────────────────────────────────────

class TestValidateDocumentBasic:
    def test_schemas_dict_has_all_stages(self):
        for stage in STAGE_ROOT_KEYS:
            assert stage in SCHEMAS, f"Stage '{stage}' missing from SCHEMAS"

    def test_unknown_stage_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown stage"):
            validate_document("unknown_stage", {})

    def test_missing_root_key_raises_validation_error(self):
        with pytest.raises(ValidationError, match="Missing required root key"):
            validate_document("catalogs", {"wrong_key": {}})

    def test_valid_catalog_passes(self):
        doc, _ = make_valid_doc("catalog")
        validate_document("catalogs", doc)

    def test_valid_profile_passes(self):
        doc, _ = make_valid_doc("profile", extra={"imports": [{"href": "#test"}]})
        validate_document("profiles", doc)

    def test_valid_ssp_passes(self, isolated_data_dir):
        profile_uuid = str(uuid.uuid4())
        write_profile_fixture(isolated_data_dir, profile_uuid)
        comp_uuid = str(uuid.uuid4())
        write_component_fixture(isolated_data_dir, comp_uuid)
        req_uuid = str(uuid.uuid4())
        doc, _ = make_valid_doc("system-security-plan", extra={
            "import-profile": {"href": f"#{profile_uuid}"},
            "control-implementation": {
                "implemented-requirements": [
                    {
                        "uuid": req_uuid,
                        "control-id": "ac-1",
                        "by-components": [{"uuid": str(uuid.uuid4()), "component-uuid": comp_uuid, "description": "some desc"}]
                    }
                ]
            }
        })
        validate_document("ssps", doc)

    def test_valid_component_def_passes(self):
        doc, _ = make_valid_doc("component-definition")
        validate_document("component-definitions", doc)

    def test_valid_assessment_plan_passes(self):
        doc, _ = make_valid_doc("assessment-plan")
        validate_document("assessment-plans", doc)

    def test_valid_assessment_results_passes(self):
        doc, _ = make_valid_doc("assessment-results")
        validate_document("assessment-results", doc)

    def test_valid_poam_passes(self):
        doc, _ = make_valid_doc("plan-of-action-and-milestones")
        validate_document("poams", doc)

    def test_valid_control_mapping_passes(self):
        doc, _ = make_valid_doc("mapping-collection", extra={
            "provenance": {
                "method": "human",
                "matching-rationale": "syntactic",
                "status": "draft",
                "mapping-description": "NIST to ISO control crosswalk"
            },
            "mappings": [
                {
                    "uuid": str(uuid.uuid4()),
                    "source-resource": {"type": "catalog", "href": "nist-catalog.json"},
                    "target-resource": {"type": "catalog", "href": "iso-catalog.json"},
                    "maps": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "relationship": "subset-of",
                            "sources": [{"type": "control", "id-ref": "AC-2"}],
                            "targets": [{"type": "control", "id-ref": "A.5.18"}],
                            "remarks": "AC-2 is a subset of A.5.18"
                        }
                    ]
                }
            ]
        })
        validate_document("control-mappings", doc)


class TestValidateDocumentSchemaFailures:
    def test_invalid_uuid_format_fails(self):
        doc = {
            "catalog": {
                "uuid": "not-a-uuid",
                "metadata": make_valid_metadata(),
            }
        }
        with pytest.raises(ValidationError):
            validate_document("catalogs", doc)

    def test_missing_title_fails(self):
        doc = {
            "catalog": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "last-modified": "2026-06-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                }
            }
        }
        with pytest.raises(ValidationError):
            validate_document("catalogs", doc)

    def test_missing_last_modified_fails(self):
        doc = {
            "catalog": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Test",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                }
            }
        }
        with pytest.raises(ValidationError):
            validate_document("catalogs", doc)


# ─────────────────────────────────────────────────────────────────────────────
# SSP cross-reference and Profile merge choices validation tests
# ─────────────────────────────────────────────────────────────────────────────

class TestSSPCrossRefValidation:
    def _make_ssp_doc(self, profile_uuid=None, requirements=None):
        doc_uuid = str(uuid.uuid4())
        ssp = {
            "uuid": doc_uuid,
            "metadata": make_valid_metadata(),
            "import-profile": {"href": f"#{profile_uuid}"} if profile_uuid else {"href": f"#{uuid.uuid4()}"},
            "system-characteristics": {
                "system-ids": [{"id": "sys-1", "identifier-type": "https://fedramp.gov"}],
                "system-name": "Test System",
                "description": "Test System Description",
                "system-information": {
                    "information-types": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "Information Title",
                            "description": "Information Description"
                        }
                    ]
                },
                "status": {"state": "operational"},
                "authorization-boundary": {
                    "description": "Boundary description"
                }
            },
            "system-implementation": {
                "users": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "role-ids": ["provider"]
                    }
                ],
                "components": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "type": "software",
                        "title": "Mock Component",
                        "description": "Mock Component Description",
                        "status": {"state": "operational"}
                    }
                ]
            },
            "control-implementation": {
                "description": "Control Implementation Description",
                "implemented-requirements": requirements if requirements is not None else [
                    {
                        "uuid": str(uuid.uuid4()),
                        "control-id": "ac-1"
                    }
                ]
            }
        }
        return {"system-security-plan": ssp}

    def test_referenced_profile_not_found(self, isolated_data_dir):
        missing_uuid = str(uuid.uuid4())
        doc = self._make_ssp_doc(profile_uuid=missing_uuid)
        with pytest.raises(ValidationError, match="does not exist"):
            validate_document("ssps", doc)

    def test_referenced_profile_exists_passes(self, isolated_data_dir):
        profile_uuid = str(uuid.uuid4())
        write_profile_fixture(isolated_data_dir, profile_uuid)
        doc = self._make_ssp_doc(profile_uuid=profile_uuid)
        validate_document("ssps", doc)

    def test_duplicate_control_id_fails(self, isolated_data_dir):
        profile_uuid = str(uuid.uuid4())
        write_profile_fixture(isolated_data_dir, profile_uuid)
        req1_uuid = str(uuid.uuid4())
        req2_uuid = str(uuid.uuid4())
        doc = self._make_ssp_doc(
            profile_uuid=profile_uuid,
            requirements=[
                {"uuid": req1_uuid, "control-id": "ac-1"},
                {"uuid": req2_uuid, "control-id": "ac-1"},
            ]
        )
        with pytest.raises(ValidationError, match="Duplicate control-id"):
            validate_document("ssps", doc)


class TestProfileAdvancedTailoringValidation:
    def test_profile_with_multiple_merge_directives_fails(self):
        profile_doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": make_valid_metadata(),
                "imports": [{"href": "#catalog-uuid", "include-all": {}}],
                "merge": {
                    "combine": {"method": "use-first"},
                    "flat": {},
                    "as-is": True
                }
            }
        }
        with pytest.raises(ValidationError, match="is valid under each of"):
            validate_document("profiles", profile_doc)
