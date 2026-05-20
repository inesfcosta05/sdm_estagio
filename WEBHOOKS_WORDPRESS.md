# 🎯 Guia de Webhooks - WordPress → Backend

## 📌 O que são Webhooks?

Webhooks são **notificações automáticas** enviadas pelo WordPress sempre que algo muda (um post é criado, atualizado, etc).

**Sem webhooks** (atual):
- Backend verifica a cada 5 minutos se houve mudanças
- Demora até 5 minutos para sincronizar dados

**Com webhooks** (futuro):
- WordPress notifica seu backend **imediatamente** quando há mudanças
- Sincronização em tempo real (<1 segundo)

---

## 🔧 Opção 1: Plugin de Webhooks (Mais Fácil)

### Passo 1: Instalar Plugin no WordPress

1. Aceda a `https://sdm.celeuma.pt/wp-admin`
2. Vá para **Plugins** → **Adicionar Novo**
3. Procure por **"Webhooks for WordPress"** ou **"WP Webhooks"**
4. Instale o plugin

**Plugins recomendados**:
- [WP Webhooks](https://wordpress.org/plugins/wp-webhooks-free/)
- [Webhooks](https://wordpress.org/plugins/webhooks/)
- [Post Notification Webhooks](https://wordpress.org/plugins/post-notification-webhooks/)

---

### Passo 2: Configurar Webhook

Após instalar:

1. Vá para **WP Webhooks** (ou similar) nas definições
2. Clique em **"Add New Webhook"**
3. Configure:

| Campo | Valor |
|-------|-------|
| **Webhook URL** | `https://seu-backend.onrender.com/api/sync/webhook` |
| **Evento** | Selecione: "Post Updated", "Post Created", "Post Deleted" |
| **Secret/Token** | Cole aqui o seu `WEBHOOK_SECRET` do `.env` |
| **Active** | ✅ Ativar |

---

### Passo 3: Testar Webhook

1. No painel do plugin, clique em **"Send Test"**
2. Verá a resposta do seu backend

**Resposta esperada** (sucesso):
```json
{
  "success": true,
  "message": "Webhook processado"
}
```

---

## 🔧 Opção 2: Webhook Customizado (Mais Controlo)

Se prefere ter mais controlo, pode criar um webhook manualmente usando **Custom Post Meta Webhooks** ou **WP REST API Hooks**.

### Código PHP para adicionar ao `functions.php` do tema WordPress

```php
<?php
/**
 * 🔔 Webhooks Customizados - Notificar Backend de Mudanças
 * 
 * Adicione este código em: Tema → Theme File Editor → functions.php
 * Ou em: Plugins → Code Snippets (com plugin "Code Snippets")
 */

// Configurações
define('BACKEND_WEBHOOK_URL', 'https://seu-backend.onrender.com/api/sync/webhook');
define('WEBHOOK_SECRET', getenv('WEBHOOK_SECRET') ?? 'seu-token-secreto');

/**
 * 📝 Webhook: Post Criado
 */
function send_webhook_post_created($post_id, $post) {
  if (in_array($post->post_type, ['ficha', 'cliente', 'pagina'])) {
    send_webhook('post.created', [
      'post_id' => $post_id,
      'post_title' => $post->post_title,
      'post_type' => $post->post_type,
      'post_content' => $post->post_content,
      'post_status' => $post->post_status
    ]);
  }
}
add_action('wp_insert_post', 'send_webhook_post_created', 10, 2);

/**
 * ✏️ Webhook: Post Atualizado
 */
function send_webhook_post_updated($post_id, $post_after, $post_before) {
  // Verificar se realmente mudou
  if (md5(serialize($post_before)) !== md5(serialize($post_after))) {
    if (in_array($post_after->post_type, ['ficha', 'cliente', 'pagina'])) {
      send_webhook('post.updated', [
        'post_id' => $post_id,
        'post_title' => $post_after->post_title,
        'post_type' => $post_after->post_type,
        'post_content' => $post_after->post_content,
        'post_status' => $post_after->post_status,
        'changes' => get_post_changes($post_before, $post_after)
      ]);
    }
  }
}
add_action('post_updated', 'send_webhook_post_updated', 10, 3);

/**
 * 🗑️ Webhook: Post Eliminado
 */
function send_webhook_post_deleted($post_id) {
  $post = get_post($post_id);
  if (in_array($post->post_type, ['ficha', 'cliente', 'pagina'])) {
    send_webhook('post.deleted', [
      'post_id' => $post_id,
      'post_title' => $post->post_title,
      'post_type' => $post->post_type
    ]);
  }
}
add_action('delete_post', 'send_webhook_post_deleted', 10, 1);

/**
 * 📤 Função para enviar webhook
 */
function send_webhook($event_type, $data) {
  $webhook_payload = [
    'type' => $event_type,
    'data' => $data,
    'timestamp' => current_time('mysql'),
    'site_url' => home_url(),
    'secret' => WEBHOOK_SECRET
  ];

  $args = [
    'method'      => 'POST',
    'timeout'     => 10,
    'redirection' => 5,
    'httpversion' => '1.1',
    'blocking'    => false, // Não bloquear a execução
    'headers'     => [
      'Content-Type'  => 'application/json',
      'User-Agent'    => 'WordPress-Webhook/' . get_bloginfo('version')
    ],
    'body'        => json_encode($webhook_payload),
    'sslverify'   => true
  ];

  $response = wp_remote_post(BACKEND_WEBHOOK_URL, $args);

  if (is_wp_error($response)) {
    error_log('Webhook Error: ' . $response->get_error_message());
  }
}

/**
 * 🔍 Função para detectar mudanças
 */
function get_post_changes($post_before, $post_after) {
  $changes = [];
  
  $fields = ['post_title', 'post_content', 'post_status', 'post_date'];
  
  foreach ($fields as $field) {
    if ($post_before->$field !== $post_after->$field) {
      $changes[$field] = [
        'before' => $post_before->$field,
        'after'  => $post_after->$field
      ];
    }
  }
  
  return $changes;
}

// Adicionar custom post types se não existem
function register_custom_post_types() {
  if (!post_type_exists('ficha')) {
    register_post_type('ficha', [
      'public' => true,
      'label'  => 'Fichas'
    ]);
  }
  
  if (!post_type_exists('cliente')) {
    register_post_type('cliente', [
      'public' => true,
      'label'  => 'Clientes'
    ]);
  }
  
  if (!post_type_exists('pagina')) {
    register_post_type('pagina', [
      'public' => true,
      'label'  => 'Páginas'
    ]);
  }
}
add_action('init', 'register_custom_post_types');

?>
```

---

## 🧪 Testar Webhook Manualmente

### Usando cURL (Terminal)

```bash
# Simular um webhook POST
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "type": "post.updated",
    "data": {
      "post_id": 123,
      "post_title": "Teste de Webhook",
      "post_type": "ficha"
    },
    "secret": "seu_token_secreto"
  }' \
  http://localhost:5000/api/sync/webhook

# Resposta esperada:
# {"success": true, "message": "Webhook processado"}
```

### Usando Postman

1. Abra **Postman**
2. Crie novo **POST** request
3. URL: `http://localhost:5000/api/sync/webhook`
4. **Body** (JSON):
```json
{
  "type": "ficha.updated",
  "data": {
    "id": 123,
    "titulo": "Teste",
    "cliente_id": 456
  },
  "secret": "seu_token_secreto"
}
```
5. Clique em **Send**

---

## 📋 Payload do Webhook - Formato Esperado

### Criação de Post
```json
{
  "type": "post.created",
  "data": {
    "post_id": 123,
    "post_title": "Nova Ficha",
    "post_type": "ficha",
    "post_content": "Descrição...",
    "post_status": "publish"
  },
  "timestamp": "2026-05-11 10:30:45",
  "site_url": "https://sdm.celeuma.pt",
  "secret": "token_secreto"
}
```

### Atualização de Post
```json
{
  "type": "post.updated",
  "data": {
    "post_id": 123,
    "post_title": "Ficha Atualizada",
    "post_type": "ficha",
    "post_content": "Nova descrição...",
    "post_status": "publish",
    "changes": {
      "post_title": {
        "before": "Ficha Antiga",
        "after": "Ficha Atualizada"
      }
    }
  },
  "timestamp": "2026-05-11 10:31:00",
  "site_url": "https://sdm.celeuma.pt",
  "secret": "token_secreto"
}
```

### Eliminação de Post
```json
{
  "type": "post.deleted",
  "data": {
    "post_id": 123,
    "post_title": "Ficha Eliminada",
    "post_type": "ficha"
  },
  "timestamp": "2026-05-11 10:31:30",
  "site_url": "https://sdm.celeuma.pt",
  "secret": "token_secreto"
}
```

---

## 🔐 Validar Token de Webhook

No seu `sync-service.js`, o token é validado automaticamente:

```javascript
// Em handleWebhook()
const webhookSecret = process.env.WEBHOOK_SECRET || '';

if (webhookSecret && secret !== webhookSecret) {
  console.warn('⚠️  Webhook com token inválido recebido');
  return res.status(403).json({ error: 'Token inválido' });
}
```

---

## ⚠️ Troubleshooting Webhooks

### ❌ "Webhook não está sendo disparado"

**Causas**:
1. Plugin não está ativo
2. Post type não está configurado
3. Backend offline

**Solução**:
```bash
# No WordPress, verifique os logs
tail -f wp-content/debug.log

# Deve ver algo como:
# [11-May-2026 10:30:45 UTC] Webhook enviado: post.updated (ID: 123)
```

---

### ❌ "Webhook recebido mas não sincroniza"

**Verifique**:
1. Token `WEBHOOK_SECRET` está correto
2. Permissões MySQL para INSERT/UPDATE
3. Logs do backend:
```bash
cd backend
npm run dev
# Procure por: "📬 Webhook recebido"
```

---

### ❌ "HTTPS/SSL Error"

**Solução**:
```env
# Se usar certificado auto-assinado, desative temporariamente
WEBHOOK_VERIFY_SSL=false
```

⚠️ Só faça isto em desenvolvimento! Em produção, use certificados válidos.

---

## 📊 Monitorar Webhooks em Tempo Real

### No Backend

```bash
cd backend
npm run dev

# Verá na consola:
# 📬 Webhook recebido: post.updated
# 📝 Atualizando 1 ficha...
# ✅ Sincronização completa
```

### No WordPress

Se instalou um plugin de webhooks, verá um registo de eventos:
- Admin → Webhooks → Ver Logs
- Cada webhook disparado fica registado

---

## ✅ Checklist - Webhooks

- [ ] Plugin instalado no WordPress
- [ ] URL do webhook configurada
- [ ] Token `WEBHOOK_SECRET` definido
- [ ] Testou webhook com cURL/Postman
- [ ] Backend recebe notificações
- [ ] Sincronização funciona em tempo real
- [ ] Documentou em DEPLOY.md

---

## 🚀 Próximos Passos

1. **Monitoramento**: Adicionar dashboard para ver webhooks
2. **Retry automático**: Se webhook falhar, tentar novamente
3. **Logging**: Guardar histórico de webhooks para auditoria
4. **Rate limiting**: Proteção contra spam de webhooks

---

## 📞 Suporte

Para dúvidas sobre webhooks:
- Consulte a documentação do plugin no WordPress
- Verifique firewall/CORS no backend
- Ative logs de debug do WordPress

