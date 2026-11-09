-- 0.10.0: etapas da avaliação independentes (pedido do dono, 09/11/2026): peso e altura deixam de ser obrigatórios.
-- As faixas aceitas continuam as mesmas quando forem informados. O app exige pelo menos uma medida ou o parecer.
alter table public.avaliacoes alter column peso drop not null;
alter table public.avaliacoes alter column altura drop not null;
