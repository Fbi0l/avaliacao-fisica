-- 0.8.0: avaliação postural visual (sugestão do professor, 09/11/2026; checklist por vistas, Kendall et al.).
-- postura = {} quando não foi feita; { itens: { chave: alteração }, obs?: texto } quando foi.
-- Item ausente = sem alteração. As chaves e valores permitidos são os mesmos de POSTURA no calculos.js (o teste confere).
create or replace function privado.postura_valida(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare permitidos constant jsonb := '{"cabeca_lateral":["direita","esquerda"],"ombros_nivel":["direito","esquerdo"],"pelve_nivel":["direita","esquerda"],"joelhos_frontal":["valgo","varo"],"pes":["plano","cavo"],"cabeca_sagital":["anteriorizada"],"ombros_sagital":["protusos"],"toracica":["hipercifose","retificada"],"lombar":["hiperlordose","retificada"],"pelve_sagital":["anteversao","retroversao"],"joelhos_sagital":["hiperextensao","semiflexao"],"abdome":["protuso"],"escapulas":["aladas"],"coluna_lateral":["direita","esquerda"],"calcaneos":["valgo","varo"]}';
  k text; v jsonb;
begin
  if p is null or p = '{}'::jsonb then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  if exists (select 1 from jsonb_object_keys(p) x where x not in ('itens', 'obs')) then return false; end if;
  if jsonb_typeof(p->'itens') is distinct from 'object' then return false; end if;
  for k, v in select * from jsonb_each(p->'itens') loop
    if not permitidos ? k or jsonb_typeof(v) <> 'string' or not (permitidos->k) ? (v#>>'{}') then return false; end if;
  end loop;
  if p ? 'obs' and (jsonb_typeof(p->'obs') is distinct from 'string' or char_length(p->>'obs') not between 1 and 1000) then return false; end if;
  return true;
exception when others then return false;
end; $$;

revoke all on function privado.postura_valida(jsonb) from public, anon;
grant execute on function privado.postura_valida(jsonb) to authenticated;

alter table public.avaliacoes
  add column postura jsonb not null default '{}' check (privado.postura_valida(postura));
grant update (postura) on public.avaliacoes to authenticated;
