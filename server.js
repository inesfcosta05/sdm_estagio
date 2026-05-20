require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
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

app.get('/api/fichas', (req, res) => {
  db.query('SELECT * FROM fichas ORDER BY data_contacto DESC LIMIT 20', 
    (err, results) => res.json(results));
});

// GET perfil
app.get('/api/perfil', (req, res) => {
  const login = req.query.login;
  if (!login) return res.status(400).json({ error: 'login required' });
  db.query(
    'SELECT id, name AS username, email, nome, apelido, alcunha, nome_mostrado AS displayName, bio, site_url AS site, role, imagem_url FROM users WHERE name = ? OR email = ? LIMIT 1',
    [login, login],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!results.length) return res.status(404).json({ error: 'not found' });
      res.json(results[0]);
    }
  );
});

// PUT perfil
app.put('/api/perfil', (req, res) => {
  const { login, nome, apelido, alcunha, displayName, bio, site } = req.body;
  console.log('PUT /api/perfil body:', req.body);
  if (!login) return res.status(400).json({ error: 'login required' });
  db.query(
    `UPDATE users SET nome = ?, apelido = ?, alcunha = ?, nome_mostrado = ?, bio = ?, site_url = ?, updated_at = NOW()
     WHERE name = ? OR email = ?`,
    [nome || '', apelido || '', alcunha || '', displayName || '', bio || '', site || '', login, login],
    (err, result) => {
      if (err) { console.error('PUT perfil DB error:', err); return res.status(500).json({ error: err.message }); }
      console.log('PUT perfil result:', result);
      res.json({ success: true, affectedRows: result.affectedRows });
    }
  );
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`🚀 API em http://localhost:${PORT}`));
