import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupEditor } from '@components/shared/GroupEditor';

vi.mock('../../components/shared/PartsEditor', () => ({
  PartsEditor: (props) => (
    <div data-testid="parts-editor-mock">
      <span data-testid="params-count">{props.params ? props.params.length : 0}</span>
      <div data-testid="params-list">
        {props.params?.map(p => (
          <div key={p.id} data-testid={`param-${p.id}`} data-scope={p.scope} data-scopelabel={p.scopeLabel}>
            {p.id}: {p.label} ({p.scopeLabel})
          </div>
        ))}
      </div>
      <button data-testid="define-param-btn" onClick={props.onDefineNewParam}>
        Define Param
      </button>
    </div>
  )
}));

describe('GroupEditor Component', () => {
  const mockOnChange = vi.fn();

  const sampleCatalog = {
    id: 'cat-1',
    title: 'Catalog 1',
    params: [
      { id: 'cat_p1', label: 'Catalog Param 1' },
      { id: 'shared_p', label: 'Catalog Shared Param' }
    ]
  };

  const sampleGroup = {
    id: 'grp-1',
    title: 'Group 1',
    params: [
      { id: 'grp_p1', label: 'Group Param 1' },
      { id: 'shared_p', label: 'Group Shared Override' }
    ],
    parts: [{ name: 'statement', prose: 'Test prose' }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes visible group parameters combining group and catalog parameters without duplicates', () => {
    render(
      <GroupEditor
        group={sampleGroup}
        catalog={sampleCatalog}
        onChange={mockOnChange}
        isEditing={true}
        mode="catalog"
      />
    );

    const grpParam1 = screen.getByTestId('param-grp_p1');
    expect(grpParam1).toBeInTheDocument();
    expect(grpParam1.getAttribute('data-scope')).toBe('group');
    expect(grpParam1.getAttribute('data-scopelabel')).toBe('📁 Group Parameters');

    const catParam1 = screen.getByTestId('param-cat_p1');
    expect(catParam1).toBeInTheDocument();
    expect(catParam1.getAttribute('data-scope')).toBe('catalog');
    expect(catParam1.getAttribute('data-scopelabel')).toBe('🌐 Catalog Parameters');

    // shared_p should take group definition over catalog definition
    const sharedParam = screen.getByTestId('param-shared_p');
    expect(sharedParam).toBeInTheDocument();
    expect(sharedParam.getAttribute('data-scope')).toBe('group');
    expect(sharedParam.textContent).toContain('Group Shared Override');

    expect(screen.getByTestId('params-count').textContent).toBe('3');
  });

  it('calls handleDefineNewParam and appends a new parameter to group.params when mode is catalog', () => {
    render(
      <GroupEditor
        group={sampleGroup}
        catalog={sampleCatalog}
        onChange={mockOnChange}
        isEditing={true}
        mode="catalog"
      />
    );

    const defineBtn = screen.getByTestId('define-param-btn');
    defineBtn.click();

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const updatedGroup = mockOnChange.mock.calls[0][0];
    expect(updatedGroup.params.length).toBe(3);
    expect(updatedGroup.params[2].id).toMatch(/^param_grp-1_\d+_[a-z0-9]+$/);
    expect(updatedGroup.params[2].label).toBe('New Group Parameter');
  });

  it('calls onDeleteGroup when Delete Group button is clicked in edit mode', () => {
    const mockOnDeleteGroup = vi.fn();
    render(
      <GroupEditor
        group={sampleGroup}
        catalog={sampleCatalog}
        onChange={mockOnChange}
        isEditing={true}
        mode="profile"
        onDeleteGroup={mockOnDeleteGroup}
      />
    );

    const deleteBtn = screen.getByTestId('delete-group-btn');
    expect(deleteBtn).toBeInTheDocument();
    deleteBtn.click();
    expect(mockOnDeleteGroup).toHaveBeenCalledWith('grp-1');
  });

  it('calls onAddSubgroup when Add Sub-group button is clicked in edit mode', () => {
    const mockOnAddSubgroup = vi.fn();
    render(
      <GroupEditor
        group={sampleGroup}
        catalog={sampleCatalog}
        onChange={mockOnChange}
        isEditing={true}
        mode="profile"
        onAddSubgroup={mockOnAddSubgroup}
      />
    );

    const addSubgroupBtn = screen.getByTestId('add-subgroup-btn');
    expect(addSubgroupBtn).toBeInTheDocument();
    addSubgroupBtn.click();
    expect(mockOnAddSubgroup).toHaveBeenCalledWith('grp-1');
  });

  it('calls onUnassignControl when remove control button is clicked', () => {
    const mockOnUnassign = vi.fn();
    const groupWithControls = {
      ...sampleGroup,
      controls: [
        { id: 'ac-1', title: 'Access Control Policy' },
        { id: 'ac-2', title: 'Account Management' }
      ]
    };

    render(
      <GroupEditor
        group={groupWithControls}
        catalog={sampleCatalog}
        onChange={mockOnChange}
        isEditing={true}
        mode="profile"
        onUnassignControl={mockOnUnassign}
      />
    );

    const removeBtn = screen.getByTestId('remove-control-btn-ac-1');
    expect(removeBtn).toBeInTheDocument();
    removeBtn.click();
    expect(mockOnUnassign).toHaveBeenCalledWith('ac-1', 'grp-1');
  });

  it('calls onOrderChange when ordering selector value changes', () => {
    const mockOnOrderChange = vi.fn();
    render(
      <GroupEditor
        group={sampleGroup}
        catalog={sampleCatalog}
        onChange={mockOnChange}
        isEditing={true}
        mode="profile"
        onOrderChange={mockOnOrderChange}
      />
    );

    const orderSelect = screen.getByTestId('group-order-select');
    expect(orderSelect).toBeInTheDocument();
    
    // Change value to ascending
    orderSelect.dispatchEvent(new Event('change', { bubbles: true }));
    // fireEvent / change
    const { fireEvent } = require('@testing-library/react');
    fireEvent.change(orderSelect, { target: { value: 'ascending' } });
    expect(mockOnOrderChange).toHaveBeenCalledWith('ascending');
  });
});

