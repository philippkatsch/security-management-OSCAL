import re

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/services/profile_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = re.sub(r'import aiofiles\nimport aiofiles\.os\n', '', content)
content = re.sub(r'from app\.repositories\.workspace_repository import get_stage_dir\n', '', content)
content = re.sub(
    r'from app\.validation import validate_document\n',
    'from app.validation import validate_document\nfrom app.utils.oscal_transform_utils import _normalize_replacement_part_ids, remove_empty_arrays\nfrom app.repositories import document_repository\n',
    content
)

# 2. _is_managed_local_catalog_import
content = re.sub(
    r'    catalogs_dir = await get_stage_dir\("catalogs", workspace_id\)\n    catalog_path = os\.path\.join\(catalogs_dir, f"\{catalog_uuid\}\.json"\)\n    try:\n        async with aiofiles\.open\(catalog_path, "r", encoding="utf-8"\) as f:\n            catalog = json\.loads\(await f\.read\(\)\)\.get\("catalog", \{\}\)\n    except \(OSError, json\.JSONDecodeError\):\n        return False',
    '    try:\n        catalog_doc = await document_repository.get_document("catalogs", catalog_uuid, workspace_id=workspace_id)\n        catalog = catalog_doc.get("catalog", {})\n    except (FileNotFoundError, ValueError):\n        return False',
    content
)

# 3. Remove _normalize_replacement_part_ids and remove_empty_arrays functions completely
content = re.sub(r'def _normalize_replacement_part_ids.*?def preprocess_profile_for_saving', 'def preprocess_profile_for_saving', content, flags=re.DOTALL)

# 4. preprocess_profile_for_saving saving local catalog
content = re.sub(
    r'        if persist_local_catalog:\n            catalogs_dir = await get_stage_dir\("catalogs", workspace_id\)\n            local_catalog_path = os\.path\.join\(catalogs_dir, f"\{local_catalog_uuid\}\.json"\)\n            async with aiofiles\.open\(local_catalog_path, "w", encoding="utf-8"\) as f:\n                await f\.write\(json\.dumps\(catalog_doc, indent=2, ensure_ascii=False\)\)',
    '        if persist_local_catalog:\n            await document_repository.save_document("catalogs", local_catalog_uuid, catalog_doc, workspace_id=workspace_id)',
    content
)

# 5. prune_orphaned_alters
content = re.sub(
    r'    catalogs_dir = await get_stage_dir\("catalogs", workspace_id\)\n\n    # 1\. Include local-controls if present\n',
    '    # 1. Include local-controls if present\n',
    content
)
content = re.sub(
    r'        cat_path = os\.path\.join\(catalogs_dir, f"\{cat_uuid\}\.json"\)\n        if await aiofiles\.os\.path\.exists\(cat_path\):\n            found_any_catalog = True\n            try:\n                async with aiofiles\.open\(cat_path, "r", encoding="utf-8"\) as f:\n                    cat_doc = json\.loads\(await f\.read\(\)\)\n                    cat_obj = cat_doc\.get\("catalog", \{\}\)',
    '        if await document_repository.document_exists("catalogs", cat_uuid, workspace_id=workspace_id):\n            found_any_catalog = True\n            try:\n                cat_doc = await document_repository.get_document("catalogs", cat_uuid, workspace_id=workspace_id)\n                cat_obj = cat_doc.get("catalog", {})',
    content
)
content = re.sub(
    r'            except Exception as e:\n                logger\.warning\("Failed to read catalog %s for alter pruning: %s", cat_path, str\(e\)\)',
    '            except Exception as e:\n                logger.warning("Failed to read catalog %s for alter pruning: %s", cat_uuid, str(e))',
    content
)

# 6. postprocess_profile_for_loading
content = re.sub(
    r'    catalogs_dir = await get_stage_dir\("catalogs", workspace_id\)\n    for imp in imports:\n',
    '    for imp in imports:\n',
    content
)
content = re.sub(
    r'        catalog_path = os\.path\.join\(catalogs_dir, f"\{ref_uuid\}\.json"\)\n        if await aiofiles\.os\.path\.exists\(catalog_path\):\n            try:\n                async with aiofiles\.open\(catalog_path, "r", encoding="utf-8"\) as f:\n                    cat_doc = json\.loads\(await f\.read\(\)\)\n                    if await _is_managed_local_catalog_import\(imp, workspace_id\):\n                        local_controls = cat_doc\["catalog"\]\.get\("controls", \[\]\)\n                        break\n            except \(OSError, json\.JSONDecodeError, KeyError\):\n                pass',
    '        if await document_repository.document_exists("catalogs", ref_uuid, workspace_id=workspace_id):\n            try:\n                cat_doc = await document_repository.get_document("catalogs", ref_uuid, workspace_id=workspace_id)\n                if await _is_managed_local_catalog_import(imp, workspace_id):\n                    local_controls = cat_doc.get("catalog", {}).get("controls", [])\n                    break\n            except Exception:\n                pass',
    content
)

# 7. cleanup_local_catalogs
new_cleanup = '''async def cleanup_local_catalogs(workspace_id: Optional[str] = None) -> None:
    """Deletes local-controls catalogs that are no longer referenced by any profile or profile version."""
    referenced_uuids = set()
    
    profiles = await document_repository.list_documents_by_stage("profiles", workspace_id=workspace_id)
    for doc in profiles:
        if "profile" in doc:
            for imp in doc["profile"].get("imports", []):
                catalog_uuid = _catalog_uuid_from_href(imp.get("href", ""))
                if catalog_uuid:
                    referenced_uuids.add(catalog_uuid)
                    
    catalogs = await document_repository.list_documents_by_stage("catalogs", workspace_id=workspace_id)
    for cat_doc in catalogs:
        if "catalog" in cat_doc:
            cat_meta = cat_doc["catalog"].get("metadata", {})
            is_local = False
            for prop in cat_meta.get("props", []):
                if prop.get("name") == "type" and prop.get("value") == "local-controls":
                    is_local = True
                    break
            
            if is_local:
                doc_uuid = cat_doc["catalog"].get("uuid")
                if doc_uuid and doc_uuid.lower() not in referenced_uuids:
                    try:
                        await document_repository.delete_document("catalogs", doc_uuid, workspace_id=workspace_id)
                    except Exception:
                        logger.warning("Failed to clean up local catalog %s", doc_uuid, exc_info=True)
'''
content = re.sub(r'async def cleanup_local_catalogs.*', new_cleanup, content, flags=re.DOTALL)

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/services/profile_service.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE")
