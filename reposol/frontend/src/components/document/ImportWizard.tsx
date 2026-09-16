import React, { useState, useEffect } from 'react';
import styles from './Document.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { authFetch } from '@lib/api';
import { toast } from 'react-hot-toast';

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  nist: { label: 'NIST', color: '#58a6ff', bg: 'rgba(56, 139, 253, 0.15)', border: 'rgba(56, 139, 253, 0.3)' },
  fedramp: { label: 'FedRAMP', color: '#3fb950', bg: 'rgba(46, 160, 67, 0.15)', border: 'rgba(46, 160, 67, 0.3)' },
  bsi: { label: 'BSI', color: '#e3b341', bg: 'rgba(210, 153, 34, 0.15)', border: 'rgba(210, 153, 34, 0.3)' },
  sample: { label: 'Sample', color: '#bc8cff', bg: 'rgba(188, 140, 255, 0.15)', border: 'rgba(188, 140, 255, 0.3)' },
};

const MODEL_ICONS: Record<string, string> = {
  catalog: '📖',
  profile: '⚙️',
  ssp: '📝',
  'system-security-plan': '📝',
  'component-definition': '🧱',
  'assessment-plan': '📅',
  'assessment-results': '✅',
  poam: '⚠️',
};

const STAGE_TO_MODEL: Record<string, string> = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'ssp',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'poam'
};

const CATALOG_EXAMPLE_URLS = [
  {
    label: 'NIST SP 800-53 Rev 5.2.0 Catalog',
    desc: 'Full catalog with Rev 5.2.0 controls & SP 800-53A assessment objectives',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json',
  },
  {
    label: 'NIST Cybersecurity Framework 2.0',
    desc: 'Official NIST CSF 2.0 core catalog functions and categories',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/refs/heads/main/nist.gov/CSF/v2.0/json/NIST_CSF_v2.0_catalog.json',
  },
  {
    label: 'BSI IT-Grundschutz Kompendium',
    desc: 'Official German Federal Office (BSI) IT-Grundschutz++ catalog',
    url: 'https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/control_layer/Grundschutz%2B%2B/Grundschutz%2B%2B-resolved_catalog.json',
  },
];

const COMPONENT_EXAMPLE_URLS = [
  {
    label: 'BSI Keycloak IAM Component Definition',
    desc: 'Official BSI Stand-der-Technik Keycloak Identity & Access Management definition',
    url: 'https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/implementation_layer/Keycloak/Keycloak-component_definition.json',
  },
  {
    label: 'BSI AWS Security Hub Component Definition',
    desc: 'BSI Stand-der-Technik AWS Security Hub cloud security posture component',
    url: 'https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/implementation_layer/AWS%20Beispiel-Components/AWS%20Security%20Hub-component_definition.json',
  },
  {
    label: 'NIST Example Component Definition (MongoDB)',
    desc: 'Official NIST OSCAL example component definition demonstrating hardware, software & database service components',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/component-definition/json/example-component-definition.json',
  },
];

const PROFILE_EXAMPLE_URLS = [
  {
    label: 'NIST SP 800-53 Rev 5 — LOW Baseline Profile',
    desc: 'Official NIST SP 800-53 Rev 5 LOW impact baseline profile',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline_profile.json',
  },
  {
    label: 'NIST SP 800-53 Rev 5 — MODERATE Baseline Profile',
    desc: 'Official NIST SP 800-53 Rev 5 MODERATE impact baseline profile',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json',
  },
  {
    label: 'NIST SP 800-53 Rev 5 — HIGH Baseline Profile',
    desc: 'Official NIST SP 800-53 Rev 5 HIGH impact baseline profile',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline_profile.json',
  },
];

const SSP_EXAMPLE_URLS = [
  {
    label: 'NIST OSCAL Example System Security Plan',
    desc: 'Official NIST OSCAL example System Security Plan (SSP) demonstrating control implementation & components',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ssp/json/ssp-example.json',
  },
];

const ASSESSMENT_PLAN_EXAMPLE_URLS = [
  {
    label: 'NIST OSCAL Example Assessment Plan',
    desc: 'Official NIST OSCAL example Assessment Plan (AP) for security assessments',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/assessment-plan/json/assessment-plan-example.json',
  },
];

const ASSESSMENT_RESULTS_EXAMPLE_URLS = [
  {
    label: 'NIST OSCAL Example Assessment Results',
    desc: 'Official NIST OSCAL example Assessment Results (AR) containing observations & findings',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/assessment-results/json/assessment-results-example.json',
  },
];

const POAM_EXAMPLE_URLS = [
  {
    label: 'NIST OSCAL Example Plan of Action and Milestones',
    desc: 'Official NIST OSCAL example Plan of Action and Milestones (POA&M) document',
    url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/poam/json/poam-example.json',
  },
];

export const getStagePresets = (stage?: string) => {
  if (stage === 'component-definitions' || stage === 'component-definition') {
    return { title: 'Standard Component Definition Presets (Click to load)', icon: '🧱', items: COMPONENT_EXAMPLE_URLS };
  }
  if (stage === 'profiles' || stage === 'profile') {
    return { title: 'Standard Profile Presets (Click to load)', icon: '⚙️', items: PROFILE_EXAMPLE_URLS };
  }
  if (stage === 'ssps' || stage === 'ssp') {
    return { title: 'Standard System Security Plan Presets (Click to load)', icon: '📝', items: SSP_EXAMPLE_URLS };
  }
  if (stage === 'assessment-plans' || stage === 'assessment-plan') {
    return { title: 'Standard Assessment Plan Presets (Click to load)', icon: '📅', items: ASSESSMENT_PLAN_EXAMPLE_URLS };
  }
  if (stage === 'assessment-results' || stage === 'assessment-result') {
    return { title: 'Standard Assessment Results Presets (Click to load)', icon: '✅', items: ASSESSMENT_RESULTS_EXAMPLE_URLS };
  }
  if (stage === 'poams' || stage === 'poam') {
    return { title: 'Standard POA&M Presets (Click to load)', icon: '⚠️', items: POAM_EXAMPLE_URLS };
  }
  if (stage === 'catalogs' || stage === 'catalog') {
    return { title: 'Standard Catalog Presets (Click to load)', icon: '📖', items: CATALOG_EXAMPLE_URLS };
  }
  return {
    title: 'Standard Catalog Presets (Click to load)',
    icon: '📖',
    items: [
      {
        label: 'NIST SP 800-53 Rev5 Catalog',
        desc: 'NIST SP 800-53 Rev 5 Catalog',
        url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json',
      },
      {
        label: 'NIST CSF 2.0 Catalog',
        desc: 'NIST Cybersecurity Framework 2.0',
        url: 'https://raw.githubusercontent.com/usnistgov/oscal-content/refs/heads/main/nist.gov/CSF/v2.0/json/NIST_CSF_v2.0_catalog.json',
      },
    ],
  };
};

export interface ImportWizardProps {
  stage?: string;
  onImported?: (stage: string, docData?: any) => void;
  onClose?: () => void;
  embedded?: boolean;
  onApplyContent?: (document: any) => void;
  currentDocument?: any;
  title?: string;
  subtitle?: string;
}

export interface ImportResultState {
  ok: boolean;
  message: string;
  status?: string;
  action?: string;
  version?: string;
  existing_version?: string;
  same_title_existing?: {
    uuid: string;
    title: string;
    version?: string;
    identical_content: boolean;
  } | null;
}

const getRegistryResultMessage = (data: any, appliedTitle: string, isEmbedded: boolean): string => {
  if (isEmbedded) {
    return `✅ Content Applied: "${appliedTitle}"`;
  }
  if (data.status === 'already_exists') {
    return `ℹ️ Already imported: "${appliedTitle}" (Version ${data.version || 'current'})`;
  }
  if (data.status === 'updated') {
    if (data.action === 'version_bump' || (data.existing_version && data.version && data.existing_version !== data.version)) {
      return `🔄 Updated: "${appliedTitle}" (v${data.existing_version} → v${data.version})`;
    }
    if (data.action === 'content_updated') {
      return `⚠️ Re-imported: "${appliedTitle}" (Updated locally modified document)`;
    }
    return `🔄 Updated: "${appliedTitle}"`;
  }
  if (data.same_title_existing) {
    const ver = data.same_title_existing.version ? ` (v${data.same_title_existing.version})` : '';
    if (data.same_title_existing.identical_content) {
      return `ℹ️ Imported: "${appliedTitle}" (Identical document${ver} already in workspace)`;
    }
    return `⚠️ Imported: "${appliedTitle}" (Duplicate title with modified content${ver})`;
  }
  return `✅ Imported: "${appliedTitle}"`;
};

const getDocumentResultMessage = (data: any, isEmbedded: boolean): string => {
  if (isEmbedded) {
    return `✅ Content Applied: "${data.title}"`;
  }
  if (data.status === 'already_exists') {
    return `ℹ️ Already imported: "${data.title}" (${data.stage}) — Version ${data.version || 'current'} is already present in your workspace with identical content.`;
  }
  if (data.status === 'updated') {
    if (data.action === 'version_bump' || (data.existing_version && data.version && data.existing_version !== data.version)) {
      return `🔄 Updated: "${data.title}" (${data.stage}) — Version updated from ${data.existing_version || 'previous'} to ${data.version}.`;
    }
    if (data.action === 'content_updated') {
      return `⚠️ Re-imported: "${data.title}" (${data.stage}) — Existing document was locally modified; updated with imported content.`;
    }
    return `🔄 Updated: "${data.title}" (${data.stage})`;
  }
  if (data.same_title_existing) {
    const ver = data.same_title_existing.version ? ` (v${data.same_title_existing.version})` : '';
    if (data.same_title_existing.identical_content) {
      return `ℹ️ Imported: "${data.title}" (${data.stage}) — Note: An identical document with this title already exists in your workspace${ver} (UUID: ${data.same_title_existing.uuid.slice(0, 8)}...).`;
    }
    return `⚠️ Imported: "${data.title}" (${data.stage}) — Note: Another document with this title already exists${ver} with different content/modifications (UUID: ${data.same_title_existing.uuid.slice(0, 8)}...).`;
  }
  return `✅ Imported: "${data.title}" (${data.stage})`;
};

const notifyImportSuccess = (data: any, docTitle: string) => {
  if (data.status === 'already_exists') {
    toast(`"${docTitle}" is already imported and up to date`, { icon: 'ℹ️' });
  } else if (data.status === 'updated') {
    if (data.action === 'content_updated') {
      toast(`Re-imported "${docTitle}" (updated locally modified document)`, { icon: '⚠️' });
    } else {
      toast.success(`Updated "${docTitle}" to v${data.version || 'latest'}`);
    }
  } else if (data.same_title_existing) {
    if (data.same_title_existing.identical_content) {
      toast(`Imported "${docTitle}" (identical document already exists in ${data.stage})`, { icon: 'ℹ️' });
    } else {
      toast(`Imported "${docTitle}" (duplicate title with different content in ${data.stage})`, { icon: '⚠️' });
    }
  } else {
    toast.success(`Successfully imported "${docTitle}"`);
  }
};

const getResultClass = (res: ImportResultState, isRegistry = false) => {
  if (!res.ok) return isRegistry ? styles['err'] : styles['invalid'];
  if (res.status === 'already_exists') return styles['info'];
  if (res.action === 'content_updated') return styles['warning'];
  if (res.same_title_existing && !res.same_title_existing.identical_content) return styles['warning'];
  return isRegistry ? styles['ok'] : styles['valid'];
};

export default function ImportWizard({
  stage,
  onImported,
  onClose,
  embedded = false,
  onApplyContent,
  currentDocument,
  title,
  subtitle,
}: ImportWizardProps) {
  const [tab, setTab] = useState<'registry' | 'url' | 'upload'>('registry');
  const [registry, setRegistry] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(() => {
    return (stage ? STAGE_TO_MODEL[stage] : '') || 'all';
  });
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ImportResultState | null>>({});
  
  const [urlInput, setUrlInput] = useState('');
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlResult, setUrlResult] = useState<ImportResultState | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResultState | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    authFetch('/api/import/registry')
      .then((r) => r.json())
      .then((data) => setRegistry(Array.isArray(data) ? data : []))
      .catch(() => setRegistry([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (embedded || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embedded, onClose]);

  const modelTypes = ['all', ...Array.from(new Set(registry.map((e) => e.model)))];
  const sourceTypes = ['all', ...Array.from(new Set(registry.map((e) => e.source)))];

  const filtered = registry.filter((entry) => {
    const matchModel = filter === 'all' || entry.model === filter;
    const matchSource = sourceFilter === 'all' || entry.source === sourceFilter;
    const matchSearch =
      !search ||
      entry.title.toLowerCase().includes(search.toLowerCase()) ||
      entry.description.toLowerCase().includes(search.toLowerCase());
    return matchModel && matchSource && matchSearch;
  });

  const handleImport = async (entry: any) => {
    setImporting(entry.id);
    setResults((prev) => ({ ...prev, [entry.id]: null }));
    try {
      const endpoint = embedded
        ? `/api/import/registry/${entry.id}?persist=false`
        : `/api/import/registry/${entry.id}`;
      const response = await authFetch(endpoint, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        let appliedTitle = data.title || entry.title;
        if (embedded && onApplyContent) {
          if (stage && data.stage && data.stage !== stage) {
            const errStageMsg = `Cannot apply a ${data.stage} document to a ${stage} document`;
            toast.error(errStageMsg);
            throw new Error(errStageMsg);
          }
          const fullDoc = data.document || data;
          const contentDoc = fullDoc?.catalog || fullDoc?.profile || fullDoc?.['component-definition'] || fullDoc?.['system-security-plan'] || fullDoc;
          await onApplyContent(contentDoc);
          toast.success(`Content from "${appliedTitle}" applied to current document`);
        }

        const msg = getRegistryResultMessage(data, appliedTitle, embedded);
        setResults((prev) => ({
          ...prev,
          [entry.id]: {
            ok: true,
            message: msg,
            status: data.status,
            action: data.action,
            version: data.version,
            existing_version: data.existing_version,
            same_title_existing: data.same_title_existing,
          },
        }));
        if (!embedded) {
          notifyImportSuccess(data, appliedTitle);
        }
        if (!embedded && onImported) onImported(data.stage);
      } else {
        setResults((prev) => ({
          ...prev,
          [entry.id]: { ok: false, message: `❌ ${data.detail || 'Import failed'}` },
        }));
        toast.error(data.detail || 'Import failed');
      }
    } catch (err: any) {
      const isApiErr = err?.name === 'ApiError';
      const msg = isApiErr ? `❌ ${err.message}` : `❌ Network error: ${err.message}`;
      setResults((prev) => ({
        ...prev,
        [entry.id]: { ok: false, message: msg },
      }));
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(null);
    }
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setUrlImporting(true);
    setUrlResult(null);
    try {
      const endpoint = embedded ? '/api/import/url?persist=false' : '/api/import/url';
      const response = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          validate_schema: true,
          persist: !embedded
        }),
      });
      const data = await response.json();
      if (response.ok) {
        if (embedded && onApplyContent) {
          if (stage && data.stage && data.stage !== stage) {
            const errStageMsg = `Cannot apply a ${data.stage} document to a ${stage} document`;
            toast.error(errStageMsg);
            throw new Error(errStageMsg);
          }
          const fullDoc = data.document || data;
          const contentDoc = fullDoc?.catalog || fullDoc?.profile || fullDoc?.['component-definition'] || fullDoc?.['system-security-plan'] || fullDoc;
          await onApplyContent(contentDoc);
          toast.success(`Content from URL applied to current document`);
        }

        const msg = getDocumentResultMessage(data, embedded);
        setUrlResult({
          ok: true,
          message: msg,
          status: data.status,
          action: data.action,
          version: data.version,
          existing_version: data.existing_version,
          same_title_existing: data.same_title_existing,
        });
        if (!embedded) {
          notifyImportSuccess(data, data.title);
        }
        if (!embedded && onImported) onImported(data.stage);
      } else {
        setUrlResult({ ok: false, message: `❌ ${data.detail || 'Import failed'}` });
        toast.error(data.detail || 'Import failed');
      }
    } catch (err: any) {
      const isApiErr = err?.name === 'ApiError';
      const msg = isApiErr ? `❌ ${err.message}` : `❌ Network error: ${err.message}`;
      setUrlResult({ ok: false, message: msg });
      toast.error(err.message || 'Import failed');
    } finally {
      setUrlImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
    setUploadResult(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadResult(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const endpoint = embedded ? '/api/import/file?persist=false' : '/api/import/file';
      const response = await authFetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        if (embedded && onApplyContent) {
          if (stage && data.stage && data.stage !== stage) {
            const errStageMsg = `Cannot apply a ${data.stage} document to a ${stage} document`;
            toast.error(errStageMsg);
            throw new Error(errStageMsg);
          }
          const fullDoc = data.document || data;
          const contentDoc = fullDoc?.catalog || fullDoc?.profile || fullDoc?.['component-definition'] || fullDoc?.['system-security-plan'] || fullDoc;
          await onApplyContent(contentDoc);
          toast.success(`Content from file applied to current document`);
        }

        const msg = getDocumentResultMessage(data, embedded);
        setUploadResult({
          ok: true,
          message: msg,
          status: data.status,
          action: data.action,
          version: data.version,
          existing_version: data.existing_version,
          same_title_existing: data.same_title_existing,
        });
        if (!embedded) {
          notifyImportSuccess(data, data.title);
        }
        if (!embedded && onImported) onImported(data.stage);
      } else {
        setUploadResult({ ok: false, message: `❌ ${data.detail || 'Import failed'}` });
        toast.error(data.detail || 'Import failed');
      }
    } catch (err: any) {
      const isApiErr = err?.name === 'ApiError';
      const msg = isApiErr ? `❌ ${err.message}` : `❌ Network error: ${err.message}`;
      setUploadResult({ ok: false, message: msg });
      toast.error(err.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const modalTitle = title || (stage === 'catalogs' || stage === 'catalog' ? '📥 Import Catalog' : '📥 Import OSCAL Document');
  const embeddedTitle = title || '📥 Load Template / Content';
  const embeddedSubtitle = subtitle || 'An OSCAL Catalog represents a single control source. Applying a template, URL, or file will replace the current catalog content with that single control baseline while preserving its UUID and title.';

  const content = (
    <div
      className={
        embedded
          ? styles['import-panel-embedded']
          : [styles['editor-panel'], styles['import-panel'], 'editor-panel'].filter(Boolean).join(' ')
      }
    >
      {embedded ? (
        <div className={styles['import-header-embedded']}>
          <h3>{embeddedTitle}</h3>
          <p>{embeddedSubtitle}</p>
        </div>
      ) : (
        <div className={`${styles['editor-header']} editor-header`}>
          <h3>{modalTitle}</h3>
          {onClose && (
            <button
              type="button"
              className={sharedStyles['btn-icon']}
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className={styles['import-tabs']}>
        <button
          type="button"
          className={`${styles['import-tab']} ${tab === 'registry' ? styles['active'] : ''}`}
          onClick={() => setTab('registry')}
        >
          📚 Registry
        </button>
        <button
          type="button"
          className={`${styles['import-tab']} ${tab === 'url' ? styles['active'] : ''}`}
          onClick={() => setTab('url')}
        >
          🔗 Import from URL
        </button>
        <button
          type="button"
          className={`${styles['import-tab']} ${tab === 'upload' ? styles['active'] : ''}`}
          onClick={() => setTab('upload')}
        >
          📤 Upload File
        </button>
      </div>

      {tab === 'registry' && (
        <div className={styles['import-registry']}>
          <div className={styles['import-filters']}>
            <div className={styles['search-wrapper']}>
              <span className={styles['search-icon']}>🔍</span>
              <input
                type="text"
                className={`form-input ${styles['search-input-with-icon']}`}
                placeholder="Search by title or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className={styles['search-clear-btn']}
                  onClick={() => setSearch('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {(!stage || stage === 'dashboard') && modelTypes.length > 2 && (
              <div className={styles['filter-chips']}>
                {modelTypes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`${styles['chip']} ${filter === m ? styles['active'] : ''}`}
                    onClick={() => setFilter(m)}
                  >
                    {m === 'all' ? 'All Models' : `${MODEL_ICONS[m] || ''} ${m}`}
                  </button>
                ))}
              </div>
            )}

            {sourceTypes.length > 2 && (
              <div className={styles['filter-chips']}>
                {sourceTypes.map((s) => {
                  const srcMeta = SOURCE_LABELS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`${styles['chip']} ${sourceFilter === s ? styles['active'] : ''}`}
                      onClick={() => setSourceFilter(s)}
                    >
                      {s === 'all' ? 'All Sources' : (srcMeta?.label || s.toUpperCase())}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles['registry-list']}>
            {loading ? (
              <div className={sharedStyles['loading-indicator']}>
                <span className={sharedStyles['spinner']} /> Loading registry…
              </div>
            ) : filtered.length === 0 ? (
              <div className={sharedStyles['empty-state']}>
                <p>No documents match your filter.</p>
              </div>
            ) : (
              filtered.map((entry) => {
                const result = results[entry.id];
                const isImporting = importing === entry.id;
                const src = SOURCE_LABELS[entry.source] || {
                  label: entry.source,
                  color: '#58a6ff',
                  bg: 'rgba(56, 139, 253, 0.15)',
                  border: 'rgba(56, 139, 253, 0.3)'
                };

                const isCurrentSource = embedded && currentDocument && (
                  (currentDocument.metadata?.title && entry.title && currentDocument.metadata.title.toLowerCase().includes(entry.title.toLowerCase())) ||
                  (entry.title && currentDocument.metadata?.title && entry.title.toLowerCase().includes(currentDocument.metadata.title.toLowerCase()))
                );

                return (
                  <div key={entry.id} className={styles['registry-entry']}>
                    <div className={styles['registry-entry-icon']}>
                      {MODEL_ICONS[entry.model] || '📄'}
                    </div>
                    <div className={styles['registry-entry-body']}>
                      <div className={styles['registry-entry-title']}>
                        {entry.title}
                        <span
                          className={styles['source-badge']}
                          style={{ backgroundColor: src.bg, color: src.color, borderColor: src.border }}
                        >
                          {src.label}
                        </span>
                        {!embedded && entry.is_imported && (
                          <span
                            className={styles['source-badge']}
                            style={{ backgroundColor: 'rgba(46, 160, 67, 0.15)', color: '#3fb950', borderColor: 'rgba(46, 160, 67, 0.3)', marginLeft: '6px' }}
                          >
                            ✓ In Workspace{entry.workspace_version ? ` (v${entry.workspace_version})` : ''}
                          </span>
                        )}
                        {isCurrentSource && (
                          <span
                            className={styles['source-badge']}
                            style={{ backgroundColor: 'rgba(56, 139, 253, 0.15)', color: '#58a6ff', borderColor: 'rgba(56, 139, 253, 0.3)', marginLeft: '6px' }}
                          >
                            ✓ Current Baseline
                          </span>
                        )}
                      </div>
                      <div className={styles['registry-entry-desc']}>{entry.description}</div>
                      {result && (
                        <div
                          className={`${styles['registry-result']} ${getResultClass(result, true)}`}
                        >
                          {result.message}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`${styles['btn-import']} ${result?.ok ? styles['imported'] : ''}`}
                      onClick={() => handleImport(entry)}
                      disabled={isImporting}
                      title={entry.url}
                    >
                      {isImporting ? (
                        <span className={styles['spinner-sm']} />
                      ) : result?.ok ? (
                        result.status === 'already_exists'
                          ? '✓ Up to date'
                          : result.status === 'updated'
                          ? '✓ Updated'
                          : '✓ Imported'
                      ) : embedded ? (
                        isCurrentSource ? '🔄 Re-Apply' : '📥 Apply Content'
                      ) : entry.is_imported ? (
                        '🔄 Re-import'
                      ) : (
                        'Import'
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'url' && (
        <div className={styles['import-tab-body']}>
          <div className="form-group">
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Document URL</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://raw.githubusercontent.com/…/catalog.json"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
            />
            <p className={styles['field-hint']}>
              Paste any raw URL to a valid OSCAL JSON or YAML document. The stage will be auto-detected from the root key.
            </p>
          </div>

          {(() => {
            const presets = getStagePresets(stage);
            return (
              <div className="form-group" style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                  {presets.title}
                </label>
                <div className={styles['preset-grid']}>
                  {presets.items.map((ex: any) => (
                    <button
                      key={ex.url}
                      className={styles['preset-card']}
                      onClick={() => setUrlInput(ex.url)}
                      type="button"
                    >
                      <div className={styles['preset-card-title']}>
                        <span>{presets.icon}</span> {ex.label}
                      </div>
                      {ex.desc && <div className={styles['preset-card-desc']}>{ex.desc}</div>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {urlResult && (
            <div
              className={`${styles['validation-result']} ${getResultClass(urlResult, false)}`}
              style={{ marginTop: '4px' }}
            >
              {urlResult.message}
            </div>
          )}

          {embedded && (
            <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className={sharedStyles['btn-primary']}
                onClick={handleUrlImport}
                disabled={urlImporting || !urlInput.trim()}
              >
                {urlImporting ? 'Importing…' : '📥 Load & Apply Content'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <div className={styles['import-tab-body']}>
          <div className="form-group">
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Select or Drop OSCAL File</label>
            <div
              className={`${styles['upload-dropzone']} ${isDragActive ? styles['drag-active'] : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={styles['upload-dropzone-icon']}>📤</div>
              <div className={styles['upload-dropzone-title']}>Click to browse or drop file here</div>
              <div className={styles['upload-dropzone-desc']}>Supports JSON, YAML, and XML official NIST OSCAL formats</div>
              <div className={styles['upload-format-chips']}>
                <span className={styles['format-chip']}>.json</span>
                <span className={styles['format-chip']}>.yaml</span>
                <span className={styles['format-chip']}>.yml</span>
                <span className={styles['format-chip']}>.xml</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".json,.yaml,.yml,.xml"
              onChange={handleFileChange}
            />
          </div>

          {selectedFile && (
            <div className={styles['selected-file-card']}>
              <div className={styles['selected-file-info']}>
                <span className={styles['selected-file-icon']}>📄</span>
                <div>
                  <div className={styles['selected-file-name']}>{selectedFile.name}</div>
                  <div className={styles['selected-file-size']}>{formatFileSize(selectedFile.size)}</div>
                </div>
              </div>
              <button
                type="button"
                className={sharedStyles['btn-soft-delete']}
                onClick={() => setSelectedFile(null)}
                title="Remove file"
              >
                ✕
              </button>
            </div>
          )}

          {uploadResult && (
            <div
              className={`${styles['validation-result']} ${getResultClass(uploadResult, false)}`}
              style={{ marginTop: '4px' }}
            >
              {uploadResult.message}
            </div>
          )}

          {embedded && (
            <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className={sharedStyles['btn-primary']}
                onClick={handleFileUpload}
                disabled={uploading || !selectedFile}
              >
                {uploading ? 'Uploading…' : '📤 Upload & Apply Content'}
              </button>
            </div>
          )}
        </div>
      )}

      {!embedded && (
        <div className={`${styles['editor-footer']} editor-footer`}>
          {onClose && (
            <button type="button" className={sharedStyles['btn-secondary']} onClick={onClose}>
              Close
            </button>
          )}
          {tab === 'url' && (
            <button
              type="button"
              className={sharedStyles['btn-primary']}
              onClick={handleUrlImport}
              disabled={urlImporting || !urlInput.trim()}
            >
              {urlImporting ? 'Importing…' : '📥 Import'}
            </button>
          )}
          {tab === 'upload' && (
            <button
              type="button"
              className={sharedStyles['btn-primary']}
              onClick={handleFileUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading…' : '📤 Upload'}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      className={`${styles['editor-overlay']} editor-overlay`}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
    >
      {content}
    </div>
  );
}

