-- Etapa 1: personais, alunos, avaliações, convites do aluno e consentimentos.
-- Preparado para vários personais: cada aluno pertence a um personal, e as regras de acesso (RLS)
-- garantem que um personal só alcance os próprios alunos e que o aluno só veja os próprios dados.
-- O banco guarda só o que é medido; os resultados são calculados no app (calculos.js).

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create or replace function privado.tocar_atualizado_em()
returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em := now(); return new; end; $$;

-- Confere um objeto JSON de medidas: só chaves conhecidas e números dentro da faixa.
create or replace function privado.medidas_validas(p jsonb, chaves text[], minimo numeric, maximo numeric)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if not (k = any(chaves)) then return false; end if;
    if jsonb_typeof(v) = 'null' then continue; end if;
    if jsonb_typeof(v) <> 'number' then return false; end if;
    if (v #>> '{}')::numeric < minimo or (v #>> '{}')::numeric > maximo then return false; end if;
  end loop;
  return true;
end; $$;

-- Dobras: cada dobra é [1ª medida, 2ª medida] (a 2ª pode ser null), em mm.
create or replace function privado.dobras_validas(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; x jsonb;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if not (k = any(array['triceps','subesc','biceps','iliaca','supraesp','abdominal','coxa','panturrilha'])) then return false; end if;
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) not between 1 and 2 then return false; end if;
    for x in select * from jsonb_array_elements(v) loop
      if jsonb_typeof(x) = 'null' then continue; end if;
      if jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric <= 0 or (x #>> '{}')::numeric > 80 then return false; end if;
    end loop;
  end loop;
  return true;
end; $$;

-- Força: {"supino": {"carga": kg, "reps": n}, "leg_press": {...}}.
create or replace function privado.forca_valida(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if not (k = any(array['supino','leg_press'])) then return false; end if;
    if jsonb_typeof(v) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(v) c where c not in ('carga','reps')) then return false; end if;
    if jsonb_typeof(v->'carga') not in ('number','null') or jsonb_typeof(v->'reps') not in ('number','null') then return false; end if;
    if (v->>'carga')::numeric not between 1 and 1000 or (v->>'reps')::numeric not between 1 and 30
       or (v->>'reps')::numeric <> trunc((v->>'reps')::numeric) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end; $$;

-- PERSONAIS: na etapa 1, o primeiro usuário do projeto vira o personal (gatilho abaixo).
create table public.personais (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default 'Personal' check (char_length(btrim(nome)) between 1 and 80),
  cref text check (cref is null or char_length(btrim(cref)) between 1 and 30),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ALUNOS
create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null default auth.uid() references public.personais(usuario_id) on delete cascade,
  usuario_id uuid unique references auth.users(id) on delete set null, -- login do aluno, quando ele aceita o convite
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  sexo text not null check (sexo in ('F','M')),
  nascimento date not null check (nascimento between date '1900-01-01' and current_date),
  etnia text not null default 'branca' check (etnia in ('branca','negra','asiatica')),
  contato text check (contato is null or char_length(contato) <= 120),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, personal_id)
);
create index alunos_personal on public.alunos (personal_id, lower(nome));

-- AVALIAÇÕES
create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null,
  personal_id uuid not null default auth.uid(),
  data date not null default current_date check (data between date '2000-01-01' and current_date + 1),
  peso numeric(5,2) not null check (peso between 20 and 300),
  altura numeric(3,2) not null check (altura between 1.00 and 2.40),
  fc_repouso smallint check (fc_repouso between 25 and 220),
  pas smallint check (pas between 60 and 260),
  pad smallint check (pad between 30 and 160),
  glicose numeric(5,1) check (glicose between 20 and 900),
  triglicerideos numeric(6,1) check (triglicerideos between 10 and 5000),
  ldl numeric(5,1) check (ldl between 5 and 600),
  hdl numeric(5,1) check (hdl between 5 and 200),
  perimetros jsonb not null default '{}' check (privado.medidas_validas(perimetros,
    array['bracoD','bracoE','antD','antE','torax','cintura','abdomen','quadril','coxaSupD','coxaSupE','coxaMedD','coxaMedE','pantD','pantE'], 5, 250)),
  dobras jsonb not null default '{}' check (privado.dobras_validas(dobras)),
  forca jsonb not null default '{}' check (privado.forca_valida(forca)),
  parecer text check (parecer is null or char_length(parecer) <= 4000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- chave composta: impede gravar avaliação para aluno de outro personal
  foreign key (aluno_id, personal_id) references public.alunos (id, personal_id) on delete cascade
);
create index avaliacoes_aluno on public.avaliacoes (aluno_id, data);

-- CONVITES DO ALUNO: o banco guarda só o hash SHA-256 do código do link.
create table public.convites_aluno (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.personais(usuario_id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  codigo_hash text not null unique check (codigo_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  usado_por uuid references auth.users(id) on delete set null,
  cancelado_em timestamptz,
  check (expira_em > criado_em)
);

-- CONSENTIMENTOS: registro do aceite do termo pelo aluno (LGPD, dados de saúde).
create table public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  versao_termo text not null check (versao_termo ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  aceito_em timestamptz not null default now()
);

create trigger personais_atualizado before update on public.personais for each row execute function privado.tocar_atualizado_em();
create trigger alunos_atualizado before update on public.alunos for each row execute function privado.tocar_atualizado_em();
create trigger avaliacoes_atualizado before update on public.avaliacoes for each row execute function privado.tocar_atualizado_em();

-- Auxiliares das regras de acesso: só respondem sobre quem está logado. Ficam no esquema privado
-- (fora da API) e rodam com permissão própria, o que evita regras que dependem umas das outras em ciclo.
create or replace function privado.sou_personal() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.personais where usuario_id = (select auth.uid()));
$$;
create or replace function privado.meu_aluno_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.alunos where usuario_id = (select auth.uid());
$$;
create or replace function privado.meu_personal_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select personal_id from public.alunos where usuario_id = (select auth.uid());
$$;
-- Quem sou eu: 'personal', 'aluno' ou null. Usado pelo app para escolher as telas.
create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = '' as $$
  select case when privado.sou_personal() then 'personal'
              when privado.meu_aluno_id() is not null then 'aluno' end;
$$;

-- REGRAS DE ACESSO (RLS)
alter table public.personais enable row level security;
alter table public.alunos enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.convites_aluno enable row level security;
alter table public.consentimentos enable row level security;

create policy personal_ve_a_si on public.personais for select to authenticated
  using (usuario_id = (select auth.uid()) or usuario_id = (select privado.meu_personal_id()));
create policy personal_edita_a_si on public.personais for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

create policy personal_seus_alunos on public.alunos for all to authenticated
  using (personal_id = (select auth.uid()))
  with check (personal_id = (select auth.uid()) and (select privado.sou_personal()));
create policy aluno_ve_a_si on public.alunos for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy personal_avaliacoes on public.avaliacoes for all to authenticated
  using (personal_id = (select auth.uid())) with check (personal_id = (select auth.uid()));
create policy aluno_ve_suas_avaliacoes on public.avaliacoes for select to authenticated
  using (aluno_id = (select privado.meu_aluno_id()));

create policy consentimento_leitura on public.consentimentos for select to authenticated
  using (usuario_id = (select auth.uid())
         or aluno_id in (select a.id from public.alunos a where a.personal_id = (select auth.uid())));

-- Permissões: o app usa só o papel authenticated; o aluno só lê.
revoke all on public.personais, public.alunos, public.avaliacoes, public.convites_aluno, public.consentimentos from public, anon, authenticated;
grant select, update (nome, cref) on public.personais to authenticated;
grant select, insert, delete on public.alunos to authenticated;
grant update (nome, sexo, nascimento, etnia, contato) on public.alunos to authenticated;
grant select, insert, delete on public.avaliacoes to authenticated;
grant update (data, peso, altura, fc_repouso, pas, pad, glicose, triglicerideos, ldl, hdl, perimetros, dobras, forca, parecer) on public.avaliacoes to authenticated;
grant select on public.consentimentos to authenticated;
-- convites_aluno: nenhum acesso direto; só pelas funções abaixo e pela função de cadastro (service_role).

-- O primeiro usuário do projeto vira o personal. Os seguintes entram como alunos, por convite.
create or replace function privado.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.personais) then
    insert into public.personais (usuario_id, nome) values (new.id, 'Personal');
  end if;
  return new;
end; $$;
create trigger ao_criar_usuario_avaliacao after insert on auth.users for each row execute function privado.ao_criar_usuario();

-- CONVITES: só o personal do aluno gera, lista e cancela.
create or replace function public.criar_convite_aluno(p_aluno uuid)
returns table (id uuid, codigo text, expira_em timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare v_codigo text; v_eu uuid := (select auth.uid());
begin
  if not exists (select 1 from public.alunos a where a.id = p_aluno and a.personal_id = v_eu) then
    raise exception 'Aluno não encontrado.' using errcode = '42501';
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

create or replace function public.convite_do_aluno(p_aluno uuid)
returns table (id uuid, criado_em timestamptz, expira_em timestamptz, situacao text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.criado_em, c.expira_em,
    case when c.usado_por is not null then 'usado'
         when c.cancelado_em is not null then 'cancelado'
         when c.usado_em is not null and c.usado_em > now() - interval '10 minutes' then 'em_uso'
         when c.usado_em is not null then 'usado'
         when c.expira_em <= now() then 'vencido'
         else 'pendente' end
  from public.convites_aluno c
  where c.aluno_id = p_aluno and c.personal_id = (select auth.uid())
  order by c.criado_em desc limit 1;
$$;

create or replace function public.cancelar_convite_aluno(p_aluno uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare n int;
begin
  update public.convites_aluno c set cancelado_em = now()
   where c.aluno_id = p_aluno and c.personal_id = (select auth.uid())
     and c.usado_em is null and c.cancelado_em is null and c.expira_em > now();
  get diagnostics n = row_count;
  return n > 0;
end; $$;

-- EXCLUSÃO (LGPD): o personal apaga o aluno, as avaliações, os consentimentos e o login dele de uma vez.
create or replace function public.excluir_aluno(p_aluno uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_login uuid;
begin
  select a.usuario_id into v_login from public.alunos a where a.id = p_aluno and a.personal_id = (select auth.uid());
  if not found then return false; end if;
  delete from public.alunos a where a.id = p_aluno;
  if v_login is not null and not exists (select 1 from public.personais p where p.usuario_id = v_login) then
    delete from auth.users u where u.id = v_login;
  end if;
  return true;
end; $$;

revoke all on function public.meu_papel(), public.criar_convite_aluno(uuid), public.convite_do_aluno(uuid),
  public.cancelar_convite_aluno(uuid), public.excluir_aluno(uuid) from public, anon;
grant execute on function public.meu_papel(), public.criar_convite_aluno(uuid), public.convite_do_aluno(uuid),
  public.cancelar_convite_aluno(uuid), public.excluir_aluno(uuid) to authenticated;
revoke all on all functions in schema privado from public, anon, authenticated;
-- As regras de acesso chamam estas três como o usuário logado: ele precisa enxergar o esquema e executá-las.
grant usage on schema privado to authenticated;
grant execute on function privado.sou_personal(), privado.meu_aluno_id(), privado.meu_personal_id() to authenticated;
-- As validações das medidas rodam dentro das regras das tabelas, também como o usuário logado.
grant execute on function privado.medidas_validas(jsonb, text[], numeric, numeric), privado.dobras_validas(jsonb), privado.forca_valida(jsonb) to authenticated;
