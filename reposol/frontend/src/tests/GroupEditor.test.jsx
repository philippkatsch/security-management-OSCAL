import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupEditor } from '../components/shared/GroupEditor';

vi.mock('../components/shared/PartsEditor', () => ({
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

  it('does not add a new parameter when mode is not catalog', () => {
    render(
      <GroupEditor
        group={sampleGroup}
        catalog={sampleCatalog}
        onChange={mockOnChange}
        isEditing={true}
        mode="profile"
      />
    );

    const defineBtn = screen.getByTestId('define-param-btn');
    defineBtn.click();

    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
