"""
Integration tests for Step 7: POA&M Tracker CRUD, Versioning, and Remediation Tracking.
Tests coverage for US 7.1 through US 7.19.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def create_sample_ssp(client: TestClient, title: str = "Prerequisite Target SSP") -> str:
    """Helper to save a valid target System Security Plan in the test store."""
    from tests.factories import SSPFactory
    ssp_id = str(uuid.uuid4())
    doc = SSPFactory.build(doc_id=ssp_id, title=title)
    doc["system-security-plan"]["import-profile"]["href"] = "https://example.com/baselines/nist-800-53.json"
    res = client.post("/api/documents/ssp", json=doc)
    assert res.status_code == 201, f"Failed to create prerequisite SSP: {res.text}"
    return ssp_id


def create_sample_poam_document(doc_id: str = None, ssp_id: str = None, title: str = "Test POA&M", version: str = "1.0.0") -> dict:
    """Helper to construct a valid OSCAL Plan of Action & Milestones document."""
    if doc_id is None:
        doc_id = str(uuid.uuid4())
    if ssp_id is None:
        ssp_id = str(uuid.uuid4())
    poam_item_id = str(uuid.uuid4())

    return {
        "plan-of-action-and-milestones": {
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
            "poam-items": [
                {
                    "uuid": poam_item_id,
                    "title": "Remediate Exposed SSH Port",
                    "description": "Restrict SSH ingress to administrative VPN subnet only"
                }
            ]
        }
    }


def test_poam_create_and_get(client: TestClient):
    """Test creation and retrieval of POA&M document (US 7.1, US 7.4, US 7.15)."""
    ssp_id = create_sample_ssp(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_poam_document(doc_id=doc_id, ssp_id=ssp_id, title="Annual Security POA&M")

    # POST create
    response = client.post("/api/documents/poam", json=doc)
    assert response.status_code == 201, f"Failed: {response.json()}"
    res_data = response.json()
    assert res_data["plan-of-action-and-milestones"]["uuid"] == doc_id
    assert res_data["plan-of-action-and-milestones"]["metadata"]["title"] == "Annual Security POA&M"

    # GET list
    list_res = client.get("/api/documents/poam")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d.get("plan-of-action-and-milestones", {}).get("uuid") == doc_id for d in docs)

    # GET single
    get_res = client.get(f"/api/documents/poam/{doc_id}")
    assert get_res.status_code == 200
    poam_items = get_res.json()["plan-of-action-and-milestones"]["poam-items"]
    assert len(poam_items) == 1
    assert poam_items[0]["title"] == "Remediate Exposed SSH Port"


def test_poam_update_and_delete(client: TestClient):
    """Test updating and deleting POA&M documents (US 7.1, US 7.17)."""
    ssp_id = create_sample_ssp(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_poam_document(doc_id=doc_id, ssp_id=ssp_id, title="Initial POA&M")
    res_init = client.post("/api/documents/poam", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    # Update title
    doc["plan-of-action-and-milestones"]["metadata"]["title"] = "Updated POA&M"
    update_res = client.post("/api/documents/poam", json=doc)
    assert update_res.status_code in (200, 201)

    # Verify update
    get_res = client.get(f"/api/documents/poam/{doc_id}")
    assert get_res.json()["plan-of-action-and-milestones"]["metadata"]["title"] == "Updated POA&M"

    # Delete
    del_res = client.delete(f"/api/documents/poam/{doc_id}")
    assert del_res.status_code == 200

    # 404 check
    assert client.get(f"/api/documents/poam/{doc_id}").status_code == 404


def test_poam_versioning(client: TestClient):
    """Test versioning for POA&M documents (US 7.18)."""
    ssp_id = create_sample_ssp(client)
    doc_id = str(uuid.uuid4())
    doc = create_sample_poam_document(doc_id=doc_id, ssp_id=ssp_id, title="Versioned POA&M", version="2.0.0")
    res_init = client.post("/api/documents/poam", json=doc)
    assert res_init.status_code == 201, f"Failed: {res_init.json()}"

    v_res = client.post(f"/api/documents/poam/{doc_id}/versions?remarks=Major+review", json=doc)
    assert v_res.status_code in (200, 201), f"Failed: {v_res.json()}"

    list_v = client.get(f"/api/documents/poam/{doc_id}/versions")
    assert list_v.status_code == 200
    assert any(v["version"] == "2.0.0" for v in list_v.json())
