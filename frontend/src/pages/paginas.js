import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
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

const SCREEN_OPTIONS_KEY = 'paginasScreenOptions';
const DEFAULT_SCREEN_OPTIONS = {
  showAutor: true,
  showComentarios: true,
  showData: true,
  pageSize: 20,
  viewMode: 'expanded'
};

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

const slugify = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const readScreenOptions = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SCREEN_OPTIONS_KEY) || '{}');
    const pageSize = Number(saved.pageSize);
    return {
      showAutor: saved.showAutor !== false,
      showComentarios: saved.showComentarios !== false,
      showData: saved.showData !== false,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_SCREEN_OPTIONS.pageSize,
      viewMode: saved.viewMode === 'compact' ? 'compact' : 'expanded'
    };
  } catch {
    return DEFAULT_SCREEN_OPTIONS;
  }
};

const normalizeEstado = (estado) => {
  const raw = (estado || 'publish').toString().toLowerCase();
  if (raw === 'publish' || raw === 'publicado') return 'publicado';
  if (raw === 'draft' || raw === 'rascunho') return 'rascunho';
  return raw;
};

export default function Paginas() {
  const [paginas, setPaginas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('tudo');
  const [filtroData, setFiltroData] = useState('');
  const [selected, setSelected] = useState([]);
  const [acaoBulk, setAcaoBulk] = useState('-1');
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [quickEditId, setQuickEditId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({
    titulo: '',
    slug: '',
    conteudo: '',
    autor: '',
    estado: 'publicado',
    dia: '01',
    mes: '01',
    ano: '2026',
    hora: '00',
    minuto: '00',
    senha: '',
    privado: false
  });
  const [screenOptionsOpen, setScreenOptionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState('visao');
  const [screenOptions, setScreenOptions] = useState(readScreenOptions);
  const [draftScreenOptions, setDraftScreenOptions] = useState(readScreenOptions);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadPaginas = () => {
      axios.get('/api/paginas')
        .then((res) => {
          if (!mounted) return;
          setPaginas(Array.isArray(res.data) ? res.data : []);
          setLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setLoading(false);
        });
    };

    loadPaginas();
    const intervalId = setInterval(loadPaginas, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const getId = (p) => p.ID || p.id || p.legacy_id;
  const getTitulo = (p) => p.post_title || p.titulo || '(sem título)';
  const getSlug = (p) => slugify(p.slug || p.post_name || getTitulo(p));
  const getConteudo = (p) => p.post_content || p.conteudo || '';
  const getEstado = (p) => normalizeEstado(p.post_status || p.estado);
  const getAutor = (p) => p.post_author || p.autor || 'celeuma';
  const getData = (p) => p.post_date || p.data_publicacao || p.data_contacto;

  const contTudo = paginas.length;
  const contPublicado = paginas.filter((p) => getEstado(p) === 'publicado').length;
  const contRascunho = paginas.filter((p) => getEstado(p) === 'rascunho').length;

  const filtered = paginas.filter((p) => {
    const titulo = getTitulo(p).toLowerCase();
    const matchSearch = !search || titulo.includes(search.toLowerCase());
    const estado = getEstado(p);
    const matchEstado = filtroEstado === 'tudo' ? true : estado === filtroEstado;
    const matchData = !filtroData ? true : (getData(p) || '').startsWith(filtroData);
    return matchSearch && matchEstado && matchData;
  });

  const pageItems = filtered.slice(0, screenOptions.pageSize);
  const allChecked = pageItems.length > 0 && pageItems.every((p) => selected.includes(getId(p)));

  const datas = useMemo(
    () => [...new Set(paginas.map((p) => (getData(p) || '').slice(0, 7)).filter(Boolean))].sort().reverse(),
    [paginas]
  );

  const visibleColumnCount = 1 + 1 + (screenOptions.showAutor ? 1 : 0) + (screenOptions.showComentarios ? 1 : 0) + (screenOptions.showData ? 1 : 0);

  const toggleAll = () => {
    const ids = pageItems.map(getId);
    setSelected((prev) => (allChecked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  };

  const toggleOne = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const formatData = (value) => {
    try {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '—' : format(date, "yyyy/MM/dd 'às' HH:mm", { locale: pt });
    } catch {
      return '—';
    }
  };

  const formatEstadoLabel = (p) => {
    const estado = getEstado(p);
    return estado === 'publicado' ? 'Publicado' : 'Última modificação';
  };

  const applyBulk = () => {
    if (acaoBulk !== 'delete' || selected.length === 0) return;
    setPaginas((prev) => prev.filter((p) => !selected.includes(getId(p))));
    setSelected([]);
  };

  const openQuickEdit = (p) => {
    const parts = parseDateParts(getData(p));
    setViewingId(null);
    setQuickEditId(getId(p));
    setQuickEditForm({
      titulo: getTitulo(p),
      slug: getSlug(p),
      conteudo: getConteudo(p),
      autor: getAutor(p),
      estado: getEstado(p),
      senha: '',
      privado: false,
      ...parts
    });
  };

  const closeQuickEdit = () => {
    setQuickEditId(null);
    setQuickEditForm({
      titulo: '',
      slug: '',
      conteudo: '',
      autor: '',
      estado: 'publicado',
      dia: '01',
      mes: '01',
      ano: '2026',
      hora: '00',
      minuto: '00',
      senha: '',
      privado: false
    });
  };

  const saveQuickEdit = () => {
    if (!quickEditId) return;
    const postDate = `${quickEditForm.ano}-${quickEditForm.mes}-${quickEditForm.dia} ${quickEditForm.hora}:${quickEditForm.minuto}:00`;
    setPaginas((prev) => prev.map((p) => {
      if (getId(p) !== quickEditId) return p;
      return {
        ...p,
        post_title: quickEditForm.titulo,
        titulo: quickEditForm.titulo,
        slug: quickEditForm.slug,
        post_name: quickEditForm.slug,
        post_content: quickEditForm.conteudo,
        conteudo: quickEditForm.conteudo,
        post_author: quickEditForm.autor,
        autor: quickEditForm.autor,
        post_status: quickEditForm.estado === 'publicado' ? 'publish' : 'draft',
        estado: quickEditForm.estado,
        post_date: postDate
      };
    }));
    closeQuickEdit();
  };

  const openScreenOptions = () => {
    setDraftScreenOptions(screenOptions);
    setHelpOpen(false);
    setScreenOptionsOpen((prev) => !prev);
  };

  const openHelp = () => {
    setScreenOptionsOpen(false);
    setHelpOpen((prev) => !prev);
  };

  const applyScreenOptions = () => {
    setScreenOptions(draftScreenOptions);
    localStorage.setItem(SCREEN_OPTIONS_KEY, JSON.stringify(draftScreenOptions));
    setScreenOptionsOpen(false);
  };

  if (loading) return <div className="py-4 text-center"><div className="spinner-border" /><p className="mt-2">Carregando...</p></div>;

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' }}>
      {!screenOptionsOpen && !helpOpen && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: -24, marginBottom: 8 }}>
          <button
            type="button"
            style={panelToggleBtn}
            onClick={openScreenOptions}
          >
            Opções deste ecrã ▼
          </button>
          <button
            type="button"
            style={panelToggleBtn}
            onClick={openHelp}
          >
            Ajuda ▼
          </button>
        </div>
      )}

      {screenOptionsOpen && (
        <div style={topPanelStyle}>
          <div style={panelSectionTitle}>Colunas</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: '0.9rem', flexWrap: 'wrap' }}>
            <label style={checkboxRow}><input type="checkbox" checked={draftScreenOptions.showAutor} onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, showAutor: e.target.checked }))} /> Autor</label>
            <label style={checkboxRow}><input type="checkbox" checked={draftScreenOptions.showComentarios} onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, showComentarios: e.target.checked }))} /> Comentários</label>
            <label style={checkboxRow}><input type="checkbox" checked={draftScreenOptions.showData} onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, showData: e.target.checked }))} /> Data</label>
          </div>

          <div style={panelSectionTitle}>Paginação</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontSize: '0.9rem' }}>
            <label style={{ marginRight: 6 }}>
              Número de itens por página:
            </label>
            <input
              type="number"
              min="1"
              max="999"
              value={draftScreenOptions.pageSize}
              onChange={(e) => setDraftScreenOptions((prev) => ({ ...prev, pageSize: Math.max(1, Number(e.target.value) || 1) }))}
              style={{ width: 70, border: '1px solid #a7aaad', borderRadius: 4, padding: '4px 8px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={panelSectionTitle}>Modo de visualização</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: '0.9rem', flexWrap: 'wrap' }}>
            <label style={checkboxRow}><input type="radio" name="page_view_mode" checked={draftScreenOptions.viewMode === 'compact'} onChange={() => setDraftScreenOptions((prev) => ({ ...prev, viewMode: 'compact' }))} /> Vista compacta</label>
            <label style={checkboxRow}><input type="radio" name="page_view_mode" checked={draftScreenOptions.viewMode === 'expanded'} onChange={() => setDraftScreenOptions((prev) => ({ ...prev, viewMode: 'expanded' }))} /> Vista expandida</label>
          </div>

          <button type="button" style={publishBtn} onClick={applyScreenOptions}>Aplicar</button>

          <button
            type="button"
            style={panelCloseBtn}
            onClick={() => setScreenOptionsOpen(false)}
          >
            Opções deste ecrã ▲
          </button>
        </div>
      )}

      {helpOpen && (
        <div style={{ ...topPanelStyle, padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr' }}>
            <div style={{ borderRight: '1px solid #c3c4c7' }}>
              <button type="button" onClick={() => setHelpTab('visao')} style={{ ...helpTabBtn, background: helpTab === 'visao' ? '#f0f0f1' : '#fff' }}>Visão geral</button>
              <button type="button" onClick={() => setHelpTab('gestao')} style={{ ...helpTabBtn, background: helpTab === 'gestao' ? '#f0f0f1' : '#fff' }}>Gestão de páginas</button>
            </div>
            <div style={{ padding: 14, background: '#eef3f8', minHeight: 110 }}>
              {helpTab === 'visao' ? (
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  As Páginas são semelhantes aos Artigos na medida em que têm também um título, corpo de texto, e metadados associados, mas são diferentes no aspecto de que não estão ligados a uma ordem cronológica, são uma espécie de artigos permanentes. As Páginas não estão categorizadas nem possuem etiquetas, mas podem ser organizadas hierarquicamente. Pode organizar as páginas em subpáginas, tornando-as “dependentes” de outra página, criando assim um grupo de páginas.
                </p>
              ) : (
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  A gestão das páginas é muito semelhante à gestão dos artigos, e os ecrãs podem ser personalizados da mesma forma.
                  <br /><br />
                  Pode também executar os mesmos tipos de acções, incluindo a filtragem da lista, actuar numa página usando as ligações de acção que aparecem quando passa o rato sobre uma linha, ou usando o menu de Edição por lotes, para editar os dados de várias páginas de uma só vez.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            style={panelCloseBtn}
            onClick={() => setHelpOpen(false)}
          >
            Ajuda ▲
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 400 }}>Páginas</h2>
        <button type="button" style={{ ...btnStyle, color: '#2271b1', borderColor: '#2271b1' }} onClick={() => navigate('/paginas/novo')}>
          Adicionar nova página
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            style={{ ...fieldInput, width: 170 }}
          />
          <button type="button" style={btnStyle} onClick={() => setSearch(searchInput)}>Pesquisar páginas</button>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: '0.88rem' }}>
        <FilterLink label="Tudo" count={contTudo} value="tudo" current={filtroEstado} onClick={setFiltroEstado} />
        {' | '}
        <FilterLink label="Publicado" count={contPublicado} value="publicado" current={filtroEstado} onClick={setFiltroEstado} />
        {' | '}
        <FilterLink label="Rascunho" count={contRascunho} value="rascunho" current={filtroEstado} onClick={setFiltroEstado} />
      </div>

      <Toolbar
        acaoBulk={acaoBulk}
        onAcaoBulk={setAcaoBulk}
        filtroData={filtroData}
        onFiltroData={setFiltroData}
        datas={datas}
        total={filtered.length}
        onApply={applyBulk}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #c3c4c7' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #c3c4c7' }}>
            <th style={thStyle('40px')}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
            <th style={thStyle()}>Título ▴▾</th>
            {screenOptions.showAutor && <th style={thStyle('170px')}>Autor</th>}
            {screenOptions.showComentarios && <th style={thStyle('60px')}>💬 ▴▾</th>}
            {screenOptions.showData && <th style={thStyle('210px', '#2271b1')}>Data ▴▾</th>}
          </tr>
        </thead>
        <tbody>
          {pageItems.length === 0 && (
            <tr><td colSpan={visibleColumnCount} style={{ padding: '12px 10px', color: '#646970' }}>Nenhuma página encontrada.</td></tr>
          )}

          {pageItems.map((p, i) => {
            const id = getId(p);
            const titulo = getTitulo(p);
            const estado = getEstado(p);
            const rowBg = i % 2 === 0 ? '#fff' : '#f6f7f7';
            const isQuickEdit = quickEditId === id;

            return (
              <React.Fragment key={id}>
                <tr
                  style={{ borderBottom: '1px solid #e2e4e7', background: rowBg }}
                  onMouseEnter={() => setHoveredRowId(id)}
                  onMouseLeave={() => setHoveredRowId((prev) => (prev === id ? null : prev))}
                >
                  <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                    <input type="checkbox" checked={selected.includes(id)} onChange={() => toggleOne(id)} />
                  </td>
                  <td style={{ padding: screenOptions.viewMode === 'compact' ? '6px 10px' : '10px', verticalAlign: 'top' }}>
                    <button type="button" style={titleLinkBtn} onClick={() => navigate(`/paginas/${id}/editar`)}>{titulo}</button>
                    {estado === 'rascunho' && <span style={{ color: '#646970', fontWeight: 600 }}> — Rascunho, Página de política de privacidade</span>}
                    {hoveredRowId === id && (
                      <div style={{ marginTop: 2, fontSize: '0.88rem' }}>
                        <button type="button" style={linkBtn} onClick={() => navigate(`/paginas/${id}/editar`)}>Editar</button>
                        <span style={sep}>|</span>
                        <button type="button" style={linkBtn} onClick={() => openQuickEdit(p)}>Edição rápida</button>
                        <span style={sep}>|</span>
                        <button type="button" style={{ ...linkBtn, color: '#b32d2e' }} onClick={() => setPaginas((prev) => prev.filter((item) => getId(item) !== id))}>Lixo</button>
                        <span style={sep}>|</span>
                        <button type="button" style={linkBtn} onClick={() => setViewingId((prev) => (prev === id ? null : id))}>Ver</button>
                      </div>
                    )}
                  </td>
                  {screenOptions.showAutor && <td style={{ padding: '10px', verticalAlign: 'top' }}><button type="button" style={linkBtn}>{getAutor(p)}</button></td>}
                  {screenOptions.showComentarios && <td style={{ padding: '10px', verticalAlign: 'top', color: '#646970', textAlign: 'center' }}>—</td>}
                  {screenOptions.showData && (
                    <td style={{ padding: '10px', verticalAlign: 'top', fontSize: '0.9rem' }}>
                      <span style={{ color: '#50575e', display: 'block' }}>{formatEstadoLabel(p)}</span>
                      <span style={{ color: '#646970' }}>{formatData(getData(p))}</span>
                    </td>
                  )}
                </tr>

                {isQuickEdit && (
                  <tr style={{ background: '#f6f7f7', borderBottom: '1px solid #dcdcde' }}>
                    <td colSpan={visibleColumnCount} style={{ padding: '16px 14px' }}>
                      <strong style={{ display: 'block', fontSize: '2rem', marginBottom: 12, fontWeight: 600, letterSpacing: '0.3px' }}>EDIÇÃO RÁPIDA</strong>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                        <div>
                          <label style={qLabel}>Título</label>
                          <input value={quickEditForm.titulo} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, titulo: e.target.value }))} style={{ ...fieldInput, width: '100%' }} />
                        </div>
                        <div>
                          <label style={qLabel}>Superior</label>
                          <select style={{ ...fieldInput, width: '100%' }}><option>Página principal (sem superior)</option></select>
                        </div>

                        <div>
                          <label style={qLabel}>Slug</label>
                          <input value={quickEditForm.slug} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, slug: e.target.value }))} style={{ ...fieldInput, width: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <div>
                            <label style={qLabel}>Ordem</label>
                            <input value="0" readOnly style={{ ...fieldInput, width: 80 }} />
                          </div>
                          <label style={checkboxRow}><input type="checkbox" /> Permitir comentários</label>
                        </div>

                        <div>
                          <label style={{ ...qLabel, fontSize: '2rem', marginBottom: 6, color: '#394149' }}>Data</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <input value={quickEditForm.dia} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, dia: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInput, width: 50, textAlign: 'center' }} />
                            <span>de</span>
                            <select value={quickEditForm.mes} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, mes: e.target.value }))} style={{ ...fieldInput, width: 92 }}>
                              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.value}-{m.label}</option>)}
                            </select>
                            <span>de</span>
                            <input value={quickEditForm.ano} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))} style={{ ...fieldInput, width: 68, textAlign: 'center' }} />
                            <span>às</span>
                            <input value={quickEditForm.hora} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, hora: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInput, width: 50, textAlign: 'center' }} />
                            <input value={quickEditForm.minuto} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, minuto: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInput, width: 50, textAlign: 'center' }} />
                          </div>
                        </div>

                        <div>
                          <label style={qLabel}>Estado</label>
                          <select value={quickEditForm.estado} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, estado: e.target.value }))} style={{ ...fieldInput, width: 160 }}>
                            <option value="publicado">Publicado</option>
                            <option value="rascunho">Rascunho</option>
                          </select>
                        </div>

                        <div>
                          <label style={qLabel}>Autor</label>
                          <input value={quickEditForm.autor} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, autor: e.target.value }))} style={{ ...fieldInput, width: '50%' }} />
                        </div>

                        <div style={{ alignSelf: 'end' }}>
                          <label style={{ ...qLabel, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={quickEditForm.privado} onChange={(e) => setQuickEditForm((prev) => ({ ...prev, privado: e.target.checked }))} /> Privado
                          </label>
                        </div>
                      </div>

                      <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                        <button type="button" style={publishBtn} onClick={saveQuickEdit}>Atualizar</button>
                        <button type="button" style={btnStyle} onClick={closeQuickEdit}>Cancelar</button>
                      </div>
                    </td>
                  </tr>
                )}
                {viewingId === id && (
                  <tr style={{ background: '#fffef7', borderBottom: '1px solid #e2e4e7' }}>
                    <td colSpan={visibleColumnCount} style={{ padding: '14px 16px', color: '#3c434a', lineHeight: 1.6 }}>
                      <strong style={{ display: 'block', marginBottom: 6 }}>Pré-visualização da página</strong>
                      <div><strong>ID:</strong> {id}</div>
                      <div><strong>Título:</strong> {getTitulo(p)}</div>
                      <div><strong>Slug:</strong> {getSlug(p)}</div>
                      <div><strong>Autor:</strong> {getAutor(p)}</div>
                      <div><strong>Estado:</strong> {getEstado(p)}</div>
                      <div><strong>Data:</strong> {formatData(getData(p))}</div>
                      <div style={{ marginTop: 8 }}>
                        <strong>Conteúdo:</strong>
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{getConteudo(p) || 'Sem conteúdo.'}</div>
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
            <th style={thStyle()}>Título ▴▾</th>
            {screenOptions.showAutor && <th style={thStyle('170px')}>Autor</th>}
            {screenOptions.showComentarios && <th style={thStyle('60px')}>💬 ▴▾</th>}
            {screenOptions.showData && <th style={thStyle('210px', '#2271b1')}>Data ▴▾</th>}
          </tr>
        </tfoot>
      </table>

      <Toolbar
        acaoBulk={acaoBulk}
        onAcaoBulk={setAcaoBulk}
        filtroData={filtroData}
        onFiltroData={setFiltroData}
        datas={datas}
        total={filtered.length}
        onApply={applyBulk}
      />
    </div>
  );
}

function Toolbar({ acaoBulk, onAcaoBulk, filtroData, onFiltroData, datas, total, onApply }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 6px', flexWrap: 'wrap' }}>
      <select value={acaoBulk} onChange={(e) => onAcaoBulk(e.target.value)} style={smallSelectStyle}>
        <option value="-1">Acções por lotes</option>
        <option value="delete">Mover para lixo</option>
      </select>
      <button type="button" style={btnStyle} onClick={onApply}>Aplicar</button>
      <select value={filtroData} onChange={(e) => onFiltroData(e.target.value)} style={{ ...smallSelectStyle, marginLeft: 8 }}>
        <option value="">Todas as datas</option>
        {datas.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <button type="button" style={btnStyle}>Filtrar</button>
      <span style={{ marginLeft: 'auto', fontSize: '0.88rem', color: '#50575e' }}>{total} {total === 1 ? 'item' : 'itens'}</span>
    </div>
  );
}

const FilterLink = ({ label, count, value, current, onClick }) => (
  <span>
    {current === value
      ? <strong>{label} ({count})</strong>
      : <button type="button" style={linkBtn} onClick={() => onClick(value)}>{label} ({count})</button>}
  </span>
);

const topPanelStyle = { position: 'relative', background: '#fff', border: '1px solid #c3c4c7', padding: '20px 24px', marginBottom: 42, marginTop: -24, borderRadius: 3, boxShadow: 'none' };
const panelSectionTitle = { fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' };
const panelToggleBtn = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '6px 12px', whiteSpace: 'nowrap', fontSize: '0.88rem', color: '#50575e', cursor: 'pointer' };
const panelCloseBtn = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, position: 'absolute', right: 0, bottom: -31, padding: '6px 12px', whiteSpace: 'nowrap', fontSize: '0.88rem', color: '#50575e', borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, zIndex: 2, cursor: 'pointer' };
const helpTabBtn = { width: '100%', border: 'none', borderBottom: '1px solid #c3c4c7', textAlign: 'left', padding: '14px 14px', fontSize: '1.1rem', color: '#2271b1' };
const btnStyle = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '3px 10px', fontSize: '0.88rem', cursor: 'pointer', color: '#1d2327' };
const publishBtn = { background: '#78a659', border: '1px solid #78a659', borderRadius: 3, padding: '5px 12px', fontSize: '0.88rem', cursor: 'pointer', color: '#fff', fontWeight: 600 };
const smallSelectStyle = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '3px 8px', fontSize: '0.88rem' };
const fieldInput = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '3px 8px', fontSize: '0.88rem', boxSizing: 'border-box' };
const thStyle = (width, color) => ({ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem', color: color || '#1d2327', width: width || 'auto', background: '#f6f7f7' });
const linkBtn = { background: 'none', border: 'none', color: '#2271b1', cursor: 'pointer', padding: 0, fontSize: '0.88rem', textDecoration: 'none' };
const titleLinkBtn = { background: 'none', border: 'none', color: '#2271b1', cursor: 'pointer', padding: 0, fontSize: '0.93rem', fontWeight: 600, textAlign: 'left' };
const qLabel = { display: 'block', marginBottom: 4, color: '#50575e' };
const checkboxRow = { display: 'flex', alignItems: 'center', gap: 6 };
const sep = { color: '#646970', margin: '0 4px' };

