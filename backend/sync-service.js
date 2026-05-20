/**
 * 🔄 SERVIÇO DE SINCRONIZAÇÃO
 * Sincroniza dados entre WordPress (online) e BD local
 * 
 * Funcionalidades:
 * - Polling periódico de mudanças
 * - Webhooks do WordPress (quando implementados)
 * - Cache de timestamps para detectar alterações
 * - Logging de sincronizações
 */

const axios = require('axios');
const mysql = require('mysql2');

class SyncService {
  constructor(localDb, wpApiUrl, syncInterval = 5 * 60 * 1000) {
    this.localDb = localDb;
    this.wpApiUrl = wpApiUrl || process.env.WP_API_URL || 'https://sdm.celeuma.pt/wp-json';
    this.syncInterval = syncInterval; // 5 minutos por padrão
    this.lastSync = {};
    this.isRunning = false;
  }

  getWordPressAuthHeaders() {
    const username = (process.env.WP_API_USER || '').trim();
    const password = (process.env.WP_API_PASS || '').trim();

    if (!username || !password) {
      return {};
    }

    return {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    };
  }

  hasWordPressAuth() {
    return Object.keys(this.getWordPressAuthHeaders()).length > 0;
  }

  async fetchWordPressCollection(resourcePath) {
    const itemsById = new Map();

    const useEditContext = this.hasWordPressAuth();
    const queryParts = [
      'per_page=100',
      `context=${useEditContext ? 'edit' : 'view'}`
    ];

    if (useEditContext) {
      queryParts.push('status=any');
    } else {
      queryParts.push('status=publish');
    }

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const separator = resourcePath.includes('?') ? '&' : '?';
      const endpoint = `${resourcePath}${separator}${queryParts.join('&')}&page=${page}`;
      const wpData = await this.getFromWordPress(endpoint);

      if (!Array.isArray(wpData) || wpData.length === 0) {
        hasMore = false;
        break;
      }

      wpData.forEach((item) => {
        if (item && item.id !== undefined && item.id !== null && !itemsById.has(item.id)) {
          itemsById.set(item.id, item);
        }
      });

      page++;
    }

    return [...itemsById.values()];
  }

  /**
   * 🚀 Iniciar sincronização automática
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Sincronização já está a correr');
      return;
    }
    
    this.isRunning = true;
    console.log(`🔄 Iniciando sincronização cada ${this.syncInterval / 1000}s`);
    
    // Sincronização imediata
    this.syncAll().catch(e => console.error('❌ Erro na primeira sincronização:', e.message));
    
    // Sincronização periódica
    this.syncInterval = setInterval(() => {
      this.syncAll().catch(e => console.error('❌ Erro na sincronização periódica:', e.message));
    }, this.syncInterval);
  }

  /**
   * ⏹️ Parar sincronização
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('⏹️  Sincronização parada');
    }
  }

  /**
   * 🔄 Sincronizar TUDO
   */
  async syncAll() {
    try {
      console.log(`⏱️  Sincronização iniciada às ${new Date().toLocaleTimeString('pt-PT')}`);
      
      await Promise.all([
        this.syncFichas(),
        this.syncClients()
      ]);
      
      console.log(`✅ Sincronização completa às ${new Date().toLocaleTimeString('pt-PT')}`);
    } catch (error) {
      console.error('❌ Erro geral de sincronização:', error.message);
    }
  }

  /**
   * 📋 Sincronizar FICHAS com PAGINAÇÃO
   */
  async syncFichas() {
    try {
      const allFichas = await this.fetchWordPressCollection('/wp/v2/fichas');
      const canReadAllStatuses = this.hasWordPressAuth();

      if (!canReadAllStatuses) {
        console.log('ℹ️  Sync sem credenciais WP: apenas fichas publicadas podem ser lidas da API.');
      }

      if (allFichas.length === 0) {
        console.log('ℹ️  Nenhuma ficha encontrada no WordPress');
        return;
      }

      const changed = allFichas.filter(ficha => {
        const lastModified = new Date(ficha.modified || ficha.date);
        return !this.lastSync.fichas || lastModified > this.lastSync.fichas;
      });

      if (changed.length === 0) {
        console.log(`✓ Fichas sem alterações (${allFichas.length} existentes)`);
        this.lastSync.fichas = new Date();
        return;
      }

      console.log(`📝 Atualizando ${changed.length} de ${allFichas.length} fichas...`);

      for (const ficha of changed) {
        await new Promise((resolve, reject) => {
          const statusUpdateClause = canReadAllStatuses
            ? 'post_status = VALUES(post_status),'
            : `post_status = CASE
                WHEN post_status IN ('pending', 'trash', 'draft', 'private') THEN post_status
                ELSE VALUES(post_status)
              END,`;

          this.localDb.query(
            `INSERT INTO fichas (
              legacy_id, title, post_date, post_status, post_visibility, author
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              title = VALUES(title),
              post_date = VALUES(post_date),
              ${statusUpdateClause}
              post_visibility = VALUES(post_visibility),
              author = VALUES(author),
              updated_at = NOW()`,
            [
              ficha.id,
              ficha.title?.rendered || ficha.title || 'Sem título',
              ficha.date || ficha.modified,
              ficha.status || 'publish',
              'public',
              ficha.author || null
            ],
            (err) => {
              if (err) {
                console.warn(`  ⚠️  Erro ao inserir ficha ${ficha.id}:`, err.message);
                resolve();
              } else {
                resolve();
              }
            }
          );
        });
      }

      this.lastSync.fichas = new Date();
      console.log(`✅ ${changed.length} fichas sincronizadas`);
    } catch (error) {
      console.error('❌ Erro ao sincronizar fichas:', error.message);
    }
  }

  /**
   * 👥 Sincronizar CLIENTES com PAGINAÇÃO
   */
  async syncClients() {
    try {
      const allClients = await this.fetchWordPressCollection('/wp/v2/clientes');
      const canReadAllStatuses = this.hasWordPressAuth();

      if (!canReadAllStatuses) {
        console.log('ℹ️  Sync sem credenciais WP: apenas clientes publicados podem ser lidos da API.');
      }

      if (allClients.length === 0) {
        console.log('ℹ️  Nenhum cliente encontrado');
        return;
      }

      const changed = allClients.filter(client => {
        const lastModified = new Date(client.modified || client.date);
        return !this.lastSync.clients || lastModified > this.lastSync.clients;
      });

      if (changed.length === 0) {
        console.log(`✓ Clientes sem alterações (${allClients.length} existentes)`);
        this.lastSync.clients = new Date();
        return;
      }

      console.log(`👥 Atualizando ${changed.length} de ${allClients.length} clientes...`);

      for (const client of changed) {
        await new Promise((resolve, reject) => {
          const statusUpdateClause = canReadAllStatuses
            ? 'estado = VALUES(estado),'
            : `estado = CASE
                WHEN estado IN ('pending', 'trash', 'draft', 'private') THEN estado
                ELSE VALUES(estado)
              END,`;

          this.localDb.query(
            `INSERT INTO clients (
              legacy_id, denominacao_fiscal, contacto_empresa, author, estado, visibilidade, publicado_em, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              denominacao_fiscal = VALUES(denominacao_fiscal),
              contacto_empresa = VALUES(contacto_empresa),
              author = VALUES(author),
              ${statusUpdateClause}
              visibilidade = VALUES(visibilidade),
              publicado_em = VALUES(publicado_em),
              updated_at = NOW()`,
            [
              client.id,
              client.title?.rendered || client.title || 'Sem nome',
              '',
              client.author || null,
              client.status || 'publish',
              'public',
              client.date || null
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      const wpClientIds = new Set(allClients.map((client) => Number(client.id)));
      const localClientRows = await new Promise((resolve, reject) => {
        this.localDb.query(
          'SELECT id, legacy_id FROM clients WHERE legacy_id IS NOT NULL',
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const orphanClientIds = localClientRows
        .filter((row) => !wpClientIds.has(Number(row.legacy_id)))
        .map((row) => row.id);

      if (orphanClientIds.length > 0) {
        await new Promise((resolve, reject) => {
          this.localDb.query(
            `DELETE FROM clients WHERE id IN (${orphanClientIds.map(() => '?').join(', ')})`,
            orphanClientIds,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        console.log(`🧹 Removidos ${orphanClientIds.length} clientes órfãos`);
      }

      this.lastSync.clients = new Date();
      console.log(`✅ ${changed.length} clientes sincronizados`);
    } catch (error) {
      console.error('❌ Erro ao sincronizar clientes:', error.message);
    }
  }

  /**
   * 📄 Sincronizar PÁGINAS com PAGINAÇÃO
   */
  async syncPages() {
    try {
      const allPages = await this.fetchWordPressCollection('/wp/v2/pages', ['publish', 'pending', 'draft', 'private']);

      if (allPages.length === 0) {
        console.log('ℹ️  Nenhuma página encontrada');
        return;
      }

      const changed = allPages.filter(page => {
        const lastModified = new Date(page.modified || page.date);
        return !this.lastSync.pages || lastModified > this.lastSync.pages;
      });

      if (changed.length === 0) {
        console.log(`✓ Páginas sem alterações (${allPages.length} existentes)`);
        this.lastSync.pages = new Date();
        return;
      }

      console.log(`📄 Atualizando ${changed.length} de ${allPages.length} páginas...`);

      for (const page of changed) {
        await new Promise((resolve, reject) => {
          this.localDb.query(
            `INSERT INTO paginas (
              id, title, content, post_date, post_status
            ) VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              title = VALUES(title),
              content = VALUES(content),
              post_date = VALUES(post_date),
              post_status = VALUES(post_status)`,
            [
              page.id,
              page.title?.rendered || page.title || 'Sem título',
              page.content?.rendered || '',
              page.date,
              page.status
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      this.lastSync.pages = new Date();
      console.log(`✅ ${changed.length} páginas sincronizadas`);
    } catch (error) {
      console.error('❌ Erro ao sincronizar páginas:', error.message);
    }
  }

  /**
   * 👤 Sincronizar UTILIZADORES
   */
  async syncUsers() {
    try {
      let allUsers = [];
      let page = 1;
      let hasMore = true;

      // Buscar todas as páginas de utilizadores
      while (hasMore) {
        const wpData = await this.getFromWordPress(`/wp/v2/users?per_page=100&page=${page}`);
        if (!wpData || wpData.length === 0) {
          hasMore = false;
          break;
        }
        allUsers = allUsers.concat(wpData);
        page++;
      }

      if (allUsers.length === 0) {
        console.log('ℹ️  Nenhum utilizador encontrado');
        return;
      }

      console.log(`👤 Atualizando ${allUsers.length} utilizadores...`);

      for (const user of allUsers) {
        await new Promise((resolve, reject) => {
          this.localDb.query(
            `INSERT INTO users (
              id, name, email, role
            ) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              email = VALUES(email),
              role = VALUES(role)`,
            [
              user.id,
              user.name,
              user.email,
              user.roles?.[0] || 'editor'
            ],
            (err) => {
              if (err) {
                console.warn(`  ⚠️  Erro ao inserir utilizador ${user.name}:`, err.message);
                resolve();
              } else {
                resolve();
              }
            }
          );
        });
      }

      this.lastSync.users = new Date();
      console.log(`✅ ${allUsers.length} utilizadores sincronizados`);
    } catch (error) {
      console.error('❌ Erro ao sincronizar utilizadores:', error.message);
    }
  }

  /**
   * 🌐 Fazer GET ao WordPress via REST API
   */
  async getFromWordPress(endpoint) {
    try {
      const url = `${this.wpApiUrl}${endpoint}`;
      console.log(`  🔗 Fetching: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true, // Não falhar em 404
        headers: this.getWordPressAuthHeaders()
      });

      if (response.status !== 200) {
        console.log(`  ⚠️  API respondeu com status ${response.status}`);
        return null;
      }

      return response.data;
    } catch (error) {
      console.error(`  ❌ Erro ao aceder WordPress (${endpoint}):`, error.message);
      return null;
    }
  }

  /**
   * 📊 Obter status da sincronização
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      wpUrl: this.wpApiUrl
    };
  }

  /**
   * 🔌 Webhook do WordPress - chamado quando há mudanças
   * Implementar no WordPress: adicionar webhook em wp-admin que chama este endpoint
   */
  async handleWebhook(data) {
    console.log('🎯 Webhook recebido:', data.type);
    
    try {
      switch (data.type) {
        case 'ficha.created':
        case 'ficha.updated':
          await this.syncFichas();
          break;
        case 'client.created':
        case 'client.updated':
          await this.syncClients();
          break;
        case 'page.created':
        case 'page.updated':
          await this.syncPages();
          break;
        default:
          console.log('⚠️  Tipo de webhook desconhecido:', data.type);
      }
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error.message);
    }
  }
}

module.exports = SyncService;
