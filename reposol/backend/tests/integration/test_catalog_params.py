"""
Integration tests for Catalog Parameter management features (US 1.4).
"""
import pytest
from tests.factories import CatalogFactory

class TestCatalogParams:
    def test_us1_4_create_catalog_with_params(self, client):
        # 1. Create a catalog with parameters
        doc = CatalogFactory.with_controls()
        uuid = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201

        # 2. Retrieve and assert parameter fields
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        assert res_get.status_code == 200
        saved_doc = res_get.json()
        controls = saved_doc["catalog"]["groups"][0]["controls"]
        
        # Verify ac-2 params
        ac2 = next(c for c in controls if c["id"] == "ac-2")
        params = ac2["params"]
        assert len(params) == 3

        # Parameter 1: Constraint and Guidelines
        p1 = next(p for p in params if p["id"] == "ac-2_prm_1")
        assert p1["label"] == "review frequency"
        assert p1["values"] == ["90 days"]
        assert len(p1["constraints"]) == 1
        assert p1["constraints"][0]["tests"][0]["expression"] == "^[0-9]+ (days|months)$"
        assert p1["guidelines"][0]["prose"] == "Enter the review frequency in days or months."

        # Parameter 2: Select choices
        p2 = next(p for p in params if p["id"] == "ac-2_prm_2")
        assert p2["label"] == "inactivity action"
        assert p2["select"]["how-many"] == "one"
        assert p2["select"]["choice"] == ["disable", "delete", "warn"]

    def test_us1_4_update_param_attributes(self, client, saved_catalog):
        doc = CatalogFactory.with_controls()
        uuid, _ = saved_catalog(groups=doc["catalog"]["groups"])

        # 1. Retrieve and modify parameter properties
        res_get = client.get(f"/api/documents/catalog/{uuid}")
        doc_to_update = res_get.json()
        controls = doc_to_update["catalog"]["groups"][0]["controls"]
        ac2 = next(c for c in controls if c["id"] == "ac-2")
        params = ac2["params"]

        p1 = next(p for p in params if p["id"] == "ac-2_prm_1")
        p1["values"] = ["180 days"]
        p1["constraints"][0]["tests"][0]["expression"] = "^[0-9]+ days$"
        p1["guidelines"][0]["prose"] = "Enter review frequency strictly in days."

        p2 = next(p for p in params if p["id"] == "ac-2_prm_2")
        p2["select"]["choice"].append("suspend")

        # Save update
        res_put = client.post("/api/documents/catalog", json=doc_to_update)
        assert res_put.status_code == 200

        # 2. Retrieve and verify
        res_verify = client.get(f"/api/documents/catalog/{uuid}")
        updated_doc = res_verify.json()
        updated_controls = updated_doc["catalog"]["groups"][0]["controls"]
        updated_ac2 = next(c for c in updated_controls if c["id"] == "ac-2")
        updated_params = updated_ac2["params"]

        updated_p1 = next(p for p in updated_params if p["id"] == "ac-2_prm_1")
        assert updated_p1["values"] == ["180 days"]
        assert updated_p1["constraints"][0]["tests"][0]["expression"] == "^[0-9]+ days$"
        assert updated_p1["guidelines"][0]["prose"] == "Enter review frequency strictly in days."

        updated_p2 = next(p for p in updated_params if p["id"] == "ac-2_prm_2")
        assert "suspend" in updated_p2["select"]["choice"]

    def test_us1_4_invalid_param_structure(self, client):
        # Build catalog with invalid parameter structure (invalid select how-many choice)
        doc = CatalogFactory.build(
            controls=[
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [
                        {
                            "id": "param-1",
                            "select": {
                                "how-many": "invalid-many-value",  # Invalid enum value
                                "choice": ["a", "b"]
                            }
                        }
                    ]
                }
            ]
        )
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 400
        assert "validation failed" in res.json()["detail"].lower()
