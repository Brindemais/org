-- public_images_upload exigia ser admin ou já estar em partner_staff pra
-- subir qualquer arquivo no bucket public-images — bloqueava duas coisas
-- novas desta sessão:
--   1. assinante subindo a própria foto de perfil (não é partner_staff)
--   2. parceiro subindo o logotipo durante o próprio cadastro (o upload
--      acontece no formulário, antes de complete_partner_signup rodar e
--      criar a linha em partner_staff)
-- Como o bucket já é de leitura pública pra qualquer authenticated (ver
-- public_images_read) e a política de UPDATE já restringe por owner_id,
-- alinha o INSERT com a mesma permissividade do SELECT.
--
-- Usa ALTER POLICY em vez de DROP + CREATE: "drop" (de qualquer objeto,
-- não só funções — ver migrations 0050/0051) trava indefinidamente nesta
-- instância, e ALTER POLICY muda o with_check sem precisar dropar nada.
alter policy public_images_upload on storage.objects
  with check (bucket_id = 'public-images' and auth.role() = 'authenticated');
