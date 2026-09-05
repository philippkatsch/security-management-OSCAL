import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentToolbar } from '../../components/shared/DocumentToolbar';
import { useSaveVersionMutation } from '../../hooks/useDocumentQuery';
import * as api from '../../lib/api';

// Mock api
vi.mock('../../lib/api', () => ({
  saveVersion: vi.fn().mockResolvedValue({ status: 'success' }),
  fetchVersions: vi.fn().mockResolvedValue([]),
  fetchDocument: vi.fn().mockResolvedValue({ catalog: { uuid: 'doc-1', metadata: { title: 'Test' } } })
}));

const mockConfirm = vi.fn();
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: mockConfirm,
  }),
}));

const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
    success: vi.fn(),
  },
  default: {
    error: (...args: any[]) => mockToastError(...args),
    success: vi.fn(),
  }
}));

describe('Draft Save Optimizations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('DocumentToolbar Back Button & Saving Indicator', () => {
    it('disables the Back button and displays Saving indicator when saving is true', () => {
      render(
        <DocumentToolbar
          title="Test Document"
          onBack={vi.fn()}
          saving={true}
          isEditing={true}
        />
      );

      const backBtn = screen.getByTestId('back-btn');
      expect(backBtn).toBeDisabled();

      const statusIndicator = screen.getByTestId('save-status-indicator');
      expect(statusIndicator).toBeInTheDocument();
      expect(statusIndicator).toHaveTextContent(/Saving.../);
    });

    it('enables the Back button and hides indicator when not saving', () => {
      render(
        <DocumentToolbar
          title="Test Document"
          onBack={vi.fn()}
          saving={false}
          isEditing={true}
        />
      );

      const backBtn = screen.getByTestId('back-btn');
      expect(backBtn).not.toBeDisabled();
      expect(screen.queryByTestId('save-status-indicator')).toBeNull();
    });

    it('disables undo, redo, and mode toggle buttons when saving is in progress', () => {
      render(
        <DocumentToolbar
          title="Test Document"
          onBack={vi.fn()}
          saving={true}
          isEditing={true}
          canUndo={true}
          canRedo={true}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onToggleEditMode={vi.fn()}
        />
      );

      expect(screen.getByTestId('undo-btn')).toBeDisabled();
      expect(screen.getByTestId('redo-btn')).toBeDisabled();
      expect(screen.getByTestId('visual-mode-btn')).toBeDisabled();
      expect(screen.getByTestId('json-mode-btn')).toBeDisabled();
    });
  });

  describe('useSaveVersionMutation Selective Invalidation', () => {
    it('only invalidates versions query when isDraft is true', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useSaveVersionMutation('catalogs', 'doc-123'), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          version: '1.0.0-draft',
          document: { catalog: { uuid: 'doc-123', metadata: { version: '1.0.0-draft' } } } as any,
          isDraft: true,
        });
      });

      expect(api.saveVersion).toHaveBeenCalledWith(
        'catalogs',
        'doc-123',
        '1.0.0-draft',
        expect.any(Object),
        undefined,
        true
      );

      // Verify that versions was invalidated but document was NOT invalidated
      const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
      expect(invalidatedKeys).toContainEqual(['versions', 'catalogs', 'doc-123']);
      expect(invalidatedKeys).not.toContainEqual(['document', 'catalogs', 'doc-123']);
    });

    it('invalidates both versions and document queries when isDraft is false', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useSaveVersionMutation('catalogs', 'doc-123'), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          version: '1.0.0',
          document: { catalog: { uuid: 'doc-123', metadata: { version: '1.0.0' } } } as any,
          isDraft: false,
        });
      });

      const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
      expect(invalidatedKeys).toContainEqual(['versions', 'catalogs', 'doc-123']);
      expect(invalidatedKeys).toContainEqual(['document', 'catalogs', 'doc-123']);
    });

    it('treats version with Draft suffix as draft and skips document query invalidation', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useSaveVersionMutation('catalogs', 'doc-123'), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          version: '1.0.0-Draft',
          document: { catalog: { uuid: 'doc-123', metadata: { version: '1.0.0-Draft' } } } as any,
        });
      });

      const invalidatedKeys = invalidateSpy.mock.calls.map(call => call[0]?.queryKey);
      expect(invalidatedKeys).toContainEqual(['versions', 'catalogs', 'doc-123']);
      expect(invalidatedKeys).not.toContainEqual(['document', 'catalogs', 'doc-123']);
    });
  });

  describe('useDraft Unmount Auto-Save Suppression', () => {
    it('suppresses unmount save when markDiscarded() is invoked', async () => {
      const { useDraft } = await import('../../hooks/useDraft');
      const saveCallback = vi.fn().mockResolvedValue({ status: 'success' });
      const testDoc = { catalog: { uuid: 'doc-456' } };

      const { result, unmount } = renderHook(() =>
        useDraft('catalogs', 'doc-456', testDoc, true, 30000, saveCallback, true)
      );

      // Explicitly mark discarded (as handleBack does when saving or discarding draft)
      act(() => {
        result.current.markDiscarded();
      });

      // Now unmount the component
      unmount();

      // Ensure saveCallback was NOT called on unmount
      expect(saveCallback).not.toHaveBeenCalled();
    });

    it('triggers unmount save when markDiscarded() is NOT invoked and document is dirty', async () => {
      const { useDraft } = await import('../../hooks/useDraft');
      const saveCallback = vi.fn().mockResolvedValue({ status: 'success' });
      const testDoc = { catalog: { uuid: 'doc-456' } };

      const { unmount } = renderHook(() =>
        useDraft('catalogs', 'doc-456', testDoc, true, 30000, saveCallback, true)
      );

      // Unmount without marking discarded
      unmount();

      // Ensure saveCallback WAS called on unmount
      expect(saveCallback).toHaveBeenCalledWith(testDoc);
    });
  });

  describe('handleBack navigation error handling and concurrency guards', () => {
    it('aborts navigation when saving draft fails', async () => {
      const { useDocumentLifecycle } = await import('../../hooks/useDocumentLifecycle');
      mockConfirm.mockResolvedValue(true);

      // Force saveVersion to reject
      (api.saveVersion as any).mockRejectedValueOnce(new Error('Network failure'));

      const navigateBack = vi.fn();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(
        () => useDocumentLifecycle('catalogs', 'catalog', 'doc-test-1', true),
        { wrapper }
      );

      // Wait until initial document load completes
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Push an edit so hasUnsavedChanges becomes true
      act(() => {
        result.current.pushUndoRedoState({
          catalog: { uuid: 'doc-test-1', metadata: { title: 'Modified' } },
        } as any);
      });

      expect(result.current.canUndo).toBe(true);

      await act(async () => {
        await result.current.handleBack(navigateBack);
      });

      // Verification: toast.error was shown, and navigateBack was NOT called
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Draft save failed'));
      expect(navigateBack).not.toHaveBeenCalled();
    });

    it('ignores subsequent Back clicks while handleBack is already in progress', async () => {
      const { useDocumentLifecycle } = await import('../../hooks/useDocumentLifecycle');
      
      let resolveConfirm: (val: boolean) => void;
      mockConfirm.mockImplementation(() => new Promise<boolean>((res) => {
        resolveConfirm = res;
      }));

      const navigateBack = vi.fn();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(
        () => useDocumentLifecycle('catalogs', 'catalog', 'doc-test-1', true),
        { wrapper }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.pushUndoRedoState({
          catalog: { uuid: 'doc-test-1', metadata: { title: 'Modified' } },
        } as any);
      });

      // Call handleBack first time (waiting on confirmation)
      act(() => {
        result.current.handleBack(navigateBack);
      });

      expect(mockConfirm).toHaveBeenCalledTimes(1);

      // Rapid second click on Back while first is still pending
      act(() => {
        result.current.handleBack(navigateBack);
      });

      // Confirm modal should NOT be opened a second time
      expect(mockConfirm).toHaveBeenCalledTimes(1);

      // Resolve first confirmation with true
      await act(async () => {
        resolveConfirm(true);
      });

      expect(navigateBack).toHaveBeenCalledTimes(1);
    });
  });
});
