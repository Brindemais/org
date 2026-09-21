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

`0004_seed_demo.sql` cria um usuário de exemplo por perfil (administração, parceiro,
assinante). As senhas **não ficam neste README** — este repositório é público, então
credenciais em texto puro aqui seriam visíveis por qualquer pessoa na internet, inclusive
para as contas reais que hoje existem em produção. Defina/redefina as senhas dessas
contas de seed diretamente no painel do Supabase Auth (ou via `auth.admin` API) e
guarde-as num gerenciador de senhas da equipe, não em arquivos versionados.

## Pagamento Pix (Asaas)

O Pix é processado de verdade pela [Asaas](https://www.asaas.com/): a Edge Function `asaas-create-pix-charge` cria a cobrança e devolve o QR code real (chamada pelo cliente ao gerar qualquer pagamento — assinatura, taxa de anunciante); a Edge Function `asaas-webhook` recebe a confirmação da Asaas e chama `confirm_payment()`, a mesma função que a tela `/admin/pagamentos` usa pra confirmar manualmente (fica como plano B caso o webhook falhe ou atrase).

Secrets necessários em *Project Settings → Edge Functions → Secrets*:
- `ASAAS_API_KEY` — chave de API da conta Asaas (sandbox ou produção)
- `ASAAS_ENV` — `sandbox` (padrão) ou `production`, escolhe a URL base da API
- `ASAAS_WEBHOOK_TOKEN` — token compartilhado, também configurado no painel da Asaas em Integrações → Webhooks como "Token de autenticação"

Webhook a cadastrar na Asaas: `https://<project-ref>.supabase.co/functions/v1/asaas-webhook`, eventos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`.

## Decisões e pendências herdadas da especificação

Ver a seção de regras de negócio no documento de especificação original. Pontos que ficam como próximos passos deliberados: gateway de pagamento definitivo, renovação automática vs. manual, taxa/prazo de saque, notificações por WhatsApp/SMS, e análise jurídica/contábil do modelo de bonificação em rede.
