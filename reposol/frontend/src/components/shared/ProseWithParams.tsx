import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import styles from './SharedComponents.module.css';

/**
 * Calculates the caret coordinates (left, top) relative to the parent relative container.
 */
function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number) {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.font = style.font;
  mirror.style.width = textarea.clientWidth + 'px';
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.lineHeight = style.lineHeight;
  
  const text = textarea.value.substring(0, position);
  mirror.textContent = text;
  
  const span = document.createElement('span');
  span.textContent = textarea.value.substring(position) || '.';
  mirror.appendChild(span);
  
  textarea.parentElement?.appendChild(mirror);
  
  const spanRect = span.getBoundingClientRect();
  const parentRect = textarea.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
  
  textarea.parentElement?.removeChild(mirror);
  
  let lineHeight = parseInt(style.lineHeight);
  if (isNaN(lineHeight)) {
    lineHeight = parseInt(style.fontSize) * 1.2 || 18;
  }
  
  return {
    left: spanRect.left - parentRect.left,
    top: spanRect.top - parentRect.top + lineHeight
  };
}

interface ProseWithParamsProps {
  value?: string;
  onChange: (val: string) => void;
  params?: any[];
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties & { minHeight?: string };
  autoFocus?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onDefineNewParam?: () => void;
}

/**
 * Textarea wrapper with parameter selection popover at the caret position.
 */
export const ProseWithParams = forwardRef(({
  value = '',
  onChange,
  params = [],
  placeholder = '',
  rows = 3,
  disabled = false,
  className = '',
  style = {},
  autoFocus = false,
  onBlur = undefined,
  onDefineNewParam = undefined
}: ProseWithParamsProps, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [caretCoords, setCaretCoords] = useState({ left: 0, top: 0 });
  const [triggerIndex, setTriggerIndex] = useState<number | null>(null);
  const [matchLength, setMatchLength] = useState<number | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleSelectionChangeOrClick = (e: React.SyntheticEvent) => {
    const textarea = e.target as HTMLTextAreaElement;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    
    // Check if cursor is inside a parameter placeholder: {{ insert: param, <id> }}
    const regex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;
    let match;
    let found = false;
    
    while ((match = regex.exec(text)) !== null) {
      const startIdx = match.index;
      const endIdx = match.index + match[0].length;
      
      if (cursorPos >= startIdx && cursorPos <= endIdx) {
        found = true;
        setTriggerIndex(startIdx);
        setMatchLength(match[0].length);
        
        // Calculate coords
        const coords = getCaretCoordinates(textarea, startIdx);
        setCaretCoords(coords);
        setShowDropdown(true);
        break;
      }
    }
    
    if (!found && showDropdown) {
      setShowDropdown(false);
    }
  };

  const handleSelectParam = (paramId: string) => {
    if (triggerIndex !== null && matchLength !== null) {
      const before = value.substring(0, triggerIndex);
      const after = value.substring(triggerIndex + matchLength);
      const newValue = `${before}{{ insert: param, ${paramId} }}${after}`;
      onChange(newValue);
      setShowDropdown(false);
      
      // Return focus to textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = triggerIndex + `{{ insert: param, ${paramId} }}`.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  useImperativeHandle(ref, () => ({
    insertParamPlaceholder: () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      // Default to first parameter ID or 'SELECT_PARAM'
      const firstParamId = params[0]?.id || 'SELECT_PARAM';
      const insertText = `{{ insert: param, ${firstParamId} }}`;

      const newValue = 
        value.substring(0, startPos) + 
        insertText + 
        value.substring(endPos);

      onChange(newValue);

      // Focus and select the parameter ID part so selection triggers dropdown
      setTimeout(() => {
        textarea.focus();
        const selectStart = startPos + `{{ insert: param, `.length;
        const selectEnd = selectStart + firstParamId.length;
        textarea.setSelectionRange(selectStart, selectEnd);
        
        // Calculate coords and open dropdown
        const coords = getCaretCoordinates(textarea, startPos);
        setCaretCoords(coords);
        setTriggerIndex(startPos);
        setMatchLength(insertText.length);
        setShowDropdown(true);
      }, 50);
    }
  }));

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    flex: style.flex !== undefined ? style.flex : '1 1 auto',
    width: style.width || '100%',
    maxWidth: style.maxWidth
  };

  const { flex, width, maxWidth, minHeight, ...restStyle } = style;

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: minHeight || '80px',
    overflow: 'hidden',
    ...restStyle
  };

  // Close dropdown if user clicks outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (showDropdown && textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        // Check if click was inside dropdown
        const dropdown = document.querySelector('.caret-param-dropdown');
        if (dropdown && !dropdown.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showDropdown]);

  return (
    <div className={styles['prose-param-container']} style={wrapperStyle}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
          onChange(e.target.value);
        }}
        onClick={handleSelectionChangeOrClick}
        onKeyUp={handleSelectionChangeOrClick}
        onFocus={handleSelectionChangeOrClick}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`form-input prose-textarea ${className}`}
        style={textareaStyle}
        autoFocus={autoFocus}
        onBlur={onBlur}
      />
      
      {!disabled && showDropdown && (
        <div
          className="dropdown-menu shadow-lg caret-param-dropdown"
          style={{
            position: 'absolute',
            left: `${caretCoords.left}px`,
            top: `${caretCoords.top}px`,
            zIndex: 100,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '4px 0',
            minWidth: '200px',
            textAlign: 'left'
          }}
        >
          {params.length > 0 ? (() => {
            const grouped = params.reduce((acc, p) => {
              const scope = p.scope || 'control';
              const label = p.scopeLabel || 'Control Parameters';
              if (!acc[scope]) {
                acc[scope] = { label, items: [] };
              }
              acc[scope].items.push(p);
              return acc;
            }, {});
            const knownScopes = ['catalog', 'group', 'control', 'profile'];
            const scopesOrder = Array.from(new Set([...knownScopes, ...Object.keys(grouped)]));
            let renderedScopesCount = 0;
            
            return scopesOrder.map((scope) => {
              const grp = grouped[scope];
              if (!grp || grp.items.length === 0) return null;
              const sIdx = renderedScopesCount;
              renderedScopesCount++;
              return (
                <div key={scope}>
                  <div style={{
                    padding: '4px 12px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    background: 'var(--color-surface-3)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    borderTop: sIdx > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                    letterSpacing: '0.5px'
                  }}>
                    {grp.label}
                  </div>
                  {grp.items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleSelectParam(p.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '6px 12px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--color-text)',
                        fontSize: '12px',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-surface-3)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <strong>{p.id}</strong> {p.label ? `— ${p.label}` : ''}
                    </button>
                  ))}
                </div>
              );
            });
          })() : (
            <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No parameters defined.
            </div>
          )}
          
          {onDefineNewParam && (
            <>
              <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }} />
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowDropdown(false);
                  onDefineNewParam();
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 12px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--color-accent-hover)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-surface-3)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
              >
                ➕ Define New Parameter...
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});

ProseWithParams.displayName = 'ProseWithParams';

