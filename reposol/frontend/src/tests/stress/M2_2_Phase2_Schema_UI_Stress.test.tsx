import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProfileAdapter } from '@components/shared/control-editor/adapters/ProfileAdapter';
import { UnifiedControlEditor } from '@components/shared/control-editor/UnifiedControlEditor';
import { MergeConfigurator } from '@components/profile/MergeConfigurator';
import { ControlEditorContext } from '@components/shared/control-editor/ControlEditorContext';
import { ConfirmProvider } from '@components/shared/ui/ConfirmProvider';

describe('Empirical Challenger M2_2: Phase 2 Schema & UI Stress Harness', () => {
  // =========================================================================
  // SUITE 1: ProfileAdapter Strict 1:1 Alter Mapping & Rule Mutation Stress
  // =========================================================================
  describe('ProfileAdapter (1:1 Alter Mapping Stress & Edge Cases)', () => {
    it('consolidates multiple additions and removals into a single 1:1 alter object without duplicates', () => {
      const onProfileChange = vi.fn();
      const mockControl = { id: 'ac-1', title: 'Access Control Policy' };
      const initialProfile = {
        uuid: 'prof-multi-1',
        modify: {
          alters: [
            {
              'control-id': 'ac-2',
              adds: [{ position: 'ending', parts: [{ name: 'statement', prose: 'AC-2 alter' }] }]
            }
          ]
        }
      };

      // 1. Initial render with no alters for ac-1
      const { rerender } = render(
        <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
          <ProfileAdapter
            control={mockControl}
            profile={initialProfile}
            alterations={[]}
            onProfileChange={onProfileChange}
          />
        </ControlEditorContext.Provider>
      );

      // Add first alter block
      fireEvent.click(screen.getByText(/Add Alteration Block/i));
      expect(onProfileChange).toHaveBeenCalledTimes(1);
      const state1 = onProfileChange.mock.calls[0][0];

      expect(state1.modify.alters.length).toBe(2); // ac-2 and ac-1
      const ac1_state1 = state1.modify.alters.find((a: any) => a['control-id'] === 'ac-1');
      expect(ac1_state1).toBeDefined();
      expect(ac1_state1.adds.length).toBe(1);

      // 2. Rerender with state1 and add another addition to ac-1
      const altersForAc1 = state1.modify.alters.filter((a: any) => a['control-id'] === 'ac-1');
      rerender(
        <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
          <ProfileAdapter
            control={mockControl}
            profile={state1}
            alterations={altersForAc1}
            onProfileChange={onProfileChange}
          />
        </ControlEditorContext.Provider>
      );

      // Add a removal rule to the existing block
      fireEvent.click(screen.getByText(/\+ Add Removal/i));
      expect(onProfileChange).toHaveBeenCalledTimes(2);
      const state2 = onProfileChange.mock.calls[1][0];

      const ac1_state2 = state2.modify.alters.filter((a: any) => a['control-id'] === 'ac-1');
      expect(ac1_state2.length).toBe(1); // STILL strictly 1 alter for ac-1
      expect(ac1_state2[0].adds.length).toBe(1);
      expect(ac1_state2[0].removes.length).toBe(1);
      expect(ac1_state2[0].removes[0]).toEqual({ 'by-id': '' });

      // 3. Rerender with state2 and add another structural addition rule
      rerender(
        <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
          <ProfileAdapter
            control={mockControl}
            profile={state2}
            alterations={ac1_state2}
            onProfileChange={onProfileChange}
          />
        </ControlEditorContext.Provider>
      );

      fireEvent.click(screen.getByText(/\+ Add Addition/i));
      expect(onProfileChange).toHaveBeenCalledTimes(3);
      const state3 = onProfileChange.mock.calls[2][0];

      const ac1_state3 = state3.modify.alters.filter((a: any) => a['control-id'] === 'ac-1');
      expect(ac1_state3.length).toBe(1); // STRICT 1:1
      expect(ac1_state3[0].adds.length).toBe(2);
      expect(ac1_state3[0].removes.length).toBe(1);
      // Ensure other control (ac-2) was not modified or corrupted
      const ac2_state3 = state3.modify.alters.find((a: any) => a['control-id'] === 'ac-2');
      expect(ac2_state3).toEqual(initialProfile.modify.alters[0]);
    });

    it('supports all addition positions and removal selectors accurately', () => {
      const onProfileChange = vi.fn();
      const mockControl = { id: 'ia-2', title: 'Identification and Authentication' };
      const currentAlter = {
        'control-id': 'ia-2',
        adds: [
          { position: 'starting', parts: [{ name: 'statement', prose: 'Initial prose' }] }
        ],
        removes: [
          { 'by-id': 'ia-2_smt_a' }
        ]
      };
      const profile = {
        uuid: 'prof-pos-1',
        modify: { alters: [currentAlter] }
      };

      const { rerender } = render(
        <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
          <ProfileAdapter
            control={mockControl}
            profile={profile}
            alterations={[currentAlter]}
            onProfileChange={onProfileChange}
          />
        </ControlEditorContext.Provider>
      );

      // Change addition position from 'starting' to 'before'
      const positionSelect = screen.getByDisplayValue('starting');
      fireEvent.change(positionSelect, { target: { value: 'before' } });

      expect(onProfileChange).toHaveBeenCalledTimes(1);
      let updatedProfile = onProfileChange.mock.calls[0][0];
      let ia2Alter = updatedProfile.modify.alters.find((a: any) => a['control-id'] === 'ia-2');
      expect(ia2Alter.adds[0].position).toBe('before');

      // Change addition prose text
      const proseInput = screen.getByDisplayValue('Initial prose');
      fireEvent.change(proseInput, { target: { value: 'Updated prose text for IA-2.' } });

      expect(onProfileChange).toHaveBeenCalledTimes(2);
      updatedProfile = onProfileChange.mock.calls[1][0];
      ia2Alter = updatedProfile.modify.alters.find((a: any) => a['control-id'] === 'ia-2');
      expect(ia2Alter.adds[0].parts[0].prose).toBe('Updated prose text for IA-2.');

      // Change removal selector from 'by-id' to 'by-name'
      const selectorDropdown = screen.getByDisplayValue('ID (by-id)');
      fireEvent.change(selectorDropdown, { target: { value: 'by-name' } });

      expect(onProfileChange).toHaveBeenCalledTimes(3);
      updatedProfile = onProfileChange.mock.calls[2][0];
      ia2Alter = updatedProfile.modify.alters.find((a: any) => a['control-id'] === 'ia-2');
      expect(ia2Alter.removes[0]).toEqual({ 'by-name': 'ia-2_smt_a' });
    });

    it('handles case-insensitivity in control ID matching when consolidating alters', () => {
      const onProfileChange = vi.fn();
      const mockControl = { id: 'ac-1', title: 'Access Control' };
      const profileWithUppercase = {
        uuid: 'prof-case-1',
        modify: {
          alters: [
            {
              'control-id': 'AC-1', // Uppercase
              adds: [{ position: 'ending', parts: [{ name: 'statement', prose: 'Existing uppercase addition' }] }]
            }
          ]
        }
      };

      const alterations = profileWithUppercase.modify.alters;

      render(
        <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
          <ProfileAdapter
            control={mockControl}
            profile={profileWithUppercase}
            alterations={alterations}
            onProfileChange={onProfileChange}
          />
        </ControlEditorContext.Provider>
      );

      // Add an addition rule
      fireEvent.click(screen.getByText(/\+ Add Addition/i));
      expect(onProfileChange).toHaveBeenCalledTimes(1);
      const updatedProfile = onProfileChange.mock.calls[0][0];

      // Must have matched case-insensitively and updated into a single consolidated alter without creating a second AC-1 alter
      expect(updatedProfile.modify.alters.length).toBe(1);
      expect(updatedProfile.modify.alters[0]['control-id']).toBe('ac-1');
      expect(updatedProfile.modify.alters[0].adds.length).toBe(2);
    });

    it('purges empty modify object when all alters and rules are removed', () => {
      const onProfileChange = vi.fn();
      const mockControl = { id: 'sc-7', title: 'Boundary Protection' };
      const profile = {
        uuid: 'prof-purge-1',
        modify: {
          alters: [
            {
              'control-id': 'sc-7',
              adds: [{ position: 'ending', parts: [{ name: 'statement', prose: 'Solo addition' }] }]
            }
          ]
        }
      };

      render(
        <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: true, dispatch: () => {} }}>
          <ProfileAdapter
            control={mockControl}
            profile={profile}
            alterations={profile.modify.alters}
            onProfileChange={onProfileChange}
          />
        </ControlEditorContext.Provider>
      );

      // Remove the block
      fireEvent.click(screen.getByText(/Remove Block/i));
      expect(onProfileChange).toHaveBeenCalledTimes(1);
      const updatedProfile = onProfileChange.mock.calls[0][0];

      // When modify becomes completely empty, modify should be undefined
      expect(updatedProfile.modify).toBeUndefined();
    });

    it('safely renders in readOnly mode without edit buttons or crash on undefined profile/alterations', () => {
      const mockControl = { id: 'sc-7', title: 'Boundary Protection' };
      
      const { container } = render(
        <ControlEditorContext.Provider value={{ stage: 'profile', control: mockControl as any, isEditing: false, dispatch: () => {} }}>
          <ProfileAdapter
            control={mockControl}
            profile={undefined}
            alterations={undefined}
          />
        </ControlEditorContext.Provider>
      );

      expect(screen.queryByText(/Add Alteration Block/i)).not.toBeInTheDocument();
      expect(container).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 2: UnifiedControlEditor Parameter Overlay & Reactivity Stress
  // =========================================================================
  describe('UnifiedControlEditor (Profile Mode Parameter Overlay Stress)', () => {
    const complexControl: any = {
      id: 'ac-2',
      title: 'Account Management',
      params: [
        { id: 'ac-2_prm_1', label: 'account types', values: ['standard', 'privileged'] },
        { id: 'ac-2_prm_2', label: 'inactivity timeout', values: ['15 minutes'] },
        { id: 'ac-2_prm_3', label: 'threshold count', values: ['3'] },
        { id: 'ac-2_prm_zero', label: 'zero value param', values: ['10'] },
        { id: 'ac-2_prm_unset', label: 'unassigned param', values: [] }
      ],
      parts: [
        {
          id: 'ac-2_smt_a',
          name: 'statement',
          prose: 'Manage accounts: {{ insert: param, ac-2_prm_1 }} with timeout {{ insert: param, ac-2_prm_2 }}. Limit to {{ insert: param, ac-2_prm_3 }} attempts. Grace period {{ insert: param, ac-2_prm_zero }}. Status: {{ insert: param, ac-2_prm_unset }}. Custom Org Target: {{ insert: param, org_prm_reviewer }}.'
        }
      ]
    };

    it('overlays multi-value parameters, custom profile parameters, and zero/falsy values correctly', () => {
      const profile = {
        uuid: 'prof-params-stress',
        modify: {
          'set-parameters': [
            {
              'param-id': 'ac-2_prm_1',
              values: ['contractor', 'emergency-admin', 'guest']
            },
            {
              'param-id': 'ac-2_prm_2',
              values: ['30 minutes'],
              guidelines: [{ prose: 'High security environments require 30 min.' }]
            },
            {
              'param-id': 'ac-2_prm_zero',
              values: ['0'] // String '0' (falsy in loose JS, but must be displayed as valid value)
            },
            {
              'param-id': 'org_prm_reviewer',
              label: 'Compliance Reviewer',
              values: ['SecOps Team'],
              guidelines: [{ prose: 'Assigned to central SecOps team.' }]
            }
          ]
        }
      };

      render(
        <ConfirmProvider>
          <UnifiedControlEditor
            control={complexControl}
            stage="profile"
            profile={profile}
            isEditing={false}
          />
        </ConfirmProvider>
      );

      // Multi-value parameter joined with comma
      expect(screen.getByText('contractor, emergency-admin, guest')).toBeInTheDocument();
      // Overridden parameter
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
      // Unaltered parameter from catalog
      expect(screen.getByText('3')).toBeInTheDocument();
      // Zero string value parameter
      expect(screen.getByText('0')).toBeInTheDocument();
      // Custom profile-only parameter
      expect(screen.getByText('SecOps Team')).toBeInTheDocument();
      // Unset parameter retains bracketed placeholder label
      expect(screen.getByText('[unassigned param]')).toBeInTheDocument();
    });

    it('maintains pure catalog parameters without overlay when stage is "catalog"', () => {
      const profileWithOverrides = {
        uuid: 'prof-ignore',
        modify: {
          'set-parameters': [
            { 'param-id': 'ac-2_prm_1', values: ['profile-only-override'] }
          ]
        }
      };

      render(
        <ConfirmProvider>
          <UnifiedControlEditor
            control={complexControl}
            stage="catalog"
            profile={profileWithOverrides}
            isEditing={false}
          />
        </ConfirmProvider>
      );

      // In catalog mode, profile overrides MUST NOT apply
      expect(screen.getByText('standard, privileged')).toBeInTheDocument();
      expect(screen.queryByText('profile-only-override')).not.toBeInTheDocument();
    });

    it('reacts dynamically to high-frequency profile parameter updates', () => {
      const { rerender } = render(
        <ConfirmProvider>
          <UnifiedControlEditor
            control={complexControl}
            stage="profile"
            profile={{
              uuid: 'prof-reactive',
              modify: {
                'set-parameters': [
                  { 'param-id': 'ac-2_prm_2', values: ['Iteration 1'] }
                ]
              }
            }}
            isEditing={false}
          />
        </ConfirmProvider>
      );

      expect(screen.getByText('Iteration 1')).toBeInTheDocument();

      // Update 2
      rerender(
        <ConfirmProvider>
          <UnifiedControlEditor
            control={complexControl}
            stage="profile"
            profile={{
              uuid: 'prof-reactive',
              modify: {
                'set-parameters': [
                  { 'param-id': 'ac-2_prm_2', values: ['Iteration 2'] }
                ]
              }
            }}
            isEditing={false}
          />
        </ConfirmProvider>
      );

      expect(screen.getByText('Iteration 2')).toBeInTheDocument();
      expect(screen.queryByText('Iteration 1')).not.toBeInTheDocument();

      // Update 3: Parameter unset/cleared in profile
      rerender(
        <ConfirmProvider>
          <UnifiedControlEditor
            control={complexControl}
            stage="profile"
            profile={{
              uuid: 'prof-reactive',
              modify: {
                'set-parameters': []
              }
            }}
            isEditing={false}
          />
        </ConfirmProvider>
      );

      // Falls back to catalog parameter value
      expect(screen.getByText('15 minutes')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 3: MergeConfigurator State Transitions & Boolean As-Is Integrity
  // =========================================================================
  describe('MergeConfigurator (Merge Mode State Transitions & As-Is Integrity)', () => {
    it('cleans up mutually exclusive merge keys when transitioning between as-is, flat, and custom', () => {
      const onChange = vi.fn();

      // Start with flat mode
      const { rerender } = render(
        <MergeConfigurator
          merge={{ combine: { method: 'use-first' }, flat: {} }}
          onChange={onChange}
          isEditing={true}
        />
      );

      // Transition flat -> as-is
      fireEvent.click(screen.getByLabelText(/As-Is/i));
      expect(onChange).toHaveBeenCalledTimes(1);
      const asIsResult = onChange.mock.calls[0][0];
      expect(asIsResult).toEqual({
        combine: { method: 'use-first' },
        'as-is': true
      });
      expect(asIsResult.flat).toBeUndefined();
      expect(asIsResult.custom).toBeUndefined();

      // Transition as-is -> custom
      rerender(
        <MergeConfigurator
          merge={asIsResult}
          onChange={onChange}
          isEditing={true}
        />
      );

      fireEvent.click(screen.getByLabelText(/Custom/i));
      expect(onChange).toHaveBeenCalledTimes(2);
      const customResult = onChange.mock.calls[1][0];
      expect(customResult.custom).toBeDefined();
      expect(customResult['as-is']).toBeUndefined();
      expect(customResult.flat).toBeUndefined();
      expect(Array.isArray(customResult.custom.groups)).toBe(true);

      // Transition custom -> flat
      rerender(
        <MergeConfigurator
          merge={customResult}
          onChange={onChange}
          isEditing={true}
        />
      );

      fireEvent.click(screen.getByLabelText(/Flat/i));
      expect(onChange).toHaveBeenCalledTimes(3);
      const flatResult = onChange.mock.calls[2][0];
      expect(flatResult.flat).toBeDefined();
      expect(flatResult['as-is']).toBeUndefined();
      expect(flatResult.custom).toBeUndefined();
    });

    it('updates duplicate combination method (combine.method) cleanly', () => {
      const onChange = vi.fn();
      render(
        <MergeConfigurator
          merge={{ 'as-is': true, combine: { method: 'use-first' } }}
          onChange={onChange}
          isEditing={true}
        />
      );

      const combineSelect = screen.getByDisplayValue(/Use First/i);
      fireEvent.change(combineSelect, { target: { value: 'keep' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0];
      expect(updated.combine).toEqual({ method: 'keep' });
      expect(updated['as-is']).toBe(true);
    });

    it('supports custom group operations (add, remove, edit folder, sort, include-controls)', () => {
      const onChange = vi.fn();
      const initialCustom = {
        combine: { method: 'merge' },
        custom: {
          groups: [
            {
              id: 'grp-sec',
              title: 'Security Operations',
              'insert-controls': [{ 'include-all': {}, order: 'keep' }]
            }
          ]
        }
      };

      const { rerender } = render(
        <MergeConfigurator
          merge={initialCustom}
          onChange={onChange}
          isEditing={true}
        />
      );

      // Add a second custom group
      fireEvent.click(screen.getByText(/➕ Add Group/i));
      expect(onChange).toHaveBeenCalledTimes(1);
      const state1 = onChange.mock.calls[0][0];
      expect(state1.custom.groups.length).toBe(2);

      // Rerender with state1 and change inclusion mode on group 1 from 'all' to 'controls'
      rerender(
        <MergeConfigurator
          merge={state1}
          onChange={onChange}
          isEditing={true}
        />
      );

      const inclusionSelects = screen.getAllByDisplayValue(/All remaining controls/i);
      fireEvent.change(inclusionSelects[0], { target: { value: 'controls' } });

      expect(onChange).toHaveBeenCalledTimes(2);
      const state2 = onChange.mock.calls[1][0];
      expect(state2.custom.groups[0]['insert-controls'][0]['include-controls']).toBeDefined();
      expect(state2.custom.groups[0]['insert-controls'][0]['include-all']).toBeUndefined();
    });
  });
});
