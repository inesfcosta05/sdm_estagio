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
    
    console.log('📋 Inspecionando dados de uma ficha local:\n');
    
    const ficha = (await q(`SELECT * FROM fichas WHERE legacy_id IS NOT NULL LIMIT 1`))[0];
    
    if (ficha) {
      console.log('Campos preenchidos (não NULL):');
      Object.entries(ficha).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          console.log(`  ${key}: ${String(value).substring(0, 100)}`);
        }
      });
      
      console.log('\n\nTodos os campos:');
      console.log(JSON.stringify(ficha, null, 2));
    } else {
      console.log('❌ Nenhuma ficha encontrada');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
