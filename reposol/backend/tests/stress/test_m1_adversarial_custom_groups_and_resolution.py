"""
Empirical Adversarial Stress Test Suite for Milestone 1:
Custom Group Definition, Multi-Level Hierarchy Resolution, Case-Insensitive Mapping,
Pattern Matching, and OSCAL v1.1.2 Sanitization.

Author: Challenger 2 (Milestone 1 Backend Resolution Challenger)
"""

import copy
import uuid
import pytest
from typing import Dict, Any

from tests.factories import CatalogFactory, ProfileFactory
from app.validation import validate_document
from app.services.resolution_service import (
    resolve_profile,
    resolve_profile_inline,
    detect_modify_conflicts,
    _matches_pattern,
    _collect_controls_map,
    _collect_all_control_ids,
    _collect_all_param_ids,
    _apply_custom_structure,
)
from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
    prune_orphaned_modifications,
)


class TestDeep6LevelCustomGroupsHierarchy:
    """Stress testing deep 6-level nested custom group hierarchies."""

    def test_six_level_custom_group_hierarchy_resolution(self, client, isolated_data_dir):
        """
        Verify resolution of a full 6-level deep custom group hierarchy:
        L1 (Enterprise) -> L2 (Domain) -> L3 (System) -> L4 (Subsystem) -> L5 (Component) -> L6 (Module)
        With controls assigned at L1, L3, L5, L6, and unassigned root controls.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "ctrl-l1", "title": "Enterprise Governance Policy"},
                {"id": "ctrl-l3", "title": "System Architecture Baseline"},
                {"id": "ctrl-l5-a", "title": "Database Component Encryption"},
                {"id": "ctrl-l5-b", "title": "Database Component Auditing"},
                {"id": "ctrl-l6-a", "title": "SQL Parser Memory Protection"},
                {"id": "ctrl-l6-b", "title": "Query Validator Bounds Check"},
                {"id": "ctrl-unassigned-1", "title": "Physical Security Perimeter"},
                {"id": "ctrl-unassigned-2", "title": "Visitor Log Management"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.importing(catalog_uuid=cat_uuid)
        prof_doc["profile"]["merge"] = {
            "custom": {
                "groups": [
                    {
                        "id": "grp-l1",
                        "title": "Level 1: Enterprise",
                        "insert-controls": [
                            {"include-controls": [{"with-ids": ["ctrl-l1"]}]}
                        ],
                        "groups": [
                            {
                                "id": "grp-l2",
                                "title": "Level 2: Domain",
                                "groups": [
                                    {
                                        "id": "grp-l3",
                                        "title": "Level 3: System",
                                        "insert-controls": [
                                            {"include-controls": [{"with-ids": ["ctrl-l3"]}]}
                                        ],
                                        "groups": [
                                            {
                                                "id": "grp-l4",
                                                "title": "Level 4: Subsystem",
                                                "groups": [
                                                    {
                                                        "id": "grp-l5",
                                                        "title": "Level 5: Component",
                                                        "insert-controls": [
                                                            {
                                                                "order": "descending",
                                                                "include-controls": [
                                                                    {"with-ids": ["ctrl-l5-a", "ctrl-l5-b"]}
                                                                ]
                                                            }
                                                        ],
                                                        "groups": [
                                                            {
                                                                "id": "grp-l6",
                                                                "title": "Level 6: Module",
                                                                "insert-controls": [
                                                                    {
                                                                        "order": "ascending",
                                                                        "include-controls": [
                                                                            {"with-ids": ["ctrl-l6-b", "ctrl-l6-a"]}
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "insert-controls": [{"include-all": {}}]
            }
        }
        prof_uuid = prof_doc["profile"]["uuid"]
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # Resolve profile
        res_resolve = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_resolve.status_code == 200
        data = res_resolve.json()

        # Check Root Groups
        assert len(data["groups"]) == 1
        g1 = data["groups"][0]
        assert g1["id"] == "grp-l1"
        assert [c["id"] for c in g1.get("controls", [])] == ["ctrl-l1"]

        # Check L2
        assert len(g1.get("groups", [])) == 1
        g2 = g1["groups"][0]
        assert g2["id"] == "grp-l2"
        assert "controls" not in g2 or not g2.get("controls")

        # Check L3
        assert len(g2.get("groups", [])) == 1
        g3 = g2["groups"][0]
        assert g3["id"] == "grp-l3"
        assert [c["id"] for c in g3.get("controls", [])] == ["ctrl-l3"]

        # Check L4
        assert len(g3.get("groups", [])) == 1
        g4 = g3["groups"][0]
        assert g4["id"] == "grp-l4"
        assert "controls" not in g4 or not g4.get("controls")

        # Check L5 (descending order: ctrl-l5-b then ctrl-l5-a)
        assert len(g4.get("groups", [])) == 1
        g5 = g4["groups"][0]
        assert g5["id"] == "grp-l5"
        assert [c["id"] for c in g5.get("controls", [])] == ["ctrl-l5-b", "ctrl-l5-a"]

        # Check L6 (ascending order: ctrl-l6-a then ctrl-l6-b)
        assert len(g5.get("groups", [])) == 1
        g6 = g5["groups"][0]
        assert g6["id"] == "grp-l6"
        assert [c["id"] for c in g6.get("controls", [])] == ["ctrl-l6-a", "ctrl-l6-b"]
        assert "groups" not in g6

        # Check Root unassigned controls
        root_ctrl_ids = [c["id"] for c in data.get("controls", [])]
        assert set(root_ctrl_ids) == {"ctrl-unassigned-1", "ctrl-unassigned-2"}

    def test_six_level_conflict_detection_at_multiple_depths(self):
        """Verify detect_modify_conflicts locates orphaned custom control references at depth 1, 3, and 6."""
        profile = {
            "merge": {
                "custom": {
                    "groups": [
                        {
                            "id": "l1",
                            "title": "Level 1",
                            "insert-controls": [{"include-controls": [{"with-ids": ["valid-1", "orphan-l1"]}]}],
                            "groups": [
                                {
                                    "id": "l2",
                                    "title": "Level 2",
                                    "groups": [
                                        {
                                            "id": "l3",
                                            "title": "Level 3",
                                            "insert-controls": [{"include-controls": [{"with-ids": ["orphan-l3"]}]}],
                                            "groups": [
                                                {
                                                    "id": "l4",
                                                    "title": "Level 4",
                                                    "groups": [
                                                        {
                                                            "id": "l5",
                                                            "title": "Level 5",
                                                            "groups": [
                                                                {
                                                                    "id": "l6",
                                                                    "title": "Level 6",
                                                                    "insert-controls": [{"include-controls": [{"with-ids": ["valid-6", "orphan-l6"]}]}]
                                                                }
                                                            ]
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        }

        resolved_control_ids = {"valid-1", "valid-6"}
        resolved_param_ids = set()

        conflicts = detect_modify_conflicts(profile, resolved_control_ids, resolved_param_ids)
        assert conflicts["has_conflicts"] is True
        orphans = conflicts["orphaned_custom_refs"]
        assert len(orphans) == 3

        orphan_map = {(o["group-id"], o["control-id"]) for o in orphans}
        assert ("l1", "orphan-l1") in orphan_map
        assert ("l3", "orphan-l3") in orphan_map
        assert ("l6", "orphan-l6") in orphan_map

    @pytest.mark.asyncio
    async def test_six_level_empty_intermediate_groups_pruned_cleanly_on_save(self):
        """
        Verify that 6-level nested groups with completely empty leaf or intermediate groups
        are cleanly pruned by preprocess_profile_for_saving so empty array constraints are met.
        """
        doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Deep Nested Empty Groups Profile",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "imports": [{"href": "../catalogs/dummy.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "groups": [
                            {
                                "id": "l1",
                                "title": "Level 1",
                                "insert-controls": [{"include-controls": [{"with-ids": ["ac-1"]}]}],
                                "groups": [
                                    {
                                        "id": "l2-empty",
                                        "title": "Level 2 Empty",
                                        "groups": [],
                                        "insert-controls": []
                                    },
                                    {
                                        "id": "l2-populated",
                                        "title": "Level 2 Populated",
                                        "groups": [
                                            {
                                                "id": "l3-empty",
                                                "title": "Level 3 Empty",
                                                "groups": [
                                                    {
                                                        "id": "l4-empty",
                                                        "title": "Level 4 Empty",
                                                        "groups": [
                                                            {
                                                                "id": "l5-empty",
                                                                "title": "Level 5 Empty",
                                                                "groups": [
                                                                    {
                                                                        "id": "l6-empty",
                                                                        "title": "Level 6 Empty",
                                                                        "insert-controls": [{"include-controls": [{"with-ids": []}]}]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }

        cleaned = await preprocess_profile_for_saving(doc, persist_local_catalog=False)
        # Validate against official NIST OSCAL schema
        await validate_document("profiles", cleaned, check_refs=False)

        g1 = cleaned["profile"]["merge"]["custom"]["groups"][0]
        assert "groups" in g1
        # l2-empty should have groups and insert-controls stripped
        l2_empty = g1["groups"][0]
        assert "groups" not in l2_empty
        assert "insert-controls" not in l2_empty


class TestMixedCasingResolutionAndMapping:
    """Stress testing mixed casing sensitivity and case-insensitive resolution across all layers."""

    def test_mixed_casing_catalog_and_profile_with_ids(self, client, isolated_data_dir):
        """
        Verify case-insensitivity:
        - Catalog controls: 'AC-1', 'Ac-2', 'aC-3', 'IA-2.1', 'SC-7_A'
        - Profile with-ids: 'ac-1', 'AC-2', 'Ac-3', 'ia-2.1', 'sc-7_a'
        - Profile alters targeting: 'Ac-1', 'aC-2'
        - Profile set-parameters targeting: 'AC-1_PRM_1'
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "AC-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "values": ["default_val"]}],
                    "parts": [{"id": "AC-1_smt", "name": "statement", "prose": "Base prose."}]
                },
                {"id": "Ac-2", "title": "Account Management"},
                {"id": "aC-3", "title": "Access Enforcement"},
                {"id": "IA-2.1", "title": "MFA"},
                {"id": "SC-7_A", "title": "Boundary Protection"}
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            imports=[
                {
                    "href": f"../catalogs/{cat_uuid}.json",
                    "include-controls": [
                        {"with-ids": ["ac-1", "AC-2", "Ac-3", "ia-2.1", "sc-7_a"]}
                    ]
                }
            ],
            merge={
                "custom": {
                    "groups": [
                        {
                            "id": "grp-mixed-ac",
                            "title": "Mixed AC Group",
                            "insert-controls": [
                                {"include-controls": [{"with-ids": ["ac-1", "AC-2", "Ac-3"]}]}
                            ]
                        },
                        {
                            "id": "grp-mixed-other",
                            "title": "Mixed Other Group",
                            "insert-controls": [
                                {"include-controls": [{"with-ids": ["IA-2.1", "SC-7_A"]}]}
                            ]
                        }
                    ]
                }
            },
            modify={
                "set-parameters": [
                    {"param-id": "AC-1_PRM_1", "values": ["overridden_val"]}
                ],
                "alters": [
                    {
                        "control-id": "Ac-1",
                        "adds": [
                            {"position": "ending", "props": [{"name": "tested", "value": "true"}]}
                        ]
                    },
                    {
                        "control-id": "ac-2",
                        "adds": [{"title": "Modified Account Management Title"}]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["groups"]) == 2
        g1 = data["groups"][0]
        assert g1["id"] == "grp-mixed-ac"
        g1_c_ids = [c["id"] for c in g1["controls"]]
        assert g1_c_ids == ["AC-1", "Ac-2", "aC-3"]

        # Check alter and set-param applied regardless of casing
        c1 = g1["controls"][0]
        assert c1["id"] == "AC-1"
        assert c1["params"][0]["values"] == ["overridden_val"]
        assert any(p.get("name") == "tested" and p.get("value") == "true" for p in c1.get("props", []))

        c2 = g1["controls"][1]
        assert c2["id"] == "Ac-2"
        assert c2["title"] == "Modified Account Management Title"

        # Check group 2
        g2 = data["groups"][1]
        assert g2["id"] == "grp-mixed-other"
        g2_c_ids = [c["id"] for c in g2["controls"]]
        assert g2_c_ids == ["IA-2.1", "SC-7_A"]

        # Verify zero modify conflicts flagged due to casing
        assert data.get("conflicts", {}).get("has_conflicts") is False

    def test_mixed_casing_in_exclude_controls(self, client, isolated_data_dir):
        """Verify exclusion works case-insensitively across imports and custom groups."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "AC-1", "title": "AC-1"},
                {"id": "AC-2", "title": "AC-2"},
                {"id": "AC-3", "title": "AC-3"},
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            imports=[
                {
                    "href": f"../catalogs/{cat_uuid}.json",
                    "include-all": {},
                    "exclude-controls": [{"with-ids": ["ac-2"]}]
                }
            ],
            merge={
                "custom": {
                    "groups": [
                        {
                            "id": "g1",
                            "title": "G1",
                            "insert-controls": [{"include-controls": [{"with-ids": ["ac-1", "ac-2", "ac-3"]}]}]
                        }
                    ]
                }
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        # ac-2 was excluded at import phase, so only AC-1 and AC-3 resolve
        g1_ctrl_ids = [c["id"] for c in data["groups"][0]["controls"]]
        assert g1_ctrl_ids == ["AC-1", "AC-3"]
        assert "AC-2" not in g1_ctrl_ids
        assert "AC-2" in [c.upper() for c in data.get("excluded_control_ids", [])]


class TestPatternMatchingAdversarialEdgeCases:
    """Stress testing pattern matching in imports, exclusions, and custom group assignments."""

    def test_pattern_matching_globs_and_case_insensitivity(self):
        """Test glob wildcards * and ? matching case-insensitively."""
        assert _matches_pattern("ac-1", ["ac-*"]) is True
        assert _matches_pattern("AC-1", ["ac-*"]) is True
        assert _matches_pattern("ac-1", ["AC-*"]) is True
        assert _matches_pattern("ac-12", ["ac-?"]) is False
        assert _matches_pattern("ac-1", ["ac-?"]) is True
        assert _matches_pattern("ia-5.1(a)", ["ia-5.*"]) is True
        assert _matches_pattern("cm-8", ["*"]) is True
        assert _matches_pattern("cm-8", ["*-8"]) is True
        assert _matches_pattern("cm-8", ["?m-8"]) is True
        assert _matches_pattern("cm-8", ["xx-*"]) is False

    def test_pattern_matching_special_regex_characters_resilience(self):
        """
        Verify that patterns with special characters like dots, plus, parens, brackets
        do not crash or cause unexpected regex errors.
        """
        # Dot in pattern
        assert _matches_pattern("ia-2.1", ["ia-2.1"]) is True
        # Unclosed bracket in pattern should gracefully return False (not crash)
        assert _matches_pattern("ac-1", ["ac-[1-9"]) is False
        # Unclosed paren should gracefully return False
        assert _matches_pattern("ac-1", ["ac-(1"]) is False
        # Empty pattern list
        assert _matches_pattern("ac-1", []) is False
        # Pattern list with None or invalid entries
        assert _matches_pattern("ac-1", [""]) is False

    def test_custom_group_pattern_matching_resolution(self, client, isolated_data_dir):
        """Verify custom group insert-controls with matching pattern assigns controls correctly."""
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "SI-1", "title": "System Flaw 1"},
                {"id": "SI-2", "title": "System Flaw 2"},
                {"id": "SI-3(1)", "title": "System Flaw 3 Enhanced"},
                {"id": "AC-1", "title": "Access Control 1"},
                {"id": "IA-1", "title": "Identity 1"}
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
                            "id": "grp-si",
                            "title": "All System Integrity Controls",
                            "insert-controls": [
                                {
                                    "order": "ascending",
                                    "include-controls": [
                                        {"matching": [{"pattern": "si-*"}]}
                                    ]
                                }
                            ]
                        }
                    ],
                    "insert-controls": [{"include-all": {}}]
                }
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["groups"]) == 1
        si_grp = data["groups"][0]
        assert si_grp["id"] == "grp-si"
        assert [c["id"] for c in si_grp["controls"]] == ["SI-1", "SI-2", "SI-3(1)"]

        # Remaining controls at root: AC-1, IA-1
        root_ids = [c["id"] for c in data["controls"]]
        assert set(root_ids) == {"AC-1", "IA-1"}


class TestEmptyAndBoundaryCustomGroups:
    """Stress testing empty group lists, missing fields, and boundary sanitization."""

    @pytest.mark.asyncio
    async def test_preprocess_custom_with_only_empty_dicts_and_lists(self):
        """Verify profile with various empty merge structures normalizes to as-is: True."""
        cases = [
            {"merge": {"custom": {}}},
            {"merge": {"custom": {"groups": []}}},
            {"merge": {"custom": {"groups": [], "insert-controls": []}}},
        ]

        for case in cases:
            doc = {
                "profile": {
                    "uuid": str(uuid.uuid4()),
                    "metadata": {
                        "title": "Boundary Test Profile",
                        "last-modified": "2026-08-25T12:00:00Z",
                        "version": "1.0.0",
                        "oscal-version": "1.1.2"
                    },
                    "imports": [{"href": "../catalogs/dummy.json", "include-all": {}}],
                    **case
                }
            }
            cleaned = await preprocess_profile_for_saving(doc, persist_local_catalog=False)
            assert "custom" not in cleaned["profile"]["merge"]
            assert cleaned["profile"]["merge"].get("as-is") is True
            await validate_document("profiles", cleaned, check_refs=False)

    @pytest.mark.asyncio
    async def test_preprocess_and_postprocess_preserves_default_structure(self):
        """
        Verify defaultStructure property is moved to metadata props on save
        and reconstituted inside merge.custom on load.
        """
        doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Default Structure Profile",
                    "last-modified": "2026-08-25T12:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "imports": [{"href": "../catalogs/dummy.json", "include-all": {}}],
                "merge": {
                    "custom": {
                        "defaultStructure": "flat",
                        "groups": [
                            {
                                "id": "grp-1",
                                "title": "Group 1",
                                "insert-controls": [
                                    {"include-controls": [{"with-ids": ["ac-1"]}]}
                                ]
                            }
                        ]
                    }
                }
            }
        }

        # 1. Preprocess for saving
        saved_doc = await preprocess_profile_for_saving(doc, persist_local_catalog=False)
        # defaultStructure must NOT be in merge.custom (not allowed by OSCAL schema)
        assert "defaultStructure" not in saved_doc["profile"]["merge"]["custom"]
        # defaultStructure must be in metadata props
        props = saved_doc["profile"]["metadata"]["props"]
        ds_prop = next((p for p in props if p.get("name") == "default-structure"), None)
        assert ds_prop is not None
        assert ds_prop["value"] == "flat"
        assert ds_prop["ns"] == "https://reposol.org/ns"

        # Must pass official schema
        await validate_document("profiles", saved_doc, check_refs=False)

        # 2. Postprocess for loading
        loaded_doc = await postprocess_profile_for_loading(saved_doc)
        assert loaded_doc["profile"]["merge"]["custom"]["defaultStructure"] == "flat"

    def test_resolve_empty_custom_group_with_no_controls_assigned(self, client, isolated_data_dir):
        """Verify a custom group defined without controls resolves as an empty group (or group without controls)."""
        cat_doc = CatalogFactory.build(controls=[{"id": "ac-1", "title": "AC-1"}])
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            merge={
                "custom": {
                    "groups": [
                        {
                            "id": "grp-empty",
                            "title": "Empty Security Domain",
                            "insert-controls": []
                        }
                    ],
                    "insert-controls": [{"include-all": {}}]
                }
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["groups"]) == 1
        assert data["groups"][0]["id"] == "grp-empty"
        assert "controls" not in data["groups"][0] or not data["groups"][0]["controls"]
        # Root controls contain ac-1
        assert len(data["controls"]) == 1
        assert data["controls"][0]["id"] == "ac-1"


class TestInvalidAndCorruptedStructureResilience:
    """Stress testing parser and resolution resilience against malformed or invalid inputs."""

    def test_non_dict_and_corrupted_items_in_custom_structure_handled_gracefully(self):
        """Verify _apply_custom_structure does not crash on corrupted list entries."""
        custom_groups = [
            None,
            "corrupted_string_entry",
            12345,
            {
                "id": "valid-grp",
                "title": "Valid Group",
                "insert-controls": [
                    None,
                    "bad_directive",
                    {"include-controls": [None, "bad_inc", {"with-ids": ["ac-1"]}]}
                ],
                "groups": [None, 999]
            }
        ]
        all_controls = [{"id": "ac-1", "title": "AC-1"}]
        all_groups = []

        res_ctrls, res_groups = _apply_custom_structure(custom_groups, None, all_controls, all_groups)
        assert len(res_groups) == 1
        assert res_groups[0]["id"] == "valid-grp"
        assert len(res_groups[0]["controls"]) == 1
        assert res_groups[0]["controls"][0]["id"] == "ac-1"

    def test_control_assigned_to_multiple_custom_groups_deduplication(self, client, isolated_data_dir):
        """
        When a control ID is included in multiple custom groups,
        verify it is assigned to the first group that claims it (use-first semantics)
        and not duplicated across groups.
        """
        cat_doc = CatalogFactory.build(controls=[{"id": "ac-1", "title": "AC-1"}])
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            merge={
                "custom": {
                    "groups": [
                        {
                            "id": "grp-first",
                            "title": "First Group",
                            "insert-controls": [{"include-controls": [{"with-ids": ["ac-1"]}]}]
                        },
                        {
                            "id": "grp-second",
                            "title": "Second Group",
                            "insert-controls": [{"include-controls": [{"with-ids": ["ac-1"]}]}]
                        }
                    ]
                }
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        assert len(data["groups"]) == 2
        g1 = data["groups"][0]
        g2 = data["groups"][1]

        assert [c["id"] for c in g1.get("controls", [])] == ["ac-1"]
        assert "controls" not in g2 or not g2.get("controls")

    def test_preview_resolution_matches_saved_profile_resolution(self, client, isolated_data_dir):
        """
        Verify POST /api/resolve/profile/preview produces IDENTICAL output
        to GET /api/resolve/profile/{uuid} for a complex custom-grouped profile.
        """
        cat_doc = CatalogFactory.build(
            controls=[
                {"id": "AC-1", "title": "Access Control Policy", "params": [{"id": "ac-1_prm_1", "values": ["v1"]}]},
                {"id": "AC-2", "title": "Account Management"},
                {"id": "IA-1", "title": "Identification Policy"},
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
                            "id": "g-ac",
                            "title": "AC Group",
                            "insert-controls": [{"include-controls": [{"with-ids": ["ac-1", "ac-2"]}]}]
                        }
                    ],
                    "insert-controls": [{"include-all": {}}]
                }
            },
            modify={
                "set-parameters": [{"param-id": "ac-1_prm_1", "values": ["v_preview_test"]}],
                "alters": [{"control-id": "ac-1", "adds": [{"title": "Live Title Preview"}]}]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        # 1. Preview (unsaved inline profile)
        res_preview = client.post("/api/resolve/profile/preview", json=prof_doc)
        assert res_preview.status_code == 200
        preview_data = res_preview.json()

        # 2. Save and resolve saved profile
        client.post("/api/documents/profiles", json=prof_doc)
        res_saved = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_saved.status_code == 200
        saved_data = res_saved.json()

        # 3. Compare structure
        assert preview_data["groups"] == saved_data["groups"]
        assert preview_data["controls"] == saved_data["controls"]
        assert preview_data["excluded_control_ids"] == saved_data["excluded_control_ids"]
        assert preview_data["conflicts"] == saved_data["conflicts"]
