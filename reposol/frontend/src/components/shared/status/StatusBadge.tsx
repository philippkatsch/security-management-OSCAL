import React from 'react';
import styles from './Status.module.css';
import { getStatusConfig } from './statusConfig';

export interface StatusBadgeProps {
  category?: string;
  value?: string;
  status?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pill' | 'dot' | 'bar' | 'badge';
  showIcon?: boolean;
  className?: string;
}

export default function StatusBadge({
  category = 'implementation-status',
  value,
  status,
  size = 'md',
  variant = 'pill',
  showIcon = true,
  className = ''
}: StatusBadgeProps) {
  const config = getStatusConfig(category, value || status);
  const color = config.color;
  const textColor = config.textColor;
  
  const badgeClasses = [
    styles.statusBadge || styles['status-badge'] || '',
    'status-badge',
    styles[`status-badge--${variant}`] || `status-badge--${variant}`,
    styles[`status-badge--${size}`] || `status-badge--${size}`,
    className
  ].filter(Boolean).join(' ');

  const style: React.CSSProperties = {};
  
  if (variant === 'pill') {
    style.backgroundColor = color;
    style.color = textColor;
  } else if (variant === 'bar') {
    style.borderLeftColor = color;
  }

  return (
    <span className={badgeClasses} style={style} data-testid="status-badge">
      {variant === 'dot' && (
        <span className={styles['status-badge__dot'] || 'status-badge__dot'} style={{ backgroundColor: color }}></span>
      )}
      
      {showIcon && (
        <span className={styles['status-badge__icon'] || 'status-badge__icon'} aria-hidden="true">
          {config.icon}
        </span>
      )}
      
      <span className={styles['status-badge__label'] || 'status-badge__label'}>{config.label}</span>
    </span>
  );
}

StatusBadge.displayName = 'StatusBadge';
