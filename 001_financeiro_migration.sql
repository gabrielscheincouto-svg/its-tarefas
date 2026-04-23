-- ============================================================
-- MIGRATION 001 - MODULO FINANCEIRO (ITS Tarefas)
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- 1) Flag de acesso ao modulo financeiro em users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_financeiro BOOLEAN DEFAULT false;

-- AJUSTE OS USERNAMES ABAIXO conforme seu cadastro
-- (Gabriel, Susan, Maique sao os unicos que devem ter acesso)
UPDATE users SET is_financeiro = true WHERE username IN ('gabriel', 'susan', 'maique');

-- 2) Catalogo de servicos (para reuso nas propostas)
CREATE TABLE IF NOT EXISTS servicos_catalogo (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  valor_padrao NUMERIC(12,2),
  tipo VARCHAR(30) DEFAULT 'pontual',
  categoria VARCHAR(50),
  ativo BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3) Propostas comerciais
CREATE TABLE IF NOT EXISTS propostas (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(30) UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  cliente_nome VARCHAR(255) NOT NULL,
  cliente_empresa VARCHAR(255),
  cliente_documento VARCHAR(20),
  cliente_email VARCHAR(255),
  cliente_contato VARCHAR(255),
  cliente_endereco TEXT,
  cliente_representante VARCHAR(255),
  cliente_cpf_representante VARCHAR(20),
  titulo VARCHAR(255) NOT NULL,
  objeto TEXT,
  observacoes TEXT,
  vigencia VARCHAR(100),
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  validade_dias INTEGER DEFAULT 15,
  status VARCHAR(20) DEFAULT 'rascunho',
  aceite_token VARCHAR(64) UNIQUE,
  aceita_em TIMESTAMP,
  aceita_ip VARCHAR(50),
  aceita_user_agent TEXT,
  recusada_em TIMESTAMP,
  motivo_recusa TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas(status);
CREATE INDEX IF NOT EXISTS idx_propostas_token ON propostas(aceite_token);

-- 4) Itens da proposta
CREATE TABLE IF NOT EXISTS proposta_itens (
  id SERIAL PRIMARY KEY,
  proposta_id INTEGER REFERENCES propostas(id) ON DELETE CASCADE,
  servico_id INTEGER REFERENCES servicos_catalogo(id),
  descricao VARCHAR(500) NOT NULL,
  quantidade NUMERIC(12,2) DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  tipo VARCHAR(30),
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_proposta_itens_prop ON proposta_itens(proposta_id);

-- 5) Templates de contrato
CREATE TABLE IF NOT EXISTS contrato_templates (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  corpo_html TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6) Contratos
CREATE TABLE IF NOT EXISTS contratos (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(30) UNIQUE NOT NULL,
  proposta_id INTEGER REFERENCES propostas(id),
  template_id INTEGER REFERENCES contrato_templates(id),
  client_id INTEGER REFERENCES clients(id),
  cliente_nome VARCHAR(255),
  cliente_documento VARCHAR(20),
  titulo VARCHAR(255),
  conteudo_html TEXT,
  valor NUMERIC(12,2),
  vigencia_inicio DATE,
  vigencia_fim DATE,
  foro VARCHAR(100) DEFAULT 'Pelotas/RS',
  cidade_assinatura VARCHAR(100) DEFAULT 'Pelotas',
  data_assinatura DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'ativo',
  task_id INTEGER REFERENCES tasks(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contratos_proposta ON contratos(proposta_id);

-- 6.1) Garantir colunas novas caso tabelas ja existam
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS cliente_contato VARCHAR(255);
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS vigencia VARCHAR(100);

-- 7) Servicos-exemplo no catalogo
INSERT INTO servicos_catalogo (nome, descricao, valor_padrao, tipo, categoria) VALUES
('Honorarios contabeis mensais', 'Contabilidade completa, apuracao de impostos e obrigacoes acessorias.', 1500.00, 'mensal', 'contabil'),
('Planejamento tributario', 'Estudo comparativo de regimes tributarios.', 5000.00, 'pontual', 'fiscal'),
('Recuperacao PIS/COFINS monofasicos', 'Identificacao e recuperacao de creditos tributarios.', 0, 'exito', 'fiscal'),
('Alteracao contratual', 'Protocolo de alteracao contratual na Junta Comercial.', 1200.00, 'pontual', 'societario'),
('Abertura de empresa', 'Constituicao, CNPJ, alvara e inscricao estadual.', 1800.00, 'pontual', 'societario')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIM DA MIGRATION 001
-- Apos rodar, cadastrar manualmente um template de contrato
-- atraves da tela /financeiro > Templates.
-- ============================================================
