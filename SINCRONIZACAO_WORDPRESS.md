# 🔄 Sincronização em Tempo Real com WordPress

## 📋 Visão Geral

Esta solução permite que o seu projeto React local esteja **sempre sincronizado** com o WordPress online (sdm.celeuma.pt), sem precisar de alterar a arquitetura existente.

**Cenário**:
- ✅ WordPress online (sdm.celeuma.pt) - em produção, colaboradores usando
- ✅ React + Node.js local - novo sistema em desenvolvimento
- ✅ Sincronização automática a cada 5 minutos
- ✅ Webhooks do WordPress para mudanças em tempo real (bónus)

---

## 🚀 Como Funciona

### Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                   WordPress Online                          │
│              (sdm.celeuma.pt/wp-json)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ REST API
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend Node.js (seu-app/backend)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    SyncService                                       │   │
│  │  - Polling a cada 5 minutos                         │   │
│  │  - Detecta mudanças via timestamp                   │   │
│  │  - Insere/atualiza no MySQL local                   │   │
│  │  - Webhooks para notificações em tempo real         │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ MySQL Local
┌─────────────────────────────────────────────────────────────┐
│                    MySQL Local                              │
│           (fichas, clients, paginas, users)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ REST API
┌─────────────────────────────────────────────────────────────┐
│              React Frontend (http://localhost:3000)         │
│  - Busca dados do backend Node.js                          │
│  - Sempre tem dados atualizados                            │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ SETUP - Configuração

### 1️⃣ Verificar a API do WordPress Online

Primeiro, confirme que o WordPress tem REST API ativa:

```bash
# Aceda a este URL no seu browser (ou cURL)
curl https://sdm.celeuma.pt/wp-json/wp/v2/posts

# Deve responder com JSON (não com erro 404)
```

Se responder com erro 404:
- **Solução**: O WordPress precisa de ter a REST API ativada
- Contacte o administrador do site ou veja em `https://sdm.celeuma.pt/wp-json`

---

### 2️⃣ Configurar Variáveis de Ambiente

No ficheiro `backend/.env`, adicione:

```env
# URL da API REST do WordPress
WP_API_URL=https://sdm.celeuma.pt/wp-json

# Intervalo de sincronização em milissegundos (300000 = 5 minutos)
SYNC_INTERVAL=300000

# Token para webhooks (gera um valor aleatório forte)
WEBHOOK_SECRET=seu_token_secreto_muito_forte_aqui
```

**Exemplo de token seguro** (use `openssl rand -hex 32` ou similar):
```
WEBHOOK_SECRET=a3f8b2c9d1e4f7a9b3c5e8d2f1a4b7c9
```

---

### 3️⃣ Iniciar o Backend

```bash
cd backend
npm install
npm run dev

# Deve ver na consola:
# ✅ MySQL OK!
# 🔄 Ativando sincronização automática com WordPress
# ✅ ${results.length} fichas sincronizadas
```

---

### 4️⃣ Testar a Sincronização

```bash
# Teste em tempo real
curl http://localhost:5000/api/sync/status

# Resposta esperada:
{
  "success": true,
  "isRunning": true,
  "wpUrl": "https://sdm.celeuma.pt/wp-json",
  "lastSync": {
    "fichas": "2026-05-11T10:30:45.123Z",
    "clients": "2026-05-11T10:30:45.456Z",
    "pages": "2026-05-11T10:30:45.789Z",
    "users": "2026-05-11T10:30:46.012Z"
  }
}
```

---

## 🔌 Endpoints Disponíveis

### Status da Sincronização

```bash
GET /api/sync/status
```

**Resposta**:
```json
{
  "success": true,
  "isRunning": true,
  "lastSync": {
    "fichas": "2026-05-11T10:30:45Z",
    "clients": "2026-05-11T10:30:46Z",
    "pages": "2026-05-11T10:30:47Z",
    "users": "2026-05-11T10:30:48Z"
  },
  "wpUrl": "https://sdm.celeuma.pt/wp-json"
}
```

---

### Iniciar Sincronização Automática

```bash
POST /api/sync/start
```

**Resposta**:
```json
{
  "success": true,
  "message": "Sincronização iniciada",
  "interval": 300000
}
```

---

### Parar Sincronização Automática

```bash
POST /api/sync/stop
```

**Resposta**:
```json
{
  "success": true,
  "message": "Sincronização parada"
}
```

---

### Sincronizar Agora (Imediatamente)

```bash
POST /api/sync/now
```

**Resposta**:
```json
{
  "success": true,
  "message": "Sincronização completa"
}
```

---

### Webhook do WordPress

```bash
POST /api/sync/webhook
Content-Type: application/json

{
  "type": "ficha.updated",
  "data": {
    "id": 123,
    "titulo": "Nova Ficha",
    "cliente_id": 456
  },
  "secret": "seu_token_secreto_muito_forte_aqui"
}
```

---

## 📡 Webhooks do WordPress (Bónus - Opcional)

Para **sincronização em tempo real** quando há mudanças:

### No WordPress, usar um plugin como "Webhooks"

1. Instale o plugin `Webhooks for WordPress` (ou similar)
2. Configure um webhook para notificar seu backend:

**URL do Webhook**:
```
https://seu-backend.com/api/sync/webhook
```

**Eventos a disparar**:
- Post criado
- Post atualizado
- Post eliminado

**Payload**:
```json
{
  "type": "post.updated",
  "data": {
    "post_id": 123,
    "post_title": "Título",
    "post_type": "post"
  },
  "secret": "seu_token_secreto_muito_forte_aqui"
}
```

---

## 🛠️ Troubleshooting

### ❌ "WP_API_URL não está configurada"

**Solução**: Adicione no `.env`:
```env
WP_API_URL=https://sdm.celeuma.pt/wp-json
```

---

### ❌ "Erro 403 - CORS"

**Problema**: WordPress não permite requisições externas

**Solução** (WordPress Plugins):
1. Instale "REST API - CORS Support"
2. Ou configure manualmente os headers CORS

---

### ❌ "Erro ao aceder WordPress"

**Motivos possíveis**:
1. WordPress offline ou URL errada
2. Firewall/SSL bloqueando requisições
3. Rate limiting do servidor

**Teste**:
```bash
curl -v https://sdm.celeuma.pt/wp-json

# Deve responder com 200 e JSON
```

---

### ⚠️ "Sincronização lenta"

**Causas**:
- WordPress responde lentamente
- BD local com muitos dados
- Intervalo de sincronização muito curto

**Soluções**:
```env
# Aumentar intervalo para 10 minutos
SYNC_INTERVAL=600000

# Ou 30 minutos
SYNC_INTERVAL=1800000
```

---

## 📊 O Que é Sincronizado

### ✅ Fichas
- ID, título, descrição, cliente
- Data de contacto, status
- Todos os campos de follow-up

### ✅ Clientes
- Nome, email, telefone, empresa
- Data de criação/modificação
- Status ativo/inativo

### ✅ Páginas
- Título, conteúdo, slug
- Data de publicação
- Status publicada/rascunho

### ✅ Utilizadores
- Nome, email, função (role)
- Admin, Editor, Contributor

---

## 🔐 Segurança

### 1. Token de Webhook

Proteja seu endpoint de webhook com um token:

```env
WEBHOOK_SECRET=seu_token_muito_seguro
```

O WordPress deve enviar este token em cada webhook.

---

### 2. Rate Limiting

Para proteger seu backend, configure rate limiting:

```javascript
// Adicionar ao seu server.js (se necessário)
const rateLimit = require('express-rate-limit');

const syncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10 // máximo 10 requisições por minuto
});

app.use('/api/sync/', syncLimiter);
```

---

### 3. HTTPS em Produção

Certifique-se que:
- Seu backend está em HTTPS
- WordPress é accessível via HTTPS
- Certificados SSL válidos

---

## 📈 Monitoramento

### Ver logs de sincronização

```bash
# Terminal onde o backend está a rodar
cd backend
npm run dev

# Verá algo como:
# ⏱️  Sincronização iniciada às 10:30:45
# 📝 Atualizando 5 fichas...
# 👥 Atualizando 3 clientes...
# 📄 Atualizando 2 páginas...
# 👤 Atualizando 8 utilizadores...
# ✅ Sincronização completa às 10:30:48
```

---

## 🚀 Deploy para Produção (Render)

Quando estiver pronto a fazer deploy:

### 1. No Render, adicione variáveis:

```env
WP_API_URL=https://sdm.celeuma.pt/wp-json
SYNC_INTERVAL=300000
WEBHOOK_SECRET=seu_token_secreto_muito_forte_aqui
```

### 2. Redeploy do Backend

Após adicionar as variáveis, o backend iniciará automaticamente a sincronização.

---

## 📝 Resumo do Fluxo

```
1. Backend inicia → Lê WP_API_URL
   ↓
2. Cria SyncService com intervalo de 5 minutos
   ↓
3. Sincronização imediata:
   - GET /wp-json/custom/v1/fichas
   - GET /wp-json/custom/v1/clients
   - GET /wp-json/custom/v1/pages
   - GET /wp-json/wp/v2/users
   ↓
4. Compara com DB local via timestamps
   ↓
5. Insere/atualiza registos mudados
   ↓
6. Agenda próxima sincronização em 5 minutos
   ↓
7. Repetir de forma infinita (até parar)
   ↓
8. React frontend busca dados do backend → Sempre atualizado ✅
```

---

## 💡 Dicas e Otimizações

### Performance

1. **Índices no MySQL** - Adicione índices às colunas de timestamp:
   ```sql
   ALTER TABLE fichas ADD INDEX idx_data_mod (data_modificacao);
   ALTER TABLE clients ADD INDEX idx_data_mod (data_modificacao);
   ```

2. **Filtros no WordPress** - Se possível, filtre por data no WordPress:
   ```javascript
   // Em sync-service.js, linha ~150
   const since = this.lastSync.fichas ? this.lastSync.fichas.toISOString() : '2020-01-01T00:00:00Z';
   const wpUrl = `${this.wpApiUrl}/custom/v1/fichas?modified_after=${since}`;
   ```

3. **Paginação** - Para muitos registos, implemente paginação:
   ```javascript
   const wpUrl = `${this.wpApiUrl}/wp/v2/posts?per_page=100&page=${page}`;
   ```

---

## ✅ Checklist de Setup

- [ ] Verificou que WordPress REST API está acessível
- [ ] Configurou `WP_API_URL` no `.env`
- [ ] Gerou token seguro para `WEBHOOK_SECRET`
- [ ] Testou com `curl /api/sync/status`
- [ ] Confirmou sincronização nos logs
- [ ] Frontend busca dados do backend
- [ ] Dados estão atualizados em tempo real
- [ ] Documentou mudanças em `DEPLOY.md`

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do backend
2. Teste a API do WordPress manualmente
3. Confirme CORS está configurado
4. Verifique firewall/SSL

---

## 🎯 Próximos Passos

1. **Implementar endpoint customizado no WordPress** para melhor compatibilidade
2. **Adicionar webhooks reais** do WordPress (não apenas polling)
3. **Criar dashboard** para monitorar sincronização
4. **Testes automáticos** para validar integridade dos dados

