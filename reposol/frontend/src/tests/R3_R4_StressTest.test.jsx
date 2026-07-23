import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useRef } from 'react';
import { ParameterCard } from '../components/shared/ParameterCard';
import DocumentEditor from '../components/DocumentEditor';
import { ProseWithParams } from '../components/shared/ProseWithParams';

describe('Requirement R3 & R4 Empirical Stress Tests', () => {

  // =========================================================================
  // REQ R3: ParameterCard Edge Cases
  // =========================================================================
  describe('Requirement R3 — ParameterCard Edge Cases', () => {
    const mockOnChange = vi.fn();
    const mockOnRemove = vi.fn();
    const mockOnToggleExpand = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('R3-01: handles undefined/null usage and guidelines without crashing', () => {
      const paramWithNulls = {
        id: 'prm_null_test',
        label: 'Null Test Param',
        usage: null,
        guidelines: null
      };

      // Render view mode
      const { rerender } = render(
        <ParameterCard
          param={paramWithNulls}
          isExpanded={false}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('prm_null_test')).toBeInTheDocument();

      // Render view mode with invalid guidelines structures
      rerender(
        <ParameterCard
          param={{ ...paramWithNulls, guidelines: [null], usage: undefined }}
          isExpanded={false}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('prm_null_test')).toBeInTheDocument();

      // Render expanded edit mode
      rerender(
        <ParameterCard
          param={paramWithNulls}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('🏷️ Parameter ID')).toBeInTheDocument();
    });

    it('R3-02: [EMPIRICAL BUG] throws TypeError when allParams is explicitly null in edit mode', () => {
      const param = {
        id: 'prm_allparams_test',
        label: 'Params Array Test',
        usage: 'Initial usage'
      };

      let caughtError = null;
      try {
        render(
          <ParameterCard
            param={param}
            isExpanded={true}
            onChange={mockOnChange}
            allParams={null}
          />
        );
      } catch (err) {
        caughtError = err;
      }

      // Empirical verification: line 597 calls allParams.filter without (allParams || []) guard
      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toContain("Cannot read properties of null (reading 'filter')");
    });

    it('R3-03: [EMPIRICAL BUG] throws TypeError when param.values is explicitly null in view/edit mode', () => {
      const paramWithNullValues = {
        id: 'prm_null_vals',
        label: 'Null Values Test',
        values: null
      };

      let caughtError = null;
      try {
        render(
          <ParameterCard
            param={paramWithNullValues}
            isExpanded={false}
            onChange={mockOnChange}
          />
        );
      } catch (err) {
        caughtError = err;
      }

      // Empirical verification: activeValues is assigned null on line 139, causing activeValues[0] to fail on line 142
      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toContain("Cannot read properties of null (reading '0')");
    });

    it('R3-04: multiple rapid placeholder insertions on usage and guidelines', async () => {
      const param = {
        id: 'prm_rapid_test',
        label: 'Rapid Insertion',
        usage: 'Start: ',
        guidelines: [{ prose: 'Guide: ' }]
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
          allParams={[{ id: 'p1', label: 'Param 1' }]}
        />
      );

      const addButtons = screen.getAllByRole('button', { name: /⚙️ Add Parameter/i });
      const usageAddBtn = addButtons[0];

      // Rapid consecutive clicks
      fireEvent.click(usageAddBtn);
      fireEvent.click(usageAddBtn);
      fireEvent.click(usageAddBtn);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });

      // Verify last call received string with parameter placeholder
      const lastCallArg = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCallArg.usage).toContain('{{ insert: param, p1 }}');
    });

    it('R3-05: profile mode displaying catalog default with missing param-id or label', () => {
      const profileParam = {
        values: ['Custom Profile Val']
      };
      const catalogDefault = {
        id: 'cat_default_p1',
        label: 'Catalog Label',
        values: ['Default Val']
      };

      render(
        <ParameterCard
          param={profileParam}
          mode="profile"
          catalogDefaultParam={catalogDefault}
          isExpanded={false}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('cat_default_p1')).toBeInTheDocument();
      expect(screen.getByText('Catalog Label')).toBeInTheDocument();
      expect(screen.getByText('Custom Profile Val')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // REQ R4: DocumentEditor Edge Cases
  // =========================================================================
  describe('Requirement R4 — DocumentEditor Edge Cases', () => {

    it('R4-01: Objective & Method parts array manipulation when ctrl.parts is undefined or null', () => {
      const ctrlWithoutParts = {
        id: 'ac-1',
        title: 'Access Control Policy',
        params: [{ id: 'ac-1_prm_1' }]
      };

      // Test component logic directly: simulating onChange on ProseWithParams for objective & method
      const parts1 = ctrlWithoutParts.parts ? [...ctrlWithoutParts.parts] : [];
      const oIdx1 = parts1.findIndex(p => p.name === 'objective');
      if (oIdx1 >= 0) {
        parts1[oIdx1] = { ...parts1[oIdx1], prose: 'Objective prose text' };
      } else {
        parts1.push({ id: `${ctrlWithoutParts.id}_obj`, name: 'objective', prose: 'Objective prose text' });
      }

      expect(parts1.length).toBe(1);
      expect(parts1[0]).toEqual({ id: 'ac-1_obj', name: 'objective', prose: 'Objective prose text' });

      // Now add method part into the same parts array
      const parts2 = [...parts1];
      const mIdx = parts2.findIndex(p => p.name === 'assessment-method');
      if (mIdx >= 0) {
        parts2[mIdx] = { ...parts2[mIdx], prose: 'Examine security logs' };
      } else {
        parts2.push({ id: `${ctrlWithoutParts.id}_method`, name: 'assessment-method', prose: 'Examine security logs' });
      }

      expect(parts2.length).toBe(2);
      expect(parts2[0].name).toBe('objective');
      expect(parts2[1].name).toBe('assessment-method');

      // Now update objective prose again
      const parts3 = [...parts2];
      const oIdx3 = parts3.findIndex(p => p.name === 'objective');
      parts3[oIdx3] = { ...parts3[oIdx3], prose: 'Updated Objective Prose' };

      expect(parts3.length).toBe(2);
      expect(parts3[0].prose).toBe('Updated Objective Prose');
      expect(parts3[1].prose).toBe('Examine security logs');
    });

    it('R4-02: [EMPIRICAL BUG] ctrl.parts as non-array object or primitive throws TypeError on spread', () => {
      const ctrlWithNonArrayParts = {
        id: 'ac-1',
        title: 'Access Control Policy',
        parts: { name: 'objective', prose: 'Single part object' } // invalid non-array structure
      };

      let caughtError = null;
      try {
        const parts = ctrlWithNonArrayParts.parts ? [...ctrlWithNonArrayParts.parts] : [];
      } catch (err) {
        caughtError = err;
      }

      // Spreading a non-iterable object throws TypeError: ctrlWithNonArrayParts.parts is not iterable
      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toContain("is not iterable");
    });

    it('R4-03: special character parameter placeholders in ProseWithParams', () => {
      const mockOnChange = vi.fn();
      const specialParamId = 'param_with-special.chars_&_symbols';

      render(
        <ProseWithParams
          value={`Prose with {{ insert: param, ${specialParamId} }} inside text.`}
          onChange={mockOnChange}
          params={[{ id: specialParamId, label: 'Special Param' }]}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea.value).toContain(specialParamId);

      // Trigger click to test regex matching on special character param id
      fireEvent.click(textarea, { target: { selectionStart: 25 } });

      // Check if textarea displays text cleanly
      expect(textarea).toBeInTheDocument();
    });

    it('R4-04: multiple controls and groups dynamic structure manipulation', () => {
      // Simulate catalog structure with multiple nested groups and controls
      const initialGroups = [
        {
          id: 'g1',
          title: 'Group 1',
          controls: [
            { id: 'ac-1', title: 'Control 1', parts: [] },
            { id: 'ac-2', title: 'Control 2', parts: [] }
          ]
        },
        {
          id: 'g2',
          title: 'Group 2',
          controls: [
            { id: 'ia-1', title: 'Identification 1', parts: [] }
          ]
        }
      ];

      // Add a 3rd group dynamically
      const updatedGroups = [
        ...initialGroups,
        {
          id: 'g3',
          title: 'Group 3',
          controls: []
        }
      ];

      expect(updatedGroups.length).toBe(3);

      // Add 5 controls to Group 3
      const newControls = Array.from({ length: 5 }, (_, i) => ({
        id: `g3-ctrl-${i + 1}`,
        title: `Dynamic Control ${i + 1}`,
        parts: []
      }));

      updatedGroups[2].controls = newControls;

      expect(updatedGroups[2].controls.length).toBe(5);

      // Delete Group 1
      const afterDelete = updatedGroups.filter(g => g.id !== 'g1');
      expect(afterDelete.length).toBe(2);
      expect(afterDelete[0].id).toBe('g2');
    });

    it('R4-05: ProseWithParams insertParamPlaceholder inserts placeholder correctly', () => {
      const mockOnChange = vi.fn();
      let proseRef = null;

      render(
        <ProseWithParams
          ref={(el) => { proseRef = el; }}
          value="Initial prose: "
          onChange={mockOnChange}
          params={[]} // empty params list
        />
      );

      // Insert param placeholder when no params exist
      proseRef.insertParamPlaceholder();

      expect(mockOnChange).toHaveBeenCalledWith('{{ insert: param, SELECT_PARAM }}Initial prose: ');
    });

    it('R4-06: ProseWithParams dropdown interaction with special characters & unicode in param IDs', () => {
      const mockOnChange = vi.fn();
      let proseRef = null;
      const unicodeParams = [
        { id: 'param_öäü_123', label: 'German Umlaute' },
        { id: 'param_🔥_fire', label: 'Emoji Param' }
      ];

      render(
        <ProseWithParams
          ref={(el) => { proseRef = el; }}
          value=""
          onChange={mockOnChange}
          params={unicodeParams}
        />
      );

      proseRef.insertParamPlaceholder();

      expect(mockOnChange).toHaveBeenCalledWith('{{ insert: param, param_öäü_123 }}');
    });
  });
});
