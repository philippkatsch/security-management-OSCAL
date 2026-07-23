"""
Shared pytest configuration and fixtures for backend tests.
"""
import os
import json
import pytest
import shutil
import tempfile
from fastapi.testclient import TestClient

from app.main import app


# ─────────────────────────────────────────────────────────────────────────────
# Core Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def isolated_data_dir(tmp_path, monkeypatch):
    """
    Redirect all storage operations to a temporary directory.
    Applied automatically to every test.
    Creates all standard OSCAL stage subdirectories.
    """
    import app.storage as storage_module
    tmp_data = tmp_path / "data"
    tmp_data.mkdir()

    # Create all stage subdirectories in workspaces/default and templates
    stages = [
        "catalogs", "profiles", "ssps", "component-definitions",
        "assessment-plans", "assessment-results", "poams",
        "control-mappings"
    ]
    for stage in stages:
        (tmp_data / stage).mkdir(parents=True, exist_ok=True)
        (tmp_data / "workspaces" / "default" / stage).mkdir(parents=True, exist_ok=True)
        (tmp_data / "templates" / stage).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(storage_module, "DATA_DIR", str(tmp_data))
    yield str(tmp_data)


@pytest.fixture
def client():
    """FastAPI TestClient wrapping the real app."""
    with TestClient(app) as c:
        yield c


# ─────────────────────────────────────────────────────────────────────────────
# Convenience Fixtures for Common Patterns
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def saved_catalog(client):
    """
    Factory fixture that creates and saves a catalog via the API.

    Usage:
        def test_something(saved_catalog):
            doc_id, doc = saved_catalog(title="My Catalog")
    """
    from tests.factories import CatalogFactory

    created_ids = []

    def _create(**overrides):
        doc = CatalogFactory.build(**overrides)
        doc_id = doc["catalog"]["uuid"]
        res = client.post("/api/documents/catalog", json=doc)
        assert res.status_code == 201, f"Failed to save catalog: {res.text}"
        created_ids.append(doc_id)
        return doc_id, doc

    yield _create

    # Cleanup
    for doc_id in created_ids:
        try:
            client.delete(f"/api/documents/catalog/{doc_id}?force=true")
        except Exception:
            pass


@pytest.fixture
def saved_profile(client):
    """
    Factory fixture that creates and saves a profile via the API.

    Usage:
        def test_something(saved_catalog, saved_profile):
            cat_id, _ = saved_catalog()
            prof_id, doc = saved_profile(catalog_uuid=cat_id)
    """
    from tests.factories import ProfileFactory

    created_ids = []

    def _create(*, catalog_uuid: str, **overrides):
        doc = ProfileFactory.importing(catalog_uuid=catalog_uuid, **overrides)
        doc_id = doc["profile"]["uuid"]
        res = client.post("/api/documents/profile", json=doc)
        assert res.status_code == 201, f"Failed to save profile: {res.text}"
        created_ids.append(doc_id)
        return doc_id, doc

    yield _create

    # Cleanup
    for doc_id in created_ids:
        try:
            client.delete(f"/api/documents/profile/{doc_id}?force=true")
        except Exception:
            pass


@pytest.fixture
def catalog_with_controls(client):
    """
    Pre-built catalog with groups, controls, params, and enhancements.
    Returns (doc_id, doc).
    """
    from tests.factories import CatalogFactory

    doc = CatalogFactory.with_controls()
    doc_id = doc["catalog"]["uuid"]
    res = client.post("/api/documents/catalog", json=doc)
    assert res.status_code == 201, f"Failed to save catalog: {res.text}"

    yield doc_id, doc

    try:
        client.delete(f"/api/documents/catalog/{doc_id}?force=true")
    except Exception:
        pass
