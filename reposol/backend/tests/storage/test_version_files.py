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
    def test_save_and_list_document_versions(self, isolated_data_dir):
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
        
        save_document_version("catalogs", doc_id, "1.0.0", doc_v1)
        
        active = get_document("catalogs", doc_id)
        assert active["catalog"]["metadata"]["version"] == "1.0.0"
        
        versions = get_document_versions("catalogs", doc_id)
        assert len(versions) == 1
        assert versions[0]["version"] == "1.0.0"

    def test_save_and_load_draft_version(self, isolated_data_dir):
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
        
        save_document_version("catalogs", doc_id, "1.0.0", doc_active)
        
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
        save_document_version("catalogs", doc_id, "1.0.0-draft", doc_draft, is_draft=True)
        
        current = get_document("catalogs", doc_id)
        assert current["catalog"]["metadata"]["title"] == "Test Catalog Modified"
        assert current["catalog"]["metadata"]["version"] == "1.0.0-draft"
        
        versions = get_document_versions("catalogs", doc_id)
        assert len(versions) == 2
        draft_entry = next(v for v in versions if v.get("is_draft"))
        assert draft_entry["version"] == "1.0.0-draft"
        
        loaded_draft = get_document_version("catalogs", doc_id, "1.0.0-draft")
        assert loaded_draft["catalog"]["metadata"]["title"] == "Test Catalog Modified"

    def test_save_release_cleans_up_draft(self, isolated_data_dir):
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
        
        save_document_version("catalogs", doc_id, "1.0.0-draft", doc_draft, is_draft=True)
        
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
        save_document_version("catalogs", doc_id, "1.0.0", doc_release)
        
        current = get_document("catalogs", doc_id)
        assert current["catalog"]["metadata"]["title"] == "Release"
        assert current["catalog"]["metadata"]["version"] == "1.0.0"
        
        versions = get_document_versions("catalogs", doc_id)
        assert len(versions) == 1
        assert not any(v.get("is_draft") for v in versions)

    def test_delete_draft_version(self, isolated_data_dir):
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
        save_document_version("catalogs", doc_id, "1.0.0-draft", doc_draft, is_draft=True)
        
        delete_document_version("catalogs", doc_id, "1.0.0-draft")
        
        versions = get_document_versions("catalogs", doc_id)
        assert not any(v.get("is_draft") for v in versions)

    def test_delete_document_cleans_up_all_versions_on_disk(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc_v1 = {"catalog": {"uuid": doc_id, "metadata": {"title": "V1", "version": "1.0.0", "last-modified": "2026-07-18T10:00:00Z"}}}
        doc_v2 = {"catalog": {"uuid": doc_id, "metadata": {"title": "V2", "version": "2.0.0", "last-modified": "2026-07-18T11:00:00Z"}}}
        
        save_document_version("catalogs", doc_id, "1.0.0", doc_v1)
        save_document_version("catalogs", doc_id, "2.0.0", doc_v2)
        
        stage_dir = get_stage_dir("catalogs")
        assert os.path.exists(os.path.join(stage_dir, f"{doc_id}_v1.0.0.json"))
        assert os.path.exists(os.path.join(stage_dir, f"{doc_id}_v2.0.0.json"))
        
        delete_document("catalogs", doc_id)
        
        assert not os.path.exists(os.path.join(stage_dir, f"{doc_id}_v1.0.0.json"))
        assert not os.path.exists(os.path.join(stage_dir, f"{doc_id}_v2.0.0.json"))
        assert not os.path.exists(os.path.join(stage_dir, f"{doc_id}.json"))

    def test_version_traversal_blocked(self, isolated_data_dir):
        traversal_id = "../../../etc/passwd"
        with patch("app.storage.is_valid_uuid", return_value=True):
            with pytest.raises(ValueError, match="Directory traversal"):
                get_document_version("catalogs", traversal_id, "1.0.0")

            with pytest.raises(ValueError, match="Directory traversal"):
                delete_document_version("catalogs", traversal_id, "1.0.0")
