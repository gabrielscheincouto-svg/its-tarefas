# Arquitetura ITS — 2 sistemas, 2 logins, 1 master

## Visão geral

A ITS tem dois sistemas separados, cada um com seu próprio login,
compartilhando apenas o mesmo projeto Supabase (mas em tabelas
diferentes). Você (Gabriel) é master nos dois.

```
                    ┌──────────────────────┐
                    │   Portal ITS (/)     │
                    │   itsgrupo.app       │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
      ┌──────────────────┐          ┌──────────────────┐
      │  ÁREA CLIENTE    │          │    ESCRITÓRIO    │
      │  (Next.js)       │          │  (its-tarefas)   │
      │                  │          │                  │
      │  Login Supabase  │          │  Login Express   │
      │  Deploy: Netlify │          │  Deploy: Render  │
      └────────┬─────────┘          └────────┬─────────┘
               │                             │
               └──────────┬──────────────────┘
                          ▼
                ┌──────────────────┐
                │     SUPABASE     │
                │                  │
                │  profiles ◄──── Cliente (auth.users)
                │  empresas        │
                │  processos       │
                │  ...             │
                │                  │
                │  users ◄────── Escritório (bcrypt)
                │  tasks           │
                │  clients         │
                └──────────────────┘
```

## Sistemas

### 1. Área do Cliente — Next.js (este repo/app)
- **URL**: deploy no Netlify
- **Quem loga**: clientes da ITS (donos de empresa)
- **Auth**: Supabase Auth (JWT, cookies httpOnly, RLS no Postgres)
- **Tabelas**: `profiles`, `empresas`, `contadores`, `processos_mensais`,
  `balancete_linhas`, `auditoria_diffs`, `planejamentos`, `indicadores`, etc.
- **Features**: economia gerada, indicadores financeiros, planejamento
  tributário mensal, documentos, chamados

### 2. Escritório — its-tarefas (Express já em produção)
- **URL**: https://its-tarefas-7xlm.onrender.com/
- **Repo**: https://github.com/gabrielscheincouto-svg/its-tarefas
- **Quem loga**: equipe ITS (Gabriel + sócios)
- **Auth**: Express session + bcryptjs (próprio, independente)
- **Tabelas**: `users`, `tasks`, `clients`, `checklist_templates`,
  `task_history`, `tickets`
- **Features**: kanban de tarefas, checklists, histórico, modo TV,
  relatórios, tickets de clientes

## Acesso Master (Gabriel)

Você tem controle total nos dois sistemas com **duas senhas separadas**
(uma em cada lado). Isso é mais seguro do que compartilhar credenciais.

### No escritório (its-tarefas)
- Login: **gabriel** / **its2026** (troque no primeiro acesso)
- Role: `admin` — criar/editar/apagar tarefas, usuários, clients, templates

### Na Área do Cliente (Next.js)
1. Crie seu usuário em Supabase Dashboard → Authentication → Users →
   Add user (ex: `gabriel@its.com.br`, senha forte).
2. Rode o SQL em `supabase/master_access.sql` pra promover a `admin`.
3. Faça login em `/login` — você será redirecionado pra `/gestao`
   onde vê o painel fiscal completo.

Veja os detalhes em `supabase/master_access.sql`.

## Por que dois logins separados?

1. **Isolamento de segurança**: um vazamento em um sistema não
   compromete o outro.
2. **Públicos diferentes**: clientes nunca precisam saber da existência
   do sistema de tarefas interno.
3. **Tecnologias diferentes**: Express+bcrypt vs Supabase Auth — cada
   um é ótimo pro seu caso, sem gambiarra pra unificar.
4. **Sem dependência cruzada**: se o Render cair, a Área do Cliente
   continua no ar (e vice-versa).

## Deploy

### Este app (Área do Cliente)
- Netlify → conecta este repo
- Build: `npm run build`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `netlify.toml` já configurado

### its-tarefas (Escritório)
- Já no Render, sem mexer
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`,
  `NODE_ENV=production`

## Fluxo do usuário

**Cliente**
1. Acessa itsgrupo.app (portal)
2. Clica "Área do Cliente" → `/login`
3. Loga com e-mail/senha Supabase
4. Cai em `/cliente` e vê seus indicadores

**Equipe ITS**
1. Acessa itsgrupo.app (portal)
2. Clica "Escritório ITS" → abre its-tarefas em nova aba
3. Loga com username/senha
4. Gerencia tarefas, clientes, checklists

**Gabriel (master)**
- Loga nos dois sistemas (um de cada vez, conforme a necessidade)
- Tem role `admin` em ambos
- Único que vê tudo
