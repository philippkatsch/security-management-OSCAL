import React from 'react';
import { MetadataEditor } from '../MetadataEditor';
import { PropsEditor } from '../PropsEditor';
import { BackMatterEditor } from '../BackMatterEditor';

interface OscalDocument {
  metadata?: any;
  props?: any[];
  'back-matter'?: any;
  [key: string]: any;
}

export interface StandardMetadataTabProps {
  document: OscalDocument;
  onChange: (updated: OscalDocument) => void;
  isEditing?: boolean;
  readOnly?: boolean;
}

export function StandardMetadataTab({ document, onChange, isEditing = false, readOnly }: StandardMetadataTabProps) {
  const isReadOnly = readOnly !== undefined ? readOnly : !isEditing;
  return (
    <>
      <MetadataEditor
        metadata={document.metadata}
        onChange={(metadata) => onChange({ ...document, metadata })}
        readOnly={isReadOnly}
      />
      <PropsEditor
        props={document.props || []}
        onChange={(props) => onChange({ ...document, props })}
        readOnly={isReadOnly}
      />
      <BackMatterEditor
        backMatter={document['back-matter']}
        onChange={(backMatter) => onChange({ ...document, 'back-matter': backMatter })}
        readOnly={isReadOnly}
      />
    </>
  );
}
