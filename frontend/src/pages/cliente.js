import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import '../api';

const SCREEN_OPTIONS_KEY = 'clientesScreenOptions';
const DEFAULT_SCREEN_OPTIONS = {
  showAuthor: true,
  showDate: true,
  pageSize: 20,
  viewMode: 'compact'
};

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

const normalizeKey = (value) => (value || '').toString().trim().toLowerCase();

const slugify = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getDateParts = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const yyyy = safe.getFullYear().toString();
  const mm = String(safe.getMonth() + 1).padStart(2, '0');
  const dd = String(safe.getDate()).padStart(2, '0');
  const hh = String(safe.getHours()).padStart(2, '0');
  const mi = String(safe.getMinutes()).padStart(2, '0');
  return { ano: yyyy, mes: mm, dia: dd, hora: hh, minuto: mi };
};

const readScreenOptions = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SCREEN_OPTIONS_KEY) || '{}');
    const pageSize = Number(saved.pageSize);
    return {
      showAuthor: saved.showAuthor !== false,
      showDate: saved.showDate !== false,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_SCREEN_OPTIONS.pageSize,
      viewMode: saved.viewMode === 'expanded' ? 'expanded' : 'compact'
    };
  } catch {
    return DEFAULT_SCREEN_OPTIONS;
  }
};

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('tudo');
  const [filtroData, setFiltroData] = useState('');
  const [selected, setSelected] = useState([]);
  const [acaoBulk, setAcaoBulk] = useState('-1');
  const [page, setPage] = useState(1);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({
    nome: '',
    slug: '',
    autor: '',
    estado: 'publicado',
    visibilidade: 'public',
    senhaVisibilidade: '',
    dia: '01',
    mes: '01',
    ano: '2026',
    hora: '00',
    minuto: '00'
  });
  const [comerciais, setComerciais] = useState([]);
  const [screenOptionsOpen, setScreenOptionsOpen] = useState(false);
  const [screenOptions, setScreenOptions] = useState(readScreenOptions);
  const [draftScreenOptions, setDraftScreenOptions] = useState(readScreenOptions);
  const [viewingId, setViewingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadClientes = () => {
      axios.get('/api/clientes')
        .then((res) => {
          if (!mounted) return;
          setClientes(Array.isArray(res.data) ? res.data : []);
          setLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setLoading(false);
        });
    };

    loadClientes();
    const intervalId = setInterval(loadClientes, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    axios.get('/api/comerciais')
      .then((res) => setComerciais(Array.isArray(res.data) ? res.data : []))
      .catch(() => setComerciais([]));
  }, []);

  const comerciaisMap = useMemo(() => {
    const map = new Map();
    comerciais.forEach((item) => {
      const label = (item.label || item.display_name || item.username || item.value || '').toString().trim();
      if (!label) return;
      [item.value, item.username, item.id]
        .filter((value) => value !== undefined && value !== null && value !== '')
        .forEach((value) => map.set(normalizeKey(value), label));
    });
    return map;
  }, [comerciais]);

  const getNome = (c) => c.denominacao_fiscal || c.nome || c.client_legacy_id || '(sem nome)';
  const getNif = (c) => (c.nif || c.nif_cliente || c.vat || '').toString();
  const normalizeNif = (value) => (value || '').toString().replace(/\D/g, '');
  const getAutor = (c) => {
    if (c.autor_nome) return c.autor_nome;
    const idRaw = c.comercial_id || c.author || c.autor;
    if (idRaw === undefined || idRaw === null || idRaw === '') return '—';
    const mapped = comerciaisMap.get(normalizeKey(idRaw));
    return mapped || idRaw;
  };
  const getEstado = (c) => {
    const raw = (c.estado || c.post_status || 'publicado').toString().toLowerCase();
    if (raw === 'publish' || raw === 'publicado') return 'publicado';
    if (raw === 'pending' || raw === 'pendente') return 'pendente';
    if (raw === 'draft' || raw === 'rascunho') return 'rascunho';
    if (raw === 'trash' || raw === 'lixo') return 'lixo';
    return raw;
  };
  const getData = (c) => c.publicado_em || c.data_contacto || c.created_at || c.updated_at || c.post_date;
  const getId = (c) => c.id || c.legacy_id || c.ID;

  const replaceCliente = (client, updates) => ({
    ...client,
    denominacao_fiscal: updates.nome,
    nome: updates.nome,
    comercial_id: updates.autor,
    autor: updates.autor,
    author: updates.autor,
    estado: updates.estado,
    post_status: updates.estado
  });

  const contTudo = clientes.length;
  const contPublicado = clientes.filter((c) => getEstado(c) === 'publicado').length;
  const contPendente = clientes.filter((c) => getEstado(c) === 'pendente').length;
  const contRascunho = clientes.filter((c) => getEstado(c) === 'rascunho').length;
  const contLixo = clientes.filter((c) => getEstado(c) === 'lixo').length;

  const filtered = clientes.filter((c) => {
    const searchText = (search || '').toLowerCase().trim();
    const searchNif = normalizeNif(search);
    const matchNome = getNome(c).toLowerCase().includes(searchText);
    const matchNif = searchNif ? normalizeNif(getNif(c)).includes(searchNif) : false;
    const matchSearch = !searchText ? true : (matchNome || matchNif);
    const matchEstado = filtroEstado === 'tudo' ? true
      : filtroEstado === 'publicado' ? getEstado(c) === 'publicado'
      : filtroEstado === 'pendente' ? getEstado(c) === 'pendente'
      : filtroEstado === 'rascunho' ? getEstado(c) === 'rascunho'
      : filtroEstado === 'lixo' ? getEstado(c) === 'lixo'
      : true;
    const matchData = !filtroData ? true : (getData(c) || '').startsWith(filtroData);
    return matchSearch && matchEstado && matchData;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / screenOptions.pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * screenOptions.pageSize, safePage * screenOptions.pageSize);
  const allChecked = pageItems.length > 0 && pageItems.every((c) => selected.includes(getId(c)));
  const visibleColumnCount = 1 + 1 + (screenOptions.showAuthor ? 1 : 0) + (screenOptions.showDate ? 1 : 0);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const datas = useMemo(
    () => [...new Set(clientes.map((c) => (getData(c) || '').slice(0, 7)).filter(Boolean))].sort().reverse(),
    [clientes]
  );

  const toggleAll = () => {
    const ids = pageItems.map(getId);
    setSelected((prev) => (allChecked ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])]));
  };

  const toggleOne = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const formatData = (d) => {
    if (!d) return '—';
    try {
      const date = new Date(d);
      return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy HH:mm', { locale: pt });
    } catch {
      return '—';
    }
  };

  const formatMonthLabel = (value) => {
    try {
      const date = new Date(`${value}-01T00:00:00`);
      const label = format(date, 'MMMM yyyy', { locale: pt });
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return value;
    }
  };

  const estLabel = (c) => {
    const e = getEstado(c);
    if (e === 'publicado') return 'Publicado';
    if (e === 'pendente') return 'Pendente';
    if (e === 'rascunho') return 'Rascunho';
    if (e === 'lixo') return 'Lixo';
    return e;
  };

  const openQuickEdit = (cliente) => {
    const dateParts = getDateParts(getData(cliente));
    setActionError('');
    setQuickEditId(getId(cliente));
    setQuickEditForm({
      nome: getNome(cliente),
      slug: slugify(getNome(cliente)),
      autor: getAutor(cliente) === '—' ? '' : getAutor(cliente),
      estado: getEstado(cliente),
      visibilidade: (cliente.visibilidade || 'public').toString().toLowerCase(),
      senhaVisibilidade: (cliente.senha_visibilidade || '').toString(),
      ...dateParts
    });
    setViewingId(null);
  };

  const openEditFull = (cliente) => {
    navigate(`/clientes/${getId(cliente)}/editar`);
  };


  const closeQuickEdit = () => {
    setQuickEditId(null);
    setQuickEditForm({
      nome: '',
      slug: '',
      autor: '',
      estado: 'publicado',
      visibilidade: 'public',
      senhaVisibilidade: '',
      dia: '01',
      mes: '01',
      ano: '2026',
      hora: '00',
      minuto: '00'
    });
  };

  const persistClienteUpdate = async (id, updates) => {
    const payload = {};
    if (typeof updates.nome === 'string') payload.denominacao_fiscal = updates.nome;
    if (typeof updates.autor === 'string') {
      payload.comercial_id = updates.autor;
      payload.author = updates.autor;
    }
    if (typeof updates.estado === 'string') payload.estado = updates.estado;
    if (typeof updates.visibilidade === 'string') payload.visibilidade = updates.visibilidade;
    if (typeof updates.senha_visibilidade === 'string') payload.senha_visibilidade = updates.senha_visibilidade;
    if (typeof updates.publicado_em === 'string' || updates.publicado_em === null) payload.publicado_em = updates.publicado_em;

    const response = await axios.put(`/api/clientes/${id}`, payload);
    return response.data?.client || replaceCliente(clientes.find((c) => getId(c) === id) || {}, updates);
  };

  const saveQuickEdit = async () => {
    if (!quickEditId || !quickEditForm.nome.trim()) return;
    const publishedAt = `${quickEditForm.ano}-${quickEditForm.mes}-${quickEditForm.dia} ${quickEditForm.hora}:${quickEditForm.minuto}:00`;
    setActionError('');
    try {
      const updatedClient = await persistClienteUpdate(quickEditId, {
        nome: quickEditForm.nome.trim(),
        autor: quickEditForm.autor.trim(),
        estado: quickEditForm.estado,
        visibilidade: quickEditForm.visibilidade,
        senha_visibilidade: quickEditForm.visibilidade === 'protected' ? quickEditForm.senhaVisibilidade.trim() : '',
        publicado_em: publishedAt
      });
      setClientes((prev) => prev.map((c) => (getId(c) === quickEditId ? updatedClient : c)));
      closeQuickEdit();
    } catch {
      setActionError('Não foi possível atualizar o cliente.');
    }
  };

  const hardDeleteCliente = async (id) => {
    setActionError('');
    try {
      await axios.delete(`/api/clientes/${id}`);
      setClientes((prev) => prev.filter((c) => getId(c) !== id));
      setSelected((prev) => prev.filter((value) => value !== id));
      if (quickEditId === id) closeQuickEdit();
      if (viewingId === id) setViewingId(null);
    } catch {
      setActionError('Não foi possível apagar o cliente.');
    }
  };


  const handleBulkApply = async () => {
    if (acaoBulk === 'delete' && selected.length > 0) {
      setActionError('');
      try {
        const updatedClients = await Promise.all(selected.map(async (id) => {
          const client = clientes.find((c) => getId(c) === id);
          if (!client) return null;
          return persistClienteUpdate(id, {
            nome: getNome(client),
            autor: getAutor(client) === '—' ? '' : getAutor(client),
            estado: 'lixo'
          });
        }));

        const byId = new Map(updatedClients.filter(Boolean).map((client) => [getId(client), client]));
        setClientes((prev) => prev.map((c) => byId.get(getId(c)) || c));
        setSelected([]);
      } catch {
        setActionError('Não foi possível aplicar a ação em lote.');
      }
      return;
    }

    if (acaoBulk === 'edit' && selected.length > 0) {
      const first = clientes.find((c) => getId(c) === selected[0]);
      if (first) openQuickEdit(first);
    }
  };

  const handleApplyScreenOptions = () => {
    const sanitized = {
      showAuthor: draftScreenOptions.showAuthor,
      showDate: draftScreenOptions.showDate,
      pageSize: Math.max(1, Number(draftScreenOptions.pageSize) || DEFAULT_SCREEN_OPTIONS.pageSize),
      viewMode: draftScreenOptions.viewMode === 'expanded' ? 'expanded' : 'compact'
    };
    setScreenOptions(sanitized);
    setDraftScreenOptions(sanitized);
    localStorage.setItem(SCREEN_OPTIONS_KEY, JSON.stringify(sanitized));
    setPage(1);
    setScreenOptionsOpen(false);
  };

  const Pagination = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: '0.9rem', color: '#50575e', marginRight: 6 }}>{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</span>
      <button type="button" style={pagBtnStyle} onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
      <button type="button" style={pagBtnStyle} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
      <input type="number" min={1} max={totalPages} value={safePage}
        onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
        style={{ width: 44, border: '1px solid #c3c4c7', borderRadius: 3, textAlign: 'center', padding: '2px 4px', fontSize: '0.88rem' }} />
      <span style={{ fontSize: '0.88rem', color: '#50575e' }}>de {totalPages}</span>
      <button type="button" style={pagBtnStyle} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
      <button type="button" style={pagBtnStyle} onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
    </div>
  );

  const ToolbarRow = ({ bottom }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: bottom ? '6px 0 0' : '0 0 4px' }}>
      <select value={acaoBulk} onChange={(e) => setAcaoBulk(e.target.value)} style={selectStyle}>
        <option value="-1">Acções por lotes</option>
        <option value="edit">Editar</option>
        <option value="delete">Mover para o lixo</option>
      </select>
      <button type="button" style={btnStyle} onClick={handleBulkApply}>Aplicar</button>
      {!bottom && <>
        <select value={filtroData} onChange={(e) => { setFiltroData(e.target.value); setPage(1); }} style={{ ...selectStyle, marginLeft: 8 }}>
          <option value="">Todas as datas</option>
          {datas.map((d) => <option key={d} value={d}>{formatMonthLabel(d)}</option>)}
        </select>
        <button type="button" style={btnStyle} onClick={() => setPage(1)}>Filtrar</button>
      </>}
      <div style={{ marginLeft: 'auto' }}><Pagination /></div>
    </div>
  );

  const renderRowActions = (cliente, isVisible) => {
    const id = getId(cliente);
    return (
      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', marginTop: 4, fontSize: '0.82rem', color: '#646970', opacity: isVisible ? 1 : 0, transition: 'opacity 120ms ease' }}>
        <ActionLink label="Editar" onClick={() => openEditFull(cliente)} />
        <ActionLink label="Edição rápida" onClick={() => openQuickEdit(cliente)} />
        <ActionLink label="Lixo" onClick={() => hardDeleteCliente(id)} danger />
        <ActionLink label="Ver" onClick={() => setViewingId((current) => (current === id ? null : id))} isLast />
      </div>
    );
  };


  if (loading) return <div className="py-4 text-center"><div className="spinner-border" /><p className="mt-2">Carregando…</p></div>;

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' }}>
      {!screenOptionsOpen && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -24, marginBottom: 8 }}>
          <button
            type="button"
            style={{ ...btnStyle, background: '#f6f7f7', padding: '6px 12px', whiteSpace: 'nowrap', borderColor: '#c3c4c7', color: '#50575e' }}
            onClick={() => {
              setDraftScreenOptions(screenOptions);
              setScreenOptionsOpen(true);
            }}
          >
            Opções deste ecrã ▼
          </button>
        </div>
      )}

      {screenOptionsOpen && (
        <div style={screenOptionsPanelStyle}>
          <div style={screenOptionsSectionTitleStyle}>Colunas</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: '0.9rem' }}>
            <label style={checkboxRowStyle}><input type="checkbox" checked={draftScreenOptions.showAuthor} onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, showAuthor: e.target.checked }))} /> Autor</label>
            <label style={checkboxRowStyle}><input type="checkbox" checked={draftScreenOptions.showDate} onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, showDate: e.target.checked }))} /> Data</label>
          </div>

          <div style={screenOptionsSectionTitleStyle}>Paginação</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontSize: '0.9rem' }}>
            <label style={{ marginRight: 6 }}>Número de itens por página:</label>
            <input
              type="number"
              min={1}
              value={draftScreenOptions.pageSize}
              onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, pageSize: e.target.value }))}
              style={{ width: 70, border: '1px solid #a7aaad', borderRadius: 4, padding: '4px 8px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={screenOptionsSectionTitleStyle}>Modo de visualização</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: '0.9rem' }}>
            <label style={checkboxRowStyle}><input type="radio" name="clientes-view-mode" checked={draftScreenOptions.viewMode === 'compact'} onChange={() => setDraftScreenOptions((prev) => ({ ...prev, viewMode: 'compact' }))} /> Vista compacta</label>
            <label style={checkboxRowStyle}><input type="radio" name="clientes-view-mode" checked={draftScreenOptions.viewMode === 'expanded'} onChange={() => setDraftScreenOptions((prev) => ({ ...prev, viewMode: 'expanded' }))} /> Vista expandida</label>
          </div>

          <button type="button" style={{ ...btnStyle, background: '#78a659', color: '#fff', borderColor: '#78a659' }} onClick={handleApplyScreenOptions}>Aplicar</button>

          <button
            type="button"
            style={{
              ...btnStyle,
              position: 'absolute',
              right: 0,
              bottom: -31,
              background: '#f6f7f7',
              padding: '6px 12px',
              whiteSpace: 'nowrap',
              borderColor: '#c3c4c7',
              color: '#50575e',
              borderTop: 'none',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: 3,
              borderBottomRightRadius: 3,
              zIndex: 2
            }}
            onClick={() => setScreenOptionsOpen(false)}
          >
            Opções deste ecrã ▲
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 400 }}>Clientes</h2>
        <button type="button" style={{ ...btnStyle, color: '#2271b1', borderColor: '#2271b1' }} onClick={() => navigate('/clientes/novo')}>
          Adicionar novo Clientes
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nome ou NIF"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchInput);
                setPage(1);
              }
            }}
            style={{ border: '1px solid #c3c4c7', borderRadius: 3, padding: '3px 8px', fontSize: '0.88rem', width: 200 }} />
          <button type="button" style={btnStyle} onClick={() => { setSearch(searchInput); setPage(1); }}>Procurar Clientes</button>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: '0.88rem' }}>
        <FL label="Tudo" count={contTudo} value="tudo" current={filtroEstado} onClick={(v) => { setFiltroEstado(v); setPage(1); }} />
        {' | '}
        <FL label="Publicados" count={contPublicado} value="publicado" current={filtroEstado} onClick={(v) => { setFiltroEstado(v); setPage(1); }} />
        {' | '}
        <FL label="Pendentes" count={contPendente} value="pendente" current={filtroEstado} onClick={(v) => { setFiltroEstado(v); setPage(1); }} />
        {' | '}
        <FL label="Rascunhos" count={contRascunho} value="rascunho" current={filtroEstado} onClick={(v) => { setFiltroEstado(v); setPage(1); }} />
        {' | '}
        <FL label="Lixo" count={contLixo} value="lixo" current={filtroEstado} onClick={(v) => { setFiltroEstado(v); setPage(1); }} />
      </div>

      {actionError && <div style={{ marginBottom: 10, color: '#b32d2e', fontSize: '0.88rem' }}>{actionError}</div>}

      <ToolbarRow />

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #c3c4c7' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #c3c4c7' }}>
            <th style={thStyle('40px')}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
            <th style={thStyle()}>Título ⇅</th>
            {screenOptions.showAuthor && <th style={thStyle('180px')}>Autor</th>}
            {screenOptions.showDate && <th style={thStyle('210px', '#2271b1')}>Data ⇅</th>}
          </tr>
        </thead>
        <tbody>
          {pageItems.length === 0 && (
            <tr><td colSpan={visibleColumnCount} style={{ padding: '12px 10px', color: '#646970' }}>Nenhum cliente encontrado.</td></tr>
          )}
          {pageItems.map((c, i) => {
            const id = getId(c);
            const d = getData(c);
            const isHovered = hoveredRowId === id;
            const showActions = screenOptions.viewMode === 'expanded' || isHovered;
            const rowBg = i % 2 === 0 ? '#fff' : '#f6f7f7';
            return (
              <React.Fragment key={id}>
                <tr
                  style={{ borderBottom: '1px solid #e2e4e7', background: rowBg }}
                  onMouseEnter={() => setHoveredRowId(id)}
                  onMouseLeave={() => setHoveredRowId((current) => (current === id ? null : current))}
                >
                  <td style={tdStyle}><input type="checkbox" checked={selected.includes(id)} onChange={() => toggleOne(id)} /></td>
                  <td style={{ ...tdStyle, paddingTop: screenOptions.viewMode === 'expanded' ? 12 : tdStyle.padding }}>
                    <a href="#editar" style={{ color: '#2271b1', fontWeight: 600, textDecoration: 'none' }}
                      onClick={(e) => { e.preventDefault(); openQuickEdit(c); }}>
                      {getNome(c)}
                    </a>
                    {renderRowActions(c, showActions)}
                    {screenOptions.viewMode === 'expanded' && null}
                  </td>
                  {screenOptions.showAuthor && (
                    <td style={tdStyle}>
                      <a href="#autor" style={{ color: '#2271b1', textDecoration: 'none' }} onClick={(e) => e.preventDefault()}>
                        {getAutor(c)}
                      </a>
                    </td>
                  )}
                  {screenOptions.showDate && (
                    <td style={{ ...tdStyle, fontSize: '0.85rem' }}>
                      <span style={{ color: '#50575e', display: 'block' }}>{estLabel(c)}</span>
                      <span style={{ color: '#646970' }}>{d ? formatData(d) : '—'}</span>
                    </td>
                  )}
                </tr>
                {quickEditId === id && (
                  <tr style={{ background: '#f6f7f7', borderBottom: '1px solid #dcdcde' }}>
                    <td colSpan={visibleColumnCount} style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.88rem' }}>
                        <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '2rem', letterSpacing: '0.3px' }}>EDIÇÃO RÁPIDA</h3>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <label style={fieldWrapStyle}>
                              <span style={fieldLabelStyle}>Título</span>
                              <input
                                type="text"
                                value={quickEditForm.nome}
                                onChange={(e) => setQuickEditForm((prev) => ({ ...prev, nome: e.target.value, slug: slugify(e.target.value) }))}
                                style={{ ...quickInputStyle, width: '100%' }}
                              />
                            </label>
                            <label style={{ ...fieldWrapStyle, marginTop: 8 }}>
                              <span style={fieldLabelStyle}>Slug</span>
                              <input type="text" value={quickEditForm.slug} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))} style={{ ...quickInputStyle, width: '100%' }} />
                            </label>
                          </div>
                          <div style={{ minWidth: 170 }}>
                            <label style={fieldWrapStyle}>
                              <span style={fieldLabelStyle}>Estado</span>
                              <select value={quickEditForm.estado} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, estado: e.target.value }))} style={{ ...quickInputStyle, width: '100%' }}>
                                <option value="publicado">Publicado</option>
                                <option value="rascunho">Rascunho</option>
                                <option value="pendente">Pendente de revisão</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: '2rem', color: '#394149', marginBottom: 6 }}>Data</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <input type="text" value={quickEditForm.dia} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, dia: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...quickInputStyle, width: 44, textAlign: 'center' }} />
                            <span>de</span>
                            <select value={quickEditForm.mes} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, mes: e.target.value }))} style={{ ...quickInputStyle, width: 80 }}>
                              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <span>de</span>
                            <input type="text" value={quickEditForm.ano} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))} style={{ ...quickInputStyle, width: 64, textAlign: 'center' }} />
                            <span>às</span>
                            <input type="text" value={quickEditForm.hora} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, hora: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...quickInputStyle, width: 44, textAlign: 'center' }} />
                            <input type="text" value={quickEditForm.minuto} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, minuto: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...quickInputStyle, width: 44, textAlign: 'center' }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
                          <label style={{ ...fieldWrapStyle, minWidth: 240 }}>
                            <span style={fieldLabelStyle}>Autor</span>
                            <select value={quickEditForm.autor} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, autor: e.target.value }))} style={{ ...quickInputStyle, width: '100%' }}>
                              <option value="">-- Selecionar --</option>
                              {comerciais.map((item) => (
                                <option key={item.id || item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </label>
                          <label style={{ ...fieldWrapStyle, minWidth: 220 }}>
                            <span style={fieldLabelStyle}>Visibilidade</span>
                            <select value={quickEditForm.visibilidade} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, visibilidade: e.target.value }))} style={{ ...quickInputStyle, width: '100%' }}>
                              <option value="public">Público</option>
                              <option value="protected">Protegido por senha</option>
                              <option value="private">Privado</option>
                            </select>
                          </label>
                          {quickEditForm.visibilidade === 'protected' && (
                            <label style={{ ...fieldWrapStyle, minWidth: 220 }}>
                              <span style={fieldLabelStyle}>Senha</span>
                              <input type="text" value={quickEditForm.senhaVisibilidade} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, senhaVisibilidade: e.target.value }))} style={{ ...quickInputStyle, width: '100%' }} />
                            </label>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button type="button" style={publishBtnStyle} onClick={saveQuickEdit}>Atualizar</button>
                          <button type="button" style={btnStyle} onClick={closeQuickEdit}>Cancelar</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {viewingId === id && (
                  <tr style={{ background: '#fffef7', borderBottom: '1px solid #e2e4e7' }}>
                    <td colSpan={visibleColumnCount} style={{ padding: '14px 16px', color: '#3c434a', lineHeight: 1.6 }}>
                      <strong style={{ display: 'block', marginBottom: 6 }}>Dados completos do cliente</strong>
                      <div><strong>ID:</strong> {getId(c)}</div>
                      <div><strong>Nome:</strong> {getNome(c)}</div>
                      <div><strong>Autor:</strong> {getAutor(c)}</div>
                      <div><strong>Estado:</strong> {estLabel(c)}</div>
                      <div><strong>Data:</strong> {formatData(getData(c))}</div>
                      <div><strong>Denominação Fiscal:</strong> {c.denominacao_fiscal}</div>
                      <div><strong>Contacto da Empresa:</strong> {c.contacto_empresa}</div>
                      <div><strong>Pessoa de contacto - Nome:</strong> {c.pessoa_contacto_nome}</div>
                      <div><strong>Pessoa de contacto - Cargo:</strong> {c.pessoa_contacto_cargo}</div>
                      <div><strong>Pessoa de contacto - Telefone/Email:</strong> {c.pessoa_contacto_telefone_email}</div>
                      <div><strong>Morada:</strong> {c.morada}</div>
                      <div><strong>NIF:</strong> {c.nif}</div>
                      <div><strong>Comercial:</strong> {c.comercial_id || c.comercial}</div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid #c3c4c7' }}>
            <th style={thStyle('40px')}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
            <th style={thStyle()}>Título ⇅</th>
            {screenOptions.showAuthor && <th style={thStyle('180px')}>Autor</th>}
            {screenOptions.showDate && <th style={thStyle('210px', '#2271b1')}>Data ⇅</th>}
          </tr>
        </tfoot>
      </table>

      <ToolbarRow bottom />
    </div>
  );
};

const FL = ({ label, count, value, current, onClick }) => (
  <span>
    {current === value
      ? <strong>{label} ({count})</strong>
      : <a href="#filtro" style={{ color: '#2271b1', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); onClick(value); }}>{label} ({count})</a>}
  </span>
);

const ActionLink = ({ label, onClick, danger = false, isLast = false }) => (
  <>
    <button
      type="button"
      onClick={onClick}
      style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: danger ? '#b32d2e' : '#2271b1', cursor: 'pointer', fontSize: 'inherit' }}
    >
      {label}
    </button>
    {!isLast && <span style={{ margin: '0 5px', color: '#646970' }}>|</span>}
  </>
);

const btnStyle = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '3px 10px', fontSize: '0.88rem', cursor: 'pointer', color: '#1d2327' };
const selectStyle = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '3px 8px', fontSize: '0.88rem' };
const thStyle = (width, color) => ({ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem', color: color || '#1d2327', width: width || 'auto', background: '#f6f7f7' });
const tdStyle = { padding: '8px 10px', verticalAlign: 'top' };
const pagBtnStyle = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '2px 7px', fontSize: '0.88rem', cursor: 'pointer' };
const publishBtnStyle = { background: '#2271b1', border: '1px solid #2271b1', borderRadius: 3, padding: '5px 12px', fontSize: '0.88rem', cursor: 'pointer', color: '#fff', fontWeight: 600 };
const fieldWrapStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldLabelStyle = { fontSize: '0.8rem', fontWeight: 600, color: '#50575e' };
const quickInputStyle = { border: '1px solid #8c8f94', borderRadius: 3, padding: '6px 8px', fontSize: '0.88rem', background: '#fff' };
const checkboxRowStyle = { display: 'flex', gap: 8, alignItems: 'center' };
const screenOptionsPanelStyle = {
  position: 'relative',
  background: '#fff',
  border: '1px solid #c3c4c7',
  padding: '20px 24px',
  marginBottom: 42,
  marginTop: -24,
  borderRadius: 3,
  boxShadow: 'none'
};
const screenOptionsSectionTitleStyle = { fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' };

export default Clientes;

