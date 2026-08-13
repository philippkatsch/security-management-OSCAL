import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ConfirmModal } from './ConfirmModal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<{ resolve: (value: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver({ resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolver?.resolve(true);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolver?.resolve(false);
  }, [resolver]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmModal
          isOpen={isOpen}
          title={options.title}
          message={options.message}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          variant={options.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
