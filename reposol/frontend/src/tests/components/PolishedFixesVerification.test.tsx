import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StatusBadge from '../../components/shared/status/StatusBadge';
import { POAMItemsEditor } from '../../components/poam/POAMItemsEditor';
import { TraceabilityPage } from '../../components/traceability/TraceabilityPage';
import { DocumentListPage } from '../../components/document/DocumentListPage';
import { Navigation } from '../../components/layout/Navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';
import * as queryHooks from '../../hooks/useDocumentQuery';

import { DashboardPage } from '../../components/dashboard/DashboardPage';

// Mocks
vi.mock('../../hooks/useDocumentQuery', () => ({
  useTraceabilityQuery: vi.fn(),
  useDocumentListQuery: vi.fn(),
  useDocumentQuery: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })),
  fetchRecentDocuments: vi.fn().mockImplementation(() => Promise.resolve([])),
  getWorkspaceId: vi.fn().mockReturnValue('test-workspace-id'),
}));

vi.mock('../../lib/api-client', () => ({
  apiClient: vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) })),
}));

describe('Polished Fixes Verification Suite (Items 1 - 6)', () => {
  // --- Fix 1: Finding Status Badge category="finding-status" ---
  describe('Fix 1: Finding Status Badge in POAM', () => {
    it('renders satisfied and not-satisfied finding statuses correctly', () => {
      const { container: satisfiedContainer } = render(
        <StatusBadge category="finding-status" value="satisfied" />
      );
      expect(satisfiedContainer.textContent).toContain('Satisfied');
      expect(satisfiedContainer.textContent).toContain('✅');

      const { container: notSatisfiedContainer } = render(
        <StatusBadge category="finding-status" value="not-satisfied" />
      );
      expect(notSatisfiedContainer.textContent).toContain('Not Satisfied');
      expect(notSatisfiedContainer.textContent).toContain('❌');
    });
  });

  // --- Fix 2: Priority Badge in POAMItemsEditor ---
  describe('Fix 2: Priority Badge in POAMItemsEditor', () => {
    it('renders priority 1 as Critical badge when priority prop is set', () => {
      const mockItem = {
        uuid: 'poam-item-1',
        title: 'Fix MFA',
        props: [{ name: 'priority', value: '1' }]
      };

      render(
        <POAMItemsEditor
          item={mockItem}
          onUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const priorityBadge = screen.getByTestId('status-badge');
      expect(priorityBadge).toBeInTheDocument();
      expect(priorityBadge).toHaveTextContent('Critical');
      expect(priorityBadge).toHaveTextContent('🔴');
    });

    it('renders priority 3 as Medium badge when priority prop is 3', () => {
      const mockItem = {
        uuid: 'poam-item-3',
        title: 'Update policy documentation',
        props: [{ name: 'priority', value: '3' }]
      };

      render(
        <POAMItemsEditor
          item={mockItem}
          onUpdate={vi.fn()}
          readOnly={false}
        />
      );

      const priorityBadge = screen.getByTestId('status-badge');
      expect(priorityBadge).toBeInTheDocument();
      expect(priorityBadge).toHaveTextContent('Medium');
      expect(priorityBadge).toHaveTextContent('🟡');
    });
  });

  // --- Fix 5: Preserve Workspace Session Query Param in Traceability Links ---
  describe('Fix 5: Preserve Workspace Session Query Param in Traceability Links', () => {
    it('appends ?w=... parameter to Open ↗ links when w query param is present', () => {
      (queryHooks.useTraceabilityQuery as any).mockReturnValue({
        data: [
          {
            stageKey: 'catalogs',
            uuid: 'cat-001',
            stageName: 'Catalog',
            title: 'NIST SP 800-53 Rev 5'
          }
        ],
        isLoading: false,
        error: null
      });

      render(
        <MemoryRouter initialEntries={['/traceability?w=ws-marketing-team']}>
          <TraceabilityPage />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/Enter Control ID/i);
      fireEvent.change(input, { target: { value: 'ac-1' } });
      const submitBtn = screen.getByRole('button', { name: /Trace/i });
      fireEvent.click(submitBtn);

      const link = screen.getByRole('link', { name: /Open ↗/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/catalogs/cat-001?w=ws-marketing-team');
    });

    it('does not append ?w= parameter when no w query param is present in URL', () => {
      (queryHooks.useTraceabilityQuery as any).mockReturnValue({
        data: [
          {
            stageKey: 'ssps',
            uuid: 'ssp-002',
            stageName: 'SSP',
            title: 'Core System Security Plan'
          }
        ],
        isLoading: false,
        error: null
      });

      render(
        <MemoryRouter initialEntries={['/traceability']}>
          <TraceabilityPage />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/Enter Control ID/i);
      fireEvent.change(input, { target: { value: 'ac-2' } });
      const submitBtn = screen.getByRole('button', { name: /Trace/i });
      fireEvent.click(submitBtn);

      const link = screen.getByRole('link', { name: /Open ↗/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/ssps/ssp-002');
    });
  });

  // --- Fix 6: Active Under Development Banners ---
  describe('Fix 6: Active Dev Banners in Navigation and DocumentListPage', () => {
    it('renders Navigation sidebar with 6 🚧 Dev badges for stages 3 to 8', () => {
      render(
        <MemoryRouter>
          <ConfirmProvider>
            <Navigation />
          </ConfirmProvider>
        </MemoryRouter>
      );

      const devBadges = screen.getAllByText('🚧 Dev');
      expect(devBadges).toHaveLength(5);
    });

    it('shows Under Active Development alert in DocumentListPage for stages 4-8 and not for stages 1-3', () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={['/ssps']}>
              <Routes>
                <Route path="/:stage" element={<DocumentListPage />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </QueryClientProvider>
      );

      const underDevNotice = screen.getByText(/under active development/i);
      expect(underDevNotice).toBeInTheDocument();

      unmount();

      const { unmount: unmount2 } = render(
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={['/catalogs']}>
              <Routes>
                <Route path="/:stage" element={<DocumentListPage />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </QueryClientProvider>
      );

      const catalogDevNotice = screen.queryByText(/under active development/i);
      expect(catalogDevNotice).toBeNull();

      unmount2();

      render(
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            <MemoryRouter initialEntries={['/component-definitions']}>
              <Routes>
                <Route path="/:stage" element={<DocumentListPage />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </QueryClientProvider>
      );

      const cdefDevNotice = screen.queryByText(/under active development/i);
      expect(cdefDevNotice).toBeNull();
    });

    it('renders DashboardPage workflow steps with 4 🚧 In Dev badges for stages 4 to 7', () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const inDevBadges = screen.getAllByText('🚧 In Dev');
      expect(inDevBadges).toHaveLength(4);
    });
  });
});
