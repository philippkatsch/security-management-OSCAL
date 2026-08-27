import React, { useEffect, useRef } from 'react';
import { ControlTreeNode } from '../../../hooks/useControlTree';
import styles from './ControlTree.module.css';

export interface TreeContextMenuProps {
  x: number;
  y: number;
  node: ControlTreeNode;
  onClose: () => void;
  onAddGroup?: (parentGroupId: string | null) => void;
  onAddControl?: (parentGroupId: string | null) => void;
  onDeleteNode?: (nodeId: string, nodeType: 'group' | 'control') => void;
  onRenameNode?: (nodeId: string) => void;
  onWithdrawNode?: (controlId: string) => void;
  onRestoreNode?: (controlId: string) => void;
  onWithdrawAllInGroup?: (groupId: string) => void;
  onRestoreAllInGroup?: (groupId: string) => void;
  // Profile mode: Exclude/Include from baseline (maps to import directives)
  onExcludeFromBaseline?: (controlId: string) => void;
  onIncludeInBaseline?: (controlId: string) => void;
  isExcludedFromBaseline?: boolean;
  onUnassignControl?: (controlId: string, sourceGroupId?: string | null) => void;
}

export const TreeContextMenu: React.FC<TreeContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onAddGroup,
  onAddControl,
  onDeleteNode,
  onRenameNode,
  onWithdrawNode,
  onRestoreNode,
  onWithdrawAllInGroup,
  onRestoreAllInGroup,
  onExcludeFromBaseline,
  onIncludeInBaseline,
  isExcludedFromBaseline,
  onUnassignControl
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates so menu stays in viewport
  const menuWidth = 190;
  const menuHeight = 160;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  const isVirtualUnassigned = node.id === '__unassigned__' || node.class === 'virtual-unassigned';
  const isGroup = node.type === 'group';

  return (
    <div
      ref={menuRef}
      className={styles.treeContextMenu}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {isGroup && !isVirtualUnassigned && onAddControl && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onAddControl(node.id);
            onClose();
          }}
        >
          <span>➕</span>
          <span>Add Control</span>
        </button>
      )}

      {isGroup && !isVirtualUnassigned && onAddGroup && (
        <button
          data-testid="context-menu-add-subgroup"
          className={styles.contextMenuItem}
          onClick={() => {
            onAddGroup(node.id);
            onClose();
          }}
        >
          <span>📁</span>
          <span>Add Sub-Group</span>
        </button>
      )}

      {isGroup && !isVirtualUnassigned && onRenameNode && (
        <button
          data-testid="context-menu-rename-group"
          className={styles.contextMenuItem}
          onClick={() => {
            onRenameNode(node.id);
            onClose();
          }}
        >
          <span>✏️</span>
          <span>Rename Group</span>
        </button>
      )}

      {isGroup && !isVirtualUnassigned && onRestoreAllInGroup && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onRestoreAllInGroup(node.id);
            onClose();
          }}
        >
          <span>↩</span>
          <span>Restore all Controls</span>
        </button>
      )}

      {isGroup && !isVirtualUnassigned && onWithdrawAllInGroup && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onWithdrawAllInGroup(node.id);
            onClose();
          }}
        >
          <span>⛔</span>
          <span>Withdraw all Controls</span>
        </button>
      )}

      {!isGroup && onAddControl && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onAddControl(node.id);
            onClose();
          }}
        >
          <span>➕</span>
          <span>Add Sub-control</span>
        </button>
      )}

      {!isGroup && node.withdrawn && onRestoreNode && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onRestoreNode(node.id);
            onClose();
          }}
        >
          <span>↩</span>
          <span>Restore Control</span>
        </button>
      )}

      {!isGroup && !node.withdrawn && onWithdrawNode && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onWithdrawNode(node.id);
            onClose();
          }}
        >
          <span>⛔</span>
          <span>Withdraw Control</span>
        </button>
      )}

      {/* Control removal action (unassign) in custom group mode */}
      {!isGroup && onUnassignControl && node.parentId && node.parentId !== '__unassigned__' && (
        <button
          data-testid="context-menu-unassign-control"
          className={styles.contextMenuItem}
          onClick={() => {
            onUnassignControl(node.id, node.parentId);
            onClose();
          }}
        >
          <span>📥</span>
          <span>Remove from Group</span>
        </button>
      )}

      {/* Profile mode: Exclude/Include from Profile (US 2.2) */}
      {!isGroup && onExcludeFromBaseline && !isExcludedFromBaseline && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onExcludeFromBaseline(node.id);
            onClose();
          }}
        >
          <span>❌</span>
          <span>Exclude from Profile</span>
        </button>
      )}

      {!isGroup && onIncludeInBaseline && isExcludedFromBaseline && (
        <button
          className={styles.contextMenuItem}
          onClick={() => {
            onIncludeInBaseline(node.id);
            onClose();
          }}
        >
          <span>✅</span>
          <span>Include in Profile</span>
        </button>
      )}

      {onDeleteNode && !isVirtualUnassigned && (!onExcludeFromBaseline || isGroup) && <div className={styles.contextMenuDivider} />}

      {onDeleteNode && !isVirtualUnassigned && (!onExcludeFromBaseline || isGroup) && (
        <button
          data-testid={isGroup ? 'context-menu-delete-group' : 'context-menu-delete-control'}
          className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
          onClick={() => {
            onDeleteNode(node.id, isGroup ? 'group' : 'control');
            onClose();
          }}
        >
          <span>🗑</span>
          <span>Delete {isGroup ? 'Group' : 'Control'}</span>
        </button>
      )}
    </div>
  );
};


