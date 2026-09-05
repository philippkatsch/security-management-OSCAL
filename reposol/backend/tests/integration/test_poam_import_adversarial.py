"""
Adversarial Stress Test Suite for AR-to-POA&M Findings Import Bridge.
Tests edge cases, boundary conditions, empty selections, missing references, and schema validity.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


def make_ar_doc(
    ar_id: str,
    findings: list = None,
    observations: list = None,
    risks: list = None,
) -> dict:
    """Utility to build a valid OSCAL AR document."""
    res_obj = {
        "uuid": str(uuid.uuid4()),
        "title": "Adversarial Test Result",
        "description": "Assessment execution result summary",
        "start": "2026-08-01T00:00:00Z",
        "reviewed-controls": {
            "control-selections": [
                {
                    "include-all": {}
                }
            ]
        },
    }
    if observations is not None:
        res_obj["observations"] = observations
    if risks is not None:
        res_obj["risks"] = risks
    if findings is not None:
        res_obj["findings"] = findings

    return {
        "assessment-results": {
            "uuid": ar_id,
            "metadata": {
                "title": "Adversarial Assessment Results",
                "last-modified": "2026-08-10T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "import-ap": {
                "href": "../assessment-plans/ap-test.json"
            },
            "results": [res_obj],
        }
    }


def make_poam_doc(poam_id: str) -> dict:
    """Utility to build a baseline POA&M document."""
    return {
        "plan-of-action-and-milestones": {
            "uuid": poam_id,
            "metadata": {
                "title": "Adversarial Target POA&M",
                "last-modified": "2026-08-10T10:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "import-ssp": {
                "href": "../ssps/ssp-test.json"
            },
            "poam-items": [
                {
                    "uuid": str(uuid.uuid4()),
                    "title": "Initial Baseline Item",
                    "description": "Baseline item"
                }
            ]
        }
    }


def make_valid_finding(f_id: str, status_state: str = "not-satisfied", obs_ids: list = None, risk_ids: list = None) -> dict:
    """Creates a schema-valid OSCAL finding."""
    f = {
        "uuid": f_id,
        "title": f"Test Finding {f_id[:8]}",
        "description": f"Description for finding {f_id}",
        "target": {
            "type": "statement-id",
            "target-id": "ac-2_smt",
            "status": {
                "state": status_state
            }
        }
    }
    if obs_ids:
        f["related-observations"] = [{"observation-uuid": oid} for oid in obs_ids]
    if risk_ids:
        f["related-risks"] = [{"risk-uuid": rid} for rid in risk_ids]
    return f


def test_import_empty_finding_uuids_list_bug(client: TestClient):
    """
    BUG TEST: When client passes finding_uuids = [] (empty list),
    the endpoint SHOULD import 0 findings.
    """
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        findings=[make_valid_finding(f1_id, "not-satisfied")]
    )
    poam_doc = make_poam_doc(poam_id)

    res_ar = client.post("/api/documents/assessment-results", json=ar_doc)
    assert res_ar.status_code == 201, f"Failed AR save: {res_ar.json()}"
    res_poam = client.post("/api/documents/poam", json=poam_doc)
    assert res_poam.status_code == 201, f"Failed POAM save: {res_poam.json()}"

    # Client requests import with EMPTY list finding_uuids=[]
    res = client.post(
        f"/api/documents/poams/{poam_id}/import-findings/{ar_id}",
        json={"finding_uuids": []}
    )
    assert res.status_code == 200, f"Import endpoint error: {res.json()}"
    body = res.json()

    # EXPECTATION: 0 findings imported because user passed empty list []
    # BUG: If finding_uuids is [] python does `set([]) if [] else None` -> None -> imports ALL findings!
    assert body["imported_findings_count"] == 0, (
        f"BUG CONFIRMED: Passing finding_uuids=[] imported {body['imported_findings_count']} findings "
        f"instead of 0 findings!"
    )


def test_import_ar_zero_findings(client: TestClient):
    """Test AR document containing zero findings."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(ar_id=ar_id, findings=[])
    poam_doc = make_poam_doc(poam_id)

    res_ar = client.post("/api/documents/assessment-results", json=ar_doc)
    assert res_ar.status_code == 201
    res_poam = client.post("/api/documents/poam", json=poam_doc)
    assert res_poam.status_code == 201

    res = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["imported_findings_count"] == 0
    assert body["imported_observations_count"] == 0
    assert body["imported_risks_count"] == 0


def test_import_ar_all_satisfied_findings(client: TestClient):
    """Test AR document where all findings are satisfied."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    f2_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        findings=[
            make_valid_finding(f1_id, "satisfied"),
            make_valid_finding(f2_id, "satisfied")
        ]
    )
    poam_doc = make_poam_doc(poam_id)

    res_ar = client.post("/api/documents/assessment-results", json=ar_doc)
    assert res_ar.status_code == 201
    res_poam = client.post("/api/documents/poam", json=poam_doc)
    assert res_poam.status_code == 201

    res = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["imported_findings_count"] == 0


def test_import_unknown_finding_uuids(client: TestClient):
    """Test request containing only unknown finding UUIDs."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        findings=[make_valid_finding(f1_id, "not-satisfied")]
    )
    poam_doc = make_poam_doc(poam_id)

    client.post("/api/documents/assessment-results", json=ar_doc)
    client.post("/api/documents/poam", json=poam_doc)

    res = client.post(
        f"/api/documents/poams/{poam_id}/import-findings/{ar_id}",
        json={"finding_uuids": [str(uuid.uuid4())]}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported_findings_count"] == 0


def test_import_missing_observation_and_risk_refs(client: TestClient):
    """
    Test finding pointing to observation-uuid and risk-uuid that do NOT exist in AR observations/risks lists.
    Demonstrates that related-observations and related-risks are blindly copied into poam-item,
    creating dangling references in the target POA&M.
    """
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    missing_obs_id = str(uuid.uuid4())
    missing_risk_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        observations=[],  # No obs defined
        risks=[],         # No risks defined
        findings=[make_valid_finding(f1_id, "not-satisfied", obs_ids=[missing_obs_id], risk_ids=[missing_risk_id])]
    )
    poam_doc = make_poam_doc(poam_id)

    from app.repositories.document_repository import save_document as repo_save_doc
    import asyncio
    asyncio.run(repo_save_doc("assessment-results", ar_id, ar_doc))
    res_poam = client.post("/api/documents/poam", json=poam_doc)
    assert res_poam.status_code == 201

    res = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["imported_findings_count"] == 1
    assert body["imported_observations_count"] == 0
    assert body["imported_risks_count"] == 0

    poam = body["document"]["plan-of-action-and-milestones"]
    # 1 initial baseline + 1 imported = 2 items
    assert len(poam["poam-items"]) == 2
    imported_item = [it for it in poam["poam-items"] if it.get("uuid") != poam_doc["plan-of-action-and-milestones"]["poam-items"][0]["uuid"]][0]
    assert imported_item["related-findings"] == [{"finding-uuid": f1_id}]

    # Confirm dangling references in item:
    poam_obs_ids = {o["uuid"] for o in poam.get("observations", [])}
    poam_risk_ids = {r["uuid"] for r in poam.get("risks", [])}
    assert missing_obs_id not in poam_obs_ids
    assert missing_risk_id not in poam_risk_ids


def test_import_findings_duplicate_across_poams(client: TestClient):
    """
    Test importing the same AR findings into two different POA&M documents.
    """
    ar_id = str(uuid.uuid4())
    poam_id1 = str(uuid.uuid4())
    poam_id2 = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    obs_id = str(uuid.uuid4())

    obs_obj = {
        "uuid": obs_id,
        "title": "Shared Obs",
        "description": "Shared observation description",
        "methods": ["examine"],
        "types": ["ssp-statement-issue"],
        "collected": "2026-08-01T10:00:00Z"
    }

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        observations=[obs_obj],
        findings=[make_valid_finding(f1_id, "not-satisfied", obs_ids=[obs_id])]
    )
    poam_doc1 = make_poam_doc(poam_id1)
    poam_doc2 = make_poam_doc(poam_id2)

    res_ar = client.post("/api/documents/assessment-results", json=ar_doc)
    assert res_ar.status_code == 201, f"Failed AR save: {res_ar.json()}"
    res_p1 = client.post("/api/documents/poam", json=poam_doc1)
    assert res_p1.status_code == 201, f"Failed POAM 1 save: {res_p1.json()}"
    res_p2 = client.post("/api/documents/poam", json=poam_doc2)
    assert res_p2.status_code == 201, f"Failed POAM 2 save: {res_p2.json()}"

    # Import into POA&M 1
    res1 = client.post(f"/api/documents/poams/{poam_id1}/import-findings/{ar_id}")
    assert res1.status_code == 200
    assert res1.json()["imported_findings_count"] == 1

    # Import into POA&M 2
    res2 = client.post(f"/api/documents/poams/{poam_id2}/import-findings/{ar_id}")
    assert res2.status_code == 200
    assert res2.json()["imported_findings_count"] == 1


def test_import_selective_finding_uuids(client: TestClient):
    """Test importing a selective subset of finding UUIDs."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())
    f2_id = str(uuid.uuid4())
    f3_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        findings=[
            make_valid_finding(f1_id, "not-satisfied"),
            make_valid_finding(f2_id, "not-satisfied"),
            make_valid_finding(f3_id, "not-satisfied"),
        ]
    )
    poam_doc = make_poam_doc(poam_id)

    client.post("/api/documents/assessment-results", json=ar_doc)
    client.post("/api/documents/poam", json=poam_doc)

    # Pass only f1_id and f3_id
    res = client.post(
        f"/api/documents/poams/{poam_id}/import-findings/{ar_id}",
        json={"finding_uuids": [f1_id, f3_id]}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported_findings_count"] == 2

    # Verify poam-items in saved doc relate only to f1_id and f3_id
    poam = body["document"]["plan-of-action-and-milestones"]
    items = poam["poam-items"]
    imported_findings_refs = [
        ref["finding-uuid"]
        for item in items
        for ref in item.get("related-findings", [])
    ]
    assert f1_id in imported_findings_refs
    assert f3_id in imported_findings_refs
    assert f2_id not in imported_findings_refs


def test_import_non_existent_poam_id(client: TestClient):
    """Test import with non-existent poam_id returns 404."""
    ar_id = str(uuid.uuid4())
    fake_poam_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(ar_id=ar_id, findings=[make_valid_finding(str(uuid.uuid4()), "not-satisfied")])
    client.post("/api/documents/assessment-results", json=ar_doc)

    res = client.post(f"/api/documents/poams/{fake_poam_id}/import-findings/{ar_id}")
    assert res.status_code == 404
    assert f"POA&M document '{fake_poam_id}' not found" in res.json()["detail"]


def test_import_non_existent_ar_id(client: TestClient):
    """Test import with non-existent ar_id returns 404."""
    poam_id = str(uuid.uuid4())
    fake_ar_id = str(uuid.uuid4())

    poam_doc = make_poam_doc(poam_id)
    client.post("/api/documents/poam", json=poam_doc)

    res = client.post(f"/api/documents/poams/{poam_id}/import-findings/{fake_ar_id}")
    assert res.status_code == 404
    assert f"Assessment Results document '{fake_ar_id}' not found" in res.json()["detail"]


def test_import_invalid_uuid_format(client: TestClient):
    """Test import with invalid UUID strings returns 400."""
    valid_id = str(uuid.uuid4())
    res1 = client.post(f"/api/documents/poams/invalid-uuid-123/import-findings/{valid_id}")
    assert res1.status_code == 400

    res2 = client.post(f"/api/documents/poams/{valid_id}/import-findings/invalid-uuid-456")
    assert res2.status_code == 400


def test_import_duplicate_uuids_in_request(client: TestClient):
    """Test passing duplicate UUIDs in the request finding_uuids array."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        findings=[make_valid_finding(f1_id, "not-satisfied")]
    )
    poam_doc = make_poam_doc(poam_id)

    client.post("/api/documents/assessment-results", json=ar_doc)
    client.post("/api/documents/poam", json=poam_doc)

    res = client.post(
        f"/api/documents/poams/{poam_id}/import-findings/{ar_id}",
        json={"finding_uuids": [f1_id, f1_id, f1_id]}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["imported_findings_count"] == 1


def test_import_reimport_idempotence(client: TestClient):
    """Test that importing findings a second time is idempotent (0 findings re-imported)."""
    ar_id = str(uuid.uuid4())
    poam_id = str(uuid.uuid4())
    f1_id = str(uuid.uuid4())

    ar_doc = make_ar_doc(
        ar_id=ar_id,
        findings=[make_valid_finding(f1_id, "not-satisfied")]
    )
    poam_doc = make_poam_doc(poam_id)

    client.post("/api/documents/assessment-results", json=ar_doc)
    client.post("/api/documents/poam", json=poam_doc)

    # First import
    res1 = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res1.status_code == 200
    assert res1.json()["imported_findings_count"] == 1

    # Second import (re-import)
    res2 = client.post(f"/api/documents/poams/{poam_id}/import-findings/{ar_id}")
    assert res2.status_code == 200
    assert res2.json()["imported_findings_count"] == 0

