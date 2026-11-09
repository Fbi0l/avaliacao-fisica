-- 0.7.0: testes físicos na avaliação (sugestões do professor, 09/11/2026).
-- testes = { flexao: repetições (0 a 150), abdominal: repetições em 1 min (0 a 150),
--            aerobico: { tipo: 'cooper' | 'livre', distancia: metros (100 a 10000),
--                        tempo: minutos (só no livre, 1 a 300), fc_final: bpm (40 a 230, opcional) },
--            flexiteste: { 'I'..'XX': nota inteira de 0 a 4 } }
-- Tudo opcional. Avaliações antigas ficam com {}.
create or replace function privado.testes_valida(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; c text; romanos text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X',
  'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if k in ('flexao', 'abdominal') then
      if jsonb_typeof(v) <> 'number' or (v#>>'{}')::numeric not between 0 and 150
         or (v#>>'{}')::numeric <> trunc((v#>>'{}')::numeric) then return false; end if;
    elsif k = 'aerobico' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      if exists (select 1 from jsonb_object_keys(v) x where x not in ('tipo','distancia','tempo','fc_final')) then return false; end if;
      if coalesce(v->>'tipo', '') not in ('cooper', 'livre') then return false; end if;
      if jsonb_typeof(v->'distancia') is distinct from 'number' or (v->>'distancia')::numeric not between 100 and 10000 then return false; end if;
      if v->>'tipo' = 'cooper' and v ? 'tempo' then return false; end if;
      if v->>'tipo' = 'livre' and (jsonb_typeof(v->'tempo') is distinct from 'number' or (v->>'tempo')::numeric not between 1 and 300) then return false; end if;
      if v ? 'fc_final' and (jsonb_typeof(v->'fc_final') is distinct from 'number' or (v->>'fc_final')::numeric not between 40 and 230
         or (v->>'fc_final')::numeric <> trunc((v->>'fc_final')::numeric)) then return false; end if;
    elsif k = 'flexiteste' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      for c in select * from jsonb_object_keys(v) loop
        if not (c = any(romanos)) or jsonb_typeof(v->c) <> 'number' or (v->>c)::numeric not in (0, 1, 2, 3, 4) then return false; end if;
      end loop;
    else
      return false;
    end if;
  end loop;
  return true;
exception when others then return false;
end; $$;

revoke all on function privado.testes_valida(jsonb) from public, anon;
grant execute on function privado.testes_valida(jsonb) to authenticated;

alter table public.avaliacoes
  add column testes jsonb not null default '{}' check (privado.testes_valida(testes));
grant update (testes) on public.avaliacoes to authenticated;

-- Correção na regra da força (0.5.0): um campo ausente (nome, carga ou repetições) passava como desconhecido.
-- Agora a ausência também é recusada. O app sempre manda os três; nada salvo muda.
create or replace function privado.forca_valida(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; o jsonb; nomes text[] := '{}'; n text;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if k = 'outros' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 8 then return false; end if;
      for o in select * from jsonb_array_elements(v) loop
        if jsonb_typeof(o) <> 'object' then return false; end if;
        if exists (select 1 from jsonb_object_keys(o) c where c not in ('nome','carga','reps')) then return false; end if;
        if jsonb_typeof(o->'nome') is distinct from 'string' or jsonb_typeof(o->'carga') is distinct from 'number'
           or jsonb_typeof(o->'reps') is distinct from 'number' then return false; end if;
        n := lower(btrim(o->>'nome'));
        if coalesce(char_length(n), 0) not between 1 and 40 or n = any(nomes) then return false; end if;
        nomes := nomes || n;
        if (o->>'carga')::numeric not between 1 and 1000 or (o->>'reps')::numeric not between 1 and 30
           or (o->>'reps')::numeric <> trunc((o->>'reps')::numeric) then return false; end if;
      end loop;
      continue;
    end if;
    if not (k = any(array['supino','leg_press'])) then return false; end if;
    if jsonb_typeof(v) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(v) c where c not in ('carga','reps')) then return false; end if;
    if jsonb_typeof(v->'carga') is distinct from 'number' or jsonb_typeof(v->'reps') is distinct from 'number' then return false; end if;
    if (v->>'carga')::numeric not between 1 and 1000 or (v->>'reps')::numeric not between 1 and 30
       or (v->>'reps')::numeric <> trunc((v->>'reps')::numeric) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end; $$;
