-- products_force_approval_trg (de antes desta sessão, do modelo antigo em
-- que parceiro cadastrava brinde livremente e precisava de aprovação do
-- admin) força approved=false em TODO insert/update de quem não é admin,
-- sem exceção — inclusive quando o parceiro escolhe um item do catálogo
-- via partner/Products.tsx, que já manda approved=true de propósito (não
-- tem mais fila de aprovação nesse fluxo, admin já vetou o brinde ao
-- cadastrar no catálogo). O gatilho estava silenciosamente sobrescrevendo
-- isso, deixando todo brinde escolhido por parceiro invisível pro
-- assinante.
--
-- Fix: só força false quando NÃO vem de uma cópia de catálogo
-- (catalog_id is null) — defesa em profundidade pra qualquer inserção
-- direta que não passe pelo fluxo de seleção (não existe mais essa opção
-- na UI, mas mantém a proteção original caso alguém tente pela API).
create or replace function products_force_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and new.catalog_id is null then
    new.approved := false;
  end if;
  return new;
end;
$$;

-- Corrige a linha que já ficou presa com approved=false por causa disso.
update products set approved = true where catalog_id is not null and approved = false;
