import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import '../api';

const SCREEN_OPTIONS_KEY = 'fichasScreenOptions';
const DEFAULT_SCREEN_OPTIONS = {
  showClient: true,
  showManager: true,
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
  return {
    ano: safe.getFullYear().toString(),
    mes: String(safe.getMonth() + 1).padStart(2, '0'),
    dia: String(safe.getDate()).padStart(2, '0'),
    hora: String(safe.getHours()).padStart(2, '0'),
    minuto: String(safe.getMinutes()).padStart(2, '0')
  };
};

const readScreenOptions = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SCREEN_OPTIONS_KEY) || '{}');
    const pageSize = Number(saved.pageSize);
    return {
      showClient: saved.showClient !== false,
      showManager: saved.showManager !== false,
      showDate: saved.showDate !== false,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_SCREEN_OPTIONS.pageSize,
      viewMode: saved.viewMode === 'expanded' ? 'expanded' : 'compact'
    };
  } catch {
    return DEFAULT_SCREEN_OPTIONS;
  }
};

const normalizeEstado = (rawValue) => {
  const raw = (rawValue || 'publish').toString().toLowerCase();
  if (raw === 'publish' || raw === 'publicado' || raw === 'verified' || raw === 'verificado') return 'publicado';
  if (raw === 'pending' || raw === 'pendente') return 'pendente';
  if (raw === 'draft' || raw === 'rascunho') return 'rascunho';
  if (raw === 'trash' || raw === 'lixo') return 'lixo';
  return raw;
};

const toBackendEstado = (uiValue) => {
  if (uiValue === 'publicado') return 'publish';
  if (uiValue === 'pendente') return 'pending';
  if (uiValue === 'lixo') return 'trash';
  return uiValue;
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const raw = (value || '').toString().trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'sim' || raw === 'yes' || raw === 'y';
};

const normalizeKey = (value) => (value || '').toString().trim().toLowerCase();

const decodeHtmlEntities = (value) => {
  const text = (value || '').toString();
  if (!text) return '';

  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
  }

  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

const cleanManagerName = (value) => {
  const raw = (value || '').toString().trim();
  if (!raw) return '—';

  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) return parenMatch[1].trim();

  if (raw.includes('/')) return raw.split('/')[0].trim();
  if (raw.includes(',')) return raw.split(',')[0].trim();
  if (raw.includes('|')) return raw.split('|')[0].trim();

  return raw;
};

const normalizeRole = (role) => {
  const raw = (role || '').toString().trim().toLowerCase();
  if (raw === 'administrator' || raw === 'administrador' || raw === 'admin') return 'admin';
  if (raw === 'contributor' || raw === 'contribuidor') return 'contributor';
  if (raw === 'editor' || raw === 'editora') return 'editor';
  return raw || 'editor';
};

const Fichas = ({ user = null }) => {
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('tudo');
  const [filtroData, setFiltroData] = useState('');
  const [filtroAssunto, setFiltroAssunto] = useState('');
  const [selected, setSelected] = useState([]);
  const [acaoBulk, setAcaoBulk] = useState('-1');
  const [page, setPage] = useState(1);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({
    titulo: '',
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
  const [clientes, setClientes] = useState([]);
  const [screenOptionsOpen, setScreenOptionsOpen] = useState(false);
  const [screenOptions, setScreenOptions] = useState(readScreenOptions);
  const [draftScreenOptions, setDraftScreenOptions] = useState(readScreenOptions);
  const [viewingId, setViewingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadFichas = () => {
      axios.get('/api/fichas')
        .then((res) => {
          if (!mounted) return;
          setFichas(Array.isArray(res.data) ? res.data : []);
          setLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setLoading(false);
        });
    };

    loadFichas();
    const intervalId = setInterval(loadFichas, 30000);

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

  useEffect(() => {
    axios.get('/api/clientes')
      .then((res) => setClientes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClientes([]));
  }, []);

  const clientesMap = useMemo(() => {
    const map = new Map();
    clientes.forEach((cliente) => {
      const nome = (
        cliente.denominacao_fiscal ||
        cliente.nome ||
        cliente.client_name ||
        ''
      ).toString().trim();
      if (!nome) return;

      [cliente.id, cliente.legacy_id, cliente.client_legacy_id, cliente.client_id]
        .filter((value) => value !== undefined && value !== null && value !== '')
        .forEach((value) => map.set(normalizeKey(value), nome));
    });
    return map;
  }, [clientes]);

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

  const getTitulo = (ficha) => decodeHtmlEntities(
    ficha.title || ficha.titulo || ficha.post_title || ficha.nome || ficha.tipo_contacto || '(sem título)'
  );

  const getSlug = (ficha) => {
    const raw = ficha.slug || ficha.post_name || ficha.url_slug || ficha.permalink_slug || slugify(getTitulo(ficha));
    return slugify(decodeHtmlEntities(raw));
  };
  const getCliente = (ficha) => {
    const resolvedName = ficha.client_name || ficha.cliente || ficha.nome_cliente || ficha.cliente_nome || ficha.denominacao_fiscal;
    if (resolvedName) return resolvedName;
    const idRaw = ficha.client_legacy_id ?? ficha.client_id;
    if (idRaw === undefined || idRaw === null || idRaw === '') return '—';
    const mapped = clientesMap.get(normalizeKey(idRaw));
    return mapped || idRaw;
  };
  const getGestor = (ficha) => {
    const resolvedName = ficha.author_name || ficha.gestor_nome || ficha.nome_autor;
    if (resolvedName) return cleanManagerName(resolvedName);
    const idRaw = ficha.author || ficha.autor || ficha.gestor || ficha.comercial_id;
    if (idRaw === undefined || idRaw === null || idRaw === '') return '—';
    const mapped = comerciaisMap.get(normalizeKey(idRaw));
    return cleanManagerName(mapped || idRaw);
  };
  const getEstado = (ficha) => normalizeEstado(ficha.estado || ficha.post_status);
  const getData = (ficha) => ficha.data_contacto || ficha.updated_at || ficha.created_at || ficha.post_date;
  const getId = (ficha) => ficha.id || ficha.legacy_id || ficha.ID;
  const getPreview = (ficha) => ficha.motivo_resumo_contacto || ficha.post_content || ficha.contacto || 'Sem informação adicional.';
  const getAssuntoTratado = (ficha) => toBool(
    ficha.assunto_tratado
      ?? ficha.assuntoTratado
      ?? ficha.assunto_tratado_flag
      ?? ficha.assunto
  );

  const replaceFicha = (ficha, updates) => ({
    ...ficha,
    title: updates.titulo,
    author: updates.autor,
    gestor: updates.autor,
    comercial_id: updates.autor,
    estado: toBackendEstado(updates.estado),
    post_status: toBackendEstado(updates.estado),
    data_contacto: updates.data_contacto,
    visibilidade: updates.visibilidade,
    senha_visibilidade: updates.senha_visibilidade
  });

  const normalizedRole = normalizeRole(user?.role);
  const isCurrentUserPrivileged = normalizedRole === 'contributor' || normalizedRole === 'admin';
  const currentUserIdentityKeys = useMemo(() => {
    const values = [
      user?.username,
      user?.email,
      user?.name,
      user?.displayName,
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    ];

    const keys = new Set();
    values
      .filter((value) => value !== undefined && value !== null && value !== '')
      .forEach((value) => {
        const raw = (value || '').toString().trim();
        if (!raw) return;
        keys.add(normalizeKey(raw));
        keys.add(normalizeKey(cleanManagerName(raw)));
      });

    return keys;
  }, [user]);

  const userVisibleFichas = (() => {
    const isOwnedByCurrentUser = (ficha) => {
      const candidates = [
        ficha.author,
        ficha.autor,
        ficha.gestor,
        ficha.comercial_id,
        ficha.nome_autor,
        getGestor(ficha)
      ];

      return candidates.some((value) => {
        const raw = (value || '').toString().trim();
        if (!raw) return false;
        const normalizedRaw = normalizeKey(raw);
        const normalizedClean = normalizeKey(cleanManagerName(raw));
        return currentUserIdentityKeys.has(normalizedRaw) || currentUserIdentityKeys.has(normalizedClean);
      });
    };

    const visible = isCurrentUserPrivileged
      ? [...fichas]
      : fichas.filter((ficha) => isOwnedByCurrentUser(ficha));

    // Fallback: if mapping between session user and imported manager names fails,
    // keep the list visible instead of showing an empty screen.
    const safeVisible = !isCurrentUserPrivileged && visible.length === 0 ? [...fichas] : visible;

    return safeVisible.sort((a, b) => {
      if (isCurrentUserPrivileged) {
        const byGestor = getGestor(a).localeCompare(getGestor(b), 'pt');
        if (byGestor !== 0) return byGestor;
      }
      const da = (getData(b) || '').toString();
      const db = (getData(a) || '').toString();
      return da.localeCompare(db);
    });
  })();

  const contTudo = userVisibleFichas.length;
  const contPublicado = userVisibleFichas.filter((ficha) => getEstado(ficha) === 'publicado').length;
  const contPendente = userVisibleFichas.filter((ficha) => getEstado(ficha) === 'pendente').length;
  const contLixo = userVisibleFichas.filter((ficha) => getEstado(ficha) === 'lixo').length;
  const contVerificado = contPublicado;

  const filtered = userVisibleFichas.filter((ficha) => {
    const titulo = getTitulo(ficha).toLowerCase();
    const cliente = String(getCliente(ficha)).toLowerCase();
    const matchSearch = !search || titulo.includes(search.toLowerCase()) || cliente.includes(search.toLowerCase());
    const matchEstado = filtroEstado === 'tudo' ? true
      : filtroEstado === 'publicado' ? getEstado(ficha) === 'publicado'
      : filtroEstado === 'pendente' ? getEstado(ficha) === 'pendente'
      : filtroEstado === 'lixo' ? getEstado(ficha) === 'lixo'
      : true;
    const matchData = !filtroData ? true : (getData(ficha) || '').startsWith(filtroData);
    const matchAssunto = !filtroAssunto ? true
      : filtroAssunto === 'tratado' ? getAssuntoTratado(ficha)
      : !getAssuntoTratado(ficha);
    return matchSearch && matchEstado && matchData && matchAssunto;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / screenOptions.pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * screenOptions.pageSize, safePage * screenOptions.pageSize);
  const allChecked = pageItems.length > 0 && pageItems.every((ficha) => selected.includes(getId(ficha)));
  const visibleColumnCount = 1 + 1 + (screenOptions.showClient ? 1 : 0) + (screenOptions.showManager ? 1 : 0) + (screenOptions.showDate ? 1 : 0);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const datas = useMemo(
    () => [...new Set(userVisibleFichas.map((ficha) => (getData(ficha) || '').slice(0, 7)).filter(Boolean))].sort().reverse(),
    [userVisibleFichas]
  );

  const toggleAll = () => {
    const ids = pageItems.map(getId);
    setSelected((prev) => (allChecked ? prev.filter((value) => !ids.includes(value)) : [...new Set([...prev, ...ids])]));
  };

  const toggleOne = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

  const formatData = (value) => {
    try {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '—' : format(date, "yyyy/MM/dd 'às' HH:mm", { locale: pt });
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

  const estLabel = (ficha) => {
    const estado = getEstado(ficha);
    if (estado === 'publicado') return 'Publicado';
    if (estado === 'pendente') return 'Pendente';
    return estado;
  };

  const openQuickEdit = (ficha) => {
    const dateParts = getDateParts(getData(ficha));
    const senhaVisibilidade = (ficha.senha_visibilidade || '').toString();
    const visibilidade = senhaVisibilidade ? 'protected' : ((ficha.visibilidade || 'public').toString().toLowerCase() === 'private' ? 'private' : 'public');
    setActionError('');
    setQuickEditId(getId(ficha));
    setQuickEditForm({
      titulo: getTitulo(ficha),
      slug: getSlug(ficha),
      autor: getGestor(ficha) === '—' ? '' : getGestor(ficha),
      estado: getEstado(ficha),
      visibilidade,
      senhaVisibilidade,
      ...dateParts
    });
    setViewingId(null);
  };

  const closeQuickEdit = () => {
    setQuickEditId(null);
    setQuickEditForm({
      titulo: '',
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

  const persistFichaUpdate = async (id, updates) => {
    const payload = {};
    if (typeof updates.titulo === 'string') payload.title = updates.titulo;
    if (typeof updates.autor === 'string') {
      payload.author = updates.autor;
      payload.comercial_id = updates.autor;
    }
    if (typeof updates.estado === 'string') {
      payload.estado = toBackendEstado(updates.estado);
      payload.post_status = toBackendEstado(updates.estado);
    }
    if (typeof updates.visibilidade === 'string') payload.visibilidade = updates.visibilidade;
    if (typeof updates.senha_visibilidade === 'string') payload.senha_visibilidade = updates.senha_visibilidade;
    if (typeof updates.data_contacto === 'string' || updates.data_contacto === null) payload.data_contacto = updates.data_contacto;

    const response = await axios.put(`/api/fichas/${id}`, payload);
    return response.data?.ficha || replaceFicha(fichas.find((ficha) => getId(ficha) === id) || {}, updates);
  };

  const saveQuickEdit = async () => {
    if (!quickEditId || !quickEditForm.titulo.trim()) return;
    const dataContacto = `${quickEditForm.ano}-${quickEditForm.mes}-${quickEditForm.dia} ${quickEditForm.hora}:${quickEditForm.minuto}:00`;
    const senhaVisibilidade = quickEditForm.visibilidade === 'protected' ? quickEditForm.senhaVisibilidade.trim() : '';
    setActionError('');

    try {
      const updatedFicha = await persistFichaUpdate(quickEditId, {
        titulo: quickEditForm.titulo.trim(),
        autor: quickEditForm.autor.trim(),
        estado: quickEditForm.estado,
        visibilidade: quickEditForm.visibilidade,
        senha_visibilidade: senhaVisibilidade,
        data_contacto: dataContacto
      });
      setFichas((prev) => prev.map((ficha) => (getId(ficha) === quickEditId ? updatedFicha : ficha)));
      closeQuickEdit();
    } catch {
      setActionError('Não foi possível atualizar a ficha.');
    }
  };

  const handleBulkApply = async () => {
    if (acaoBulk === 'edit' && selected.length > 0) {
      const first = fichas.find((ficha) => getId(ficha) === selected[0]);
      if (first) openQuickEdit(first);
      return;
    }

    if (acaoBulk === 'delete' && selected.length > 0) {
      setActionError('');
      try {
        const updatedFichas = await Promise.all(selected.map(async (id) => {
          const ficha = fichas.find((item) => getId(item) === id);
          if (!ficha) return null;
          return persistFichaUpdate(id, {
            titulo: getTitulo(ficha),
            autor: getGestor(ficha) === '—' ? '' : getGestor(ficha),
            estado: 'lixo',
            visibilidade: ficha.visibilidade || 'public',
            senha_visibilidade: ficha.senha_visibilidade || '',
            data_contacto: getData(ficha)
          });
        }));

        const byId = new Map(updatedFichas.filter(Boolean).map((ficha) => [getId(ficha), ficha]));
        setFichas((prev) => prev.map((ficha) => byId.get(getId(ficha)) || ficha));
        setSelected([]);
      } catch {
        setActionError('Não foi possível aplicar a ação em lote.');
      }
    }
  };

  const handleApplyScreenOptions = () => {
    const sanitized = {
      showClient: draftScreenOptions.showClient,
      showManager: draftScreenOptions.showManager,
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
      <button type="button" style={pagBtnStyle} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>‹</button>
      <input
        type="number"
        min={1}
        max={totalPages}
        value={safePage}
        onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
        style={{ width: 44, border: '1px solid #c3c4c7', borderRadius: 3, textAlign: 'center', padding: '2px 4px', fontSize: '0.88rem' }}
      />
      <span style={{ fontSize: '0.88rem', color: '#50575e' }}>de {totalPages}</span>
      <button type="button" style={pagBtnStyle} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>›</button>
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
          {datas.map((dataValue) => <option key={dataValue} value={dataValue}>{formatMonthLabel(dataValue)}</option>)}
        </select>
        <select value={filtroEstado === 'tudo' ? '' : filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value || 'tudo'); setPage(1); }} style={selectStyle}>
          <option value="">Todos os Estados</option>
          <option value="pendente">Pendente</option>
          <option value="publicado">Verificado</option>
          <option value="lixo">Lixo</option>
        </select>
        <select value={filtroAssunto} onChange={(e) => { setFiltroAssunto(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">Todos os assuntos</option>
          <option value="tratado">Assunto tratado</option>
          <option value="nao_tratado">Assunto não tratado</option>
        </select>
        <button type="button" style={btnStyle} onClick={() => setPage(1)}>Filtrar</button>
      </>}
      <div style={{ marginLeft: 'auto' }}><Pagination /></div>
    </div>
  );

  const renderRowActions = (ficha, isVisible) => {
    const id = getId(ficha);
    const previewLabel = getEstado(ficha) === 'publicado' ? 'Ver' : 'Pré-visualizar';
    return (
      <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', marginTop: 4, fontSize: '0.82rem', color: '#646970', opacity: isVisible ? 1 : 0, transition: 'opacity 120ms ease' }}>
        <ActionLink label="Editar" onClick={() => navigate(`/fichas/${id}/editar`)} />
        <ActionLink label="Edição rápida" onClick={() => openQuickEdit(ficha)} />
        <ActionLink label="Lixo" onClick={() => moveFichaToTrash(id)} danger />
        <ActionLink label={previewLabel} onClick={() => setViewingId((current) => (current === id ? null : id))} isLast />
      </div>
    );
  };

  const moveFichaToTrash = async (id) => {
    const currentFicha = fichas.find((ficha) => getId(ficha) === id);
    if (!currentFicha) return;

    setActionError('');
    try {
      const updatedFicha = await persistFichaUpdate(id, {
        titulo: getTitulo(currentFicha),
        autor: getGestor(currentFicha) === '—' ? '' : getGestor(currentFicha),
        estado: 'lixo',
        visibilidade: currentFicha.visibilidade || 'public',
        senha_visibilidade: currentFicha.senha_visibilidade || '',
        data_contacto: getData(currentFicha)
      });
      setFichas((prev) => prev.map((ficha) => (getId(ficha) === id ? updatedFicha : ficha)));
      setSelected((prev) => prev.filter((value) => value !== id));
      if (quickEditId === id) closeQuickEdit();
      if (viewingId === id) setViewingId(null);
    } catch {
      setActionError('Não foi possível mover a ficha para o lixo.');
    }
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
          <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: '0.9rem', flexWrap: 'wrap' }}>
            <label style={checkboxRowStyle}><input type="checkbox" checked={draftScreenOptions.showClient} onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, showClient: e.target.checked }))} /> Cliente</label>
            <label style={checkboxRowStyle}><input type="checkbox" checked={draftScreenOptions.showManager} onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, showManager: e.target.checked }))} /> Gestor</label>
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
            <label style={checkboxRowStyle}><input type="radio" name="fichas-view-mode" checked={draftScreenOptions.viewMode === 'compact'} onChange={() => setDraftScreenOptions((prev) => ({ ...prev, viewMode: 'compact' }))} /> Vista compacta</label>
            <label style={checkboxRowStyle}><input type="radio" name="fichas-view-mode" checked={draftScreenOptions.viewMode === 'expanded'} onChange={() => setDraftScreenOptions((prev) => ({ ...prev, viewMode: 'expanded' }))} /> Vista expandida</label>
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
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 400 }}>Fichas</h2>
        <button type="button" style={{ ...btnStyle, color: '#2271b1', borderColor: '#2271b1' }} onClick={() => navigate('/fichas/nova')}>
          Adicionar novo Fichas
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchInput);
                setPage(1);
              }
            }}
            style={{ border: '1px solid #c3c4c7', borderRadius: 3, padding: '3px 8px', fontSize: '0.88rem', width: 200 }}
          />
          <button type="button" style={btnStyle} onClick={() => { setSearch(searchInput); setPage(1); }}>Procurar Fichas</button>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: '0.88rem' }}>
        <FL label="Tudo" count={contTudo} value="tudo" current={filtroEstado} onClick={(value) => { setFiltroEstado(value); setPage(1); }} />
        {' | '}
        <FL label="Verificados" count={contVerificado} value="publicado" current={filtroEstado} onClick={(value) => { setFiltroEstado(value); setPage(1); }} />
        {' | '}
        <FL label="Pendentes" count={contPendente} value="pendente" current={filtroEstado} onClick={(value) => { setFiltroEstado(value); setPage(1); }} />
        {' | '}
        <FL label="Lixo" count={contLixo} value="lixo" current={filtroEstado} onClick={(value) => { setFiltroEstado(value); setPage(1); }} />
      </div>

      {actionError && <div style={{ marginBottom: 10, color: '#b32d2e', fontSize: '0.88rem' }}>{actionError}</div>}

      <ToolbarRow />

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #c3c4c7' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #c3c4c7' }}>
            <th style={thStyle('40px')}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
            <th style={thStyle()}>Título ⇅</th>
            {screenOptions.showClient && <th style={thStyle('220px')}>Cliente</th>}
            {screenOptions.showManager && <th style={thStyle('160px')}>Gestor</th>}
            {screenOptions.showDate && <th style={thStyle('190px', '#2271b1')}>Data ⇅</th>}
          </tr>
        </thead>
        <tbody>
          {pageItems.length === 0 && (
            <tr><td colSpan={visibleColumnCount} style={{ padding: '12px 10px', color: '#646970' }}>Nenhuma ficha encontrada.</td></tr>
          )}
          {pageItems.map((ficha, index) => {
            const id = getId(ficha);
            const dataValue = getData(ficha);
            const isHovered = hoveredRowId === id;
            const showActions = screenOptions.viewMode === 'expanded' || isHovered;
            const rowBg = index % 2 === 0 ? '#fff' : '#f6f7f7';
            return (
              <React.Fragment key={id}>
                <tr
                  style={{ borderBottom: '1px solid #e2e4e7', background: rowBg }}
                  onMouseEnter={() => setHoveredRowId(id)}
                  onMouseLeave={() => setHoveredRowId((current) => (current === id ? null : current))}
                >
                  <td style={tdStyle}><input type="checkbox" checked={selected.includes(id)} onChange={() => toggleOne(id)} /></td>
                  <td style={{ ...tdStyle, paddingTop: screenOptions.viewMode === 'expanded' ? 12 : tdStyle.padding }}>
                    <a href="#editar" style={{ color: '#2271b1', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigate(`/fichas/${id}/editar`); }}>
                      {getTitulo(ficha)}
                    </a>
                    {getEstado(ficha) === 'pendente' && <> — <strong>Pendente</strong></>}
                    {getEstado(ficha) === 'lixo' && <> — <strong>Lixo</strong></>}
                    {renderRowActions(ficha, showActions)}
                  </td>
                  {screenOptions.showClient && <td style={tdStyle}>{getCliente(ficha)}</td>}
                  {screenOptions.showManager && (
                    <td style={tdStyle}>
                      <a href="#gestor" style={{ color: '#2271b1', textDecoration: 'none' }} onClick={(e) => e.preventDefault()}>
                        {getGestor(ficha)}
                      </a>
                    </td>
                  )}
                  {screenOptions.showDate && (
                    <td style={{ ...tdStyle, fontSize: '0.85rem' }}>
                      <span style={{ color: '#50575e', display: 'block' }}>{getEstado(ficha) === 'publicado' ? 'Publicado' : 'Última modificação'}</span>
                      <span style={{ color: '#646970' }}>{dataValue ? formatData(dataValue) : '—'}</span>
                    </td>
                  )}
                </tr>
                {quickEditId === id && (
                  <tr style={{ background: '#f6f7f7', borderBottom: '1px solid #dcdcde' }}>
                    <td colSpan={visibleColumnCount} style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.88rem' }}>
                        <h3 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '2rem', letterSpacing: '0.3px' }}>EDIÇÃO RÁPIDA</h3>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 260 }}>
                            <label style={fieldWrapStyle}>
                              <span style={fieldLabelStyle}>Título</span>
                              <input
                                type="text"
                                value={quickEditForm.titulo}
                                onChange={(e) => setQuickEditForm((prev) => ({ ...prev, titulo: e.target.value, slug: slugify(e.target.value) }))}
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
                                <option value="pendente">Pendente de revisão</option>
                                <option value="publicado">Verificado</option>
                                <option value="lixo">Lixo</option>
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
                              {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                            </select>
                            <span>de</span>
                            <input type="text" value={quickEditForm.ano} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))} style={{ ...quickInputStyle, width: 64, textAlign: 'center' }} />
                            <span>às</span>
                            <input type="text" value={quickEditForm.hora} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, hora: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...quickInputStyle, width: 44, textAlign: 'center' }} />
                            <input type="text" value={quickEditForm.minuto} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, minuto: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...quickInputStyle, width: 44, textAlign: 'center' }} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
                          <label style={{ ...fieldWrapStyle, minWidth: 240 }}>
                            <span style={fieldLabelStyle}>Autor</span>
                            <select value={quickEditForm.autor} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, autor: e.target.value }))} style={{ ...quickInputStyle, width: '100%' }}>
                              <option value="">-- Selecionar --</option>
                              {comerciais.map((item) => (
                                <option key={item.id || item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </label>
                          <label style={{ ...fieldWrapStyle, minWidth: 174 }}>
                            <span style={fieldLabelStyle}>Senha</span>
                            <input
                              type="text"
                              value={quickEditForm.senhaVisibilidade}
                              onChange={(e) => setQuickEditForm((prev) => ({
                                ...prev,
                                senhaVisibilidade: e.target.value,
                                visibilidade: e.target.value.trim() ? 'protected' : (prev.visibilidade === 'protected' ? 'public' : prev.visibilidade)
                              }))}
                              style={{ ...quickInputStyle, width: '100%' }}
                            />
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
                            <span style={{ color: '#646970' }}>— ou —</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#50575e' }}>
                              <input
                                type="checkbox"
                                checked={quickEditForm.visibilidade === 'private'}
                                onChange={(e) => setQuickEditForm((prev) => ({
                                  ...prev,
                                  visibilidade: e.target.checked ? 'private' : (prev.senhaVisibilidade.trim() ? 'protected' : 'public')
                                }))}
                              />
                              Privado
                            </label>
                          </div>
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
                      <strong style={{ display: 'block', marginBottom: 6 }}>Pré-visualização da ficha</strong>
                      <div><strong>ID:</strong> {getId(ficha)}</div>
                      <div><strong>Título:</strong> {getTitulo(ficha)}</div>
                      <div><strong>Cliente:</strong> {getCliente(ficha)}</div>
                      <div><strong>Gestor:</strong> {getGestor(ficha)}</div>
                      <div><strong>Estado:</strong> {estLabel(ficha)}</div>
                      <div><strong>Data:</strong> {formatData(getData(ficha))}</div>
                      <div style={{ marginTop: 8 }}>
                        <strong>Resumo:</strong>
                        <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getPreview(ficha)) }} />
                      </div>
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
            {screenOptions.showClient && <th style={thStyle('220px')}>Cliente</th>}
            {screenOptions.showManager && <th style={thStyle('160px')}>Gestor</th>}
            {screenOptions.showDate && <th style={thStyle('190px', '#2271b1')}>Data ⇅</th>}
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

export default Fichas;