// frontend/src/pages/novocliente.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from '../components/RichTextEditor';
import '../api';

const BOX_LAYOUT_KEY = 'novoClienteBoxLayout';
const DEFAULT_LAYOUT = { left: ['autor', 'campos'], right: ['publicar'] };

export default function NovoCliente({ disableVisualEditor = false }) {
  const [titulo, setTitulo] = useState('');
  const [autor, setAutor] = useState('');
  const [estado, setEstado] = useState('draft');
  const [visibilidade, setVisibilidade] = useState('public');
  const [form, setForm] = useState({
    denominacao_fiscal: '',
    contacto_empresa: '',
    pessoa_contacto_nome: '',
    pessoa_contacto_cargo: '',
    pessoa_contacto_telefone_email: '',
    morada: '',
    localidade: '',
    nif: '',
    observacoes: '',
    comercial: '',
  });
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [comerciais, setComerciais] = useState([]);
  const [boxLayout, setBoxLayout] = useState(DEFAULT_LAYOUT);
  const [draggedBox, setDraggedBox] = useState('');
  const [senhaVisibilidade, setSenhaVisibilidade] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/comerciais')
      .then((res) => setComerciais(Array.isArray(res.data) ? res.data : []))
      .catch(() => setComerciais([]));
  }, []);

  useEffect(() => {
    localStorage.removeItem(BOX_LAYOUT_KEY);
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleFieldValueChange = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (estadoFinal) => {
    setErro('');
    try {
      await axios.post('/api/clientes', {
        nome: titulo,
        autor,
        comercial_id: form.comercial || autor,
        estado: estadoFinal,
        visibilidade,
        senha_visibilidade: visibilidade === 'protected' ? senhaVisibilidade : '',
        ...form,
      });
      setSucesso(true);
      if (estadoFinal === 'publish') navigate('/clientes');
    } catch {
      setErro('Erro ao guardar o cliente.');
    }
  };

  const fields = [
    { name: 'denominacao_fiscal', label: 'Denominação Fiscal' },
    { name: 'contacto_empresa', label: 'Contacto da Empresa' },
    { name: 'pessoa_contacto_nome', label: 'Pessoa de contacto - Nome' },
    { name: 'pessoa_contacto_cargo', label: 'Pessoa de contacto - Cargo' },
    { name: 'pessoa_contacto_telefone_email', label: 'Pessoa de contacto - Telefone/Email' },
    { name: 'morada', label: 'Morada' },
    { name: 'localidade', label: 'Localidade' },
    { name: 'nif', label: 'NIF', required: true },
    { name: 'observacoes', label: 'Observações', type: 'richtext' },
    { name: 'comercial', label: 'Comercial', required: true, type: 'select' },
  ];

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

  const renderBox = (boxKey) => {
    const position = getBoxPosition(boxKey);
    const canMoveUp = !!position;
    const canMoveDown = !!position;
    if (boxKey === 'autor') {
      return (
        <SideBox
          key="autor"
          title="Autor"
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => moveBoxVertically('autor', -1)}
          onMoveDown={() => moveBoxVertically('autor', 1)}
          onDragStart={() => setDraggedBox('autor')}
          onDragEnd={() => setDraggedBox('')}
        >
          <select value={autor} onChange={e => setAutor(e.target.value)} style={{ ...fieldInputStyle, width: 200 }}>
            <option value="">-- Seleccionar --</option>
            {comerciais.map((c) => (
              <option key={c.id || c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </SideBox>
      );
    }

    if (boxKey === 'campos') {
      return (
        <SideBox
          key="campos"
          title="Mais campos"
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={() => moveBoxVertically('campos', -1)}
          onMoveDown={() => moveBoxVertically('campos', 1)}
          onDragStart={() => setDraggedBox('campos')}
          onDragEnd={() => setDraggedBox('')}
        >
          {fields.map(f => (
            <div key={f.name} style={fieldRowStyle}>
              <label style={fieldLabelStyle}>
                {f.label}{f.required && <span style={{ color: 'red' }}> *</span>}
              </label>
              {f.type === 'select' ? (
                <select name={f.name} value={form[f.name]} onChange={handleChange} style={{ ...fieldInputStyle, width: '100%', maxWidth: 340 }}>
                  <option value="">-- Seleccionar um --</option>
                  {comerciais.map((c) => (
                    <option key={`field-${c.id || c.value}`} value={c.value}>{c.label}</option>
                  ))}
                </select>
              ) : f.type === 'richtext' ? (
                <div style={{ maxWidth: 680 }}>
                  <RichTextEditor
                    value={form[f.name]}
                    onChange={(value) => handleFieldValueChange(f.name, value)}
                    disableVisualEditor={disableVisualEditor}
                    minHeight={130}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  name={f.name}
                  value={form[f.name]}
                  onChange={handleChange}
                  style={{ ...fieldInputStyle, width: '100%', maxWidth: f.name === 'nif' ? 320 : 680 }}
                />
              )}
            </div>
          ))}
        </SideBox>
      );
    }

    return (
      <SideBox
        key="publicar"
        title="Publicar"
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={() => moveBoxVertically('publicar', -1)}
        onMoveDown={() => moveBoxVertically('publicar', 1)}
        onDragStart={() => setDraggedBox('publicar')}
        onDragEnd={() => setDraggedBox('')}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button style={sideBtnStyle} onClick={() => handleSave('draft')}>Guardar rascunho</button>
          <button style={{ ...sideBtnStyle, marginLeft: 'auto' }}>Pré-visualizar</button>
        </div>
        <div style={sideRowStyle}>
          <span>🖊 Estado: <strong>{estado === 'draft' ? 'Rascunho' : 'Publicado'}</strong></span>
          <button style={linkBtnStyle} onClick={() => setEstado(e => e === 'draft' ? 'publish' : 'draft')}>Editar</button>
        </div>
        <div style={sideRowStyle}>
          <span>👁 Visibilidade: <strong>{visibilidade === 'private' ? 'Privado' : visibilidade === 'protected' ? 'Protegido por senha' : 'Público'}</strong></span>
          <button style={linkBtnStyle} onClick={() => setVisibilidade((v) => (v === 'public' ? 'protected' : v === 'protected' ? 'private' : 'public'))}>Editar</button>
        </div>
        {visibilidade === 'protected' && (
          <input type="text" placeholder="Senha de proteção" value={senhaVisibilidade} onChange={(e) => setSenhaVisibilidade(e.target.value)} style={{ ...fieldInputStyle, width: '100%', marginBottom: 8 }} />
        )}
        <div style={sideRowStyle}>
          <span>📅 Publicar <strong>imediatamente</strong></span>
          <button style={linkBtnStyle}>Editar</button>
        </div>
        <div style={{ borderTop: '1px solid #dcdcde', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button style={linkBtnStyle} onClick={() => navigate('/clientes')}>← Cancelar</button>
          <button style={publishBtnStyle} onClick={() => handleSave('publish')}>Publicar</button>
        </div>
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
        flexShrink: 0
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      {boxLayout[columnKey].map((boxKey, index) => (
        <React.Fragment key={`slot-${columnKey}-${boxKey}`}>
          <DropSlot active={Boolean(draggedBox)} onDrop={() => onDropAtPosition(columnKey, index)} />
          {renderBox(boxKey)}
        </React.Fragment>
      ))}
      <DropSlot active={Boolean(draggedBox)} onDrop={() => onDropAtPosition(columnKey, boxLayout[columnKey].length)} />
    </div>
  );

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' }}>
      <h2 style={{ fontWeight: 400, fontSize: '1.5rem', marginBottom: 16 }}>Adicionar novo Cliente</h2>

      {sucesso && <div style={alertOkStyle}>Cliente guardado com sucesso!</div>}
      {erro && <div style={alertErrStyle}>{erro}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <input
            type="text"
            placeholder="Adicionar título"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            style={titleInputStyle}
          />
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            {renderColumn('left')}
            {renderColumn('right')}
          </div>
        </div>
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
          <button type="button" style={iconBtnStyle(canMoveUp)} title="Mover para cima" onClick={onMoveUp} disabled={!canMoveUp}>∧</button>
          <button type="button" style={iconBtnStyle(canMoveDown)} title="Mover para baixo" onClick={onMoveDown} disabled={!canMoveDown}>∨</button>
          <button type="button" style={iconBtnStyle(true)} onClick={() => setCollapsed((v) => !v)}>{collapsed ? '▾' : '▴'}</button>
        </span>
      </div>
      {!collapsed && <div style={{ padding: '10px 16px' }}>{children}</div>}
    </div>
  );
}

const titleInputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '1.5rem', border: '1px solid #c3c4c7',
  borderRadius: 0, marginBottom: 12, boxSizing: 'border-box', outline: 'none',
  color: '#1d2327', fontFamily: 'inherit', lineHeight: 1.2,
};
const boxHeaderStyle = {
  background: '#f6f7f7', borderBottom: '1px solid #c3c4c7',
  padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const fieldRowStyle = {
  display: 'grid',
  gridTemplateColumns: '200px minmax(0, 1fr)',
  gap: '8px 16px',
  alignItems: 'center',
  marginBottom: 16,
};
const fieldLabelStyle = { fontWeight: 600, fontSize: '0.88rem', color: '#1d2327' };
const fieldInputStyle = {
  border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 8px',
  fontSize: '0.9rem', boxSizing: 'border-box',
};
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
const alertOkStyle = {
  background: '#edfaef', border: '1px solid #68de7c', color: '#1a7a2e',
  padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem',
};
const alertErrStyle = {
  background: '#fce8e8', border: '1px solid #e05252', color: '#c00',
  padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem',
};
