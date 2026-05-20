const mysql = require('mysql2');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wp_migracion'
});

function q(sql, params=[]) { return new Promise((r, rej) => db.query(sql, params, (e, res) => e ? rej(e) : r(res))); }

(async () => {
  try {
    db.connect();
    const cnt = (await q(`SELECT COUNT(*) AS cnt FROM fichas WHERE legacy_id IS NOT NULL`))[0].cnt;
    console.log('Rows with legacy_id IS NOT NULL:', cnt);
    const samples = await q(`SELECT id, legacy_id, title, data_contacto FROM fichas WHERE legacy_id IS NOT NULL ORDER BY id DESC LIMIT 20`);
    console.log('Sample rows with legacy_id (id, legacy_id, title, data_contacto):');
    console.table(samples);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();