import React from 'react';
import { useControlEditorContext } from '../ControlEditorContext';
import StatusBadge from '../../status/StatusBadge';

export function SSPAdapter(props: any) {
  const { isEditing, control, dispatch } = useControlEditorContext();
  const { implementation, components } = props;
  
  if (!implementation) return null;

  return (
    <div className="ssp-adapter mt-4 border-t pt-4">
      <h3 className="text-lg font-semibold mb-4">Implementation Details</h3>
      <div className="space-y-4">
        {implementation['by-components']?.map((bc: any, idx: number) => {
          const comp = components?.find((c: any) => c.uuid === bc['component-uuid']);
          return (
            <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded border">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium">{comp ? comp.title : bc['component-uuid']}</div>
                <StatusBadge 
                  category="implementation-status" 
                  status={bc['implementation-status']?.state || 'planned'} 
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {bc.description || 'No description provided.'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
