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
    
    console.log('📋 Adicionando coluna updated_at à tabela fichas...');
    
    // Verificar se a coluna já existe
    const hasColumn = (await q(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fichas' AND COLUMN_NAME = 'updated_at'`
    ))[0].cnt;
    
    if (hasColumn > 0) {
      console.log('✅ Coluna updated_at já existe em fichas');
    } else {
      await q(`ALTER TABLE fichas ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
      console.log('✅ Coluna updated_at adicionada com sucesso');
    }
    
    console.log('\n📋 Verificando estrutura final da tabela fichas:');
    const schema = await q(`DESC fichas`);
    const hasUpdatedAt = schema.some(col => col.Field === 'updated_at');
    console.log(hasUpdatedAt ? '✅ updated_at presente' : '❌ updated_at não encontrada');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
