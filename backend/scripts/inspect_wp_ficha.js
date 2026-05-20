const axios = require('axios');

const WP_API = 'https://sdm.celeuma.pt/wp-json';

(async () => {
  try {
    console.log('🔍 Buscando estrutura de uma ficha do WordPress...\n');
    
    const response = await axios.get(`${WP_API}/wp/v2/fichas?per_page=1`);
    if (response.data && response.data.length > 0) {
      const ficha = response.data[0];
      console.log('📝 Campos disponíveis numa ficha do WP:');
      console.log(JSON.stringify(ficha, null, 2));
    } else {
      console.log('❌ Nenhuma ficha encontrada');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
