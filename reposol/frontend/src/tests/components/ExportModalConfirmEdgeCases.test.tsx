import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportModal } from '../../components/shared/ui/ExportModal';
import { ConfirmProvider, useConfirm } from '../../components/shared/ui/ConfirmProvider';
import { toast } from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock HTMLDialogElement methods for JSDOM if needed
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

describe('ExportModal Component', () => {
  it('renders null when isOpen is false', () => {
    const { container } = render(
      <ExportModal isOpen={false} docId="doc-1" stage="catalog" onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog when isOpen is true and shows document title', () => {
    render(
      <ExportModal
        isOpen={true}
        docId="doc-123"
        docTitle="My Catalog Document"
        stage="catalog"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('export-modal')).toBeInTheDocument();
    expect(screen.getByText(/Export OSCAL Document/i)).toBeInTheDocument();
    expect(screen.getByText(/Select format to export "My Catalog Document"/i)).toBeInTheDocument();
  });

  it('allows format selection (JSON, YAML, XML) and triggers export window.open', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const handleClose = vi.fn();

    render(
      <ExportModal
        isOpen={true}
        docId="doc-456"
        docTitle="Test SSP"
        stage="ssp"
        onClose={handleClose}
      />
    );

    const jsonRadio = screen.getByTestId('export-format-json') as HTMLInputElement;
    const yamlRadio = screen.getByTestId('export-format-yaml') as HTMLInputElement;
    const xmlRadio = screen.getByTestId('export-format-xml') as HTMLInputElement;

    expect(jsonRadio.checked).toBe(true);

    // Switch to YAML
    fireEvent.click(yamlRadio);
    expect(yamlRadio.checked).toBe(true);

    // Switch to XML
    fireEvent.click(xmlRadio);
    expect(xmlRadio.checked).toBe(true);

    // Click export confirm button
    const confirmBtn = screen.getByTestId('export-confirm-btn');
    fireEvent.click(confirmBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/export/ssp/doc-456?format=xml'),
      '_blank'
    );
    expect(toast.success).toHaveBeenCalledWith('Exporting as XML...');
    expect(handleClose).toHaveBeenCalledTimes(1);

    windowOpenSpy.mockRestore();
  });

  it('handles null docId gracefully on export attempt', () => {
    const handleClose = vi.fn();

    render(
      <ExportModal
        isOpen={true}
        docId={null}
        stage="profile"
        onClose={handleClose}
      />
    );

    const confirmBtn = screen.getByTestId('export-confirm-btn');
    fireEvent.click(confirmBtn);

    expect(toast.error).toHaveBeenCalledWith('No document selected for export');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

const TestConfirmConsumer = ({ onResult }: { onResult: (res: boolean) => void }) => {
  const { confirm } = useConfirm();
  const handleTrigger = async () => {
    const res = await confirm({
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document?',
      confirmLabel: 'Yes, Delete',
      cancelLabel: 'No, Keep',
      variant: 'danger',
    });
    onResult(res);
  };

  return <button onClick={handleTrigger}>Trigger Confirm</button>;
};

describe('ConfirmProvider and useConfirm Hook', () => {
  it('throws error when useConfirm is called outside ConfirmProvider', () => {
    const InvalidConsumer = () => {
      useConfirm();
      return null;
    };
    expect(() => render(<InvalidConsumer />)).toThrow(
      'useConfirm must be used within a ConfirmProvider'
    );
  });

  it('resolves true when user clicks confirm button', async () => {
    const handleResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestConfirmConsumer onResult={handleResult} />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Trigger Confirm'));
    const confirmBtn = await screen.findByText('Yes, Delete');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleResult).toHaveBeenCalledWith(true);
    });
  });

  it('resolves false when user clicks cancel button', async () => {
    const handleResult = vi.fn();
    render(
      <ConfirmProvider>
        <TestConfirmConsumer onResult={handleResult} />
      </ConfirmProvider>
    );

    fireEvent.click(screen.getByText('Trigger Confirm'));
    const cancelBtn = await screen.findByText('No, Keep');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(handleResult).toHaveBeenCalledWith(false);
    });
  });
});
