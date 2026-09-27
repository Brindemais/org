-- Achado na auditoria: overload antigo de confirm_pickup_delivery (3 args,
-- p_withdrawn_by texto livre) continuava concedido a authenticated,
-- mesmo já superado pelo de 4 args (0029) que adicionou verificação de
-- código, aprovação do produto e checagem de authorized_persons. O app só
-- chama o de 4 (nomeados, sem ambiguidade), mas o velho ficava exposto
-- via REST direto — qualquer staff de parceiro podia confirmar retirada
-- sem o assinante informar código nenhum. Mesma classe de bug do overload
-- morto de award_referral_bonuses (0030) e do grant faltante em
-- confirm_payment/mark_payment_chargeback (0043).
drop function if exists confirm_pickup_delivery(uuid, uuid, text);
