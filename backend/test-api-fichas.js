const http = require('http');

console.log('🔍 Testando endpoint /api/fichas...\n');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/fichas',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('✅ Resposta recebida com sucesso!');
      console.log(`📊 Tipo de dados: ${typeof parsed}`);
      
      if (Array.isArray(parsed)) {
        console.log(`📈 Número de fichas: ${parsed.length}`);
        if (parsed.length > 0) {
          console.log(`\n🎯 Primeira ficha:`);
          console.log(JSON.stringify(parsed[0], null, 2).substring(0, 500));
        }
      } else if (parsed.error) {
        console.log(`❌ Erro da API: ${parsed.error}`);
      } else {
        console.log(`\n📄 Estrutura:`);
        console.log(JSON.stringify(parsed, null, 2).substring(0, 500));
      }
    } catch (e) {
      console.log('📋 Resposta raw (primeiros 300 chars):');
      console.log(data.substring(0, 300));
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Erro de conexão: ${e.message}`);
});

req.end();
