-- Novo tipo de bônus pro sistema de qualificação VIP/VIP MAIS/ELITE
-- (ver 0108/0109). ALTER TYPE ... ADD VALUE precisa ser sua própria
-- instrução top-level, não pode ir dentro de um bloco do $$ ... $$ com
-- outras instruções — por isso essa migração só tem essa linha.
alter type wallet_tx_type add value if not exists 'bonus_qualification';
