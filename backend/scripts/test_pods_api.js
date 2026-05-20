const axios = require('axios');

const WP_API = 'https://sdm.celeuma.pt/wp-json';

(async () => {
  try {
    console.log('🔍 Explorando Pods endpoint...\n');
    
    // Tentar /pods/v1/fichas/5630
    console.log('1️⃣  Tentando /pods/v1/fichas/5630...');
    try {
      const resp = await axios.get(`${WP_API}/pods/v1/fichas/5630`, { timeout: 5000 });
      console.log('✅ Pods response:');
      console.log(JSON.stringify(resp.data, null, 2).substring(0, 3000));
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
    
    // Tentar /pods/v1/fichas
    console.log('\n\n2️⃣  Tentando /pods/v1/fichas?limit=1...');
    try {
      const resp = await axios.get(`${WP_API}/pods/v1/fichas?limit=1`, { timeout: 5000 });
      console.log('✅ Pods list response:');
      console.log(JSON.stringify(resp.data, null, 2).substring(0, 3000));
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
