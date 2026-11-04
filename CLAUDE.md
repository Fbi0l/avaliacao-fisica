# Avaliação Física — guia para o Claude

App para o personal trainer avaliar alunos e acompanhar a evolução; o aluno vê os próprios resultados. Site estático (HTML, CSS e JavaScript puros, sem build) com Supabase para banco, login e regras de acesso, no GitHub Pages, instalável no celular. Mesmo padrão do app `financeiro-pessoal`. Responda sempre em português do Brasil, em linguagem simples: o dono não é programador.

Nome do app provisório. Identidade visual e design definitivos ficam para depois.

## Onde fica cada coisa

- Site: https://fbi0l.github.io/avaliacao-fisica/ (GitHub Pages ligado em 04/11/2026; publica a cada envio para `main`).
- Supabase: AINDA NÃO CRIADO. Será um projeto próprio (o plano gratuito da conta principal já tem 2 projetos ativos). Ao criar: preencher `SUPABASE_URL` e `SUPABASE_KEY` (chave publicável) no `app.js` e o `connect-src` da CSP no `index.html`.
- `calculos.js`: fórmulas da avaliação (funções puras). `app.js`: telas e regras do formulário. `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`.
- `supabase/migrations/`: banco. O nome do arquivo deve usar a versão que o Supabase registrar ao aplicar.
- `supabase/functions/registrar-aluno/`: cadastro do aluno pelo convite (aceite do termo LGPD). Publicar com verificação de JWT desligada (confere tudo por conta própria).
- Proposta e decisões: documento "Sistema de Avaliação Física — Proposta" (Claude Docs). Protótipo navegável: artifact "Avaliação Física".

## Modelo

- O primeiro usuário do projeto vira o personal (gatilho). Alunos entram só por convite do personal e só leem.
- Preparado para vários personais: tudo tem `personal_id`; as regras de acesso separam os personais. A etapa 3 vai acrescentar o convite de novos personais.
- O banco guarda só o que é medido; os resultados são calculados no app, então corrigir uma fórmula vale para avaliações antigas.
- Dobras: `{chave: [1ª medida, 2ª medida]}` em mm. Perímetros: `{chave: cm}`. Força: `{supino|leg_press: {carga, reps}}`.

## Regras que não podem ser quebradas

- Toda tabela com dados tem RLS. Funções auxiliares das regras ficam no esquema `privado` (fora da API), `security definer`, `set search_path = ''`, respondendo só sobre o usuário logado.
- No site só entra a chave publicável. `service_role`/`sb_secret_` nunca no repositório; `tests/seguranca-site.cjs` confere.
- Nada de HTML montado a partir de dados (`innerHTML` etc.): use `h()` / `textContent`. CSP sem `unsafe-inline`; script externo com versão exata e `integrity`.
- Dados de saúde (LGPD): aceite do termo registrado (`consentimentos`, com versão); exclusão completa pelo `excluir_aluno`. Mudou o termo? Suba `TERMO_VERSAO` no `app.js` E na função `registrar-aluno` (teste confere).
- Campos de texto com fonte de 16px no celular.

## Pendências e decisões em aberto

- Criar o projeto Supabase (conta nova do dono, convidando a conta atual como Developer), aplicar a migração, publicar a função, preencher a configuração. Ligar o backup como no Financeiro.
- Equação de % de gordura: hoje Faulkner; Petroski (1995) é alternativa (mulheres exigem a dobra axilar média). Decidir com o personal.
- Tabela de força do leg press: a definir (hoje mostra "Tabela a definir").
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
