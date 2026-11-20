# Plano de resposta a incidentes de segurança

App **Avaliação Física** — atualizado em 20/11/2026.

**Incidente** é qualquer situação em que dados do app possam ter sido vistos, copiados, alterados ou apagados por quem não devia: uma senha ou chave vazada, uma regra de acesso errada, um aparelho perdido com o app aberto, um backup exposto, um personal vendo aluno de outro.

**Responsável:** o administrador (Fabio Luan). Na ausência dele, quem tiver acesso de dono ao projeto do Supabase.

## 1. Conter (na primeira hora)

- [ ] Anote **quando** e **como** soube do problema (data, hora, quem avisou).
- [ ] Se uma chave vazou: no Supabase, *Project Settings → API Keys*, gere uma nova chave secreta (`sb_secret_`/`service_role`) e atualize a função `registrar-aluno`. Se foi a senha do banco, troque em *Database → Reset database password*.
- [ ] Se uma conta foi invadida: no Supabase, *Authentication → Users*, encerre as sessões e troque a senha do usuário.
- [ ] Se uma regra de acesso estava errada: corrija com uma migração nova e rode `npm run test:banco`.
- [ ] Se necessário, tire o site do ar (*Settings → Pages* no GitHub) até a correção.
- [ ] **Não apague registros** que mostram o que aconteceu (logs do Supabase em *Logs*, histórico do GitHub).

## 2. Avaliar (em até 24 horas)

Responda e guarde as respostas:

1. Quais dados foram atingidos? (lembre: avaliações são **dados de saúde**, sensíveis)
2. De quantos alunos e personais?
3. Os dados estavam protegidos? (criptografados, só hash, só o código do convite etc.)
4. Alguém de fato acessou, ou só poderia ter acessado?
5. Que dano isso pode causar às pessoas? (constrangimento, discriminação, fraude)

**Precisa comunicar** se o incidente puder trazer **risco ou dano relevante** aos titulares. Com dados de saúde envolvidos, considere que sim, salvo se ficou claro que ninguém acessou ou os dados estavam ilegíveis.

## 3. Comunicar (em até 3 dias úteis)

Prazo da Resolução CD/ANPD nº 15/2024, contado de quando se soube que o incidente atingiu dados pessoais.

- [ ] **ANPD:** formulário de comunicação de incidente no site da ANPD (gov.br/anpd). Informe o que aconteceu, os dados e titulares atingidos, as medidas tomadas e o contato.
- [ ] **Personais:** cada personal é o controlador dos dados dos alunos dele: avise primeiro os personais atingidos.
- [ ] **Alunos atingidos:** mensagem simples, sem termos técnicos: o que aconteceu, quais dados, o que já foi feito e o que a pessoa pode fazer (por exemplo, trocar a senha). Combine com o personal quem envia.

Modelo de aviso:

> Olá, [nome]. Em [data] identificamos [o que aconteceu, em uma frase]. Os dados que podem ter sido atingidos são [quais]. Já [medidas tomadas]. Por segurança, recomendamos [o que fazer]. Se tiver dúvidas, fale com [contato].

## 4. Registrar e corrigir a causa

- [ ] Preencha o registro abaixo, **mesmo que não tenha sido preciso comunicar**: a ANPD pode pedir o histórico dos últimos 5 anos.
- [ ] Corrija a causa, acrescente um teste que pegaria o problema e publique uma versão nova.

## Registro de incidentes

| Data em que soube | O que aconteceu | Dados e titulares atingidos | Comunicou ANPD? Quando? | Comunicou titulares? Quando? | Medidas tomadas |
|---|---|---|---|---|---|
| | | | | | |
