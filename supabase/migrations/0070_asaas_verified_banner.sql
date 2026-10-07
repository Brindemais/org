-- Marca quando o parceiro confirmou ter terminado a verificação da
-- subconta Asaas (link que a própria Asaas envia por e-mail — a API de
-- criação não devolve esse link pra gente embutir direto no painel, só
-- dispara o envio). Usado pra parar de mostrar a faixa de aviso no topo
-- do painel do parceiro depois que ele confirmar.
alter table partners add column asaas_verified_at timestamptz;
