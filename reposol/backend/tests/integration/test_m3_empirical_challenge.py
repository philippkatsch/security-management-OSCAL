import pytest
import asyncio
import uuid
import copy
from typing import Dict, Any

from app.services.resolution_service import resolve_profile, resolve_ssp, get_profile_baseline_diff, clear_resolution_cache
from app.repositories.document_repository import save_document, get_document, delete_document


@pytest.mark.asyncio
async def test_m3_baseline_diff_empty_profile():
    workspace_id = "test-ws-m3-empty"
    cat_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())

    # Save minimal catalog
    cat_doc = {
        "catalog": {
            "uuid": cat_id,
            "metadata": {"title": "Test Catalog for Empty Profile"},
            "controls": [
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "ac-2", "title": "Account Management"}
            ]
        }
    }
    await save_document("catalogs", cat_id, cat_doc, workspace_id=workspace_id)

    # Save empty profile (no imports, no alters)
    prof_doc = {
        "profile": {
            "uuid": prof_id,
            "metadata": {"title": "Empty Profile"},
            "imports": []
        }
    }
    await save_document("profiles", prof_id, prof_doc, workspace_id=workspace_id)

    try:
        clear_resolution_cache()
        diff = await get_profile_baseline_diff(workspace_id, prof_id, cat_id)

        assert diff is not None
        assert "summary" in diff
        assert "deltas" in diff

        summary = diff["summary"]
        assert summary["total_baseline_controls"] == 2
        # Since profile has no imports, both baseline controls should be considered 'removed' from the profile perspective
        assert summary["removed_count"] == 2
        assert summary["added_count"] == 0
        assert summary["modified_count"] == 0
        assert summary["untouched_count"] == 0

    finally:
        await delete_document("catalogs", cat_id, workspace_id=workspace_id)
        await delete_document("profiles", prof_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_m3_baseline_diff_multi_catalog_profile():
    workspace_id = "test-ws-m3-multicat"
    cat1_id = str(uuid.uuid4())
    cat2_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())

    # Save Catalog 1
    cat1_doc = {
        "catalog": {
            "uuid": cat1_id,
            "metadata": {"title": "Catalog 1 (Core Controls)"},
            "controls": [
                {"id": "ac-1", "title": "Access Control Policy"},
                {"id": "ac-2", "title": "Account Management"}
            ]
        }
    }
    await save_document("catalogs", cat1_id, cat1_doc, workspace_id=workspace_id)

    # Save Catalog 2
    cat2_doc = {
        "catalog": {
            "uuid": cat2_id,
            "metadata": {"title": "Catalog 2 (Privacy Controls)"},
            "controls": [
                {"id": "pm-1", "title": "Information Security Program Plan"}
            ]
        }
    }
    await save_document("catalogs", cat2_id, cat2_doc, workspace_id=workspace_id)

    # Save Profile importing BOTH catalogs
    prof_doc = {
        "profile": {
            "uuid": prof_id,
            "metadata": {"title": "Multi-Catalog Profile"},
            "imports": [
                {"href": f"#{cat1_id}", "include-all": {}},
                {"href": f"#{cat2_id}", "include-all": {}}
            ]
        }
    }
    await save_document("profiles", prof_id, prof_doc, workspace_id=workspace_id)

    try:
        clear_resolution_cache()
        resolved = await resolve_profile(workspace_id, prof_id)
        assert len(resolved["controls"]) == 3  # ac-1, ac-2, pm-1

        # Diff against Catalog 1
        diff1 = await get_profile_baseline_diff(workspace_id, prof_id, cat1_id)
        # ac-1 and ac-2 exist in cat1 and profile (untouched)
        # pm-1 exists in profile but not cat1 (added relative to cat1)
        assert diff1["summary"]["untouched_count"] == 2
        assert diff1["summary"]["added_count"] == 1  # pm-1
        assert diff1["summary"]["removed_count"] == 0

    finally:
        await delete_document("catalogs", cat1_id, workspace_id=workspace_id)
        await delete_document("catalogs", cat2_id, workspace_id=workspace_id)
        await delete_document("profiles", prof_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_m3_baseline_diff_complex_alters_and_set_parameters():
    workspace_id = "test-ws-m3-alters"
    cat_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())

    cat_doc = {
        "catalog": {
            "uuid": cat_id,
            "metadata": {"title": "Baseline Catalog for Alters Test"},
            "controls": [
                {
                    "id": "ac-1",
                    "title": "Access Control Policy",
                    "params": [{"id": "ac-1_prm_1", "values": ["1 year"]}],
                    "props": [{"name": "status", "value": "draft"}]
                },
                {
                    "id": "ac-2",
                    "title": "Account Management",
                    "props": [{"name": "priority", "value": "P1"}]
                },
                {
                    "id": "ac-3",
                    "title": "Access Enforcement"
                }
            ]
        }
    }
    await save_document("catalogs", cat_id, cat_doc, workspace_id=workspace_id)

    # Profile with set-parameters overrides and alters (adding/removing props)
    prof_doc = {
        "profile": {
            "uuid": prof_id,
            "metadata": {"title": "Complex Modify Profile"},
            "imports": [
                {
                    "href": f"#{cat_id}",
                    "include-controls": [{"with-ids": ["ac-1", "ac-2"]}]  # ac-3 excluded
                }
            ],
            "modify": {
                "set-parameters": [
                    {"param-id": "ac-1_prm_1", "values": ["3 years"], "label": "Retention Period"}
                ],
                "alters": [
                    {
                        "control-id": "ac-1",
                        "adds": [
                            {"props": [{"name": "review-frequency", "value": "annually"}]}
                        ]
                    },
                    {
                        "control-id": "ac-2",
                        "removes": [
                            {"by-name": "priority"}
                        ]
                    }
                ]
            }
        }
    }
    await save_document("profiles", prof_id, prof_doc, workspace_id=workspace_id)

    try:
        clear_resolution_cache()
        diff = await get_profile_baseline_diff(workspace_id, prof_id, cat_id)

        assert diff["summary"]["total_baseline_controls"] == 3
        # ac-1 and ac-2 are modified via set-parameters and alters
        assert diff["summary"]["modified_count"] == 2
        # ac-3 was excluded in imports, so removed count is 1
        assert diff["summary"]["removed_count"] == 1
        assert diff["summary"]["added_count"] == 0
        assert diff["summary"]["untouched_count"] == 0

        # Verify control deltas details
        deltas_map = {d["id"]: d for d in diff["deltas"]}
        assert deltas_map["ac-1"]["status"] == "modified"
        assert deltas_map["ac-2"]["status"] == "modified"
        assert deltas_map["ac-3"]["status"] == "removed"

    finally:
        await delete_document("catalogs", cat_id, workspace_id=workspace_id)
        await delete_document("profiles", prof_id, workspace_id=workspace_id)


@pytest.mark.asyncio
async def test_m3_diagram_persistence_large_base64_strings():
    workspace_id = "test-ws-m3-large-diagram"
    ssp_id = str(uuid.uuid4())

    # Generate a 2MB base64 string payload representing an architecture diagram
    large_base64_payload = "data:image/png;base64," + ("B" * (2 * 1024 * 1024))
    resource_uuid = str(uuid.uuid4())
    diagram_uuid = str(uuid.uuid4())

    ssp_doc = {
        "system-security-plan": {
            "uuid": ssp_id,
            "metadata": {
                "title": "SSP with Large Architecture Diagram",
                "version": "1.0",
                "oscal-version": "1.0.0"
            },
            "system-characteristics": {
                "system-name": "Test System Large Diagram",
                "system-information": {
                    "information-types": []
                },
                "security-impact-level": {
                    "security-objective-confidentiality": "fips-199-moderate",
                    "security-objective-integrity": "fips-199-moderate",
                    "security-objective-availability": "fips-199-low"
                }
            },
            "control-implementation": {
                "description": "System control implementation",
                "implemented-requirements": []
            },
            "back-matter": {
                "resources": [
                    {
                        "uuid": resource_uuid,
                        "title": "System Architecture Diagram High-Res",
                        "rlinks": [
                            {
                                "href": large_base64_payload,
                                "media-type": "image/png"
                            }
                        ]
                    }
                ]
            }
        }
    }

    # Save document to repository (JSON disk storage / DB)
    await save_document("system-security-plans", ssp_id, ssp_doc, workspace_id=workspace_id)

    try:
        # Re-fetch document from storage
        fetched_doc, file_path = await get_document("system-security-plans", ssp_id, workspace_id=workspace_id)
        assert fetched_doc is not None

        ssp = fetched_doc.get("system-security-plan", {})
        back_matter = ssp.get("back-matter", {})
        resources = back_matter.get("resources", [])

        assert len(resources) == 1
        res = resources[0]
        assert res["uuid"] == resource_uuid
        assert len(res["rlinks"][0]["href"]) > 2 * 1024 * 1024
        assert res["rlinks"][0]["href"] == large_base64_payload

        # Resolve SSP
        clear_resolution_cache()
        resolved = await resolve_ssp(workspace_id, ssp_id)
        assert resolved is not None

    finally:
        await delete_document("system-security-plans", ssp_id, workspace_id=workspace_id)
