-- ============================================================
-- ACESSO MASTER — Gabriel (ITS)
-- ============================================================
-- Este script dá controle total dos DOIS sistemas:
--   1. App Next.js (Área do Cliente) — tabela `profiles` (Supabase Auth)
--   2. its-tarefas (Escritório) — tabela `users` (bcrypt + session)
--
-- Os dois sistemas vivem no MESMO projeto Supabase, mas em
-- tabelas diferentes e NÃO compartilham credenciais.
-- Você terá duas senhas (uma em cada sistema) — ambas controladas
-- por você, com poder total em cada lado.
-- ============================================================

-- =====================================================
-- PARTE 1 — Master no app Next.js (Área do Cliente)
-- =====================================================
-- Passo A: crie seu usuário no Supabase Dashboard
--   Authentication → Users → Add user → Create new user
--   Email: gabriel@its.com.br
--   Senha: (a que você escolher — forte, min 12 chars)
--   Auto Confirm User: ON
--
-- Passo B: rode o SQL abaixo para promover a master
update profiles
   set role = 'admin',
       nome = 'Gabriel Couto'
 where email = 'gabriel@its.com.br';

-- Verifica
select id, email, nome, role from profiles where email = 'gabriel@its.com.br';

-- =====================================================
-- PARTE 2 — Master no its-tarefas (Escritório)
-- =====================================================
-- O its-tarefas já cria automaticamente no primeiro deploy
-- um usuário Gabriel com:
--   username: gabriel
--   senha:    its2026
--   role:     admin
--
-- IMPORTANTE: troque a senha no primeiro login via interface!
-- Acesse: https://its-tarefas-7xlm.onrender.com/
-- Clique no seu nome → Trocar senha.
--
-- Se precisar resetar sua senha via SQL (ex: se esqueceu),
-- use o hash bcrypt abaixo. Gere um novo hash em:
--   https://bcrypt-generator.com/  (rounds = 10)
--
-- Exemplo (substitua pelo hash gerado):
-- update users
--    set password = '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR',
--        role = 'admin'
--  where username = 'gabriel';

-- =====================================================
-- PARTE 3 — Garantir que só você seja master nos 2 lados
-- =====================================================
-- Área do Cliente: ver todos os admins
select id, email, nome, role from profiles where role = 'admin';

-- Escritório: ver todos os admins
select id, username, name, role from users where role = 'admin';

-- Se houver outros admins que não deveriam, rebaixe:
-- update profiles set role = 'internal' where email = 'outro@its.com.br';
-- update users set role = 'user' where username = 'outro_usuario';
