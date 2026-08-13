import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { editModeAtom } from '@stores/uiAtoms';

export interface FormState {
  dirty: boolean;
  touched: Record<string, boolean>;
  errors: Record<string, string>;
}

export interface FormContextValue {
  state: FormState;
  setFieldTouched: (field: string) => void;
  setFieldError: (field: string, error: string) => void;
  clearFieldError: (field: string) => void;
  isEditing: boolean;
}

const FormContext = createContext<FormContextValue | undefined>(undefined);

interface FormProviderProps {
  children: React.ReactNode;
  readOnly?: boolean;
}

export const FormProvider: React.FC<FormProviderProps> = ({ children, readOnly }) => {
  const globalEditMode = useAtomValue(editModeAtom);
  const isEditing = readOnly !== undefined ? !readOnly : globalEditMode;

  const [state, setState] = useState<FormState>({
    dirty: false,
    touched: {},
    errors: {}
  });

  const setFieldTouched = (field: string) => {
    setState(prev => ({
      ...prev,
      dirty: true,
      touched: { ...prev.touched, [field]: true }
    }));
  };

  const setFieldError = (field: string, error: string) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [field]: error }
    }));
  };

  const clearFieldError = (field: string) => {
    setState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[field];
      return { ...prev, errors: newErrors };
    });
  };

  const value = useMemo(() => ({
    state,
    setFieldTouched,
    setFieldError,
    clearFieldError,
    isEditing
  }), [state, isEditing]);

  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
};

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
};
