import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmProvider, useConfirm } from '../../components/shared/ui/ConfirmProvider';
import APPage from '../../components/assessment-plan/APPage';
import { BrowserRouter } from 'react-router-dom';
import { useDocumentLifecycle } from '@hooks/useDocumentLifecycle';

// Mock dependencies
vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: vi.fn(),
}));

vi.mock('@lib/api', () => ({
  getWorkspaceId: () => 'ws-123',
  exportDocument: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Challenger 5 Verification - ConfirmModal & APPage', () => {
  let mockWindowConfirm: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowConfirm = vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('window.confirm should NEVER be called!');
    });

    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      });
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      });
    }
  });

  describe('ConfirmProvider & useConfirm Empirical Check', () => {
    const ConfirmComponent = ({ onResult }: { onResult: (res: boolean) => void }) => {
      const { confirm } = useConfirm();
      const handleClick = async () => {
        const res = await confirm({
          title: 'Custom Modal Test',
          message: 'Are you sure?',
          confirmLabel: 'Confirm Action',
          cancelLabel: 'Cancel Action',
        });
        onResult(res);
      };
      return <button onClick={handleClick}>Trigger Custom Confirm</button>;
    };

    it('empirically verifies window.confirm is NEVER called and ConfirmModal renders correctly', async () => {
      const handleResult = vi.fn();
      render(
        <ConfirmProvider>
          <ConfirmComponent onResult={handleResult} />
        </ConfirmProvider>
      );

      fireEvent.click(screen.getByText('Trigger Custom Confirm'));

      // Confirm native window.confirm was NOT called
      expect(mockWindowConfirm).not.toHaveBeenCalled();

      // Confirm modal UI elements are rendered
      const title = await screen.findByText('Custom Modal Test');
      expect(title).toBeInTheDocument();
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();

      // Click Confirm button
      const confirmBtn = screen.getByText('Confirm Action');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(handleResult).toHaveBeenCalledWith(true);
      });
      expect(mockWindowConfirm).not.toHaveBeenCalled();
    });

    it('resolves false when user cancels custom modal without calling window.confirm', async () => {
      const handleResult = vi.fn();
      render(
        <ConfirmProvider>
          <ConfirmComponent onResult={handleResult} />
        </ConfirmProvider>
      );

      fireEvent.click(screen.getByText('Trigger Custom Confirm'));
      expect(mockWindowConfirm).not.toHaveBeenCalled();

      const cancelBtn = await screen.findByText('Cancel Action');
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(handleResult).toHaveBeenCalledWith(false);
      });
      expect(mockWindowConfirm).not.toHaveBeenCalled();
    });
  });

  describe('APPage Tab Switching & Metadata Updates', () => {
    const sampleAP = {
      'assessment-plan': {
        uuid: 'ap-12345',
        metadata: {
          title: 'Sample Assessment Plan',
          version: '1.0.0',
          'last-modified': '2026-08-13T00:00:00Z',
          oscal_version: '1.2.0',
        },
        'import-ssp': {
          href: 'ssp-baseline.json',
        },
        'reviewed-controls': {
          'control-selections': [
            { uuid: 'cs-1', 'include-all': true }
          ]
        },
        'assessment-subjects': [
          {
            uuid: 'subj-1',
            type: 'component',
            description: 'Database Subject Scope',
            'include-all': true,
          }
        ],
        tasks: [
          {
            uuid: 'task-1',
            title: 'Audit Server Configuration',
            type: 'action',
            timing: {
              'on-date': { date: '2026-09-01' }
            }
          }
        ],
        'local-definitions': {
          activities: [
            {
              uuid: 'act-1',
              title: 'Review System Logs',
              description: 'Inspect auth logs',
              props: [{ name: 'method', value: 'EXAMINE' }],
              steps: [{ uuid: 'step-1', title: 'Step 1' }]
            }
          ]
        },
        'terms-and-conditions': {
          parts: [
            {
              uuid: 'tc-1',
              name: 'clause',
              title: 'Scope Clause',
              prose: 'Assessment must be completed within 30 days.'
            }
          ]
        }
      }
    };

    it('renders all APPage tabs cleanly and handles tab switching and metadata update without error', async () => {
      const mockSetDoc = vi.fn();
      const mockPushUndoRedoState = vi.fn();

      (useDocumentLifecycle as any).mockReturnValue({
        activeDoc: sampleAP,
        doc: sampleAP,
        setDoc: mockSetDoc,
        isEditing: true,
        pushUndoRedoState: mockPushUndoRedoState,
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
        <BrowserRouter>
          <ConfirmProvider>
            <APPage apId="ap-12345" initialIsEditing={true} />
          </ConfirmProvider>
        </BrowserRouter>
      );

      // Default tab: Overview
      expect(screen.getByText('Assessment Plan Overview')).toBeInTheDocument();

      // Tab 1: Subjects Scope (id: assessment-subjects)
      const subjectsTabBtn = screen.getByText('Subjects Scope');
      fireEvent.click(subjectsTabBtn);
      expect(screen.getByText('Assessment Subjects')).toBeInTheDocument();
      expect(screen.getByText('Database Subject Scope')).toBeInTheDocument();

      // Tab 2: Activity Tasks (id: activities-tasks)
      const activitiesTabBtn = screen.getByText('Activity Tasks');
      fireEvent.click(activitiesTabBtn);
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Audit Server Configuration')).toBeInTheDocument();
      expect(screen.getByText('Activities')).toBeInTheDocument();
      expect(screen.getByText('Review System Logs')).toBeInTheDocument();

      // Tab 3: Terms & Conditions (id: terms-and-conditions)
      const termsTabBtn = screen.getByText('Terms & Conditions');
      fireEvent.click(termsTabBtn);
      expect(screen.getByDisplayValue('Scope Clause')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Assessment must be completed within 30 days.')).toBeInTheDocument();

      // Tab 4: Metadata (id: metadata)
      const metadataTabBtn = screen.getByText('Metadata');
      fireEvent.click(metadataTabBtn);
      
      // Title input in StandardMetadataTab / MetadataEditor
      const titleInput = screen.getByDisplayValue('Sample Assessment Plan');
      expect(titleInput).toBeInTheDocument();

      // Simulate editing title in metadata
      fireEvent.change(titleInput, { target: { value: 'Updated Assessment Plan Title' } });

      // Verify setDoc was called with updated metadata without throwing error (debounced)
      await waitFor(() => {
        expect(mockSetDoc).toHaveBeenCalledWith(
          expect.objectContaining({
            'assessment-plan': expect.objectContaining({
              metadata: expect.objectContaining({
                title: 'Updated Assessment Plan Title'
              })
            })
          })
        );
        expect(mockPushUndoRedoState).toHaveBeenCalled();
      });
    });
  });
});
