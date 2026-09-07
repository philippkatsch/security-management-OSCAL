import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MappingPage } from '../../components/mapping/MappingPage';
import { BrowserRouter } from 'react-router-dom';

const mockSetDoc = vi.fn();
const mockPushUndoRedoState = vi.fn();

let currentDoc: any = null;
let currentIsEditing = false;

vi.mock('@hooks/useDocumentLifecycle', () => ({
  useDocumentLifecycle: () => ({
    activeDoc: currentDoc,
    setDoc: mockSetDoc,
    isEditing: currentIsEditing,
    pushUndoRedoState: mockPushUndoRedoState,
    isDirty: false,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    save: vi.fn(),
  }),
}));

vi.mock('@hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('@lib/api', () => ({
  getWorkspaceId: () => 'ws-123',
  fetchDocument: vi.fn().mockImplementation((stage: string, uuid: string) => {
    if (uuid === '11111111-1111-1111-1111-111111111111') {
      return Promise.resolve({
        catalog: {
          controls: [
            { id: 'AC-1', title: 'Access Control Policy' },
            { id: 'AC-2', title: 'Account Management' },
            { id: 'AC-3', title: 'Access Enforcement' },
          ],
        },
      });
    }
    if (uuid === '22222222-2222-2222-2222-222222222222') {
      return Promise.resolve({
        catalog: {
          controls: [
            { id: 'A.5.1', title: 'Policies for Information Security' },
            { id: 'A.9.2', title: 'User Access Provisioning' },
          ],
        },
      });
    }
    return Promise.resolve(null);
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MappingPage Component', () => {
  const createSampleMappingDoc = () => ({
    'mapping-collection': {
      uuid: 'mc-12345',
      metadata: {
        title: 'NIST SP 800-53 to ISO 27001 Mapping',
        version: '1.0.0',
        'last-modified': '2026-08-13T12:00:00Z',
        oscal_version: '1.2.0',
      },
      mappings: [
        {
          uuid: 'mapping-group-1',
          'source-resource': {
            type: 'catalog',
            title: 'NIST SP 800-53 Rev. 5',
            href: 'urn:uuid:11111111-1111-1111-1111-111111111111',
          },
          'target-resource': {
            type: 'catalog',
            title: 'ISO/IEC 27001:2022',
            href: 'urn:uuid:22222222-2222-2222-2222-222222222222',
          },
          maps: [
            {
              uuid: 'map-1',
              relationship: 'equivalent-to',
              sources: [{ 'id-ref': 'AC-1' }],
              targets: [{ 'id-ref': 'A.5.1' }],
              props: [
                { name: 'confidence', value: '95' },
                { name: 'method', value: 'manual' },
                { name: 'rationale', value: 'Direct policy equivalence' },
              ],
              remarks: 'Policy mapping',
            },
            {
              uuid: 'map-2',
              relationship: 'equal-to',
              sources: [{ 'id-ref': 'AC-2' }],
              targets: [{ 'id-ref': 'A.9.2' }],
              props: [
                { name: 'confidence', value: '90' },
                { name: 'method', value: 'automated' },
              ],
            },
          ],
        },
      ],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentDoc = createSampleMappingDoc();
    currentIsEditing = false;
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <MappingPage mappingId="mc-12345" initialEditMode={false} onClose={vi.fn()} />
      </BrowserRouter>
    );
  };

  it('renders Overview tab with metrics and CompletenessReport component', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Source Controls Mapped')).toBeInTheDocument();
    });

    // Verify title and Overview tab contents
    expect(screen.getByText('NIST SP 800-53 to ISO 27001 Mapping')).toBeInTheDocument();
    expect(screen.getByText('Total Mappings')).toBeInTheDocument();
    expect(screen.getByText('Source Coverage')).toBeInTheDocument();

    // Verify CompletenessReport rendering
    expect(screen.getByText('Coverage Report')).toBeInTheDocument();
    expect(screen.getByText('Target Controls Mapped')).toBeInTheDocument();
  });

  it('supports full tab navigation (Overview, Mappings, Matrix View, Sankey Flow View, Gap Analysis, Metadata, JSON Source)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Coverage Report')).toBeInTheDocument();
    });

    // Navigate to Mappings tab
    fireEvent.click(screen.getByRole('tab', { name: 'Mappings' }));
    expect(screen.getByText('Source Control')).toBeInTheDocument();

    // Navigate to Matrix View tab
    fireEvent.click(screen.getByRole('tab', { name: 'Matrix View' }));
    expect(screen.getByText('Source \\ Target')).toBeInTheDocument();

    // Navigate to Sankey Flow View tab
    fireEvent.click(screen.getByRole('tab', { name: 'Sankey Flow View' }));
    expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();

    // Navigate to Gap Analysis tab
    fireEvent.click(screen.getByRole('tab', { name: 'Gap Analysis' }));
    expect(screen.getByText('Unmapped Source Controls')).toBeInTheDocument();

    // Navigate to Metadata tab
    fireEvent.click(screen.getByRole('tab', { name: 'Metadata' }));
    expect(screen.getByText('Source Resource')).toBeInTheDocument();
    expect(screen.getByText('Target Resource')).toBeInTheDocument();

    // Navigate to JSON Source tab
    fireEvent.click(screen.getByRole('tab', { name: 'JSON Source' }));
    expect(document.querySelector('.json-editor-container')).toBeInTheDocument();
  });

  it('renders visual matrix grid cells with accessibility attributes and handles keyboard interaction', async () => {
    renderComponent();

    // Navigate to Matrix View
    fireEvent.click(screen.getByRole('tab', { name: 'Matrix View' }));

    // Wait for controls to load
    await waitFor(() => {
      expect(screen.getByText('AC-1')).toBeInTheDocument();
      expect(screen.getByText('A.5.1')).toBeInTheDocument();
    });

    // Find grid cell for AC-1 -> A.5.1
    const gridCell = screen.getByRole('gridcell', { name: /Mapping cell AC-1 to A.5.1: equivalent-to/i });
    expect(gridCell).toBeInTheDocument();
    expect(gridCell).toHaveAttribute('tabindex', '0');

    // Press Enter to trigger selection
    fireEvent.keyDown(gridCell, { key: 'Enter', code: 'Enter' });

    // Verify detail panel opens
    expect(screen.getByText('Mapping Details')).toBeInTheDocument();
    expect(gridCell).toHaveAttribute('aria-selected', 'true');

    // Close detail panel
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Mapping Details')).not.toBeInTheDocument();

    // Click grid cell to reopen detail panel
    fireEvent.click(gridCell);
    expect(screen.getByText('Mapping Details')).toBeInTheDocument();
  });

  it('renders Sankey Flow View with keyboard accessible nodes and links', async () => {
    renderComponent();

    // Navigate to Sankey Flow View
    fireEvent.click(screen.getByRole('tab', { name: 'Sankey Flow View' }));

    await waitFor(() => {
      expect(screen.getByTestId('sankey-diagram')).toBeInTheDocument();
    });

    // Check source node keyboard accessibility
    const sourceNode = screen.getByTestId('sankey-node-AC-1');
    expect(sourceNode).toHaveAttribute('tabindex', '0');
    expect(sourceNode).toHaveAttribute('role', 'button');
    expect(sourceNode).toHaveAttribute('aria-label', expect.stringContaining('AC-1'));

    // Trigger focus and keydown events
    fireEvent.focus(sourceNode);
    fireEvent.keyDown(sourceNode, { key: 'Enter', code: 'Enter' });
    fireEvent.blur(sourceNode);

    // Check target node accessibility
    const targetNode = screen.getByTestId('sankey-node-A.5.1');
    expect(targetNode).toHaveAttribute('tabindex', '0');
    expect(targetNode).toHaveAttribute('role', 'button');
    expect(targetNode).toHaveAttribute('aria-label', expect.stringContaining('A.5.1'));

    fireEvent.focus(targetNode);
    fireEvent.keyDown(targetNode, { key: ' ', code: 'Space' });
    fireEvent.blur(targetNode);
  });

  it('updates resource metadata fields in Metadata tab when editing', async () => {
    currentIsEditing = true;
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('NIST SP 800-53 to ISO 27001 Mapping')).toBeInTheDocument();
    });

    // Navigate to Metadata tab
    fireEvent.click(screen.getByRole('tab', { name: 'Metadata' }));

    expect(screen.getByText('Source Resource')).toBeInTheDocument();
    expect(screen.getByText('Target Resource')).toBeInTheDocument();

    // Find inputs for Source Resource title and href
    const titleInputs = screen.getAllByRole('textbox');
    const sourceTitleInput = titleInputs.find(i => (i as HTMLInputElement).value === 'NIST SP 800-53 Rev. 5');
    expect(sourceTitleInput).toBeDefined();

    // Edit Source Resource title
    fireEvent.change(sourceTitleInput!, { target: { value: 'Updated NIST Catalog' } });
    expect(mockSetDoc).toHaveBeenCalled();

    // Find input for Target Resource title
    const targetTitleInput = titleInputs.find(i => (i as HTMLInputElement).value === 'ISO/IEC 27001:2022');
    expect(targetTitleInput).toBeDefined();

    // Edit Target Resource title
    fireEvent.change(targetTitleInput!, { target: { value: 'Updated ISO Catalog' } });
    expect(mockSetDoc).toHaveBeenCalled();
  });
});
