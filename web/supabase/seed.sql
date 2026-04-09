-- Dados de exemplo. Rodar DEPOIS de criar usuários no Supabase Auth.
-- Substitua os UUIDs pelos ids reais dos auth.users.

-- Ex: admin ITS
-- update profiles set role='admin', nome='Gabriel Couto' where email='gabriel@its.com.br';

-- Contador de exemplo
insert into contadores (razao_social, cnpj) values
  ('Escritório Contábil Exemplo', '00.111.222/0001-33')
on conflict do nothing;

-- Empresa de exemplo (ajuste owner_user_id e contador_id)
-- insert into empresas (razao_social, nome_fantasia, cnpj, regime, owner_user_id, contador_id)
-- values ('Comércio Alfa Ltda', 'Alfa', '12.345.678/0001-90', 'presumido',
--   '<uuid-do-cliente>', (select id from contadores limit 1));

-- Checklist padrão
-- insert into empresa_docs_config (empresa_id, codigo, nome, ordem)
-- select id, 'SPED_FISCAL', 'SPED Fiscal', 1 from empresas where cnpj='12.345.678/0001-90'
-- union all select id,'SPED_CONTRIB','SPED Contribuições',2 from empresas where cnpj='12.345.678/0001-90'
-- union all select id,'BALANCETE','Balancete do mês',3 from empresas where cnpj='12.345.678/0001-90'
-- union all select id,'DCTFWEB','DCTFWeb',4 from empresas where cnpj='12.345.678/0001-90'
-- union all select id,'EFD_REINF','EFD-Reinf',5 from empresas where cnpj='12.345.678/0001-90'
-- union all select id,'ESOCIAL','eSocial',6 from empresas where cnpj='12.345.678/0001-90';
