import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/sidebar';
import Topbar from './components/topbar';

// Páginas
import Home from './pages/home';
import Fichas from './pages/ficha';
import NovaFicha from './pages/novaficha';
import EditarFicha from './pages/editarficha';
import Clientes from './pages/cliente';
import NovoCliente from './pages/novocliente';
import EditarCliente from './pages/editarcliente';
import Paginas from './pages/paginas';
import NovaPagina from './pages/novapagina';
import EditarPagina from './pages/editarpagina';
import Perfil from './pages/perfil';
import Relatorios from './pages/relatorios';
import Login from './pages/login';
import UsersAdmin from './pages/usersadmin';
import { apiFetch } from './api';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeRole = (role) => {
  const raw = (role || '').toString().trim().toLowerCase();
  if (raw === 'administrator' || raw === 'administrador' || raw === 'admin') return 'admin';
  if (raw === 'contributor' || raw === 'contribuidor') return 'contributor';
  return 'editor';
};

const isAdminRole = (role) => normalizeRole(role) === 'admin';

const COLOR_SCHEME_VARS = {
  default: {
    'theme-page-bg': '#f5f7fa',
    'theme-surface-bg': '#f8fafc',
    'theme-topbar-start': '#607d88',
    'theme-topbar-end': '#6b8a95',
    'theme-topbar-text': '#eef4f6',
    'theme-sidebar-start': '#1a1d2e',
    'theme-sidebar-end': '#16213e',
    'theme-sidebar-border': 'rgba(255,255,255,0.10)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.08)',
    'theme-sidebar-active-start': '#4f46e5',
    'theme-sidebar-active-end': '#7c3aed'
  },
  light: {
    'theme-page-bg': '#f4f4f4',
    'theme-surface-bg': '#ffffff',
    'theme-topbar-start': '#8c8f94',
    'theme-topbar-end': '#9ea2a8',
    'theme-topbar-text': '#ffffff',
    'theme-sidebar-start': '#dcdcde',
    'theme-sidebar-end': '#cfd1d4',
    'theme-sidebar-border': 'rgba(0,0,0,0.12)',
    'theme-sidebar-hover': 'rgba(0,0,0,0.08)',
    'theme-sidebar-active-start': '#d54e21',
    'theme-sidebar-active-end': '#1ea5cb'
  },
  modern: {
    'theme-page-bg': '#f6f8ff',
    'theme-surface-bg': '#ffffff',
    'theme-topbar-start': '#3858e9',
    'theme-topbar-end': '#4c6cf0',
    'theme-topbar-text': '#ffffff',
    'theme-sidebar-start': '#1e1e1e',
    'theme-sidebar-end': '#2a2a2a',
    'theme-sidebar-border': 'rgba(255,255,255,0.10)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.10)',
    'theme-sidebar-active-start': '#3858e9',
    'theme-sidebar-active-end': '#43d675'
  },
  blue: {
    'theme-page-bg': '#eef6f9',
    'theme-surface-bg': '#f7fbfd',
    'theme-topbar-start': '#096484',
    'theme-topbar-end': '#4796b3',
    'theme-topbar-text': '#ffffff',
    'theme-sidebar-start': '#0a5f7d',
    'theme-sidebar-end': '#0f7598',
    'theme-sidebar-border': 'rgba(255,255,255,0.14)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.12)',
    'theme-sidebar-active-start': '#52accc',
    'theme-sidebar-active-end': '#74b6ce'
  },
  coffee: {
    'theme-page-bg': '#f4efea',
    'theme-surface-bg': '#fbf8f5',
    'theme-topbar-start': '#59524c',
    'theme-topbar-end': '#6f6760',
    'theme-topbar-text': '#fff8ef',
    'theme-sidebar-start': '#46403c',
    'theme-sidebar-end': '#59524c',
    'theme-sidebar-border': 'rgba(255,255,255,0.10)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.11)',
    'theme-sidebar-active-start': '#c7a589',
    'theme-sidebar-active-end': '#9ea476'
  },
  ectoplasm: {
    'theme-page-bg': '#f2eef6',
    'theme-surface-bg': '#faf7fd',
    'theme-topbar-start': '#523f6d',
    'theme-topbar-end': '#6a4f8f',
    'theme-topbar-text': '#f8f4ff',
    'theme-sidebar-start': '#413256',
    'theme-sidebar-end': '#523f6d',
    'theme-sidebar-border': 'rgba(255,255,255,0.10)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.11)',
    'theme-sidebar-active-start': '#a3b745',
    'theme-sidebar-active-end': '#d46f15'
  },
  midnight: {
    'theme-page-bg': '#eef2f4',
    'theme-surface-bg': '#f5f8fa',
    'theme-topbar-start': '#363b3f',
    'theme-topbar-end': '#495259',
    'theme-topbar-text': '#f0f6fb',
    'theme-sidebar-start': '#25282b',
    'theme-sidebar-end': '#363b3f',
    'theme-sidebar-border': 'rgba(255,255,255,0.10)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.11)',
    'theme-sidebar-active-start': '#69a8bb',
    'theme-sidebar-active-end': '#e14d43'
  },
  ocean: {
    'theme-page-bg': '#eef4f2',
    'theme-surface-bg': '#f6faf8',
    'theme-topbar-start': '#627c83',
    'theme-topbar-end': '#738e96',
    'theme-topbar-text': '#f2fbff',
    'theme-sidebar-start': '#627c83',
    'theme-sidebar-end': '#738e96',
    'theme-sidebar-border': 'rgba(255,255,255,0.12)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.12)',
    'theme-sidebar-active-start': '#9ebaa0',
    'theme-sidebar-active-end': '#aa9d88'
  },
  sunrise: {
    'theme-page-bg': '#fbf2ef',
    'theme-surface-bg': '#fff8f5',
    'theme-topbar-start': '#b43c38',
    'theme-topbar-end': '#cf4944',
    'theme-topbar-text': '#fff4ef',
    'theme-sidebar-start': '#b43c38',
    'theme-sidebar-end': '#cf4944',
    'theme-sidebar-border': 'rgba(255,255,255,0.10)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.13)',
    'theme-sidebar-active-start': '#dd823b',
    'theme-sidebar-active-end': '#ccaf0b'
  },
  jardim: {
    'theme-page-bg': '#fdf0f5',
    'theme-surface-bg': '#fff5f9',
    'theme-topbar-start': '#c0607e',
    'theme-topbar-end': '#d4789a',
    'theme-topbar-text': '#fff0f5',
    'theme-sidebar-start': '#9b3060',
    'theme-sidebar-end': '#b84878',
    'theme-sidebar-border': 'rgba(255,255,255,0.15)',
    'theme-sidebar-hover': 'rgba(255,255,255,0.12)',
    'theme-sidebar-active-start': '#e8a0be',
    'theme-sidebar-active-end': '#f4c2d6'
  }
};

function AppShell({ sidebarMinimized, onSidebarToggle, user, onLogout, onImpersonate, onStopImpersonation, isImpersonating, language, onLanguageChange, colorScheme, onColorSchemeChange, onProfileUpdate, customSchemes, onCustomSchemesChange, prefs = {} }) {
  // Keyboard shortcuts (Alt+key navigation)
  useEffect(() => {
    if (!prefs.keyboardShortcuts) return;
    const handler = (e) => {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      const map = { h: '/', f: '/fichas', c: '/clientes', p: '/paginas', n: '/fichas/nova', r: '/relatorios', u: '/perfil' };
      if (map[key]) { e.preventDefault(); window.history.pushState({}, '', map[key]); window.dispatchEvent(new PopStateEvent('popstate')); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prefs.keyboardShortcuts]);

  return (
    <div className="app-layout">
      <Sidebar onToggle={onSidebarToggle} isMinimized={sidebarMinimized} language={language} user={user} />

      <div className={`main-container ${sidebarMinimized ? 'sidebar-minimized' : 'sidebar-expanded'}`}>
        <Topbar user={user} onLogout={onLogout} language={language} isImpersonating={isImpersonating} onStopImpersonation={onStopImpersonation} />

        <main className="content-area">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/fichas" element={<Fichas user={user} />} />
            <Route path="/fichas/nova" element={<NovaFicha disableVisualEditor={!!prefs.disableVisualEditor} />} />
            <Route path="/fichas/:id/editar" element={<EditarFicha disableVisualEditor={!!prefs.disableVisualEditor} />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/novo" element={<NovoCliente />} />
            <Route path="/clientes/:id/editar" element={<EditarCliente />} />
            <Route path="/paginas" element={<Paginas />} />
            <Route path="/paginas/novo" element={<NovaPagina disableVisualEditor={!!prefs.disableVisualEditor} />} />
            <Route path="/paginas/:id/editar" element={<EditarPagina disableVisualEditor={!!prefs.disableVisualEditor} />} />
            <Route
              path="/perfil"
              element={
                <Perfil
                  user={user}
                  language={language}
                  onLanguageChange={onLanguageChange}
                  colorScheme={colorScheme}
                  onColorSchemeChange={onColorSchemeChange}
                  onProfileUpdate={onProfileUpdate}
                  customSchemes={customSchemes}
                  onCustomSchemesChange={onCustomSchemesChange}
                />
              }
            />
            <Route
              path="/admin/utilizadores"
              element={
                isAdminRole(user?.role)
                  ? <UsersAdmin user={user} onImpersonate={onImpersonate} />
                  : <Navigate to="/" replace />
              }
            />
            <Route path="/relatorios" element={<Relatorios user={user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <span>Powered by </span>
          <a href="https://celeuma.pt" target="_blank" rel="noreferrer">Celeuma</a>
        </footer>

      </div>
    </div>
  );
}

function AppContent() {
  const [sidebarMinimized, setSidebarMinimized] = useState(
    () => localStorage.getItem('sidebarMinimized') === 'true'
  );
  const [user, setUser] = useState(
    () => {
      const storedUser = safeParse(sessionStorage.getItem('authUser'), null);
      const storedToken = sessionStorage.getItem('sessionToken') || '';
      if (!storedUser) return null;
      return { ...storedUser, sessionToken: storedUser.sessionToken || storedToken };
    }
  );
  const [language, setLanguage] = useState(
    () => localStorage.getItem('siteLanguage') || 'default'
  );
  const [colorScheme, setColorScheme] = useState(() => {
    const saved = localStorage.getItem('siteColorScheme');
    const customs = safeParse(localStorage.getItem('customColorSchemes'), []);
    const validCustom = customs.some(s => s.id === saved);
    return (saved && (COLOR_SCHEME_VARS[saved] || validCustom)) ? saved : 'ocean';
  });
  const [customSchemes, setCustomSchemes] = useState(
    () => safeParse(localStorage.getItem('customColorSchemes'), [])
  );
  const [prefs, setPrefs] = useState(
    () => safeParse(localStorage.getItem('userPrefs'), {})
  );
  const [impersonationOriginalUser, setImpersonationOriginalUser] = useState(
    () => safeParse(sessionStorage.getItem('impersonationOriginalUser'), null)
  );
  const hydratedProfileKeyRef = useRef('');

  useEffect(() => {
    // Remove legacy persistent auth so entering the site always requires login.
    localStorage.removeItem('authUser');
  }, []);

  useEffect(() => {
    const normalized = language === 'default' ? 'pt' : language;
    document.documentElement.lang = normalized;
    localStorage.setItem('siteLanguage', language);
  }, [language]);

  useEffect(() => {
    const custom = customSchemes.find(s => s.id === colorScheme);
    const vars = COLOR_SCHEME_VARS[colorScheme] || (custom ? custom.vars : null) || COLOR_SCHEME_VARS.ocean;
    Object.entries(vars).forEach(([name, value]) => {
      document.documentElement.style.setProperty(`--${name}`, value);
    });
    localStorage.setItem('siteColorScheme', colorScheme);
  }, [colorScheme, customSchemes]);

  useEffect(() => {
    if (!user) return;

    const loginKey = (user.username || user.email || '').trim();
    if (!loginKey) return;
    if (hydratedProfileKeyRef.current === loginKey) return;

    const fetchProfile = async () => {
      try {
        const params = new URLSearchParams({ login: loginKey });
        const res = await apiFetch(`/api/perfil?${params.toString()}`);
        if (!res.ok) {
          hydratedProfileKeyRef.current = '';
          return;
        }

        hydratedProfileKeyRef.current = loginKey;

        const p = await res.json();
        // Load preferences from BD into localStorage
        if (p.preferences && Object.keys(p.preferences).length > 0) {
          const existing = safeParse(localStorage.getItem('userPrefs'), {});
          localStorage.setItem('userPrefs', JSON.stringify({ ...existing, ...p.preferences }));
        }
        setUser((prev) => {
          const merged = {
            ...(prev || {}),
            id: p.id ?? prev?.id,
            username: p.username || prev?.username,
            name: p.displayName || prev?.name,
            displayName: p.displayName || prev?.displayName,
            firstName: p.firstName ?? prev?.firstName ?? '',
            lastName: p.lastName ?? prev?.lastName ?? '',
            nickname: p.nickname || prev?.nickname,
            bio: p.bio ?? prev?.bio ?? '',
            site: p.site ?? prev?.site ?? '',
            email: p.email || prev?.email || '',
            avatarUrl: p.avatarUrl || prev?.avatarUrl || '',
            sessionToken: prev?.sessionToken || sessionStorage.getItem('sessionToken') || ''
          };
          sessionStorage.setItem('authUser', JSON.stringify(merged));
          return merged;
        });
      } catch {
        hydratedProfileKeyRef.current = '';
        // Mantem dados locais se o backend nao responder.
      }
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loginKey = (user.username || user.email || '').trim();
    const token = (user.sessionToken || sessionStorage.getItem('sessionToken') || '').trim();
    if (!loginKey || !token) return;

    let disposed = false;

    const forceLogout = () => {
      hydratedProfileKeyRef.current = '';
      setUser(null);
      sessionStorage.removeItem('authUser');
      sessionStorage.removeItem('sessionToken');
      setImpersonationOriginalUser(null);
      sessionStorage.removeItem('impersonationOriginalUser');
    };

    const validateSession = async () => {
      try {
        const params = new URLSearchParams({ login: loginKey, token });
        const res = await apiFetch(`/api/sessions/validate?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!disposed && data?.valid === false) {
          forceLogout();
        }
      } catch {
        // Se o backend estiver indisponível, mantém sessão local até próxima validação.
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) validateSession();
    };

    validateSession();
    window.addEventListener('focus', validateSession);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const intervalId = window.setInterval(validateSession, 30000);

    return () => {
      disposed = true;
      window.removeEventListener('focus', validateSession);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [user]);

  const handleSidebarToggle = (minimized) => {
    setSidebarMinimized(minimized);
  };

  const handleLogin = (authUser) => {
    hydratedProfileKeyRef.current = ''; // força reload do perfil da BD após login
    setUser(authUser);
    sessionStorage.setItem('authUser', JSON.stringify(authUser));
    if (authUser?.sessionToken) {
      sessionStorage.setItem('sessionToken', authUser.sessionToken);
    } else {
      sessionStorage.removeItem('sessionToken');
    }
    setImpersonationOriginalUser(null);
    sessionStorage.removeItem('impersonationOriginalUser');
  };

  const handleLogout = () => {
    hydratedProfileKeyRef.current = '';
    setUser(null);
    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('sessionToken');
    setImpersonationOriginalUser(null);
    sessionStorage.removeItem('impersonationOriginalUser');
  };

  const handleImpersonate = (targetAuthUser) => {
    if (!targetAuthUser) return;

    const current = safeParse(sessionStorage.getItem('authUser'), user);
    const existingOriginal = safeParse(sessionStorage.getItem('impersonationOriginalUser'), null);
    if (!existingOriginal && current) {
      sessionStorage.setItem('impersonationOriginalUser', JSON.stringify(current));
      setImpersonationOriginalUser(current);
    }

    const merged = { ...targetAuthUser, isImpersonating: true };
    setUser(merged);
    sessionStorage.setItem('authUser', JSON.stringify(merged));
    if (merged.sessionToken) {
      sessionStorage.setItem('sessionToken', merged.sessionToken);
    }
    hydratedProfileKeyRef.current = '';
  };

  const handleStopImpersonation = () => {
    const original = safeParse(sessionStorage.getItem('impersonationOriginalUser'), impersonationOriginalUser);
    if (!original) return;

    setUser(original);
    sessionStorage.setItem('authUser', JSON.stringify(original));
    if (original.sessionToken) {
      sessionStorage.setItem('sessionToken', original.sessionToken);
    } else {
      sessionStorage.removeItem('sessionToken');
    }

    setImpersonationOriginalUser(null);
    sessionStorage.removeItem('impersonationOriginalUser');
    hydratedProfileKeyRef.current = '';
  };

  const handleProfileUpdate = (profileUpdates) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...profileUpdates };
      sessionStorage.setItem('authUser', JSON.stringify(merged));
      return merged;
    });

    // Persist to backend — use current user state for login key
    const currentUser = safeParse(sessionStorage.getItem('authUser'), {});
    const login = (
      profileUpdates.username ||
      profileUpdates.email ||
      currentUser.username ||
      currentUser.email ||
      ''
    ).trim();

    console.log('handleProfileUpdate login:', login, 'updates:', profileUpdates);

    if (!login) {
      console.warn('Perfil: login vazio, não foi feito PUT');
      return;
    }

    const preferences = safeParse(localStorage.getItem('userPrefs'), {});
    // Update prefs state so toolbar/shortcuts react immediately
    setPrefs(preferences);

    apiFetch('/api/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login,
        nome: profileUpdates.firstName ?? profileUpdates.nome ?? '',
        apelido: profileUpdates.lastName ?? profileUpdates.apelido ?? '',
        alcunha: profileUpdates.nickname ?? profileUpdates.alcunha ?? '',
        displayName: profileUpdates.displayName ?? profileUpdates.nomePublico ?? '',
        bio: profileUpdates.bio ?? '',
        site: profileUpdates.site ?? '',
        email: profileUpdates.email ?? '',
        preferences
      })
    })
      .then(res => res.json())
      .then(data => { console.log('Perfil guardado:', data); })
      .catch(err => console.error('Erro ao guardar perfil:', err));
  };

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
  };

  const handleColorSchemeChange = (nextScheme) => {
    const isBuiltin = !!COLOR_SCHEME_VARS[nextScheme];
    const isCustom = customSchemes.some(s => s.id === nextScheme);
    if (isBuiltin || isCustom) {
      setColorScheme(nextScheme);
    }
  };

  const handleCustomSchemesChange = (next) => {
    setCustomSchemes(next);
    localStorage.setItem('customColorSchemes', JSON.stringify(next));
    // If active scheme was deleted, fall back to ocean
    if (!next.some(s => s.id === colorScheme) && !COLOR_SCHEME_VARS[colorScheme]) {
      setColorScheme('ocean');
    }
  };

  const isAuthenticated = !!user;
  const isImpersonating = !!impersonationOriginalUser && !!user?.isImpersonating;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Login onLogin={handleLogin} language={language} />
          )
        }
      />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <AppShell
              sidebarMinimized={sidebarMinimized}
              onSidebarToggle={handleSidebarToggle}
              user={user}
              onLogout={handleLogout}
              onImpersonate={handleImpersonate}
              onStopImpersonation={handleStopImpersonation}
              isImpersonating={isImpersonating}
              language={language}
              onLanguageChange={handleLanguageChange}
              colorScheme={colorScheme}
              onColorSchemeChange={handleColorSchemeChange}
              onProfileUpdate={handleProfileUpdate}
              customSchemes={customSchemes}
              onCustomSchemesChange={handleCustomSchemesChange}
              prefs={prefs}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
