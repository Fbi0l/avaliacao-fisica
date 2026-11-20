-- Auditoria automática SOMENTE LEITURA da configuração de segurança (mesmo modelo do Inventário).
-- 1) Cria o usuário de banco auditoria_leitura, que só lê os catálogos do PostgreSQL (estrutura,
--    políticas, permissões). Ele NÃO tem acesso a nenhuma tabela de dados; o fim deste script confere
--    isso e desfaz tudo se não for verdade. A senha NÃO fica aqui: o dono define no SQL Editor
--    (ver AUDITORIA_SUPABASE.md). Sem senha, ninguém entra com esse usuário.
-- 2) Cria auditoria_seguranca.buckets(), única janela extra: só o nome e se cada bucket é público.
DO $papel$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auditoria_leitura') THEN
    CREATE ROLE auditoria_leitura LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 2;
  END IF;
END
$papel$;
ALTER ROLE auditoria_leitura SET default_transaction_read_only = on;
ALTER ROLE auditoria_leitura SET statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS auditoria_seguranca;
REVOKE ALL ON SCHEMA auditoria_seguranca FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA auditoria_seguranca TO auditoria_leitura;

CREATE OR REPLACE FUNCTION auditoria_seguranca.buckets()
RETURNS TABLE(id text, public boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT b.id::text, coalesce(b.public, false) FROM storage.buckets b
$fn$;
REVOKE ALL ON FUNCTION auditoria_seguranca.buckets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION auditoria_seguranca.buckets() TO auditoria_leitura;

-- Conferência obrigatória: o usuário de auditoria não pode ler nenhum dado.
DO $confere$
DECLARE v_tabela text;
BEGIN
  SELECT c.relnamespace::regnamespace::text || '.' || c.relname INTO v_tabela
  FROM pg_class c
  WHERE c.relkind IN ('r', 'p', 'v', 'm')
    AND c.relnamespace IN ('public'::regnamespace, 'auth'::regnamespace, 'storage'::regnamespace, 'privado'::regnamespace)
    AND has_table_privilege('auditoria_leitura', c.oid, 'SELECT')
  LIMIT 1;
  IF v_tabela IS NOT NULL THEN
    RAISE EXCEPTION 'auditoria_leitura conseguiria ler %. Nada foi alterado.', v_tabela;
  END IF;
END
$confere$;
