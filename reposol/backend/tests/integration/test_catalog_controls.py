"""
Integration tests for Catalog Control management features (US 1.3).
"""
import pytest
from tests.factories import CatalogFactory

class TestCatalogControls:
    def test_us1_3_create_catalog_with_controls(self, client):
        # 1. Create catalog with controls
        doc = CatalogFactory.with_controls()
        uuid = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        # 2. Retrieve and assert control fields
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.status_code == 200
        saved_doc = res_get.json()
        groups = saved_doc["catalog"]["groups"]
        assert len(groups) == 1
        controls = groups[0]["controls"]
        assert len(controls) == 2
        
        # Verify ac-1
        ac1 = next(c for c in controls if c["id"] == "ac-1")
        assert ac1["title"] == "Policy and Procedures"
        assert len(ac1["parts"]) == 2  # statement, guidance
        
        # Verify statement and statement parts
        statement = next(p for p in ac1["parts"] if p["name"] == "statement")
        assert "access control policy" in statement["prose"]
        assert len(statement["parts"]) == 2  # item a, item b
        assert statement["parts"][0]["id"] == "ac-1_smt.a"
        
        # Verify sub-control/enhancement
        sub_controls = ac1.get("controls", [])
        assert len(sub_controls) == 1
        assert sub_controls[0]["id"] == "ac-1.1"
        assert sub_controls[0]["title"] == "Automated Policy Management"

        # Verify ac-2 and custom properties
        ac2 = next(c for c in controls if c["id"] == "ac-2")
        props = ac2.get("props", [])
        assert any(p["name"] == "label" and p["value"] == "AC-2" for p in props)
        assert any(p["name"] == "sort-id" and p["value"] == "ac-02" for p in props)

    def test_us1_3_update_control_properties_and_parts(self, client, saved_catalog):
        doc = CatalogFactory.with_controls()
        uuid, _ = saved_catalog(groups=doc["catalog"]["groups"])

        # 1. Retrieve the existing document
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        controls = doc_to_update["catalog"]["groups"][0]["controls"]
        ac1 = next(c for c in controls if c["id"] == "ac-1")
        
        # Modify the control title
        ac1["title"] = "Updated Access Control Policy"
        
        # Modify the prose of guidance part
        guidance = next(p for p in ac1["parts"] if p["name"] == "guidance")
        guidance["prose"] = "This is updated guidance prose."
        
        # Add a new custom property to ac-1
        ac1.setdefault("props", []).append({
            "name": "custom-prop",
            "value": "custom-value"
        })

        # Save update
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200

        # 2. Retrieve and verify changes
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        updated_controls = updated_doc["catalog"]["groups"][0]["controls"]
        updated_ac1 = next(c for c in updated_controls if c["id"] == "ac-1")
        
        assert updated_ac1["title"] == "Updated Access Control Policy"
        updated_guidance = next(p for p in updated_ac1["parts"] if p["name"] == "guidance")
        assert updated_guidance["prose"] == "This is updated guidance prose."
        assert any(p["name"] == "custom-prop" and p["value"] == "custom-value" for p in updated_ac1["props"])

    def test_us1_3_add_and_delete_enhancement(self, client, saved_catalog):
        doc = CatalogFactory.with_controls()
        uuid, _ = saved_catalog(groups=doc["catalog"]["groups"])

        # 1. Retrieve and add a sub-control (enhancement) to ac-2
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        controls = doc_to_update["catalog"]["groups"][0]["controls"]
        ac2 = next(c for c in controls if c["id"] == "ac-2")
        
        ac2["controls"] = [
            {
                "id": "ac-2.1",
                "title": "Automated Account Locking",
                "parts": [
                    {
                        "id": "ac-2.1_smt",
                        "name": "statement",
                        "prose": "Lock accounts automatically after inactivity."
                    }
                ]
            }
        ]

        # Save
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200

        # 2. Verify addition, then delete the sub-control from ac-1
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        updated_controls = updated_doc["catalog"]["groups"][0]["controls"]
        
        # Verify ac-2.1 is there
        updated_ac2 = next(c for c in updated_controls if c["id"] == "ac-2")
        assert len(updated_ac2["controls"]) == 1
        assert updated_ac2["controls"][0]["id"] == "ac-2.1"

        # Now remove the sub-control from ac-1
        updated_ac1 = next(c for c in updated_controls if c["id"] == "ac-1")
        assert "controls" in updated_ac1
        del updated_ac1["controls"]

        # Save again
        res_put2 = client.post("/api/documents/catalog", json=updated_doc)
        assert res_put2.status_code == 200

        # Verify deletion
        res_final = client.get(f"/api/documents/catalog/{uuid}")
        final_doc = res_final.json()
        final_controls = final_doc["catalog"]["groups"][0]["controls"]
        final_ac1 = next(c for c in final_controls if c["id"] == "ac-1")
        assert "controls" not in final_ac1 or len(final_ac1["controls"]) == 0

    def test_us1_3_invalid_control_structure(self, client):
        # Build catalog with invalid control structure (missing id in control)
        doc = CatalogFactory.build(
            groups=[
                {
                    "id": "ac",
                    "title": "Access Control",
                    "controls": [
                        {
                            "title": "Control with no ID"
                        }
                    ]
                }
            ]
        )
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
