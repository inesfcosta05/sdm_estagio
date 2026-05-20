# ✅ ALTERAÇÕES IMPLEMENTADAS

## 📦 Dependências Adicionadas
- `axios` → Para fazer chamadas HTTP à API REST do WordPress

## 📝 Ficheiros Modificados

### 1. `/backend/package.json`
✅ Adicionado `"axios": "^1.7.0"` às dependências

### 2. `/backend/server.js`
✅ Importado axios no topo
✅ Adicionados 4 novos endpoints para sincronização:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/sync/wordpress/test` | GET | Testa conexão com WordPress |
| `/api/sync/wordpress/fichas` | GET | Busca fichas do WordPress via API |
| `/api/sync/wordpress/clientes` | GET | Busca clientes do WordPress via API |
| `/api/sync/trigger` | POST | Aciona sincronização manual |

### 3. `/backend/.env.example`
✅ Actualizado com variáveis para WordPress:
- `WP_API_URL` → URL da API REST do WordPress
- `WP_API_USER` → Utilizador WordPress (opcional)
- `WP_API_PASS` → Password WordPress (opcional)
- `SYNC_SECRET` → Token para sincronização segura

### 4. `/frontend/.env.example`
✅ Actualizado com comentários

### 5. `/SETUP_LOCAL.md`
✅ Criado guia completo de instalação local

---

## 🚀 PRÓXIMOS PASSOS

### 1️⃣ Configurar Backend Local
```bash
cd backend

# Copiar ficheiro de exemplo
cp .env.example .env

# Editar .env com:
# - BD: DB_HOST, DB_USER, DB_PASS, DB_NAME
# - WordPress (opcional): WP_API_URL=https://seusite.com/wp-json
```

### 2️⃣ Testar Backend
```bash
npm run dev
# Vai ver: ✅ MySQL OK!
```

### 3️⃣ Testar Endpoints (em outro terminal)
```bash
# Fichas locais
curl http://localhost:5000/api/fichas

# Se configurou WordPress:
curl http://localhost:5000/api/sync/wordpress/test
curl http://localhost:5000/api/sync/wordpress/fichas
```

### 4️⃣ Configurar Frontend
```bash
cd ../frontend

# Copiar .env.example se não tiver .env
cp .env.example .env

# Confirmar:
# REACT_APP_API_BASE_URL=http://localhost:5000
```

### 5️⃣ Testar Frontend
```bash
npm install  # Se ainda não fez
npm start
# Abre http://localhost:3000
```

---

## 📖 COMO USAR A SINCRONIZAÇÃO

### Cenário 1: Apenas Ler do WordPress
Se quer que o frontend mostre dados do WordPress:

```javascript
// No frontend, substituir chamadas:
// De: GET /api/fichas
// Para: GET /api/sync/wordpress/fichas
```

### Cenário 2: Sincronizar para BD Local
Se quer guardar dados do WordPress na sua BD:

1. Chamar: `GET /api/sync/wordpress/fichas`
2. Receber array de fichas
3. Fazer POST para: `POST /api/fichas` com cada uma

### Cenário 3: Híbrido
Mostrar dados da BD local + WordPress juntos

```javascript
const local = await fetch('http://localhost:5000/api/fichas');
const wordpress = await fetch('http://localhost:5000/api/sync/wordpress/fichas');
const todos = [...local, ...wordpress];
```

---

## 🔐 IMPORTANTE - SEGURANÇA

### Antes de Fazer Commit
```bash
# Certificar que .env está no .gitignore
cat .gitignore | grep ".env"

# Se não estiver:
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

### Credenciais do WordPress
- **NUNCA** fazer commit do `.env` com credenciais
- No Render, adicionar variáveis no painel (não em ficheiros)
- Se usar App Passwords em WordPress, é mais seguro que passwords

---

## ✅ CHECKLIST FINAL

- [ ] Backend: `npm install axios` (✅ Feito)
- [ ] Backend: Copiar `.env` e configurar
- [ ] Frontend: Copiar `.env` e configurar
- [ ] Testar backend: `npm run dev`
- [ ] Testar frontend: `npm start`
- [ ] Testar endpoints: `curl http://localhost:5000/api/fichas`
- [ ] (Opcional) Testar WordPress: `curl http://localhost:5000/api/sync/wordpress/test`

---

## 📞 PRÓXIMO PASSO: DEPLOY PARA RENDER

Quando tudo funciona localmente, segue: [SINCRONIZACAO_E_DEPLOY.md](SINCRONIZACAO_E_DEPLOY.md)

Ou se tiveres dúvidas, posso ajudar com configurações específicas! 🚀
