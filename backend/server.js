// Must run before any other require in this file — every module below (in
// particular ./sync-service) reads process.env lazily at call time, but
// loading .env first regardless keeps that guarantee explicit rather than
// incidental.
const dotenvResult = require('dotenv').config({
  path: require('path').resolve(__dirname, '.env')
});

if (dotenvResult.error && dotenvResult.error.code !== 'ENOENT') {
  // ENOENT (no .env file) is normal on Render, where vars come from the
  // dashboard instead — anything else (e.g. a malformed .env) is worth
  // surfacing since it can silently leave expected vars unset.
  console.error('⚠️  Erro ao carregar .env:', dotenvResult.error.message);
}

// Masked visibility into which critical env vars actually made it into
// process.env at boot — never the values themselves. Check these lines in
// the logs first whenever a feature gated by one of them ("WP_SYNC_BYPASS_SECRET
// não detetada" and similar) appears to be misbehaving.
['DB_HOST', 'DB_USER', 'DB_NAME', 'WP_API_URL', 'WP_API_USER', 'WP_API_PASS', 'WP_SYNC_BYPASS_SECRET', 'SYNC_SECRET']
  .forEach((key) => console.log(`  🔧 ${key}: ${process.env[key] ? 'definida' : 'NÃO definida'}`));

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const SyncService = require('./sync-service');

const app = express();

// Fallback used only when FRONTEND_URLS/FRONTEND_URL isn't set on the environment.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://sdm-estagio-m1yn.onrender.com', '*'];
const normalizeOrigin = (value) => (value || '').toString().trim().replace(/\/$/, '');

const allowedOriginsRaw = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
const allowedOrigins = (allowedOriginsRaw
  ? allowedOriginsRaw.split(',')
  : DEFAULT_ALLOWED_ORIGINS
).map(normalizeOrigin).filter(Boolean);

const dbPassword = process.env.DB_PASS || process.env.DB_PASSWORD || '';

const isDevLocalOrigin = (origin) => {
  if (!origin) return false;
  const normalized = origin.toLowerCase();

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }

  // Laragon local domains usually end with .test
  if (/^https?:\/\/[a-z0-9.-]+\.test(:\d+)?$/.test(normalized)) {
    return true;
  }

  return false;
};

app.use(
  cors({
    origin(origin, callback) {
      // Log origin for easier debugging in Render logs
      try { console.debug('CORS origin:', origin); } catch (e) {}

      if (!origin || allowedOrigins.includes(normalizeOrigin(origin)) || isDevLocalOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`⚠️ CORS bloqueado para origem: ${origin}`);
      // Reject without throwing, so Express's default error handler (which strips
      // CORS headers) never gets involved — the browser just sees a clean CORS block.
      return callback(null, false);
    }
  })
);
app.use(express.json());

// A pool instead of a single long-lived connection: a lone connection that
// sits idle (e.g. while a WordPress sync fetch is in flight) can get dropped
// by the MySQL server's wait_timeout or a network blip, and every query
// after that fails forever with "Can't add new command when connection is
// in closed state" until the process restarts. A pool hands each query a
// live connection on demand and quietly replaces dead ones, so a single
// dropped connection can no longer take down bulk syncs (clientes/fichas).
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: dbPassword,
  database: process.env.DB_NAME || 'wp_migracion',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

db.getConnection((err, connection) => {
  if (err) { console.error('❌ MYSQL FALHOU:', err.message); return; }
  connection.release();
  console.log('✅ MySQL OK!');

  // Garantir que a tabela users existe com a estrutura correta
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      role ENUM('admin', 'editor', 'contributor') DEFAULT 'editor',
      preferences TEXT,
      created_at DATETIME DEFAULT NOW(),
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
      INDEX idx_name (name),
      INDEX idx_email (email)
    )
  `, (createErr) => {
    if (createErr) console.error('Erro ao criar tabela users:', createErr.message);
    else console.log('✅ Tabela users OK');
  });

  // Garantir coluna preferences (compatível com MySQL 5.7+)
  db.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferences'`,
    (e, rows) => {
      if (!e && rows[0].cnt === 0) {
        db.query(`ALTER TABLE users ADD COLUMN preferences TEXT NULL`, (e2) => {
          if (e2) console.error('Erro ao criar coluna preferences:', e2.message);
          else console.log('✅ Coluna preferences criada');
        });
      }
    }
  );

  // Garantir coluna senha_visibilidade em clients
  db.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'senha_visibilidade'`,
    (e, rows) => {
      if (!e && rows[0].cnt === 0) {
        db.query(`ALTER TABLE clients ADD COLUMN senha_visibilidade VARCHAR(255) NULL`, (e2) => {
          if (e2) console.error('Erro ao criar coluna senha_visibilidade:', e2.message);
          else console.log('✅ Coluna senha_visibilidade criada');
        });
      }
    }
  );
});

const normalizeUserRole = (role) => {
  const raw = (role || '').toString().trim().toLowerCase();
  if (raw === 'administrator' || raw === 'administrador') return 'admin';
  if (raw === 'admin') return 'admin';
  if (raw === 'contribuidor') return 'contributor';
  if (raw === 'contributor') return 'contributor';
  if (raw === 'editor' || raw === 'editora') return 'editor';
  return raw || 'editor';
};

const isAdminRole = (role) => normalizeUserRole(role) === 'admin';

const PHPASS_ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const sha256Hex = (value) => crypto.createHash('sha256').update((value || '').toString(), 'utf8').digest('hex');

const encodePhpass64 = (inputBuffer, count) => {
  let output = '';
  let index = 0;

  do {
    let value = inputBuffer[index++];
    output += PHPASS_ITOA64[value & 0x3f];

    if (index < count) {
      value |= inputBuffer[index] << 8;
    }
    output += PHPASS_ITOA64[(value >> 6) & 0x3f];

    if (index++ >= count) {
      break;
    }

    if (index < count) {
      value |= inputBuffer[index] << 16;
    }
    output += PHPASS_ITOA64[(value >> 12) & 0x3f];

    if (index++ >= count) {
      break;
    }

    output += PHPASS_ITOA64[(value >> 18) & 0x3f];
  } while (index < count);

  return output;
};

const verifyPhpassPassword = (password, storedHash) => {
  const hash = (storedHash || '').toString().trim();
  if (!hash || !(hash.startsWith('$P$') || hash.startsWith('$H$')) || hash.length < 34) {
    return false;
  }

  const countLog2 = PHPASS_ITOA64.indexOf(hash[3]);
  if (countLog2 < 7 || countLog2 > 30) {
    return false;
  }

  const salt = hash.slice(4, 12);
  if (salt.length !== 8) {
    return false;
  }

  const passwordBuffer = Buffer.from((password || '').toString(), 'utf8');
  let digest = crypto.createHash('md5').update(salt, 'utf8').update(passwordBuffer).digest();
  const iterations = 1 << countLog2;

  for (let i = 0; i < iterations; i += 1) {
    digest = crypto.createHash('md5').update(digest).update(passwordBuffer).digest();
  }

  return hash.slice(0, 12) + encodePhpass64(digest, 16) === hash;
};

const verifyStoredPassword = (password, storedHash) => {
  const hash = (storedHash || '').toString().trim();
  if (!hash) return false;

  if (/^[0-9a-f]{64}$/i.test(hash)) {
    return sha256Hex(password) === hash.toLowerCase();
  }

  if (hash.startsWith('$P$') || hash.startsWith('$H$')) {
    return verifyPhpassPassword(password, hash);
  }

  return hash === (password || '').toString();
};

const parsePreferencesValue = (value) => {
  if (!value) return {};
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return {};
  }
};

const buildAuthUserFromUsersRow = (row) => {
  const firstName = (row?.nome || '').toString();
  const lastName = (row?.apelido || '').toString();
  const displayName = (row?.nome_mostrado || `${firstName} ${lastName}`.trim() || row?.name || row?.email || '').toString();

  return {
    id: row.id,
    username: (row.name || row.email || '').toString(),
    name: displayName,
    displayName,
    firstName,
    lastName,
    nickname: (row.alcunha || row.name || '').toString(),
    bio: (row.bio || '').toString(),
    site: (row.site_url || '').toString(),
    email: (row.email || '').toString(),
    avatarUrl: (row.imagem_url || '').toString(),
    role: normalizeUserRole(row.role),
    preferences: parsePreferencesValue(row.preferences)
  };
};

const buildAuthUserFromWpRow = (row) => ({
  id: row.ID,
  username: (row.user_login || '').toString(),
  name: (row.display_name || row.user_login || '').toString(),
  displayName: (row.display_name || row.user_login || '').toString(),
  firstName: '',
  lastName: '',
  nickname: (row.display_name || row.user_login || '').toString(),
  bio: '',
  site: '',
  email: (row.user_email || '').toString(),
  avatarUrl: '',
  role: 'editor',
  preferences: {}
});

const createSessionForUser = (userId, req, cb) => {
  const token = crypto.randomBytes(32).toString('hex');
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || '';

  db.query(
    'INSERT INTO sessions (user_id, token, user_agent, ip) VALUES (?, ?, ?, ?)',
    [userId, token, ua, ip],
    (err) => {
      if (err) return cb(err);
      return cb(null, token);
    }
  );
};

const findUserForLogin = (login, cb) => {
  const normalizedLogin = (login || '').toString().trim();
  if (!normalizedLogin) return cb(new Error('login required'));

  const queryWpUsers = () => {
    db.query(
      `SELECT ID AS id, user_login AS username, user_email AS email, display_name AS displayName, user_pass AS password_hash
       FROM wp_users
       WHERE LOWER(user_login) = LOWER(?) OR LOWER(user_email) = LOWER(?) OR LOWER(display_name) = LOWER(?)
       LIMIT 1`,
      [normalizedLogin, normalizedLogin, normalizedLogin],
      (wpErr, wpRows) => {
        if (wpErr) return cb(wpErr);
        if (!wpRows || !wpRows.length) return cb(null, null);
        return cb(null, { source: 'wp_users', user: wpRows[0] });
      }
    );
  };

  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
    (colErr, colRows) => {
      if (colErr) return queryWpUsers();

      const existingCols = (colRows || []).map((row) => row.COLUMN_NAME);
      const has = (col) => existingCols.includes(col);

      const selectCols = ['id', 'name', 'email', 'role', 'password_hash'];
      if (has('nome')) selectCols.push('nome');
      if (has('apelido')) selectCols.push('apelido');
      if (has('alcunha')) selectCols.push('alcunha');
      if (has('nome_mostrado')) selectCols.push('nome_mostrado');
      if (has('bio')) selectCols.push('bio');
      if (has('site_url')) selectCols.push('site_url');
      if (has('imagem_url')) selectCols.push('imagem_url');
      if (has('preferences')) selectCols.push('preferences');

      const whereParts = ['LOWER(name) = LOWER(?)', 'LOWER(email) = LOWER(?)'];
      const whereParams = [normalizedLogin, normalizedLogin];
      if (has('alcunha')) { whereParts.push('LOWER(alcunha) = LOWER(?)'); whereParams.push(normalizedLogin); }
      if (has('nome_mostrado')) { whereParts.push('LOWER(nome_mostrado) = LOWER(?)'); whereParams.push(normalizedLogin); }
      if (has('nome')) { whereParts.push('LOWER(nome) = LOWER(?)'); whereParams.push(normalizedLogin); }

      const sql = `SELECT ${selectCols.join(', ')} FROM users WHERE ${whereParts.join(' OR ')} LIMIT 1`;

      db.query(sql, whereParams, (userErr, users) => {
        if (userErr) {
          if (userErr.code === 'ER_NO_SUCH_TABLE' || userErr.errno === 1146 || userErr.code === 'ER_BAD_FIELD_ERROR' || userErr.errno === 1054) {
            return queryWpUsers();
          }
          return cb(userErr);
        }
        if (users && users.length) return cb(null, { source: 'users', user: users[0] });
        return queryWpUsers();
      });
    }
  );
};

app.post('/api/login', (req, res) => {
  console.log('1');









  const login = (req.body?.login || '').toString().trim();
  const password = (req.body?.password || '').toString();
  console.log('1234');
  if (!login || !password) {
    return res.status(400).json({ error: 'login e password são obrigatórios' });
  }
  console.log('123');
  findUserForLogin(login, (err, result) => {
      console.log('12');
    if (err) {
      console.error('POST /api/login erro:', err.message);
      return res.status(500).json({ error: 'Erro ao autenticar utilizador' });
    }

    if (!result) {
      return res.status(401).json({ error: 'Utilizador ou password inválidos' });
    }

    const { source, user } = result;
    const storedHash = user.password_hash || '';

    if (!verifyStoredPassword(password, storedHash)) {
      return res.status(401).json({ error: 'Utilizador ou password inválidos' });
    }

    const authUser = source === 'users'
      ? buildAuthUserFromUsersRow(user)
      : buildAuthUserFromWpRow(user);

    if (source === 'users') {
      return createSessionForUser(user.id, req, (sessionErr, token) => {
        if (sessionErr) {
          console.error('POST /api/login sessão:', sessionErr.message);
          return res.status(500).json({ error: 'Erro ao criar sessão' });
        }

        return res.json({
          success: true,
          authUser: {
            ...authUser,
            sessionToken: token
          }
        });
      });
    }

    return res.json({
      success: true,
      authUser: {
        ...authUser,
        sessionToken: ''
      }
    });
  });
});

const resolveUserByLogin = (login, cb) => {
  const normalizedLogin = (login || '').toString().trim();
  if (!normalizedLogin) return cb(new Error('login required'));

  db.query(
    `SELECT id, name, email, role
     FROM users
     WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)
     LIMIT 1`,
    [normalizedLogin, normalizedLogin],
    (err, rows) => {
      if (err) return cb(err);
      if (!rows || !rows.length) return cb(null, null);
      return cb(null, rows[0]);
    }
  );
};

const assertAdminByLogin = (actingLogin, cb) => {
  resolveUserByLogin(actingLogin, (err, user) => {
    if (err) return cb(err);
    if (!user) return cb(Object.assign(new Error('Utilizador não encontrado'), { status: 404 }));
    if (!isAdminRole(user.role)) return cb(Object.assign(new Error('Acesso negado'), { status: 403 }));
    return cb(null, user);
  });
};

// FICHAS ✅ (já funciona)
// The client relation on legacy fichas wasn't migrated into `client_legacy_id`
// (it's NULL for practically every row) — the real link still lives in the
// WordPress Pods relationship table (`wp_podsrel`, pod "fichas" field "cliente" =
// pod_id 13 / field_id 15), so resolve through it, falling back to the direct
// column in case it's ever populated too.
//
// Same story for every contact-tracking field below (tipo de contacto, data
// do contacto, contacto efetuado, follow up, ...): the WordPress REST API
// for this CPT doesn't expose Pods custom fields at all (confirmed directly
// against the live site — even authenticated, /wp/v2/fichas only returns
// core post fields), so the periodic sync never had a way to bring any of
// them over and every one of these `fichas.*` columns is NULL for every
// WP-synced row. The real values live in WordPress's own `wp_postmeta`
// table (migrated wholesale into this same database) under different field
// names than this app uses — confirmed directly in the DB before writing
// this query:
//   data_do_proximo_contacto   -> data_proximo_contacto (YYYYMMDD)
//   tipo_de_contacto           -> tipo_contacto (Telefónico/Email/Reunião/Visita)
//   pessoa_de_contacto         -> pessoa_contacto
//   data_do_contacto           -> data_contacto (YYYYMMDD)
//   inicio_do_contacto         -> inicio_contacto (HH:MM:SS)
//   fim_do_contacto            -> fim_contacto (HH:MM:SS)
//   motivoresumo_do_contacto   -> motivo_resumo_contacto
//   contacto_efetuado          -> contacto_efetuado (same name, "1"/"0")
//   follow_up                  -> follow_up (same name, "1"/"0")
//   novo_contacto              -> novo_contacto (same name, "1"/"0")
//   tipo_do_proximo_contacto   -> tipo_proximo_contacto
//   assunto_tratado            -> assunto_tratado (same name, "1"/"0")
// Resolved the same way client_name is: one pivoted subquery joined once
// (cheaper than one LEFT JOIN per field), read live at request time,
// preferring a value set directly through this app's own ficha edit form
// over the WordPress one. Shared by GET /api/fichas and GET /api/fichas/:id.
const CONTACT_META_SUBQUERY = `(
  SELECT
    post_id,
    MAX(CASE WHEN meta_key = 'data_do_proximo_contacto' THEN STR_TO_DATE(meta_value, '%Y%m%d') END) AS data_proximo_contacto,
    MAX(CASE WHEN meta_key = 'tipo_de_contacto' THEN meta_value END) AS tipo_contacto,
    MAX(CASE WHEN meta_key = 'pessoa_de_contacto' THEN meta_value END) AS pessoa_contacto,
    MAX(CASE WHEN meta_key = 'data_do_contacto' THEN STR_TO_DATE(meta_value, '%Y%m%d') END) AS data_contacto,
    MAX(CASE WHEN meta_key = 'inicio_do_contacto' THEN meta_value END) AS inicio_contacto,
    MAX(CASE WHEN meta_key = 'fim_do_contacto' THEN meta_value END) AS fim_contacto,
    MAX(CASE WHEN meta_key = 'motivoresumo_do_contacto' THEN meta_value END) AS motivo_resumo_contacto,
    MAX(CASE WHEN meta_key = 'contacto_efetuado' THEN meta_value END) AS contacto_efetuado,
    MAX(CASE WHEN meta_key = 'follow_up' THEN meta_value END) AS follow_up,
    MAX(CASE WHEN meta_key = 'novo_contacto' THEN meta_value END) AS novo_contacto,
    MAX(CASE WHEN meta_key = 'tipo_do_proximo_contacto' THEN meta_value END) AS tipo_proximo_contacto,
    MAX(CASE WHEN meta_key = 'assunto_tratado' THEN meta_value END) AS assunto_tratado
  FROM wp_postmeta
  WHERE meta_key IN (
    'data_do_proximo_contacto', 'tipo_de_contacto', 'pessoa_de_contacto', 'data_do_contacto',
    'inicio_do_contacto', 'fim_do_contacto', 'motivoresumo_do_contacto', 'contacto_efetuado',
    'follow_up', 'novo_contacto', 'tipo_do_proximo_contacto', 'assunto_tratado'
  )
  GROUP BY post_id
) pm`;

const CONTACT_META_SELECT = `
     COALESCE(f.data_proximo_contacto, pm.data_proximo_contacto) AS data_proximo_contacto,
     COALESCE(NULLIF(f.tipo_contacto, ''), pm.tipo_contacto) AS tipo_contacto,
     COALESCE(NULLIF(f.pessoa_contacto, ''), pm.pessoa_contacto) AS pessoa_contacto,
     COALESCE(f.data_contacto, pm.data_contacto) AS data_contacto,
     COALESCE(f.inicio_contacto, pm.inicio_contacto) AS inicio_contacto,
     COALESCE(f.fim_contacto, pm.fim_contacto) AS fim_contacto,
     COALESCE(NULLIF(f.motivo_resumo_contacto, ''), pm.motivo_resumo_contacto) AS motivo_resumo_contacto,
     COALESCE(f.contacto_efetuado, pm.contacto_efetuado) AS contacto_efetuado,
     COALESCE(f.follow_up, pm.follow_up) AS follow_up,
     COALESCE(f.novo_contacto, pm.novo_contacto) AS novo_contacto,
     COALESCE(NULLIF(f.tipo_proximo_contacto, ''), pm.tipo_proximo_contacto) AS tipo_proximo_contacto,
     COALESCE(f.assunto_tratado, pm.assunto_tratado) AS assunto_tratado`;

app.get('/api/fichas', (req, res) => {
  console.log('📋 Fichas pedidas');

  const AUTHOR_NAME_EXPR = `COALESCE(
    NULLIF(TRIM(u.nome_mostrado), ''),
    NULLIF(TRIM(CONCAT(IFNULL(u.nome, ''), ' ', IFNULL(u.apelido, ''))), ''),
    NULLIF(TRIM(u.name), '')
  ) AS author_name`;

  const respond = (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    console.log(`✅ ${results.length} fichas`);
    res.json(results);
  };

  db.query(
    `SELECT f.*,
       COALESCE(cl_direct.denominacao_fiscal, cl_pods.denominacao_fiscal) AS client_name,
       ${AUTHOR_NAME_EXPR},${CONTACT_META_SELECT}
     FROM fichas f
     LEFT JOIN clients cl_direct ON cl_direct.legacy_id = f.client_legacy_id
     LEFT JOIN wp_podsrel pr ON pr.pod_id = 13 AND pr.field_id = 15 AND pr.item_id = f.legacy_id
     LEFT JOIN clients cl_pods ON cl_pods.legacy_id = pr.related_item_id
     LEFT JOIN users u ON u.id = CAST(NULLIF(f.author, '') AS UNSIGNED)
     LEFT JOIN ${CONTACT_META_SUBQUERY} ON pm.post_id = f.legacy_id
     ORDER BY COALESCE(f.data_contacto, pm.data_contacto) DESC`,
    (err, results) => {
      if (!err) return respond(null, results);

      console.warn('⚠️ Falha ao juntar wp_podsrel para resolver cliente das fichas, a usar fallback simples:', err.message);
      db.query(
        `SELECT f.*,
           cl_direct.denominacao_fiscal AS client_name,
           ${AUTHOR_NAME_EXPR},${CONTACT_META_SELECT}
         FROM fichas f
         LEFT JOIN clients cl_direct ON cl_direct.legacy_id = f.client_legacy_id
         LEFT JOIN users u ON u.id = CAST(NULLIF(f.author, '') AS UNSIGNED)
         LEFT JOIN ${CONTACT_META_SUBQUERY} ON pm.post_id = f.legacy_id
         ORDER BY COALESCE(f.data_contacto, pm.data_contacto) DESC`,
        respond
      );
    }
  );
});

// The "Propostas" / "Propostas Adjudicadas" fields (serviços propostos,
// valor total, estado, faturação, ...) are, like data_proximo_contacto,
// never populated on `fichas` by the WordPress sync — WordPress's REST API
// doesn't expose Pods custom fields for this CPT at all, so only the real
// wp_postmeta table (migrated wholesale into this DB) has them. Confirmed
// the exact meta_keys directly in the DB before writing this (see PT names
// below vs this app's own column names, which don't match 1:1):
//   descritivo_da_proposta          -> descritivo_proposta
//   valor_total_da_proposta         -> valor_total_proposta
//   estado_da_proposta              -> estado_proposta
//   data_de_apresentacao_da_proposta -> data_apresentacao_proposta
//   possibilidade_de_negocio        -> possibilidade_negocio
//   motivo_da_possibilidade_de_negocio -> motivo_possibilidade_negocio
//   valor_total_adjudicado          -> valor_total_adjudicado (same name)
//   descritivo_da_fatura            -> descritivo_fatura
//   valor_da_fatura                 -> valor_fatura
//   data_da_fatura                  -> data_fatura
//   data_prevista_para_o_recebimento -> data_prevista_recebimento
//   data_do_ultimo_contacto_financeiro -> data_ultimo_contacto_financeiro
// Plus two Pods repeater fields (line items), each stored as N separately
// numbered meta rows rather than one field:
//   servicos_<n>_servico / servicos_<n>_valor             (serviços propostos)
//   servicos-adjudicados_<n>_servico / _valor              (serviços adjudicados)
//
// Registered BEFORE /api/fichas/:id below — Express matches routes in
// registration order, so if this came after, the literal path
// "propostas-meta" would be captured as :id instead (and 400 as an invalid
// numeric id) rather than ever reaching this handler.
app.get('/api/fichas/propostas-meta', (req, res) => {
  const scalarQuery = `
    SELECT
      post_id,
      MAX(CASE WHEN meta_key = 'descritivo_da_proposta' THEN meta_value END) AS descritivo_proposta,
      MAX(CASE WHEN meta_key = 'valor_total_da_proposta' THEN meta_value END) AS valor_total_proposta,
      MAX(CASE WHEN meta_key = 'estado_da_proposta' THEN meta_value END) AS estado_proposta,
      MAX(CASE WHEN meta_key = 'data_de_apresentacao_da_proposta' THEN STR_TO_DATE(meta_value, '%Y%m%d') END) AS data_apresentacao_proposta,
      MAX(CASE WHEN meta_key = 'possibilidade_de_negocio' THEN meta_value END) AS possibilidade_negocio,
      MAX(CASE WHEN meta_key = 'motivo_da_possibilidade_de_negocio' THEN meta_value END) AS motivo_possibilidade_negocio,
      MAX(CASE WHEN meta_key = 'valor_total_adjudicado' THEN meta_value END) AS valor_total_adjudicado,
      MAX(CASE WHEN meta_key = 'descritivo_da_fatura' THEN meta_value END) AS descritivo_fatura,
      MAX(CASE WHEN meta_key = 'valor_da_fatura' THEN meta_value END) AS valor_fatura,
      MAX(CASE WHEN meta_key = 'data_da_fatura' THEN STR_TO_DATE(meta_value, '%Y%m%d') END) AS data_fatura,
      MAX(CASE WHEN meta_key = 'data_prevista_para_o_recebimento' THEN STR_TO_DATE(meta_value, '%Y%m%d') END) AS data_prevista_recebimento,
      MAX(CASE WHEN meta_key = 'data_do_ultimo_contacto_financeiro' THEN STR_TO_DATE(meta_value, '%Y%m%d') END) AS data_ultimo_contacto_financeiro
    FROM wp_postmeta
    WHERE meta_key IN (
      'descritivo_da_proposta', 'valor_total_da_proposta', 'estado_da_proposta', 'data_de_apresentacao_da_proposta',
      'possibilidade_de_negocio', 'motivo_da_possibilidade_de_negocio',
      'valor_total_adjudicado', 'descritivo_da_fatura', 'valor_da_fatura', 'data_da_fatura',
      'data_prevista_para_o_recebimento', 'data_do_ultimo_contacto_financeiro'
    )
    GROUP BY post_id
  `;

  const repeaterQuery = `
    SELECT post_id, meta_key, meta_value
    FROM wp_postmeta
    WHERE (meta_key REGEXP '^servicos_[0-9]+_(servico|valor)$'
       OR meta_key REGEXP '^servicos-adjudicados_[0-9]+_(servico|valor)$')
      AND meta_value IS NOT NULL AND meta_value != ''
  `;

  db.query(scalarQuery, (err, scalarRows) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(repeaterQuery, (err2, repeaterRows) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const result = {};
      const getEntry = (postId) => {
        if (!result[postId]) {
          result[postId] = {
            proposta: { servicos: [] },
            adjudicada: { servicos: [] }
          };
        }
        return result[postId];
      };

      scalarRows.forEach((row) => {
        const entry = getEntry(row.post_id);
        entry.proposta.descritivo = row.descritivo_proposta || null;
        entry.proposta.valorTotal = row.valor_total_proposta || null;
        entry.proposta.estado = row.estado_proposta || null;
        entry.proposta.dataApresentacao = row.data_apresentacao_proposta || null;
        entry.proposta.possibilidadeNegocio = row.possibilidade_negocio || null;
        entry.proposta.motivoPossibilidadeNegocio = row.motivo_possibilidade_negocio || null;
        entry.adjudicada.valorTotal = row.valor_total_adjudicado || null;
        entry.adjudicada.descritivoFatura = row.descritivo_fatura || null;
        entry.adjudicada.valorFatura = row.valor_fatura || null;
        entry.adjudicada.dataFatura = row.data_fatura || null;
        entry.adjudicada.dataPrevistaRecebimento = row.data_prevista_recebimento || null;
        entry.adjudicada.dataUltimoContactoFinanceiro = row.data_ultimo_contacto_financeiro || null;
      });

      const repeaterPattern = /^(servicos|servicos-adjudicados)_(\d+)_(servico|valor)$/;
      repeaterRows.forEach((row) => {
        const match = row.meta_key.match(repeaterPattern);
        if (!match) return;
        const [, group, idxStr, field] = match;
        const idx = Number(idxStr);
        const entry = getEntry(row.post_id);
        const list = group === 'servicos' ? entry.proposta.servicos : entry.adjudicada.servicos;
        if (!list[idx]) list[idx] = {};
        list[idx][field] = row.meta_value;
      });

      Object.values(result).forEach((entry) => {
        entry.proposta.servicos = entry.proposta.servicos.filter(Boolean);
        entry.adjudicada.servicos = entry.adjudicada.servicos.filter(Boolean);
      });

      res.json(result);
    });
  });
});

app.get('/api/fichas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de ficha inválido' });
  }

  // Same wp_postmeta resolution as GET /api/fichas — without it, opening a
  // ficha to edit would show blank contact-tracking fields even though the
  // reports tab correctly resolves and displays values for them.
  db.query(
    `SELECT f.*,${CONTACT_META_SELECT}
     FROM fichas f
     LEFT JOIN ${CONTACT_META_SUBQUERY} ON pm.post_id = f.legacy_id
     WHERE f.id = ? OR f.legacy_id = ? LIMIT 1`,
    [id, id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.status(404).json({ error: 'Ficha não encontrada' });
      return res.json(rows[0]);
    }
  );
});

const normalizeFichaBoolean = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value ? 1 : 0;
  const raw = (value || '').toString().trim().toLowerCase();
  return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(raw) ? 1 : 0;
};

const getFichaColumnValueMap = (body) => {
  const src = body || {};

  const normalizeStatus = (value) => {
    const raw = (value || '').toString().trim().toLowerCase();
    if (raw === 'publicado' || raw === 'verificado') return 'publish';
    if (raw === 'pendente') return 'pending';
    return raw || 'pending';
  };

  const normalizeVisibility = (value) => {
    const raw = (value || '').toString().trim().toLowerCase();
    if (raw === 'privado') return 'private';
    if (raw === 'protegido') return 'protected';
    return raw || 'public';
  };

  const asText = (value) => (value === undefined || value === null ? '' : value.toString().trim());
  const asNullable = (value) => {
    if (value === undefined || value === null) return null;
    const text = value.toString().trim();
    return text === '' ? null : text;
  };

  const title = asText(src.title || src.titulo || src.post_title);

  return {
    legacy_id: asNullable(src.legacy_id),
    client_legacy_id: asText(src.client_legacy_id || src.cliente || src.client_id),
    title,
    post_status: normalizeStatus(src.post_status || src.estado),
    post_visibility: normalizeVisibility(src.post_visibility || src.visibilidade),
    post_date: asNullable(src.post_date || src.data_publicacao),
    author: asText(src.author || src.autor || src.gestor || src.comercial_id),
    tipo_contacto: asText(src.tipo_contacto),
    pessoa_contacto: asText(src.pessoa_contacto),
    contacto: asText(src.contacto),
    data_contacto: asNullable(src.data_contacto),
    inicio_contacto: asText(src.inicio_contacto),
    fim_contacto: asText(src.fim_contacto),
    motivo_resumo_contacto: asText(src.motivo_resumo_contacto),
    contacto_efetuado: normalizeFichaBoolean(src.contacto_efetuado),
    follow_up: normalizeFichaBoolean(src.follow_up),
    novo_contacto: normalizeFichaBoolean(src.novo_contacto),
    tipo_proximo_contacto: asText(src.tipo_proximo_contacto),
    data_proximo_contacto: asNullable(src.data_proximo_contacto),
    data_apresentacao_proposta: asNullable(src.data_apresentacao_proposta),
    estado_proposta: asText(src.estado_proposta),
    descritivo_proposta: asText(src.descritivo_proposta),
    servicos_proposta: asText(src.servicos_proposta),
    valor_total_proposta: asText(src.valor_total_proposta),
    possibilidade_negocio: asText(src.possibilidade_negocio),
    motivo_possibilidade_negocio: asText(src.motivo_possibilidade_negocio),
    servicos_adjudicados: asText(src.servicos_adjudicados),
    valor_total_adjudicado: asText(src.valor_total_adjudicado),
    descritivo_fatura: asText(src.descritivo_fatura),
    valor_fatura: asText(src.valor_fatura),
    data_fatura: asNullable(src.data_fatura),
    data_prevista_recebimento: asNullable(src.data_prevista_recebimento),
    data_ultimo_contacto_financeiro: asNullable(src.data_ultimo_contacto_financeiro),
    relatorio_errado: normalizeFichaBoolean(src.relatorio_errado),
    porque_relatorio_errado: asText(src.porque_relatorio_errado),
    assunto_tratado: normalizeFichaBoolean(src.assunto_tratado),
    anexos: asText(src.anexos)
  };
};

app.post('/api/fichas', (req, res) => {
  db.query('SHOW COLUMNS FROM fichas', (colsErr, colRows) => {
    if (colsErr) return res.status(500).json({ error: colsErr.message });

    const existingCols = new Set((colRows || []).map((row) => row.Field));
    const mapped = getFichaColumnValueMap(req.body);
    const insertCols = [];
    const values = [];

    Object.entries(mapped).forEach(([column, value]) => {
      if (!existingCols.has(column)) return;
      if (column === 'legacy_id' && (value === null || value === '')) return;
      insertCols.push(column);
      values.push(value);
    });

    if (!insertCols.includes('title')) {
      insertCols.push('title');
      values.push('Sem título');
    }

    if (existingCols.has('created_at')) {
      insertCols.push('created_at');
      values.push(new Date());
    }

    const placeholders = insertCols.map(() => '?').join(', ');

    db.query(
      `INSERT INTO fichas (${insertCols.join(', ')}) VALUES (${placeholders})`,
      values,
      (err, result) => {
        if (err) {
          console.error('❌ ERRO create ficha:', err.message);
          return res.status(500).json({ error: err.message });
        }

        db.query('SELECT * FROM fichas WHERE id = ? LIMIT 1', [result.insertId], (fetchErr, rows) => {
          if (fetchErr) return res.status(500).json({ error: fetchErr.message });
          return res.status(201).json({ success: true, ficha: rows[0] || null });
        });
      }
    );
  });
});

app.put('/api/fichas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de ficha inválido' });
  }

  db.query('SHOW COLUMNS FROM fichas', (colsErr, colRows) => {
    if (colsErr) return res.status(500).json({ error: colsErr.message });

    const existingCols = new Set((colRows || []).map((row) => row.Field));
    const updates = [];
    const values = [];
    const mapped = getFichaColumnValueMap(req.body);

    Object.entries(mapped).forEach(([column, value]) => {
      if (column === 'legacy_id') return;
      if (!existingCols.has(column)) return;
      updates.push(`${column} = ?`);
      values.push(value);
    });

    if (!updates.length) {
      return res.status(400).json({ error: 'Sem campos para atualizar' });
    }

    if (existingCols.has('updated_at')) {
      updates.push('updated_at = NOW()');
    }

    values.push(id, id);

    db.query(
      `UPDATE fichas SET ${updates.join(', ')} WHERE id = ? OR legacy_id = ?`,
      values,
      (err, result) => {
        if (err) {
          console.error('❌ ERRO update ficha:', err.message);
          return res.status(500).json({ error: err.message });
        }

        if (!result.affectedRows) {
          return res.status(404).json({ error: 'Ficha não encontrada' });
        }

        db.query('SELECT * FROM fichas WHERE id = ? OR legacy_id = ? LIMIT 1', [id, id], (fetchErr, rows) => {
          if (fetchErr) {
            console.error('❌ ERRO fetch updated ficha:', fetchErr.message);
            return res.status(500).json({ error: fetchErr.message });
          }

          return res.json({ success: true, ficha: rows[0] || null });
        });
      }
    );
  });
});

// DELETE /api/fichas/:id - eliminação definitiva (a ficha já deve estar no lixo)
app.delete('/api/fichas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de ficha inválido' });
  }
  db.query('DELETE FROM fichas WHERE id = ? OR legacy_id = ?', [id, id], (err, result) => {
    if (err) {
      console.error('❌ ERRO delete ficha:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Ficha não encontrada' });
    }
    return res.json({ success: true });
  });
});

// CLIENTES ✅ **CORRIGIDO** - SÓ tabela real
// Same story as CONTACT_META_SUBQUERY for fichas: several `clients` columns
// come back NULL for every WP-synced row because the REST sync never wrote
// them, and the real values live in wp_postmeta under different field names.
// Confirmed directly in the DB before writing this (some fields, e.g. morada
// and nif, DO sync correctly through a different path already and are
// ~95% filled — the fallback here only fills the remaining gaps for those):
//   comercial                          -> comercial_id (gestor responsável)
//   pessoa_de_contacto_-_telefone_email -> pessoa_contacto_telefone_email
//   contacto_da_empresa                -> contacto_empresa (telefone geral)
//   pessoa_de_contacto_-_cargo         -> pessoa_contacto_cargo
//   morada                             -> morada
//   nif                                -> nif
//   pessoa_de_contacto_-_nome          -> pessoa_contacto_nome
// There is no "fax", "código postal" or "localidade" field anywhere in the
// migrated data (searched wp_postmeta exhaustively) — the classic paper
// "Ficha Detalhada do Cliente" report had those columns, but this system
// never tracked them, so the client report leaves them out rather than
// fabricate empty placeholders for data that was never collected.
const CLIENT_META_SUBQUERY = `(
  SELECT
    post_id,
    MAX(CASE WHEN meta_key = 'comercial' THEN meta_value END) AS comercial_id,
    MAX(CASE WHEN meta_key = 'pessoa_de_contacto_-_telefone_email' THEN meta_value END) AS pessoa_contacto_telefone_email,
    MAX(CASE WHEN meta_key = 'contacto_da_empresa' THEN meta_value END) AS contacto_empresa,
    MAX(CASE WHEN meta_key = 'pessoa_de_contacto_-_cargo' THEN meta_value END) AS pessoa_contacto_cargo,
    MAX(CASE WHEN meta_key = 'morada' THEN meta_value END) AS morada,
    MAX(CASE WHEN meta_key = 'nif' THEN meta_value END) AS nif,
    MAX(CASE WHEN meta_key = 'pessoa_de_contacto_-_nome' THEN meta_value END) AS pessoa_contacto_nome
  FROM wp_postmeta
  WHERE meta_key IN (
    'comercial', 'pessoa_de_contacto_-_telefone_email', 'contacto_da_empresa',
    'pessoa_de_contacto_-_cargo', 'morada', 'nif', 'pessoa_de_contacto_-_nome'
  )
  GROUP BY post_id
) pmc`;

const CLIENT_META_SELECT = `
     COALESCE(NULLIF(c.comercial_id, ''), pmc.comercial_id) AS comercial_id,
     COALESCE(NULLIF(c.pessoa_contacto_telefone_email, ''), pmc.pessoa_contacto_telefone_email) AS pessoa_contacto_telefone_email,
     COALESCE(NULLIF(c.contacto_empresa, ''), pmc.contacto_empresa) AS contacto_empresa,
     COALESCE(NULLIF(c.pessoa_contacto_cargo, ''), pmc.pessoa_contacto_cargo) AS pessoa_contacto_cargo,
     COALESCE(NULLIF(c.morada, ''), pmc.morada) AS morada,
     COALESCE(NULLIF(c.nif, ''), pmc.nif) AS nif,
     COALESCE(NULLIF(c.pessoa_contacto_nome, ''), pmc.pessoa_contacto_nome) AS pessoa_contacto_nome`;

app.get('/api/clientes', (req, res) => {
  console.log('👥 Clientes pedidos - TENTANDO TABELA clients...');
  
  db.query('SHOW COLUMNS FROM clients', (err, colunas) => {
    if (err) {
      console.error('❌ Tabela clients NÃO EXISTE');
      return res.status(500).json({ error: 'Tabela clients não encontrada' });
    }
    
    console.log(`✅ Tabela clients OK - ${colunas.length} colunas`);

    db.query(
      `SELECT c.*,
         COALESCE(
           NULLIF(TRIM(u.nome_mostrado), ''),
           NULLIF(TRIM(CONCAT(IFNULL(u.nome, ''), ' ', IFNULL(u.apelido, ''))), ''),
           NULLIF(TRIM(u.name), '')
         ) AS autor_nome,${CLIENT_META_SELECT}
       FROM clients c
       LEFT JOIN ${CLIENT_META_SUBQUERY} ON pmc.post_id = c.legacy_id
       LEFT JOIN users u ON u.id = COALESCE(
         CAST(NULLIF(c.comercial_id, '') AS UNSIGNED),
         CAST(NULLIF(pmc.comercial_id, '') AS UNSIGNED),
         CAST(NULLIF(c.author, '') AS UNSIGNED)
       )
       ORDER BY COALESCE(c.publicado_em, c.created_at, c.updated_at) DESC, c.legacy_id DESC`,
      (err2, results) => {
        if (err2) {
          console.error('❌ ERRO clients:', err2.message);
          return res.status(500).json({ error: err2.message });
        }

        console.log(`✅ ${results.length} CLIENTES REAIS com TODOS campos`);
        console.log('📋 Campos:', Object.keys(results[0] || {}));
        res.json(results);
      }
    );
  });
});

// GET /api/clientes/:id - obter cliente por id
app.get('/api/clientes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de cliente inválido' });
  }

  db.query(
    `SELECT c.*,${CLIENT_META_SELECT}
     FROM clients c
     LEFT JOIN ${CLIENT_META_SUBQUERY} ON pmc.post_id = c.legacy_id
     WHERE c.id = ? OR c.legacy_id = ? LIMIT 1`,
    [id, id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
      return res.json(rows[0]);
    }
  );
});

// GET /api/comerciais - listar comerciais para selects
app.get('/api/comerciais', (req, res) => {
  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
    (errCols, colRows) => {
      if (errCols) return res.status(500).json({ error: errCols.message });

      const existingCols = (colRows || []).map((r) => r.COLUMN_NAME);
      const has = (col) => existingCols.includes(col);

      const nameExpr = has('nome')
        ? "TRIM(CONCAT(IFNULL(nome, ''), ' ', IFNULL(apelido, '')))"
        : 'name';

      const roleExpr = has('role') ? 'LOWER(IFNULL(role, \'\'))' : "''";

      const sql = `
        SELECT
          id,
          TRIM(IFNULL(name, '')) AS username,
          ${nameExpr} AS display_name,
          ${roleExpr} AS role_name
        FROM users
        ORDER BY display_name ASC, username ASC
      `;

      db.query(sql, (errUsers, rows) => {
        if (errUsers) return res.status(500).json({ error: errUsers.message });

        const mapped = (rows || []).map((r) => {
          const username = (r.username || '').toString().trim();
          const displayName = (r.display_name || '').toString().trim() || username;
          const roleName = (r.role_name || '').toString().trim();
          return {
            id: r.id,
            value: username || displayName,
            label: displayName,
            username,
            role: roleName
          };
        });

        db.query(
          `SELECT DISTINCT TRIM(nome_autor) AS autor FROM (
             SELECT IFNULL(author, '') AS nome_autor FROM clients
             UNION ALL
             SELECT IFNULL(comercial_id, '') AS nome_autor FROM clients
           ) AS autores
           WHERE TRIM(nome_autor) != ''
           ORDER BY autor ASC`,
          (errFallback, fallbackRows) => {
            if (errFallback) return res.status(500).json({ error: errFallback.message });

            // These "legacy" rows are a last-resort fallback for author/
            // comercial_id values on `clients` that don't correspond to any
            // real row in `users` — e.g. an old numeric author id from
            // before the migration. If a value here IS a real user's id
            // (the normal case: fichas/clients store the real WP user id as
            // author), keeping it anyway creates a duplicate entry with the
            // same numeric id/value but a junk label (literally "8" instead
            // of "Beatriz Cardoso") — and since the frontend's id/value
            // lookup map is keyed by that same numeric string, this junk
            // entry silently overwrites the real name, so real gestores with
            // real fichas show up in reports labelled by a bare number
            // instead of their name. Only keep truly orphaned values.
            const knownIdentifiers = new Set();
            mapped.forEach((m) => {
              if (m.id !== undefined && m.id !== null) knownIdentifiers.add(String(m.id).toLowerCase());
              if (m.username) knownIdentifiers.add(m.username.toLowerCase());
              if (m.value) knownIdentifiers.add(String(m.value).toLowerCase());
            });

            const fromClients = (fallbackRows || [])
              .filter((f) => !knownIdentifiers.has((f.autor || '').toString().trim().toLowerCase()))
              .map((f, idx) => ({
                id: `legacy-${idx + 1}`,
                value: f.autor,
                label: f.autor,
                username: f.autor,
                role: 'legacy'
              }));

            const source = [...mapped, ...fromClients];
            const dedup = [];
            const seen = new Set();
            source.forEach((item) => {
              const key = (item.value || '').toLowerCase();
              if (key && !seen.has(key)) {
                seen.add(key);
                dedup.push(item);
              }
            });

            return res.json(dedup);
          }
        );
      });
    }
  );
});

// POST /api/clientes - criar cliente
app.post('/api/clientes', (req, res) => {
  const body = req.body || {};
  const nome = (body.denominacao_fiscal || body.nome || '').toString().trim();
  const legacyId = Number(body.legacy_id);
  const estado = (body.estado || 'publicado').toString().trim();
  const visibilidade = (body.visibilidade || 'public').toString().trim();
  const senhaVisibilidade = (body.senha_visibilidade || '').toString().trim();

  if (!nome) {
    return res.status(400).json({ error: 'Nome/denominação fiscal é obrigatório' });
  }

  const values = [
    Number.isInteger(legacyId) && legacyId > 0 ? legacyId : null,
    nome,
    (body.contacto_empresa || '').toString().trim(),
    (body.pessoa_contacto_nome || '').toString().trim(),
    (body.pessoa_contacto_cargo || '').toString().trim(),
    (body.pessoa_contacto_telefone_email || '').toString().trim(),
    (body.morada || '').toString().trim(),
    (body.localidade || '').toString().trim(),
    (body.nif || '').toString().trim(),
    (body.observacoes || '').toString().trim(),
    (body.comercial_id || body.comercial || body.autor || '').toString().trim(),
    (body.author || '').toString().trim(),
    estado,
    visibilidade,
    senhaVisibilidade || null,
    body.publicado_em || null
  ];

  db.query(
    `INSERT INTO clients (
      legacy_id,
      denominacao_fiscal,
      contacto_empresa,
      pessoa_contacto_nome,
      pessoa_contacto_cargo,
      pessoa_contacto_telefone_email,
      morada,
      localidade,
      nif,
      observacoes,
      comercial_id,
      author,
      estado,
      visibilidade,
      senha_visibilidade,
      publicado_em,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    values,
    (err, result) => {
      if (err) {
        console.error('❌ ERRO create client:', err.message);
        return res.status(500).json({ error: err.message });
      }

      db.query('SELECT * FROM clients WHERE id = ? LIMIT 1', [result.insertId], (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        return res.status(201).json({ success: true, client: rows[0] || null });
      });
    }
  );
});

app.put('/api/clientes/:id', (req, res) => {
  const id = Number(req.params.id);
  const {
    denominacao_fiscal,
    comercial_id,
    estado,
    visibilidade,
    senha_visibilidade,
    publicado_em,
    contacto_empresa,
    pessoa_contacto_nome,
    pessoa_contacto_cargo,
    pessoa_contacto_telefone_email,
    morada,
    localidade,
    nif,
    observacoes,
    author
  } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de cliente inválido' });
  }

  const updates = [];
  const values = [];

  if (typeof denominacao_fiscal === 'string') {
    updates.push('denominacao_fiscal = ?');
    values.push(denominacao_fiscal.trim());
  }

  if (typeof comercial_id === 'string') {
    updates.push('comercial_id = ?');
    values.push(comercial_id.trim());
  }

  if (typeof estado === 'string') {
    updates.push('estado = ?');
    values.push(estado.trim());
  }

  if (typeof visibilidade === 'string') {
    updates.push('visibilidade = ?');
    values.push(visibilidade.trim());
  }

  if (typeof senha_visibilidade === 'string') {
    updates.push('senha_visibilidade = ?');
    values.push(senha_visibilidade.trim());
  }

  if (typeof publicado_em === 'string' || publicado_em === null) {
    updates.push('publicado_em = ?');
    values.push(publicado_em);
  }

  if (typeof contacto_empresa === 'string') {
    updates.push('contacto_empresa = ?');
    values.push(contacto_empresa.trim());
  }

  if (typeof pessoa_contacto_nome === 'string') {
    updates.push('pessoa_contacto_nome = ?');
    values.push(pessoa_contacto_nome.trim());
  }

  if (typeof pessoa_contacto_cargo === 'string') {
    updates.push('pessoa_contacto_cargo = ?');
    values.push(pessoa_contacto_cargo.trim());
  }

  if (typeof pessoa_contacto_telefone_email === 'string') {
    updates.push('pessoa_contacto_telefone_email = ?');
    values.push(pessoa_contacto_telefone_email.trim());
  }

  if (typeof morada === 'string') {
    updates.push('morada = ?');
    values.push(morada.trim());
  }

  if (typeof localidade === 'string') {
    updates.push('localidade = ?');
    values.push(localidade.trim());
  }

  if (typeof nif === 'string') {
    updates.push('nif = ?');
    values.push(nif.trim());
  }

  if (typeof observacoes === 'string') {
    updates.push('observacoes = ?');
    values.push(observacoes.trim());
  }

  if (typeof author === 'string') {
    updates.push('author = ?');
    values.push(author.trim());
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'Sem campos para atualizar' });
  }

  updates.push('updated_at = NOW()');
  values.push(id, id);

  db.query(
    `UPDATE clients SET ${updates.join(', ')} WHERE id = ? OR legacy_id = ?`,
    values,
    (err, result) => {
      if (err) {
        console.error('❌ ERRO update client:', err.message);
        return res.status(500).json({ error: err.message });
      }

      if (!result.affectedRows) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      db.query('SELECT * FROM clients WHERE id = ? OR legacy_id = ? LIMIT 1', [id, id], (err2, rows) => {
        if (err2) {
          console.error('❌ ERRO fetch updated client:', err2.message);
          return res.status(500).json({ error: err2.message });
        }

        return res.json({ success: true, client: rows[0] || null });
      });
    }
  );
});

// DELETE /api/clientes/:id - hard delete
app.delete('/api/clientes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de cliente inválido' });
  }
  db.query('DELETE FROM clients WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('❌ ERRO delete client:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    return res.json({ success: true });
  });
});

// PÁGINAS ✅ (já funciona)  
app.get('/api/paginas', (req, res) => {
  console.log('📄 Páginas pedidas');
  db.query(`
    SELECT * FROM wp_posts
    WHERE post_type = 'page' AND post_status IN ('publish', 'draft', 'trash')
    ORDER BY post_date DESC
  `, (err, results) => {
    if (err) {
      db.query('SELECT legacy_id as ID, tipo_contacto as post_title, motivo_resumo_contacto as post_content, data_contacto as post_date FROM fichas ORDER BY data_contacto DESC', (err2, fallback) => {
        console.log(`✅ ${fallback.length} páginas (fichas)`);
        res.json(fallback);
      });
      return;
    }
    console.log(`✅ ${results.length} páginas wp_posts`);
    res.json(results);
  });
});

app.get('/api/paginas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de página inválido' });
  }

  db.query(
    `SELECT * FROM wp_posts WHERE post_type = 'page' AND ID = ? LIMIT 1`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || !rows.length) return res.status(404).json({ error: 'Página não encontrada' });
      res.json(rows[0]);
    }
  );
});

app.post('/api/paginas', (req, res) => {
  const titulo = (req.body?.titulo || '').toString().trim() || 'Sem título';
  const conteudo = (req.body?.conteudo || '').toString();
  const slug = ((req.body?.slug || titulo).toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'pagina';
  const estadoRaw = (req.body?.estado || 'draft').toString().toLowerCase();
  const estado = estadoRaw === 'publish' || estadoRaw === 'publicado' ? 'publish' : 'draft';
  const autor = Number(req.body?.autor) || 1;
  const ordem = Number(req.body?.ordem) || 0;
  const superior = Number(req.body?.superior) || 0;

  db.query(
    `INSERT INTO wp_posts
      (post_author, post_date, post_date_gmt, post_content, post_title, post_status, comment_status, ping_status, post_name, post_modified, post_modified_gmt, post_parent, menu_order, post_type)
     VALUES (?, NOW(), NOW(), ?, ?, ?, 'closed', 'closed', ?, NOW(), NOW(), ?, ?, 'page')`,
    [autor, conteudo, titulo, estado, slug, superior, ordem],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query('SELECT * FROM wp_posts WHERE ID = ? LIMIT 1', [result.insertId], (fetchErr, rows) => {
        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        res.status(201).json({ success: true, pagina: rows[0] || null });
      });
    }
  );
});

app.put('/api/paginas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de página inválido' });
  }

  const titulo = (req.body?.titulo || '').toString().trim() || 'Sem título';
  const conteudo = (req.body?.conteudo || '').toString();
  const slug = ((req.body?.slug || titulo).toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'pagina';
  const estadoRaw = (req.body?.estado || 'draft').toString().toLowerCase();
  const estado = estadoRaw === 'publish' || estadoRaw === 'publicado' ? 'publish'
    : estadoRaw === 'lixo' || estadoRaw === 'trash' ? 'trash'
    : 'draft';
  const autor = Number(req.body?.autor) || 1;
  const ordem = Number(req.body?.ordem) || 0;
  const superior = Number(req.body?.superior) || 0;

  db.query(
    `UPDATE wp_posts
     SET post_title = ?, post_content = ?, post_status = ?, post_name = ?, post_author = ?, post_parent = ?, menu_order = ?, post_modified = NOW(), post_modified_gmt = NOW()
     WHERE ID = ? AND post_type = 'page'`,
    [titulo, conteudo, estado, slug, autor, superior, ordem, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!result.affectedRows) return res.status(404).json({ error: 'Página não encontrada' });
      db.query('SELECT * FROM wp_posts WHERE ID = ? LIMIT 1', [id], (fetchErr, rows) => {
        if (fetchErr) return res.status(500).json({ error: fetchErr.message });
        res.json({ success: true, pagina: rows[0] || null });
      });
    }
  );
});

// DELETE /api/paginas/:id - eliminação definitiva (a página já deve estar no lixo)
app.delete('/api/paginas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de página inválido' });
  }
  db.query('DELETE FROM wp_posts WHERE ID = ? AND post_type = \'page\'', [id], (err, result) => {
    if (err) {
      console.error('❌ ERRO delete pagina:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Página não encontrada' });
    }
    return res.json({ success: true });
  });
});

// PERFIL UTILIZADOR (tabela users)
app.get('/api/perfil', (req, res) => {
  const login = (req.query.login || '').toString().trim();
  if (!login) {
    return res.status(400).json({ error: 'Parametro login em falta' });
  }

  const sendWpUser = (wpUserRow) => {
    if (!wpUserRow) {
      return res.status(404).json({ error: 'Utilizador nao encontrado' });
    }

    return res.json({
      id: wpUserRow.id,
      username: (wpUserRow.username || '').toString(),
      email: (wpUserRow.email || '').toString(),
      role: 'editor',
      displayName: (wpUserRow.displayName || wpUserRow.username || '').toString(),
      firstName: '',
      lastName: '',
      nickname: (wpUserRow.displayName || wpUserRow.username || '').toString(),
      bio: '',
      site: '',
      avatarUrl: '',
      preferences: {}
    });
  };

  const queryWpUsers = () => {
    db.query(
      `SELECT ID AS id, user_login AS username, user_email AS email, display_name AS displayName
       FROM wp_users
       WHERE LOWER(user_login) = LOWER(?) OR LOWER(user_email) = LOWER(?) OR LOWER(display_name) = LOWER(?)
       LIMIT 1`,
      [login, login, login],
      (wpErr, wpRows) => {
        if (wpErr) {
          console.error('GET perfil wp_users DB error:', wpErr.message);
          return res.status(500).json({ error: wpErr.message });
        }
        return sendWpUser((wpRows && wpRows[0]) || null);
      }
    );
  };

  // Verificar que colunas existem na tabela users
  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
    (colErr, colRows) => {
      if (colErr) {
        // Some managed databases can restrict INFORMATION_SCHEMA access.
        console.warn('GET perfil: falha em INFORMATION_SCHEMA, tentar wp_users:', colErr.message);
        return queryWpUsers();
      }

      const existingCols = colRows.map(r => r.COLUMN_NAME);
      const has = (col) => existingCols.includes(col);

      // Sempre selecionar id, name, email, role (colunas base)
      const selectCols = ['id', 'name', 'email', 'role'];
      if (has('nome')) selectCols.push('nome');
      if (has('apelido')) selectCols.push('apelido');
      if (has('alcunha')) selectCols.push('alcunha');
      if (has('nome_mostrado')) selectCols.push('nome_mostrado');
      if (has('bio')) selectCols.push('bio');
      if (has('site_url')) selectCols.push('site_url');
      if (has('imagem_url')) selectCols.push('imagem_url');
      if (has('preferences')) selectCols.push('preferences');

      // WHERE clause só com colunas que existem
      const whereParts = ['LOWER(name) = LOWER(?)', 'LOWER(email) = LOWER(?)'];
      const whereParams = [login, login];
      if (has('alcunha')) { whereParts.push('LOWER(alcunha) = LOWER(?)'); whereParams.push(login); }
      if (has('nome_mostrado')) { whereParts.push('LOWER(nome_mostrado) = LOWER(?)'); whereParams.push(login); }
      if (has('nome')) { whereParts.push('LOWER(nome) = LOWER(?)'); whereParams.push(login); }

      const sql = `SELECT ${selectCols.join(', ')} FROM users WHERE ${whereParts.join(' OR ')} LIMIT 1`;

      db.query(sql, whereParams, (userErr, users) => {
        if (userErr) {
          // If custom users table does not exist in production, fallback to wp_users.
          if (userErr && (userErr.code === 'ER_NO_SUCH_TABLE' || userErr.errno === 1146)) {
            console.warn('GET perfil: tabela users não existe, tentar wp_users');
            return queryWpUsers();
          }
          // Column mismatch (e.g. schema uses 'nome' instead of 'name') — fallback
          if (userErr && (userErr.code === 'ER_BAD_FIELD_ERROR' || userErr.errno === 1054)) {
            console.warn('GET perfil: coluna inválida em users, tentar wp_users:', userErr.message);
            return queryWpUsers();
          }
          console.error('GET perfil DB error:', userErr.message);
          return res.status(500).json({ error: userErr.message });
        }

        if (!users || users.length === 0) {
          // Fallback: tentar wp_users se não encontrado em users
          return queryWpUsers();
        }

        const user = users[0];
        const firstName = (user.nome || '').toString();
        const lastName = (user.apelido || '').toString();
        const fullName = `${firstName} ${lastName}`.trim();

        let prefs = {};
        if (user.preferences) {
          try { prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences; } catch(e) {}
        }

        return res.json({
          id: user.id,
          username: (user.name || '').toString(),
          email: (user.email || '').toString(),
          role: (user.role || '').toString(),
          displayName: (user.nome_mostrado || fullName || user.name || '').toString(),
          firstName,
          lastName,
          nickname: (user.alcunha || user.name || '').toString(),
          bio: (user.bio || '').toString(),
          site: (user.site_url || '').toString(),
          avatarUrl: (user.imagem_url || '').toString(),
          preferences: prefs
        });
      });
    }
  );
});

// PUT PERFIL - Atualizar dados do utilizador (inclui preferences)
app.put('/api/perfil', (req, res) => {
  const { login, nome, apelido, alcunha, displayName, bio, site, email, preferences } = req.body;
  console.log('PUT /api/perfil login:', login);
  if (!login) return res.status(400).json({ error: 'login required' });

  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
    (colErr, colRows) => {
      if (colErr) return res.status(500).json({ error: colErr.message });

      const existingCols = colRows.map(r => r.COLUMN_NAME);
      const has = (col) => existingCols.includes(col);

      // Criar colunas em falta
      const missing = ['nome','apelido','alcunha','nome_mostrado','bio','site_url','preferences'].filter(c => !has(c));
      const addCols = (cols, done) => {
        if (!cols.length) return done();
        const col = cols.shift();
        const type = col === 'preferences' ? 'TEXT NULL' : 'VARCHAR(255) NULL';
        db.query(`ALTER TABLE users ADD COLUMN ${col} ${type}`, () => addCols(cols, done));
      };

      addCols(missing, () => {
        const setParts = [];
        const setVals = [];
        if (has('nome') || missing.includes('nome')) { setParts.push('nome = ?'); setVals.push(nome || ''); }
        if (has('apelido') || missing.includes('apelido')) { setParts.push('apelido = ?'); setVals.push(apelido || ''); }
        if (has('alcunha') || missing.includes('alcunha')) { setParts.push('alcunha = ?'); setVals.push(alcunha || ''); }
        if (has('nome_mostrado') || missing.includes('nome_mostrado')) { setParts.push('nome_mostrado = ?'); setVals.push(displayName || ''); }
        if (has('bio') || missing.includes('bio')) { setParts.push('bio = ?'); setVals.push(bio || ''); }
        if (has('site_url') || missing.includes('site_url')) { setParts.push('site_url = ?'); setVals.push(site || ''); }
        if (has('preferences') || missing.includes('preferences')) { setParts.push('preferences = ?'); setVals.push(preferences ? JSON.stringify(preferences) : null); }
        if (has('email')) { setParts.push('email = ?'); setVals.push(email || ''); }
        if (has('updated_at')) { setParts.push('updated_at = NOW()'); }

        if (!setParts.length) return res.json({ success: true, affectedRows: 0 });

        setVals.push(login, login);
        const sql = `UPDATE users SET ${setParts.join(', ')} WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?)`;
        db.query(sql, setVals, (err, result) => {
          if (err) { console.error('PUT perfil DB error:', err.message); return res.status(500).json({ error: err.message }); }
          res.json({ success: true, affectedRows: result.affectedRows });
        });
      });
    }
  );
});

// POST PERFIL/PASSWORD - Alterar senha
app.post('/api/perfil/password', (req, res) => {
  const { login, currentPassword, newPassword } = req.body;
  if (!login || !newPassword) {
    return res.status(400).json({ error: 'login e newPassword são obrigatórios' });
  }

  const hashPassword = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

  db.query(
    'SELECT id, password_hash FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });

      const user = results[0];

      // Se já existe hash SHA-256 (64 hex chars), verificar senha atual.
      // Hashes WP (formato $P$...) são ignorados — permite redefinir senha.
      const isSha256Hash = user.password_hash && /^[0-9a-f]{64}$/i.test(user.password_hash);
      if (isSha256Hash && currentPassword) {
        const currentHash = hashPassword(currentPassword);
        if (user.password_hash !== currentHash) {
          return res.status(401).json({ error: 'Senha atual incorreta' });
        }
      }

      const newHash = hashPassword(newPassword);
      const hasUpdatedAt = true; // assumed
      db.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [newHash, user.id],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true });
        }
      );
    }
  );
});

// SESSIONS - criar tabela se não existir
db.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_agent TEXT,
    ip VARCHAR(45),
    created_at DATETIME DEFAULT NOW(),
    last_active DATETIME DEFAULT NOW()
  )
`, () => {});

// APP PASSWORDS - criar tabela se não existir
db.query(`
  CREATE TABLE IF NOT EXISTS app_passwords (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    last_used DATETIME NULL
  )
`, () => {});

// POST /api/sessions - criar sessão ao fazer login
app.post('/api/sessions', (req, res) => {
  const { login } = req.body;
  if (!login) return res.status(400).json({ error: 'login required' });
  db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err || !results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
      const userId = results[0].id;
      const token = crypto.randomBytes(32).toString('hex');
      const ua = req.headers['user-agent'] || '';
      const ip = req.ip || '';
      db.query('INSERT INTO sessions (user_id, token, user_agent, ip) VALUES (?, ?, ?, ?)',
        [userId, token, ua, ip],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, token });
        }
      );
    }
  );
});

// GET /api/sessions - listar sessões ativas do utilizador
app.get('/api/sessions', (req, res) => {
  const { login } = req.query;
  if (!login) return res.status(400).json({ error: 'login required' });
  db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err || !results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
      const userId = results[0].id;
      db.query('SELECT id, user_agent, ip, created_at, last_active FROM sessions WHERE user_id = ? ORDER BY last_active DESC',
        [userId],
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json(rows);
        }
      );
    }
  );
});

// GET /api/sessions/validate - validar se o token de sessão ainda está ativo
app.get('/api/sessions/validate', (req, res) => {
  const login = (req.query.login || '').toString().trim();
  const token = (req.query.token || '').toString().trim();
  if (!login || !token) return res.status(400).json({ error: 'login and token required' });

  db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err || !results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
      const userId = results[0].id;

      db.query('SELECT id FROM sessions WHERE user_id = ? AND token = ? LIMIT 1',
        [userId, token],
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ valid: rows.length > 0 });
        }
      );
    }
  );
});

// DELETE /api/sessions - fechar todas as sessões exceto a atual
app.delete('/api/sessions', (req, res) => {
  const { login, currentToken } = req.body;
  if (!login) return res.status(400).json({ error: 'login required' });
  db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err || !results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
      const userId = results[0].id;
      db.query(
        currentToken
          ? 'DELETE FROM sessions WHERE user_id = ? AND token != ?'
          : 'DELETE FROM sessions WHERE user_id = ?',
        currentToken ? [userId, currentToken] : [userId],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, closed: result.affectedRows });
        }
      );
    }
  );
});

// GET /api/app-passwords - listar senhas de aplicação do utilizador
app.get('/api/app-passwords', (req, res) => {
  const login = (req.query.login || '').toString().trim();
  if (!login) return res.status(400).json({ error: 'login required' });
  db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err || !results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
      const userId = results[0].id;
      db.query('SELECT id, name, created_at, last_used FROM app_passwords WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json(rows);
        }
      );
    }
  );
});

// POST /api/app-passwords - criar nova senha de aplicação
app.post('/api/app-passwords', (req, res) => {
  const { login, name } = req.body;
  if (!login || !name) return res.status(400).json({ error: 'login e name são obrigatórios' });
  db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err || !results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
      const userId = results[0].id;
      // Token: 24 hex chars maiúsculos agrupados em blocos de 4 (ex: ABCD EFGH ...)
      const raw = crypto.randomBytes(12).toString('hex').toUpperCase();
      const formatted = raw.match(/.{4}/g).join(' ');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      db.query('INSERT INTO app_passwords (user_id, name, password_hash) VALUES (?, ?, ?)',
        [userId, name.trim(), hash],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, id: result.insertId, token: formatted });
        }
      );
    }
  );
});

// DELETE /api/app-passwords/:id - revogar uma senha de aplicação
app.delete('/api/app-passwords/:id', (req, res) => {
  const { login } = req.body;
  const id = parseInt(req.params.id, 10);
  if (!login || !id) return res.status(400).json({ error: 'login e id são obrigatórios' });
  db.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1',
    [login, login],
    (err, results) => {
      if (err || !results.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
      const userId = results[0].id;
      db.query('DELETE FROM app_passwords WHERE id = ? AND user_id = ?',
        [id, userId],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (result.affectedRows === 0) return res.status(404).json({ error: 'Senha não encontrada' });
          res.json({ success: true });
        }
      );
    }
  );
});

// ADMIN - listar utilizadores
app.get('/api/admin/users', (req, res) => {
  const actingLogin = (req.query.actingLogin || '').toString().trim();
  if (!actingLogin) return res.status(400).json({ error: 'actingLogin required' });

  assertAdminByLogin(actingLogin, (authErr) => {
    if (authErr) return res.status(authErr.status || 500).json({ error: authErr.message });

    db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
      (colErr, colRows) => {
        if (colErr) return res.status(500).json({ error: colErr.message });

        const existingCols = (colRows || []).map((r) => r.COLUMN_NAME);
        const has = (col) => existingCols.includes(col);

        const nameExpr = has('nome')
          ? (has('apelido')
            ? "TRIM(CONCAT(IFNULL(nome, ''), ' ', IFNULL(apelido, '')))"
            : "TRIM(IFNULL(nome, ''))")
          : 'name';

        const sql = `
          SELECT
            id,
            TRIM(IFNULL(name, '')) AS username,
            TRIM(IFNULL(email, '')) AS email,
            LOWER(TRIM(IFNULL(role, 'editor'))) AS role,
            ${nameExpr} AS full_name,
            ${has('nome_mostrado') ? "TRIM(IFNULL(nome_mostrado, ''))" : "''"} AS display_name
          FROM users
          ORDER BY display_name ASC, full_name ASC, username ASC
        `;

        db.query(sql, (userErr, rows) => {
          if (userErr) return res.status(500).json({ error: userErr.message });

          const users = (rows || []).map((row) => {
            const username = (row.username || '').toString().trim();
            const displayName = (row.display_name || row.full_name || username || '').toString().trim() || username;
            return {
              id: row.id,
              username,
              email: (row.email || '').toString(),
              role: normalizeUserRole(row.role),
              displayName
            };
          });

          return res.json(users);
        });
      }
    );
  });
});

// ADMIN - atualizar cargo
app.put('/api/admin/users/:id/role', (req, res) => {
  const actingLogin = (req.body?.actingLogin || '').toString().trim();
  const nextRole = normalizeUserRole(req.body?.role);
  const targetId = Number(req.params.id);

  if (!actingLogin) return res.status(400).json({ error: 'actingLogin required' });
  if (!Number.isInteger(targetId) || targetId <= 0) return res.status(400).json({ error: 'ID inválido' });
  if (!['admin', 'contributor', 'editor'].includes(nextRole)) return res.status(400).json({ error: 'Cargo inválido' });

  assertAdminByLogin(actingLogin, (authErr) => {
    if (authErr) return res.status(authErr.status || 500).json({ error: authErr.message });

    db.query('UPDATE users SET role = ? WHERE id = ?', [nextRole, targetId], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!result.affectedRows) return res.status(404).json({ error: 'Utilizador não encontrado' });
      return res.json({ success: true, role: nextRole });
    });
  });
});

// ADMIN - impersonação para user testing
app.post('/api/admin/impersonate', (req, res) => {
  const actingLogin = (req.body?.actingLogin || '').toString().trim();
  const targetUserId = Number(req.body?.targetUserId);

  if (!actingLogin) return res.status(400).json({ error: 'actingLogin required' });
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) return res.status(400).json({ error: 'targetUserId inválido' });

  assertAdminByLogin(actingLogin, (authErr, adminUser) => {
    if (authErr) return res.status(authErr.status || 500).json({ error: authErr.message });

    db.query('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [targetUserId], (userErr, rows) => {
      if (userErr) return res.status(500).json({ error: userErr.message });
      if (!rows || !rows.length) return res.status(404).json({ error: 'Utilizador alvo não encontrado' });

      const target = rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const ua = req.headers['user-agent'] || '';
      const ip = req.ip || '';

      db.query(
        'INSERT INTO sessions (user_id, token, user_agent, ip) VALUES (?, ?, ?, ?)',
        [target.id, token, ua, ip],
        (sessionErr) => {
          if (sessionErr) return res.status(500).json({ error: sessionErr.message });

          const username = (target.name || '').toString().trim();
          const email = (target.email || '').toString().trim();

          return res.json({
            success: true,
            authUser: {
              id: target.id,
              username,
              name: username,
              displayName: username,
              firstName: '',
              lastName: '',
              nickname: username,
              bio: '',
              site: '',
              email,
              avatarUrl: '',
              role: normalizeUserRole(target.role),
              sessionToken: token,
              isImpersonating: true,
              impersonatedBy: adminUser.name || actingLogin
            }
          });
        }
      );
    });
  });
});

// ============================================
// SINCRONIZAÇÃO COM WORDPRESS
// ============================================

// Configurar URL do WordPress
const WP_API_URL = (process.env.WP_API_URL || '').trim();
const WP_API_USER = (process.env.WP_API_USER || '').trim();
const WP_API_PASS = (process.env.WP_API_PASS || '').trim();
// WordPress's `status=any` deliberately excludes 'trash' — list every native
// status by name so authenticated requests can see trashed items too.
const WP_ALL_STATUSES = 'publish,pending,draft,trash';
const WP_API_HEADERS = WP_API_USER && WP_API_PASS
  ? {
      Authorization: `Basic ${Buffer.from(`${WP_API_USER}:${WP_API_PASS}`).toString('base64')}`
    }
  : {};

// Endpoint para sincronizar dados do WordPress
app.get('/api/sync/wordpress/fichas', async (req, res) => {
  if (!WP_API_URL) {
    return res.status(400).json({ 
      error: 'WP_API_URL não configurada',
      help: 'Configure WP_API_URL nas variáveis de ambiente'
    });
  }

  try {
    console.log('🔄 Sincronizando fichas do WordPress...');
    const wpUrl = `${WP_API_URL}/wp/v2/posts?per_page=100&context=${Object.keys(WP_API_HEADERS).length ? 'edit' : 'view'}&status=${Object.keys(WP_API_HEADERS).length ? WP_ALL_STATUSES : 'publish'}`;

    const response = await axios.get(wpUrl, { headers: WP_API_HEADERS });
    const fichas = response.data.map(post => ({
      id: post.id,
      title: post.title.rendered,
      content: post.content.rendered,
      status: post.status,
      data_contacto: post.date,
      author: post.author,
      featured_media: post.featured_media,
      link: post.link
    }));

    console.log(`✅ ${fichas.length} fichas sincronizadas do WordPress`);
    res.json({
      success: true,
      count: fichas.length,
      fichas
    });
  } catch (error) {
    console.error('❌ Erro ao sincronizar WordPress:', error.message);
    res.status(500).json({ 
      error: error.message,
      help: 'Verifica se WP_API_URL está correto e o WordPress está acessível'
    });
  }
});

// Endpoint para testar conexão com WordPress
app.get('/api/sync/wordpress/test', async (req, res) => {
  if (!WP_API_URL) {
    return res.status(400).json({ 
      error: 'WP_API_URL não configurada'
    });
  }

  try {
    console.log(`🧪 Testando WordPress em ${WP_API_URL}`);
    const response = await axios.get(`${WP_API_URL}`, { timeout: 5000 });
    
    res.json({
      success: true,
      message: 'WordPress acessível',
      wp_version: response.data?.wp_version || 'desconhecida',
      url: WP_API_URL
    });
  } catch (error) {
    console.error('❌ Erro ao testar WordPress:', error.message);
    res.status(500).json({ 
      error: error.message,
      message: 'Não conseguiu conectar ao WordPress',
      url: WP_API_URL
    });
  }
});

// Endpoint para sincronizar dados de clientes do WordPress
app.get('/api/sync/wordpress/clientes', async (req, res) => {
  if (!WP_API_URL) {
    return res.status(400).json({ 
      error: 'WP_API_URL não configurada'
    });
  }

  try {
    console.log('🔄 Sincronizando clientes do WordPress...');
    
    // Se usar um custom post type para clientes, usar aqui
    // Para agora, busca fichas com categoria "cliente"
    const wpUrl = `${WP_API_URL}/wp/v2/posts?per_page=100&search=cliente&context=${Object.keys(WP_API_HEADERS).length ? 'edit' : 'view'}&status=${Object.keys(WP_API_HEADERS).length ? WP_ALL_STATUSES : 'publish'}`;

    const response = await axios.get(wpUrl, { headers: WP_API_HEADERS });
    const clientes = response.data.map(post => ({
      id: post.id,
      nome: post.title.rendered,
      descricao: post.content.rendered,
      data_criacao: post.date,
      link: post.link
    }));

    console.log(`✅ ${clientes.length} clientes sincronizados do WordPress`);
    res.json({
      success: true,
      count: clientes.length,
      clientes
    });
  } catch (error) {
    console.error('❌ Erro ao sincronizar clientes:', error.message);
    res.status(500).json({ 
      error: error.message
    });
  }
});

// Endpoint de sincronização automática (chamada periodicamente)
app.post('/api/sync/trigger', (req, res) => {
  const token = req.body?.token;
  const secret = process.env.SYNC_SECRET || '';

  if (secret && token !== secret) {
    return res.status(403).json({ error: 'Token inválido' });
  }

  console.log('⏰ Sincronização manual acionada');
  res.json({ 
    success: true, 
    message: 'Sincronização em progresso',
    endpoints: [
      '/api/sync/wordpress/fichas',
      '/api/sync/wordpress/clientes',
      '/api/sync/wordpress/test'
    ]
  });
});

// ============================================
// 🛠️ REPARAÇÃO TEMPORÁRIA DE ESTADOS (fichas/clientes perdidos na migração)
// ============================================
// A migração original para `fichas`/`clients` gravou `post_status`/`estado`
// como 'publish' em todas as linhas, perdendo o estado real (pending/trash/
// draft) que ainda existe em `wp_posts` (post_type 'fichas'/'clientes'). Este
// par de endpoints compara as duas fontes e corrige/recupera o que falta.
// Uso previsto: correr uma vez o /preview para confirmar o que vai mudar, e
// depois o POST para aplicar. Remover depois de usado.

const checkRepairSecret = (req, res) => {
  const secret = process.env.SYNC_SECRET || '';
  const token = (req.body?.token || req.query?.token || '').toString();
  if (secret && token !== secret) {
    res.status(403).json({ error: 'Token inválido' });
    return false;
  }
  return true;
};

const buildRepairPlan = (callback) => {
  db.query(
    `SELECT ID, post_title, post_status, post_author, post_date
     FROM wp_posts WHERE post_type = 'fichas' AND post_status IN ('pending', 'trash')`,
    (errF, wpFichas) => {
      if (errF) return callback(errF);

      db.query(
        `SELECT ID, post_title, post_status, post_author, post_date
         FROM wp_posts WHERE post_type = 'clientes' AND post_status IN ('trash', 'draft')`,
        (errC, wpClientes) => {
          if (errC) return callback(errC);

          db.query('SELECT legacy_id, post_status FROM fichas WHERE legacy_id IS NOT NULL', (errFT, fichasRows) => {
            if (errFT) return callback(errFT);

            db.query('SELECT legacy_id, estado FROM clients WHERE legacy_id IS NOT NULL', (errCT, clientsRows) => {
              if (errCT) return callback(errCT);

              const fichasByLegacy = new Map(fichasRows.map((r) => [Number(r.legacy_id), (r.post_status || '').toLowerCase()]));
              const clientsByLegacy = new Map(clientsRows.map((r) => [Number(r.legacy_id), (r.estado || '').toLowerCase()]));

              const fichasToUpdate = [];
              const fichasToInsert = [];
              (wpFichas || []).forEach((row) => {
                const id = Number(row.ID);
                if (fichasByLegacy.has(id)) {
                  if (fichasByLegacy.get(id) === 'publish' && row.post_status !== 'publish') {
                    fichasToUpdate.push({ legacy_id: id, post_status: row.post_status, title: row.post_title });
                  }
                } else {
                  fichasToInsert.push({
                    legacy_id: id,
                    title: row.post_title || 'Sem título',
                    post_status: row.post_status,
                    author: row.post_author ? String(row.post_author) : '',
                    post_date: row.post_date
                  });
                }
              });

              const clientesToUpdate = [];
              const clientesToInsert = [];
              (wpClientes || []).forEach((row) => {
                const id = Number(row.ID);
                if (clientsByLegacy.has(id)) {
                  if (clientsByLegacy.get(id) === 'publish' && row.post_status !== 'publish') {
                    clientesToUpdate.push({ legacy_id: id, estado: row.post_status, title: row.post_title });
                  }
                } else {
                  clientesToInsert.push({
                    legacy_id: id,
                    denominacao_fiscal: row.post_title || 'Sem nome',
                    estado: row.post_status,
                    author: row.post_author ? String(row.post_author) : '',
                    publicado_em: row.post_date
                  });
                }
              });

              callback(null, { fichasToUpdate, fichasToInsert, clientesToUpdate, clientesToInsert });
            });
          });
        }
      );
    }
  );
};

// GET /api/admin/reparar-estados/preview?token=... - simulação, não escreve nada
app.get('/api/admin/reparar-estados/preview', (req, res) => {
  if (!checkRepairSecret(req, res)) return;
  buildRepairPlan((err, plan) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      resumo: {
        fichas_a_corrigir: plan.fichasToUpdate.length,
        fichas_a_recuperar: plan.fichasToInsert.length,
        clientes_a_corrigir: plan.clientesToUpdate.length,
        clientes_a_recuperar: plan.clientesToInsert.length
      },
      detalhe: plan
    });
  });
});

// POST /api/admin/reparar-estados - aplica as correções/recuperações
app.post('/api/admin/reparar-estados', (req, res) => {
  if (!checkRepairSecret(req, res)) return;

  buildRepairPlan((err, plan) => {
    if (err) return res.status(500).json({ error: err.message });

    const tasks = [];

    plan.fichasToUpdate.forEach((item) => {
      tasks.push((cb) => db.query('UPDATE fichas SET post_status = ? WHERE legacy_id = ?', [item.post_status, item.legacy_id], cb));
    });
    plan.fichasToInsert.forEach((item) => {
      tasks.push((cb) => db.query(
        'INSERT INTO fichas (legacy_id, title, post_status, author, data_contacto, post_date, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [item.legacy_id, item.title, item.post_status, item.author, item.post_date, item.post_date],
        cb
      ));
    });
    plan.clientesToUpdate.forEach((item) => {
      tasks.push((cb) => db.query('UPDATE clients SET estado = ? WHERE legacy_id = ?', [item.estado, item.legacy_id], cb));
    });
    plan.clientesToInsert.forEach((item) => {
      tasks.push((cb) => db.query(
        'INSERT INTO clients (legacy_id, denominacao_fiscal, estado, author, publicado_em, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [item.legacy_id, item.denominacao_fiscal, item.estado, item.author, item.publicado_em],
        cb
      ));
    });

    const errors = [];
    let index = 0;
    const runNext = () => {
      if (index >= tasks.length) {
        return res.json({
          success: true,
          erros: errors,
          resumo: {
            fichas_corrigidas: plan.fichasToUpdate.length,
            fichas_recuperadas: plan.fichasToInsert.length,
            clientes_corrigidos: plan.clientesToUpdate.length,
            clientes_recuperados: plan.clientesToInsert.length,
            falhas: errors.length
          }
        });
      }
      const task = tasks[index];
      index += 1;
      task((taskErr) => {
        if (taskErr) errors.push(taskErr.message);
        runNext();
      });
    };
    runNext();
  });
});

// ============================================
// 🔄 NOVOS ENDPOINTS DE SINCRONIZAÇÃO
// ============================================

// Iniciar sincronização automática
app.post('/api/sync/start', (req, res) => {
  if (syncService.isRunning) {
    return res.json({ 
      success: true, 
      message: 'Sincronização já está a correr'
    });
  }

  syncService.start();
  res.json({ 
    success: true, 
    message: 'Sincronização iniciada',
    interval: syncService.syncInterval
  });
});

// Parar sincronização automática
app.post('/api/sync/stop', (req, res) => {
  syncService.stop();
  res.json({ 
    success: true, 
    message: 'Sincronização parada'
  });
});

// Sincronizar agora (força uma sincronização imediata)
app.post('/api/sync/now', async (req, res) => {
  try {
    await syncService.syncAll();
    res.json({ 
      success: true, 
      message: 'Sincronização completa'
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// Obter status da sincronização
app.get('/api/sync/status', (req, res) => {
  const status = syncService.getStatus();
  res.json({
    success: true,
    ...status
  });
});

// Webhook do WordPress - recebe notificações de mudanças
app.post('/api/sync/webhook', async (req, res) => {
  const { type, data, secret } = req.body;
  const webhookSecret = process.env.WEBHOOK_SECRET || '';

  // Validar token de segurança
  if (webhookSecret && secret !== webhookSecret) {
    console.warn('⚠️  Webhook com token inválido recebido');
    return res.status(403).json({ error: 'Token inválido' });
  }

  console.log(`📬 Webhook recebido: ${type}`);

  try {
    await syncService.handleWebhook({ type, data });
    res.json({ 
      success: true, 
      message: 'Webhook processado'
    });
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error.message);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

// Setup: criar primeiro utilizador admin (só funciona se não existir nenhum admin)
app.post('/api/setup/admin', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email e password são obrigatórios' });
  }
  db.query('SELECT COUNT(*) AS cnt FROM users WHERE role = ?', ['admin'], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows[0].cnt > 0) {
      return res.status(403).json({ error: 'Já existe um administrador. Endpoint desativado.' });
    }
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hash, 'admin'],
      (insertErr, result) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.json({ success: true, id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: 'admin' });
      }
    );
  });
});

// ============================================
// 🧪 DIAGNÓSTICO TEMPORÁRIO — remover depois de resolver a ligação à BD
// Testa conectividade MySQL isoladamente, sem tocar na ligação principal.
// ============================================
app.get('/api/db-test', (req, res) => {
  const expectedSecret = process.env.DB_TEST_SECRET || '';
  const providedSecret = (req.query.secret || req.headers['x-db-test-secret'] || '').toString();

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Não autorizado' });
  }

  const testHost = process.env.DB_HOST || 'localhost';
  const testPort = Number(process.env.DB_PORT) || 3306;
  const testUser = process.env.DB_USER || 'root';
  const testPassword = process.env.DB_PASS || process.env.DB_PASSWORD || '';
  const testDatabase = process.env.DB_NAME || 'wp_migracion';

  const startedAt = Date.now();
  const testConn = mysql.createConnection({
    host: testHost,
    port: testPort,
    user: testUser,
    password: testPassword,
    database: testDatabase,
    connectTimeout: 10000
  });

  let responded = false;
  const finish = (payload) => {
    if (responded) return;
    responded = true;
    try { testConn.destroy(); } catch (e) {}
    res.json(payload);
  };

  const safetyTimer = setTimeout(() => {
    finish({
      success: false,
      reason: 'timeout',
      message: 'Sem resposta em 10s (timeout de segurança do endpoint)',
      host: testHost,
      port: testPort,
      database: testDatabase,
      durationMs: Date.now() - startedAt
    });
  }, 10500);

  const classifyError = (err) => {
    if (err.code === 'ETIMEDOUT' || err.code === 'PROTOCOL_SEQUENCE_TIMEOUT') return 'timeout';
    if (err.code === 'ECONNREFUSED') return 'connection_refused';
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return 'dns';
    if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_DBACCESS_DENIED_ERROR') return 'auth';
    if (err.code === 'ER_BAD_DB_ERROR') return 'database_not_found';
    return 'other';
  };

  testConn.connect((err) => {
    if (err) {
      clearTimeout(safetyTimer);
      return finish({
        success: false,
        reason: classifyError(err),
        code: err.code || null,
        message: err.message || 'Erro desconhecido',
        host: testHost,
        port: testPort,
        database: testDatabase,
        durationMs: Date.now() - startedAt
      });
    }

    testConn.query('SELECT 1', (queryErr) => {
      clearTimeout(safetyTimer);
      if (queryErr) {
        return finish({
          success: false,
          reason: 'query_failed',
          code: queryErr.code || null,
          message: queryErr.message,
          host: testHost,
          port: testPort,
          database: testDatabase,
          durationMs: Date.now() - startedAt
        });
      }

      finish({
        success: true,
        message: 'Ligação e SELECT 1 bem sucedidos',
        host: testHost,
        port: testPort,
        database: testDatabase,
        durationMs: Date.now() - startedAt
      });
    });
  });
});

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  db.query('SELECT 1', (err) => {
    if (err) {
      return res.status(503).json({ status: 'error', db: err.message });
    }
    res.json({ status: 'ok' });
  });
});

const PORT = process.env.PORT || 3001;
// ============================================
// 🚀 INICIALIZAR SINCRONIZAÇÃO E SERVIDOR
// ============================================

// Criar instância do serviço de sincronização
const syncService = new SyncService(
  db,
  process.env.WP_API_URL,
  parseInt(process.env.SYNC_INTERVAL || '60000', 10) // 1 minuto por padrão
);

// Iniciar sincronização automática se WP_API_URL estiver configurada
if (process.env.WP_API_URL) {
  console.log('🔄 Ativando sincronização automática com WordPress');
  syncService.start();
} else {
  console.log('⚠️  WP_API_URL não configurada - sincronização desativada');
}

const server = app.listen(PORT, () => {
  console.log(`🚀 API: http://localhost:${PORT}`);
  console.log(`📋 http://localhost:${PORT}/api/fichas`);
  console.log(`👥 http://localhost:${PORT}/api/clientes`);
  console.log(`📄 http://localhost:${PORT}/api/paginas`);
  console.log(`🙍 http://localhost:${PORT}/api/perfil?login=<user_or_email>`);
  if (WP_API_URL) {
    console.log(`🔄 🔗 http://localhost:${PORT}/api/sync/wordpress/fichas (Sync)`);
    console.log(`🧪 🔗 http://localhost:${PORT}/api/sync/wordpress/test (Teste WP)`);
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ A porta ${PORT} já está em uso. Já existe outra instância do backend a correr.`);
    console.error('   Se quiseres reiniciar esta instância, termina primeiro o processo que está a usar a porta 3001.');
    process.exit(1);
  }

  throw error;
});
