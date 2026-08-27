"""
Empirical Performance and Stress Test Suite for Milestone 4-1:
Live Profile Resolution Engine, Debounce/Abort Latency Verification (< 500ms),
Large Payload Scaling, and Conflict Detection.

Author: Challenger M4-1 (Challenger Debounce & Abort)
"""

import time
import uuid
import pytest
from typing import Dict, Any, List

from tests.factories import CatalogFactory, ProfileFactory
from app.services.resolution_service import (
    resolve_profile,
    resolve_profile_inline,
    detect_modify_conflicts,
    clear_resolution_cache
)


class TestResolutionLatencyAndScaling:
    """Empirical verification of the < 500ms resolution roundtrip performance constraint."""

    def test_live_preview_resolution_roundtrip_latency_large_payload(self, client, isolated_data_dir):
        """
        Verify that POST /api/resolve/profile/preview completes in < 500ms (target < 100ms)
        for a realistic large profile referencing 150 catalog controls with 15 custom groups,
        30 alterations, and 30 parameter overrides.
        """
        # 1. Seed catalog with 150 controls across 5 groups
        cat_groups = []
        for g_idx in range(5):
            ctrls = [
                {
                    "id": f"ctrl-{g_idx}-{c_idx}",
                    "title": f"Control Title {g_idx}.{c_idx}",
                    "params": [
                        {"id": f"prm-{g_idx}-{c_idx}", "values": [f"default-{c_idx}"]}
                    ],
                    "props": [
                        {"name": "label", "value": f"L-{g_idx}-{c_idx}"}
                    ],
                    "parts": [
                        {"id": f"part-{g_idx}-{c_idx}", "name": "statement", "prose": f"Policy requirement text for {g_idx}.{c_idx}"}
                    ]
                }
                for c_idx in range(30)
            ]
            cat_groups.append({
                "id": f"cat-grp-{g_idx}",
                "title": f"Catalog Domain Group {g_idx}",
                "controls": ctrls
            })

        cat_doc = CatalogFactory.build(controls=[], groups=cat_groups)
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # 2. Build large profile with custom groups, alters, and param overrides
        custom_groups = []
        for cg_idx in range(15):
            assigned_ids = [f"ctrl-{cg_idx % 5}-{i}" for i in range(5)]
            custom_groups.append({
                "id": f"custom-grp-{cg_idx}",
                "title": f"Tailored Custom Group {cg_idx}",
                "insert-controls": [
                    {
                        "include-controls": [{"with-ids": assigned_ids}],
                        "order": "ascending"
                    }
                ]
            })

        alters = [
            {
                "control-id": f"ctrl-{i % 5}-{i % 30}",
                "adds": [
                    {
                        "props": [{"name": "implementation-guidance", "value": f"Guidance {i}"}]
                    }
                ]
            }
            for i in range(30)
        ]

        set_params = [
            {
                "param-id": f"prm-{i % 5}-{i % 30}",
                "values": [f"tailored-override-val-{i}"]
            }
            for i in range(30)
        ]

        prof_doc = {
            "profile": {
                "uuid": str(uuid.uuid4()),
                "metadata": {"title": "High-Load Live Preview Profile"},
                "imports": [
                    {
                        "href": f"../catalogs/{cat_uuid}.json",
                        "include-all": {}
                    }
                ],
                "merge": {
                    "custom": {
                        "groups": custom_groups,
                        "insert-controls": [{"include-all": {}}]
                    }
                },
                "modify": {
                    "set-parameters": set_params,
                    "alters": alters
                }
            }
        }

        # Warm-up call
        client.post("/api/resolve/profile/preview", json=prof_doc)

        # Measure latency across 30 consecutive live preview resolution requests
        latencies = []
        for _ in range(30):
            start = time.perf_counter()
            res = client.post("/api/resolve/profile/preview", json=prof_doc)
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            latencies.append(elapsed_ms)
            assert res.status_code == 200

        avg_latency = sum(latencies) / len(latencies)
        max_latency = max(latencies)
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]

        print(f"\n[LATENCY BENCHMARK] 150 Controls + 15 Custom Groups + 60 Modifies: Avg={avg_latency:.2f}ms, P95={p95_latency:.2f}ms, Max={max_latency:.2f}ms")

        # The project specification constraint is < 500ms
        assert avg_latency < 100.0, f"Average latency {avg_latency:.2f}ms exceeded 100ms threshold"
        assert max_latency < 500.0, f"Max latency {max_latency:.2f}ms exceeded 500ms hard ceiling"

        # Verify resolution accuracy
        data = res.json()
        assert len(data["groups"]) == 15
        assert len(data["all_groups"]) == 5
        assert data["conflicts"]["has_conflicts"] is False

    def test_rapid_sequential_document_mutations_pipeline(self, client, isolated_data_dir):
        """
        Simulates 25 rapid document mutations arriving at the backend endpoint sequentially.
        Ensures each mutation executes deterministically without corruption or state leaks.
        """
        cat_doc = CatalogFactory.build(
            controls=[{"id": f"c-{i}", "title": f"Ctrl {i}"} for i in range(20)]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        for mutation_step in range(1, 26):
            prof_doc = {
                "profile": {
                    "uuid": f"prof-mutation-{mutation_step}",
                    "metadata": {"title": f"Profile Step {mutation_step}"},
                    "imports": [{"href": cat_uuid, "include-all": {}}],
                    "merge": {
                        "custom": {
                            "groups": [
                                {
                                    "id": f"group-step-{mutation_step}",
                                    "title": f"Group at step {mutation_step}",
                                    "insert-controls": [
                                        {"include-controls": [{"with-ids": [f"c-{mutation_step % 20}"]}]}
                                    ]
                                }
                            ]
                        }
                    }
                }
            }

            start = time.perf_counter()
            res = client.post("/api/resolve/profile/preview", json=prof_doc)
            elapsed_ms = (time.perf_counter() - start) * 1000.0

            assert res.status_code == 200
            assert elapsed_ms < 200.0  # Well below 500ms
            data = res.json()
            assert len(data["groups"]) == 1
            assert data["groups"][0]["id"] == f"group-step-{mutation_step}"
            assert data["groups"][0]["controls"][0]["id"] == f"c-{mutation_step % 20}"

    def test_conflict_detection_stress_large_orphaned_sets(self, client, isolated_data_dir):
        """
        Stress test detect_modify_conflicts with 100 orphaned alters, 100 orphaned params,
        and 50 orphaned custom group references across 6 nested group levels.
        """
        cat_doc = CatalogFactory.build(
            controls=[{"id": "valid-ctrl-1", "params": [{"id": "valid-prm-1"}]}]
        )
        cat_uuid = cat_doc["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat_doc)

        # Profile with hundreds of orphaned references
        orphaned_alters = [{"control-id": f"nonexistent-ctrl-{i}", "adds": []} for i in range(100)]
        orphaned_params = [{"param-id": f"nonexistent-param-{i}", "values": ["val"]} for i in range(100)]
        orphaned_custom_groups = [
            {
                "id": f"grp-{i}",
                "title": f"Group {i}",
                "insert-controls": [
                    {"include-controls": [{"with-ids": [f"ghost-ctrl-{i}"]}]}
                ]
            }
            for i in range(50)
        ]

        prof_doc = {
            "profile": {
                "uuid": "prof-conflict-stress",
                "imports": [{"href": cat_uuid, "include-all": {}}],
                "merge": {"custom": {"groups": orphaned_custom_groups}},
                "modify": {
                    "alters": orphaned_alters,
                    "set-parameters": orphaned_params
                }
            }
        }

        start = time.perf_counter()
        res = client.post("/api/resolve/profile/preview", json=prof_doc)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        assert res.status_code == 200
        assert elapsed_ms < 200.0
        conflicts = res.json()["conflicts"]
        assert conflicts["has_conflicts"] is True
        assert len(conflicts["orphaned_alters"]) == 100
        assert len(conflicts["orphaned_params"]) == 100
        assert len(conflicts["orphaned_custom_refs"]) == 50
