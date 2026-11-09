# Backup automático criptografado

Todo dia às **06h17 (Fortaleza)**, o GitHub faz uma cópia do banco do app, confere se ela pode ser lida por inteiro, **criptografa** com a sua chave e guarda por **30 dias** em *Actions → Backup criptografado*. A conexão diária também evita que o Supabase pause o projeto gratuito por falta de uso. É o mesmo modelo do Financeiro.

São dados de saúde (LGPD): o arquivo só sai do GitHub criptografado e só abre com a sua chave privada, que fica no seu computador.

São dois arquivos por dia:

- `avaliacao_dados_…dump.age`: personais, alunos, avaliações, aceites do termo, mensagens, convites, regras de acesso, gatilhos e funções (esquemas `public` e `privado`).
- `avaliacao_auth_…dump.age`: as contas de login (e-mail e hash da senha), para recriar o acesso num projeto novo.

Ficam de fora as configurações do login no painel do Supabase, a função de cadastro (está em `supabase/functions`) e o gatilho que cria o personal administrador (está na primeira migração).

O workflow **Teste do backup** ensaia tudo com um PostgreSQL de teste e dados fictícios: aplica as migrações reais, faz o backup, restaura e compara origem e destino, inclusive as regras de acesso (`npm run test:backup` faz o mesmo aqui).

## Configurar (uma vez)

### 1. Chave de criptografia

Pode usar a mesma chave do Financeiro. Mostre a parte pública no PowerShell:

```powershell
age-keygen -y "$HOME\BackupsFinanceiro\chave-privada-backup-age.txt"
```

A linha que começa com `age1…` é a chave pública (pode ser colada no chat). A chave privada **nunca** vai para o GitHub nem para o chat.

### 2. Dados de conexão

No Supabase, abra o projeto **avaliacao-fisica** (organização "Avaliacao Fisica") → botão **Connect** → **Session pooler**. Anote o host e o usuário (`postgres.rsgbuvjrkrrybzoacjrh`).

A senha do banco não foi guardada na criação: gere uma nova em *Project Settings → Database → Reset database password*. O app não usa essa senha, então trocá-la não afeta nada.

### 3. Cadastrar no GitHub

Em *Settings → Secrets and variables → Actions* do repositório `avaliacao-fisica`:

| Aba | Nome | Valor |
|---|---|---|
| Variables | `SUPABASE_DB_HOST` | Host do *Session pooler* |
| Variables | `SUPABASE_DB_PORT` | `5432` |
| Variables | `SUPABASE_DB_USER` | `postgres.rsgbuvjrkrrybzoacjrh` |
| Variables | `BACKUP_AGE_RECIPIENT` | Chave pública `age1…` |
| Variables | `BACKUP_ENABLED` | `true` |
| **Secrets** | `SUPABASE_DB_PASSWORD` | Senha do banco (só você digita, nunca no chat) |

### 4. Primeiro teste

*Actions → Backup criptografado → Run workflow*. Ao terminar verde, baixe o artefato e teste a abertura:

```powershell
age --decrypt -i "$HOME\BackupsFinanceiro\chave-privada-backup-age.txt" `
  -o "$HOME\BackupsFinanceiro\avaliacao-teste.dump" "$HOME\Downloads\avaliacao_dados_DATA.dump.age"
```

O arquivo aberto tem dados de saúde dos alunos: apague-o depois do teste e nunca o publique.

## Restaurar (em caso de perda)

1. Crie um projeto Supabase novo. **Não** aplique as migrações: o backup já recria tabelas, regras de acesso, permissões, gatilhos e funções.
2. Restaure primeiro as contas de login e depois os dados, pulando só o item `SCHEMA public`, que já existe:

```bash
pg_restore --no-owner --no-acl -d "$URL_DO_BANCO" avaliacao_auth.dump
pg_restore -l avaliacao_dados.dump | grep -vE ' SCHEMA - public ' > lista.txt
pg_restore --no-owner --exit-on-error -L lista.txt -d "$URL_DO_BANCO" avaliacao_dados.dump
```

3. Recrie o gatilho `ao_criar_usuario_avaliacao` em `auth.users` (final da primeira migração) e desligue o cadastro aberto (*Authentication → Sign In / Providers*).
4. Publique a função `registrar-aluno` (verificação de JWT desligada).
5. Troque o endereço e a chave publicável no `app.js`, e o endereço na política de segurança do `index.html`.

O procedimento exato é o do teste automático `tests/backup-restauracao.sh`.
