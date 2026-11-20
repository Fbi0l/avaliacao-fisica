# Registro das operações de tratamento de dados (LGPD, art. 37)

App **Avaliação Física** — atualizado em 20/11/2026. Revise sempre que entrar uma tabela, um campo ou um fornecedor novo.

**Papéis.** Cada personal é o **controlador** dos dados dos próprios alunos: é ele quem decide avaliar, o que medir e por quanto tempo acompanhar. O app, mantido pelo administrador (Fabio Luan), age como **operador**: guarda e processa os dados para o personal. Os dados dos próprios personais (nome, CREF, e-mail) têm o administrador como controlador.

**Agente de pequeno porte.** O app é gratuito, está em testes e tem poucos usuários: se enquadra no regime simplificado (Resolução CD/ANPD nº 2/2022), o que permite este registro em formato simples. Dados sensíveis em volume grande podem tirar essa condição: rever quando o número de alunos crescer.

## Operações

| # | Operação | Dados | Titular | Finalidade | Base legal | Onde fica (tabela) | Quem acessa | Por quanto tempo |
|---|---|---|---|---|---|---|---|---|
| 1 | Conta de acesso | e-mail, senha (só o hash) | personal e aluno | entrar no app | execução de contrato (art. 7º, V) | Supabase Auth (`auth.users`) | o próprio titular; administrador (técnico) | até a exclusão da conta |
| 2 | Cadastro do personal | nome, CREF, aceite do termo (versão e data) | personal | identificar o personal para os alunos | execução de contrato (art. 7º, V) | `personais` | o próprio personal e os alunos dele (nome e CREF) | até a exclusão da conta |
| 3 | Cadastro do aluno | nome, sexo, data de nascimento, contato | aluno | identificar o aluno e calcular os resultados (as equações usam sexo e idade) | consentimento (art. 7º, I) | `alunos` | o personal dele e o próprio aluno | enquanto for aluno do personal; sai na exclusão |
| 4 | Avaliação física | peso, altura, FC de repouso, pressão, glicose, colesterol e triglicerídeos, perímetros, dobras, força, testes, postura, parecer | aluno | avaliar, planejar o treino e mostrar a evolução | **dado sensível de saúde**: consentimento específico e destacado (art. 11, I) | `avaliacoes` | o personal dele e o próprio aluno | enquanto for aluno do personal; sai na exclusão |
| 5 | Treino | fichas, treinos feitos e cargas anotadas, periodização | aluno | prescrever e acompanhar o treino | consentimento (art. 11, I) | `fichas`, `treinos_feitos`, `ciclos` | o personal dele e o próprio aluno | idem |
| 6 | Mensagens | texto das conversas e avaliações anexadas | aluno e personal | comunicação entre os dois | consentimento (art. 7º, I) | `mensagens` | só os dois participantes | idem |
| 7 | Prova do consentimento | aluno, usuário, versão do termo, data do aceite | aluno | comprovar o aceite (art. 8º, §2º) | cumprimento de obrigação legal (art. 7º, II) | `consentimentos` | o personal dele e o próprio aluno | enquanto existirem os dados do aluno |
| 8 | Convites | hash do código, quem convidou, validade, quem usou | personal e aluno | dar acesso com segurança | legítimo interesse (art. 7º, IX) | `convites_aluno`, `convites_personal` | só por funções do servidor | até a exclusão do aluno ou do personal |
| 9 | Preferências no aparelho | tema, guia já visto, rascunho do treino do dia, última atividade | personal e aluno | conveniência e encerrar a sessão por inatividade | legítimo interesse (art. 7º, IX) | `localStorage` do navegador (não sai do aparelho) | só o próprio aparelho | até sair do app ou limpar o navegador |
| 10 | Cópia de segurança | cópia de todo o banco, criptografada | todos | recuperar dados em caso de falha | legítimo interesse (art. 7º, IX) e segurança (art. 46) | GitHub Actions (artefato criptografado com a chave do administrador) | só o administrador, com a chave privada | 30 dias (**hoje desligada**; ver `BACKUP.md`) |

## Fornecedores (operadores e suboperadores)

| Fornecedor | O que faz | Onde | Observação |
|---|---|---|---|
| Supabase | banco de dados, login, função de cadastro | São Paulo (sa-east-1) | dados principais não saem do Brasil |
| GitHub (Pages e Actions) | hospeda o site; guarda as cópias de segurança | Estados Unidos | o site não guarda dados; a cópia vai criptografada (transferência internacional, art. 33) |
| jsDelivr | entrega a biblioteca do Supabase para o navegador | global (CDN) | recebe só o pedido do arquivo (IP e navegador), com integridade conferida |
| Have I Been Pwned | confere se a senha nova já vazou | global | recebe só os 5 primeiros caracteres do hash da senha (k-anonimato) |

O app **não usa** cookies de rastreamento, analytics, pixels de anúncio nem inteligência artificial.

## Segurança (art. 46)

- RLS em todas as tabelas; funções das regras no esquema `privado`; chave secreta só no servidor.
- Testes a cada envio: regras de acesso (`npm run test:banco`), segurança do site e navegador com acessibilidade.
- Auditoria semanal da configuração do Supabase com o usuário `auditoria_leitura`, que **não lê nenhum dado** (`AUDITORIA_SUPABASE.md`; começa desligada).
- Dependabot avisa de atualizações e falhas conhecidas nas bibliotecas de teste e nas ações do GitHub.

## Direitos dos titulares (art. 18)

- **Correção:** o personal edita os dados do aluno no app.
- **Exclusão:** o personal usa "Excluir aluno" (`excluir_aluno`): apaga o aluno, avaliações, treinos, mensagens, consentimentos e a conta de acesso. As cópias de segurança expiram em até 30 dias.
- **Acesso e cópia:** hoje o aluno vê tudo no app, mas ainda não há um botão para baixar os dados (pendência).
- Prazo de resposta: até 15 dias (art. 19, II).
