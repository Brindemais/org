-- ============================================================
-- pg_net não aceita ALTER EXTENSION ... SET SCHEMA (não é
-- relocatable), então o único jeito de tirar o registro da extensão
-- do schema public é dropar e recriar. Os objetos de verdade dela
-- (net.http_post, net.http_get, net._http_response etc.) vivem no
-- schema próprio `net`, criado pelo script de instalação da própria
-- extensão independente de qual schema é passado aqui — só o registro
-- da extensão muda de public para extensions.
--
-- Único ponto do código que depende disso: o cron job diário de
-- lembrete de renovação (0023_renewal_reminders.sql), que chama
-- net.http_post(...) já totalmente qualificado — continua funcionando
-- sem nenhuma mudança, e foi conferido na produção logo depois deste
-- fix (net.http_get de teste voltou status_code 200, cron job
-- intacto em cron.job).
-- ============================================================

drop extension pg_net;
create extension pg_net schema extensions;
