import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../api';

const wordCount = (text) => text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
const EDITOR_SLOT_KEY = 'editor_slot';
const DEFAULT_LAYOUT = { left: [EDITOR_SLOT_KEY], right: ['publicar', 'atributos', 'imagem'] };

export default function NovaPagina({ disableVisualEditor = false, mode = 'create', pageId = null }) {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [estado, setEstado] = useState('draft');
  const [visibilidade, setVisibilidade] = useState('public');
  const [ordem, setOrdem] = useState(0);
  const [superior, setSuperior] = useState('raiz');
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [loadingPage, setLoadingPage] = useState(mode === 'edit');
  const [boxLayout, setBoxLayout] = useState(DEFAULT_LAYOUT);
  const [draggedBox, setDraggedBox] = useState('');
  const [screenOptionsOpen, setScreenOptionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState('sobre');
  const [showAtributosBox, setShowAtributosBox] = useState(true);
  const [showImagemBox, setShowImagemBox] = useState(true);
  const [showDiscussao] = useState(false);
  const [showSlug] = useState(false);
  const [showAutor] = useState(false);
  const [layoutColumns, setLayoutColumns] = useState('2');
  const [fullHeightEditor, setFullHeightEditor] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setBoxLayout((prev) => {
      const leftWithoutEditor = prev.left.filter((item) => item !== EDITOR_SLOT_KEY);
      const rightWithoutEditor = prev.right.filter((item) => item !== EDITOR_SLOT_KEY);
      return {
        left: [EDITOR_SLOT_KEY, ...leftWithoutEditor],
        right: rightWithoutEditor,
      };
    });
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !pageId) {
      setLoadingPage(false);
      return;
    }

    let active = true;
    setErro('');
    setLoadingPage(true);

    axios.get(`/api/paginas/${pageId}`)
      .then((res) => {
        if (!active) return;
        const page = res.data || {};
        setTitulo(page.post_title || page.titulo || '');
        setConteudo(page.post_content || page.conteudo || '');
        setEstado((page.post_status || page.estado || 'draft') === 'publish' ? 'publish' : 'draft');
        setOrdem(Number(page.menu_order || page.ordem || 0));
        const parentId = Number(page.post_parent || page.superior || 0);
        setSuperior(parentId > 0 ? String(parentId) : 'raiz');
      })
      .catch(() => {
        if (!active) return;
        setErro('Erro ao carregar a página para edição.');
      })
      .finally(() => {
        if (active) setLoadingPage(false);
      });

    return () => { active = false; };
  }, [mode, pageId]);

  useEffect(() => {
    setBoxLayout((prev) => {
      const left = prev.left.filter((item) => item !== 'atributos' && item !== 'imagem');
      let right = prev.right.filter((item) => item !== 'atributos' && item !== 'imagem');

      if (showAtributosBox && !left.includes('atributos') && !right.includes('atributos')) right.push('atributos');
      if (showImagemBox && !left.includes('imagem') && !right.includes('imagem')) right.push('imagem');

      if (layoutColumns === '1') {
        return {
          left: [...left, ...right],
          right: []
        };
      }

      return { left, right };
    });
  }, [showAtributosBox, showImagemBox, layoutColumns]);

  const getColumnForBox = (layout, key) => {
    if (layout.left.includes(key)) return 'left';
    if (layout.right.includes(key)) return 'right';
    return null;
  };

  const moveBoxTo = (key, targetColumn, targetIndex) => {
    setBoxLayout((prev) => {
      const sourceColumn = getColumnForBox(prev, key);
      if (!sourceColumn || !['left', 'right'].includes(targetColumn)) return prev;

      const next = {
        left: [...prev.left],
        right: [...prev.right],
      };

      next[sourceColumn] = next[sourceColumn].filter((item) => item !== key);
      const insertion = Math.max(0, Math.min(targetIndex, next[targetColumn].length));
      next[targetColumn].splice(insertion, 0, key);

      return next;
    });
  };

  const moveBoxVertically = (key, direction) => {
    const column = getColumnForBox(boxLayout, key);
    if (!column) return;
    const list = boxLayout[column];
    const index = list.indexOf(key);
    const nextIndex = index + direction;
    if (index === -1) return;

    if (nextIndex < 0 || nextIndex >= list.length) {
      const targetColumn = column === 'left' ? 'right' : 'left';
      const targetIndex = direction < 0 ? 0 : boxLayout[targetColumn].length;
      moveBoxTo(key, targetColumn, targetIndex);
      return;
    }

    moveBoxTo(key, column, nextIndex);
  };

  const onDropAtPosition = (targetColumn, targetIndex) => {
    if (!draggedBox) return;
    moveBoxTo(draggedBox, targetColumn, targetIndex);
    setDraggedBox('');
  };

  const getBoxPosition = (key) => {
    const column = getColumnForBox(boxLayout, key);
    if (!column) return null;
    const list = boxLayout[column];
    const index = list.indexOf(key);
    return { column, index, total: list.length };
  };

  const handleSave = async (estadoFinal) => {
    setErro('');
    try {
      const payload = {
        titulo,
        conteudo,
        slug: titulo.toLowerCase().replace(/\s+/g, '-'),
        estado: estadoFinal,
        autor: '',
        ordem,
        superior: superior === 'raiz' ? null : superior,
      };

      if (mode === 'edit' && pageId) {
        await axios.put(`/api/paginas/${pageId}`, payload);
      } else {
        await axios.post('/api/paginas', payload);
      }

      setSucesso(true);
      if (estadoFinal === 'publish') navigate('/paginas');
    } catch {
      setErro(mode === 'edit' ? 'Erro ao atualizar a página.' : 'Erro ao guardar a página.');
    }
  };

  const toggleScreenOptions = () => {
    setHelpOpen(false);
    setScreenOptionsOpen((prev) => !prev);
  };

  const toggleHelp = () => {
    setScreenOptionsOpen(false);
    setHelpOpen((prev) => !prev);
  };

  const renderRightBox = (boxKey) => {
    if (boxKey === EDITOR_SLOT_KEY) {
      return (
        <div key={EDITOR_SLOT_KEY} style={editorWrapStyle}>
          <PageEditor value={conteudo} onChange={setConteudo} disableVisualEditor={disableVisualEditor} fullHeight={fullHeightEditor} />
          <div style={editorFooterStyle}>Contagem de palavras: {wordCount(conteudo)}</div>
        </div>
      );
    }

    const position = getBoxPosition(boxKey);
    const canMoveUp = !!position;
    const canMoveDown = !!position;

    if (boxKey === 'publicar') {
      return (
        <SideBox
          key="publicar"
          title="Publicar"
          onMoveUp={() => moveBoxVertically('publicar', -1)}
          onMoveDown={() => moveBoxVertically('publicar', 1)}
          onDragStart={() => setDraggedBox('publicar')}
          onDragEnd={() => setDraggedBox('')}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button style={sideBtnStyle} onClick={() => handleSave('draft')}>Guardar rascunho</button>
            <button style={{ ...sideBtnStyle, marginLeft: 'auto' }}>Pré-visualizar</button>
          </div>
          <div style={sideRowStyle}>
            <span>🖊 Estado: <strong>{estado === 'draft' ? 'Rascunho' : 'Publicado'}</strong></span>
            <button style={linkBtnStyle} onClick={() => setEstado(estado === 'draft' ? 'publish' : 'draft')}>Editar</button>
          </div>
          <div style={sideRowStyle}>
            <span>👁 Visibilidade: <strong>{visibilidade === 'public' ? 'Público' : 'Privado'}</strong></span>
            <button style={linkBtnStyle} onClick={() => setVisibilidade((v) => (v === 'public' ? 'private' : 'public'))}>Editar</button>
          </div>
          <div style={sideRowStyle}>
            <span>📅 Publicar <strong>imediatamente</strong></span>
            <button style={linkBtnStyle}>Editar</button>
          </div>
          <div style={{ borderTop: '1px solid #dcdcde', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button style={linkBtnStyle} onClick={() => navigate('/paginas')}>← Mover para lixo</button>
            <button style={publishBtnStyle} onClick={() => handleSave('publish')}>Publicar</button>
          </div>
        </SideBox>
      );
    }

    if (boxKey === 'atributos') {
      return (
        <SideBox
          key="atributos"
          title="Atributos da página"
          onMoveUp={() => moveBoxVertically('atributos', -1)}
          onMoveDown={() => moveBoxVertically('atributos', 1)}
          onDragStart={() => setDraggedBox('atributos')}
          onDragEnd={() => setDraggedBox('')}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        >
          <div style={{ marginBottom: 10 }}>
            <label style={sideLabelStyle}>Superior</label>
            <select value={superior} onChange={(e) => setSuperior(e.target.value)} style={sideSelectStyle}>
              <option value="raiz">(raiz)</option>
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={sideLabelStyle}>Ordem</label>
            <input
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
              style={{ border: '1px solid #c3c4c7', borderRadius: 3, padding: '4px 8px', width: 60, fontSize: '0.9rem' }}
            />
          </div>
          <p style={{ fontSize: '0.82rem', color: '#646970', margin: 0 }}>
            Precisa de ajuda? Utilize o separador de Ajuda acima do título do ecrã.
          </p>
        </SideBox>
      );
    }

    return (
      <SideBox
        key="imagem"
        title="Imagem de destaque"
        onMoveUp={() => moveBoxVertically('imagem', -1)}
        onMoveDown={() => moveBoxVertically('imagem', 1)}
        onDragStart={() => setDraggedBox('imagem')}
        onDragEnd={() => setDraggedBox('')}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      >
        <a href="#img" style={{ color: '#2271b1', textDecoration: 'none', fontSize: '0.9rem' }} onClick={(e) => e.preventDefault()}>
          Definir imagem de destaque
        </a>
      </SideBox>
    );
  };

  const renderColumn = (columnKey) => (
    <div
      style={{
        flex: columnKey === 'left' ? '1 1 auto' : '0 0 320px',
        width: columnKey === 'right' ? 320 : 'auto',
        maxWidth: '100%',
        minWidth: 0,
        flexShrink: 0,
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      {boxLayout[columnKey].map((boxKey, index) => (
        <React.Fragment key={`slot-${columnKey}-${boxKey}`}>
          <DropSlot active={Boolean(draggedBox)} onDrop={() => onDropAtPosition(columnKey, index)} />
          {renderRightBox(boxKey)}
        </React.Fragment>
      ))}
      <DropSlot active={Boolean(draggedBox)} onDrop={() => onDropAtPosition(columnKey, boxLayout[columnKey].length)} />
    </div>
  );

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' }}>
      {!screenOptionsOpen && !helpOpen && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: -24, marginBottom: 8 }}>
          <button type="button" style={screenTopBtnStyle} onClick={toggleScreenOptions}>Opções deste ecrã ▼</button>
          <button type="button" style={screenTopBtnStyle} onClick={toggleHelp}>Ajuda ▼</button>
        </div>
      )}

      {screenOptionsOpen && (
        <div style={screenPanelStyle}>
          <div style={screenSectionTitleStyle}>Elementos do ecrã</div>
          <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
            Alguns elementos do ecrã podem ser mostrados ou escondidos através das caixas de seleção. Expanda e minimize os elementos ao clicar nos seus títulos, e altere a sua disposição através de arrastar os seus títulos ou de clicar nas setas para cima e para baixo.
          </p>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16, fontSize: '0.9rem' }}>
            <label style={screenCheckboxRowStyle}><input type="checkbox" checked={showAtributosBox} onChange={(e) => setShowAtributosBox(e.target.checked)} /> Atributos da página</label>
            <label style={screenCheckboxRowStyle}><input type="checkbox" checked={showImagemBox} onChange={(e) => setShowImagemBox(e.target.checked)} /> Imagem de destaque</label>
            <label style={screenCheckboxRowStyle}><input type="checkbox" checked={showDiscussao} readOnly /> Discussão</label>
            <label style={screenCheckboxRowStyle}><input type="checkbox" checked={showSlug} readOnly /> Slug</label>
            <label style={screenCheckboxRowStyle}><input type="checkbox" checked={showAutor} readOnly /> Autor</label>
          </div>

          <div style={screenSectionTitleStyle}>Layout</div>
          <div style={{ display: 'flex', gap: 18, marginBottom: 16, fontSize: '0.9rem' }}>
            <label style={screenCheckboxRowStyle}><input type="radio" name="pagina-layout" checked={layoutColumns === '1'} onChange={() => setLayoutColumns('1')} /> 1 coluna</label>
            <label style={screenCheckboxRowStyle}><input type="radio" name="pagina-layout" checked={layoutColumns === '2'} onChange={() => setLayoutColumns('2')} /> 2 colunas</label>
          </div>

          <div style={screenSectionTitleStyle}>Opções adicionais</div>
          <label style={screenCheckboxRowStyle}><input type="checkbox" checked={fullHeightEditor} onChange={(e) => setFullHeightEditor(e.target.checked)} /> Activar o editor a toda a altura e funcionalidade livre de distracções.</label>

          <button type="button" style={screenCloseBtnStyle} onClick={() => setScreenOptionsOpen(false)}>Opções deste ecrã ▲</button>
        </div>
      )}

      {helpOpen && (
        <div style={{ ...screenPanelStyle, padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr' }}>
            <div style={{ borderRight: '1px solid #c3c4c7' }}>
              <button type="button" onClick={() => setHelpTab('sobre')} style={{ ...helpTabBtnStyle, background: helpTab === 'sobre' ? '#f0f0f1' : '#fff' }}>Sobre páginas</button>
              <button type="button" onClick={() => setHelpTab('multimedia')} style={{ ...helpTabBtnStyle, background: helpTab === 'multimedia' ? '#f0f0f1' : '#fff' }}>Inserir multimédia</button>
              <button type="button" onClick={() => setHelpTab('atributos')} style={{ ...helpTabBtnStyle, background: helpTab === 'atributos' ? '#f0f0f1' : '#fff' }}>Atributos da página</button>
            </div>

            <div style={{ padding: 14, background: '#eef3f8', minHeight: 120, lineHeight: 1.5 }}>
              {helpTab === 'sobre' && (
                <p style={{ margin: 0 }}>
                  As Páginas são semelhantes aos Artigos na medida em que têm também um título, corpo de texto, e metadados associados, mas são diferentes no aspecto de que não estão ligados a uma ordem cronológica, são uma espécie de artigos permanentes. As Páginas não estão categorizadas nem possuem etiquetas, mas podem ser organizadas hierarquicamente. Pode organizar as páginas em subpáginas, tornando-as “dependentes” de outra página, criando assim um grupo de páginas.
                </p>
              )}
              {helpTab === 'multimedia' && (
                <p style={{ margin: 0 }}>
                  Pode carregar e inserir multimédia (imagens, áudio, documentos, etc.) ao clicar no botão “Adicionar multimédia”. Pode escolher imagens e ficheiros já existentes na sua biblioteca ou carregar novos ficheiros para adicionar à sua página.
                </p>
              )}
              {helpTab === 'atributos' && (
                <p style={{ margin: 0 }}>
                  Pode dispor as páginas em hierarquia através da opção “Página superior”, e definir uma ordem própria digitando um número em “Ordem”.
                </p>
              )}
            </div>
          </div>

          <button type="button" style={screenCloseBtnStyle} onClick={() => setHelpOpen(false)}>Ajuda ▲</button>
        </div>
      )}

      <h2 style={{ fontWeight: 400, fontSize: '1.5rem', marginBottom: 16 }}>{mode === 'edit' ? 'Editar página' : 'Adicionar nova página'}</h2>

      {sucesso && <div style={alertOkStyle}>{mode === 'edit' ? 'Página atualizada com sucesso!' : 'Página guardada com sucesso!'}</div>}
      {erro && <div style={alertErrStyle}>{erro}</div>}

      {loadingPage && <div style={{ ...alertOkStyle, background: '#eef3f8', borderColor: '#c3c4c7', color: '#1d2327' }}>A carregar página…</div>}

      <input type="text" placeholder="Adicionar título" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={titleInputStyle} />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 16 }}>
        {renderColumn('left')}
        {layoutColumns === '2' && renderColumn('right')}
      </div>
    </div>
  );
}

function DropSlot({ active, onDrop }) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      style={{
        height: active ? 8 : 0,
        marginBottom: active ? 6 : 0,
        border: active ? '1px dashed #2271b1' : '1px dashed transparent',
        borderRadius: 3,
        transition: 'all 120ms ease'
      }}
    />
  );
}

function SideBox({ title, children, onMoveUp, onMoveDown, onDragStart, onDragEnd, canMoveUp, canMoveDown }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ border: '1px solid #c3c4c7', background: '#fff', marginBottom: 12 }} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div style={{ ...boxHeaderStyle, cursor: 'grab' }}>
        <strong style={{ fontSize: '0.93rem' }}>{title}</strong>
        <span style={{ display: 'flex', gap: 4 }}>
          <button type="button" style={iconBtnStyle(canMoveUp)} onClick={onMoveUp} title="Mover para cima" disabled={!canMoveUp}>∧</button>
          <button type="button" style={iconBtnStyle(canMoveDown)} onClick={onMoveDown} title="Mover para baixo" disabled={!canMoveDown}>∨</button>
          <button type="button" style={iconBtnStyle(true)} onClick={() => setCollapsed((v) => !v)}>{collapsed ? '▾' : '▴'}</button>
        </span>
      </div>
      {!collapsed && <div style={{ padding: '10px 16px' }}>{children}</div>}
    </div>
  );
}

function PageEditor({ value, onChange, disableVisualEditor = false, fullHeight = true }) {
  const [mode, setMode] = useState(disableVisualEditor ? 'html' : 'visual');
  const [showAdvancedToolbar, setShowAdvancedToolbar] = useState(false);
  const textareaRef = React.useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const getSelection = () => {
    const ta = textareaRef.current;
    if (!ta) return selection;
    return {
      start: typeof ta.selectionStart === 'number' ? ta.selectionStart : selection.start,
      end: typeof ta.selectionEnd === 'number' ? ta.selectionEnd : selection.end
    };
  };

  const setCaret = (start, end = start) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(start, end);
    setSelection({ start, end });
  };

  const insertTag = (open, close) => {
    const { start, end } = getSelection();
    const selected = value.slice(start, end);
    const newVal = value.slice(0, start) + open + selected + close + value.slice(end);
    onChange(newVal);
    const newPos = start + open.length + selected.length + close.length;
    setTimeout(() => setCaret(newPos), 0);
  };

  const insertRaw = (text) => {
    const { start, end } = getSelection();
    const newVal = value.slice(0, start) + text + value.slice(end);
    onChange(newVal);
    const newPos = start + text.length;
    setTimeout(() => setCaret(newPos), 0);
  };

  const closeOpenTags = () => {
    const { start } = getSelection();
    const before = value.slice(0, start);
    const tagRegex = /<\/?([a-zA-Z][\w-]*)([^>]*)>/g;
    const selfClosing = new Set(['br', 'img', 'hr', 'input', 'meta', 'link']);
    const stack = [];
    let match;

    while ((match = tagRegex.exec(before)) !== null) {
      const full = match[0];
      const tag = match[1].toLowerCase();
      const isClosing = full.startsWith('</');
      const isSelfClosing = full.endsWith('/>') || selfClosing.has(tag);

      if (!isClosing && !isSelfClosing) {
        stack.push(tag);
        continue;
      }

      if (isClosing) {
        const idx = stack.lastIndexOf(tag);
        if (idx !== -1) stack.splice(idx, 1);
      }
    }

    if (!stack.length) {
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }

    const closers = stack.reverse().map((tag) => `</${tag}>`).join('');
    insertRaw(closers);
  };

  const visualMainButtons = [
    { label: <b>B</b>, action: () => insertTag('<strong>', '</strong>') },
    { label: <i>I</i>, action: () => insertTag('<em>', '</em>') },
    { label: '•', action: () => insertTag('<ul>\n<li>', '</li>\n</ul>') },
    { label: '1.', action: () => insertTag('<ol>\n<li>', '</li>\n</ol>') },
    { label: '❝', action: () => insertTag('<blockquote>', '</blockquote>') },
    { label: '☰', action: () => insertTag('<p style="text-align:left;">', '</p>') },
    { label: '≡', action: () => insertTag('<p style="text-align:center;">', '</p>') },
    { label: '☷', action: () => insertTag('<p style="text-align:right;">', '</p>') },
    { label: '🔗', action: () => { const url = window.prompt('URL:'); if (url) insertTag(`<a href="${url}">`, '</a>'); } },
    { label: '▦', action: () => insertTag('<table><tr><td>', '</td></tr></table>') },
    { label: '⤢', action: () => insertTag('<pre>', '</pre>') },
    { label: '⌨', action: () => setShowAdvancedToolbar((prev) => !prev), title: 'Mostrar/esconder barra de ferramentas' }
  ];

  const visualAdvancedButtons = [
    { label: 'S', action: () => insertTag('<del>', '</del>') },
    { label: 'A', action: () => insertTag('<span style="color:#1d2327;">', '</span>') },
    { label: '🔗', action: () => { const url = window.prompt('URL:'); if (url) insertTag(`<a href="${url}">`, '</a>'); } },
    { label: 'Ω', action: () => insertTag('&omega;', '') }
  ];

  const htmlButtons = [
    { label: 'b', action: () => insertTag('<b>', '</b>') },
    { label: 'i', action: () => insertTag('<i>', '</i>') },
    { label: 'link', action: () => { const url = window.prompt('URL:'); if (url) insertTag(`<a href="${url}">`, '</a>'); } },
    { label: 'b-quote', action: () => insertTag('<blockquote>', '</blockquote>') },
    { label: 'img', action: () => { const url = window.prompt('URL da imagem:'); if (url) insertTag(`<img src="${url}" alt="" />`, ''); } },
    { label: 'ul', action: () => insertTag('<ul>\n<li>', '</li>\n</ul>') },
    { label: 'ol', action: () => insertTag('<ol>\n<li>', '</li>\n</ol>') },
    { label: 'code', action: () => insertTag('<code>', '</code>') },
    { label: 'fechar etiquetas', action: closeOpenTags }
  ];

  const isVisual = mode === 'visual';
  const buttons = isVisual ? visualMainButtons : htmlButtons;

  return (
    <>
      <div style={editorTopBarStyle}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={editorTopBtnStyle}>Adicionar multimédia</button>
          <button type="button" style={editorTopBtnStyle}>Shortcode do Pods</button>
        </div>
        <div style={{ display: 'flex', gap: 0, marginLeft: 'auto', alignSelf: 'stretch' }}>
          <button type="button" style={{ ...tabBtnStyle, background: isVisual ? '#fff' : '#f0f0f1', fontWeight: isVisual ? 600 : 400 }} onClick={() => setMode('visual')}>Visual</button>
          <button type="button" style={{ ...tabBtnStyle, background: !isVisual ? '#fff' : '#f0f0f1', fontWeight: !isVisual ? 600 : 400 }} onClick={() => setMode('html')}>HTML</button>
        </div>
      </div>

      <div style={formatBarStyle}>
        {isVisual && <select style={formatSelectStyle}><option>Parágrafo</option></select>}
        {buttons.map((btn, i) => (
          <button key={i} type="button" onClick={btn.action} style={isVisual ? formatIconBtnStyle : formatTagBtnStyle} title={btn.title || ''}>
            {btn.label}
          </button>
        ))}
      </div>

      {isVisual && showAdvancedToolbar && (
        <div style={formatBarStyle}>
          {visualAdvancedButtons.map((btn, i) => (
            <button key={`adv-${i}`} type="button" onClick={btn.action} style={formatIconBtnStyle}>{btn.label}</button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={(e) => setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd })}
        onClick={(e) => setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd })}
        onKeyUp={(e) => setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd })}
        style={{ ...textareaStyle, minHeight: fullHeight ? 430 : 300 }}
        placeholder={!isVisual ? '<p>Escreva HTML aqui...</p>' : 'Escreva o conteúdo aqui...'}
      />
    </>
  );
}

const titleInputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '1.5rem', border: '1px solid #c3c4c7',
  borderRadius: 0, marginBottom: 12, boxSizing: 'border-box', outline: 'none',
  color: '#1d2327', fontFamily: 'inherit',
};
const boxHeaderStyle = {
  background: '#f6f7f7', borderBottom: '1px solid #c3c4c7',
  padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const editorWrapStyle = { border: '1px solid #c3c4c7', background: '#fff', marginBottom: 12 };
const editorTopBarStyle = {
  background: '#f6f7f7', borderBottom: '1px solid #dcdcde',
  padding: '6px 8px', display: 'flex', alignItems: 'center',
};
const editorTopBtnStyle = {
  background: '#f6f7f7', border: '1px solid #8c8f94', borderRadius: 4,
  padding: '5px 12px', fontSize: '0.92rem', cursor: 'pointer', color: '#3c434a',
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
const formatIconBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: '#3c434a', minWidth: 24, padding: '2px 4px' };
const formatTagBtnStyle = { background: '#f6f7f7', border: '1px solid #8c8f94', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.2, color: '#3c434a', padding: '4px 10px' };
const textareaStyle = {
  width: '100%', minHeight: 300, border: 'none', outline: 'none',
  resize: 'vertical', padding: '10px', fontSize: '0.95rem',
  boxSizing: 'border-box', fontFamily: 'Georgia, "Times New Roman", serif', display: 'block', lineHeight: 1.6,
};
const editorFooterStyle = {
  borderTop: '1px solid #dcdcde', padding: '5px 10px',
  fontSize: '0.82rem', color: '#646970', background: '#f6f7f7',
};
const alertOkStyle = {
  background: '#edfaef', border: '1px solid #68de7c', color: '#1a7a2e',
  padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem',
};
const alertErrStyle = {
  background: '#fce8e8', border: '1px solid #e05252', color: '#c00',
  padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem',
};
const screenPanelStyle = {
  position: 'relative',
  background: '#fff',
  border: '1px solid #c3c4c7',
  padding: '20px 24px',
  marginBottom: 42,
  marginTop: -24,
  borderRadius: 3,
  boxShadow: 'none'
};
const screenSectionTitleStyle = { fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' };
const screenTopBtnStyle = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '6px 12px', whiteSpace: 'nowrap', fontSize: '0.88rem', color: '#50575e', cursor: 'pointer' };
const screenCloseBtnStyle = { background: '#f6f7f7', border: '1px solid #c3c4c7', position: 'absolute', right: 0, bottom: -31, padding: '6px 12px', whiteSpace: 'nowrap', fontSize: '0.88rem', color: '#50575e', borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, zIndex: 2, cursor: 'pointer' };
const screenCheckboxRowStyle = { display: 'flex', alignItems: 'center', gap: 6 };
const helpTabBtnStyle = { width: '100%', border: 'none', borderBottom: '1px solid #c3c4c7', textAlign: 'left', padding: '14px 14px', fontSize: '0.95rem', color: '#2271b1' };
const sideBtnStyle = {
  background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3,
  padding: '4px 10px', fontSize: '0.85rem', cursor: 'pointer', color: '#1d2327',
};
const publishBtnStyle = {
  background: '#2e7d32', border: 'none', borderRadius: 3,
  padding: '5px 14px', fontSize: '0.9rem', cursor: 'pointer', color: '#fff', fontWeight: 600,
};
const linkBtnStyle = {
  background: 'none', border: 'none', color: 'var(--theme-topbar-start, #2271b1)', cursor: 'pointer',
  fontSize: '0.85rem', padding: 0,
};
const sideRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 6, fontSize: '0.88rem',
};
const sideLabelStyle = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.88rem' };
const sideSelectStyle = {
  width: '100%', border: '1px solid #c3c4c7', borderRadius: 3,
  padding: '5px 8px', fontSize: '0.9rem',
};
const iconBtnStyle = (enabled = true) => ({
  background: enabled ? '#fff' : '#f6f7f7',
  border: '1px solid #c3c4c7',
  cursor: enabled ? 'pointer' : 'not-allowed',
  color: enabled ? '#50575e' : '#a7aaad',
  fontSize: '0.74rem',
  lineHeight: 1,
  width: 20,
  height: 20,
  borderRadius: 2,
  padding: 0,
});
