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
    this.lastSyncComplete = {};
    this.lastError = null;
    this.lastFetchStats = {};
    this.isRunning = false;
    this.isSyncing = false;
  }

  // Counts how many fetched items carry each post_status, so we can see (via
  // logs / getStatus()) exactly what WordPress sent this cycle — without that,
  // "pendentes/lixo still show 0" is ambiguous between "WP has none right now"
  // and "we're failing to write/count what WP sent".
  static statusBreakdown(items) {
    const counts = {};
    items.forEach((item) => {
      const status = (item.status || 'publish').toString();
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
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

  // WordPress's REST API treats `status=any` as a shorthand for every status
  // EXCEPT 'trash' (trash is intentionally hidden from "any" for safety) — so
  // fetching trashed items requires asking for every native post_status by
  // name, explicitly including 'trash'. Deliberately limited to the 4 states
  // this app actually models (publicado/pendente/rascunho/lixo) — 'future'
  // and 'private' aren't used anywhere in the UI, and trimming them out
  // narrows the surface for whatever is rejecting the request with a 400.
  static ALL_NATIVE_STATUSES = 'publish,pending,draft,trash';

  /**
   * Fetches a WP collection across every native post_status (publish, pending,
   * draft, trash) when authenticated. Returns `{ items, complete }` —
   * `complete` is false whenever we fell back to an unauthenticated,
   * publish-only fetch, so callers know NOT to treat that partial result as
   * the full picture (e.g. never delete local rows just because they're
   * missing from a publish-only snapshot).
   */
  async fetchWordPressCollection(resourcePath) {
    let lastFailure = null;

    const collect = async (useEditContext) => {
      const itemsById = new Map();
      const queryParts = [
        'per_page=100',
        `context=${useEditContext ? 'edit' : 'view'}`
      ];

      queryParts.push(useEditContext ? `status=${SyncService.ALL_NATIVE_STATUSES}` : 'status=publish');

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const separator = resourcePath.includes('?') ? '&' : '?';
        const endpoint = `${resourcePath}${separator}${queryParts.join('&')}&page=${page}`;
        const wpResponse = await this.getFromWordPressResponse(endpoint);

        if (wpResponse.status === 400 || wpResponse.status === 404) {
          if (page === 1) {
            lastFailure = { endpoint, status: wpResponse.status, body: wpResponse.data };
            return null;
          }

          break;
        }

        if (wpResponse.status !== 200) {
          lastFailure = { endpoint, status: wpResponse.status, body: wpResponse.data };
          return null;
        }

        const wpData = wpResponse.data;

        if (!Array.isArray(wpData)) {
          lastFailure = { endpoint, status: wpResponse.status, body: wpData };
          return null;
        }

        if (wpData.length === 0) {
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
    };

    const preferEdit = this.hasWordPressAuth();
    const primary = await collect(preferEdit);
    if (primary !== null) {
      if (preferEdit) this.lastError = null;
      return { items: primary, complete: preferEdit };
    }

    if (preferEdit) {
      console.warn(
        '⚠️  Autenticação/pedido WordPress falhou — a sincronizar apenas conteúdo publicado. Rascunhos/pendentes/lixo não serão tocados nesta sincronização (não vão ser apagados nem atualizados) até isto ser corrigido.',
        lastFailure ? { endpoint: lastFailure.endpoint, status: lastFailure.status, wpError: lastFailure.body } : ''
      );
      this.lastError = lastFailure;
      const fallback = await collect(false);
      return { items: fallback || [], complete: false };
    }

    return { items: [], complete: false };
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
    if (this.isSyncing) {
      console.log('⚠️  Sincronização já em execução - ignorando ciclo sobreposto');
      return;
    }

    this.isSyncing = true;
    try {
      console.log(`⏱️  Sincronização iniciada às ${new Date().toLocaleTimeString('pt-PT')}`);
      
      await Promise.all([
        this.syncFichas(),
        this.syncClients(),
        this.syncPages()
      ]);
      
      console.log(`✅ Sincronização completa às ${new Date().toLocaleTimeString('pt-PT')}`);
    } catch (error) {
      console.error('❌ Erro geral de sincronização:', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pods relationship fields aren't part of the WP core REST schema, so their
   * exact shape depends on how the "cliente" field is configured to appear in
   * the REST response (a bare ID, an array of IDs, or an array of nested
   * objects with an `id`/`ID` key). Try every shape we've seen Pods use and
   * take the first thing that looks like a real post ID.
   */
  extractClientLegacyId(ficha) {
    const candidates = [
      ficha.cliente,
      ficha.client,
      ficha.fields?.cliente,
      ficha.pods?.cliente,
      ficha.acf?.cliente,
      ficha.meta?.cliente
    ];

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === '') continue;
      const value = Array.isArray(candidate) ? candidate[0] : candidate;
      if (value === undefined || value === null) continue;
      const id = typeof value === 'object' ? (value.id ?? value.ID) : value;
      const num = Number(id);
      if (Number.isFinite(num) && num > 0) return num;
    }

    return null;
  }

  /**
   * 📋 Sincronizar FICHAS com PAGINAÇÃO
   */
  async syncFichas() {
    try {
      const { items: allFichas, complete } = await this.fetchWordPressCollection('/wp/v2/fichas');

      if (allFichas.length === 0) {
        console.log('ℹ️  Nenhuma ficha encontrada no WordPress');
        return;
      }

      console.log(`📝 Sincronizando ${allFichas.length} fichas...`);

      const statusBreakdown = SyncService.statusBreakdown(allFichas);
      this.lastFetchStats.fichas = statusBreakdown;
      console.log('  📊 Estados recebidos do WordPress:', JSON.stringify(statusBreakdown));

      // One-time visibility into the raw shape WordPress sends for the
      // "cliente" relationship, so we can confirm/adjust extractClientLegacyId
      // above if this WP install exposes it differently than expected.
      const sample = allFichas[0];
      console.log('  🔍 Amostra de campos da 1ª ficha:', Object.keys(sample).join(', '));
      console.log('  🔍 Amostra de relação "cliente":', JSON.stringify(sample.cliente ?? sample.client ?? sample.fields?.cliente ?? null));

      for (const ficha of allFichas) {
        const clientLegacyId = this.extractClientLegacyId(ficha);

        await new Promise((resolve, reject) => {
          this.localDb.query(
            `INSERT INTO fichas (
              legacy_id, client_legacy_id, title, post_date, post_status, post_visibility, author
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              client_legacy_id = COALESCE(VALUES(client_legacy_id), client_legacy_id),
              title = VALUES(title),
              post_date = VALUES(post_date),
              post_status = VALUES(post_status),
              post_visibility = VALUES(post_visibility),
              author = VALUES(author),
              updated_at = NOW()`,
            [
              ficha.id,
              clientLegacyId,
              ficha.title?.rendered || ficha.title || 'Sem título',
              ficha.date_gmt || ficha.date || ficha.modified_gmt || ficha.modified,
              ficha.status || 'publish',
              'public',
              ficha.author || null
            ],
            (err) => {
              if (err) {
                console.warn(`  ⚠️  Erro ao inserir ficha ${ficha.id}:`, err.message);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });
      }

      // Only delete local rows that vanished from WordPress when we're sure we
      // saw every native status (including trash) — a degraded/publish-only
      // fetch must never be mistaken for "these other rows no longer exist".
      if (!complete) {
        console.warn('⚠️  A saltar a limpeza de fichas órfãs: a sincronização não teve acesso autenticado a todos os estados nesta ronda.');
      } else {
        const wpFichaIds = new Set(allFichas.map((ficha) => Number(ficha.id)));
        const localFichaRows = await new Promise((resolve, reject) => {
          this.localDb.query(
            'SELECT id, legacy_id FROM fichas WHERE legacy_id IS NOT NULL',
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        const orphanFichaIds = localFichaRows
          .filter((row) => !wpFichaIds.has(Number(row.legacy_id)))
          .map((row) => row.id);

        if (orphanFichaIds.length > 0) {
          await new Promise((resolve, reject) => {
            this.localDb.query(
              `DELETE FROM fichas WHERE id IN (${orphanFichaIds.map(() => '?').join(', ')})`,
              orphanFichaIds,
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          console.log(`🧹 Removidas ${orphanFichaIds.length} fichas órfãs`);
        }
      }

      this.lastSync.fichas = new Date();
      this.lastSyncComplete.fichas = complete;
      console.log(`✅ ${allFichas.length} fichas sincronizadas`);
    } catch (error) {
      console.error('❌ Erro ao sincronizar fichas:', error.message);
    }
  }

  /**
   * 👥 Sincronizar CLIENTES com PAGINAÇÃO
   */
  async syncClients() {
    try {
      const { items: allClients, complete } = await this.fetchWordPressCollection('/wp/v2/clientes');

      if (allClients.length === 0) {
        console.log('ℹ️  Nenhum cliente encontrado');
        return;
      }

      console.log(`👥 Sincronizando ${allClients.length} clientes...`);

      const statusBreakdown = SyncService.statusBreakdown(allClients);
      this.lastFetchStats.clients = statusBreakdown;
      console.log('  📊 Estados recebidos do WordPress:', JSON.stringify(statusBreakdown));

      for (const client of allClients) {
        await new Promise((resolve, reject) => {
          this.localDb.query(
            `INSERT INTO clients (
              legacy_id, denominacao_fiscal, contacto_empresa, author, estado, visibilidade, publicado_em, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
              denominacao_fiscal = VALUES(denominacao_fiscal),
              contacto_empresa = VALUES(contacto_empresa),
              author = VALUES(author),
              estado = VALUES(estado),
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
              client.date_gmt || client.date || null
            ],
            (err) => {
              if (err) {
                console.warn(`  ⚠️  Erro ao inserir cliente ${client.id}:`, err.message);
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });
      }

      if (!complete) {
        console.warn('⚠️  A saltar a limpeza de clientes órfãos: a sincronização não teve acesso autenticado a todos os estados nesta ronda.');
      } else {
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
      }

      this.lastSync.clients = new Date();
      this.lastSyncComplete.clients = complete;
      console.log(`✅ ${allClients.length} clientes sincronizados`);
    } catch (error) {
      console.error('❌ Erro ao sincronizar clientes:', error.message);
    }
  }

  /**
   * 📄 Sincronizar PÁGINAS com PAGINAÇÃO
   */
  async syncPages() {
    try {
      const { items: allPages, complete } = await this.fetchWordPressCollection('/wp/v2/pages');

      if (allPages.length === 0) {
        console.log('ℹ️  Nenhuma página encontrada');
        return;
      }

      console.log(`📄 Sincronizando ${allPages.length} páginas...`);

      const statusBreakdown = SyncService.statusBreakdown(allPages);
      this.lastFetchStats.pages = statusBreakdown;
      console.log('  📊 Estados recebidos do WordPress:', JSON.stringify(statusBreakdown));

      for (const page of allPages) {
        await new Promise((resolve, reject) => {
          this.localDb.query(
            `INSERT INTO wp_posts (
              ID, post_author, post_date, post_date_gmt, post_content, post_title,
              post_status, post_name, post_modified, post_modified_gmt, post_parent,
              menu_order, post_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              post_author = VALUES(post_author),
              post_date = VALUES(post_date),
              post_date_gmt = VALUES(post_date_gmt),
              post_content = VALUES(post_content),
              post_title = VALUES(post_title),
              post_status = VALUES(post_status),
              post_modified = VALUES(post_modified),
              post_modified_gmt = VALUES(post_modified_gmt),
              post_parent = VALUES(post_parent),
              menu_order = VALUES(menu_order),
              post_type = VALUES(post_type)`,
            [
              page.id,
              Number(page.author) || 1,
              page.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
              page.date_gmt || page.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
              page.content?.rendered || '',
              page.title?.rendered || page.title || 'Sem título',
              page.status || 'publish',
              page.slug || `page-${page.id}`,
              page.modified || page.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
              page.modified_gmt || page.modified || page.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
              Number(page.parent) || 0,
              Number(page.menu_order) || 0,
              'page'
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      if (!complete) {
        console.warn('⚠️  A saltar a limpeza de páginas órfãs: a sincronização não teve acesso autenticado a todos os estados nesta ronda.');
      } else {
        const wpPageIds = new Set(allPages.map((page) => Number(page.id)));
        const localPageRows = await new Promise((resolve, reject) => {
          this.localDb.query(
            `SELECT ID FROM wp_posts WHERE post_type = 'page'`,
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        const orphanPageIds = localPageRows
          .map((row) => Number(row.ID))
          .filter((id) => !wpPageIds.has(id));

        if (orphanPageIds.length > 0) {
          await new Promise((resolve, reject) => {
            this.localDb.query(
              `DELETE FROM wp_posts WHERE ID IN (${orphanPageIds.map(() => '?').join(', ')}) AND post_type = 'page'`,
              orphanPageIds,
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          console.log(`🧹 Removidas ${orphanPageIds.length} páginas órfãs`);
        }
      }

      this.lastSync.pages = new Date();
      this.lastSyncComplete.pages = complete;
      console.log(`✅ ${allPages.length} páginas sincronizadas`);
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
        const response = await this.getFromWordPressResponse(`/wp/v2/users?per_page=100&page=${page}`);

        if (response.status === 400 || response.status === 404) {
          if (page === 1) {
            break;
          }

          break;
        }

        if (response.status !== 200) {
          break;
        }

        const wpData = response.data;

        if (!Array.isArray(wpData) || wpData.length === 0) {
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
    const response = await this.getFromWordPressResponse(endpoint);

    if (response.status !== 200) {
      console.log(`  ⚠️  API respondeu com status ${response.status}`);
      return null;
    }

    return response.data;
  }

  async getFromWordPressResponse(endpoint) {
    try {
      const url = `${this.wpApiUrl}${endpoint}`;
      console.log(`  🔗 Fetching: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true, // Não falhar em 404
        headers: this.getWordPressAuthHeaders()
      });

      if (response.status !== 200) {
        // WordPress's error body (code/message/data.params) is the whole
        // point — it's what tells us WHY (invalid param, missing capability,
        // forbidden status, ...) instead of just "something went wrong".
        console.log(`  ⚠️  API respondeu com status ${response.status}:`, JSON.stringify(response.data));
      }

      return { status: response.status, data: response.data };
    } catch (error) {
      console.error(`  ❌ Erro ao aceder WordPress (${endpoint}):`, error.message);
      return { status: 0, data: null };
    }
  }

  /**
   * 📊 Obter status da sincronização
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      // true = essa sincronização viu todos os estados nativos (autenticada);
      // false = caiu para o modo sem autenticação (só publicados, sem apagar órfãos).
      lastSyncComplete: this.lastSyncComplete,
      // Detalhe do último pedido autenticado que falhou (endpoint, status HTTP,
      // corpo do erro devolvido pelo WordPress) — null se o último pedido correu bem.
      lastError: this.lastError,
      // Contagem por post_status do que o WordPress devolveu na última sincronização
      // completa de cada recurso — ex: { fichas: { publish: 100, pending: 15, trash: 2 } }.
      lastFetchStats: this.lastFetchStats,
      hasWordPressAuth: this.hasWordPressAuth(),
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
