import React, { useState, useEffect, useRef } from 'react';

/**
 * A simple input wrapper that debounces onChange events.
 * Handles unmount flushing and stable onChange references to prevent data loss.
 */
export function DebouncedInput({
  value,
  onChange,
  delay = 300,
  placeholder = '',
  className = '',
  type = 'text',
  disabled = false,
  multiline = false,
  rows = 3,
  ...props
}) {
  const [displayValue, setDisplayValue] = useState(value || '');
  const onChangeRef = useRef(onChange);
  const lastCommittedRef = useRef(value || '');
  const pendingValueRef = useRef(displayValue);

  // Keep refs up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync external value changes
  useEffect(() => {
    const valStr = value || '';
    if (valStr !== lastCommittedRef.current) {
      lastCommittedRef.current = valStr;
      setDisplayValue(valStr);
      pendingValueRef.current = valStr;
    }
  }, [value]);

  // Track pending display value
  useEffect(() => {
    pendingValueRef.current = displayValue;
  }, [displayValue]);

  // Debounce logic
  useEffect(() => {
    if (displayValue === lastCommittedRef.current) return;

    const handler = setTimeout(() => {
      if (pendingValueRef.current !== lastCommittedRef.current) {
        lastCommittedRef.current = pendingValueRef.current;
        onChangeRef.current?.(pendingValueRef.current);
      }
    }, delay);

    return () => clearTimeout(handler);
  }, [displayValue, delay]);

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      if (pendingValueRef.current !== lastCommittedRef.current) {
        lastCommittedRef.current = pendingValueRef.current;
        onChangeRef.current?.(pendingValueRef.current);
      }
    };
  }, []);

  const handleBlur = (e) => {
    if (pendingValueRef.current !== lastCommittedRef.current) {
      lastCommittedRef.current = pendingValueRef.current;
      onChangeRef.current?.(pendingValueRef.current);
    }
    props.onBlur?.(e);
  };

  if (multiline) {
    return (
      <textarea
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        rows={rows}
        disabled={disabled}
        {...props}
      />
    );
  }

  return (
    <input
      type={type}
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      {...props}
    />
  );
}

export function DebouncedTextarea(props) {
  return <DebouncedInput multiline={true} {...props} />;
}
