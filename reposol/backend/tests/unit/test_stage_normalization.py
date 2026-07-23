"""
Unit tests for stage normalization covering:
- Stage mapping lookups
- Case insensitivity
- Invalid stage error raising
"""
import pytest
from fastapi import HTTPException
from app.routes import normalize_stage, STAGE_MAPPING

def test_normalize_stage_valid():
    # Test plural forms
    assert normalize_stage("catalogs") == "catalogs"
    assert normalize_stage("profiles") == "profiles"
    assert normalize_stage("ssps") == "ssps"
    
    # Test singular/variant forms
    assert normalize_stage("catalog") == "catalogs"
    assert normalize_stage("profile") == "profiles"
    assert normalize_stage("ssp") == "ssps"
    assert normalize_stage("component") == "component-definitions"
    assert normalize_stage("components") == "component-definitions"
    assert normalize_stage("component-definition") == "component-definitions"
    assert normalize_stage("assessment-plan") == "assessment-plans"
    assert normalize_stage("assessment-result") == "assessment-results"
    assert normalize_stage("poam") == "poams"
    assert normalize_stage("control-mapping") == "control-mappings"
    assert normalize_stage("mapping") == "control-mappings"
    assert normalize_stage("mappings") == "control-mappings"

def test_normalize_stage_case_insensitivity():
    assert normalize_stage("Catalog") == "catalogs"
    assert normalize_stage("PROFILES") == "profiles"
    assert normalize_stage("SsPs") == "ssps"

def test_normalize_stage_invalid():
    with pytest.raises(HTTPException) as exc_info:
        normalize_stage("invalid_stage")
    assert exc_info.value.status_code == 400
    assert "Invalid stage" in exc_info.value.detail
