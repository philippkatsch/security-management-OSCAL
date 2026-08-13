import React from 'react';
import { useFormContext } from '../FormContext';
import styles from '../Form.module.css';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  helpText?: string;
  error?: string;
  disabled?: boolean;
  name: string; // Used for context tracking
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  required,
  placeholder,
  multiline,
  rows = 3,
  helpText,
  error,
  disabled,
  name,
}) => {
  const { isEditing, setFieldTouched, setFieldError, clearFieldError } = useFormContext();
  const actualDisabled = disabled || !isEditing;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setFieldTouched(name);
    
    // Basic required validation
    if (required && !e.target.value.trim()) {
      setFieldError(name, 'This field is required');
    } else {
      clearFieldError(name);
    }
  };

  const handleBlur = () => {
    setFieldTouched(name);
    if (required && !value?.trim()) {
      setFieldError(name, 'This field is required');
    }
  };

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      
      {multiline ? (
        <textarea
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={rows}
          disabled={actualDisabled}
        />
      ) : (
        <input
          type="text"
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={actualDisabled}
        />
      )}
      
      {error && <div className={styles.errorMessage}>{error}</div>}
      {helpText && !error && <div className={styles.helpText}>{helpText}</div>}
    </div>
  );
};
