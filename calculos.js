/* Cálculos da avaliação física. Funções puras: recebem as medidas e devolvem os resultados.
   Nada aqui acessa a tela ou o banco; tudo é testado em tests/calculos.cjs.
   Referências: Lee et al. (2000) massa muscular; Faulkner (1968) e Petroski (1995) % de gordura; Ross e Wilson (1974)
   modelo Phantom; Epley (1985) 1RM; ACSM (1998) força no leg press; Diretriz Brasileira de Hipertensão (2020); Heyward (1991) faixas de gordura. */
'use strict';

const PERIMETROS = [['bracoD', 'Braço D'], ['bracoE', 'Braço E'], ['antD', 'Antebraço D'], ['antE', 'Antebraço E'], ['torax', 'Tórax'], ['cintura', 'Cintura'], ['abdomen', 'Abdômen'], ['quadril', 'Quadril'], ['coxaSupD', 'Coxa superior D'], ['coxaSupE', 'Coxa superior E'], ['coxaMedD', 'Coxa média D'], ['coxaMedE', 'Coxa média E'], ['pantD', 'Panturrilha D'], ['pantE', 'Panturrilha E']];
const DOBRAS = [['triceps', 'Tríceps'], ['subesc', 'Subescapular'], ['biceps', 'Bíceps'], ['iliaca', 'Suprailíaca'], ['supraesp', 'Supraespinhal'], ['abdominal', 'Abdominal'], ['coxa', 'Coxa'], ['panturrilha', 'Panturrilha']];
const ETNIAS = { branca: 0, negra: 1.1, asiatica: -2 }; // ajuste da fórmula de Lee
const ROTULO_ETNIA = { branca: 'Branca', negra: 'Negra', asiatica: 'Asiática' };

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

/** Massa muscular esquelética (kg) por Lee et al. (2000). Perímetros em cm corrigidos pelas dobras (mm). */
function massaMuscularLee({ alturaM, sexo, idade, etnia, bracoD, coxaMedD, pantD, triceps, coxa, panturrilha }) {
  if (![alturaM, idade, bracoD, coxaMedD, pantD, triceps, coxa, panturrilha].every(ok)) return null;
  const cag = bracoD - Math.PI * triceps / 10, ctg = coxaMedD - Math.PI * coxa / 10, ccg = pantD - Math.PI * panturrilha / 10;
  return alturaM * (0.00744 * cag * cag + 0.00088 * ctg * ctg + 0.00441 * ccg * ccg) + 2.4 * (sexo === 'M' ? 1 : 0) - 0.048 * idade + (ETNIAS[etnia] ?? 0) + 7.8;
}

/** 1RM estimado por Epley. Uma repetição = a própria carga. */
function umRM(carga, reps) {
  if (!ok(carga) || !ok(reps) || carga <= 0 || reps < 1) return null;
  return reps === 1 ? carga : carga * (1 + reps / 30);
}

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
 * aluno: { sexo: 'F'|'M', nascimento: 'AAAA-MM-DD', etnia }
 * av: linha da tabela avaliacoes ({ data, peso, altura, fc_repouso, pas, pad, glicose, …, perimetros, dobras, forca }).
 * Valores ausentes viram null nos resultados que dependem deles.
 */
function calcular(aluno, av) {
  const idade = idadeEm(aluno.nascimento, av.data);
  const peso = Number(av.peso), altura = Number(av.altura), alturaCm = altura * 100;
  const per = av.perimetros || {}, d = {};
  DOBRAS.forEach(([k]) => { d[k] = mediaDobra((av.dobras || {})[k]); });
  const todas = DOBRAS.every(([k]) => ok(d[k]));
  const soma = (...ks) => ks.every(k => ok(d[k])) ? ks.reduce((s, k) => s + d[k], 0) : null;
  const equacaoGordura = equacaoDe(av);
  const gordura = equacaoGordura === 'petroski' ? gorduraPetroski(d, aluno.sexo, idade, peso, alturaCm) : gorduraFaulkner(d);
  const massaGorda = ok(gordura) ? peso * gordura / 100 : null;
  const massaMuscular = massaMuscularLee({ alturaM: altura, sexo: aluno.sexo, idade, etnia: aluno.etnia, bracoD: per.bracoD, coxaMedD: per.coxaMedD, pantD: per.pantD, triceps: d.triceps, coxa: d.coxa, panturrilha: d.panturrilha });
  const zMuscular = ok(massaMuscular) ? zPhantom(massaMuscular, alturaCm, ...PHANTOM_MUSCULO, 3) : null;
  const fcMaxima = 220 - idade;
  const forca = av.forca || {};
  const sup = umRM(forca.supino?.carga, forca.supino?.reps), leg = umRM(forca.leg_press?.carga, forca.leg_press?.reps);
  const zPerimetros = {}, zDobras = {};
  for (const [k, [m, s]] of Object.entries(PHANTOM_PERIMETROS)) if (ok(per[k])) zPerimetros[k] = zPhantom(per[k], alturaCm, m, s);
  for (const [k, [m, s]] of Object.entries(PHANTOM_DOBRAS)) if (ok(d[k])) zDobras[k] = zPhantom(d[k], alturaCm, m, s);
  return {
    idade, imc: peso / (altura * altura), dobras: d,
    somaDobras: todas ? soma(...DOBRAS.map(([k]) => k)) : null,
    dobrasPerifericas: soma('triceps', 'biceps', 'coxa', 'panturrilha'),
    dobrasCentrais: soma('subesc', 'iliaca', 'supraesp', 'abdominal'),
    gordura, equacaoGordura, classeGordura: classeGordura(gordura, aluno.sexo, idade),
    massaGorda, massaMagra: ok(massaGorda) ? peso - massaGorda : null,
    massaMuscular, zMuscular, classeMuscular: classeMassaMuscular(zMuscular),
    perimetroMuscularBraco: ok(per.bracoD) && ok(d.triceps) ? per.bracoD - Math.PI * d.triceps / 10 : null,
    fcMaxima, fcReserva: ok(av.fc_repouso) ? fcMaxima - av.fc_repouso : null,
    pressao: classePressao(av.pas, av.pad),
    supino1RM: sup, supinoRelativo: ok(sup) ? sup / peso : null, classeSupino: ok(sup) ? classeSupino(sup / peso, aluno.sexo, idade) : null,
    legPress1RM: leg, legPressRelativo: ok(leg) ? leg / peso : null, classeLegPress: ok(leg) ? classeLegPress(leg / peso, aluno.sexo, idade) : null,
    zPerimetros, zDobras
  };
}

if (typeof module !== 'undefined') {
  module.exports = { PERIMETROS, DOBRAS, ETNIAS, ROTULO_ETNIA, EXAMES, PHANTOM_PERIMETROS, PHANTOM_DOBRAS, idadeEm, mediaDobra, lerNumero, zPhantom, classeProporcao,
    classeMassaMuscular, classeGordura, gorduraFaulkner, gorduraPetroski, EQUACOES_GORDURA, equacaoDe, massaMuscularLee, umRM, classeSupino, classeLegPress, classePressao, classeExame, calcular };
}
