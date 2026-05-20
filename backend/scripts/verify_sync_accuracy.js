const mysql = require('mysql2');
const axios = require('axios');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wp_migracion'
});

const WP_API = process.env.WP_API_URL || 'https://sdm.celeuma.pt/wp-json';

function q(sql, params=[]) { return new Promise((r, rej) => db.query(sql, params, (e, res) => e ? rej(e) : r(res))); }

(async () => {
  try {
    db.connect();
    
    console.log('🔍 VALIDAÇÃO: Comparando dados locais com WordPress');
    console.log('');
    
    // 1. Verificar fichas
    const localFichas = (await q(`SELECT id, legacy_id, title FROM fichas ORDER BY RAND() LIMIT 5`));
    console.log('📝 Amostra de Fichas Locais:');
    console.table(localFichas);
    
    // 2. Verificar uma ficha no WP
    if (localFichas.length > 0) {
      const sample = localFichas[0];
      try {
        const wpFicha = await axios.get(`${WP_API}/wp/v2/fichas/${sample.legacy_id}`);
        console.log('\n✅ Ficha encontrada no WordPress:');
        console.log(`   Local ID: ${sample.id}`);
        console.log(`   Legacy ID (WP): ${sample.legacy_id}`);
        console.log(`   Título Local: ${sample.title}`);
        console.log(`   Título WP: ${wpFicha.data.title?.rendered || wpFicha.data.title}`);
      } catch (err) {
        console.log(`❌ Erro ao buscar ficha no WP: ${err.message}`);
      }
    }
    
    // 3. Verificar clientes
    const localClientes = (await q(`SELECT id, legacy_id, denominacao_fiscal FROM clients ORDER BY RAND() LIMIT 5`));
    console.log('\n👥 Amostra de Clientes Locais:');
    console.table(localClientes);
    
    // 4. Verificar um cliente no WP
    if (localClientes.length > 0) {
      const sample = localClientes[0];
      try {
        const wpCliente = await axios.get(`${WP_API}/wp/v2/clientes/${sample.legacy_id}`);
        console.log('\n✅ Cliente encontrado no WordPress:');
        console.log(`   Local ID: ${sample.id}`);
        console.log(`   Legacy ID (WP): ${sample.legacy_id}`);
        console.log(`   Nome Local: ${sample.denominacao_fiscal}`);
        console.log(`   Nome WP: ${wpCliente.data.title?.rendered || wpCliente.data.title}`);
      } catch (err) {
        console.log(`❌ Erro ao buscar cliente no WP: ${err.message}`);
      }
    }
    
    console.log('\n✅ VALIDAÇÃO COMPLETA');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();
