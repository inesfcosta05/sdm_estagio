import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';

// MD5 simples para Gravatar (sem dependências externas)
function md5(str) {
  function safeAdd(x, y) { const lsw = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff); }
  function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a,b,c,d,x,s,t){return md5cmn((b&c)|(~b&d),a,b,x,s,t);}
  function md5gg(a,b,c,d,x,s,t){return md5cmn((b&d)|(c&~d),a,b,x,s,t);}
  function md5hh(a,b,c,d,x,s,t){return md5cmn(b^c^d,a,b,x,s,t);}
  function md5ii(a,b,c,d,x,s,t){return md5cmn(c^(b|~d),a,b,x,s,t);}
  const utf8 = unescape(encodeURIComponent(str));
  const len = utf8.length;
  const words = [];
  for (let i=0;i<len;i++) words[i>>2]|=utf8.charCodeAt(i)<<(i%4)*8;
  words[len>>2]|=0x80<<(len%4)*8;
  words[(((len+64)>>6)<<4)+14]=len*8;
  let [a,b,c,d]=[1732584193,-271733879,-1732584194,271733878];
  for (let i=0;i<words.length;i+=16){
    const [A,B,C,D]=[a,b,c,d];
    a=md5ff(a,b,c,d,words[i+0],7,-680876936);d=md5ff(d,a,b,c,words[i+1],12,-389564586);c=md5ff(c,d,a,b,words[i+2],17,606105819);b=md5ff(b,c,d,a,words[i+3],22,-1044525330);
    a=md5ff(a,b,c,d,words[i+4],7,-176418897);d=md5ff(d,a,b,c,words[i+5],12,1200080426);c=md5ff(c,d,a,b,words[i+6],17,-1473231341);b=md5ff(b,c,d,a,words[i+7],22,-45705983);
    a=md5ff(a,b,c,d,words[i+8],7,1770035416);d=md5ff(d,a,b,c,words[i+9],12,-1958414417);c=md5ff(c,d,a,b,words[i+10],17,-42063);b=md5ff(b,c,d,a,words[i+11],22,-1990404162);
    a=md5ff(a,b,c,d,words[i+12],7,1804603682);d=md5ff(d,a,b,c,words[i+13],12,-40341101);c=md5ff(c,d,a,b,words[i+14],17,-1502002290);b=md5ff(b,c,d,a,words[i+15],22,1236535329);
    a=md5gg(a,b,c,d,words[i+1],5,-165796510);d=md5gg(d,a,b,c,words[i+6],9,-1069501632);c=md5gg(c,d,a,b,words[i+11],14,643717713);b=md5gg(b,c,d,a,words[i+0],20,-373897302);
    a=md5gg(a,b,c,d,words[i+5],5,-701558691);d=md5gg(d,a,b,c,words[i+10],9,38016083);c=md5gg(c,d,a,b,words[i+15],14,-660478335);b=md5gg(b,c,d,a,words[i+4],20,-405537848);
    a=md5gg(a,b,c,d,words[i+9],5,568446438);d=md5gg(d,a,b,c,words[i+14],9,-1019803690);c=md5gg(c,d,a,b,words[i+3],14,-187363961);b=md5gg(b,c,d,a,words[i+8],20,1163531501);
    a=md5gg(a,b,c,d,words[i+13],5,-1444681467);d=md5gg(d,a,b,c,words[i+2],9,-51403784);c=md5gg(c,d,a,b,words[i+7],14,1735328473);b=md5gg(b,c,d,a,words[i+12],20,-1926607734);
    a=md5hh(a,b,c,d,words[i+5],4,-378558);d=md5hh(d,a,b,c,words[i+8],11,-2022574463);c=md5hh(c,d,a,b,words[i+11],16,1839030562);b=md5hh(b,c,d,a,words[i+14],23,-35309556);
    a=md5hh(a,b,c,d,words[i+1],4,-1530992060);d=md5hh(d,a,b,c,words[i+4],11,1272893353);c=md5hh(c,d,a,b,words[i+7],16,-155497632);b=md5hh(b,c,d,a,words[i+10],23,-1094730640);
    a=md5hh(a,b,c,d,words[i+13],4,681279174);d=md5hh(d,a,b,c,words[i+0],11,-358537222);c=md5hh(c,d,a,b,words[i+3],16,-722521979);b=md5hh(b,c,d,a,words[i+6],23,76029189);
    a=md5hh(a,b,c,d,words[i+9],4,-640364487);d=md5hh(d,a,b,c,words[i+12],11,-421815835);c=md5hh(c,d,a,b,words[i+15],16,530742520);b=md5hh(b,c,d,a,words[i+2],23,-995338651);
    a=md5ii(a,b,c,d,words[i+0],6,-198630844);d=md5ii(d,a,b,c,words[i+7],10,1126891415);c=md5ii(c,d,a,b,words[i+14],15,-1416354905);b=md5ii(b,c,d,a,words[i+5],21,-57434055);
    a=md5ii(a,b,c,d,words[i+12],6,1700485571);d=md5ii(d,a,b,c,words[i+3],10,-1894986606);c=md5ii(c,d,a,b,words[i+10],15,-1051523);b=md5ii(b,c,d,a,words[i+1],21,-2054922799);
    a=md5ii(a,b,c,d,words[i+8],6,1873313359);d=md5ii(d,a,b,c,words[i+15],10,-30611744);c=md5ii(c,d,a,b,words[i+6],15,-1560198380);b=md5ii(b,c,d,a,words[i+13],21,1309151649);
    a=md5ii(a,b,c,d,words[i+4],6,-145523070);d=md5ii(d,a,b,c,words[i+11],10,-1120210379);c=md5ii(c,d,a,b,words[i+2],15,718787259);b=md5ii(b,c,d,a,words[i+9],21,-343485551);
    a=safeAdd(a,A);b=safeAdd(b,B);c=safeAdd(c,C);d=safeAdd(d,D);
  }
  return [a,b,c,d].map(n=>(n<0?n+0x100000000:n).toString(16).padStart(8,'0').match(/../g).map(h=>h.split('').reverse().join('')).join('')).join('');
}

function gravatarUrl(email, size = 110) {
  const hash = md5((email || '').trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}

const COLOR_SCHEMES = [
  { id: 'default', label: 'Por omissão', colors: ['#1d2327', '#2c3338', '#2271b1', '#72aee6'] },
  { id: 'light', label: 'Leve', colors: ['#dcdcde', '#8c8f94', '#d54e21', '#1ea5cb'] },
  { id: 'modern', label: 'Moderno', colors: ['#1e1e1e', '#3858e9', '#43d675', '#72aee6'] },
  { id: 'blue', label: 'Azul', colors: ['#096484', '#4796b3', '#52accc', '#74b6ce'] },
  { id: 'coffee', label: 'Café', colors: ['#46403c', '#59524c', '#c7a589', '#9ea476'] },
  { id: 'ectoplasm', label: 'Ectoplasma', colors: ['#413256', '#523f6d', '#a3b745', '#d46f15'] },
  { id: 'midnight', label: 'Meia-noite', colors: ['#25282b', '#363b3f', '#69a8bb', '#e14d43'] },
  { id: 'ocean', label: 'Oceano', colors: ['#627c83', '#738e96', '#9ebaa0', '#aa9d88'] },
  { id: 'sunrise', label: 'Nascer do Sol', colors: ['#b43c38', '#cf4944', '#dd823b', '#ccaf0b'] },
  { id: 'jardim', label: 'Jardim Encantado', colors: ['#9b3060', '#b84878', '#e8a0be', '#f4c2d6'] }
];

export default function Perfil({ user, language = 'default', onLanguageChange, colorScheme = 'ocean', onColorSchemeChange, onProfileUpdate, customSchemes = [], onCustomSchemesChange }) {
  const locale = language === 'en' ? 'en' : 'pt';
  const t = {
    pt: {
      pageTitle: 'Perfil',
      personalOptions: 'Opções pessoais',
      visualEditor: 'Editor visual',
      disableEditor: 'Não utilizar o editor visual ao escrever',
      panelPalette: 'Paleta de cores do painel',
      shortcuts: 'Atalhos de teclado',
      shortcutsText: 'Ligar atalhos de teclado para navegar rapidamente (Alt+H, Alt+F, Alt+C, Alt+P, Alt+N, Alt+U).',
      toolbar: 'Barra de ferramentas',
      toolbarText: 'Mostrar a barra de ferramentas ao visualizar o site',
      language: 'Idioma',
      default: 'Por omissão',
      portuguese: 'Português',
      english: 'Inglês',
      nameSection: 'Nome',
      username: 'Nome de utilizador',
      usernameReadonly: 'Os nomes de utilizador não podem ser alterados.',
      firstName: 'Nome',
      lastName: 'Apelido',
      nickname: 'Alcunha (obrigatório)',
      publicName: 'Mostrar o nome publicamente como',
      contactSection: 'Informações de contacto',
      emailRequired: 'Email (obrigatório)',
      emailHelp: 'Se alterar isto, será enviado um email de confirmação para o seu novo endereço.',
      site: 'Site',
      about: 'Sobre si',
      bio: 'Informação biográfica',
      bioHelp: 'Partilhe algumas informações biográficas para preencher o seu perfil.',
      avatar: 'Imagem de perfil',
      gravatar: 'Pode alterar a sua fotografia de perfil no Gravatar.',
      account: 'Gestão da conta',
      newPassword: 'Nova senha',
      setNewPassword: 'Definir nova senha',
      sessions: 'Sessões',
      closeSessions: 'Fechar a sessão em todas as outras localizações',
      sessionsHelp: 'Perdeu o seu telefone ou deixou a sua conta aberta num computador público? Pode fechar a sessão em todas as outras localizações, ficando ligado aqui.',
      appPasswords: 'Senhas de aplicação',
      appPasswordsHelp: 'As senhas de aplicação permitem a autenticação através de sistemas não interativos, como XML-RPC ou a REST API, sem ter de fornecer a sua senha.',
      appPasswordName: 'Nome da nova senha de aplicação',
      appPasswordHelp: 'Necessário para criar uma senha de aplicação, mas não para atualizar o utilizador.',
      addAppPassword: 'Adicionar nova senha de aplicação',
      updateProfile: 'Atualizar perfil',
      saved: 'Guardado.'
    },
    en: {
      pageTitle: 'Profile',
      personalOptions: 'Personal options',
      visualEditor: 'Visual editor',
      disableEditor: 'Disable the visual editor when writing',
      panelPalette: 'Admin color scheme',
      shortcuts: 'Keyboard shortcuts',
      shortcutsText: 'Enable keyboard shortcuts for quick navigation (Alt+H, Alt+F, Alt+C, Alt+P, Alt+N, Alt+U).',
      toolbar: 'Toolbar',
      toolbarText: 'Show toolbar when viewing site',
      language: 'Language',
      default: 'Default',
      portuguese: 'Portuguese',
      english: 'English',
      nameSection: 'Name',
      username: 'Username',
      usernameReadonly: 'Usernames cannot be changed.',
      firstName: 'First name',
      lastName: 'Last name',
      nickname: 'Nickname (required)',
      publicName: 'Display name publicly as',
      contactSection: 'Contact info',
      emailRequired: 'Email (required)',
      emailHelp: 'If you change this, a confirmation email will be sent to your new address.',
      site: 'Website',
      about: 'About yourself',
      bio: 'Biographical info',
      bioHelp: 'Share biographical information to fill out your profile.',
      avatar: 'Profile picture',
      gravatar: 'You can change your profile picture on Gravatar.',
      account: 'Account management',
      newPassword: 'New password',
      setNewPassword: 'Set new password',
      sessions: 'Sessions',
      closeSessions: 'Log out everywhere else',
      sessionsHelp: 'Lost your phone or left your account open on a shared computer? You can log out everywhere else and stay signed in here.',
      appPasswords: 'Application passwords',
      appPasswordsHelp: 'Application passwords allow authentication through non-interactive systems such as XML-RPC or REST API without sharing your password.',
      appPasswordName: 'New application password name',
      appPasswordHelp: 'Required to create an application password, but not to update the user.',
      addAppPassword: 'Add new application password',
      updateProfile: 'Update profile',
      saved: 'Saved.'
    }
  }[locale];

  const defaults = useMemo(() => {
    const raw = (user?.username || user?.name || user?.email || 'editor').trim();
    const username = raw.includes('@') ? raw.split('@')[0] : raw;
    const email = user?.email || (raw.includes('@') ? raw : '');
    const nameCandidate = (user?.displayName || user?.name || '').trim();
    const isNameEmail = nameCandidate.includes('@');

    let firstName = (user?.firstName || user?.nome || '').trim();
    let lastName = (user?.lastName || user?.apelido || '').trim();

    if (!firstName && nameCandidate && !isNameEmail) {
      const parts = nameCandidate.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        firstName = parts[0];
        if (!lastName) {
          lastName = parts.slice(1).join(' ');
        }
      } else if (parts.length === 1 && parts[0].toLowerCase() !== username.toLowerCase()) {
        firstName = parts[0];
      }
    }

    const composedName = `${firstName} ${lastName}`.trim();
    const displayName = (
      user?.displayName ||
      user?.nomePublico ||
      composedName ||
      (!isNameEmail && nameCandidate && nameCandidate.toLowerCase() !== username.toLowerCase() ? nameCandidate : '') ||
      username
    ).trim();

    return {
      username,
      nome: firstName,
      apelido: lastName,
      alcunha: user?.nickname || user?.alcunha || username,
      nomePublico: displayName,
      email,
      site: user?.site || '',
      bio: user?.bio || ''
    };
  }, [user]);

  const [form, setForm] = useState(defaults);
  const [palette, setPalette] = useState(colorScheme || user?.colorScheme || 'ocean');
  const [saved, setSaved] = useState(false);

  // Preferences stored in localStorage
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('userPrefs') || '{}'); } catch { return {}; }
  });
  const updatePref = (key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('userPrefs', JSON.stringify(next));
      return next;
    });
  };

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState(null);

  const handleChangePassword = async () => {
    if (!passwordForm.next) return setPasswordMsg({ error: 'Insira a nova senha.' });
    if (passwordForm.next !== passwordForm.confirm) return setPasswordMsg({ error: 'As senhas não coincidem.' });
    const login = (user?.username || user?.email || '').trim();
    try {
      const res = await apiFetch('/api/perfil/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, currentPassword: passwordForm.current, newPassword: passwordForm.next })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMsg({ ok: 'Senha alterada com sucesso.' });
        setPasswordForm({ current: '', next: '', confirm: '' });
        setShowPasswordForm(false);
      } else {
        setPasswordMsg({ error: data.error || 'Erro ao alterar senha.' });
      }
    } catch {
      setPasswordMsg({ error: 'Não foi possível ligar ao servidor.' });
    }
  };

  // Sessions
  const [sessionMsg, setSessionMsg] = useState(null);
  const handleCloseSessions = async () => {
    const login = (user?.username || user?.email || '').trim();
    const currentToken = (user?.sessionToken || sessionStorage.getItem('sessionToken') || '').trim();
    if (!login) return;
    if (!currentToken) {
      setSessionMsg({ error: 'Sessão atual não identificada. Termine sessão e entre novamente.' });
      return;
    }
    try {
      const res = await apiFetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, currentToken })
      });
      const data = await res.json();
      if (data.success) {
        setSessionMsg({ ok: data.closed > 0 ? `${data.closed} sessão(ões) terminada(s).` : 'Não há outras sessões ativas.' });
      } else setSessionMsg({ error: data.error || 'Erro ao terminar sessões.' });
    } catch {
      setSessionMsg({ error: 'Não foi possível ligar ao servidor.' });
    }
  };

  // App passwords (backend)
  const [appPasswordName, setAppPasswordName] = useState('');
  const [appPasswords, setAppPasswords] = useState([]);
  const [newAppPasswordToken, setNewAppPasswordToken] = useState(null);
  const [appPasswordsLoading, setAppPasswordsLoading] = useState(false);
  const [appPasswordError, setAppPasswordError] = useState(null);

  const getLogin = () => (user?.username || user?.email || '').trim();

  const parseJsonSafe = async (res) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  };

  const loadAppPasswords = async () => {
    const login = getLogin();
    if (!login) return;
    setAppPasswordsLoading(true);
    setAppPasswordError(null);
    try {
      const res = await apiFetch(`/api/app-passwords?login=${encodeURIComponent(login)}`);
      const data = await parseJsonSafe(res);
      if (res.ok && data) setAppPasswords(Array.isArray(data) ? data : []);
      else if (!res.ok) setAppPasswordError(data?.error || `Erro do servidor (${res.status}).`);
    } catch {
      setAppPasswordError('Não foi possível ligar ao servidor. Verifique se o backend está a correr.');
    } finally {
      setAppPasswordsLoading(false);
    }
  };

  useEffect(() => { loadAppPasswords(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddAppPassword = async () => {
    const name = appPasswordName.trim();
    if (!name) return;
    const login = getLogin();
    if (!login) return;
    setAppPasswordError(null);
    try {
      const res = await apiFetch('/api/app-passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, name })
      });
      const data = await parseJsonSafe(res);
      if (res.ok && data?.token) {
        setNewAppPasswordToken(data.token);
        setAppPasswordName('');
        await loadAppPasswords();
      } else {
        setAppPasswordError(data?.error || `Erro do servidor (${res.status}).`);
      }
    } catch {
      setAppPasswordError('Não foi possível ligar ao servidor. Verifique se o backend está a correr.');
    }
  };

  const handleRevokeAppPassword = async (id) => {
    const login = getLogin();
    if (!login) return;
    setAppPasswordError(null);
    try {
      const res = await apiFetch(`/api/app-passwords/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login })
      });
      const data = await parseJsonSafe(res);
      if (res.ok) await loadAppPasswords();
      else setAppPasswordError(data?.error || `Erro do servidor (${res.status}).`);
    } catch {
      setAppPasswordError('Não foi possível ligar ao servidor. Verifique se o backend está a correr.');
    }
  };

  // Custom theme builder state
  const BLANK_CUSTOM = { name: '', sidebar: '#2c3338', topbar: '#2271b1', accent: '#72aee6', accentAlt: '#43d675', bg: '#f6f7f7' };
  const [newTheme, setNewTheme] = useState(BLANK_CUSTOM);
  const [showBuilder, setShowBuilder] = useState(false);

  const buildCustomVars = (t) => ({
    'theme-page-bg': t.bg,
    'theme-surface-bg': '#ffffff',
    'theme-topbar-start': t.topbar,
    'theme-topbar-end': t.topbar,
    'theme-topbar-text': '#ffffff',
    'theme-sidebar-start': t.sidebar,
    'theme-sidebar-end': t.sidebar,
    'theme-sidebar-border': 'rgba(255,255,255,0.12)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.10)',
    'theme-sidebar-active-start': t.accent,
    'theme-sidebar-active-end': t.accentAlt
  });

  const handleSaveCustomTheme = () => {
    if (!newTheme.name.trim()) return;
    const id = 'custom_' + Date.now();
    const scheme = {
      id,
      label: newTheme.name.trim(),
      colors: [newTheme.sidebar, newTheme.topbar, newTheme.accent, newTheme.bg],
      vars: buildCustomVars(newTheme)
    };
    const next = [...customSchemes, scheme];
    if (onCustomSchemesChange) onCustomSchemesChange(next);
    setNewTheme(BLANK_CUSTOM);
    setShowBuilder(false);
    setPalette(id);
    if (onColorSchemeChange) onColorSchemeChange(id);
  };

  const handleDeleteCustomTheme = (id) => {
    const next = customSchemes.filter(s => s.id !== id);
    if (onCustomSchemesChange) onCustomSchemesChange(next);
    if (palette === id) {
      setPalette('ocean');
      if (onColorSchemeChange) onColorSchemeChange('ocean');
    }
  };

  useEffect(() => {
    setForm(defaults);
  }, [defaults]);

  useEffect(() => {
    setPalette(colorScheme || 'ocean');
  }, [colorScheme]);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(id);
  }, [saved]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleUpdateProfile = () => {
    if (onColorSchemeChange) {
      onColorSchemeChange(palette);
    }
    if (onProfileUpdate) {
      onProfileUpdate({
        username: form.username,
        name: `${form.nome} ${form.apelido}`.trim() || form.username,
        firstName: form.nome,
        lastName: form.apelido,
        nickname: form.alcunha,
        displayName: form.nomePublico,
        nome: form.nome,
        apelido: form.apelido,
        nomePublico: form.nomePublico,
        email: form.email,
        site: form.site,
        bio: form.bio,
        colorScheme: palette,
        preferences: prefs
      });
    }
    setSaved(true);
  };

  return (
    <div className="perfil-page">
      <h1 className="perfil-title">{t.pageTitle}</h1>

      <section className="perfil-section">
        <h2>{t.personalOptions}</h2>

        <div className="perfil-row perfil-row-top">
          <label className="perfil-label">{t.panelPalette}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className="perfil-palettes">
              {COLOR_SCHEMES.map((scheme) => (
                <label key={scheme.id} className={`perfil-palette ${palette === scheme.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="colorScheme"
                    checked={palette === scheme.id}
                    onChange={() => setPalette(scheme.id)}
                  />
                  <span>{scheme.label}</span>
                  <span className="perfil-palette-strip" aria-hidden="true">
                    {scheme.colors.map((color) => (
                      <span key={`${scheme.id}-${color}`} className="perfil-palette-color" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </label>
              ))}
              {customSchemes.map((scheme) => (
                <label key={scheme.id} className={`perfil-palette ${palette === scheme.id ? 'active' : ''}`} style={{ position: 'relative' }}>
                  <input
                    type="radio"
                    name="colorScheme"
                    checked={palette === scheme.id}
                    onChange={() => setPalette(scheme.id)}
                  />
                  <span>{scheme.label}</span>
                  <button
                    type="button"
                    title="Apagar tema"
                    onClick={(e) => { e.preventDefault(); handleDeleteCustomTheme(scheme.id); }}
                    style={{ position: 'absolute', top: 2, right: 4, background: 'none', border: 'none', color: '#b32d2e', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: 0 }}
                  >×</button>
                  <span className="perfil-palette-strip" aria-hidden="true">
                    {scheme.colors.map((color, i) => (
                      <span key={i} className="perfil-palette-color" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowBuilder(v => !v)}
                className="sdm-btn sdm-btn-dashed"
                style={{ borderRadius: 3, padding: '3px 10px', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                {showBuilder ? '− Cancelar' : '+ Criar tema personalizado'}
              </button>
            </div>
            {showBuilder && (
              <div style={{ marginTop: 8, padding: '12px 14px', border: '1px solid #c3c4c7', borderRadius: 3, background: '#f6f7f7', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Nome do tema</label>
                  <input
                    type="text"
                    value={newTheme.name}
                    onChange={e => setNewTheme(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Meu tema"
                    style={{ border: '1px solid #c3c4c7', borderRadius: 3, padding: '4px 8px', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                {[
                  { key: 'sidebar', label: 'Cor da sidebar' },
                  { key: 'topbar', label: 'Cor da topbar' },
                  { key: 'accent', label: 'Cor de destaque' },
                  { key: 'accentAlt', label: 'Cor de destaque secundária' },
                  { key: 'bg', label: 'Cor de fundo da página' }
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: '0.82rem', width: 170, flexShrink: 0 }}>{label}</label>
                    <input
                      type="color"
                      value={newTheme[key]}
                      onChange={e => setNewTheme(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: 36, height: 28, border: '1px solid #c3c4c7', borderRadius: 3, cursor: 'pointer', padding: 2, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.78rem', color: '#646970', fontFamily: 'monospace' }}>{newTheme[key]}</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleSaveCustomTheme}
                  disabled={!newTheme.name.trim()}
                  className="sdm-btn sdm-btn-primary"
                  style={{ alignSelf: 'flex-start', borderRadius: 3, padding: '5px 14px', fontSize: '0.88rem', cursor: newTheme.name.trim() ? 'pointer' : 'not-allowed', opacity: newTheme.name.trim() ? 1 : 0.6 }}
                >
                  Guardar tema
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="perfil-row">
          <label className="perfil-label">{t.shortcuts}</label>
          <label className="perfil-inline-check">
            <input type="checkbox" checked={!!prefs.keyboardShortcuts} onChange={e => updatePref('keyboardShortcuts', e.target.checked)} />
            <span>{t.shortcutsText}</span>
          </label>
        </div>

        <div className="perfil-row">
          <label className="perfil-label">{t.language}</label>
          <select
            className="perfil-input perfil-select"
            value={language}
            onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
          >
            <option value="default">{t.default}</option>
            <option value="en">{t.english}</option>
            <option value="pt">{t.portuguese}</option>
          </select>
        </div>
      </section>

      <section className="perfil-section">
        <h2>{t.nameSection}</h2>

        <div className="perfil-row">
          <label className="perfil-label">{t.username}</label>
          <div className="perfil-control-group">
            <input className="perfil-input" value={form.username} disabled />
            <small>{t.usernameReadonly}</small>
          </div>
        </div>

        <div className="perfil-row">
          <label className="perfil-label">{t.firstName}</label>
          <input className="perfil-input" value={form.nome} onChange={(e) => update('nome', e.target.value)} />
        </div>

        <div className="perfil-row">
          <label className="perfil-label">{t.lastName}</label>
          <input className="perfil-input" value={form.apelido} onChange={(e) => update('apelido', e.target.value)} />
        </div>

        <div className="perfil-row">
          <label className="perfil-label">{t.nickname}</label>
          <input className="perfil-input" value={form.alcunha} onChange={(e) => update('alcunha', e.target.value)} />
        </div>

        <div className="perfil-row">
          <label className="perfil-label">{t.publicName}</label>
          <select className="perfil-input perfil-select" value={form.nomePublico} onChange={(e) => update('nomePublico', e.target.value)}>
            <option>{`${form.nome} ${form.apelido}`.trim() || form.username}</option>
            <option>{form.username}</option>
            <option>{form.nomePublico}</option>
          </select>
        </div>
      </section>

      <section className="perfil-section">
        <h2>{t.contactSection}</h2>

        <div className="perfil-row">
          <label className="perfil-label">{t.emailRequired}</label>
          <div className="perfil-control-group">
            <input className="perfil-input" value={form.email} onChange={(e) => update('email', e.target.value)} />
            <small>{t.emailHelp}</small>
          </div>
        </div>

        <div className="perfil-row">
          <label className="perfil-label">{t.site}</label>
          <input className="perfil-input" value={form.site} onChange={(e) => update('site', e.target.value)} />
        </div>
      </section>

      <section className="perfil-section">
        <h2>{t.about}</h2>

        <div className="perfil-row perfil-row-top">
          <label className="perfil-label">{t.bio}</label>
          <div className="perfil-control-group">
            <textarea className="perfil-textarea" rows="4" value={form.bio} onChange={(e) => update('bio', e.target.value)} />
            <small>{t.bioHelp}</small>
          </div>
        </div>

        <div className="perfil-row perfil-row-top">
          <label className="perfil-label">{t.avatar}</label>
          <div className="perfil-avatar-block">
            <img
              src={user?.avatarUrl || gravatarUrl(form.email, 110)}
              alt="Foto de perfil"
              style={{ width: 110, height: 110, objectFit: 'cover', display: 'block', borderRadius: 4 }}
              onError={e => { e.target.src = gravatarUrl(form.email, 110); }}
            />
            <a href="https://gravatar.com/emails" target="_blank" rel="noreferrer">{t.gravatar}</a>
          </div>
        </div>
      </section>

      <section className="perfil-section">
        <h2>{t.account}</h2>

        <div className="perfil-row perfil-row-top">
          <label className="perfil-label">{t.newPassword}</label>
          <div className="perfil-control-group">
            <button
              type="button"
              className="perfil-btn-secondary"
              onClick={() => {
                setShowPasswordForm(v => {
                  const nextOpen = !v;
                  if (nextOpen) {
                    setPasswordForm({ current: '', next: '', confirm: '' });
                  }
                  return nextOpen;
                });
                setPasswordMsg(null);
              }}
            >
              {showPasswordForm ? 'Cancelar' : t.setNewPassword}
            </button>
            {showPasswordForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, maxWidth: 340 }}>
                <input
                  className="perfil-input"
                  type="password"
                  name="current-password-profile"
                  autoComplete="off"
                  placeholder="Senha atual (deixe vazio se nunca definiu)"
                  value={passwordForm.current}
                  onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                />
                <input
                  className="perfil-input"
                  type="password"
                  name="new-password-profile"
                  autoComplete="new-password"
                  placeholder="Nova senha"
                  value={passwordForm.next}
                  onChange={e => setPasswordForm(p => ({ ...p, next: e.target.value }))}
                />
                <input
                  className="perfil-input"
                  type="password"
                  name="confirm-password-profile"
                  autoComplete="new-password"
                  placeholder="Confirmar nova senha"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                />
                <button type="button" className="perfil-btn-primary" onClick={handleChangePassword} style={{ alignSelf: 'flex-start' }}>Alterar senha</button>
                {passwordMsg?.error && <small style={{ color: '#b32d2e' }}>{passwordMsg.error}</small>}
                {passwordMsg?.ok && <small style={{ color: '#00a32a' }}>{passwordMsg.ok}</small>}
              </div>
            )}
          </div>
        </div>

        <div className="perfil-row perfil-row-top">
          <label className="perfil-label">{t.sessions}</label>
          <div className="perfil-control-group">
            <button type="button" className="perfil-btn-secondary" onClick={handleCloseSessions}>{t.closeSessions}</button>
            <small>{t.sessionsHelp}</small>
            {sessionMsg?.ok && <small style={{ color: '#00a32a' }}>{sessionMsg.ok}</small>}
            {sessionMsg?.error && <small style={{ color: '#b32d2e' }}>{sessionMsg.error}</small>}
          </div>
        </div>
      </section>

      <section className="perfil-section">
        <h2>{t.appPasswords}</h2>
        <p className="perfil-help-text">{t.appPasswordsHelp}</p>

        {newAppPasswordToken && (
          <div style={{ background: '#edfaef', border: '1px solid #00a32a', borderRadius: 4, padding: '10px 14px', marginBottom: 16, maxWidth: 500 }}>
            <strong style={{ color: '#00a32a', fontSize: '0.85rem' }}>Guarde esta senha — não será mostrada novamente!</strong>
            <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: 2, margin: '6px 0' }}>{newAppPasswordToken}</div>
            <button type="button" onClick={() => setNewAppPasswordToken(null)} style={{ fontSize: '0.78rem', background: 'none', border: 'none', color: '#646970', cursor: 'pointer', padding: 0 }}>Fechar</button>
          </div>
        )}

        {appPasswordError && <small style={{ color: '#b32d2e', display: 'block', marginBottom: 8 }}>{appPasswordError}</small>}
        {appPasswordsLoading && <small style={{ color: '#646970', display: 'block', marginBottom: 8 }}>A carregar…</small>}
        {appPasswords.length > 0 && (
          <table style={{ width: '100%', maxWidth: 600, borderCollapse: 'collapse', marginBottom: 16, fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #c3c4c7' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Criada</th>
                <th style={{ padding: '4px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {appPasswords.map((ap) => (
                <tr key={ap.id} style={{ borderBottom: '1px solid #f0f0f1' }}>
                  <td style={{ padding: '4px 8px' }}>{ap.name}</td>
                  <td style={{ padding: '4px 8px', color: '#646970' }}>
                    {ap.created_at ? new Date(ap.created_at).toLocaleDateString('pt-PT') : '—'}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <button type="button" onClick={() => handleRevokeAppPassword(ap.id)} className="sdm-btn sdm-btn-danger" style={{ borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>Revogar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="perfil-row perfil-row-top">
          <label className="perfil-label">{t.appPasswordName}</label>
          <div className="perfil-control-group">
            <input
              className="perfil-input"
              value={appPasswordName}
              onChange={e => setAppPasswordName(e.target.value)}
              placeholder="Ex: Plugin de backup"
            />
            <small>{t.appPasswordHelp}</small>
          </div>
        </div>

        <div className="perfil-actions">
          <button type="button" className="perfil-btn-secondary" onClick={handleAddAppPassword} disabled={!appPasswordName.trim()}>
            {t.addAppPassword}
          </button>
        </div>
      </section>

      <div className="perfil-actions">
        <button type="button" className="perfil-btn-primary" onClick={handleUpdateProfile}>{t.updateProfile}</button>
        {saved && <span className="perfil-save-ok">{t.saved}</span>}
      </div>
    </div>
  );
}