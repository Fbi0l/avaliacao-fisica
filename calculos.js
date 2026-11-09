/* Cálculos da avaliação física. Funções puras: recebem as medidas e devolvem os resultados.
   Nada aqui acessa a tela ou o banco; tudo é testado em tests/calculos.cjs.
   Referências: Lee et al. (2000) massa muscular; Faulkner (1968) e Petroski (1995) % de gordura; Ross e Wilson (1974)
   modelo Phantom; Epley (1985) 1RM; ACSM (1998) força no leg press; Tanaka, Monahan e Seals (2001) FC máxima; Karvonen (1957) zonas de FC; NSCA (Baechle e Earle, 2008) zonas de carga por % do 1RM;
   CSEP-PATH (2019) / ACSM flexão de braço; Pollock e Wilmore (1993) abdominal em 1 minuto; Cooper (1968) teste de 12 minutos e
   Cooper Institute classificação do VO2máx; Araújo, Flexiteste (20 movimentos, notas de 0 a 4); avaliação postural visual por vistas (Kendall et al.); Diretriz Brasileira de Hipertensão (2020); Heyward (1991) faixas de gordura. */
'use strict';

const PERIMETROS = [['bracoD', 'Braço D'], ['bracoE', 'Braço E'], ['antD', 'Antebraço D'], ['antE', 'Antebraço E'], ['torax', 'Tórax'], ['cintura', 'Cintura'], ['abdomen', 'Abdômen'], ['quadril', 'Quadril'], ['coxaSupD', 'Coxa superior D'], ['coxaSupE', 'Coxa superior E'], ['coxaMedD', 'Coxa média D'], ['coxaMedE', 'Coxa média E'], ['pantD', 'Panturrilha D'], ['pantE', 'Panturrilha E']];
const DOBRAS = [['triceps', 'Tríceps'], ['subesc', 'Subescapular'], ['biceps', 'Bíceps'], ['iliaca', 'Suprailíaca'], ['supraesp', 'Supraespinhal'], ['abdominal', 'Abdominal'], ['coxa', 'Coxa'], ['panturrilha', 'Panturrilha']];

const ok = v => typeof v === 'number' && Number.isFinite(v);

/** Idade em anos completos na data da avaliação (datas ISO "AAAA-MM-DD"). */
function idadeEm(nascimento, data) {
  const [a1, m1, d1] = String(nascimento).split('-').map(Number), [a2, m2, d2] = String(data).split('-').map(Number);
  let i = a2 - a1;
  if (m2 < m1 || (m2 === m1 && d2 < d1)) i--;
  return i;
}

/** Média das duas medidas de uma dobra; com uma só, ela mesma. */
function mediaDobra(par) {
  const v = (Array.isArray(par) ? par : [par]).filter(ok);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/** Lê um número digitado com vírgula ou ponto. Vazio = null; texto inválido = NaN. */
function lerNumero(texto) {
  const s = String(texto ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Escore-Z do Phantom: medidas lineares ajustadas por 170,18/altura; massas ao cubo. */
const zPhantom = (valor, alturaCm, media, dp, expoente = 1) => (valor * Math.pow(170.18 / alturaCm, expoente) - media) / dp;
const PHANTOM_PERIMETROS = { bracoD: [26.89, 2.33], antD: [25.13, 1.41], torax: [87.86, 5.18], cintura: [71.91, 4.45], abdomen: [79.06, 6.95], quadril: [94.67, 5.58], coxaSupD: [55.82, 4.23], coxaMedD: [53.2, 4.56], pantD: [35.25, 2.3] };
const PHANTOM_DOBRAS = { triceps: [15.4, 4.47], subesc: [17.2, 5.07], biceps: [8.0, 2.0], iliaca: [22.4, 6.8], supraesp: [15.4, 4.47], abdominal: [25.4, 7.78], coxa: [27.0, 8.33], panturrilha: [16.0, 4.67] };
const PHANTOM_MUSCULO = [25.55, 2.99];

/** Proporção (escore-Z) em palavras. Neutra: acima nem sempre é melhor (cintura, dobras). */
function classeProporcao(z) {
  if (!ok(z)) return null;
  return z > 2 ? { texto: 'Bem acima', tom: 'destaque' } : z > 1 ? { texto: 'Acima', tom: 'neutro' } : z >= -1 ? { texto: 'Na média', tom: 'neutro' }
    : z >= -2 ? { texto: 'Abaixo', tom: 'neutro' } : { texto: 'Bem abaixo', tom: 'destaque' };
}
function classeMassaMuscular(z) {
  if (!ok(z)) return null;
  return z > 3 ? { texto: 'Excelente volume muscular', tom: 'bom' } : z > 2 ? { texto: 'Ótimo volume muscular', tom: 'bom' } : z > 1 ? { texto: 'Bom volume muscular', tom: 'bom' }
    : z > -1 ? { texto: 'Volume muscular adequado', tom: 'neutro' } : z > -2 ? { texto: 'Déficit muscular leve', tom: 'atencao' }
    : z > -3 ? { texto: 'Déficit muscular moderado', tom: 'ruim' } : { texto: 'Déficit muscular severo', tom: 'ruim' };
}

// Percentual de gordura: limites superiores por faixa de idade (20-29 … 60+) e sexo (Heyward, 1991). A REVISAR com o personal.
const FAIXAS_GORDURA = {
  M: [[5.3, 9.4, 14.1, 17.6, 22.5, 29.3], [9.3, 14.1, 17.6, 20.7, 24.3, 30.1], [11.6, 16.4, 19.7, 22.6, 26.3, 31.5], [13.0, 18.2, 21.3, 24.3, 27.7, 32.5], [13.1, 18.6, 22.1, 25.1, 28.5, 33.6]],
  F: [[10.8, 17.1, 20.6, 23.9, 27.8, 35.6], [13.4, 18.1, 21.9, 24.9, 30.1, 35.9], [16.2, 21.5, 25.2, 28.4, 32.2, 37.8], [18.9, 25.2, 28.7, 32.6, 35.7, 39.7], [19.2, 25.1, 29.6, 32.9, 36.8, 40.5]]
};
const ROTULOS_GORDURA = [['Muito baixo', 'atencao'], ['Baixo', 'neutro'], ['Ótimo', 'bom'], ['Saudável', 'bom'], ['Acima do ideal', 'atencao'], ['Elevado', 'ruim'], ['Muito elevado', 'ruim']];
function classeGordura(pct, sexo, idade) {
  if (!ok(pct) || !FAIXAS_GORDURA[sexo]) return null;
  const linha = FAIXAS_GORDURA[sexo][Math.min(4, Math.max(0, Math.floor((idade - 20) / 10)))];
  const i = linha.findIndex(t => pct <= t);
  const [texto, tom] = ROTULOS_GORDURA[i === -1 ? 6 : i];
  return { texto, tom };
}

/** % de gordura por Faulkner: 0,153 × (tríceps + subescapular + suprailíaca + abdominal) + 5,783. */
function gorduraFaulkner(d) {
  const v = [d.triceps, d.subesc, d.iliaca, d.abdominal];
  return v.every(ok) ? 0.153 * v.reduce((s, x) => s + x, 0) + 5.783 : null;
}

/** % de gordura por Petroski (1995), validada com adultos brasileiros: densidade corporal pelas mesmas
    4 dobras nos dois sexos (subescapular, tríceps, suprailíaca e panturrilha) e, nas mulheres, também
    peso (kg) e estatura (cm); a densidade vira % pela fórmula de Siri (1961): 495 / densidade − 450.
    Fonte das constantes: Petroski (1995), tese UFSM, reproduzida em Rev. Bras. Cineantropom. Desempenho Hum.
    e Rev. Bras. Geriatr. Gerontol. (2006). A REVISAR com o personal. */
function gorduraPetroski(d, sexo, idade, peso, alturaCm) {
  const v = [d.subesc, d.triceps, d.iliaca, d.panturrilha];
  if (!v.every(ok) || !ok(idade)) return null;
  const x = v.reduce((s, n) => s + n, 0);
  let dc;
  if (sexo === 'M') dc = 1.10726863 - 0.00081201 * x + 0.00000212 * x * x - 0.00041761 * idade;
  else if (sexo === 'F') {
    if (!ok(peso) || !ok(alturaCm)) return null;
    dc = 1.02902361 - 0.00067159 * x + 0.00000242 * x * x - 0.00026073 * idade - 0.00056009 * peso + 0.00054649 * alturaCm;
  } else return null;
  return 495 / dc - 450;
}

/** Equações de % de gordura que o personal pode escolher em cada avaliação, com as dobras que cada uma usa. */
const EQUACOES_GORDURA = {
  faulkner: { nome: 'Faulkner', referencia: 'Faulkner (1968)', dobras: ['triceps', 'subesc', 'iliaca', 'abdominal'] },
  petroski: { nome: 'Petroski', referencia: 'Petroski (1995)', dobras: ['subesc', 'triceps', 'iliaca', 'panturrilha'] }
};
const equacaoDe = av => (av && EQUACOES_GORDURA[av.equacao_gordura]) ? av.equacao_gordura : 'faulkner';

/** Massa muscular esquelética (kg) por Lee et al. (2000). Perímetros em cm corrigidos pelas dobras (mm).
    Sem o ajuste por etnia da fórmula original (retirado a pedido do professor em 09/11/2026): usa o valor neutro, 0. */
function massaMuscularLee({ alturaM, sexo, idade, bracoD, coxaMedD, pantD, triceps, coxa, panturrilha }) {
  if (![alturaM, idade, bracoD, coxaMedD, pantD, triceps, coxa, panturrilha].every(ok)) return null;
  const cag = bracoD - Math.PI * triceps / 10, ctg = coxaMedD - Math.PI * coxa / 10, ccg = pantD - Math.PI * panturrilha / 10;
  return alturaM * (0.00744 * cag * cag + 0.00088 * ctg * ctg + 0.00441 * ccg * ccg) + 2.4 * (sexo === 'M' ? 1 : 0) - 0.048 * idade + 7.8;
}

/** 1RM estimado por Epley. Uma repetição = a própria carga. */
function umRM(carga, reps) {
  if (!ok(carga) || !ok(reps) || carga <= 0 || reps < 1) return null;
  return reps === 1 ? carga : carga * (1 + reps / 30);
}

/** FC máxima estimada por Tanaka, Monahan e Seals (2001): 208 − 0,7 × idade, arredondada. */
function fcMaximaTanaka(idade) { return ok(idade) ? Math.round(208 - 0.7 * idade) : null; }

/** Zonas de FC. Com a FC de repouso, Karvonen (% da FC de reserva + repouso); sem ela, % da FC máxima.
    Faixas usuais de 5 zonas, A REVISAR com o professor. */
const ZONAS_FC = [
  { zona: 1, nome: 'Recuperação', de: 50, ate: 60, uso: 'aquecimento, volta à calma, recuperação ativa' },
  { zona: 2, nome: 'Aeróbico leve', de: 60, ate: 70, uso: 'base aeróbica e queima de gordura, conversa fácil' },
  { zona: 3, nome: 'Aeróbico moderado', de: 70, ate: 80, uso: 'condicionamento, respiração mais forte' },
  { zona: 4, nome: 'Limiar', de: 80, ate: 90, uso: 'ritmo forte e sustentado, fala difícil' },
  { zona: 5, nome: 'Máximo', de: 90, ate: 100, uso: 'tiros curtos, esforço máximo' }
];
function zonasFC(fcMaxima, fcRepouso) {
  if (!ok(fcMaxima)) return null;
  const karvonen = ok(fcRepouso) && fcRepouso < fcMaxima;
  const bpm = pct => Math.round(karvonen ? fcRepouso + (fcMaxima - fcRepouso) * pct / 100 : fcMaxima * pct / 100);
  return { metodo: karvonen ? 'karvonen' : 'fcmax', zonas: ZONAS_FC.map(z => ({ ...z, min: bpm(z.de), max: bpm(z.ate) })) };
}

/** Zonas de carga por % do 1RM (NSCA): faixas usuais, A REVISAR com o professor. */
const ZONAS_CARGA = [
  { chave: 'resistencia', nome: 'Resistência muscular', curto: 'Resistência', de: 0, ate: 67, reps: '12 ou mais repetições' },
  { chave: 'hipertrofia', nome: 'Hipertrofia', curto: 'Hipertrofia', de: 67, ate: 85, reps: '6 a 12 repetições' },
  { chave: 'forca', nome: 'Força', curto: 'Força', de: 85, ate: 100, reps: 'até 6 repetições' }
];
/** Em que zona está uma carga, dado o 1RM. Acima de 100% ainda é Força (o 1RM é estimado). */
function zonaCarga(carga, rm) {
  if (!ok(carga) || !ok(rm) || carga <= 0 || rm <= 0) return null;
  const pct = carga / rm * 100;
  const z = ZONAS_CARGA.find(x => pct < x.ate) || ZONAS_CARGA.at(-1);
  return { pct, ...z };
}
/** Faixas de carga (kg) de cada zona para um 1RM, arredondadas de 0,5 em 0,5 kg. */
function cargasPorZona(rm) {
  if (!ok(rm) || rm <= 0) return null;
  const kg = pct => Math.round(rm * pct / 100 * 2) / 2;
  return ZONAS_CARGA.map(z => ({ ...z, min: z.de ? kg(z.de) : null, max: z.chave === 'forca' ? kg(100) : kg(z.ate) }));
}

/* ---------- Testes físicos (0.7.0) ---------- */
/** Classe por limites INFERIORES: tabela[sexo][i][coluna], do melhor para o pior; abaixo do último, a última classe. */
function classePorLimites(valor, tabela, sexo, col, rotulos) {
  if (!ok(valor) || !tabela[sexo] || col == null) return null;
  for (let i = 0; i < tabela[sexo].length; i++) if (valor >= tabela[sexo][i][col]) return { texto: rotulos[i][0], tom: rotulos[i][1] };
  return { texto: rotulos.at(-1)[0], tom: rotulos.at(-1)[1] };
}
/** Coluna de idade 15-19, 20-29, …, 60-69 (abaixo de 15 usa 15-19; 70 ou mais usa 60-69). */
const colunaIdade15a69 = idade => !ok(idade) ? null : idade < 20 ? 0 : Math.min(5, Math.floor((idade - 20) / 10) + 1);

/** Flexão de braço até a falha, CSEP-PATH (2019), a mesma tabela das diretrizes do ACSM.
    Homens: flexão normal; mulheres: com os joelhos no chão. Limites inferiores de Excelente, Muito bom, Bom e Regular. */
const FLEXAO = {
  M: [[39, 36, 30, 25, 21, 18], [29, 29, 22, 17, 13, 11], [23, 22, 17, 13, 10, 8], [18, 17, 12, 10, 7, 5]],
  F: [[33, 30, 27, 24, 21, 17], [25, 21, 20, 15, 11, 12], [18, 15, 13, 11, 7, 5], [12, 10, 8, 5, 2, 2]]
};
const classeFlexao = (reps, sexo, idade) => classePorLimites(reps, FLEXAO, sexo, colunaIdade15a69(idade),
  [['Excelente', 'bom'], ['Muito bom', 'bom'], ['Bom', 'bom'], ['Regular', 'atencao'], ['Precisa melhorar', 'ruim']]);

/** Abdominal em 1 minuto, Pollock e Wilmore (1993). Limites inferiores de Excelente, Acima da média, Média e Abaixo da média. */
const ABDOMINAL = {
  M: [[48, 43, 36, 31, 26, 23], [42, 37, 31, 26, 22, 17], [38, 33, 27, 22, 18, 12], [33, 29, 22, 17, 13, 7]],
  F: [[42, 36, 29, 25, 19, 16], [36, 31, 24, 20, 12, 12], [32, 25, 20, 15, 5, 4], [27, 21, 15, 7, 3, 2]]
};
const classeAbdominal = (reps, sexo, idade) => classePorLimites(reps, ABDOMINAL, sexo, colunaIdade15a69(idade),
  [['Excelente', 'bom'], ['Acima da média', 'bom'], ['Média', 'neutro'], ['Abaixo da média', 'atencao'], ['Fraco', 'ruim']]);

/** VO2máx (ml/kg/min) estimado pela distância do teste de Cooper de 12 minutos (m). */
const vo2Cooper = metros => ok(metros) && metros > 504.9 ? (metros - 504.9) / 44.73 : null;
/** VO2máx pela tabela do Cooper Institute (percentis 95, 80, 60 e 40), 20-29 a 70-79 (abaixo de 20 usa 20-29; 80 ou mais, 70-79). */
const VO2 = {
  M: [[55.4, 54, 52.5, 48.9, 45.7, 42.1], [51.1, 48.3, 46.4, 43.4, 39.5, 36.7], [45.4, 44, 42.4, 39.2, 35.5, 32.3], [41.7, 40.5, 38.5, 35.6, 32.3, 29.4]],
  F: [[49.6, 47.4, 45.3, 41.1, 37.8, 36.7], [43.9, 42.4, 39.7, 36.7, 33, 30.9], [39.5, 37.8, 36.3, 33, 30, 28.1], [36.1, 34.4, 33, 30.1, 27.5, 25.9]]
};
const classeVO2 = (vo2, sexo, idade) => classePorLimites(vo2, VO2, sexo, !ok(idade) ? null : Math.min(5, Math.max(0, Math.floor((idade - 20) / 10))),
  [['Superior', 'bom'], ['Excelente', 'bom'], ['Bom', 'bom'], ['Razoável', 'neutro'], ['Fraco', 'ruim']]);
/** Ritmo (min por km) e velocidade (km/h) a partir da distância (m) e do tempo (min). */
function ritmo(metros, minutos) {
  if (!ok(metros) || !ok(minutos) || metros <= 0 || minutos <= 0) return null;
  return { pace: minutos / (metros / 1000), kmh: (metros / 1000) / (minutos / 60) };
}
/** Pace em texto: 5,5 → "5:30 /km". */
function paceTexto(minPorKm) {
  if (!ok(minPorKm)) return null;
  let m = Math.floor(minPorKm), seg = Math.round((minPorKm - m) * 60);
  if (seg === 60) { m += 1; seg = 0; }
  return `${m}:${String(seg).padStart(2, '0')} /km`;
}

/** Flexiteste (Araújo): 20 movimentos, nota de 0 (amplitude muito pequena) a 4 (muito grande). Flexíndice = soma dos 20. */
const FLEXITESTE = [
  ['I', 'Flexão dorsal', 'Tornozelo'], ['II', 'Flexão plantar', 'Tornozelo'],
  ['III', 'Flexão', 'Joelho'], ['IV', 'Extensão', 'Joelho'],
  ['V', 'Flexão', 'Quadril'], ['VI', 'Extensão', 'Quadril'], ['VII', 'Adução', 'Quadril'], ['VIII', 'Abdução', 'Quadril'],
  ['IX', 'Flexão', 'Tronco'], ['X', 'Extensão', 'Tronco'], ['XI', 'Flexão lateral', 'Tronco'],
  ['XII', 'Flexão', 'Punho'], ['XIII', 'Extensão', 'Punho'],
  ['XIV', 'Flexão', 'Cotovelo'], ['XV', 'Extensão', 'Cotovelo'],
  ['XVI', 'Adução posterior a partir da abdução de 180°', 'Ombro'], ['XVII', 'Extensão com adução posterior', 'Ombro'],
  ['XVIII', 'Extensão posterior', 'Ombro'], ['XIX', 'Rotação lateral (abdução de 90°, cotovelo a 90°)', 'Ombro'],
  ['XX', 'Rotação medial (abdução de 90°, cotovelo a 90°)', 'Ombro']
];
const MIN_FLEXITESTE_SUGERIDO = 5;

/** Resultados dos testes físicos de uma avaliação (campo testes). */
function calcularTestes(testes, sexo, idade) {
  const t = testes && typeof testes === 'object' ? testes : {};
  const aer = t.aerobico && typeof t.aerobico === 'object' ? t.aerobico : null;
  const cooper = aer?.tipo === 'cooper', tempo = cooper ? 12 : Number(aer?.tempo);
  const distancia = aer ? Number(aer.distancia) : null;
  const vo2 = cooper ? vo2Cooper(distancia) : null;
  const flex = t.flexiteste && typeof t.flexiteste === 'object' ? t.flexiteste : {};
  const movimentos = FLEXITESTE.filter(([k]) => Number.isInteger(flex[k])).map(([k, nome, art]) => ({ chave: k, nome, articulacao: art, nota: flex[k] }));
  return {
    flexao: ok(t.flexao) ? t.flexao : null, classeFlexao: classeFlexao(t.flexao, sexo, idade),
    abdominal: ok(t.abdominal) ? t.abdominal : null, classeAbdominal: classeAbdominal(t.abdominal, sexo, idade),
    aerobico: aer ? { tipo: aer.tipo, distancia, tempo, fcFinal: ok(aer.fc_final) ? aer.fc_final : null, ...ritmo(distancia, tempo) } : null,
    vo2, classeVO2: classeVO2(vo2, sexo, idade),
    flexiteste: movimentos, somaFlexiteste: movimentos.length ? movimentos.reduce((a, m) => a + m.nota, 0) : null,
    flexindice: movimentos.length === FLEXITESTE.length ? movimentos.reduce((a, m) => a + m.nota, 0) : null
  };
}

/* ---------- Avaliação postural (0.8.0) ---------- */
/** Checklist visual por vista. Cada item: [chave, nome, [[valor, texto da alteração], …]]. Sem valor = sem alteração. */
const POSTURA = [
  ['Anterior', [
    ['cabeca_lateral', 'Cabeça', [['direita', 'inclinada para a direita'], ['esquerda', 'inclinada para a esquerda']]],
    ['ombros_nivel', 'Ombros', [['direito', 'ombro direito mais alto'], ['esquerdo', 'ombro esquerdo mais alto']]],
    ['pelve_nivel', 'Pelve (cristas ilíacas)', [['direita', 'lado direito mais alto'], ['esquerda', 'lado esquerdo mais alto']]],
    ['joelhos_frontal', 'Joelhos', [['valgo', 'valgo (para dentro)'], ['varo', 'varo (para fora)']]],
    ['pes', 'Pés (arco plantar)', [['plano', 'pé plano'], ['cavo', 'pé cavo']]]
  ]],
  ['Lateral', [
    ['cabeca_sagital', 'Cabeça', [['anteriorizada', 'anteriorizada (projetada à frente)']]],
    ['ombros_sagital', 'Ombros', [['protusos', 'protusos (projetados à frente)']]],
    ['toracica', 'Coluna torácica', [['hipercifose', 'hipercifose (curvatura aumentada)'], ['retificada', 'retificada (curvatura diminuída)']]],
    ['lombar', 'Coluna lombar', [['hiperlordose', 'hiperlordose (curvatura aumentada)'], ['retificada', 'retificada (curvatura diminuída)']]],
    ['pelve_sagital', 'Pelve', [['anteversao', 'anteversão'], ['retroversao', 'retroversão']]],
    ['joelhos_sagital', 'Joelhos', [['hiperextensao', 'hiperestendidos (recurvato)'], ['semiflexao', 'em semiflexão']]],
    ['abdome', 'Abdômen', [['protuso', 'protuso']]]
  ]],
  ['Posterior', [
    ['escapulas', 'Escápulas', [['aladas', 'aladas (descoladas das costas)']]],
    ['coluna_lateral', 'Coluna', [['direita', 'desvio para a direita (sinal de escoliose)'], ['esquerda', 'desvio para a esquerda (sinal de escoliose)']]],
    ['calcaneos', 'Calcanhares', [['valgo', 'valgo (para dentro)'], ['varo', 'varo (para fora)']]]
  ]]
];
const POSTURA_OBS_MAX = 1000;
/** Alterações encontradas, na ordem do checklist: [{ vista, chave, nome, texto }]. Valores fora da lista são ignorados. */
function alteracoesPosturais(postura) {
  const itens = postura && typeof postura === 'object' && postura.itens && typeof postura.itens === 'object' ? postura.itens : {};
  const lista = [];
  for (const [vista, grupo] of POSTURA) for (const [chave, nome, opcoes] of grupo) {
    const o = opcoes.find(([v]) => v === itens[chave]);
    if (o) lista.push({ vista, chave, nome, texto: o[1] });
  }
  return lista;
}
/** A postura foi avaliada? (o personal marcou, mesmo sem nenhuma alteração) */
const posturaAvaliada = postura => !!(postura && typeof postura === 'object' && postura.itens && typeof postura.itens === 'object');

/** Outros exercícios do teste de força, escolhidos pelo personal: sem tabela de classificação, só 1RM e 1RM ÷ peso. */
const MAX_OUTROS_EXERCICIOS = 8;
const SUGESTOES_EXERCICIOS = ['Agachamento livre', 'Remada curvada', 'Puxada frontal', 'Desenvolvimento', 'Rosca direta', 'Tríceps testa',
  'Cadeira extensora', 'Mesa flexora', 'Stiff', 'Levantamento terra', 'Supino inclinado', 'Crucifixo'];
/** Nome do exercício para comparar entre avaliações: sem acento, minúsculo, espaços simples. */
const chaveExercicio = nome => String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Força relativa no supino (1RM ÷ peso): limites inferiores de Excelente, Muito bom, Médio e Fraco,
// por faixa de idade (<20, 20-29, 30-39, 40-49, 50-59, 60+).
const SUPINO = {
  M: [[1.33, 1.31, 1.11, 0.99, 0.89, 0.83], [1.19, 1.14, 0.98, 0.88, 0.79, 0.71], [1.06, 0.99, 0.88, 0.80, 0.71, 0.66], [0.89, 0.88, 0.78, 0.72, 0.63, 0.57]],
  F: [[0.77, 0.80, 0.70, 0.62, 0.55, 0.54], [0.65, 0.70, 0.60, 0.54, 0.48, 0.48], [0.58, 0.59, 0.53, 0.50, 0.43, 0.42], [0.53, 0.51, 0.47, 0.43, 0.39, 0.38]]
};
function classeSupino(relativa, sexo, idade) {
  if (!ok(relativa) || !SUPINO[sexo]) return null;
  const col = idade < 20 ? 0 : Math.min(5, Math.floor((idade - 20) / 10) + 1);
  const rot = [['Excelente', 'bom'], ['Muito bom', 'bom'], ['Médio', 'neutro'], ['Fraco', 'atencao']];
  for (let i = 0; i < 4; i++) if (relativa > SUPINO[sexo][i][col]) return { texto: rot[i][0], tom: rot[i][1] };
  return { texto: 'Muito fraco', tom: 'ruim' };
}

/** Leg press: força relativa (1RM ÷ peso) por sexo e idade, ACSM Guidelines for Exercise Testing and
    Prescription, Resource Manual (1998). Limites INFERIORES de Excelente, Bom, Médio e Regular para
    20-29, 30-39, 40-49, 50-59 e 60+ anos (abaixo do último: Fraco). Menores de 20 usam a coluna 20-29.
    A tabela foi feita num leg press de cadeira (horizontal); no leg press 45° de anilhas a carga
    costuma ser bem maior, então a classificação tende a sair acima do real. Aprovada pelo dono em 05/11/2026. */
const LEG_PRESS = {
  M: [[2.08, 1.88, 1.76, 1.66, 1.56], [2.00, 1.80, 1.70, 1.60, 1.50], [1.83, 1.63, 1.56, 1.46, 1.37], [1.65, 1.55, 1.50, 1.40, 1.31]],
  F: [[1.63, 1.42, 1.32, 1.26, 1.15], [1.54, 1.35, 1.26, 1.13, 1.08], [1.35, 1.20, 1.12, 0.99, 0.92], [1.26, 1.13, 1.06, 0.86, 0.85]]
};
function classeLegPress(relativa, sexo, idade) {
  if (!ok(relativa) || !LEG_PRESS[sexo] || !ok(idade)) return null;
  const col = Math.min(4, Math.max(0, Math.floor((idade - 20) / 10)));
  const rot = [['Excelente', 'bom'], ['Bom', 'bom'], ['Médio', 'neutro'], ['Regular', 'atencao']];
  for (let i = 0; i < 4; i++) if (relativa >= LEG_PRESS[sexo][i][col]) return { texto: rot[i][0], tom: rot[i][1] };
  return { texto: 'Fraco', tom: 'ruim' };
}

/** Pressão arterial pela Diretriz Brasileira de Hipertensão 2020: vale a pior das duas medidas.
    A diretriz só classifica do normal para cima; abaixo de 90/60 mmHg (critério usual de hipotensão)
    a pressão não é "ótima": vira alerta, a não ser que a outra medida já esteja na faixa de hipertensão. */
function classePressao(sistolica, diastolica) {
  if (!ok(sistolica) || !ok(diastolica)) return null;
  const hipertensao = sistolica >= 140 || diastolica >= 90;
  if (!hipertensao && (sistolica < 90 || diastolica < 60)) return { texto: 'Baixa (hipotensão)', tom: 'atencao' };
  const s = sistolica < 120 ? 0 : sistolica < 130 ? 1 : sistolica < 140 ? 2 : sistolica < 160 ? 3 : sistolica < 180 ? 4 : 5;
  const d = diastolica < 80 ? 0 : diastolica < 85 ? 1 : diastolica < 90 ? 2 : diastolica < 100 ? 3 : diastolica < 110 ? 4 : 5;
  const [texto, tom] = [['Ótima', 'bom'], ['Normal', 'bom'], ['Pré-hipertensão', 'atencao'], ['Hipertensão estágio 1', 'ruim'], ['Hipertensão estágio 2', 'ruim'], ['Hipertensão estágio 3', 'ruim']][Math.max(s, d)];
  return { texto, tom };
}

// Exames de sangue: referências gerais para adultos. A REVISAR com o personal.
const EXAMES = {
  glicose: { nome: 'Glicose', unidade: 'mg/dL', referencia: '< 100', classe: v => v < 100 ? ['Normal', 'bom'] : v < 126 ? ['Alterada', 'atencao'] : ['Elevada', 'ruim'] },
  triglicerideos: { nome: 'Triglicerídeos', unidade: 'mg/dL', referencia: '< 150', classe: v => v < 150 ? ['Desejável', 'bom'] : v < 200 ? ['Limítrofe', 'atencao'] : ['Elevado', 'ruim'] },
  ldl: { nome: 'LDL-C', unidade: 'mg/dL', referencia: '< 130', classe: v => v < 130 ? ['Desejável', 'bom'] : v < 160 ? ['Limítrofe', 'atencao'] : ['Elevado', 'ruim'] },
  hdl: { nome: 'HDL-C', unidade: 'mg/dL', referencia: '> 40', classe: v => v > 40 ? ['Desejável', 'bom'] : ['Baixo', 'atencao'] }
};
function classeExame(chave, valor) {
  if (!ok(valor) || !EXAMES[chave]) return null;
  const [texto, tom] = EXAMES[chave].classe(valor);
  return { texto, tom };
}

/**
 * Resultados de uma avaliação.
 * aluno: { sexo: 'F'|'M', nascimento: 'AAAA-MM-DD' }
 * av: linha da tabela avaliacoes ({ data, peso, altura, fc_repouso, pas, pad, glicose, …, perimetros, dobras, forca }).
 * Valores ausentes viram null nos resultados que dependem deles.
 */
function calcular(aluno, av) {
  const idade = idadeEm(aluno.nascimento, av.data);
  // Peso e altura são opcionais (0.10.0): sem eles, o que depende deles fica vazio e o resto é calculado normalmente.
  const numero = x => x == null || x === '' ? null : Number(x);
  const peso = numero(av.peso), altura = numero(av.altura), alturaCm = ok(altura) ? altura * 100 : null;
  const per = av.perimetros || {}, d = {};
  DOBRAS.forEach(([k]) => { d[k] = mediaDobra((av.dobras || {})[k]); });
  const todas = DOBRAS.every(([k]) => ok(d[k]));
  const soma = (...ks) => ks.every(k => ok(d[k])) ? ks.reduce((s, k) => s + d[k], 0) : null;
  const equacaoGordura = equacaoDe(av);
  const gordura = equacaoGordura === 'petroski' ? gorduraPetroski(d, aluno.sexo, idade, peso, alturaCm) : gorduraFaulkner(d);
  const massaGorda = ok(gordura) && ok(peso) ? peso * gordura / 100 : null;
  const massaMuscular = massaMuscularLee({ alturaM: altura, sexo: aluno.sexo, idade, bracoD: per.bracoD, coxaMedD: per.coxaMedD, pantD: per.pantD, triceps: d.triceps, coxa: d.coxa, panturrilha: d.panturrilha });
  const zMuscular = ok(massaMuscular) && ok(alturaCm) ? zPhantom(massaMuscular, alturaCm, ...PHANTOM_MUSCULO, 3) : null;
  const fcMaxima = fcMaximaTanaka(idade);
  const forca = av.forca || {};
  const sup = umRM(forca.supino?.carga, forca.supino?.reps), leg = umRM(forca.leg_press?.carga, forca.leg_press?.reps);
  const outros = (Array.isArray(forca.outros) ? forca.outros : []).map(o => {
    const rm = umRM(o.carga, o.reps);
    return { nome: o.nome, carga: o.carga, reps: o.reps, rm, relativo: ok(rm) && ok(peso) ? rm / peso : null };
  });
  const zPerimetros = {}, zDobras = {};
  for (const [k, [m, s]] of Object.entries(PHANTOM_PERIMETROS)) if (ok(per[k]) && ok(alturaCm)) zPerimetros[k] = zPhantom(per[k], alturaCm, m, s);
  for (const [k, [m, s]] of Object.entries(PHANTOM_DOBRAS)) if (ok(d[k]) && ok(alturaCm)) zDobras[k] = zPhantom(d[k], alturaCm, m, s);
  return {
    idade, peso, altura, imc: ok(peso) && ok(altura) ? peso / (altura * altura) : null, dobras: d,
    somaDobras: todas ? soma(...DOBRAS.map(([k]) => k)) : null,
    dobrasPerifericas: soma('triceps', 'biceps', 'coxa', 'panturrilha'),
    dobrasCentrais: soma('subesc', 'iliaca', 'supraesp', 'abdominal'),
    gordura, equacaoGordura, classeGordura: classeGordura(gordura, aluno.sexo, idade),
    massaGorda, massaMagra: ok(massaGorda) ? peso - massaGorda : null,
    massaMuscular, zMuscular, classeMuscular: classeMassaMuscular(zMuscular),
    perimetroMuscularBraco: ok(per.bracoD) && ok(d.triceps) ? per.bracoD - Math.PI * d.triceps / 10 : null,
    fcMaxima, fcReserva: ok(av.fc_repouso) && ok(fcMaxima) ? fcMaxima - av.fc_repouso : null,
    pressao: classePressao(av.pas, av.pad),
    supino1RM: sup, supinoRelativo: ok(sup) && ok(peso) ? sup / peso : null, classeSupino: ok(sup) && ok(peso) ? classeSupino(sup / peso, aluno.sexo, idade) : null,
    legPress1RM: leg, legPressRelativo: ok(leg) && ok(peso) ? leg / peso : null, classeLegPress: ok(leg) && ok(peso) ? classeLegPress(leg / peso, aluno.sexo, idade) : null,
    outrosExercicios: outros,
    exercicios1RM: [['Supino reto', sup], ['Leg press', leg], ...outros.map(o => [o.nome, o.rm])].filter(([, rm]) => ok(rm)).map(([nome, rm]) => ({ nome, rm })),
    zonasFC: zonasFC(fcMaxima, ok(av.fc_repouso) ? Number(av.fc_repouso) : null),
    testes: calcularTestes(av.testes, aluno.sexo, idade),
    posturaAvaliada: posturaAvaliada(av.postura), alteracoesPosturais: alteracoesPosturais(av.postura), obsPostura: av.postura?.obs || null,
    zPerimetros, zDobras
  };
}

if (typeof module !== 'undefined') {
  module.exports = { POSTURA, POSTURA_OBS_MAX, alteracoesPosturais, posturaAvaliada, FLEXAO, ABDOMINAL, VO2, FLEXITESTE, MIN_FLEXITESTE_SUGERIDO, classeFlexao, classeAbdominal, vo2Cooper, classeVO2, ritmo, paceTexto, calcularTestes, ZONAS_FC, ZONAS_CARGA, zonasFC, zonaCarga, cargasPorZona, PERIMETROS, DOBRAS, EXAMES, MAX_OUTROS_EXERCICIOS, SUGESTOES_EXERCICIOS, chaveExercicio, fcMaximaTanaka, PHANTOM_PERIMETROS, PHANTOM_DOBRAS, idadeEm, mediaDobra, lerNumero, zPhantom, classeProporcao,
    classeMassaMuscular, classeGordura, gorduraFaulkner, gorduraPetroski, EQUACOES_GORDURA, equacaoDe, massaMuscularLee, umRM, classeSupino, classeLegPress, classePressao, classeExame, calcular };
}
