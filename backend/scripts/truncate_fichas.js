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
    
    console.log('📋 LIMPEZA COMPLETA - Removendo TODAS as fichas e reiniciando...\n');
    
    const before = (await q(`SELECT COUNT(*) AS cnt FROM fichas`))[0].cnt;
    console.log(`Fichas antes: ${before}`);
    
    await q(`TRUNCATE TABLE fichas`);
    
    const after = (await q(`SELECT COUNT(*) AS cnt FROM fichas`))[0].cnt;
    console.log(`Fichas depois: ${after}`);
    console.log('\n✅ Tabela fichas limpa - próximo passo: fazer sync completo do WordPress');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
