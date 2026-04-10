-- ============================================================
-- ITS Tax and Corporate — Schema Postgres (Supabase)
-- Multi-tenant com RLS
-- ============================================================

create extension if not exists "uuid-ossp";

-- Perfis de usuário (vinculados a auth.users)
create type user_role as enum ('admin','internal','contador','cliente');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'cliente',
  nome text not null,
  email text unique not null,
  telefone text,
  created_at timestamptz default now()
);

-- Escritórios de contabilidade
create table contadores (
  id uuid primary key default uuid_generate_v4(),
  razao_social text not null,
  cnpj text unique,
  responsavel_user_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- Empresas (clientes)
create type regime_tributario as enum ('simples','presumido','real');

create table empresas (
  id uuid primary key default uuid_generate_v4(),
  razao_social text not null,
  nome_fantasia text,
  cnpj text unique not null,
  regime regime_tributario not null default 'presumido',
  anexo_simples smallint,
  owner_user_id uuid references profiles(id) not null,
  contador_id uuid references contadores(id),
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Usuários adicionais (sócios) de uma empresa
create table empresa_users (
  empresa_id uuid references empresas(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (empresa_id, user_id)
);

-- Documentos exigidos por empresa (checklist configurável)
create table empresa_docs_config (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  codigo text not null,  -- ex: SPED_FISCAL, SPED_CONTRIB, BALANCETE, DCTFWEB
  nome text not null,
  obrigatorio boolean default true,
  ordem int default 0,
  unique (empresa_id, codigo)
);

-- Processo mensal por empresa
create type processo_status as enum ('pendente','em_andamento','concluido','publicado');
create table processos_mensais (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  competencia date not null,  -- primeiro dia do mês
  status processo_status default 'pendente',
  economia_gerada numeric(14,2) default 0,
  relatorio_url text,
  publicado_em timestamptz,
  created_at timestamptz default now(),
  unique (empresa_id, competencia)
);

-- Checklist (etapas) do processo mensal
create table processo_etapas (
  id uuid primary key default uuid_generate_v4(),
  processo_id uuid references processos_mensais(id) on delete cascade,
  ordem int not null,
  titulo text not null,
  concluida boolean default false,
  concluida_em timestamptz,
  responsavel_user_id uuid references profiles(id)
);

-- Upload de documentos
create table documentos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  processo_id uuid references processos_mensais(id),
  codigo text not null,
  nome_arquivo text not null,
  storage_path text not null,
  sha256 text,
  tamanho bigint,
  enviado_por uuid references profiles(id),
  enviado_em timestamptz default now()
);

-- Balancete — linhas flexíveis (chart of accounts dinâmico)
create table balancete_linhas (
  id uuid primary key default uuid_generate_v4(),
  processo_id uuid references processos_mensais(id) on delete cascade,
  codigo_conta text,
  descricao text not null,
  natureza char(1),  -- D ou C
  saldo_mes numeric(16,2) not null,
  classificacao text  -- auto-classificador
);

-- Auditoria ITS (diffs de valores)
create table auditoria_diffs (
  id uuid primary key default uuid_generate_v4(),
  processo_id uuid references processos_mensais(id) on delete cascade,
  item text not null,
  valor_contador numeric(14,2),
  valor_its numeric(14,2),
  impacto numeric(14,2),
  observacao text,
  created_at timestamptz default now()
);

-- Planejamento tributário (simulação dos 3 regimes)
create table planejamentos (
  id uuid primary key default uuid_generate_v4(),
  processo_id uuid references processos_mensais(id) on delete cascade,
  simples numeric(14,2),
  presumido numeric(14,2),
  real numeric(14,2),
  recomendacao regime_tributario,
  created_at timestamptz default now()
);

-- Indicadores financeiros
create table indicadores (
  id uuid primary key default uuid_generate_v4(),
  processo_id uuid references processos_mensais(id) on delete cascade,
  margem_bruta numeric(6,2),
  margem_liquida numeric(6,2),
  liquidez_corrente numeric(8,2),
  roe numeric(6,2),
  roa numeric(6,2),
  endividamento numeric(6,2),
  pmr int, pmp int,
  health_score int
);

-- Solicitações do cliente (consultas, planejamento)
create type req_status as enum ('aberta','em_analise','respondida','fechada');
create table solicitacoes (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid references empresas(id) on delete cascade,
  autor_user_id uuid references profiles(id),
  assunto text not null,
  descricao text,
  status req_status default 'aberta',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table contadores enable row level security;
alter table empresas enable row level security;
alter table empresa_users enable row level security;
alter table empresa_docs_config enable row level security;
alter table processos_mensais enable row level security;
alter table processo_etapas enable row level security;
alter table documentos enable row level security;
alter table balancete_linhas enable row level security;
alter table auditoria_diffs enable row level security;
alter table planejamentos enable row level security;
alter table indicadores enable row level security;
alter table solicitacoes enable row level security;

-- Função helper: role do usuário
create or replace function get_user_role() returns user_role
language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- Função helper: empresas acessíveis pelo usuário
create or replace function user_empresas() returns setof uuid
language sql stable as $$
  select id from empresas where owner_user_id = auth.uid()
  union
  select empresa_id from empresa_users where user_id = auth.uid()
  union
  select e.id from empresas e
    join contadores c on e.contador_id = c.id
    where c.responsavel_user_id = auth.uid()
  union
  select id from empresas where get_user_role() in ('admin','internal')
$$;

-- Profiles: cada um lê o seu; admin lê todos
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or get_user_role() in ('admin','internal'));
create policy profiles_self_update on profiles for update
  using (id = auth.uid());
create policy profiles_admin_all on profiles for all
  using (get_user_role() = 'admin');

-- Empresas
create policy empresas_read on empresas for select
  using (id in (select user_empresas()));
create policy empresas_admin_write on empresas for all
  using (get_user_role() in ('admin','internal'));

-- Tabelas vinculadas à empresa (padrão genérico)
create policy docs_read on documentos for select
  using (empresa_id in (select user_empresas()));
create policy docs_insert on documentos for insert
  with check (empresa_id in (select user_empresas())
              and get_user_role() in ('contador','internal','admin'));

create policy processos_read on processos_mensais for select
  using (empresa_id in (select user_empresas()));
create policy processos_write on processos_mensais for all
  using (get_user_role() in ('admin','internal'));

create policy etapas_read on processo_etapas for select
  using (processo_id in (select id from processos_mensais where empresa_id in (select user_empresas())));
create policy etapas_write on processo_etapas for all
  using (get_user_role() in ('admin','internal'));

create policy balancete_read on balancete_linhas for select
  using (processo_id in (select id from processos_mensais where empresa_id in (select user_empresas())));
create policy balancete_write on balancete_linhas for all
  using (get_user_role() in ('contador','admin','internal'));

create policy auditoria_read on auditoria_diffs for select
  using (processo_id in (select id from processos_mensais where empresa_id in (select user_empresas())));
create policy auditoria_write on auditoria_diffs for all
  using (get_user_role() in ('admin','internal'));

create policy plan_read on planejamentos for select
  using (processo_id in (select id from processos_mensais where empresa_id in (select user_empresas())));
create policy plan_write on planejamentos for all
  using (get_user_role() in ('admin','internal'));

create policy ind_read on indicadores for select
  using (processo_id in (select id from processos_mensais where empresa_id in (select user_empresas())));
create policy ind_write on indicadores for all
  using (get_user_role() in ('admin','internal'));

create policy sol_read on solicitacoes for select
  using (empresa_id in (select user_empresas()));
create policy sol_insert on solicitacoes for insert
  with check (empresa_id in (select user_empresas()));

-- Trigger: criar profile ao criar usuário no Auth
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, email, nome, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', new.email),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'cliente'));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Storage bucket (criar via dashboard ou API):
-- insert into storage.buckets (id, name, public) values ('documentos','documentos', false);
