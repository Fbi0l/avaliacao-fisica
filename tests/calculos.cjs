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

// Lee (2000), mulher, 32 anos, 1,65 m (sem ajuste por etnia: valor neutro):
// CAG = 29 − π·2,2 = 22,0885; CTG = 55,6 − π·2,7 = 47,1177; CCG = 36,4 − π·1,7 = 31,0593
// 1,65 × (0,00744·487,90 + 0,00088·2220,08 + 0,00441·964,68) − 0,048·32 + 7,8 = 22,497 kg
const lee = { alturaM: 1.65, sexo: 'F', idade: 32, bracoD: 29, coxaMedD: 55.6, pantD: 36.4, triceps: 22, coxa: 27, panturrilha: 17 };
perto(C.massaMuscularLee(lee), 22.497, 0.01, 'Lee mulher');
perto(C.massaMuscularLee({ ...lee, sexo: 'M' }) - C.massaMuscularLee(lee), 2.4, 1e-9, 'homem soma 2,4 kg');
perto(C.massaMuscularLee({ ...lee, etnia: 'negra' }), C.massaMuscularLee(lee), 1e-9, 'etnia não muda mais o resultado (retirada em 0.5.0)');
assert.equal(C.ETNIAS, undefined, 'etnia não existe mais nos cálculos');
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
// Pressão baixa não é "Ótima": abaixo de 90/60 vira alerta de hipotensão
assert.deepEqual(C.classePressao(60, 30), { texto: 'Baixa (hipotensão)', tom: 'atencao' });
assert.equal(C.classePressao(89, 70).texto, 'Baixa (hipotensão)');
assert.equal(C.classePressao(110, 59).texto, 'Baixa (hipotensão)');
assert.equal(C.classePressao(90, 60).texto, 'Ótima', 'no limite ainda é ótima');
assert.equal(C.classePressao(150, 55).texto, 'Hipertensão estágio 1', 'hipertensão vence a diastólica baixa');

// Exames
assert.equal(C.classeExame('glicose', 99).texto, 'Normal'); assert.equal(C.classeExame('glicose', 126).texto, 'Elevada');
assert.equal(C.classeExame('hdl', 40).texto, 'Baixo'); assert.equal(C.classeExame('ldl', null), null);

// Avaliação completa (formato da tabela avaliacoes)
const aluna = { sexo: 'F', nascimento: '1994-03-12', };
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
// FC máxima por Tanaka (2001): 208 − 0,7 × 32 = 185,6 → 186; reserva 186 − 66 = 120
assert.equal(r.fcMaxima, 186); assert.equal(r.fcReserva, 120);
assert.equal(C.fcMaximaTanaka(20), 194); assert.equal(C.fcMaximaTanaka(60), 166); assert.equal(C.fcMaximaTanaka(null), null);
assert.deepEqual(r.outrosExercicios, [], 'sem outros exercícios');
assert.equal(r.pressao.texto, 'Ótima');
perto(r.supino1RM, 48.1333, 0.001, '1RM'); assert.equal(r.classeSupino.texto, 'Excelente');
assert.equal(r.legPress1RM, null, 'leg press não medido');
perto(r.zPerimetros.cintura, 0.296, 0.001, 'Z da cintura');
assert.equal(r.zPerimetros.torax, undefined, 'tórax não medido');

// Avaliação sem dobras: nada quebra, resultados dependentes ficam vazios
const parcial = C.calcular(aluna, { data: '2026-10-14', peso: 63.8, altura: 1.65, perimetros: {}, dobras: {}, forca: {} });
assert.equal(parcial.gordura, null); assert.equal(parcial.massaMuscular, null); assert.equal(parcial.somaDobras, null);
assert.equal(parcial.classeGordura, null); assert.equal(parcial.pressao, null);

// Petroski (1995): conferido à mão. Mulher 30 anos, 60 kg, 165 cm, Σ4 = 60 mm → densidade 1,0461838 → 23,15 %.
{
  const d4 = n => ({ subesc: n, triceps: n, iliaca: n, panturrilha: n });
  assert.ok(Math.abs(C.gorduraPetroski(d4(15), 'F', 30, 60, 165) - 23.15) < 0.01);
  // Homem 30 anos, Σ4 = 50 mm → densidade 1,0594402 → 17,23 % (peso e altura não entram)
  assert.ok(Math.abs(C.gorduraPetroski(d4(12.5), 'M', 30) - 17.23) < 0.01);
  assert.equal(C.gorduraPetroski({ ...d4(15), panturrilha: null }, 'M', 30), null, 'falta a panturrilha');
  assert.equal(C.gorduraPetroski(d4(15), 'F', 30, null, 165), null, 'mulher sem peso');
  assert.ok(C.gorduraPetroski(d4(20), 'M', 30) > C.gorduraPetroski(d4(10), 'M', 30), 'mais dobra, mais gordura');
  // Escolha por avaliação; sem escolha (avaliações antigas), Faulkner
  const aluna = { sexo: 'F', nascimento: '1996-01-01', };
  const av = { data: '2026-01-02', peso: 60, altura: 1.65, perimetros: {}, dobras: { subesc: [15], triceps: [15], iliaca: [15], panturrilha: [15], abdominal: [20] } };
  assert.equal(C.calcular(aluna, av).equacaoGordura, 'faulkner');
  assert.ok(Math.abs(C.calcular(aluna, av).gordura - (0.153 * 65 + 5.783)) < 1e-9);
  const rp = C.calcular(aluna, { ...av, equacao_gordura: 'petroski' });
  assert.equal(rp.equacaoGordura, 'petroski'); assert.ok(Math.abs(rp.gordura - 23.15) < 0.01);
  assert.ok(rp.classeGordura?.texto, 'Petroski também recebe classificação');
  assert.equal(C.equacaoDe({ equacao_gordura: 'xyz' }), 'faulkner');
}
// Leg press (ACSM 1998): limites inferiores, por sexo e faixa de idade
assert.equal(C.classeLegPress(2.08, 'M', 25).texto, 'Excelente');
assert.equal(C.classeLegPress(2.07, 'M', 25).texto, 'Bom');
assert.equal(C.classeLegPress(1.90, 'M', 25).texto, 'Médio');
assert.equal(C.classeLegPress(1.70, 'M', 25).texto, 'Regular');
assert.equal(C.classeLegPress(1.64, 'M', 25).texto, 'Fraco');
assert.equal(C.classeLegPress(1.64, 'M', 65).texto, 'Excelente', 'mesma força vale mais aos 65');
assert.equal(C.classeLegPress(1.40, 'F', 35).texto, 'Bom');
assert.equal(C.classeLegPress(0.80, 'F', 55).texto, 'Fraco');
assert.equal(C.classeLegPress(2.2, 'M', 17).texto, 'Excelente', 'menor de 20 usa 20-29');
assert.equal(C.classeLegPress(null, 'M', 30), null);
for (const sexo of ['M', 'F']) for (const idade of [18, 25, 35, 45, 55, 70]) for (const r of [0.3, 0.9, 1.2, 1.5, 1.8, 2.5])
  assert.ok(C.classeLegPress(r, sexo, idade)?.texto, `sem classe: ${sexo} ${idade} ${r}`);
// Outros exercícios do teste de força: 1RM e 1RM ÷ peso, sem classificação
{
  const ro = C.calcular(aluna, { ...av, forca: { ...av.forca, outros: [{ nome: 'Agachamento livre', carga: 60, reps: 6 }, { nome: 'Rosca direta', carga: 14, reps: 1 }] } });
  assert.equal(ro.outrosExercicios.length, 2);
  perto(ro.outrosExercicios[0].rm, 72, 1e-9, 'Epley no agachamento: 60 × (1 + 6/30)');
  perto(ro.outrosExercicios[0].relativo, 72 / 63.8, 1e-9, '1RM ÷ peso');
  assert.equal(ro.outrosExercicios[1].rm, 14, 'uma repetição = a própria carga');
  perto(ro.supino1RM, 48.1333, 0.001, 'supino continua igual');
  assert.equal(C.chaveExercicio('  Agachamento   LIVRE '), 'agachamento livre');
  assert.equal(C.chaveExercicio('Rosca  Diréta'), C.chaveExercicio('rosca direta'), 'compara sem acento nem maiúscula');
  assert.deepEqual(C.calcular(aluna, { ...av, forca: { outros: 'x' } }).outrosExercicios, [], 'formato inválido não quebra');
}
// Zonas de FC: Karvonen com repouso; sem repouso, % da FC máxima
{
  const k = C.zonasFC(186, 66);
  assert.equal(k.metodo, 'karvonen');
  assert.deepEqual(k.zonas.map(z => [z.min, z.max]), [[126, 138], [138, 150], [150, 162], [162, 174], [174, 186]], '66 + 120 × %');
  const m = C.zonasFC(186, null);
  assert.equal(m.metodo, 'fcmax');
  assert.deepEqual(m.zonas.map(z => [z.min, z.max]), [[93, 112], [112, 130], [130, 149], [149, 167], [167, 186]]);
  assert.equal(C.zonasFC(186, 190).metodo, 'fcmax', 'repouso acima da máxima não usa Karvonen');
  assert.equal(C.zonasFC(null, 60), null);
  assert.equal(r.zonasFC.metodo, 'karvonen', 'avaliação com FC de repouso');
  assert.equal(r.zonasFC.zonas[4].max, 186);
}
// Zonas de carga por % do 1RM
{
  assert.equal(C.zonaCarga(60, 100).chave, 'resistencia'); assert.equal(C.zonaCarga(66.9, 100).chave, 'resistencia');
  assert.equal(C.zonaCarga(67, 100).chave, 'hipertrofia'); assert.equal(C.zonaCarga(80, 100).chave, 'hipertrofia');
  assert.equal(C.zonaCarga(85, 100).chave, 'forca'); assert.equal(C.zonaCarga(110, 100).chave, 'forca', 'acima do 1RM ainda é força');
  perto(C.zonaCarga(80, 100).pct, 80, 1e-9, '% do 1RM');
  assert.equal(C.zonaCarga(null, 100), null); assert.equal(C.zonaCarga(10, 0), null);
  assert.deepEqual(C.cargasPorZona(100).map(z => [z.min, z.max]), [[null, 67], [67, 85], [85, 100]]);
  assert.deepEqual(C.cargasPorZona(48.13).map(z => [z.min, z.max]), [[null, 32], [32, 41], [41, 48]], 'arredonda de 0,5 em 0,5 kg');
  assert.equal(C.cargasPorZona(null), null);
  assert.deepEqual(r.exercicios1RM.map(e => e.nome), ['Supino reto'], 'só exercícios testados');
}
// Testes físicos: tabelas conferidas em 09/11/2026 (CSEP-PATH 2019, Pollock e Wilmore 1993, Cooper Institute)
{
  // Flexão (CSEP): homem 20-29 → Excelente ≥36, Muito bom 29-35, Bom 22-28, Regular 17-21, Precisa melhorar ≤16
  for (const [n, t] of [[36, 'Excelente'], [35, 'Muito bom'], [29, 'Muito bom'], [28, 'Bom'], [22, 'Bom'], [21, 'Regular'], [17, 'Regular'], [16, 'Precisa melhorar'], [0, 'Precisa melhorar']])
    assert.equal(C.classeFlexao(n, 'M', 25).texto, t, `flexão homem 25 anos, ${n}`);
  // Mulher 50-59 (joelhos): ≥21, 11-20, 7-10, 2-6, ≤1
  for (const [n, t] of [[21, 'Excelente'], [11, 'Muito bom'], [10, 'Bom'], [7, 'Bom'], [6, 'Regular'], [2, 'Regular'], [1, 'Precisa melhorar']])
    assert.equal(C.classeFlexao(n, 'F', 55).texto, t, `flexão mulher 55 anos, ${n}`);
  assert.equal(C.classeFlexao(39, 'M', 16).texto, 'Excelente', '15-19'); assert.equal(C.classeFlexao(38, 'M', 16).texto, 'Muito bom');
  assert.equal(C.classeFlexao(18, 'M', 75).texto, 'Excelente', '70+ usa 60-69'); assert.equal(C.classeFlexao(null, 'M', 30), null);
  // Abdominal 1 min (Pollock e Wilmore): homem 15-19 → ≥48, 42-47, 38-41, 33-37, ≤32
  for (const [n, t] of [[48, 'Excelente'], [47, 'Acima da média'], [42, 'Acima da média'], [41, 'Média'], [38, 'Média'], [37, 'Abaixo da média'], [33, 'Abaixo da média'], [32, 'Fraco']])
    assert.equal(C.classeAbdominal(n, 'M', 18).texto, t, `abdominal homem 18 anos, ${n}`);
  // Mulher 20-29: ≥36, 31-35, 25-30, 21-24, ≤20
  for (const [n, t] of [[36, 'Excelente'], [31, 'Acima da média'], [30, 'Média'], [25, 'Média'], [24, 'Abaixo da média'], [21, 'Abaixo da média'], [20, 'Fraco']])
    assert.equal(C.classeAbdominal(n, 'F', 25).texto, t, `abdominal mulher 25 anos, ${n}`);
  // Tabelas sem buracos nem degraus invertidos: limites caem do melhor para o pior em toda coluna
  for (const tab of [C.FLEXAO, C.ABDOMINAL, C.VO2]) for (const sexo of ['M', 'F']) for (let col = 0; col < 6; col++)
    for (let i = 1; i < 4; i++) assert.ok(tab[sexo][i][col] < tab[sexo][i - 1][col], `limites em ordem ${sexo} ${col} ${i}`);
  // Cooper: VO2 = (d − 504,9) / 44,73 → 2400 m = 42,37
  perto(C.vo2Cooper(2400), 42.3675, 0.001, 'VO2 do Cooper'); assert.equal(C.vo2Cooper(400), null, 'distância curta demais');
  // Cooper Institute, homem 30-39: Superior ≥54, Excelente ≥48,3, Bom ≥44, Razoável ≥40,5, Fraco abaixo
  for (const [v, t] of [[54, 'Superior'], [53.9, 'Excelente'], [48.3, 'Excelente'], [44, 'Bom'], [40.5, 'Razoável'], [40.4, 'Fraco']])
    assert.equal(C.classeVO2(v, 'M', 35).texto, t, `VO2 homem 35, ${v}`);
  assert.equal(C.classeVO2(49.6, 'F', 18).texto, 'Superior', 'abaixo de 20 usa 20-29'); assert.equal(C.classeVO2(36.7, 'F', 85).texto, 'Superior', '80+ usa 70-79');
  // Ritmo
  assert.deepEqual(C.ritmo(4000, 30), { pace: 7.5, kmh: 8 }); assert.equal(C.paceTexto(7.5), '7:30 /km'); assert.equal(C.paceTexto(4.999), '5:00 /km');
  assert.equal(C.ritmo(0, 10), null);
  // Flexiteste: 20 movimentos, I a XX
  assert.equal(C.FLEXITESTE.length, 20); assert.deepEqual(C.FLEXITESTE.map(m => m[0]).slice(0, 4), ['I', 'II', 'III', 'IV']); assert.equal(C.FLEXITESTE[19][0], 'XX');
  // Tudo junto, na avaliação
  const rt = C.calcular(aluna, { ...av, testes: { flexao: 20, abdominal: 25, aerobico: { tipo: 'cooper', distancia: 2050, fc_final: 176 }, flexiteste: { IV: 3, I: 2 } } });
  assert.equal(rt.testes.classeFlexao.texto, 'Muito bom', 'mulher 32 anos, 20 flexões'); assert.equal(rt.testes.classeAbdominal.texto, 'Acima da média');
  perto(rt.testes.vo2, (2050 - 504.9) / 44.73, 1e-9, 'VO2'); assert.equal(rt.testes.aerobico.tempo, 12); assert.equal(rt.testes.aerobico.fcFinal, 176);
  assert.deepEqual(rt.testes.flexiteste.map(m => m.chave), ['I', 'IV'], 'na ordem do teste'); assert.equal(rt.testes.somaFlexiteste, 5); assert.equal(rt.testes.flexindice, null);
  const todos = Object.fromEntries(C.FLEXITESTE.map(([k]) => [k, 2]));
  assert.equal(C.calcularTestes({ flexiteste: todos }, 'M', 30).flexindice, 40, 'com os 20, Flexíndice');
  const livre = C.calcularTestes({ aerobico: { tipo: 'livre', distancia: 4000, tempo: 30 } }, 'M', 30);
  assert.equal(livre.vo2, null, 'livre não estima VO2'); assert.equal(livre.aerobico.kmh, 8);
  const vazio = C.calcularTestes(undefined, 'M', 30);
  assert.equal(vazio.flexao, null); assert.equal(vazio.aerobico, null); assert.deepEqual(vazio.flexiteste, []);
}
// Avaliação postural
{
  assert.equal(C.POSTURA.length, 3); assert.equal(C.POSTURA.flatMap(([, g]) => g).length, 15, '15 itens');
  const chaves = C.POSTURA.flatMap(([, g]) => g.map(([k]) => k)); assert.equal(new Set(chaves).size, chaves.length, 'chaves sem repetir');
  assert.equal(C.posturaAvaliada({}), false); assert.equal(C.posturaAvaliada(undefined), false); assert.equal(C.posturaAvaliada({ itens: {} }), true);
  const alt = C.alteracoesPosturais({ itens: { calcaneos: 'varo', cabeca_lateral: 'direita', lombar: 'inventado' } });
  assert.deepEqual(alt.map(a => [a.vista, a.chave]), [['Anterior', 'cabeca_lateral'], ['Posterior', 'calcaneos']], 'na ordem do checklist; valor desconhecido some');
  const rp = C.calcular(aluna, { ...av, postura: { itens: {}, obs: 'ok' } });
  assert.equal(rp.posturaAvaliada, true); assert.deepEqual(rp.alteracoesPosturais, []); assert.equal(rp.obsPostura, 'ok');
  assert.equal(C.calcular(aluna, av).posturaAvaliada, false, 'avaliação antiga');
}
console.log('Cálculos aprovados: idade, Faulkner, Petroski, Lee, Phantom, Epley, força (inclusive outros exercícios), FC máxima de Tanaka, zonas de FC e de carga, testes físicos (flexão, abdominal, Cooper, flexiteste), avaliação postural, faixas de gordura, pressão e exames.');
