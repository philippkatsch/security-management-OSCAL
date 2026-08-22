import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, Suspense } from 'react';
import styles from './SharedComponents.module.css';
import { ErrorBoundary } from '@components/shared/ui/ErrorBoundary';
const Editor = React.lazy(() => import('@monaco-editor/react'));

/**
 * Performant JSON Code Editor with Monaco Editor virtualization.
 *
 * Automatically handles large documents (>200k lines) and highlights/scrolls
 * to the selected control or group ID.
 */
export interface JsonEditorProps {
  value?: any;
  data?: any;
  onChange?: (value: any) => void;
  onValidate?: (documentToValidate?: any) => Promise<any> | any;
  readOnly?: boolean;
  highlightId?: string | null;
}

export const JsonEditor = forwardRef<any, JsonEditorProps>(({
  value = '',
  data = '',
  onChange,
  onValidate,
  readOnly = false,
  highlightId = null
}, ref) => {
  const rawInput = value || data;
  const formattedValue = typeof rawInput === 'object' ? JSON.stringify(rawInput, null, 2) : String(rawInput || '');
  const [error, setError] = useState('');
  const editorRef = useRef<any>(null);
  const scrolledForRef = useRef<string | null>(null);
  const validationTimeoutRef = useRef<any>(null);

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
    },
    /**
     * Reverse sync: determine which OSCAL entity the cursor is currently inside.
     * Scans backward from cursor line, counting braces to track nesting depth,
     * and returns the first "id", "uuid", or "control-id" value found at the
     * same or parent nesting level.
     */
    getCursorEntityId: (): string | null => {
      const editor = editorRef.current;
      if (!editor) return null;

      const position = editor.getPosition();
      if (!position) return null;

      const model = editor.getModel();
      if (!model) return null;

      const cursorLine = position.lineNumber;
      let depth = 0;

      for (let line = cursorLine; line >= 1; line--) {
        const content = model.getLineContent(line);

        // Strip quoted strings to avoid counting braces inside string values
        const stripped = content.replace(/"(?:[^"\\]|\\.)*"/g, '""');

        // At same level or parent level, check for id/uuid/control-id
        if (depth <= 0) {
          const match = content.match(/"(?:uuid|id|control-id)"\s*:\s*"([^"]+)"/);
          if (match) return match[1];
        }

        // Count structural braces (going backward: } increases depth, { decreases)
        for (let i = 0; i < stripped.length; i++) {
          if (stripped[i] === '}') depth++;
          if (stripped[i] === '{') depth--;
        }
      }

      return null;
    }
  }));

  // Debounced JSON validation to avoid blocking the thread on large files
  const validateJson = (textToValidate: string) => {
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
      } catch (err: any) {
        setError(`Invalid JSON: ${err?.message || 'Syntax error'}`);
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
    const matches = model.findMatches(`"(?:id|uuid|control-id)"\\s*:\\s*"${escaped}"`, false, true, false, null, false);

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

    // Listen for all model content changes (typing, paste, programatic setValue)
    editor.onDidChangeModelContent(() => {
      const val = editor.getValue();
      handleEditorChange(val);
    });

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

  const handleEditorChange = (newValue: string | undefined) => {
    const val = newValue || '';
    onChange?.(val);
    validateJson(val);
  };

  return (
    <ErrorBoundary>
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
                className={styles['btn-secondary']}
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
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Loading editor bundle...</div>}>
            <Editor
              height="100%"
              defaultLanguage="json"
              value={formattedValue}
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
          </Suspense>
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
    </ErrorBoundary>
  );
});

JsonEditor.displayName = 'JsonEditor';
