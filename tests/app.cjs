// Regras puras do app.js: rotas, convite, inatividade e conversão do formulário da avaliação.
const assert = require('node:assert/strict');
const A = require('../app.js');
const { TERMO_VERSAO } = { TERMO_VERSAO: '2026-11-04' };

assert.equal(A.TERMO_VERSAO, TERMO_VERSAO, 'mesma versão do termo que a função registrar-aluno');
assert.equal(A.hojeISO(new Date(2026, 0, 5)), '2026-01-05');
assert.equal(A.fmt(1234.5), '1.234,5'); assert.equal(A.fmt(null), '—'); assert.equal(A.fmt(2, 0), '2');

// Convite
const COD = 'Mz_8yaX_GmVI_JUiP_9-3DMYTZu0hAym30Qxs0yo0-A';
assert.equal(A.codigoDoLink('?convite=' + COD), COD);
for (const ruim of ['', '?convite=curto', '?convite=' + COD + 'x', '?outro=' + COD]) assert.equal(A.codigoDoLink(ruim), null);
assert.equal(A.linkConvite('https://fbi0l.github.io/avaliacao-fisica/?x=1#aluno', COD), 'https://fbi0l.github.io/avaliacao-fisica/?convite=' + COD);

// Inatividade
assert.equal(A.expirouPorInatividade(String(Date.now() - 31 * 60e3), Date.now()), true);
assert.equal(A.expirouPorInatividade(String(Date.now() - 5 * 60e3), Date.now()), false);
assert.equal(A.expirouPorInatividade(null, Date.now()), false);

// Rotas
const ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
assert.deepEqual(A.lerRota('#aluno-' + ID), { tela: 'aluno', id: ID, aba: 'avaliacoes' });
assert.deepEqual(A.lerRota('#aluno-' + ID + '-evolucao'), { tela: 'aluno', id: ID, aba: 'evolucao' });
assert.deepEqual(A.lerRota('#av-' + ID), { tela: 'avaliacao', id: ID });
assert.deepEqual(A.lerRota('#nova-' + ID), { tela: 'nova', id: ID });
assert.deepEqual(A.lerRota('#editar-' + ID), { tela: 'editar', id: ID });
for (const ruim of ['', '#', '#aluno-123', '#av-' + ID + 'x', '#<script>']) assert.deepEqual(A.lerRota(ruim), { tela: 'inicio' });

// Formulário → registro do banco
const r = A.rascunhoVazio('2026-10-14', 1.65);
assert.equal(r.altura, '1,65');
Object.assign(r, { peso: '63,8', fc_repouso: '66', pas: '116', pad: '76', glicose: '89' });
r.per.bracoD = '29'; r.per.cintura = '71,04';
r.dob1.triceps = '22'; r.dob2.triceps = '22,4'; r.dob1.subesc = '19';
r.supC = '38'; r.supR = '8'; r.parecer = '  Boa evolução.  ';
let { registro, erros } = A.montarAvaliacao(r, '2026-11-04');
assert.deepEqual(erros, []);
assert.deepEqual(registro, {
  data: '2026-10-14', peso: 63.8, altura: 1.65, fc_repouso: 66, pas: 116, pad: 76, glicose: 89, triglicerideos: null, ldl: null, hdl: null,
  perimetros: { bracoD: 29, cintura: 71 }, dobras: { triceps: [22, 22.4], subesc: [19] }, forca: { supino: { carga: 38, reps: 8 } }, parecer: 'Boa evolução.'
});
// Altura digitada em centímetros vira metros
assert.equal(A.montarAvaliacao({ ...A.rascunhoVazio('2026-10-14'), peso: '70', altura: '172' }, '2026-11-04').registro.altura, 1.72);
// Erros com mensagem clara
const erro = (extra, re) => { const e = A.montarAvaliacao({ ...A.rascunhoVazio('2026-10-14', 1.7), peso: '70', ...extra }, '2026-11-04').erros; assert.ok(e.some(m => re.test(m)), `${JSON.stringify(extra)} → ${e}`); };
erro({ peso: '' }, /Peso/); erro({ altura: '3' }, /Altura/); erro({ data: '2027-01-01' }, /futura/);
erro({ pas: '120' }, /duas medidas/); erro({ pas: '80', pad: '90' }, /menor que a sistólica/);
erro({ per: { cintura: '900' } }, /Cintura/); erro({ dob1: { triceps: 'abc' } }, /Tríceps/); erro({ dob2: { coxa: '20' } }, /1ª medida/);
erro({ supC: '40' }, /Supino: preencha/); erro({ legC: '100', legR: '2,5' }, /Leg press: repetições/); erro({ parecer: 'x'.repeat(4001) }, /4000/);

// Editar: rascunho a partir do salvo e de volta dá o mesmo registro
const ida = A.montarAvaliacao(A.rascunhoDe({ ...registro }), '2026-11-04');
assert.deepEqual(ida.erros, []); assert.deepEqual(ida.registro, registro);

// Sentido da mudança
assert.equal(A.sentido(-2, -1), 'bom'); assert.equal(A.sentido(2, -1), 'ruim'); assert.equal(A.sentido(2, 0), 'neutro'); assert.equal(A.sentido(0.01, 1), 'neutro');
console.log('App aprovado: convite, inatividade, rotas e formulário da avaliação.');
