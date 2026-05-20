const express = require('express');
const mysql = require('mysql2');
require('dotenv').config({ path: './backend/.env' });

const app = express();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wp_migracion',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

console.log(`🔌 Conectando a: ${process.env.DB_HOST}/${process.env.DB_NAME}\n`);

// Verificar tabelas
db.query('SHOW TABLES', (err, tables) => {
  if (err) {
    console.error('❌ Erro ao conectar:', err.message);
  } else {
    console.log(`✅ Conectado com sucesso! ${tables.length} tabelas encontradas:\n`);
    tables.forEach((row, i) => {
      const tableName = row[Object.keys(row)[0]];
      console.log(`  ${i + 1}. ${tableName}`);
    });
    
    console.log('\n📊 Contagem de registos principais:\n');
    
    // Contar fichas
    db.query('SELECT COUNT(*) as count FROM fichas', (err, res) => {
      if (err) {
        console.log('❌ fichas:', err.message);
      } else {
        console.log(`✅ fichas: ${res[0].count} registos`);
      }
      
      // Contar clientes
      db.query('SELECT COUNT(*) as count FROM clients', (err, res) => {
        if (err) {
          console.log('❌ clients:', err.message);
        } else {
          console.log(`✅ clients: ${res[0].count} registos`);
        }
        
        // Contar páginas
        db.query('SELECT COUNT(*) as count FROM wp_posts WHERE post_type="page"', (err, res) => {
          if (err) {
            console.log('❌ wp_posts (pages):', err.message);
          } else {
            console.log(`✅ wp_posts (pages): ${res[0].count} registos`);
          }
          
          console.log('\n✅ Diagnóstico completo!');
          db.end();
          process.exit(0);
        });
      });
    });
  }
});
