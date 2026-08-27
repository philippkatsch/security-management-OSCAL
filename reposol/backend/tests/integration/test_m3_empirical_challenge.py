import pytest
import asyncio
import uuid
import copy
from typing import Dict, Any

from app.services.resolution_service import resolve_profile, resolve_ssp, clear_resolution_cache
from app.repositories.document_repository import save_document, get_document, delete_document


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
