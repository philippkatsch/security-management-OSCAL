"""
Versioning and draft storage tests covering:
- save_document_version and get_document_versions
- Draft files suffix (-draft) and fallback logic
- Official release overwriting draft state
- Deleting specific versions (delete_document_version)
- Deleting main document cleans up all versions on disk
- Path traversal blocks for version operations
"""
import os
import json
import uuid
import pytest
from unittest.mock import patch

from app.storage import (
    save_document_version,
    get_document_versions,
    get_document_version,
    delete_document_version,
    get_document,
    save_document,
    delete_document,
    get_stage_dir,
)

class TestDocumentVersioning:
    @pytest.mark.asyncio
    async def test_save_and_list_document_versions(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc_v1 = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Test Catalog",
                    "last-modified": "2026-07-18T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                }
            }
        }
        
        await save_document_version("catalogs", doc_id, "1.0.0", doc_v1, skip_validation=True)
        
        active, _ = await get_document("catalogs", doc_id)
        assert active["catalog"]["metadata"]["version"] == "1.0.0"
        
        versions = await get_document_versions("catalogs", doc_id)
        assert len(versions) == 1
        assert versions[0]["version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_save_and_load_draft_version(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc_active = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Test Catalog",
                    "last-modified": "2026-07-18T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                }
            }
        }
        
        await save_document_version("catalogs", doc_id, "1.0.0", doc_active, skip_validation=True)
        
        doc_draft = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Test Catalog Modified",
                    "last-modified": "2026-07-18T11:00:00Z",
                    "version": "1.0.0-draft",
                    "oscal-version": "1.1.2"
                }
            }
        }
        await save_document_version("catalogs", doc_id, "1.0.0-draft", doc_draft, is_draft=True, skip_validation=True)
        
        current, _ = await get_document("catalogs", doc_id)
        assert current["catalog"]["metadata"]["title"] == "Test Catalog Modified"
        assert current["catalog"]["metadata"]["version"] == "1.0.0-draft"
        
        versions = await get_document_versions("catalogs", doc_id)
        assert len(versions) == 2
        draft_entry = next(v for v in versions if v.get("is_draft"))
        assert draft_entry["version"] == "1.0.0-draft"
        
        loaded_draft = await get_document_version("catalogs", doc_id, "1.0.0-draft")
        assert loaded_draft["catalog"]["metadata"]["title"] == "Test Catalog Modified"

    @pytest.mark.asyncio
    async def test_save_release_cleans_up_draft(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc_draft = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Draft",
                    "last-modified": "2026-07-18T10:00:00Z",
                    "version": "1.0.0-draft",
                    "oscal-version": "1.1.2"
                }
            }
        }
        
        await save_document_version("catalogs", doc_id, "1.0.0-draft", doc_draft, is_draft=True, skip_validation=True)
        
        doc_release = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Release",
                    "last-modified": "2026-07-18T11:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                }
            }
        }
        await save_document_version("catalogs", doc_id, "1.0.0", doc_release, skip_validation=True)
        
        current, _ = await get_document("catalogs", doc_id)
        assert current["catalog"]["metadata"]["title"] == "Release"
        assert current["catalog"]["metadata"]["version"] == "1.0.0"
        
        versions = await get_document_versions("catalogs", doc_id)
        assert len(versions) == 1
        assert not any(v.get("is_draft") for v in versions)

    @pytest.mark.asyncio
    async def test_delete_draft_version(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc_draft = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Draft",
                    "last-modified": "2026-07-18T10:00:00Z",
                    "version": "1.0.0-draft",
                    "oscal-version": "1.1.2"
                }
            }
        }
        await save_document_version("catalogs", doc_id, "1.0.0-draft", doc_draft, is_draft=True, skip_validation=True)
        
        await delete_document_version("catalogs", doc_id, "1.0.0-draft")
        
        versions = await get_document_versions("catalogs", doc_id)
        assert not any(v.get("is_draft") for v in versions)

    @pytest.mark.asyncio
    async def test_delete_document_cleans_up_all_versions_on_disk(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc_v1 = {"catalog": {"uuid": doc_id, "metadata": {"title": "V1", "version": "1.0.0", "last-modified": "2026-07-18T10:00:00Z"}}}
        doc_v2 = {"catalog": {"uuid": doc_id, "metadata": {"title": "V2", "version": "2.0.0", "last-modified": "2026-07-18T11:00:00Z"}}}
        
        await save_document_version("catalogs", doc_id, "1.0.0", doc_v1, skip_validation=True)
        await save_document_version("catalogs", doc_id, "2.0.0", doc_v2, skip_validation=True)
        
        stage_dir = await get_stage_dir("catalogs")
        assert os.path.exists(os.path.join(stage_dir, f"{doc_id}_v1.0.0.json"))
        assert os.path.exists(os.path.join(stage_dir, f"{doc_id}_v2.0.0.json"))
        
        await delete_document("catalogs", doc_id)
        
        assert not os.path.exists(os.path.join(stage_dir, f"{doc_id}_v1.0.0.json"))
        assert not os.path.exists(os.path.join(stage_dir, f"{doc_id}_v2.0.0.json"))
        assert not os.path.exists(os.path.join(stage_dir, f"{doc_id}.json"))

    @pytest.mark.asyncio
    async def test_version_traversal_blocked(self, isolated_data_dir):
        traversal_id = "../../../etc/passwd"
        with patch("app.storage.is_valid_uuid", return_value=True):
            with pytest.raises(ValueError, match="Directory traversal"):
                await get_document_version("catalogs", traversal_id, "1.0.0")

            with pytest.raises(ValueError, match="Directory traversal"):
                await delete_document_version("catalogs", traversal_id, "1.0.0")

    @pytest.mark.asyncio
    async def test_draft_version_skips_validation(self, isolated_data_dir):
        from app.validation import OSCALValidationError
        doc_id = str(uuid.uuid4())
        # An invalid draft doc: missing required fields or having invalid types per NIST OSCAL schema
        doc_draft = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Draft Incomplete",
                    "version": "1.0.0-draft",
                    "oscal-version": "1.1.2",
                    "invalid-extra-prop": 12345
                },
                "controls": [
                    {"id": "c1"} # Missing required 'title' in control
                ]
            }
        }
        # Saving as draft should NOT raise schema validation error even with skip_validation=False
        await save_document_version("catalogs", doc_id, "1.0.0-draft", doc_draft, is_draft=True, skip_validation=False)
        loaded = await get_document_version("catalogs", doc_id, "1.0.0-draft")
        assert loaded["catalog"]["metadata"]["title"] == "Draft Incomplete"

    @pytest.mark.asyncio
    async def test_published_version_enforces_validation(self, isolated_data_dir):
        from app.validation import OSCALValidationError
        doc_id = str(uuid.uuid4())
        doc_invalid = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Invalid Published",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "controls": [
                    {"id": "c1"} # Missing required 'title' in control
                ]
            }
        }
        # Saving as official release MUST raise validation error
        with pytest.raises(OSCALValidationError):
            await save_document_version("catalogs", doc_id, "1.0.0", doc_invalid, is_draft=False, skip_validation=False)

    @pytest.mark.asyncio
    async def test_draft_version_case_insensitive_and_variants(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        # Incomplete document that would fail schema validation
        doc_variant = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Variant Draft",
                    "version": "1.0.0-Draft",
                    "oscal-version": "1.1.2"
                },
                "controls": [{"id": "c_var"}] # Missing required title
            }
        }
        # Saving with "1.0.0-Draft" without explicit is_draft=True should be detected as draft
        await save_document_version("catalogs", doc_id, "1.0.0-Draft", doc_variant, skip_validation=False)
        loaded = await get_document_version("catalogs", doc_id, "1.0.0-Draft")
        assert loaded["catalog"]["metadata"]["title"] == "Variant Draft"
