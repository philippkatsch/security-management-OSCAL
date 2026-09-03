import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImportDefinitionsEditor } from '../../components/component-definition/editors/ImportDefinitionsEditor';
import { ImportComponentDefinition, BackMatter } from '../../lib/types/oscal';

vi.mock('../../lib/api', () => ({
  validateDocument: vi.fn().mockResolvedValue({ valid: true, errors: [] })
}));

describe('ImportDefinitionsEditor Unit Tests', () => {
  const sampleImports: ImportComponentDefinition[] = [
    { href: 'https://example.com/oscal/aws-components.json' },
    { href: '#res-imported-001' }
  ];

  const sampleBackMatter: BackMatter = {
    resources: [
      {
        uuid: 'res-imported-001',
        title: 'Vendor Baseline Definition',
        description: 'Vendor pre-packaged OSCAL component definition',
        base64: {
          filename: 'vendor-def.json',
          'media-type': 'application/json',
          value: btoa(JSON.stringify({
            'component-definition': {
              metadata: { title: 'Vendor Component Pack', version: '2.0.0' },
              components: [{ uuid: 'v-1', title: 'Vendor Firewall', type: 'software', description: 'Packet filter' }]
            }
          }))
        }
      }
    ]
  };

  it('renders imported definitions list with URI and embedded resource indicators', () => {
    render(
      <ImportDefinitionsEditor
        importDefinitions={sampleImports}
        backMatter={sampleBackMatter}
        onChangeImports={vi.fn()}
        editMode={false}
      />
    );

    expect(screen.getByText('https://example.com/oscal/aws-components.json')).toBeInTheDocument();
    expect(screen.getByText('Vendor Baseline Definition')).toBeInTheDocument();
    expect(screen.getByText('Remote URI')).toBeInTheDocument();
    expect(screen.getByText('Embedded Resource')).toBeInTheDocument();
  });

  it('allows adding a new import by URI in edit mode', () => {
    const mockOnChange = vi.fn();
    render(
      <ImportDefinitionsEditor
        importDefinitions={sampleImports}
        backMatter={sampleBackMatter}
        onChangeImports={mockOnChange}
        editMode={true}
      />
    );

    const input = screen.getByPlaceholderText(/Enter URI/i);
    fireEvent.change(input, { target: { value: 'https://oscal.io/nist-core.json' } });

    const addBtn = screen.getByRole('button', { name: /\+ Add Import/i });
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const result = mockOnChange.mock.calls[0][0];
    expect(result.length).toBe(3);
    expect(result[2].href).toBe('https://oscal.io/nist-core.json');
  });

  it('allows removing an import and cleans up back-matter resource', () => {
    const mockOnChangeImports = vi.fn();
    const mockOnChangeBackMatter = vi.fn();

    render(
      <ImportDefinitionsEditor
        importDefinitions={sampleImports}
        backMatter={sampleBackMatter}
        onChangeImports={mockOnChangeImports}
        onChangeBackMatter={mockOnChangeBackMatter}
        editMode={true}
      />
    );

    const deleteBtns = screen.getAllByRole('button', { name: /🗑 Delete/i });
    fireEvent.click(deleteBtns[1]); // Delete #res-imported-001

    expect(mockOnChangeImports).toHaveBeenCalledWith([sampleImports[0]]);
    expect(mockOnChangeBackMatter).toHaveBeenCalledWith({ resources: [] });
  });

  it('opens read-only inspection drawer when Inspect is clicked', () => {
    render(
      <ImportDefinitionsEditor
        importDefinitions={sampleImports}
        backMatter={sampleBackMatter}
        onChangeImports={vi.fn()}
        editMode={false}
      />
    );

    const inspectBtns = screen.getAllByRole('button', { name: /👁️ Inspect/i });
    fireEvent.click(inspectBtns[1]); // Inspect embedded resource

    expect(screen.getByText(/Imported Definition Inspection/i)).toBeInTheDocument();
    expect(screen.getByText('Vendor Component Pack')).toBeInTheDocument();
    expect(screen.getByText('Vendor Firewall')).toBeInTheDocument();
  });

  it('validates an imported document against OSCAL schema on demand', async () => {
    render(
      <ImportDefinitionsEditor
        importDefinitions={sampleImports}
        backMatter={sampleBackMatter}
        onChangeImports={vi.fn()}
        editMode={false}
      />
    );

    const validateBtns = screen.getAllByRole('button', { name: /🔍 Validate/i });
    fireEvent.click(validateBtns[1]); // Validate embedded resource

    await waitFor(() => {
      expect(screen.getByText(/Valid OSCAL Schema/i)).toBeInTheDocument();
    });
  });
});
