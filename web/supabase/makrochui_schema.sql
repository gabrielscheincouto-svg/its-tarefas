-- ============================================================
-- MAKROCHUI — Schema adicional para sistema de gestão Cecopel
-- Projeto Supabase: uubrvdudtzmdqyqbjkom
-- ============================================================

-- Atualizar tabela de usuários existente para suportar email login
ALTER TABLE makrochui_users ADD COLUMN IF NOT EXISTS email text UNIQUE;
ALTER TABLE makrochui_users ADD COLUMN IF NOT EXISTS loja text;
ALTER TABLE makrochui_users ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';

-- ============================================================
-- CHAMADOS LOG (motivo de alteração no kanban)
-- ============================================================
CREATE TABLE IF NOT EXISTS makrochui_ticket_logs (
  id serial PRIMARY KEY,
  ticket_id integer NOT NULL REFERENCES makrochui_tickets(id) ON DELETE CASCADE,
  user_id integer NOT NULL,
  user_name text NOT NULL,
  status_anterior text NOT NULL,
  status_novo text NOT NULL,
  motivo text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PREMIAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS makrochui_prem_periodos (
  id serial PRIMARY KEY,
  mes text NOT NULL,
  ano integer NOT NULL,
  status text NOT NULL DEFAULT 'avaliacao', -- 'avaliacao' | 'finalizado'
  avaliacoes integer DEFAULT 0,
  total_colaboradores integer DEFAULT 0,
  media numeric(4,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(mes, ano)
);

CREATE TABLE IF NOT EXISTS makrochui_prem_colaboradores (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  cargo text,
  setor text,
  loja text,
  salario numeric(10,2) DEFAULT 0,
  admissao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS makrochui_prem_avaliacoes (
  id serial PRIMARY KEY,
  periodo_id integer REFERENCES makrochui_prem_periodos(id) ON DELETE CASCADE,
  colaborador_id integer REFERENCES makrochui_prem_colaboradores(id) ON DELETE CASCADE,
  avaliador_id integer NOT NULL,
  notas jsonb NOT NULL DEFAULT '{}', -- {"ponto": 4.5, "vendas": 3.2, ...}
  nota_final numeric(4,2),
  pct_bonus numeric(5,2) DEFAULT 0,
  valor_bonus numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pendente', -- 'pendente' | 'enviada' | 'aprovada'
  created_at timestamptz DEFAULT now(),
  UNIQUE(periodo_id, colaborador_id)
);

CREATE TABLE IF NOT EXISTS makrochui_prem_criterios (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  categoria text DEFAULT 'geral', -- 'geral' | setor específico
  peso numeric(4,2) DEFAULT 1.0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS makrochui_prem_config (
  id serial PRIMARY KEY,
  nota_min numeric(3,1) NOT NULL,
  nota_max numeric(3,1) NOT NULL,
  pct_salario numeric(5,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- REUNIÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS makrochui_reunioes (
  id serial PRIMARY KEY,
  titulo text NOT NULL,
  data_reuniao date NOT NULL,
  hora text,
  loja text,
  participantes jsonb DEFAULT '[]',
  pauta text,
  ata text,
  status text DEFAULT 'agendada', -- 'agendada' | 'realizada' | 'cancelada'
  created_by integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- DOCUMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS makrochui_documentos (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  categoria text NOT NULL, -- 'manuais' | 'contratos' | 'politicas'
  arquivo_url text,
  tamanho text,
  uploaded_by integer NOT NULL,
  loja text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INSERIR USUÁRIOS CECOPEL
-- ============================================================
INSERT INTO makrochui_users (name, username, password, role, department, email, loja, active)
VALUES
  ('Kassem Jomaa', 'kassem', 'Makro2026', 'admin', 'Diretoria', 'kassem@cecopel.com.br', 'Todas', true),
  ('Anuar Jomaa', 'anuar', 'Makro2026', 'admin', 'Diretoria', 'anuar@cecopel.com.br', 'Todas', true),
  ('Financeiro', 'financeiro', 'Makro2026', 'financeiro', 'Financeiro', 'financeiro@cecopel.com.br', 'Todas', true)
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  loja = EXCLUDED.loja;

-- ============================================================
-- INSERIR CONFIGURAÇÃO PADRÃO DE PREMIAÇÕES
-- ============================================================
INSERT INTO makrochui_prem_config (nota_min, nota_max, pct_salario) VALUES
  (1.0, 2.99, 0),
  (3.0, 3.49, 5),
  (3.5, 3.99, 10),
  (4.0, 4.49, 15),
  (4.5, 4.79, 20),
  (4.8, 5.0, 30)
ON CONFLICT DO NOTHING;

-- ============================================================
-- INSERIR CRITÉRIOS PADRÃO
-- ============================================================
INSERT INTO makrochui_prem_criterios (nome, categoria, peso) VALUES
  ('Ponto', 'geral', 1.0),
  ('Atendimento', 'geral', 1.0),
  ('Trabalho em Equipe', 'geral', 1.0),
  ('Organização', 'geral', 1.0),
  ('Proatividade', 'geral', 1.0)
ON CONFLICT DO NOTHING;
