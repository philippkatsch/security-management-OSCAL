import React from 'react';
import { FormProvider } from './FormContext';
import { produce } from 'immer';
import {
  TextField,
  SelectField,
  UUIDField,
  DateTimeField,
  MarkdownField,
  ArrayField
} from './fields';
import styles from './Form.module.css';

export interface FieldConfig {
  path: string;
  type: 'text' | 'textarea' | 'markdown' | 'select' | 'uuid' | 'datetime' | 'array';
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  rows?: number;
  helpText?: string;
  multiple?: boolean;
  renderItem?: (item: any, index: number, handlers: any) => React.ReactNode;
  createItem?: () => any;
  addLabel?: string;
}

export interface EntityEditorProps<T> {
  entity: T;
  onChange: (updated: T) => void;
  fields: FieldConfig[];
  title?: string;
  className?: string;
  readOnly?: boolean;
}

// Utility to get nested value
function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Utility to set nested value using immer
function setNestedValue<T>(obj: T, path: string, value: any): T {
  return produce(obj, (draft: any) => {
    const parts = path.split('.');
    const last = parts.pop()!;
    let current = draft;
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Clean up empty strings/arrays from standard fields unless it's a specific empty type we want to keep
    if (value === '' || (Array.isArray(value) && value.length === 0)) {
       delete current[last];
    } else {
       current[last] = value;
    }
  });
}

function FieldRenderer({ config, entity, onChange }: { config: FieldConfig, entity: any, onChange: (path: string, value: any) => void }) {
  const value = getNestedValue(entity, config.path);
  
  const handleChange = (newVal: any) => {
    onChange(config.path, newVal);
  };

  switch (config.type) {
    case 'text':
    case 'textarea':
      return (
        <TextField
          name={config.path}
          label={config.label}
          value={value}
          onChange={handleChange}
          required={config.required}
          placeholder={config.placeholder}
          multiline={config.type === 'textarea'}
          rows={config.rows}
          helpText={config.helpText}
        />
      );
    case 'markdown':
      return (
        <MarkdownField
          name={config.path}
          label={config.label}
          value={value}
          onChange={handleChange}
          rows={config.rows}
          placeholder={config.placeholder}
        />
      );
    case 'select':
      return (
        <SelectField
          name={config.path}
          label={config.label}
          value={value}
          onChange={handleChange}
          options={config.options || []}
          required={config.required}
          placeholder={config.placeholder}
          multiple={config.multiple}
        />
      );
    case 'uuid':
      return (
        <UUIDField
          name={config.path}
          label={config.label}
          value={value}
          onChange={handleChange}
        />
      );
    case 'datetime':
      return (
        <DateTimeField
          name={config.path}
          label={config.label}
          value={value}
          onChange={handleChange}
          required={config.required}
        />
      );
    case 'array':
      if (!config.renderItem || !config.createItem) {
        console.error(`ArrayField ${config.path} is missing renderItem or createItem`);
        return null;
      }
      return (
        <ArrayField
          name={config.path}
          label={config.label}
          items={value || []}
          onChange={handleChange}
          renderItem={config.renderItem}
          createItem={config.createItem}
          addLabel={config.addLabel}
        />
      );
    default:
      return <div>Unsupported field type: {config.type}</div>;
  }
}

export function EntityEditor<T>({ entity, onChange, fields, title, className, readOnly }: EntityEditorProps<T>) {
  const handleFieldChange = (path: string, value: any) => {
    const updated = setNestedValue(entity, path, value);
    onChange(updated);
  };

  return (
    <FormProvider readOnly={readOnly}>
      <div className={`${styles.entityEditor} ${className || ''}`}>
        {title && <h3 className={styles.editorTitle}>{title}</h3>}
        <div className={styles.fieldsContainer}>
          {fields.map((config) => (
            <FieldRenderer
              key={config.path}
              config={config}
              entity={entity}
              onChange={handleFieldChange}
            />
          ))}
        </div>
      </div>
    </FormProvider>
  );
}
