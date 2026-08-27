import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DocumentListPage } from '@components/document/DocumentListPage';
import { DocumentToolbar } from '@components/shared/DocumentToolbar';
import { ConfirmProvider } from '@components/shared/ui/ConfirmProvider';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithRouter = (initialPath = '/catalogs') => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/:stage" element={<DocumentListPage />} />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>
  );
};

describe('DocumentListPage - In-Page Contextual Guide Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch for authFetch
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        })
      )
    );
  });

  it('renders Guide button in Catalogs list page header and opens Catalog guide modal on click', async () => {
    renderWithRouter('/catalogs');

    const guideBtn = screen.getByTestId('stage-help-btn');
    expect(guideBtn).toBeInTheDocument();
    expect(guideBtn).toHaveTextContent('💡 Guide');

    // Click Guide button
    fireEvent.click(guideBtn);

    const modal = screen.getByTestId('stage-help-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Step 1: Security Control Catalogs')).toBeInTheDocument();
    expect(within(modal).getByText('Why does this Stage exist?')).toBeInTheDocument();

    // Close modal
    const closeBtn = within(modal).getByRole('button', { name: /Close guide modal/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('stage-help-modal')).not.toBeInTheDocument();
  });

  it('renders Guide button in Profiles list page header and opens Profile guide modal on click', async () => {
    renderWithRouter('/profiles');

    const guideBtn = screen.getByTestId('stage-help-btn');
    expect(guideBtn).toBeInTheDocument();

    fireEvent.click(guideBtn);

    const modal = screen.getByTestId('stage-help-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Step 2: Profile Tailoring & Baselines')).toBeInTheDocument();
    expect(within(modal).getByText(/A full standard catalog .* is too broad/i)).toBeInTheDocument();
  });

  it('renders Guide button in SSPs list page and opens SSP guide modal', async () => {
    renderWithRouter('/ssps');

    const guideBtn = screen.getByTestId('stage-help-btn');
    expect(guideBtn).toBeInTheDocument();

    fireEvent.click(guideBtn);

    const modal = screen.getByTestId('stage-help-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Step 4: System Security Plans (SSP)')).toBeInTheDocument();
  });

  it('renders Guide button in Control Mappings list page and opens Mapping guide modal', async () => {
    renderWithRouter('/control-mappings');

    const guideBtn = screen.getByTestId('stage-help-btn');
    expect(guideBtn).toBeInTheDocument();

    fireEvent.click(guideBtn);

    const modal = screen.getByTestId('stage-help-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Step 8: Cross-Framework Control Mappings')).toBeInTheDocument();
  });

  it('renders Guide button in DocumentToolbar and opens contextual guide modal', () => {
    render(
      <DocumentToolbar
        stage="profiles"
        title="NIST Baseline Profile"
        isEditing={false}
      />
    );

    const guideBtn = screen.getByTestId('document-guide-btn');
    expect(guideBtn).toBeInTheDocument();
    expect(guideBtn).toHaveTextContent('💡 Guide');

    fireEvent.click(guideBtn);

    const modal = screen.getByTestId('stage-help-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Step 2: Profile Tailoring & Baselines')).toBeInTheDocument();

    const closeBtn = within(modal).getByRole('button', { name: /Close guide modal/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('stage-help-modal')).not.toBeInTheDocument();
  });
});
