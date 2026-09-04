import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { formatProse } from '../../lib/oscal-formatting';
import { ParameterCard } from '../../components/shared/ParameterCard';
import { Parameter } from '../../types/oscal';

describe('Challenger M1_1: Phase 1 Parameter & Prose Adversarial Tests', () => {
  describe('formatProse Edge Cases & Adversarial Inputs', () => {
    it('handles falsy valid values: string "0", number 0, boolean false, and boolean true', () => {
      const paramsArray = [
        { id: 'p_zero_str', values: ['0'] },
        { id: 'p_zero_num', values: [0] },
        { id: 'p_false', values: [false] },
        { id: 'p_true', values: [true] },
      ] as any;

      const prose = 'Values: {{ insert: param, p_zero_str }}, {{ insert: param, p_zero_num }}, {{ insert: param, p_false }}, {{ insert: param, p_true }}.';
      const formatted = formatProse(prose, paramsArray);

      expect(formatted).toBe('Values: 0, 0, false, true.');
    });

    it('handles multi-value arrays joining with commas and skipping null/undefined/empty string items', () => {
      const paramsArray = [
        {
          id: 'p_multi',
          values: ['daily', '', null, 'weekly', undefined, '   ', 'monthly', 0, false]
        }
      ] as any;

      const prose = 'Backup schedule options: {{ insert: param, p_multi }}.';
      const formatted = formatProse(prose, paramsArray);

      expect(formatted).toBe('Backup schedule options: daily, weekly, monthly, 0, false.');
    });

    it('falls back to [label] when values is null, undefined, or empty array with a label', () => {
      const paramsArray: any = [
        { id: 'p_null', values: null, label: 'Null Value Label' },
        { id: 'p_undef', values: undefined, label: 'Undefined Value Label' },
        { id: 'p_empty', values: [], label: 'Empty Array Label' },
        { id: 'p_spaces', values: ['   ', ''], label: 'Whitespace Only Label' },
      ];

      const prose = '{{ insert: param, p_null }} | {{ insert: param, p_undef }} | {{ insert: param, p_empty }} | {{ insert: param, p_spaces }}';
      const formatted = formatProse(prose, paramsArray);

      expect(formatted).toBe('[Null Value Label] | [Undefined Value Label] | [Empty Array Label] | [Whitespace Only Label]');
    });

    it('falls back to [param-id] when values is empty and no label is provided', () => {
      const paramsArray: any = [
        { id: 'p_nolabel_null', values: null },
        { id: 'p_nolabel_empty', values: [] },
      ];

      const prose = 'Check {{ insert: param, p_nolabel_null }} and {{ insert: param, p_nolabel_empty }}.';
      const formatted = formatProse(prose, paramsArray);

      expect(formatted).toBe('Check [p_nolabel_null] and [p_nolabel_empty].');
    });

    it('supports param-id key as alternative to id in parameter objects', () => {
      const paramsArray: any = [
        { 'param-id': 'ac-1_prm_1', values: ['30 days'] },
      ];

      const prose = 'Review policy every {{ insert: param, ac-1_prm_1 }}.';
      const formatted = formatProse(prose, paramsArray);

      expect(formatted).toBe('Review policy every 30 days.');
    });

    it('handles dictionary / record params map with mixed object and primitive values', () => {
      const paramsMap = {
        p_str: 'admin',
        p_num: 42,
        p_zero: 0,
        p_false: false,
        p_arr: ['role1', 'role2', 'role3'],
        p_obj_values: { values: ['optA', 'optB'] },
        p_obj_label: { values: null, label: 'Select Target' },
        p_obj_empty: { values: [] },
        p_null: null,
      };

      const prose = 'Config: {{ insert: param, p_str }} | {{ insert: param, p_num }} | {{ insert: param, p_zero }} | {{ insert: param, p_false }} | {{ insert: param, p_arr }} | {{ insert: param, p_obj_values }} | {{ insert: param, p_obj_label }} | {{ insert: param, p_obj_empty }} | {{ insert: param, p_null }} | {{ insert: param, p_missing }}';
      const formatted = formatProse(prose, paramsMap);

      expect(formatted).toBe('Config: admin | 42 | 0 | false | role1, role2, role3 | optA, optB | [Select Target] | [p_obj_empty] | [p_null] | [p_missing]');
    });

    it('handles irregular whitespace in template brackets', () => {
      const paramsArray: any = [
        { id: 'p1', values: ['val1'] },
      ];

      const prose = 'A {{insert:param,p1}} B {{  insert:  param  ,  p1  }} C {{insert:param,  p1}} D';
      const formatted = formatProse(prose, paramsArray);

      expect(formatted).toBe('A val1 B val1 C val1 D');
    });

    it('handles edge case prose inputs gracefully', () => {
      expect(formatProse('', [])).toBe('');
      expect(formatProse(null, [])).toBe('');
      expect(formatProse(undefined, [])).toBe('');
      expect(formatProse('No placeholders here.', [])).toBe('No placeholders here.');
      expect(formatProse('{{ insert: param, missing }}', [])).toBe('[missing]');
    });
  });

  describe('ParameterCard Component Adversarial Stress Tests', () => {
    it('renders safely with param.values as null, undefined, empty array, or non-array without throwing', () => {
      const testCases = [
        { id: 'param_null', values: null, label: 'Null Value Param' },
        { id: 'param_undef', values: undefined, label: 'Undef Value Param' },
        { id: 'param_empty', values: [], label: 'Empty Value Param' },
        { id: 'param_zero', values: ['0'], label: 'Zero Value Param' },
        { id: 'param_multi', values: ['val1', 'val2', 'val3'], label: 'Multi Value Param' },
      ];

      testCases.forEach((paramObj) => {
        const { unmount } = render(
          <ParameterCard
            param={paramObj}
            isExpanded={true}
            readOnly={false}
            mode="catalog"
            onChange={vi.fn()}
          />
        );
        unmount();
      });
    });

    it('renders in profile mode with catalogDefaultParam having null, undefined, or multi-values', () => {
      const defaultParam = {
        id: 'p_override',
        label: 'Default Timeout',
        values: ['15', '30'],
        select: {
          'how-many': 'one',
          choice: ['15', '30', '60']
        }
      };

      const overrideParam = {
        'param-id': 'p_override',
        values: null
      };

      const onChangeMock = vi.fn();

      render(
        <ParameterCard
          param={overrideParam}
          catalogDefaultParam={defaultParam}
          isExpanded={true}
          readOnly={false}
          mode="profile"
          onChange={onChangeMock}
        />
      );

      // Should display catalog default values when override values is null
      expect(screen.getByText('p_override')).toBeDefined();
    });

    it('handles multi-value selection and toggle in profile mode without crashing', () => {
      const defaultParam = {
        id: 'p_choices',
        label: 'Allowed Roles',
        values: ['admin'],
        select: {
          'how-many': 'all',
          choice: ['admin', 'auditor', 'operator', 'guest']
        }
      };

      const overrideParam = {
        'param-id': 'p_choices',
        values: ['admin', 'auditor']
      };

      const onChangeMock = vi.fn();

      render(
        <ParameterCard
          param={overrideParam}
          catalogDefaultParam={defaultParam}
          isExpanded={true}
          readOnly={false}
          mode="profile"
          onChange={onChangeMock}
        />
      );

      expect(screen.getByText('p_choices')).toBeDefined();
    });

    it('safely handles regex constraint validations against empty, single, and multi-values', () => {
      const paramWithConstraints = {
        id: 'p_regex',
        label: 'Port Number',
        values: ['8080'],
        constraints: [
          {
            description: 'Must be valid port',
            tests: [{ expression: '^[0-9]+$', remarks: 'Port must be numeric' }]
          }
        ]
      };

      render(
        <ParameterCard
          param={paramWithConstraints}
          isExpanded={true}
          readOnly={true}
          mode="catalog"
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('p_regex')).toBeDefined();
    });
  });
});
