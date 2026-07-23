import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

/**
 * Calculates the caret coordinates (left, top) relative to the parent relative container.
 */
function getCaretCoordinates(textarea, position) {
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
  
  textarea.parentElement.appendChild(mirror);
  
  const spanRect = span.getBoundingClientRect();
  const parentRect = textarea.parentElement.getBoundingClientRect();
  
  textarea.parentElement.removeChild(mirror);
  
  let lineHeight = parseInt(style.lineHeight);
  if (isNaN(lineHeight)) {
    lineHeight = parseInt(style.fontSize) * 1.2 || 18;
  }
  
  return {
    left: spanRect.left - parentRect.left,
    top: spanRect.top - parentRect.top + textarea.scrollTop + lineHeight
  };
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
  onBlur = null,
  onDefineNewParam = null
}, ref) => {
  const textareaRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [caretCoords, setCaretCoords] = useState({ left: 0, top: 0 });
  const [triggerIndex, setTriggerIndex] = useState(null);
  const [matchLength, setMatchLength] = useState(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleSelectionChangeOrClick = (e) => {
    const textarea = e.target;
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
        const coords = getCaretCoordinates(textarea, startIdx);
        setCaretCoords(coords);
        setTriggerIndex(startIdx);
        setMatchLength(match[0].length);
        setShowDropdown(true);
        break;
      }
    }
    
    if (!found) {
      setShowDropdown(false);
    }
  };

  const handleSelectParam = (paramId) => {
    const textarea = textareaRef.current;
    if (!textarea || triggerIndex === null || matchLength === null) return;

    const insertText = `{{ insert: param, ${paramId} }}`;
    const newValue = 
      value.substring(0, triggerIndex) + 
      insertText + 
      value.substring(triggerIndex + matchLength);

    onChange(newValue);
    setShowDropdown(false);

    // Refocus and place cursor at the end of the inserted parameter
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = triggerIndex + insertText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
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

  const wrapperStyle = {
    position: 'relative',
    flex: style.flex !== undefined ? style.flex : '1 1 auto',
    width: style.width || '100%',
    maxWidth: style.maxWidth
  };

  const { flex, width, maxWidth, minHeight, ...restStyle } = style;

  const textareaStyle = {
    width: '100%',
    minHeight: minHeight || '80px',
    overflow: 'hidden',
    ...restStyle
  };

  // Close dropdown if user clicks outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (showDropdown && textareaRef.current && !textareaRef.current.contains(e.target)) {
        // Check if click was inside dropdown
        const dropdown = document.querySelector('.caret-param-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
          setShowDropdown(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showDropdown]);

  return (
    <div className="prose-param-container" style={wrapperStyle}>
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
                      onMouseOver={(e) => e.target.style.background = 'var(--color-surface-3)'}
                      onMouseOut={(e) => e.target.style.background = 'none'}
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
                onMouseOver={(e) => e.target.style.background = 'var(--color-surface-3)'}
                onMouseOut={(e) => e.target.style.background = 'none'}
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

