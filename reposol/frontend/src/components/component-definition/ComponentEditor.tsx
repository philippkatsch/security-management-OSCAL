import React, { useState, useEffect } from 'react';
import styles from './ComponentPage.module.css';
import { ProseWithParams } from '@components/shared/ProseWithParams';
import { OSCAL_DEFINED_COMPONENT_TYPES } from '@lib/oscal-constants';
import { DefinedComponent, Resource } from '@lib/types/oscal';
import PropertyPalette from './editors/PropertyPalette';
import ProtocolsEditor from './editors/ProtocolsEditor';
import ComponentRolesEditor from './editors/ComponentRolesEditor';
import ComponentLinksEditor from './editors/ComponentLinksEditor';
import ControlImplementationsEditor from './editors/ControlImplementationsEditor';

const Accordion = ({ 
  title, 
  children, 
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle
}: { 
  title: string; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div className={styles['component-editor__section']}>
      <div 
        className={styles['component-editor__section-header']} 
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
      >
        <h4 className={styles['section-title']}>{title}</h4>
        <span className={`${styles['chevron']} ${isOpen ? styles['open'] : ''}`}>▼</span>
      </div>
      {isOpen && <div className={styles['component-editor__section-content']}>{children}</div>}
    </div>
  );
};

export interface ComponentEditorProps {
  component: DefinedComponent | any;
  components?: DefinedComponent[];
  parties?: any[];
  resources?: Resource[];
  onUpdate?: (component: DefinedComponent | any) => void;
  onClose?: () => void;
  editMode?: boolean;
}

export default function ComponentEditor({ 
  component, 
  components = [],
  parties = [],
  resources = [],
  onUpdate = () => {}, 
  onClose, 
  editMode = false 
}: ComponentEditorProps) {
  if (!component) return null;

  const isNetworkRelevant = component?.type === 'service' || component?.type === 'software';

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    props: false,
    roles: false,
    protocols: isNetworkRelevant,
    impls: false
  });

  useEffect(() => {
    if (component?.type === 'service' || component?.type === 'software') {
      setOpenSections(prev => ({ ...prev, protocols: true }));
    }
  }, [component?.type]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const componentRef = React.useRef(component);
  useEffect(() => {
    componentRef.current = component;
  }, [component]);

  const handleChange = (field: string, value: any) => {
    if (!editMode) return;
    const next = { ...componentRef.current, [field]: value };
    componentRef.current = next;
    onUpdate(next);
  };

  return (
    <div className={styles['component-editor']}>
      <div className={styles['panel-body']}>
        
        {/* 1. Basic Info */}
        <Accordion 
          title="Basic Info" 
          isOpen={openSections.basic} 
          onToggle={() => toggleSection('basic')}
        >
          <div className={styles['form-group']}>
            <label className="form-label">Title <span className="required">*</span></label>
            <input 
              type="text" 
              className="form-input" 
              style={editMode && !component.title?.trim() ? { borderColor: 'var(--color-danger, #ef4444)' } : undefined}
              value={component.title || ''} 
              onChange={(e) => handleChange('title', e.target.value)}
              disabled={!editMode}
            />
            {editMode && !component.title?.trim() && (
              <span className="field-error" style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                Title is required by OSCAL Metaschema.
              </span>
            )}
          </div>
          <div className={styles['form-group']}>
            <label className="form-label">Type <span className="required">*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select 
                className="form-input" 
                value={(OSCAL_DEFINED_COMPONENT_TYPES as readonly string[]).includes(component.type) ? component.type : '__custom__'} 
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    handleChange('type', 'custom');
                  } else {
                    handleChange('type', e.target.value);
                  }
                }}
                disabled={!editMode}
              >
                {OSCAL_DEFINED_COMPONENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="__custom__">Custom / Other...</option>
              </select>
              {(!(OSCAL_DEFINED_COMPONENT_TYPES as readonly string[]).includes(component.type) || component.type === '') && (
                <>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter custom component type (e.g. cloud-service, firmware)"
                    value={component.type || ''} 
                    onChange={(e) => handleChange('type', e.target.value)}
                    disabled={!editMode}
                  />
                  {(component.type === 'this-system' || component.type === 'system') && (
                    <div style={{ color: '#d97706', fontSize: '0.85rem', marginTop: '4px' }}>
                      ⚠️ Warning: &quot;{component.type}&quot; is reserved exclusively for System Security Plans (SSPs) and should not be used in reusable Component Definitions.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className={styles['form-group']}>
            <label className="form-label">Description <span className="required">*</span></label>
            {editMode ? (
              <>
                <textarea 
                  className="form-textarea" 
                  style={!component.description?.trim() ? { borderColor: 'var(--color-danger, #ef4444)' } : undefined}
                  value={component.description || ''} 
                  onChange={(e) => handleChange('description', e.target.value)}
                />
                {!component.description?.trim() && (
                  <span className="field-error" style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                    Description is required by OSCAL Metaschema.
                  </span>
                )}
              </>
            ) : (
              <div className={styles['prose-readonly']}>
                <ProseWithParams value={component.description} />
              </div>
            )}
          </div>
          <div className={styles['form-group']}>
            <label className="form-label">Purpose</label>
            <textarea 
              className="form-textarea" 
              value={component.purpose || ''} 
              onChange={(e) => handleChange('purpose', e.target.value)}
              disabled={!editMode}
            />
          </div>
          <div className={styles['form-group']}>
            <label className="form-label">Remarks</label>
            {editMode ? (
              <textarea 
                className="form-textarea" 
                value={component.remarks || ''} 
                onChange={(e) => handleChange('remarks', e.target.value)}
              />
            ) : (
              <div className={styles['prose-readonly']}>
                <ProseWithParams value={component.remarks} />
              </div>
            )}
          </div>
        </Accordion>

        {/* 2. Properties & Links */}
        <Accordion 
          title="Properties & Links" 
          isOpen={openSections.props} 
          onToggle={() => toggleSection('props')}
        >
          <PropertyPalette 
            component={component} 
            onChange={(props) => handleChange('props', props)}
            editMode={editMode}
          />
          <div style={{ marginTop: '1.25rem' }}>
            <h5 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted, #7d8590)', margin: '0 0 8px 0' }}>
              Links &amp; Relationships
            </h5>
            <ComponentLinksEditor
              links={component.links || []}
              components={components}
              resources={resources}
              currentComponentUuid={component.uuid}
              componentType={component.type}
              onChange={(links) => handleChange('links', links)}
              editMode={editMode}
            />
          </div>
        </Accordion>

        {/* 3. Protocols */}
        <Accordion 
          title="Protocols" 
          isOpen={openSections.protocols} 
          onToggle={() => toggleSection('protocols')}
        >
          <ProtocolsEditor component={component} onChange={handleChange} editMode={editMode} />
        </Accordion>

        {/* 4. Responsible Roles */}
        <Accordion 
          title="Responsible Roles" 
          isOpen={openSections.roles} 
          onToggle={() => toggleSection('roles')}
        >
          <ComponentRolesEditor
            roles={component['responsible-roles'] || []}
            parties={parties}
            onChange={(roles) => handleChange('responsible-roles', roles)}
            editMode={editMode}
          />
        </Accordion>

        {/* 5. Control Implementations */}
        <Accordion 
          title="Control Implementations" 
          isOpen={openSections.impls} 
          onToggle={() => toggleSection('impls')}
        >
          <ControlImplementationsEditor
            controlImplementations={component['control-implementations'] || []}
            onChange={(impls) => handleChange('control-implementations', impls)}
            editMode={editMode}
          />
        </Accordion>
      </div>
    </div>
  );
}
