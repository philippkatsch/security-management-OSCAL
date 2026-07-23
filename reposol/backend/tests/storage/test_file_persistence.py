"""
Storage persistence tests covering:
- Directory safety checks (is_safe_subdir)
- Stage directory retrieval (get_stage_dir)
- Document CRUD operations: list, get, save, delete
- Safety controls (directory traversal blocks, invalid UUID guards)
"""
import os
import json
import uuid
import pytest
from unittest.mock import patch

from app.storage import (
    is_safe_subdir,
    get_stage_dir,
    list_documents,
    get_document,
    save_document,
    delete_document,
)

# ─────────────────────────────────────────────────────────────────────────────
# is_safe_subdir
# ─────────────────────────────────────────────────────────────────────────────

class TestIsSafeSubdir:
    def test_child_inside_parent(self, tmp_path):
        parent = tmp_path / "parent"
        child = parent / "child"
        parent.mkdir()
        child.mkdir()
        assert is_safe_subdir(str(parent), str(child))

    def test_parent_itself_not_safe(self, tmp_path):
        parent = tmp_path / "parent"
        parent.mkdir()
        assert not is_safe_subdir(str(parent), str(parent))

    def test_sibling_directory_not_safe(self, tmp_path):
        parent = tmp_path / "parent"
        sibling = tmp_path / "sibling"
        parent.mkdir()
        sibling.mkdir()
        assert not is_safe_subdir(str(parent), str(sibling))

    def test_ancestor_not_safe(self, tmp_path):
        parent = tmp_path / "parent"
        parent.mkdir()
        assert not is_safe_subdir(str(parent), str(tmp_path))

    def test_nonexistent_child_path(self, tmp_path):
        parent = tmp_path / "parent"
        parent.mkdir()
        non_existent = parent / "nonexistent_file.json"
        assert is_safe_subdir(str(parent), str(non_existent))

    def test_value_error_returns_false(self):
        with patch("os.path.commonpath", side_effect=ValueError("simulated path error")):
            assert not is_safe_subdir("/parent", "/parent/child")


# ─────────────────────────────────────────────────────────────────────────────
# get_stage_dir
# ─────────────────────────────────────────────────────────────────────────────

class TestGetStageDir:
    def test_valid_stage_creates_dir(self, isolated_data_dir):
        stage_dir = get_stage_dir("catalogs")
        assert os.path.isdir(stage_dir)

    def test_traversal_attempt_parent_dir(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Directory traversal"):
            get_stage_dir("../outside")

    def test_traversal_attempt_to_root(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Directory traversal"):
            get_stage_dir("catalogs/..")


# ─────────────────────────────────────────────────────────────────────────────
# list_documents
# ─────────────────────────────────────────────────────────────────────────────

class TestListDocuments:
    def test_empty_stage_returns_empty_list(self, isolated_data_dir):
        result = list_documents("catalogs")
        assert result == []

    def test_lists_saved_documents(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id, "title": "Test"}}
        save_document("catalogs", doc_id, doc)
        result = list_documents("catalogs")
        assert len(result) == 1
        assert result[0]["catalog"]["uuid"] == doc_id

    def test_skips_non_uuid_filenames(self, isolated_data_dir):
        stage_dir = get_stage_dir("catalogs")
        with open(os.path.join(stage_dir, "README.json"), "w") as f:
            json.dump({"note": "not a document"}, f)
        result = list_documents("catalogs")
        assert result == []

    def test_skips_corrupted_json_files(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        stage_dir = get_stage_dir("catalogs")
        with open(os.path.join(stage_dir, f"{doc_id}.json"), "w") as f:
            f.write("{ not valid json }")
        result = list_documents("catalogs")
        assert result == []


# ─────────────────────────────────────────────────────────────────────────────
# get_document
# ─────────────────────────────────────────────────────────────────────────────

class TestGetDocument:
    def test_get_existing_document(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id, "title": "Existing Doc"}}
        save_document("catalogs", doc_id, doc)
        result = get_document("catalogs", doc_id)
        assert result["catalog"]["title"] == "Existing Doc"

    def test_get_nonexistent_document_raises_file_not_found(self, isolated_data_dir):
        missing_id = str(uuid.uuid4())
        with pytest.raises(FileNotFoundError):
            get_document("catalogs", missing_id)

    def test_get_invalid_uuid_raises_value_error(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Invalid document UUID format"):
            get_document("catalogs", "not-a-uuid")

    def test_get_traversal_blocked_with_patched_uuid(self, isolated_data_dir):
        traversal_id = "../../../etc/passwd"
        with patch("app.storage.is_valid_uuid", return_value=True):
            with pytest.raises(ValueError, match="Directory traversal"):
                get_document("catalogs", traversal_id)


# ─────────────────────────────────────────────────────────────────────────────
# save_document
# ─────────────────────────────────────────────────────────────────────────────

class TestSaveDocument:
    def test_save_new_document_returns_false(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id}}
        existed = save_document("catalogs", doc_id, doc)
        assert existed is False

    def test_save_existing_document_returns_true(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id}}
        save_document("catalogs", doc_id, doc)
        existed = save_document("catalogs", doc_id, doc)
        assert existed is True

    def test_save_invalid_uuid_raises_value_error(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Invalid document UUID format"):
            save_document("catalogs", "bad-uuid", {"catalog": {}})


# ─────────────────────────────────────────────────────────────────────────────
# delete_document
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteDocument:
    def test_delete_existing_document(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        save_document("catalogs", doc_id, {"catalog": {"uuid": doc_id}})
        delete_document("catalogs", doc_id)
        with pytest.raises(FileNotFoundError):
            get_document("catalogs", doc_id)

    def test_delete_nonexistent_raises_file_not_found(self, isolated_data_dir):
        with pytest.raises(FileNotFoundError):
            delete_document("catalogs", str(uuid.uuid4()))

    def test_delete_removes_file_from_disk(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        save_document("catalogs", doc_id, {"catalog": {"uuid": doc_id}})
        stage_dir = get_stage_dir("catalogs")
        file_path = os.path.join(stage_dir, f"{doc_id}.json")
        assert os.path.exists(file_path)
        delete_document("catalogs", doc_id)
        assert not os.path.exists(file_path)
