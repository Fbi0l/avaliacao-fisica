# avaliacao-fisica

App para o personal trainer registrar avaliações físicas, acompanhar a evolução dos alunos e, futuramente, montar treinos. O aluno recebe um convite e passa a ver a própria evolução. Site estático (HTML, CSS e JavaScript, sem etapa de build) com Supabase para banco, login e regras de acesso. Funciona no computador e no celular, e pode ser instalado como app.

## Versão 1.0.1 — Ajustes no celular

- Campos do formulário alinhados: o rótulo e a unidade ("Peso (kg)") ficam na mesma linha, e os campos lado a lado começam na mesma altura.
- Selos dos cartões de resultado ("Bom volume muscular") quebram a linha em vez de sair do cartão; tabelas de perímetros e dobras cabem na largura do celular (régua de proporção menor).
- Instalação no iPhone mais estável: identificador do app no manifesto e configurações de app de tela inicial como no Financeiro. Se o teclado não abrir no app instalado, apague o ícone e adicione de novo pelo Safari.
- Guia de uso revisado (sem mudança de passos).

## Versão 1.0.0 — Mensagens

- **Chat entre o aluno e o personal** (fase 5 das sugestões do professor). O personal tem o balão de mensagens no topo, com o número de não lidas, a lista de conversas (mais recentes primeiro; quem ainda não tem acesso aparece com "Convidar") e o botão **Mensagem** na ficha do aluno. O aluno ganhou a aba **Mensagens** embaixo e o atalho "Conversar com…" no Início.
- O personal pode **enviar uma avaliação pelo clipe**: o aluno toca no cartão e ela abre. Mensagens marcadas como "lida" quando o outro abre a conversa; separadores de dia e a linha "N novas". O app procura mensagens novas a cada 20 segundos com a tela aberta.
- Segurança: cada conversa é só do aluno e do personal dele (regras de acesso no banco); o banco preenche quem escreveu, a data e o personal, e ninguém edita nem apaga mensagens pelo app. O aluno de exemplo e alunos sem acesso não conversam. As mensagens são apagadas junto com o aluno na exclusão (LGPD).
- **Termo do aluno atualizado** (versão 2026-11-09): passa a citar as mensagens. Vale para novos convites; quem já aceitou continua com o aceite registrado na versão anterior.
- Banco: tabela `mensagens` (migração `chat`). Guia de uso atualizado (personal e aluno).

## Versão 0.10.0 — Etapas independentes

- **Nenhuma etapa da avaliação é obrigatória**, nem peso e altura (pedido do dono: por exemplo, o personal não consegue medir as próprias dobras). Dá para registrar só os testes, só a postura, perímetros sem dobras, só o peso ou só um parecer; basta ter alguma coisa.
- Sem o aviso de "faltam medidas" ao salvar. O app calcula o que for possível com o que foi preenchido: sem peso e altura, não saem IMC, massa gorda e magra, massa muscular, força relativa (e a classificação do supino e do leg press) nem a proporção do modelo Phantom; o resto sai normal.
- O resultado mostra só o que foi medido: números principais, seções e tabelas vazias não aparecem. Gráficos, comparação e o painel do aluno ignoram o que não foi medido.
- Banco: `peso` e `altura` deixam de ser obrigatórios (migração `peso_altura_opcionais`); as faixas aceitas continuam as mesmas. Guia de uso atualizado.

## Versão 0.9.0 — Visual Coral revisado

- **Visual novo** (direção "A · Coral", revisada com as skills de UX e pela Lei de Jakob: o app funciona como os apps que as pessoas já usam). Cores quentes com coral só em ações e seleção; números em preto e status sempre com seta e palavra, não só cor. Fontes Outfit (títulos e números) e Work Sans (texto), servidas pelo próprio site. Ícone do app em coral. Modo escuro acompanha.
- **Topo**: marca à esquerda; à direita, ajuda (?) e o **menu da conta** (círculo com as iniciais), com Meus dados, Personais (administrador) e Sair.
- **Aluno**: **abas embaixo** (Início, Avaliações, Evolução, Perfil), como nos apps de saúde. Início com os números principais e o recado; Avaliações lista todas e abre cada uma com as partes recolhíveis; Evolução com seletor de medida, gráfico, "desde a primeira avaliação" e zonas de treino; Perfil com os dados, o guia e Sair.
- **Personal**: lista de alunos em linhas, com filtros **Reavaliar** (última avaliação há mais de 3 meses) e **Sem acesso**; no celular, **"Novo aluno"** vira botão flutuante embaixo à direita. Ficha com avatar. Formulário com **barra de progresso**, etapas concluídas com ✓ e, no celular, **Voltar / Próximo fixos embaixo**.
- **Resultado da avaliação**: números principais no topo e cada parte (perímetros e dobras, força, testes, postura, coração e exames, zonas) numa **seção que abre e fecha**. O personal vê tudo aberto; o aluno vê o resumo e abre o que quiser.
- Guia de uso atualizado. Nenhuma regra, cálculo ou dado mudou. Tela de design: "Avaliação Física — Coral revisado".

## Versão 0.8.0 — Avaliação postural

- Nova etapa **Postura** na avaliação (agora são 8 etapas), opcional: o personal marca "Fiz a avaliação postural" e preenche um checklist visual por vista, com observações.
  - **Anterior**: cabeça inclinada, ombros e pelve desnivelados, joelhos valgo ou varo, pé plano ou cavo.
  - **Lateral**: cabeça e ombros projetados à frente, hipercifose ou coluna torácica retificada, hiperlordose ou lombar retificada, pelve em anteversão ou retroversão, joelhos hiperestendidos ou em semiflexão, abdômen protuso.
  - **Posterior**: escápulas aladas, desvio lateral da coluna (sinal de escoliose), calcanhares valgo ou varo.
- O resultado mostra as alterações por vista (ou "Nenhuma alteração observada") e as observações, com o aviso de que é uma triagem visual e de quando encaminhar a um fisioterapeuta ou médico. Aparece também no painel do aluno (avaliação postural mais recente) e na comparação (número de alterações).
- Checklist baseado na avaliação postural visual por vistas (Kendall et al.), a ajustar com o professor se ele quiser. Sem fotos por enquanto.
- A aluna de exemplo ganhou a postura na 1ª e na 3ª avaliação. Guia de uso atualizado.
- Banco: coluna `postura` em `avaliacoes`, conferida por `privado.postura_valida` (migração `avaliacao_postural`).

## Versão 0.7.1 — Correção

- Seções vazias (por exemplo, uma avaliação sem testes físicos) apareciam como a palavra "null" no meio da tela. Agora simplesmente não aparecem. Valia para o resultado da avaliação, a ficha do aluno e o painel do aluno.
- Guia de uso revisado: nada muda para quem usa.

## Versão 0.7.0 — Testes físicos

- Nova etapa **Testes** na avaliação (agora são 7 etapas), toda opcional:
  - **Flexão de braço** até a falha, classificada pela tabela da CSEP (CSEP-PATH 2019, a mesma reproduzida nas diretrizes do ACSM), por sexo e idade. Mulheres fazem com os joelhos no chão.
  - **Abdominal em 1 minuto**, classificado por Pollock e Wilmore (1993).
  - **Teste aeróbico**: Cooper de 12 minutos (o app estima o VO₂máx e classifica pela tabela do Cooper Institute) ou distância e tempo livres (pace e velocidade). FC ao final, opcional.
  - **Flexiteste** (Araújo): nota de 0 a 4 em cada um dos 20 movimentos que o personal escolher testar (sugestão: pelo menos 5). Com os 20, mostra o Flexíndice.
- Os testes aparecem no resultado da avaliação, nos gráficos de evolução, na comparação entre avaliações e no painel do aluno (a avaliação mais recente com testes).
- A aluna de exemplo ganhou testes nas 3 avaliações. Guia de uso atualizado.
- Banco: coluna `testes` em `avaliacoes`, conferida por `privado.testes_valida` (migração `testes_fisicos`).

## Versão 0.6.0 — Zonas de treino

- Nova seção **Zonas de treino** no resultado de cada avaliação (personal) e no painel do aluno.
- **Frequência cardíaca**: 5 zonas (recuperação, aeróbico leve, aeróbico moderado, limiar e máximo) em batimentos por minuto. Com a FC de repouso, pela FC de reserva (Karvonen) com a FC máxima de Tanaka; sem ela, pela % da FC máxima. No painel do aluno vale a avaliação mais recente com FC de repouso.
- **Carga**: para cada exercício com 1RM (supino, leg press e os outros), as faixas em kg de resistência muscular (abaixo de 67%), hipertrofia (67% a 85%) e força (85% para cima), pela NSCA. Uma **calculadora** mostra em que zona está a carga usada no treino (por exemplo, 30 kg no supino = 62% do 1RM, resistência). No painel do aluno, vale o 1RM mais recente de cada exercício.
- Faixas usuais, a revisar com o professor. O guia de primeiro acesso (personal e aluno) fala das zonas e do “+ Outro exercício”. Sem mudança no banco.
- O guia de uso passa a ser revisado a cada versão: o teste recusa publicar uma versão nova sem essa revisão.

## Versão 0.5.0 — Sugestões do professor (parte 1)

- **Teste de força em qualquer exercício**: na etapa Força, além do supino e do leg press, o botão **+ Outro exercício** acrescenta até 8 exercícios escolhidos pelo personal (com sugestões como agachamento, remada e puxada, ou qualquer nome). O app calcula o 1RM (Epley) e o 1RM ÷ peso. Esses exercícios não têm tabela de classificação; a comparação entre avaliações junta pelo nome (sem diferenciar acento ou maiúscula).
- **FC máxima por Tanaka** (208 − 0,7 × idade), no lugar de 220 − idade. Vale também para as avaliações antigas, porque o resultado é calculado na hora; a FC de reserva acompanha.
- **Etnia retirada** do cadastro do aluno, da lista e do banco (menos dado pessoal sensível). A massa muscular (Lee) passa a usar o valor neutro: para quem estava como negra ou asiática, o resultado muda em +1,1 kg ou −2 kg nas avaliações antigas.
- Aluno de exemplo ganhou o agachamento livre nas 3 avaliações.
- Banco: migrações `forca_outros_exercicios` (aplicar antes de publicar o site) e `remove_etnia` (aplicar depois).

## Versão 0.4.2 — Sugestão de instalar no celular

- Sempre que o app é aberto no navegador do celular, aparece embaixo um aviso para instalá-lo na tela inicial. No Android, o botão **Instalar** faz tudo em um toque (ou o aviso explica o caminho pelo menu ⋮). No iPhone, o aviso mostra o caminho: Compartilhar → "Adicionar à Tela de Início".
- "Agora não" esconde o aviso até a próxima vez que o app for aberto. Depois de instalado, ou no computador, o aviso não aparece.

## Versão 0.4.1 — Topo no celular

- No celular, o topo passa para duas linhas: a marca em cima e os botões (?, Personais, Meus dados, Sair) embaixo, com 44 px de altura para o toque. Antes, com o botão "Personais", o topo ficava mais largo que a tela e empurrava a página para os lados.

## Versão 0.4.0 — Guia de primeiro acesso e aluno de exemplo

- **Guia para o personal** (7 passos curtos) no primeiro acesso: alunos, nova avaliação em 6 etapas, resultado completo, evolução e comparação, convite do aluno e dicas finais. No último passo, o botão leva direto à evolução do aluno de exemplo.
- **Aluno de exemplo**: todo personal novo (sem nenhum aluno) ganha a "Mariana Costa (exemplo)", com 3 avaliações fictícias de junho a outubro de 2026, para ver todas as tabelas, classificações e gráficos funcionando. Ela aparece com a etiqueta "Aluno de exemplo: dados fictícios", não recebe convite (o banco recusa) e pode ser apagada em "Editar". Apagada, não volta.
- **Guia básico para o aluno** (4 passos): o que ele vê, como ler as setas e as cores, evolução e recado do personal, e com quem falar sobre os dados.
- O guia aparece uma vez por pessoa (marcado no perfil e no aparelho) e o botão **"?"** no topo reabre quando quiser.
- Banco: coluna `exemplo` em `alunos` (migração `aluno_exemplo`).

## Versão 0.3.0 — Convite de novos personais

- **Botão "Personais"** no topo, só para o administrador (o personal que criou o projeto): gera um link de convite de personal, com um campo "Para quem?" só para você lembrar (a pessoa convidada não vê essa anotação). O link vale por 3 dias e funciona uma vez; no máximo 10 pendentes ao mesmo tempo. A lista mostra cada convite (aguardando, aceito por quem, cancelado ou vencido) e deixa cancelar os pendentes.
- **Quem recebe o link** lê o termo de uso para personais (cuidar dos dados dos alunos, convidar só com consentimento, atender pedidos de exclusão), informa nome, e-mail e senha, e entra como personal com **alunos próprios, totalmente separados**: nenhum personal vê nada do outro, e o novo personal não consegue se tornar administrador nem convidar outros.
- Mesma segurança do convite do aluno: o banco guarda só o hash do código, o convite é reservado numa única operação (dois cadastros ao mesmo tempo não passam), qualquer falha apaga a conta criada e devolve o convite, e senhas vazadas são recusadas. O aceite do termo fica registrado na ficha do personal.
- Banco: migração `convite_personal` (colunas `admin`, `termo_versao` e `termo_aceito_em` em `personais`, tabela `convites_personal` sem acesso direto pelo app e funções só para o administrador). Função `registrar-aluno` com o caminho `tipo: 'personal'`.

## Versão 0.2.0 — Duas equações de gordura, leg press e pressão baixa

- **Equação do % de gordura à escolha do personal**, em cada avaliação, na etapa Dobras: **Faulkner** (tríceps, subescapular, suprailíaca e abdominal) ou **Petroski (1995)**, feita com adultos brasileiros (subescapular, tríceps, suprailíaca e panturrilha; para mulheres, também peso e altura; % pela fórmula de Siri). O resultado mostra qual equação foi usada. Avaliações antigas continuam com Faulkner.
- **Leg press classificado** pela tabela de força relativa do ACSM (1998), por sexo e idade: Excelente, Bom, Médio, Regular ou Fraco. A tabela foi feita em leg press de cadeira; no 45° a classificação tende a sair acima do real (o app avisa).
- **Pressão baixa**: abaixo de 90/60 mmHg aparece "Baixa (hipotensão)" como alerta, em vez de "Ótima".
- Banco: coluna `equacao_gordura` nas avaliações (migração `equacao_gordura`).

## Versão 0.1.1 — Aviso de medidas faltando

- **No resultado**, quando faltam medidas, cada cartão diz o que precisa para calcular (por exemplo, "falta: dobra tríceps, dobra subescapular…") em vez de só "—", e um aviso no topo leva direto para completar a avaliação.
- **Ao salvar** uma avaliação sem as dobras ou perímetros da gordura (Faulkner) ou da massa muscular (Lee), o app avisa o que não vai ser calculado. Tocando em salvar de novo, ela é salva assim mesmo.

## Versão 0.1.0 — Etapa 1: avaliação e evolução

- **Alunos:** cadastro com sexo e nascimento, busca e edição.
- **Nova avaliação em 8 etapas** (básico, exames, perímetros, dobras, força, testes, postura, parecer), com gordura e massa muscular calculadas enquanto se preenche. Altura aceita em metros ou centímetros; dobras com até duas medidas e média automática.
- **Resultado completo:** gordura (Faulkner), massa muscular (Lee et al., 2000), massa gorda e magra em kg, somatórios de dobras, proporcionalidade (Phantom) em régua neutra, 1RM (Epley) com força relativa no supino, FC máxima e de reserva, pressão arterial classificada pela Diretriz Brasileira de 2020 e exames com referência. Botão para imprimir ou salvar em PDF.
- **Evolução** em gráficos (peso, gordura, massa muscular, soma de dobras, cintura e 1RM) e **comparação** entre quaisquer duas avaliações.
- **Acesso do aluno por convite:** link de uso único, válido por 7 dias. O aluno aceita o termo de uso dos dados de saúde (LGPD), cria a senha e passa a ver só os próprios resultados, em linguagem simples, com o recado do personal.
- **Exclusão completa** do aluno, das avaliações, do aceite e do login, para atender pedidos de exclusão (LGPD).
- **Correções em relação à planilha original:** faixa "adequado" de gordura que só valia para um valor exato, massa adiposa misturando % e kg, leg press usando a tabela do supino, Phantom de massas sem o ajuste ao cubo, faixas sem classificação ("FALSO") e 1RM limitado a 10 repetições.
- Segurança como no Financeiro: regras de acesso por usuário no banco, convite guardado só como hash, senhas vazadas recusadas, saída automática após 30 minutos sem uso, só a chave publicável no site.

Publicado em 05/11/2026: banco no projeto Supabase `avaliacao-fisica` (São Paulo), função de cadastro do aluno e site no GitHub Pages.
