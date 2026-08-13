import React from 'react';
import { useControlEditorContext } from '../ControlEditorContext';

export function ProfileAdapter(props: any) {
  const { isEditing, control, dispatch } = useControlEditorContext();
  const { alterations, profile, onProfileChange } = props;
  
  return (
    <div className="profile-adapter">
      {/* Profile specific logic will be moved from ProfileControlOverlay here */}
    </div>
  );
}
