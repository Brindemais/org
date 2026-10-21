-- O passo 1 do cadastro (nome, CPF, telefone etc) nunca era salvo em
-- lugar nenhum até o código do e-mail ser confirmado — ficava só na
-- memória do navegador. Signup.tsx e PartnerSignup.tsx agora passam
-- esses dados como metadata do auth.users (raw_user_meta_data) já na
-- criação da conta, antes do código. Essa função expõe isso pro admin
-- em cadastros travados (sem profile ainda), pra dar pra identificar a
-- pessoa se precisar de suporte — antes só tinha e-mail e data.
--
-- Precisa de DROP antes do CREATE porque a assinatura de retorno muda
-- (colunas novas) — Postgres não deixa CREATE OR REPLACE trocar o
-- formato das colunas de saída.
drop function if exists admin_list_pending_signups();

-- A função antiga não tinha checagem de admin nenhuma no corpo, só
-- contava com o GRANT (authenticated apenas, sem anon/PUBLIC) — mas um
-- CREATE novo em Postgres volta a conceder EXECUTE pra PUBLIC por
-- padrão. Adiciona a checagem is_admin() explícita no corpo (como as
-- outras funções admin_* já fazem) em vez de depender só do GRANT.
create function admin_list_pending_signups()
returns table(id uuid, email text, full_name text, document text, phone text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  select
    u.id, u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'responsible_name', u.raw_user_meta_data->>'trade_name'),
    coalesce(u.raw_user_meta_data->>'cpf', u.raw_user_meta_data->>'cnpj_cpf'),
    u.raw_user_meta_data->>'phone',
    u.created_at
  from auth.users u
  where not exists (select 1 from profiles p where p.id = u.id)
  order by u.created_at desc
  limit 200;
end;
$$;

revoke all on function admin_list_pending_signups() from public;
grant execute on function admin_list_pending_signups() to authenticated;
