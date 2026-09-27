-- confirm_payment/mark_payment_chargeback checam auth.role() = 'service_role'
-- dentro do próprio corpo, mas isso só roda depois do Postgres já ter
-- deixado a chamada passar — e o service_role nunca tinha recebido EXECUTE
-- nessas duas funções (só authenticated), então a Edge Function do webhook
-- (que autentica como service_role) sempre ia bater em "permission denied"
-- antes mesmo de chegar nesse check, mesmo com o token do webhook certo.
-- Só não tinha aparecido até agora porque nenhum teste tinha chegado vivo
-- até essa etapa (sempre travava antes, no 401 do token).
grant execute on function confirm_payment(uuid, uuid) to service_role;
grant execute on function mark_payment_chargeback(uuid) to service_role;
