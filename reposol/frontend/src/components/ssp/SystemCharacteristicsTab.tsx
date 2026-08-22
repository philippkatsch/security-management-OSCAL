import React from 'react';
import SystemCharacteristicsEditor from './SystemCharacteristicsEditor';

export function SystemCharacteristicsTab({ sysChar, isEditing, handleUpdateField, ssp }: any) {
  return (
    <div className="sys-char-tab p-6">
      <SystemCharacteristicsEditor
        systemChars={sysChar || {}}
        onUpdate={(newSysChar: any) => handleUpdateField(['system-characteristics'], newSysChar)}
        backMatter={ssp?.['back-matter'] || {}}
        onBackMatterChange={(newBackMatter: any) => handleUpdateField(['back-matter'], newBackMatter)}
        editMode={isEditing}
      />
    </div>
  );
}
