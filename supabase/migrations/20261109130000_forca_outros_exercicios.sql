-- 0.5.0: teste de força em qualquer exercício (pedido do professor, 09/11/2026).
-- Além de supino e leg press, a avaliação aceita a chave "outros": lista de até 8 exercícios
-- escolhidos pelo personal, cada um { nome (1 a 40 letras), carga (1 a 1000 kg), reps (1 a 30, inteiro) },
-- sem nomes repetidos (ignorando maiúsculas). Avaliações antigas continuam válidas.
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
        if jsonb_typeof(o->'nome') <> 'string' or jsonb_typeof(o->'carga') <> 'number' or jsonb_typeof(o->'reps') <> 'number' then return false; end if;
        n := lower(btrim(o->>'nome'));
        if char_length(n) not between 1 and 40 or n = any(nomes) then return false; end if;
        nomes := nomes || n;
        if (o->>'carga')::numeric not between 1 and 1000 or (o->>'reps')::numeric not between 1 and 30
           or (o->>'reps')::numeric <> trunc((o->>'reps')::numeric) then return false; end if;
      end loop;
      continue;
    end if;
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

revoke all on function privado.forca_valida(jsonb) from public, anon;
grant execute on function privado.forca_valida(jsonb) to authenticated;
