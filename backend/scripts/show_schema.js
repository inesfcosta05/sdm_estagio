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
    
    console.log('📋 ESTRUTURA DAS TABELAS:\n');
    
    // Fichas
    console.log('📝 Tabela: fichas');
    const fichasSchema = await q(`DESC fichas`);
    console.table(fichasSchema);
    
    // Clients
    console.log('\n👥 Tabela: clients');
    const clientsSchema = await q(`DESC clients`);
    console.table(clientsSchema);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
