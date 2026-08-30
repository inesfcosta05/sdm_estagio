import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import '../api';

const normalizeKey = (value) => (value || '').toString().trim().toLowerCase();

const toDateOnly = (value) => {
  if (value === 0) return '';
  if (!value) return '';
  const raw = value.toString();
  const rawTrim = raw.trim();
  if (!rawTrim || rawTrim === '0' || rawTrim === '0000-00-00' || rawTrim === '0000-00-00 00:00:00') return '';
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const ptMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (ptMatch) {
    const [, dd, mm, yyyy] = ptMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toDatePt = (value) => {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return '—';
  const [yyyy, mm, dd] = dateOnly.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const isAdjudicada = (ficha) => {
  const estado = (ficha.estado_proposta || '').toString().trim().toLowerCase();
  if (estado.includes('adjud')) return true;
  if ((ficha.servicos_adjudicados || '').toString().trim()) return true;
  if ((ficha.valor_total_adjudicado || '').toString().trim()) return true;
  if (hasKeyword(getReportBlob(ficha), /adjudic|aceit|fechad|confirmad/i)) return true;
  return false;
};

const hasProposta = (ficha) => {
  if (toDateOnly(ficha.data_apresentacao_proposta)) return true;
  if ((ficha.descritivo_proposta || '').toString().trim()) return true;
  if ((ficha.servicos_proposta || '').toString().trim()) return true;
  const blob = [
    ficha.title,
    ficha.titulo,
    ficha.post_title,
    ficha.post_content,
    ficha.estado_proposta,
    ficha.descritivo_proposta,
    ficha.servicos_proposta,
    ficha.servicos_adjudicados,
    ficha.valor_total_proposta,
    ficha.valor_total_adjudicado
  ]
    .map((value) => (value || '').toString().trim())
    .filter(Boolean)
    .join(' ');

  return hasKeyword(blob, /propost|orçament|orcament|adjudic/i);
};

const cleanReportText = (value) => {
  const raw = (value || '').toString().trim();
  if (!raw) return '';
  if (/^\[\s*\]$/.test(raw)) return '';
  return raw;
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = (value || '').toString().trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'sim' || normalized === 'yes';
};

const asText = (...values) => {
  for (const value of values) {
    const text = cleanReportText(value);
    if (text) return text;
  }
  return '';
};

const cleanManagerName = (value) => {
  const raw = cleanReportText(value);
  if (!raw) return '—';

  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) return parenMatch[1].trim();

  if (raw.includes('/')) return raw.split('/')[0].trim();
  if (raw.includes(',')) return raw.split(',')[0].trim();
  if (raw.includes('|')) return raw.split('|')[0].trim();

  return raw;
};

const getReportBlob = (ficha) => [
  ficha.title,
  ficha.titulo,
  ficha.post_title,
  ficha.post_content,
  ficha.estado_proposta,
  ficha.descritivo_proposta,
  ficha.servicos_proposta,
  ficha.servicos_adjudicados,
  ficha.motivo_resumo_contacto,
  ficha.motivo_tipo_proximo_contacto,
  ficha.tipo_proximo_contacto,
  ficha.contacto_efetuado,
  ficha.follow_up,
  ficha.novo_contacto,
  ficha.assunto_tratado
]
  .map((value) => (value || '').toString().trim())
  .filter(Boolean)
  .join(' ');

const hasKeyword = (text, pattern) => pattern.test((text || '').toString().toLowerCase());

const normalizeRole = (role) => {
  const raw = (role || '').toString().trim().toLowerCase();
  if (raw === 'administrator' || raw === 'administrador' || raw === 'admin') return 'admin';
  if (raw === 'contributor' || raw === 'contribuidor') return 'contributor';
  if (raw === 'editor' || raw === 'editora') return 'editor';
  return raw || 'editor';
};

const groupItemsByDate = (items, getDateValue) => {
  const groups = new Map();

  items.forEach((item) => {
    const dateKey = toDateOnly(getDateValue(item)) || 'sem-data';
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(item);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === 'sem-data') return 1;
      if (b === 'sem-data') return -1;
      return b.localeCompare(a);
    })
    .map(([dateKey, groupedItems]) => ({
      dateKey,
      dateLabel: dateKey === 'sem-data' ? 'Sem data' : toDatePt(dateKey),
      items: groupedItems
    }));
};

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Groups items by calendar month (year-month), oldest month first, with each
// group's items sorted chronologically by their exact date — used by
// "Contactos a Efetuar" so each month gets its own heading (e.g. "Janeiro de
// 2026") instead of one heading per exact day.
const groupItemsByMonth = (items, getDateValue) => {
  const groups = new Map();

  items.forEach((item) => {
    const dateOnly = toDateOnly(getDateValue(item));
    const monthKey = dateOnly ? dateOnly.slice(0, 7) : 'sem-data';
    if (!groups.has(monthKey)) groups.set(monthKey, []);
    groups.get(monthKey).push(item);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === 'sem-data') return 1;
      if (b === 'sem-data') return -1;
      return a.localeCompare(b);
    })
    .map(([monthKey, groupedItems]) => {
      const items = [...groupedItems].sort((a, b) => {
        const da = toDateOnly(getDateValue(a));
        const db = toDateOnly(getDateValue(b));
        return da.localeCompare(db);
      });

      const monthLabel = monthKey === 'sem-data'
        ? 'Sem data'
        : `${MESES_PT[Number(monthKey.slice(5, 7)) - 1]} de ${monthKey.slice(0, 4)}`;

      return { monthKey, monthLabel, items };
    });
};

export default function Relatorios({ user = null }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tipo = searchParams.get('tipo') || 'propostas-adjudicadas';

  const [fichas, setFichas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [comerciais, setComerciais] = useState([]);
  const [loading, setLoading] = useState(true);

  const [clienteAdj, setClienteAdj] = useState('Todos');
  const [clienteProp, setClienteProp] = useState('Todos');
  const [dataContactos, setDataContactos] = useState('');
  const [gestor, setGestor] = useState('Todos');
  const [clienteGC, setClienteGC] = useState('Todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [submittedClienteAdj, setSubmittedClienteAdj] = useState('Todos');
  const [submittedClienteProp, setSubmittedClienteProp] = useState('Todos');
  const [submittedDataContactos, setSubmittedDataContactos] = useState('');
  const [submittedGC, setSubmittedGC] = useState({ gestor: 'Todos', cliente: 'Todos', dataInicio: '', dataFim: '' });
  const [showContactos, setShowContactos] = useState(false);
  const [expandedDatasPropostas, setExpandedDatasPropostas] = useState({});
  const [expandedDatasContactos, setExpandedDatasContactos] = useState({});
  const [showGestorClientes, setShowGestorClientes] = useState(false);
  const [expandedGestoresClientes, setExpandedGestoresClientes] = useState({});
  const [expandedDatasGestorClientes, setExpandedDatasGestorClientes] = useState({});

  const [pesquisaPropostas, setPesquisaPropostas] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchAll = () => Promise.all([
      axios.get('/api/fichas').catch(() => ({ data: [] })),
      axios.get('/api/clientes').catch(() => ({ data: [] })),
      axios.get('/api/comerciais').catch(() => ({ data: [] }))
    ]).then(([fRes, cRes, mRes]) => {
      if (!mounted) return;
      setFichas(Array.isArray(fRes.data) ? fRes.data : []);
      setClientes(Array.isArray(cRes.data) ? cRes.data : []);
      setComerciais(Array.isArray(mRes.data) ? mRes.data : []);
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setFichas([]);
      setClientes([]);
      setComerciais([]);
      setLoading(false);
    });

    // initial fetch
    fetchAll();
    // poll every 60s to keep reports updated
    const intervalId = setInterval(fetchAll, 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const clienteByAnyKey = useMemo(() => {
    const map = new Map();
    clientes.forEach((cliente) => {
      [
        cliente.id,
        cliente.legacy_id,
        cliente.client_legacy_id,
        cliente.client_id,
        cliente.cliente_id,
        cliente.denominacao_fiscal,
        cliente.nome,
        cliente.client_name,
        cliente.cliente,
        cliente.client,
        cliente.nome_cliente,
        cliente.cliente_nome,
        cliente.nomeCliente,
        cliente.contacto_empresa,
        cliente.pessoa_contacto_nome
      ]
        .filter((value) => value !== undefined && value !== null && value !== '')
        .forEach((value) => map.set(normalizeKey(value), cliente));
    });
    return map;
  }, [clientes]);

  const getClienteRaw = (ficha) => ficha.cliente || ficha.cliente_nome || ficha.clienteNome || ficha.nome_cliente || ficha.nomeCliente || ficha.client_name || ficha.client || ficha.denominacao_fiscal || ficha.client_legacy_id || ficha.cliente_legacy_id || ficha.client_id || ficha.cliente_id || ficha.nome || ficha.title || ficha.post_title;

  const getClienteNome = (ficha) => {
    const raw = getClienteRaw(ficha);
    if (raw === undefined || raw === null || raw === '') return '—';
    const mapped = clienteByAnyKey.get(normalizeKey(raw));
    const nome = mapped?.denominacao_fiscal || mapped?.nome || raw;
    return nome.toString().trim() || '—';
  };

  const getClienteId = (ficha) => {
    const raw = getClienteRaw(ficha);
    const mapped = clienteByAnyKey.get(normalizeKey(raw));
    if (!mapped && raw) {
      const byName = clientes.find((cliente) => {
        const nome = (cliente.denominacao_fiscal || cliente.nome || cliente.client_name || '').toString().trim().toLowerCase();
        return nome && nome === raw.toString().trim().toLowerCase();
      });
      return byName?.id || byName?.legacy_id || null;
    }
    return mapped?.id || mapped?.legacy_id || null;
  };

  const gestorMap = useMemo(() => {
    const map = new Map();
    comerciais.forEach((item) => {
      const label = cleanManagerName(item.label || item.display_name || item.username || item.value || item.name || item.displayName || '');
      if (!label) return;
      [item.value, item.username, item.id, label, item.label, item.display_name, item.name, item.displayName, item.user_nicename]
        .filter((value) => value !== undefined && value !== null && value !== '')
        .forEach((value) => map.set(normalizeKey(cleanManagerName(value)), label));
    });
    return map;
  }, [comerciais]);

  const gestorIdMap = useMemo(() => {
    const idMap = new Map();
    comerciais.forEach((item) => {
      const label = cleanManagerName(item.label || item.display_name || item.username || item.value || item.name || item.displayName || '');
      if (!label) return;
      if (item.id !== undefined && item.id !== null) idMap.set(String(item.id), label);
      if (item.value !== undefined && item.value !== null) idMap.set(String(item.value), label);
      if (item.username) idMap.set(String(item.username), label);
    });
    return idMap;
  }, [comerciais]);

  const getGestor = useCallback((ficha) => {
    const candidates = [ficha.comercial_id, ficha.author, ficha.autor, ficha.gestor, ficha.nome_autor, ficha.nomeAutor, ficha.user];
    for (const raw of candidates) {
      if (raw === undefined || raw === null || raw === '') continue;
      const rawStr = String(raw).trim();
      // try id-based mapping first
      const byId = gestorIdMap.get(rawStr);
      if (byId) return byId;
      // try normalized name mapping
      const cleaned = cleanManagerName(rawStr);
      const mapped = gestorMap.get(normalizeKey(cleaned));
      if (mapped) return mapped;
      // fallback to cleaned name
      if (cleaned && cleaned !== '—') return cleaned;
    }
    return '—';
  }, [gestorMap, gestorIdMap]);

  const normalizedRole = normalizeRole(user?.role);
  const isCurrentUserPrivileged = normalizedRole === 'editor' || normalizedRole === 'contributor' || normalizedRole === 'admin';
  const allGestorNames = useMemo(() => {
    const fromComerciais = comerciais
      .map((item) => cleanManagerName(item.label || item.display_name || item.username || item.value || ''))
      .filter((name) => name && name !== '—');

    const fromFichas = fichas
      .map((ficha) => getGestor(ficha))
      .filter((name) => name && name !== '—');

    return [...new Set([...fromComerciais, ...fromFichas])].sort((a, b) => a.localeCompare(b, 'pt'));
  }, [comerciais, fichas, getGestor]);

  const currentUserIdentityKeys = useMemo(() => {
    const keys = new Set();
    [
      user?.username,
      user?.email,
      user?.name,
      user?.displayName,
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    ]
      .filter((value) => value !== undefined && value !== null && value !== '')
      .forEach((value) => {
        const raw = (value || '').toString().trim();
        if (!raw) return;
        keys.add(normalizeKey(raw));
        keys.add(normalizeKey(cleanManagerName(raw)));
      });
    return keys;
  }, [user]);

  const visibleFichas = (() => {
    if (!user || isCurrentUserPrivileged) return fichas;

    return fichas.filter((ficha) => {
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
        return currentUserIdentityKeys.has(normalizeKey(raw)) || currentUserIdentityKeys.has(normalizeKey(cleanManagerName(raw)));
      });
    });
  })();

  const getFichaId = (ficha) => ficha.id || ficha.legacy_id || ficha.ID;
  const getFichaTitulo = (ficha) => asText(ficha.title, ficha.titulo, ficha.post_title, ficha.tipo_contacto, ficha.nome) || '(sem título)';
  const getPropostaTitulo = (ficha) => {
    const descritivo = cleanReportText(ficha.descritivo_proposta);
    const servicos = cleanReportText(ficha.servicos_proposta);
    const titulo = cleanReportText(ficha.title || ficha.titulo || ficha.post_title);
    return descritivo || servicos || titulo || '(sem título)';
  };

  const getPropostaData = (ficha) => ficha.data_apresentacao_proposta || ficha.created_at || ficha.updated_at;
  // "Contactos a Efetuar" só existe para fichas com data do PRÓXIMO contacto
  // preenchida — sem fallback para data_contacto/created_at/updated_at, que
  // são datas de contactos já passados, não do que falta fazer.
  const getContactoData = (ficha) => ficha.data_proximo_contacto;
  const getGestorClienteData = (item) => item.dataContacto;
  const getSummaryFlag = (ficha, names) => names.some((name) => toBool(ficha[name]));
  const getDuracaoLabel = (ficha) => {
    const direct = asText(ficha.duracao_contacto, ficha.duracao);
    if (direct) return direct;
    const ini = asText(ficha.hora_inicio_contacto, ficha.hora_inicio);
    const fim = asText(ficha.hora_fim_contacto, ficha.hora_fim);
    if (ini || fim) return `${ini || '--:--'} - ${fim || '--:--'}`;
    return '—';
  };

  const withDerivedSignals = (item) => {
    const motivo = `${item.motivoResumo || ''} ${item.motivoTipoProximo || ''}`;
    const hasNextContact = !!item.dataProximoContacto || !!cleanReportText(item.motivoTipoProximo);

    return {
      ...item,
      sinalRealizado: item.contactoEfetuado || !!item.dataContacto,
      sinalFollowUp: item.followUp || hasKeyword(motivo, /follow\s*up/),
      sinalReforco: item.reforcoPedido || hasKeyword(motivo, /reforc|reforço|insist|voltar\s+a\s+ligar/),
      sinalNovo: item.novoContacto || hasKeyword(motivo, /novo\s+contact|nova\s+abordagem|prospe/),
      sinalDesmarcado: item.contactoDesmarcado || hasKeyword(motivo, /desmarcad|nao\s+atendeu|não\s+atendeu|sem\s+resposta|nao\s+atende/),
      sinalAgendado: hasNextContact
    };
  };
  const clienteOptions = (() => {
    const fromFichas = visibleFichas
      .map((ficha) => getClienteNome(ficha))
      .filter((name) => name && name !== '—');

    const fromClientes = clientes
      .map((cliente) => (cliente.denominacao_fiscal || cliente.nome || cliente.client_name || cliente.cliente_nome || cliente.nome_cliente || '').toString().trim())
      .filter(Boolean);

    const names = [...new Set([...fromFichas, ...fromClientes])].sort((a, b) => a.localeCompare(b, 'pt'));
    return ['Todos', ...names];
  })();

  const gestorOptions = (() => {
    const source = allGestorNames.length
      ? allGestorNames
      : [...new Set(visibleFichas.map((ficha) => getGestor(ficha)).filter((name) => name && name !== '—'))]
        .sort((a, b) => a.localeCompare(b, 'pt'));

    return source.length ? ['Todos', ...source] : ['Todos'];
  })();

  useEffect(() => {
    if (isCurrentUserPrivileged) return;
    if (!gestorOptions.length) return;
    const fallbackGestor = gestorOptions[0];
    if (!gestorOptions.includes(gestor)) setGestor(fallbackGestor);
    if (!gestorOptions.includes(submittedGC.gestor)) {
      setSubmittedGC((prev) => ({ ...prev, gestor: fallbackGestor }));
    }
  }, [isCurrentUserPrivileged, gestorOptions, gestor, submittedGC.gestor]);

  useEffect(() => {
    if (tipo === 'gestores') {
      setShowGestorClientes(true);
    }
  }, [tipo]);

  const propostasFiltradas = (() => {
    const byTipo = visibleFichas.filter((ficha) => hasProposta(ficha));
    const byEstado = tipo === 'propostas-adjudicadas'
      ? byTipo.filter((ficha) => isAdjudicada(ficha))
      : byTipo.filter((ficha) => !isAdjudicada(ficha));
    const byCliente = (tipo === 'propostas-adjudicadas' ? submittedClienteAdj : submittedClienteProp) === 'Todos'
      ? byEstado
      : byEstado.filter((ficha) => getClienteNome(ficha) === (tipo === 'propostas-adjudicadas' ? submittedClienteAdj : submittedClienteProp));

    const pesquisa = pesquisaPropostas.trim().toLowerCase();
    const byPesquisa = !pesquisa
      ? byCliente
      : byCliente.filter((ficha) => {
        const composed = `${toDatePt(ficha.data_apresentacao_proposta)} ${getPropostaTitulo(ficha)} ${getClienteNome(ficha)}`.toLowerCase();
        return composed.includes(pesquisa);
      });

    return [...byPesquisa].sort((a, b) => {
      const da = toDateOnly(getPropostaData(a));
      const db = toDateOnly(getPropostaData(b));
      return db.localeCompare(da);
    });
  })();

  const propostasAgrupadasPorData = useMemo(
    () => groupItemsByDate(propostasFiltradas, getPropostaData),
    [propostasFiltradas]
  );

  const contactosFiltrados = (() => {
    const contactosBase = visibleFichas.filter((ficha) => !!toDateOnly(ficha.data_proximo_contacto));

    const filtrados = submittedDataContactos
      ? contactosBase.filter((ficha) => toDateOnly(ficha.data_proximo_contacto) === submittedDataContactos)
      : contactosBase;

    return filtrados
      .sort((a, b) => {
        const da = toDateOnly(getContactoData(a));
        const db = toDateOnly(getContactoData(b));
        const byDate = da.localeCompare(db);
        if (byDate !== 0) return byDate;

        const ca = String(getClienteNome(a)).toLowerCase();
        const cb = String(getClienteNome(b)).toLowerCase();
        return ca.localeCompare(cb, 'pt');
      });
  })();

  const contactosAgrupadosPorMes = useMemo(
    () => groupItemsByMonth(contactosFiltrados, getContactoData),
    [contactosFiltrados]
  );

  const gestorClientesFiltrados = (() => {
    const base = visibleFichas.map((ficha) => withDerivedSignals({
      fichaId: getFichaId(ficha),
      fichaTitulo: getFichaTitulo(ficha),
      gestorNome: getGestor(ficha),
      clienteNome: getClienteNome(ficha),
      clienteId: getClienteId(ficha),
      dataContacto: toDateOnly(ficha.data_contacto || ficha.post_date || ficha.created_at || ficha.updated_at),
      dataProximoContacto: toDateOnly(ficha.data_proximo_contacto),
      duracao: getDuracaoLabel(ficha),
      tipoContacto: asText(ficha.tipo_contacto, ficha.tipo_contato) || '—',
      contactoEfetuado: getSummaryFlag(ficha, ['contacto_efetuado', 'contactoEfetuado', 'contacto_efetuado_flag']),
      motivoResumo: asText(ficha.motivo_resumo_contacto, ficha.motivo_resumo, ficha.post_content) || '—',
      motivoTipoProximo: asText(ficha.motivo_tipo_proximo_contacto, ficha.tipo_proximo_contacto, ficha.motivo_proximo_contacto) || '—',
      assuntoTratado: getSummaryFlag(ficha, ['assunto_tratado', 'assuntoTratado', 'assunto_tratado_flag']),
      followUp: getSummaryFlag(ficha, ['follow_up', 'followUp']),
      reforcoPedido: getSummaryFlag(ficha, ['reforcos_pedidos_contacto', 'reforco_pedido_contacto', 'reforco_pedido']),
      novoContacto: getSummaryFlag(ficha, ['novo_contacto', 'novoContacto']),
      contactoDesmarcado: getSummaryFlag(ficha, ['contacto_desmarcado', 'contactoDesmarcado'])
    }));

    const { gestor: subGestor, cliente: subCliente, dataInicio: subDataInicio, dataFim: subDataFim } = submittedGC;
    
    const filtered = base.filter(item => {
      const normalizedItemGestor = normalizeKey(cleanManagerName(item.gestorNome));
      const normalizedSubGestor = normalizeKey(cleanManagerName(subGestor));
      const byGestor = subGestor === 'Todos' ? true : normalizedItemGestor === normalizedSubGestor;

      const normalizedItemCliente = normalizeKey(item.clienteNome || '');
      const normalizedSubCliente = normalizeKey(subCliente || '');
      const byCliente = subCliente === 'Todos' ? true : normalizedItemCliente === normalizedSubCliente;

      const byDataInicio = !subDataInicio ? true : (item.dataContacto && item.dataContacto >= subDataInicio);
      const byDataFim = !subDataFim ? true : (item.dataContacto && item.dataContacto <= subDataFim);

      return byGestor && byCliente && byDataInicio && byDataFim;
    });

    return filtered.sort((a, b) => {
      const g = a.gestorNome.localeCompare(b.gestorNome, 'pt');
      if (g !== 0) return g;
      const d = (b.dataContacto || '').localeCompare(a.dataContacto || '');
      if (d !== 0) return d;
      return a.fichaTitulo.localeCompare(b.fichaTitulo, 'pt');
    });
  }, [visibleFichas, submittedGC]);

  const gestorClientesAgrupadosPorGestor = useMemo(() => {
    const groups = new Map();

    gestorClientesFiltrados.forEach((item) => {
      const gestorNome = (cleanManagerName(item.gestorNome) === '—' ? '' : cleanManagerName(item.gestorNome)) || 'Sem gestor';
      if (!groups.has(gestorNome)) groups.set(gestorNome, []);
      groups.get(gestorNome).push(item);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt'))
      .map(([gestorNome, items]) => ({
        gestorNome,
        resumo: {
          agendados: items.filter((item) => item.sinalAgendado).length,
          followUp: items.filter((item) => item.sinalFollowUp).length,
          reforcos: items.filter((item) => item.sinalReforco).length,
          realizados: items.filter((item) => item.sinalRealizado).length,
          novos: items.filter((item) => item.sinalNovo).length,
          desmarcados: items.filter((item) => item.sinalDesmarcado).length
        },
        datas: groupItemsByDate(items, getGestorClienteData)
      }));
  }, [gestorClientesFiltrados]);

  const resumoGlobalGestorClientes = useMemo(() => ({
    agendados: gestorClientesFiltrados.filter((item) => item.sinalAgendado).length,
    followUp: gestorClientesFiltrados.filter((item) => item.sinalFollowUp).length,
    reforcos: gestorClientesFiltrados.filter((item) => item.sinalReforco).length,
    realizados: gestorClientesFiltrados.filter((item) => item.sinalRealizado).length,
    novos: gestorClientesFiltrados.filter((item) => item.sinalNovo).length,
    desmarcados: gestorClientesFiltrados.filter((item) => item.sinalDesmarcado).length
  }), [gestorClientesFiltrados]);

  const exportGestorClientesToExcel = () => {
    if (gestorClientesFiltrados.length === 0) return;
    const workbook = XLSX.utils.book_new();

    const usedSheetNames = new Set();
    const getUniqueSheetName = (baseName) => {
      const cleaned = String(baseName || 'Sem gestor')
        .replace(/[\\/?*:]/g, ' ')
        .replace(/\[/g, ' ')
        .replace(/\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Sem gestor';
      const maxLen = 31;
      let candidate = cleaned.slice(0, maxLen);
      let n = 2;

      while (usedSheetNames.has(candidate)) {
        const suffix = ` (${n})`;
        candidate = `${cleaned.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`;
        n += 1;
      }

      usedSheetNames.add(candidate);
      return candidate;
    };

    const resumoAoa = [];
    resumoAoa.push(['Gestores']);
    resumoAoa.push([]);
    resumoAoa.push(['Resumo Global']);
    resumoAoa.push(['Nº de Contactos Agendados', resumoGlobalGestorClientes.agendados]);
    resumoAoa.push(['Nº de Follow Up', resumoGlobalGestorClientes.followUp]);
    resumoAoa.push(['Nº de Reforços de Pedidos de Contacto', resumoGlobalGestorClientes.reforcos]);
    resumoAoa.push(['Nº de Contactos Realizados', resumoGlobalGestorClientes.realizados]);
    resumoAoa.push(['Nº de Novos Contactos', resumoGlobalGestorClientes.novos]);
    resumoAoa.push(['Nº de Contactos Desmarcados', resumoGlobalGestorClientes.desmarcados]);
    resumoAoa.push([]);

    const resumoSheet = XLSX.utils.aoa_to_sheet(resumoAoa);
    resumoSheet['!cols'] = [{ wch: 46 }, { wch: 14 }];
    const resumoSheetName = getUniqueSheetName('Resumo Geral');
    XLSX.utils.book_append_sheet(workbook, resumoSheet, resumoSheetName);

    gestorClientesAgrupadosPorGestor.forEach((gestorGrupo) => {
      const aoa = [];
      aoa.push([`Gestor: ${gestorGrupo.gestorNome}`]);
      aoa.push([]);
      aoa.push(['Resumo do Gestor']);
      aoa.push(['Nº de Contactos Agendados', gestorGrupo.resumo.agendados]);
      aoa.push(['Nº de Follow Up', gestorGrupo.resumo.followUp]);
      aoa.push(['Nº de Reforços de Pedidos de Contacto', gestorGrupo.resumo.reforcos]);
      aoa.push(['Nº de Contactos Realizados', gestorGrupo.resumo.realizados]);
      aoa.push(['Nº de Novos Contactos', gestorGrupo.resumo.novos]);
      aoa.push(['Nº de Contactos Desmarcados', gestorGrupo.resumo.desmarcados]);
      aoa.push([]);
      aoa.push([
        'Data',
        'Ficha',
        'Cliente',
        'Duração',
        'Tipo de contacto',
        'Contacto efetuado?',
        'Motivo/Resumo do Contacto',
        'Motivo/Tipo do Próximo Contacto',
        'Data do Próximo Contacto',
        'Assunto Tratado?'
      ]);

      gestorGrupo.datas.forEach((grupo) => {
        grupo.items.forEach((item) => {
          aoa.push([
            grupo.dateLabel,
            item.fichaTitulo,
            item.clienteNome,
            item.duracao,
            item.tipoContacto,
            item.contactoEfetuado ? 'Sim' : 'Não',
            item.motivoResumo,
            item.motivoTipoProximo,
            item.dataProximoContacto ? toDatePt(item.dataProximoContacto) : '—',
            item.assuntoTratado ? 'Sim' : 'Não'
          ]);
        });
      });

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet['!cols'] = [
        { wch: 18 },
        { wch: 42 },
        { wch: 36 },
        { wch: 14 },
        { wch: 18 },
        { wch: 16 },
        { wch: 48 },
        { wch: 36 },
        { wch: 18 },
        { wch: 16 }
      ];

      const sheetName = getUniqueSheetName(gestorGrupo.gestorNome);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const parts = [];
    if (submittedGC.gestor !== 'Todos') parts.push(submittedGC.gestor);
    if (submittedGC.cliente !== 'Todos') parts.push(submittedGC.cliente);
    if (submittedGC.dataInicio) parts.push(`de_${submittedGC.dataInicio}`);
    if (submittedGC.dataFim) parts.push(`ate_${submittedGC.dataFim}`);
    const suffix = parts.length ? `_${parts.join('_').replace(/[^a-z0-9_-]+/gi, '_')}` : '';

    XLSX.writeFile(workbook, `relatorio_gestor_cliente${suffix}.xlsx`);
  };

  const titles = {
    'propostas-adjudicadas': 'Propostas Adjudicadas',
    propostas: 'Propostas',
    'contactos-a-efetuar': 'Contactos a Efetuar',
    gestores: 'Gestores',
    clientes: 'Clientes'
  };

  return (
    <div style={pageStyle}>
      <h2 style={{ fontWeight: 400, fontSize: '1.8rem', marginBottom: 20 }}>
        {titles[tipo] || 'Relatórios'}
      </h2>

      {loading && <p style={{ marginTop: 6 }}>A carregar dados...</p>}

      {tipo === 'propostas-adjudicadas' && (
        <>
          <div style={rowStyle}>
            <label style={labelStyle}>Cliente</label>
            <select value={clienteAdj} onChange={(e) => setClienteAdj(e.target.value)} style={selectStyle}>
              {clienteOptions.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button
              type="button"
              style={actionBtn}
              onClick={() => {
                setSubmittedClienteAdj(clienteAdj);
                setExpandedDatasPropostas({});
              }}
            >
              Ver propostas adjudicadas
            </button>
          </div>

          <ResultadosPropostas
            clienteSelecionado={submittedClienteAdj}
            pesquisa={pesquisaPropostas}
            setPesquisa={setPesquisaPropostas}
            grupos={propostasAgrupadasPorData}
            expandedDatasPropostas={expandedDatasPropostas}
            setExpandedDatasPropostas={setExpandedDatasPropostas}
            onOpenFicha={(id) => navigate(`/fichas/${id}/editar`)}
            getFichaId={getFichaId}
            getPropostaTitulo={getPropostaTitulo}
            getClienteNome={getClienteNome}
          />
        </>
      )}

      {tipo === 'propostas' && (
        <>
          <div style={rowStyle}>
            <label style={labelStyle}>Cliente</label>
            <select value={clienteProp} onChange={(e) => setClienteProp(e.target.value)} style={selectStyle}>
              {clienteOptions.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button
              type="button"
              style={actionBtn}
              onClick={() => {
                setSubmittedClienteProp(clienteProp);
                setExpandedDatasPropostas({});
              }}
            >
              Ver propostas
            </button>
          </div>

          <ResultadosPropostas
            clienteSelecionado={submittedClienteProp}
            pesquisa={pesquisaPropostas}
            setPesquisa={setPesquisaPropostas}
            grupos={propostasAgrupadasPorData}
            expandedDatasPropostas={expandedDatasPropostas}
            setExpandedDatasPropostas={setExpandedDatasPropostas}
            onOpenFicha={(id) => navigate(`/fichas/${id}/editar`)}
            getFichaId={getFichaId}
            getPropostaTitulo={getPropostaTitulo}
            getClienteNome={getClienteNome}
          />
        </>
      )}

      {tipo === 'contactos-a-efetuar' && (
        <>
          <div style={rowStyle}>
            <label style={labelStyle}>Data</label>
            <input type="date" value={dataContactos} onChange={(e) => setDataContactos(e.target.value)} style={dateInputStyle} />
            <button
              type="button"
              style={actionBtn}
              onClick={() => {
                setSubmittedDataContactos(dataContactos);
                setShowContactos(true);
                setExpandedDatasContactos({});
              }}
            >
              Ver contactos a efetuar
            </button>
          </div>

          {showContactos && (
            <div style={{ marginTop: 18 }}>
              <h3 style={reportHeading}>
                {submittedDataContactos ? `Clientes a contactar em: ${toDatePt(submittedDataContactos)}` : 'Clientes a contactar'}
              </h3>
              {contactosFiltrados.length === 0 ? (
                <p style={{ marginTop: 8 }}>Sem contactos para esta data.</p>
              ) : (
                <div style={listStyle}>
                  {contactosAgrupadosPorMes.map((grupo) => (
                    <div key={`mes-${grupo.monthKey}`} style={dateSectionStyle}>
                      <button
                        type="button"
                        style={dateToggleSimpleStyle}
                        onClick={() => {
                          setExpandedDatasContactos((prev) => ({
                            ...prev,
                            [grupo.monthKey]: !(prev[grupo.monthKey] ?? true)
                          }));
                        }}
                      >
                        <span style={dateChevronSimpleStyle}>{(expandedDatasContactos[grupo.monthKey] ?? true) ? '▼' : '▶'}</span>
                        <span style={dateHeadingStyle}>{grupo.monthLabel}</span>
                        <span style={dateCountSimpleStyle}>({grupo.items.length})</span>
                      </button>

                      {(expandedDatasContactos[grupo.monthKey] ?? true) && grupo.items.map((ficha) => {
                        const clienteId = getClienteId(ficha);
                        const clienteNome = getClienteNome(ficha);
                        return (
                          <div key={`contacto-${getFichaId(ficha)}`} style={dateRowStyle}>
                            <span>{toDatePt(ficha.data_proximo_contacto)} — {getGestor(ficha)} - </span>
                            <button
                              type="button"
                              style={reportLinkStyle}
                              onClick={() => {
                                if (clienteId) navigate(`/clientes/${clienteId}/editar`);
                              }}
                              disabled={!clienteId}
                              title={clienteId ? 'Editar cliente' : 'Cliente sem ligação'}
                            >
                              {clienteNome}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tipo === 'gestores' && (
        <>
          <div style={gcGridStyle}>
            <div style={gcFieldStyle}>
              <label style={gcLabelStyle}>Gestor</label>
              <select value={gestor} onChange={(e) => setGestor(e.target.value)} style={gcControlStyle}>
                {gestorOptions.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div style={gcFieldStyle}>
              <label style={gcLabelStyle}>Cliente</label>
              <select value={clienteGC} onChange={(e) => setClienteGC(e.target.value)} style={gcControlStyle}>
                {clienteOptions.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={gcFieldStyle}>
              <label style={{ ...gcLabelStyle, color: '#c0392b' }}>Data de Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={gcControlStyle} />
            </div>
            <div style={gcFieldStyle}>
              <label style={{ ...gcLabelStyle, color: '#c0392b' }}>Data de Fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={gcControlStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              style={actionBtn}
              onClick={() => {
                setSubmittedGC({ gestor, cliente: clienteGC, dataInicio, dataFim });
                setShowGestorClientes(true);
              }}
            >
              Filtrar
            </button>
            <button
              type="button"
              style={clearBtn}
              onClick={() => {
                setGestor(isCurrentUserPrivileged ? 'Todos' : (gestorOptions[0] || 'Todos'));
                setClienteGC('Todos');
                setDataInicio('');
                setDataFim('');
                setSubmittedGC({ gestor: isCurrentUserPrivileged ? 'Todos' : (gestorOptions[0] || 'Todos'), cliente: 'Todos', dataInicio: '', dataFim: '' });
                setShowGestorClientes(true);
                setExpandedGestoresClientes({});
                setExpandedDatasGestorClientes({});
              }}
            >
              Limpar
            </button>
            <button
              type="button"
              style={exportBtn}
              onClick={exportGestorClientesToExcel}
              disabled={gestorClientesFiltrados.length === 0}
            >
              Exportar para Excel
            </button>
          </div>

          {showGestorClientes && (
            <div style={{ marginTop: 18 }}>
              <h3 style={reportHeading}>Clientes por Gestor</h3>
              {gestorClientesFiltrados.length === 0 ? (
                <p>Sem resultados para os filtros atuais.</p>
              ) : (
                <div style={listStyle}>
                  <div style={summaryBoxStyle}>
                    <div style={summaryTitleStyle}>Resumo Global</div>
                    <div style={summaryGridStyle}>
                      <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Contactos Agendados</span><strong>{resumoGlobalGestorClientes.agendados}</strong></div>
                      <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Follow Up</span><strong>{resumoGlobalGestorClientes.followUp}</strong></div>
                      <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Reforços</span><strong>{resumoGlobalGestorClientes.reforcos}</strong></div>
                      <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Contactos Realizados</span><strong>{resumoGlobalGestorClientes.realizados}</strong></div>
                      <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Novos Contactos</span><strong>{resumoGlobalGestorClientes.novos}</strong></div>
                      <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Contactos Desmarcados</span><strong>{resumoGlobalGestorClientes.desmarcados}</strong></div>
                    </div>
                  </div>

                  <div style={summaryListSectionStyle}>
                    <div style={subHeadingStyle}>Sumários por Gestor</div>
                    {gestorClientesAgrupadosPorGestor.map((gestorGrupo) => (
                      <div key={`gc-summary-${gestorGrupo.gestorNome}`} style={summaryBoxStyle}>
                        <div style={summaryTitleStyle}>Sumário para Gestor: {gestorGrupo.gestorNome}</div>
                        <div style={summaryGridStyle}>
                          <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Contactos Agendados</span><strong>{gestorGrupo.resumo.agendados}</strong></div>
                          <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Follow Up</span><strong>{gestorGrupo.resumo.followUp}</strong></div>
                          <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Reforços</span><strong>{gestorGrupo.resumo.reforcos}</strong></div>
                          <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Contactos Realizados</span><strong>{gestorGrupo.resumo.realizados}</strong></div>
                          <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Novos Contactos</span><strong>{gestorGrupo.resumo.novos}</strong></div>
                          <div style={summaryMetricCardStyle}><span style={summaryMetricLabelStyle}>Contactos Desmarcados</span><strong>{gestorGrupo.resumo.desmarcados}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={detailReportsSectionStyle}>
                    <div style={subHeadingStyle}>Relatórios Detalhados</div>
                  {gestorClientesAgrupadosPorGestor.map((gestorGrupo) => {
                    const isGestorOpen = expandedGestoresClientes[gestorGrupo.gestorNome] ?? false;
                    return (
                      <div key={`gc-gestor-${gestorGrupo.gestorNome}`} style={dateSectionStyle}>
                        <button
                          type="button"
                          style={gestorToggleStyle}
                          onClick={() => {
                            setExpandedGestoresClientes((prev) => ({
                              ...prev,
                              [gestorGrupo.gestorNome]: !(prev[gestorGrupo.gestorNome] ?? true)
                            }));
                          }}
                        >
                          <span style={gestorChevronStyle}>{isGestorOpen ? '▴' : '▾'}</span>
                          <span style={gestorHeadingStyle}>{`Gestor: ${gestorGrupo.gestorNome}`}</span>
                        </button>

                        {isGestorOpen && (
                          <div style={{ marginLeft: 0 }}>
                            {gestorGrupo.datas.map((grupo) => {
                              const isDateOpen = expandedDatasGestorClientes[`${gestorGrupo.gestorNome}::${grupo.dateKey}`] ?? false;
                              return (
                                <div key={`gc-data-${gestorGrupo.gestorNome}-${grupo.dateKey}`} style={dateSectionStyle}>
                                  <button
                                    type="button"
                                    style={dateToggleSimpleStyle}
                                    onClick={() => {
                                      setExpandedDatasGestorClientes((prev) => ({
                                        ...prev,
                                        [`${gestorGrupo.gestorNome}::${grupo.dateKey}`]: !(prev[`${gestorGrupo.gestorNome}::${grupo.dateKey}`] ?? true)
                                      }));
                                    }}
                                  >
                                    <span style={dateChevronSimpleStyle}>{isDateOpen ? '▴' : '▾'}</span>
                                    <span style={dateHeadingStyle}>{grupo.dateLabel}</span>
                                  </button>

                                  {isDateOpen && (
                                    <div style={listStyle}>
                                      {grupo.items.map((item) => (
                                        <div key={`gc-${item.fichaId}-${item.clienteId || item.clienteNome}`} style={detailCardStyle}>
                                          <div style={detailLineStyle}><strong>Ficha:</strong> {item.fichaTitulo}</div>
                                          <div style={detailLineStyle}><strong>Gestor:</strong> {item.gestorNome}</div>
                                          <div style={detailLineStyle}>
                                            <strong>Cliente:</strong>{' '}
                                            <button
                                              type="button"
                                              style={reportLinkStyle}
                                              onClick={() => {
                                                if (item.clienteId) navigate(`/clientes/${item.clienteId}/editar`);
                                              }}
                                              disabled={!item.clienteId}
                                              title={item.clienteId ? 'Editar cliente' : 'Cliente sem ligação'}
                                            >
                                              {item.clienteNome}
                                            </button>
                                          </div>
                                          <div style={detailLineStyle}><strong>Duração:</strong> {item.duracao}</div>
                                          <div style={detailLineStyle}><strong>Tipo de contacto:</strong> {item.tipoContacto}</div>
                                          <div style={detailLineStyle}><strong>Contacto efetuado?</strong> {item.contactoEfetuado ? 'Sim' : 'Não'}</div>
                                          <div style={detailLineStyle}><strong>Motivo/Resumo do Contacto:</strong> {item.motivoResumo}</div>
                                          <div style={detailLineStyle}><strong>Motivo/Tipo do Próximo Contacto:</strong> {item.motivoTipoProximo}</div>
                                          <div style={detailLineStyle}><strong>Data do Próximo Contacto:</strong> {item.dataProximoContacto ? toDatePt(item.dataProximoContacto) : '—'}</div>
                                          <div style={detailLineStyle}><strong>Assunto Tratado?</strong> {item.assuntoTratado ? 'Sim' : 'Não'}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tipo === 'clientes' && (
        <p>Conteúdo em preparação.</p>
      )}
    </div>
  );
}

function ResultadosPropostas({ clienteSelecionado, pesquisa, setPesquisa, grupos, expandedDatasPropostas, setExpandedDatasPropostas, onOpenFicha, getFichaId, getPropostaTitulo, getClienteNome }) {
  if (!clienteSelecionado) return null;

  const gruposFiltrados = grupos
    .map((grupo) => ({
      ...grupo,
      items: clienteSelecionado === 'Todos'
        ? grupo.items
        : grupo.items.filter((ficha) => getClienteNome(ficha) === clienteSelecionado)
    }))
    .filter((grupo) => grupo.items.length > 0);

  const itens = gruposFiltrados.flatMap((grupo) => grupo.items);

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={reportHeading}>Propostas apresentadas por: {clienteSelecionado}</h3>

      <div style={{ marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Pesquisar na lista..."
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      {itens.length === 0 ? (
        <p>Sem resultados para os filtros atuais.</p>
      ) : (
        <div style={listStyle}>
          {gruposFiltrados.map((grupo) => (
            <div key={`prop-data-${grupo.dateKey}`} style={dateSectionStyle}>
              <button
                type="button"
                style={dateToggleSimpleStyle}
                onClick={() => {
                  setExpandedDatasPropostas((prev) => ({
                    ...prev,
                    [grupo.dateKey]: !(prev[grupo.dateKey] ?? true)
                  }));
                }}
              >
                <span style={dateChevronSimpleStyle}>{(expandedDatasPropostas[grupo.dateKey] ?? true) ? '▼' : '▶'}</span>
                <span style={dateHeadingStyle}>{grupo.dateLabel}</span>
                <span style={dateCountSimpleStyle}>({grupo.items.length})</span>
              </button>

              {(expandedDatasPropostas[grupo.dateKey] ?? true) && (
                <div style={listStyle}>
                  {grupo.items.map((ficha) => {
                    const fichaId = getFichaId(ficha);
                    const propostaTitulo = getPropostaTitulo(ficha);
                    const clienteNome = getClienteNome(ficha);
                    return (
                      <div key={`prop-${fichaId}`} style={dateRowStyle}>
                        <button type="button" style={reportLinkStyle} onClick={() => onOpenFicha(fichaId)} title="Editar ficha">
                          {propostaTitulo} - {clienteNome}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pageStyle = { fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' };
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 };
const labelStyle = { fontWeight: 600, fontSize: '0.88rem', color: '#1d2327', minWidth: 50 };
const selectStyle = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 8px', fontSize: '0.9rem', minWidth: 260 };
const dateInputStyle = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 8px', fontSize: '0.9rem' };
const actionBtn = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 12px', fontSize: '0.88rem', cursor: 'pointer', color: '#1d2327' };
const exportBtn = { background: '#8aaE8c', border: '1px solid #8aaE8c', borderRadius: 3, padding: '5px 12px', fontSize: '0.88rem', cursor: 'pointer', color: '#fff' };
const clearBtn = { background: 'none', border: 'none', color: 'var(--theme-topbar-start, #2271b1)', fontSize: '0.88rem', cursor: 'pointer', padding: '5px 0' };
const reportHeading = { fontWeight: 700, fontSize: '1.7rem', margin: '2px 0 12px' };
const searchInputStyle = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 8px', fontSize: '0.88rem', minWidth: 300 };
const listStyle = { display: 'flex', flexDirection: 'column', gap: 7 };
const dateSectionStyle = { marginBottom: 8 };
const summaryBoxStyle = { padding: '6px 0 10px' };
const summaryTitleStyle = { fontSize: '1.1rem', fontWeight: 500, marginBottom: 6 };
const summaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 };
const summaryMetricCardStyle = { background: '#f6f8fb', border: '1px solid #dce3ea', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const summaryMetricLabelStyle = { color: '#4b5563', fontSize: '0.88rem' };
const summaryListSectionStyle = { marginTop: 10 };
const detailReportsSectionStyle = { marginTop: 16, paddingTop: 10, borderTop: '1px solid #e5e7eb' };
const subHeadingStyle = { fontSize: '1.02rem', fontWeight: 600, color: '#374151', marginBottom: 6 };
const gestorToggleStyle = { background: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: 0, margin: '10px 0 4px', cursor: 'pointer' };
const gestorChevronStyle = { color: '#1d2327', fontSize: '0.9rem', transform: 'translateY(-1px)' };
const gestorHeadingStyle = { fontSize: '1.15rem', fontWeight: 700, color: '#1d2327' };
const dateToggleSimpleStyle = { background: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, margin: '8px 0 6px', cursor: 'pointer' };
const dateChevronSimpleStyle = { color: '#6b7280', fontSize: '0.82rem', transform: 'translateY(-1px)' };
const dateHeadingStyle = { fontSize: '1rem', fontWeight: 600, color: '#3c434a' };
const dateCountSimpleStyle = { color: '#6b7280', fontSize: '0.9rem' };
const dateRowStyle = { fontSize: '1.05rem', lineHeight: 1.35 };
const detailCardStyle = { borderTop: '1px solid #e5e7eb', padding: '10px 0' };
const detailLineStyle = { fontSize: '1.02rem', marginBottom: 4, lineHeight: 1.5 };
const reportLinkStyle = { background: 'none', border: 'none', color: '#005eff', padding: 0, cursor: 'pointer', textAlign: 'left', fontSize: '1.05rem' };
const gcGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(170px, 1fr))', gap: '10px 16px', alignItems: 'start' };
const gcFieldStyle = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const gcLabelStyle = { ...labelStyle, display: 'block', minWidth: 0, marginBottom: 6 };
const gcControlStyle = {
  border: '1px solid #c3c4c7',
  borderRadius: 3,
  padding: '5px 8px',
  fontSize: '0.9rem',
  height: 40,
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  background: '#fff'
};
