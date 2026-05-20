const mysql = require('mysql2');

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wp_migracion',
  multipleStatements: true
});

function query(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

async function tableHasColumn(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows && rows[0] && rows[0].cnt > 0;
}

async function dedupeByLegacy(table) {
  console.log(`\n--- Dedupe for table: ${table}`);
  const hasLegacy = await tableHasColumn(table, 'legacy_id');
  if (!hasLegacy) {
    console.log(`  ✖ Column legacy_id not found on ${table}, skipping`);
    return;
  }

  const totalBefore = (await query(`SELECT COUNT(*) AS cnt FROM ${table}`))[0].cnt;
  const distinctLegacy = (await query(`SELECT COUNT(DISTINCT legacy_id) AS cnt FROM ${table} WHERE legacy_id IS NOT NULL`))[0].cnt;
  const duplicates = (await query(`SELECT COUNT(*) AS dup_count FROM (SELECT legacy_id FROM ${table} WHERE legacy_id IS NOT NULL GROUP BY legacy_id HAVING COUNT(*) > 1) t`))[0].dup_count;

  console.log(`  Rows before: ${totalBefore}`);
  console.log(`  Distinct legacy_id (non-null): ${distinctLegacy}`);
  console.log(`  Duplicate legacy_id groups: ${duplicates}`);

  if (duplicates === 0) {
    console.log('  ✓ No duplicate legacy_id groups found');
  } else {
    console.log('  ➜ Removing duplicates (keeping highest id per legacy_id)...');
    // Keep the row with the highest id (assumed latest)
    const delSql = `DELETE t1 FROM ${table} t1 INNER JOIN ${table} t2 ON t1.legacy_id = t2.legacy_id WHERE t1.id < t2.id AND t1.legacy_id IS NOT NULL`;
    const result = await query(delSql);
    console.log(`  Deleted rows: ${result.affectedRows || 0}`);

    const totalAfter = (await query(`SELECT COUNT(*) AS cnt FROM ${table}`))[0].cnt;
    console.log(`  Rows after: ${totalAfter}`);

    // Try to add unique index on legacy_id
    try {
      console.log('  ➜ Adding UNIQUE index on legacy_id');
      await query(`ALTER TABLE ${table} ADD UNIQUE INDEX uniq_${table}_legacy_id (legacy_id)`);
      console.log('  ✓ Unique index created');
    } catch (err) {
      console.warn('  ⚠️ Could not create unique index:', err.message);
    }
  }
}

async function run() {
  try {
    db.connect((err) => {
      if (err) {
        console.error('❌ DB connect error:', err.message);
        process.exit(1);
      }
    });

    await dedupeByLegacy('clients');
    await dedupeByLegacy('fichas');

    console.log('\n✅ Dedupe script finished');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error in dedupe script:', err.message);
    process.exit(2);
  }
}

run();
