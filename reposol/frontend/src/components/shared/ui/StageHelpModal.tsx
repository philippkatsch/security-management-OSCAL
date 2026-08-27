import React, { useEffect, useCallback } from 'react';
import {
  OscalStageId,
  getStageGuide,
  OSCAL_STAGE_GUIDES
} from '@components/knowledge-base/data/kbStageData';
import styles from './StageHelpModal.module.css';

export interface StageHelpModalProps {
  isOpen: boolean;
  stage: string;
  onClose: () => void;
}

const STAGE_MAP: Record<string, OscalStageId> = {
  catalogs: 'catalogs',
  catalog: 'catalogs',
  profiles: 'profiles',
  profile: 'profiles',
  'component-definitions': 'component-definitions',
  'component-definition': 'component-definitions',
  components: 'component-definitions',
  ssps: 'ssps',
  ssp: 'ssps',
  'system-security-plans': 'ssps',
  'assessment-plans': 'assessment-plans',
  'assessment-plan': 'assessment-plans',
  ap: 'assessment-plans',
  'assessment-results': 'assessment-results',
  ar: 'assessment-results',
  poams: 'poams',
  poam: 'poams',
  'control-mappings': 'control-mappings',
  mappings: 'control-mappings',
  mapping: 'control-mappings'
};

export const StageHelpModal: React.FC<StageHelpModalProps> = ({
  isOpen,
  stage,
  onClose
}) => {
  const safeStageId = STAGE_MAP[stage.toLowerCase()] || 'catalogs';
  const guide = getStageGuide(safeStageId) || OSCAL_STAGE_GUIDES[0];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className={styles['modal-overlay']}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-help-title"
      data-testid="stage-help-modal"
    >
      <div
        className={styles['modal-dialog']}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles['modal-header']}>
          <div className={styles['header-left']}>
            <div className={styles['stage-icon-box']}>
              <span>{guide.icon}</span>
            </div>
            <div className={styles['header-info']}>
              <div className={styles['header-badges']}>
                <span className={styles['stage-badge']}>{guide.badgeLabel}</span>
                <span className={styles['category-badge']}>{guide.category}</span>
              </div>
              <h2 id="stage-help-title" className={styles['modal-title']}>
                {guide.title}
              </h2>
              <p className={styles['modal-tagline']}>{guide.tagline}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles['close-btn']}
            onClick={onClose}
            aria-label="Close guide modal"
            title="Close guide"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className={styles['modal-body']}>
          {/* Section 1: Foundational Purpose */}
          <section className={styles['guide-section']}>
            <h3 className={styles['section-title']}>
              <span>💡</span>
              <span>Why does this Stage exist?</span>
            </h3>

            <div className={styles['purpose-card']}>
              <p className={styles['purpose-text']}>{guide.whyItExists.overview}</p>

              <div className={styles['meta-grid']}>
                <div className={styles['meta-box']}>
                  <span className={styles['meta-box-title']}>👥 Who creates it?</span>
                  <p className={styles['meta-box-text']}>{guide.whyItExists.whoCreatesIt}</p>
                </div>

                <div className={styles['meta-box']}>
                  <span className={styles['meta-box-title']}>🔄 Downstream Reuse</span>
                  <p className={styles['meta-box-text']}>{guide.whyItExists.howItIsReused}</p>
                </div>
              </div>

              <div className={styles['examples-row']}>
                <span className={styles['examples-label']}>Standard Real-World Examples:</span>
                <div className={styles['examples-tags']}>
                  {guide.whyItExists.realWorldExamples.map((ex, idx) => (
                    <span key={idx} className={styles['example-tag']}>
                      📜 {ex}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Workflow & Sequence */}
          <section className={styles['guide-section']}>
            <h3 className={styles['section-title']}>
              <span>🧭</span>
              <span>Lifecycle Workflow & Sequence</span>
            </h3>

            <div className={styles['workflow-grid']}>
              <div className={styles['workflow-box']}>
                <div className={styles['workflow-box-header']}>
                  <span>🚀</span>
                  <span>Where to start?</span>
                </div>
                <p>{guide.workflowSequence.startHereAdvice}</p>
              </div>

              <div className={styles['workflow-box']}>
                <div className={styles['workflow-box-header']}>
                  <span>📥</span>
                  <span>Prerequisites</span>
                </div>
                <p>{guide.workflowSequence.prerequisites}</p>
              </div>

              <div className={styles['workflow-box']}>
                <div className={styles['workflow-box-header']}>
                  <span>📦</span>
                  <span>What you produce</span>
                </div>
                <p>{guide.workflowSequence.whatYouProduce}</p>
              </div>
            </div>
          </section>

          {/* Section 3: Key Steps & Activities */}
          <section className={styles['guide-section']}>
            <h3 className={styles['section-title']}>
              <span>📋</span>
              <span>Key Activities & Steps in this Stage</span>
            </h3>

            <div className={styles['phases-container']}>
              {guide.keyPhases.map((phase) => (
                <div key={phase.phaseNumber} className={styles['phase-item']}>
                  <div className={styles['phase-item-header']}>
                    <div>
                      <span className={styles['phase-num']}>Step {phase.phaseNumber}: </span>
                      <strong className={styles['phase-title']}>{phase.title}</strong>
                    </div>
                    <span className={styles['phase-subtitle']}>{phase.subtitle}</span>
                  </div>
                  <p className={styles['meta-box-text']}>{phase.description}</p>
                  <ul className={styles['phase-activities']}>
                    {phase.whatYouDo.map((item, idx) => (
                      <li key={idx}>
                        <span className={styles['bullet']}>✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: What you can do in Reposol */}
          <section className={styles['guide-section']}>
            <h3 className={styles['section-title']}>
              <span>🛠️</span>
              <span>What can you do in Reposol?</span>
            </h3>

            <div className={styles['capabilities-grid']}>
              {guide.reposolCapabilities.map((feat, idx) => (
                <div key={idx} className={styles['capability-card']}>
                  <div className={styles['capability-header']}>
                    <span>{feat.icon}</span>
                    <span>{feat.title}</span>
                  </div>
                  <p className={styles['capability-desc']}>{feat.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className={styles['modal-footer']}>
          <button
            type="button"
            className={styles['got-it-btn']}
            onClick={onClose}
          >
            Got it, close guide
          </button>
        </div>
      </div>
    </div>
  );
};
export default StageHelpModal;
