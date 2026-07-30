# Brinde Mais

Comunidade Nacional de Consumo Inteligente — plataforma web responsiva de assinatura (R$ 79,00/mês) com brinde mensal, descontos em parceiros, indicação em rede (7 níveis), carteira/saques e loja virtual.

MVP piloto: Rio de Janeiro.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS, mobile-first (área do assinante em `/app`), painéis desktop responsivos para parceiro (`/parceiro`) e administração (`/admin`).
- **Backend:** Supabase (Postgres + Auth + Row Level Security). Toda regra financeira sensível (bonificação de indicação, confirmação de pagamento, saques, baixa de estoque) roda em funções `SECURITY DEFINER` no banco, nunca em updates diretos do cliente.
- **Hospedagem:** Netlify, deploy contínuo a partir deste repositório.

## Estrutura

```
src/
  pages/public/       landing page, login, cadastro (wizard de assinatura)
  pages/subscriber/    área do assinante (mobile-first, /app)
  pages/partner/        painel do parceiro (/parceiro)
  pages/admin/           painel administrativo (/admin)
  lib/, hooks/, contexts/  supabase client, auth, helpers
supabase/migrations/    schema, funções, RLS e seed de demonstração (SQL)
```

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com a URL e a anon key do seu projeto Supabase
npm run dev
```

## Banco de dados

Aplique as migrations em `supabase/migrations/` (via Supabase CLI ou MCP) na ordem numérica. `0004_seed_demo.sql` é opcional e cria dados de demonstração.

## Contas de demonstração (seed)

| Perfil | E-mail | Senha |
|---|---|---|
| Administração | admin@brindemais.com.br | BrindeMais2026! |
| Parceiro (Empório das Cervejas) | parceiro@emporiodascervejas.com.br | BrindeMais2026! |
| Assinante | lucas@example.com | BrindeMais2026! |

## Pagamento Pix (MVP)

O gateway de pagamento Pix está marcado como *pendente de definição* na especificação de produto. Nesta primeira versão, o Pix é simulado na tela do assinante e a confirmação do pagamento é feita manualmente pela administração em `/admin/pagamentos`, seguindo exatamente o fluxo de estados (pendente → confirmado → assinatura ativa → bonificação de indicação) que será usado quando um gateway real (Mercado Pago, Efí, Asaas etc.) for integrado.

## Decisões e pendências herdadas da especificação

Ver a seção de regras de negócio no documento de especificação original. Pontos que ficam como próximos passos deliberados: gateway de pagamento definitivo, renovação automática vs. manual, taxa/prazo de saque, notificações por WhatsApp/SMS, e análise jurídica/contábil do modelo de bonificação em rede.
