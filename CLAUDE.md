# Avaliação Física — guia para o Claude

App para o personal trainer avaliar alunos e acompanhar a evolução; o aluno vê os próprios resultados. Site estático (HTML, CSS e JavaScript puros, sem build) com Supabase para banco, login e regras de acesso, no GitHub Pages, instalável no celular. Mesmo padrão do app `financeiro-pessoal`. Responda sempre em português do Brasil, em linguagem simples: o dono não é programador.

Nome do app provisório. Identidade visual e design definitivos ficam para depois.

## Onde fica cada coisa

- Site: https://fbi0l.github.io/avaliacao-fisica/ (GitHub Pages ligado em 04/11/2026; publica a cada envio para `main`).
- Supabase: projeto `avaliacao-fisica`, ref `rsgbuvjrkrrybzoacjrh` (São Paulo, plano gratuito), criado em 05/11/2026 numa conta separada do dono (organização "Avaliacao Fisica"); a conta principal (fabioluan090@gmail.com) é Developer nela. Criado com "Automatically expose new tables" DESLIGADO e "automatic RLS" ligado: toda tabela nova precisa de `grant` explícito, inclusive para `service_role` (a função de cadastro só tem o mínimo, ver migração `permissoes_funcao_cadastro`). O conector do Supabase no Claude fica autorizado para UMA organização por vez: para mexer no Financeiro ou no Inventário, reautorizar escolhendo a organização "Fabio Luan".
- `calculos.js`: fórmulas da avaliação (funções puras). `app.js`: telas e regras do formulário. `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`.
- `supabase/migrations/`: banco. O nome do arquivo deve usar a versão que o Supabase registrar ao aplicar.
- `supabase/functions/registrar-aluno/`: cadastro do aluno pelo convite (aceite do termo LGPD). Publicar com verificação de JWT desligada (confere tudo por conta própria).
- Proposta e decisões: documento "Sistema de Avaliação Física — Proposta" (Claude Docs). Protótipo navegável: artifact "Avaliação Física".

## Modelo

- O primeiro usuário do projeto vira o personal (gatilho). Alunos entram só por convite do personal e só leem.
- Preparado para vários personais: tudo tem `personal_id`; as regras de acesso separam os personais. A etapa 3 vai acrescentar o convite de novos personais.
- O banco guarda só o que é medido; os resultados são calculados no app, então corrigir uma fórmula vale para avaliações antigas.
- Dobras: `{chave: [1ª medida, 2ª medida]}` em mm. `equacao_gordura`: 'faulkner' (padrão) ou 'petroski'. Perímetros: `{chave: cm}`. Força: `{supino|leg_press: {carga, reps}}`.

## Regras que não podem ser quebradas

- Toda tabela com dados tem RLS. Funções auxiliares das regras ficam no esquema `privado` (fora da API), `security definer`, `set search_path = ''`, respondendo só sobre o usuário logado.
- No site só entra a chave publicável. `service_role`/`sb_secret_` nunca no repositório; `tests/seguranca-site.cjs` confere.
- Nada de HTML montado a partir de dados (`innerHTML` etc.): use `h()` / `textContent`. CSP sem `unsafe-inline`; script externo com versão exata e `integrity`.
- Dados de saúde (LGPD): aceite do termo registrado (`consentimentos`, com versão); exclusão completa pelo `excluir_aluno`. Mudou o termo? Suba `TERMO_VERSAO` no `app.js` E na função `registrar-aluno` (teste confere).
- Campos de texto com fonte de 16px no celular.

## Pendências e decisões em aberto

- Ligar o backup como no Financeiro. Cadastro aberto DESLIGADO em 05/11/2026, depois que o personal (fabioluan090@gmail.com) criou a conta: o convite do aluno cria contas pela chave de serviço e não depende dele. Não religar. A senha do banco não foi guardada na criação: gerar uma nova em Project Settings → Database quando for preciso (backup).
- % de gordura: Faulkner ou Petroski (1995) à escolha em cada avaliação (`equacao_gordura`), feito na 0.2.0. Usamos a versão de Petroski com as mesmas 4 dobras nos dois sexos (subescapular, tríceps, suprailíaca, panturrilha) e peso/estatura nas mulheres; o coeficiente da idade feminina (0,00026073) aparece como 0,0002073 em uma das fontes: revisar com o personal.
- Leg press: tabela do ACSM (1998), aprovada pelo dono e publicada em 05/11/2026 (0.2.0). Feita em leg press de cadeira; no 45° superestima (o app avisa).
- Revisar com o personal as faixas de gordura (Heyward 1991), referências dos exames e o texto do termo.
- Etapa 2: fichas de treino e periodização. Etapa 3: vários personais.

## Versão

A versão aparece em `index.html` (rodapés e `?v=`), `sw.js` (cache e lista) e `package.json`. Ao publicar mudança visível, suba em todos e registre no topo do `README.md`. O teste do site confere.

## Testes

- `npm test`: cálculos, regras do formulário, função de cadastro e segurança do site (sem rede).
- `npm run test:banco` (precisa de um PostgreSQL local em PGHOST/PGPORT): tabelas, regras de acesso, convites, visão do aluno e exclusão, sobre `tests/supabase-simulado.sql`.
- Mudou algo? Rode os testes e acrescente um caso novo.

## Como publicar

Banco → função → site, sempre com o OK do dono.
