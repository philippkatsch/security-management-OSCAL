import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProseWithParams } from '../components/shared/ProseWithParams';

describe('ProseWithParams Component', () => {
  const mockOnChange = vi.fn();
  const mockOnDefineNewParam = vi.fn();

  const mockParams = [
    { id: 'ac-1_prm_1', label: 'Access Policy', scope: 'control' },
    { id: 'ac-1_prm_2', label: 'Review Period', scope: 'control' },
    { id: 'cat_prm_1', label: 'Global Timeout', scope: 'catalog', scopeLabel: 'Catalog Parameters' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Textarea Rendering & Placeholder Insertion Detection
  // ---------------------------------------------------------------------------
  describe('Textarea Rendering & Dropdown Triggering', () => {
    it('renders textarea with given value and placeholder', () => {
      render(
        <ProseWithParams
          value="Enforce policy every {{ insert: param, ac-1_prm_1 }} days."
          onChange={mockOnChange}
          params={mockParams}
          placeholder="Enter control prose..."
        />
      );

      const textarea = screen.getByPlaceholderText('Enter control prose...');
      expect(textarea).toBeInTheDocument();
      expect(textarea.value).toBe('Enforce policy every {{ insert: param, ac-1_prm_1 }} days.');
    });

    it('triggers onChange when typing in textarea', () => {
      render(
        <ProseWithParams
          value="Initial prose"
          onChange={mockOnChange}
          params={mockParams}
        />
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Updated prose' } });

      expect(mockOnChange).toHaveBeenCalledWith('Updated prose');
    });

    it('opens parameter selection dropdown when cursor is inside placeholder syntax', () => {
      const prose = 'Enforce policy every {{ insert: param, ac-1_prm_1 }} days.';
      render(
        <ProseWithParams
          value={prose}
          onChange={mockOnChange}
          params={mockParams}
        />
      );

      const textarea = screen.getByRole('textbox');
      // Set selection inside {{ insert: param, ac-1_prm_1 }}
      textarea.setSelectionRange(25, 25);
      fireEvent.click(textarea);

      // Dropdown should be displayed
      const dropdown = document.querySelector('.caret-param-dropdown');
      expect(dropdown).toBeInTheDocument();

      // Check parameter options are listed in dropdown
      expect(screen.getByText('ac-1_prm_1')).toBeInTheDocument();
      expect(screen.getByText('ac-1_prm_2')).toBeInTheDocument();
    });

    it('groups parameters by scope in dropdown menu', () => {
      const prose = 'Test {{ insert: param, ac-1_prm_1 }}';
      render(
        <ProseWithParams
          value={prose}
          onChange={mockOnChange}
          params={mockParams}
        />
      );

      const textarea = screen.getByRole('textbox');
      textarea.setSelectionRange(10, 10);
      fireEvent.click(textarea);

      expect(screen.getByText('Control Parameters')).toBeInTheDocument();
      expect(screen.getByText('Catalog Parameters')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Live Prose Parameter Substitution
  // ---------------------------------------------------------------------------
  describe('Live Prose Parameter Substitution', () => {
    it('substitutes parameter placeholder with selected option and fires onChange', () => {
      const prose = 'Enforce policy every {{ insert: param, ac-1_prm_1 }} days.';
      render(
        <ProseWithParams
          value={prose}
          onChange={mockOnChange}
          params={mockParams}
        />
      );

      const textarea = screen.getByRole('textbox');
      textarea.setSelectionRange(25, 25);
      fireEvent.click(textarea);

      // Click on ac-1_prm_2 in the dropdown menu
      const optionBtn = screen.getByText('ac-1_prm_2').closest('button');
      fireEvent.click(optionBtn);

      expect(mockOnChange).toHaveBeenCalledWith(
        'Enforce policy every {{ insert: param, ac-1_prm_2 }} days.'
      );
    });

    it('handles dropdown selection for multi-placeholder prose statements', () => {
      const prose = 'Change {{ insert: param, ac-1_prm_1 }} every {{ insert: param, ac-1_prm_2 }} days.';
      render(
        <ProseWithParams
          value={prose}
          onChange={mockOnChange}
          params={mockParams}
        />
      );

      const textarea = screen.getByRole('textbox');
      // Position inside second placeholder
      const secondPlaceholderIndex = prose.indexOf('ac-1_prm_2');
      textarea.setSelectionRange(secondPlaceholderIndex, secondPlaceholderIndex);
      fireEvent.click(textarea);

      const optionBtn = screen.getByText('cat_prm_1').closest('button');
      fireEvent.click(optionBtn);

      expect(mockOnChange).toHaveBeenCalledWith(
        'Change {{ insert: param, ac-1_prm_1 }} every {{ insert: param, cat_prm_1 }} days.'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Imperative Handle: insertParamPlaceholder
  // ---------------------------------------------------------------------------
  describe('Imperative Handle (insertParamPlaceholder)', () => {
    it('inserts parameter placeholder at cursor via ref call and opens dropdown', () => {
      const ref = createRef();
      render(
        <ProseWithParams
          ref={ref}
          value="Initial text."
          onChange={mockOnChange}
          params={mockParams}
        />
      );

      act(() => {
        ref.current.insertParamPlaceholder();
      });

      // Should insert first parameter ID by default at start of text
      expect(mockOnChange).toHaveBeenCalledWith(
        '{{ insert: param, ac-1_prm_1 }}Initial text.'
      );
    });

    it('uses SELECT_PARAM as fallback placeholder when params list is empty', () => {
      const ref = createRef();
      render(
        <ProseWithParams
          ref={ref}
          value="Empty params text."
          onChange={mockOnChange}
          params={[]}
        />
      );

      act(() => {
        ref.current.insertParamPlaceholder();
      });

      expect(mockOnChange).toHaveBeenCalledWith(
        '{{ insert: param, SELECT_PARAM }}Empty params text.'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Dropdown Options & Callbacks
  // ---------------------------------------------------------------------------
  describe('Dropdown Menu Options & Callbacks', () => {
    it('renders "➕ Define New Parameter..." option and calls callback when clicked', () => {
      const prose = 'Test {{ insert: param, ac-1_prm_1 }}';
      render(
        <ProseWithParams
          value={prose}
          onChange={mockOnChange}
          params={mockParams}
          onDefineNewParam={mockOnDefineNewParam}
        />
      );

      const textarea = screen.getByRole('textbox');
      textarea.setSelectionRange(10, 10);
      fireEvent.click(textarea);

      const newParamBtn = screen.getByText(/Define New Parameter/i);
      expect(newParamBtn).toBeInTheDocument();

      fireEvent.click(newParamBtn);
      expect(mockOnDefineNewParam).toHaveBeenCalledTimes(1);
    });

    it('renders "No parameters defined." when params array is empty', () => {
      const prose = 'Test {{ insert: param, missing_param }}';
      render(
        <ProseWithParams
          value={prose}
          onChange={mockOnChange}
          params={[]}
        />
      );

      const textarea = screen.getByRole('textbox');
      textarea.setSelectionRange(10, 10);
      fireEvent.click(textarea);

      expect(screen.getByText('No parameters defined.')).toBeInTheDocument();
    });

    it('does not render dropdown menu when disabled is true', () => {
      const prose = 'Disabled {{ insert: param, ac-1_prm_1 }}';
      render(
        <ProseWithParams
          value={prose}
          onChange={mockOnChange}
          params={mockParams}
          disabled={true}
        />
      );

      const textarea = screen.getByRole('textbox');
      textarea.setSelectionRange(15, 15);
      fireEvent.click(textarea);

      expect(document.querySelector('.caret-param-dropdown')).not.toBeInTheDocument();
    });
  });
});
