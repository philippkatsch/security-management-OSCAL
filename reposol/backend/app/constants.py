from fastapi import HTTPException
from fastapi.responses import JSONResponse
from typing import Dict

# Stage normalization mapping
STAGE_MAPPING = {
    "catalog": "catalogs",
    "catalogs": "catalogs",
    "profile": "profiles",
    "profiles": "profiles",
    "ssp": "ssps",
    "ssps": "ssps",
    "system-security-plan": "ssps",
    "component": "component-definitions",
    "components": "component-definitions",
    "component-definition": "component-definitions",
    "component-definitions": "component-definitions",
    "assessment-plan": "assessment-plans",
    "assessment-plans": "assessment-plans",
    "assessment-result": "assessment-results",
    "assessment-results": "assessment-results",
    "poam": "poams",
    "poams": "poams",
    "control-mapping": "control-mappings",
    "control-mappings": "control-mappings",
    "mapping": "control-mappings",
    "mappings": "control-mappings",
}

OSCAL_ROOT_KEYS = {
    "catalogs": "catalog",
    "profiles": "profile",
    "ssps": "system-security-plan",
    "component-definitions": "component-definition",
    "assessment-plans": "assessment-plan",
    "assessment-results": "assessment-results",
    "poams": "plan-of-action-and-milestones",
    "control-mappings": "mapping-collection",
}

STAGE_ROOT_KEYS = OSCAL_ROOT_KEYS

def normalize_stage(stage: str) -> str:
    """Normalizes the stage name based on the specification mapping."""
    normalized = STAGE_MAPPING.get(stage.lower())
    if not normalized:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}")
    return normalized

class OSCALValidationException(HTTPException):
    def __init__(self, message: str, errors: list):
        super().__init__(status_code=400, detail=message)
        self.errors = errors

def validation_error_response(e):
    """Creates a standardized JSON response for validation errors."""
    errors = getattr(e, "errors", [])
    raise OSCALValidationException(f"Validation failed: {e.message}", errors)


DRAFT_SUFFIX = '-draft'
VERSION_SEPARATOR = '_v'
TEMP_EXTENSION = '.tmp'
LOCK_TIMEOUT = 10
