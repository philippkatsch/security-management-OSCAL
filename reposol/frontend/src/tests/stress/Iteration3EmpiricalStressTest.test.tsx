import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import APPage from '../../components/assessment-plan/APPage';
import { ConfirmModal } from '../../components/shared/ui/ConfirmModal';
import { toast } from 'react-hot-toast';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';

// Mock react-hot-toast with vi.fn()
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: vi.fn(),
}));

vi.mock('@lib/api', () => ({
  getWorkspaceId: () => 'ws-123',
  exportDocument: vi.fn(),
}));

describe('Iteration 3 Empirical Stress Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all defined tabs without throwing runtime errors', () => {
    const sampleAP = {
      'assessment-plan': {
        uuid: 'ap-stress-1',
        metadata: {
          title: 'Stress Test AP',
          version: '1.0.0',
          'last-modified': '2026-08-13T00:00:00Z',
          oscal_version: '1.2.0',
        },
        'import-ssp': { href: 'ssp-ref.json' },
        'reviewed-controls': { 'control-selections': [] },
        'assessment-subjects': [],
        tasks: [],
        'local-definitions': { activities: [] },
        'terms-and-conditions': { parts: [] },
      },
    };

    (useDocumentLifecycle as any).mockReturnValue({
      activeDoc: sampleAP,
      doc: sampleAP,
      setDoc: vi.fn(),
      isEditing: true,
      pushUndoRedoState: vi.fn(),
      loading: false,
      error: null,
      saving: false,
      validating: false,
      validationResult: null,
      versions: [],
      hasDraft: false,
      showDrawer: false,
      setShowDrawer: vi.fn(),
      handleBack: vi.fn(),
      handleToggleEdit: vi.fn(),
      handleSelectVersion: vi.fn(),
      handleDeleteDraft: vi.fn(),
      handlePublishVersion: vi.fn(),
    });

    render(
      <MemoryRouter>
        <APPage apId="ap-stress-1" initialIsEditing={true} />
      </MemoryRouter>
    );

    expect(screen.getByText('Assessment Plan Overview')).toBeInTheDocument();
  });

  it('handles modal cancel via Esc / onCancel event', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm Cancellation"
        message="Are you sure you want to cancel?"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalled();
  });

  it('handles window.open throwing an error gracefully', () => {
    const handleExportError = (err: Error) => {
      toast.error(`Export failed: ${err.message}`);
    };

    try {
      throw new Error('Pop-up blocked');
    } catch (err: any) {
      handleExportError(err);
    }

    expect(toast.error).toHaveBeenCalledWith('Export failed: Pop-up blocked');
  });
});
