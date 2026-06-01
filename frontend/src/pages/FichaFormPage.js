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

const CONTACTO_OPTIONS = [
  { value: 'reuniao', label: 'Reunião' },
  { value: 'visita', label: 'Visita' },
  { value: 'email', label: 'Email' },
  { value: 'telefonico', label: 'Telefónico' }
];

const ESTADO_PROPOSTA_OPTIONS = [
  'Desinteresse',
  'A Orçamentar',
  'Enviada',
  'Adjudicada',
  'Não adjudicada'
];

const POSSIBILIDADE_OPTIONS = ['0%', '25%', '50%', '75%', '100%'];

const SERVICO_OPTIONS = [
  'Design | Design',
  'Comunicação e Eventos | Comunicação e Eventos',
  'Web',
  'PUC',
  'Mr. DoIt',
  'Takemedia',
  'TOMI',
  'Outsourcing'
];

const DEFAULT_FORM = {
  title: '',
  client_legacy_id: '',
  post_status: 'pending',
  post_visibility: 'public',
  author: '',
  tipo_contacto: '',
  pessoa_contacto: '',
  contacto: '',
  data_contacto: '',
  inicio_contacto: '',
  fim_contacto: '',
  motivo_resumo_contacto: '',
  contacto_efetuado: false,
  follow_up: false,
  novo_contacto: false,
  tipo_proximo_contacto: '',
  data_proximo_contacto: '',
  data_apresentacao_proposta: '',
  estado_proposta: '',
  descritivo_proposta: '',
  valor_total_proposta: '',
  possibilidade_negocio: '',
  motivo_possibilidade_negocio: '',
  valor_total_adjudicado: '',
  descritivo_fatura: '',
  valor_fatura: '',
  data_fatura: '',
  data_prevista_recebimento: '',
  data_ultimo_contacto_financeiro: '',
  relatorio_errado: false,
  porque_relatorio_errado: '',
  assunto_tratado: false,
  anexos: ''
};

const DEFAULT_BOX_LAYOUT = { left: ['autor', 'campos', 'fichas'], right: ['publicar'] };

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

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const raw = (value || '').toString().trim().toLowerCase();
  return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(raw);
};

const parseServiceRows = (value) => {
  if (!value) return [{ servico: '', valor: '' }];
  if (Array.isArray(value)) return value.length ? value : [{ servico: '', valor: '' }];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((item) => ({
          servico: (item?.servico || '').toString(),
          valor: (item?.valor || '').toString()
        }))
        .filter((item) => item.servico || item.valor);
      return normalized.length ? normalized : [{ servico: '', valor: '' }];
    }
  } catch {
    // Ignore invalid JSON and fall back to plain text.
  }

  return [{ servico: value.toString(), valor: '' }];
};

const stringifyServiceRows = (rows) => JSON.stringify(
  (rows || [])
    .map((row) => ({
      servico: (row.servico || '').toString().trim(),
      valor: (row.valor || '').toString().trim()
    }))
    .filter((row) => row.servico || row.valor)
);

export default function FichaFormPage({ mode = 'create', disableVisualEditor = false }) {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('comercial');
  const [ok, setOk] = useState('');
  const [erro, setErro] = useState('');
  const [editStatus, setEditStatus] = useState(false);
  const [editVisibility, setEditVisibility] = useState(false);
  const [editPublishDate, setEditPublishDate] = useState(false);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [postDateParts, setPostDateParts] = useState(parseDateParts());
  const [servicosPropostos, setServicosPropostos] = useState([{ servico: '', valor: '' }]);
  const [servicosAdjudicados, setServicosAdjudicados] = useState([{ servico: '', valor: '' }]);

  const [comerciais, setComerciais] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [statusDraft, setStatusDraft] = useState(DEFAULT_FORM.post_status);
  const [visibilityDraft, setVisibilityDraft] = useState(DEFAULT_FORM.post_visibility);
  const [publishDateDraft, setPublishDateDraft] = useState(parseDateParts());
  const [boxLayout, setBoxLayout] = useState(DEFAULT_BOX_LAYOUT);
  const [draggedBox, setDraggedBox] = useState('');

  useEffect(() => {
    axios.get('/api/comerciais')
      .then((res) => setComerciais(Array.isArray(res.data) ? res.data : []))
      .catch(() => setComerciais([]));

    axios.get('/api/clientes')
      .then((res) => setClientes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;

    setLoading(true);
    setErro('');

    axios.get(`/api/fichas/${id}`)
      .then((res) => {
        const ficha = res.data || {};
        setForm({
          title: (ficha.title || '').toString(),
          client_legacy_id: (ficha.client_legacy_id || '').toString(),
          post_status: (ficha.post_status || 'pending').toString().toLowerCase(),
          post_visibility: (ficha.post_visibility || 'public').toString().toLowerCase(),
          author: (ficha.author || '').toString(),
          tipo_contacto: (ficha.tipo_contacto || '').toString().toLowerCase(),
          pessoa_contacto: (ficha.pessoa_contacto || '').toString(),
          contacto: (ficha.contacto || '').toString(),
          data_contacto: (ficha.data_contacto || '').toString().slice(0, 10),
          inicio_contacto: (ficha.inicio_contacto || '').toString(),
          fim_contacto: (ficha.fim_contacto || '').toString(),
          motivo_resumo_contacto: (ficha.motivo_resumo_contacto || '').toString(),
          contacto_efetuado: toBool(ficha.contacto_efetuado),
          follow_up: toBool(ficha.follow_up),
          novo_contacto: toBool(ficha.novo_contacto),
          tipo_proximo_contacto: (ficha.tipo_proximo_contacto || '').toString().toLowerCase(),
          data_proximo_contacto: (ficha.data_proximo_contacto || '').toString().slice(0, 10),
          data_apresentacao_proposta: (ficha.data_apresentacao_proposta || '').toString().slice(0, 10),
          estado_proposta: (ficha.estado_proposta || '').toString(),
          descritivo_proposta: (ficha.descritivo_proposta || '').toString(),
          valor_total_proposta: (ficha.valor_total_proposta || '').toString(),
          possibilidade_negocio: (ficha.possibilidade_negocio || '').toString(),
          motivo_possibilidade_negocio: (ficha.motivo_possibilidade_negocio || '').toString(),
          valor_total_adjudicado: (ficha.valor_total_adjudicado || '').toString(),
          descritivo_fatura: (ficha.descritivo_fatura || '').toString(),
          valor_fatura: (ficha.valor_fatura || '').toString(),
          data_fatura: (ficha.data_fatura || '').toString().slice(0, 10),
          data_prevista_recebimento: (ficha.data_prevista_recebimento || '').toString().slice(0, 10),
          data_ultimo_contacto_financeiro: (ficha.data_ultimo_contacto_financeiro || '').toString().slice(0, 10),
          relatorio_errado: toBool(ficha.relatorio_errado),
          porque_relatorio_errado: (ficha.porque_relatorio_errado || '').toString(),
          assunto_tratado: toBool(ficha.assunto_tratado),
          anexos: (ficha.anexos || '').toString()
        });

        setPostDateParts(parseDateParts(ficha.post_date || ficha.data_contacto || ficha.created_at));
        setServicosPropostos(parseServiceRows(ficha.servicos_proposta));
        setServicosAdjudicados(parseServiceRows(ficha.servicos_adjudicados));

        setStatusDraft((ficha.post_status || 'pending').toString().toLowerCase());
        setVisibilityDraft((ficha.post_visibility || 'public').toString().toLowerCase());
        setPublishDateDraft(parseDateParts(ficha.post_date || ficha.data_contacto || ficha.created_at));
      })
      .catch(() => setErro('Não foi possível carregar a ficha.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const postDate = useMemo(
    () => `${postDateParts.ano}-${postDateParts.mes}-${postDateParts.dia} ${postDateParts.hora}:${postDateParts.minuto}:00`,
    [postDateParts]
  );

  const anexosInputRef = React.useRef(null);

  const postStatusLabel = useMemo(() => {
    if (form.post_status === 'draft') return 'Rascunho';
    if (form.post_status === 'publish') return 'Publicado';
    return 'Pendente de revisão';
  }, [form.post_status]);

  const visibilityLabel = useMemo(() => {
    if (form.post_visibility === 'private') return 'Privado';
    if (form.post_visibility === 'protected') return 'Protegido por senha';
    return 'Público';
  }, [form.post_visibility]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addServico = (setter) => setter((prev) => [...prev, { servico: '', valor: '' }]);
  const updateServico = (setter, index, field, value) => {
    setter((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  const removeServico = (setter, index) => {
    setter((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ servico: '', valor: '' }];
    });
  };

  const onAttachFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const names = files.map((file) => file.name).join(', ');
    setForm((prev) => ({
      ...prev,
      anexos: prev.anexos ? `${prev.anexos}, ${names}` : names
    }));

    event.target.value = '';
  };

  const saveFicha = async (targetStatus) => {
    setSaving(true);
    setErro('');
    setOk('');

    const payload = {
      title: form.title.trim(),
      client_legacy_id: form.client_legacy_id,
      post_status: targetStatus || form.post_status,
      post_visibility: form.post_visibility,
      post_date: postDate,
      author: form.author,
      tipo_contacto: form.tipo_contacto,
      pessoa_contacto: form.pessoa_contacto,
      contacto: form.contacto,
      data_contacto: form.data_contacto || null,
      inicio_contacto: form.inicio_contacto,
      fim_contacto: form.fim_contacto,
      motivo_resumo_contacto: form.motivo_resumo_contacto,
      contacto_efetuado: form.contacto_efetuado,
      follow_up: form.follow_up,
      novo_contacto: form.novo_contacto,
      tipo_proximo_contacto: form.tipo_proximo_contacto,
      data_proximo_contacto: form.data_proximo_contacto || null,
      data_apresentacao_proposta: form.data_apresentacao_proposta || null,
      estado_proposta: form.estado_proposta,
      descritivo_proposta: form.descritivo_proposta,
      servicos_proposta: stringifyServiceRows(servicosPropostos),
      valor_total_proposta: form.valor_total_proposta,
      possibilidade_negocio: form.possibilidade_negocio,
      motivo_possibilidade_negocio: form.motivo_possibilidade_negocio,
      servicos_adjudicados: stringifyServiceRows(servicosAdjudicados),
      valor_total_adjudicado: form.valor_total_adjudicado,
      descritivo_fatura: form.descritivo_fatura,
      valor_fatura: form.valor_fatura,
      data_fatura: form.data_fatura || null,
      data_prevista_recebimento: form.data_prevista_recebimento || null,
      data_ultimo_contacto_financeiro: form.data_ultimo_contacto_financeiro || null,
      relatorio_errado: form.relatorio_errado,
      porque_relatorio_errado: form.porque_relatorio_errado,
      assunto_tratado: form.assunto_tratado,
      anexos: form.anexos
    };

    if (!payload.title) {
      setSaving(false);
      setErro('O título da ficha é obrigatório.');
      return;
    }

    try {
      if (isEdit) {
        await axios.put(`/api/fichas/${id}`, payload);
      } else {
        await axios.post('/api/fichas', payload);
      }

      setOk(isEdit ? 'Ficha atualizada com sucesso.' : 'Ficha criada com sucesso.');
      navigate('/fichas');
    } catch {
      setErro(isEdit ? 'Erro ao atualizar a ficha.' : 'Erro ao criar a ficha.');
    } finally {
      setSaving(false);
    }
  };

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
        right: [...prev.right]
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
        <MetaBox
          key="autor"
          title="Autor"
          onMoveUp={() => moveBoxVertically('autor', -1)}
          onMoveDown={() => moveBoxVertically('autor', 1)}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          draggable
          onDragStart={() => setDraggedBox('autor')}
          onDragEnd={() => setDraggedBox('')}
        >
          <select value={form.author} onChange={(e) => handleChange('author', e.target.value)} style={{ ...fieldInput, width: 260 }}>
            <option value="">Escolha uma opção</option>
            {comerciais.map((item) => (
              <option key={item.id || item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </MetaBox>
      );
    }

    if (boxKey === 'campos') {
      return (
        <MetaBox
          key="campos"
          title="Mais campos"
          onMoveUp={() => moveBoxVertically('campos', -1)}
          onMoveDown={() => moveBoxVertically('campos', 1)}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          draggable
          onDragStart={() => setDraggedBox('campos')}
          onDragEnd={() => setDraggedBox('')}
        >
          <FieldRow label={<>Cliente <span style={{ color: 'red' }}>*</span></>}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClientSelect
                  value={form.client_legacy_id}
                  options={clientes.map((cliente) => {
                    const value = (cliente.legacy_id || cliente.id || '').toString();
                    const label = (cliente.denominacao_fiscal || cliente.nome || cliente.client_name || value).toString();
                    return { value, label };
                  })}
                  onChange={(value) => handleChange('client_legacy_id', value)}
                />
              </div>
              <button type="button" style={{ ...sideBtn, marginTop: 8 }}>Adicionar novo</button>
            </div>
          </FieldRow>

          <FieldRow label="Este relatório está errado?">
            <label style={checkboxRow}><input type="checkbox" checked={form.relatorio_errado} onChange={(e) => handleChange('relatorio_errado', e.target.checked)} /> Sim</label>
          </FieldRow>

          <FieldRow label="Porquê?">
            <textarea value={form.porque_relatorio_errado} onChange={(e) => handleChange('porque_relatorio_errado', e.target.value)} style={{ ...fieldInput, width: '100%', maxWidth: 860, height: 120 }} />
          </FieldRow>

          <FieldRow label="Assunto tratado?">
            <label style={checkboxRow}><input type="checkbox" checked={form.assunto_tratado} onChange={(e) => handleChange('assunto_tratado', e.target.checked)} /> Sim</label>
          </FieldRow>

          <FieldRow label="Anexos">
            <div>
              <button type="button" style={sideBtn} onClick={() => anexosInputRef.current?.click()}>Adicionar ficheiro</button>
              <input ref={anexosInputRef} type="file" multiple style={{ display: 'none' }} onChange={onAttachFiles} />
              <input
                type="text"
                value={form.anexos}
                onChange={(e) => handleChange('anexos', e.target.value)}
                placeholder="URL(s) ou identificadores de anexos"
                style={{ ...fieldInput, width: '100%', maxWidth: 860, marginTop: 8 }}
              />
            </div>
          </FieldRow>
        </MetaBox>
      );
    }

    if (boxKey === 'fichas') {
      return (
      <MetaBox
        key="fichas"
        title="Fichas"
        onMoveUp={() => moveBoxVertically('fichas', -1)}
        onMoveDown={() => moveBoxVertically('fichas', 1)}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        draggable
        onDragStart={() => setDraggedBox('fichas')}
        onDragEnd={() => setDraggedBox('')}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid #c3c4c7', marginBottom: 16, marginTop: -4 }}>
          <TabBtn label="Contacto Comercial" active={tab === 'comercial'} onClick={() => setTab('comercial')} />
          <TabBtn label="Contacto Financeiro" active={tab === 'financeiro'} onClick={() => setTab('financeiro')} />
        </div>

        {tab === 'comercial' && (
          <>
            <FieldFull label="Tipo de Contacto">
              <select value={form.tipo_contacto} onChange={(e) => handleChange('tipo_contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }}>
                <option value="">Escolha uma opção</option>
                {CONTACTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FieldFull>
            <FieldFull label="Pessoa de Contacto">
              <input value={form.pessoa_contacto} onChange={(e) => handleChange('pessoa_contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Contacto">
              <input value={form.contacto} onChange={(e) => handleChange('contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label={<>Data do Contacto <span style={{ color: 'red' }}>*</span></>}>
              <input type="date" value={form.data_contacto} onChange={(e) => handleChange('data_contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label={<>Início do Contacto <span style={{ color: 'red' }}>*</span></>}>
              <input type="time" value={form.inicio_contacto} onChange={(e) => handleChange('inicio_contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label={<>Fim do Contacto <span style={{ color: 'red' }}>*</span></>}>
              <input type="time" value={form.fim_contacto} onChange={(e) => handleChange('fim_contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Motivo/Resumo do Contacto">
              <MiniEditor value={form.motivo_resumo_contacto} onChange={(value) => handleChange('motivo_resumo_contacto', value)} disableVisualEditor={disableVisualEditor} />
            </FieldFull>

            <CheckRow label="Contacto Efetuado?" checked={form.contacto_efetuado} onChange={(value) => handleChange('contacto_efetuado', value)} />
            <CheckRow label="Follow Up?" checked={form.follow_up} onChange={(value) => handleChange('follow_up', value)} />
            <CheckRow label="Novo Contacto?" checked={form.novo_contacto} onChange={(value) => handleChange('novo_contacto', value)} />

            <FieldFull label="Tipo do Próximo Contacto">
              <select value={form.tipo_proximo_contacto} onChange={(e) => handleChange('tipo_proximo_contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }}>
                <option value="">Escolha uma opção</option>
                {CONTACTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FieldFull>
            <FieldFull label="Data do Próximo Contacto">
              <input type="date" value={form.data_proximo_contacto} onChange={(e) => handleChange('data_proximo_contacto', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Data de Apresentação da Proposta">
              <input type="date" value={form.data_apresentacao_proposta} onChange={(e) => handleChange('data_apresentacao_proposta', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Estado da Proposta">
              <select value={form.estado_proposta} onChange={(e) => handleChange('estado_proposta', e.target.value)} style={{ ...fieldInput, width: '100%' }}>
                <option value="">Escolha uma opção</option>
                {ESTADO_PROPOSTA_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </FieldFull>
            <FieldFull label="Descritivo da Proposta">
              <MiniEditor value={form.descritivo_proposta} onChange={(value) => handleChange('descritivo_proposta', value)} disableVisualEditor={disableVisualEditor} />
            </FieldFull>
            <FieldFull label="Serviços Propostos">
              <ServicosTable
                rows={servicosPropostos}
                addRow={() => addServico(setServicosPropostos)}
                updateRow={(i, f, v) => updateServico(setServicosPropostos, i, f, v)}
                removeRow={(i) => removeServico(setServicosPropostos, i)}
              />
            </FieldFull>
            <FieldFull label="Valor Total da Proposta">
              <input value={form.valor_total_proposta} onChange={(e) => handleChange('valor_total_proposta', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Possibilidade de Negócio">
              <select value={form.possibilidade_negocio} onChange={(e) => handleChange('possibilidade_negocio', e.target.value)} style={{ ...fieldInput, width: '100%' }}>
                <option value="">Escolha uma opção</option>
                {POSSIBILIDADE_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </FieldFull>
            <FieldFull label="Motivo da Possibilidade de Negócio">
              <MiniEditor value={form.motivo_possibilidade_negocio} onChange={(value) => handleChange('motivo_possibilidade_negocio', value)} disableVisualEditor={disableVisualEditor} minHeight={420} />
            </FieldFull>
          </>
        )}

        {tab === 'financeiro' && (
          <>
            <FieldFull label="Serviços Adjudicados">
              <ServicosTable
                rows={servicosAdjudicados}
                addRow={() => addServico(setServicosAdjudicados)}
                updateRow={(i, f, v) => updateServico(setServicosAdjudicados, i, f, v)}
                removeRow={(i) => removeServico(setServicosAdjudicados, i)}
              />
            </FieldFull>
            <FieldFull label="Valor Total Adjudicado">
              <input value={form.valor_total_adjudicado} onChange={(e) => handleChange('valor_total_adjudicado', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Descritivo da Fatura">
              <MiniEditor value={form.descritivo_fatura} onChange={(value) => handleChange('descritivo_fatura', value)} disableVisualEditor={disableVisualEditor} />
            </FieldFull>
            <FieldFull label="Valor da Fatura">
              <input value={form.valor_fatura} onChange={(e) => handleChange('valor_fatura', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Data da Fatura">
              <input type="date" value={form.data_fatura} onChange={(e) => handleChange('data_fatura', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Data prevista para o Recebimento">
              <input type="date" value={form.data_prevista_recebimento} onChange={(e) => handleChange('data_prevista_recebimento', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
            <FieldFull label="Data do Último Contacto">
              <input type="date" value={form.data_ultimo_contacto_financeiro} onChange={(e) => handleChange('data_ultimo_contacto_financeiro', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
            </FieldFull>
          </>
        )}
      </MetaBox>
      );
    }

    return (
      <MetaBox
        key="publicar"
        title="Publicar"
        onMoveUp={() => moveBoxVertically('publicar', -1)}
        onMoveDown={() => moveBoxVertically('publicar', 1)}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        draggable
        onDragStart={() => setDraggedBox('publicar')}
        onDragEnd={() => setDraggedBox('')}
      >
        <div style={{ padding: '0 0 2px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button type="button" style={sideBtn} onClick={() => saveFicha('pending')} disabled={saving}>Guardar como pendente</button>
            <button type="button" style={{ ...sideBtn, marginLeft: 'auto' }}>Pré-visualizar</button>
          </div>

          <div style={sideRow}>
            <span>Estado: <strong>{postStatusLabel}</strong> {!editStatus && <button type="button" style={linkBtn} onClick={() => { setStatusDraft(form.post_status); setEditStatus(true); }}>Editar</button>}</span>
          </div>
          {editStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} style={{ ...fieldInput, flex: 1 }}>
                <option value="pending">Pendente de revisão</option>
                <option value="draft">Rascunho</option>
              </select>
              <button type="button" style={okBtn} onClick={() => { handleChange('post_status', statusDraft); setEditStatus(false); }}>OK</button>
            </div>
          )}

          <div style={sideRow}>
            <span>Visibilidade: <strong>{visibilityLabel}</strong> {!editVisibility && <button type="button" style={linkBtn} onClick={() => { setVisibilityDraft(form.post_visibility); setEditVisibility(true); }}>Editar</button>}</span>
          </div>
          {editVisibility && (
            <div style={{ marginTop: -2, marginBottom: 10 }}>
              <label style={radioRow}><input type="radio" name="post_visibility" value="public" checked={visibilityDraft === 'public'} onChange={(e) => setVisibilityDraft(e.target.value)} /> Público</label>
              <label style={radioRow}><input type="radio" name="post_visibility" value="protected" checked={visibilityDraft === 'protected'} onChange={(e) => setVisibilityDraft(e.target.value)} /> Protegido por senha</label>
              <label style={radioRow}><input type="radio" name="post_visibility" value="private" checked={visibilityDraft === 'private'} onChange={(e) => setVisibilityDraft(e.target.value)} /> Privado</label>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" style={okBtn} onClick={() => { handleChange('post_visibility', visibilityDraft); setEditVisibility(false); }}>OK</button>
                <button type="button" style={linkBtn} onClick={() => setEditVisibility(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#50575e', lineHeight: 1.4 }}>
            Publicar <strong>imediatamente</strong> {!editPublishDate && <button type="button" style={linkBtn} onClick={() => { setPublishDateDraft({ ...postDateParts }); setEditPublishDate(true); }}>Editar</button>}
          </div>
          {editPublishDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 10px', flexWrap: 'wrap' }}>
              <input type="text" value={publishDateDraft.dia} onChange={(e) => setPublishDateDraft((p) => ({ ...p, dia: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInput, width: 34, textAlign: 'center' }} />
              <span>de</span>
              <select value={publishDateDraft.mes} onChange={(e) => setPublishDateDraft((p) => ({ ...p, mes: e.target.value }))} style={{ ...fieldInput, width: 92 }}>
                {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.value}-{month.label}</option>)}
              </select>
              <span>de</span>
              <input type="text" value={publishDateDraft.ano} onChange={(e) => setPublishDateDraft((p) => ({ ...p, ano: e.target.value.replace(/\D/g, '').slice(0, 4) }))} style={{ ...fieldInput, width: 66, textAlign: 'center' }} />
              <span>às</span>
              <input type="text" value={publishDateDraft.hora} onChange={(e) => setPublishDateDraft((p) => ({ ...p, hora: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInput, width: 38, textAlign: 'center' }} />
              <span>:</span>
              <input type="text" value={publishDateDraft.minuto} onChange={(e) => setPublishDateDraft((p) => ({ ...p, minuto: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...fieldInput, width: 38, textAlign: 'center' }} />
              <button type="button" style={okBtn} onClick={() => { setPostDateParts({ ...publishDateDraft }); setEditPublishDate(false); }}>OK</button>
              <button type="button" style={linkBtn} onClick={() => setEditPublishDate(false)}>Cancelar</button>
            </div>
          )}

          <div style={{ borderTop: '1px solid #dcdcde', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" style={linkBtn} onClick={() => (isEdit ? saveFicha('trash') : navigate('/fichas'))}>{isEdit ? 'Mover para o lixo' : 'Cancelar'}</button>
            <button type="button" style={publishBtn} onClick={() => saveFicha('publish')} disabled={saving}>{saving ? (isEdit ? 'A atualizar...' : 'A publicar...') : (isEdit ? 'Atualizar' : 'Publicar')}</button>
          </div>
        </div>
      </MetaBox>
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

  if (loading) {
    return <div className="py-4 text-center"><div className="spinner-border" /><p className="mt-2">Carregando...</p></div>;
  }

  return (
    <div style={pageStyle}>
      <h2 style={{ fontWeight: 400, fontSize: '1.5rem', marginBottom: 16 }}>
        {isEdit ? 'Editar Ficha' : 'Adicionar nova Ficha'}
       </h2>

      {ok && <div style={alertOk}>{ok}</div>}
      {erro && <div style={alertErr}>{erro}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            placeholder="Adicionar título"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            style={titleInput}
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

function MetaBox({ title, children, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true, draggable = false, onDragStart, onDragEnd }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{ border: '1px solid #c3c4c7', background: '#fff', marginBottom: 12 }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ ...boxHeader, cursor: draggable ? 'grab' : 'default' }}>
        <strong style={{ fontSize: '0.93rem' }}>{title}</strong>
        <span style={{ display: 'flex', gap: 4 }}>
          <button type="button" style={iconBtn(canMoveUp)} title="Mover para cima" onClick={onMoveUp} disabled={!canMoveUp}>∧</button>
          <button type="button" style={iconBtn(canMoveDown)} title="Mover para baixo" onClick={onMoveDown} disabled={!canMoveDown}>∨</button>
          <button type="button" style={iconBtn(true)} title="Expandir/Recolher" onClick={() => setCollapsed((v) => !v)}>{collapsed ? '▾' : '▴'}</button>
        </span>
      </div>
      {!collapsed && <div style={{ padding: '10px 16px' }}>{children}</div>}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: '8px 16px', alignItems: 'start', marginBottom: 14 }}>
      <label style={{ fontWeight: 600, fontSize: '0.88rem', paddingTop: 6 }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function FieldFull({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 4 }}>{label}</label>
      <label style={checkboxRow}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Sim</label>
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        border: '1px solid #c3c4c7',
        borderBottom: active ? 'none' : '1px solid #c3c4c7',
        background: active ? '#fff' : '#f6f7f7',
        fontWeight: active ? 700 : 500,
        fontSize: '0.95rem',
        cursor: 'pointer',
        marginBottom: active ? -1 : 0,
        color: '#1d2327'
      }}
    >
      {label}
    </button>
  );
}

function ClientSelect({ value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const rootRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const onDocClick = (event) => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()));

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', maxWidth: 780 }}>
      <button type="button" style={clientSelectBtn} onClick={() => setOpen((prev) => !prev)}>
        <span>{selected?.label || 'Escolha um cliente'}</span>
        <span style={{ color: '#50575e' }}>▼</span>
      </button>
      {open && (
        <div style={clientSelectList}>
          <div style={{ padding: 8, borderBottom: '1px solid #dcdcde', background: '#fff' }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar cliente"
              style={{ ...fieldInput, width: '100%' }}
            />
          </div>
          <button type="button" style={clientSelectItem} onClick={() => { onChange(''); setOpen(false); }}>Escolha um cliente</button>
          {filteredOptions.map((option) => (
            <button key={`client-option-${option.value}`} type="button" style={clientSelectItem} onClick={() => { onChange(option.value); setOpen(false); }}>
              {option.label}
            </button>
          ))}
          {!filteredOptions.length && <div style={clientSelectEmpty}>Sem resultados</div>}
        </div>
      )}
    </div>
  );
}

function MiniEditor({ value, onChange, disableVisualEditor = false, minHeight = 130 }) {
  const [mode, setMode] = React.useState(disableVisualEditor ? 'html' : 'visual');
  const [showAdvancedToolbar, setShowAdvancedToolbar] = React.useState(false);
  const textareaRef = React.useRef(null);
  const [selection, setSelection] = React.useState({ start: 0, end: 0 });

  React.useEffect(() => {
    setMode(disableVisualEditor ? 'html' : 'visual');
  }, [disableVisualEditor]);

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
      // Keep behavior visible when there are no pending tags to close.
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
        }
      }, 0);
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
    { label: '⌨', action: () => setShowAdvancedToolbar((prev) => !prev), title: 'Mostrar/esconder barra de ferramentas (Shift+Alt+Z)' }
  ];

  const visualAdvancedButtons = [
    { label: 'S', action: () => insertTag('<del>', '</del>') },
    { label: 'A', action: () => insertTag('<span style="color:#1d2327;">', '</span>') },
    { label: '🔗', action: () => { const url = window.prompt('URL:'); if (url) insertTag(`<a href="${url}">`, '</a>'); } },
    { label: 'Ω', action: () => insertTag('&omega;', '') },
    { label: '⇤', action: () => insertTag('<p style="text-indent:2em;">', '</p>') },
    { label: '⇥', action: () => insertTag('<p style="margin-left:2em;">', '</p>') },
    { label: '↺', action: () => {} },
    { label: '↻', action: () => {} },
    { label: '?', action: () => {} }
  ];

  const htmlButtons = [
    { label: 'b', action: () => insertTag('<b>', '</b>') },
    { label: 'i', action: () => insertTag('<i>', '</i>') },
    { label: 'link', action: () => { const url = window.prompt('URL:'); if (url) insertTag(`<a href="${url}">`, '</a>'); } },
    { label: 'b-quote', action: () => insertTag('<blockquote>', '</blockquote>') },
    { label: 'del', action: () => insertTag('<del>', '</del>') },
    { label: 'ins', action: () => insertTag('<ins>', '</ins>') },
    { label: 'img', action: () => { const url = window.prompt('URL da imagem:'); if (url) insertTag(`<img src="${url}" alt="" />`, ''); } },
    { label: 'ul', action: () => insertTag('<ul>\n<li>', '</li>\n</ul>') },
    { label: 'ol', action: () => insertTag('<ol>\n<li>', '</li>\n</ol>') },
    { label: 'li', action: () => insertTag('<li>', '</li>') },
    { label: 'code', action: () => insertTag('<code>', '</code>') },
    { label: 'more', action: () => insertRaw('\n<!--more-->\n') },
    { label: 'fechar etiquetas', action: closeOpenTags }
  ];

  const isVisual = mode === 'visual';
  const buttons = isVisual ? visualMainButtons : htmlButtons;

  return (
    <div style={{ border: '1px solid #c3c4c7', background: '#fff' }}>
      <div style={{ background: '#f0f0f1', borderBottom: '1px solid #dcdcde', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" style={editorTopBtn}>Adicionar multimédia</button>
        <button type="button" style={editorTopBtn}>Shortcode do Pods</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignSelf: 'stretch' }}>
          <button type="button" onClick={() => setMode('visual')} style={{ ...tabBtnSm, background: isVisual ? '#fff' : '#f0f0f1', fontWeight: isVisual ? 600 : 400 }}>Visual</button>
          <button type="button" onClick={() => setMode('html')} style={{ ...tabBtnSm, background: !isVisual ? '#fff' : '#f0f0f1', fontWeight: !isVisual ? 600 : 400 }}>HTML</button>
        </div>
      </div>
      <div style={{ background: '#f0f0f1', borderBottom: '1px solid #dcdcde', padding: '6px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {isVisual && (
          <select style={{ ...fieldInput, padding: '4px 8px', fontSize: '0.85rem', minWidth: 140, borderRadius: 0 }}>
            <option>Parágrafo</option>
          </select>
        )}
        {buttons.map((btn, i) => (
          <button key={i} type="button" onClick={btn.action} style={isVisual ? editorIconBtn : editorTagBtn} title={btn.title || ''}>
            {btn.label}
          </button>
        ))}
      </div>
      {isVisual && showAdvancedToolbar && (
        <div style={{ background: '#f0f0f1', borderBottom: '1px solid #dcdcde', padding: '6px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {visualAdvancedButtons.map((btn, i) => (
            <button key={`adv-${i}`} type="button" onClick={btn.action} style={editorIconBtn}>
              {btn.label}
            </button>
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
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          minHeight,
          padding: '10px',
          resize: 'vertical',
          boxSizing: 'border-box',
          fontFamily: isVisual ? 'Georgia, "Times New Roman", serif' : 'Consolas, "Courier New", monospace',
          fontSize: isVisual ? '0.95rem' : '0.92rem',
          lineHeight: 1.6,
          color: '#1d2327'
        }}
      />
    </div>
  );
}

function ServicosTable({ rows, addRow, updateRow, removeRow }) {
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #c3c4c7', marginBottom: 8 }}>
        <thead>
          <tr style={{ background: '#f6f7f7' }}>
            <th style={{ width: 40, padding: '4px 6px', border: '1px solid #c3c4c7' }}></th>
            <th style={{ padding: '8px 10px', border: '1px solid #c3c4c7', fontSize: '0.9rem', textAlign: 'left' }}>Serviço</th>
            <th style={{ padding: '8px 10px', border: '1px solid #c3c4c7', fontSize: '0.9rem', textAlign: 'left' }}>Valor</th>
            <th style={{ width: 54, border: '1px solid #c3c4c7' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 6px', border: '1px solid #c3c4c7', color: '#646970', textAlign: 'center' }}>{i + 1}</td>
              <td style={{ padding: '6px', border: '1px solid #c3c4c7' }}>
                <select value={row.servico} onChange={(e) => updateRow(i, 'servico', e.target.value)} style={{ ...fieldInput, width: '100%' }}>
                  <option value="">Escolha uma opção</option>
                  {row.servico && !SERVICO_OPTIONS.includes(row.servico) && <option value={row.servico}>{row.servico}</option>}
                  {SERVICO_OPTIONS.map((option) => (
                    <option key={`${i}-${option}`} value={option}>{option}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '6px', border: '1px solid #c3c4c7' }}>
                <input value={row.valor} onChange={(e) => updateRow(i, 'valor', e.target.value)} style={{ ...fieldInput, width: '100%' }} />
              </td>
              <td style={{ padding: '4px 6px', border: '1px solid #c3c4c7', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <button type="button" onClick={addRow} style={serviceActionBtn}>+</button>
                  <button type="button" onClick={() => removeRow(i)} style={serviceActionBtn}>-</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'right' }}>
        <button type="button" onClick={addRow} style={sideBtn}>Adicionar linha</button>
      </div>
    </div>
  );
}

const pageStyle = { fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' };
const titleInput = { width: '100%', padding: '10px 12px', fontSize: '1.5rem', border: '1px solid #c3c4c7', borderRadius: 0, marginBottom: 12, boxSizing: 'border-box', outline: 'none', color: '#1d2327', fontFamily: 'inherit', lineHeight: 1.2 };
const boxHeader = { background: '#f6f7f7', borderBottom: '1px solid #c3c4c7', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const fieldInput = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 8px', fontSize: '0.9rem', boxSizing: 'border-box' };
const sideBtn = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '4px 10px', fontSize: '0.85rem', cursor: 'pointer', color: '#1d2327' };
const publishBtn = { background: '#2e7d32', border: 'none', borderRadius: 3, padding: '5px 14px', fontSize: '0.9rem', cursor: 'pointer', color: '#fff', fontWeight: 600 };
const linkBtn = { background: 'none', border: 'none', color: 'var(--theme-topbar-start, #2271b1)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 };
const sideRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: '0.88rem' };
const iconBtn = (enabled = true) => ({
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
const checkboxRow = { display: 'flex', alignItems: 'center', gap: 6 };
const radioRow = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 };
const editorTopBtn = { background: '#f6f7f7', border: '1px solid #8c8f94', borderRadius: 4, padding: '5px 12px', fontSize: '0.92rem', lineHeight: 1.2, cursor: 'pointer', color: '#3c434a' };
const tabBtnSm = { border: '1px solid #c3c4c7', borderBottom: 'none', padding: '6px 14px', fontSize: '0.95rem', cursor: 'pointer', background: 'transparent', color: '#3c434a' };
const editorIconBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: '#3c434a', minWidth: 24, padding: '2px 4px' };
const editorTagBtn = { background: '#f6f7f7', border: '1px solid #8c8f94', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1.2, color: '#3c434a', padding: '4px 10px' };
const okBtn = { background: '#f6f7f7', border: '1px solid #8c8f94', borderRadius: 4, color: '#1d2327', padding: '4px 10px', fontSize: '0.9rem', cursor: 'pointer' };
const serviceActionBtn = { width: 22, height: 22, border: '1px solid #8c8f94', background: '#fff', borderRadius: '50%', lineHeight: '18px', textAlign: 'center', cursor: 'pointer', color: '#3c434a', fontSize: '1rem' };
const clientSelectBtn = { width: '100%', border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 8px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', color: '#1d2327', fontSize: '0.9rem' };
const clientSelectList = { position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, border: '1px solid #c3c4c7', background: '#fff', zIndex: 80, maxHeight: 260, overflowY: 'auto' };
const clientSelectItem = { width: '100%', border: 'none', borderBottom: '1px solid #f0f0f1', background: '#fff', textAlign: 'left', padding: '8px 10px', cursor: 'pointer', color: '#1d2327' };
const clientSelectEmpty = { padding: '10px', color: '#646970', fontSize: '0.9rem' };
const alertOk = { background: '#edfaef', border: '1px solid #68de7c', color: '#1a7a2e', padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem' };
const alertErr = { background: '#fce8e8', border: '1px solid #e05252', color: '#c00', padding: '8px 12px', marginBottom: 12, borderRadius: 3, fontSize: '0.9rem' };
