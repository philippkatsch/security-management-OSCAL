import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { editModeAtom } from '@stores/uiAtoms';
import { MetadataGeneralPanel } from './metadata/MetadataGeneralPanel';
import { MetadataRolesPartiesPanel } from './metadata/MetadataRolesPartiesPanel';
import { MetadataRevisionsPanel } from './metadata/MetadataRevisionsPanel';

/**
 * Metadata Editor for title, version, parties, locations, roles, responsible-parties, revisions, props, and links.
 */
export function MetadataEditor({
  metadata = {},
  onChange,
  readOnly,
  onNavigateToProperties
}: {
  metadata?: any;
  onChange?: (updated: any) => void;
  readOnly?: boolean;
  onNavigateToProperties?: () => void;
  isEditing?: boolean;
}) {
  const globalEditMode = useAtomValue(editModeAtom);
  const isEditing = readOnly !== undefined ? !readOnly : globalEditMode;
  const isReadOnlyState = !isEditing;
  const [expandedSections, setExpandedSections] = useState({
    general: true,
    documentIds: false,
    roles: false,
    parties: false,
    locations: false,
    responsibleParties: false,
    revisions: false,
    actions: false,
    props: false,
    links: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFieldChange = (field, val) => {
    const updated = { ...metadata };
    if (val === '' || val === null || val === undefined) {
      if (field !== 'title' && field !== 'version') {
        delete updated[field];
      } else {
        updated[field] = val;
      }
    } else {
      updated[field] = val;
    }
    onChange?.(updated);
  };

  return (
    <div className="metadata-editor" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <MetadataGeneralPanel 
        metadata={metadata} 
        readOnly={isReadOnlyState} 
        expandedSections={expandedSections} 
        toggleSection={toggleSection} 
        handleFieldChange={handleFieldChange} 
        onNavigateToProperties={onNavigateToProperties}
      />
      <MetadataRolesPartiesPanel 
        metadata={metadata} 
        readOnly={isReadOnlyState} 
        expandedSections={expandedSections} 
        toggleSection={toggleSection} 
        handleFieldChange={handleFieldChange} 
      />
      <MetadataRevisionsPanel 
        metadata={metadata} 
        readOnly={isReadOnlyState} 
        expandedSections={expandedSections} 
        toggleSection={toggleSection} 
        handleFieldChange={handleFieldChange} 
      />
    </div>
  );
}
