# ✅ Render Deployment Checklist

## Ficheiros já preparados ✓

- ✅ `backend/Procfile` - Configuração para Render
- ✅ `backend/.env.example` - Template com todas as variáveis
- ✅ `frontend/.env.example` - Template React
- ✅ `backend/package.json` - Scripts corretos
- ✅ `frontend/package.json` - Build script pronto
- ✅ `.gitignore` - Proteger .env e node_modules
- ✅ `RENDER_DEPLOY.md` - Guia completo de deployment

---

## 🔷 O que TU tens que fazer (Passo-a-Passo)

### PASSO 1: Fazer Push para GitHub

```bash
cd projeto_fichas

git init
git add .
git commit -m "feat: projeto pronto para deploy no Render"
git remote add origin https://github.com/TEU_USERNAME/projeto_fichas.git
git branch -M main
git push -u origin main
```

**Importante:**
- Cria um repositório privado (para dados sensíveis)
- O `.env` NÃO é enviado (está em .gitignore)

---

### PASSO 2: Criar Base de Dados Online

Escolhe UMA das opções:

#### Opção A: Railway.app (Recomendado)
1. Vai para https://railway.app
2. Faz login com GitHub
3. Clica "New Project" → "Database" → "MySQL"
4. Espera 2-3 minutos para criar
5. **Copia as credenciais:**
   - `host` (ex: `containers-us-west-xxx.railway.app`)
   - `port` (ex: `7000`)
   - `user` (ex: `root`)
   - `password` (gerada automaticamente)
   - `database` (ex: `railway`)

#### Opção B: PlanetScale (Alternativa)
1. Vai para https://planetscale.com
2. Sign up com GitHub
3. Cria nova base de dados MySQL
4. Vai em "Connect" e copia a connection string

---

### PASSO 3: Criar Backend no Render

1. **Vai para https://render.com/dashboard**
2. **Clica "New" → "Web Service"**
3. **Conecta o repositório GitHub**
   - Se for primeira vez, autoriza Render
   - Seleciona `projeto_fichas`

4. **Preenche os dados:**
   ```
   Name: projeto-fichas-backend
   Environment: Node
   Build Command: cd backend && npm install
   Start Command: node backend/server.js
   Branch: main
   ```

5. **Vai a "Environment" e adiciona:**
   ```
   PORT=5000
   NODE_ENV=production
   
   DB_HOST=host-do-railway-aqui
   DB_USER=root
   DB_PASS=password-do-railway-aqui
   DB_NAME=railway
   
   FRONTEND_URLS=https://projeto-fichas-frontend.onrender.com
   
   # Opcional (se tiver WordPress):
   WP_API_URL=https://seusite.com/wp-json
   ```

6. **Clica "Deploy"** e espera (5-10 minutos até ficar "Live")

7. **Copia o URL:** `https://seu-backend.onrender.com`

---

### PASSO 4: Criar Frontend no Render

1. **Vai para https://render.com/dashboard**
2. **Clica "New" → "Static Site"**
3. **Conecta o MESMO repositório**

4. **Preenche os dados:**
   ```
   Name: projeto-fichas-frontend
   Branch: main
   Build Command: cd frontend && npm install && npm run build
   Publish Directory: frontend/build
   ```

5. **Vai a "Environment" e adiciona:**
   ```
   REACT_APP_API_BASE_URL=https://projeto-fichas-backend.onrender.com
   ```
   (Substitui pela URL real do teu backend do Passo 3)

6. **Clica "Deploy"** e espera (3-5 minutos)

7. **Copia o URL:** `https://seu-frontend.onrender.com`

---

### PASSO 5: Criar Schema da Base de Dados

Agora tens que criar as tabelas. Vais receber um comando de conexão do Railway.

```bash
# Coneta-te à BD:
mysql -h SEU_HOST -P SEU_PORT -u root -p
# Enter password quando pedir

# Dentro do MySQL:
USE railway;

# Cola aqui o script SQL das tuas tabelas
# (Precisas de consultar as tabelas do teu projeto)
```

**Opção mais fácil:** 
- Exporta o schema da tua BD local
- Copia e cola no MySQL do Railway

```bash
# No teu computador (MySQL local):
mysqldump -h localhost -u root -p wp_migracion --no-data > schema.sql

# Depois copia o conteúdo de schema.sql e cola no Railway
```

---

### PASSO 6: Testar Conexão

Após criar a BD:

```bash
# Testar backend
curl https://seu-backend.onrender.com/api/fichas

# Testar frontend (abrir no navegador)
https://seu-frontend.onrender.com
```

Se vires a aplicação React e dados → **Sucesso! 🎉**

---

## 🚨 Problemas Comuns

### "Application failed to start"
- Verifica os logs no Render (Dashboard → Logs)
- Confirma que PORT está em Environment

### "Cannot connect to database"
- Verifica HOST, USER, PASSWORD (sem espaços)
- Confirma que a BD existe (USE railway)
- Testa localmente: `mysql -h host -u user -p`

### "CORS error" no Frontend
- Verifica que `FRONTEND_URLS` tem exatamente `https://seu-frontend.onrender.com`
- Sem `www.`, sem paths extras

### "Build failed" no Frontend
- Testa localmente: `cd frontend && npm run build`
- Verifica que tem todas as dependências em package.json

---

## 📋 Checklist Final

- [ ] Criaste repositório no GitHub
- [ ] Fizeste push do código
- [ ] Criaste base de dados no Railway/PlanetScale
- [ ] Criaste Web Service (backend) no Render
- [ ] Criaste Static Site (frontend) no Render
- [ ] Adicionaste variáveis de ambiente corretas
- [ ] Executaste script SQL para criar tabelas
- [ ] Testaste backend: curl /api/fichas
- [ ] Testaste frontend: abrir URL no navegador
- [ ] Atualizaste `FRONTEND_URLS` no backend se mudou

---

## 🎯 Próximos Passos Após Deploy

1. ✅ Testa todas as funcionalidades (fichas, clientes, etc)
2. ✅ Verifica os logs para erros
3. ✅ Configura domínio personalizado (opcional)
4. ✅ Configura backups automáticos da BD
5. ✅ Monitoramento contínuo no Render Dashboard

---

## 💡 URLs Importantes

- Render Dashboard: https://render.com/dashboard
- Railway Dashboard: https://railway.app/dashboard
- GitHub: https://github.com
- Email de suporte Render: support@render.com

---

**Sucesso no deployment! 🚀**

Se ficares preso, consulta o [RENDER_DEPLOY.md](RENDER_DEPLOY.md) para mais detalhes sobre cada passo.
