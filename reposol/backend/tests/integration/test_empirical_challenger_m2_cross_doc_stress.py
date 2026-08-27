"""
Empirical Challenger M2.2 Stress Suite: Cross-Document Workflows & Multi-Format Profile Export.
Targeting:
- Lossless JSON/YAML/XML profile export with XML escaping & Unicode
- Deep multi-tier chained profile parameter cascades
- Dynamic multi-catalog import inclusion/exclusion/matching resolution
- Recursive part alters in custom/flat/as-is merge structuring
- Non-existent import references & boundary validation
"""
import pytest
import xml.etree.ElementTree as ET
import yaml
import json
from tests.factories import CatalogFactory, ProfileFactory


class TestEmpiricalChallengerM2CrossDocStress:

    def test_challenge_1_profile_export_xml_escaping_and_unicode(self, client, isolated_data_dir):
        """
        Challenge 1: Lossless multi-format export of profiles containing special XML entities,
        quotes, ampersands, angle brackets, and multi-byte Unicode.
        """
        special_prose = "Policy: Must enforce TLS >= 1.3 & AES-256-GCM <standard> 'strict' \"mode\" \u2014 \u00dcberpr\u00fcfung \u2705 \u65e5\u672c\u8a9e"
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "sec-1",
                "title": "Security & Privacy <Base>",
                "params": [{"id": "prm_algo", "values": ["AES & RSA > 2048"]}],
                "parts": [{"id": "sec-1_smt", "name": "statement", "prose": special_prose}]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            title="Profile with Special <Entities> & 'Quotes' \u00c4\u00d6\u00dc",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={
                "set-parameters": [
                    {"param-id": "prm_algo", "values": ["ECDSA-P384 & Ed25519 <strict>"]}
                ],
                "alters": [
                    {
                        "control-id": "sec-1",
                        "adds": [
                            {
                                "position": "ending",
                                "parts": [
                                    {
                                        "id": "sec-1_ext",
                                        "name": "guidance",
                                        "prose": "Guidance with <b>HTML-like</b> markup & XML special chars: <>&\"'"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        res_create = client.post("/api/documents/profiles", json=prof_doc)
        assert res_create.status_code == 201

        # 1. Test JSON Export
        res_json = client.get(f"/api/export/profiles/{prof_uuid}?format=json")
        assert res_json.status_code == 200
        assert res_json.headers["content-type"] == "application/json"
        data_json = res_json.json()
        assert data_json["profile"]["metadata"]["title"] == "Profile with Special <Entities> & 'Quotes' \u00c4\u00d6\u00dc"
        assert data_json["profile"]["modify"]["set-parameters"][0]["values"] == ["ECDSA-P384 & Ed25519 <strict>"]

        # 2. Test YAML Export
        res_yaml = client.get(f"/api/export/profiles/{prof_uuid}?format=yaml")
        assert res_yaml.status_code == 200
        data_yaml = yaml.safe_load(res_yaml.text)
        assert data_yaml["profile"]["metadata"]["title"] == "Profile with Special <Entities> & 'Quotes' \u00c4\u00d6\u00dc"
        assert data_yaml["profile"]["modify"]["set-parameters"][0]["values"] == ["ECDSA-P384 & Ed25519 <strict>"]

        # 3. Test XML Export
        res_xml = client.get(f"/api/export/profiles/{prof_uuid}?format=xml")
        assert res_xml.status_code == 200
        assert "xml" in res_xml.headers["content-type"]
        root = ET.fromstring(res_xml.text)
        assert "profile" in root.tag

    def test_challenge_2_three_tier_chained_profile_parameter_cascade(self, client, isolated_data_dir):
        """
        Challenge 2: Deep 3-tier chained profile cascade with overriding parameter precedence.
        Catalog -> Profile A -> Profile B -> Profile C
        """
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "params": [
                    {"id": "prm_1", "values": ["prm1_cat"]},
                    {"id": "prm_2", "values": ["prm2_cat"]},
                    {"id": "prm_3", "values": ["prm3_cat"]}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Profile A overrides prm_1, prm_2
        prof_a = ProfileFactory.build(
            title="Tier 1 Profile A",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            modify={"set-parameters": [{"param-id": "prm_1", "values": ["prm1_A"]}, {"param-id": "prm_2", "values": ["prm2_A"]}]}
        )
        prof_a_uuid = prof_a["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_a)

        # Profile B (imports A) overrides prm_2, prm_3
        prof_b = ProfileFactory.build(
            title="Tier 2 Profile B",
            imports=[{"href": f"../profiles/{prof_a_uuid}.json", "include-all": {}}],
            modify={"set-parameters": [{"param-id": "prm_2", "values": ["prm2_B"]}, {"param-id": "prm_3", "values": ["prm3_B"]}]}
        )
        prof_b_uuid = prof_b["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_b)

        # Profile C (imports B) overrides prm_1
        prof_c = ProfileFactory.build(
            title="Tier 3 Profile C",
            imports=[{"href": f"../profiles/{prof_b_uuid}.json", "include-all": {}}],
            modify={"set-parameters": [{"param-id": "prm_1", "values": ["prm1_C"]}]}
        )
        prof_c_uuid = prof_c["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_c)

        # Resolve Profile C
        res = client.get(f"/api/resolve/profile/{prof_c_uuid}")
        assert res.status_code == 200
        ctrl = res.json()["controls"][0]
        params = {p["id"]: p.get("values") for p in ctrl.get("params", [])}

        # Expected resolution:
        # prm_1 overridden by Profile C -> ["prm1_C"]
        # prm_2 overridden by Profile B -> ["prm2_B"]
        # prm_3 overridden by Profile B -> ["prm3_B"]
        assert params.get("prm_1") == ["prm1_C"]
        assert params.get("prm_2") == ["prm2_B"]
        assert params.get("prm_3") == ["prm3_B"]

    def test_challenge_3_multi_catalog_import_with_matching_and_exclusions(self, client, isolated_data_dir):
        """
        Challenge 3: Complex multi-catalog import combining wildcard matching with explicit exclusions.
        """
        cat1 = CatalogFactory.build(
            controls=[
                {"id": "ac-1", "title": "Access Control 1"},
                {"id": "ac-2", "title": "Access Control 2"},
                {"id": "ia-1", "title": "Ident 1"}
            ]
        )
        cat2 = CatalogFactory.build(
            controls=[
                {"id": "si-1", "title": "System Integrity 1"},
                {"id": "si-2", "title": "System Integrity 2"},
                {"id": "ac-1", "title": "Access Control 1 Duplicate"}
            ]
        )
        cat1_uuid = cat1["catalog"]["uuid"]
        cat2_uuid = cat2["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat1)
        client.post("/api/documents/catalogs", json=cat2)

        prof = ProfileFactory.build(
            title="Multi-Catalog Matching Profile",
            imports=[
                {
                    "href": f"../catalogs/{cat1_uuid}.json",
                    "include-controls": [{"matching": [{"pattern": "ac-*"}]}]
                },
                {
                    "href": f"../catalogs/{cat2_uuid}.json",
                    "include-controls": [{"with-ids": ["si-1", "ac-1"]}],
                    "exclude-controls": [{"with-ids": ["ac-1"]}]
                }
            ],
            merge={"combine": {"method": "use-first"}}
        )
        prof_uuid = prof["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof)

        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res.status_code == 200
        data = res.json()
        ctrl_ids = {c["id"] for c in data["controls"]}

        # Expect: ac-1 (from cat1), ac-2 (from cat1), si-1 (from cat2)
        # Excluded: ia-1 (not matching ac-*), si-2 (not in include-controls), ac-1 from cat2 (in exclude-controls)
        assert ctrl_ids == {"ac-1", "ac-2", "si-1"}

    def test_challenge_4_recursive_alter_persistence_in_custom_structuring(self, client, isolated_data_dir):
        """
        Challenge 4: Verify that statement alters are correctly applied when the profile uses
        custom grouping mode with insert-controls directives.
        """
        cat_doc = CatalogFactory.build(
            controls=[{
                "id": "ac-1",
                "title": "Access Control",
                "parts": [
                    {"id": "p-1", "name": "statement", "prose": "Initial statement."}
                ]
            }]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        prof_doc = ProfileFactory.build(
            title="Custom Structuring with Alters",
            imports=[{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}],
            merge={
                "custom": {
                    "groups": [
                        {
                            "id": "custom-group-1",
                            "title": "Custom Tailored Family",
                            "insert-controls": [{"include-controls": [{"with-ids": ["ac-1"]}]}]
                        }
                    ]
                }
            },
            modify={
                "alters": [
                    {
                        "control-id": "ac-1",
                        "adds": [
                            {
                                "position": "ending",
                                "parts": [
                                    {"id": "p-2", "name": "guidance", "prose": "Custom group guidance note."}
                                ]
                            }
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
        group = data["groups"][0]
        assert group["id"] == "custom-group-1"
        assert len(group["controls"]) == 1
        ctrl = group["controls"][0]
        assert ctrl["id"] == "ac-1"
        part_ids = [p["id"] for p in ctrl.get("parts", [])]
        assert "p-1" in part_ids
        assert "p-2" in part_ids

    def test_challenge_5_invalid_or_missing_import_graceful_handling(self, client, isolated_data_dir):
        """
        Challenge 5: Verify that resolving a profile with an invalid/missing catalog reference
        returns a clear error or handled response rather than an unhandled 500 server crash.
        """
        missing_uuid = "00000000-0000-0000-0000-000000000000"
        prof_doc = ProfileFactory.build(
            title="Orphaned Import Profile",
            imports=[{"href": f"../catalogs/{missing_uuid}.json", "include-all": {}}]
        )
        prof_uuid = prof_doc["profile"]["uuid"]
        client.post("/api/documents/profiles", json=prof_doc)

        # Profile resolution should handle missing imports cleanly (e.g. 404 or empty catalog or 422)
        res = client.get(f"/api/resolve/profile/{prof_uuid}")
        # Ensure it doesn't return unhandled 500 internal server error
        assert res.status_code in (200, 400, 404, 422)
