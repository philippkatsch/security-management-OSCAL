import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MergeConfigurator } from '@components/profile/MergeConfigurator';

describe('MergeConfigurator (R1-01)', () => {
  it('sets as-is to boolean true when As-Is radio button is clicked', () => {
    const onChange = vi.fn();
    render(
      <MergeConfigurator
        merge={{ flat: {} }}
        onChange={onChange}
        isEditing={true}
      />
    );

    const asIsRadio = screen.getByLabelText(/As-Is/i);
    fireEvent.click(asIsRadio);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedMerge = onChange.mock.calls[0][0];
    expect(updatedMerge['as-is']).toBe(true);
    expect(typeof updatedMerge['as-is']).toBe('boolean');
  });
});
