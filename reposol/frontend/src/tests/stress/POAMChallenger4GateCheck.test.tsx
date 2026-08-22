import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { POAMDashboard } from '../../components/poam/POAMDashboard';
import { ARFindingsImportModal } from '../../components/poam/ARFindingsImportModal';
import { importARFindingsAction } from '../../lib/document-actions/poam-actions';
import { produce } from 'immer';
import * as api from '../../lib/api';
import * as queryHooks from '../../hooks/useDocumentQuery';

vi.mock('../../lib/api', () => ({
  fetchDocument: vi.fn(),
}));

vi.mock('../../hooks/useDocumentQuery', () => ({
  useDocumentListQuery: vi.fn(),
}));

describe('Challenger 4 - Empirical State Management & Deduplication Gate Checks', () => {
  describe('poam-actions.ts - importARFindingsAction Deduplication', () => {
    it('deduplicates poam-items, observations, and risks by UUID', () => {
      const initialDoc = {
        'plan-of-action-and-milestones': {
          uuid: 'poam-1',
          'poam-items': [{ uuid: 'item-existing-1', title: 'Existing Item' }],
          observations: [{ uuid: 'obs-existing-1', title: 'Existing Obs' }],
          risks: [{ uuid: 'risk-existing-1', title: 'Existing Risk' }],
        },
      };

      const newItems = [
        { uuid: 'item-existing-1', title: 'Duplicate Item' },
        { uuid: 'item-new-2', title: 'New Item 2' },
      ];

      const newObs = [
        { uuid: 'obs-existing-1', title: 'Duplicate Obs' },
        { uuid: 'obs-new-2', title: 'New Obs 2' },
      ];

      const newRisks = [
        { uuid: 'risk-existing-1', title: 'Duplicate Risk' },
        { uuid: 'risk-new-2', title: 'New Risk 2' },
      ];

      const action = importARFindingsAction(newItems, newObs, newRisks);
      const nextDoc = produce(initialDoc, action.apply);

      const poam = nextDoc['plan-of-action-and-milestones'];
      expect(poam['poam-items']).toHaveLength(2);
      expect(poam['poam-items'].map((i: any) => i.uuid)).toEqual(['item-existing-1', 'item-new-2']);
      expect(poam['poam-items'][0].title).toBe('Existing Item'); // Not overwritten

      expect(poam.observations).toHaveLength(2);
      expect(poam.observations.map((o: any) => o.uuid)).toEqual(['obs-existing-1', 'obs-new-2']);

      expect(poam.risks).toHaveLength(2);
      expect(poam.risks.map((r: any) => r.uuid)).toEqual(['risk-existing-1', 'risk-new-2']);
    });

    it('handles missing collections gracefully when arrays are initially undefined', () => {
      const initialDoc = {
        'plan-of-action-and-milestones': {
          uuid: 'poam-2',
        },
      };

      const newItems = [{ uuid: 'item-1', title: 'Item 1' }];
      const newObs = [{ uuid: 'obs-1', title: 'Obs 1' }];
      const newRisks = [{ uuid: 'risk-1', title: 'Risk 1' }];

      const action = importARFindingsAction(newItems, newObs, newRisks);
      const nextDoc = produce(initialDoc, action.apply);

      const poam = nextDoc['plan-of-action-and-milestones'];
      expect(poam['poam-items']).toHaveLength(1);
      expect(poam.observations).toHaveLength(1);
      expect(poam.risks).toHaveLength(1);
    });
  });

  describe('POAMDashboard.tsx Edit Mode State Sync & ISO Date Overdue Checks', () => {
    it('supports inline editing of SSP reference and calls updateRootField', () => {
      const updateRootField = vi.fn();
      const samplePoam = {
        'import-ssp': { href: 'http://example.com/ssp-old.json' },
      };

      render(
        <POAMDashboard
          poam={samplePoam}
          isEditing={true}
          updateRootField={updateRootField}
          dashboardMetrics={[]}
          resolvedPercent={0}
          completedItems={[]}
          items={[]}
          riskStatusData={{}}
          priorityData={{}}
        />
      );

      const editBtn = screen.getByText('Edit SSP Reference');
      fireEvent.click(editBtn);

      const input = screen.getByDisplayValue('http://example.com/ssp-old.json');
      fireEvent.change(input, { target: { value: 'http://example.com/ssp-new.json' } });

      const saveBtn = screen.getByText('Save');
      fireEvent.click(saveBtn);

      expect(updateRootField).toHaveBeenCalledWith('import-ssp', { href: 'http://example.com/ssp-new.json' });
    });

    it('supports inline editing of System ID when import-ssp is not present', () => {
      const updateRootField = vi.fn();
      const samplePoam = {
        'system-id': { identifier: 'SYS-OLD' },
      };

      render(
        <POAMDashboard
          poam={samplePoam}
          isEditing={true}
          updateRootField={updateRootField}
          dashboardMetrics={[]}
          resolvedPercent={0}
          completedItems={[]}
          items={[]}
          riskStatusData={{}}
          priorityData={{}}
        />
      );

      const editBtn = screen.getByText('Edit System ID');
      fireEvent.click(editBtn);

      const input = screen.getByDisplayValue('SYS-OLD');
      fireEvent.change(input, { target: { value: 'SYS-NEW' } });

      const saveBtn = screen.getByText('Save');
      fireEvent.click(saveBtn);

      expect(updateRootField).toHaveBeenCalledWith('system-id', { identifier: 'SYS-NEW' });
    });

    it('accurately parses ISO timestamp deadlines with time components for overdue risks', () => {
      const poamWithIsoDeadline = {
        risks: [
          {
            uuid: 'risk-iso-1',
            title: 'ISO Timestamp Risk',
            status: 'open',
            deadline: '2020-05-15T14:30:00Z', // ISO string with time component
          },
        ],
      };

      render(
        <POAMDashboard
          poam={poamWithIsoDeadline}
          dashboardMetrics={[]}
          resolvedPercent={0}
          completedItems={[]}
          items={[]}
          riskStatusData={{}}
          priorityData={{}}
        />
      );

      expect(screen.getByTestId('overdue-alert-banner')).toBeInTheDocument();
      expect(screen.getByText('1 Overdue Risk(s) Detected!')).toBeInTheDocument();
    });
  });

  describe('ARFindingsImportModal.tsx State Reset on Reopen', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (queryHooks.useDocumentListQuery as any).mockReturnValue({
        data: [{ id: 'ar-1', title: 'Test AR' }],
        isLoading: false,
      });
      (api.fetchDocument as any).mockResolvedValue({
        'assessment-results': {
          uuid: 'ar-1',
          results: [],
        },
      });
    });

    it('resets modal step to 1 and clears selections when isOpen transitions to true', () => {
      const { rerender } = render(
        <ARFindingsImportModal isOpen={false} onClose={vi.fn()} onImport={vi.fn()} />
      );

      expect(screen.queryByTestId('ar-import-modal')).not.toBeInTheDocument();

      rerender(<ARFindingsImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />);

      expect(screen.getByTestId('ar-import-modal')).toBeInTheDocument();
      expect(screen.getByText('1. Select AR')).toHaveClass(/active/);
    });
  });
});
