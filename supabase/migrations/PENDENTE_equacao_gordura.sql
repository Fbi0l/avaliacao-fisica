-- Equação do % de gordura escolhida pelo personal em cada avaliação (decidido em 05/11/2026).
-- As avaliações antigas ficam com Faulkner, que era a única até aqui.
alter table public.avaliacoes
  add column equacao_gordura text not null default 'faulkner' check (equacao_gordura in ('faulkner', 'petroski'));
grant update (equacao_gordura) on public.avaliacoes to authenticated;
