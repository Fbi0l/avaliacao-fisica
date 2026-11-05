# Novo design — direções visuais (05/11/2026)

Material de base para a futura mudança de visual do app. **Nada disto está no app ainda**: o app publicado continua com o visual atual. A direção final ainda não foi escolhida.

- `avaliacao-fisica-direcoes-visuais.jpg`: as 3 direções lado a lado, cada uma com 3 telas (início do aluno, resultado da avaliação, evolução).
- `telas/`: o código de cada tela (formato da tela de design do Claude, `.dc.html`). `Main.dc.html` é o início da direção A. `_todas-juntas.html` abre as 9 telas numa página só, no navegador.
- Tela de design no Claude (editável, privada): "Avaliação Física — direções visuais", https://claude.ai/artifact/7LXHHgT1vwMptTMVAWwnon

Os números das telas são de uma aluna fictícia (a "Mariana Costa" do protótipo, 3 avaliações de junho a outubro de 2026), calculados pelas fórmulas reais do `calculos.js`.

## Referências analisadas

Usadas só como inspiração: o app deve ter identidade própria, sem copiar cores exatas, logos ou layouts das marcas.

**Bluefit** (site oficial, missão e valores, Instagram @bluefitacademia)
- Azul elétrico saturado (#0000EE) com azul-marinho (#050D9E) e branco; rosa-magenta só como destaque.
- Montserrat, geométrica; títulos em caixa-alta pesada, leitura limpa. Monograma "BF" com cortes horizontais (velocidade).
- Fotos de gente real sorrindo, tom bem-humorado e acessível. Missão: acabar com as desculpas para não treinar.
- Sensação: democrática, amigável, energética sem agressividade.

**Sky Fit** (projeto "Social Media - Sky Fit (Lançamento)" no Behance)
- Fundo marinho quase preto, vermelho vivo e branco, contraste forte.
- Caixa-alta muito pesada, condensada e inclinada; fumaça, holofote, neon, selos de "live".
- Sensação: intensa, competitiva, de evento. Ótima em post; cansa em tela de uso diário.

## Conclusões que valem para qualquer direção

- Aproveitar da Bluefit: uma cor própria forte como assinatura, fonte geométrica, tom humano e simples para o aluno.
- Aproveitar da Sky Fit: números grandes em fonte condensada e sensação de conquista quando o aluno evolui.
- Evitar: vermelho como cor da marca (no app vermelho é alerta: pressão baixa, piora); fumaça, textura e neon em telas de dados; caixa-alta em texto longo; copiar o azul da Bluefit.
- Skills usadas: **ui-ux-pro-max** e **bencium-controlled-ux-designer**. Delas: visual plano (bordas em vez de sombras), contraste mínimo 4,5:1, toques de 44 px, ícones em SVG (sem emoji), cor nunca sozinha para dar significado (sempre seta ▲▼ e palavra junto), e com menos de 4 avaliações preferir cartões de número a gráfico de linha (o gráfico entra com os valores escritos em cada ponto).

## As 3 direções

| | A · Coral acolhedor | B · Noite de conquista | C · Dia a dia + conquista |
|---|---|---|---|
| Inspiração | Bluefit | Sky Fit | as duas |
| Fundo | claro quente #F6F3EF, cartões #FFFFFF, borda #E7E1DA | quase preto #0D0F14, cartões #171A22, borda #272C38 | claro #F2EFE8, cartões #FFFFFF, blocos de conquista #121A2C |
| Texto | #1D1B1A, secundário #5E5853 | #F3F4F6, secundário #A3A9B6 | #121A2C, secundário #575C68 |
| Cor de destaque | coral #C83D12 | verde-limão #C6F432 (texto escuro por cima) | laranja #FF7A2E, só sobre o azul-marinho |
| "Melhorou" | verde #0F5E4A sobre #E3F1EC | o próprio limão | verde #1C6B4F sobre #E1F0E8 |
| Fontes | Outfit (títulos e números) + Work Sans (texto) | Barlow Condensed (títulos e números) + Barlow (texto) | Barlow Condensed (números) + Plus Jakarta Sans (texto) |
| Ponto forte | a mais fácil de ler e acolhedora | a mais impactante e motivadora | leitura fácil no dia a dia, impacto na conquista |
| Cuidado | discreta, a conquista não "explode" | cansa no uso longo; resultado fica denso | dois climas na mesma tela; manter disciplina |

Na tela de design, cada tela tem a cor de destaque ajustável (aba Tweaks), com alternativas: A coral #C83D12 / #B4411F / #9E3A1F; B limão #C6F432 / menta #7CF5C8 / âmbar #FFB020; C laranja #FF7A2E / âmbar #FFB020 / menta #7CF5C8.

## Próximos passos (quando retomar)

1. O dono escolhe uma direção (ou uma combinação, por exemplo o início da C com o resultado da B).
2. Desenhar as telas do personal (lista de alunos, nova avaliação em etapas, comparar) na direção escolhida.
3. Levar para o app: variáveis de cor e fontes no `styles.css` (claro e, se for o caso, escuro), mantendo as regras do `CLAUDE.md` (CSP sem inline, fontes servidas pelo próprio site, campos com 16 px no celular). Subir a versão e registrar no `README.md`.
