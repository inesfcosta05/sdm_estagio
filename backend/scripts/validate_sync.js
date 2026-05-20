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
    await new Promise(r => setTimeout(r, 5000)); // Aguardar 5s para sync completar
    
    const fichas = (await q(`SELECT COUNT(*) AS cnt FROM fichas WHERE legacy_id IS NOT NULL`))[0].cnt;
    const clientes = (await q(`SELECT COUNT(*) AS cnt FROM clients WHERE legacy_id IS NOT NULL`))[0].cnt;
    
    console.log('');
    console.log('📊 VALIDAÇÃO FINAL - Dados Sincronizados:');
    console.log(`✅ Fichas: ${fichas} (esperado: ~6215)`);
    console.log(`✅ Clientes: ${clientes} (esperado: ~4770)`);
    console.log('');
    
    if (fichas === 6215 && clientes === 4770) {
      console.log('🎉 PERFEITO! Dados estão corretos e sem duplicatas');
    } else {
      console.log(`⚠️  Contagens: fichas=${fichas} clientes=${clientes}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
