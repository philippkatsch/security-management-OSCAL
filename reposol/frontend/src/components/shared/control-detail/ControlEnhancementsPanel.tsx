import React from 'react';
import styles from './ControlDetail.module.css';
import { EnhancementsAccordion } from '../EnhancementsAccordion';

export function ControlEnhancementsPanel({
  mode,
  isEditing,
  enhancements,
  onSelectControl,
  handleAddEnhancement,
  handleRemoveEnhancement,
  renderEnhancementContent
}) {
  return (
    <div className={styles['section-container']} style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
      <EnhancementsAccordion
        enhancements={enhancements}
        isEditing={isEditing}
        onSelectEnhancement={onSelectControl}
        onAddEnhancement={mode === 'catalog' && isEditing ? handleAddEnhancement : undefined}
        onRemoveEnhancement={mode === 'catalog' && isEditing ? handleRemoveEnhancement : undefined}
        showNavArrow={mode === 'catalog'}
        renderEnhancementContent={mode === 'profile' ? renderEnhancementContent : undefined}
      />
    </div>
  );
}
