"""
Integration tests for Step 8: Control Mapping CRUD, Versioning, and Relationship Rules.
Tests coverage for US 8.1 through US 8.17.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def create_sample_mapping_document(doc_id: str = None, title: str = "Test Control Mapping", version: str = "1.0.0") -> dict:
    """Helper to construct a valid OSCAL Control Mapping (mapping-collection) document."""
    if doc_id is None:
        doc_id = str(uuid.uuid4())
    src_cat_id = str(uuid.uuid4())
    tgt_cat_id = str(uuid.uuid4())
    mapping_id = str(uuid.uuid4())
    map_entry_id = str(uuid.uuid4())

    return {
        "mapping-collection": {
            "uuid": doc_id,
            "metadata": {
                "title": title,
                "last-modified": "2026-07-30T10:00:00Z",
                "version": version,
                "oscal-version": "1.1.2",
            },
            "mappings": [
                {
                    "uuid": mapping_id,
                    "source-resource": {
                        "type": "catalog",
                        "href": f"../catalogs/{src_cat_id}.json"
                    },
                    "target-resource": {
                        "type": "catalog",
                        "href": f"../catalogs/{tgt_cat_id}.json"
                    },
                    "maps": [
                        {
                            "uuid": map_entry_id,
                            "relationship": "subset-of",
                            "sources": [
                                {
                                    "type": "control",
                                    "id-ref": "ac-1"
                                }
                            ],
                            "targets": [
                                {
                                    "type": "control",
                                    "id-ref": "A.5.1"
                                }
                            ],
                            "remarks": "Policy and procedure alignment"
                        }
                    ]
                }
            ]
        }
    }


def test_control_mapping_create_and_get(client: TestClient):
    """Test creation and retrieval of Control Mapping collection (US 8.1, US 8.4, US 8.13)."""
    doc_id = str(uuid.uuid4())
    doc = create_sample_mapping_document(doc_id=doc_id, title="NIST 800-53 to ISO 27001 Mapping")

    # POST create
    response = client.post("/api/documents/control-mapping", json=doc)
    assert response.status_code == 201, f"Failed: {response.json()}"
    res_data = response.json()
    assert res_data["mapping-collection"]["uuid"] == doc_id
    assert res_data["mapping-collection"]["metadata"]["title"] == "NIST 800-53 to ISO 27001 Mapping"

    # GET list
    list_res = client.get("/api/documents/control-mapping")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d.get("mapping-collection", {}).get("uuid") == doc_id for d in docs)

    # GET single
    get_res = client.get(f"/api/documents/control-mapping/{doc_id}")
    assert get_res.status_code == 200
    mappings = get_res.json()["mapping-collection"]["mappings"]
    assert len(mappings) == 1
    assert mappings[0]["maps"][0]["relationship"] == "subset-of"


def test_control_mapping_update_and_delete(client: TestClient):
    """Test updating and deleting Control Mapping documents (US 8.1, US 8.15)."""
    doc_id = str(uuid.uuid4())
    doc = create_sample_mapping_document(doc_id=doc_id, title="Initial Mapping")
    res_init = client.post("/api/documents/control-mapping", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    # Update
    doc["mapping-collection"]["metadata"]["title"] = "Updated Mapping Title"
    update_res = client.post("/api/documents/control-mapping", json=doc)
    assert update_res.status_code in (200, 201)

    # Verify update
    get_res = client.get(f"/api/documents/control-mapping/{doc_id}")
    assert get_res.json()["mapping-collection"]["metadata"]["title"] == "Updated Mapping Title"

    # Delete
    del_res = client.delete(f"/api/documents/control-mapping/{doc_id}")
    assert del_res.status_code == 200

    # 404 check
    assert client.get(f"/api/documents/control-mapping/{doc_id}").status_code == 404


def test_control_mapping_versioning(client: TestClient):
    """Test versioning for Control Mapping documents (US 8.16)."""
    doc_id = str(uuid.uuid4())
    doc = create_sample_mapping_document(doc_id=doc_id, title="Versioned Mapping", version="1.1.0")
    res_init = client.post("/api/documents/control-mapping", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    v_res = client.post(f"/api/documents/control-mapping/{doc_id}/versions?remarks=Updated+crosswalk", json=doc)
    assert v_res.status_code in (200, 201), f"Failed: {v_res.json()}"

    list_v = client.get(f"/api/documents/control-mapping/{doc_id}/versions")
    assert list_v.status_code == 200
    assert any(v["version"] == "1.1.0" for v in list_v.json())
