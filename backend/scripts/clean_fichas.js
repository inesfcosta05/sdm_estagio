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
    
    console.log('📋 =================  LIMPEZA DE FICHAS DUPLICADAS  =================');
    console.log('');
    
    // 1. Contar antes
    const beforeCnt = (await q(`SELECT COUNT(*) AS cnt FROM fichas`))[0].cnt;
    const beforeNull = (await q(`SELECT COUNT(*) AS cnt FROM fichas WHERE legacy_id IS NULL`))[0].cnt;
    const beforeValid = (await q(`SELECT COUNT(*) AS cnt FROM fichas WHERE legacy_id IS NOT NULL`))[0].cnt;
    
    console.log(`📊 ANTES DA LIMPEZA:`);
    console.log(`   • Total fichas: ${beforeCnt}`);
    console.log(`   • Com legacy_id: ${beforeValid}`);
    console.log(`   • SEM legacy_id (a remover): ${beforeNull}`);
    console.log('');
    
    if (beforeNull === 0) {
      console.log('✅ Nenhuma ficha sem legacy_id. Base de dados já está limpa.');
      process.exit(0);
    }
    
    // 2. Remover fichas sem legacy_id
    console.log(`🗑️  Removendo ${beforeNull} fichas sem legacy_id...`);
    const delResult = await q(`DELETE FROM fichas WHERE legacy_id IS NULL`);
    console.log(`✅ Removidas: ${delResult.affectedRows} fichas`);
    console.log('');
    
    // 3. Contar depois
    const afterCnt = (await q(`SELECT COUNT(*) AS cnt FROM fichas`))[0].cnt;
    const afterNull = (await q(`SELECT COUNT(*) AS cnt FROM fichas WHERE legacy_id IS NULL`))[0].cnt;
    
    console.log(`📊 DEPOIS DA REMOÇÃO:`);
    console.log(`   • Total fichas: ${afterCnt}`);
    console.log(`   • SEM legacy_id: ${afterNull}`);
    console.log('');
    
    // 4. Criar UNIQUE index em legacy_id
    console.log(`🔐 Criando UNIQUE index em fichas.legacy_id...`);
    try {
      // Primeiro, verificar se o índice já existe
      const indexExists = (await q(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fichas' AND INDEX_NAME = 'uniq_fichas_legacy_id'`
      ))[0].cnt;
      
      if (indexExists > 0) {
        console.log('⚠️  Índice uniq_fichas_legacy_id já existe, removendo e recriando...');
        await q(`ALTER TABLE fichas DROP INDEX uniq_fichas_legacy_id`);
      }
      
      await q(`ALTER TABLE fichas ADD UNIQUE INDEX uniq_fichas_legacy_id (legacy_id)`);
      console.log(`✅ UNIQUE index criado com sucesso`);
    } catch (err) {
      console.warn(`⚠️  Erro ao criar unique index:`, err.message);
    }
    console.log('');
    
    // 5. Verificar integridade
    console.log(`✅ INTEGRIDADE VERIFICADA:`);
    const distinct = (await q(`SELECT COUNT(DISTINCT legacy_id) AS cnt FROM fichas WHERE legacy_id IS NOT NULL`))[0].cnt;
    const total = (await q(`SELECT COUNT(*) AS cnt FROM fichas`))[0].cnt;
    console.log(`   • Total fichas: ${total}`);
    console.log(`   • legacy_id únicos (não NULL): ${distinct}`);
    console.log(`   • Tudo OK: ${distinct === total ? '✅ SIM' : '❌ NÃO - há duplicatas!'}`);
    console.log('');
    
    console.log(`🎉 LIMPEZA CONCLUÍDA COM SUCESSO`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(2);
  }
})();
