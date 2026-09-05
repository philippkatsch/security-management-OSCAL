import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewedControlsTab } from '../../../components/assessment-plan/ReviewedControlsTab';
import { AssessmentPlan } from '../../../lib/types/oscal';

vi.mock('../../../lib/api', () => ({
  fetchDocument: vi.fn().mockResolvedValue({
    'system-security-plan': {
      'control-implementation': {
        'implemented-requirements': [
          { 'control-id': 'ac-1', description: 'Access control policy' },
          { 'control-id': 'ac-2', description: 'Account management controls' },
          { 'control-id': 'ia-2', description: 'User identification and authentication' },
        ],
      },
    },
  }),
}));

describe('ReviewedControlsTab', () => {
  const mockDispatch = vi.fn();

  const mockAP: AssessmentPlan = {
    uuid: 'ap-1',
    metadata: {
      title: 'Testing Plan',
      version: '1.0.0',
      'oscal-version': '1.2.2',
    },
    'import-ssp': {
      href: '../system-security-plans/00000000-0000-0000-0000-000000000001.json',
    },
    'reviewed-controls': {
      'control-selections': [
        {
          'include-controls': [
            { 'control-id': 'ac-1', 'statement-ids': ['ac-1_smt_a'] },
            { 'control-id': 'ac-2' },
          ],
        },
      ],
      'control-objective-selections': [
        {
          'include-all': {},
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders scoping coverage summary and control candidate items', async () => {
    render(
      <ReviewedControlsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    expect(screen.getByText('Assessment Scoping & Coverage Matrix')).toBeInTheDocument();
    expect(screen.getByText('Reviewed Controls Tree & Statement Tailoring')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ac-1')).toBeInTheDocument();
      expect(screen.getByText('ac-2')).toBeInTheDocument();
    });
  });

  it('handles Auto-Populate from SSP action', async () => {
    render(
      <ReviewedControlsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('ac-1')).toBeInTheDocument();
    });

    const autoPopBtn = screen.getByRole('button', { name: /Auto-Populate from SSP/i });
    fireEvent.click(autoPopBtn);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'POPULATE_CONTROLS_FROM_SSP',
      })
    );
  });

  it('toggles statement part tailoring for a control', async () => {
    render(
      <ReviewedControlsTab
        document={mockAP}
        dispatch={mockDispatch}
        isEditing={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('ac-1')).toBeInTheDocument();
    });

    const statementToggleButtons = screen.getAllByRole('button', { name: /Statement Tailoring/i });
    fireEvent.click(statementToggleButtons[0]);

    expect(screen.getByText('Statement Sub-Parts Scoping:')).toBeInTheDocument();
    const partButton = screen.getByRole('button', { name: /ac-1_smt_b/i });
    fireEvent.click(partButton);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_STATEMENT_IDS',
      })
    );
  });
});
