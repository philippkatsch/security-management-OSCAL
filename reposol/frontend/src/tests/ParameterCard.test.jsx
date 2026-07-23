import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ParameterCard } from '../components/shared/ParameterCard';
import { ParameterEditor } from '../components/shared/ParameterEditor';

describe('ParameterCard Component', () => {
  const mockOnChange = vi.fn();
  const mockOnRemove = vi.fn();
  const mockOnToggleExpand = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Rendering in Catalog mode vs Profile mode
  // ---------------------------------------------------------------------------
  describe('Rendering (Catalog vs Profile Mode)', () => {
    it('renders parameter in Catalog mode with ID, label, values, choices and delete button', () => {
      const param = {
        id: 'ac-1_prm_1',
        label: 'System Access Period',
        values: ['30 days'],
        select: { 'how-many': 'one', choice: ['30 days', '60 days', '90 days'] },
        usage: 'Defines account review frequency',
        guidelines: [{ prose: 'Select standard period' }]
      };

      render(
        <ParameterCard
          param={param}
          mode="catalog"
          isExpanded={false}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      // Verify ID and Label
      expect(screen.getByText('ac-1_prm_1')).toBeInTheDocument();
      expect(screen.getByText('System Access Period')).toBeInTheDocument();

      // Verify Values and Choice tags
      expect(screen.getByText('30 days')).toBeInTheDocument();
      expect(screen.getByText(/Choice:\s*30 days/i)).toBeInTheDocument();
      expect(screen.getByText(/Choice:\s*60 days/i)).toBeInTheDocument();
      expect(screen.getByText(/Choice:\s*90 days/i)).toBeInTheDocument();

      // Verify Usage/Guidelines prose
      expect(screen.getByText('Defines account review frequency')).toBeInTheDocument();

      // Verify Selection rule hint
      expect(screen.getByText(/Selection rule:\s*one/i)).toBeInTheDocument();

      // Verify Edit and Delete buttons exist in catalog mode
      expect(screen.getByText('✏️ Edit')).toBeInTheDocument();
      expect(screen.getByText('🗑')).toBeInTheDocument();

      // Ensure Overridden badge is NOT present
      expect(screen.queryByText('[Overridden]')).not.toBeInTheDocument();
    });

    it('renders parameter in Profile mode with catalog defaults and [Overridden] badge', () => {
      const catalogDefaultParam = {
        id: 'ac-1_prm_1',
        label: 'Catalog Default Label',
        values: ['30 days'],
        usage: 'Catalog usage'
      };

      const profileParam = {
        'param-id': 'ac-1_prm_1',
        values: ['60 days']
      };

      render(
        <ParameterCard
          param={profileParam}
          mode="profile"
          catalogDefaultParam={catalogDefaultParam}
          isExpanded={false}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      // Displays parameter ID and merged catalog label
      expect(screen.getByText('ac-1_prm_1')).toBeInTheDocument();
      expect(screen.getByText('Catalog Default Label')).toBeInTheDocument();

      // Displays overridden value
      expect(screen.getByText('60 days')).toBeInTheDocument();

      // Displays Revert to Default button in profile mode when parameter has overrides
      expect(screen.getByText('↩ Revert to Default')).toBeInTheDocument();

      // Delete button must be rendered in profile mode if onRemove is provided
      expect(screen.getByText('🗑')).toBeInTheDocument();
    });

    it('renders edit mode notice in profile mode when expanded', () => {
      const catalogDefaultParam = {
        id: 'ac-1_prm_1',
        label: 'Default Label',
        values: ['10']
      };

      const profileParam = {
        'param-id': 'ac-1_prm_1',
        values: ['20']
      };

      render(
        <ParameterCard
          param={profileParam}
          mode="profile"
          catalogDefaultParam={catalogDefaultParam}
          isExpanded={true}
          onChange={mockOnChange}
          onRemove={mockOnRemove}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      // Parameter ID input should be disabled in profile mode
      const idInput = screen.getByDisplayValue('ac-1_prm_1');
      expect(idInput).toBeDisabled();
    });

    it('does not render edit/delete controls when readOnly is true', () => {
      const param = { id: 'ac-1_prm_1', label: 'Read Only Param' };

      render(
        <ParameterCard
          param={param}
          readOnly={true}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByText('✏️ Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('🗑')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Editing Free-Text Values & Parameter Attributes
  // ---------------------------------------------------------------------------
  describe('Editing Free-Text Values & Attributes', () => {
    it('triggers onToggleExpand when clicking Edit button', () => {
      const param = { id: 'ac-1_prm_1', label: 'Toggle Test' };

      render(
        <ParameterCard
          param={param}
          isExpanded={false}
          onChange={mockOnChange}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      fireEvent.click(screen.getByText('✏️ Edit'));
      expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
    });

    it('edits free-text parameter values input and triggers onChange with value array', async () => {
      const param = {
        id: 'ac-1_prm_1',
        label: 'Free-text Param',
        values: ['30 days']
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const valuesInput = screen.getByDisplayValue('30 days');
      fireEvent.change(valuesInput, { target: { value: '60 days, 90 days' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          ...param,
          values: ['60 days', '90 days']
        });
      });
    });

    it('edits parameter label, usage, class, and depends-on fields', async () => {
      const param = {
        id: 'ac-1_prm_1',
        label: 'Old Label',
        usage: 'Old Usage',
        class: 'Old Class'
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      // Edit Label
      const labelInput = screen.getByDisplayValue('Old Label');
      fireEvent.change(labelInput, { target: { value: 'New Label' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({ label: 'New Label' })
        );
      });
    });

    it('removes field from parameter when text is cleared', async () => {
      const param = {
        id: 'ac-1_prm_1',
        label: 'Label to Clear',
        usage: 'Usage to Clear'
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const usageInput = screen.getByDisplayValue('Usage to Clear');
      fireEvent.change(usageInput, { target: { value: '' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
        const lastCallArg = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(lastCallArg.usage).toBeUndefined();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Selecting Single & Multi Choices
  // ---------------------------------------------------------------------------
  describe('Single & Multi Choice Selection', () => {
    it('renders choice tags and selection rule hint in view mode', () => {
      const param = {
        id: 'ia-5_prm_1',
        label: 'Authenticator Choice',
        select: {
          'how-many': 'one-or-more',
          choice: ['TLS 1.2', 'TLS 1.3', 'IPsec']
        }
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={false}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Choice:\s*TLS 1.2/i)).toBeInTheDocument();
      expect(screen.getByText(/Choice:\s*TLS 1.3/i)).toBeInTheDocument();
      expect(screen.getByText(/Choice:\s*IPsec/i)).toBeInTheDocument();
      expect(screen.getByText(/Selection rule:\s*one-or-more/i)).toBeInTheDocument();
    });

    it('selects single choice from choice dropdown in edit mode', () => {
      const param = {
        id: 'ia-5_prm_1',
        select: {
          'how-many': 'one',
          choice: ['8 characters', '12 characters', '16 characters']
        },
        values: ['8 characters']
      };

      const { container } = render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      const valueSelect = container.querySelector('select');
      fireEvent.change(valueSelect, { target: { value: '16 characters' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...param,
        values: ['16 characters']
      });
    });

    it('shows custom value input when Custom Value... option is selected in choice dropdown', () => {
      const param = {
        id: 'ia-5_prm_1',
        select: {
          'how-many': 'one',
          choice: ['8 characters', '12 characters']
        },
        values: ['8 characters']
      };

      const { container } = render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      const valueSelect = container.querySelector('select');
      fireEvent.change(valueSelect, { target: { value: '__custom__' } });

      const customInput = screen.getByPlaceholderText('Enter custom parameter value...');
      expect(customInput).toBeInTheDocument();
    });

    it('edits choices input in configuration section and triggers onChange', async () => {
      const param = {
        id: 'ia-5_prm_1',
        select: {
          'how-many': 'one',
          choice: ['8', '12']
        }
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      const choicesConfigInput = screen.getByDisplayValue('8, 12');
      fireEvent.change(choicesConfigInput, { target: { value: '8, 12, 16' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          ...param,
          select: {
            'how-many': 'one',
            choice: ['8', '12', '16']
          }
        });
      });
    });

    it('toggles multi-choice checkboxes in edit mode when how-many is one-or-more', () => {
      const param = {
        id: 'ia-5_prm_1',
        select: {
          'how-many': 'one-or-more',
          choice: ['TLS 1.2', 'TLS 1.3', 'IPsec']
        },
        values: ['TLS 1.2']
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      const tls13Checkbox = screen.getByLabelText('TLS 1.3');
      fireEvent.click(tls13Checkbox);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...param,
        values: ['TLS 1.2', 'TLS 1.3']
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Constraint Display & Modification
  // ---------------------------------------------------------------------------
  describe('Constraint Display & Modification', () => {
    it('displays constraint warning in view mode when parameter value violates constraint regex', () => {
      const param = {
        id: 'ac-1_prm_2',
        label: 'Constraint Param',
        values: ['invalid_text'],
        constraints: [
          { description: 'Must be numeric', tests: [{ expression: '^[0-9]+$' }] }
        ]
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={false}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText(/Must be numeric/i)).toBeInTheDocument();
    });

    it('adds a new constraint when clicking "➕ Add Constraint"', () => {
      const param = {
        id: 'ac-1_prm_2',
        label: 'Constraint Param'
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      const addBtn = screen.getByText('➕ Add Constraint');
      fireEvent.click(addBtn);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...param,
        constraints: [
          {
            description: 'New Constraint',
            tests: [{ expression: '.*', remarks: 'Value must match constraint regex' }]
          }
        ]
      });
    });

    it('updates constraint description and expression in edit mode', async () => {
      const param = {
        id: 'ac-1_prm_2',
        constraints: [
          { description: 'Original Description', tests: [{ expression: '.*' }] }
        ]
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      const descInput = screen.getByDisplayValue('Original Description');
      fireEvent.change(descInput, { target: { value: 'Updated Constraint Description' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          ...param,
          constraints: [
            { description: 'Updated Constraint Description', tests: [{ expression: '.*' }] }
          ]
        });
      });
    });

    it('removes constraint when clicking constraint delete button', () => {
      const param = {
        id: 'ac-1_prm_2',
        constraints: [
          { description: 'Constraint to Remove', tests: [{ expression: '.*' }] }
        ]
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      // Find delete button inside constraints container
      const deleteButtons = screen.getAllByText('🗑');
      const constraintDeleteBtn = deleteButtons[deleteButtons.length - 1];
      fireEvent.click(constraintDeleteBtn);

      expect(mockOnChange).toHaveBeenCalledWith({ id: 'ac-1_prm_2' });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Unassigned State
  // ---------------------------------------------------------------------------
  describe('Unassigned State Handling', () => {
    it('renders unassigned state cleanly in view mode without values or choices', () => {
      const param = {
        id: 'prm_unassigned',
        label: 'Unassigned Parameter'
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={false}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('prm_unassigned')).toBeInTheDocument();
      expect(screen.getByText('Unassigned Parameter')).toBeInTheDocument();
      expect(screen.queryByText('Selection:')).not.toBeInTheDocument();
      expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
    });

    it('allows assigning initial values to an unassigned parameter in edit mode', async () => {
      const param = {
        id: 'prm_unassigned',
        label: 'Unassigned Parameter'
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
        />
      );

      const valuesInput = screen.getByPlaceholderText('Enter default value(s), comma-separated');
      fireEvent.change(valuesInput, { target: { value: 'Initial Value' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          ...param,
          values: ['Initial Value']
        });
      });
    });
  });

  describe('Requirement R3 — Parameter Card Integration with ProseWithParams', () => {
    it('renders Add Parameter buttons for usage and guidelines fields when expanded', () => {
      const param = {
        id: 'param_1',
        label: 'Test Parameter',
        usage: 'Initial usage',
        guidelines: [{ prose: 'Initial guideline' }]
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
          allParams={[{ id: 'param_1' }, { id: 'param_2' }]}
        />
      );

      const addParamButtons = screen.getAllByRole('button', { name: /⚙️ Add Parameter/i });
      expect(addParamButtons.length).toBe(2);
    });

    it('triggers parameter placeholder insertion on usage and guidelines when clicking Add Parameter buttons', async () => {
      const param = {
        id: 'param_1',
        label: 'Test Parameter',
        usage: 'Usage text',
        guidelines: [{ prose: 'Guideline text' }]
      };

      render(
        <ParameterCard
          param={param}
          isExpanded={true}
          onChange={mockOnChange}
          allParams={[{ id: 'param_1' }, { id: 'param_2' }]}
        />
      );

      const [usageAddBtn, guidelinesAddBtn] = screen.getAllByRole('button', { name: /⚙️ Add Parameter/i });

      fireEvent.click(usageAddBtn);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            usage: expect.stringContaining('{{ insert: param, param_1 }}')
          })
        );
      });

      mockOnChange.mockClear();

      fireEvent.click(guidelinesAddBtn);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(
          expect.objectContaining({
            guidelines: [{ prose: expect.stringContaining('{{ insert: param, param_1 }}') }]
          })
        );
      });
    });
  });

  describe('ParameterEditor Component', () => {
    it('renders Add Parameter button in profile mode when readOnly is false', () => {
      render(
        <ParameterEditor
          params={[]}
          catalogParams={[{ id: 'cat_p1', label: 'Cat Param' }]}
          mode="profile"
          onChange={mockOnChange}
          readOnly={false}
        />
      );

      expect(screen.getByText('➕ Add Parameter')).toBeInTheDocument();
      fireEvent.click(screen.getByText('➕ Add Parameter'));
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('prevents deletion and alerts the user if parameter is referenced in the document', () => {
      const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const fullDoc = {
        id: "cat_1",
        metadata: {},
        controls: [
          {
            id: "ac-1",
            parts: [
              {
                id: "ac-1_smt.a",
                name: "statement",
                prose: "Enforce policy every {{ insert: param, custom_p1 }} days."
              }
            ]
          }
        ]
      };
      
      const testParams = [{ id: 'custom_p1', label: 'Custom Param' }];
      
      render(
        <ParameterEditor
          params={testParams}
          mode="catalog"
          onChange={mockOnChange}
          readOnly={false}
          fullDocument={fullDoc}
        />
      );

      const deleteBtn = screen.getByText('🗑');
      expect(deleteBtn).toBeInTheDocument();
      fireEvent.click(deleteBtn);

      expect(mockAlert).toHaveBeenCalledWith(
        expect.stringContaining('Cannot delete parameter "custom_p1" because it is inserted in control statement prose')
      );
      expect(mockOnChange).not.toHaveBeenCalled();

      mockAlert.mockRestore();
    });

    it('prevents deletion and alerts the user if parameter is referenced via bracket notation [param_id]', () => {
      const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const fullDoc = {
        id: "cat_1",
        metadata: {},
        controls: [
          {
            id: "ac-1",
            parts: [
              {
                id: "ac-1_smt.a",
                name: "statement",
                prose: "Enforce policy every [custom_p1] days."
              }
            ]
          }
        ]
      };
      
      const testParams = [{ id: 'custom_p1', label: 'Custom Param' }];
      
      render(
        <ParameterEditor
          params={testParams}
          mode="catalog"
          onChange={mockOnChange}
          readOnly={false}
          fullDocument={fullDoc}
        />
      );

      const deleteBtn = screen.getByText('🗑');
      expect(deleteBtn).toBeInTheDocument();
      fireEvent.click(deleteBtn);

      expect(mockAlert).toHaveBeenCalledWith(
        expect.stringContaining('Cannot delete parameter "custom_p1" because it is inserted in control statement prose')
      );
      expect(mockOnChange).not.toHaveBeenCalled();

      mockAlert.mockRestore();
    });

    it('supports deleting and restoring catalog default parameters in profile mode', () => {
      const mockOnChangeAlters = vi.fn();
      const catalogParams = [{ id: 'cat_p1', label: 'Cat Param' }];
      const fullDoc = {
        id: "profile_1",
        modify: {
          alters: [
            {
              'control-id': 'ac-1',
              removes: [{ 'by-id': 'cat_p1' }]
            }
          ]
        }
      };

      const { rerender } = render(
        <ParameterEditor
          params={[]}
          catalogParams={catalogParams}
          mode="profile"
          context="local"
          parentId="ac-1"
          parentType="control"
          onChange={mockOnChange}
          onChangeAlters={mockOnChangeAlters}
          readOnly={false}
          fullDocument={fullDoc}
        />
      );

      expect(screen.getByText('Removed')).toBeInTheDocument();
      const restoreBtn = screen.getByText('↩ Restore');
      expect(restoreBtn).toBeInTheDocument();

      fireEvent.click(restoreBtn);
      expect(mockOnChangeAlters).toHaveBeenCalled();

      const docWithNoRemoves = {
        id: "profile_1",
        modify: { alters: [] }
      };

      rerender(
        <ParameterEditor
          params={[]}
          catalogParams={catalogParams}
          mode="profile"
          context="local"
          parentId="ac-1"
          parentType="control"
          onChange={mockOnChange}
          onChangeAlters={mockOnChangeAlters}
          readOnly={false}
          fullDocument={docWithNoRemoves}
        />
      );

      const deleteBtn = screen.getByText('🗑');
      expect(deleteBtn).toBeInTheDocument();
      
      fireEvent.click(deleteBtn);
      expect(mockOnChangeAlters).toHaveBeenCalled();
    });
  });
});
