import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function md5(str) {
  function safeAdd(x, y) { const lsw = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff); }
  function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a, b, c, d, x, s, t) { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
  function md5gg(a, b, c, d, x, s, t) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function md5hh(a, b, c, d, x, s, t) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a, b, c, d, x, s, t) { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }
  const utf8 = unescape(encodeURIComponent(str || ''));
  const len = utf8.length;
  const words = [];
  for (let i = 0; i < len; i += 1) words[i >> 2] |= utf8.charCodeAt(i) << (i % 4) * 8;
  words[len >> 2] |= 0x80 << (len % 4) * 8;
  words[(((len + 64) >> 6) << 4) + 14] = len * 8;
  let [a, b, c, d] = [1732584193, -271733879, -1732584194, 271733878];
  for (let i = 0; i < words.length; i += 16) {
    const [A, B, C, D] = [a, b, c, d];
    a = md5ff(a, b, c, d, words[i + 0], 7, -680876936); d = md5ff(d, a, b, c, words[i + 1], 12, -389564586); c = md5ff(c, d, a, b, words[i + 2], 17, 606105819); b = md5ff(b, c, d, a, words[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, words[i + 4], 7, -176418897); d = md5ff(d, a, b, c, words[i + 5], 12, 1200080426); c = md5ff(c, d, a, b, words[i + 6], 17, -1473231341); b = md5ff(b, c, d, a, words[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, words[i + 8], 7, 1770035416); d = md5ff(d, a, b, c, words[i + 9], 12, -1958414417); c = md5ff(c, d, a, b, words[i + 10], 17, -42063); b = md5ff(b, c, d, a, words[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, words[i + 12], 7, 1804603682); d = md5ff(d, a, b, c, words[i + 13], 12, -40341101); c = md5ff(c, d, a, b, words[i + 14], 17, -1502002290); b = md5ff(b, c, d, a, words[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, words[i + 1], 5, -165796510); d = md5gg(d, a, b, c, words[i + 6], 9, -1069501632); c = md5gg(c, d, a, b, words[i + 11], 14, 643717713); b = md5gg(b, c, d, a, words[i + 0], 20, -373897302);
    a = md5gg(a, b, c, d, words[i + 5], 5, -701558691); d = md5gg(d, a, b, c, words[i + 10], 9, 38016083); c = md5gg(c, d, a, b, words[i + 15], 14, -660478335); b = md5gg(b, c, d, a, words[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, words[i + 9], 5, 568446438); d = md5gg(d, a, b, c, words[i + 14], 9, -1019803690); c = md5gg(c, d, a, b, words[i + 3], 14, -187363961); b = md5gg(b, c, d, a, words[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, words[i + 13], 5, -1444681467); d = md5gg(d, a, b, c, words[i + 2], 9, -51403784); c = md5gg(c, d, a, b, words[i + 7], 14, 1735328473); b = md5gg(b, c, d, a, words[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, words[i + 5], 4, -378558); d = md5hh(d, a, b, c, words[i + 8], 11, -2022574463); c = md5hh(c, d, a, b, words[i + 11], 16, 1839030562); b = md5hh(b, c, d, a, words[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, words[i + 1], 4, -1530992060); d = md5hh(d, a, b, c, words[i + 4], 11, 1272893353); c = md5hh(c, d, a, b, words[i + 7], 16, -155497632); b = md5hh(b, c, d, a, words[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, words[i + 13], 4, 681279174); d = md5hh(d, a, b, c, words[i + 0], 11, -358537222); c = md5hh(c, d, a, b, words[i + 3], 16, -722521979); b = md5hh(b, c, d, a, words[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, words[i + 9], 4, -640364487); d = md5hh(d, a, b, c, words[i + 12], 11, -421815835); c = md5hh(c, d, a, b, words[i + 15], 16, 530742520); b = md5hh(b, c, d, a, words[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, words[i + 0], 6, -198630844); d = md5ii(d, a, b, c, words[i + 7], 10, 1126891415); c = md5ii(c, d, a, b, words[i + 14], 15, -1416354905); b = md5ii(b, c, d, a, words[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, words[i + 12], 6, 1700485571); d = md5ii(d, a, b, c, words[i + 3], 10, -1894986606); c = md5ii(c, d, a, b, words[i + 10], 15, -1051523); b = md5ii(b, c, d, a, words[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, words[i + 8], 6, 1873313359); d = md5ii(d, a, b, c, words[i + 15], 10, -30611744); c = md5ii(c, d, a, b, words[i + 6], 15, -1560198380); b = md5ii(b, c, d, a, words[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, words[i + 4], 6, -145523070); d = md5ii(d, a, b, c, words[i + 11], 10, -1120210379); c = md5ii(c, d, a, b, words[i + 2], 15, 718787259); b = md5ii(b, c, d, a, words[i + 9], 21, -343485551);
    a = safeAdd(a, A); b = safeAdd(b, B); c = safeAdd(c, C); d = safeAdd(d, D);
  }
  return [a, b, c, d].map((n) => (n < 0 ? n + 0x100000000 : n).toString(16).padStart(8, '0').match(/../g).map((h) => h.split('').reverse().join('')).join('')).join('');
}

function gravatarUrl(email, size = 72) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return '';
  const hash = md5(normalized);
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}

const Topbar = ({ user, onLogout, language = 'default', isImpersonating = false, onStopImpersonation }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const locale = language === 'en' ? 'en' : 'pt';
  const t = {
    pt: {
      hello: 'Olá,',
      editProfile: 'Editar perfil',
      logout: 'Terminar sessão',
      testingMode: 'Modo de teste ativo',
      stopTesting: 'Sair do modo de teste'
    },
    en: {
      hello: 'Hello,',
      editProfile: 'Edit profile',
      logout: 'Log out',
      testingMode: 'Testing mode active',
      stopTesting: 'Exit testing mode'
    }
  }[locale];

  const getDisplayName = () => {
    const firstName = (user?.firstName || user?.nome || '').trim();
    const lastName = (user?.lastName || user?.apelido || '').trim();
    if (firstName || lastName) return `${firstName} ${lastName}`.trim();
    const raw = user?.displayName || user?.name || user?.username || 'utilizador';
    if (typeof raw === 'string' && raw.includes('@')) return raw.split('@')[0] || 'utilizador';
    return raw;
  };

  const displayUsername = getDisplayName();
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const avatarMiniUrl = useMemo(() => {
    if (avatarLoadFailed) return '';
    return user?.avatarUrl || gravatarUrl(user?.email, 36);
  }, [avatarLoadFailed, user?.avatarUrl, user?.email]);

  const avatarLargeUrl = useMemo(() => {
    if (avatarLoadFailed) return '';
    return user?.avatarUrl || gravatarUrl(user?.email, 72);
  }, [avatarLoadFailed, user?.avatarUrl, user?.email]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.avatarUrl, user?.email]);

  const goToProfile = () => {
    navigate('/perfil');
    setIsOpen(false);
  };

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
    }
    navigate('/login', { replace: true, state: { fromLogout: true } });
  };

  return (
    <header className="topbar">
      <div className="topbar-right">
        {isImpersonating && (
          <button
            type="button"
            onClick={onStopImpersonation}
            style={{
              background: '#f59e0b',
              color: '#fff',
              border: '1px solid #d97706',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: '0.82rem',
              marginRight: 10,
              cursor: 'pointer'
            }}
            title={t.testingMode}
          >
            {t.stopTesting}
          </button>
        )}
        <div
          className="topbar-user-menu"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <button type="button" className="topbar-user-trigger" onClick={goToProfile}>
            <span className="topbar-greeting">{t.hello}</span>
            <span className="topbar-user-name">{displayUsername}</span>
            <span className="topbar-avatar-mini">
              {avatarMiniUrl ? (
                <img
                  src={avatarMiniUrl}
                  alt=""
                  className="topbar-avatar-mini-img"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4z"/>
                </svg>
              )}
            </span>
          </button>

          {isOpen && (
            <div className="topbar-user-dropdown" role="menu">
              <div className="topbar-user-header">
                <div className="topbar-avatar-large">
                  {avatarLargeUrl ? (
                    <img
                      src={avatarLargeUrl}
                      alt={displayUsername}
                      className="topbar-avatar-large-img"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.025 10 8 10c-2.026 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                    </svg>
                  )}
                </div>
                <div className="topbar-user-meta">
                  <button type="button" className="topbar-link-like" onClick={goToProfile}>
                    {displayUsername}
                  </button>
                  <div className="topbar-role">{user?.role || 'editor'}</div>
                </div>
              </div>

              <button type="button" className="topbar-menu-item" onClick={goToProfile}>
                {t.editProfile}
              </button>
              {isImpersonating && (
                <button type="button" className="topbar-menu-item" onClick={onStopImpersonation}>
                  {t.stopTesting}
                </button>
              )}
              <button type="button" className="topbar-menu-item" onClick={handleLogout}>
                {t.logout}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
