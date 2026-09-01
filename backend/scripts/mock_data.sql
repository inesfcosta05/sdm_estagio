-- =====================================================================
-- DADOS FICTÍCIOS PARA DEMO EM VÍDEO — sdm_estagio
-- Gerado automaticamente. Nenhum dado aqui corresponde a clientes,
-- utilizadores ou contactos reais da Celeuma.
--
-- Todos os registos são identificáveis e removíveis em bloco:
--   - clients.legacy_id  BETWEEN 900001 AND 900999
--   - fichas.legacy_id   BETWEEN 990001 AND 990999
--   - users.id           BETWEEN 9001 AND 9099 (email a terminar em @demo.local)
--   - wp_postmeta.post_id BETWEEN 990001 AND 990999 (chaves ligadas às fichas acima)
--
-- Ver mock_data_cleanup.sql para reverter tudo isto de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ESTRUTURA DAS TABELAS (IF NOT EXISTS — seguro mesmo que já existam)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name TEXT NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  nome VARCHAR(100),
  apelido VARCHAR(100),
  alcunha VARCHAR(50),
  nome_mostrado VARCHAR(250),
  bio LONGTEXT,
  site_url VARCHAR(100),
  password_hash VARCHAR(255),
  registado DATETIME,
  imagem_url LONGTEXT,
  preferences TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  legacy_id INT UNIQUE,
  denominacao_fiscal VARCHAR(255),
  contacto_empresa VARCHAR(100),
  pessoa_contacto_nome VARCHAR(255),
  pessoa_contacto_cargo VARCHAR(255),
  pessoa_contacto_telefone_email VARCHAR(255),
  morada TEXT,
  nif VARCHAR(20),
  comercial_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  author VARCHAR(100),
  estado VARCHAR(50),
  visibilidade VARCHAR(50),
  publicado_em DATETIME,
  senha_visibilidade VARCHAR(255),
  observacoes TEXT,
  localidade VARCHAR(255),
  INDEX idx_nif (nif),
  INDEX idx_comercial_id (comercial_id)
);

CREATE TABLE IF NOT EXISTS fichas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  legacy_id INT UNIQUE,
  client_legacy_id INT,
  title TEXT,
  post_status VARCHAR(50),
  post_visibility VARCHAR(50),
  post_date DATETIME,
  author VARCHAR(100),
  tipo_contacto VARCHAR(50),
  pessoa_contacto VARCHAR(255),
  contacto TEXT,
  data_contacto DATE,
  inicio_contacto TIME,
  fim_contacto TIME,
  motivo_resumo_contacto TEXT,
  contacto_efetuado TINYINT(1),
  follow_up TINYINT(1),
  novo_contacto TINYINT(1),
  tipo_proximo_contacto VARCHAR(50),
  data_proximo_contacto DATE,
  data_apresentacao_proposta DATE,
  estado_proposta VARCHAR(50),
  descritivo_proposta TEXT,
  servicos_proposta TEXT,
  valor_total_proposta DECIMAL(12,2),
  possibilidade_negocio VARCHAR(20),
  motivo_possibilidade_negocio TEXT,
  servicos_adjudicados TEXT,
  valor_total_adjudicado DECIMAL(12,2),
  descritivo_fatura TEXT,
  valor_fatura DECIMAL(12,2),
  data_fatura DATE,
  data_prevista_recebimento DATE,
  data_ultimo_contacto_financeiro DATE,
  relatorio_errado TINYINT(1) DEFAULT 0,
  porque_relatorio_errado TEXT,
  assunto_tratado TINYINT(1) DEFAULT 0,
  anexos TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client_legacy_id (client_legacy_id),
  INDEX idx_author (author),
  INDEX idx_post_status (post_status)
);

CREATE TABLE IF NOT EXISTS wp_postmeta (
  meta_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  meta_key VARCHAR(255) DEFAULT NULL,
  meta_value LONGTEXT,
  INDEX idx_post_id (post_id),
  INDEX idx_meta_key (meta_key(191))
);

START TRANSACTION;

-- ---------------------------------------------------------------------
-- UTILIZADORES (admin, moderador = contributor, 2x editor)
-- Password para todas as contas de demo: Demo1234!
-- ---------------------------------------------------------------------
INSERT INTO users (id, name, email, role, nome, apelido, nome_mostrado, password_hash, registado) VALUES (9001, 'Ana Administradora', 'admin@demo.local', 'admin', 'Ana', 'Administradora', 'Ana Administradora', '7dbb7f051b44d7d54584a7bc6c32f00da5a3b5e6973485b9fb176fe56346b3e3', NOW());
INSERT INTO users (id, name, email, role, nome, apelido, nome_mostrado, password_hash, registado) VALUES (9002, 'Miguel Moderador', 'moderador@demo.local', 'contributor', 'Miguel', 'Moderador', 'Miguel Moderador', '7dbb7f051b44d7d54584a7bc6c32f00da5a3b5e6973485b9fb176fe56346b3e3', NOW());
INSERT INTO users (id, name, email, role, nome, apelido, nome_mostrado, password_hash, registado) VALUES (9003, 'Elsa Editora', 'editora1@demo.local', 'editor', 'Elsa', 'Editora', 'Elsa Editora', '7dbb7f051b44d7d54584a7bc6c32f00da5a3b5e6973485b9fb176fe56346b3e3', NOW());
INSERT INTO users (id, name, email, role, nome, apelido, nome_mostrado, password_hash, registado) VALUES (9004, 'Duarte Editor', 'editor2@demo.local', 'editor', 'Duarte', 'Editor', 'Duarte Editor', '7dbb7f051b44d7d54584a7bc6c32f00da5a3b5e6973485b9fb176fe56346b3e3', NOW());

-- ---------------------------------------------------------------------
-- CLIENTES (12)
-- ---------------------------------------------------------------------
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900001, 'Padaria Aurora, Lda.', '232111222', 'Carla Aurora', 'Gerente', 'carla.aurora@demo.local', 'Rua das Flores, 12', 'Viseu', '599111222', 'Cliente fidelizado há 3 anos.', 9001, '9001', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900002, 'TechNova Soluções Digitais, Lda.', '239222333', 'Miguel Tecno', 'Diretor Técnico', 'miguel.tecno@demo.local', 'Av. Central, 45', 'Coimbra', '599222333', 'Interessados em renovar o site institucional.', 9002, '9002', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900003, 'Verde Horizonte Jardins, Unip. Lda.', '213333444', 'Sofia Verde', 'Proprietária', 'sofia.verde@demo.local', 'Rua do Jardim, 8', 'Lisboa', '599333444', 'Pequeno negócio local, atendimento próximo.', 9003, '9003', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900004, 'Construções Silva & Filhos, Lda.', '225444555', 'João Silva', 'Sócio-Gerente', 'joao.silva@demo.local', 'Rua da Obra, 100', 'Porto', '599444555', NULL, 9002, '9002', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900005, 'Ótica Visão Clara', '234555666', 'Marta Visão', 'Gerente', 'marta.visao@demo.local', 'Praça da Ótica, 3', 'Aveiro', '599555666', NULL, 9004, '9004', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900006, 'Restaurante O Bacalhau Feliz, Lda.', '232666777', 'Pedro Bacalhau', 'Chef / Proprietário', 'pedro.bacalhau@demo.local', 'Largo do Peixe, 5', 'Viseu', '599666777', 'Quer menu digital com QR code.', 9001, '9001', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900007, 'Moda Elegance Boutique', '253777888', 'Inês Elegance', 'Gerente', 'ines.elegance@demo.local', 'Rua da Moda, 22', 'Braga', '599777888', NULL, 9003, '9003', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900008, 'AutoPeças Rápido, Lda.', '244888999', 'Rui Rápido', 'Sócio', 'rui.rapido@demo.local', 'Zona Industrial, Lote 9', 'Leiria', '599888999', NULL, 9004, '9004', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900009, 'Clínica Dentária Sorriso Perfeito', '271999000', 'Dra. Beatriz Sorrisos', 'Diretora Clínica', 'beatriz.sorrisos@demo.local', 'Av. da Saúde, 15', 'Guarda', '599999000', 'Cliente exigente, valoriza rapidez de resposta.', 9002, '9002', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900010, 'Imobiliária Novo Lar, Lda.', '232100200', 'Tiago Lar', 'Consultor Sénior', 'tiago.lar@demo.local', 'Rua do Comércio, 30', 'Viseu', '599100200', NULL, 9001, '9001', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900011, 'Gráfica Impressão Total', '239200300', 'Helena Gráfica', 'Gerente', 'helena.grafica@demo.local', 'Rua da Imprensa, 7', 'Coimbra', '599200300', NULL, 9003, '9003', 'publicado', 'public', NOW(), NOW(), NOW());
INSERT INTO clients (legacy_id, denominacao_fiscal, contacto_empresa, pessoa_contacto_nome, pessoa_contacto_cargo, pessoa_contacto_telefone_email, morada, localidade, nif, observacoes, comercial_id, author, estado, visibilidade, created_at, updated_at, publicado_em) VALUES (900012, 'Farmácia Bem-Estar', '272300400', 'Dr. André Bem-Estar', 'Diretor Técnico', 'andre.bemestar@demo.local', 'Praça Central, 1', 'Castelo Branco', '599300400', 'Renovação de contrato prevista para breve.', 9004, '9004', 'publicado', 'public', NOW(), NOW(), NOW());

-- ---------------------------------------------------------------------
-- FICHAS — 19 registos (contactos + propostas + adjudicadas)
-- ---------------------------------------------------------------------
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990001, 900001, '[DEMO] Padaria Aurora — Primeiro contacto', 'publish', 'public', '2026-06-10', '9001', 'Telefónico', '2026-06-10', 'Primeiro contacto — apresentação dos serviços de comunicação digital.', 1, 0, 1, 'Visita', '2026-09-15', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990002, 900001, '[DEMO] Padaria Aurora — Visita às instalações para avaliar necessidades de imagem de marca', 'publish', 'public', '2026-07-22', '9001', 'Visita', '2026-07-22', 'Visita às instalações para avaliar necessidades de imagem de marca.', 1, 1, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990003, 900002, '[DEMO] TechNova Soluções Digitais — Pedido de orçamento para renovação de site institucional', 'publish', 'public', '2026-06-05', '9002', 'Email', '2026-06-05', 'Pedido de orçamento para renovação de site institucional.', 1, 0, 1, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990004, 900002, '[DEMO] TechNova Soluções Digitais — Envio de proposta de renovação de site institucional', 'publish', 'public', '2026-06-12', '9002', 'Email', '2026-06-12', 'Envio de proposta de renovação de site institucional.', 1, 0, 0, NULL, NULL, 1, '2026-06-12', 'Adjudicada', 'Redesenho completo do site institucional, com sistema de gestão de conteúdos e otimização para telemóvel.', 2400, 2400, 'Fatura relativa ao desenvolvimento do novo site institucional.', 2400, '2026-07-05', '2026-08-05', '2026-07-20', NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990005, 900003, '[DEMO] Verde Horizonte Jardins — Reunião inicial para levantamento de necessidades de marketing digital', 'publish', 'public', '2026-08-01', '9003', 'Reunião', '2026-08-01', 'Reunião inicial para levantamento de necessidades de marketing digital.', 1, 0, 0, NULL, NULL, 0, NULL, 'A Orçamentar', 'Campanha de redes sociais para divulgação de serviços de jardinagem.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990006, 900004, '[DEMO] Construções Silva & Filhos — Proposta de catálogo digital de projetos', 'publish', 'public', '2026-07-10', '9002', 'Telefónico', '2026-07-10', 'Proposta de catálogo digital de projetos.', 1, 0, 0, NULL, NULL, 0, '2026-07-15', 'Não Adjudicada', 'Catálogo digital com portfólio de obras realizadas.', 900, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990007, 900004, '[DEMO] Construções Silva & Filhos — Contacto inicial', 'publish', 'public', '2026-07-10', '9002', 'Telefónico', '2026-07-10', 'Contacto inicial.', 1, 0, 1, 'Telefónico', '2026-09-28', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990008, 900005, '[DEMO] Ótica Visão Clara — Proposta de campanha para dia mundial da visão', 'publish', 'public', '2026-06-20', '9004', 'Email', '2026-06-20', 'Proposta de campanha para dia mundial da visão.', 1, 0, 0, NULL, NULL, 0, '2026-06-25', 'Desinteresse', 'Campanha sazonal para o dia mundial da visão.', 350, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990009, 900006, '[DEMO] Restaurante O Bacalhau Feliz — Visita ao restaurante para avaliar o espaço e o menu atual', 'publish', 'public', '2026-08-03', '9001', 'Visita', '2026-08-03', 'Visita ao restaurante para avaliar o espaço e o menu atual.', 1, 0, 1, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990010, 900006, '[DEMO] Restaurante O Bacalhau Feliz — Apresentação de proposta de menu digital com QR code', 'publish', 'public', '2026-08-10', '9001', 'Reunião', '2026-08-10', 'Apresentação de proposta de menu digital com QR code.', 1, 0, 0, NULL, NULL, 1, '2026-08-10', 'Adjudicada', 'Menu digital acessível por QR code, atualizável pelo próprio cliente.', 600, 600, 'Fatura do menu digital — pagamento pendente de confirmação de data.', 600, NULL, '2026-09-30', NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990011, 900007, '[DEMO] Moda Elegance Boutique — Visita à loja para propor sessão fotográfica de coleção outono/inverno', 'publish', 'public', '2026-08-14', '9003', 'Visita', '2026-08-14', 'Visita à loja para propor sessão fotográfica de coleção outono/inverno.', 1, 1, 1, 'Reunião', '2026-09-10', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990012, 900008, '[DEMO] AutoPeças Rápido — Tentativa de contacto', 'publish', 'public', '2026-07-28', '9004', 'Telefónico', '2026-07-28', 'Tentativa de contacto — sem resposta, a remarcar.', 0, 0, 1, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990013, 900009, '[DEMO] Clínica Dentária Sorriso Perfeito — Reunião para apresentação de serviços de comunicação digital', 'publish', 'public', '2026-08-05', '9002', 'Reunião', '2026-08-05', 'Reunião para apresentação de serviços de comunicação digital.', 1, 0, 1, 'Visita', '2026-09-22', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990014, 900009, '[DEMO] Clínica Dentária Sorriso Perfeito — Envio de proposta de gestão de redes sociais', 'publish', 'public', '2026-08-12', '9002', 'Email', '2026-08-12', 'Envio de proposta de gestão de redes sociais.', 1, 0, 0, NULL, NULL, 0, '2026-08-12', 'Enviada', 'Gestão mensal de redes sociais com produção de conteúdo fotográfico.', 450, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990015, 900010, '[DEMO] Imobiliária Novo Lar — Proposta de campanha de anúncios para novos empreendimentos', 'publish', 'public', '2026-07-01', '9001', 'Reunião', '2026-07-01', 'Proposta de campanha de anúncios para novos empreendimentos.', 1, 0, 0, NULL, NULL, 1, '2026-07-01', 'Adjudicada', 'Campanha de anúncios online para divulgação de novos empreendimentos imobiliários.', 1200, 1200, 'Fatura da campanha de anúncios — 1º trimestre.', 1200, '2026-07-25', '2026-08-25', '2026-08-10', NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990016, 900010, '[DEMO] Imobiliária Novo Lar — Reunião inicial', 'publish', 'public', '2026-07-01', '9001', 'Reunião', '2026-07-01', 'Reunião inicial.', 1, 0, 1, 'Reunião', '2026-10-01', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990017, 900011, '[DEMO] Gráfica Impressão Total — Esclarecimento de dúvidas sobre serviços de design gráfico', 'publish', 'public', '2026-08-18', '9003', 'Telefónico', '2026-08-18', 'Esclarecimento de dúvidas sobre serviços de design gráfico — processo encerrado.', 1, 0, 1, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990018, 900012, '[DEMO] Farmácia Bem-Estar — Primeiro contacto sobre renovação de identidade visual', 'publish', 'public', '2026-06-15', '9004', 'Email', '2026-06-15', 'Primeiro contacto sobre renovação de identidade visual.', 1, 0, 1, 'Email', '2026-09-05', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO fichas (legacy_id, client_legacy_id, title, post_status, post_visibility, post_date, author, tipo_contacto, data_contacto, motivo_resumo_contacto, contacto_efetuado, follow_up, novo_contacto, tipo_proximo_contacto, data_proximo_contacto, assunto_tratado, data_apresentacao_proposta, estado_proposta, descritivo_proposta, valor_total_proposta, valor_total_adjudicado, descritivo_fatura, valor_fatura, data_fatura, data_prevista_recebimento, data_ultimo_contacto_financeiro, created_at, updated_at) VALUES (990019, 900012, '[DEMO] Farmácia Bem-Estar — Visita de acompanhamento', 'publish', 'public', '2026-08-20', '9004', 'Visita', '2026-08-20', 'Visita de acompanhamento — renovação de contrato prevista.', 1, 1, 0, 'Visita', '2026-09-18', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());

-- ---------------------------------------------------------------------
-- wp_postmeta — espelha os dados de proposta/adjudicação acima no
-- formato que GET /api/fichas/propostas-meta realmente lê (datas em
-- YYYYMMDD), para que apareçam corretamente nos relatórios.
-- ---------------------------------------------------------------------
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'descritivo_da_proposta', 'Redesenho completo do site institucional, com sistema de gestão de conteúdos e otimização para telemóvel.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'valor_total_da_proposta', '2400');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'estado_da_proposta', 'Adjudicada');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'data_de_apresentacao_da_proposta', '20260612');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos_0_servico', 'Design e desenvolvimento de website');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos_0_valor', '2000€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos_1_servico', 'Otimização SEO inicial');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos_1_valor', '400€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'valor_total_adjudicado', '2400');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'descritivo_da_fatura', 'Fatura relativa ao desenvolvimento do novo site institucional.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'valor_da_fatura', '2400');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'data_da_fatura', '20260705');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'data_prevista_para_o_recebimento', '20260805');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'data_do_ultimo_contacto_financeiro', '20260720');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos-adjudicados_0_servico', 'Design e desenvolvimento de website');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos-adjudicados_0_valor', '2000€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos-adjudicados_1_servico', 'Otimização SEO inicial');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990004, 'servicos-adjudicados_1_valor', '400€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990005, 'descritivo_da_proposta', 'Campanha de redes sociais para divulgação de serviços de jardinagem.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990005, 'estado_da_proposta', 'A Orçamentar');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990005, 'servicos_0_servico', 'Gestão de redes sociais (mensal)');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990005, 'servicos_0_valor', '150€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990006, 'descritivo_da_proposta', 'Catálogo digital com portfólio de obras realizadas.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990006, 'valor_total_da_proposta', '900');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990006, 'estado_da_proposta', 'Não Adjudicada');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990006, 'data_de_apresentacao_da_proposta', '20260715');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990006, 'servicos_0_servico', 'Catálogo digital de projetos');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990006, 'servicos_0_valor', '900€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990008, 'descritivo_da_proposta', 'Campanha sazonal para o dia mundial da visão.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990008, 'valor_total_da_proposta', '350');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990008, 'estado_da_proposta', 'Desinteresse');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990008, 'data_de_apresentacao_da_proposta', '20260625');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990008, 'servicos_0_servico', 'Campanha sazonal (redes sociais + email)');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990008, 'servicos_0_valor', '350€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'descritivo_da_proposta', 'Menu digital acessível por QR code, atualizável pelo próprio cliente.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'valor_total_da_proposta', '600');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'estado_da_proposta', 'Adjudicada');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'data_de_apresentacao_da_proposta', '20260810');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'servicos_0_servico', 'Menu digital com QR code');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'servicos_0_valor', '600€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'valor_total_adjudicado', '600');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'descritivo_da_fatura', 'Fatura do menu digital — pagamento pendente de confirmação de data.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'valor_da_fatura', '600');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'data_prevista_para_o_recebimento', '20260930');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'servicos-adjudicados_0_servico', 'Menu digital com QR code');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990010, 'servicos-adjudicados_0_valor', '600€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'descritivo_da_proposta', 'Gestão mensal de redes sociais com produção de conteúdo fotográfico.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'valor_total_da_proposta', '450');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'estado_da_proposta', 'Enviada');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'data_de_apresentacao_da_proposta', '20260812');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'servicos_0_servico', 'Gestão de redes sociais (mensal)');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'servicos_0_valor', '350€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'servicos_1_servico', 'Produção de conteúdo fotográfico');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990014, 'servicos_1_valor', '100€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'descritivo_da_proposta', 'Campanha de anúncios online para divulgação de novos empreendimentos imobiliários.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'valor_total_da_proposta', '1200');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'estado_da_proposta', 'Adjudicada');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'data_de_apresentacao_da_proposta', '20260701');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'servicos_0_servico', 'Campanha de anúncios online (trimestral)');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'servicos_0_valor', '1200€');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'valor_total_adjudicado', '1200');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'descritivo_da_fatura', 'Fatura da campanha de anúncios — 1º trimestre.');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'valor_da_fatura', '1200');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'data_da_fatura', '20260725');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'data_prevista_para_o_recebimento', '20260825');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'data_do_ultimo_contacto_financeiro', '20260810');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'servicos-adjudicados_0_servico', 'Campanha de anúncios online (trimestral)');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (990015, 'servicos-adjudicados_0_valor', '1200€');

COMMIT;

-- Resumo: 4 utilizadores, 12 clientes, 19 fichas, 68 linhas de wp_postmeta.