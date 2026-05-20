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

function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

async function fetchAllClientIds() {
  const ids = [];
  let page = 1;

  while (true) {
    const response = await axios.get(`${WP_API}/wp/v2/clientes?per_page=100&page=${page}`, {
      timeout: 15000,
      validateStatus: () => true
    });

    if (response.status !== 200 || !Array.isArray(response.data) || response.data.length === 0) {
      break;
    }

    for (const item of response.data) {
      ids.push(Number(item.id));
    }

    page += 1;
  }

  return ids;
}

(async () => {
  try {
    db.connect();

    const localBefore = (await q('SELECT COUNT(*) AS cnt FROM clients'))[0].cnt;
    const localLegacyBefore = (await q('SELECT COUNT(*) AS cnt FROM clients WHERE legacy_id IS NOT NULL'))[0].cnt;
    console.log(`Local clients before: ${localBefore}`);
    console.log(`Local clients with legacy_id: ${localLegacyBefore}`);

    const wpIds = await fetchAllClientIds();
    console.log(`WordPress clients fetched: ${wpIds.length}`);

    const idList = wpIds.join(',');
    const deleteSql = idList
      ? `DELETE FROM clients WHERE legacy_id IS NOT NULL AND legacy_id NOT IN (${idList})`
      : 'DELETE FROM clients WHERE 1=1';

    const result = await q(deleteSql);
    console.log(`Deleted orphan clients: ${result.affectedRows || 0}`);

    const localAfter = (await q('SELECT COUNT(*) AS cnt FROM clients'))[0].cnt;
    const localLegacyAfter = (await q('SELECT COUNT(*) AS cnt FROM clients WHERE legacy_id IS NOT NULL'))[0].cnt;
    console.log(`Local clients after: ${localAfter}`);
    console.log(`Local clients with legacy_id after: ${localLegacyAfter}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(2);
  }
})();