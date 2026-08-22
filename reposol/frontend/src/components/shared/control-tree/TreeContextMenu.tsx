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
  onWithdrawNode?: (controlId: string) => void;
  onRestoreNode?: (controlId: string) => void;
}

export const TreeContextMenu: React.FC<TreeContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onAddGroup,
  onAddControl,
  onDeleteNode,
  onWithdrawNode,
  onRestoreNode
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

  const isGroup = node.type === 'group';

  return (
    <div
      ref={menuRef}
      className={styles.treeContextMenu}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {isGroup && onAddControl && (
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

      {isGroup && onAddGroup && (
        <button
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

      {onDeleteNode && <div className={styles.contextMenuDivider} />}

      {onDeleteNode && (
        <button
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
