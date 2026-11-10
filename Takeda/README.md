# Intranet Takeda

Painéis de gestão da Takeda Design (Next.js 15 + Supabase), publicados na Vercel.

- Dados do DOit sincronizados por um robô (Edge Function `supabase/functions/doit-sync`) a cada poucos minutos.
- Login por e-mail e senha, só para convidados; acesso por nível (RLS no Supabase).
- Variáveis de ambiente: veja `.env.example` (as chaves ficam na Vercel, nunca no repositório).

Rodar localmente: `npm install` e `npm run dev`.
Pendências: `PENDENCIAS.md`.
