import React from 'react';
import styles from './ControlDetail.module.css';
import { EnhancementsAccordion } from '../EnhancementsAccordion';

export interface ControlEnhancementsPanelProps {
  mode?: any;
  isEditing?: boolean;
  enhancements?: any[];
  onSelectControl?: any;
  handleAddEnhancement?: any;
  handleRemoveEnhancement?: any;
  onWithdrawEnhancement?: any;
  onRestoreEnhancement?: any;
  renderEnhancementContent?: any;
  controlId?: string;
  [key: string]: any;
}

export function ControlEnhancementsPanel({
  mode,
  isEditing,
  enhancements = [],
  onSelectControl,
  handleAddEnhancement,
  handleRemoveEnhancement,
  onWithdrawEnhancement,
  onRestoreEnhancement,
  renderEnhancementContent,
  controlId: _controlId
}: ControlEnhancementsPanelProps) {
  return (
    <div className={styles['section-container']} style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
      <EnhancementsAccordion
        enhancements={enhancements}
        isEditing={isEditing}
        onSelectEnhancement={onSelectControl}
        onAddEnhancement={mode === 'catalog' && isEditing ? handleAddEnhancement : undefined}
        onRemoveEnhancement={mode === 'catalog' && isEditing ? handleRemoveEnhancement : undefined}
        onWithdrawEnhancement={mode === 'catalog' && isEditing ? onWithdrawEnhancement : undefined}
        onRestoreEnhancement={mode === 'catalog' && isEditing ? onRestoreEnhancement : undefined}
        showNavArrow={mode === 'catalog'}
        renderEnhancementContent={mode === 'profile' ? renderEnhancementContent : undefined}
      />
    </div>
  );
}
