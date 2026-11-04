// Cálculos da avaliação com casos conferidos à mão (valores esperados calculados fora do código).
const assert = require('node:assert/strict');
const C = require('../calculos.js');
const perto = (v, esperado, tol, msg) => assert.ok(Math.abs(v - esperado) <= tol, `${msg}: ${v} ≠ ${esperado}`);

// Idade na data da avaliação
assert.equal(C.idadeEm('1994-03-12', '2026-03-11'), 31, 'véspera do aniversário');
assert.equal(C.idadeEm('1994-03-12', '2026-03-12'), 32, 'no aniversário');
assert.equal(C.idadeEm('2000-02-29', '2026-02-28'), 25, 'nascido em 29/02');

// Números digitados
assert.equal(C.lerNumero('1,65'), 1.65); assert.equal(C.lerNumero(' 63.8 '), 63.8);
assert.equal(C.lerNumero(''), null); assert.ok(Number.isNaN(C.lerNumero('abc')));

// Média das dobras: duas medidas, uma só, nenhuma
perto(C.mediaDobra([22, 22.4]), 22.2, 1e-9, 'média de duas medidas');
assert.equal(C.mediaDobra([19, null]), 19); assert.equal(C.mediaDobra([]), null);

// Faulkner: 0,153 × (22 + 19 + 21 + 24) + 5,783 = 18,941
perto(C.gorduraFaulkner({ triceps: 22, subesc: 19, iliaca: 21, abdominal: 24 }), 18.941, 1e-9, 'Faulkner');
assert.equal(C.gorduraFaulkner({ triceps: 22, subesc: 19, iliaca: 21 }), null, 'falta dobra');

// Lee (2000), mulher branca, 32 anos, 1,65 m:
// CAG = 29 − π·2,2 = 22,0885; CTG = 55,6 − π·2,7 = 47,1177; CCG = 36,4 − π·1,7 = 31,0593
// 1,65 × (0,00744·487,90 + 0,00088·2220,08 + 0,00441·964,68) − 0,048·32 + 7,8 = 22,497 kg
const lee = { alturaM: 1.65, sexo: 'F', idade: 32, etnia: 'branca', bracoD: 29, coxaMedD: 55.6, pantD: 36.4, triceps: 22, coxa: 27, panturrilha: 17 };
perto(C.massaMuscularLee(lee), 22.497, 0.01, 'Lee mulher');
perto(C.massaMuscularLee({ ...lee, sexo: 'M' }) - C.massaMuscularLee(lee), 2.4, 1e-9, 'homem soma 2,4 kg');
perto(C.massaMuscularLee({ ...lee, etnia: 'negra' }) - C.massaMuscularLee(lee), 1.1, 1e-9, 'etnia negra soma 1,1 kg');
perto(C.massaMuscularLee({ ...lee, etnia: 'asiatica' }) - C.massaMuscularLee(lee), -2, 1e-9, 'etnia asiática tira 2 kg');
assert.equal(C.massaMuscularLee({ ...lee, pantD: null }), null, 'falta perímetro');

// Phantom: cintura 71 cm, 1,65 m → (71 · 170,18/165 − 71,91)/4,45 = 0,296
perto(C.zPhantom(71, 165, 71.91, 4.45), 0.296, 0.001, 'Phantom linear');
// massa ao cubo: 22,497 · (170,18/165)³ = 24,682 → (24,682 − 25,55)/2,99 = −0,290
perto(C.zPhantom(22.497, 165, 25.55, 2.99, 3), -0.290, 0.002, 'Phantom de massa ao cubo');
assert.equal(C.classeProporcao(0.3).texto, 'Na média'); assert.equal(C.classeProporcao(2.5).texto, 'Bem acima');
assert.equal(C.classeProporcao(-1.5).texto, 'Abaixo'); assert.equal(C.classeProporcao(null), null);
assert.equal(C.classeMassaMuscular(-0.29).texto, 'Volume muscular adequado');
assert.equal(C.classeMassaMuscular(2.1).texto, 'Ótimo volume muscular');
assert.equal(C.classeMassaMuscular(-3.2).texto, 'Déficit muscular severo');

// 1RM por Epley: 38 kg × 8 → 38 · (1 + 8/30) = 48,133
perto(C.umRM(38, 8), 48.1333, 0.001, 'Epley'); assert.equal(C.umRM(100, 1), 100, 'uma repetição');
assert.equal(C.umRM(null, 8), null); assert.equal(C.umRM(40, 0), null);

// Força relativa no supino (mulher 32 anos: Excelente acima de 0,70)
assert.equal(C.classeSupino(0.7545, 'F', 32).texto, 'Excelente');
assert.equal(C.classeSupino(0.55, 'F', 32).texto, 'Médio');
assert.equal(C.classeSupino(0.40, 'F', 32).texto, 'Muito fraco');
assert.equal(C.classeSupino(1.2, 'M', 25).texto, 'Muito bom');
assert.equal(C.classeSupino(1.0, 'M', 17).texto, 'Fraco');

// Faixas de gordura: sempre uma classe, sem buracos (a planilha devolvia FALSO em alguns casos)
assert.equal(C.classeGordura(18.9, 'F', 32).texto, 'Ótimo');
assert.equal(C.classeGordura(36, 'F', 32).texto, 'Muito elevado');
assert.equal(C.classeGordura(5, 'M', 18).texto, 'Muito baixo', 'menores de 20 usam a faixa 20-29');
assert.equal(C.classeGordura(20, 'M', 75).texto, 'Ótimo', '60+: até 22,1%');
for (const sexo of ['F', 'M']) for (let idade = 15; idade <= 80; idade += 5) for (let p = 3; p <= 50; p += 0.1)
  assert.ok(C.classeGordura(p, sexo, idade)?.texto, `sem classe: ${sexo} ${idade} ${p}`);

// Pressão arterial (Diretriz 2020): vale a pior das duas
assert.equal(C.classePressao(116, 76).texto, 'Ótima');
assert.equal(C.classePressao(125, 82).texto, 'Normal');
assert.equal(C.classePressao(130, 79).texto, 'Pré-hipertensão');
assert.equal(C.classePressao(125, 90).texto, 'Hipertensão estágio 1');
assert.equal(C.classePressao(165, 80).texto, 'Hipertensão estágio 2');
assert.equal(C.classePressao(180, 70).texto, 'Hipertensão estágio 3');
assert.equal(C.classePressao(120, null), null);

// Exames
assert.equal(C.classeExame('glicose', 99).texto, 'Normal'); assert.equal(C.classeExame('glicose', 126).texto, 'Elevada');
assert.equal(C.classeExame('hdl', 40).texto, 'Baixo'); assert.equal(C.classeExame('ldl', null), null);

// Avaliação completa (formato da tabela avaliacoes)
const aluna = { sexo: 'F', nascimento: '1994-03-12', etnia: 'branca' };
const av = {
  data: '2026-10-14', peso: '63.80', altura: '1.65', fc_repouso: 66, pas: 116, pad: 76,
  perimetros: { bracoD: 29, cintura: 71, coxaMedD: 55.6, pantD: 36.4 },
  dobras: { triceps: [22, 22], subesc: [19, null], biceps: [9], iliaca: [21, 21], supraesp: [12, 12], abdominal: [24, 24], coxa: [27, 27], panturrilha: [17, 17] },
  forca: { supino: { carga: 38, reps: 8 } }
};
const r = C.calcular(aluna, av);
assert.equal(r.idade, 32);
perto(r.imc, 63.8 / (1.65 * 1.65), 1e-9, 'IMC');
perto(r.gordura, 18.941, 1e-9, 'gordura'); assert.equal(r.classeGordura.texto, 'Ótimo');
perto(r.massaGorda, 63.8 * 0.18941, 1e-9, 'massa gorda'); perto(r.massaMagra, 63.8 - 63.8 * 0.18941, 1e-9, 'massa magra (kg, sem misturar %)');
perto(r.massaMuscular, 22.497, 0.01, 'massa muscular');
assert.equal(r.somaDobras, 22 + 19 + 9 + 21 + 12 + 24 + 27 + 17);
assert.equal(r.dobrasPerifericas, 22 + 9 + 27 + 17); assert.equal(r.dobrasCentrais, 19 + 21 + 12 + 24);
assert.equal(r.fcMaxima, 188); assert.equal(r.fcReserva, 122);
assert.equal(r.pressao.texto, 'Ótima');
perto(r.supino1RM, 48.1333, 0.001, '1RM'); assert.equal(r.classeSupino.texto, 'Excelente');
assert.equal(r.legPress1RM, null, 'leg press não medido');
perto(r.zPerimetros.cintura, 0.296, 0.001, 'Z da cintura');
assert.equal(r.zPerimetros.torax, undefined, 'tórax não medido');

// Avaliação sem dobras: nada quebra, resultados dependentes ficam vazios
const parcial = C.calcular(aluna, { data: '2026-10-14', peso: 63.8, altura: 1.65, perimetros: {}, dobras: {}, forca: {} });
assert.equal(parcial.gordura, null); assert.equal(parcial.massaMuscular, null); assert.equal(parcial.somaDobras, null);
assert.equal(parcial.classeGordura, null); assert.equal(parcial.pressao, null);

console.log('Cálculos aprovados: idade, Faulkner, Lee, Phantom, Epley, força, faixas de gordura, pressão e exames.');
