import React, { useState, useMemo, useCallback, useEffect } from 'react';
import styles from '../ComponentPage.module.css';
import { PropsEditor } from '@components/shared/PropsEditor';
import { Property, DefinedComponent } from '@lib/types/oscal';

export const OSCAL_NS = 'http://csrc.nist.gov/ns/oscal';

export const STANDARD_ASSET_TYPES = [
  'operating-system',
  'database',
  'web-server',
  'dns-server',
  'email-server',
  'directory-server',
  'pbx',
  'firewall',
  'router',
  'switch',
  'storage-array',
  'appliance'
] as const;

export const STANDARD_VALIDATION_TYPES = [
  'FIPS-140-2',
  'FIPS-140-3',
  'Common-Criteria',
  'FedRAMP-Low',
  'FedRAMP-Moderate',
  'FedRAMP-High',
  'BSI-C5',
  'PCI-DSS',
  'SOC-2',
  'ISO-27001'
] as const;

export const STANDARD_PROP_NAMES = new Set([
  'implementation-point',
  'virtual',
  'public',
  'allows-authenticated-scan',
  'release-date',
  'asset-type',
  'version',
  'patch-level',
  'model',
  'asset-id',
  'asset-tag',
  'label',
  'sort-id',
  'baseline-configuration-name',
  'function',
  'software-identifier',
  'software-name',
  'software-version',
  'software-patch-level',
  'validation-type',
  'validation-reference',
  'os-name',
  'os-version',
  'ipv4-address',
  'ipv6-address',
  'direction',
  'uri',
  'fqdn',
  'vlan-id',
  'network-id',
  'hardware-model'
]);

export interface PropertyPaletteProps {
  component: DefinedComponent | any;
  onChange: (updatedProps: Property[]) => void;
  isReadOnly?: boolean;
  editMode?: boolean;
}

export function PropertyPalette({
  component,
  onChange,
  isReadOnly = false,
  editMode
}: PropertyPaletteProps) {
  const isEditing = editMode !== undefined ? editMode : !isReadOnly;
  const props: Property[] = useMemo(() => component?.props || [], [component?.props]);
  const compType = component?.type || '';

  // Local state for custom asset-type combobox
  const rawAssetType = useMemo(() => {
    const p = props.find(item => item.name === 'asset-type' && (item.ns === OSCAL_NS || !item.ns));
    return p?.value || '';
  }, [props]);

  const isCustomAssetType = useMemo(() => {
    return rawAssetType !== '' && !(STANDARD_ASSET_TYPES as readonly string[]).includes(rawAssetType as any);
  }, [rawAssetType]);

  const [customAssetTypeMode, setCustomAssetTypeMode] = useState<boolean>(isCustomAssetType);

  // Deprecated hardware-model check
  const hardwareModelValue = useMemo(() => {
    const p = props.find(item => item.name === 'hardware-model' && (item.ns === OSCAL_NS || !item.ns));
    return p?.value || '';
  }, [props]);

  // Read helper
  const getProp = useCallback(
    (name: string): string => {
      const p = props.find(item => item.name === name && (item.ns === OSCAL_NS || !item.ns));
      return p?.value ?? '';
    },
    [props]
  );

  const propsRef = React.useRef<Property[]>(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  // Write helper
  const setProp = useCallback(
    (name: string, value: string | null | undefined) => {
      if (!isEditing) return;
      const current = [...propsRef.current];
      const index = current.findIndex(p => p.name === name && (p.ns === OSCAL_NS || !p.ns));
      const trimmed = value !== null && value !== undefined ? String(value).trim() : '';

      if (!trimmed) {
        if (index !== -1) {
          current.splice(index, 1);
        }
      } else {
        if (index !== -1) {
          current[index] = {
            ...current[index],
            value: trimmed,
            ns: current[index].ns || OSCAL_NS
          };
        } else {
          current.push({
            name,
            value: trimmed,
            ns: OSCAL_NS
          });
        }
      }
      propsRef.current = current;
      onChange(current);
    },
    [isEditing, onChange]
  );

  // 1-Click Deprecation Migration
  const handleMigrateHardwareModel = () => {
    if (!isEditing || !hardwareModelValue) return;
    let nextProps = propsRef.current.filter(p => p.name !== 'hardware-model');
    const existingModelIndex = nextProps.findIndex(p => p.name === 'model' && (p.ns === OSCAL_NS || !p.ns));
    if (existingModelIndex === -1) {
      nextProps.push({
        name: 'model',
        value: hardwareModelValue,
        ns: OSCAL_NS
      });
    }
    propsRef.current = nextProps;
    onChange(nextProps);
  };

  // Custom properties for fallback editor
  const customProps = useMemo(() => {
    return props.filter(p => !STANDARD_PROP_NAMES.has(p.name) || (p.ns && p.ns !== OSCAL_NS));
  }, [props]);

  const handleCustomPropsChange = (newCustomProps: Property[]) => {
    if (!isEditing) return;
    const standardProps = propsRef.current.filter(p => STANDARD_PROP_NAMES.has(p.name) && (!p.ns || p.ns === OSCAL_NS));
    const next = [...standardProps, ...newCustomProps];
    propsRef.current = next;
    onChange(next);
  };

  // Date validation check (ISO YYYY-MM-DD)
  const releaseDate = getProp('release-date');
  const isReleaseDateValid = !releaseDate || /^\d{4}-\d{2}-\d{2}$/.test(releaseDate);

  // IPv4 validation check
  const ipv4 = getProp('ipv4-address');
  const isIpv4Valid =
    !ipv4 ||
    /^(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(
      ipv4
    );

  // URI validation check
  const uri = getProp('uri');
  const isUriValid = !uri || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri);

  return (
    <div className={styles['palette-container'] || styles['property-palette']}>
      {/* ── Deprecation Warning Banner ── */}
      {hardwareModelValue && (
        <div className={styles['deprecation-banner']} role="alert">
          <div className={styles['deprecation-info']}>
            <span className={styles['warning-icon']}>⚠️</span>
            <div>
              <strong>Deprecation Notice:</strong> Property <code>hardware-model</code> is deprecated in OSCAL 1.2+
              in favor of <code>model</code>. (Current value: &quot;{hardwareModelValue}&quot;)
            </div>
          </div>
          {isEditing && (
            <button
              type="button"
              className={styles['migrate-btn'] || styles['deprecation-action-btn']}
              onClick={handleMigrateHardwareModel}
              title="Migrate hardware-model to model"
            >
              🔄 Migrate to &apos;model&apos;
            </button>
          )}
        </div>
      )}

      {/* ── Section 1: Architecture & Deployment Toggles ── */}
      <div className={styles['section-card'] || styles['palette-category']}>
        <div className={styles['section-header']}>
          <span className={styles['section-icon']}>🏗️</span>
          <h5 className={styles['section-title']}>Architecture &amp; Deployment</h5>
        </div>
        <div className={styles['toggles-grid'] || styles['palette-grid']}>
          {/* Implementation Point */}
          <div className={styles['toggle-item'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Implementation Point</label>
            {isEditing ? (
              <div className={styles['segmented-control']}>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('implementation-point') === 'internal' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('implementation-point', getProp('implementation-point') === 'internal' ? '' : 'internal')}
                >
                  🏢 Internal
                </button>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('implementation-point') === 'external' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('implementation-point', getProp('implementation-point') === 'external' ? '' : 'external')}
                >
                  🌐 External
                </button>
              </div>
            ) : (
              <span className={styles['read-only-badge']}>
                {getProp('implementation-point') ? (getProp('implementation-point') === 'internal' ? '🏢 Internal' : '🌐 External') : '—'}
              </span>
            )}
          </div>

          {/* Virtual */}
          <div className={styles['toggle-item'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Virtualized Asset</label>
            {isEditing ? (
              <div className={styles['segmented-control']}>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('virtual') === 'yes' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('virtual', getProp('virtual') === 'yes' ? '' : 'yes')}
                >
                  ☁️ Yes
                </button>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('virtual') === 'no' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('virtual', getProp('virtual') === 'no' ? '' : 'no')}
                >
                  🖥️ No
                </button>
              </div>
            ) : (
              <span className={styles['read-only-badge']}>
                {getProp('virtual') ? (getProp('virtual') === 'yes' ? '☁️ Virtual' : '🖥️ Physical') : '—'}
              </span>
            )}
          </div>

          {/* Public */}
          <div className={styles['toggle-item'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Public Access</label>
            {isEditing ? (
              <div className={styles['segmented-control']}>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('public') === 'yes' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('public', getProp('public') === 'yes' ? '' : 'yes')}
                >
                  🌍 Public
                </button>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('public') === 'no' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('public', getProp('public') === 'no' ? '' : 'no')}
                >
                  🔒 Private
                </button>
              </div>
            ) : (
              <span className={styles['read-only-badge']}>
                {getProp('public') ? (getProp('public') === 'yes' ? '🌍 Public' : '🔒 Private') : '—'}
              </span>
            )}
          </div>

          {/* Allows Authenticated Scan */}
          <div className={styles['toggle-item'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Authenticated Scan</label>
            {isEditing ? (
              <div className={styles['segmented-control']}>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('allows-authenticated-scan') === 'yes' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('allows-authenticated-scan', getProp('allows-authenticated-scan') === 'yes' ? '' : 'yes')}
                >
                  🔍 Yes
                </button>
                <button
                  type="button"
                  className={`${styles['segment-btn'] || styles['segmented-btn']} ${getProp('allows-authenticated-scan') === 'no' ? (styles['active-segment'] || styles['active']) : ''}`}
                  onClick={() => setProp('allows-authenticated-scan', getProp('allows-authenticated-scan') === 'no' ? '' : 'no')}
                >
                  🚫 No
                </button>
              </div>
            ) : (
              <span className={styles['read-only-badge']}>
                {getProp('allows-authenticated-scan') ? (getProp('allows-authenticated-scan') === 'yes' ? '🔍 Allowed' : '🚫 Not allowed') : '—'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Release & Product Identification ── */}
      <div className={styles['section-card'] || styles['palette-category']}>
        <div className={styles['section-header']}>
          <span className={styles['section-icon']}>📦</span>
          <h5 className={styles['section-title']}>Product &amp; Release</h5>
        </div>
        <div className={styles['form-grid'] || styles['palette-grid']}>
          {/* Release Date */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Release Date (YYYY-MM-DD)</label>
            {isEditing ? (
              <>
                <input
                  type="date"
                  className={`form-input ${styles['input'] || ''} ${!isReleaseDateValid ? (styles['input-error'] || styles['inputError']) : ''}`}
                  value={getProp('release-date')}
                  onChange={(e) => setProp('release-date', e.target.value)}
                />
                {!isReleaseDateValid && (
                  <span className={styles['error-text'] || styles['errorText']}>Format must be YYYY-MM-DD</span>
                )}
              </>
            ) : (
              <span className={styles['read-only-value']}>{getProp('release-date') || '—'}</span>
            )}
          </div>

          {/* Asset Type */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Asset Type</label>
            {isEditing ? (
              <div className={styles['combobox-wrapper']}>
                {!customAssetTypeMode ? (
                  <select
                    className={`form-input ${styles['select'] || ''}`}
                    value={rawAssetType}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomAssetTypeMode(true);
                      } else {
                        setProp('asset-type', e.target.value);
                      }
                    }}
                  >
                    <option value="">Select standard asset type...</option>
                    {STANDARD_ASSET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                    <option value="__custom__">➕ Custom / Other...</option>
                  </select>
                ) : (
                  <div className={styles['custom-input-row']}>
                    <input
                      type="text"
                      className={`form-input ${styles['input'] || ''}`}
                      placeholder="Enter custom asset type (e.g. cloud-service)"
                      value={rawAssetType}
                      onChange={(e) => setProp('asset-type', e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className={styles['switch-mode-btn']}
                      onClick={() => setCustomAssetTypeMode(false)}
                      title="Back to standard presets"
                    >
                      Presets
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span className={styles['read-only-value']}>{rawAssetType || '—'}</span>
            )}
          </div>

          {/* Version */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Version</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. 7.0.5"
                value={getProp('version')}
                onChange={(e) => setProp('version', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('version') || '—'}</span>
            )}
          </div>

          {/* Patch Level */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Patch Level</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. patch-2, SP1"
                value={getProp('patch-level')}
                onChange={(e) => setProp('patch-level', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('patch-level') || '—'}</span>
            )}
          </div>

          {/* Model */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Model</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="Hardware or product model"
                value={getProp('model')}
                onChange={(e) => setProp('model', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('model') || '—'}</span>
            )}
          </div>

          {/* Function */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Function</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. Primary document datastore"
                value={getProp('function')}
                onChange={(e) => setProp('function', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('function') || '—'}</span>
            )}
          </div>

          {/* Asset ID */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Asset ID</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. srv-db-01"
                value={getProp('asset-id')}
                onChange={(e) => setProp('asset-id', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('asset-id') || '—'}</span>
            )}
          </div>

          {/* Asset Tag */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Asset Tag</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. TAG-98234"
                value={getProp('asset-tag')}
                onChange={(e) => setProp('asset-tag', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('asset-tag') || '—'}</span>
            )}
          </div>

          {/* Baseline Configuration Name */}
          <div className={`${styles['field-group'] || styles['palette-field']} ${styles['full-width'] || styles['fullWidth'] || ''}`}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Baseline Configuration Name</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. CIS MongoDB 7.0 Benchmark v1.0.0"
                value={getProp('baseline-configuration-name')}
                onChange={(e) => setProp('baseline-configuration-name', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('baseline-configuration-name') || '—'}</span>
            )}
          </div>

          {/* Label */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Label</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="Short display label"
                value={getProp('label')}
                onChange={(e) => setProp('label', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('label') || '—'}</span>
            )}
          </div>

          {/* Sort ID */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Sort ID</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. 01-primary"
                value={getProp('sort-id')}
                onChange={(e) => setProp('sort-id', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('sort-id') || '—'}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Conditional Software Specifics (when type === 'software') ── */}
      {compType === 'software' && (
        <div className={`${styles['section-card'] || styles['palette-category']} ${styles['software-card'] || ''}`}>
          <div className={styles['section-header']}>
            <span className={styles['section-icon']}>💻</span>
            <h5 className={styles['section-title']}>Software Specifications</h5>
            <span className={styles['type-badge']}>type=&quot;software&quot;</span>
          </div>
          <div className={styles['form-grid'] || styles['palette-grid']}>
            {/* Software Identifier (SWID / CPE / PURL) */}
            <div className={`${styles['field-group'] || styles['palette-field']} ${styles['full-width'] || styles['fullWidth'] || ''}`}>
              <label className={styles['control-label'] || styles['palette-field-label']}>Software Identifier (SWID Tag / CPE / PURL)</label>
              {isEditing ? (
                <input
                  type="text"
                  className={`form-input ${styles['input'] || ''}`}
                  placeholder="e.g. pkg:deb/debian/mongodb-enterprise@7.0.5 or cpe:2.3:a:mongodb:mongodb:7.0.5:*:*:*:*:*:*:*"
                  value={getProp('software-identifier')}
                  onChange={(e) => setProp('software-identifier', e.target.value)}
                />
              ) : (
                <span className={styles['read-only-value']}>{getProp('software-identifier') || '—'}</span>
              )}
            </div>

            {/* Software Name */}
            <div className={styles['field-group'] || styles['palette-field']}>
              <label className={styles['control-label'] || styles['palette-field-label']}>Software Name</label>
              {isEditing ? (
                <input
                  type="text"
                  className={`form-input ${styles['input'] || ''}`}
                  placeholder="Official software product name"
                  value={getProp('software-name')}
                  onChange={(e) => setProp('software-name', e.target.value)}
                />
              ) : (
                <span className={styles['read-only-value']}>{getProp('software-name') || '—'}</span>
              )}
            </div>

            {/* Software Version */}
            <div className={styles['field-group'] || styles['palette-field']}>
              <label className={styles['control-label'] || styles['palette-field-label']}>Software Version</label>
              {isEditing ? (
                <input
                  type="text"
                  className={`form-input ${styles['input'] || ''}`}
                  placeholder="Software version string"
                  value={getProp('software-version')}
                  onChange={(e) => setProp('software-version', e.target.value)}
                />
              ) : (
                <span className={styles['read-only-value']}>{getProp('software-version') || '—'}</span>
              )}
            </div>

            {/* Software Patch Level */}
            <div className={styles['field-group'] || styles['palette-field']}>
              <label className={styles['control-label'] || styles['palette-field-label']}>Software Patch Level</label>
              {isEditing ? (
                <input
                  type="text"
                  className={`form-input ${styles['input'] || ''}`}
                  placeholder="e.g. hotfix-3, rev-2"
                  value={getProp('software-patch-level')}
                  onChange={(e) => setProp('software-patch-level', e.target.value)}
                />
              ) : (
                <span className={styles['read-only-value']}>{getProp('software-patch-level') || '—'}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 4: Conditional Validation Specifics (when type === 'validation') ── */}
      {compType === 'validation' && (
        <div className={`${styles['section-card'] || styles['palette-category']} ${styles['validation-card'] || ''}`}>
          <div className={styles['section-header']}>
            <span className={styles['section-icon']}>🛡️</span>
            <h5 className={styles['section-title']}>Validation &amp; Certification</h5>
            <span className={styles['type-badge']}>type=&quot;validation&quot;</span>
          </div>
          <div className={styles['form-grid'] || styles['palette-grid']}>
            {/* Validation Type */}
            <div className={styles['field-group'] || styles['palette-field']}>
              <label className={styles['control-label'] || styles['palette-field-label']}>Validation Type / Standard</label>
              {isEditing ? (
                <div className={styles['combobox-wrapper']}>
                  <input
                    type="text"
                    list="validation-type-presets"
                    className={`form-input ${styles['input'] || ''}`}
                    placeholder="e.g. FIPS-140-3, Common-Criteria"
                    value={getProp('validation-type')}
                    onChange={(e) => setProp('validation-type', e.target.value)}
                  />
                  <datalist id="validation-type-presets">
                    {STANDARD_VALIDATION_TYPES.map((vt) => (
                      <option key={vt} value={vt} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <span className={styles['read-only-value']}>{getProp('validation-type') || '—'}</span>
              )}
            </div>

            {/* Validation Reference */}
            <div className={styles['field-group'] || styles['palette-field']}>
              <label className={styles['control-label'] || styles['palette-field-label']}>Validation Reference / Cert ID</label>
              {isEditing ? (
                <input
                  type="text"
                  className={`form-input ${styles['input'] || ''}`}
                  placeholder="e.g. NIST CMVP Certificate #4123"
                  value={getProp('validation-reference')}
                  onChange={(e) => setProp('validation-reference', e.target.value)}
                />
              ) : (
                <span className={styles['read-only-value']}>{getProp('validation-reference') || '—'}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Section 5: OS & Network Infrastructure ── */}
      <div className={styles['section-card'] || styles['palette-category']}>
        <div className={styles['section-header']}>
          <span className={styles['section-icon']}>🌐</span>
          <h5 className={styles['section-title']}>OS &amp; Network Infrastructure</h5>
        </div>
        <div className={styles['form-grid'] || styles['palette-grid']}>
          {/* OS Name */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Operating System Name</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. Ubuntu Linux, Windows Server"
                value={getProp('os-name')}
                onChange={(e) => setProp('os-name', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('os-name') || '—'}</span>
            )}
          </div>

          {/* OS Version */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Operating System Version</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. 24.04 LTS, 2022"
                value={getProp('os-version')}
                onChange={(e) => setProp('os-version', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('os-version') || '—'}</span>
            )}
          </div>

          {/* IPv4 Address */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>IPv4 Address</label>
            {isEditing ? (
              <>
                <input
                  type="text"
                  className={`form-input ${styles['input'] || ''} ${!isIpv4Valid ? (styles['input-error'] || styles['inputError']) : ''}`}
                  placeholder="e.g. 192.168.1.100"
                  value={getProp('ipv4-address')}
                  onChange={(e) => setProp('ipv4-address', e.target.value)}
                />
                {!isIpv4Valid && (
                  <span className={styles['error-text'] || styles['errorText']}>Must be valid IPv4 address (x.x.x.x)</span>
                )}
              </>
            ) : (
              <span className={styles['read-only-value']}>{getProp('ipv4-address') || '—'}</span>
            )}
          </div>

          {/* IPv6 Address */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>IPv6 Address</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. 2001:db8::1"
                value={getProp('ipv6-address')}
                onChange={(e) => setProp('ipv6-address', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('ipv6-address') || '—'}</span>
            )}
          </div>

          {/* Traffic Direction */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Traffic Direction</label>
            {isEditing ? (
              <select
                className={`form-input ${styles['select'] || ''}`}
                value={getProp('direction')}
                onChange={(e) => setProp('direction', e.target.value)}
              >
                <option value="">Select direction...</option>
                <option value="incoming">incoming (Inbound)</option>
                <option value="outgoing">outgoing (Outbound)</option>
              </select>
            ) : (
              <span className={styles['read-only-value']}>{getProp('direction') || '—'}</span>
            )}
          </div>

          {/* Endpoint URI */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Endpoint URI</label>
            {isEditing ? (
              <>
                <input
                  type="text"
                  className={`form-input ${styles['input'] || ''} ${!isUriValid ? (styles['input-error'] || styles['inputError']) : ''}`}
                  placeholder="e.g. https://api.service.internal:8443"
                  value={getProp('uri')}
                  onChange={(e) => setProp('uri', e.target.value)}
                />
                {!isUriValid && <span className={styles['error-text'] || styles['errorText']}>Must include scheme (e.g. https://)</span>}
              </>
            ) : (
              <span className={styles['read-only-value']}>{getProp('uri') || '—'}</span>
            )}
          </div>

          {/* FQDN */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>FQDN</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. db1.prod.enterprise.internal"
                value={getProp('fqdn')}
                onChange={(e) => setProp('fqdn', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('fqdn') || '—'}</span>
            )}
          </div>

          {/* VLAN ID */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>VLAN ID</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. 100, vlan-dmz"
                value={getProp('vlan-id')}
                onChange={(e) => setProp('vlan-id', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('vlan-id') || '—'}</span>
            )}
          </div>

          {/* Network ID */}
          <div className={styles['field-group'] || styles['palette-field']}>
            <label className={styles['control-label'] || styles['palette-field-label']}>Network ID / Subnet</label>
            {isEditing ? (
              <input
                type="text"
                className={`form-input ${styles['input'] || ''}`}
                placeholder="e.g. 192.168.1.0/24, net-prod-backend"
                value={getProp('network-id')}
                onChange={(e) => setProp('network-id', e.target.value)}
              />
            ) : (
              <span className={styles['read-only-value']}>{getProp('network-id') || '—'}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 6: Custom / Free-Form Properties Fallback ── */}
      <div className={styles['section-card'] || styles['palette-category']}>
        <div className={styles['section-header']}>
          <span className={styles['section-icon']}>🏷️</span>
          <h5 className={styles['section-title']}>Custom &amp; Non-Standard Properties</h5>
        </div>
        <p className={styles['section-description']}>
          Arbitrary organization-specific properties with custom namespaces, classes, and remarks.
        </p>
        <PropsEditor
          props={customProps}
          onChange={handleCustomPropsChange}
          readOnly={!isEditing}
        />
      </div>
    </div>
  );
}

export default PropertyPalette;
