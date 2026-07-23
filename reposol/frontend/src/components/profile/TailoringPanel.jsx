import React from 'react';
import { DebouncedInput } from '../shared/DebouncedInput';
import { formatProse } from '../../lib/oscal-utils';

/**
 * Control Tailoring & Parameter Override Panel for Profiles.
 */
export function TailoringPanel({
  control = {},
  profile = {},
  onChange,
  isEditing = false
}) {
  const params = control.params || [];
  const parts = control.parts || [];

  const setParams = profile.modify?.['set-parameters'] || [];

  const handleParamOverrideChange = (paramId, overrideValue) => {
    let updatedSetParams = [...setParams];
    const existingIdx = updatedSetParams.findIndex(p => p['param-id'] === paramId);

    const values = overrideValue.trim() ? [overrideValue.trim()] : [];

    if (values.length === 0) {
      // Remove override if empty
      if (existingIdx !== -1) {
        updatedSetParams = updatedSetParams.filter((_, i) => i !== existingIdx);
      }
    } else {
      if (existingIdx !== -1) {
        updatedSetParams[existingIdx] = { ...updatedSetParams[existingIdx], values };
      } else {
        updatedSetParams.push({ 'param-id': paramId, values });
      }
    }

    // Save changes to profile modify structure
    const modify = profile.modify ? { ...profile.modify } : {};
    modify['set-parameters'] = updatedSetParams;
    onChange({ ...profile, modify });
  };

  // Helper to get active value (either override or catalog default)
  const getParamStatus = (paramId, defaultValues) => {
    const override = setParams.find(p => p['param-id'] === paramId);
    if (override && override.values && override.values.length > 0) {
      return { value: override.values[0], isOverridden: true };
    }
    return { value: defaultValues?.[0] || `[${paramId}]`, isOverridden: false };
  };

  // Render prose with parameter replacement (live rendering helper)
  const renderFormattedProse = (prose) => {
    const resolvedParams = {};
    params.forEach(p => {
      resolvedParams[p.id] = getParamStatus(p.id, p.values).value;
    });
    return formatProse(prose, resolvedParams);
  };

  // Render parts in read-only format
  const renderPart = (p) => {
    const subparts = p.parts || [];
    return (
      <div key={p.id || p.prose} style={{ marginBottom: '8px' }}>
        {p.name && (
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-success)', marginRight: '6px', textTransform: 'uppercase' }}>
            [{p.name}]
          </span>
        )}
        <span style={{ fontSize: '14px', lineHeight: '1.6' }}>
          {renderFormattedProse(p.prose || '')}
        </span>
        {subparts.length > 0 && (
          <div style={{ marginLeft: '16px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {subparts.map(renderPart)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tailoring-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      
      {/* Header Info */}
      <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="badge" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)', fontSize: '10px' }}>
            Tailoring Control
          </span>
          <span className="badge" style={{ background: 'var(--color-surface-3)', fontSize: '10px', fontFamily: 'monospace' }}>
            {control.id}
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{control.title}</h2>
      </div>

      {/* Control prose view (resolved with current param overrides) */}
      <div>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>Prose Statements (Resolved)</h4>
        {parts.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>No prose statements.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {parts.map(renderPart)}
          </div>
        )}
      </div>

      {/* Parameter overrides section */}
      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>Parameter Overrides (set-parameters)</h4>
        
        {params.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            This control does not contain any predefined parameters.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {params.map((p) => {
              const status = getParamStatus(p.id, p.values);
              const override = setParams.find(sp => sp['param-id'] === p.id);
              const overrideText = override && override.values ? override.values[0] : '';

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--color-surface-2)',
                    border: status.isOverridden ? '1px solid var(--color-success)' : '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px' }}>{p.id}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>— {p.label || 'Parameter'}</span>
                    </div>
                    {status.isOverridden && (
                      <span className="badge" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)', fontSize: '9px' }}>
                        Overridden
                      </span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    Catalog Default: {p.values?.join(', ') || '(empty)'}
                  </p>

                  {isEditing ? (
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Override Value</label>
                      <DebouncedInput
                        value={overrideText}
                        onChange={(val) => handleParamOverrideChange(p.id, val)}
                        placeholder="Override value..."
                        className="form-input"
                        style={{ width: '100%', height: '28px', fontSize: '12px' }}
                      />
                    </div>
                  ) : (
                    status.isOverridden && (
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-success)', fontWeight: 'bold' }}>
                        Active Baseline Override: {status.value}
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
