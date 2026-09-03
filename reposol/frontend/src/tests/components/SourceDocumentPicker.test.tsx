import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SourceDocumentPicker } from '../../components/component-definition/pickers/SourceDocumentPicker';

vi.mock('@lib/api-client', () => ({
  apiClient: vi.fn().mockImplementation((url: string) => {
    if (url.includes('catalogs')) {
      return Promise.resolve({
        json: () => Promise.resolve([
          {
            catalog: {
              uuid: 'cat-uuid-001',
              metadata: { title: 'NIST SP 800-53 Rev 5', version: '5.1.1' }
            }
          }
        ])
      });
    }
    if (url.includes('profiles')) {
      return Promise.resolve({
        json: () => Promise.resolve([
          {
            profile: {
              uuid: 'prof-uuid-002',
              metadata: { title: 'FedRAMP Moderate Baseline', version: '1.0' }
            }
          }
        ])
      });
    }
    return Promise.resolve({ json: () => Promise.resolve([]) });
  })
}));

describe('SourceDocumentPicker Unit Tests', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it('renders input with current value and shows active reference badge', () => {
    render(
      <SourceDocumentPicker
        value="catalogs/cat-uuid-001"
        onChange={vi.fn()}
        disabled={false}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByDisplayValue('catalogs/cat-uuid-001')).toBeInTheDocument();
    expect(screen.getByText('📚 Catalog')).toBeInTheDocument();
  });

  it('opens modal browser on clicking Browse button and loads catalogs and profiles', async () => {
    const mockOnChange = vi.fn();
    render(
      <SourceDocumentPicker
        value=""
        onChange={mockOnChange}
        disabled={false}
      />,
      { wrapper: createWrapper() }
    );

    const browseBtn = screen.getByRole('button', { name: /🔍 Browse\.\.\./i });
    fireEvent.click(browseBtn);

    expect(screen.getByText('Select Framework Source Document')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 Rev 5')).toBeInTheDocument();
      expect(screen.getByText('FedRAMP Moderate Baseline')).toBeInTheDocument();
    });

    const selectBtns = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(selectBtns[0]);

    expect(mockOnChange).toHaveBeenCalledWith('catalogs/cat-uuid-001');
  });

  it('allows applying custom external URI', () => {
    const mockOnChange = vi.fn();
    render(
      <SourceDocumentPicker
        value=""
        onChange={mockOnChange}
        disabled={false}
      />,
      { wrapper: createWrapper() }
    );

    const browseBtn = screen.getByRole('button', { name: /🔍 Browse\.\.\./i });
    fireEvent.click(browseBtn);

    const customTab = screen.getByRole('button', { name: /🔗 Custom URI/i });
    fireEvent.click(customTab);

    const customInput = screen.getByPlaceholderText(/raw\.githubusercontent\.com/i);
    fireEvent.change(customInput, { target: { value: 'https://example.com/custom-cat.json' } });

    const applyBtn = screen.getByRole('button', { name: /Apply Custom URI/i });
    fireEvent.click(applyBtn);

    expect(mockOnChange).toHaveBeenCalledWith('https://example.com/custom-cat.json');
  });
});
