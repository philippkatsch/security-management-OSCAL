import { useEffect } from 'react';

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean, isEditing: boolean) {
  useEffect(() => {
    if (!isEditing || !hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Standard way to show browser prompt
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isEditing]);
}
