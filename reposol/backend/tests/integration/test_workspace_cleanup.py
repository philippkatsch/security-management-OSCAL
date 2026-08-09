"""
Integration tests for the DELETE /api/workspaces/{workspace_id} endpoint.

Verifies workspace-level deletion, protection of reserved workspaces,
404 for non-existent workspaces, and path traversal mitigation.
"""
import os
import json
import pytest
from uuid import uuid4


class TestDeleteWorkspace:
    """Tests for the workspace delete endpoint."""

    def _create_workspace_with_doc(self, client, workspace_id: str) -> str:
        """Helper: create a catalog in a specific workspace so the directory is populated."""
        doc_uuid = str(uuid4())
        payload = {
            "catalog": {
                "uuid": doc_uuid,
                "metadata": {
                    "title": "Workspace Cleanup Test Catalog",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                    "last-modified": "2026-01-01T00:00:00Z"
                }
            }
        }
        res = client.post(
            "/api/documents/catalog",
            json=payload,
            headers={"X-Workspace-ID": workspace_id},
        )
        assert res.status_code == 201, f"Setup failed: {res.text}"
        return doc_uuid

    def test_delete_workspace_success(self, client, isolated_data_dir):
        """Deleting a workspace removes its entire directory tree."""
        ws_id = str(uuid4())
        doc_uuid = self._create_workspace_with_doc(client, ws_id)

        # Verify workspace directory was created
        ws_dir = os.path.join(isolated_data_dir, "..", ws_id)
        ws_dir = os.path.abspath(ws_dir)
        assert os.path.isdir(ws_dir), f"Workspace dir should exist: {ws_dir}"

        # Delete the workspace
        res = client.delete(f"/api/workspaces/{ws_id}")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "deleted"
        assert body["workspace_id"] == ws_id

        # Verify directory is gone
        assert not os.path.exists(ws_dir), "Workspace directory should be deleted"

    def test_delete_workspace_protected_default(self, client):
        """Cannot delete the 'default' workspace."""
        res = client.delete("/api/workspaces/default")
        assert res.status_code == 400
        assert "protected" in res.json()["detail"].lower() or "Cannot delete" in res.json()["detail"]

    def test_delete_workspace_protected_master(self, client):
        """Cannot delete the 'master' workspace."""
        res = client.delete("/api/workspaces/master")
        assert res.status_code == 400

    def test_delete_workspace_protected_templates(self, client):
        """Cannot delete the 'templates' workspace."""
        res = client.delete("/api/workspaces/templates")
        assert res.status_code == 400

    def test_delete_workspace_not_found(self, client):
        """Deleting a non-existent workspace returns 404."""
        fake_ws_id = str(uuid4())
        res = client.delete(f"/api/workspaces/{fake_ws_id}")
        assert res.status_code == 404

    def test_delete_workspace_path_traversal_blocked(self, client):
        """Path traversal attempts in workspace_id are rejected."""
        res = client.delete("/api/workspaces/..evil..dir")
        assert res.status_code == 400
        assert "traversal" in res.json()["detail"].lower()

    def test_delete_workspace_removes_all_stages(self, client, isolated_data_dir):
        """Deleting a workspace removes documents across all stages."""
        ws_id = str(uuid4())

        # Create a catalog
        self._create_workspace_with_doc(client, ws_id)

        # Create a profile in the same workspace
        profile_uuid = str(uuid4())
        catalog_uuid = str(uuid4())
        profile_payload = {
            "profile": {
                "uuid": profile_uuid,
                "metadata": {
                    "title": "Cleanup Test Profile",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2",
                    "last-modified": "2026-01-01T00:00:00Z"
                },
                "imports": [{"href": f"#{catalog_uuid}"}]
            }
        }
        res = client.post(
            "/api/documents/profile",
            json=profile_payload,
            headers={"X-Workspace-ID": ws_id},
        )
        assert res.status_code == 201, f"Profile creation failed: {res.text}"

        # Verify both stage directories exist
        ws_dir = os.path.abspath(os.path.join(isolated_data_dir, "..", ws_id))
        assert os.path.isdir(os.path.join(ws_dir, "catalogs"))
        assert os.path.isdir(os.path.join(ws_dir, "profiles"))

        # Delete entire workspace
        res = client.delete(f"/api/workspaces/{ws_id}")
        assert res.status_code == 200

        # Verify everything is gone
        assert not os.path.exists(ws_dir)

    def test_delete_workspace_idempotent_after_deletion(self, client, isolated_data_dir):
        """Attempting to delete an already-deleted workspace returns 404."""
        ws_id = str(uuid4())
        self._create_workspace_with_doc(client, ws_id)

        # First delete succeeds
        res = client.delete(f"/api/workspaces/{ws_id}")
        assert res.status_code == 200

        # Second delete returns 404
        res = client.delete(f"/api/workspaces/{ws_id}")
        assert res.status_code == 404
