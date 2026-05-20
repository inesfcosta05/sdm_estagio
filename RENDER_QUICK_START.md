# 🎯 RENDER DEPLOYMENT - O Que Já Está Feito

## ✅ Ficheiros Criados/Atualizados Automaticamente

| Ficheiro | O que faz |
|----------|-----------|
| `backend/Procfile` | ✅ Diz ao Render como começar o servidor |
| `backend/.env.example` | ✅ Template com todas as variáveis necessárias |
| `backend/schema.sql` | ✅ Script SQL para criar tabelas na BD online |
| `frontend/.env.example` | ✅ Template React com URL da API |
| `.gitignore` | ✅ Protege .env e node_modules |
| `RENDER_DEPLOY.md` | ✅ Guia completo (54+ linhas de instruções) |
| `RENDER_SETUP_CHECKLIST.md` | ✅ Checklist passo-a-passo |

---

## 🔴 O QUE TENS QUE FAZER (TU)

### **1️⃣ GITHUB** (5 minutos)
```bash
# Na pasta do projeto
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### **2️⃣ BASE DE DADOS** (10 minutos)
- Vai para **Railway.app** ou **PlanetScale.com**
- Cria MySQL database
- Copia: `HOST`, `PORT`, `USER`, `PASSWORD`, `DATABASE_NAME`
- Conecta e cola o conteúdo de `backend/schema.sql`

### **3️⃣ RENDER - BACKEND** (5 minutos)
- Render.com → New Web Service → GitHub
- Seleciona repository
- Config:
  - Name: `projeto-fichas-backend`
  - Build: `cd backend && npm install`
  - Start: `node backend/server.js`
- Adiciona Environment Variables:
  ```
  DB_HOST=seu-host-railway
  DB_USER=root
  DB_PASS=sua-password
  DB_NAME=railway
  PORT=5000
  FRONTEND_URLS=https://seu-frontend.onrender.com
  ```

### **4️⃣ RENDER - FRONTEND** (5 minutos)
- Render.com → New Static Site → GitHub (mesmo repo)
- Config:
  - Name: `projeto-fichas-frontend`
  - Build: `cd frontend && npm install && npm run build`
  - Publish: `frontend/build`
- Adiciona Environment Variable:
  ```
  REACT_APP_API_BASE_URL=https://seu-backend.onrender.com
  ```

### **5️⃣ TESTAR** (2 minutos)
```bash
# Terminal
curl https://seu-backend.onrender.com/api/fichas

# Navegador
https://seu-frontend.onrender.com
```

---

## 📊 Resumo de Tempo

| Tarefa | Tempo | Quem |
|--------|-------|-----|
| Push GitHub | 2 min | TU |
| Setup Railway BD | 10 min | TU |
| Criar Backend Render | 5 min | TU |
| Criar Frontend Render | 5 min | TU |
| Criar tabelas SQL | 5 min | TU |
| **TOTAL** | **≈ 30 min** | TU |

---

## 🚀 Próximo Passo

**Abre agora:**
- 👉 [RENDER_SETUP_CHECKLIST.md](RENDER_SETUP_CHECKLIST.md) - Instruções completas passo-a-passo

---

## 📞 Possíveis Dúvidas

**P: Por onde começo?**  
R: Abrir `RENDER_SETUP_CHECKLIST.md` e seguir passo 1 (GitHub push)

**P: O que é que falta?**  
R: Só as credenciais (DB, URLs) - código tudo pronto

**P: Vai dar trabalho?**  
R: Não, é tudo config em UI - sem programação

**P: Quanto custa?**  
R: Railway BD: grátis até $5/mês  
Render: grátis (com limite de hora de inatividade)

---

**Status: 85% pronto - Apenas config manual necessária** ✨
