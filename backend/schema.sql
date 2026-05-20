-- ============================================
-- SCRIPT SQL PARA CRIAR SCHEMA DE BASE
-- ============================================
-- 
-- USE ESTE SCRIPT para criar as tabelas necessárias
-- na tua base de dados Render/PlanetScale/Railway
--
-- Passos:
-- 1. Conecta-te à BD: mysql -h host -u root -p
-- 2. Seleciona a BD: USE railway;
-- 3. Cola o conteúdo deste ficheiro

-- ============================================
-- TABELAS PRINCIPAIS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255),
    password_hash VARCHAR(255),
    papel ENUM('admin', 'editor', 'contributor') DEFAULT 'contributor',
    preferences TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_papel (papel)
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT,
    token VARCHAR(500),
    token_expiry DATETIME,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expiry (token_expiry)
);

CREATE TABLE IF NOT EXISTS app_passwords (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    nome VARCHAR(255),
    senha_hash VARCHAR(255),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS fichas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(500),
    descricao LONGTEXT,
    estado VARCHAR(50),
    criado_por INT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (criado_por) REFERENCES users(id),
    INDEX idx_estado (estado),
    INDEX idx_criado_em (criado_em),
    INDEX idx_atualizado_em (atualizado_em)
);

CREATE TABLE IF NOT EXISTS clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    empresa VARCHAR(255),
    morada TEXT,
    senha_visibilidade VARCHAR(255),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_nome (nome),
    INDEX idx_empresa (empresa)
);

CREATE TABLE IF NOT EXISTS paginas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(500),
    slug VARCHAR(255) UNIQUE,
    conteudo LONGTEXT,
    estado VARCHAR(50),
    criado_por INT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (criado_por) REFERENCES users(id),
    INDEX idx_slug (slug),
    INDEX idx_estado (estado)
);

CREATE TABLE IF NOT EXISTS wp_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    wp_id INT UNIQUE,
    titulo VARCHAR(500),
    conteudo LONGTEXT,
    data_criacao DATETIME,
    data_atualizacao DATETIME,
    sincronizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wp_id (wp_id),
    INDEX idx_data_atualizacao (data_atualizacao)
);

-- ============================================
-- DADOS INICIAIS (OPCIONAL)
-- ============================================

-- Cria utilizador admin de teste
INSERT INTO users (email, nome, password_hash, papel) 
VALUES ('admin@localhost', 'Administrador', 'hashed_password_aqui', 'admin')
ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id);

-- ============================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================

ALTER TABLE fichas ADD INDEX idx_criado_por (criado_por);
ALTER TABLE paginas ADD INDEX idx_criado_por (criado_por);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Descomente para verificar se as tabelas foram criadas:
-- SHOW TABLES;
-- DESCRIBE fichas;
-- DESCRIBE clientes;
-- DESCRIBE users;
