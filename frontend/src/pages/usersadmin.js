import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../api';

const normalizeRole = (role) => {
  const raw = (role || '').toString().trim().toLowerCase();
  if (raw === 'administrator' || raw === 'administrador' || raw === 'admin') return 'admin';
  if (raw === 'contributor' || raw === 'contribuidor') return 'contributor';
  return 'editor';
};

const roleLabel = (role) => {
  if (role === 'admin') return 'Admin';
  if (role === 'contributor') return 'Contribuidor';
  return 'Editor';
};

export default function UsersAdmin({ user = null, onImpersonate }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [draftRoles, setDraftRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const isAdmin = normalizeRole(user?.role) === 'admin';
  const actingLogin = (user?.username || user?.email || '').toString().trim();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/', { replace: true });
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    axios.get('/api/admin/users', {
      params: { actingLogin }
    })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setUsers(list);
        setDraftRoles(Object.fromEntries(list.map((item) => [item.id, normalizeRole(item.role)])));
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.response?.data?.error || 'Não foi possível carregar utilizadores.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdmin, actingLogin, navigate]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const byRole = normalizeRole(a.role).localeCompare(normalizeRole(b.role));
      if (byRole !== 0) return byRole;
      return (a.displayName || a.username || '').localeCompare((b.displayName || b.username || ''), 'pt');
    });
  }, [users]);

  const saveRole = async (target) => {
    const nextRole = normalizeRole(draftRoles[target.id] || target.role);
    if (nextRole === normalizeRole(target.role)) return;

    setBusyId(target.id);
    setError('');

    try {
      await axios.put(`/api/admin/users/${target.id}/role`, {
        actingLogin,
        role: nextRole
      });

      setUsers((prev) => prev.map((item) => (
        item.id === target.id ? { ...item, role: nextRole } : item
      )));
    } catch (err) {
      setError(err?.response?.data?.error || 'Não foi possível atualizar o cargo.');
    } finally {
      setBusyId(null);
    }
  };

  const startUserTesting = async (target) => {
    setBusyId(target.id);
    setError('');

    try {
      const res = await axios.post('/api/admin/impersonate', {
        actingLogin,
        targetUserId: target.id
      });

      const authUser = res?.data?.authUser;
      if (!authUser) throw new Error('Resposta de impersonação inválida');
      if (typeof onImpersonate === 'function') onImpersonate(authUser);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Não foi possível iniciar o modo de teste.');
      setBusyId(null);
    }
  };

  if (loading) {
    return <p style={{ marginTop: 6 }}>A carregar utilizadores...</p>;
  }

  return (
    <div style={pageStyle}>
      <h2 style={{ fontWeight: 400, fontSize: '1.8rem', marginBottom: 16 }}>Admin - Utilizadores</h2>
      <p style={{ marginBottom: 14, color: '#4b5563' }}>
        Os admins podem gerir cargos e testar contas de utilizador sem pedir credenciais.
      </p>

      {error && <div style={errorStyle}>{error}</div>}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Utilizador</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle}>Cargo</th>
            <th style={thStyle}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((item) => {
            const itemRole = normalizeRole(item.role);
            const currentDraft = normalizeRole(draftRoles[item.id] || itemRole);
            const disabled = busyId === item.id;

            return (
              <tr key={item.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={tdStyle}>
                  <strong>{item.displayName || item.username}</strong>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{item.username}</div>
                </td>
                <td style={tdStyle}>{item.email || '—'}</td>
                <td style={tdStyle}>
                  <select
                    value={currentDraft}
                    onChange={(e) => setDraftRoles((prev) => ({ ...prev, [item.id]: normalizeRole(e.target.value) }))}
                    style={selectStyle}
                    disabled={disabled}
                  >
                    <option value="editor">Editor</option>
                    <option value="contributor">Contribuidor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div style={{ marginTop: 4, fontSize: '0.82rem', color: '#6b7280' }}>Atual: {roleLabel(itemRole)}</div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      style={btnStyle}
                      onClick={() => saveRole(item)}
                      disabled={disabled || currentDraft === itemRole}
                    >
                      Guardar cargo
                    </button>
                    <button
                      type="button"
                      style={testBtnStyle}
                      onClick={() => startUserTesting(item)}
                      disabled={disabled || item.id === user?.id}
                      title={item.id === user?.id ? 'Já está nesta conta' : 'Entrar em modo de teste'}
                    >
                      Testar conta
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {sortedUsers.length === 0 && (
            <tr>
              <td style={tdStyle} colSpan={4}>Sem utilizadores para mostrar.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const pageStyle = { fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', fontSize: '0.93rem', color: '#1d2327' };
const errorStyle = { marginBottom: 10, color: '#b32d2e', fontSize: '0.9rem' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #c3c4c7' };
const thStyle = { textAlign: 'left', padding: '9px 10px', fontSize: '0.87rem', color: '#50575e', borderBottom: '1px solid #c3c4c7' };
const tdStyle = { padding: '10px', fontSize: '0.9rem', verticalAlign: 'top' };
const selectStyle = { border: '1px solid #c3c4c7', borderRadius: 3, padding: '4px 6px', fontSize: '0.9rem', minWidth: 150 };
const btnStyle = { background: '#f6f7f7', border: '1px solid #c3c4c7', borderRadius: 3, padding: '5px 10px', fontSize: '0.86rem', cursor: 'pointer', color: '#1d2327' };
const testBtnStyle = { background: '#2271b1', border: '1px solid #2271b1', borderRadius: 3, padding: '5px 10px', fontSize: '0.86rem', cursor: 'pointer', color: '#fff' };
