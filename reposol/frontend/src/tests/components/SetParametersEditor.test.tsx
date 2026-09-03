import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SetParametersEditor } from '../../components/component-definition/editors/SetParametersEditor';
import { SetParameter } from '../../lib/types/oscal';

describe('SetParametersEditor Unit Tests', () => {
  const sampleParams: SetParameter[] = [
    {
      'param-id': 'ac-7_prm_1',
      values: ['3', '5'],
      remarks: 'Configurable attempt threshold'
    },
    {
      'param-id': 'ac-7_prm_2',
      values: ['15_minutes'],
      remarks: 'Lockout duration'
    }
  ];

  it('renders parameter cards with param-id and values in read-only mode', () => {
    render(
      <SetParametersEditor
        setParameters={sampleParams}
        onChange={vi.fn()}
        editMode={false}
        level="requirement"
      />
    );

    expect(screen.getByText('ac-7_prm_1')).toBeInTheDocument();
    expect(screen.getByText('ac-7_prm_2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('15_minutes')).toBeInTheDocument();
    expect(screen.queryByText('+ Add Parameter')).not.toBeInTheDocument();
  });

  it('renders edit mode inputs and allows adding a new parameter', () => {
    const mockOnChange = vi.fn();
    render(
      <SetParametersEditor
        setParameters={sampleParams}
        onChange={mockOnChange}
        editMode={true}
        level="set"
      />
    );

    expect(screen.getByDisplayValue('ac-7_prm_1')).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /\+ Add Parameter/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const result = mockOnChange.mock.calls[0][0];
    expect(result.length).toBe(3);
    expect(result[2]['param-id']).toBe('param-3');
  });

  it('allows adding and removing values from values array', () => {
    const mockOnChange = vi.fn();
    render(
      <SetParametersEditor
        setParameters={sampleParams}
        onChange={mockOnChange}
        editMode={true}
        level="requirement"
      />
    );

    // Add a new value tag to first parameter
    const valueInputs = screen.getAllByPlaceholderText('Add value...');
    fireEvent.change(valueInputs[0], { target: { value: '10' } });
    
    const addValueBtns = screen.getAllByRole('button', { name: /^\+ Add$/i });
    fireEvent.click(addValueBtns[0]);

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated[0].values).toEqual(['3', '5', '10']);
  });

  it('removes a value when × button is clicked', () => {
    const mockOnChange = vi.fn();
    render(
      <SetParametersEditor
        setParameters={sampleParams}
        onChange={mockOnChange}
        editMode={true}
        level="requirement"
      />
    );

    const deleteValBtns = screen.getAllByRole('button', { name: '×' });
    fireEvent.click(deleteValBtns[0]); // Delete '3'

    expect(mockOnChange).toHaveBeenCalled();
    const updated = mockOnChange.mock.calls[0][0];
    expect(updated[0].values).toEqual(['5']);
  });

  it('shows warning when values array is empty', () => {
    const emptyValuesParam: SetParameter[] = [
      {
        'param-id': 'ac-7_prm_empty',
        values: [],
        remarks: 'Empty'
      }
    ];

    render(
      <SetParametersEditor
        setParameters={emptyValuesParam}
        onChange={vi.fn()}
        editMode={true}
        level="requirement"
      />
    );

    expect(screen.getByText(/At least one non-empty value is required/i)).toBeInTheDocument();
  });

  it('detects duplicate parameter IDs', () => {
    const dupParams: SetParameter[] = [
      { 'param-id': 'ac-7_prm_1', values: ['3'] },
      { 'param-id': 'ac-7_prm_1', values: ['5'] }
    ];

    render(
      <SetParametersEditor
        setParameters={dupParams}
        onChange={vi.fn()}
        editMode={true}
        level="requirement"
      />
    );

    const warnings = screen.getAllByText(/Duplicate/i);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('allows quick adding available catalog parameters', () => {
    const mockOnChange = vi.fn();
    const available = [
      { id: 'ac-7_prm_3', label: 'Reset Timer', usage: 'Number of minutes' }
    ];

    render(
      <SetParametersEditor
        setParameters={sampleParams}
        availableParams={available}
        onChange={mockOnChange}
        editMode={true}
        level="requirement"
      />
    );

    const quickAddBtn = screen.getByRole('button', { name: /\+ ac-7_prm_3/i });
    expect(quickAddBtn).toBeInTheDocument();
    fireEvent.click(quickAddBtn);

    expect(mockOnChange).toHaveBeenCalled();
    const result = mockOnChange.mock.calls[0][0];
    expect(result.some((p: any) => p['param-id'] === 'ac-7_prm_3')).toBe(true);
  });
});
