import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import '../api';

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Fev' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Abr' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Ago' },
  { value: '09', label: 'Set' },
  { value: '10', label: 'Out' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dez' }
];

const DEFAULT_LAYOUT = { left: ['autor', 'campos'], right: ['publicar'] };

const parseDateParts = (value) => {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    dia: String(safe.getDate()).padStart(2, '0'),
    mes: String(safe.getMonth() + 1).padStart(2, '0'),
    ano: String(safe.getFullYear()),
    hora: String(safe.getHours()).padStart(2, '0'),
    minuto: String(safe.getMinutes()).padStart(2, '0')
  };
};

export default function EditarCliente() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [comerciais, setComerciais] = useState([]);

  const [titulo, setTitulo] = useState('');
  const [autor, setAutor] = useState('');
  const [estado, setEstado] = useState('publicado');
  const [visibilidade, setVisibilidade] = useState('public');
  const [senhaVisibilidade, setSenhaVisibilidade] = useState('');
  const [dateParts, setDateParts] = useState(parseDateParts());

  const [editEstado, setEditEstado] = useState(false);
  const [editVisibilidade, setEditVisibilidade] = useState(false);
  const [editData, setEditData] = useState(false);

  const [form, setForm] = useState({
    denominacao_fiscal: '',
    contacto_empresa: '',
    pessoa_contacto_nome: '',
    pessoa_contacto_cargo: '',
    pessoa_contacto_telefone_email: '',
    morada: '',
    nif: '',
    comercial: ''
  });
  const [boxLayout, setBoxLayout] = useState(DEFAULT_LAYOUT);
  const [draggedBox, setDraggedBox] = useState('');

  useEffect(() => {
    axios.get('/api/comerciais')
      .then((res) => setComerciais(Array.isArray(res.data) ? res.data : []))
      .catch(() => setComerciais([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setErro('');
    axios.get(`/api/clientes/${id}`)
      .then((res) => {
        const c = res.data || {};
        setTitulo(c.denominacao_fiscal || '');
        setAutor(c.comercial_id || c.author || '');
        setEstado((c.estado || 'publicado').toString().toLowerCase());
        setVisibilidade((c.visibilidade || 'public').toString().toLowerCase());
        setSenhaVisibilidade((c.senha_visibilidade || '').toString());
        setDateParts(parseDateParts(c.publicado_em || c.created_at || c.updated_at));
        setForm({
          denominacao_fiscal: c.denominacao_fiscal || '',
          contacto_empresa: c.contacto_empresa || '',
          pessoa_contacto_nome: c.pessoa_contacto_nome || '',
          pessoa_contacto_cargo: c.pessoa_contacto_cargo || '',
          pessoa_contacto_telefone_email: c.pessoa_contacto_telefone_email || '',
          morada: c.morada || '',
          nif: c.nif || '',
          comercial: c.comercial_id || ''
        });
      })
      .catch(() => setErro('Não foi possível carregar o cliente.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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

  const publishedAt = useMemo(
    () => `${dateParts.ano}-${dateParts.mes}-${dateParts.dia} ${dateParts.hora}:${dateParts.minuto}:00`,
    [dateParts]
  );

  const handleSave = async () => {
    setSaving(true);
    setErro('');
    setOk('');
    try {
      await axios.put(`/api/clientes/${id}`, {
        denominacao_fiscal: titulo,
        contacto_empresa: form.contacto_empresa,
        pessoa_contacto_nome: form.pessoa_contacto_nome,
        pessoa_contacto_cargo: form.pessoa_contacto_cargo,
        pessoa_contacto_telefone_email: form.pessoa_contacto_telefone_email,
        morada: form.morada,
        nif: form.nif,
        comercial_id: autor || form.comercial,
        author: autor || form.comercial,
        estado,
        visibilidade,
        senha_visibilidade: visibilidade === 'protected' ? senhaVisibilidade : '',
        publicado_em: publishedAt
      });
      setOk('Cliente atualizado com sucesso.');
      navigate('/clientes');
    } catch {
      setErro('Erro ao atualizar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { name: 'denominacao_fiscal', label: 'Denominação Fiscal' },
    { name: 'contacto_empresa', label: 'Contacto da Empresa' },
    { name: 'pessoa_contacto_nome', label: 'Pessoa de contacto - Nome' },
    { name: 'pessoa_contacto_cargo', label: 'Pessoa de contacto - Cargo' },
    { name: 'pessoa_contacto_telefone_email', label: 'Pessoa de contacto - Telefone/Email' },
    { name: 'morada', label: 'Morada' },
    { name: 'nif', label: 'NIF', required: true },
    { name: 'comercial', label: 'Comercial', required: true, type: 'select' }
  ];

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
          <select value={autor} onChange={(e) => { setAutor(e.target.value); setForm((prev) => ({ ...prev, comercial: e.target.value })); }} style={{ ...fieldInputStyle, width: 200 }}>
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
          {fields.map((f) => (
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
              ) : (
                <input type="text" name={f.name} value={form[f.name]} onChange={handleChange} style={{ ...fieldInputStyle, width: '100%', maxWidth: f.name === 'nif' ? 320 : 680 }} />
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
          <button style={sideBtnStyle}>Guardar rascunho</button>
          <button style={{ ...sideBtnStyle, marginLeft: 'auto' }}>Pré-visualizar</button>
        </div>

        <div style={sideRowStyle}>
          <span>🖊 Estado: <strong>{estado === 'rascunho' ? 'Rascunho' : estado === 'pendente' ? 'Pendente de revisão' : 'Publicado'}</strong></span>
          <button style={linkBtnStyle} onClick={() => setEditEstado((v) => !v)}>Editar</button>
        </div>
        {editEstado && (
          <div style={{ display: 'flex', gap: 8, margin: '6px 0 10px' }}>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...fieldInputStyle, flex: 1 }}>
              <option value="rascunho">Rascunho</option>
              <option value="pendente">Pendente de revisão</option>
              <option value="publicado">Publicado</option>
            </select>
            <button style={sideBtnStyle} onClick={() => setEditEstado(false)}>OK</button>
          </div>
        )}

        <div style={sideRowStyle}>
          <span>👁 Visibilidade: <strong>{visibilidade === 'private' ? 'Privado' : visibilidade === 'protected' ? 'Protegido por senha' : 'Público'}</strong></span>
          <button style={linkBtnStyle} onClick={() => setEditVisibilidade((v) => !v)}>Editar</button>
        </div>
        {editVisibilidade && (
          <div style={{ margin: '6px 0 10px', fontSize: '0.88rem' }}>
            <label style={{ display: 'block', marginBottom: 4 }}><input type="radio" checked={visibilidade === 'public'} onChange={() => setVisibilidade('public')} /> Público</label>
            <label style={{ display: 'block', marginBottom: 4 }}><input type="radio" checked={visibilidade === 'protected'} onChange={() => setVisibilidade('protected')} /> Protegido por senha</label>
            <label style={{ display: 'block', marginBottom: 6 }}><input type="radio" checked={visibilidade === 'private'} onChange={() => setVisibilidade('private')} /> Privado</label>
            {visibilidade === 'protected' && (
              <input type="text" placeholder="Senha" value={senhaVisibilidade} onChange={(e) => setSenhaVisibilidade(e.target.value)} style={{ ...fieldInputStyle, width: '100%', marginBottom: 8 }} />
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={sideBtnStyle} onClick={() => setEditVisibilidade(false)}>OK</button>
              <button style={linkBtnStyle} onClick={() => setEditVisibilidade(false)}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={sideRowStyle}>
          <span>📅 Publicado em <strong>{dateParts.dia} {MONTHS.find((m) => m.value === dateParts.mes)?.label || dateParts.mes} {dateParts.ano} às {dateParts.hora}:{dateParts.minuto}</strong></span>
          <button style={linkBtnStyle} onClick={() => setEditData((v) => !v)}>Editar</button>
        </div>
        {editData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 10px', flexWrap: 'wrap' }}>
            <input type="text" value={dateParts.dia} onChange={(e) => setDateParts((p) => ({ ...p, dia: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInputStyle, width: 30, textAlign: 'center' }} />
            <span>de</span>
            <select value={dateParts.mes} onChange={(e) => setDateParts((p) => ({ ...p, mes: e.target.value }))} style={{ ...fieldInputStyle, width: 78 }}>
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <span>de</span>
            <input type="text" value={dateParts.ano} onChange={(e) => setDateParts((p) => ({ ...p, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))} style={{ ...fieldInputStyle, width: 52, textAlign: 'center' }} />
            <span>às</span>
            <input type="text" value={dateParts.hora} onChange={(e) => setDateParts((p) => ({ ...p, hora: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInputStyle, width: 30, textAlign: 'center' }} />
            <input type="text" value={dateParts.minuto} onChange={(e) => setDateParts((p) => ({ ...p, minuto: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInputStyle, width: 30, textAlign: 'center' }} />
            <button style={sideBtnStyle} onClick={() => setEditData(false)}>OK</button>
            <button style={linkBtnStyle} onClick={() => setEditData(false)}>Cancelar</button>
          </div>
        )}

        <div style={{ borderTop: '1px solid #dcdcde', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button style={linkBtnStyle} onClick={() => navigate('/clientes')}>Mover para o lixo</button>
          <button style={publishBtnStyle} onClick={handleSave} disabled={saving}>{saving ? 'A atualizar...' : 'Atualizar'}</button>
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

  if (loading) return <div className="py-4 text-center"><div className="spinner-border" /><p className="mt-2">Carregando...</p></div>;

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' }}>
      <h2 style={{ fontWeight: 400, fontSize: '1.5rem', marginBottom: 16 }}>Editar Cliente</h2>

      {ok && <div style={alertOkStyle}>{ok}</div>}
      {erro && <div style={alertErrStyle}>{erro}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input type="text" value={titulo} onChange={(e) => { setTitulo(e.target.value); setForm((prev) => ({ ...prev, denominacao_fiscal: e.target.value })); }} style={titleInputStyle} />

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
  padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
};
const fieldRowStyle = {
  display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px 16px',
  alignItems: 'center', marginBottom: 16
};
const fieldLabelStyle = { fontWeight: 600, fontSize: '0.88rem', color: '#1d2327' };
const fieldInputStyle = {
  border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 8px',
  fontSize: '0.9rem', boxSizing: 'border-box'
};
const sideBtnStyle = {
  background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3,
  padding: '4px 10px', fontSize: '0.85rem', cursor: 'pointer', color: '#1d2327'
};
const publishBtnStyle = {
  background: '#2e7d32', border: 'none', borderRadius: 3,
  padding: '5px 14px', fontSize: '0.9rem', cursor: 'pointer', color: '#fff', fontWeight: 600
};
const linkBtnStyle = {
  background: 'none', border: 'none', color: 'var(--theme-topbar-start, #2271b1)', cursor: 'pointer',
  fontSize: '0.85rem', padding: 0
};
const sideRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 6, fontSize: '0.88rem'
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
  padding: 0
});
const alertOkStyle = {
  background: '#edfaef', border: '1px solid #68de7c', color: '#1a7a2e',
  padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem'
};
const alertErrStyle = {
  background: '#fce8e8', border: '1px solid #e05252', color: '#c00',
  padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem'
};
