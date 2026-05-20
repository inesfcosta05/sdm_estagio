const axios = require('axios');

const WP_API = 'https://sdm.celeuma.pt/wp-json';

(async () => {
  try {
    console.log('🔍 Verificando endpoints disponíveis no WordPress...\n');
    
    // 1. Tentar GET com _fields para expandir resposta
    console.log('1️⃣  Tentando endpoint com _fields=*...');
    try {
      const resp1 = await axios.get(`${WP_API}/wp/v2/fichas/5630?_fields=*`, { timeout: 5000 });
      console.log('✅ Resposta com _fields=*:');
      console.log(JSON.stringify(resp1.data, null, 2));
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
    
    // 2. Tentar ACF endpoint
    console.log('\n\n2️⃣  Tentando ACF endpoint...');
    try {
      const resp2 = await axios.get(`${WP_API}/acf/v3/fichas/5630`, { timeout: 5000 });
      console.log('✅ ACF data:');
      console.log(JSON.stringify(resp2.data, null, 2));
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
    
    // 3. Verificar se há custom REST routes
    console.log('\n\n3️⃣  Listando namespaces disponíveis...');
    try {
      const resp3 = await axios.get(`${WP_API}/`, { timeout: 5000 });
      console.log('Namespaces:');
      console.log(resp3.data.namespaces);
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
