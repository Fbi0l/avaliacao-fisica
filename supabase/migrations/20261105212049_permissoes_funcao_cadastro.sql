-- Projeto criado com "Automatically expose new tables" desligado: nenhum papel recebe acesso sozinho.
-- A função registrar-aluno (papel service_role, só no servidor) precisa exatamente disto:
grant select, update on public.convites_aluno to service_role;   -- conferir, reservar e marcar o convite
grant select, update on public.alunos to service_role;           -- nome do aluno e ligar o login à ficha
grant select on public.personais to service_role;                -- nome do personal na tela do convite
grant insert on public.consentimentos to service_role;           -- registrar o aceite do termo (LGPD)
