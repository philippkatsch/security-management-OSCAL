import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParameterCard } from '@components/shared/ParameterCard';

describe('Adversarial Stress Test: ParameterCard Component Robustness', () => {
  const mockOnChange = vi.fn();
  const mockOnRemove = vi.fn();
  const mockOnToggleExpand = vi.fn();
  const mockOnRestore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Extreme Malformed / Boundary Values
  // ---------------------------------------------------------------------------
  describe('Malformed & Boundary Value Arrays', () => {
    it('handles empty parameter object with zero crashes in view mode', () => {
      expect(() => {
        render(
          <ParameterCard
            param={{}}
            mode="catalog"
            isExpanded={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('New Parameter')).toBeInTheDocument();
    });

    it('handles empty parameter object with zero crashes in edit mode', () => {
      expect(() => {
        render(
          <ParameterCard
            param={{}}
            mode="catalog"
            isExpanded={true}
            readOnly={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();

      expect(screen.getByDisplayValue('New Parameter')).toBeInTheDocument();
    });

    it('handles scalar numbers and booleans inside values array: [0, false, "0"]', () => {
      const param = {
        id: 'scalar_vals_prm',
        label: 'Falsy Scalar Values',
        values: [0, false, '0']
      };

      expect(() => {
        render(
          <ParameterCard
            param={param}
            mode="catalog"
            isExpanded={false}
            readOnly={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();

      // Check that scalar 0, false, and '0' render without crashing
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBe(2);
    });

    it('handles values containing null and undefined items safely', () => {
      const param = {
        id: 'null_items_prm',
        label: 'Null items in values',
        values: [null, undefined, 'valid-val']
      };

      expect(() => {
        render(
          <ParameterCard
            param={param}
            mode="catalog"
            isExpanded={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('valid-val')).toBeInTheDocument();
    });

    it('handles non-array values types defensively (e.g. string or object passed as values)', () => {
      const param1 = {
        id: 'string_values_prm',
        values: 'scalar-string-not-array' as any
      };
      const param2 = {
        id: 'object_values_prm',
        values: { invalid: 'object' } as any
      };

      expect(() => {
        render(
          <ParameterCard
            param={param1}
            mode="catalog"
            isExpanded={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();

      expect(() => {
        render(
          <ParameterCard
            param={param2}
            mode="catalog"
            isExpanded={true}
            readOnly={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Select & Choice Edge Cases
  // ---------------------------------------------------------------------------
  describe('Select and Choice Edge Cases', () => {
    it('handles select with null choice and missing how-many', () => {
      const param = {
        id: 'broken_select_prm',
        select: {
          choice: null as any,
          'how-many': null as any
        },
        values: ['option1']
      };

      expect(() => {
        render(
          <ParameterCard
            param={param}
            mode="catalog"
            isExpanded={true}
            readOnly={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();
    });

    it('handles choice with duplicate and empty string items in multi-select mode', () => {
      const param = {
        id: 'dup_choice_prm',
        select: {
          'how-many': 'one-or-more',
          choice: ['Choice A', 'Choice A', '', '   ']
        },
        values: ['Choice A']
      };

      expect(() => {
        render(
          <ParameterCard
            param={param}
            mode="catalog"
            isExpanded={true}
            readOnly={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Constraints, Guidelines, Links, Props Edge Cases
  // ---------------------------------------------------------------------------
  describe('Constraints & Metadata Edge Cases', () => {
    it('handles malformed regex patterns in constraints safely', () => {
      const param = {
        id: 'bad_regex_prm',
        values: ['test-val'],
        constraints: [
          {
            description: 'Broken regex constraint',
            tests: [
              { expression: '[invalid(regex+' }  // Syntax error in regex
            ]
          }
        ]
      };

      expect(() => {
        render(
          <ParameterCard
            param={param}
            mode="catalog"
            isExpanded={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();
    });

    it('handles malformed guidelines array (null / empty objects)', () => {
      const param = {
        id: 'bad_guidelines_prm',
        guidelines: [null as any, {}, { prose: null as any }]
      };

      expect(() => {
        render(
          <ParameterCard
            param={param}
            mode="catalog"
            isExpanded={false}
            onChange={mockOnChange}
          />
        );
      }).not.toThrow();
    });

    it('handles null links and props in edit mode with advanced view opened', () => {
      const param = {
        id: 'null_props_links_prm',
        links: null as any,
        props: null as any
      };

      const { container } = render(
        <ParameterCard
          param={param}
          mode="catalog"
          isExpanded={true}
          readOnly={false}
          onChange={mockOnChange}
        />
      );

      const advBtn = screen.getByTitle(/toggle optional\/advanced parameter metadata/i);
      fireEvent.click(advBtn);

      expect(screen.getByText('Parameter Links')).toBeInTheDocument();
      expect(screen.getByText('Parameter Properties')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Profile Mode Overrides & Revert Safeguards
  // ---------------------------------------------------------------------------
  describe('Profile Mode Overrides and Revert Safeguards', () => {
    it('handles profile parameter without param-id or id attribute, defaulting cleanly', () => {
      const catalogDefault = {
        id: 'cat_default_prm',
        label: 'Default Label',
        values: ['Default Value']
      };
      const profileParam = {
        values: ['Overridden Value']
      };

      render(
        <ParameterCard
          param={profileParam}
          mode="profile"
          catalogDefaultParam={catalogDefault}
          isExpanded={false}
          readOnly={false}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('cat_default_prm')).toBeInTheDocument();
      expect(screen.getByText('Overridden Value')).toBeInTheDocument();
      expect(screen.getByText('↩ Revert to Default')).toBeInTheDocument();

      fireEvent.click(screen.getByText('↩ Revert to Default'));
      expect(mockOnChange).toHaveBeenCalledWith({
        'param-id': 'cat_default_prm'
      });
    });

    it('handles removed state with onRestore callback in profile mode', () => {
      const param = {
        'param-id': 'removed_prm',
        label: 'To be restored'
      };

      render(
        <ParameterCard
          param={param}
          mode="profile"
          isRemoved={true}
          onRestore={mockOnRestore}
          readOnly={false}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Removed')).toBeInTheDocument();
      const restoreBtn = screen.getByText('↩ Restore');
      expect(restoreBtn).toBeInTheDocument();

      fireEvent.click(restoreBtn);
      expect(mockOnRestore).toHaveBeenCalledTimes(1);
    });

    it('handles missing / undefined callback props without crashing when clicked', () => {
      const param = {
        id: 'no_callbacks_prm',
        label: 'No callbacks'
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={false}
          readOnly={false}
          onChange={undefined}
          onRemove={undefined}
          onToggleExpand={undefined}
        />
      );

      const editBtn = screen.getByText('✏️ Edit');
      expect(() => {
        fireEvent.click(editBtn);
      }).not.toThrow();
    });
  });
});
