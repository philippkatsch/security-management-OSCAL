import re
with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/services/document_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'from app\.constants import STAGE_ROOT_KEYS',
    'from app.constants import STAGE_ROOT_KEYS\nfrom app.validation import validate_document',
    content
)

new_save = '''async def save_document(stage: str, doc_id: str, document: Dict[str, Any], workspace_id: Optional[str] = None) -> bool:
    """Preprocesses, validates and saves or updates a document."""
    if stage == "profiles":
        document = await preprocess_profile_for_saving(document, persist_local_catalog=True, workspace_id=workspace_id)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)
    else:
        document = remove_empty_arrays(document)

    await validate_document(stage, document, workspace_id=workspace_id)

    existed = await repo_save_document(stage, doc_id, document, workspace_id=workspace_id)
    await cleanup_local_catalogs(workspace_id=workspace_id)
    return existed
'''

content = re.sub(
    r'async def save_document\(stage: str, doc_id: str, document: Dict\[str, Any\], workspace_id: Optional\[str\] = None\) -> bool:.*?return existed\n',
    new_save,
    content,
    flags=re.DOTALL
)

new_save_version = '''async def save_document_version(stage: str, doc_id: str, version: str, document: Dict[str, Any], is_draft: bool = False, remarks: Optional[str] = None, workspace_id: Optional[str] = None) -> None:
    """Preprocesses, validates and saves a document version."""
    root_key = STAGE_ROOT_KEYS[stage]
    
    # Automatic revision tracking (US 0.7) - Only for official versions
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    metadata = document[root_key].setdefault("metadata", {})
    metadata["last-modified"] = now_str
    
    if not is_draft:
        revisions = metadata.setdefault("revisions", [])
        new_rev = {
            "version": version,
            "last-modified": now_str,
            "oscal-version": metadata.get("oscal-version", "1.1.2"),
            "remarks": remarks or "Version saved"
        }
        revisions.insert(0, new_rev)

    if stage == "profiles":
        document = await preprocess_profile_for_saving(document, persist_local_catalog=True, workspace_id=workspace_id)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)
    else:
        document = remove_empty_arrays(document)

    await validate_document(stage, document, workspace_id=workspace_id)

    await repo_save_document_version(stage, doc_id, version, document, is_draft=is_draft, workspace_id=workspace_id)
    await cleanup_local_catalogs(workspace_id=workspace_id)
'''

content = re.sub(
    r'async def save_document_version\(stage: str, doc_id: str, version: str, document: Dict\[str, Any\], is_draft: bool = False, remarks: Optional\[str\] = None, workspace_id: Optional\[str\] = None\) -> None:.*?await cleanup_local_catalogs\(workspace_id=workspace_id\)\n',
    new_save_version,
    content,
    flags=re.DOTALL
)

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/services/document_service.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE")
