"""
Integration and semantic validation tests for Profiles (US 2.6).
"""
import uuid
import pytest
from jsonschema import ValidationError
from app.validation import validate_document
from tests.factories import ProfileFactory

class TestProfileValidation:
    """Tests for Profile validation endpoint and custom validation logic."""

    def test_api_validate_profile_success(self, client, isolated_data_dir):
        # Build a valid profile with at least one import (OSCAL schema minItems constraint)
        prof_doc = ProfileFactory.importing(catalog_uuid=str(uuid.uuid4()))
        
        # Validate via endpoint - should return 200
        res = client.post("/api/validate/profiles", json=prof_doc)
        assert res.status_code == 200
        assert res.json() == {"status": "valid", "stage": "profiles"}

    def test_api_validate_profile_invalid_schema(self, client, isolated_data_dir):
        # Build profile with invalid UUID format
        prof_doc = ProfileFactory.build(doc_id="invalid-uuid-format")
        # Ensure it has an import to not fail on the minItems imports validation first
        prof_doc["profile"]["imports"] = [{"href": f"../catalogs/{str(uuid.uuid4())}.json", "include-all": {}}]
        
        # Validate via endpoint - should return 400 due to validation failure
        res = client.post("/api/validate/profiles", json=prof_doc)
        assert res.status_code == 400
        data = res.json()
        assert "Validation failed" in data["detail"]
        assert len(data["errors"]) > 0

    def test_api_validate_profile_missing_root_key(self, client, isolated_data_dir):
        # Send empty dictionary or dictionary missing 'profile' root key
        res = client.post("/api/validate/profiles", json={"not-profile": {}})
        assert res.status_code == 400
        assert "Missing required root key" in res.json()["detail"]

    def test_direct_validate_document_semantic_merge_constraint(self):
        # A profile with multiple merge keys (flat, as-is) directly validated
        # without preprocessing should raise ValidationError.
        profile_doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Conflicting Merge Profile",
                    "last-modified": "2026-07-19T10:00:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.1.2"
                },
                "imports": [{"href": f"../catalogs/{uuid.uuid4()}.json", "include-all": {}}],
                "merge": {
                    "flat": {},
                    "as-is": True
                }
            }
        }
        
        # Direct validation without preprocessing should raise ValidationError
        with pytest.raises(ValidationError) as excinfo:
            validate_document("profiles", profile_doc)
        
        assert "Profile merge must specify only one of flat, as-is, or custom" in str(excinfo.value)
