import re

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/api/document_routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Body import if not exists
if 'from fastapi import' in content and 'Body' not in content:
    content = re.sub(r'from fastapi import APIRouter, HTTPException, Depends, Request, Response', 'from fastapi import APIRouter, HTTPException, Depends, Request, Response, Body', content)

new_save_doc = '''@router.post("/api/documents/{stage}")
async def save_doc(stage: str, response: Response, body: Dict[str, Any] = Body(...), ws_id: str = Depends(get_workspace_id)):
    """Save or update a document (checks schema validation)."""
    normalized = normalize_stage(stage)
    
    root_key = STAGE_ROOT_KEYS[normalized]
    try:
        doc_id = body[root_key]["uuid"]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Missing uuid under root key '{root_key}'")

    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format in document: '{doc_id}'")

    try:
        existed = await save_document(normalized, doc_id, body, workspace_id=ws_id)
        response.status_code = 200 if existed else 201
        return await get_document(normalized, doc_id, workspace_id=ws_id) if normalized == "profiles" else body
    except ValidationError as e:
        return validation_error_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal persistence error: {str(e)}")
'''

content = re.sub(r'@router\.post\("/api/documents/\{stage\}"\)\s*async def save_doc\(stage: str, request: Request, response: Response, ws_id: str = Depends\(get_workspace_id\)\):.*?except Exception as e:\n        raise HTTPException\(status_code=500, detail=f"Internal persistence error: \{str\(e\)\}"\)\n', new_save_doc, content, flags=re.DOTALL)

new_validate_doc = '''@router.post("/api/validate/{stage}")
async def validate_doc(stage: str, body: Dict[str, Any] = Body(...), ws_id: str = Depends(get_workspace_id)):
    """Validate a document against the stage's schema without saving."""
    normalized = normalize_stage(stage)
        
    try:
        if normalized == "profiles":
            validation_body = await preprocess_profile_for_saving(body, persist_local_catalog=False, workspace_id=ws_id)
        elif normalized == "catalogs":
            validation_body = preprocess_catalog_for_saving(body)
        else:
            validation_body = remove_empty_arrays(body)
        await validate_document(normalized, validation_body, workspace_id=ws_id)
        return {"status": "valid", "stage": normalized}
    except ValidationError as e:
        return validation_error_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")
'''

content = re.sub(r'@router\.post\("/api/validate/\{stage\}"\)\s*async def validate_doc\(stage: str, request: Request, ws_id: str = Depends\(get_workspace_id\)\):.*?except Exception as e:\n        return JSONResponse\(status_code=400, content=\{"detail": f"Validation failed: \{str\(e\)\}", "errors": \[\]\}\)\n', new_validate_doc, content, flags=re.DOTALL)


# Fix version routes for Body()
with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/api/document_routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE")
