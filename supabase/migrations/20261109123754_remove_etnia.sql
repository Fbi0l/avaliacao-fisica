-- 0.5.0: a etnia deixa de ser coletada (pedido do professor, 09/11/2026; menos dado pessoal sensível, LGPD).
-- A fórmula de massa muscular (Lee) passou a usar o valor neutro. Aplicar DEPOIS de publicar o site 0.5.0,
-- que já não lê nem grava esta coluna. Apagar a coluna remove junto a permissão de editá-la.
alter table public.alunos drop column if exists etnia;
