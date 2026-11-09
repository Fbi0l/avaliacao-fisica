-- 1.1.0: fichas de treino (etapa 2). O personal monta a ficha do aluno com divisão livre; o aluno marca
-- os treinos feitos e anota a carga usada. Uma ficha ativa por aluno; as anteriores ficam no histórico.
-- Tudo sai junto com o aluno na exclusão (cascade a partir de public.alunos), como o resto dos dados dele.

-- Treinos da ficha: [{nome, exercicios: [{nome, grupo?, series?, reps?, carga?, descanso?, obs?}]}]
-- Até 10 treinos com até 30 exercícios cada. Nada além dessas chaves.
create or replace function privado.treinos_validos(t jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare tr jsonb; ex jsonb;
begin
  if jsonb_typeof(t) is distinct from 'array' or jsonb_array_length(t) not between 1 and 10 then return false; end if;
  for tr in select * from jsonb_array_elements(t) loop
    if jsonb_typeof(tr) is distinct from 'object' or exists (select 1 from jsonb_object_keys(tr) k where k not in ('nome', 'exercicios')) then return false; end if;
    if jsonb_typeof(tr->'nome') is distinct from 'string' or char_length(btrim(tr->>'nome')) not between 1 and 40 then return false; end if;
    if jsonb_typeof(tr->'exercicios') is distinct from 'array' or jsonb_array_length(tr->'exercicios') > 30 then return false; end if;
    for ex in select * from jsonb_array_elements(tr->'exercicios') loop
      if jsonb_typeof(ex) is distinct from 'object'
        or exists (select 1 from jsonb_object_keys(ex) k where k not in ('nome', 'grupo', 'series', 'reps', 'carga', 'descanso', 'obs')) then return false; end if;
      if jsonb_typeof(ex->'nome') is distinct from 'string' or char_length(btrim(ex->>'nome')) not between 1 and 60 then return false; end if;
      if ex ? 'grupo' and (ex->>'grupo') is distinct from null and (ex->>'grupo') not in ('peito', 'costas', 'ombros', 'biceps', 'triceps', 'pernas', 'gluteos', 'panturrilha', 'abdomen', 'cardio', 'outro') then return false; end if;
      if ex ? 'series' and jsonb_typeof(ex->'series') <> 'null' and (jsonb_typeof(ex->'series') <> 'number' or (ex->>'series')::numeric not between 1 and 20 or (ex->>'series')::numeric <> trunc((ex->>'series')::numeric)) then return false; end if;
      if ex ? 'reps' and jsonb_typeof(ex->'reps') <> 'null' and (jsonb_typeof(ex->'reps') <> 'string' or char_length(ex->>'reps') > 20) then return false; end if;
      if ex ? 'carga' and jsonb_typeof(ex->'carga') <> 'null' and (jsonb_typeof(ex->'carga') <> 'number' or (ex->>'carga')::numeric not between 0 and 1000) then return false; end if;
      if ex ? 'descanso' and jsonb_typeof(ex->'descanso') <> 'null' and (jsonb_typeof(ex->'descanso') <> 'number' or (ex->>'descanso')::numeric not between 0 and 900 or (ex->>'descanso')::numeric <> trunc((ex->>'descanso')::numeric)) then return false; end if;
      if ex ? 'obs' and jsonb_typeof(ex->'obs') <> 'null' and (jsonb_typeof(ex->'obs') <> 'string' or char_length(ex->>'obs') > 200) then return false; end if;
    end loop;
  end loop;
  return true;
end; $$;

-- Registro de um treino feito: {"<nº do exercício>": {"feito": bool, "carga": kg?}}
create or replace function privado.registro_valido(r jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb;
begin
  if jsonb_typeof(r) is distinct from 'object' then return false; end if;
  for k, v in select * from jsonb_each(r) loop
    if k !~ '^([0-9]|[12][0-9])$' or jsonb_typeof(v) <> 'object'
      or exists (select 1 from jsonb_object_keys(v) c where c not in ('feito', 'carga')) then return false; end if;
    if v ? 'feito' and jsonb_typeof(v->'feito') <> 'boolean' then return false; end if;
    if v ? 'carga' and jsonb_typeof(v->'carga') <> 'null' and (jsonb_typeof(v->'carga') <> 'number' or (v->>'carga')::numeric not between 0 and 1000) then return false; end if;
  end loop;
  return true;
end; $$;

create table public.fichas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null,
  personal_id uuid not null default auth.uid(),
  objetivo text not null default 'hipertrofia' check (objetivo in ('hipertrofia', 'forca', 'emagrecimento', 'resistencia', 'saude', 'outro')),
  divisao text not null default 'abc' check (divisao in ('corpo', 'ab', 'abc', 'ppl', 'abcd', 'abcde', 'semana', 'personalizada')),
  inicio date not null default current_date check (inicio between date '2020-01-01' and current_date + 366),
  semanas smallint check (semanas between 1 and 52),
  vezes_semana smallint check (vezes_semana between 1 and 7),
  observacao text check (observacao is null or char_length(observacao) <= 1000),
  treinos jsonb not null check (privado.treinos_validos(treinos)),
  encerrada_em date, -- vazia = ficha ativa
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (aluno_id, personal_id) references public.alunos (id, personal_id) on delete cascade
);
create unique index fichas_uma_ativa on public.fichas (aluno_id) where encerrada_em is null;
create index fichas_aluno on public.fichas (aluno_id, inicio);
create unique index fichas_id_aluno on public.fichas (id, aluno_id);
alter table public.fichas enable row level security;
create trigger fichas_atualizado before update on public.fichas for each row execute function privado.tocar_atualizado_em();

create table public.treinos_feitos (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null,
  aluno_id uuid not null,
  personal_id uuid not null,
  treino smallint not null check (treino between 0 and 9),
  data date not null default current_date check (data between date '2020-01-01' and current_date + 1),
  exercicios jsonb not null default '{}' check (privado.registro_valido(exercicios)),
  criado_em timestamptz not null default now(),
  foreign key (ficha_id, aluno_id) references public.fichas (id, aluno_id) on delete cascade,
  foreign key (aluno_id, personal_id) references public.alunos (id, personal_id) on delete cascade
);
create index treinos_feitos_aluno on public.treinos_feitos (aluno_id, data);
create index treinos_feitos_ficha on public.treinos_feitos (ficha_id, aluno_id);
create index treinos_feitos_personal on public.treinos_feitos (personal_id);
alter table public.treinos_feitos enable row level security;

-- O aluno e o personal saem da ficha, não do app; o treino precisa existir na ficha.
create or replace function privado.treino_feito_preencher()
returns trigger language plpgsql security definer set search_path = '' as $$
declare f record;
begin
  select fi.aluno_id, fi.personal_id, jsonb_array_length(fi.treinos) as n into f from public.fichas fi where fi.id = new.ficha_id;
  if not found then raise exception 'ficha inexistente' using errcode = '23503'; end if;
  if new.treino >= f.n then raise exception 'treino fora da ficha' using errcode = '23514'; end if;
  new.aluno_id := f.aluno_id;
  new.personal_id := f.personal_id;
  if tg_op = 'INSERT' then new.criado_em := now(); end if;
  return new;
end; $$;
revoke all on function privado.treino_feito_preencher() from public, anon, authenticated;
create trigger treinos_feitos_preencher before insert or update on public.treinos_feitos
  for each row execute function privado.treino_feito_preencher();

-- Fichas: o personal cuida das fichas dos alunos dele; o aluno só lê as próprias.
create policy personal_fichas on public.fichas for all to authenticated
  using (personal_id = (select auth.uid()))
  with check (personal_id = (select auth.uid()) and (select privado.sou_personal()));
create policy aluno_ve_suas_fichas on public.fichas for select to authenticated
  using (aluno_id = (select privado.meu_aluno_id()));

-- Treinos feitos: o aluno registra, corrige e desfaz os próprios; o personal acompanha.
create policy aluno_treinos_feitos on public.treinos_feitos for all to authenticated
  using (aluno_id = (select privado.meu_aluno_id()))
  with check (aluno_id = (select privado.meu_aluno_id()));
create policy personal_ve_treinos_feitos on public.treinos_feitos for select to authenticated
  using (personal_id = (select auth.uid()));

revoke all on public.fichas, public.treinos_feitos from public, anon, authenticated;
grant select, insert, delete on public.fichas to authenticated;
grant update (objetivo, divisao, inicio, semanas, vezes_semana, observacao, treinos, encerrada_em) on public.fichas to authenticated;
grant select, insert, delete on public.treinos_feitos to authenticated;
grant update (treino, data, exercicios) on public.treinos_feitos to authenticated;
grant execute on function privado.treinos_validos(jsonb), privado.registro_valido(jsonb) to authenticated;
