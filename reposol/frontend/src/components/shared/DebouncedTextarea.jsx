import React, { useState, useEffect } from 'react';

/**
 * A textarea wrapper that debounces onChange events.
 */
export function DebouncedTextarea({
  value,
  onChange,
  delay = 300,
  placeholder = '',
  className = '',
  rows = 3,
  disabled = false,
  ...props
}) {
  const [displayValue, setDisplayValue] = useState(value || '');

  useEffect(() => {
    setDisplayValue(value || '');
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (displayValue !== (value || '')) {
        onChange(displayValue);
      }
    }, delay);

    return () => clearTimeout(handler);
  }, [displayValue, delay, onChange, value]);

  return (
    <textarea
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={rows}
      disabled={disabled}
      {...props}
    />
  );
}
