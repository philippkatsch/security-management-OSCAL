import React from 'react';
import { useControlEditorContext } from '../ControlEditorContext';

export function CatalogAdapter(props: any) {
  const { isEditing, control } = useControlEditorContext();
  
  // Direct editing specific rendering if any additional UI is needed
  return (
    <div className="catalog-adapter">
      {/* The main catalog editing functionality is already in the shared panels */}
    </div>
  );
}
