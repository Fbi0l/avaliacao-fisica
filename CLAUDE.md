# Avaliação Física — guia para o Claude

App para o personal trainer avaliar alunos e acompanhar a evolução; o aluno vê os próprios resultados. Site estático (HTML, CSS e JavaScript puros, sem build) com Supabase para banco, login e regras de acesso, no GitHub Pages, instalável no celular. Mesmo padrão do app `financeiro-pessoal`. Responda sempre em português do Brasil, em linguagem simples: o dono não é programador.

Nome do app provisório. Visual: Coral revisado desde a 0.9.0.

## Onde fica cada coisa

- Site: https://fbi0l.github.io/avaliacao-fisica/ (GitHub Pages ligado em 04/11/2026; publica a cada envio para `main`).
- Supabase: projeto `avaliacao-fisica`, ref `rsgbuvjrkrrybzoacjrh` (São Paulo, plano gratuito), criado em 05/11/2026 numa conta separada do dono (organização "Avaliacao Fisica"); a conta principal (fabioluan090@gmail.com) é Developer nela. Criado com "Automatically expose new tables" DESLIGADO e "automatic RLS" ligado: toda tabela nova precisa de `grant` explícito, inclusive para `service_role` (a função de cadastro só tem o mínimo, ver migração `permissoes_funcao_cadastro`). O conector do Supabase no Claude fica autorizado para UMA organização por vez: para mexer no Financeiro ou no Inventário, reautorizar escolhendo a organização "Fabio Luan".
- `calculos.js`: fórmulas da avaliação (funções puras). `app.js`: telas e regras do formulário. `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`.
- `supabase/migrations/`: banco. O nome do arquivo deve usar a versão que o Supabase registrar ao aplicar.
- `supabase/functions/registrar-aluno/`: cadastro pelo convite: do aluno (aceite do termo LGPD) e, com `tipo: 'personal'`, de um novo personal (termo do personal, `TERMO_PERSONAL_VERSAO` igual no `app.js`). Publicar com verificação de JWT desligada (confere tudo por conta própria).
- Proposta e decisões: documento "Sistema de Avaliação Física — Proposta" (Claude Docs). Protótipo navegável: artifact "Avaliação Física".
- Design: direção "A · Coral" revisada (skills de UX + Lei de Jakob), aprovada pelo dono e aplicada na 0.9.0. Tela de design "Avaliação Física — Coral revisado" (Claude Design: aluno, personal e chat). Tokens no topo do `styles.css` (claro e escuro); coral só em ações/seleção, texto coral sobre fundo claro usa `--accent-text`; status sempre com seta/palavra. Fontes Outfit + Work Sans em `assets/fonts` (OFL), nunca de fora (CSP). Navegação: aluno com abas embaixo (`#inicio`, `#avaliacoes`, `#av-<id>`, `#evolucao`, `#mensagens`, `#perfil`); personal com lista + ficha, mensagens em `#mensagens` e `#conversa-<id>`; resultado em seções `<details>` (`secao()` no `app.js`). Histórico das direções em `docs/design/`.

## Modelo

- O primeiro usuário do projeto vira o personal ADMINISTRADOR (gatilho). Novos personais entram só por convite do administrador (`convites_personal`); alunos, só por convite do personal deles, e só leem.
- Preparado para vários personais: tudo tem `personal_id`; as regras de acesso separam os personais. A etapa 3 vai acrescentar o convite de novos personais.
- O banco guarda só o que é medido; os resultados são calculados no app, então corrigir uma fórmula vale para avaliações antigas.
- Etapas independentes (0.10.0, pedido do dono): nenhuma etapa é obrigatória, nem peso e altura (`null` no banco); o app exige só uma medida qualquer ou o parecer (`temAlgumaMedida`). Todo cálculo que depende de peso/altura devolve `null` sem eles, e as telas escondem o que não foi medido; nada de avisar "faltam medidas" ao salvar.
- Dobras: `{chave: [1ª medida, 2ª medida]}` em mm. `equacao_gordura`: 'faulkner' (padrão) ou 'petroski'. Perímetros: `{chave: cm}`. Força: `{supino|leg_press: {carga, reps}, outros: [{nome, carga, reps}]}` (até 8 outros, nomes sem repetir, sem classificação). Sem etnia desde a 0.5.0 (Lee com valor neutro). FC máxima por Tanaka. Testes (0.7.0): `{flexao: reps, abdominal: reps em 1 min, aerobico: {tipo: 'cooper'|'livre', distancia (m), tempo (min, só livre), fc_final?}, flexiteste: {'I'..'XX': 0-4}}`. Tabelas: flexão CSEP-PATH 2019 (= ACSM), abdominal Pollock e Wilmore 1993, VO2 do Cooper pela tabela do Cooper Institute; escolhidas pelo dono em 09/11/2026 como as mais recomendadas. Postura (0.8.0): `{}` (não feita) ou `{itens: {chave: alteração}, obs?}`; chaves e valores em `POSTURA` no `calculos.js`, iguais aos de `privado.postura_valida` (teste confere: mudou um, mude o outro com migração nova).

## Regras que não podem ser quebradas

- Toda tabela com dados tem RLS. Funções auxiliares das regras ficam no esquema `privado` (fora da API), `security definer`, `set search_path = ''`, respondendo só sobre o usuário logado.
- No site só entra a chave publicável. `service_role`/`sb_secret_` nunca no repositório; `tests/seguranca-site.cjs` confere.
- Nada de HTML montado a partir de dados (`innerHTML` etc.): use `h()` / `textContent`. CSP sem `unsafe-inline`; script externo com versão exata e `integrity`.
- Dados de saúde (LGPD): aceite do termo registrado (`consentimentos`, com versão); exclusão completa pelo `excluir_aluno`. Mudou o termo? Suba `TERMO_VERSAO` no `app.js` E na função `registrar-aluno` (teste confere).
- Campos de texto com fonte de 16px no celular.
- Guia de uso (tutorial de primeiro acesso, `PASSOS_TUTORIAL_PERSONAL` e `PASSOS_TUTORIAL_ALUNO` no `app.js`): SEMPRE atualizar junto com qualquer mudança de tela, fluxo ou recurso (pedido do dono em 09/11/2026). A cada versão, revisar os passos e subir `GUIA_REVISADO_NA_VERSAO`; o teste recusa versão nova sem isso.

## Pendências e decisões em aberto

- Ligar o backup como no Financeiro. Cadastro aberto DESLIGADO em 05/11/2026, depois que o personal (fabioluan090@gmail.com) criou a conta: o convite do aluno cria contas pela chave de serviço e não depende dele. Não religar. A senha do banco não foi guardada na criação: gerar uma nova em Project Settings → Database quando for preciso (backup).
- % de gordura: Faulkner ou Petroski (1995) à escolha em cada avaliação (`equacao_gordura`), feito na 0.2.0. Usamos a versão de Petroski com as mesmas 4 dobras nos dois sexos (subescapular, tríceps, suprailíaca, panturrilha) e peso/estatura nas mulheres; o coeficiente da idade feminina (0,00026073) aparece como 0,0002073 em uma das fontes: revisar com o personal.
- Leg press: tabela do ACSM (1998), aprovada pelo dono e publicada em 05/11/2026 (0.2.0). Feita em leg press de cadeira; no 45° superestima (o app avisa).
- Revisar com o personal as faixas de gordura (Heyward 1991), referências dos exames e o texto do termo.
- Convite de novos personais: feito na 0.3.0 (pedido do dono em 05/11/2026: um professor da faculdade vai testar como personal). Só o administrador (`personais.admin`, o primeiro personal) gera convites; o novo personal tem alunos próprios e separados. Ainda falta: o administrador ver/desativar personais e excluir um personal com todos os dados.
- Guia de primeiro acesso (personal e aluno) e aluno de exemplo: feitos na 0.4.0 (`PASSOS_TUTORIAL_*`, `ALUNO_EXEMPLO`/`avaliacoesExemplo` no `app.js`; `alunos.exemplo` no banco). Mudou uma tela ou um passo do fluxo? Atualize o guia junto.
- Sugestões do professor (áudios de 09/11/2026), em fases: 1) etnia fora, 1RM em qualquer exercício, FC máxima de Tanaka: feito na 0.5.0. 2) etapa "Testes": flexão de braço, abdominal, flexiteste e teste aeróbico (Cooper ou distância/tempo/pace): feito na 0.7.0; falta o professor dizer quais 5 movimentos do flexiteste ele prefere (hoje o personal escolhe entre os 20). 3) zonas de FC (Karvonen com Tanaka, 5 zonas de 50% a 100%) e de carga (% do 1RM pela NSCA: <67, 67–85, ≥85), no resultado e no painel do aluno: feito na 0.6.0, faixas a revisar com ele. 4) avaliação postural: feita na 0.8.0 (checklist visual por vistas, Kendall et al.; sem fotos), a revisar com ele. 5) chat aluno–personal: feito na 1.0.0. Em 09/11/2026 o professor aprovou tudo como está ("está ótimo"): tabelas de flexão e abdominal, flexiteste com o personal escolhendo entre os 20 movimentos, checklist postural e faixas das zonas.
- Chat (1.0.0): tabela `mensagens` (uma conversa por aluno; `autor`, `personal_id` e `criado_em` preenchidos pelo gatilho `privado.mensagem_preencher`; só `lida_em` pode ser alterada, e só por quem recebeu; ninguém apaga, só a exclusão do aluno). O personal pode anexar uma avaliação do mesmo aluno (`avaliacao_id`). Aluno de exemplo e aluno sem login não conversam. Atualização por consulta a cada 20 s (`INTERVALO_MENSAGENS_MS`), sem Realtime. Termo do aluno na versão 2026-11-09 (cita as mensagens).
- Etapa 2: fichas de treino e periodização.

## Versão

A versão aparece em `index.html` (rodapés e `?v=`), `sw.js` (cache e lista) e `package.json`. Ao publicar mudança visível, suba em todos e registre no topo do `README.md`. O teste do site confere.

## Testes

- `npm test`: cálculos, regras do formulário, função de cadastro e segurança do site (sem rede).
- `npm run test:banco` (precisa de um PostgreSQL local em PGHOST/PGPORT): tabelas, regras de acesso, convites, visão do aluno e exclusão, sobre `tests/supabase-simulado.sql`.
- Mudou algo? Rode os testes e acrescente um caso novo.

## Como publicar

Banco → função → site, sempre com o OK do dono.
