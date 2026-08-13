import re

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/api/version_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Body import if not exists
if 'from fastapi import' in content and 'Body' not in content:
    content = re.sub(r'from fastapi import APIRouter, HTTPException, Depends, Request', 'from fastapi import APIRouter, HTTPException, Depends, Request, Body', content)

new_save_version = '''@router.post("/api/documents/{stage}/{doc_id:path}/versions")
async def save_doc_version(stage: str, doc_id: str, body: Dict[str, Any] = Body(...), remarks: Optional[str] = None, is_draft: bool = False, ws_id: str = Depends(get_workspace_id)):
    """Save a specific version of a document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Extract version
    root_key = STAGE_ROOT_KEYS[normalized]
    try:
        version = body[root_key]["metadata"]["version"]
    except (KeyError, TypeError):
        raise HTTPException(status_code=400, detail="Missing version in document metadata")

    try:
        await save_document_version(normalized, doc_id, version, body, is_draft=is_draft, remarks=remarks, workspace_id=ws_id)
        return {"status": "success", "version": version}
    except ValidationError as e:
        return validation_error_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal persistence error: {str(e)}")
'''

content = re.sub(
    r'@router\.post\("/api/documents/\{stage\}/\{doc_id:path\}/versions"\)\s*async def save_doc_version\(stage: str, doc_id: str, request: Request, remarks: Optional\[str\] = None, is_draft: bool = False, ws_id: str = Depends\(get_workspace_id\)\):.*?except Exception as e:\n        raise HTTPException\(status_code=500, detail=f"Internal persistence error: \{str\(e\)\}"\)\n',
    new_save_version,
    content,
    flags=re.DOTALL
)

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/api/version_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE")
