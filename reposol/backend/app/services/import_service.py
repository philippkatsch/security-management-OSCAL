import uuid
import httpx
from typing import Optional, Dict, Any
from app.constants import STAGE_ROOT_KEYS, STAGE_MAPPING
from app.validation import validate_document
from app.services.document_service import save_document
from app.repositories.document_repository import is_valid_uuid

class ImportServiceError(Exception):
    pass

class ImportValidationError(ImportServiceError):
    pass

def detect_stage(document: dict) -> str:
    """Auto-detect the OSCAL stage from the document root key."""
    key_to_stage = {v: k for k, v in STAGE_ROOT_KEYS.items()}
    for root_key in document:
        if root_key in key_to_stage:
            return key_to_stage[root_key]
    raise ImportServiceError(f"Cannot detect OSCAL stage. Unknown root keys: {list(document.keys())}")


async def fetch_remote_document(url: str) -> dict:
    """Fetch JSON, YAML, or XML document from a remote URL."""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                "Accept": "application/json, application/yaml, application/xml, text/plain, */*",
                "User-Agent": "Reposol-OSCAL-Manager/1.0",
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            try:
                data = response.json()
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

            text = response.text
            url_lower = url.lower()
            if url_lower.endswith((".yaml", ".yml")):
                from app.format_converter import parse_yaml_to_dict
                return parse_yaml_to_dict(text)
            elif url_lower.endswith(".xml") or (isinstance(text, str) and text.strip().startswith("<")):
                from app.format_converter import parse_xml_to_oscal_dict
                return parse_xml_to_oscal_dict(text)
            else:
                from app.format_converter import parse_yaml_to_dict
                return parse_yaml_to_dict(text)
    except httpx.TimeoutException:
        raise ImportServiceError(f"Timeout fetching URL: {url}")
    except httpx.HTTPStatusError as e:
        raise ImportServiceError(f"Remote server returned {e.response.status_code} for URL: {url}")
    except Exception as e:
        raise ImportServiceError(f"Failed to fetch URL: {str(e)}")


async def import_document(document: dict, validate: bool = True, workspace_id: Optional[str] = None, persist: bool = True) -> dict:
    """Import a document into local storage (or parse only if persist=False), with optional validation."""
    stage = detect_stage(document)
    normalized_stage = STAGE_MAPPING.get(stage, stage)
    root_key = STAGE_ROOT_KEYS.get(normalized_stage)

    if not root_key:
        raise ImportServiceError(f"Unsupported stage: {stage}")

    doc_data = document.get(root_key)
    if not doc_data:
        raise ImportServiceError(f"Document missing root key '{root_key}'")

    doc_id = doc_data.get("uuid")
    if not doc_id:
        if not persist:
            doc_id = str(uuid.uuid4())
            doc_data["uuid"] = doc_id
        else:
            raise ImportServiceError("Document missing 'uuid' field")

    if not is_valid_uuid(doc_id):
        if not persist:
            doc_id = str(uuid.uuid4())
            doc_data["uuid"] = doc_id
        else:
            raise ImportServiceError(f"Invalid UUID format: '{doc_id}'")

    if validate:
        try:
            await validate_document(normalized_stage, document, check_refs=False, workspace_id=workspace_id)
        except Exception as e:
            raise ImportValidationError(f"Schema validation failed: {str(e)}")

    if not persist:
        return {
            "status": "parsed",
            "stage": normalized_stage,
            "uuid": doc_id,
            "title": doc_data.get("metadata", {}).get("title", "Untitled"),
            "oscal_version": doc_data.get("metadata", {}).get("oscal-version", "unknown"),
            "document": document,
        }

    _, _, existed = await save_document(normalized_stage, doc_id, document, workspace_id=workspace_id, skip_validation=True)

    return {
        "status": "updated" if existed else "created",
        "stage": normalized_stage,
        "uuid": doc_id,
        "title": doc_data.get("metadata", {}).get("title", "Untitled"),
        "oscal_version": doc_data.get("metadata", {}).get("oscal-version", "unknown"),
        "document": document,
    }


async def import_findings_from_ar(
    poam_id: str,
    ar_id: str,
    finding_uuids: Optional[list] = None,
    workspace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Imports unsatisfied findings from an Assessment Results (AR) document into a POA&M document.
    Auto-generates poam-item entries and copies referenced observations, risks, and findings
    while preserving original UUIDs (DD-017 & US 7.6).
    """
    import copy
    import uuid
    from datetime import datetime, timezone
    from app.services.document_service import get_document

    if not is_valid_uuid(poam_id):
        raise ValueError(f"Invalid POA&M UUID format: '{poam_id}'")
    if not is_valid_uuid(ar_id):
        raise ValueError(f"Invalid Assessment Results UUID format: '{ar_id}'")

    # 1. Fetch target POA&M and source AR documents
    try:
        poam_doc, _ = await get_document("poams", poam_id, workspace_id=workspace_id)
    except FileNotFoundError:
        raise FileNotFoundError(f"POA&M document '{poam_id}' not found")

    try:
        ar_doc, _ = await get_document("assessment-results", ar_id, workspace_id=workspace_id)
    except FileNotFoundError:
        raise FileNotFoundError(f"Assessment Results document '{ar_id}' not found")

    ar_root = ar_doc.get("assessment-results", {})
    results = ar_root.get("results", [])

    # 2. Build index of observations, risks, and findings in source AR
    obs_map: Dict[str, Dict[str, Any]] = {}
    risk_map: Dict[str, Dict[str, Any]] = {}
    unsatisfied_findings: list = []

    target_finding_uuids = set(finding_uuids) if finding_uuids is not None else None

    for res in results:
        for obs in res.get("observations", []):
            if isinstance(obs, dict) and "uuid" in obs:
                obs_map[obs["uuid"]] = obs
        for risk in res.get("risks", []):
            if isinstance(risk, dict) and "uuid" in risk:
                risk_map[risk["uuid"]] = risk
        for finding in res.get("findings", []):
            if not isinstance(finding, dict):
                continue
            f_uuid = finding.get("uuid")
            if not f_uuid:
                continue
            if target_finding_uuids is not None and f_uuid not in target_finding_uuids:
                continue

            # Evaluate status: string or dict format
            target = finding.get("target", {})
            status = target.get("status") if isinstance(target, dict) else None
            is_unsatisfied = False
            if isinstance(status, str) and status == "not-satisfied":
                is_unsatisfied = True
            elif isinstance(status, dict) and status.get("state") == "not-satisfied":
                is_unsatisfied = True

            if is_unsatisfied:
                unsatisfied_findings.append(finding)

    # 3. Prepare POA&M structure
    poam_root = poam_doc.setdefault("plan-of-action-and-milestones", {})
    poam_items = poam_root.setdefault("poam-items", [])
    poam_obs = poam_root.setdefault("observations", [])
    poam_risks = poam_root.setdefault("risks", [])
    poam_findings = poam_root.setdefault("findings", [])

    existing_finding_ids = {f["uuid"] for f in poam_findings if isinstance(f, dict) and "uuid" in f}
    existing_obs_ids = {o["uuid"] for o in poam_obs if isinstance(o, dict) and "uuid" in o}
    existing_risk_ids = {r["uuid"] for r in poam_risks if isinstance(r, dict) and "uuid" in r}
    existing_linked_finding_ids = {
        ref["finding-uuid"]
        for item in poam_items if isinstance(item, dict)
        for ref in item.get("related-findings", [])
        if isinstance(ref, dict) and "finding-uuid" in ref
    }

    imported_findings_count = 0
    imported_obs_count = 0
    imported_risks_count = 0
    created_poam_item_ids: list = []

    # 4. Transform unsatisfied findings into poam-items & copy entities
    for finding in unsatisfied_findings:
        f_uuid = finding["uuid"]
        if f_uuid in existing_linked_finding_ids:
            continue  # Idempotent skip if already imported

        # Copy finding entity preserving original UUID
        if f_uuid not in existing_finding_ids:
            poam_findings.append(copy.deepcopy(finding))
            existing_finding_ids.add(f_uuid)

        # Copy linked observations preserving original UUIDs
        rel_obs = finding.get("related-observations", [])
        for obs_ref in rel_obs:
            if not isinstance(obs_ref, dict):
                continue
            o_uuid = obs_ref.get("observation-uuid")
            if o_uuid and o_uuid in obs_map and o_uuid not in existing_obs_ids:
                poam_obs.append(copy.deepcopy(obs_map[o_uuid]))
                existing_obs_ids.add(o_uuid)
                imported_obs_count += 1

        # Copy linked risks preserving original UUIDs
        rel_risks = finding.get("related-risks", [])
        for risk_ref in rel_risks:
            if not isinstance(risk_ref, dict):
                continue
            r_uuid = risk_ref.get("risk-uuid")
            if r_uuid and r_uuid in risk_map and r_uuid not in existing_risk_ids:
                poam_risks.append(copy.deepcopy(risk_map[r_uuid]))
                existing_risk_ids.add(r_uuid)
                imported_risks_count += 1

        # Build new poam-item
        item_uuid = str(uuid.uuid4())
        new_item: Dict[str, Any] = {
            "uuid": item_uuid,
            "title": finding.get("title", f"Remediate Finding {f_uuid[:8]}"),
            "description": finding.get("description", f"Automated remediation item for unsatisfied finding {f_uuid}"),
            "related-findings": [{"finding-uuid": f_uuid}],
        }
        if rel_obs:
            new_item["related-observations"] = copy.deepcopy(rel_obs)
        if rel_risks:
            new_item["related-risks"] = copy.deepcopy(rel_risks)

        poam_items.append(new_item)
        created_poam_item_ids.append(item_uuid)
        imported_findings_count += 1

    # 5. Update metadata timestamp and persist
    metadata = poam_root.setdefault("metadata", {})
    metadata["last-modified"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    saved_doc, new_etag, _ = await save_document("poams", poam_id, poam_doc, workspace_id=workspace_id)

    return {
        "status": "success",
        "message": f"Successfully imported {imported_findings_count} finding(s) into POA&M {poam_id}",
        "imported_findings_count": imported_findings_count,
        "imported_observations_count": imported_obs_count,
        "imported_risks_count": imported_risks_count,
        "poam_item_ids": created_poam_item_ids,
        "document": saved_doc,
    }

