"""
Empirical Verification Test Suite for Milestone 1
Author: challenger_m1_2 (teamwork_preview_challenger)

Tests cover:
1. Multi-tier chained profile imports (Profile A -> Profile B -> Profile C) with cumulative & overriding statement alters and parameter values.
2. Profile resolution under all 3 structuring modes (`as-is`, `custom`, `flat`) combined with alters.
3. Profile resolution under duplicate combine methods (`use-first`, `keep`) combined with alters.
4. Multi-format serialization of resolved catalogs (JSON, YAML, XML) via `format_converter.py`.
5. Adversarial edge cases: deep nesting, circular detection, multi-criteria removal, and case normalization.
"""

import pytest
import json
import uuid
from typing import Dict, Any

from tests.factories import CatalogFactory, ProfileFactory
from app.services.resolution_service import resolve_profile
from app.format_converter import (
    serialize_oscal_dict_to_xml,
    parse_xml_to_oscal_dict,
    serialize_dict_to_yaml,
    parse_yaml_to_dict
)


class TestChainedMultiTierImports:
    """Adversarial stress-testing of 3-tier and deep chained profile imports with alters and param overrides."""

    def test_three_tier_chained_alters_and_parameters(self, client, isolated_data_dir):
        """
        Verify: Base Catalog -> Profile A (Tier 1) -> Profile B (Tier 2) -> Profile C (Tier 3)
        - Cumulative parameter overrides and downstream parameter override priority.
        - Cumulative part additions, removals of base parts, additions relative to upstream-added parts,
          and downstream removals of upstream-added parts.
        """
        # 1. Base Catalog
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {"id": "ac-1_prm_1", "values": ["v0_1"]},
                        {"id": "ac-1_prm_2", "values": ["v0_2"]},
                        {"id": "ac-1_prm_3", "values": ["v0_3"]}
                    ],
                    "parts": [
                        {
                            "id": "ac-1_smt",
                            "name": "statement",
                            "prose": "The organization:",
                            "parts": [
                                {"id": "ac-1_smt.a", "name": "item", "prose": "Clause A (Base)"},
                                {"id": "ac-1_smt.b", "name": "item", "prose": "Clause B (Base)"}
                            ]
                        }
                    ]
                },
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [
                        {"id": "ac-2_prm_1", "values": ["v0_4"]}
                    ],
                    "parts": [
                        {"id": "ac-2_smt", "name": "statement", "prose": "Manage accounts."}
                    ]
                },
                {
                    "id": "ac-3",
                    "title": "Access Enforcement",
                    "parts": [
                        {"id": "ac-3_smt", "name": "statement", "prose": "Enforce access."}
                    ]
                }
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Profile A (Tier 1 - importing Base Catalog)
        # - Overrides ac-1_prm_1 -> v1_1
        # - Adds ac-1_smt.c (ending ac-1_smt)
        # - Adds ac-1_smt.temp (ending ac-1_smt)
        # - Adds guidance part to ac-2
        prof_a_doc = ProfileFactory.build(
            title="Tier 1 Profile A",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [
                    {"param-id": "ac-1_prm_1", "values": ["v1_1"]}
                ],
                "alters": [
                    {
                        "control-id": "ac-1",
                        "adds": [
                            {
                                "position": "ending",
                                "by-id": "ac-1_smt",
                                "parts": [
                                    {"id": "ac-1_smt.c", "name": "item", "prose": "Clause C (from Profile A)"},
                                    {"id": "ac-1_smt.temp", "name": "item", "prose": "Temp Clause (from Profile A)"}
                                ]
                            }
                        ]
                    },
                    {
                        "control-id": "ac-2",
                        "adds": [
                            {
                                "position": "ending",
                                "parts": [
                                    {"id": "ac-2_gdn", "name": "guidance", "prose": "Guidance A"}
                                ]
                            }
                        ]
                    }
                ]
            }
        )
        prof_a_uuid = prof_a_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_a_doc)

        # 3. Profile B (Tier 2 - importing Profile A)
        # - Overrides ac-1_prm_2 -> v2_2
        # - Overrides ac-1_prm_1 -> v2_1 (overrides Tier 1)
        # - Removes ac-1_smt.a (from base catalog)
        # - Removes ac-1_smt.temp (added in Tier 1)
        # - Adds ac-1_smt.d AFTER ac-1_smt.c (referencing Tier 1 added part)
        prof_b_doc = ProfileFactory.build(
            title="Tier 2 Profile B",
            imports=[{"href": f"../profiles/{prof_a_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [
                    {"param-id": "ac-1_prm_1", "values": ["v2_1"]},
                    {"param-id": "ac-1_prm_2", "values": ["v2_2"]}
                ],
                "alters": [
                    {
                        "control-id": "ac-1",
                        "removes": [
                            {"by-id": "ac-1_smt.a"},
                            {"by-id": "ac-1_smt.temp"}
                        ],
                        "adds": [
                            {
                                "position": "after",
                                "by-id": "ac-1_smt.c",
                                "parts": [
                                    {"id": "ac-1_smt.d", "name": "item", "prose": "Clause D (from Profile B)"}
                                ]
                            }
                        ]
                    }
                ]
            }
        )
        prof_b_uuid = prof_b_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_b_doc)

        # 4. Profile C (Tier 3 - importing Profile B)
        # - Overrides ac-1_prm_3 -> v3_3
        # - Overrides ac-1_prm_2 -> v3_2 (overrides Tier 2)
        # - Overrides ac-1_prm_1 -> v3_1 (overrides Tier 2 & Tier 1)
        # - Adds ac-1_smt.prefix BEFORE ac-1_smt.b
        # - Adds ac-1_smt.final at ENDING of ac-1_smt
        # - Removes ac-2_gdn (which was added back in Tier 1 Profile A)
        prof_c_doc = ProfileFactory.build(
            title="Tier 3 Profile C",
            imports=[{"href": f"../profiles/{prof_b_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [
                    {"param-id": "ac-1_prm_1", "values": ["v3_1"]},
                    {"param-id": "ac-1_prm_2", "values": ["v3_2"]},
                    {"param-id": "ac-1_prm_3", "values": ["v3_3"]}
                ],
                "alters": [
                    {
                        "control-id": "ac-1",
                        "adds": [
                            {
                                "position": "before",
                                "by-id": "ac-1_smt.b",
                                "parts": [
                                    {"id": "ac-1_smt.prefix", "name": "item", "prose": "Prefix Clause (from Profile C)"}
                                ]
                            },
                            {
                                "position": "ending",
                                "by-id": "ac-1_smt",
                                "parts": [
                                    {"id": "ac-1_smt.final", "name": "item", "prose": "Final Clause (from Profile C)"}
                                ]
                            }
                        ]
                    },
                    {
                        "control-id": "ac-2",
                        "removes": [
                            {"by-id": "ac-2_gdn"}
                        ]
                    }
                ]
            }
        )
        prof_c_uuid = prof_c_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_c_doc)

        # 5. Resolve Profile C via API
        res = client.get(f"/api/resolve/profile/{prof_c_uuid}")
        assert res.status_code == 200
        resolved = res.json()
        ctrls = {c["id"]: c for c in resolved["controls"]}
        assert len(ctrls) == 3

        # Check AC-1 Parameters
        ac1_params = {p["id"]: p.get("values") for p in ctrls["ac-1"].get("params", [])}
        assert ac1_params.get("ac-1_prm_1") == ["v3_1"], "Profile C should override Profile B and A for prm_1"
        assert ac1_params.get("ac-1_prm_2") == ["v3_2"], "Profile C should override Profile B for prm_2"
        assert ac1_params.get("ac-1_prm_3") == ["v3_3"], "Profile C should set prm_3"

        # Check AC-2 Parameter (unmodified baseline)
        ac2_params = {p["id"]: p.get("values") for p in ctrls["ac-2"].get("params", [])}
        assert ac2_params.get("ac-2_prm_1") == ["v0_4"], "Base value should persist when un-overridden"

        # Check AC-1 Statement subparts sequence
        ac1_subparts = ctrls["ac-1"]["parts"][0]["parts"]
        subpart_ids = [p["id"] for p in ac1_subparts]
        assert "ac-1_smt.a" not in subpart_ids, "Clause A was removed in Tier 2"
        assert "ac-1_smt.temp" not in subpart_ids, "Temp Clause was added in Tier 1 and removed in Tier 2"
        assert subpart_ids == [
            "ac-1_smt.prefix",
            "ac-1_smt.b",
            "ac-1_smt.c",
            "ac-1_smt.d",
            "ac-1_smt.final"
        ], "Parts must preserve exact recursive before/after/ending order across 3 tiers"

        # Check AC-2 Parts: ac-2_gdn was added in Tier 1 and removed in Tier 3
        ac2_part_ids = [p["id"] for p in ctrls["ac-2"].get("parts", [])]
        assert ac2_part_ids == ["ac-2_smt"], "ac-2_gdn should be completely removed"

    def test_chained_circular_import_rejection(self, client, isolated_data_dir):
        """Verify circular reference in multi-tier chains (A -> B -> C -> A) is caught and rejected."""
        prof_a_id = str(uuid.uuid4())
        prof_b_id = str(uuid.uuid4())
        prof_c_id = str(uuid.uuid4())

        prof_a = ProfileFactory.build(title="A", imports=[{"href": f"../profiles/{prof_b_id}.json", "include-all": {}}])
        prof_a["profile"]["uuid"] = prof_a_id

        prof_b = ProfileFactory.build(title="B", imports=[{"href": f"../profiles/{prof_c_id}.json", "include-all": {}}])
        prof_b["profile"]["uuid"] = prof_b_id

        prof_c = ProfileFactory.build(title="C", imports=[{"href": f"../profiles/{prof_a_id}.json", "include-all": {}}])
        prof_c["profile"]["uuid"] = prof_c_id

        client.post("/api/documents/profiles", json=prof_a)
        client.post("/api/documents/profiles", json=prof_b)
        client.post("/api/documents/profiles", json=prof_c)

        with pytest.raises(ValueError, match="Circular profile reference detected"):
            client.get(f"/api/resolve/profile/{prof_a_id}")


class TestStructuringModesWithAlters:
    """Adversarial testing of structuring modes (`as-is`, `custom`, `flat`) combined with alters."""

    def test_as_is_structuring_with_nested_group_alters(self, client, isolated_data_dir):
        """Verify `as-is` preserves deep nested groups while correctly applying alters and parameter overrides."""
        cat_doc = CatalogFactory.build(
            groups=[
                {
                    "id": "grp-parent",
                    "title": "Parent Group",
                    "groups": [
                        {
                            "id": "grp-child",
                            "title": "Child Group",
                            "controls": [
                                {
                                    "id": "ctrl-nested",
                                    "title": "Nested Control",
                                    "params": [{"id": "nested_prm", "values": ["orig"]}],
                                    "parts": [{"id": "nested_smt", "name": "statement", "prose": "Base prose."}]
                                }
                            ]
                        }
                    ],
                    "controls": [
                        {"id": "ctrl-top", "title": "Top Level Control"}
                    ]
                }
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [{"param-id": "nested_prm", "values": ["altered_val"]}],
                "alters": [
                    {
                        "control-id": "ctrl-nested",
                        "adds": [
                            {"position": "ending", "parts": [{"id": "nested_add", "name": "guidance", "prose": "Added note."}]}
                        ]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["groups"]) == 1
        p_grp = data["groups"][0]
        assert p_grp["id"] == "grp-parent"
        assert len(p_grp["controls"]) == 1
        assert p_grp["controls"][0]["id"] == "ctrl-top"

        assert len(p_grp["groups"]) == 1
        c_grp = p_grp["groups"][0]
        assert c_grp["id"] == "grp-child"
        assert len(c_grp["controls"]) == 1

        nested_c = c_grp["controls"][0]
        assert nested_c["id"] == "ctrl-nested"
        assert nested_c["params"][0]["values"] == ["altered_val"]
        assert len(nested_c["parts"]) == 2
        assert nested_c["parts"][1]["id"] == "nested_add"

    def test_flat_structuring_with_alters_across_all_levels(self, client, isolated_data_dir):
        """Verify `flat` merge extracts all controls into a single flat list while applying all alters."""
        cat_doc = CatalogFactory.build(
            controls=[{"id": "root-ctrl", "title": "Root Control"}],
            groups=[
                {
                    "id": "g-1",
                    "title": "Group 1",
                    "controls": [
                        {
                            "id": "c-1",
                            "title": "Control 1",
                            "controls": [{"id": "c-1.1", "title": "Sub Control 1.1"}]
                        }
                    ],
                    "groups": [
                        {
                            "id": "g-1.1",
                            "title": "Sub Group 1.1",
                            "controls": [{"id": "c-2", "title": "Control 2"}]
                        }
                    ]
                }
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        prof_doc = ProfileFactory.build(
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            merge={"flat": {}},
            modify={
                "alters": [
                    {
                        "control-id": "c-1.1",
                        "adds": [{"position": "ending", "props": [{"name": "custom-status", "value": "enhanced"}]}]
                    },
                    {
                        "control-id": "root-ctrl",
                        "adds": [{"title": "Overridden Root Title"}]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["groups"]) == 0, "Flat mode must have zero groups"
        ctrl_map = {c["id"]: c for c in data["controls"]}
        assert set(ctrl_map.keys()) == {"root-ctrl", "c-1", "c-1.1", "c-2"}

        assert ctrl_map["root-ctrl"]["title"] == "Overridden Root Title"
        assert ctrl_map["c-1.1"]["props"][0]["value"] == "enhanced"
        # Sub-controls should be detached in flat mode root list
        assert "controls" not in ctrl_map["c-1"]

    def test_custom_structuring_ordering_and_alters(self, client, isolated_data_dir):
        """
        Verify `custom` merge:
        - Reorganizes controls into custom groups with descending order.
        - Matches pattern-based inclusions.
        - Places remaining controls at root.
        - Correctly applies alters inside custom groups.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "AC-1 Baseline"},
                {"id": "ac-2", "title": "AC-2 Baseline"},
                {"id": "ac-3", "title": "AC-3 Baseline"},
                {"id": "si-1", "title": "SI-1 Baseline"},
                {"id": "si-2", "title": "SI-2 Baseline"},
                {"id": "ia-1", "title": "IA-1 Baseline"}
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            merge={
                "custom": {
                    "groups": [
                        {
                            "id": "grp-access",
                            "title": "Access Controls (Ordered Descending)",
                            "insert-controls": [
                                {
                                    "order": "descending",
                                    "include-controls": [{"with-ids": ["ac-1", "ac-2"]}]
                                }
                            ]
                        },
                        {
                            "id": "grp-integrity",
                            "title": "System Integrity Controls (Pattern Match)",
                            "insert-controls": [
                                {
                                    "include-controls": [{"matching": [{"pattern": "si-*"}]}]
                                }
                            ]
                        }
                    ],
                    "insert-controls": [
                        {"include-all": {}}
                    ]
                }
            },
            modify={
                "alters": [
                    {
                        "control-id": "ac-1",
                        "adds": [{"title": "AC-1 Custom Tailored"}]
                    },
                    {
                        "control-id": "ia-1",
                        "adds": [{"title": "IA-1 Tailored Root"}]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        # Check groups
        groups = {g["id"]: g for g in data["groups"]}
        assert "grp-access" in groups
        assert "grp-integrity" in groups

        # grp-access: ac-2 then ac-1 (descending order)
        ac_ids = [c["id"] for c in groups["grp-access"]["controls"]]
        assert ac_ids == ["ac-2", "ac-1"]
        assert groups["grp-access"]["controls"][1]["title"] == "AC-1 Custom Tailored"

        # grp-integrity: si-1 and si-2
        si_ids = [c["id"] for c in groups["grp-integrity"]["controls"]]
        assert set(si_ids) == {"si-1", "si-2"}

        # Root remaining controls: ac-3 and ia-1
        root_ids = [c["id"] for c in data["controls"]]
        assert set(root_ids) == {"ac-3", "ia-1"}
        ia_ctrl = next(c for c in data["controls"] if c["id"] == "ia-1")
        assert ia_ctrl["title"] == "IA-1 Tailored Root"


class TestDuplicateCombineMethodsWithAlters:
    """Adversarial testing of duplicate combine methods (`use-first`, `keep`) combined with alters."""

    def test_combine_use_first_with_alters(self, client, isolated_data_dir):
        """Verify `use-first` keeps only the first catalog's instance and applies alters correctly."""
        cat1 = CatalogFactory.build(
            controls=[{
                "id": "c-dup",
                "title": "Cat 1 Control",
                "params": [{"id": "p-dup", "values": ["cat1_val"]}],
                "parts": [{"id": "p-smt", "name": "statement", "prose": "Cat 1 prose."}]
            }]
        )
        cat2 = CatalogFactory.build(
            controls=[{
                "id": "c-dup",
                "title": "Cat 2 Control",
                "params": [{"id": "p-dup", "values": ["cat2_val"]}],
                "parts": [{"id": "p-smt", "name": "statement", "prose": "Cat 2 prose."}]
            }]
        )
        client.post("/api/documents/catalogs", json=cat1)
        client.post("/api/documents/catalogs", json=cat2)

        prof_doc = ProfileFactory.build(
            imports=[
                {"href": f"../catalogs/{cat1['catalog']['uuid']}.json", "include-all": {}},
                {"href": f"../catalogs/{cat2['catalog']['uuid']}.json", "include-all": {}}
            ],
            merge={"combine": {"method": "use-first"}},
            modify={
                "set-parameters": [{"param-id": "p-dup", "values": ["override_val"]}],
                "alters": [
                    {
                        "control-id": "c-dup",
                        "adds": [{"position": "ending", "parts": [{"id": "p-extra", "name": "guidance", "prose": "Extra."}]}]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["controls"]) == 1
        ctrl = data["controls"][0]
        assert ctrl["title"] == "Cat 1 Control", "Must use first encountered instance"
        assert ctrl["params"][0]["values"] == ["override_val"]
        assert len(ctrl["parts"]) == 2
        assert ctrl["parts"][0]["prose"] == "Cat 1 prose."
        assert ctrl["parts"][1]["id"] == "p-extra"

    def test_combine_keep_with_alters_applied_to_all_duplicates(self, client, isolated_data_dir):
        """Verify `keep` retains duplicate controls and alters apply consistently to all retained duplicates."""
        cat1 = CatalogFactory.build(
            controls=[{
                "id": "c-dup",
                "title": "Cat 1 Duplicate",
                "props": [{"name": "source", "value": "cat1"}]
            }]
        )
        cat2 = CatalogFactory.build(
            controls=[{
                "id": "c-dup",
                "title": "Cat 2 Duplicate",
                "props": [{"name": "source", "value": "cat2"}]
            }]
        )
        client.post("/api/documents/catalogs", json=cat1)
        client.post("/api/documents/catalogs", json=cat2)

        prof_doc = ProfileFactory.build(
            imports=[
                {"href": f"../catalogs/{cat1['catalog']['uuid']}.json", "include-all": {}},
                {"href": f"../catalogs/{cat2['catalog']['uuid']}.json", "include-all": {}}
            ],
            merge={"combine": {"method": "keep"}},
            modify={
                "alters": [
                    {
                        "control-id": "c-dup",
                        "adds": [{"position": "ending", "props": [{"name": "audited", "value": "true"}]}]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["controls"]) == 2
        for c in data["controls"]:
            assert c["id"] == "c-dup"
            prop_names = [p["name"] for p in c["props"]]
            assert "audited" in prop_names, "Alter must be applied to both duplicate instances"


class TestMultiFormatSerializationOfResolvedCatalogs:
    """Adversarial testing of multi-format serialization (JSON, YAML, XML) on resolved catalog structures."""

    def test_resolved_catalog_lossless_serialization_roundtrips(self, isolated_data_dir):
        """
        Verify that a resolved catalog containing nested groups, controls, parameters, parts,
        props, and links converts cleanly to and from JSON, YAML, and XML without structural data loss.
        """
        resolved_catalog_data = {
            "catalog": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Resolved High-Assurance Security Catalog",
                    "last-modified": "2026-08-22T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.0.0"
                },
                "params": [
                    {"id": "cat_param_1", "values": ["global_val"]}
                ],
                "groups": [
                    {
                        "id": "grp-1",
                        "title": "Access Management Group",
                        "controls": [
                            {
                                "id": "ac-1",
                                "title": "Access Control Policy and Procedures",
                                "params": [
                                    {"id": "ac-1_prm_1", "values": ["30_days"], "label": "Frequency"}
                                ],
                                "props": [
                                    {"name": "label", "value": "AC-1"},
                                    {"name": "status", "value": "tailored"}
                                ],
                                "links": [
                                    {"href": "https://example.org/policy/ac-1", "rel": "reference"}
                                ],
                                "parts": [
                                    {
                                        "id": "ac-1_smt",
                                        "name": "statement",
                                        "prose": "The organization:",
                                        "parts": [
                                            {"id": "ac-1_smt.a", "name": "item", "prose": "Develops policy."},
                                            {"id": "ac-1_smt.b", "name": "item", "prose": "Reviews policy quarterly."}
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "controls": [
                    {
                        "id": "si-1",
                        "title": "System Flaw Remediation",
                        "parts": [
                            {"id": "si-1_smt", "name": "statement", "prose": "Flaws are remediated within 15 days."}
                        ]
                    }
                ]
            }
        }

        # 1. JSON Roundtrip
        json_str = json.dumps(resolved_catalog_data, indent=2)
        parsed_json = json.loads(json_str)
        assert parsed_json == resolved_catalog_data

        # 2. YAML Roundtrip
        yaml_str = serialize_dict_to_yaml(resolved_catalog_data)
        parsed_yaml = parse_yaml_to_dict(yaml_str)
        assert parsed_yaml == resolved_catalog_data

        # 3. XML Roundtrip
        xml_str = serialize_oscal_dict_to_xml(resolved_catalog_data)
        assert "<catalog" in xml_str
        assert "xmlns=\"http://csrc.nist.gov/ns/oscal/1.0\"" in xml_str
        assert "<group" in xml_str
        assert "id=\"ac-1\"" in xml_str
        assert "<param" in xml_str
        assert "<part" in xml_str

        # Parse XML back to OSCAL dict
        parsed_xml_dict = parse_xml_to_oscal_dict(xml_str)
        assert "catalog" in parsed_xml_dict
        cat = parsed_xml_dict["catalog"]
        assert cat["uuid"] == resolved_catalog_data["catalog"]["uuid"]
        assert len(cat["groups"]) == 1
        assert cat["groups"][0]["controls"][0]["id"] == "ac-1"
        assert len(cat["controls"]) == 1
        assert cat["controls"][0]["id"] == "si-1"


class TestAdversarialResolutionEdgeCases:
    """Additional adversarial edge case tests targeting deep nesting, case normalization, and complex merge trees."""

    def test_four_tier_deep_nested_part_alterations(self, client, isolated_data_dir):
        """
        Test 4-tier chained profiles operating on a 4-level deep nested part hierarchy:
        stmt -> stmt.a -> stmt.a.1 -> stmt.a.1.i
        - Tier 1 adds stmt.a.1.ii
        - Tier 2 modifies stmt.a.1.i prose via in-place replacement
        - Tier 3 inserts stmt.a.1.i_prefix before stmt.a.1.i
        - Tier 4 removes stmt.a.1.ii
        """
        # Base Catalog
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "cm-1",
                "title": "Configuration Management Policy",
                "parts": [
                    {
                        "id": "cm-1_smt",
                        "name": "statement",
                        "prose": "The organization:",
                        "parts": [
                            {
                                "id": "cm-1_smt.a",
                                "name": "item",
                                "prose": "Maintains configuration:",
                                "parts": [
                                    {
                                        "id": "cm-1_smt.a.1",
                                        "name": "item",
                                        "prose": "Hardware baseline:",
                                        "parts": [
                                            {
                                                "id": "cm-1_smt.a.1.i",
                                                "name": "item",
                                                "prose": "Original Sub-item I"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalogs", json=cat_doc)
        assert res.status_code == 201

        # Profile 1: Adds cm-1_smt.a.1.ii
        prof1 = ProfileFactory.build(
            title="Tier 1",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={
                "alters": [
                    {
                        "control-id": "cm-1",
                        "adds": [
                            {
                                "position": "ending",
                                "by-id": "cm-1_smt.a.1",
                                "parts": [{"id": "cm-1_smt.a.1.ii", "name": "item", "prose": "Sub-item II (Tier 1)"}]
                            }
                        ]
                    }
                ]
            }
        )
        p1_uuid = prof1["profile"]["uuid"]
        res1 = client.post("/api/documents/profiles", json=prof1)
        assert res1.status_code == 201

        # Profile 2: Replacement of cm-1_smt.a.1.i (remove old + add modified after old)
        prof2 = ProfileFactory.build(
            title="Tier 2",
            imports=[{"href": f"../profiles/{p1_uuid}.json", "include-all": {}}],
            modify={
                "alters": [
                    {
                        "control-id": "cm-1",
                        "removes": [{"by-id": "cm-1_smt.a.1.i"}],
                        "adds": [
                            {
                                "position": "after",
                                "by-id": "cm-1_smt.a.1.i",
                                "parts": [{"id": "cm-1_smt.a.1.i_mod", "name": "item", "prose": "Replaced Sub-item I (Tier 2)"}]
                            }
                        ]
                    }
                ]
            }
        )
        p2_uuid = prof2["profile"]["uuid"]
        res2 = client.post("/api/documents/profiles", json=prof2)
        assert res2.status_code == 201

        # Profile 3: Inserts before cm-1_smt.a.1.i_mod
        prof3 = ProfileFactory.build(
            title="Tier 3",
            imports=[{"href": f"../profiles/{p2_uuid}.json", "include-all": {}}],
            modify={
                "alters": [
                    {
                        "control-id": "cm-1",
                        "adds": [
                            {
                                "position": "before",
                                "by-id": "cm-1_smt.a.1.i_mod",
                                "parts": [{"id": "cm-1_smt.a.1.pre", "name": "item", "prose": "Pre Sub-item (Tier 3)"}]
                            }
                        ]
                    }
                ]
            }
        )
        p3_uuid = prof3["profile"]["uuid"]
        res3 = client.post("/api/documents/profiles", json=prof3)
        assert res3.status_code == 201

        # Profile 4: Removes cm-1_smt.a.1.ii
        prof4 = ProfileFactory.build(
            title="Tier 4",
            imports=[{"href": f"../profiles/{p3_uuid}.json", "include-all": {}}],
            modify={
                "alters": [
                    {
                        "control-id": "cm-1",
                        "removes": [{"by-id": "cm-1_smt.a.1.ii"}]
                    }
                ]
            }
        )
        p4_uuid = prof4["profile"]["uuid"]
        res4 = client.post("/api/documents/profiles", json=prof4)
        assert res4.status_code == 201

        p4_res = client.get(f"/api/resolve/profile/{p4_uuid}").json()
        ctrl = p4_res["controls"][0]
        level4_parts = ctrl["parts"][0]["parts"][0]["parts"][0]["parts"]
        level4_ids = [p["id"] for p in level4_parts]

        assert level4_ids == ["cm-1_smt.a.1.pre", "cm-1_smt.a.1.i_mod"]
        assert level4_parts[1]["prose"] == "Replaced Sub-item I (Tier 2)"

    def test_case_insensitive_alter_and_param_resolution(self, client, isolated_data_dir):
        """Verify profile alters match control IDs and param IDs case-insensitively."""
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "AC-1",
                "title": "Uppercase AC-1",
                "params": [{"id": "PRM_AC_1", "values": ["UPPER"]}],
                "parts": [{"id": "AC-1_SMT", "name": "statement", "prose": "Upper statement."}]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalogs", json=cat_doc)
        assert res.status_code == 201

        prof_doc = ProfileFactory.build(
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [
                    {"param-id": "prm_ac_1", "values": ["lowered_override"]}
                ],
                "alters": [
                    {
                        "control-id": "ac-1",
                        "adds": [
                            {
                                "position": "ending",
                                "by-id": "ac-1_smt",
                                "parts": [{"id": "ac-1_note", "name": "item", "prose": "Added note"}]
                            }
                        ]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        res = client.post("/api/documents/profiles", json=prof_doc)
        assert res.status_code == 201

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]
        assert ctrl["params"][0]["values"] == ["lowered_override"]
        assert len(ctrl["parts"][0]["parts"]) == 1
        assert ctrl["parts"][0]["parts"][0]["id"] == "ac-1_note"

