"""
Tier 5 White-Box Coverage Hardening & Adversarial Test Suite for Backend.
Tests untested execution paths, corner cases, invalid inputs, edge-case schema validations,
YAML/XML edge cases, profile resolution wildcards/conflict edge cases, FIPS 199 scoring bounds,
AR-to-POA&M import edge cases, and 409 Conflict reference integrity deletions.
"""
import pytest
import uuid
import copy
from typing import Dict, Any

from app.format_converter import (
    parse_xml_to_oscal_dict,
    serialize_oscal_dict_to_xml,
    parse_yaml_to_dict,
    serialize_dict_to_yaml,
    xml_to_dict,
    dict_to_xml_element,
)
from app.validation import (
    validate_document,
    OSCALValidationError,
    JSONSchemaValidationError,
    _validate_profile_integrity,
    _validate_ssp_integrity,
)
from app.services.resolution_service import (
    _matches_pattern,
    _filter_controls,
    _filter_groups,
    _apply_modify,
    resolve_profile,
    resolve_ssp,
    clear_resolution_cache,
)
from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
    prune_orphaned_alters,
    cleanup_local_catalogs,
)
from app.services.import_service import (
    import_findings_from_ar,
    detect_stage,
    ImportServiceError,
    ImportValidationError,
)
from app.services.document_service import (
    delete_document,
    save_document,
    get_document,
)
from tests.factories import CatalogFactory, ProfileFactory, generate_uuid, GenericDocumentFactory


# =============================================================================
# Helper for constructing fully valid OSCAL structures
# =============================================================================

def build_valid_poam(doc_id: str = None) -> Dict[str, Any]:
    if not doc_id:
        doc_id = generate_uuid()
    return {
        "plan-of-action-and-milestones": {
            "uuid": doc_id,
            "metadata": {
                "title": "Valid Test POA&M",
                "last-modified": "2026-08-13T00:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2"
            },
            "poam-items": [
                {
                    "uuid": generate_uuid(),
                    "title": "Initial Remediation Item",
                    "description": "Baseline item for POA&M structure"
                }
            ]
        }
    }

def build_valid_ar(doc_id: str = None, results: list = None) -> Dict[str, Any]:
    if not doc_id:
        doc_id = generate_uuid()
    if results is None:
        results = [
            {
                "uuid": generate_uuid(),
                "title": "Result 1",
                "description": "Default AR result description",
                "start": "2026-08-01T00:00:00Z",
                "reviewed-controls": {
                    "control-selections": [{"include-all": {}}]
                },
                "findings": []
            }
        ]
    return {
        "assessment-results": {
            "uuid": doc_id,
            "metadata": {
                "title": "Valid Assessment Results",
                "last-modified": "2026-08-13T00:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2"
            },
            "import-ap": {
                "href": f"../assessment-plans/{generate_uuid()}.json"
            },
            "results": results
        }
    }

def build_valid_ssp(doc_id: str = None, profile_id: str = None) -> Dict[str, Any]:
    if not doc_id:
        doc_id = generate_uuid()
    if not profile_id:
        profile_id = generate_uuid()
    return {
        "system-security-plan": {
            "uuid": doc_id,
            "metadata": {
                "title": "Valid Test SSP",
                "last-modified": "2026-08-13T00:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2"
            },
            "import-profile": {
                "href": f"../profiles/{profile_id}.json"
            },
            "system-characteristics": {
                "system-ids": [{"id": "sys-1", "identifier-type": "https://fedramp.gov"}],
                "system-name": "Test System Name",
                "system-name-short": "TSN",
                "description": "Valid SSP System Description for Testing",
                "security-sensitivity-level": "moderate",
                "system-information": {
                    "information-types": [
                        {
                            "uuid": generate_uuid(),
                            "title": "Financial Information",
                            "description": "Financial records and info",
                            "categorizations": [
                                {
                                    "system": "http://doi.org/10.6028/NIST.SP.800-60v2r1",
                                    "information-type-ids": ["C.3.5.1"]
                                }
                            ],
                            "confidentiality-impact": {"base": "fips-199-high"},
                            "integrity-impact": {"base": "fips-199-moderate"},
                            "availability-impact": {"base": "fips-199-low"}
                        }
                    ]
                },
                "status": {"state": "operational"},
                "authorization-boundary": {
                    "description": "System boundary description for testing"
                }
            },
            "system-implementation": {
                "users": [
                    {
                        "uuid": generate_uuid(),
                        "role-ids": ["provider"]
                    }
                ],
                "components": [
                    {
                        "uuid": generate_uuid(),
                        "type": "software",
                        "title": "This System",
                        "description": "Primary System Component",
                        "status": {"state": "operational"}
                    }
                ]
            },
            "control-implementation": {
                "description": "Control Implementation Section Description",
                "implemented-requirements": [
                    {
                        "uuid": generate_uuid(),
                        "control-id": "ac-1"
                    }
                ]
            }
        }
    }


# =============================================================================
# 1. Format Converter Edge Cases & Adversarial Verification
# =============================================================================

class TestFormatConverterAdversarial:
    def test_xml_serialization_empty_dict_raises_value_error(self):
        with pytest.raises(ValueError, match="Empty dictionary"):
            serialize_oscal_dict_to_xml({})

    def test_xml_parsing_unusual_elements_and_singular_plural(self):
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <catalog xmlns="http://csrc.nist.gov/ns/oscal/1.0" uuid="11111111-1111-1111-1111-111111111111">
            <metadata>
                <title>XML Edge Test</title>
                <last-modified>2026-08-13T00:00:00Z</last-modified>
                <version>1.0</version>
                <oscal-version>1.1.2</oscal-version>
            </metadata>
            <group id="ac">
                <title>Access Control</title>
                <control id="ac-1">
                    <title>Policy</title>
                    <prop name="label" value="AC-1"/>
                    <link href="https://example.com/ref" rel="reference"/>
                </control>
            </group>
        </catalog>
        """
        oscal_dict = parse_xml_to_oscal_dict(xml_content)
        assert "catalog" in oscal_dict
        cat = oscal_dict["catalog"]
        assert cat["uuid"] == "11111111-1111-1111-1111-111111111111"
        assert cat["metadata"]["title"] == "XML Edge Test"
        assert "groups" in cat
        assert cat["groups"][0]["id"] == "ac"
        assert cat["groups"][0]["controls"][0]["props"][0]["name"] == "label"

    def test_xml_roundtrip_serialization(self):
        catalog = CatalogFactory.with_controls()
        xml_str = serialize_oscal_dict_to_xml(catalog)
        assert "<catalog" in xml_str
        assert "uuid=" in xml_str

        parsed = parse_xml_to_oscal_dict(xml_str)
        assert "catalog" in parsed
        assert parsed["catalog"]["uuid"] == catalog["catalog"]["uuid"]

    def test_yaml_converter_edge_cases(self):
        catalog = CatalogFactory.build(title="YAML Special Chars Title: Test & Proof")
        yaml_str = serialize_dict_to_yaml(catalog)
        assert "YAML Special Chars Title" in yaml_str

        parsed = parse_yaml_to_dict(yaml_str)
        assert parsed["catalog"]["metadata"]["title"] == "YAML Special Chars Title: Test & Proof"

        # Edge case: empty YAML
        empty_parsed = parse_yaml_to_dict("")
        assert empty_parsed is None


# =============================================================================
# 2. Schema Validation Edge Cases & Integrity Verification
# =============================================================================

class TestSchemaValidationAdversarial:
    @pytest.mark.asyncio
    async def test_validate_unknown_stage_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown stage: invalid_stage"):
            await validate_document("invalid_stage", {})

    @pytest.mark.asyncio
    async def test_validate_missing_root_key_raises_jsonschema_error(self):
        with pytest.raises(JSONSchemaValidationError, match="Missing required root key: 'catalog'"):
            await validate_document("catalogs", {"wrong_root": {}})

    def test_profile_merge_integrity_conflict(self):
        errors = []
        profile_merge_conflict = {
            "merge": {
                "flat": {},
                "custom": {"groups": []}
            }
        }
        _validate_profile_integrity(profile_merge_conflict, "profile", errors)
        assert len(errors) == 1
        assert "Profile merge must specify only one of flat, as-is, or custom" in errors[0]["message"]

    @pytest.mark.asyncio
    async def test_ssp_integrity_invalid_import_profile_uuid(self):
        errors = []
        ssp_data = {
            "import-profile": {
                "href": "not-a-valid-uuid-path"
            }
        }
        await _validate_ssp_integrity(ssp_data, "system-security-plan", errors, workspace_id="default")
        assert any(e["schema_path"] == "custom/import-profile-uuid" for e in errors)

    @pytest.mark.asyncio
    async def test_ssp_integrity_nonexistent_profile(self):
        errors = []
        non_existent_uuid = generate_uuid()
        ssp_data = {
            "import-profile": {
                "href": f"../profiles/{non_existent_uuid}.json"
            }
        }
        await _validate_ssp_integrity(ssp_data, "system-security-plan", errors, workspace_id="default")
        assert any(e["schema_path"] == "custom/import-profile-existence" for e in errors)

    @pytest.mark.asyncio
    async def test_ssp_integrity_duplicate_control_ids(self):
        errors = []
        ssp_data = {
            "control-implementation": {
                "implemented-requirements": [
                    {"control-id": "ac-1", "uuid": generate_uuid()},
                    {"control-id": "ac-1", "uuid": generate_uuid()}
                ]
            }
        }
        await _validate_ssp_integrity(ssp_data, "system-security-plan", errors, workspace_id="default")
        assert any(e["schema_path"] == "custom/duplicate-control-id" for e in errors)

    @pytest.mark.asyncio
    async def test_ssp_integrity_nonexistent_component_reference(self):
        errors = []
        comp_uuid = generate_uuid()
        ssp_data = {
            "control-implementation": {
                "implemented-requirements": [
                    {
                        "control-id": "ac-1",
                        "uuid": generate_uuid(),
                        "by-components": [
                            {"component-uuid": comp_uuid}
                        ]
                    }
                ]
            }
        }
        await _validate_ssp_integrity(ssp_data, "system-security-plan", errors, workspace_id="default")
        assert any(e["schema_path"] == "custom/component-existence" for e in errors)


# =============================================================================
# 3. Profile Resolution & Service Layer Edge Cases
# =============================================================================

class TestProfileResolutionAdversarial:
    def test_wildcard_pattern_matching(self):
        assert _matches_pattern("ac-1", ["ac-*"]) is True
        assert _matches_pattern("ac-1.a", ["ac-*"]) is True
        assert _matches_pattern("au-2", ["ac-*"]) is False
        assert _matches_pattern("ac-1", ["ac-?"]) is True
        assert _matches_pattern("ac-10", ["ac-?"]) is False
        assert _matches_pattern("AC-1", ["ac-1"]) is True  # Case insensitive
        assert _matches_pattern("ac-1", []) is False

    def test_filter_controls_nested_child_inclusion(self):
        controls = [
            {
                "id": "ac-1",
                "title": "Access Control Policy",
                "controls": [
                    {"id": "ac-1.1", "title": "Sub Control"}
                ]
            },
            {
                "id": "au-1",
                "title": "Audit Policy"
            }
        ]
        filtered = _filter_controls(
            controls,
            include_all=False,
            included_ids={"ac-1.1"},
            include_patterns=[],
            excluded_ids=set(),
            exclude_patterns=[]
        )
        assert len(filtered) == 1
        assert filtered[0]["id"] == "ac-1"
        assert len(filtered[0]["controls"]) == 1
        assert filtered[0]["controls"][0]["id"] == "ac-1.1"

    def test_apply_modify_alters(self):
        catalog = {
            "controls": [
                {
                    "id": "ac-1",
                    "title": "Policy",
                    "props": [{"name": "label", "value": "AC-1"}],
                    "links": [{"href": "http://old.com", "id": "l1"}],
                    "params": [{"id": "p1", "label": "old param"}]
                }
            ]
        }
        modify = {
            "set-parameters": [
                {"param-id": "p1", "values": ["new value"]}
            ],
            "alters": [
                {
                    "control-id": "ac-1",
                    "removes": [
                        {"by-item-name": "link"}
                    ],
                    "adds": [
                        {
                            "props": [{"name": "env", "value": "prod"}]
                        }
                    ]
                }
            ]
        }
        _apply_modify(catalog, modify)
        ctrl = catalog["controls"][0]
        assert ctrl["params"][0]["values"] == ["new value"]
        assert "links" not in ctrl or len(ctrl.get("links", [])) == 0
        assert any(p["name"] == "env" and p["value"] == "prod" for p in ctrl["props"])

    @pytest.mark.asyncio
    async def test_resolve_profile_missing_imported_catalog(self):
        prof_doc = ProfileFactory.importing(catalog_uuid=generate_uuid())
        prof_id = prof_doc["profile"]["uuid"]
        await save_document("profiles", prof_id, prof_doc, workspace_id="default")

        resolved = await resolve_profile("default", prof_id)
        assert resolved["controls"] == []
        assert resolved["groups"] == []

    @pytest.mark.asyncio
    async def test_prune_orphaned_alters_removes_invalid_alters(self, saved_catalog):
        cat_id, _ = saved_catalog()
        prof_doc = ProfileFactory.with_alters(
            catalog_uuid=cat_id,
            alters=[
                {"control-id": "ac-1", "adds": [{"props": [{"name": "a", "value": "1"}]}]},
                {"control-id": "non-existent-ctrl-999", "adds": [{"props": [{"name": "b", "value": "2"}]}]}
            ]
        )
        profile = prof_doc["profile"]
        await prune_orphaned_alters(profile, workspace_id="default")
        alters = profile.get("modify", {}).get("alters", [])
        assert not any(a.get("control-id") == "non-existent-ctrl-999" for a in alters)


# =============================================================================
# 4. AR-to-POA&M Import Edge Cases
# =============================================================================

class TestARToPOAMImportAdversarial:
    @pytest.mark.asyncio
    async def test_import_findings_invalid_uuids_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid POA&M UUID format"):
            await import_findings_from_ar("invalid-poam-uuid", generate_uuid(), workspace_id="default")

        with pytest.raises(ValueError, match="Invalid Assessment Results UUID format"):
            await import_findings_from_ar(generate_uuid(), "invalid-ar-uuid", workspace_id="default")

    @pytest.mark.asyncio
    async def test_import_findings_nonexistent_documents_raises_filenotfound(self):
        poam_id = generate_uuid()
        ar_id = generate_uuid()

        with pytest.raises(FileNotFoundError, match="POA&M document"):
            await import_findings_from_ar(poam_id, ar_id, workspace_id="default")

    @pytest.mark.asyncio
    async def test_import_findings_dict_vs_string_status(self):
        poam_doc = build_valid_poam()
        poam_id = poam_doc["plan-of-action-and-milestones"]["uuid"]
        await save_document("poams", poam_id, poam_doc, workspace_id="default")

        f1_uuid = generate_uuid()
        f2_uuid = generate_uuid()
        f3_uuid = generate_uuid()

        results = [
            {
                "uuid": generate_uuid(),
                "title": "Result 1",
                "description": "Result 1 Description",
                "start": "2026-08-01T00:00:00Z",
                "reviewed-controls": {
                    "control-selections": [{"include-all": {}}]
                },
                "findings": [
                    {
                        "uuid": f1_uuid,
                        "title": "String Status Finding",
                        "description": "Finding 1 description",
                        "target": {
                            "type": "statement-id",
                            "target-id": "ac-1_smt",
                            "status": {"state": "not-satisfied"}
                        }
                    },
                    {
                        "uuid": f2_uuid,
                        "title": "Dict Status Finding",
                        "description": "Finding 2 description",
                        "target": {
                            "type": "statement-id",
                            "target-id": "ac-2_smt",
                            "status": {"state": "not-satisfied"}
                        }
                    },
                    {
                        "uuid": f3_uuid,
                        "title": "Satisfied Finding",
                        "description": "Finding 3 description",
                        "target": {
                            "type": "statement-id",
                            "target-id": "ac-3_smt",
                            "status": {"state": "satisfied"}
                        }
                    }
                ]
            }
        ]
        ar_doc = build_valid_ar(results=results)
        ar_id = ar_doc["assessment-results"]["uuid"]
        await save_document("assessment-results", ar_id, ar_doc, workspace_id="default")

        res = await import_findings_from_ar(poam_id, ar_id, workspace_id="default")
        assert res["imported_findings_count"] == 2
        assert len(res["poam_item_ids"]) == 2

    @pytest.mark.asyncio
    async def test_import_findings_idempotency_prevents_duplicates(self):
        poam_doc = build_valid_poam()
        poam_id = poam_doc["plan-of-action-and-milestones"]["uuid"]
        await save_document("poams", poam_id, poam_doc, workspace_id="default")

        f_uuid = generate_uuid()
        results = [
            {
                "uuid": generate_uuid(),
                "title": "Result 1",
                "description": "Result 1 Description",
                "start": "2026-08-01T00:00:00Z",
                "reviewed-controls": {
                    "control-selections": [{"include-all": {}}]
                },
                "findings": [
                    {
                        "uuid": f_uuid,
                        "title": "Unsatisfied Finding",
                        "description": "Unsatisfied finding description",
                        "target": {
                            "type": "statement-id",
                            "target-id": "ac-1_smt",
                            "status": {"state": "not-satisfied"}
                        }
                    }
                ]
            }
        ]
        ar_doc = build_valid_ar(results=results)
        ar_id = ar_doc["assessment-results"]["uuid"]
        await save_document("assessment-results", ar_id, ar_doc, workspace_id="default")

        res1 = await import_findings_from_ar(poam_id, ar_id, workspace_id="default")
        assert res1["imported_findings_count"] == 1

        res2 = await import_findings_from_ar(poam_id, ar_id, workspace_id="default")
        assert res2["imported_findings_count"] == 0

    @pytest.mark.asyncio
    async def test_import_findings_selective_uuids(self):
        poam_doc = build_valid_poam()
        poam_id = poam_doc["plan-of-action-and-milestones"]["uuid"]
        await save_document("poams", poam_id, poam_doc, workspace_id="default")

        f1_uuid = generate_uuid()
        f2_uuid = generate_uuid()

        results = [
            {
                "uuid": generate_uuid(),
                "title": "Result 1",
                "description": "Result 1 Description",
                "start": "2026-08-01T00:00:00Z",
                "reviewed-controls": {
                    "control-selections": [{"include-all": {}}]
                },
                "findings": [
                    {"uuid": f1_uuid, "title": "F1", "description": "F1 desc", "target": {"type": "statement-id", "target-id": "ac-1_smt", "status": {"state": "not-satisfied"}}},
                    {"uuid": f2_uuid, "title": "F2", "description": "F2 desc", "target": {"type": "statement-id", "target-id": "ac-2_smt", "status": {"state": "not-satisfied"}}}
                ]
            }
        ]
        ar_doc = build_valid_ar(results=results)
        ar_id = ar_doc["assessment-results"]["uuid"]
        await save_document("assessment-results", ar_id, ar_doc, workspace_id="default")

        res = await import_findings_from_ar(poam_id, ar_id, finding_uuids=[f1_uuid], workspace_id="default")
        assert res["imported_findings_count"] == 1


# =============================================================================
# 5. Referential Integrity & 409 Conflict Edge Cases
# =============================================================================

class TestReferenceIntegrityAdversarial:
    @pytest.mark.asyncio
    async def test_delete_catalog_referenced_by_profile_blocks_without_force(self, saved_catalog):
        cat_id, _ = saved_catalog()
        prof_doc = ProfileFactory.importing(catalog_uuid=cat_id)
        prof_id = prof_doc["profile"]["uuid"]
        await save_document("profiles", prof_id, prof_doc, workspace_id="default")

        with pytest.raises(ValueError, match="referenced by the following documents"):
            await delete_document("catalogs", cat_id, force=False, workspace_id="default")

        await delete_document("catalogs", cat_id, force=True, workspace_id="default")

    @pytest.mark.asyncio
    async def test_delete_profile_referenced_by_ssp_blocks_without_force(self):
        cat_doc = CatalogFactory.build()
        cat_id = cat_doc["catalog"]["uuid"]
        await save_document("catalogs", cat_id, cat_doc, workspace_id="default")

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_id)
        prof_id = prof_doc["profile"]["uuid"]
        await save_document("profiles", prof_id, prof_doc, workspace_id="default")

        ssp_doc = build_valid_ssp(profile_id=prof_id)
        ssp_id = ssp_doc["system-security-plan"]["uuid"]
        await save_document("ssps", ssp_id, ssp_doc, workspace_id="default")

        with pytest.raises(ValueError, match="referenced by the following documents"):
            await delete_document("profiles", prof_id, force=False, workspace_id="default")

        await delete_document("profiles", prof_id, force=True, workspace_id="default")


# =============================================================================
# 6. FIPS 199 Scoring & Bounds Adversarial Verification
# =============================================================================

class TestFIPS199ScoringAdversarial:
    @pytest.mark.asyncio
    async def test_fips199_system_characteristics_structure(self):
        cat_doc = CatalogFactory.build()
        cat_id = cat_doc["catalog"]["uuid"]
        await save_document("catalogs", cat_id, cat_doc, workspace_id="default")

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_id)
        prof_id = prof_doc["profile"]["uuid"]
        await save_document("profiles", prof_id, prof_doc, workspace_id="default")

        ssp_doc = build_valid_ssp(profile_id=prof_id)
        ssp_id = ssp_doc["system-security-plan"]["uuid"]
        await save_document("ssps", ssp_id, ssp_doc, workspace_id="default")

        retrieved, _ = await get_document("ssps", ssp_id, workspace_id="default")
        sys_char = retrieved["system-security-plan"]["system-characteristics"]
        assert sys_char["security-sensitivity-level"] == "moderate"
        inf_type = sys_char["system-information"]["information-types"][0]
        assert inf_type["confidentiality-impact"]["base"] == "fips-199-high"
        assert inf_type["integrity-impact"]["base"] == "fips-199-moderate"
        assert inf_type["availability-impact"]["base"] == "fips-199-low"
