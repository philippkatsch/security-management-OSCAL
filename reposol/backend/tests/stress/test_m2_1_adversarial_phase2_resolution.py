"""
M2_1 Empirical Challenger: Adversarial Stress Test Suite for Phase 2 Resolution Engines.
Tests cover:
1. Pattern exclusions & wildcard syntax (matching: [{"pattern": ...}], case insensitivity, regex resilience, precedence).
2. Live preview of local-controls under complex structures (merges, alters, parameter overrides, custom groups, conflicts).
3. Withdrawn control auto-exclusion across root controls, nested groups, sub-controls, and varied prop casings.
4. In-place statement replacement and deep multi-level statement additions in backend resolution (both live preview and saved).
"""
import pytest
import copy
from tests.factories import CatalogFactory, ProfileFactory


class TestM2_1AdversarialPhase2Resolution:
    """Empirical stress tests challenging Phase 2 backend resolution engine."""

    def test_adversarial_wildcard_patterns_all_syntaxes(self, client, isolated_data_dir):
        """
        Pillar 1: Test glob patterns with 'matching',
        infix/prefix/suffix wildcards, single-character '?', case-insensitivity, and regex special characters.
        """
        # 1. Base catalog with diverse control ID naming conventions
        cat_doc = CatalogFactory.build(
            title="Base Catalog for Pattern Stress",
            controls=[
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "ac-2", "title": "Account Management", "controls": [{"id": "ac-2.1", "title": "Automated"}]},
                {"id": "ac-20", "title": "External System Access"},
                {"id": "ac-200", "title": "Legacy Gateway Access"},
                {"id": "ac-special-ext", "title": "Special Extension"},
                {"id": "au-1", "title": "Audit Policy"},
                {"id": "au-2", "title": "Audit Events"},
                {"id": "ia-5", "title": "Authenticator Management"},
                {"id": "sc-7.1", "title": "Boundary Protection Part 1"},
                {"id": "sc-7.2", "title": "Boundary Protection Part 2"},
                {"id": "sc-7.10", "title": "Boundary Protection Part 10"},
                {"id": "regex.ctrl", "title": "Dot in ID"},
                {"id": "regex[bracket]", "title": "Bracket in ID"},
                {"id": "regex+plus", "title": "Plus in ID"}
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Profile with NIST OSCAL compliant matching array containing pattern objects
        prof_doc = ProfileFactory.build(
            title="Adversarial Wildcard Profile",
            imports=[
                {
                    "href": f"../catalogs/{cat_uuid}.json",
                    # Include: AC controls, AU controls, SC-7.* controls, and regex controls
                    "include-controls": [
                        {
                            "matching": [
                                {"pattern": "AC-*"},  # uppercase pattern test
                                {"pattern": "sc-7.?"}, # single char after sc-7. -> matches 7.1, 7.2 but NOT 7.10
                                {"pattern": "*special*"}, # infix wildcard
                                {"pattern": "regex*"}
                            ],
                            "with-ids": ["au-1"]
                        }
                    ],
                    # Exclude: exclude ac-2? (matches ac-20, ac-2.1), exclude ac-200, ac-2.*, with-ids for bracket/plus
                    "exclude-controls": [
                        {
                            "matching": [
                                {"pattern": "ac-2?"},  # single char wildcard -> excludes ac-20
                                {"pattern": "ac-200"},
                                {"pattern": "ac-2.*"}  # excludes ac-2.1
                            ],
                            "with-ids": ["regex[bracket]", "regex+plus"] # exact literal ID exclusion
                        }
                    ]
                }
            ]
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        res_save = client.post("/api/documents/profiles", json=prof_doc)
        assert res_save.status_code == 201

        # 3. Resolve profile
        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        resolved_ctrl_ids = [c["id"].lower() for c in data["controls"]]

        # Inclusions verified:
        assert "ac-1" in resolved_ctrl_ids
        assert "ac-special-ext" in resolved_ctrl_ids
        assert "au-1" in resolved_ctrl_ids
        assert "sc-7.1" in resolved_ctrl_ids
        assert "sc-7.2" in resolved_ctrl_ids
        assert "regex.ctrl" in resolved_ctrl_ids

        # Exclusions verified (took precedence over inclusions):
        assert "ac-20" not in resolved_ctrl_ids
        assert "ac-200" not in resolved_ctrl_ids
        assert "ac-2.1" not in resolved_ctrl_ids
        assert "regex[bracket]" not in resolved_ctrl_ids
        assert "regex+plus" not in resolved_ctrl_ids

        # Items not matched by include rules:
        assert "au-2" not in resolved_ctrl_ids
        assert "ia-5" not in resolved_ctrl_ids
        assert "sc-7.10" not in resolved_ctrl_ids  # sc-7.? matched single char only, not 2 chars

    def test_adversarial_local_controls_live_preview(self, client, isolated_data_dir):
        """
        Pillar 2: Test unsaved local-controls in live preview (/api/resolve/profile/preview)
        under complex merges, modifies, parameter overrides, custom grouping, and conflict checks.
        """
        # 1. Base catalog
        cat_doc = CatalogFactory.build(
            title="Imported Base Catalog",
            controls=[
                {
                    "id": "imp-1",
                    "title": "Imported Control 1",
                    "params": [{"id": "imp-1_prm", "values": ["Default Import"]}]
                }
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Live preview payload containing unsaved local controls, alters on local control,
        # set-parameters on local control, custom merge grouping, and combine rules.
        preview_payload = {
            "profile": {
                "uuid": "99999999-9999-9999-9999-999999999999",
                "metadata": {"title": "Complex Live Preview Profile", "version": "1.0.0"},
                "imports": [
                    {
                        "href": f"../catalogs/{cat_uuid}.json",
                        "include-all": {}
                    }
                ],
                "local-controls": [
                    {
                        "id": "local-sec-1",
                        "title": "Local Security Architecture",
                        "params": [
                            {"id": "local_param_1", "values": ["Default Local Param Value"]}
                        ],
                        "parts": [
                            {
                                "id": "local-sec-1_smt",
                                "name": "statement",
                                "prose": "Local initial statement."
                            }
                        ]
                    },
                    {
                        "id": "local-sec-2",
                        "title": "Local Key Management",
                        "parts": [
                            {
                                "id": "local-sec-2_smt",
                                "name": "statement",
                                "prose": "Initial local key management statement."
                            }
                        ]
                    }
                ],
                "merge": {
                    "combine": {"method": "use-first"},
                    "custom": {
                        "groups": [
                            {
                                "id": "custom-grp-1",
                                "title": "Corporate Local Controls Group",
                                "insert-controls": [
                                    {
                                        "include-controls": [
                                            {"with-ids": ["local-sec-1", "local-sec-2"]}
                                        ]
                                    }
                                ]
                            }
                        ],
                        "insert-controls": [
                            {
                                "include-controls": [
                                    {"with-ids": ["imp-1"]}
                                ]
                            }
                        ]
                    }
                },
                "modify": {
                    "set-parameters": [
                        {
                            "param-id": "local_param_1",
                            "values": ["Overridden Local Param Value"]
                        }
                    ],
                    "alters": [
                        {
                            "control-id": "local-sec-1",
                            "removes": [{"by-id": "local-sec-1_smt"}],
                            "adds": [
                                {
                                    "by-id": "local-sec-1_smt",
                                    "position": "after",
                                    "parts": [
                                        {
                                            "id": "local-sec-1_smt",
                                            "name": "statement",
                                            "prose": "Replaced in-place local statement prose."
                                        }
                                    ]
                                },
                                {
                                    "position": "ending",
                                    "parts": [
                                        {
                                            "id": "local-sec-1_gbl",
                                            "name": "guidance",
                                            "prose": "Added local guidance."
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        }

        res = client.post("/api/resolve/profile/preview", json=preview_payload)
        assert res.status_code == 200
        data = res.json()

        # 3. Verify custom groups and local controls structure
        assert len(data["groups"]) == 1
        custom_grp = data["groups"][0]
        assert custom_grp["id"] == "custom-grp-1"
        grp_ctrl_ids = [c["id"] for c in custom_grp["controls"]]
        assert "local-sec-1" in grp_ctrl_ids
        assert "local-sec-2" in grp_ctrl_ids

        # Verify root controls contains imp-1
        assert len(data["controls"]) == 1
        assert data["controls"][0]["id"] == "imp-1"

        # 4. Verify alters applied to local control in live preview
        local_ctrl_1 = next(c for c in custom_grp["controls"] if c["id"] == "local-sec-1")
        part_ids = [p["id"] for p in local_ctrl_1["parts"]]
        assert "local-sec-1_smt" in part_ids
        assert "local-sec-1_gbl" in part_ids

        smt_part = next(p for p in local_ctrl_1["parts"] if p["id"] == "local-sec-1_smt")
        assert smt_part["prose"] == "Replaced in-place local statement prose."

        # 5. Verify parameter override applied to local control
        assert local_ctrl_1["params"][0]["values"] == ["Overridden Local Param Value"]

        # 6. Verify conflict detection does not flag local control parameter or control as orphaned
        conflicts = data.get("conflicts")
        if conflicts:
            orphaned_params = conflicts.get("orphaned_set_parameters", [])
            assert not any(p["param-id"] == "local_param_1" for p in orphaned_params)
            orphaned_alters = conflicts.get("orphaned_alters", [])
            assert not any(a["control-id"] == "local-sec-1" for a in orphaned_alters)

    def test_adversarial_withdrawn_controls_auto_exclusion(self, client, isolated_data_dir):
        """
        Pillar 4: Test automatic exclusion of withdrawn controls across root controls,
        nested groups, child controls, and mixed casing ('Status', 'STATE', 'Withdrawn', 'WITHDRAWN').
        """
        cat_doc = CatalogFactory.build(
            title="Catalog with Withdrawn Controls",
            controls=[
                {
                    "id": "ctrl-active-1",
                    "title": "Active Control 1",
                    "props": [{"name": "status", "value": "active"}]
                },
                {
                    "id": "ctrl-withdrawn-root",
                    "title": "Deprecated Control at Root",
                    "props": [{"name": "status", "value": "withdrawn"}]
                }
            ],
            groups=[
                {
                    "id": "grp-1",
                    "title": "Group 1",
                    "controls": [
                        {
                            "id": "ctrl-active-2",
                            "title": "Active Control 2",
                            "controls": [
                                {
                                    "id": "ctrl-withdrawn-sub",
                                    "title": "Withdrawn Sub-control",
                                    "props": [{"name": "STATUS", "value": "Withdrawn"}]
                                }
                            ]
                        },
                        {
                            "id": "ctrl-withdrawn-state",
                            "title": "Withdrawn by State Prop",
                            "props": [{"name": "STATE", "value": "WITHDRAWN"}]
                        }
                    ],
                    "groups": [
                        {
                            "id": "subgrp-1",
                            "title": "Subgroup 1",
                            "controls": [
                                {
                                    "id": "ctrl-withdrawn-nested-grp",
                                    "title": "Nested Withdrawn Control",
                                    "props": [{"name": "status", "value": "withdrawn"}]
                                },
                                {
                                    "id": "ctrl-active-3",
                                    "title": "Active Nested Control",
                                    "props": [{"name": "status", "value": "operational"}]
                                }
                            ]
                        }
                    ]
                }
            ]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Profile with include-all: {}
        prof_doc = ProfileFactory.build(
            title="Profile Auto-Excluding Withdrawn",
            imports=[
                {
                    "href": f"../catalogs/{cat_uuid}.json",
                    "include-all": {}
                }
            ]
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()

        def collect_ids(resolved):
            ids = set()
            for c in resolved.get("controls", []):
                ids.add(c["id"].lower())
                for sub in c.get("controls", []):
                    ids.add(sub["id"].lower())
            for g in resolved.get("groups", []):
                for c in g.get("controls", []):
                    ids.add(c["id"].lower())
                    for sub in c.get("controls", []):
                        ids.add(sub["id"].lower())
                for sub_g in g.get("groups", []):
                    for c in sub_g.get("controls", []):
                        ids.add(c["id"].lower())
            return ids

        resolved_ids = collect_ids(data)

        # Active controls present
        assert "ctrl-active-1" in resolved_ids
        assert "ctrl-active-2" in resolved_ids
        assert "ctrl-active-3" in resolved_ids

        # Withdrawn controls auto-excluded
        assert "ctrl-withdrawn-root" not in resolved_ids
        assert "ctrl-withdrawn-sub" not in resolved_ids
        assert "ctrl-withdrawn-state" not in resolved_ids
        assert "ctrl-withdrawn-nested-grp" not in resolved_ids

        # Check excluded_control_ids list in resolution payload
        excluded = data["excluded_control_ids"]
        assert "ctrl-withdrawn-root" in excluded
        assert "ctrl-withdrawn-sub" in excluded
        assert "ctrl-withdrawn-state" in excluded
        assert "ctrl-withdrawn-nested-grp" in excluded

    def test_adversarial_deep_part_tree_replacement_and_additions_live_preview(self, client, isolated_data_dir):
        """
        Pillar 3: Test atomic in-place statement replacement and targeted additions in live preview.
        """
        cat_doc = CatalogFactory.build(
            title="Catalog with Deep Part Hierarchy",
            controls=[
                {
                    "id": "deep-1",
                    "title": "Deep Structure Control",
                    "parts": [
                        {
                            "id": "deep-1_smt",
                            "name": "statement",
                            "prose": "Root statement",
                            "parts": [
                                {
                                    "id": "deep-1_smt.a",
                                    "name": "item",
                                    "prose": "Item a",
                                    "parts": [
                                        {
                                            "id": "deep-1_smt.a.1",
                                            "name": "subitem",
                                            "prose": "Original subitem a.1",
                                            "parts": [
                                                {
                                                    "id": "deep-1_smt.a.1.i",
                                                    "name": "subsubitem",
                                                    "prose": "Original subsubitem i"
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
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        preview_payload = {
            "profile": {
                "uuid": "88888888-8888-8888-8888-888888888888",
                "metadata": {"title": "Live Preview Deep Alterations", "version": "1.0.0"},
                "imports": [
                    {
                        "href": f"../catalogs/{cat_uuid}.json",
                        "include-all": {}
                    }
                ],
                "modify": {
                    "alters": [
                        {
                            "control-id": "deep-1",
                            # Atomic in-place replacement of deep-1_smt.a.1
                            "removes": [
                                {"by-id": "deep-1_smt.a.1"},
                                {"by-id": "deep-1_smt.a.1.i"}
                            ],
                            "adds": [
                                {
                                    "by-id": "deep-1_smt.a.1",
                                    "position": "after",
                                    "parts": [
                                        {
                                            "id": "deep-1_smt.a.1",
                                            "name": "subitem",
                                            "prose": "Replaced subitem a.1 text"
                                        }
                                    ]
                                },
                                # Targeted addition starting inside deep-1_smt.a
                                {
                                    "by-id": "deep-1_smt.a",
                                    "position": "starting",
                                    "parts": [
                                        {
                                            "id": "deep-1_smt.a.0",
                                            "name": "subitem",
                                            "prose": "Prepended subitem a.0"
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        }

        res = client.post("/api/resolve/profile/preview", json=preview_payload)
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]

        root_smt = ctrl["parts"][0]
        assert root_smt["id"] == "deep-1_smt"

        item_a = root_smt["parts"][0]
        assert item_a["id"] == "deep-1_smt.a"

        # Check children of item_a
        item_a_children = item_a["parts"]
        assert len(item_a_children) == 2
        assert item_a_children[0]["id"] == "deep-1_smt.a.0"
        assert item_a_children[0]["prose"] == "Prepended subitem a.0"

        assert item_a_children[1]["id"] == "deep-1_smt.a.1"
        assert item_a_children[1]["prose"] == "Replaced subitem a.1 text"
        # Removed subsubitem i is gone
        assert "parts" not in item_a_children[1] or len(item_a_children[1]["parts"]) == 0
