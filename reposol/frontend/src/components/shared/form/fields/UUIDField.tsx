import React from 'react';
import { useFormContext } from '../FormContext';
import styles from '../Form.module.css';
const uuidv4 = () => crypto.randomUUID();

interface UUIDFieldProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  autoGenerate?: boolean;
  copyable?: boolean;
  name: string;
  disabled?: boolean;
}

export const UUIDField: React.FC<UUIDFieldProps> = ({
  label = 'UUID',
  value,
  onChange,
  autoGenerate = true,
  copyable = true,
  name,
  disabled
}) => {
  const { isEditing, setFieldTouched } = useFormContext();
  const actualDisabled = disabled || !isEditing;

  const handleGenerate = () => {
    if (onChange && !actualDisabled) {
      onChange(uuidv4());
      setFieldTouched(name);
    }
  };

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
    }
  };

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>{label}</label>
      <div className={styles.inputWithAction}>
        <input
          type="text"
          className={`${styles.input} ${styles.uuidInput}`}
          value={value || ''}
          readOnly
          disabled={actualDisabled}
        />
        <div className={styles.actionButtons}>
          {copyable && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleCopy}
              title="Copy UUID"
            >
              📋
            </button>
          )}
          {autoGenerate && !actualDisabled && onChange && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleGenerate}
              title="Generate new UUID"
            >
              🔄
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
