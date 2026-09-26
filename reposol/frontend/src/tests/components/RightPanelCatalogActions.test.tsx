import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ControlHeader } from '../../components/shared/ControlHeader';
import { GroupEditor } from '../../components/shared/GroupEditor';
import { CatalogOverviewPanel } from '../../components/shared/overview/CatalogOverviewPanel';
import { UnifiedControlEditor } from '../../components/shared/control-editor/UnifiedControlEditor';
import { ConfirmProvider } from '../../components/shared/ui/ConfirmProvider';

vi.mock('../../components/shared/PartsEditor', () => ({
  PartsEditor: () => <div data-testid="parts-editor-mock" />
}));

describe('Right-Hand Panel Catalog Actions (US 1.22 Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ControlHeader right-panel action toolbar', () => {
    const activeControl = {
      id: 'ac-1',
      title: 'Access Control Policy',
      class: 'policy',
      props: [{ name: 'status', value: 'active' }]
    };

    const withdrawnControl = {
      id: 'ac-2',
      title: 'Deprecated Control',
      class: 'policy',
      props: [{ name: 'status', value: 'withdrawn' }]
    };

    it('renders Add Sub-control, Withdraw Control, and Delete Control buttons in Edit Mode for active controls', async () => {
      const mockAddSub = vi.fn();
      const mockWithdraw = vi.fn();
      const mockDelete = vi.fn();

      render(
        <ConfirmProvider>
          <ControlHeader
            id="ac-1"
            title="Access Control Policy"
            control={activeControl}
            isEditing={true}
            stage="catalog"
            onAddSubControl={mockAddSub}
            onWithdrawControl={mockWithdraw}
            onDeleteControl={mockDelete}
          />
        </ConfirmProvider>
      );

      const addSubBtn = screen.getByTestId('header-add-subcontrol-btn');
      expect(addSubBtn).toBeInTheDocument();
      fireEvent.click(addSubBtn);
      expect(mockAddSub).toHaveBeenCalledWith('ac-1');

      const withdrawBtn = screen.getByTestId('header-withdraw-control-btn');
      expect(withdrawBtn).toBeInTheDocument();
      fireEvent.click(withdrawBtn);
      // Since confirm modal appears in ConfirmProvider, wait for and click confirm button
      const confirmModalBtn = await screen.findByRole('button', { name: /^Withdraw$/i });
      fireEvent.click(confirmModalBtn);
      await waitFor(() => {
        expect(mockWithdraw).toHaveBeenCalledWith('ac-1');
      });

      const deleteBtn = screen.getByTestId('header-delete-control-btn');
      expect(deleteBtn).toBeInTheDocument();
      fireEvent.click(deleteBtn);
      const confirmDeleteModalBtn = await screen.findByRole('button', { name: /^Delete$/i });
      fireEvent.click(confirmDeleteModalBtn);
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('ac-1');
      });
    });

    it('renders Restore Control and Delete Control for withdrawn controls in Edit Mode', async () => {
      const mockRestore = vi.fn();
      const mockDelete = vi.fn();

      render(
        <ConfirmProvider>
          <ControlHeader
            id="ac-2"
            title="Deprecated Control"
            control={withdrawnControl}
            isEditing={true}
            stage="catalog"
            onRestoreControl={mockRestore}
            onDeleteControl={mockDelete}
          />
        </ConfirmProvider>
      );

      // Restore button in action toolbar
      const restoreBtn = screen.getByTestId('header-restore-control-btn');
      expect(restoreBtn).toBeInTheDocument();
      fireEvent.click(restoreBtn);
      const confirmModalBtn = await screen.findByRole('button', { name: /^Restore$/i });
      fireEvent.click(confirmModalBtn);
      await waitFor(() => {
        expect(mockRestore).toHaveBeenCalledWith('ac-2');
      });

      // Withdraw button should NOT be rendered for already withdrawn control
      expect(screen.queryByTestId('header-withdraw-control-btn')).not.toBeInTheDocument();
    });

    it('does NOT render mutation action buttons in View Mode (isEditing = false)', () => {
      render(
        <ConfirmProvider>
          <ControlHeader
            id="ac-1"
            title="Access Control Policy"
            control={activeControl}
            isEditing={false}
            stage="catalog"
          />
        </ConfirmProvider>
      );

      expect(screen.queryByTestId('header-add-subcontrol-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header-withdraw-control-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header-delete-control-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('header-restore-control-btn')).not.toBeInTheDocument();
    });
  });

  describe('GroupEditor right-panel action toolbar and cards', () => {
    const sampleGroup = {
      id: 'grp-ac',
      title: 'Access Control Family',
      groups: [
        { id: 'sub-1', title: 'Sub-Category 1', controls: [{ id: 'sub-c1', title: 'Sub C1' }] }
      ],
      controls: [
        { id: 'ac-1', title: 'Active Policy', props: [{ name: 'status', value: 'active' }] },
        { id: 'ac-2', title: 'Withdrawn Policy', props: [{ name: 'status', value: 'withdrawn' }] }
      ]
    };

    it('renders Add Control, Add Sub-group, Withdraw all, Restore all, and Delete Group buttons in header', () => {
      const mockAddCtrl = vi.fn();
      const mockAddSub = vi.fn();
      const mockWithdrawAll = vi.fn();
      const mockRestoreAll = vi.fn();
      const mockDeleteGroup = vi.fn();

      render(
        <GroupEditor
          group={sampleGroup}
          isEditing={true}
          mode="catalog"
          onAddControl={mockAddCtrl}
          onAddSubgroup={mockAddSub}
          onWithdrawAllInGroup={mockWithdrawAll}
          onRestoreAllInGroup={mockRestoreAll}
          onDeleteGroup={mockDeleteGroup}
        />
      );

      const addCtrlBtn = screen.getByTestId('group-add-control-btn');
      expect(addCtrlBtn).toBeInTheDocument();
      addCtrlBtn.click();
      expect(mockAddCtrl).toHaveBeenCalledWith('grp-ac');

      const addSubBtn = screen.getByTestId('group-add-subgroup-header-btn');
      expect(addSubBtn).toBeInTheDocument();
      addSubBtn.click();
      expect(mockAddSub).toHaveBeenCalledWith('grp-ac');

      const withdrawAllBtn = screen.getByTestId('group-withdraw-all-btn');
      expect(withdrawAllBtn).toBeInTheDocument();
      withdrawAllBtn.click();
      expect(mockWithdrawAll).toHaveBeenCalledWith('grp-ac');

      const restoreAllBtn = screen.getByTestId('group-restore-all-btn');
      expect(restoreAllBtn).toBeInTheDocument();
      restoreAllBtn.click();
      expect(mockRestoreAll).toHaveBeenCalledWith('grp-ac');

      const deleteGroupBtn = screen.getByTestId('delete-group-btn');
      expect(deleteGroupBtn).toBeInTheDocument();
      deleteGroupBtn.click();
      expect(mockDeleteGroup).toHaveBeenCalledWith('grp-ac');
    });

    it('allows deleting a subgroup directly from the sub-groups list', () => {
      const mockDeleteGroup = vi.fn();

      render(
        <GroupEditor
          group={sampleGroup}
          isEditing={true}
          mode="catalog"
          onDeleteGroup={mockDeleteGroup}
        />
      );

      const deleteSubBtn = screen.getByTestId('delete-subgroup-btn-sub-1');
      expect(deleteSubBtn).toBeInTheDocument();
      deleteSubBtn.click();
      expect(mockDeleteGroup).toHaveBeenCalledWith('sub-1');
    });

    it('allows adding a control, withdrawing active control, restoring withdrawn control, and deleting control in Controls card', () => {
      const mockAddCtrl = vi.fn();
      const mockWithdrawCtrl = vi.fn();
      const mockRestoreCtrl = vi.fn();
      const mockDeleteCtrl = vi.fn();

      render(
        <GroupEditor
          group={sampleGroup}
          isEditing={true}
          mode="catalog"
          onAddControl={mockAddCtrl}
          onWithdrawControl={mockWithdrawCtrl}
          onRestoreControl={mockRestoreCtrl}
          onDeleteControl={mockDeleteCtrl}
        />
      );

      // Add control to group button
      const addCtrlBtn = screen.getByTestId('add-control-to-group-btn');
      expect(addCtrlBtn).toBeInTheDocument();
      addCtrlBtn.click();
      expect(mockAddCtrl).toHaveBeenCalledWith('grp-ac');

      // Withdraw button for active ac-1
      const withdrawBtn = screen.getByTestId('withdraw-control-btn-ac-1');
      expect(withdrawBtn).toBeInTheDocument();
      withdrawBtn.click();
      expect(mockWithdrawCtrl).toHaveBeenCalledWith('ac-1');

      // Restore button for withdrawn ac-2
      const restoreBtn = screen.getByTestId('restore-control-btn-ac-2');
      expect(restoreBtn).toBeInTheDocument();
      restoreBtn.click();
      expect(mockRestoreCtrl).toHaveBeenCalledWith('ac-2');

      // Delete button for ac-1
      const deleteBtn = screen.getByTestId('delete-control-btn-ac-1');
      expect(deleteBtn).toBeInTheDocument();
      deleteBtn.click();
      expect(mockDeleteCtrl).toHaveBeenCalledWith('ac-1');
    });
  });

  describe('CatalogOverviewPanel right-panel actions', () => {
    it('renders Add Family and Add Control buttons in Edit Mode when groups exist', () => {
      const mockAddGroup = vi.fn();
      const mockAddControl = vi.fn();

      render(
        <CatalogOverviewPanel
          document={{ groups: [{ id: 'ac', title: 'Access Control' }] }}
          isEditing={true}
          onAddGroup={mockAddGroup}
          onAddControl={mockAddControl}
        />
      );

      const addFamBtn = screen.getByTestId('overview-add-family-btn');
      expect(addFamBtn).toBeInTheDocument();
      addFamBtn.click();
      expect(mockAddGroup).toHaveBeenCalledTimes(1);

      const addCtrlBtn = screen.getByTestId('overview-add-control-btn');
      expect(addCtrlBtn).toBeInTheDocument();
      addCtrlBtn.click();
      expect(mockAddControl).toHaveBeenCalledTimes(1);
    });

    it('renders Add Family button in empty state in Edit Mode', () => {
      const mockAddGroup = vi.fn();

      render(
        <CatalogOverviewPanel
          document={{ groups: [] }}
          isEditing={true}
          onAddGroup={mockAddGroup}
        />
      );

      const emptyAddFamBtn = screen.getByTestId('empty-catalog-add-family-btn');
      expect(emptyAddFamBtn).toBeInTheDocument();
      emptyAddFamBtn.click();
      expect(mockAddGroup).toHaveBeenCalledTimes(1);
    });

    it('renders Add Control button in empty state in Edit Mode', () => {
      const mockAddControl = vi.fn();

      render(
        <CatalogOverviewPanel
          document={{ groups: [] }}
          isEditing={true}
          onAddControl={mockAddControl}
        />
      );

      const emptyAddCtrlBtn = screen.getByTestId('empty-catalog-add-control-btn');
      expect(emptyAddCtrlBtn).toBeInTheDocument();
      emptyAddCtrlBtn.click();
      expect(mockAddControl).toHaveBeenCalledTimes(1);
    });

    it('renders top-level controls section when document.controls has items', () => {
      const mockSelectCtrl = vi.fn();

      render(
        <CatalogOverviewPanel
          document={{
            groups: [],
            controls: [
              { id: 'top-1', title: 'Top Level Control 1' },
              { id: 'top-2', title: 'Deprecated Top Control', status: 'withdrawn' }
            ]
          }}
          isEditing={false}
          onSelectControl={mockSelectCtrl}
        />
      );

      const ctrlItem = screen.getByTestId('overview-control-item-top-1');
      expect(ctrlItem).toBeInTheDocument();
      ctrlItem.click();
      expect(mockSelectCtrl).toHaveBeenCalledWith('top-1');

      const ctrlItem2 = screen.getByTestId('overview-control-item-top-2');
      expect(ctrlItem2).toBeInTheDocument();
      expect(ctrlItem2).toHaveTextContent('Withdrawn');
    });
  });

  describe('UnifiedControlEditor pass-through to ControlHeader and Enhancements', () => {
    it('forwards action callbacks to ControlHeader', async () => {
      const mockAddSub = vi.fn();
      const mockWithdraw = vi.fn();
      const mockDelete = vi.fn();

      render(
        <ConfirmProvider>
          <UnifiedControlEditor
            control={{ id: 'ac-1', title: 'Test Control' }}
            stage="catalog"
            isEditing={true}
            onAddSubControl={mockAddSub}
            onWithdrawControl={mockWithdraw}
            onDeleteControl={mockDelete}
          />
        </ConfirmProvider>
      );

      const addSubBtn = screen.getByTestId('header-add-subcontrol-btn');
      expect(addSubBtn).toBeInTheDocument();
      fireEvent.click(addSubBtn);
      expect(mockAddSub).toHaveBeenCalledWith('ac-1');

      const withdrawBtn = screen.getByTestId('header-withdraw-control-btn');
      expect(withdrawBtn).toBeInTheDocument();
      fireEvent.click(withdrawBtn);
      const confirmModalBtn = await screen.findByRole('button', { name: /^Withdraw$/i });
      fireEvent.click(confirmModalBtn);
      await waitFor(() => {
        expect(mockWithdraw).toHaveBeenCalledWith('ac-1');
      });
    });

    it('renders breadcrumbs and allows navigation up to parent control, group, or overview', () => {
      const mockSelectGroup = vi.fn();
      const mockSelectControl = vi.fn();

      const mockCatalog = {
        groups: [
          {
            id: 'ac',
            title: 'Access Control',
            controls: [
              {
                id: 'ac-2',
                title: 'Account Management',
                controls: [
                  { id: 'ac-2.1', title: 'Automated System Account Management' }
                ]
              }
            ]
          }
        ]
      };

      render(
        <UnifiedControlEditor
          control={{ id: 'ac-2.1', title: 'Automated System Account Management' }}
          catalog={mockCatalog}
          stage="catalog"
          isEditing={false}
          onSelectGroup={mockSelectGroup}
          onSelectControl={mockSelectControl}
        />
      );

      // Breadcrumb items: Overview, Access Control, Account Management
      const overviewBreadcrumb = screen.getByText('Overview');
      expect(overviewBreadcrumb).toBeInTheDocument();
      fireEvent.click(overviewBreadcrumb);
      expect(mockSelectGroup).toHaveBeenCalledWith(null);

      const groupBreadcrumb = screen.getByText('Access Control');
      expect(groupBreadcrumb).toBeInTheDocument();
      fireEvent.click(groupBreadcrumb);
      expect(mockSelectGroup).toHaveBeenCalledWith('ac');

      const parentCtrlBreadcrumb = screen.getByText('Account Management');
      expect(parentCtrlBreadcrumb).toBeInTheDocument();
      fireEvent.click(parentCtrlBreadcrumb);
      expect(mockSelectControl).toHaveBeenCalledWith('ac-2');
    });

    it('allows withdrawing and restoring sub-controls in EnhancementsAccordion', () => {
      const mockWithdrawCtrl = vi.fn();
      const mockRestoreCtrl = vi.fn();

      const sampleControlWithEnhancements = {
        id: 'ac-2',
        title: 'Account Management',
        controls: [
          { id: 'ac-2.1', title: 'Active Sub-control' },
          { id: 'ac-2.2', title: 'Deprecated Sub-control', status: 'withdrawn' }
        ]
      };

      render(
        <UnifiedControlEditor
          control={sampleControlWithEnhancements}
          stage="catalog"
          isEditing={true}
          onWithdrawControl={mockWithdrawCtrl}
          onRestoreControl={mockRestoreCtrl}
        />
      );

      // Open enhancements accordion
      const accordionHeader = screen.getByText(/Control Enhancements \(Sub-controls\)/i);
      fireEvent.click(accordionHeader);

      // Withdraw button for ac-2.1
      const withdrawSubBtn = screen.getByTestId('withdraw-enhancement-btn-ac-2.1');
      expect(withdrawSubBtn).toBeInTheDocument();
      fireEvent.click(withdrawSubBtn);
      expect(mockWithdrawCtrl).toHaveBeenCalledWith('ac-2.1');

      // Restore button for ac-2.2
      const restoreSubBtn = screen.getByTestId('restore-enhancement-btn-ac-2.2');
      expect(restoreSubBtn).toBeInTheDocument();
      fireEvent.click(restoreSubBtn);
      expect(mockRestoreCtrl).toHaveBeenCalledWith('ac-2.2');
    });
  });

  describe('GroupEditor confirmations with ConfirmProvider', () => {
    it('prompts confirmation before deleting group and executing onDeleteGroup', async () => {
      const mockDeleteGroup = vi.fn();

      render(
        <ConfirmProvider>
          <GroupEditor
            group={{ id: 'grp-test', title: 'Test Group' }}
            isEditing={true}
            mode="catalog"
            onDeleteGroup={mockDeleteGroup}
          />
        </ConfirmProvider>
      );

      const deleteBtn = screen.getByTestId('delete-group-btn');
      fireEvent.click(deleteBtn);

      const confirmModalBtn = await screen.findByRole('button', { name: /^Delete$/i });
      fireEvent.click(confirmModalBtn);

      await waitFor(() => {
        expect(mockDeleteGroup).toHaveBeenCalledWith('grp-test');
      });
    });
  });
});
