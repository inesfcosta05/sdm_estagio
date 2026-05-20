require('dotenv').config({
  path: require('path').resolve(__dirname, '.env')
});

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const SyncService = require('./sync-service');

const app = express();
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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
      if (!origin || allowedOrigins.includes(origin) || isDevLocalOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  })
);
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wp_migracion'
});

db.connect(err => {
  if (err) { console.error('❌ MYSQL FALHOU:', err.message); return; }
  console.log('✅ MySQL OK!');
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
app.get('/api/fichas', (req, res) => {
  console.log('📋 Fichas pedidas');
  db.query('SELECT * FROM fichas ORDER BY data_contacto DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    console.log(`✅ ${results.length} fichas`);
    res.json(results);
  });
});

app.get('/api/fichas/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de ficha inválido' });
  }

  db.query('SELECT * FROM fichas WHERE id = ? OR legacy_id = ? LIMIT 1', [id, id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ficha não encontrada' });
    return res.json(rows[0]);
  });
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

// CLIENTES ✅ **CORRIGIDO** - SÓ tabela real
app.get('/api/clientes', (req, res) => {
  console.log('👥 Clientes pedidos - TENTANDO TABELA clients...');
  
  db.query('SHOW COLUMNS FROM clients', (err, colunas) => {
    if (err) {
      console.error('❌ Tabela clients NÃO EXISTE');
      return res.status(500).json({ error: 'Tabela clients não encontrada' });
    }
    
    console.log(`✅ Tabela clients OK - ${colunas.length} colunas`);
    
    db.query('SELECT * FROM clients ORDER BY COALESCE(publicado_em, created_at, updated_at) DESC, legacy_id DESC', (err2, results) => {
      if (err2) {
        console.error('❌ ERRO clients:', err2.message);
        return res.status(500).json({ error: err2.message });
      }
      
      console.log(`✅ ${results.length} CLIENTES REAIS com TODOS campos`);
      console.log('📋 Campos:', Object.keys(results[0] || {}));
      res.json(results);
    });
  });
});

// GET /api/clientes/:id - obter cliente por id
app.get('/api/clientes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID de cliente inválido' });
  }

  db.query('SELECT * FROM clients WHERE id = ? OR legacy_id = ? LIMIT 1', [id, id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json(rows[0]);
  });
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

            const fromClients = (fallbackRows || []).map((f, idx) => ({
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
    (body.nif || '').toString().trim(),
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
      nif,
      comercial_id,
      author,
      estado,
      visibilidade,
      senha_visibilidade,
      publicado_em,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
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
    nif,
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

  if (typeof nif === 'string') {
    updates.push('nif = ?');
    values.push(nif.trim());
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
    WHERE post_type = 'page' AND post_status IN ('publish', 'draft')
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
  const estado = estadoRaw === 'publish' || estadoRaw === 'publicado' ? 'publish' : 'draft';
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

// PERFIL UTILIZADOR (tabela users)
app.get('/api/perfil', (req, res) => {
  const login = (req.query.login || '').toString().trim();
  if (!login) {
    return res.status(400).json({ error: 'Parametro login em falta' });
  }

  // Verificar que colunas existem na tabela users
  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
    (colErr, colRows) => {
      if (colErr) return res.status(500).json({ error: colErr.message });

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
          console.error('GET perfil DB error:', userErr.message);
          return res.status(500).json({ error: userErr.message });
        }

        if (!users || users.length === 0) {
          return res.status(404).json({ error: 'Utilizador nao encontrado' });
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
    const wpUrl = `${WP_API_URL}/wp/v2/posts?per_page=100&context=${Object.keys(WP_API_HEADERS).length ? 'edit' : 'view'}&status=${Object.keys(WP_API_HEADERS).length ? 'any' : 'publish'}`;
    
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
    const wpUrl = `${WP_API_URL}/wp/v2/posts?per_page=100&search=cliente&context=${Object.keys(WP_API_HEADERS).length ? 'edit' : 'view'}&status=${Object.keys(WP_API_HEADERS).length ? 'any' : 'publish'}`;
    
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
