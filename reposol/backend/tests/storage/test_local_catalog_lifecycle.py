"""
Local catalog lifecycle storage tests covering:
- Extraction of local-controls into a separate catalog document
- Deterministic UUID derivation (uuid.uuid5 namespace check)
- Reconstruction of local-controls when loading profile
- Deletion / updating profile triggers cleanup of orphaned local catalogs
- cleanup_local_catalogs only affects local controls type catalogs
"""
import os
import json
import uuid
import pytest

from app.storage import (
    save_document,
    get_document,
    delete_document,
    get_stage_dir,
    cleanup_local_catalogs
)

def test_local_catalog_lifecycle(isolated_data_dir):
    profile_id = str(uuid.uuid4())
    profile_doc = {
        "profile": {
            "uuid": profile_id,
            "metadata": {
                "title": "Tailored Baseline",
                "last-modified": "2026-07-13T20:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "local-controls": [
                {
                    "id": "corp-1",
                    "title": "Corporate Training",
                    "parts": [{"id": "corp-1_smt", "name": "statement", "prose": "Training is required."}],
                }
            ],
        }
    }

    # 1. Save profile
    save_document("profiles", profile_id, profile_doc)

    # Verify profile file does NOT contain "local-controls" directly
    profiles_dir = get_stage_dir("profiles")
    with open(os.path.join(profiles_dir, f"{profile_id}.json"), encoding="utf-8") as f:
        stored_profile = json.load(f)
    assert "local-controls" not in stored_profile["profile"]
    
    # Verify imported catalog exists on disk with deterministic UUID
    # local_catalog_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"reposol-local-controls:{profile_uuid}:{version}"))
    expected_catalog_id = str(uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"reposol-local-controls:{profile_id}:1.0.0"
    ))
    catalogs_dir = get_stage_dir("catalogs")
    catalog_path = os.path.join(catalogs_dir, f"{expected_catalog_id}.json")
    assert os.path.exists(catalog_path)

    # Verify catalog contains the local controls and correct type metadata property
    with open(catalog_path, encoding="utf-8") as f:
        stored_catalog = json.load(f)
    assert stored_catalog["catalog"]["controls"][0]["id"] == "corp-1"
    assert any(
        prop.get("name") == "type" and prop.get("value") == "local-controls"
        for prop in stored_catalog["catalog"]["metadata"]["props"]
    )

    # 2. Get profile (loads it and reconstructs local-controls)
    loaded_profile = get_document("profiles", profile_id)
    assert "local-controls" in loaded_profile["profile"]
    assert loaded_profile["profile"]["local-controls"][0]["id"] == "corp-1"

    # 3. Save profile without local controls (or update version)
    profile_no_local = {
        "profile": {
            "uuid": profile_id,
            "metadata": {
                "title": "Tailored Baseline",
                "last-modified": "2026-07-13T21:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            }
        }
    }
    save_document("profiles", profile_id, profile_no_local)

    # Verify cleanup deleted the orphaned local catalog
    assert not os.path.exists(catalog_path)


def test_cleanup_local_catalogs_ignores_other_catalogs(isolated_data_dir):
    # Save a standard catalog
    standard_id = str(uuid.uuid4())
    standard_doc = {
        "catalog": {
            "uuid": standard_id,
            "metadata": {
                "title": "Standard Catalog",
                "last-modified": "2026-07-13T20:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2"
            }
        }
    }
    save_document("catalogs", standard_id, standard_doc)
    
    # Save a profile with local controls (which extracts a local catalog)
    profile_id = str(uuid.uuid4())
    profile_doc = {
        "profile": {
            "uuid": profile_id,
            "metadata": {
                "title": "Tailored Baseline",
                "last-modified": "2026-07-13T20:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.1.2",
            },
            "local-controls": [
                {
                    "id": "corp-1",
                    "title": "Corporate Training",
                    "parts": [{"id": "corp-1_smt", "name": "statement", "prose": "Training is required."}],
                }
            ],
        }
    }
    save_document("profiles", profile_id, profile_doc)
    
    # Verify both catalogs exist
    catalogs_dir = get_stage_dir("catalogs")
    standard_path = os.path.join(catalogs_dir, f"{standard_id}.json")
    expected_local_id = str(uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"reposol-local-controls:{profile_id}:1.0.0"
    ))
    local_path = os.path.join(catalogs_dir, f"{expected_local_id}.json")
    
    assert os.path.exists(standard_path)
    assert os.path.exists(local_path)
    
    # Delete the profile (orphans the local catalog)
    delete_document("profiles", profile_id)
    
    # Verify local catalog is deleted but standard catalog is NOT touched
    assert not os.path.exists(local_path)
    assert os.path.exists(standard_path)
