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

interface StandardMetadataTabProps {
  document: OscalDocument;
  onChange: (updated: OscalDocument) => void;
}

export function StandardMetadataTab({ document, onChange }: StandardMetadataTabProps) {
  return (
    <>
      <MetadataEditor
        metadata={document.metadata}
        onChange={(metadata) => onChange({ ...document, metadata })}
      />
      <PropsEditor
        props={document.props || []}
        onChange={(props) => onChange({ ...document, props })}
      />
      <BackMatterEditor
        backMatter={document['back-matter']}
        onChange={(backMatter) => onChange({ ...document, 'back-matter': backMatter })}
      />
    </>
  );
}
