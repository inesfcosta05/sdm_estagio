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
    
    const total = (await q(`SELECT COUNT(*) AS cnt FROM clients`))[0].cnt;
    const withLegacy = (await q(`SELECT COUNT(*) AS cnt FROM clients WHERE legacy_id IS NOT NULL`))[0].cnt;
    const withoutLegacy = (await q(`SELECT COUNT(*) AS cnt FROM clients WHERE legacy_id IS NULL`))[0].cnt;
    const distinct = (await q(`SELECT COUNT(DISTINCT legacy_id) AS cnt FROM clients WHERE legacy_id IS NOT NULL`))[0].cnt;
    
    console.log('👥 STATUS DOS CLIENTES:');
    console.log(`   • Total: ${total}`);
    console.log(`   • Com legacy_id: ${withLegacy}`);
    console.log(`   • Sem legacy_id: ${withoutLegacy}`);
    console.log(`   • Distinct legacy_id: ${distinct}`);
    
    if (withoutLegacy > 0) {
      console.log(`\n⚠️  Encontrados ${withoutLegacy} clientes sem legacy_id`);
      const samples = await q(`SELECT id, legacy_id, denominacao_fiscal FROM clients WHERE legacy_id IS NULL LIMIT 10`);
      console.log('Samples:');
      console.table(samples);
    } else {
      console.log('\n✅ Todos os clientes têm legacy_id preenchido');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
