import pytest
import os
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.storage import get_stage_dir

client = TestClient(app)

def test_api_setup_stress_across_all_8_stages():
    """Verify document creation, retrieval, and disk deletion for all 8 OSCAL stages via API endpoints."""
    ws_id = f"pytest-stress-{uuid.uuid4()}"
    headers = {"X-Workspace-ID": ws_id}

    cat_uuid = str(uuid.uuid4())
    prof_uuid = str(uuid.uuid4())
    comp_uuid = str(uuid.uuid4())
    ssp_uuid = str(uuid.uuid4())
    ap_uuid = str(uuid.uuid4())
    ar_uuid = str(uuid.uuid4())
    poam_uuid = str(uuid.uuid4())
    map_uuid = str(uuid.uuid4())

    stage_specs = [
        ("catalog", "catalogs", cat_uuid, {
            "catalog": {
                "uuid": cat_uuid,
                "metadata": {"title": "Test Cat", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"}
            }
        }),
        ("profile", "profiles", prof_uuid, {
            "profile": {
                "uuid": prof_uuid,
                "metadata": {"title": "Test Prof", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"},
                "imports": [{"href": f"../catalogs/{cat_uuid}.json", "include-all": {}}]
            }
        }),
        ("component-definitions", "component-definitions", comp_uuid, {
            "component-definition": {
                "uuid": comp_uuid,
                "metadata": {"title": "Test CompDef", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"},
                "components": [{"uuid": str(uuid.uuid4()), "type": "software", "title": "Comp", "description": "Desc"}]
            }
        }),
        ("ssps", "ssps", ssp_uuid, {
            "system-security-plan": {
                "uuid": ssp_uuid,
                "metadata": {"title": "Test SSP", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"},
                "import-profile": {"href": f"../profiles/{prof_uuid}.json"},
                "system-characteristics": {
                    "system-ids": [{"id": "s1", "identifier-type": "https://fedramp.gov"}],
                    "system-name": "Sys",
                    "description": "Desc",
                    "system-information": {"information-types": [{"uuid": str(uuid.uuid4()), "title": "Info", "description": "Info Desc"}]},
                    "status": {"state": "operational"},
                    "authorization-boundary": {"description": "Bound"}
                },
                "system-implementation": {
                    "users": [{"uuid": str(uuid.uuid4()), "role-ids": ["admin"]}],
                    "components": [{"uuid": str(uuid.uuid4()), "type": "software", "title": "C1", "description": "D1", "status": {"state": "operational"}}]
                },
                "control-implementation": {
                    "description": "Ctrl",
                    "implemented-requirements": [{"uuid": str(uuid.uuid4()), "control-id": "ac-1"}]
                }
            }
        }),
        ("assessment-plan", "assessment-plans", ap_uuid, {
            "assessment-plan": {
                "uuid": ap_uuid,
                "metadata": {"title": "Test AP", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"},
                "import-ssp": {"href": f"../ssps/{ssp_uuid}.json"},
                "reviewed-controls": {"control-selections": [{"include-all": {}}]}
            }
        }),
        ("assessment-results", "assessment-results", ar_uuid, {
            "assessment-results": {
                "uuid": ar_uuid,
                "metadata": {"title": "Test AR", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"},
                "import-ap": {"href": f"../assessment-plans/{ap_uuid}.json"},
                "results": [{
                    "uuid": str(uuid.uuid4()),
                    "title": "Res",
                    "description": "Desc",
                    "start": "2026-08-08T00:00:00Z",
                    "reviewed-controls": {"control-selections": [{"include-all": {}}]}
                }]
            }
        }),
        ("poams", "poams", poam_uuid, {
            "plan-of-action-and-milestones": {
                "uuid": poam_uuid,
                "metadata": {"title": "Test POAM", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"},
                "poam-items": [{"uuid": str(uuid.uuid4()), "title": "Item", "description": "Desc"}]
            }
        }),
        ("control-mappings", "control-mappings", map_uuid, {
            "mapping-collection": {
                "uuid": map_uuid,
                "metadata": {"title": "Test Map", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-08T00:00:00Z"},
                "provenance": {"method": "human", "status": "draft", "matching-rationale": "semantic", "mapping-description": "Desc"},
                "mappings": []
            }
        })
    ]

    created_docs = []

    # 1. Create documents across all 8 stages
    for route_stage, norm_stage, doc_uuid, payload in stage_specs:
        res = client.post(f"/api/documents/{route_stage}", json=payload, headers=headers)
        assert res.status_code in (200, 201), f"Failed POST for {route_stage}: {res.text}"

        # Verify disk file exists
        stage_dir = get_stage_dir(norm_stage, workspace_id=ws_id)
        doc_file = os.path.join(stage_dir, f"{doc_uuid}.json")
        assert os.path.exists(doc_file), f"File {doc_file} does not exist on backend disk"

        created_docs.append((route_stage, norm_stage, doc_uuid, doc_file))

    # 2. Verify GET for all 8 documents
    for route_stage, norm_stage, doc_uuid, doc_file in created_docs:
        res = client.get(f"/api/documents/{route_stage}/{doc_uuid}", headers=headers)
        assert res.status_code == 200, f"Failed GET for {route_stage}/{doc_uuid}"

    # 3. Teardown cleanup via DELETE /api/documents/{stage}/{id}?force=true
    for route_stage, norm_stage, doc_uuid, doc_file in created_docs:
        res = client.delete(f"/api/documents/{route_stage}/{doc_uuid}?force=true", headers=headers)
        assert res.status_code == 200, f"Failed DELETE for {route_stage}/{doc_uuid}"

        # Verify disk file is 100% removed
        assert not os.path.exists(doc_file), f"Disk file {doc_file} was NOT removed after DELETE cleanup!"

        # Verify GET returns 404
        res_get = client.get(f"/api/documents/{route_stage}/{doc_uuid}", headers=headers)
        assert res_get.status_code == 404
