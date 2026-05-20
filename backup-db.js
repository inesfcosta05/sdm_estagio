#!/usr/bin/env node

/**
 * Script para fazer dump da base de dados MySQL
 * Uso: node backup-db.js
 */

require('dotenv').config({
  path: require('path').resolve(__dirname, 'backend', '.env')
});

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'wp_migracion'
    });

    console.log('🔗 Conectado à base de dados:', process.env.DB_NAME);

    // Obter lista de tabelas
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`
    );

    let sqlContent = `-- ============================================\n`;
    sqlContent += `-- DUMP DA BASE DE DADOS: ${process.env.DB_NAME}\n`;
    sqlContent += `-- Data: ${new Date().toLocaleString()}\n`;
    sqlContent += `-- Host: ${process.env.DB_HOST}\n`;
    sqlContent += `-- ============================================\n\n`;

    // Percorrer cada tabela
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      console.log(`📋 Processando tabela: ${tableName}`);

      // Obter CREATE TABLE
      const [createTableRows] = await connection.execute(
        `SHOW CREATE TABLE \`${tableName}\``
      );
      sqlContent += `\n-- ============================================\n`;
      sqlContent += `-- Tabela: ${tableName}\n`;
      sqlContent += `-- ============================================\n`;
      sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlContent += createTableRows[0]['Create Table'] + ';\n\n';

      // Obter dados
      const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const columnNames = columns.map(c => `\`${c}\``).join(', ');
        
        for (const row of rows) {
          const values = columns.map(col => {
            let val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') {
              return `'${val.replace(/'/g, "''")}'`;
            }
            if (val instanceof Date) {
              if (isNaN(val.getTime())) return 'NULL';
              return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }
            if (typeof val === 'number') return val.toString();
            if (typeof val === 'boolean') return val ? '1' : '0';
            if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
            return `'${String(val).replace(/'/g, "''")}'`;
          }).join(', ');
          
          sqlContent += `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${values});\n`;
        }
      }
      
      sqlContent += '\n';
    }

    // Salvar arquivo
    const outputPath = path.join(__dirname, 'wp_migracion_dump.sql');
    fs.writeFileSync(outputPath, sqlContent, 'utf8');
    
    console.log(`\n✅ Dump criado com sucesso: ${outputPath}`);
    console.log(`📊 Tamanho do arquivo: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    console.log(`📦 Número de tabelas: ${tables.length}`);

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao fazer backup:', error.message);
    process.exit(1);
  }
}

backupDatabase();
