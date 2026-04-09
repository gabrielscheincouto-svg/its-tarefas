# ITS Tax and Corporate — Plataforma

Plataforma multi-tenant para auditoria fiscal, planejamento tributário mensal e indicadores financeiros.

## Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (Auth + Postgres + Storage)
- Tailwind CSS
- Row Level Security para multi-tenant

## Perfis
- **admin** — Gabriel / ITS (acesso total)
- **internal** — funcionário ITS
- **contador** — escritório contábil do cliente
- **cliente** — dono da empresa

## Setup

### 1. Criar projeto Supabase
1. Acesse https://supabase.com → New Project
2. Copie `Project URL`, `anon key` e `service_role key`

### 2. Rodar o schema
No SQL Editor do Supabase, cole e execute `supabase/schema.sql`.

Depois crie o bucket de storage:
```sql
insert into storage.buckets (id, name, public) values ('documentos','documentos', false);
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.local.example .env.local
# edite .env.local com suas keys
```

### 4. Instalar e rodar
```bash
npm install
npm run dev
```
Abra http://localhost:3000

### 5. Criar o primeiro admin
1. Cadastre-se em `/login` (use Sign up do Supabase ou crie no dashboard)
2. No SQL Editor: `update profiles set role='admin' where email='seu@email.com';`

## Estrutura
```
app/
  page.tsx              → Landing ITS
  login/                → Login (cliente / contador / admin)
  (cliente)/cliente/    → Dashboard do cliente
  (contador)/contador/  → Área do contador
  (admin)/admin/        → Painel gestor ITS
  api/auth/signout/     → Logout
lib/
  supabase-browser.ts   → Client browser
  supabase-server.ts    → Client SSR
supabase/
  schema.sql            → Schema + RLS
  seed.sql              → Dados de exemplo
middleware.ts           → Proteção de rotas
```

## Deploy
Vercel + Supabase. Configure as mesmas env vars no dashboard da Vercel.

## Próximos passos
- Upload de balancete + parser automático
- Motor de cálculo Simples × Presumido × Real
- Geração automática de relatório mensal em PDF
- Notificações e gamificação leve (Health Score, streaks)
