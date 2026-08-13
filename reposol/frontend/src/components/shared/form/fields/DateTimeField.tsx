import React from 'react';
import { useFormContext } from '../FormContext';
import styles from '../Form.module.css';

interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  name: string;
  disabled?: boolean;
}

export const DateTimeField: React.FC<DateTimeFieldProps> = ({
  label,
  value,
  onChange,
  required,
  name,
  disabled
}) => {
  const { isEditing, setFieldTouched, setFieldError, clearFieldError } = useFormContext();
  const actualDisabled = disabled || !isEditing;

  // Convert ISO string to format required by datetime-local input
  const formatForInput = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      // Ensure we format it to local time for the datetime-local input
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    } catch {
      return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const localVal = e.target.value;
    if (localVal) {
      const date = new Date(localVal);
      onChange(date.toISOString());
    } else {
      onChange('');
    }
    
    setFieldTouched(name);
    if (required && !localVal) {
      setFieldError(name, 'This field is required');
    } else {
      clearFieldError(name);
    }
  };

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      
      <input
        type="datetime-local"
        className={styles.input}
        value={formatForInput(value)}
        onChange={handleChange}
        disabled={actualDisabled}
        onBlur={() => setFieldTouched(name)}
      />
    </div>
  );
};
