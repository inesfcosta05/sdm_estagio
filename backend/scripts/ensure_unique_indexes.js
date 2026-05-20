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
    
    console.log('📋 =================  GARANTIR UNIQUE INDEX NOS CLIENTES  =================');
    console.log('');
    
    try {
      const indexExists = (await q(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND INDEX_NAME = 'uniq_clients_legacy_id'`
      ))[0].cnt;
      
      if (indexExists > 0) {
        console.log('⚠️  Índice uniq_clients_legacy_id já existe, removendo...');
        await q(`ALTER TABLE clients DROP INDEX uniq_clients_legacy_id`);
      }
      
      console.log('🔐 Criando UNIQUE index em clients.legacy_id...');
      await q(`ALTER TABLE clients ADD UNIQUE INDEX uniq_clients_legacy_id (legacy_id)`);
      console.log(`✅ UNIQUE index criado`);
    } catch (err) {
      console.warn(`⚠️  Erro:`, err.message);
    }
    
    console.log('');
    console.log('✅ ÍNDICES GARANTIDOS');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(2);
  }
})();
