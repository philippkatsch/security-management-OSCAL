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
    sync_master_templates,
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
    @pytest.mark.asyncio
    async def test_valid_stage_creates_dir(self, isolated_data_dir):
        stage_dir = await get_stage_dir("catalogs")
        assert os.path.isdir(stage_dir)

    @pytest.mark.asyncio
    async def test_traversal_attempt_parent_dir(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Directory traversal"):
            await get_stage_dir("../outside")

    @pytest.mark.asyncio
    async def test_traversal_attempt_to_root(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Directory traversal"):
            await get_stage_dir("catalogs/..")


# ─────────────────────────────────────────────────────────────────────────────
# list_documents
# ─────────────────────────────────────────────────────────────────────────────

class TestListDocuments:
    @pytest.mark.asyncio
    async def test_empty_stage_returns_empty_list(self, isolated_data_dir):
        result = await list_documents("catalogs")
        assert result == []

    @pytest.mark.asyncio
    async def test_lists_saved_documents(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id, "title": "Test"}}
        await save_document("catalogs", doc_id, doc, skip_validation=True)
        result = await list_documents("catalogs")
        assert len(result) == 1
        assert result[0]["catalog"]["uuid"] == doc_id

    @pytest.mark.asyncio
    async def test_skips_non_uuid_filenames(self, isolated_data_dir):
        stage_dir = await get_stage_dir("catalogs")
        with open(os.path.join(stage_dir, "README.json"), "w") as f:
            json.dump({"note": "not a document"}, f)
        result = await list_documents("catalogs")
        assert result == []

    @pytest.mark.asyncio
    async def test_skips_corrupted_json_files(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        stage_dir = await get_stage_dir("catalogs")
        with open(os.path.join(stage_dir, f"{doc_id}.json"), "w") as f:
            f.write("{ not valid json }")
        result = await list_documents("catalogs")
        assert result == []


# ─────────────────────────────────────────────────────────────────────────────
# get_document
# ─────────────────────────────────────────────────────────────────────────────

class TestGetDocument:
    @pytest.mark.asyncio
    async def test_get_existing_document(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id, "title": "Existing Doc"}}
        await save_document("catalogs", doc_id, doc, skip_validation=True)
        result, _ = await get_document("catalogs", doc_id)
        assert result["catalog"]["title"] == "Existing Doc"

    @pytest.mark.asyncio
    async def test_get_nonexistent_document_raises_file_not_found(self, isolated_data_dir):
        missing_id = str(uuid.uuid4())
        with pytest.raises(FileNotFoundError):
            await get_document("catalogs", missing_id)

    @pytest.mark.asyncio
    async def test_get_invalid_uuid_raises_value_error(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Invalid document UUID format"):
            await get_document("catalogs", "not-a-uuid")

    @pytest.mark.asyncio
    async def test_get_traversal_blocked_with_patched_uuid(self, isolated_data_dir):
        traversal_id = "../../../etc/passwd"
        with patch("app.storage.is_valid_uuid", return_value=True):
            with pytest.raises(ValueError, match="Directory traversal"):
                await get_document("catalogs", traversal_id)


# ─────────────────────────────────────────────────────────────────────────────
# save_document
# ─────────────────────────────────────────────────────────────────────────────

class TestSaveDocument:
    @pytest.mark.asyncio
    async def test_save_new_document_returns_false(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id}}
        _, _, existed = await save_document("catalogs", doc_id, doc, skip_validation=True)
        assert existed is False

    @pytest.mark.asyncio
    async def test_save_existing_document_returns_true(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        doc = {"catalog": {"uuid": doc_id}}
        await save_document("catalogs", doc_id, doc, skip_validation=True)
        _, _, existed = await save_document("catalogs", doc_id, doc, skip_validation=True)
        assert existed is True

    @pytest.mark.asyncio
    async def test_save_invalid_uuid_raises_value_error(self, isolated_data_dir):
        with pytest.raises(ValueError, match="Invalid document UUID format"):
            await save_document("catalogs", "bad-uuid", {"catalog": {}}, skip_validation=True)


# ─────────────────────────────────────────────────────────────────────────────
# delete_document
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteDocument:
    @pytest.mark.asyncio
    async def test_delete_existing_document(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        await save_document("catalogs", doc_id, {"catalog": {"uuid": doc_id}}, skip_validation=True)
        await delete_document("catalogs", doc_id)
        with pytest.raises(FileNotFoundError):
            _, _ = await get_document("catalogs", doc_id)

    @pytest.mark.asyncio
    async def test_delete_nonexistent_raises_file_not_found(self, isolated_data_dir):
        with pytest.raises(FileNotFoundError):
            await delete_document("catalogs", str(uuid.uuid4()))

    @pytest.mark.asyncio
    async def test_delete_removes_file_from_disk(self, isolated_data_dir):
        doc_id = str(uuid.uuid4())
        await save_document("catalogs", doc_id, {"catalog": {"uuid": doc_id}}, skip_validation=True)
        stage_dir = await get_stage_dir("catalogs")
        file_path = os.path.join(stage_dir, f"{doc_id}.json")
        assert os.path.exists(file_path)
        await delete_document("catalogs", doc_id)
        assert not os.path.exists(file_path)


# ─────────────────────────────────────────────────────────────────────────────
# sync_master_templates
# ─────────────────────────────────────────────────────────────────────────────

class TestSyncMasterTemplates:
    @pytest.mark.asyncio
    async def test_sync_copies_files_from_seed_to_templates(self, tmp_path):
        seed_dir = tmp_path / "seed"
        data_dir = tmp_path / "data"
        templates_dir = data_dir / "workspaces" / "default"
        catalogs_dir = seed_dir / "catalogs"
        catalogs_dir.mkdir(parents=True)

        sample_json = catalogs_dir / "sample.json"
        sample_json.write_text('{"catalog": {"title": "Sample Catalog"}}')

        with patch.dict(os.environ, {
            "REPOSOL_DATA_DIR": str(data_dir),
            "REPOSOL_TEMPLATES_SEED_DIR": str(seed_dir),
        }, clear=False):
            # Unset PYTEST_CURRENT_TEST in patch so sync runs
            with patch.dict(os.environ, {"PYTEST_CURRENT_TEST": ""}):
                with patch("app.storage.TEMPLATES_DIR", str(templates_dir)):
                    with patch("app.storage.DATA_DIR", str(data_dir)):
                        await sync_master_templates()

        target_file = templates_dir / "catalogs" / "sample.json"
        assert target_file.exists()
        assert "Sample Catalog" in target_file.read_text()

