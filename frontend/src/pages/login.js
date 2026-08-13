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
    setError('');

    if (!username.trim() || !password.trim()) {
      setError(t.fill);
      return;
    }

    const input = username.trim();

    try {
      const response = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: input, password })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          setError(t.invalid);
          return;
        }

        if (response.status === 400) {
          setError(data?.error || t.fill);
          return;
        }

        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      const authUser = data?.authUser;
      if (!authUser) {
        setError(t.unavailable);
        return;
      }

      if (typeof onLogin === 'function') {
        onLogin({
          ...authUser,
          username: authUser.username || input,
          name: authUser.name || authUser.displayName || input,
          displayName: authUser.displayName || authUser.name || input,
          email: authUser.email || (input.includes('@') ? input : '')
        });
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
              <Form.Label htmlFor="login-username">{t.usernameLabel}</Form.Label>
              <Form.Control
                id="login-username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label htmlFor="login-password">{t.password}</Form.Label>
              <Form.Control
                id="login-password"
                name="password"
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
