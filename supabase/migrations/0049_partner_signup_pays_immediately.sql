-- ============================================================
-- Cadastro de parceiro passa a criar login e cobrar a taxa de anunciante
-- na hora (igual o cadastro de assinante), em vez de só registrar
-- interesse e esperar a equipe convidar depois. complete_partner_signup
-- espelha complete_signup + admin_complete_partner_invite juntos: cria o
-- profile (role partner), a linha em partners e o vínculo em
-- partner_staff, tudo numa chamada só, autenticada pela própria pessoa
-- que acabou de se cadastrar.
--
-- partners.status continua nascendo no valor padrão da pipeline
-- (interested) — pagar a taxa libera a área de anunciante
-- (is_advertiser, via confirm_payment já existente), mas não pula a
-- aprovação do admin pra aparecer nas listagens públicas
-- (list_public_partners já filtra por status).
-- ============================================================

create or replace function complete_partner_signup(
  p_company_name text, p_trade_name text, p_cnpj_cpf text, p_responsible_name text,
  p_phone text, p_whatsapp text, p_email text, p_category text,
  p_city text, p_neighborhood text, p_address text
) returns partners language plpgsql security definer set search_path = public as $$
declare
  v_partner partners;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'PROFILE_ALREADY_EXISTS';
  end if;

  insert into profiles (id, role, full_name, email, phone, referral_code)
  values (auth.uid(), 'partner', p_responsible_name, p_email, p_phone, generate_referral_code());

  insert into partners (company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, category, city, neighborhood, address, requires_fee)
  values (p_company_name, p_trade_name, p_cnpj_cpf, p_responsible_name, p_phone, coalesce(nullif(p_whatsapp, ''), p_phone), p_email, p_category, p_city, p_neighborhood, p_address, true)
  returning * into v_partner;

  insert into partner_staff (partner_id, profile_id) values (v_partner.id, auth.uid());

  return v_partner;
end;
$$;

revoke execute on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text) to authenticated;
