#!/usr/bin/env bash
# Ensaio completo do backup, sem tocar no Supabase real (mesmo modelo do Financeiro):
# cria um banco local com as MIGRAÇÕES REAIS e dados fictícios (personal, aluna com login, avaliação,
# aceite do termo e mensagens), roda scripts/backup.sh, descriptografa, restaura num banco vazio e confere
# se tudo voltou igual: dados, regras de acesso, permissões e gatilhos.
# Requer: PostgreSQL em PGHOST/PGPORT com superusuário (PGUSER/PGPASSWORD), age e age-keygen.
set -Eeuo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf -- "$tmp"' EXIT
export PGSSLMODE=disable PGDATABASE=postgres PGUSER="${PGUSER:-postgres}"
q() { psql -v ON_ERROR_STOP=1 -qAt "$@"; }

for db in aval_origem aval_destino; do q -c "drop database if exists $db" -c "create database $db"; done
simular_supabase() { q -d "$1" -f "$raiz/tests/supabase-simulado.sql"; }
simular_supabase aval_origem
for m in "$raiz"/supabase/migrations/*.sql; do q -d aval_origem -f "$m"; done

P=00000000-0000-0000-0000-0000000000a1; AL=00000000-0000-0000-0000-0000000000c3
como() { q -d aval_origem -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub', '$1', true); $2; commit;" | tail -1; }
q -d aval_origem -c "insert into auth.users (id, email) values ('$P','personal@exemplo.com'), ('$AL','aluna@exemplo.com')"
q -d aval_origem -c "insert into auth.identities values ('00000000-0000-0000-0000-0000000000d1', '$P'), ('00000000-0000-0000-0000-0000000000d2', '$AL')"
ALUNA="$(como $P "insert into public.alunos (nome, sexo, nascimento) values ('Aluna Teste','F','1994-03-12') returning id")"
AV="$(como $P "insert into public.avaliacoes (aluno_id, data, peso, altura, perimetros, dobras, parecer) values ('$ALUNA','2026-10-14',63.8,1.65,'{\"cintura\":71}','{\"triceps\":[22,22]}','Ótima adesão') returning id")"
q -d aval_origem -c "update public.alunos set usuario_id = '$AL' where id = '$ALUNA'" \
  -c "insert into public.consentimentos (aluno_id, usuario_id, versao_termo) values ('$ALUNA','$AL','2026-11-09')"
como $P "insert into public.mensagens (aluno_id, avaliacao_id) values ('$ALUNA','$AV') returning id" >/dev/null
como $AL "insert into public.mensagens (aluno_id, texto) values ('$ALUNA','Obrigada!') returning id" >/dev/null

age-keygen -o "$tmp/chave.txt" 2>/dev/null
publica="$(age-keygen -y "$tmp/chave.txt")"
for escopo in dados auth; do
  BACKUP_SCOPE=$escopo PG_CLIENT=local PGDATABASE=aval_origem BACKUP_AGE_RECIPIENT="$publica" BACKUP_OUTPUT_DIR="$tmp/saida" \
    bash "$raiz/scripts/backup.sh" >/dev/null
done
ls "$tmp/saida" | grep -q '\.dump$' && { echo "FALHA: sobrou arquivo sem criptografia"; exit 1; }
( cd "$tmp/saida" && sha256sum -c --quiet ./*.sha256 )
grep -q "Aluna Teste" "$tmp"/saida/*.age && { echo "FALHA: dado legível no arquivo criptografado"; exit 1; }

# Restauração num banco vazio: primeiro as contas de login, depois os dados (o esquema public já existe).
simular_supabase aval_destino
for escopo in auth dados; do
  age --decrypt -i "$tmp/chave.txt" -o "$tmp/$escopo.dump" "$(ls "$tmp"/saida/avaliacao_${escopo}_*.dump.age)"
done
pg_restore --no-owner --no-acl -d aval_destino "$tmp/auth.dump"
pg_restore -l "$tmp/dados.dump" | grep -vE ' SCHEMA - public ' > "$tmp/lista.txt"
pg_restore --no-owner --exit-on-error -L "$tmp/lista.txt" -d aval_destino "$tmp/dados.dump"

conferir() { q -d "$1" -c "select concat_ws('|',
  (select count(*) from public.personais)||'/'||(select count(*) from public.alunos)||'/'||(select count(*) from public.avaliacoes)||'/'||
  (select count(*) from public.consentimentos)||'/'||(select count(*) from public.mensagens),
  coalesce((select string_agg(coalesce(texto, 'cartão'), ',' order by criado_em) from public.mensagens), '-'),
  (select count(*) from auth.users),
  (select string_agg(tablename||'.'||policyname, ',' order by tablename, policyname) from pg_policies where schemaname='public'),
  (select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
  (select string_agg(tgname, ',' order by tgname) from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'public.%'),
  (select string_agg(grantee||':'||table_name||':'||privilege_type, ',' order by grantee, table_name, privilege_type) from information_schema.role_table_grants where grantee in ('anon','authenticated','service_role') and table_schema='public'),
  has_function_privilege('authenticated','public.excluir_aluno(uuid)','execute')||'/'||has_function_privilege('anon','public.excluir_aluno(uuid)','execute')||'/'||has_schema_privilege('authenticated','privado','usage'))"; }
antes="$(conferir aval_origem)"; depois="$(conferir aval_destino)"
echo "Conferido (contagens|mensagens|contas): $(cut -d'|' -f1-3 <<<"$antes")"
[[ -n "$antes" && "$antes" == "$depois" ]] || { echo "Origem:  $antes"; echo "Destino: $depois"; echo "FALHA: o banco restaurado ficou diferente"; exit 1; }

# As regras continuam valendo depois da restauração: a aluna lê só a própria conversa e não anexa avaliação.
d() { q -d aval_destino -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub', '$1', true); $2; commit;" 2>&1 | tail -1; }
[[ "$(d $AL 'select count(*) from public.mensagens')" == 2 ]] || { echo "FALHA: aluna não lê a conversa restaurada"; exit 1; }
[[ "$(d $AL "insert into public.mensagens (aluno_id, avaliacao_id, texto) values ('$ALUNA','$AV','x') returning id")" == *ERROR* ]] || { echo "FALHA: regra das mensagens não veio na restauração"; exit 1; }
[[ "$(d 00000000-0000-0000-0000-0000000000b2 'select count(*) from public.avaliacoes')" == 0 ]] || { echo "FALHA: outro usuário vê avaliações"; exit 1; }
for db in aval_origem aval_destino; do q -c "drop database $db"; done
echo "Backup aprovado: criptografado, checksum conferido, restaurado igual à origem e com as regras ativas."
