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

  /**
   * A cheap connectivity check run before each bulk insert loop
   * (syncFichas/syncClients/syncPages). localDb is expected to be a mysql2
   * pool, so this also doubles as the "reconnect" the caller needs: a pool's
   * `.query()` always hands back a fresh, live connection from the pool
   * rather than reusing one that may have been dropped by the MySQL server's
   * wait_timeout while the (often slow) WordPress fetch was in flight — this
   * is what used to surface deep inside a bulk insert as "Can't add new
   * command when connection is in closed state". Failing fast here, before
   * a single row of the batch is written, avoids a half-applied sync.
   */
  pingLocalDb() {
    return new Promise((resolve, reject) => {
      this.localDb.query('SELECT 1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
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
   * Fetches every page of a WP collection endpoint for a given query-string
   * (already fully built, minus `&page=N`). Returns the item array, or `null`
   * if the request failed (in which case `lastFailureRef.value` is set to the
   * endpoint/status/body for logging).
   */
  async collectRaw(resourcePath, queryParts, lastFailureRef, extraHeaders = {}) {
    const itemsById = new Map();
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const separator = resourcePath.includes('?') ? '&' : '?';
      const endpoint = `${resourcePath}${separator}${queryParts.join('&')}&page=${page}`;
      const wpResponse = await this.getFromWordPressResponse(endpoint, extraHeaders);

      if (wpResponse.status === 400 || wpResponse.status === 401 || wpResponse.status === 403 || wpResponse.status === 404) {
        if (page === 1) {
          lastFailureRef.value = { endpoint, status: wpResponse.status, body: wpResponse.data };
          return null;
        }

        break;
      }

      if (wpResponse.status !== 200) {
        lastFailureRef.value = { endpoint, status: wpResponse.status, body: wpResponse.data };
        return null;
      }

      const wpData = wpResponse.data;

      if (!Array.isArray(wpData)) {
        lastFailureRef.value = { endpoint, status: wpResponse.status, body: wpData };
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
  }

  collectByStatus(resourcePath, status, useEditContext, lastFailureRef) {
    return this.collectRaw(resourcePath, [
      'per_page=100',
      `context=${useEditContext ? 'edit' : 'view'}`,
      `status=${status}`
    ], lastFailureRef);
  }

  /** Same request but with no `status` filter at all — some non-core REST
   * controllers (Pods' own, for example, differs in places from WordPress's
   * built-in `WP_REST_Posts_Controller`) default to showing everything an
   * authenticated request can see rather than defaulting to 'publish'. */
  collectWithoutStatusFilter(resourcePath, useEditContext, lastFailureRef) {
    return this.collectRaw(resourcePath, [
      'per_page=100',
      `context=${useEditContext ? 'edit' : 'view'}`
    ], lastFailureRef);
  }

  // Pods generates its own REST controller for these two CPTs, and on this
  // WordPress install its *listing* behaviour (a request with no `status`
  // query param at all) ignores authentication entirely and always returns
  // only `publish` items, no matter which account/context is used — there is
  // no context/param combination on an unfiltered request that reveals
  // drafts/pending/trash. What DOES work is asking for one explicit
  // `status=X` value at a time: WordPress/Pods honours that per request, so
  // each status has to be fetched individually and merged, rather than
  // relying on a single "give me everything" call.
  static PER_STATUS_ONLY_ROUTES = ['/wp/v2/fichas', '/wp/v2/clientes'];

  hasSyncBypassSecret() {
    return !!(process.env.WP_SYNC_BYPASS_SECRET || '').trim();
  }

  /**
   * Fichas/Clientes are Pods CPTs whose REST permission_callback rejects
   * context=edit and per-status requests down to publish-only for this
   * account — even though the account IS a real WordPress Administrator —
   * because the CPT's registered `capability_type` was never mapped to a
   * capability actually granted to any role. That's a WordPress/Pods
   * configuration problem; no REST query parameter can talk around a
   * permission_callback that checks a specific capability string.
   *
   * The real fix lives in a tiny custom endpoint on the WordPress side (see
   * wordpress-mu-plugin/sdm-sync-bypass.php in this repo) that runs its own
   * WP_Query directly — bypassing Pods' REST controller and its capability
   * check entirely — gated by a shared secret header instead of WordPress
   * capabilities. This is tried FIRST for these two routes; if the secret
   * isn't configured, or the endpoint hasn't been installed on WordPress yet
   * (404), it falls straight through to the per-status strategy below so
   * sync keeps working in the meantime.
   */
  async fetchViaSyncBypass(resourcePath) {
    const secret = (process.env.WP_SYNC_BYPASS_SECRET || '').trim();
    if (!secret) return null;

    const slug = resourcePath.split('/').filter(Boolean).pop();
    const lastFailureRef = { value: null };
    const items = await this.collectRaw(
      `/sdm-sync/v1/${slug}`,
      ['per_page=100'],
      lastFailureRef,
      { 'X-Sdm-Sync-Secret': secret }
    );

    if (items === null) {
      const status = lastFailureRef.value?.status;
      if (status === 404) {
        console.log(`ℹ️  Endpoint de bypass /sdm-sync/v1/${slug} ainda não está instalado no WordPress — a usar a estratégia estado a estado.`);
      } else {
        console.warn(
          `⚠️  Endpoint de bypass /sdm-sync/v1/${slug} falhou (HTTP ${status}) — a usar a estratégia estado a estado.`,
          lastFailureRef.value?.body || ''
        );
      }
      return null;
    }

    this.lastError = null;
    console.log(`✅  ${items.length} itens obtidos via endpoint de bypass /sdm-sync/v1/${slug} (todos os estados, sem restrição do Pods).`);
    return { items, complete: true };
  }

  /**
   * For CPTs where an unfiltered listing silently ignores auth and collapses
   * to publish-only (see PER_STATUS_ONLY_ROUTES above): fetch each native
   * status (publish, pending, draft, trash) with its own explicit
   * `status=X` request and merge the results, instead of trying a single
   * combined or filter-less request.
   *
   * `context=edit` requires a real editing capability up front and 403s
   * (`rest_forbidden_context`) immediately for accounts that only have broad
   * READ access but not full edit rights on this CPT. `context=view`, sent
   * with the exact same Basic Auth header, doesn't carry that extra
   * capability gate, so it's tried first for each status; `edit` is kept as
   * a per-status fallback for the opposite kind of account (edit rights,
   * view refused for some other reason).
   *
   * `complete` is only true when every native status was reachable — same
   * contract as fetchWordPressCollection below — so orphan-deletion is only
   * ever run against a full picture. A lone failure on `trash` specifically
   * is tolerated (logged as info, not a warning) since trash commonly sits
   * behind a stricter capability than editing/viewing, but it still leaves
   * `complete: false` so orphan cleanup stays skipped that round.
   */
  async fetchByIndividualStatuses(resourcePath) {
    const lastFailureRef = { value: null };
    const statuses = SyncService.ALL_NATIVE_STATUSES.split(',');
    const merged = new Map();
    const okStatuses = [];
    const failedStatuses = [];
    const useAuth = this.hasWordPressAuth();

    for (const status of statuses) {
      let result = useAuth ? await this.collectByStatus(resourcePath, status, false, lastFailureRef) : null;
      if (result === null && useAuth) {
        result = await this.collectByStatus(resourcePath, status, true, lastFailureRef);
      }

      if (result === null) {
        failedStatuses.push(status);
        continue;
      }

      okStatuses.push(status);
      result.forEach((item) => merged.set(item.id, item));
    }

    if (okStatuses.length === 0) {
      console.warn(
        `⚠️  Nenhum estado foi acessível individualmente para ${resourcePath} — a sincronizar apenas conteúdo publicado (pedido anónimo). Rascunhos/pendentes/lixo não serão tocados nesta sincronização (não vão ser apagados nem atualizados) até isto ser corrigido.`,
        lastFailureRef.value ? { endpoint: lastFailureRef.value.endpoint, status: lastFailureRef.value.status, wpError: lastFailureRef.value.body } : ''
      );
      this.lastError = lastFailureRef.value;
      const fallback = await this.collectByStatus(resourcePath, 'publish', false, lastFailureRef);
      return { items: fallback || [], complete: false };
    }

    const complete = failedStatuses.length === 0;

    const onlyTrashBlocked = failedStatuses.length === 1
      && failedStatuses[0] === 'trash'
      && lastFailureRef.value
      && [400, 403].includes(lastFailureRef.value.status);

    if (onlyTrashBlocked) {
      this.lastError = null;
      console.log(`ℹ️  Estado "trash" não acessível para esta conta em ${resourcePath} (HTTP ${lastFailureRef.value.status}) — a sincronizar na mesma com publish/pending/draft.`);
    } else {
      this.lastError = complete ? null : lastFailureRef.value;
      console.warn(
        complete
          ? `✅  Todos os estados obtidos com sucesso para ${resourcePath} (pedidos estado a estado).`
          : `⚠️  Estados obtidos para ${resourcePath}: ${okStatuses.join(', ')}. Sem acesso a: ${failedStatuses.join(', ')} (não serão apagados nem atualizados até isto ser corrigido).`
      );
    }

    return { items: [...merged.values()], complete };
  }

  /**
   * Fetches a WP collection across every native post_status (publish, pending,
   * draft, trash) when authenticated. Returns `{ items, complete }` —
   * `complete` is only true when EVERY native status was confirmed reachable,
   * so callers know not to treat a partial result as the full picture (e.g.
   * never delete local rows just because they're missing from an incomplete
   * snapshot).
   *
   * Some WordPress installs grant a role enough capability to see
   * pending/draft posts but not trashed ones (trashing/deleting is commonly
   * gated behind a stricter capability than editing) — so a combined
   * `status=publish,pending,draft,trash` request can come back 400/403 even
   * for a real administrator, purely because ONE of those statuses is
   * forbidden for that account on this custom post type. Rather than
   * collapsing straight to "publish only" in that case, we retry each status
   * on its own and keep whatever the account actually has access to.
   *
   * If EVERY non-publish status is rejected via `context=edit` (this WP
   * install's capability gate for the CPT refuses `edit` context outright,
   * regardless of which status), that's a hard server-side permission wall —
   * no query trick bypasses a real `current_user_can()` check. Still, some
   * Pods-registered post types expose a custom REST controller that doesn't
   * replicate WP core's status-gating exactly, so we try two more things
   * before giving up: the same statuses without `context=edit`, and a request
   * with no `status` filter at all (in case a custom controller defaults to
   * "everything visible to this user" instead of "publish only").
   */
  async fetchWordPressCollection(resourcePath) {
    if (SyncService.PER_STATUS_ONLY_ROUTES.some((route) => resourcePath.startsWith(route))) {
      const viaBypass = await this.fetchViaSyncBypass(resourcePath);
      if (viaBypass !== null) return viaBypass;
      return this.fetchByIndividualStatuses(resourcePath);
    }

    const lastFailureRef = { value: null };
    const preferEdit = this.hasWordPressAuth();

    const combined = await this.collectByStatus(resourcePath, SyncService.ALL_NATIVE_STATUSES, preferEdit, lastFailureRef);
    if (combined !== null) {
      if (preferEdit) this.lastError = null;
      return { items: combined, complete: preferEdit };
    }

    if (!preferEdit) {
      return { items: [], complete: false };
    }

    console.warn(
      '⚠️  Pedido combinado de estados falhou — a tentar cada estado em separado (pode faltar capacidade só para alguns, ex: apagar/lixo).',
      lastFailureRef.value ? { endpoint: lastFailureRef.value.endpoint, status: lastFailureRef.value.status, wpError: lastFailureRef.value.body } : ''
    );

    const statuses = SyncService.ALL_NATIVE_STATUSES.split(',');
    const merged = new Map();
    const okStatuses = [];
    const failedStatuses = [];

    for (const status of statuses) {
      const result = await this.collectByStatus(resourcePath, status, true, lastFailureRef);
      if (result === null) {
        failedStatuses.push(status);
        continue;
      }
      okStatuses.push(status);
      result.forEach((item) => merged.set(item.id, item));
    }

    const nonPublishOk = okStatuses.filter((status) => status !== 'publish');
    const nonPublishFailed = failedStatuses.filter((status) => status !== 'publish');

    // Every non-publish status was rejected via context=edit — this account's
    // capability gate is blocking edit-context on this CPT outright, not just
    // for a specific status. Try the couple of things that could still work
    // on a non-standard REST controller before accepting defeat.
    if (nonPublishOk.length === 0 && nonPublishFailed.length > 0) {
      console.warn(`⚠️  Todos os estados não-publicados foram recusados com context=edit (${nonPublishFailed.join(', ')}) — a tentar contornar.`);

      for (const status of nonPublishFailed) {
        const viaView = await this.collectByStatus(resourcePath, status, false, lastFailureRef);
        if (viaView !== null && viaView.length > 0) {
          viaView.forEach((item) => merged.set(item.id, item));
          if (!okStatuses.includes(status)) okStatuses.push(status);
        }
      }

      if (okStatuses.filter((status) => status !== 'publish').length === 0) {
        const noFilterEdit = await this.collectWithoutStatusFilter(resourcePath, true, lastFailureRef);
        const noFilterView = noFilterEdit === null
          ? await this.collectWithoutStatusFilter(resourcePath, false, lastFailureRef)
          : noFilterEdit;

        if (noFilterView) {
          noFilterView.forEach((item) => {
            merged.set(item.id, item);
            const status = (item.status || 'publish').toString();
            if (status !== 'publish' && !okStatuses.includes(status)) okStatuses.push(status);
          });
        }
      }
    }

    const stillFailed = statuses.filter((status) => !okStatuses.includes(status));

    if (okStatuses.length > 0) {
      const complete = stillFailed.length === 0;

      // "trash" commonly sits behind a stricter WordPress capability than
      // editing/viewing pending or draft content (deleting vs. editing), so a
      // 400/403 specifically for trash — with everything else reachable — is
      // a known, tolerated limitation, not an incident: don't raise it as an
      // error, just note it once and move on with what we could get.
      const onlyTrashBlocked = stillFailed.length === 1
        && stillFailed[0] === 'trash'
        && lastFailureRef.value
        && [400, 403].includes(lastFailureRef.value.status);

      if (onlyTrashBlocked) {
        this.lastError = null;
        console.log(`ℹ️  Estado "trash" não acessível para esta conta (HTTP ${lastFailureRef.value.status}) — a sincronizar na mesma publish/pending/draft normalmente.`);
      } else {
        this.lastError = complete ? null : lastFailureRef.value;
        console.warn(
          complete
            ? '✅  Todos os estados obtidos com sucesso (alguns só depois de contornar o context=edit).'
            : `⚠️  Estados obtidos: ${okStatuses.join(', ')}. Sem acesso a: ${stillFailed.join(', ')} (não serão apagados nem atualizados até isto ser corrigido).`
        );
      }

      return { items: [...merged.values()], complete };
    }

    console.warn(
      '⚠️  Nenhum estado autenticado foi acessível, mesmo depois de contornar o context=edit — a sincronizar apenas conteúdo publicado. Rascunhos/pendentes/lixo não serão tocados nesta sincronização (não vão ser apagados nem atualizados) até isto ser corrigido.',
      lastFailureRef.value ? { endpoint: lastFailureRef.value.endpoint, status: lastFailureRef.value.status, wpError: lastFailureRef.value.body } : ''
    );
    this.lastError = lastFailureRef.value;
    const fallback = await this.collectByStatus(resourcePath, 'publish', false, lastFailureRef);
    return { items: fallback || [], complete: false };
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

      try {
        await this.pingLocalDb();
      } catch (pingErr) {
        console.error(`❌ Ligação à base de dados local indisponível antes de inserir ${allFichas.length} fichas (${pingErr.message}) — a saltar esta ronda.`);
        return;
      }

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

      try {
        await this.pingLocalDb();
      } catch (pingErr) {
        console.error(`❌ Ligação à base de dados local indisponível antes de inserir ${allClients.length} clientes (${pingErr.message}) — a saltar esta ronda.`);
        return;
      }

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

      try {
        await this.pingLocalDb();
      } catch (pingErr) {
        console.error(`❌ Ligação à base de dados local indisponível antes de inserir ${allPages.length} páginas (${pingErr.message}) — a saltar esta ronda.`);
        return;
      }

      for (const page of allPages) {
        await new Promise((resolve, reject) => {
          this.localDb.query(
            `INSERT INTO wp_posts (
              ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
              post_status, comment_status, ping_status, post_password, post_name, to_ping, pinged,
              post_modified, post_modified_gmt, post_content_filtered, post_parent, guid,
              menu_order, post_type, post_mime_type, comment_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              post_author = VALUES(post_author),
              post_date = VALUES(post_date),
              post_date_gmt = VALUES(post_date_gmt),
              post_content = VALUES(post_content),
              post_title = VALUES(post_title),
              post_excerpt = VALUES(post_excerpt),
              post_status = VALUES(post_status),
              comment_status = VALUES(comment_status),
              ping_status = VALUES(ping_status),
              post_modified = VALUES(post_modified),
              post_modified_gmt = VALUES(post_modified_gmt),
              post_content_filtered = VALUES(post_content_filtered),
              post_parent = VALUES(post_parent),
              guid = VALUES(guid),
              menu_order = VALUES(menu_order),
              post_type = VALUES(post_type),
              post_mime_type = VALUES(post_mime_type),
              comment_count = VALUES(comment_count)`,
            [
              page.id,
              Number(page.author) || 1,
              // post_date must also be GMT (fed a "local site time" string would
              // reintroduce the same +1h drift already fixed for fichas/clients).
              page.date_gmt || page.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
              page.date_gmt || page.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
              page.content?.rendered || '',
              page.title?.rendered || page.title || 'Sem título',
              page.excerpt?.rendered || '',
              page.status || 'publish',
              // The rest are columns MySQL has no usable default for (TEXT
              // columns can't have a DEFAULT at all, so omitting them from the
              // INSERT is what caused the post_excerpt failure) — send explicit
              // safe values for every one of them so no future column can
              // reject an insert the same way.
              page.comment_status || 'closed',
              page.ping_status || 'closed',
              page.password || '',
              page.slug || `page-${page.id}`,
              '',
              '',
              page.modified_gmt || page.modified || new Date().toISOString().slice(0, 19).replace('T', ' '),
              page.modified_gmt || page.modified || page.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
              '',
              Number(page.parent) || 0,
              page.guid?.rendered || page.link || '',
              Number(page.menu_order) || 0,
              'page',
              '',
              Number(page.comment_count) || 0
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

  async getFromWordPressResponse(endpoint, extraHeaders = {}) {
    try {
      const url = `${this.wpApiUrl}${endpoint}`;
      console.log(`  🔗 Fetching: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true, // Não falhar em 404
        headers: { ...this.getWordPressAuthHeaders(), ...extraHeaders }
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
      // true = WP_SYNC_BYPASS_SECRET está definida, então fichas/clientes tentam
      // primeiro o endpoint próprio (wordpress-mu-plugin/sdm-sync-bypass.php) em
      // vez de pedir estado a estado ao Pods.
      usingSyncBypass: this.hasSyncBypassSecret(),
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
