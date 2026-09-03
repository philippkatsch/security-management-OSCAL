import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ControlTreePicker } from '../../components/component-definition/pickers/ControlTreePicker';

vi.mock('@lib/api', () => ({
  authFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Policy and Procedures' },
            { id: 'ac-2', title: 'Account Management' },
            { id: 'ac-7', title: 'Unsuccessful Logon Attempts' }
          ]
        }
      ],
      nodes: []
    })
  })
}));

describe('ControlTreePicker Unit Tests', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it('renders control tree browser and lists controls from referenced catalog', async () => {
    render(
      <ControlTreePicker
        source="catalogs/11111111-2222-3333-4444-555555555555"
        existingControlIds={['ac-1']}
        onAddControls={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Hierarchical Control Browser')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('AC-1')).toBeInTheDocument();
      expect(screen.getByText('AC-2')).toBeInTheDocument();
      expect(screen.getByText('AC-7')).toBeInTheDocument();
      expect(screen.getByText('Already Implemented')).toBeInTheDocument();
    });
  });

  it('allows searching controls and toggling selection for bulk add', async () => {
    const mockOnAddControls = vi.fn();
    render(
      <ControlTreePicker
        source="catalogs/11111111-2222-3333-4444-555555555555"
        existingControlIds={['ac-1']}
        onAddControls={mockOnAddControls}
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('AC-2')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search control ID/i);
    fireEvent.change(searchInput, { target: { value: 'ac-2' } });

    // Select AC-2
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    const bulkAddBtn = screen.getByRole('button', { name: /Bulk Add \(1\)/i });
    expect(bulkAddBtn).toBeEnabled();
    fireEvent.click(bulkAddBtn);

    expect(mockOnAddControls).toHaveBeenCalledWith([
      { controlId: 'ac-2', title: 'Account Management' }
    ]);
  });
});
