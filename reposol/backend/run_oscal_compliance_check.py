import os
import sys
import json
import traceback

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
sys.path.insert(0, os.path.dirname(__file__))

from app.validation import validate_document, OSCALValidationError, STAGE_ROOT_KEYS
from app.storage import DATA_DIR, is_valid_uuid

def check_stage(stage):
    stage_dir = os.path.join(DATA_DIR, stage)
    if not os.path.exists(stage_dir):
        print(f"Directory {stage_dir} does not exist. Skipping.")
        return [], []

    passed_files = []
    failed_files = []
    
    print(f"\n--- Checking {stage} ---")
    for filename in os.listdir(stage_dir):
        if not filename.endswith(".json"):
            continue
        # Strip extension
        doc_id = filename[:-5]
        # Skip if it is not a valid UUID (or if it ends with _draft)
        is_draft = doc_id.endswith("_draft")
        clean_uuid = doc_id[:-6] if is_draft else doc_id
        if not is_valid_uuid(clean_uuid):
            continue
            
        file_path = os.path.join(stage_dir, filename)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                doc = json.load(f)
            
            # Validate document schema
            validate_document(stage, doc, check_refs=False)
            
            # If schema passes, check references if applicable
            ref_error = None
            if stage in ["profiles", "ssps"]:
                try:
                    validate_document(stage, doc, check_refs=True)
                except Exception as e:
                    ref_error = str(e)
            
            if ref_error:
                print(f"[WARN] {filename}: Schema OK, but Reference/Semantic error: {ref_error}")
                passed_files.append((filename, f"Schema OK, Ref/Semantic error: {ref_error}"))
            else:
                print(f"[PASS] {filename}")
                passed_files.append((filename, "Fully Valid"))
                
        except OSCALValidationError as e:
            errors_str = "; ".join([f"{err['path']}: {err['message']}" for err in e.errors])
            print(f"[FAIL] {filename}: {errors_str}")
            failed_files.append((filename, errors_str))
        except Exception as e:
            print(f"[FAIL] {filename}: {str(e)}")
            failed_files.append((filename, str(e)))
            
    return passed_files, failed_files

if __name__ == "__main__":
    # Normalized stages as expected by STAGE_ROOT_KEYS / validate_document
    stages = ["catalogs", "profiles", "ssps", "component-definitions", "assessment-plans", "assessment-results", "poams", "control-mappings"]
    
    total_passed = 0
    total_failed = 0
    
    report = {}
    for stage in stages:
        passed, failed = check_stage(stage)
        report[stage] = {"passed": passed, "failed": failed}
        total_passed += len(passed)
        total_failed += len(failed)
        
    print("\n==========================================")
    print(f"Summary: {total_passed} passed/warned, {total_failed} failed.")
    print("==========================================")
    
    # Save the output to a JSON file
    with open(os.path.join(DATA_DIR, "compliance_check_results.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
