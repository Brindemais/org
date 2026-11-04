-- Achado da auditoria: _qualification_tier() não tinha search_path fixo
-- (lint de segurança do Supabase aponta isso pra toda função). Sem risco
-- real aqui (função pura, só compara os dois inteiros recebidos, não
-- toca em tabela nenhuma), mas corrige pra ficar no mesmo padrão do
-- resto do projeto.
create or replace function public._qualification_tier(p_direct_active int, p_l1_l2_active int)
returns text
language sql
immutable
set search_path = public
as $f$
  select case
    when p_direct_active >= 100 and p_l1_l2_active >= 1100 then 'elite'
    when p_direct_active >= 10 and p_l1_l2_active >= 110 then 'vip_mais'
    when p_direct_active >= 10 then 'vip'
    else 'none'
  end;
$f$;

revoke all on function public._qualification_tier(int, int) from public, anon, authenticated;
