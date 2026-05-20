const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    const [rows] = await conn.execute('SELECT post_status, COUNT(1) as cnt FROM fichas GROUP BY post_status');
    console.log('\n📊 Distribuição de post_status nas fichas:');
    rows.forEach(r => console.log(`   ${r.post_status}: ${r.cnt}`));
    
    await conn.end();
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
})();
