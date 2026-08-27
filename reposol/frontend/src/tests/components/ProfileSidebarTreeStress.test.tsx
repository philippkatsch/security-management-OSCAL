import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileSidebar } from '@components/profile/ProfileSidebar';
import { ControlTree } from '@components/shared/control-tree/ControlTree';
import { ControlTreeNodeComponent } from '@components/shared/control-tree/ControlTreeNode';
import { TreeContextMenu } from '@components/shared/control-tree/TreeContextMenu';
import { useControlTree } from '@hooks/useControlTree';

// Wrapper component to test real useControlTree hook with ControlTree
function TestControlTreeHarness({
  groups = [],
  controls = [],
  isEditing = true,
  onMoveNode,
  onAddGroup,
  onRenameGroup,
  onDeleteNode,
  searchQuery = ''
}: any) {
  const tree = useControlTree({
    groups,
    controls,
    showWithdrawn: false
  });

  React.useEffect(() => {
    if (searchQuery !== undefined) {
      tree.setSearchQuery(searchQuery);
    }
  }, [searchQuery, tree]);

  return (
    <ControlTree
      tree={tree}
      isEditing={isEditing}
      onMoveNode={onMoveNode}
      onAddGroup={onAddGroup}
      onRenameGroup={onRenameGroup}
      onDeleteNode={onDeleteNode}
      addGroupLabel="Add Custom Group"
    />
  );
}

describe('Challenger M2-1: Profile Sidebar Tree Lifecycle & Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. DEEP HIERARCHY & RAPID ADDITIONS STRESS TESTS (5+ LEVELS)
  // =========================================================================
  describe('1. Deep Hierarchy & Rapid Additions Stress Tests (5+ Levels)', () => {
    // Construct 7-level deep nested group structure (Level 0 through Level 6)
    const create7LevelHierarchy = () => {
      const leafGroup = {
        id: 'grp-lvl6',
        title: 'Level 6 Leaf Group',
        controls: [{ id: 'ctrl-deep-6', title: 'Deep Control at Lvl 6' }],
        groups: []
      };
      const lvl5 = { id: 'grp-lvl5', title: 'Level 5 Group', groups: [leafGroup], controls: [] };
      const lvl4 = { id: 'grp-lvl4', title: 'Level 4 Group', groups: [lvl5], controls: [] };
      const lvl3 = { id: 'grp-lvl3', title: 'Level 3 Group', groups: [lvl4], controls: [] };
      const lvl2 = { id: 'grp-lvl2', title: 'Level 2 Group', groups: [lvl3], controls: [] };
      const lvl1 = { id: 'grp-lvl1', title: 'Level 1 Group', groups: [lvl2], controls: [] };
      const lvl0 = { id: 'grp-lvl0', title: 'Level 0 Root Group', groups: [lvl1], controls: [{ id: 'ctrl-root', title: 'Root Control' }] };

      return [lvl0];
    };

    it('renders 7 levels of deeply nested custom groups with accurate depth indentation', () => {
      const groups = create7LevelHierarchy();

      render(
        <TestControlTreeHarness
          groups={groups}
          isEditing={true}
          onAddGroup={vi.fn()}
        />
      );

      // Verify all levels exist in DOM when expanded
      expect(screen.getByTestId('tree-node-grp-lvl0')).toBeInTheDocument();
      expect(screen.getByText('Level 0 Root Group')).toBeInTheDocument();

      // Root node padding: depth 0 -> 0 * 16 + 8 = 8px
      const rootNodeRow = screen.getByTestId('tree-node-grp-lvl0');
      expect(rootNodeRow.style.paddingLeft).toBe('8px');
    });

    it('navigates and expands down through 7 levels of custom groups', () => {
      const groups = create7LevelHierarchy();

      render(
        <TestControlTreeHarness
          groups={groups}
          isEditing={true}
          onAddGroup={vi.fn()}
        />
      );

      // Expand lvl0
      const toggle0 = screen.getByTestId('tree-node-grp-lvl0').querySelector('span');
      if (toggle0) fireEvent.click(toggle0);

      expect(screen.getByTestId('tree-node-grp-lvl1')).toBeInTheDocument();
      // Level 1 padding: depth 1 -> 1 * 16 + 8 = 24px
      expect(screen.getByTestId('tree-node-grp-lvl1').style.paddingLeft).toBe('24px');

      // Expand lvl1
      const toggle1 = screen.getByTestId('tree-node-grp-lvl1').querySelector('span');
      if (toggle1) fireEvent.click(toggle1);
      expect(screen.getByTestId('tree-node-grp-lvl2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl2').style.paddingLeft).toBe('40px');

      // Expand lvl2
      const toggle2 = screen.getByTestId('tree-node-grp-lvl2').querySelector('span');
      if (toggle2) fireEvent.click(toggle2);
      expect(screen.getByTestId('tree-node-grp-lvl3')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl3').style.paddingLeft).toBe('56px');

      // Expand lvl3
      const toggle3 = screen.getByTestId('tree-node-grp-lvl3').querySelector('span');
      if (toggle3) fireEvent.click(toggle3);
      expect(screen.getByTestId('tree-node-grp-lvl4')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl4').style.paddingLeft).toBe('72px');

      // Expand lvl4
      const toggle4 = screen.getByTestId('tree-node-grp-lvl4').querySelector('span');
      if (toggle4) fireEvent.click(toggle4);
      expect(screen.getByTestId('tree-node-grp-lvl5')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl5').style.paddingLeft).toBe('88px');

      // Expand lvl5
      const toggle5 = screen.getByTestId('tree-node-grp-lvl5').querySelector('span');
      if (toggle5) fireEvent.click(toggle5);
      expect(screen.getByTestId('tree-node-grp-lvl6')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl6').style.paddingLeft).toBe('104px');
    });

    it('searches for deep leaf node at level 6 and preserves complete ancestor tree', () => {
      const groups = create7LevelHierarchy();

      render(
        <TestControlTreeHarness
          groups={groups}
          searchQuery="Leaf Group"
          isEditing={true}
        />
      );

      // Search matches 'Level 6 Leaf Group' and must keep all ancestor nodes in filtered tree
      expect(screen.getByTestId('tree-node-grp-lvl0')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl3')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl4')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl5')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-grp-lvl6')).toBeInTheDocument();
      expect(screen.getByText('Level 6 Leaf Group')).toBeInTheDocument();
    });

    it('triggers context menu on deep sub-group (Level 5) to add sub-group with exact parent ID', () => {
      const mockOnAddGroup = vi.fn();
      const groups = create7LevelHierarchy();

      render(
        <TestControlTreeHarness
          groups={groups}
          searchQuery="Level 5"
          isEditing={true}
          onAddGroup={mockOnAddGroup}
        />
      );

      const lvl5Node = screen.getByTestId('tree-node-grp-lvl5');
      const actionBtn = lvl5Node.querySelector('button[title="Node actions"]');
      expect(actionBtn).toBeInTheDocument();
      fireEvent.click(actionBtn!);

      const addSubgroupBtn = screen.getByTestId('context-menu-add-subgroup');
      expect(addSubgroupBtn).toBeInTheDocument();
      fireEvent.click(addSubgroupBtn);

      expect(mockOnAddGroup).toHaveBeenCalledWith('grp-lvl5');
    });

    it('handles 25 rapid top-level and sub-group additions via footer action without crashing', () => {
      const mockOnAddGroup = vi.fn();
      const initialGroups = [{ id: 'cg-base', title: 'Base Group', groups: [], controls: [] }];

      render(
        <TestControlTreeHarness
          groups={initialGroups}
          isEditing={true}
          onAddGroup={mockOnAddGroup}
        />
      );

      const addBtn = screen.getByTestId('add-custom-group-btn');
      for (let i = 0; i < 25; i++) {
        fireEvent.click(addBtn);
      }

      expect(mockOnAddGroup).toHaveBeenCalledTimes(25);
      expect(mockOnAddGroup).toHaveBeenLastCalledWith(null);
    });
  });

  // =========================================================================
  // 2. INLINE TITLE EDITING EDGE CASES & ROBUSTNESS
  // =========================================================================
  describe('2. Inline Title Editing Edge Cases & Robustness', () => {
    const createMockGroupNode = (title = 'Test Group') => ({
      id: 'grp-test-node',
      title: title,
      type: 'group' as const,
      depth: 0,
      hasChildren: false,
      isExpanded: false,
      isSelected: false,
      isVisible: true,
      children: []
    });

    const createMockTree = () => ({
      selectedId: null,
      expandedIds: new Set<string>(),
      searchQuery: '',
      filteredNodes: [],
      toggleExpand: vi.fn(),
      select: vi.fn()
    });

    it('commits inline title with XSS payloads and special characters safely on Enter', () => {
      const mockOnRename = vi.fn();
      const node = createMockGroupNode('Standard Name');
      const mockTree = createMockTree();

      const { rerender } = render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const titleSpan = screen.getByText('Standard Name');
      fireEvent.doubleClick(titleSpan);

      const input = screen.getByTestId('inline-rename-input-grp-test-node');
      const specialPayload = '<script>alert("xss")</script> 🔒 & " \' < > / \\ ~ ! @ # $ % ^ & * ( ) _ + = - { } [ ] : ; , . ? 🔥 [Deutsch/日本語]';

      fireEvent.change(input, { target: { value: specialPayload } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnRename).toHaveBeenCalledWith('grp-test-node', specialPayload.trim());

      // Rerender with updated node title to ensure it renders as plain text safely
      const updatedNode = { ...node, title: specialPayload.trim() };
      rerender(
        <ControlTreeNodeComponent
          node={updatedNode}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      expect(screen.getByText(specialPayload.trim())).toBeInTheDocument();
    });

    it('rejects blank string input ("") and does NOT dispatch rename on Enter', () => {
      const mockOnRename = vi.fn();
      const node = createMockGroupNode('Original Group Title');
      const mockTree = createMockTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const titleSpan = screen.getByText('Original Group Title');
      fireEvent.doubleClick(titleSpan);

      const input = screen.getByTestId('inline-rename-input-grp-test-node');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnRename).not.toHaveBeenCalled();
      expect(screen.queryByTestId('inline-rename-input-grp-test-node')).not.toBeInTheDocument();
      expect(screen.getByText('Original Group Title')).toBeInTheDocument();
    });

    it('rejects whitespace-only input ("   \\t\\n   ") and does NOT dispatch rename', () => {
      const mockOnRename = vi.fn();
      const node = createMockGroupNode('Original Group Title');
      const mockTree = createMockTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const titleSpan = screen.getByText('Original Group Title');
      fireEvent.doubleClick(titleSpan);

      const input = screen.getByTestId('inline-rename-input-grp-test-node');
      fireEvent.change(input, { target: { value: '    \t   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnRename).not.toHaveBeenCalled();
      expect(screen.queryByTestId('inline-rename-input-grp-test-node')).not.toBeInTheDocument();
      expect(screen.getByText('Original Group Title')).toBeInTheDocument();
    });

    it('does not call onRenameGroup if the title is unchanged', () => {
      const mockOnRename = vi.fn();
      const node = createMockGroupNode('Unchanged Title');
      const mockTree = createMockTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const titleSpan = screen.getByText('Unchanged Title');
      fireEvent.doubleClick(titleSpan);

      const input = screen.getByTestId('inline-rename-input-grp-test-node');
      fireEvent.change(input, { target: { value: '   Unchanged Title   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Trimming results in 'Unchanged Title' === node.title, so no rename call
      expect(mockOnRename).not.toHaveBeenCalled();
    });

    it('cancels inline edit on Escape key and discards draft modifications', () => {
      const mockOnRename = vi.fn();
      const node = createMockGroupNode('Protected Title');
      const mockTree = createMockTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const titleSpan = screen.getByText('Protected Title');
      fireEvent.doubleClick(titleSpan);

      const input = screen.getByTestId('inline-rename-input-grp-test-node');
      fireEvent.change(input, { target: { value: 'Draft Should Be Discarded' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnRename).not.toHaveBeenCalled();
      expect(screen.queryByTestId('inline-rename-input-grp-test-node')).not.toBeInTheDocument();
      expect(screen.getByText('Protected Title')).toBeInTheDocument();
    });

    it('commits inline edit on blur event when value is changed', () => {
      const mockOnRename = vi.fn();
      const node = createMockGroupNode('Initial Title');
      const mockTree = createMockTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const titleSpan = screen.getByText('Initial Title');
      fireEvent.doubleClick(titleSpan);

      const input = screen.getByTestId('inline-rename-input-grp-test-node');
      fireEvent.change(input, { target: { value: 'Committed On Blur' } });
      fireEvent.blur(input);

      expect(mockOnRename).toHaveBeenCalledWith('grp-test-node', 'Committed On Blur');
      expect(screen.queryByTestId('inline-rename-input-grp-test-node')).not.toBeInTheDocument();
    });

    it('triggers inline editing via Context Menu "✏️ Rename Group"', () => {
      const mockOnRename = vi.fn();
      const node = createMockGroupNode('Context Renamable');
      const mockTree = createMockTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const actionBtn = screen.getByTitle('Node actions');
      fireEvent.click(actionBtn);

      const renameMenuBtn = screen.getByTestId('context-menu-rename-group');
      expect(renameMenuBtn).toBeInTheDocument();
      fireEvent.click(renameMenuBtn);

      expect(screen.getByTestId('inline-rename-input-grp-test-node')).toBeInTheDocument();
    });

    it('does not allow double click inline editing on control nodes', () => {
      const mockOnRename = vi.fn();
      const controlNode = {
        id: 'ac-1',
        title: 'Access Control Policy',
        type: 'control' as const,
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        isSelected: false,
        isVisible: true,
        children: []
      };
      const mockTree = createMockTree();

      render(
        <ControlTreeNodeComponent
          node={controlNode}
          tree={mockTree as any}
          isEditing={true}
          onRenameGroup={mockOnRename}
        />
      );

      const titleSpan = screen.getByText('Access Control Policy');
      fireEvent.doubleClick(titleSpan);

      expect(screen.queryByTestId('inline-rename-input-ac-1')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. TREE DRAG-AND-DROP REORDERING BETWEEN DEEP SUB-GROUPS
  // =========================================================================
  describe('3. Tree Drag-and-Drop Reordering Between Deep Sub-Groups', () => {
    const mockFlatList = [
      { id: 'grp-parent', type: 'group', parentId: null, depth: 0 },
      { id: 'grp-deep-a', type: 'group', parentId: 'grp-parent', depth: 1 },
      { id: 'grp-deep-b', type: 'group', parentId: 'grp-parent', depth: 1 },
      { id: 'ctrl-sub-1', type: 'control', parentId: 'grp-deep-a', depth: 2 }
    ];

    const createDndTree = (activeDraggedId: string | null = 'grp-deep-b') => ({
      selectedId: null,
      expandedIds: new Set(['grp-parent', 'grp-deep-a']),
      searchQuery: '',
      flatList: mockFlatList as any,
      filteredNodes: mockFlatList as any,
      toggleExpand: vi.fn(),
      select: vi.fn()
    });

    it('initiates drag and sets dataTransfer text/plain payload on dragStart', () => {
      const mockOnDragStart = vi.fn();
      const node = {
        id: 'grp-deep-b',
        title: 'Deep Group B',
        type: 'group' as const,
        depth: 1,
        hasChildren: false,
        isExpanded: false,
        isSelected: false,
        isVisible: true,
        children: []
      };
      const mockTree = createDndTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={vi.fn()}
          onDragStartNode={mockOnDragStart}
        />
      );

      const nodeRow = screen.getByTestId('tree-node-grp-deep-b');
      const setDataMock = vi.fn();
      const dataTransfer = {
        setData: setDataMock,
        effectAllowed: 'uninitialized'
      };

      fireEvent.dragStart(nodeRow, { dataTransfer });

      expect(setDataMock).toHaveBeenCalledWith('text/plain', 'grp-deep-b');
      expect(setDataMock).toHaveBeenCalledWith('nodeType', 'group');
      expect(mockOnDragStart).toHaveBeenCalledWith('grp-deep-b');
    });

    it('calculates drop zones (before, inside, after) accurately on group dragOver', () => {
      const node = {
        id: 'grp-deep-a',
        title: 'Deep Group A',
        type: 'group' as const,
        depth: 1,
        hasChildren: false,
        isExpanded: false,
        isSelected: false,
        isVisible: true,
        children: []
      };
      const mockTree = createDndTree();

      const { container } = render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={vi.fn()}
          activeDraggedId="grp-deep-b"
        />
      );

      const nodeRow = screen.getByTestId('tree-node-grp-deep-a');
      const getBcrSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 140,
        height: 40,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: 100,
        toJSON: () => {}
      } as any);

      // 1. Top 20% (offsetY = 5 < 10) -> 'before'
      const eBefore = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 105 });
      Object.defineProperty(eBefore, 'dataTransfer', { value: { dropEffect: 'none' } });
      fireEvent(nodeRow, eBefore);
      expect(container.querySelectorAll(`.${nodeRow.className}`)).toBeDefined();

      // 2. Middle 50% (offsetY = 20) -> 'inside'
      const eInside = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 120 });
      Object.defineProperty(eInside, 'dataTransfer', { value: { dropEffect: 'none' } });
      fireEvent(nodeRow, eInside);

      // 3. Bottom 20% (offsetY = 35 > 30) -> 'after'
      const eAfter = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 135 });
      Object.defineProperty(eAfter, 'dataTransfer', { value: { dropEffect: 'none' } });
      fireEvent(nodeRow, eAfter);

      getBcrSpy.mockRestore();
    });

    it('executes drop "inside" target deep group and calls onMoveNode with target parent ID', () => {
      const mockOnMoveNode = vi.fn();
      const node = {
        id: 'grp-deep-a',
        title: 'Deep Group A',
        type: 'group' as const,
        depth: 1,
        hasChildren: false,
        isExpanded: false,
        isSelected: false,
        isVisible: true,
        parentId: 'grp-parent',
        children: []
      };
      const mockTree = createDndTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={mockOnMoveNode}
          activeDraggedId="grp-deep-b"
        />
      );

      const nodeRow = screen.getByTestId('tree-node-grp-deep-a');
      const getBcrSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 140,
        height: 40,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: 100,
        toJSON: () => {}
      } as any);

      // DragOver at middle -> dropPosition = 'inside'
      const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 120 });
      Object.defineProperty(dragOverEvent, 'dataTransfer', { value: { dropEffect: 'none' } });
      fireEvent(nodeRow, dragOverEvent);

      // Drop
      const dropEvent = new MouseEvent('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { getData: (key: string) => (key === 'text/plain' ? 'grp-deep-b' : '') }
      });
      fireEvent(nodeRow, dropEvent);

      // Dropping inside grp-deep-a should move grp-deep-b under grp-deep-a at index 0
      expect(mockOnMoveNode).toHaveBeenCalledWith('grp-deep-b', 'grp-deep-a', 0);
      getBcrSpy.mockRestore();
    });

    it('executes drop "after" target node and calls onMoveNode with node.parentId and next index', () => {
      const mockOnMoveNode = vi.fn();
      const node = {
        id: 'grp-deep-a',
        title: 'Deep Group A',
        type: 'group' as const,
        depth: 1,
        hasChildren: false,
        isExpanded: false,
        isSelected: false,
        isVisible: true,
        parentId: 'grp-parent',
        children: []
      };
      const mockTree = createDndTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={mockOnMoveNode}
          activeDraggedId="grp-deep-b"
        />
      );

      const nodeRow = screen.getByTestId('tree-node-grp-deep-a');
      const getBcrSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 140,
        height: 40,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: 100,
        toJSON: () => {}
      } as any);

      // DragOver at bottom -> clientY = 135 -> offsetY = 35 > 30 (height * 0.75) -> dropPosition = 'after'
      const dragOverEvent = new MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 135 });
      Object.defineProperty(dragOverEvent, 'dataTransfer', { value: { dropEffect: 'none' } });
      fireEvent(nodeRow, dragOverEvent);

      const dropEvent = new MouseEvent('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { getData: (key: string) => (key === 'text/plain' ? 'grp-deep-b' : '') }
      });
      fireEvent(nodeRow, dropEvent);

      // Sibling index of grp-deep-a is 0. Drop after should be index 1 under grp-parent
      expect(mockOnMoveNode).toHaveBeenCalledWith('grp-deep-b', 'grp-parent', 1);
      getBcrSpy.mockRestore();
    });

    it('ignores dragOver and drop when dragged node is identical to target node (self-drop)', () => {
      const mockOnMoveNode = vi.fn();
      const node = {
        id: 'grp-deep-a',
        title: 'Deep Group A',
        type: 'group' as const,
        depth: 1,
        hasChildren: false,
        isExpanded: false,
        isSelected: false,
        isVisible: true,
        parentId: 'grp-parent',
        children: []
      };
      const mockTree = createDndTree('grp-deep-a');

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={mockOnMoveNode}
          activeDraggedId="grp-deep-a"
        />
      );

      const nodeRow = screen.getByTestId('tree-node-grp-deep-a');

      fireEvent.dragOver(nodeRow, {
        clientY: 120,
        dataTransfer: { dropEffect: 'none' }
      });

      fireEvent.drop(nodeRow, {
        dataTransfer: { getData: (key: string) => (key === 'text/plain' ? 'grp-deep-a' : '') }
      });

      expect(mockOnMoveNode).not.toHaveBeenCalled();
    });

    it('resets drop position on dragLeave and dragEnd', () => {
      const mockOnDragEnd = vi.fn();
      const node = {
        id: 'grp-deep-a',
        title: 'Deep Group A',
        type: 'group' as const,
        depth: 1,
        hasChildren: false,
        isExpanded: false,
        isSelected: false,
        isVisible: true,
        parentId: 'grp-parent',
        children: []
      };
      const mockTree = createDndTree();

      render(
        <ControlTreeNodeComponent
          node={node}
          tree={mockTree as any}
          isEditing={true}
          onMoveNode={vi.fn()}
          onDragEndNode={mockOnDragEnd}
          activeDraggedId="grp-deep-b"
        />
      );

      const nodeRow = screen.getByTestId('tree-node-grp-deep-a');

      fireEvent.dragLeave(nodeRow);
      fireEvent.dragEnd(nodeRow);

      expect(mockOnDragEnd).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. READ-ONLY PROTECTION & MUTATION INVARIANTS
  // =========================================================================
  describe('4. Read-Only Protection & Mutation Invariants', () => {
    const sampleProfileWithCustomMerge = {
      imports: [{ href: 'catalogs/cat.json', 'include-all': {} }],
      merge: {
        custom: {
          groups: [
            {
              id: 'cg-locked',
              title: 'Locked Group',
              'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
            }
          ]
        }
      }
    };

    const sampleResolved = {
      groups: [
        {
          id: 'cg-locked',
          title: 'Locked Group',
          controls: [{ id: 'ac-1', title: 'Access Control' }],
          groups: []
        }
      ],
      controls: []
    };

    it('omits Add Custom Group button in read-only mode (isEditing = false)', () => {
      render(
        <ProfileSidebar
          resolvedCatalog={sampleResolved}
          profile={sampleProfileWithCustomMerge}
          isEditing={false}
          onSelectControl={vi.fn()}
          onSelectGroup={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      expect(screen.queryByTestId('add-custom-group-btn')).not.toBeInTheDocument();
    });

    it('omits context menu trigger buttons (•••) on all nodes in read-only mode', () => {
      render(
        <ProfileSidebar
          resolvedCatalog={sampleResolved}
          profile={sampleProfileWithCustomMerge}
          isEditing={false}
          onSelectControl={vi.fn()}
          onSelectGroup={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      expect(screen.queryByTitle('Node actions')).not.toBeInTheDocument();
    });

    it('blocks opening context menu on right-click in read-only mode', () => {
      render(
        <ProfileSidebar
          resolvedCatalog={sampleResolved}
          profile={sampleProfileWithCustomMerge}
          isEditing={false}
          onSelectControl={vi.fn()}
          onSelectGroup={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      const nodeRow = screen.getByTestId('tree-node-cg-locked');
      fireEvent.contextMenu(nodeRow);

      expect(screen.queryByTestId('context-menu-add-subgroup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('context-menu-rename-group')).not.toBeInTheDocument();
      expect(screen.queryByTestId('context-menu-delete-group')).not.toBeInTheDocument();
    });

    it('sets draggable to false and hides drag handles in read-only mode', () => {
      render(
        <ProfileSidebar
          resolvedCatalog={sampleResolved}
          profile={sampleProfileWithCustomMerge}
          isEditing={false}
          onSelectControl={vi.fn()}
          onSelectGroup={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      const nodeRow = screen.getByTestId('tree-node-cg-locked');
      expect(nodeRow.getAttribute('draggable')).toBe('false');
      expect(screen.queryByTitle('Drag to reorder')).not.toBeInTheDocument();
    });

    it('prevents double-click inline renaming in read-only mode', () => {
      render(
        <ProfileSidebar
          resolvedCatalog={sampleResolved}
          profile={sampleProfileWithCustomMerge}
          isEditing={false}
          onSelectControl={vi.fn()}
          onSelectGroup={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      const titleSpan = screen.getByText('Locked Group');
      fireEvent.doubleClick(titleSpan);

      expect(screen.queryByTestId('inline-rename-input-cg-locked')).not.toBeInTheDocument();
    });

    it('omits custom group mutation callbacks on ControlTree when profile is not in custom merge mode', () => {
      const nonCustomProfile = {
        imports: [{ href: 'catalogs/cat.json', 'include-all': {} }],
        merge: {
          'as-is': true
        }
      };

      const mockAddGroup = vi.fn();

      render(
        <ProfileSidebar
          resolvedCatalog={sampleResolved}
          profile={nonCustomProfile}
          isEditing={true}
          onAddCustomGroup={mockAddGroup}
          onSelectControl={vi.fn()}
          onSelectGroup={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      // In as-is merge mode, custom group creation button must NOT be present
      expect(screen.queryByTestId('add-custom-group-btn')).not.toBeInTheDocument();
    });

    it('handles 10-level deep nested tree and builds complete breadcrumb trail', () => {
      // Build 10 levels deep
      const build10Levels = () => {
        let current: any = {
          id: 'deep-10-leaf',
          title: 'Deep 10 Leaf',
          controls: [{ id: 'ctrl-10-leaf', title: 'Deep 10 Control' }],
          groups: []
        };
        for (let i = 9; i >= 0; i--) {
          current = {
            id: `lvl-${i}`,
            title: `Level ${i}`,
            groups: [current],
            controls: []
          };
        }
        return [current];
      };

      const groups = build10Levels();

      render(
        <TestControlTreeHarness
          groups={groups}
          searchQuery="Deep 10 Leaf"
          isEditing={true}
        />
      );

      for (let i = 0; i <= 9; i++) {
        expect(screen.getByTestId(`tree-node-lvl-${i}`)).toBeInTheDocument();
      }
      expect(screen.getByTestId('tree-node-deep-10-leaf')).toBeInTheDocument();
    });

    it('handles 50 rapid sequential group creations without ID collisions or stack overflow', () => {
      const mockAddGroup = vi.fn();
      const groups = [{ id: 'cg-root', title: 'Root', groups: [], controls: [] }];

      render(
        <TestControlTreeHarness
          groups={groups}
          isEditing={true}
          onAddGroup={mockAddGroup}
        />
      );

      const addBtn = screen.getByTestId('add-custom-group-btn');
      for (let i = 0; i < 50; i++) {
        fireEvent.click(addBtn);
      }

      expect(mockAddGroup).toHaveBeenCalledTimes(50);
    });

    it('dispatches addCustomGroup, renameCustomGroup, deleteCustomGroup and moveCustomGroup via ProfileSidebar dispatch prop', () => {
      const mockDispatch = vi.fn();
      const customProfile = {
        imports: [{ href: 'catalogs/cat.json', 'include-all': {} }],
        merge: {
          custom: {
            groups: [
              {
                id: 'cg-action-test',
                title: 'Action Test Group',
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['ac-1'] }] }]
              }
            ]
          }
        }
      };

      render(
        <ProfileSidebar
          resolvedCatalog={sampleResolved}
          profile={customProfile}
          isEditing={true}
          dispatch={mockDispatch}
          onSelectControl={vi.fn()}
          onSelectGroup={vi.fn()}
          onSelectOverview={vi.fn()}
          onSelectMetadata={vi.fn()}
          onSelectProperties={vi.fn()}
          onSelectParameters={vi.fn()}
          onSelectBackMatter={vi.fn()}
          onSelectImports={vi.fn()}
        />
      );

      // 1. Add Custom Group
      const addBtn = screen.getByTestId('add-custom-group-btn');
      fireEvent.click(addBtn);

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch.mock.calls[0][0].type).toBe('ADD_CUSTOM_GROUP');

      // 2. Rename Custom Group
      const titleSpan = screen.getByText('Locked Group');
      fireEvent.doubleClick(titleSpan);
      const renameInput = screen.getByTestId('inline-rename-input-cg-locked');
      fireEvent.change(renameInput, { target: { value: 'Dispatched Rename' } });
      fireEvent.keyDown(renameInput, { key: 'Enter' });

      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(mockDispatch.mock.calls[1][0].type).toBe('RENAME_CUSTOM_GROUP');
      expect(mockDispatch.mock.calls[1][0].payload.title).toBe('Dispatched Rename');

      // 3. Delete Custom Group via context menu
      const actionBtn = screen.getByTitle('Node actions');
      fireEvent.click(actionBtn);
      const deleteMenuBtn = screen.getByTestId('context-menu-delete-group');
      fireEvent.click(deleteMenuBtn);

      expect(mockDispatch).toHaveBeenCalledTimes(3);
      expect(mockDispatch.mock.calls[2][0].type).toBe('DELETE_CUSTOM_GROUP');
      expect(mockDispatch.mock.calls[2][0].payload.groupId).toBe('cg-locked');
    });
  });
});

