"""
Integration tests for the recent-documents endpoint (US 0.5).
"""
import os
import json
import pytest
from app.validation import STAGE_ROOT_KEYS

class TestRecentDocumentsIntegration:

    def test_us0_5_recent_documents_empty(self, client, isolated_data_dir):
        """Verify that when no documents exist, the recent-documents endpoint returns an empty list."""
        response = client.get("/api/recent-documents")
        assert response.status_code == 200
        assert response.json() == []

    def test_us0_5_recent_documents_sorting_and_limit(self, client, isolated_data_dir):
        """Verify recent documents are aggregated across all stages, sorted by last-modified desc, and capped at 10."""
        # We will create 12 documents with staggered last-modified timestamps across all different stages.
        # Stages are: catalogs, profiles, ssps, component-definitions, assessment-plans, assessment-results, poams, control-mappings
        stages_cycle = [
            "catalogs",
            "profiles",
            "ssps",
            "component-definitions",
            "assessment-plans",
            "assessment-results",
            "poams",
            "control-mappings"
        ]

        documents_metadata = [
            (stages_cycle[0], "2026-07-19T01:00:00Z", "Catalog 1", 1),
            (stages_cycle[1], "2026-07-19T02:00:00Z", "Profile 2", 2),
            (stages_cycle[2], "2026-07-19T03:00:00Z", "SSP 3", 3),
            (stages_cycle[3], "2026-07-19T04:00:00Z", "Component 4", 4),
            (stages_cycle[4], "2026-07-19T05:00:00Z", "Assessment Plan 5", 5),
            (stages_cycle[5], "2026-07-19T06:00:00Z", "Assessment Results 6", 6),
            (stages_cycle[6], "2026-07-19T07:00:00Z", "POAM 7", 7),
            (stages_cycle[7], "2026-07-19T08:00:00Z", "Control Mapping 8", 8),
            (stages_cycle[0], "2026-07-19T09:00:00Z", "Catalog 9", 9),
            (stages_cycle[1], "2026-07-19T10:00:00Z", "Profile 10", 10),
            (stages_cycle[2], "2026-07-19T11:00:00Z", "SSP 11", 11),
            (stages_cycle[3], "2026-07-19T12:00:00Z", "Component 12", 12),
        ]

        # Write directly to the isolated filesystem to avoid API validation constraints
        for stage, last_mod, title, num in documents_metadata:
            root_key = STAGE_ROOT_KEYS[stage]
            # Create a valid UUIDv4 format using the number as the suffix
            uuid_str = f"a123bcde-1234-5678-abcd-{num:012d}"
            doc = {
                root_key: {
                    "uuid": uuid_str,
                    "metadata": {
                        "title": title,
                        "last-modified": last_mod,
                        "version": "1.0.0"
                    }
                }
            }
            
            stage_dir = os.path.join(isolated_data_dir, stage)
            file_path = os.path.join(stage_dir, f"{uuid_str}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(doc, f)

        # Call endpoint
        response = client.get("/api/recent-documents")
        assert response.status_code == 200
        recent_list = response.json()

        # Should be capped at 10 items
        assert len(recent_list) == 10

        # Verify sorting is descending by last-modified (newest/latest first)
        # Expected order (from newest to oldest of the top 10):
        # Component 12 (12:00), SSP 11 (11:00), Profile 10 (10:00), Catalog 9 (09:00),
        # Control Mapping 8 (08:00), POAM 7 (07:00), Assessment Results 6 (06:00),
        # Assessment Plan 5 (05:00), Component 4 (04:00), SSP 3 (03:00)
        expected_titles = [
            "Component 12", "SSP 11", "Profile 10", "Catalog 9", "Control Mapping 8",
            "POAM 7", "Assessment Results 6", "Assessment Plan 5", "Component 4", "SSP 3"
        ]
        
        actual_titles = [doc["title"] for doc in recent_list]
        assert actual_titles == expected_titles

        # Verify structural fields are present
        for doc in recent_list:
            assert "stage" in doc
            assert "uuid" in doc
            assert "title" in doc
            assert "last-modified" in doc
            assert "version" in doc
            
            # Stage should be mapped to the normalized plural directory stage name
            assert doc["stage"] in stages_cycle
