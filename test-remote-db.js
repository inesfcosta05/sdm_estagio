const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: '94.46.168.3',
      user: 'celeuma_estag',
      password: '&PjBZHGA#U%C',
      database: 'celeuma_novosdm',
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0
    });

    console.log('✅ Conexão bem-sucedida!');

    // Obter lista de tabelas
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()"
    );

    console.log(`\n📊 Número de tabelas: ${tables.length}`);
    console.log('\n📋 Tabelas encontradas:');
    tables.forEach((table, idx) => {
      console.log(`  ${idx + 1}. ${table.TABLE_NAME}`);
    });

    // Verificar dados em tabelas principais
    console.log('\n📈 Contagem de registos:');
    
    const mainTables = ['fichas', 'clientes', 'users', 'wp_posts'];
    for (const tableName of mainTables) {
      try {
        const [result] = await connection.execute(
          `SELECT COUNT(*) as cnt FROM \`${tableName}\``
        );
        console.log(`  ${tableName}: ${result[0].cnt} registos`);
      } catch (e) {
        console.log(`  ${tableName}: tabela não existe ou erro ao ler`);
      }
    }

    await connection.end();
    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    process.exit(1);
  }
}

testConnection();
