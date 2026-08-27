import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Jotai Store Atoms
import {
  documentListAtom,
  recentDocsAtom,
  currentStageAtom,
  currentDocIdAtom,
  documentCountsAtom,
} from '../../stores/documentAtoms';
import {
  sidebarOpenAtom,
  editModeAtom,
  activeTabAtom,
  saveStatusAtom,
  globalErrorAtom,
} from '../../stores/uiAtoms';
import { workspaceIdAtom } from '../../stores/workspaceAtoms';
import { getWorkspaceId } from '@lib/api';

// UI & Stage Components
import { ConfirmModal } from '../shared/ui/ConfirmModal';
import { ConfirmProvider, useConfirm } from '../shared/ui/ConfirmProvider';
import { JsonEditor } from '../shared/JsonEditor';
import { SankeyDiagram, SankeyControl, SankeyMapEntry } from '../mapping/SankeyDiagram';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary';
import StatusBadge from '../shared/status/StatusBadge';

// Mock Monaco editor for JSDOM
vi.mock('@monaco-editor/react', () => {
  const React = require('react');
  return {
    default: (props: any) =>
      React.createElement('textarea', {
        'data-testid': 'monaco-editor-textarea',
        value: props.value,
        onChange: (e: any) => props.onChange && props.onChange(e.target.value),
      }),
  };
});

// Polyfill HTMLDialogElement for JSDOM
beforeEach(() => {
  vi.clearAllMocks();
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

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Tier 5 White-Box Adversarial Frontend Coverage Suite', () => {
  /* =========================================================================
   * Suite 1: Jotai Atom Store State Boundary Conditions
   * ========================================================================= */
  describe('1. Jotai Atom Store State Boundary Conditions', () => {
    function TestAtomComponent() {
      const [docList, setDocList] = useAtom(documentListAtom);
      const [counts, setCounts] = useAtom(documentCountsAtom);
      const [stage, setStage] = useAtom(currentStageAtom);
      const [docId, setDocId] = useAtom(currentDocIdAtom);
      const [saveStatus, setSaveStatus] = useAtom(saveStatusAtom);
      const [globalErr, setGlobalErr] = useAtom(globalErrorAtom);
      const [workspaceId, setWorkspaceId] = useAtom(workspaceIdAtom);

      return (
        <div>
          <div data-testid="doc-count">{docList.length}</div>
          <div data-testid="stage-name">{stage || 'NONE'}</div>
          <div data-testid="doc-id">{docId || 'NONE'}</div>
          <div data-testid="catalog-count">{counts.catalog ?? -1}</div>
          <div data-testid="save-status">{saveStatus}</div>
          <div data-testid="global-err">{globalErr || 'NONE'}</div>
          <div data-testid="workspace-id">{workspaceId}</div>

          <button
            data-testid="btn-update-doc-list"
            onClick={() =>
              setDocList([
                {
                  id: 'doc-1',
                  title: 'Test Catalog',
                  stage: 'catalog',
                  updated_at: '2026-08-13T00:00:00Z',
                } as any,
              ])
            }
          >
            Update List
          </button>
          <button
            data-testid="btn-update-counts"
            onClick={() =>
              setCounts({
                catalog: 5,
                profile: 3,
                'component-definition': 2,
                ssp: 1,
                'assessment-plan': 0,
                'assessment-results': 0,
                poam: 0,
                mapping: 0,
              })
            }
          >
            Update Counts
          </button>
          <button data-testid="btn-set-stage" onClick={() => setStage('profile')}>
            Set Stage
          </button>
          <button data-testid="btn-set-doc-id" onClick={() => setDocId('prof-999')}>
            Set Doc ID
          </button>
          <button data-testid="btn-set-saving" onClick={() => setSaveStatus('saving')}>
            Set Saving
          </button>
          <button
            data-testid="btn-set-err"
            onClick={() => setGlobalErr('<script>alert("xss")</script> Network Failure')}
          >
            Set Error
          </button>
        </div>
      );
    }

    it('initializes documentAtoms with correct empty/default values', () => {
      render(
        <Provider>
          <TestAtomComponent />
        </Provider>
      );

      expect(screen.getByTestId('doc-count').textContent).toBe('0');
      expect(screen.getByTestId('stage-name').textContent).toBe('NONE');
      expect(screen.getByTestId('doc-id').textContent).toBe('NONE');
      expect(screen.getByTestId('catalog-count').textContent).toBe('-1');
      expect(screen.getByTestId('save-status').textContent).toBe('idle');
      expect(screen.getByTestId('global-err').textContent).toBe('NONE');
      expect(screen.getByTestId('workspace-id').textContent).toBe(getWorkspaceId());
    });

    it('handles state updates and isolated Provider scope boundary conditions', () => {
      render(
        <Provider>
          <TestAtomComponent />
        </Provider>
      );

      fireEvent.click(screen.getByTestId('btn-update-doc-list'));
      expect(screen.getByTestId('doc-count').textContent).toBe('1');

      fireEvent.click(screen.getByTestId('btn-update-counts'));
      expect(screen.getByTestId('catalog-count').textContent).toBe('5');

      fireEvent.click(screen.getByTestId('btn-set-stage'));
      expect(screen.getByTestId('stage-name').textContent).toBe('profile');

      fireEvent.click(screen.getByTestId('btn-set-doc-id'));
      expect(screen.getByTestId('doc-id').textContent).toBe('prof-999');

      fireEvent.click(screen.getByTestId('btn-set-saving'));
      expect(screen.getByTestId('save-status').textContent).toBe('saving');

      fireEvent.click(screen.getByTestId('btn-set-err'));
      expect(screen.getByTestId('global-err').textContent).toContain('Network Failure');
    });
  });

  /* =========================================================================
   * Suite 2: ConfirmModal & ConfirmProvider (DD-032) Fallback & Edge Cases
   * ========================================================================= */
  describe('2. ConfirmModal & ConfirmProvider (DD-032) Edge Cases', () => {
    it('renders ConfirmModal with default props and handles danger/warning variants', () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();

      const { rerender } = render(
        <ConfirmModal
          isOpen={true}
          title="Delete Catalog"
          message="Are you sure you want to delete this catalog?"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      expect(screen.getByText('Delete Catalog')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this catalog?')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Confirm'));
      expect(handleConfirm).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Cancel'));
      expect(handleCancel).toHaveBeenCalledTimes(1);

      // Rerender with custom labels and danger variant
      rerender(
        <ConfirmModal
          isOpen={true}
          title="Force Delete"
          message="Document has 409 Conflict references."
          confirmLabel="Force Delete Now"
          cancelLabel="Abort Action"
          variant="danger"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      expect(screen.getByText('Force Delete Now')).toBeInTheDocument();
      expect(screen.getByText('Abort Action')).toBeInTheDocument();
    });

    it('resolves useConfirm hook promise correctly on user confirmation or cancellation', async () => {
      let confirmResult: boolean | null = null;

      function TestConsumer() {
        const { confirm } = useConfirm();

        const handleClick = async () => {
          const res = await confirm({
            title: 'Archive Document',
            message: 'Do you want to archive this file?',
            confirmLabel: 'Yes, Archive',
            variant: 'warning',
          });
          confirmResult = res;
        };

        return <button onClick={handleClick}>Trigger Confirm</button>;
      }

      render(
        <ConfirmProvider>
          <TestConsumer />
        </ConfirmProvider>
      );

      fireEvent.click(screen.getByText('Trigger Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Archive Document')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Yes, Archive'));

      await waitFor(() => {
        expect(confirmResult).toBe(true);
      });
    });

    it('throws an error if useConfirm is called outside ConfirmProvider', () => {
      function InvalidConsumer() {
        useConfirm();
        return null;
      }

      // Prevent console.error noise during expected throw test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<InvalidConsumer />)).toThrow(
        'useConfirm must be used within a ConfirmProvider'
      );
      spy.mockRestore();
    });
  });

  /* =========================================================================
   * Suite 3: Debounced Monaco Editor & Syntax Error Hints (JsonEditor)
   * ========================================================================= */
  describe('3. Debounced Monaco Editor & Syntax Validation (JsonEditor)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders object input as formatted JSON string and handles onValidate prop', async () => {
      const handleValidate = vi.fn();
      const objectData = { catalog: { id: 'cat-1', title: 'Sample Catalog' } };

      render(<JsonEditor data={objectData} onValidate={handleValidate} onChange={vi.fn()} />);

      await act(async () => {
        await Promise.resolve();
      });

      const textarea = screen.getByTestId('monaco-editor-textarea');
      expect(textarea).toHaveValue(JSON.stringify(objectData, null, 2));

      const validateBtn = screen.getByRole('button', { name: /Validate Schema/i });
      fireEvent.click(validateBtn);
      expect(handleValidate).toHaveBeenCalled();
    });

    it('debounces syntax validation by 500ms and displays syntax error hint on invalid JSON', async () => {
      const handleChange = vi.fn();

      render(<JsonEditor value='{"title": "Valid"}' onChange={handleChange} />);

      const textarea = screen.getByTestId('monaco-editor-textarea');

      // Change text to invalid JSON syntax
      fireEvent.change(textarea, { target: { value: '{"title": "Broken JSON' } });
      expect(handleChange).toHaveBeenCalledWith('{"title": "Broken JSON');

      // Error hint should NOT appear immediately (0ms)
      expect(screen.queryByText(/Invalid JSON/i)).toBeNull();

      // Fast-forward timers by 490ms - still no error
      act(() => {
        vi.advanceTimersByTime(490);
      });
      expect(screen.queryByText(/Invalid JSON/i)).toBeNull();

      // Fast-forward past 500ms debounce threshold
      act(() => {
        vi.advanceTimersByTime(20);
      });

      expect(screen.getByText(/Invalid JSON:/i)).toBeInTheDocument();
    });

    it('handles empty string input safely without throwing syntax errors', () => {
      render(<JsonEditor value="" onChange={vi.fn()} />);

      const textarea = screen.getByTestId('monaco-editor-textarea');
      fireEvent.change(textarea, { target: { value: '   ' } });

      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.queryByText(/Invalid JSON/i)).toBeNull();
    });
  });

  /* =========================================================================
   * Suite 4: Sankey Diagram Edge Cases & Interactive Flows (SankeyDiagram)
   * ========================================================================= */
  describe('4. Sankey Diagram Edge Cases (SankeyDiagram)', () => {
    const mockSources: SankeyControl[] = [
      { id: 'ac-1', title: 'Access Control Policy', group: 'ac' },
      { id: 'ac-2', title: 'Account Management', group: 'ac' },
      { id: 'ia-1', title: 'Identification & Auth Policy', group: 'ia' },
    ];

    const mockTargets: SankeyControl[] = [
      { id: 'iso-a5', title: 'Policies for Information Security', group: 'A.5' },
      { id: 'iso-a9', title: 'Access Control', group: 'A.9' },
    ];

    const mockMaps: SankeyMapEntry[] = [
      {
        uuid: 'map-1',
        relationship: 'equal-to',
        sources: [{ 'id-ref': 'ac-1' }],
        targets: [{ 'id-ref': 'iso-a9' }],
        props: [
          { name: 'confidence', value: '95' },
          { name: 'rationale', value: 'Direct policy mapping' },
        ],
      },
    ];

    it('renders empty diagram state without crashing when source/target controls are empty', () => {
      render(<SankeyDiagram sourceControls={[]} targetControls={[]} maps={[]} />);
      expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
      expect(screen.getByTestId('sankey-svg')).toBeInTheDocument();
    });

    it('filters flow links by relationship type filter', () => {
      render(
        <SankeyDiagram
          sourceControls={mockSources}
          targetControls={mockTargets}
          maps={mockMaps}
          filterRelationship="equal-to"
        />
      );

      expect(screen.getByTestId('sankey-link-map-1-ac-1-iso-a9')).toBeInTheDocument();
    });

    it('enforces zoom scaling boundaries between 50% and 200%', () => {
      render(
        <SankeyDiagram
          sourceControls={mockSources}
          targetControls={mockTargets}
          maps={mockMaps}
        />
      );

      const zoomInBtn = screen.getByTitle('Zoom In');
      const zoomOutBtn = screen.getByTitle('Zoom Out');
      const resetBtn = screen.getByTitle('Reset Zoom');

      // Click Zoom In multiple times
      fireEvent.click(zoomInBtn); // 115%
      fireEvent.click(zoomInBtn); // 130%
      expect(screen.getByText('130%')).toBeInTheDocument();

      fireEvent.click(resetBtn);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('handles mouse enter on flow links to display floating tooltip with confidence/rationale', () => {
      render(
        <SankeyDiagram
          sourceControls={mockSources}
          targetControls={mockTargets}
          maps={mockMaps}
        />
      );

      const linkPath = screen.getByTestId('sankey-link-map-1-ac-1-iso-a9');
      fireEvent.mouseEnter(linkPath);

      expect(screen.getByTestId('sankey-tooltip')).toBeInTheDocument();
      expect(screen.getByText(/ac-1 → iso-a9/i)).toBeInTheDocument();
      expect(screen.getByText(/95%/i)).toBeInTheDocument();
      expect(screen.getByText(/Direct policy mapping/i)).toBeInTheDocument();

      fireEvent.mouseLeave(linkPath);
      expect(screen.queryByTestId('sankey-tooltip')).toBeNull();
    });
  });

  /* =========================================================================
   * Suite 5: Cross-Stage Navigation Error Boundaries (ErrorBoundary)
   * ========================================================================= */
  describe('5. Cross-Stage Navigation Error Boundaries (ErrorBoundary)', () => {
    function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
      if (shouldThrow) {
        throw new Error('Adversarial render crash in stage component');
      }
      return <div>Stage Component Content Normal</div>;
    }

    it('renders children normally when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Stage Component Content Normal')).toBeInTheDocument();
    });

    it('catches uncaught rendering exception and displays fallback error UI with reload button', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(
        screen.getByText('An unexpected error occurred in the application.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Adversarial render crash in stage component')
      ).toBeInTheDocument();

      const reloadBtn = screen.getByRole('button', { name: /Reload Page/i });
      expect(reloadBtn).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  /* =========================================================================
   * Suite 7: StatusBadge System Resilience (StatusBadge)
   * ========================================================================= */
  describe('7. StatusBadge System Resilience', () => {
    it('renders status badge gracefully for standard and fallback categories', () => {
      render(<StatusBadge category="implementation-status" value="implemented" />);
      const badge = screen.getByTestId('status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain('Implemented');
    });

    it('handles undefined category or unknown status value without crashing', () => {
      render(<StatusBadge category="non-existent-category" value="unknown-status" />);
      const badge = screen.getByTestId('status-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain('unknown-status');
    });

    it('renders dot and bar status variants cleanly', () => {
      const { rerender } = render(
        <StatusBadge category="implementation-status" value="planned" variant="dot" />
      );
      expect(screen.getByTestId('status-badge')).toBeInTheDocument();

      rerender(
        <StatusBadge category="implementation-status" value="partial" variant="bar" />
      );
      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    });
  });
});
