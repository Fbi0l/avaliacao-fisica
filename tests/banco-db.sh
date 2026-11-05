#!/usr/bin/env bash
# Banco (PostgreSQL de teste, sem tocar no Supabase real): personal, alunos, avaliações, convites,
# visão do aluno, validação das medidas e exclusão. Uso: PGHOST/PGPORT apontando para um PostgreSQL local.
set -Eeuo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
export PGSSLMODE=disable PGDATABASE=postgres PGUSER="${PGUSER:-postgres}"
q() { psql -v ON_ERROR_STOP=1 -qAt "$@"; }
B=aval_teste
q -c "drop database if exists $B" -c "create database $B"
q -d $B -f "$raiz/tests/supabase-simulado.sql"
for m in "$raiz"/supabase/migrations/*.sql; do q -d $B -f "$m"; done

P1=00000000-0000-0000-0000-0000000000a1; P2=00000000-0000-0000-0000-0000000000b2; AL=00000000-0000-0000-0000-0000000000c3
q -d $B -c "insert into auth.users (id, email) values ('$P1','personal@exemplo.com')"
q -d $B -c "insert into auth.users (id, email) values ('$P2','outro@exemplo.com'), ('$AL','aluna@exemplo.com')"

como() { # papel, usuario, sql -> última linha (resultado ou erro)
  { q -d $B -c "begin; set local role $1; select set_config('request.jwt.claim.sub', '$2', true); $3; commit;" 2>&1 || true; } | { grep -v "^CONTEXT\|^PL/pgSQL\|^$\|^LINE\|^ *\^" || true; } | tail -1; }
falha=0; ok() { echo "ok  $1"; }; erro() { echo "ERRO $1: $2"; falha=1; }
confere() { [[ "$2" == "$3" ]] && ok "$1" || erro "$1" "esperado '$3', veio '$2'"; }
recusa() { [[ "$2" == *ERROR* || "$2" == *DETAIL* || "$2" == "" || "$2" == "0" ]] && ok "$1" || erro "$1" "deveria recusar, veio '$2'"; }

confere "primeiro usuário vira o personal" "$(q -d $B -c 'select usuario_id from public.personais')" "$P1"
# Função de cadastro (service_role): exatamente o que ela usa, e nada além.
confere "cadastro lê o convite" "$(q -d $B -c "begin; set local role service_role; select count(*) >= 0 from public.convites_aluno; commit;" 2>&1 | tail -1)" "t"
confere "cadastro lê o nome do personal" "$(q -d $B -c "begin; set local role service_role; select count(*) > 0 from public.personais; commit;" 2>&1 | tail -1)" "t"
recusa "cadastro não lê avaliações" "$(q -d $B -c "begin; set local role service_role; select count(*) from public.avaliacoes; commit;" 2>&1 | tail -1)"
recusa "cadastro não apaga alunos" "$(q -d $B -c "begin; set local role service_role; delete from public.alunos; commit;" 2>&1 | tail -1)"
confere "papel do personal" "$(como authenticated $P1 'select public.meu_papel()')" "personal"
confere "usuário sem cadastro não tem papel" "$(como authenticated $P2 "select coalesce(public.meu_papel(), 'nenhum')")" "nenhum"

ALUNA="$(como authenticated $P1 "insert into public.alunos (nome, sexo, nascimento, etnia) values ('Mariana Costa','F','1994-03-12','branca') returning id")"
[[ "$ALUNA" =~ ^[0-9a-f-]{36}$ ]] && ok "personal cadastra aluno" || erro "cadastrar aluno" "$ALUNA"
recusa "quem não é personal não cadastra aluno" "$(como authenticated $P2 "insert into public.alunos (nome, sexo, nascimento) values ('X','M','1990-01-01') returning id")"
recusa "visitante sem login não lê alunos" "$(como anon 00000000-0000-0000-0000-000000000000 'select count(*) from public.alunos')"

AV='{"bracoD":29,"cintura":71,"coxaMedD":55.6,"pantD":36.4}'
DB='{"triceps":[22,22.4],"subesc":[19,null],"biceps":[9],"iliaca":[21,21],"supraesp":[12,12],"abdominal":[24,24],"coxa":[27,27],"panturrilha":[17,17]}'
AVAL="$(como authenticated $P1 "insert into public.avaliacoes (aluno_id, data, peso, altura, pas, pad, perimetros, dobras, forca, parecer) values ('$ALUNA','2026-10-14',63.8,1.65,116,76,'$AV','$DB','{\"supino\":{\"carga\":38,\"reps\":8}}','Ótima adesão') returning id")"
[[ "$AVAL" =~ ^[0-9a-f-]{36}$ ]] && ok "personal registra avaliação" || erro "registrar avaliação" "$AVAL"
recusa "medida desconhecida é recusada" "$(como authenticated $P1 "insert into public.avaliacoes (aluno_id, peso, altura, perimetros) values ('$ALUNA',60,1.6,'{\"pescoco\":30}') returning id")"
recusa "medida fora da faixa é recusada" "$(como authenticated $P1 "insert into public.avaliacoes (aluno_id, peso, altura, perimetros) values ('$ALUNA',60,1.6,'{\"cintura\":900}') returning id")"
recusa "dobra com texto é recusada" "$(como authenticated $P1 "insert into public.avaliacoes (aluno_id, peso, altura, dobras) values ('$ALUNA',60,1.6,'{\"triceps\":[\"20\"]}') returning id")"
recusa "repetições quebradas são recusadas" "$(como authenticated $P1 "insert into public.avaliacoes (aluno_id, peso, altura, forca) values ('$ALUNA',60,1.6,'{\"supino\":{\"carga\":40,\"reps\":2.5}}') returning id")"
recusa "peso absurdo é recusado" "$(como authenticated $P1 "insert into public.avaliacoes (aluno_id, peso, altura) values ('$ALUNA',600,1.6) returning id")"
confere "avaliação antiga fica com Faulkner" "$(q -d $B -c "select equacao_gordura from public.avaliacoes where id='$AVAL'")" "faulkner"
confere "personal troca a equação para Petroski" "$(como authenticated $P1 "update public.avaliacoes set equacao_gordura='petroski' where id='$AVAL' returning equacao_gordura")" "petroski"
recusa "equação desconhecida é recusada" "$(como authenticated $P1 "update public.avaliacoes set equacao_gordura='xyz' where id='$AVAL' returning id")"

# Um segundo personal (etapa 3) não alcança nada do primeiro.
q -d $B -c "insert into public.personais (usuario_id, nome) values ('$P2','Outro personal')"
confere "outro personal não vê os alunos do primeiro" "$(como authenticated $P2 'select count(*) from public.alunos')" "0"
confere "outro personal não vê as avaliações do primeiro" "$(como authenticated $P2 'select count(*) from public.avaliacoes')" "0"
recusa "outro personal não grava avaliação no aluno do primeiro" "$(como authenticated $P2 "insert into public.avaliacoes (aluno_id, peso, altura) values ('$ALUNA',60,1.6) returning id")"
recusa "outro personal não gera convite para aluno do primeiro" "$(como authenticated $P2 "select codigo from public.criar_convite_aluno('$ALUNA')")"
confere "outro personal não apaga aluno do primeiro" "$(como authenticated $P2 "select public.excluir_aluno('$ALUNA')")" "f"
q -d $B -c "delete from public.personais where usuario_id = '$P2'"

# Convite: código de 43 caracteres, banco guarda só o hash; gerar outro cancela o anterior.
COD1="$(como authenticated $P1 "select codigo from public.criar_convite_aluno('$ALUNA')")"
COD="$(como authenticated $P1 "select codigo from public.criar_convite_aluno('$ALUNA')")"
[[ "$COD" =~ ^[A-Za-z0-9_-]{43}$ ]] && ok "convite com código de 43 caracteres" || erro "convite" "$COD"
H="$(printf '%s' "$COD" | sha256sum | cut -d' ' -f1)"
confere "banco guarda só o hash do código" "$(q -d $B -c "select count(*) from public.convites_aluno where codigo_hash = '$H'")" "1"
confere "novo convite cancela o anterior" "$(q -d $B -c "select count(*) from public.convites_aluno where cancelado_em is null")" "1"
confere "situação do convite" "$(como authenticated $P1 "select situacao from public.convite_do_aluno('$ALUNA')")" "pendente"
recusa "app não lê a tabela de convites direto" "$(como authenticated $P1 'select count(*) from public.convites_aluno')"

# Cadastro pelo convite (o que a função registrar-aluno faz com a chave de serviço).
q -d $B -c "begin; set local role service_role;
  update public.convites_aluno set usado_em = now(), usado_por = '$AL' where codigo_hash = '$H';
  update public.alunos set usuario_id = '$AL' where id = '$ALUNA';
  insert into public.consentimentos (aluno_id, usuario_id, versao_termo) values ('$ALUNA','$AL','2026-11-04'); commit;"
confere "papel da aluna" "$(como authenticated $AL 'select public.meu_papel()')" "aluno"
confere "aluna vê a própria ficha" "$(como authenticated $AL 'select nome from public.alunos')" "Mariana Costa"
confere "aluna vê as próprias avaliações" "$(como authenticated $AL 'select count(*) from public.avaliacoes')" "1"
confere "aluna vê o nome do seu personal" "$(como authenticated $AL 'select nome from public.personais')" "Personal"
confere "aluna vê o próprio consentimento" "$(como authenticated $AL 'select versao_termo from public.consentimentos')" "2026-11-04"
recusa "aluna não altera avaliação" "$(como authenticated $AL "with x as (update public.avaliacoes set peso = 50 returning 1) select count(*) from x")"
recusa "aluna não cria avaliação" "$(como authenticated $AL "insert into public.avaliacoes (aluno_id, personal_id, peso, altura) values ('$ALUNA','$P1',50,1.6) returning id")"
recusa "aluna não altera a própria ficha" "$(como authenticated $AL "with x as (update public.alunos set nome = 'X' returning 1) select count(*) from x")"
recusa "aluna não cadastra outro aluno" "$(como authenticated $AL "insert into public.alunos (personal_id, nome, sexo, nascimento) values ('$P1','X','M','1990-01-01') returning id")"
recusa "convite já usado não é gerado de novo" "$(como authenticated $P1 "select codigo from public.criar_convite_aluno('$ALUNA')")"

# Convite de novos personais: só o administrador (primeiro personal) gera; quem aceita fica separado.
confere "primeiro personal é administrador" "$(como authenticated $P1 'select public.sou_administrador()')" "t"
confere "aluna não é administradora" "$(como authenticated $AL 'select public.sou_administrador()')" "f"
CP="$(como authenticated $P1 "select codigo from public.criar_convite_personal('Prof. Carlos')")"
[[ "$CP" =~ ^[A-Za-z0-9_-]{43}$ ]] && ok "administrador gera convite de personal" || erro "convite de personal" "$CP"
HP="$(printf '%s' "$CP" | sha256sum | cut -d' ' -f1)"
confere "banco guarda só o hash do convite de personal" "$(q -d $B -c "select count(*) from public.convites_personal where codigo_hash = '$HP'")" "1"
recusa "aluna não gera convite de personal" "$(como authenticated $AL "select codigo from public.criar_convite_personal(null)")"
recusa "visitante sem login não gera convite de personal" "$(como anon 00000000-0000-0000-0000-000000000000 "select codigo from public.criar_convite_personal(null)")"
recusa "app não lê a tabela de convites de personal direto" "$(como authenticated $P1 'select count(*) from public.convites_personal')"
confere "administrador vê o convite pendente" "$(como authenticated $P1 'select situacao from public.listar_convites_personal() limit 1')" "pendente"
confere "aluna não vê convites de personal" "$(como authenticated $AL 'select count(*) from public.listar_convites_personal()')" "0"
# O que a função de cadastro faz com a chave de serviço: reserva o convite, cria a ficha do personal, registra quem usou.
q -d $B -c "begin; set local role service_role;
  update public.convites_personal set usado_em = now() where codigo_hash = '$HP' and usado_em is null;
  insert into public.personais (usuario_id, nome, termo_versao, termo_aceito_em) values ('$P2','Prof. Carlos','2026-11-05', now());
  update public.convites_personal set usado_por = '$P2' where codigo_hash = '$HP'; commit;"
confere "novo personal tem papel de personal" "$(como authenticated $P2 'select public.meu_papel()')" "personal"
confere "novo personal não é administrador" "$(como authenticated $P2 'select public.sou_administrador()')" "f"
recusa "novo personal não se promove a administrador" "$(como authenticated $P2 "with x as (update public.personais set admin = true where usuario_id = '$P2' returning 1) select count(*) from x")"
recusa "novo personal não convida personais" "$(como authenticated $P2 "select codigo from public.criar_convite_personal(null)")"
confere "novo personal começa sem alunos (não vê os do outro)" "$(como authenticated $P2 'select count(*) from public.alunos')" "0"
confere "novo personal não vê avaliações do outro" "$(como authenticated $P2 'select count(*) from public.avaliacoes')" "0"
ALUNO2="$(como authenticated $P2 "insert into public.alunos (nome, sexo, nascimento) values ('João Teste','M','1990-05-05') returning id")"
[[ "$ALUNO2" =~ ^[0-9a-f-]{36}$ ]] && ok "novo personal cadastra o próprio aluno" || erro "aluno do novo personal" "$ALUNO2"
confere "primeiro personal não vê o aluno do novo" "$(como authenticated $P1 "select count(*) from public.alunos where id = '$ALUNO2'")" "0"
confere "novo personal não vê o nome do outro personal" "$(como authenticated $P2 "select count(*) from public.personais where usuario_id = '$P1'")" "0"
confere "convite aparece como usado, com o nome" "$(como authenticated $P1 "select situacao || ' ' || personal_nome from public.listar_convites_personal() limit 1")" "usado Prof. Carlos"
CP2="$(como authenticated $P1 "select codigo from public.criar_convite_personal(null)")"
ID2="$(q -d $B -c "select id from public.convites_personal where usado_em is null and cancelado_em is null")"
confere "administrador cancela convite pendente" "$(como authenticated $P1 "select public.cancelar_convite_personal('$ID2')")" "t"
confere "convite cancelado não cancela de novo" "$(como authenticated $P1 "select public.cancelar_convite_personal('$ID2')")" "f"
confere "outro personal não cancela convite" "$(como authenticated $P2 "select public.cancelar_convite_personal('$ID2')")" "f"
recusa "cadastro não lê avaliações nem com convite de personal" "$(q -d $B -c "begin; set local role service_role; select count(*) from public.avaliacoes; commit;" 2>&1 | tail -1)"

# Aluno de exemplo: o personal cria com exemplo = true; não recebe convite.
EX="$(como authenticated $P1 "insert into public.alunos (nome, sexo, nascimento, exemplo) values ('Mariana Costa (exemplo)','F','1994-03-12', true) returning id")"
[[ "$EX" =~ ^[0-9a-f-]{36}$ ]] && ok "personal cria o aluno de exemplo" || erro "aluno de exemplo" "$EX"
recusa "aluno de exemplo não recebe convite" "$(como authenticated $P1 "select codigo from public.criar_convite_aluno('$EX')")"
confere "aluno comum começa sem a marca de exemplo" "$(q -d $B -c "select exemplo from public.alunos where id = '$ALUNA'")" "f"
confere "personal apaga o aluno de exemplo" "$(como authenticated $P1 "select public.excluir_aluno('$EX')")" "t"

# Exclusão (LGPD): some tudo, inclusive o login da aluna; o personal continua.
confere "personal apaga a aluna" "$(como authenticated $P1 "select public.excluir_aluno('$ALUNA')")" "t"
confere "avaliações apagadas junto" "$(q -d $B -c 'select count(*) from public.avaliacoes')" "0"
confere "consentimento apagado junto" "$(q -d $B -c 'select count(*) from public.consentimentos')" "0"
confere "login da aluna apagado" "$(q -d $B -c "select count(*) from auth.users where id = '$AL'")" "0"
confere "personal continua" "$(q -d $B -c "select count(*) from public.personais where usuario_id = '$P1'")" "1"

q -c "drop database $B" >/dev/null
[[ $falha == 0 ]] && echo "Banco aprovado." || { echo "Banco com falhas."; exit 1; }
