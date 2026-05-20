# 🔄 Sincronização de Dados + Deploy para Render

## SITUAÇÃO ATUAL
- **Versão A (Colaboradores)**: WordPress online com dados atualizados
- **Versão B (Tu)**: React + Node.js local, com BD MySQL separada
- **Problema**: Dados não sincronizam; tu tens BD diferente do WordPress

---

## OPÇÃO 1: USAR REST API DO WORDPRESS (RECOMENDADO - Mais Simples)

### Passo 1: Verificar API do WordPress
1. Acede ao site WordPress online
2. Testa a API em: `https://seusite.com/wp-json/wp/v2/posts`
3. Se responde com JSON, a API está ativa ✅

### Passo 2: Criar Endpoints que Leem do WordPress
Adiciona ao teu `backend/server.js`:

```javascript
const axios = require('axios');

// Configurar URL do WordPress
const WP_API_URL = process.env.WP_API_URL || 'https://seusite.com/wp-json';

// Endpoint para FICHAS (lê do WordPress)
app.get('/api/fichas/wordpress', async (req, res) => {
  try {
    const response = await axios.get(`${WP_API_URL}/wp/v2/posts?per_page=100`);
    // Mapear dados do WordPress para o teu formato
    const fichas = response.data.map(post => ({
      id: post.id,
      titulo: post.title.rendered,
      conteudo: post.content.rendered,
      data: post.date,
      status: post.status
    }));
    res.json(fichas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint que sincroniza: tenta BD local primeiro, depois WordPress
app.get('/api/fichas-sync', async (req, res) => {
  db.query('SELECT * FROM fichas ORDER BY data_contacto DESC', async (err, results) => {
    if (err || !results.length) {
      // Se não tiver na BD local, vai buscar ao WordPress
      try {
        const response = await axios.get(`${WP_API_URL}/wp/v2/posts?per_page=100`);
        const fichas = response.data.map(post => ({
          id: post.id,
          titulo: post.title.rendered,
          conteudo: post.content.rendered,
          data_contacto: post.date
        }));
        return res.json(fichas);
      } catch (wpError) {
        return res.status(500).json({ error: wpError.message });
      }
    }
    res.json(results);
  });
});
```

**Vantagens**: Simples, não precisa de alterar BD
**Desvantagens**: Mais lento (chamadas HTTP)

---

## OPÇÃO 2: REPLICAR BD DO WORDPRESS (Mais Rápido)

### Passo 1: Obter Credenciais do WordPress Online
Pede ao teu colaborador/hosting:
- Host da BD (`seuhost.com`)
- Utilizador da BD
- Password da BD
- Nome da BD do WordPress

### Passo 2: Alterar Backend para Apontar para BD WordPress
Cria um segundo ficheiro `.env` com dados do WordPress:

```env
# .env.production
DB_HOST=seuhost.com
DB_USER=usuario_wp
DB_PASS=senha_wp
DB_NAME=database_wp
PORT=5000
FRONTEND_URL=https://tuapp.onrender.com
```

### Passo 3: Testar Localmente
```bash
cd backend
npm install
NODE_ENV=production node server.js
```

**Vantagens**: Mais rápido, dados em tempo real
**Desvantagens**: Precisa acesso à BD remota (pode ter restrições)

---

## 🚀 DEPLOY PARA RENDER

### Passo 1: Criar Conta em Render
1. Vai para https://render.com
2. Faz login com GitHub
3. Clica em "New +"

### Passo 2: Deploy do Backend
1. Clica **"New Web Service"**
2. Conecta o teu repositório GitHub
3. **Configuração**:
   - **Name**: `fichas-backend` (ou o nome que quiseres)
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node backend/server.js`
   - **Region**: `Frankfurt` (Europa, mais rápido)

4. **Adiciona Variáveis de Ambiente** (clica em "Environment"):
```
DB_HOST=seuhost.com
DB_USER=usuario_wp
DB_PASS=senha_wp
DB_NAME=database_wp
PORT=5000
FRONTEND_URLS=https://tuapp.onrender.com,http://localhost:3000
```

5. Clica **"Create Web Service"**
6. Espera 5-10 minutos até deploy ficar pronto ✅

### Resultado Backend
- URL: `https://fichas-backend.onrender.com` (ou similar)
- Guarda esta URL!

---

### Passo 3: Deploy do Frontend
1. No Render, clica **"New +"** → **"Static Site"**
2. Conecta GitHub novamente
3. **Configuração**:
   - **Name**: `fichas-frontend`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/build`

4. **Adiciona Variável de Ambiente**:
```
REACT_APP_API_BASE_URL=https://fichas-backend.onrender.com
```

5. Clica **"Create Static Site"**
6. Espera deploy completar

### Resultado Frontend
- URL: `https://fichas-frontend.onrender.com` (ou similar)

---

### Passo 4: Atualizar Variáveis do Backend
Volta para o backend no Render e adiciona:
```
FRONTEND_URLS=https://fichas-frontend.onrender.com,http://localhost:3000
```

---

## ⚙️ CONFIGURAÇÃO FINAL (localhost)

### Ficheiro `.env` local
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=wp_migracion
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### Ficheiro `.env` frontend local
```
REACT_APP_API_BASE_URL=http://localhost:5000
```

### Para Desenvolvimento
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm start
```

---

## 📋 CHECKLIST DE PASSOS

- [ ] **Opção 1 ou 2**: Decidir qual estratégia usar (REST API ou BD Remota)
- [ ] **Obter Credenciais**: Se Opção 2, pedir dados do WordPress ao colaborador
- [ ] **Instalar axios**: `npm install axios` no backend (se Opção 1)
- [ ] **Testar Localmente**: Verificar que dados sincronizam
- [ ] **Criar Conta Render**: https://render.com
- [ ] **Deploy Backend**: Seguir Passo 2
- [ ] **Deploy Frontend**: Seguir Passo 3
- [ ] **Testar Online**: Verificar que tudo funciona
- [ ] **Colaboradores**: Comunicar novo URL

---

## 🔒 SEGURANÇA - IMPORTANTE!

**NUNCA commits credenciais ao Git!**

1. Cria `.env` em cada máquina
2. Adiciona `.env` ao `.gitignore`:
```
.env
.env.local
.env.*.local
```

3. No Render, adiciona variáveis no painel (não em ficheiros)

---

## 🐛 TROUBLESHOOTING

### "CORS Error"
→ Adiciona Frontend URL às variáveis do Backend: `FRONTEND_URLS=https://tuapp.onrender.com`

### "Cannot connect to database"
→ Verifica: Host, User, Password, Nome da BD
→ Testa: `mysql -h seuhost.com -u usuario -p`

### "Build falha no Render"
→ Verifica os logs: Clica na build e vê o error
→ Comum: Falta de `node_modules` → adiciona `npm install`

### "Dados antigos no frontend"
→ Limpa cache: `Ctrl+Shift+Delete` ou `Cmd+Shift+Delete`
→ Ou força refresh: `Ctrl+F5`

---

## 📞 PRÓXIMOS PASSOS

1. **Escolhe Opção 1 ou 2** acima
2. **Se Opção 2**: Pede credenciais ao teu colaborador
3. **Implementa** a solução
4. **Testa** localmente
5. **Faz deploy** para Render
6. **Avisa** os colaboradores do novo URL

Tens dúvidas em algum passo? Diz-me qual!
