import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { ARFindingsImportModal } from '../ARFindingsImportModal';
import * as api from '../../../lib/api';
import * as queryHooks from '../../../hooks/useDocumentQuery';

vi.mock('../../../lib/api', () => ({
  fetchDocument: vi.fn(),
}));

vi.mock('../../../hooks/useDocumentQuery', () => ({
  useDocumentListQuery: vi.fn(),
}));

const mockArList = [
  {
    id: 'ar-doc-101',
    title: 'Q3 Security Assessment Results',
    version: '1.0.0',
  },
];

const mockArDoc = {
  'assessment-results': {
    uuid: 'ar-doc-101',
    results: [
      {
        uuid: 'result-1',
        observations: [
          {
            uuid: 'obs-1',
            title: 'Exposed Database Port',
            description: 'Port 5432 is publicly accessible',
          },
        ],
        risks: [
          {
            uuid: 'risk-1',
            title: 'High Severity Database Leak Risk',
            status: 'open',
          },
        ],
        findings: [
          {
            uuid: 'finding-1',
            title: 'Database Storage Unencrypted',
            description: 'Data volume is not encrypted',
            target: {
              'target-id': 'ac-2_smt',
              status: { state: 'not-satisfied' },
            },
            'related-observations': [{ 'observation-uuid': 'obs-1' }],
            'related-risks': [{ 'risk-uuid': 'risk-1' }],
          },
          {
            uuid: 'finding-2',
            title: 'Password Complexity Validated',
            description: 'Password rules enforced',
            target: {
              'target-id': 'ia-5_smt',
              status: { state: 'satisfied' },
            },
          },
        ],
      },
    ],
  },
};

describe('ARFindingsImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (queryHooks.useDocumentListQuery as any).mockReturnValue({
      data: mockArList,
      isLoading: false,
    });
    (api.fetchDocument as any).mockResolvedValue(mockArDoc);
  });

  it('renders step 1 and lists available AR documents', () => {
    render(<ARFindingsImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText('Import Findings from Assessment Results')).toBeInTheDocument();
    expect(screen.getByText('Q3 Security Assessment Results')).toBeInTheDocument();
  });

  it('selects an AR document and navigates to step 2 displaying unsatisfied findings', async () => {
    render(<ARFindingsImportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} />);

    const card = screen.getByTestId('ar-doc-card-ar-doc-101');
    await act(async () => {
      fireEvent.click(card);
    });

    await waitFor(() => {
      expect(api.fetchDocument).toHaveBeenCalledWith('assessment-results', 'ar-doc-101');
      expect(screen.getByText('Found 1 Unsatisfied Finding(s)')).toBeInTheDocument();
      expect(screen.getByText('Database Storage Unencrypted')).toBeInTheDocument();
      expect(screen.queryByText('Password Complexity Validated')).not.toBeInTheDocument();
    });
  });

  it('allows step 2 next navigation to step 3 preview and confirms import', async () => {
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(<ARFindingsImportModal isOpen={true} onClose={onClose} onImport={onImport} />);

    // Step 1 -> Select AR
    await act(async () => {
      fireEvent.click(screen.getByTestId('ar-doc-card-ar-doc-101'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('btn-next-preview')).toBeInTheDocument();
    });

    // Step 2 -> Click Next: Preview
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-next-preview'));
    });

    // Step 3 -> Preview
    expect(screen.getByText('Remediate: Database Storage Unencrypted')).toBeInTheDocument();

    // Confirm Import
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-confirm-import'));
    });

    expect(onImport).toHaveBeenCalledTimes(1);
    const [items, obs, risks] = onImport.mock.calls[0];
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Remediate: Database Storage Unencrypted');
    expect(items[0]['related-findings'][0]['finding-uuid']).toBe('finding-1');
    expect(obs.length).toBe(1);
    expect(obs[0].uuid).toBe('obs-1');
    expect(risks.length).toBe(1);
    expect(risks[0].uuid).toBe('risk-1');

    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ARFindingsImportModal isOpen={false} onClose={vi.fn()} onImport={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
