-- 1.0.0: chat entre o aluno e o personal dele (sugestão do professor, 09/11/2026).
-- Cada conversa é de UM aluno com o personal dele: só os dois leem e escrevem. O aluno de exemplo não conversa.
-- As mensagens são apagadas junto com o aluno (excluir_aluno → cascade), como o resto dos dados dele (LGPD).
create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null,
  personal_id uuid not null,
  autor uuid not null,
  texto text check (texto is null or char_length(btrim(texto)) between 1 and 2000),
  avaliacao_id uuid references public.avaliacoes(id) on delete cascade, -- avaliação enviada pelo personal como cartão (sai junto se a avaliação for excluída)
  criado_em timestamptz not null default now(),
  lida_em timestamptz,
  check (texto is not null or avaliacao_id is not null),
  foreign key (aluno_id, personal_id) references public.alunos (id, personal_id) on delete cascade
);
create index mensagens_conversa on public.mensagens (aluno_id, criado_em);
create index mensagens_nao_lidas on public.mensagens (personal_id, aluno_id) where lida_em is null;
create index mensagens_avaliacao on public.mensagens (avaliacao_id) where avaliacao_id is not null;
alter table public.mensagens enable row level security;

-- Quem escreve e de qual personal é a conversa saem do banco, não do app: autor = quem está logado,
-- personal = o dono do aluno. Quem envia não escolhe a data nem marca a própria mensagem como lida.
create or replace function privado.mensagem_preencher()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.autor := (select auth.uid());
  select a.personal_id into new.personal_id from public.alunos a where a.id = new.aluno_id;
  new.criado_em := now();
  new.lida_em := null;
  if new.texto is not null then new.texto := btrim(new.texto); end if;
  return new;
end; $$;
revoke all on function privado.mensagem_preencher() from public, anon, authenticated;
create trigger mensagens_preencher before insert on public.mensagens
  for each row execute function privado.mensagem_preencher();

-- Ler: o personal, as conversas dos alunos dele; o aluno, a própria.
create policy mensagens_ler on public.mensagens for select to authenticated
  using (personal_id = (select auth.uid()) or aluno_id = (select privado.meu_aluno_id()));

-- Escrever: o personal, para um aluno dele que tem acesso ao app (não o de exemplo), podendo anexar
-- uma avaliação desse mesmo aluno; o aluno, só na própria conversa e só texto.
create policy mensagens_personal_escreve on public.mensagens for insert to authenticated
  with check (
    personal_id = (select auth.uid()) and autor = (select auth.uid())
    and exists (select 1 from public.alunos a where a.id = aluno_id and a.personal_id = (select auth.uid()) and a.usuario_id is not null and not a.exemplo)
    and (avaliacao_id is null or exists (select 1 from public.avaliacoes v where v.id = avaliacao_id and v.aluno_id = mensagens.aluno_id)));
create policy mensagens_aluno_escreve on public.mensagens for insert to authenticated
  with check (
    aluno_id = (select privado.meu_aluno_id()) and autor = (select auth.uid()) and avaliacao_id is null and texto is not null);

-- Marcar como lida: só quem recebeu, e só a coluna lida_em (grant abaixo).
create policy mensagens_marcar_lida on public.mensagens for update to authenticated
  using (autor <> (select auth.uid()) and (personal_id = (select auth.uid()) or aluno_id = (select privado.meu_aluno_id())))
  with check (autor <> (select auth.uid()) and lida_em is not null);

revoke all on public.mensagens from public, anon, authenticated;
grant select, insert on public.mensagens to authenticated;
grant update (lida_em) on public.mensagens to authenticated;
