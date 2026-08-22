import React, { useEffect, useRef, useState } from 'react';
import styles from './ExportModal.module.css';
import { getWorkspaceId } from '@lib/api';
import { toast } from 'react-hot-toast';

export type ExportFormat = 'json' | 'yaml' | 'xml';

export interface ExportModalProps {
  isOpen: boolean;
  docId: string | null;
  docTitle?: string;
  stage: string;
  onClose: () => void;
}

export function ExportModal({
  isOpen,
  docId,
  docTitle,
  stage,
  onClose,
}: ExportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = (e: React.MouseEvent | React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  const handleExport = () => {
    if (!docId) {
      toast.error('No document selected for export');
      onClose();
      return;
    }

    try {
      const wsId = getWorkspaceId();
      const exportUrl = `/api/export/${stage}/${docId}?format=${selectedFormat}&w=${encodeURIComponent(wsId)}`;
      window.open(exportUrl, '_blank');
      toast.success(`Exporting as ${selectedFormat.toUpperCase()}...`);
      onClose();
    } catch (err: any) {
      toast.error(`Export failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      open={isOpen}
      onCancel={handleCancel}
      data-testid="export-modal"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>Export OSCAL Document</h3>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className={styles.subtitle}>
          {docTitle ? `Select format to export "${docTitle}"` : 'Select preferred export format'}
        </p>

        <div className={styles.formatList}>
          <label
            className={`${styles.formatOption} ${selectedFormat === 'json' ? styles.formatOptionSelected : ''}`}
            onClick={() => setSelectedFormat('json')}
          >
            <input
              type="radio"
              name="exportFormat"
              value="json"
              checked={selectedFormat === 'json'}
              onChange={() => setSelectedFormat('json')}
              className={styles.radioInput}
              data-testid="export-format-json"
            />
            <div className={styles.formatDetails}>
              <span className={styles.formatName}>JSON (.json)</span>
              <span className={styles.formatDesc}>Standard NIST OSCAL JSON data structure</span>
            </div>
          </label>

          <label
            className={`${styles.formatOption} ${selectedFormat === 'yaml' ? styles.formatOptionSelected : ''}`}
            onClick={() => setSelectedFormat('yaml')}
          >
            <input
              type="radio"
              name="exportFormat"
              value="yaml"
              checked={selectedFormat === 'yaml'}
              onChange={() => setSelectedFormat('yaml')}
              className={styles.radioInput}
              data-testid="export-format-yaml"
            />
            <div className={styles.formatDetails}>
              <span className={styles.formatName}>YAML (.yaml)</span>
              <span className={styles.formatDesc}>Human-readable YAML representation</span>
            </div>
          </label>

          <label
            className={`${styles.formatOption} ${selectedFormat === 'xml' ? styles.formatOptionSelected : ''}`}
            onClick={() => setSelectedFormat('xml')}
          >
            <input
              type="radio"
              name="exportFormat"
              value="xml"
              checked={selectedFormat === 'xml'}
              onChange={() => setSelectedFormat('xml')}
              className={styles.radioInput}
              data-testid="export-format-xml"
            />
            <div className={styles.formatDetails}>
              <span className={styles.formatName}>XML (.xml)</span>
              <span className={styles.formatDesc}>Schema-compliant OSCAL XML document</span>
            </div>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleExport}
            data-testid="export-confirm-btn"
          >
            Export
          </button>
        </div>
      </div>
    </dialog>
  );
}
