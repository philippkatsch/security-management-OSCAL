"""
Adversarial and Stress Challenger Test Suite for Step 5: Assessment Plan Builder.
Empirically challenges:
1. NIST OSCAL AP JSON Schema v1.2.2 compliance across all 9 assemblies
2. Task DAG cycle detection (self-loop, 2-node, 3-node, large 50-node ring, disconnected graph, diamond DAG)
3. Evaluation method enums (INTERVIEW, EXAMINE, TEST vs invalid/casing/typos)
4. 7 Canonical terms parts (rules-of-engagement, disclosures, assessment-inclusions, assessment-exclusions, results-delivery, assumptions, methodology vs invalid)
5. Task timing variants (on-date, within-date-range, at-frequency: valid & invalid periods, units, conflicts)
"""
import uuid
import pytest
from jsonschema import ValidationError
from app.validation import validate_document


def create_base_ap(extra=None):
    ap_id = str(uuid.uuid4())
    doc = {
        "assessment-plan": {
            "uuid": ap_id,
            "metadata": {
                "title": "Adversarial Test Assessment Plan",
                "last-modified": "2026-09-03T12:00:00Z",
                "version": "1.0.0",
                "oscal-version": "1.2.2"
            },
            "import-ssp": {
                "href": "#target-ssp-resource"
            },
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


# ============================================================================
# 1. NIST OSCAL AP JSON Schema v1.2.2 Compliance Across All 9 Assemblies
# ============================================================================
class TestAdversarialAssemblies:
    @pytest.mark.asyncio
    async def test_all_9_assemblies_simultaneously_valid(self):
        """Verify document with all 9 assemblies populated passes schema and semantic validation."""
        act_uuid = str(uuid.uuid4())
        task1_uuid = str(uuid.uuid4())
        task2_uuid = str(uuid.uuid4())
        comp_uuid = str(uuid.uuid4())
        plat_uuid = str(uuid.uuid4())
        res_uuid = str(uuid.uuid4())
        user_uuid = str(uuid.uuid4())

        doc, ap_uuid = create_base_ap({
            "local-definitions": {
                "components": [
                    {
                        "uuid": comp_uuid,
                        "type": "software",
                        "title": "Test Scanner Tool",
                        "description": "Authenticated scanner engine",
                        "status": {"state": "operational"}
                    }
                ],
                "users": [
                    {
                        "uuid": user_uuid,
                        "title": "Lead Assessor",
                        "role-ids": ["assessor"]
                    }
                ],
                "activities": [
                    {
                        "uuid": act_uuid,
                        "title": "Network Scan Activity",
                        "description": "Port and vulnerability scan",
                        "props": [{"name": "method", "value": "TEST"}],
                        "steps": [
                            {"uuid": str(uuid.uuid4()), "description": "Configure targets"},
                            {"uuid": str(uuid.uuid4()), "description": "Execute scan"}
                        ]
                    }
                ],
                "objectives-and-methods": [
                    {
                        "control-id": "ac-1",
                        "description": "Policy check",
                        "parts": [
                            {
                                "name": "assessment-method",
                                "props": [{"name": "method", "value": "EXAMINE"}]
                            }
                        ]
                    }
                ]
            },
            "terms-and-conditions": {
                "parts": [
                    {"name": "rules-of-engagement", "prose": "Authorized testing window"},
                    {"name": "methodology", "prose": "NIST SP 800-53A"}
                ]
            },
            "assessment-subjects": [
                {
                    "type": "component",
                    "description": "Production cluster",
                    "include-all": {}
                }
            ],
            "assessment-assets": {
                "components": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "type": "software",
                        "title": "Scanner Agent",
                        "description": "Host-level vulnerability reporting agent",
                        "status": {"state": "operational"}
                    }
                ],
                "assessment-platforms": [
                    {
                        "uuid": plat_uuid,
                        "title": "Security Test Rig",
                        "uses-components": [{"component-uuid": comp_uuid}]
                    }
                ]
            },
            "tasks": [
                {
                    "uuid": task1_uuid,
                    "title": "Initial Kickoff",
                    "type": "milestone",
                    "timing": {"on-date": {"date": "2026-10-01T08:00:00Z"}}
                },
                {
                    "uuid": task2_uuid,
                    "title": "Technical Assessment",
                    "type": "action",
                    "dependencies": [{"task-uuid": task1_uuid}],
                    "associated-activities": [
                        {
                            "activity-uuid": act_uuid,
                            "subjects": [{"type": "component", "include-all": {}}]
                        }
                    ],
                    "timing": {
                        "within-date-range": {
                            "start": "2026-10-02T08:00:00Z",
                            "end": "2026-10-10T17:00:00Z"
                        }
                    }
                }
            ],
            "back-matter": {
                "resources": [
                    {
                        "uuid": res_uuid,
                        "title": "Engagement Letter",
                        "rlinks": [{"href": f"#{res_uuid}", "media-type": "application/pdf"}]
                    }
                ]
            }
        })

        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_disallowed_root_properties_fail_schema(self):
        """Schema specifies additionalProperties: false on root assessment-plan."""
        doc, _ = create_base_ap({
            "unauthorized-extra-property": "should_fail"
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_disallowed_properties_in_terms_fail_schema(self):
        """terms-and-conditions has additionalProperties: false."""
        doc, _ = create_base_ap({
            "terms-and-conditions": {
                "parts": [{"name": "rules-of-engagement", "prose": "Valid prose"}],
                "invalid-extra": 123
            }
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_disallowed_properties_in_task_dependencies_fail_schema(self):
        """Task dependency has additionalProperties: false."""
        t1 = str(uuid.uuid4())
        t2 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {"uuid": t1, "title": "T1", "type": "action"},
                {
                    "uuid": t2,
                    "title": "T2",
                    "type": "action",
                    "dependencies": [{"task-uuid": t1, "unknown_field": "bad"}]
                }
            ]
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)


# ============================================================================
# 2. DAG Cycle Detection in Backend Validation
# ============================================================================
class TestAdversarialDAGCycleDetection:
    @pytest.mark.asyncio
    async def test_diamond_dag_passes(self):
        """
        A -> B -> D
        A -> C -> D
        Diamond structure is an acyclic DAG and must pass!
        """
        a = str(uuid.uuid4())
        b = str(uuid.uuid4())
        c = str(uuid.uuid4())
        d = str(uuid.uuid4())

        doc, _ = create_base_ap({
            "tasks": [
                {"uuid": a, "title": "A", "type": "action"},
                {"uuid": b, "title": "B", "type": "action", "dependencies": [{"task-uuid": a}]},
                {"uuid": c, "title": "C", "type": "action", "dependencies": [{"task-uuid": a}]},
                {"uuid": d, "title": "D", "type": "action", "dependencies": [{"task-uuid": b}, {"task-uuid": c}]}
            ]
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_large_cycle_50_nodes_detected(self):
        """Ring of 50 tasks: T0 -> T1 -> T2 -> ... -> T49 -> T0 must trigger cycle detection."""
        uuids = [str(uuid.uuid4()) for _ in range(50)]
        tasks = []
        for i in range(50):
            prev_idx = (i - 1) % 50
            tasks.append({
                "uuid": uuids[i],
                "title": f"Task {i}",
                "type": "action",
                "dependencies": [{"task-uuid": uuids[prev_idx]}]
            })

        doc, _ = create_base_ap({"tasks": tasks})
        with pytest.raises(ValidationError, match="Circular task dependency detected"):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_disconnected_graph_with_hidden_cycle(self):
        """Disconnected components: T1->T2 is clean; T3->T4->T3 has a cycle."""
        t1, t2, t3, t4 = [str(uuid.uuid4()) for _ in range(4)]
        doc, _ = create_base_ap({
            "tasks": [
                {"uuid": t1, "title": "T1", "type": "action"},
                {"uuid": t2, "title": "T2", "type": "action", "dependencies": [{"task-uuid": t1}]},
                {"uuid": t3, "title": "T3", "type": "action", "dependencies": [{"task-uuid": t4}]},
                {"uuid": t4, "title": "T4", "type": "action", "dependencies": [{"task-uuid": t3}]}
            ]
        })
        with pytest.raises(ValidationError, match="Circular task dependency detected"):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_nested_subtasks_cycle_detected(self):
        """Parent task contains subtasks that form a circular dependency."""
        p1 = str(uuid.uuid4())
        sub1 = str(uuid.uuid4())
        sub2 = str(uuid.uuid4())

        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": p1,
                    "title": "Parent Task",
                    "type": "milestone",
                    "tasks": [
                        {
                            "uuid": sub1,
                            "title": "Subtask 1",
                            "type": "action",
                            "dependencies": [{"task-uuid": sub2}]
                        },
                        {
                            "uuid": sub2,
                            "title": "Subtask 2",
                            "type": "action",
                            "dependencies": [{"task-uuid": sub1}]
                        }
                    ]
                }
            ]
        })
        with pytest.raises(ValidationError, match="Circular task dependency detected"):
            await validate_document("assessment-plans", doc, check_refs=False)


# ============================================================================
# 3. Evaluation Method Enums and 7 Canonical Terms Parts
# ============================================================================
class TestAdversarialEnumsAndTerms:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("invalid_method", [
        "interview", "Examine", "tEst", "AUDIT", "REVIEW"
    ])
    async def test_adversarial_activity_method_rejected(self, invalid_method):
        act_uuid = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "local-definitions": {
                "activities": [
                    {
                        "uuid": act_uuid,
                        "title": "Bad Method Activity",
                        "description": "Activity testing invalid method enum",
                        "props": [{"name": "method", "value": invalid_method}]
                    }
                ]
            }
        })
        with pytest.raises(ValidationError, match="Invalid activity assessment method"):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("empty_or_whitespace_method", [
        "", " "
    ])
    async def test_whitespace_method_rejected(self, empty_or_whitespace_method):
        act_uuid = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "local-definitions": {
                "activities": [
                    {
                        "uuid": act_uuid,
                        "title": "Bad Method Activity",
                        "description": "Activity testing invalid method string",
                        "props": [{"name": "method", "value": empty_or_whitespace_method}]
                    }
                ]
            }
        })
        # Rejected by schema string pattern or method enum
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("canonical_name", [
        "rules-of-engagement",
        "disclosures",
        "assessment-inclusions",
        "assessment-exclusions",
        "results-delivery",
        "assumptions",
        "methodology"
    ])
    async def test_all_7_canonical_terms_accepted(self, canonical_name):
        doc, _ = create_base_ap({
            "terms-and-conditions": {
                "parts": [
                    {"name": canonical_name, "prose": f"Standard clause for {canonical_name}"}
                ]
            }
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("adversarial_term_name", [
        "RULES-OF-ENGAGEMENT", "rules_of_engagement", "scope", "pricing", "confidentiality", "nda"
    ])
    async def test_non_canonical_terms_rejected(self, adversarial_term_name):
        doc, _ = create_base_ap({
            "terms-and-conditions": {
                "parts": [
                    {"name": adversarial_term_name, "prose": "Prose"}
                ]
            }
        })
        with pytest.raises(ValidationError, match="Invalid terms-and-conditions part name"):
            await validate_document("assessment-plans", doc, check_refs=False)


# ============================================================================
# 4. Task Timing Variants
# ============================================================================
class TestAdversarialTaskTimingVariants:
    @pytest.mark.asyncio
    async def test_valid_on_date_timing(self):
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "On Date Task",
                    "type": "milestone",
                    "timing": {"on-date": {"date": "2026-11-15T09:30:00Z", "remarks": "Kickoff date"}}
                }
            ]
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_invalid_on_date_missing_date_fails_schema(self):
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "Invalid On Date",
                    "type": "action",
                    "timing": {"on-date": {"remarks": "Missing required date"}}
                }
            ]
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_valid_within_date_range_timing(self):
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "Range Task",
                    "type": "action",
                    "timing": {
                        "within-date-range": {
                            "start": "2026-11-01T00:00:00Z",
                            "end": "2026-11-30T23:59:59Z"
                        }
                    }
                }
            ]
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_invalid_within_date_range_missing_end_fails(self):
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "Bad Range Task",
                    "type": "action",
                    "timing": {
                        "within-date-range": {
                            "start": "2026-11-01T00:00:00Z"
                        }
                    }
                }
            ]
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("unit", [
        "seconds", "minutes", "hours", "days", "months", "years"
    ])
    async def test_valid_at_frequency_units(self, unit):
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "Periodic Task",
                    "type": "action",
                    "timing": {
                        "at-frequency": {
                            "period": 30,
                            "unit": unit
                        }
                    }
                }
            ]
        })
        await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("bad_unit", [
        "weeks", "decades", "DAY", "hours ", "fortnight"
    ])
    async def test_invalid_at_frequency_unit_fails_schema(self, bad_unit):
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "Bad Unit Task",
                    "type": "action",
                    "timing": {
                        "at-frequency": {
                            "period": 1,
                            "unit": bad_unit
                        }
                    }
                }
            ]
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("bad_period", [0, -5, -1])
    async def test_non_positive_period_fails_schema(self, bad_period):
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "Bad Period Task",
                    "type": "action",
                    "timing": {
                        "at-frequency": {
                            "period": bad_period,
                            "unit": "days"
                        }
                    }
                }
            ]
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)

    @pytest.mark.asyncio
    async def test_conflicting_timing_variants_fail_schema(self):
        """A timing object cannot provide both on-date and within-date-range."""
        t1 = str(uuid.uuid4())
        doc, _ = create_base_ap({
            "tasks": [
                {
                    "uuid": t1,
                    "title": "Conflicting Timing",
                    "type": "action",
                    "timing": {
                        "on-date": {"date": "2026-11-01T00:00:00Z"},
                        "within-date-range": {
                            "start": "2026-11-01T00:00:00Z",
                            "end": "2026-11-10T00:00:00Z"
                        }
                    }
                }
            ]
        })
        with pytest.raises(ValidationError):
            await validate_document("assessment-plans", doc, check_refs=False)
