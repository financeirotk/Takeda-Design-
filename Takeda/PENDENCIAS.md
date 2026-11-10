# Pendências — Intranet Takeda

## Dados / números
- [ ] **Custo M.O. diferente do Tableau** (Visão Projeto). O custo das atividades no DOit dá ~R$ 9/h; o Tableau usa ~R$ 30/h.
      Ex.: projeto 1977 → DOit R$ 35,0 mil × Tableau R$ 113,5 mil; projeto 2144 → DOit R$ 5,7 mil × Tableau R$ 15,2 mil.
      Afeta: Custo M.O. Direta, Custo Hora Média e Margem de Contribuição.
      Próximo passo: descobrir a fonte do custo-hora por colaborador usada no Tableau (planilha?) e integrar.
- [ ] **Horas da Jéssica em out/2026**: intranet mostra 112 h, Tableau mostra 20 h. Verificar se o Tableau filtra projetos (ex.: "Considerar no Dashboard").
- [ ] **Detalhes Horas — "Índice Geral" e "No prazo"**: definir a regra de cálculo usada no Tableau.
- [ ] **Projetos Ativos — "Em Aprovação" e "Atrasados"**: não existem como status no DOit; definir de onde vêm.
- [ ] **Financeiro (Sheets)**: integrar a planilha financeira do painel HTML atual e definir qual fonte vale para cada número.

## Acesso e segurança
- [ ] Supabase → Authentication → URL Configuration: Site URL e Redirect URLs com `https://intranet-takeda.vercel.app`.
- [ ] Ativar o Auth Hook "Before User Created" (`hook_before_user_created`) para só convidados criarem conta.
- [ ] Verificação em duas etapas (2FA) — pronta no código, desligada no beta.
- [ ] Servidor de e-mail próprio (SMTP) antes de abrir para mais pessoas.

## Infra
- [ ] Subir o código no GitHub da empresa e ligar o repositório à Vercel (deploy automático).
- [ ] Supabase Pro antes do uso diário pela direção (backup diário, sem pausa por inatividade).
- [ ] Limpeza: remover a função de teste `doit-probe` e as tabelas `doit_samples` (public e staging).
