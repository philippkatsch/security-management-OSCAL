import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatementsEditor } from '../../components/component-definition/editors/StatementsEditor';
import { ComponentStatement } from '../../lib/types/oscal';

describe('StatementsEditor Unit Tests', () => {
  const sampleStatements: ComponentStatement[] = [
    {
      'statement-id': 'ac-7_smt_a',
      uuid: 'stmt-001',
      description: 'Account lock occurs after 3 failed attempts.',
      props: [{ name: 'threshold', value: '3' }],
      links: [{ href: '#comp-1' }]
    },
    {
      'statement-id': 'ac-7_smt_b',
      uuid: 'stmt-002',
      description: 'Unlock requires admin intervention.',
      props: [],
      links: []
    }
  ];

  it('renders statement cards with statement-id and description in read-only mode', () => {
    render(
      <StatementsEditor
        statements={sampleStatements}
        controlId="ac-7"
        onChange={vi.fn()}
        editMode={false}
      />
    );

    expect(screen.getByText('ac-7_smt_a')).toBeInTheDocument();
    expect(screen.getByText('ac-7_smt_b')).toBeInTheDocument();
    expect(screen.getByText('Account lock occurs after 3 failed attempts.')).toBeInTheDocument();
    expect(screen.getByText('Unlock requires admin intervention.')).toBeInTheDocument();
    expect(screen.queryByText('+ Add Statement')).not.toBeInTheDocument();
  });

  it('renders inputs and add/remove buttons in edit mode', () => {
    const mockOnChange = vi.fn();
    render(
      <StatementsEditor
        statements={sampleStatements}
        controlId="ac-7"
        onChange={mockOnChange}
        editMode={true}
      />
    );

    expect(screen.getByDisplayValue('ac-7_smt_a')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Account lock occurs after 3 failed attempts.')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /\+ Add Statement/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const newStatements = mockOnChange.mock.calls[0][0];
    expect(newStatements.length).toBe(3);
    expect(newStatements[2]['statement-id']).toBe('ac-7_smt_c');
  });

  it('updates statement narrative and statement-id', () => {
    const mockOnChange = vi.fn();
    render(
      <StatementsEditor
        statements={sampleStatements}
        controlId="ac-7"
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const idInput = screen.getByDisplayValue('ac-7_smt_a');
    fireEvent.change(idInput, { target: { value: 'ac-7_smt_custom' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ 'statement-id': 'ac-7_smt_custom' })
      ])
    );
  });

  it('removes a statement when delete button is clicked', () => {
    const mockOnChange = vi.fn();
    render(
      <StatementsEditor
        statements={sampleStatements}
        controlId="ac-7"
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const removeBtns = screen.getAllByTitle(/Remove this statement/i);
    fireEvent.click(removeBtns[0]);

    expect(mockOnChange).toHaveBeenCalledWith([sampleStatements[1]]);
  });

  it('detects duplicate statement IDs and displays a warning', () => {
    const dupStatements: ComponentStatement[] = [
      {
        'statement-id': 'ac-7_smt_a',
        uuid: 'stmt-001',
        description: 'First statement'
      },
      {
        'statement-id': 'ac-7_smt_a',
        uuid: 'stmt-002',
        description: 'Second statement duplicate'
      }
    ];

    render(
      <StatementsEditor
        statements={dupStatements}
        controlId="ac-7"
        onChange={vi.fn()}
        editMode={true}
      />
    );

    const warnings = screen.getAllByText(/Duplicate ID/i);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('displays quick add suggestions when availableStatementParts are provided', () => {
    const mockOnChange = vi.fn();
    const parts = [
      { id: 'ac-7_smt_c', label: 'Part C', prose: 'Notification to administrator' }
    ];

    render(
      <StatementsEditor
        statements={sampleStatements}
        controlId="ac-7"
        availableStatementParts={parts}
        onChange={mockOnChange}
        editMode={true}
      />
    );

    const quickAddBtn = screen.getByRole('button', { name: /\+ ac-7_smt_c/i });
    expect(quickAddBtn).toBeInTheDocument();
    fireEvent.click(quickAddBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const addedList = mockOnChange.mock.calls[0][0];
    expect(addedList.some((s: any) => s['statement-id'] === 'ac-7_smt_c')).toBe(true);
  });

  it('toggles metadata drawer to edit statement props and links', () => {
    render(
      <StatementsEditor
        statements={sampleStatements}
        controlId="ac-7"
        onChange={vi.fn()}
        editMode={true}
      />
    );

    const toggleBtns = screen.getAllByRole('button', { name: /▼ Metadata/i });
    fireEvent.click(toggleBtns[0]);

    expect(screen.getByText('Statement Properties')).toBeInTheDocument();
    expect(screen.getByText('Statement Links')).toBeInTheDocument();
  });
});
