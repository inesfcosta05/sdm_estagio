import React, { useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

const Login = ({ onLogin, language = 'default' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locale = language === 'en' ? 'en' : 'pt';
  const t = {
    pt: {
      ended: 'Sessão terminada.',
      title: 'Iniciar sessao',
      fill: 'Preencha utilizador e senha.',
      invalid: 'Utilizador ou senha inválidos.',
      unavailable: 'Servidor de autenticação indisponível. Tente novamente.',
      usernameLabel: 'Nome de utilizador ou endereço de email',
      password: 'Senha',
      submit: 'Iniciar sessão'
    },
    en: {
      ended: 'Session ended.',
      title: 'Sign in',
      fill: 'Please enter username and password.',
      invalid: 'Invalid username or password.',
      unavailable: 'Authentication server unavailable. Please try again.',
      usernameLabel: 'Username or email address',
      password: 'Password',
      submit: 'Sign in'
    }
  }[locale];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError(t.fill);
      return;
    }

    const input = username.trim();
    const isEmail = input.includes('@');
    const derivedUsername = isEmail ? (input.split('@')[0] || 'utilizador') : input;

    const fetchProfile = async (loginValue) => {
      const res = await apiFetch(`/api/perfil?login=${encodeURIComponent(loginValue)}`);
      if (!res.ok) {
        const status = res.status;
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${status}: ${text}`);
        err.status = status;
        throw err;
      }
      const data = await res.json().catch(() => null);
      return data || null;
    };

    try {
      let p = null;

      try {
        p = await fetchProfile(input);
      } catch (err) {
        if (err?.status !== 404) {
          throw err;
        }
      }

      if (!p && derivedUsername && derivedUsername !== input) {
        try {
          p = await fetchProfile(derivedUsername);
        } catch (err) {
          if (err?.status !== 404) {
            throw err;
          }
        }
      }

      if (!p) {
        setError(t.invalid);
        return;
      }

      let sessionToken = '';
      try {
        const sessionRes = await apiFetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: input })
        });
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData?.token) {
          sessionToken = sessionData.token;
        }
      } catch {
        // Sem token de sessão, mantém login local e tenta validar depois.
      }

      const authUser = {
        id: p.id,
        username: p.username || derivedUsername,
        name: p.displayName || derivedUsername,
        displayName: p.displayName || derivedUsername,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        nickname: p.nickname || p.username || derivedUsername,
        bio: p.bio || '',
        site: p.site || '',
        email: p.email || (isEmail ? input : ''),
        avatarUrl: p.avatarUrl || '',
        sessionToken,
        role: p.role || 'editor'
      };

      if (typeof onLogin === 'function') {
        onLogin(authUser);
      }

      navigate('/', { replace: true });
    } catch {
      setError(t.unavailable);
      return;
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <Card.Body>
          {location.state?.fromLogout && (
            <Alert variant="info" className="mb-3">
              {t.ended}
            </Alert>
          )}

          <h4 className="mb-4">{t.title}</h4>

          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>{t.usernameLabel}</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t.password}</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Form.Group>

            <div className="d-flex justify-content-end">
              <Button type="submit">{t.submit}</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Login;
