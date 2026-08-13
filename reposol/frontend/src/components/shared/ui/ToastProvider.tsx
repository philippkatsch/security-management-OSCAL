import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        },
        success: { duration: 3000 },
        error: { duration: 6000 },
      }}
    />
  );
}
