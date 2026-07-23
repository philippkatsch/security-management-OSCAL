import React, { useState, useEffect } from 'react';

/**
 * A simple input wrapper that debounces onChange events.
 */
export function DebouncedInput({
  value,
  onChange,
  delay = 300,
  placeholder = '',
  className = '',
  type = 'text',
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
    <input
      type={type}
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      {...props}
    />
  );
}
