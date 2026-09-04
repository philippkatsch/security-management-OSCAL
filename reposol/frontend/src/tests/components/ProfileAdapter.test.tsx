import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { ProfileAdapter, useProfileControlAlters } from '@components/shared/control-editor/adapters/ProfileAdapter';
import { ControlEditorContext } from '@components/shared/control-editor/ControlEditorContext';

describe('ProfileAdapter & useProfileControlAlters Unit Tests', () => {
  const mockControl = { id: 'ac-1', title: 'Access Control Policy' };
  const mockProfile = {
    uuid: 'prof-1',
    modify: {
      alters: [
        {
          'control-id': 'ac-1',
          adds: [{ position: 'ending', parts: [{ id: 'ac-1_p1', name: 'statement', prose: 'Existing addition' }] }],
          removes: [{ 'by-id': 'ac-1_smt' }]
        },
        {
          'control-id': 'ac-2',
          adds: [{ position: 'ending', parts: [{ name: 'statement', prose: 'AC-2 addition' }] }]
        }
      ]
    }
  };

  it('enforces 1:1 control-to-alter mapping and does NOT create duplicate alter objects', () => {
    const onProfileChange = vi.fn();
    const alterations = mockProfile.modify.alters.filter(a => a['control-id'] === 'ac-1');

    render(
      <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
        <ProfileAdapter
          control={mockControl}
          profile={mockProfile}
          alterations={alterations}
          onProfileChange={onProfileChange}
        />
      </ControlEditorContext.Provider>
    );

    // Click "Add Alteration Block" button
    const addBtn = screen.getByText(/Add Alteration Block/i);
    fireEvent.click(addBtn);

    expect(onProfileChange).toHaveBeenCalledTimes(1);
    const updatedProfile = onProfileChange.mock.calls[0][0];
    
    // There must be exactly 1 alter for 'ac-1', containing 2 adds
    const ac1Alters = updatedProfile.modify.alters.filter((a: any) => a['control-id'] === 'ac-1');
    expect(ac1Alters.length).toBe(1);
    expect(ac1Alters[0].adds.length).toBe(2);
    expect(updatedProfile.modify.alters.length).toBe(2); // ac-1 and ac-2
  });

  it('removes alter object when all alterations are cleared', () => {
    const onProfileChange = vi.fn();
    const alterations = mockProfile.modify.alters.filter(a => a['control-id'] === 'ac-1');

    render(
      <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
        <ProfileAdapter
          control={mockControl}
          profile={mockProfile}
          alterations={alterations}
          onProfileChange={onProfileChange}
        />
      </ControlEditorContext.Provider>
    );

    // Click "Remove Block"
    const removeBtn = screen.getByText(/Remove Block/i);
    fireEvent.click(removeBtn);

    expect(onProfileChange).toHaveBeenCalledTimes(1);
    const updatedProfile = onProfileChange.mock.calls[0][0];
    
    // ac-1 alter must be removed, leaving only ac-2
    const ac1Alters = (updatedProfile.modify?.alters || []).filter((a: any) => a['control-id'] === 'ac-1');
    expect(ac1Alters.length).toBe(0);
    expect(updatedProfile.modify.alters.length).toBe(1);
  });

  it('allows adding removal rules and add rules inside an alter block', () => {
    const onProfileChange = vi.fn();
    const alterations = mockProfile.modify.alters.filter(a => a['control-id'] === 'ac-1');

    render(
      <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
        <ProfileAdapter
          control={mockControl}
          profile={mockProfile}
          alterations={alterations}
          onProfileChange={onProfileChange}
        />
      </ControlEditorContext.Provider>
    );

    const addAdditionBtn = screen.getByRole('button', { name: /\+ Add Addition/i });
    expect(addAdditionBtn).toBeInTheDocument();
    fireEvent.click(addAdditionBtn);

    expect(onProfileChange).toHaveBeenCalled();
  });

  it('useProfileControlAlters provides resolved parts, append, and reset actions', () => {
    const onProfileChange = vi.fn();
    const origControl = {
      id: 'ac-1',
      parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Baseline prose' }]
    };

    const { result } = renderHook(() =>
      useProfileControlAlters({
        profile: mockProfile as any,
        control: origControl,
        originalControl: origControl,
        onProfileChange,
        allParams: []
      })
    );

    expect(result.current.resolvedParts.length).toBeGreaterThan(0);
    expect(typeof result.current.renderEditPart).toBe('function');
    expect(typeof result.current.handleAddProfilePartAtEnd).toBe('function');

    act(() => {
      result.current.handleAddProfilePartAtEnd('guidance');
    });

    expect(onProfileChange).toHaveBeenCalled();
    const updated = onProfileChange.mock.calls[0][0];
    const ac1Alter = updated.modify.alters.find((a: any) => a['control-id'] === 'ac-1');
    expect(ac1Alter.adds.some((add: any) => add.parts?.some((p: any) => p.name === 'guidance'))).toBe(true);
  });
});
