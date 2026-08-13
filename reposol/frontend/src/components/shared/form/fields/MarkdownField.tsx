import React from 'react';
import { useFormContext } from '../FormContext';
import styles from '../Form.module.css';

interface MarkdownFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  name: string;
  disabled?: boolean;
}

export const MarkdownField: React.FC<MarkdownFieldProps> = ({
  label,
  value,
  onChange,
  rows = 5,
  placeholder = 'Supports markdown...',
  name,
  disabled
}) => {
  const { isEditing, setFieldTouched } = useFormContext();
  const actualDisabled = disabled || !isEditing;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setFieldTouched(name);
  };

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        {label}
        <span className={styles.markdownHint}> (Markdown supported)</span>
      </label>
      
      <textarea
        className={`${styles.input} ${styles.markdownInput}`}
        value={value || ''}
        onChange={handleChange}
        onBlur={() => setFieldTouched(name)}
        placeholder={placeholder}
        rows={rows}
        disabled={actualDisabled}
      />
    </div>
  );
};
