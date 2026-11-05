# avaliacao-fisica

App para o personal trainer registrar avaliações físicas, acompanhar a evolução dos alunos e, futuramente, montar treinos. O aluno recebe um convite e passa a ver a própria evolução. Site estático (HTML, CSS e JavaScript, sem etapa de build) com Supabase para banco, login e regras de acesso. Funciona no computador e no celular, e pode ser instalado como app.

## Versão 0.2.0 — Duas equações de gordura, leg press e pressão baixa

- **Equação do % de gordura à escolha do personal**, em cada avaliação, na etapa Dobras: **Faulkner** (tríceps, subescapular, suprailíaca e abdominal) ou **Petroski (1995)**, feita com adultos brasileiros (subescapular, tríceps, suprailíaca e panturrilha; para mulheres, também peso e altura; % pela fórmula de Siri). O resultado mostra qual equação foi usada. Avaliações antigas continuam com Faulkner.
- **Leg press classificado** pela tabela de força relativa do ACSM (1998), por sexo e idade: Excelente, Bom, Médio, Regular ou Fraco. A tabela foi feita em leg press de cadeira; no 45° a classificação tende a sair acima do real (o app avisa).
- **Pressão baixa**: abaixo de 90/60 mmHg aparece "Baixa (hipotensão)" como alerta, em vez de "Ótima".
- Banco: coluna `equacao_gordura` nas avaliações (migração `equacao_gordura`).

## Versão 0.1.1 — Aviso de medidas faltando

- **No resultado**, quando faltam medidas, cada cartão diz o que precisa para calcular (por exemplo, "falta: dobra tríceps, dobra subescapular…") em vez de só "—", e um aviso no topo leva direto para completar a avaliação.
- **Ao salvar** uma avaliação sem as dobras ou perímetros da gordura (Faulkner) ou da massa muscular (Lee), o app avisa o que não vai ser calculado. Tocando em salvar de novo, ela é salva assim mesmo.

## Versão 0.1.0 — Etapa 1: avaliação e evolução

- **Alunos:** cadastro com sexo, nascimento e etnia (usada na fórmula de massa muscular), busca e edição.
- **Nova avaliação em 6 etapas** (básico, exames, perímetros, dobras, força, parecer), com gordura e massa muscular calculadas enquanto se preenche. Altura aceita em metros ou centímetros; dobras com até duas medidas e média automática.
- **Resultado completo:** gordura (Faulkner), massa muscular (Lee et al., 2000), massa gorda e magra em kg, somatórios de dobras, proporcionalidade (Phantom) em régua neutra, 1RM (Epley) com força relativa no supino, FC máxima e de reserva, pressão arterial classificada pela Diretriz Brasileira de 2020 e exames com referência. Botão para imprimir ou salvar em PDF.
- **Evolução** em gráficos (peso, gordura, massa muscular, soma de dobras, cintura e 1RM) e **comparação** entre quaisquer duas avaliações.
- **Acesso do aluno por convite:** link de uso único, válido por 7 dias. O aluno aceita o termo de uso dos dados de saúde (LGPD), cria a senha e passa a ver só os próprios resultados, em linguagem simples, com o recado do personal.
- **Exclusão completa** do aluno, das avaliações, do aceite e do login, para atender pedidos de exclusão (LGPD).
- **Correções em relação à planilha original:** faixa "adequado" de gordura que só valia para um valor exato, massa adiposa misturando % e kg, leg press usando a tabela do supino, Phantom de massas sem o ajuste ao cubo, faixas sem classificação ("FALSO") e 1RM limitado a 10 repetições.
- Segurança como no Financeiro: regras de acesso por usuário no banco, convite guardado só como hash, senhas vazadas recusadas, saída automática após 30 minutos sem uso, só a chave publicável no site.

Publicado em 05/11/2026: banco no projeto Supabase `avaliacao-fisica` (São Paulo), função de cadastro do aluno e site no GitHub Pages.
