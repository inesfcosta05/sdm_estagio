# 🚀 Deploy no Render - Guia Completo

## 📋 Pré-requisitos

1. Conta no [Render.com](https://render.com) (grátis)
2. Repositório GitHub com o projeto
3. MySQL hospedado (pode usar Railway, PlanetScale, ou outro)
4. Git configurado localmente

---

## 🔷 PASSO 1: Preparar o Repositório GitHub

### 1.1. Fazer Push do Projeto

```bash
cd projeto_fichas

# Se ainda não é repo git
git init
git add .
git commit -m "Initial commit - ready for Render"

# Adicionar remote
git remote add origin https://github.com/teu-user/projeto_fichas.git
git branch -M main
git push -u origin main
```

### 1.2. Criar Ficheiros de Configuração Necessários

#### Backend - `backend/Procfile` (para Render)
```
web: npm run start
```

#### Backend - `backend/.env.example`
```
PORT=3001
NODE_ENV=production

DB_HOST=your-mysql-host.mysql.render.com
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=seu_database_name

FRONTEND_URLS=https://seu-frontend.onrender.com,https://www.seu-frontend.onrender.com

WP_API_URL=https://seusite.com/wp-json
WP_SYNC_ENABLED=true
WP_SYNC_INTERVAL=300000
```

#### Frontend - `.env.example` (na raiz do frontend)
```
REACT_APP_API_BASE_URL=https://seu-backend.onrender.com
```

---

## 🗄️ PASSO 2: Configurar Base de Dados MySQL

### Opção A: Usar Railway (Recomendado - Grátis)

1. **Ir para [Railway.app](https://railway.app)**
2. **Fazer login** com GitHub
3. **Novo Projeto** → Database → MySQL
4. **Esperar carregamento** (2-3 minutos)
5. **Copiar credenciais:**
   - Host: `containers-us-west-xxx.railway.app`
   - Port: `7000` (ou qual aparecer)
   - User: `root`
   - Password: (password gerada)
   - Database: `railway`

### Opção B: Usar PlanetScale (MySQL em cloud)

1. **Ir para [PlanetScale.com](https://planetscale.com)**
2. **Sign up** com GitHub
3. **Criar database** → MySQL 8.0
4. **Get Connection String** → Select "Node.js"
5. Copiar a string de conexão

---

## 🔷 PASSO 3: Deploy do Backend no Render

### 3.1. Criar Web Service no Render

1. **Ir para [Render.com](https://render.com/dashboard)**
2. **New** → **Web Service**
3. **Conectar repositório GitHub**
   - Se for primeira vez, autorizar Render no GitHub
   - Selecionar `projeto_fichas` repository

### 3.2. Configurar o Serviço

```
Name: projeto-fichas-backend
Environment: Node
Build Command: cd backend && npm install
Start Command: node backend/server.js
Branch: main
```

### 3.3. Adicionar Variáveis de Ambiente

No Render, ir a **Environment**:

```
PORT=3001
NODE_ENV=production
DB_HOST=your-railway-host.com
DB_PORT=7000
DB_USER=root
DB_PASSWORD=sua_password_railway
DB_NAME=railway
FRONTEND_URLS=https://projeto-fichas-frontend.onrender.com,https://www.projeto-fichas-frontend.onrender.com
WP_API_URL=https://seusite.com/wp-json
```

O backend também aceita `DB_PASS` se preferires manter a nomenclatura antiga, mas no Render a configuração acima fica mais consistente com o resto da documentação.

### 3.4. Deploy

Render vai automaticamente:
- Pull do GitHub
- Instalar dependências
- Correr build
- Iniciar servidor

**Status:** Esperar "Live" (verde) - demora 5-10 minutos

**URL do Backend:** `https://projeto-fichas-backend.onrender.com`

---

## 🎨 PASSO 4: Deploy do Frontend no Render

### 4.1. Criar Static Site no Render

1. **Ir para [Render.com](https://render.com/dashboard)**
2. **New** → **Static Site**
3. **Conectar o mesmo repositório**

### 4.2. Configurar o Site

```
Name: projeto-fichas-frontend
Branch: main
Build Command: cd frontend && npm install && npm run build
Publish directory: frontend/build
```

### 4.3. Adicionar Variáveis de Ambiente

No Render (Environment):

```
REACT_APP_API_BASE_URL=https://projeto-fichas-backend.onrender.com
```

### 4.4. Deploy

Render vai:
- Fazer build React
- Gerar pasta `build`
- Servir ficheiros estáticos

**URL do Frontend:** `https://projeto-fichas-frontend.onrender.com`

---

## 🗄️ PASSO 5: Criar Schema da Base de Dados

### 5.1. Conectar à Base de Dados

Se usar Railway:

```bash
# Instalar MySQL client
# Windows: choco install mysql

mysql -h containers-us-west-xxx.railway.app -P 7000 -u root -p
# Enter password quando pedido
```

### 5.2. Executar Script SQL

Criar ficheiro `backend/schema.sql`:

```sql
CREATE DATABASE IF NOT EXISTS railway;
USE railway;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255),
    password_hash VARCHAR(255),
    papel ENUM('admin', 'user', 'editor') DEFAULT 'user',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fichas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(500),
    descricao LONGTEXT,
    estado VARCHAR(50),
    criado_por INT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (criado_por) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255),
    email VARCHAR(255),
    telefone VARCHAR(20),
    empresa VARCHAR(255),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT,
    token_expiry DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Adicionar mais tabelas conforme necessário
```

Executar:

```bash
mysql -h host -u root -p < backend/schema.sql
```

---

## 🔗 PASSO 6: Testar a Conexão

### 6.1. Testar Backend

```bash
# Substituir pela URL real do Render
curl https://projeto-fichas-backend.onrender.com/api/fichas

# Esperar resposta JSON:
# {"fichas":[]} ou {"error":"..."}
```

### 6.2. Testar Frontend

Abrir no navegador:
```
https://projeto-fichas-frontend.onrender.com
```

Deve carregar a aplicação React.

### 6.3. Verificar Logs

No Render Dashboard:
- Backend: **Logs** (vai mostrar console.log e erros)
- Frontend: **Logs** (vai mostrar build output)

---

## ⚙️ PASSO 7: Configurações Adicionais

### 7.1. Auto-Deploy com GitHub

Render já tem configurado. Cada push para `main`:
```bash
git push origin main
# Render vai automaticamente fazer rebuild e deploy
```

### 7.2. Custom Domain (Opcional)

1. No Render, ir a **Settings**
2. **Custom Domain**
3. Adicionar domínio (ex: `fichas.minhaempresa.com`)
4. Adicionar DNS CNAME conforme instruções

### 7.3. SSL/TLS

Render **faz automaticamente** (certificado Let's Encrypt gratuito).

### 7.4. Environment-Specific URLs

Se precisar de URLs diferentes por ambiente:

```javascript
// frontend/src/api.js
const apiBaseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
export const apiClient = axios.create({
  baseURL: apiBaseURL
});
```

```javascript
// backend/server.js
const corsOptions = {
  origin: (process.env.FRONTEND_URLS || 'http://localhost:3000').split(','),
  credentials: true
};
app.use(cors(corsOptions));
```

---

## 🚨 Problemas Comuns

### ❌ "Application failed to start"

**Solução:**
```bash
# Ver logs no Render
# Verificar se PORT está configurada
# Verificar variáveis de ambiente
```

### ❌ "Cannot connect to database"

**Solução:**
- Verificar HOST, PORT, USER, PASSWORD
- Testar localmente: `mysql -h host -u user -p`
- Verificar firewall/IP allowlist na BD hospedada

### ❌ "CORS error" no Frontend

**Solução:**
Verificar `FRONTEND_URLS` no backend tem URL correta:
```
FRONTEND_URLS=https://seu-frontend.onrender.com
```

### ❌ "Build failed"

**Solução:**
```bash
# Testar localmente
cd backend && npm install
cd ../frontend && npm install && npm run build
```

---

## 📊 Monitoramento

### No Render Dashboard:

- **CPU/Memory:** Status em tempo real
- **Logs:** Últimos eventos
- **Metrics:** Tráfego e performance
- **Events:** Deploy history

### Alerts (Gratuito):

1. Settings → Notifications
2. Receber email em caso de downtime

---

## 💡 Dicas Finais

✅ **Fazer commit antes de fazer deploy:**
```bash
git add .
git commit -m "Update deployment config"
git push origin main
```

✅ **Testar localmente primeiro:**
```bash
# Com variáveis de ambiente de produção
NODE_ENV=production npm run dev
```

✅ **Usar GitHub Actions para testes** (opcional):
Adicionar ficheiro `.github/workflows/test.yml` para CI/CD

✅ **Monitorar logs regularmente** para erros

✅ **Backup da BD** periodicamente

---

## 📞 Próximos Passos

1. ✅ Executar este guia passo-a-passo
2. ✅ Testar endpoints da API
3. ✅ Testar login e funcionalidades
4. ✅ Configurar domínio personalizado
5. ✅ Configurar backups automáticos da BD
6. ✅ Monitorar performance em produção

**Sucesso no deploy! 🎉**
