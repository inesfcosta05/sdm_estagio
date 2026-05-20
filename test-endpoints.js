const http = require('http');

const endpoints = ['/api/fichas', '/api/clientes', '/api/paginas'];
let completed = 0;

endpoints.forEach(ep => {
  http.get('http://localhost:3001' + ep, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const count = Array.isArray(parsed) ? parsed.length : (parsed.error ? '❌ erro' : 'OK');
        console.log('✅ ' + ep + ': ' + count);
      } catch (e) {
        console.log('❌ ' + ep + ': erro parse');
      }
      completed++;
      if (completed === endpoints.length) process.exit(0);
    });
  }).on('error', e => {
    console.log('❌ ' + ep + ': ' + e.code);
    completed++;
    if (completed === endpoints.length) process.exit(0);
  });
});

setTimeout(() => {
  console.log('⏱️ Timeout');
  process.exit(1);
}, 5000);
