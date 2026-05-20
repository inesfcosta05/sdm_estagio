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
    
    // Atualiza 5 fichas para trash
    await conn.execute('UPDATE fichas SET post_status = ? WHERE id < 6 LIMIT 5', ['trash']);
    console.log('✅ 5 fichas atualizadas para trash');
    
    // Atualiza 5 fichas para pending
    await conn.execute('UPDATE fichas SET post_status = ? WHERE id BETWEEN 6 AND 10 LIMIT 5', ['pending']);
    console.log('✅ 5 fichas atualizadas para pending');
    
    // Verifica distribuição
    const [rows] = await conn.execute('SELECT post_status, COUNT(1) as cnt FROM fichas GROUP BY post_status');
    console.log('\n📊 Nova distribuição de post_status:');
    rows.forEach(r => console.log(`   ${r.post_status}: ${r.cnt}`));
    
    await conn.end();
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
})();
