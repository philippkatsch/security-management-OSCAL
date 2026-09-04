"""
Integration test for Diamond Dependency Profile Resolution (R7-04).
Diamond Topology:
         Profile A (Top)
          /           \
   Profile B         Profile C
          \           /
         Catalog D (Base)
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory


class TestProfileDiamondResolution:
    def test_diamond_dependency_profile_resolution_selective_branches(self, client, isolated_data_dir):
        # 1. Base Catalog D: defines controls ac-1, ac-2 and parameters
        cat_d_doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {"id": "ac-1_prm_1", "label": "Session Timeout", "values": ["30"]}
                    ],
                    "parts": [
                        {"id": "ac-1_smt", "name": "statement", "prose": "Base statement for AC-1."}
                    ]
                },
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "params": [
                        {"id": "ac-2_prm_1", "label": "Review Frequency", "values": ["annually"]}
                    ],
                    "parts": [
                        {"id": "ac-2_smt", "name": "statement", "prose": "Base statement for AC-2."}
                    ]
                }
            ]
        )
        cat_d_uuid = cat_d_doc["catalog"]["uuid"]
        res_cat = client.post("/api/documents/catalogs", json=cat_d_doc)
        assert res_cat.status_code in [200, 201]

        # 2. Profile B: Imports Catalog D, includes ac-1, alters ac-1 and overrides ac-1_prm_1
        prof_b_doc = ProfileFactory.build()
        prof_b_uuid = prof_b_doc["profile"]["uuid"]
        prof_b_doc["profile"]["metadata"]["title"] = "Profile B (Branch B)"
        prof_b_doc["profile"]["imports"] = [
            {"href": f"#{cat_d_uuid}", "include-controls": [{"with-ids": ["ac-1"]}]}
        ]
        prof_b_doc["profile"]["modify"] = {
            "set-parameters": [
                {"param-id": "ac-1_prm_1", "values": ["15"], "label": "Tailored 15m"}
            ],
            "alters": [
                {
                    "control-id": "ac-1",
                    "adds": [
                        {
                            "position": "ending",
                            "parts": [
                                {"id": "ac-1_b_addition", "name": "guidance", "prose": "Guidance from Profile B."}
                            ]
                        }
                    ]
                }
            ]
        }
        res_b = client.post("/api/documents/profiles", json=prof_b_doc)
        assert res_b.status_code in [200, 201]

        # 3. Profile C: Imports Catalog D, includes ac-2, alters ac-2 and overrides ac-2_prm_1
        prof_c_doc = ProfileFactory.build()
        prof_c_uuid = prof_c_doc["profile"]["uuid"]
        prof_c_doc["profile"]["metadata"]["title"] = "Profile C (Branch C)"
        prof_c_doc["profile"]["imports"] = [
            {"href": f"#{cat_d_uuid}", "include-controls": [{"with-ids": ["ac-2"]}]}
        ]
        prof_c_doc["profile"]["modify"] = {
            "set-parameters": [
                {"param-id": "ac-2_prm_1", "values": ["semi-annually"]}
            ],
            "alters": [
                {
                    "control-id": "ac-2",
                    "adds": [
                        {
                            "position": "ending",
                            "parts": [
                                {"id": "ac-2_c_addition", "name": "guidance", "prose": "Guidance from Profile C."}
                            ]
                        }
                    ]
                }
            ]
        }
        res_c = client.post("/api/documents/profiles", json=prof_c_doc)
        assert res_c.status_code in [200, 201]

        # 4. Profile A: Top-level profile importing Profile B and Profile C (Diamond)
        prof_a_doc = ProfileFactory.build()
        prof_a_uuid = prof_a_doc["profile"]["uuid"]
        prof_a_doc["profile"]["metadata"]["title"] = "Profile A (Diamond Top)"
        prof_a_doc["profile"]["imports"] = [
            {"href": f"#{prof_b_uuid}", "include-all": {}},
            {"href": f"#{prof_c_uuid}", "include-all": {}}
        ]
        prof_a_doc["profile"]["merge"] = {"as-is": True}
        res_a = client.post("/api/documents/profiles", json=prof_a_doc)
        assert res_a.status_code in [200, 201]

        # 5. Resolve Top-Level Profile A
        res_resolve = client.get(f"/api/resolve/profile/{prof_a_uuid}")
        assert res_resolve.status_code == 200
        resolved_catalog = res_resolve.json()

        # 6. Assertions on Diamond Resolved Output
        assert resolved_catalog is not None
        controls = resolved_catalog.get("controls", [])
        
        all_resolved_controls = []
        def collect_controls(items):
            for item in items:
                if "controls" in item:
                    all_resolved_controls.extend(item["controls"])
                if "groups" in item:
                    collect_controls(item["groups"])
        if controls:
            all_resolved_controls.extend(controls)
        if "groups" in resolved_catalog:
            collect_controls(resolved_catalog["groups"])

        control_map = {c["id"]: c for c in all_resolved_controls}
        
        # Both controls must be present exactly once without duplicates
        assert "ac-1" in control_map
        assert "ac-2" in control_map

        # Verify ac-1 has Profile B's tailored parameter and alter
        ac1 = control_map["ac-1"]
        ac1_param = next((p for p in ac1.get("params", []) if p.get("id") == "ac-1_prm_1"), None)
        assert ac1_param is not None
        assert ac1_param.get("values") == ["15"]

        # Verify ac-2 has Profile C's tailored parameter and alter
        ac2 = control_map["ac-2"]
        ac2_param = next((p for p in ac2.get("params", []) if p.get("id") == "ac-2_prm_1"), None)
        assert ac2_param is not None
        assert ac2_param.get("values") == ["semi-annually"]
