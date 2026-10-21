-- Auditoria de segurança: duas falhas encontradas nas funções de carteira.
--
-- 1) award_referral_bonuses(p_source_subscriber_id, p_base_amount, ...)
--    estava com EXECUTE liberado pra 'authenticated' sem checagem nenhuma
--    por dentro — qualquer usuário logado podia chamar essa função
--    direto via supabase.rpc() passando qualquer valor em p_base_amount e
--    criar bônus/saldo do zero pra si mesmo (ou pra quem o referenciou),
--    sem nenhum pagamento real por trás. Só é chamada internamente por
--    outras funções SECURITY DEFINER (confirm_payment,
--    confirm_pickup_delivery, confirm_product_order_delivery) — nunca
--    precisou ser pública. Revoga de authenticated/anon/public; chamadas
--    internas continuam funcionando porque todas essas funções são
--    donas 'postgres', que mantém EXECUTE.
--
-- 2) available_balance, current_wallet_balance, available_bonus_balance e
--    pending_withdrawals_total recebem p_user_id como parâmetro mas nunca
--    checavam se é o próprio usuário ou um admin chamando — qualquer
--    usuário logado podia ler o saldo (carteira, bônus disponível,
--    saque pendente) de QUALQUER outro usuário só sabendo o UUID dele.
--    Adiciona guarda "p_user_id = auth.uid() or is_admin()" direto no
--    WHERE — pra quem não tem permissão, o resultado vira 0 em vez de
--    estourar erro (mantém compatível com o uso em telas que só exibem
--    o valor, sem precisar tratar exceção).
revoke all on function award_referral_bonuses(uuid, numeric, text, uuid, uuid) from authenticated, anon, public;

create or replace function current_wallet_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin());
$$;

create or replace function pending_withdrawals_total(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(amount),0) from withdrawals
  where user_id = p_user_id and status in ('requested','analyzing','approved')
    and (p_user_id = auth.uid() or is_admin());
$$;

create or replace function available_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'adjustment') then amount
    when direction = 'in' and type not in ('bonus_subscription', 'adjustment') and created_at <= now() - interval '30 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin());
$$;

create or replace function available_bonus_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(case
    when direction = 'in' and type = 'bonus_subscription' then amount
    when direction = 'in' and type in ('bonus_consumption','bonus_partner_fee') and created_at <= now() - interval '30 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin());
$$;

-- 3) Bucket público de imagens (logos de parceiro, fotos de produto)
--    estava sem limite de tamanho nem restrição de tipo de arquivo —
--    qualquer usuário autenticado podia subir um arquivo de qualquer
--    tamanho e qualquer tipo (não só imagem), servido publicamente no
--    domínio do Supabase Storage. O front só restringe com accept=
--    "image/*" no input, que é só uma dica de UI, não uma trava real
--    (dá pra contornar chamando a API de upload direto). Limita a 5MB
--    e só os tipos de imagem realmente usados no app.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'public-images';
