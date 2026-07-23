import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Editor from '@monaco-editor/react';

/**
 * Performant JSON Code Editor with Monaco Editor virtualization.
 *
 * Automatically handles large documents (>200k lines) and highlights/scrolls
 * to the selected control or group ID.
 */
export const JsonEditor = forwardRef(({
  value = '',
  onChange,
  onValidate,
  readOnly = false,
  highlightId = null
}, ref) => {
  const [error, setError] = useState('');
  const editorRef = useRef(null);
  const scrolledForRef = useRef(null);
  const validationTimeoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (editorRef.current) {
        editorRef.current.getModel()?.undo();
      }
    },
    redo: () => {
      if (editorRef.current) {
        editorRef.current.getModel()?.redo();
      }
    }
  }));

  // Debounced JSON validation to avoid blocking the thread on large files
  const validateJson = (textToValidate) => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      try {
        if (!textToValidate.trim()) {
          setError('');
          return;
        }
        JSON.parse(textToValidate);
        setError('');
      } catch (err) {
        setError(`Invalid JSON: ${err.message}`);
      }
    }, 500); // 500ms debounce
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  // Helper to scroll and select the target ID line in Monaco
  const performScroll = (editor, id, textVal) => {
    if (!editor || !id || !textVal) return;

    // Only scroll once per highlightId and file content length combo
    const scrollKey = `${id}::${textVal.length}`;
    if (scrolledForRef.current === scrollKey) return;

    const model = editor.getModel();
    if (!model) return;

    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = model.findMatches(`"id"\\s*:\\s*"${escaped}"`, false, true, false, null, false);

    if (matches && matches.length > 0) {
      const match = matches[0];
      const lineNumber = match.range.startLineNumber;

      scrolledForRef.current = scrollKey;

      // Reveal the line in the center of the viewport
      editor.revealLineInCenter(lineNumber);
      
      // Set cursor position and selection
      editor.setPosition({ lineNumber, column: match.range.startColumn });
      editor.setSelection(match.range);
      
      // Focus the editor
      editor.focus();
    }
  };

  // Run scroll logic if the editor is already loaded and highlightId changes
  useEffect(() => {
    if (editorRef.current) {
      performScroll(editorRef.current, highlightId, value);
    }
  }, [highlightId, value]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure Monaco JSON options if needed
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false
    });

    // Run initial scroll
    performScroll(editor, highlightId, value);
  };

  const handleEditorChange = (newValue) => {
    onChange(newValue);
    validateJson(newValue);
  };

  return (
    <div
      className="json-editor-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '400px'
      }}
    >
      <div
        className="json-editor-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          borderTopLeftRadius: 'var(--radius-md)',
          borderTopRightRadius: 'var(--radius-md)'
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {onValidate && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onValidate(value)}
              style={{ 
                padding: '6px 14px', 
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Validate Schema
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          border: '1px solid var(--color-border)',
          borderBottomLeftRadius: 'var(--radius-md)',
          borderBottomRightRadius: 'var(--radius-md)',
          overflow: 'hidden',
          minHeight: '350px',
          background: 'var(--color-surface)'
        }}
      >
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          loading={<div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Loading editor...</div>}
          options={{
            readOnly: readOnly,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineHeight: 19.5,
            fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
            automaticLayout: true,
            wordWrap: 'off',
            formatOnPaste: true,
            formatOnType: true
          }}
        />
      </div>

      {error && (
        <div
          style={{
            marginTop: '8px',
            color: 'var(--color-danger)',
            fontSize: '12px',
            fontFamily: 'monospace',
            background: 'rgba(248, 81, 73, 0.1)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(248, 81, 73, 0.3)'
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
});

JsonEditor.displayName = 'JsonEditor';
