import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import './RichTextEditor.css';

const HEADING_OPTIONS = [
  { value: 'p', label: 'Parágrafo' },
  { value: 'h2', label: 'Título 2' },
  { value: 'h3', label: 'Título 3' },
  { value: 'h4', label: 'Título 4' },
];

export default function RichTextEditor({ value, onChange, disableVisualEditor = false, minHeight = 130 }) {
  const [mode, setMode] = React.useState(disableVisualEditor ? 'html' : 'visual');
  // Tracks the last HTML the editor itself produced, so the sync effect below
  // can tell an external value change (loading a record, HTML-tab edit) apart
  // from React re-rendering with a state update the editor already applied.
  // Comparing against editor.getHTML() instead would race: a fast keystroke
  // right after a toolbar click can run before React re-renders with the
  // toolbar's onChange, making the effect see a "stale" value and stomp the
  // newer content back to the old one.
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    setMode(disableVisualEditor ? 'html' : 'visual');
  }, [disableVisualEditor]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: false },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      lastEmittedRef.current = html;
      onChange(html);
    },
  });

  // Keep the editor in sync when `value` changes from outside (loading a
  // record for edit, or the user switching back from the HTML tab).
  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (next === lastEmittedRef.current) return;
    lastEmittedRef.current = next;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const isVisual = mode === 'visual';

  const currentHeading = () => {
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    if (editor.isActive('heading', { level: 4 })) return 'h4';
    return 'p';
  };

  const setHeading = (val) => {
    if (val === 'p') editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level: Number(val.slice(1)) }).run();
  };

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    if (previousUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const url = window.prompt('URL do link:');
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const toolbarButtons = [
    { label: <b>B</b>, title: 'Negrito', active: editor.isActive('bold'), action: () => editor.chain().focus().toggleBold().run() },
    { label: <i>I</i>, title: 'Itálico', active: editor.isActive('italic'), action: () => editor.chain().focus().toggleItalic().run() },
    { label: '•', title: 'Lista com marcadores', active: editor.isActive('bulletList'), action: () => editor.chain().focus().toggleBulletList().run() },
    { label: '1.', title: 'Lista numerada', active: editor.isActive('orderedList'), action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: '☰', title: 'Alinhar à esquerda', active: editor.isActive({ textAlign: 'left' }), action: () => editor.chain().focus().setTextAlign('left').run() },
    { label: '≡', title: 'Centrar', active: editor.isActive({ textAlign: 'center' }), action: () => editor.chain().focus().setTextAlign('center').run() },
    { label: '☷', title: 'Alinhar à direita', active: editor.isActive({ textAlign: 'right' }), action: () => editor.chain().focus().setTextAlign('right').run() },
    { label: '🔗', title: 'Inserir/remover link', active: editor.isActive('link'), action: toggleLink },
    { label: '↺', title: 'Desfazer', active: false, action: () => editor.chain().focus().undo().run() },
    { label: '↻', title: 'Refazer', active: false, action: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div style={editorWrapStyle}>
      <div style={editorTopBarStyle}>
        {!disableVisualEditor && (
          <button
            type="button"
            style={{ ...tabBtnStyle, background: isVisual ? '#fff' : '#f0f0f1', fontWeight: isVisual ? 600 : 400 }}
            onClick={() => setMode('visual')}
          >
            Visual
          </button>
        )}
        <button
          type="button"
          style={{ ...tabBtnStyle, background: !isVisual ? '#fff' : '#f0f0f1', fontWeight: !isVisual ? 600 : 400 }}
          onClick={() => setMode('html')}
        >
          HTML
        </button>
      </div>

      {isVisual && (
        <div style={formatBarStyle}>
          <select style={formatSelectStyle} value={currentHeading()} onChange={(e) => setHeading(e.target.value)}>
            {HEADING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {toolbarButtons.map((b, i) => (
            <button
              key={i}
              type="button"
              title={b.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={b.action}
              style={{ ...formatIconBtnStyle, background: b.active ? '#dcdcde' : 'none', borderRadius: 3 }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      <div className="rte-content" style={{ display: isVisual ? 'block' : 'none', '--rte-min-height': `${minHeight}px` }}>
        <EditorContent editor={editor} />
      </div>

      {!isVisual && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...textareaStyle, minHeight }}
          placeholder="<p>Escreva HTML aqui...</p>"
        />
      )}
    </div>
  );
}

const editorWrapStyle = { border: '1px solid #c3c4c7', background: '#fff' };
const editorTopBarStyle = {
  background: '#f6f7f7', borderBottom: '1px solid #dcdcde',
  padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
};
const tabBtnStyle = {
  border: '1px solid #c3c4c7', borderBottom: 'none', padding: '6px 14px', fontSize: '0.95rem',
  cursor: 'pointer', color: '#3c434a', background: 'transparent',
};
const formatBarStyle = {
  background: '#f0f0f1', borderBottom: '1px solid #dcdcde',
  padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
};
const formatSelectStyle = {
  border: '1px solid #c3c4c7', borderRadius: 0, padding: '4px 8px', fontSize: '0.85rem', minWidth: 140,
};
const formatIconBtnStyle = {
  border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
  color: '#3c434a', minWidth: 26, height: 26, padding: '2px 4px',
};
const textareaStyle = {
  width: '100%', border: 'none', outline: 'none',
  resize: 'vertical', padding: '10px', fontSize: '0.92rem',
  boxSizing: 'border-box', fontFamily: 'Consolas, "Courier New", monospace',
  display: 'block', lineHeight: 1.6, color: '#1d2327',
};
