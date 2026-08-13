import React from 'react';
import { useFormContext } from '../FormContext';
import styles from '../Form.module.css';

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  name: string;
  disabled?: boolean;
  multiple?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
  name,
  disabled,
  multiple
}) => {
  const { isEditing, setFieldTouched, setFieldError, clearFieldError } = useFormContext();
  const actualDisabled = disabled || !isEditing;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (multiple) {
      const selectedOptions = Array.from(e.target.selectedOptions).map(o => o.value);
      onChange(selectedOptions as any);
    } else {
      onChange(e.target.value);
    }
    setFieldTouched(name);
    
    if (required && !e.target.value) {
      setFieldError(name, 'This field is required');
    } else {
      clearFieldError(name);
    }
  };

  const handleBlur = () => {
    setFieldTouched(name);
  };

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      
      <select
        className={`${styles.input} ${styles.select}`}
        value={value || (multiple ? [] : '')}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={actualDisabled}
        multiple={multiple}
      >
        {placeholder && !multiple && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
