import React from 'react';
import './StatusBadge.css';
import { getStatusConfig } from './statusConfig';

export default function StatusBadge({
  category = 'document-lifecycle',
  value,
  status,
  size = 'md',
  variant = 'pill',
  showIcon = true,
  className = ''
}) {
  const config = getStatusConfig(category, value || status);
  const color = config.color;
  const textColor = config.textColor;
  
  const badgeClasses = [
    'status-badge',
    `status-badge--${variant}`,
    `status-badge--${size}`,
    className
  ].filter(Boolean).join(' ');

  const style = {};
  
  if (variant === 'pill') {
    style.backgroundColor = color;
    style.color = textColor;
  } else if (variant === 'bar') {
    style.borderLeftColor = color;
  }

  return (
    <span className={badgeClasses} style={style}>
      {variant === 'dot' && (
        <span className="status-badge__dot" style={{ backgroundColor: color }}></span>
      )}
      
      {showIcon && (
        <span className="status-badge__icon" aria-hidden="true">
          {config.icon}
        </span>
      )}
      
      <span className="status-badge__label">{config.label}</span>
    </span>
  );
}

StatusBadge.displayName = 'StatusBadge';
