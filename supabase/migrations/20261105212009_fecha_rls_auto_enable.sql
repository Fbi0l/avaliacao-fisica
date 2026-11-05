-- A opção "Enable automatic RLS" do Supabase cria public.rls_auto_enable() (gatilho de evento).
-- Ela só deve rodar como gatilho: ninguém da API precisa chamá-la.
-- (No Supabase foi aplicada sem o "if exists"; aqui ele existe para o banco de teste local, que não tem essa função.)
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
