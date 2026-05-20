const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  console.log(`\n🔍 Verificando BD: ${process.env.DB_NAME}\n`);

  // Listar todas as tabelas
  const [tables] = await connection.query('SHOW TABLES');
  console.log(`📋 Tabelas encontradas (${tables.length}):`);
  tables.forEach((row, i) => {
    const tableName = row[Object.keys(row)[0]];
    console.log(`  ${i + 1}. ${tableName}`);
  });

  console.log('\n---\n');

  // Contar registos nas tabelas principais
  const mainTables = ['fichas', 'clientes', 'clients', 'pages', 'paginas', 'users', 'wp_posts'];
  
  for (const table of mainTables) {
    try {
      const [result] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result[0].count;
      console.log(`✅ ${table}: ${count} registos`);
    } catch (e) {
      console.log(`❌ ${table}: não encontrada`);
    }
  }

  await connection.end();
}

checkDatabase().catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
