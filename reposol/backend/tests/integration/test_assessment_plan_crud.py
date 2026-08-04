"""
Integration tests for Step 5: Assessment Plan CRUD, Versioning, and Validation.
Tests coverage for US 5.1 through US 5.17.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def create_sample_ap_document(doc_id: str = None, title: str = "Test Assessment Plan", version: str = "1.0.0") -> dict:
    """Helper to construct a valid OSCAL Assessment Plan document."""
    if doc_id is None:
        doc_id = str(uuid.uuid4())
    ssp_id = str(uuid.uuid4())
    return {
        "assessment-plan": {
            "uuid": doc_id,
            "metadata": {
                "title": title,
                "last-modified": "2026-07-30T10:00:00Z",
                "version": version,
                "oscal-version": "1.1.2",
            },
            "import-ssp": {
                "href": f"../ssps/{ssp_id}.json"
            },
            "reviewed-controls": {
                "control-selections": [
                    {
                        "include-all": {}
                    }
                ]
            }
        }
    }


def test_ap_create_and_get(client: TestClient):
    """Test creation and retrieval of an Assessment Plan document (US 5.1, US 5.13)."""
    doc_id = str(uuid.uuid4())
    doc = create_sample_ap_document(doc_id=doc_id, title="Enterprise Audit AP")

    # POST create
    response = client.post("/api/documents/assessment-plan", json=doc)
    assert response.status_code == 201, f"Failed: {response.json()}"
    res_data = response.json()
    assert res_data["assessment-plan"]["uuid"] == doc_id
    assert res_data["assessment-plan"]["metadata"]["title"] == "Enterprise Audit AP"

    # GET list
    list_res = client.get("/api/documents/assessment-plan")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d.get("assessment-plan", {}).get("uuid") == doc_id for d in docs)

    # GET single
    get_res = client.get(f"/api/documents/assessment-plan/{doc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["assessment-plan"]["metadata"]["title"] == "Enterprise Audit AP"


def test_ap_update_and_delete(client: TestClient):
    """Test editing and deleting an Assessment Plan document (US 5.1, US 5.15)."""
    doc_id = str(uuid.uuid4())
    doc = create_sample_ap_document(doc_id=doc_id, title="Initial AP Title")
    res_init = client.post("/api/documents/assessment-plan", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    # Update title
    doc["assessment-plan"]["metadata"]["title"] = "Updated AP Title"
    update_res = client.post("/api/documents/assessment-plan", json=doc)
    assert update_res.status_code in (200, 201)

    # Verify update
    get_res = client.get(f"/api/documents/assessment-plan/{doc_id}")
    assert get_res.json()["assessment-plan"]["metadata"]["title"] == "Updated AP Title"

    # Delete
    del_res = client.delete(f"/api/documents/assessment-plan/{doc_id}")
    assert del_res.status_code == 200

    # Verify 404 after deletion
    get_404 = client.get(f"/api/documents/assessment-plan/{doc_id}")
    assert get_404.status_code == 404


def test_ap_versioning(client: TestClient):
    """Test saving and retrieving document versions for Assessment Plans (US 5.16)."""
    doc_id = str(uuid.uuid4())
    doc = create_sample_ap_document(doc_id=doc_id, title="Versioned AP", version="1.1.0")
    res_init = client.post("/api/documents/assessment-plan", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    # Save version 1.1.0
    v_res = client.post(f"/api/documents/assessment-plan/{doc_id}/versions?remarks=Added+tasks", json=doc)
    assert v_res.status_code in (200, 201), f"Failed: {v_res.json()}"

    # List versions
    list_v = client.get(f"/api/documents/assessment-plan/{doc_id}/versions")
    assert list_v.status_code == 200
    versions = list_v.json()
    assert len(versions) >= 1
    assert any(v["version"] == "1.1.0" for v in versions)


def test_ap_schema_validation(client: TestClient):
    """Test that invalid Assessment Plan structures fail schema validation (DD-002, US 5.12)."""
    invalid_doc = {
        "assessment-plan": {
            "uuid": "invalid-uuid",
            "metadata": {}  # Missing title, version, last-modified
        }
    }
    res = client.post("/api/documents/assessment-plan", json=invalid_doc)
    assert res.status_code in (400, 422)
