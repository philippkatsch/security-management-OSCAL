import React from 'react';
import { useControlEditorContext } from '../ControlEditorContext';
import { PropsEditor } from '@components/shared/PropsEditor';
import { LinksEditor } from '@components/shared/LinksEditor';

export function CatalogAdapter({
  onChange,
  allUsedPropKeys = []
}: any) {
  const { isEditing, control } = useControlEditorContext();
  
  const handlePropsChange = (newProps: any[]) => {
    onChange?.({
      ...control,
      props: newProps
    });
  };

  const handleLinksChange = (newLinks: any[]) => {
    onChange?.({
      ...control,
      links: newLinks
    });
  };

  return (
    <div className="catalog-adapter" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
      {/* Control Properties */}
      {(isEditing || (control?.props && control.props.length > 0)) && (
        <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
          <PropsEditor
            props={control?.props || []}
            onChange={handlePropsChange}
            allUsedKeys={allUsedPropKeys}
            readOnly={!isEditing}
          />
        </div>
      )}

      {/* Control Links & References / Mappings */}
      {(isEditing || (control?.links && control.links.length > 0)) && (
        <div className="section-container" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
          <LinksEditor
            links={control?.links || []}
            onChange={handleLinksChange}
            readOnly={!isEditing}
          />
        </div>
      )}
    </div>
  );
}
