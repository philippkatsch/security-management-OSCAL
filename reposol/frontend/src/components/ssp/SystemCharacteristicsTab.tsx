import React from 'react';
import SystemCharacteristicsEditor from './SystemCharacteristicsEditor';
import { addDiagramWithResource, removeDiagramWithResource } from '../../lib/document-actions/ssp-actions';

export function SystemCharacteristicsTab({
  sysChar,
  isEditing,
  handleUpdateField,
  ssp,
  dispatch
}: any) {
  const metadataParties = ssp?.metadata?.parties || [];
  const metadataRoles = ssp?.metadata?.roles || [];

  return (
    <div className="sys-char-tab p-6">
      <SystemCharacteristicsEditor
        systemChars={sysChar || {}}
        onUpdate={(newSysChar: any) => handleUpdateField(['system-characteristics'], newSysChar)}
        backMatter={ssp?.['back-matter'] || {}}
        onBackMatterChange={(newBackMatter: any) => handleUpdateField(['back-matter'], newBackMatter)}
        onUploadDiagram={(container: any, diagram: any, resource: any) => {
          if (dispatch) {
            dispatch(addDiagramWithResource(container, diagram, resource));
          } else {
            const currentContainer = sysChar?.[container] || { description: '', diagrams: [] };
            const updatedContainer = {
              ...currentContainer,
              diagrams: [...(currentContainer.diagrams || []), diagram]
            };
            handleUpdateField(['system-characteristics', container], updatedContainer);
            if (resource) {
              const currentResources = ssp?.['back-matter']?.resources || [];
              handleUpdateField(['back-matter', 'resources'], [...currentResources, resource]);
            }
          }
        }}
        onRemoveDiagram={(container: any, diagramUuid: string, resourceUuid?: string) => {
          if (dispatch) {
            dispatch(removeDiagramWithResource(container, diagramUuid, resourceUuid));
          } else {
            const currentContainer = sysChar?.[container] || { description: '', diagrams: [] };
            const updatedContainer = {
              ...currentContainer,
              diagrams: (currentContainer.diagrams || []).filter((d: any) => d.uuid !== diagramUuid)
            };
            handleUpdateField(['system-characteristics', container], updatedContainer);
            if (resourceUuid) {
              const currentResources = (ssp?.['back-matter']?.resources || []).filter((r: any) => r.uuid !== resourceUuid);
              handleUpdateField(['back-matter', 'resources'], currentResources);
            }
          }
        }}
        editMode={isEditing}
        metadataParties={metadataParties}
        metadataRoles={metadataRoles}
      />
    </div>
  );
}

export default SystemCharacteristicsTab;
