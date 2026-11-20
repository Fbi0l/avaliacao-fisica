# Auditoria automática de segurança do Supabase

Toda segunda-feira às 06h50 (Fortaleza), o workflow **Auditoria de seguranca do Supabase** conecta ao banco do Avaliação Física **somente para leitura** e confere a configuração de segurança. É o mesmo modelo do Inventário.

1. **Regras fixas**, que nunca podem ser violadas (`scripts/auditoria-supabase-regras.sql`):
   - toda tabela com RLS ligado;
   - nenhum bucket do Storage público;
   - toda função `SECURITY DEFINER` (em `public` e `privado`) com `search_path` fixo e sem execução por quem não fez login;
   - `anon`/`authenticated` sem `TRUNCATE`, `TRIGGER`, `REFERENCES` ou `MAINTAIN` (permissões que ignoram o RLS);
   - nenhuma chave para `auth.users` que impeça excluir contas;
   - o próprio usuário da auditoria sem acesso a dados.
2. **Comparação com a foto aprovada** (`docs/auditoria-supabase-esperado.txt`): RLS, permissões, políticas com as condições completas, funções, gatilhos, chaves para contas e buckets. Qualquer mudança não planejada faz o workflow falhar e mostra a diferença no resumo, e o GitHub manda e-mail.

Em 20/11/2026, as regras foram conferidas no banco oficial: **nenhuma violação**. A foto aprovada foi gerada no mesmo dia e conferida por hash.

## Usuário de menor privilégio

A migração `auditoria_leitura` (já aplicada em 20/11/2026) criou o usuário de banco `auditoria_leitura`:

- lê apenas os catálogos do PostgreSQL (estrutura e configuração), **nenhuma linha de dados**: a própria migração confere isso e desfaz tudo se não for verdade;
- sessões somente leitura, no máximo 30 s por consulta e 2 conexões;
- a única janela extra é `auditoria_seguranca.buckets()`, que informa só o nome de cada bucket e se ele é público;
- **ainda sem senha**: ninguém entra com ele até o passo 1.

## Ligar (uma vez)

**Começa desligada.** Faça os passos abaixo; o backup usa as mesmas variáveis de conexão (`BACKUP.md`).

### 1. Senha do usuário de auditoria

Gere uma senha longa (por exemplo, no gerenciador de senhas) e, no Supabase (projeto **avaliacao-fisica**), abra o **SQL Editor** e execute, trocando o texto:

```sql
alter role auditoria_leitura with password 'COLE_AQUI_A_SENHA_LONGA';
```

Não cole essa senha no chat.

### 2. Cadastrar no GitHub

Em *Settings → Secrets and variables → Actions* do repositório:

| Aba | Nome | Valor |
|---|---|---|
| Variables | `SUPABASE_DB_HOST` | Host do *Session pooler* (o mesmo do backup) |
| Variables | `SUPABASE_DB_PORT` | `5432` |
| Variables | `SUPABASE_DB_USER` | `postgres.rsgbuvjrkrrybzoacjrh` (só o sufixo é usado) |
| **Secrets** | `SUPABASE_AUDIT_DB_PASSWORD` | A senha do passo 1 |
| Variables | `AUDITORIA_ENABLED` | `true` |

### 3. Primeiro teste

*Actions → Auditoria de seguranca do Supabase → Run workflow*. Deve terminar verde com "Auditoria aprovada".

## Quando mudar o banco de propósito

Tabela, política, função ou permissão nova muda a foto. No mesmo envio, atualize `docs/auditoria-supabase-esperado.txt` (`bash scripts/auditoria-supabase.sh --gerar`, ou peça ao Claude para gerar pelo conector do Supabase e conferir por hash). Se a auditoria falhar sem ninguém ter mexido no banco, siga o plano de incidentes (`docs/lgpd/plano-de-incidentes.md`).
