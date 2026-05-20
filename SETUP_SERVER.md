# 🖥️ SETUP NO SERVIDOR DA EMPRESA

## 📋 Pré-requisitos

Servidor deve ter:
- Node.js 18.20.0+ (recomendado 20.x)
- MySQL 5.7+ ou MariaDB
- PM2 ou similar para process management
- Nginx ou Apache (reverse proxy)
- Git (opcional)

---

## 🔧 PASSO 1: Preparar Servidor

### 1.1 Instalar Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Verificar
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 1.2 Instalar MySQL

```bash
# Ubuntu/Debian
sudo apt-get install -y mysql-server

# CentOS/RHEL
sudo yum install -y mysql-server

# Iniciar
sudo systemctl start mysql
sudo systemctl enable mysql

# Verificar
mysql --version
```

### 1.3 Criar Utilizador MySQL (Opcional)

```bash
mysql -u root -p

CREATE USER 'appuser'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON wp_migracion.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 📦 PASSO 2: Descompactar e Estruturar Projeto

```bash
# Descompactar
unzip projeto_fichas_ENTREGA.zip -d /var/www/

# Pasta raiz
cd /var/www/projeto_fichas

# Estrutura final
ls -la
# backend/
# frontend/
# wp_migracion_dump.sql
# SETUP_SERVER.md
```

---

## 🗄️ PASSO 3: Importar Base de Dados

### 3.1 Criar Database Vazia

```bash
mysql -u root -p -e "CREATE DATABASE wp_migracion DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3.2 Importar Dump

```bash
# Opção A: Com password inline (menos seguro)
mysql -u root -p'SEU_PASSWORD' wp_migracion < /var/www/projeto_fichas/wp_migracion_dump.sql

# Opção B: Com prompt (recomendado)
mysql -u root -p wp_migracion < /var/www/projeto_fichas/wp_migracion_dump.sql
# Digita password quando pedido

# Verificar
mysql -u root -p wp_migracion -e "SHOW TABLES;" | wc -l
# Deve mostrar: 43 (42 tabelas + header)
```

---

## ⚙️ PASSO 4: Configurar Backend

### 4.1 Instalar Dependências

```bash
cd /var/www/projeto_fichas/backend

npm install
# Deve instalar: express, mysql2, cors, dotenv, axios, etc
```

### 4.2 Criar .env

```bash
# Copiar template
cp .env.example .env

# Editar
nano .env  # ou vim, ou editor favorito
```

**Conteúdo do .env:**
```
# ============================================
# BASE DE DADOS
# ============================================
DB_HOST=localhost
DB_USER=root
DB_PASS=seu_password_mysql
DB_NAME=wp_migracion
PORT=5000

# ============================================
# FRONTEND (CORS)
# ============================================
# Se em localhost:
FRONTEND_URL=http://localhost:3000

# Se em servidor com domínio:
FRONTEND_URLS=https://seu-dominio.com,https://www.seu-dominio.com

# ============================================
# WORDPRESS SYNC (Se aplicável)
# ============================================
# Deixar vazio se não sincronizar com WP
WP_API_URL=https://seu-wordpress.com/wp-json
WP_SYNC_ENABLED=false

# ============================================
# ENVIRONMENT
# ============================================
NODE_ENV=production
```

### 4.3 Testar Backend

```bash
# Teste rápido
npm start

# Deve ver:
# ✅ MySQL OK!
# Servidor rodando em http://localhost:5000

# Ctrl+C para parar
```

---

## 🎨 PASSO 5: Configurar Frontend

### 5.1 Build React

```bash
cd /var/www/projeto_fichas/frontend

# Instalar
npm install

# Gerar build
npm run build

# Verifica pasta build/
ls build/
# Deve ter: index.html, static/, etc
```

### 5.2 Servir Frontend (Nginx)

Criar ficheiro de config: `/etc/nginx/sites-available/fichas`

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Redirect HTTP → HTTPS (opcional, ver HTTPS abaixo)
    # return 301 https://$server_name$request_uri;

    # Frontend React
    location / {
        root /var/www/projeto_fichas/frontend/build;
        try_files $uri /index.html;
        expires 1d;
    }

    # API Backend
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets
    location /static {
        root /var/www/projeto_fichas/frontend/build;
        expires 30d;
    }
}
```

Ativar:
```bash
sudo ln -s /etc/nginx/sites-available/fichas /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar sintaxe
sudo systemctl reload nginx
```

---

## 🔄 PASSO 6: Process Manager (PM2)

### 6.1 Instalar PM2 Globalmente

```bash
npm install -g pm2

# Verificar
pm2 --version
```

### 6.2 Iniciar Backend com PM2

```bash
cd /var/www/projeto_fichas/backend

# Iniciar
pm2 start server.js --name fichas-backend --env production

# Monitorar
pm2 monit

# Status
pm2 status
```

### 6.3 PM2 Startup (Reinicia após reboot)

```bash
# Gerar script
pm2 startup

# Guardar processos atuais
pm2 save

# Testar
sudo reboot  # Depois de reboot, PM2 deve estar rodando
```

### 6.4 Logs

```bash
# Ver logs em tempo real
pm2 logs fichas-backend

# Ver arquivo de log
pm2 show fichas-backend
```

---

## 🔒 PASSO 7: HTTPS/SSL (Certbot)

### 7.1 Instalar Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx

# ou para Apache:
# sudo apt-get install -y certbot python3-certbot-apache
```

### 7.2 Gerar Certificado

```bash
sudo certbot certonly --nginx -d seu-dominio.com -d www.seu-dominio.com

# Ou interactive:
sudo certbot certonly --standalone
```

### 7.3 Atualizar Nginx para HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # (resto da config igual)
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    return 301 https://$server_name$request_uri;
}
```

Recarregar:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 7.4 Renovação Automática

```bash
# Testar
sudo certbot renew --dry-run

# Automático (roda 2x/dia)
sudo systemctl enable certbot.timer
```

---

## 🧪 PASSO 8: Testar Aplicação

### 8.1 Testar Backend API

```bash
# Teste básico
curl http://localhost:5000/api/fichas

# Resposta esperada:
# {"fichas":[...]} ou []
```

### 8.2 Testar Frontend

Abrir navegador:
```
http://seu-dominio.com
ou
https://seu-dominio.com (se com SSL)
```

Esperar carregar React app.

### 8.3 Testar Autenticação

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost","password":"senha"}'

# Resposta com token
```

---

## 📊 PASSO 9: Monitoração

### 9.1 Ver Recursos

```bash
# CPU, Memória, Disco
pm2 monit

# Sistema
free -h  # Memória
df -h    # Disco
top      # Processos
```

### 9.2 Ver Logs

```bash
# Backend
pm2 logs fichas-backend

# Nginx
sudo tail -f /var/log/nginx/error.log

# MySQL
sudo tail -f /var/log/mysql/error.log
```

---

## 🔄 PASSO 10: Sincronização com WordPress

Se quiser sincronizar dados do WordPress:

### 10.1 Configurar .env

```
WP_API_URL=https://seu-wordpress.com/wp-json
WP_SYNC_ENABLED=true
SYNC_INTERVAL=300000  # 5 minutos
```

### 10.2 Testar Sync

```bash
curl http://localhost:5000/api/sync/wordpress/test

# Resposta:
# {"success":true,"message":"WordPress conexão OK"}
```

---

## 🚨 Troubleshooting

### "Cannot connect to database"
```bash
# Verificar MySQL
mysql -u root -p -e "SELECT 1"

# Verificar credenciais em .env
# Testar conexão
mysql -h localhost -u root -p -e "USE wp_migracion; SHOW TABLES;"
```

### "Application failed to start"
```bash
# Ver logs
pm2 logs fichas-backend

# Verificar PORT não está em uso
lsof -i :5000

# Matar processo na porta
kill -9 <PID>
```

### "CORS error"
```bash
# Verificar FRONTEND_URLS em .env
# Deve ser EXATAMENTE o domínio do navegador
# Sem trailing slash
# Com protocolo (http:// ou https://)
```

### "Build falhou"
```bash
# Testar build localmente
cd frontend
npm run build

# Ver erros específicos
npm run build 2>&1 | tail -50
```

---

## 📝 Checklist Deployment

- [ ] Node.js instalado (v20+)
- [ ] MySQL funcionando
- [ ] Database criado: wp_migracion
- [ ] Dump importado (42 tabelas)
- [ ] Backend .env configurado
- [ ] Backend testado com `npm start`
- [ ] Frontend build criado
- [ ] Nginx/Apache configurado
- [ ] PM2 rodando backend
- [ ] SSL/HTTPS ativo
- [ ] API respondendo: `/api/fichas`
- [ ] Frontend carrega em navegador
- [ ] Login funciona
- [ ] Dados aparecem no frontend

---

## 📞 Suporte

Se houver erros:
1. Verificar logs: `pm2 logs fichas-backend`
2. Verificar .env tem todos campos
3. Verificar conectividade: `mysql -u root -p`
4. Contactar Inês para debug

---

**Deploy completo! 🚀**
