-- Auditoria de 23/11/2026: o personal criava aluno com qualquer coluna, inclusive usuario_id, e podia ligar
-- a ficha à conta de outra pessoa (outro personal ou conta sem perfil) sem convite nem termo. Ligar o login
-- à ficha é só da função registrar-aluno (service_role), depois do convite e do aceite.
-- O INSERT passa a valer só para as colunas que o app grava; personal_id e id vêm do default.
revoke insert on public.alunos from authenticated;
grant insert (nome, sexo, nascimento, contato, exemplo) on public.alunos to authenticated;
