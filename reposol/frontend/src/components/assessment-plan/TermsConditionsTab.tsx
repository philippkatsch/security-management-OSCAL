import React, { useState } from 'react';
import { AssessmentPlan, TermsPart, TermsPartNameEnum, Resource } from '../../lib/types/oscal';
import { DocumentAction } from '../../lib/document-actions/types';
import {
  addTermsPart,
  updateTermsPart,
  removeTermsPart,
  addResourceAttachment,
  removeResourceAttachment
} from '../../lib/document-actions/assessment-plan-actions';
import { generateUUID } from '../../lib/oscal-utils';

export interface TermsConditionsTabProps {
  document: AssessmentPlan;
  dispatch: (action: DocumentAction) => void;
  isEditing: boolean;
}

const CANONICAL_TERMS_PARTS: Array<{ name: TermsPartNameEnum; label: string; description: string }> = [
  { name: 'rules-of-engagement', label: 'Rules of Engagement', description: 'Testing authorization, testing hours, escalation contacts, operational boundaries' },
  { name: 'disclosures', label: 'Vulnerability Disclosures', description: 'Coordinated vulnerability disclosure rules, reporting timelines, and embargo periods' },
  { name: 'assessment-inclusions', label: 'Assessment Inclusions', description: 'Mandatory testing depths, required scope perimeters, and target inclusions' },
  { name: 'assessment-exclusions', label: 'Assessment Exclusions', description: 'Prohibited actions (e.g. DoS attacks, physical penetration, production disruption)' },
  { name: 'results-delivery', label: 'Results Delivery', description: 'Report formatting, delivery mechanisms, encryption, and recipient distribution' },
  { name: 'assumptions', label: 'Operational Assumptions', description: 'Assumed system availability, test account credentials, and pre-requisite conditions' },
  { name: 'methodology', label: 'Assessment Methodology', description: 'Standard audit framework citations (e.g. NIST SP 800-53A, FedRAMP SAP Guidelines)' },
];

export const TermsConditionsTab: React.FC<TermsConditionsTabProps> = ({
  document: ap,
  dispatch,
  isEditing,
}) => {
  const terms = ap?.['terms-and-conditions'] || { parts: [] };
  const parts: TermsPart[] = (terms.parts || []) as TermsPart[];
  const backMatter = ap?.['back-matter'] || { resources: [] };
  const resources: Resource[] = backMatter.resources || [];

  const [activeSection, setActiveSection] = useState<'terms' | 'attachments'>('terms');

  // New terms part form
  const [selectedPartName, setSelectedPartName] = useState<TermsPartNameEnum>('rules-of-engagement');
  const [newPartTitle, setNewPartTitle] = useState('');
  const [newPartProse, setNewPartProse] = useState('');

  // Attachment upload loading
  const [uploading, setUploading] = useState(false);

  const handleAddPart = () => {
    const defaultMeta = CANONICAL_TERMS_PARTS.find((p) => p.name === selectedPartName);
    dispatch(
      addTermsPart({
        uuid: generateUUID(),
        name: selectedPartName,
        title: newPartTitle.trim() || defaultMeta?.label || 'Rules of Engagement',
        prose: newPartProse.trim(),
      })
    );
    setNewPartProse('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // Strip data URL prefix to store pure Base64 value: e.g. "data:application/pdf;base64,..."
      const base64Value = dataUrl ? dataUrl.split(',')[1] || dataUrl : '';
      const resUuid = generateUUID();

      const newResource: Resource = {
        uuid: resUuid,
        title: file.name,
        description: `Attached artifact: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        rlinks: [
          {
            href: `#${resUuid}`,
            'media-type': file.type || 'application/octet-stream',
          },
        ],
        base64: {
          filename: file.name,
          'media-type': file.type || 'application/octet-stream',
          value: base64Value,
        },
      };

      dispatch(addResourceAttachment(newResource));
      setUploading(false);
      // Reset input
      e.target.value = '';
    };

    reader.onerror = () => {
      console.error('File reading failed');
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDownloadAttachment = (res: Resource) => {
    if (!res.base64?.value) return;
    const mediaType = res.base64['media-type'] || 'application/octet-stream';
    const filename = res.base64.filename || res.title || 'attachment';
    const dataUrl = `data:${mediaType};base64,${res.base64.value}`;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top Toggle */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1.5">
        <button
          type="button"
          onClick={() => setActiveSection('terms')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            activeSection === 'terms'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📜 Terms & Conditions ({parts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('attachments')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            activeSection === 'attachments'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📎 Back-Matter Evidence & Attachments ({resources.length})
        </button>
      </div>

      {activeSection === 'terms' ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>📜</span> Terms & Conditions (7 Canonical OSCAL Parts)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Defines legal boundaries, testing authorization, disclosure policies, and methodology references.
              </p>
            </div>

            {/* Existing Terms Parts List */}
            {parts.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-500">
                No terms & conditions parts defined. Select a canonical category below to add.
              </div>
            ) : (
              <div className="space-y-4">
                {parts.map((part, idx) => (
                  <div
                    key={part.uuid || idx}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-950 border border-blue-800 px-2 py-0.5 font-mono text-xs font-bold uppercase text-blue-300">
                          {part.name}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={part.title || ''}
                            onChange={(e) => dispatch(updateTermsPart(idx, { title: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 font-semibold focus:border-blue-500 focus:outline-none"
                          />
                        ) : (
                          <span className="font-semibold text-slate-100 text-sm">{part.title}</span>
                        )}
                      </div>

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => dispatch(removeTermsPart(idx))}
                          className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                          title="Remove Clause"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <textarea
                        rows={3}
                        value={part.prose || ''}
                        onChange={(e) => dispatch(updateTermsPart(idx, { prose: e.target.value }))}
                        placeholder="Clause details, markdown formatting, or testing parameters..."
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none font-sans"
                      />
                    ) : (
                      <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{part.prose}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Terms Part Form */}
            {isEditing && (
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-300">Add Canonical Terms & Conditions Clause:</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Canonical Part Type</label>
                    <select
                      value={selectedPartName}
                      onChange={(e) => {
                        const nextName = e.target.value as TermsPartNameEnum;
                        setSelectedPartName(nextName);
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                    >
                      {CANONICAL_TERMS_PARTS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.label} ({p.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Clause Title</label>
                    <input
                      type="text"
                      placeholder={CANONICAL_TERMS_PARTS.find((p) => p.name === selectedPartName)?.label || 'Rules of Engagement'}
                      value={newPartTitle}
                      onChange={(e) => setNewPartTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Clause Prose / Text</label>
                  <textarea
                    rows={3}
                    placeholder="Enter clause provisions, operational boundaries, or rules..."
                    value={newPartProse}
                    onChange={(e) => setNewPartProse(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddPart}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    + Add Terms Clause
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Back-Matter Base64 Resource Attachments (DD-007) */
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>📎</span> Back-Matter Resource Attachments (Embedded Base64)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Embed signed Rules of Engagement PDFs, test scripts, or scan artifacts directly in <code>back-matter.resources[]</code>.
                </p>
              </div>

              {isEditing && (
                <div>
                  <label className="cursor-pointer rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 inline-flex items-center gap-1.5 shadow">
                    <span>⬆️</span> Upload & Embed File
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
              )}
            </div>

            {uploading && (
              <div className="rounded-lg bg-blue-950/40 p-3 text-center text-xs text-blue-300 animate-pulse border border-blue-900">
                Encoding file to Base64 and embedding into document...
              </div>
            )}

            {resources.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-500">
                No embedded back-matter resource attachments present in document.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resources.map((res) => (
                  <div
                    key={res.uuid}
                    className="flex items-start justify-between rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-2"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-100 text-sm flex items-center gap-1.5">
                        <span>📄</span>
                        <span>{res.title || 'Attachment'}</span>
                      </div>
                      {res.description && <p className="text-slate-400 text-xs">{res.description}</p>}
                      <div className="text-[10px] text-slate-500 font-mono">
                        URI: <code>#{res.uuid}</code> • Type: {res.base64?.['media-type'] || 'binary'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {res.base64?.value && (
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(res)}
                          className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
                        >
                          ⬇️ Download
                        </button>
                      )}
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => dispatch(removeResourceAttachment(res.uuid))}
                          className="rounded p-1 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                          title="Delete Attachment"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
