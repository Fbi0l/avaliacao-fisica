-- Aluno de exemplo (05/11/2026): no primeiro acesso, o personal novo ganha um aluno fictício com
-- 3 avaliações para conhecer todas as telas, tabelas e gráficos. Ele pode apagar quando quiser.
alter table public.alunos add column exemplo boolean not null default false;

-- Aluno de exemplo não recebe convite: é fictício, ninguém deve criar login para ele.
create or replace function public.criar_convite_aluno(p_aluno uuid)
returns table (id uuid, codigo text, expira_em timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare v_codigo text; v_eu uuid := (select auth.uid());
begin
  if not exists (select 1 from public.alunos a where a.id = p_aluno and a.personal_id = v_eu) then
    raise exception 'Aluno não encontrado.' using errcode = '42501';
  end if;
  if exists (select 1 from public.alunos a where a.id = p_aluno and a.exemplo) then
    raise exception 'O aluno de exemplo não recebe convite.' using errcode = '42501';
  end if;
  if exists (select 1 from public.alunos a where a.id = p_aluno and a.usuario_id is not null) then
    raise exception 'Este aluno já tem acesso ao app.' using errcode = '23505';
  end if;
  -- um convite ativo por aluno: gerar outro cancela o anterior
  update public.convites_aluno c set cancelado_em = now()
   where c.aluno_id = p_aluno and c.usado_em is null and c.cancelado_em is null and c.expira_em > now();
  v_codigo := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  return query
    insert into public.convites_aluno (personal_id, aluno_id, codigo_hash)
    values (v_eu, p_aluno, encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'))
    returning convites_aluno.id, v_codigo, convites_aluno.expira_em;
end; $$;
