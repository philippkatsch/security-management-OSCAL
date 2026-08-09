import React, { useState, useRef, useEffect } from 'react';
import { getValidTransitions, isTerminal } from '../../../lib/status-machine';
import StatusBadge from './StatusBadge';
import './Lifecycle.css';

const DESCRIPTIONS = {
  'draft': 'Working copy, freely editable',
  'active': 'Published and active',
  'archived': 'Archived and read-only',
  'superseded': 'Replaced by a newer document'
};

export default function LifecycleSelector({ currentStatus, onStatusChange, documentTitle }) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(null);
  const [successorUuid, setSuccessorUuid] = useState('');
  const dropdownRef = useRef(null);

  const validTransitions = getValidTransitions(currentStatus);
  const disabled = isTerminal(currentStatus);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setConfirmingStatus(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (status) => {
    setConfirmingStatus(status);
    setSuccessorUuid('');
  };

  const handleConfirm = () => {
    onStatusChange(confirmingStatus, successorUuid);
    setIsOpen(false);
    setConfirmingStatus(null);
  };

  return (
    <div className="lifecycle-selector-container" ref={dropdownRef}>
      <button 
        className={`lifecycle-selector-toggle ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <StatusBadge status={currentStatus} />
        {!disabled && <span className="lifecycle-selector-arrow">▼</span>}
      </button>

      {isOpen && (
        <div className="lifecycle-selector-dropdown">
          <div className="lifecycle-selector-header">Document Status</div>
          
          {confirmingStatus ? (
            <div className="lifecycle-selector-confirm">
              <p>Are you sure you want to change status from <strong>{currentStatus}</strong> to <strong>{confirmingStatus}</strong>?</p>
              
              {confirmingStatus === 'superseded' && (
                <div className="lifecycle-selector-input-group">
                  <label>Successor UUID or Title:</label>
                  <input 
                    type="text" 
                    value={successorUuid} 
                    onChange={(e) => setSuccessorUuid(e.target.value)} 
                    placeholder="Enter successor UUID..."
                    autoFocus
                  />
                </div>
              )}
              
              <div className="lifecycle-selector-confirm-actions">
                <button className="btn btn-text" onClick={() => setConfirmingStatus(null)}>Cancel</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleConfirm}
                  disabled={confirmingStatus === 'superseded' && !successorUuid}
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <ul className="lifecycle-selector-list">
              {['draft', 'active', 'archived', 'superseded'].map(status => {
                const isValid = validTransitions.includes(status);
                const isCurrent = status === currentStatus;
                
                if (isCurrent) return null; // Don't show current status in dropdown options

                return (
                  <li 
                    key={status}
                    className={`lifecycle-selector-item ${isValid ? '' : 'disabled'}`}
                    onClick={() => isValid && handleSelect(status)}
                  >
                    <div className="lifecycle-selector-item-title">
                      <StatusBadge status={status} variant="dot" size="md" />
                    </div>
                    <span className="lifecycle-selector-desc">{DESCRIPTIONS[status]}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
