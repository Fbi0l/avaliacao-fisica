// Fichas de treino (1.1.0): divisão livre, validação da ficha, treino sugerido, frequência e cargas anotadas.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const T = require('../treino.js');
const K = require('../calculos.js');

// As chaves aceitas pelo banco são as mesmas do app.
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', fs.readdirSync(path.join(__dirname, '..', 'supabase', 'migrations')).find(f => /_fichas_treino\.sql$/.test(f))), 'utf8');
const lista = re => (sql.match(re) || [])[1].split(',').map(x => x.trim().replace(/'/g, '')).sort();
assert.deepEqual(lista(/objetivo in \(([^)]+)\)/), Object.keys(T.OBJETIVOS).sort(), 'objetivos iguais aos do banco');
assert.deepEqual(lista(/divisao in \(([^)]+)\)/), Object.keys(T.DIVISOES).sort(), 'divisões iguais às do banco');
assert.deepEqual(lista(/\(ex->>'grupo'\) not in \(([^)]+)\)/), T.GRUPOS.map(g => g[0]).sort(), 'grupos iguais aos do banco');
assert.ok(T.EXERCICIOS.every(e => T.NOME_GRUPO[e.grupo]), 'todo exercício da lista tem grupo válido');
assert.equal(new Set(T.EXERCICIOS.map(e => e.nome)).size, T.EXERCICIOS.length, 'lista sem repetidos');

// Trocar a divisão não perde exercícios
{
  const sup = { nome: 'Supino reto', grupo: 'peito' };
  let t = T.trocarDivisao([], 'abc');
  assert.deepEqual(t.map(x => x.nome), ['A · Peito e tríceps', 'B · Costas e bíceps', 'C · Pernas e ombros']);
  t[2].exercicios.push(sup);
  const ab = T.trocarDivisao(t, 'ab');
  assert.equal(ab.length, 3, 'o 3º treino tem exercício: fica');
  assert.deepEqual(ab[2].exercicios, [sup]);
  assert.equal(ab[0].nome, 'A · Superior');
  assert.equal(T.trocarDivisao([{ nome: 'X', exercicios: [] }, { nome: 'Y', exercicios: [] }], 'corpo').length, 1, 'treinos vazios saem');
}

// Montar a ficha
{
  const r = T.rascunhoDaFicha(null, '2026-11-10');
  assert.equal(r.divisao, 'ab');
  assert.match(T.montarFicha(r).erro, /pelo menos um exercício/);
  r.treinos[0].exercicios.push({ nome: ' Supino reto ', grupo: 'peito', series: '4', reps: '8–10', carga: '27,5', descanso: '90', obs: '' }, { nome: '', series: '3' });
  const ok = T.montarFicha(r);
  assert.ok(ok.dados, ok.erro);
  assert.deepEqual(ok.dados.treinos[0].exercicios, [{ nome: 'Supino reto', grupo: 'peito', series: 4, reps: '8–10', carga: 27.5, descanso: 90 }], 'linha sem nome é ignorada, números convertidos');
  assert.equal(ok.dados.semanas, 6);
  assert.equal(ok.dados.vezes_semana, 4);
  const mau = (mudar, re) => { const x = structuredClone(r); mudar(x); assert.match(T.montarFicha(x).erro || '', re); };
  mau(x => { x.treinos[0].exercicios[0].series = '2,5'; }, /Séries/);
  mau(x => { x.treinos[0].exercicios[0].series = '30'; }, /Séries/);
  mau(x => { x.treinos[0].exercicios[0].carga = 'muito'; }, /Carga/);
  mau(x => { x.treinos[0].exercicios[0].descanso = '1000'; }, /Descanso/);
  mau(x => { x.treinos[1].nome = x.treinos[0].nome.toUpperCase(); }, /dois treinos/);
  mau(x => { x.treinos[1].nome = '  '; }, /nome ao treino 2/);
  mau(x => { x.semanas = '60'; }, /1 a 52/);
  mau(x => { x.vezes_semana = '8'; }, /1 a 7/);
  mau(x => { x.divisao = 'xyz'; }, /dividir/);
  mau(x => { x.treinos = []; }, /pelo menos um treino/);
  const volta = T.rascunhoDaFicha({ ...ok.dados, id: 'f' }, '2026-11-10');
  assert.deepEqual(T.montarFicha(volta).dados, ok.dados, 'ida e volta pelo rascunho mantém a ficha');
}

// Treino sugerido, semana, frequência e cargas
{
  const ficha = { id: 'f1', inicio: '2026-11-02', semanas: 6, vezes_semana: 4, treinos: [{ nome: 'A', exercicios: [{ nome: 'Supino reto', carga: 27 }] }, { nome: 'B', exercicios: [{ nome: 'Leg press', carga: 120 }, { nome: 'Agachamento' }] }] };
  assert.equal(T.proximoTreino(ficha, []), 0, 'sem treino feito: o primeiro');
  const feitos = [
    { ficha_id: 'f1', treino: 0, data: '2026-11-02', exercicios: { 0: { feito: true, carga: 25 } } },
    { ficha_id: 'f1', treino: 1, data: '2026-11-03', exercicios: { 0: { feito: true, carga: 130 } } },
    { ficha_id: 'f1', treino: 0, data: '2026-11-05', exercicios: { 0: { feito: true, carga: 26 } } },
    { ficha_id: 'f1', treino: 1, data: '2026-11-09', exercicios: { 1: { feito: true } } },
    { ficha_id: 'outra', treino: 0, data: '2026-11-10', exercicios: {} }
  ];
  assert.equal(T.proximoTreino(ficha, feitos), 0, 'depois do B vem o A de novo');
  assert.equal(T.proximoTreino(ficha, feitos.slice(0, 3)), 1);
  assert.deepEqual(T.semanaDaFicha(ficha, '2026-11-09'), { semana: 2, comecou: true, terminou: false });
  assert.equal(T.semanaDaFicha(ficha, '2026-12-20').terminou, true);
  assert.equal(T.semanaDaFicha(ficha, '2026-11-01').comecou, false);
  const fr = T.frequencia(ficha, feitos, '2026-11-09');
  assert.equal(fr.total, 4, 'só os da ficha');
  assert.equal(fr.ultimo, '2026-11-09');
  assert.deepEqual(fr.porSemana.map(s => s.total), [3, 1]);
  assert.deepEqual(fr.porSemana[0].dias[0], [0], 'segunda da semana 1: treino A');
  assert.equal(fr.meta, Math.round(4 / (4 * 8 / 7) * 100), 'meta proporcional aos dias passados');
  const cg = T.cargasAnotadas(ficha, feitos);
  assert.deepEqual(cg.map(c => [c.nome, c.usada, c.dif]), [['Supino reto', 26, -1], ['Leg press', 130, 10]], 'última carga anotada de cada exercício');
}

// Sugestão de carga pelo 1RM da avaliação
{
  const s = T.sugestaoCarga('supino  RETO', 'hipertrofia', [{ nome: 'Supino reto', rm: 48 }], K.chaveExercicio);
  assert.equal(s.rm, 48);
  assert.equal(s.de, 32, '67% de 48 ≈ 32');
  assert.equal(s.ate, 41, '85% de 48 ≈ 41');
  assert.equal(s.pct(27), 56);
  assert.equal(T.sugestaoCarga('Rosca direta', 'hipertrofia', [{ nome: 'Supino reto', rm: 48 }], K.chaveExercicio), null);
  assert.equal(T.prescricao({ series: 4, reps: '8–10', carga: 27.5, descanso: 90 }), '4 × 8–10 · 27,5 kg · 90 s');
  assert.equal(T.prescricao({ reps: '12', descanso: 120 }), '12 · 2 min');
}
console.log('Treino aprovado: divisão livre, ficha conferida, chaves iguais às do banco, treino sugerido, frequência, cargas e 1RM.');
