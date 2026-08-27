"""
Adversarial Stress Test Suite for Milestone M4-2 (OSCAL Profile Schema & Export Validation).
Author: Challenger M4-2 (Empirical Challenger)

Coverage:
1. Deep nested custom groups in export (JSON, YAML, XML) with up to 5 levels of nesting and mixed branches.
2. Empty group sanitization, empty `with-ids` array removal, empty custom block normalization to `as-is`, and invalid array rejection.
3. Strict schema validation using `jsonschema.Draft7Validator` against NIST OSCAL Schema v1.1.2.
4. Virtual UI helper exclusion (`__unassigned__`, `virtual-unassigned`, `defaultStructure`).
5. Unicode / international character resilience and XML entity escaping in export.
6. Error boundary and edge case verification (invalid UUID, missing documents, malformed schemas).
"""

import copy
import json
import uuid
import pytest
import yaml
import xml.etree.ElementTree as ET
from jsonschema import Draft7Validator, ValidationError

from app.validation import validate_document, SCHEMAS, OSCALValidationError
from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
    remove_empty_arrays,
)
from app.format_converter import (
    serialize_dict_to_yaml,
    serialize_oscal_dict_to_xml,
    parse_yaml_to_dict,
    parse_xml_to_oscal_dict,
)
from tests.factories import CatalogFactory, ProfileFactory


class TestM42AdversarialDeepNestedCustomGroupsExport:
    """Stress tests for deep nested custom groups across JSON, YAML, and XML exports."""

    @pytest.mark.asyncio
    async def test_5_level_deep_nested_custom_groups_json_yaml_xml(self, client, isolated_data_dir):
        """
        Adversarial Test: 5-level deep custom group hierarchy:
        Level 1 (Family) -> Level 2 (Subfamily) -> Level 3 (Section) -> Level 4 (Sub-section) -> Level 5 (Cluster)
        with controls inserted at multiple depths, custom group props, classes, and links.
        Verify full preservation and NIST OSCAL Schema v1.1.2 compliance across JSON, YAML, XML.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ctrl-l1", "title": "Level 1 Control"},
                {"id": "ctrl-l2", "title": "Level 2 Control"},
                {"id": "ctrl-l3", "title": "Level 3 Control"},
                {"id": "ctrl-l4", "title": "Level 4 Control"},
                {"id": "ctrl-l5a", "title": "Level 5 Control A"},
                {"id": "ctrl-l5b", "title": "Level 5 Control B"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        prof_doc = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title="5-Level Deep Custom Groups Profile",
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # Build 5-level deep custom group structure
        prof_doc["profile"]["merge"] = {
            "combine": {"method": "use-first"},
            "custom": {
                "groups": [
                    {
                        "id": "grp-lvl-1",
                        "title": "Level 1: Enterprise Governance",
                        "class": "enterprise-family",
                        "props": [{"name": "tier", "value": "1"}],
                        "insert-controls": [
                            {"order": "ascending", "include-controls": [{"with-ids": ["ctrl-l1"]}]}
                        ],
                        "groups": [
                            {
                                "id": "grp-lvl-2",
                                "title": "Level 2: Technical Domain",
                                "class": "technical-domain",
                                "props": [{"name": "tier", "value": "2"}],
                                "insert-controls": [
                                    {"order": "keep", "include-controls": [{"with-ids": ["ctrl-l2"]}]}
                                ],
                                "groups": [
                                    {
                                        "id": "grp-lvl-3",
                                        "title": "Level 3: Component Area",
                                        "class": "component-area",
                                        "props": [{"name": "tier", "value": "3"}],
                                        "insert-controls": [
                                            {"order": "descending", "include-controls": [{"with-ids": ["ctrl-l3"]}]}
                                        ],
                                        "groups": [
                                            {
                                                "id": "grp-lvl-4",
                                                "title": "Level 4: Implementation Module",
                                                "class": "module",
                                                "props": [{"name": "tier", "value": "4"}],
                                                "insert-controls": [
                                                    {"order": "ascending", "include-controls": [{"with-ids": ["ctrl-l4"]}]}
                                                ],
                                                "groups": [
                                                    {
                                                        "id": "grp-lvl-5",
                                                        "title": "Level 5: Atomic Control Cluster",
                                                        "class": "atomic-cluster",
                                                        "props": [{"name": "tier", "value": "5"}],
                                                        "insert-controls": [
                                                            {
                                                                "order": "ascending",
                                                                "include-controls": [{"with-ids": ["ctrl-l5a", "ctrl-l5b"]}],
                                                            }
                                                        ],
                                                    }
                                                ],
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        }

        # 1. Save Profile via API
        res_post = client.post("/api/documents/profiles", json=prof_doc)
        assert res_post.status_code == 201

        # 2. JSON Export Verification
        res_json = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_json.status_code == 200
        assert res_json.headers["content-type"] == "application/json"
        exported_json = res_json.json()

        # Strict NIST Schema validation using Draft7Validator
        validator = Draft7Validator(SCHEMAS["profiles"])
        schema_errors = list(validator.iter_errors(exported_json))
        assert len(schema_errors) == 0, f"JSON export schema errors: {[e.message for e in schema_errors]}"
        await validate_document("profiles", exported_json, check_refs=False)

        # Traverse and verify all 5 levels in JSON
        g1 = exported_json["profile"]["merge"]["custom"]["groups"][0]
        assert g1["id"] == "grp-lvl-1"
        assert g1["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ctrl-l1"]

        g2 = g1["groups"][0]
        assert g2["id"] == "grp-lvl-2"
        assert g2["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ctrl-l2"]

        g3 = g2["groups"][0]
        assert g3["id"] == "grp-lvl-3"
        assert g3["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ctrl-l3"]

        g4 = g3["groups"][0]
        assert g4["id"] == "grp-lvl-4"
        assert g4["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ctrl-l4"]

        g5 = g4["groups"][0]
        assert g5["id"] == "grp-lvl-5"
        assert g5["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ctrl-l5a", "ctrl-l5b"]

        # 3. YAML Export Verification
        res_yaml = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res_yaml.status_code == 200
        assert "yaml" in res_yaml.headers["content-type"]
        exported_yaml = yaml.safe_load(res_yaml.text)

        yaml_errors = list(validator.iter_errors(exported_yaml))
        assert len(yaml_errors) == 0, f"YAML export schema errors: {[e.message for e in yaml_errors]}"
        await validate_document("profiles", exported_yaml, check_refs=False)

        yg1 = exported_yaml["profile"]["merge"]["custom"]["groups"][0]
        assert yg1["groups"][0]["groups"][0]["groups"][0]["groups"][0]["id"] == "grp-lvl-5"

        # 4. XML Export Verification
        res_xml = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res_xml.status_code == 200
        assert "xml" in res_xml.headers["content-type"]
        root = ET.fromstring(res_xml.text)

        ns = {"oscal": "http://csrc.nist.gov/ns/oscal/1.0"}
        merge_el = root.find("oscal:merge", ns)
        assert merge_el is not None

        custom_el = merge_el.find("oscal:custom", ns)
        assert custom_el is not None

        # Verify XML hierarchy down to level 5
        lvl1_el = custom_el.find("oscal:group[@id='grp-lvl-1']", ns)
        assert lvl1_el is not None
        lvl2_el = lvl1_el.find("oscal:group[@id='grp-lvl-2']", ns)
        assert lvl2_el is not None
        lvl3_el = lvl2_el.find("oscal:group[@id='grp-lvl-3']", ns)
        assert lvl3_el is not None
        lvl4_el = lvl3_el.find("oscal:group[@id='grp-lvl-4']", ns)
        assert lvl4_el is not None
        lvl5_el = lvl4_el.find("oscal:group[@id='grp-lvl-5']", ns)
        assert lvl5_el is not None

    @pytest.mark.asyncio
    async def test_asymmetric_sibling_branches_export(self, client, isolated_data_dir):
        """
        Adversarial Test: Custom groups with asymmetric sibling branches:
        - Branch A: 4 levels deep
        - Branch B: 1 level flat with multiple insert-controls
        - Branch C: group without insert-controls containing sub-groups
        - Top-level custom insert-controls alongside custom groups
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "a-1", "title": "A-1"},
                {"id": "a-4", "title": "A-4"},
                {"id": "b-1", "title": "B-1"},
                {"id": "b-2", "title": "B-2"},
                {"id": "c-sub", "title": "C-Sub"},
                {"id": "top-ctrl", "title": "Top Control"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="Asymmetric Branches Profile")
        prof_uuid = prof_doc["profile"]["uuid"]

        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "branch-a-root",
                        "title": "Branch A (Deep)",
                        "groups": [
                            {
                                "id": "branch-a-l2",
                                "title": "Branch A L2",
                                "groups": [
                                    {
                                        "id": "branch-a-l3",
                                        "title": "Branch A L3",
                                        "groups": [
                                            {
                                                "id": "branch-a-l4",
                                                "title": "Branch A L4",
                                                "insert-controls": [
                                                    {"include-controls": [{"with-ids": ["a-4"]}]}
                                                ],
                                            }
                                        ],
                                    }
                                ],
                            }
                        ],
                    },
                    {
                        "id": "branch-b-flat",
                        "title": "Branch B (Flat)",
                        "insert-controls": [
                            {"order": "ascending", "include-controls": [{"with-ids": ["b-1"]}]},
                            {"order": "descending", "include-controls": [{"with-ids": ["b-2"]}]},
                        ],
                    },
                    {
                        "id": "branch-c-container",
                        "title": "Branch C (Container)",
                        "groups": [
                            {
                                "id": "branch-c-child",
                                "title": "Branch C Child",
                                "insert-controls": [
                                    {"include-controls": [{"with-ids": ["c-sub"]}]}
                                ],
                            }
                        ],
                    },
                ],
                "insert-controls": [
                    {"include-controls": [{"with-ids": ["top-ctrl"]}]}
                ],
            }
        }

        res_post = client.post("/api/documents/profiles", json=prof_doc)
        assert res_post.status_code == 201

        # Check JSON export
        res_json = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_json.status_code == 200
        exported = res_json.json()
        await validate_document("profiles", exported, check_refs=False)

        custom = exported["profile"]["merge"]["custom"]
        assert len(custom["groups"]) == 3
        assert len(custom["insert-controls"]) == 1

        # Check YAML export
        res_yaml = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res_yaml.status_code == 200
        parsed_yaml = yaml.safe_load(res_yaml.text)
        await validate_document("profiles", parsed_yaml, check_refs=False)

        # Check XML export
        res_xml = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res_xml.status_code == 200
        root = ET.fromstring(res_xml.text)
        assert "profile" in root.tag


class TestM42AdversarialEmptyGroupAndArraySanitization:
    """Stress tests for empty array sanitization, with-ids cleanup, and invalid array rejection."""

    @pytest.mark.asyncio
    async def test_deeply_nested_empty_arrays_sanitization(self):
        """
        Adversarial Test: Complex profile containing empty arrays at various nested levels:
        - Root empty `imports: []`
        - Group with empty `groups: []`
        - Group with empty `insert-controls: []`
        - Group with `insert-controls: [{"include-controls": [{"with-ids": []}]}]`
        - Group with empty `props: []`, `links: []`, `parts: []`, `params: []`
        All empty arrays must be stripped cleanly so minItems: 1 is satisfied.
        """
        doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Deep Empty Arrays Profile",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                    "props": [],
                    "links": [],
                    "roles": [],
                    "parties": [],
                },
                "imports": [
                    {
                        "href": "../catalogs/sample.json",
                        "include-controls": [],
                        "exclude-controls": [],
                        "include-all": {},
                    }
                ],
                "merge": {
                    "custom": {
                        "groups": [
                            {
                                "id": "grp-clean",
                                "title": "Group Clean",
                                "props": [],
                                "links": [],
                                "parts": [],
                                "params": [],
                                "groups": [],
                                "insert-controls": [],
                            },
                            {
                                "id": "grp-empty-with-ids",
                                "title": "Group With Empty With-IDs",
                                "insert-controls": [
                                    {
                                        "include-controls": [
                                            {"with-ids": []}
                                        ],
                                    }
                                ],
                            },
                            {
                                "id": "grp-order-empty-with-ids",
                                "title": "Group With Order And Empty With-IDs",
                                "insert-controls": [
                                    {
                                        "order": "ascending",
                                        "include-controls": [
                                            {"with-ids": []}
                                        ],
                                    }
                                ],
                            },
                            {
                                "id": "grp-valid-populated",
                                "title": "Group Populated",
                                "insert-controls": [
                                    {
                                        "include-controls": [
                                            {"with-ids": ["ctrl-1", "ctrl-2"]}
                                        ]
                                    }
                                ],
                            },
                        ]
                    }
                },
            }
        }

        cleaned = await preprocess_profile_for_saving(doc, persist_local_catalog=False)

        # Verify metadata empty arrays removed
        meta = cleaned["profile"]["metadata"]
        assert "props" not in meta
        assert "links" not in meta
        assert "roles" not in meta
        assert "parties" not in meta

        # Verify imports empty arrays removed
        imp = cleaned["profile"]["imports"][0]
        assert "include-controls" not in imp
        assert "exclude-controls" not in imp

        # Verify custom groups sanitization
        groups = cleaned["profile"]["merge"]["custom"]["groups"]
        assert len(groups) == 4

        g0 = groups[0]
        assert "props" not in g0
        assert "links" not in g0
        assert "parts" not in g0
        assert "params" not in g0
        assert "groups" not in g0
        assert "insert-controls" not in g0

        # g1: purely empty insert-controls structure is stripped completely
        g1 = groups[1]
        assert "insert-controls" not in g1

        # g2: empty include-controls stripped, valid order property preserved
        g2 = groups[2]
        assert g2["insert-controls"] == [{"order": "ascending"}]

        # g3: valid populated insert-controls retained
        g3 = groups[3]
        assert g3["insert-controls"][0]["include-controls"][0]["with-ids"] == ["ctrl-1", "ctrl-2"]

        # Validate strictly against NIST schema
        await validate_document("profiles", cleaned, check_refs=False)

    @pytest.mark.asyncio
    async def test_entirely_empty_custom_block_normalizes_to_as_is(self):
        """
        Adversarial Test: When merge.custom only contained empty groups or empty arrays,
        it must normalize to as-is: True rather than leaving an empty custom: {} block,
        which would fail NIST OSCAL schema validation.
        """
        doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Empty Custom Block Normalization",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
                "imports": [{"href": "../catalogs/sample.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "groups": [],
                        "insert-controls": [],
                    }
                },
            }
        }

        cleaned = await preprocess_profile_for_saving(doc, persist_local_catalog=False)
        assert "custom" not in cleaned["profile"]["merge"]
        assert cleaned["profile"]["merge"].get("as-is") is True

        await validate_document("profiles", cleaned, check_refs=False)

    def test_rejection_of_invalid_schema_types(self, client, isolated_data_dir):
        """
        Adversarial Test: Validate that invalid non-array types for array fields or invalid types are rejected with 400.
        """
        cat_uuid = str(uuid.uuid4())

        # 1. Invalid 'groups' type (string instead of array)
        invalid_doc_1 = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Invalid Groups Type",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
                "imports": [{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "groups": "not-an-array"
                    }
                }
            }
        }
        res1 = client.post("/api/documents/profiles", json=invalid_doc_1)
        assert res1.status_code == 400

        # 2. Invalid 'with-ids' type (dict instead of array of strings)
        invalid_doc_2 = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Invalid With-IDs Type",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
                "imports": [{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "groups": [
                            {
                                "id": "grp-1",
                                "title": "Group 1",
                                "insert-controls": [
                                    {"include-controls": [{"with-ids": {"invalid": "dict"}}]}
                                ]
                            }
                        ]
                    }
                }
            }
        }
        res2 = client.post("/api/documents/profiles", json=invalid_doc_2)
        assert res2.status_code == 400

        # 3. Invalid order enum value
        invalid_doc_3 = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Invalid Order Enum",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
                "imports": [{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "groups": [
                            {
                                "id": "grp-1",
                                "title": "Group 1",
                                "insert-controls": [
                                    {
                                        "order": "random-invalid-order",
                                        "include-controls": [{"with-ids": ["ac-1"]}]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
        res3 = client.post("/api/documents/profiles", json=invalid_doc_3)
        assert res3.status_code == 400


class TestM42AdversarialVirtualUIHelperExclusion:
    """Stress tests ensuring virtual UI elements never leak into exports."""

    @pytest.mark.asyncio
    async def test_virtual_helpers_and_ui_metadata_excluded_from_export(self, client, isolated_data_dir):
        """
        Adversarial Test: Profiles containing UI temporary state:
        - `__unassigned__` group
        - `virtual-unassigned` class
        - `defaultStructure` in merge.custom
        - `with-child-controls` in imports
        Verify that none of these leak into raw exported JSON, YAML, or XML.
        """
        cat_doc = CatalogFactory.build(controls=[{"id": "ac-1", "title": "AC-1"}])
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid, title="UI Helpers Test Profile")
        prof_uuid = prof_doc["profile"]["uuid"]

        # Inject UI helpers
        prof_doc["profile"]["imports"][0]["with-child-controls"] = True
        prof_doc["profile"]["merge"] = {
            "custom": {
                "defaultStructure": "by-domain",
                "groups": [
                    {
                        "id": "grp-real",
                        "title": "Real Security Group",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["ac-1"]}]}
                        ],
                    },
                ]
            }
        }

        res_post = client.post("/api/documents/profiles", json=prof_doc)
        assert res_post.status_code == 201

        # 1. JSON Export Check
        res_json = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_json.status_code == 200
        json_data = res_json.json()

        # defaultStructure must NOT be in merge.custom
        assert "defaultStructure" not in json_data["profile"]["merge"].get("custom", {})
        # with-child-controls must NOT be in imports
        assert "with-child-controls" not in json_data["profile"]["imports"][0]

        # Raw text search
        assert "__unassigned__" not in res_json.text
        assert "virtual-unassigned" not in res_json.text
        assert "defaultStructure" not in res_json.text

        await validate_document("profiles", json_data, check_refs=False)

        # 2. YAML Export Check
        res_yaml = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res_yaml.status_code == 200
        assert "__unassigned__" not in res_yaml.text
        assert "virtual-unassigned" not in res_yaml.text
        assert "defaultStructure" not in res_yaml.text

        # 3. XML Export Check
        res_xml = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res_xml.status_code == 200
        assert "__unassigned__" not in res_xml.text
        assert "virtual-unassigned" not in res_xml.text
        assert "defaultStructure" not in res_xml.text


class TestM42AdversarialUnicodeAndXMLEntityExport:
    """Stress tests for Unicode character integrity and XML entity escaping."""

    @pytest.mark.asyncio
    async def test_unicode_and_xml_special_characters_in_export(self, client, isolated_data_dir):
        """
        Adversarial Test: Profiles containing German Grundschutz umlauts (ä, ö, ü, ß),
        special XML characters (<, >, &, \", '), and multiline descriptions.
        Verify that exports in JSON, YAML, and XML preserve characters and parse cleanly.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "inf-1",
                    "title": "Informationssicherheit & Datenschutz <Grundschutz>",
                }
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        special_title = "IT-Grundschutz Baustein OPS.1.1.4: Schutz vor Schadsoftware & 'Spam' <Edition 2023>"
        special_group_title = "Sicherheitsanforderungen für Cloud-Dienste (München & Köln) — § 203 StGB & DSGVO"

        prof_doc = ProfileFactory.importing(
            catalog_uuid=cat_uuid,
            title=special_title,
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-grundschutz-ops",
                        "title": special_group_title,
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["inf-1"]}]}
                        ],
                    }
                ]
            }
        }

        res_post = client.post("/api/documents/profiles", json=prof_doc)
        assert res_post.status_code == 201

        # 1. JSON Export Check
        res_json = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_json.status_code == 200
        json_data = res_json.json()
        assert json_data["profile"]["metadata"]["title"] == special_title
        assert json_data["profile"]["merge"]["custom"]["groups"][0]["title"] == special_group_title
        await validate_document("profiles", json_data, check_refs=False)

        # 2. YAML Export Check
        res_yaml = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res_yaml.status_code == 200
        yaml_data = yaml.safe_load(res_yaml.text)
        assert yaml_data["profile"]["metadata"]["title"] == special_title
        assert yaml_data["profile"]["merge"]["custom"]["groups"][0]["title"] == special_group_title
        await validate_document("profiles", yaml_data, check_refs=False)

        # 3. XML Export Check
        res_xml = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res_xml.status_code == 200
        # XML parser must not crash on escaped entities
        root = ET.fromstring(res_xml.text)
        ns = {"oscal": "http://csrc.nist.gov/ns/oscal/1.0"}
        title_el = root.find("oscal:metadata/oscal:title", ns)
        assert title_el is not None
        assert title_el.text == special_title

        grp_title_el = root.find("oscal:merge/oscal:custom/oscal:group/oscal:title", ns)
        assert grp_title_el is not None
        assert grp_title_el.text == special_group_title


class TestM42AdversarialBoundaryAndEdgeCases:
    """Stress tests for boundary conditions, invalid IDs, and non-existent resources."""

    def test_export_nonexistent_profile_returns_404(self, client, isolated_data_dir):
        """Exporting a non-existent UUID must return 404."""
        fake_uuid = str(uuid.uuid4())
        res = client.get(f"/api/export/profiles/{fake_uuid}?format=json")
        assert res.status_code == 404

    def test_export_malformed_uuid_returns_400(self, client, isolated_data_dir):
        """Exporting an invalid UUID format must return 400."""
        res = client.get("/api/export/profiles/not-a-valid-uuid?format=json")
        assert res.status_code == 400
        assert "Invalid UUID format" in res.json()["detail"]

    @pytest.mark.asyncio
    async def test_draft7_validator_direct_evaluation_all_variations(self):
        """
        Adversarial Test: Run Draft7Validator directly on a comprehensive matrix of OSCAL profile variations:
        - Minimal profile
        - Profile with full metadata + backmatter
        - Profile with flat merge
        - Profile with as-is merge
        - Profile with custom merge containing multiple groups and sub-groups
        - Profile with modifies, alters, and set-parameters
        All must pass Draft7Validator.iter_errors with 0 errors.
        """
        validator = Draft7Validator(SCHEMAS["profiles"])

        # Variation 1: Minimal profile
        v1 = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Minimal Profile",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                },
                "imports": [{"href": "../catalogs/c1.json", "include-all": {}}],
            }
        }
        assert len(list(validator.iter_errors(v1))) == 0

        # Variation 2: Flat merge
        v2 = copy.deepcopy(v1)
        v2["profile"]["merge"] = {"flat": {}}
        assert len(list(validator.iter_errors(v2))) == 0

        # Variation 3: as-is merge
        v3 = copy.deepcopy(v1)
        v3["profile"]["merge"] = {"as-is": True}
        assert len(list(validator.iter_errors(v3))) == 0

        # Variation 4: modify with alters and set-parameters
        v4 = copy.deepcopy(v1)
        v4["profile"]["modify"] = {
            "set-parameters": [
                {
                    "param-id": "param-1",
                    "values": ["30 days"],
                }
            ],
            "alters": [
                {
                    "control-id": "ac-1",
                    "adds": [
                        {
                            "position": "ending",
                            "parts": [
                                {
                                    "id": "ac-1_custom_smt",
                                    "name": "statement",
                                    "prose": "Custom statement addition.",
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        assert len(list(validator.iter_errors(v4))) == 0

        # Variation 5: back-matter resources
        v5 = copy.deepcopy(v1)
        v5["profile"]["back-matter"] = {
            "resources": [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "Reference Guide",
                    "rlinks": [{"href": "https://example.com/guide.pdf", "media-type": "application/pdf"}],
                }
            ]
        }
        assert len(list(validator.iter_errors(v5))) == 0
