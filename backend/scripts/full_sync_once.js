const mysql = require('mysql2');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const SyncService = require('../sync-service');

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wp_migracion'
});

function q(sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

(async () => {
  try {
    db.connect();

    const syncService = new SyncService(
      db,
      process.env.WP_API_URL,
      parseInt(process.env.SYNC_INTERVAL || '60000', 10)
    );

    console.log('🔄 Iniciando reconciliação única com WordPress...');
    await syncService.syncAll();

    const fichas = await q('SELECT COUNT(*) AS cnt FROM fichas');
    const clientes = await q('SELECT COUNT(*) AS cnt FROM clients');
    const pages = await q("SELECT COUNT(*) AS cnt FROM wp_posts WHERE post_type = 'page'");

    console.log('');
    console.log('📊 Contagens locais após sync:');
    console.log(`Fichas: ${fichas[0].cnt}`);
    console.log(`Clientes: ${clientes[0].cnt}`);
    console.log(`Páginas: ${pages[0].cnt}`);
    console.log('');

    await new Promise((resolve, reject) => db.end((err) => (err ? reject(err) : resolve())));
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(2);
  }
})();
