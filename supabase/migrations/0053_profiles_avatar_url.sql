-- Foto de perfil (assinante e responsável pelo parceiro) — não existia
-- nenhuma coluna pra isso em profiles. Atualizável pelo próprio dono via
-- profiles_update_own (não está na lista de colunas privilegiadas
-- protegidas por protect_profiles_privileged_columns).
alter table profiles add column if not exists avatar_url text;
