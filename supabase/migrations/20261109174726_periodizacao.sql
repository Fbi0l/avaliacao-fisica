-- 1.2.0: periodização por blocos (mesociclos). Opcional: o personal planeja um ciclo (ex.: adaptação → hipertrofia →
-- força → polimento), cada bloco com objetivo e semanas, e liga a ficha de cada bloco ao ciclo. Quem não quiser
-- periodizar continua só com a ficha simples. Um ciclo ativo por aluno; sai junto com o aluno na exclusão.

-- Blocos: [{nome, objetivo, semanas, obs?}], de 1 a 12 blocos, de 1 a 26 semanas cada.
create or replace function privado.blocos_validos(b jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare x jsonb;
begin
  if jsonb_typeof(b) is distinct from 'array' or jsonb_array_length(b) not between 1 and 12 then return false; end if;
  for x in select * from jsonb_array_elements(b) loop
    if jsonb_typeof(x) is distinct from 'object' or exists (select 1 from jsonb_object_keys(x) k where k not in ('nome', 'objetivo', 'semanas', 'obs')) then return false; end if;
    if jsonb_typeof(x->'nome') is distinct from 'string' or char_length(btrim(x->>'nome')) not between 1 and 40 then return false; end if;
    if (x->>'objetivo') is null or (x->>'objetivo') not in ('hipertrofia', 'forca', 'emagrecimento', 'resistencia', 'saude', 'outro') then return false; end if;
    if jsonb_typeof(x->'semanas') is distinct from 'number' or (x->>'semanas')::numeric not between 1 and 26 or (x->>'semanas')::numeric <> trunc((x->>'semanas')::numeric) then return false; end if;
    if x ? 'obs' and jsonb_typeof(x->'obs') <> 'null' and (jsonb_typeof(x->'obs') <> 'string' or char_length(x->>'obs') > 300) then return false; end if;
  end loop;
  return true;
end; $$;

create table public.ciclos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null,
  personal_id uuid not null default auth.uid(),
  nome text not null default 'Periodização' check (char_length(btrim(nome)) between 1 and 60),
  meta text check (meta is null or char_length(meta) <= 300),
  inicio date not null default current_date check (inicio between date '2020-01-01' and current_date + 366),
  blocos jsonb not null check (privado.blocos_validos(blocos)),
  encerrado_em date, -- vazio = ciclo ativo
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (aluno_id, personal_id) references public.alunos (id, personal_id) on delete cascade
);
create unique index ciclos_um_ativo on public.ciclos (aluno_id) where encerrado_em is null;
create unique index ciclos_id_aluno on public.ciclos (id, aluno_id);
create index ciclos_personal on public.ciclos (personal_id);
alter table public.ciclos enable row level security;
create trigger ciclos_atualizado before update on public.ciclos for each row execute function privado.tocar_atualizado_em();

-- A ficha pode pertencer a um bloco do ciclo do mesmo aluno. Apagar o ciclo só solta a ficha (ela continua).
alter table public.fichas add column ciclo_id uuid, add column bloco smallint check (bloco between 0 and 11),
  add constraint fichas_bloco_com_ciclo check ((ciclo_id is null) = (bloco is null)),
  add constraint fichas_ciclo_fk foreign key (ciclo_id, aluno_id) references public.ciclos (id, aluno_id) on delete set null (ciclo_id);
-- "on delete set null (ciclo_id)" deixa o bloco sem ciclo: o gatilho abaixo limpa o bloco junto.
create or replace function privado.ficha_bloco_coerente()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.ciclo_id is null then new.bloco := null; end if;
  return new;
end; $$;
revoke all on function privado.ficha_bloco_coerente() from public, anon, authenticated;
create trigger fichas_bloco_coerente before insert or update on public.fichas for each row execute function privado.ficha_bloco_coerente();
create index fichas_ciclo on public.fichas (ciclo_id, aluno_id) where ciclo_id is not null;

create policy personal_ciclos on public.ciclos for all to authenticated
  using (personal_id = (select auth.uid()))
  with check (personal_id = (select auth.uid()) and (select privado.sou_personal()));
create policy aluno_ve_seus_ciclos on public.ciclos for select to authenticated
  using (aluno_id = (select privado.meu_aluno_id()));

revoke all on public.ciclos from public, anon, authenticated;
grant select, insert, delete on public.ciclos to authenticated;
grant update (nome, meta, inicio, blocos, encerrado_em) on public.ciclos to authenticated;
grant update (ciclo_id, bloco) on public.fichas to authenticated;
grant execute on function privado.blocos_validos(jsonb) to authenticated;
