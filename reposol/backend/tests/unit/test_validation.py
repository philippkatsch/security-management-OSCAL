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


def write_ap_fixture(tmp_data_dir, ap_uuid):
    ap_dir = os.path.join(tmp_data_dir, "assessment-plans")
    os.makedirs(ap_dir, exist_ok=True)
    ap_doc = {
        "assessment-plan": {
            "uuid": ap_uuid,
            "metadata": make_valid_metadata(),
            "import-ssp": {"href": "#target-ssp"},
            "reviewed-controls": {
                "control-selections": [{"include-all": {}}]
            }
        }
    }
    path = os.path.join(ap_dir, f"{ap_uuid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(ap_doc, f)
    return path


# ─────────────────────────────────────────────────────────────────────────────
# validate_document - basic and schema validation tests
# ─────────────────────────────────────────────────────────────────────────────

class TestValidateDocumentBasic:
    def test_schemas_dict_has_all_stages(self):
        for stage in STAGE_ROOT_KEYS:
            assert stage in SCHEMAS, f"Stage '{stage}' missing from SCHEMAS"

    @pytest.mark.asyncio
    async def test_unknown_stage_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown stage"):
            await validate_document("unknown_stage", {})

    @pytest.mark.asyncio
    async def test_missing_root_key_raises_validation_error(self):
        with pytest.raises(ValidationError, match="Missing required root key"):
            await validate_document("catalogs", {"wrong_key": {}})

    @pytest.mark.asyncio
    async def test_valid_catalog_passes(self):
        doc, _ = make_valid_doc("catalog")
        await validate_document("catalogs", doc)

    @pytest.mark.asyncio
    async def test_valid_profile_passes(self):
        doc, _ = make_valid_doc("profile", extra={"imports": [{"href": "#test"}]})
        await validate_document("profiles", doc)

    @pytest.mark.asyncio
    async def test_valid_ssp_passes(self, isolated_data_dir):
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
        await validate_document("ssps", doc)

    @pytest.mark.asyncio
    async def test_valid_component_def_passes(self):
        doc, _ = make_valid_doc("component-definition")
        await validate_document("component-definitions", doc)

    @pytest.mark.asyncio
    async def test_valid_assessment_plan_passes(self):
        doc, _ = make_valid_doc("assessment-plan")
        await validate_document("assessment-plans", doc)

    @pytest.mark.asyncio
    async def test_valid_assessment_results_passes(self):
        doc, _ = make_valid_doc("assessment-results")
        await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_valid_poam_passes(self):
        doc, _ = make_valid_doc("plan-of-action-and-milestones")
        await validate_document("poams", doc)

    @pytest.mark.asyncio
    async def test_valid_control_mapping_passes(self):
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
        await validate_document("control-mappings", doc)


class TestValidateDocumentSchemaFailures:
    @pytest.mark.asyncio
    async def test_invalid_uuid_format_fails(self):
        doc = {
            "catalog": {
                "uuid": "not-a-uuid",
                "metadata": make_valid_metadata(),
            }
        }
        with pytest.raises(ValidationError):
            await validate_document("catalogs", doc)

    @pytest.mark.asyncio
    async def test_missing_title_fails(self):
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
            await validate_document("catalogs", doc)

    @pytest.mark.asyncio
    async def test_missing_last_modified_fails(self):
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
            await validate_document("catalogs", doc)


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

    @pytest.mark.asyncio
    async def test_referenced_profile_not_found(self, isolated_data_dir):
        missing_uuid = str(uuid.uuid4())
        doc = self._make_ssp_doc(profile_uuid=missing_uuid)
        with pytest.raises(ValidationError, match="does not exist"):
            await validate_document("ssps", doc)

    @pytest.mark.asyncio
    async def test_referenced_profile_exists_passes(self, isolated_data_dir):
        profile_uuid = str(uuid.uuid4())
        write_profile_fixture(isolated_data_dir, profile_uuid)
        doc = self._make_ssp_doc(profile_uuid=profile_uuid)
        await validate_document("ssps", doc)

    @pytest.mark.asyncio
    async def test_duplicate_control_id_fails(self, isolated_data_dir):
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
            await validate_document("ssps", doc)


class TestProfileAdvancedTailoringValidation:
    @pytest.mark.asyncio
    async def test_profile_with_multiple_merge_directives_fails(self):
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
            await validate_document("profiles", profile_doc)


class TestARIntegrityValidation:
    def _make_valid_ar(self, ap_uuid=None, obs_uuid=None, risk_uuid=None, finding_uuid=None, target_state="satisfied"):
        doc_uuid = str(uuid.uuid4())
        ap_id = ap_uuid or str(uuid.uuid4())
        o_uuid = obs_uuid or str(uuid.uuid4())
        r_uuid = risk_uuid or str(uuid.uuid4())
        f_uuid = finding_uuid or str(uuid.uuid4())
        return {
            "assessment-results": {
                "uuid": doc_uuid,
                "metadata": make_valid_metadata(),
                "import-ap": {
                    "href": f"../assessment-plans/{ap_id}.json"
                },
                "results": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "title": "Quarterly Evaluation Results",
                        "description": "Comprehensive security assessment results",
                        "start": "2026-08-01T00:00:00Z",
                        "reviewed-controls": {
                            "control-selections": [{"include-all": {}}]
                        },
                        "observations": [
                            {
                                "uuid": o_uuid,
                                "description": "Port 22 is open on bastion host",
                                "methods": ["examine"],
                                "collected": "2026-08-01T12:00:00Z"
                            }
                        ],
                        "risks": [
                            {
                                "uuid": r_uuid,
                                "title": "Unauthorized SSH Access Risk",
                                "description": "SSH access exposed to public internet",
                                "statement": "Permitting arbitrary inbound connections to port 22 increases compromise risk.",
                                "status": "open",
                                "related-observations": [{"observation-uuid": o_uuid}]
                            }
                        ],
                        "findings": [
                            {
                                "uuid": f_uuid,
                                "title": "AC-1 Non-Compliance Determination",
                                "description": "Access control policy not enforced",
                                "target": {
                                    "type": "statement-id",
                                    "target-id": "ac-1_smt",
                                    "status": {"state": target_state}
                                },
                                "related-observations": [{"observation-uuid": o_uuid}],
                                "related-risks": [{"risk-uuid": r_uuid}]
                            }
                        ]
                    }
                ]
            }
        }

    @pytest.mark.asyncio
    async def test_valid_ar_passes(self, isolated_data_dir):
        ap_uuid = str(uuid.uuid4())
        write_ap_fixture(isolated_data_dir, ap_uuid)
        doc = self._make_valid_ar(ap_uuid=ap_uuid)
        await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_valid_ar_fragment_href_passes(self):
        doc = self._make_valid_ar()
        doc["assessment-results"]["import-ap"]["href"] = f"#{uuid.uuid4()}"
        await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_missing_root_fields_fails(self):
        # Missing import-ap
        doc = self._make_valid_ar()
        del doc["assessment-results"]["import-ap"]
        with pytest.raises(ValidationError, match="Missing required field: 'import-ap'"):
            await validate_document("assessment-results", doc)

        # Missing results
        doc2 = self._make_valid_ar()
        del doc2["assessment-results"]["results"]
        with pytest.raises(ValidationError, match="Missing required field: 'results'"):
            await validate_document("assessment-results", doc2)

        # Missing metadata
        doc3 = self._make_valid_ar()
        del doc3["assessment-results"]["metadata"]
        with pytest.raises(ValidationError, match="Missing required field: 'metadata'"):
            await validate_document("assessment-results", doc3)

        # Missing uuid
        doc4 = self._make_valid_ar()
        del doc4["assessment-results"]["uuid"]
        with pytest.raises(ValidationError, match="Missing required field: 'uuid'"):
            await validate_document("assessment-results", doc4)

    @pytest.mark.asyncio
    async def test_nonexistent_ap_href_fails(self, isolated_data_dir):
        missing_ap_uuid = str(uuid.uuid4())
        doc = self._make_valid_ar(ap_uuid=missing_ap_uuid)
        with pytest.raises(ValidationError, match="Referenced Assessment Plan.*does not exist"):
            await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_dangling_observation_uuid_in_finding_fails(self, isolated_data_dir):
        ap_uuid = str(uuid.uuid4())
        write_ap_fixture(isolated_data_dir, ap_uuid)
        dangling_obs = str(uuid.uuid4())
        doc = self._make_valid_ar(ap_uuid=ap_uuid)
        doc["assessment-results"]["results"][0]["findings"][0]["related-observations"] = [
            {"observation-uuid": dangling_obs}
        ]
        with pytest.raises(ValidationError, match=f"Dangling observation reference: '{dangling_obs}' not found"):
            await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_dangling_risk_uuid_in_finding_fails(self, isolated_data_dir):
        ap_uuid = str(uuid.uuid4())
        write_ap_fixture(isolated_data_dir, ap_uuid)
        dangling_risk = str(uuid.uuid4())
        doc = self._make_valid_ar(ap_uuid=ap_uuid)
        doc["assessment-results"]["results"][0]["findings"][0]["related-risks"] = [
            {"risk-uuid": dangling_risk}
        ]
        with pytest.raises(ValidationError, match=f"Dangling risk reference: '{dangling_risk}' not found"):
            await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_dangling_observation_uuid_in_risk_fails(self, isolated_data_dir):
        ap_uuid = str(uuid.uuid4())
        write_ap_fixture(isolated_data_dir, ap_uuid)
        dangling_obs = str(uuid.uuid4())
        doc = self._make_valid_ar(ap_uuid=ap_uuid)
        doc["assessment-results"]["results"][0]["risks"][0]["related-observations"] = [
            {"observation-uuid": dangling_obs}
        ]
        with pytest.raises(ValidationError, match=f"Dangling observation reference in risk: '{dangling_obs}' not found"):
            await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_invalid_target_type_fails(self, isolated_data_dir):
        ap_uuid = str(uuid.uuid4())
        write_ap_fixture(isolated_data_dir, ap_uuid)
        doc = self._make_valid_ar(ap_uuid=ap_uuid)
        doc["assessment-results"]["results"][0]["findings"][0]["target"]["type"] = "invalid-type"
        with pytest.raises(ValidationError, match="Invalid finding target type 'invalid-type'"):
            await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_invalid_target_status_state_fails(self, isolated_data_dir):
        ap_uuid = str(uuid.uuid4())
        write_ap_fixture(isolated_data_dir, ap_uuid)
        doc = self._make_valid_ar(ap_uuid=ap_uuid)
        doc["assessment-results"]["results"][0]["findings"][0]["target"]["status"]["state"] = "unknown-state"
        with pytest.raises(ValidationError, match="Invalid finding target status state 'unknown-state'"):
            await validate_document("assessment-results", doc)

    @pytest.mark.asyncio
    async def test_duplicate_entity_uuid_fails(self, isolated_data_dir):
        ap_uuid = str(uuid.uuid4())
        write_ap_fixture(isolated_data_dir, ap_uuid)
        shared_uuid = str(uuid.uuid4())
        doc = self._make_valid_ar(ap_uuid=ap_uuid, obs_uuid=shared_uuid, risk_uuid=shared_uuid)
        with pytest.raises(ValidationError, match="Duplicate"):
            await validate_document("assessment-results", doc)


class TestComponentIntegrityValidation:
    def _make_valid_cdef(self, comp_uuid=None):
        c_uuid = comp_uuid or str(uuid.uuid4())
        return {
            "component-definition": {
                "uuid": str(uuid.uuid4()),
                "metadata": make_valid_metadata(),
                "components": [
                    {
                        "uuid": c_uuid,
                        "type": "software",
                        "title": "Software Asset",
                        "description": "Component Description"
                    }
                ]
            }
        }

    @pytest.mark.asyncio
    async def test_defined_component_with_status_fails(self):
        doc = self._make_valid_cdef()
        doc["component-definition"]["components"][0]["status"] = {"state": "operational"}
        with pytest.raises(ValidationError, match="must not contain 'status' property"):
            await validate_document("component-definitions", doc)

    @pytest.mark.asyncio
    async def test_capability_dangling_component_uuid_fails(self):
        doc = self._make_valid_cdef()
        dangling_comp = str(uuid.uuid4())
        doc["component-definition"]["capabilities"] = [
            {
                "uuid": str(uuid.uuid4()),
                "name": "Cap 1",
                "description": "Cap 1 description",
                "incorporates-components": [
                    {"component-uuid": dangling_comp}
                ]
            }
        ]
        with pytest.raises(ValidationError, match="Referenced component .* not found in components array"):
            await validate_document("component-definitions", doc)


class TestPOAMIntegrityValidation:
    def _make_valid_poam(self, finding_uuid=None, obs_uuid=None, risk_uuid=None):
        f_uuid = finding_uuid or str(uuid.uuid4())
        o_uuid = obs_uuid or str(uuid.uuid4())
        r_uuid = risk_uuid or str(uuid.uuid4())
        return {
            "plan-of-action-and-milestones": {
                "uuid": str(uuid.uuid4()),
                "metadata": make_valid_metadata(),
                "findings": [
                    {
                        "uuid": f_uuid,
                        "title": "Finding 1",
                        "description": "Finding 1 Description",
                        "target": {
                            "type": "statement-id",
                            "target-id": "ac-1_smt",
                            "status": {"state": "not-satisfied"}
                        }
                    }
                ],
                "observations": [
                    {
                        "uuid": o_uuid,
                        "description": "Obs desc",
                        "methods": ["TEST"],
                        "collected": "2026-09-05T12:00:00Z"
                    }
                ],
                "risks": [
                    {
                        "uuid": r_uuid,
                        "title": "Risk 1",
                        "description": "Risk 1 Description",
                        "statement": "Risk statement",
                        "status": "open"
                    }
                ],
                "poam-items": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "title": "Remediation Item 1",
                        "description": "Desc",
                        "related-findings": [{"finding-uuid": f_uuid}],
                        "related-observations": [{"observation-uuid": o_uuid}],
                        "related-risks": [{"risk-uuid": r_uuid}]
                    }
                ]
            }
        }

    @pytest.mark.asyncio
    async def test_valid_poam_passes(self):
        doc = self._make_valid_poam()
        await validate_document("poams", doc)

    @pytest.mark.asyncio
    async def test_poam_dangling_finding_uuid_fails(self):
        doc = self._make_valid_poam()
        dangling_f = str(uuid.uuid4())
        doc["plan-of-action-and-milestones"]["poam-items"][0]["related-findings"] = [
            {"finding-uuid": dangling_f}
        ]
        with pytest.raises(ValidationError, match="Dangling finding reference"):
            await validate_document("poams", doc)

    @pytest.mark.asyncio
    async def test_poam_empty_risk_statement_fails(self):
        doc = self._make_valid_poam()
        doc["plan-of-action-and-milestones"]["risks"][0]["statement"] = "   "
        with pytest.raises(ValidationError, match="Risk statement must be a non-empty string"):
            await validate_document("poams", doc)


class TestMappingIntegrityValidation:
    def _make_valid_mapping(self):
        return {
            "mapping-collection": {
                "uuid": str(uuid.uuid4()),
                "metadata": make_valid_metadata(),
                "mappings": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "source-resource": {"type": "catalog", "href": "#cat1"},
                        "target-resource": {"type": "catalog", "href": "#cat2"},
                        "maps": [
                            {
                                "uuid": str(uuid.uuid4()),
                                "relationship": "equivalent-to",
                                "sources": [{"type": "control", "id-ref": "ac-1"}],
                                "targets": [{"type": "control", "id-ref": "ctrl-1"}]
                            }
                        ]
                    }
                ]
            }
        }

    @pytest.mark.asyncio
    async def test_valid_mapping_passes(self):
        doc = self._make_valid_mapping()
        await validate_document("control-mappings", doc)

    @pytest.mark.asyncio
    async def test_mapping_invalid_relationship_token_fails(self):
        doc = self._make_valid_mapping()
        doc["mapping-collection"]["mappings"][0]["maps"][0]["relationship"] = "bogus-rel"
        with pytest.raises(ValidationError, match="Invalid relationship token 'bogus-rel'"):
            await validate_document("control-mappings", doc)


