import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PropsEditor } from '../components/shared/PropsEditor';

describe('PropsEditor Profile Mode Tailoring', () => {
  it('renders property correctly in normal mode', () => {
    const props = [{ name: 'sort-id', value: 'ac-1' }];
    render(<PropsEditor props={props} readOnly={false} />);
    
    const nameInput = screen.getByPlaceholderText('name');
    const valueInput = screen.getByPlaceholderText('value');
    
    expect(nameInput.value).toBe('sort-id');
    expect(valueInput.value).toBe('ac-1');
  });

  it('renders removed property with strikethrough, red Removed badge, and always-visible Restore button', () => {
    const props = [{ name: 'sort-id', value: 'ac-1' }];
    const mockOnRestore = vi.fn();
    
    render(
      <PropsEditor
        props={props}
        removedPropNames={['sort-id']}
        onRestoreProp={mockOnRestore}
        readOnly={false}
      />
    );
    
    // Check that inputs are disabled
    const nameInput = screen.getByPlaceholderText('name');
    const valueInput = screen.getByPlaceholderText('value');
    expect(nameInput).toBeDisabled();
    expect(valueInput).toBeDisabled();

    // Check Removed badge
    expect(screen.getByText('Removed')).toBeInTheDocument();

    // Check Restore button
    const restoreBtn = screen.getByRole('button', { name: /Restore/i });
    expect(restoreBtn).toBeInTheDocument();
    
    // Click Restore
    fireEvent.click(restoreBtn);
    expect(mockOnRestore).toHaveBeenCalledWith('sort-id');
  });

  it('renders overridden property with warning styles and a Revert button', () => {
    const props = [{ name: 'sort-id', value: 'modified-ac-1' }];
    const mockOnRevert = vi.fn();
    
    render(
      <PropsEditor
        props={props}
        overriddenPropNames={['sort-id']}
        onRevertProp={mockOnRevert}
        readOnly={false}
      />
    );
    
    // Check Revert button
    const revertBtn = screen.getByRole('button', { name: /Revert/i });
    expect(revertBtn).toBeInTheDocument();
    
    // Click Revert
    fireEvent.click(revertBtn);
    expect(mockOnRevert).toHaveBeenCalledWith('sort-id');
  });
});
