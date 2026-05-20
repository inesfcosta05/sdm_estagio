# 🛠️ SETUP LOCAL - Projeto Fichas

## 1️⃣ Clonar Repositório

```bash
git clone seu-repo
cd projeto_fichas
```

## 2️⃣ Setup Backend

### Passo 1: Instalar Dependências
```bash
cd backend
npm install
```

### Passo 2: Configurar Variáveis de Ambiente
```bash
# Copiar ficheiro de exemplo
cp .env.example .env

# Editar .env com os dados corretos:
# - DB_HOST, DB_USER, DB_PASS, DB_NAME (tua BD local)
# - FRONTEND_URL=http://localhost:3000
# - (Opcional) WP_API_URL se quiser sincronizar com WordPress
```

### Passo 3: Testar Conexão BD
```bash
# No MySQL/MariaDB, verifica se a BD existe:
mysql -h localhost -u root -p
> USE wp_migracion;
> SHOW TABLES;
```

### Passo 4: Iniciar Backend
```bash
# Terminal 1 - Backend
npm run dev
# Deve ver: ✅ MySQL OK!
# E URLs dos endpoints
```

## 3️⃣ Setup Frontend

### Passo 1: Instalar Dependências
```bash
cd ../frontend
npm install
```

### Passo 2: Configurar API URL
```bash
# Copiar ficheiro de exemplo
cp .env.example .env

# Verificar que tem:
# REACT_APP_API_BASE_URL=http://localhost:5000
```

### Passo 3: Iniciar Frontend
```bash
# Terminal 2 - Frontend
npm start
# Abre automaticamente em http://localhost:3000
```

## ✅ Verificar Instalação

1. **Backend está a responder**: http://localhost:5000/api/fichas
   - Deve retornar um array (pode estar vazio)

2. **Frontend carrega**: http://localhost:3000
   - Deve ver a aplicação React

3. **Dados aparecem no Frontend**:
   - Se tiver dados na BD, deve ver na aplicação

## 🔄 SINCRONIZAR COM WORDPRESS

Se quiser testar sincronização do WordPress:

### 1. Configurar WP_API_URL
```bash
# No backend/.env:
WP_API_URL=https://seusite.com/wp-json
```

### 2. Testar Conexão
```bash
curl http://localhost:5000/api/sync/wordpress/test
# Deve retornar: { "success": true, ... }
```

### 3. Buscar Dados do WordPress
```bash
curl http://localhost:5000/api/sync/wordpress/fichas
# Retorna array de fichas do WordPress
```

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"
- Verifica: `mysql -h localhost -u root -p`
- Verifica BD: `USE wp_migracion; SHOW TABLES;`
- Actualiza credenciais no `.env`

### Erro: "CORS error" no frontend
- Verifica se backend está a rodar em `http://localhost:5000`
- Verifica frontend `.env`: `REACT_APP_API_BASE_URL=http://localhost:5000`

### Erro: "Cannot find module 'axios'"
```bash
cd backend
npm install axios
```

### Frontend não vê dados
- Abre Console (F12) → Network tab
- Verifica chamada GET a `http://localhost:5000/api/fichas`
- Se erro, vê a resposta

## 📝 Comandos Úteis

```bash
# Backend - desenvolvimento com auto-reload
npm run dev

# Backend - produção
npm start

# Frontend - desenvolvimento
npm start

# Frontend - build para produção
npm run build

# Frontend - testar build localmente
npm install -g serve
serve -s build -l 3000
```

## 🔐 Segurança - NÃO FAZER COMMIT DE `.env`

O ficheiro `.env` está no `.gitignore` por padrão. Se não estiver:

```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

## 🚀 Próximo Passo: Deploy para Render

Quando tudo funciona localmente, segue o guia em [SINCRONIZACAO_E_DEPLOY.md](SINCRONIZACAO_E_DEPLOY.md)
