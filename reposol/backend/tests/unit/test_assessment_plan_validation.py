"""
Unit tests for Assessment Plan (Step 5) semantic and referential integrity validation.
Covers:
- Mandatory root assemblies check (uuid, metadata, import-ssp, reviewed-controls)
- import-ssp.href existence, fragment, and URI validation
- Task dependency DAG cycle detection (Kahn's / DFS) & non-existent task reference checks
- Activity linkages to local-definitions.activities
- Assessment method enum enforcement (INTERVIEW, EXAMINE, TEST)
- Terms and conditions canonical 7 part names validation
- Valid full AP pass
"""
import os
import json
import uuid
import pytest
from jsonschema import ValidationError

from app.validation import validate_document, OSCALValidationError


def make_valid_metadata():
    return {
        "title": "Assessment Plan Document",
        "last-modified": "2026-09-02T12:00:00Z",
        "version": "1.0.0",
        "oscal-version": "1.2.2",
    }


def make_valid_ap(ssp_uuid=None, extra=None):
    ap_id = str(uuid.uuid4())
    href = f"../system-security-plans/{ssp_uuid}.json" if ssp_uuid else f"#{uuid.uuid4()}"
    doc = {
        "assessment-plan": {
            "uuid": ap_id,
            "metadata": make_valid_metadata(),
            "import-ssp": {"href": href},
            "reviewed-controls": {
                "control-selections": [
                    {
                        "include-all": {}
                    }
                ]
            }
        }
    }
    if extra:
        for k, v in extra.items():
            if isinstance(v, dict) and k in doc["assessment-plan"]:
                doc["assessment-plan"][k].update(v)
            else:
                doc["assessment-plan"][k] = v
    return doc, ap_id


def write_ssp_fixture(tmp_data_dir, ssp_uuid):
    ssp_dir = os.path.join(tmp_data_dir, "ssps")
    os.makedirs(ssp_dir, exist_ok=True)
    ssp_doc = {
        "system-security-plan": {
            "uuid": ssp_uuid,
            "metadata": make_valid_metadata(),
            "import-profile": {"href": "https://example.com/profile.json"},
            "system-characteristics": {
                "system-name": "Test Target System",
                "system-ids": [{"id": "sys-1", "identifier-type": "https://fedramp.gov"}],
                "status": {"state": "operational"},
                "authorization-boundary": {"description": "Boundary"}
            },
            "system-implementation": {
                "users": [{"uuid": str(uuid.uuid4()), "role-ids": ["admin"]}],
                "components": [{"uuid": str(uuid.uuid4()), "type": "software", "title": "Web Server", "status": {"state": "operational"}}]
            },
            "control-implementation": {
                "description": "Implemented controls",
                "implemented-requirements": [{"uuid": str(uuid.uuid4()), "control-id": "ac-1"}]
            }
        }
    }
    path = os.path.join(ssp_dir, f"{ssp_uuid}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(ssp_doc, f)
    return path


class TestAssessmentPlanRootValidation:
    @pytest.mark.asyncio
    async def test_valid_minimal_ap_passes(self):
        doc, _ = make_valid_ap()
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_missing_root_key_fails(self):
        with pytest.raises(ValidationError, match="Missing required root key"):
            await validate_document("assessment-plans", {"wrong-key": {}})

    @pytest.mark.asyncio
    async def test_missing_required_root_field_fails(self):
        doc, _ = make_valid_ap()
        del doc["assessment-plan"]["import-ssp"]
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_invalid_uuid_fails(self):
        doc, _ = make_valid_ap()
        doc["assessment-plan"]["uuid"] = "not-a-valid-uuid"
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)


class TestAssessmentPlanSSPReferenceValidation:
    @pytest.mark.asyncio
    async def test_empty_import_ssp_href_fails(self):
        doc, _ = make_valid_ap()
        doc["assessment-plan"]["import-ssp"]["href"] = ""
        with pytest.raises(ValidationError, match="empty href|href"):
            await validate_document("assessment-plans", doc, check_refs=True)

    @pytest.mark.asyncio
    async def test_nonexistent_ssp_uuid_fails(self, isolated_data_dir):
        missing_ssp_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(ssp_uuid=missing_ssp_uuid)
        with pytest.raises(ValidationError, match="does not exist"):
            await validate_document("assessment-plans", doc, check_refs=True)

    @pytest.mark.asyncio
    async def test_existing_ssp_uuid_passes(self, isolated_data_dir):
        ssp_uuid = str(uuid.uuid4())
        write_ssp_fixture(isolated_data_dir, ssp_uuid)
        doc, _ = make_valid_ap(ssp_uuid=ssp_uuid)
        await validate_document("assessment-plans", doc, check_refs=True)

    @pytest.mark.asyncio
    async def test_backmatter_resource_reference_passes(self):
        resource_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "import-ssp": {"href": f"#{resource_uuid}"},
            "back-matter": {
                "resources": [
                    {
                        "uuid": resource_uuid,
                        "title": "Embedded Target SSP",
                        "rlinks": [{"href": f"#{resource_uuid}", "media-type": "application/json"}]
                    }
                ]
            }
        })
        await validate_document("assessment-plans", doc, check_refs=True)

    @pytest.mark.asyncio
    async def test_external_https_ssp_href_passes(self):
        doc, _ = make_valid_ap(extra={
            "import-ssp": {"href": "https://compliance.example.gov/ssps/system-a.json"}
        })
        await validate_document("assessment-plans", doc, check_refs=True)


class TestAssessmentPlanTaskDAGValidation:
    @pytest.mark.asyncio
    async def test_linear_task_dependencies_passes(self):
        t1_uuid = str(uuid.uuid4())
        t2_uuid = str(uuid.uuid4())
        t3_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "tasks": [
                {
                    "uuid": t1_uuid,
                    "title": "Phase 1: Preparation",
                    "type": "milestone"
                },
                {
                    "uuid": t2_uuid,
                    "title": "Phase 2: Execution",
                    "type": "action",
                    "dependencies": [{"task-uuid": t1_uuid}]
                },
                {
                    "uuid": t3_uuid,
                    "title": "Phase 3: Wrap-up",
                    "type": "milestone",
                    "dependencies": [{"task-uuid": t2_uuid}]
                }
            ]
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_cycle_two_nodes_fails(self):
        t1_uuid = str(uuid.uuid4())
        t2_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "tasks": [
                {
                    "uuid": t1_uuid,
                    "title": "Task 1",
                    "type": "action",
                    "dependencies": [{"task-uuid": t2_uuid}]
                },
                {
                    "uuid": t2_uuid,
                    "title": "Task 2",
                    "type": "action",
                    "dependencies": [{"task-uuid": t1_uuid}]
                }
            ]
        })
        with pytest.raises(ValidationError, match="Circular task dependency detected"):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_cycle_three_nodes_fails(self):
        t1_uuid = str(uuid.uuid4())
        t2_uuid = str(uuid.uuid4())
        t3_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "tasks": [
                {
                    "uuid": t1_uuid,
                    "title": "Task A",
                    "type": "action",
                    "dependencies": [{"task-uuid": t2_uuid}]
                },
                {
                    "uuid": t2_uuid,
                    "title": "Task B",
                    "type": "action",
                    "dependencies": [{"task-uuid": t3_uuid}]
                },
                {
                    "uuid": t3_uuid,
                    "title": "Task C",
                    "type": "action",
                    "dependencies": [{"task-uuid": t1_uuid}]
                }
            ]
        })
        with pytest.raises(ValidationError, match="Circular task dependency detected"):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_self_dependency_fails(self):
        t1_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "tasks": [
                {
                    "uuid": t1_uuid,
                    "title": "Self Dependent Task",
                    "type": "action",
                    "dependencies": [{"task-uuid": t1_uuid}]
                }
            ]
        })
        with pytest.raises(ValidationError, match="Circular task dependency detected"):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_nonexistent_task_uuid_in_dependencies_fails(self):
        t1_uuid = str(uuid.uuid4())
        missing_task_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "tasks": [
                {
                    "uuid": t1_uuid,
                    "title": "Task 1",
                    "type": "action",
                    "dependencies": [{"task-uuid": missing_task_uuid}]
                }
            ]
        })
        with pytest.raises(ValidationError, match="does not exist in document tasks"):
            await validate_document("assessment-plans", doc, check_refs=False)


class TestAssessmentPlanActivityLinkageValidation:
    @pytest.mark.asyncio
    async def test_valid_activity_linkage_passes(self):
        act_uuid = str(uuid.uuid4())
        task_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "local-definitions": {
                "activities": [
                    {
                        "uuid": act_uuid,
                        "title": "Penetration Testing Procedure",
                        "description": "Execute network scans and exploitation tests",
                        "props": [{"name": "method", "value": "TEST"}]
                    }
                ]
            },
            "tasks": [
                {
                    "uuid": task_uuid,
                    "title": "Pen Test Execution Task",
                    "type": "action",
                    "associated-activities": [
                        {
                            "activity-uuid": act_uuid,
                            "subjects": [
                                {
                                    "type": "component",
                                    "include-all": {}
                                }
                            ]
                        }
                    ]
                }
            ]
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_nonexistent_activity_uuid_fails(self):
        valid_other_act_uuid = str(uuid.uuid4())
        missing_act_uuid = str(uuid.uuid4())
        task_uuid = str(uuid.uuid4())
        doc, _ = make_valid_ap(extra={
            "local-definitions": {
                "activities": [
                    {
                        "uuid": valid_other_act_uuid,
                        "title": "Other Activity",
                        "description": "Other activity description"
                    }
                ]
            },
            "tasks": [
                {
                    "uuid": task_uuid,
                    "title": "Action Task",
                    "type": "action",
                    "associated-activities": [
                        {
                            "activity-uuid": missing_act_uuid,
                            "subjects": [{"type": "component", "include-all": {}}]
                        }
                    ]
                }
            ]
        })
        with pytest.raises(ValidationError, match="does not exist in local-definitions.activities"):
            await validate_document("assessment-plans", doc, check_refs=False)


class TestAssessmentPlanMethodEnumsValidation:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("method", ["INTERVIEW", "EXAMINE", "TEST"])
    async def test_valid_method_enums_pass(self, method):
        doc, _ = make_valid_ap(extra={
            "local-definitions": {
                "objectives-and-methods": [
                    {
                        "control-id": "ac-2",
                        "description": "Account management objective",
                        "parts": [
                            {
                                "name": "assessment-method",
                                "props": [{"name": "method", "value": method}],
                                "parts": [{"name": "assessment-objects", "prose": "Evidence logs"}]
                            }
                        ]
                    }
                ]
            }
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("invalid_method", ["interview", "examine", "test", "INSPECT", "CUSTOM"])
    async def test_invalid_method_enum_fails(self, invalid_method):
        doc, _ = make_valid_ap(extra={
            "local-definitions": {
                "objectives-and-methods": [
                    {
                        "control-id": "ac-2",
                        "parts": [
                            {
                                "name": "assessment-method",
                                "props": [{"name": "method", "value": invalid_method}],
                                "parts": [{"name": "assessment-objects", "prose": "Evidence logs"}]
                            }
                        ]
                    }
                ]
            }
        })
        with pytest.raises(ValidationError, match="Invalid assessment method"):
            await validate_document("assessment-plans", doc, check_refs=False)


class TestAssessmentPlanTermsValidation:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("part_name", [
        "rules-of-engagement",
        "disclosures",
        "assessment-inclusions",
        "assessment-exclusions",
        "results-delivery",
        "assumptions",
        "methodology"
    ])
    async def test_canonical_terms_part_names_pass(self, part_name):
        doc, _ = make_valid_ap(extra={
            "terms-and-conditions": {
                "parts": [
                    {
                        "name": part_name,
                        "title": f"Clause for {part_name}",
                        "prose": "Standard terms and conditions prose."
                    }
                ]
            }
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("invalid_part_name", ["non-disclosure", "custom-rules", "nda", "terms"])
    async def test_invalid_terms_part_name_fails(self, invalid_part_name):
        doc, _ = make_valid_ap(extra={
            "terms-and-conditions": {
                "parts": [
                    {
                        "name": invalid_part_name,
                        "prose": "Prose"
                    }
                ]
            }
        })
        with pytest.raises(ValidationError, match="Invalid terms-and-conditions part name"):
            await validate_document("assessment-plans", doc, check_refs=False)


class TestAssessmentPlanComprehensiveFullDocument:
    @pytest.mark.asyncio
    async def test_full_rich_ap_passes(self, isolated_data_dir):
        ssp_uuid = str(uuid.uuid4())
        write_ssp_fixture(isolated_data_dir, ssp_uuid)

        act_uuid = str(uuid.uuid4())
        t1_uuid = str(uuid.uuid4())
        t2_uuid = str(uuid.uuid4())
        comp_uuid = str(uuid.uuid4())
        res_uuid = str(uuid.uuid4())

        doc = {
            "assessment-plan": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Comprehensive FedRAMP Security Assessment Plan",
                    "last-modified": "2026-09-02T15:30:00Z",
                    "version": "1.0.0",
                    "oscal-version": "1.2.2",
                    "roles": [{"id": "lead-assessor", "title": "Lead Assessor"}],
                    "parties": [{"uuid": str(uuid.uuid4()), "type": "person", "name": "Bob Assessor"}]
                },
                "import-ssp": {
                    "href": f"../system-security-plans/{ssp_uuid}.json",
                    "remarks": "Target system security plan for annual audit"
                },
                "reviewed-controls": {
                    "description": "Reviewed baseline controls",
                    "control-selections": [
                        {
                            "description": "Access Control and Audit family",
                            "include-controls": [
                                {"control-id": "ac-1"},
                                {"control-id": "ac-2", "statement-ids": ["ac-2_smt_a", "ac-2_smt_b"]}
                            ],
                            "exclude-controls": [
                                {"control-id": "ac-3"}
                            ]
                        }
                    ],
                    "control-objective-selections": [
                        {
                            "include-all": {}
                        }
                    ]
                },
                "assessment-subjects": [
                    {
                        "type": "component",
                        "description": "Scoped production components",
                        "include-all": {}
                    }
                ],
                "assessment-assets": {
                    "components": [
                        {
                            "uuid": comp_uuid,
                            "type": "software",
                            "title": "Nessus Vulnerability Scanner",
                            "description": "Automated network vulnerability scanner",
                            "status": {"state": "operational"}
                        }
                    ],
                    "assessment-platforms": [
                        {
                            "uuid": str(uuid.uuid4()),
                            "title": "Assessor Scanning Rig",
                            "uses-components": [{"component-uuid": comp_uuid}]
                        }
                    ]
                },
                "local-definitions": {
                    "activities": [
                        {
                            "uuid": act_uuid,
                            "title": "Vulnerability Scan Activity",
                            "description": "Run authenticated vulnerability scans against production servers",
                            "props": [{"name": "method", "value": "TEST"}],
                            "steps": [
                                {
                                    "uuid": str(uuid.uuid4()),
                                    "description": "Configure credentialed scanner targets"
                                },
                                {
                                    "uuid": str(uuid.uuid4()),
                                    "description": "Execute scan policy"
                                }
                            ]
                        }
                    ],
                    "objectives-and-methods": [
                        {
                            "control-id": "ac-2",
                            "parts": [
                                {
                                    "name": "assessment-objective",
                                    "props": [{"name": "method-id", "value": "m-1"}],
                                    "prose": "Verify account management controls"
                                },
                                {
                                    "name": "assessment-method",
                                    "props": [{"name": "method", "value": "EXAMINE"}],
                                    "parts": [{"name": "assessment-objects", "prose": "Account management policy"}]
                                }
                            ]
                        }
                    ]
                },
                "tasks": [
                    {
                        "uuid": t1_uuid,
                        "title": "Kickoff and Scoping",
                        "type": "milestone",
                        "timing": {
                            "on-date": {"date": "2026-10-01T09:00:00Z"}
                        }
                    },
                    {
                        "uuid": t2_uuid,
                        "title": "Vulnerability Assessment Execution",
                        "type": "action",
                        "timing": {
                            "within-date-range": {
                                "start": "2026-10-02T09:00:00Z",
                                "end": "2026-10-10T17:00:00Z"
                            }
                        },
                        "dependencies": [{"task-uuid": t1_uuid}],
                        "associated-activities": [
                            {
                                "activity-uuid": act_uuid,
                                "subjects": [{"type": "component", "include-all": {}}]
                            }
                        ]
                    }
                ],
                "terms-and-conditions": {
                    "parts": [
                        {
                            "name": "rules-of-engagement",
                            "title": "Rules of Engagement",
                            "prose": "Testing permitted only during business hours."
                        },
                        {
                            "name": "methodology",
                            "title": "Assessment Methodology",
                            "prose": "NIST SP 800-53A Rev 5 assessment procedures."
                        }
                    ]
                },
                "back-matter": {
                    "resources": [
                        {
                            "uuid": res_uuid,
                            "title": "Signed Rules of Engagement.pdf",
                            "rlinks": [{"href": f"#{res_uuid}", "media-type": "application/pdf"}],
                            "base64": {
                                "filename": "Signed Rules of Engagement.pdf",
                                "media-type": "application/pdf",
                                "value": "JVBERi0xLjQK"
                            }
                        }
                    ]
                }
            }
        }

        await validate_document("assessment-plans", doc, check_refs=True)
