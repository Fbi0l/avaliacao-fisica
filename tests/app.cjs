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
// Convite de personal: outro parâmetro no link, o mesmo formato de código, e o termo igual ao da função
assert.deepEqual(A.conviteDoLink('?convite_personal=' + COD), { tipo: 'personal', codigo: COD });
assert.deepEqual(A.conviteDoLink('?convite=' + COD), { tipo: 'aluno', codigo: COD });
assert.deepEqual(A.conviteDoLink('?convite_personal=curto'), { tipo: 'personal', codigo: null }, 'link de personal quebrado mostra a tela de convite com erro');
assert.deepEqual(A.conviteDoLink(''), { tipo: null, codigo: null });
assert.equal(A.linkConvite('https://fbi0l.github.io/avaliacao-fisica/#x', COD, 'convite_personal'), 'https://fbi0l.github.io/avaliacao-fisica/?convite_personal=' + COD);
const fonteFuncao = require('fs').readFileSync('supabase/functions/registrar-aluno/cadastro.js', 'utf8');
assert.equal(A.TERMO_PERSONAL_VERSAO, (fonteFuncao.match(/TERMO_PERSONAL_VERSAO = '([^']+)'/) || [])[1], 'mesma versão do termo do personal no app e na função');
assert.equal(A.situacaoConvite({ situacao: 'pendente', expira_em: '2026-11-08T12:00:00Z' }).cancelavel, true);
assert.equal(A.situacaoConvite({ situacao: 'usado', personal_nome: 'Carlos' }).detalhe, 'por Carlos');
for (const sit of ['em_uso', 'usado', 'cancelado', 'vencido', 'xyz']) assert.equal(A.situacaoConvite({ situacao: sit }).cancelavel, false, sit);
const htmlConv = require('fs').readFileSync('index.html', 'utf8');
for (const id of ['personaisBtn', 'personaisDialog', 'persRotulo', 'persGerar', 'persLink', 'persCopiar', 'persLista', 'termoPersonal', 'termoAluno', 'convNome', 'convNomeCampo', 'termoPVersao', 'convAceiteTexto'])
  assert.ok(htmlConv.includes(`id="${id}"`), `index.html tem #${id}`);


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
  perimetros: { bracoD: 29, cintura: 71 }, equacao_gordura: 'faulkner', dobras: { triceps: [22, 22.4], subesc: [19] }, forca: { supino: { carga: 38, reps: 8 } }, testes: {}, postura: {}, parecer: 'Boa evolução.'
});
// Altura digitada em centímetros vira metros
assert.equal(A.montarAvaliacao({ ...A.rascunhoVazio('2026-10-14'), peso: '70', altura: '172' }, '2026-11-04').registro.altura, 1.72);
// Erros com mensagem clara
const erro = (extra, re) => { const e = A.montarAvaliacao({ ...A.rascunhoVazio('2026-10-14', 1.7), peso: '70', ...extra }, '2026-11-04').erros; assert.ok(e.some(m => re.test(m)), `${JSON.stringify(extra)} → ${e}`); };
erro({ peso: '' }, /Peso/); erro({ altura: '3' }, /Altura/); erro({ data: '2027-01-01' }, /futura/);
erro({ pas: '120' }, /duas medidas/); erro({ pas: '80', pad: '90' }, /menor que a sistólica/);
erro({ per: { cintura: '900' } }, /Cintura/); erro({ dob1: { triceps: 'abc' } }, /Tríceps/); erro({ dob2: { coxa: '20' } }, /1ª medida/);
erro({ supC: '40' }, /Supino: preencha/); erro({ legC: '100', legR: '2,5' }, /Leg press: repetições/); erro({ parecer: 'x'.repeat(4001) }, /4000/);

// Outros exercícios do teste de força (0.5.0)
{
  const base = { ...A.rascunhoVazio('2026-10-14', 1.7), peso: '70' };
  const ok = A.montarAvaliacao({ ...base, outros: [{ nome: ' Agachamento   livre ', c: '60', r: '6' }, { nome: '', c: '', r: '' }, { nome: 'Rosca direta', c: '14,5', r: '1' }] }, '2026-11-04');
  assert.deepEqual(ok.erros, []);
  assert.deepEqual(ok.registro.forca, { outros: [{ nome: 'Agachamento livre', carga: 60, reps: 6 }, { nome: 'Rosca direta', carga: 14.5, reps: 1 }] }, 'linha vazia é ignorada');
  assert.deepEqual(A.montarAvaliacao(base, '2026-11-04').registro.forca, {}, 'sem exercícios, sem chave outros');
  erro({ outros: [{ nome: '', c: '50', r: '5' }] }, /nome ao exercício/);
  erro({ outros: [{ nome: 'Remada', c: '50', r: '' }] }, /Remada: preencha/);
  erro({ outros: [{ nome: 'Remada', c: '', r: '' }] }, /Remada: preencha/);
  erro({ outros: [{ nome: 'Remada', c: '5000', r: '5' }] }, /Remada: carga/);
  erro({ outros: [{ nome: 'Remada', c: '50', r: '2,5' }] }, /Remada: repetições/);
  erro({ outros: [{ nome: 'Remada', c: '50', r: '5' }, { nome: 'REMADA', c: '40', r: '5' }] }, /já está na lista/);
  erro({ outros: [{ nome: 'Supino reto', c: '50', r: '5' }] }, /já está na lista/);
  erro({ outros: [{ nome: 'x'.repeat(41), c: '50', r: '5' }] }, /40 letras/);
  erro({ outros: Array.from({ length: 9 }, (_, i) => ({ nome: 'Ex ' + i, c: '10', r: '5' })) }, /No máximo 8/);
  // Editar ida e volta com outros exercícios
  const volta = A.montarAvaliacao(A.rascunhoDe({ ...ok.registro, data: '2026-10-14', peso: 70, altura: 1.7 }), '2026-11-04');
  assert.deepEqual(volta.registro.forca, ok.registro.forca);
  // Aluno de exemplo: sem etnia e com um exercício livre que evolui
  assert.equal('etnia' in A.ALUNO_EXEMPLO, false, 'aluno de exemplo sem etnia');
  const ex = A.avaliacoesExemplo('x');
  assert.deepEqual(ex.map(v => v.forca.outros[0].carga), [40, 46, 52]);
}

// Zonas no painel do aluno: 1RM mais recente de cada exercício e FC da última avaliação com repouso
{
  const al = { sexo: 'M', nascimento: '1990-01-01' };
  const avs = [
    { data: '2026-06-01', peso: 80, altura: 1.8, fc_repouso: 70, perimetros: {}, dobras: {}, forca: { supino: { carga: 60, reps: 1 }, outros: [{ nome: 'Rosca Direta', carga: 20, reps: 1 }] } },
    { data: '2026-09-01', peso: 80, altura: 1.8, fc_repouso: null, perimetros: {}, dobras: {}, forca: { supino: { carga: 70, reps: 1 } } }
  ];
  const z = A.zonasDoAluno(al, avs);
  assert.deepEqual(z.exercicios.map(e => [e.nome, e.rm, e.data]), [['Supino reto', 70, '2026-09-01'], ['Rosca Direta', 20, '2026-06-01']]);
  assert.equal(z.fc.metodo, 'karvonen'); assert.equal(z.dataFC, '2026-06-01', 'usa a última com FC de repouso');
  assert.equal(A.zonasDoAluno(al, []), null);
  assert.equal(A.zonasDoAluno(al, [avs[1]]).fc.metodo, 'fcmax', 'sem nenhuma FC de repouso');
}

// Testes físicos (0.7.0): formulário → registro, erros e ida e volta
{
  const base = { ...A.rascunhoVazio('2026-10-14', 1.7), peso: '70' };
  const t = { ...A.testesVazios(), flexao: '22', abdominal: '35', aerTipo: 'cooper', aerDist: '2.400', aerFc: '172', flex: { IV: '3', XII: '0', I: '' } };
  const r1 = A.montarAvaliacao({ ...base, testes: t }, '2026-11-04');
  assert.deepEqual(r1.erros, []);
  assert.deepEqual(r1.registro.testes, { flexao: 22, abdominal: 35, aerobico: { tipo: 'cooper', distancia: 2400, fc_final: 172 }, flexiteste: { IV: 3, XII: 0 } }, 'Cooper sem tempo; "—" fica de fora');
  const livre = A.montarAvaliacao({ ...base, testes: { ...A.testesVazios(), aerTipo: 'livre', aerDist: '4000', aerTempo: '30' } }, '2026-11-04');
  assert.deepEqual(livre.registro.testes, { aerobico: { tipo: 'livre', distancia: 4000, tempo: 30 } });
  assert.deepEqual(A.montarAvaliacao({ ...base, testes: { ...A.testesVazios(), aerDist: '2000' } }, '2026-11-04').registro.testes, {}, 'sem tipo, sem teste aeróbico');
  const errT = (extra, re) => { const e = A.montarAvaliacao({ ...base, testes: { ...A.testesVazios(), ...extra } }, '2026-11-04').erros; assert.ok(e.some(m => re.test(m)), `${JSON.stringify(extra)} → ${e}`); };
  errT({ flexao: '2,5' }, /Flexão de braço/); errT({ abdominal: '200' }, /Abdominal/);
  errT({ aerTipo: 'cooper' }, /distância/); errT({ aerTipo: 'livre', aerDist: '3000' }, /tempo/);
  errT({ aerTipo: 'cooper', aerDist: '2000', aerFc: '300' }, /FC final/); errT({ flex: { V: '5' } }, /Flexiteste V/);
  const volta = A.montarAvaliacao(A.rascunhoDe({ ...r1.registro, data: '2026-10-14', peso: 70, altura: 1.7 }), '2026-11-04');
  assert.deepEqual(volta.registro.testes, r1.registro.testes, 'editar ida e volta');
  assert.deepEqual(A.rascunhoDe({ data: '2026-10-14', peso: 70, altura: 1.7 }).testes, A.testesVazios(), 'avaliação antiga sem testes');
  const ex = A.avaliacoesExemplo('x');
  assert.deepEqual(ex.map(v => v.testes.flexao), [12, 16, 21], 'aluna de exemplo com testes');
}

// Avaliação postural (0.8.0)
{
  const base = { ...A.rascunhoVazio('2026-10-14', 1.7), peso: '70' };
  assert.deepEqual(A.montarAvaliacao(base, '2026-11-04').registro.postura, {}, 'não feita');
  const sem = A.montarAvaliacao({ ...base, postura: { feita: true, itens: {}, obs: '  ' } }, '2026-11-04').registro.postura;
  assert.deepEqual(sem, { itens: {} }, 'feita, sem alterações');
  const com = A.montarAvaliacao({ ...base, postura: { feita: true, itens: { lombar: 'hiperlordose', pes: 'quadrado', inventado: 'x' }, obs: ' Ver joelho. ' } }, '2026-11-04');
  assert.deepEqual(com.registro.postura, { itens: { lombar: 'hiperlordose' }, obs: 'Ver joelho.' }, 'valor ou item fora da lista some');
  assert.deepEqual(A.montarAvaliacao({ ...base, postura: { feita: false, itens: { lombar: 'hiperlordose' } } }, '2026-11-04').registro.postura, {}, 'desmarcou: não salva');
  const e = A.montarAvaliacao({ ...base, postura: { feita: true, itens: {}, obs: 'x'.repeat(1001) } }, '2026-11-04').erros;
  assert.ok(e.some(m => /1000/.test(m)), e);
  const volta = A.montarAvaliacao(A.rascunhoDe({ ...com.registro, data: '2026-10-14', peso: 70, altura: 1.7 }), '2026-11-04');
  assert.deepEqual(volta.registro.postura, com.registro.postura, 'editar ida e volta');
  assert.equal(A.rascunhoDe({ data: '2026-10-14', peso: 70, altura: 1.7 }).postura.feita, false, 'avaliação antiga sem postura');
  // O banco aceita exatamente as mesmas chaves e valores do checklist
  const sql = require('fs').readFileSync(require('path').join(__dirname, '..', 'supabase', 'migrations', require('fs').readdirSync(require('path').join(__dirname, '..', 'supabase', 'migrations')).find(f => f.endsWith('_avaliacao_postural.sql'))), 'utf8');
  const doBanco = JSON.parse(sql.match(/permitidos constant jsonb := '([^']+)'/)[1]);
  const doApp = Object.fromEntries(require('../calculos.js').POSTURA.flatMap(([, g]) => g.map(([k, , o]) => [k, o.map(x => x[0])])));
  assert.deepEqual(doBanco, doApp, 'checklist do app igual ao do banco');
  assert.ok(A.avaliacoesExemplo('x')[0].postura.itens.lombar, 'aluna de exemplo com postura');
}

// Guia de uso revisado a cada versão (pedido do dono em 09/11/2026)
{
  const versao = require('../package.json').version;
  assert.equal(A.GUIA_REVISADO_NA_VERSAO, versao, `Versão ${versao}: revise o guia de primeiro acesso (PASSOS_TUTORIAL_*) e suba GUIA_REVISADO_NA_VERSAO no app.js.`);
  const textoGuia = passos => passos.map(p => [p.titulo, p.texto, ...p.itens].join(' ')).join(' ').toLowerCase();
  const personal = textoGuia(A.PASSOS_TUTORIAL_PERSONAL), aluno = textoGuia(A.PASSOS_TUTORIAL_ALUNO);
  for (const t of ['outro exercício', 'zonas de treino', '8 etapas', 'flexiteste', 'cooper', 'postura']) assert.ok(personal.includes(t), `guia do personal sem: ${t}`);
  assert.ok(aluno.includes('zonas'), 'guia do aluno sem as zonas'); assert.ok(aluno.includes('testes físicos'), 'guia do aluno sem os testes'); assert.ok(aluno.includes('postural'), 'guia do aluno sem a postura');
  assert.ok(!personal.includes('etnia'), 'guia ainda fala de etnia');
}

// Editar: rascunho a partir do salvo e de volta dá o mesmo registro
const ida = A.montarAvaliacao(A.rascunhoDe({ ...registro }), '2026-11-04');
assert.deepEqual(ida.erros, []); assert.deepEqual(ida.registro, registro);

// Sentido da mudança
assert.equal(A.sentido(-2, -1), 'bom'); assert.equal(A.sentido(2, -1), 'ruim'); assert.equal(A.sentido(2, 0), 'neutro'); assert.equal(A.sentido(0.01, 1), 'neutro');
// O que falta para calcular gordura e massa muscular (aviso ao salvar e no resultado)
{
  const f0 = A.faltasDoCalculo({ perimetros: { bracoD: 24, coxaMedD: 34, pantD: 20 }, dobras: {} });
  assert.deepEqual(f0.gordura, ['dobra tríceps', 'dobra subescapular', 'dobra suprailíaca', 'dobra abdominal']);
  assert.deepEqual(f0.muscular, ['dobra tríceps', 'dobra coxa', 'dobra panturrilha']);
  const cheio = { perimetros: { bracoD: 24, coxaMedD: 34, pantD: 20 }, dobras: { triceps: [10], subesc: [12, 12.4], iliaca: [14], abdominal: [18], coxa: [20], panturrilha: [9] } };
  assert.deepEqual(A.faltasDoCalculo(cheio), { gordura: [], muscular: [] });
  assert.deepEqual(A.faltasDoCalculo({ ...cheio, perimetros: { bracoD: 24 } }).muscular, ['Coxa média D', 'Panturrilha D']);
  assert.deepEqual(A.faltasDoCalculo(undefined).gordura.length, 4, 'avaliação vazia');
  assert.equal(A.listaFalta(['a']), 'a'); assert.equal(A.listaFalta(['a', 'b']), 'a e b'); assert.equal(A.listaFalta(['a', 'b', 'c']), 'a, b e c');
}
// Equação escolhida: vai para o registro, volta ao editar e muda as dobras exigidas
{
  const base = { ...A.rascunhoVazio('2026-10-14', 1.7), peso: '70' };
  assert.equal(A.montarAvaliacao({ ...base, equacao: 'petroski' }, '2026-11-04').registro.equacao_gordura, 'petroski');
  assert.equal(A.montarAvaliacao({ ...base, equacao: 'outra' }, '2026-11-04').registro.equacao_gordura, 'faulkner', 'valor estranho vira Faulkner');
  assert.equal(A.rascunhoDe({ data: '2026-10-14', peso: 70, altura: 1.7, equacao_gordura: 'petroski' }).equacao, 'petroski');
  assert.equal(A.rascunhoDe({ data: '2026-10-14', peso: 70, altura: 1.7 }).equacao, 'faulkner', 'avaliação antiga');
  const dob = { triceps: [10], subesc: [12], iliaca: [14], abdominal: [18] };
  assert.deepEqual(A.faltasDoCalculo({ dobras: dob }).gordura, []);
  assert.deepEqual(A.faltasDoCalculo({ dobras: dob, equacao_gordura: 'petroski' }).gordura, ['dobra panturrilha']);
}
// Guia de primeiro acesso: aparece uma vez; passos completos para personal e aluno
assert.equal(A.deveMostrarTutorial({}, null), true);
assert.equal(A.deveMostrarTutorial({ tutorial_visto: true }, null), false, 'já viu em outro aparelho');
assert.equal(A.deveMostrarTutorial({}, '1'), false, 'já viu neste aparelho');
assert.equal(A.deveMostrarTutorial({ tutorial_visto: 'true' }, null), true, 'só o valor verdadeiro conta');
assert.ok(A.PASSOS_TUTORIAL_PERSONAL.length >= 5 && A.PASSOS_TUTORIAL_ALUNO.length >= 3);
assert.ok(A.PASSOS_TUTORIAL_ALUNO.length < A.PASSOS_TUTORIAL_PERSONAL.length, 'o do aluno é o básico');
for (const p of [...A.PASSOS_TUTORIAL_PERSONAL, ...A.PASSOS_TUTORIAL_ALUNO])
  assert.ok(p.icone && p.titulo && p.texto && p.itens.length >= 1 && p.itens.every(t => typeof t === 'string' && t.length), `passo ${p.titulo}`);
const htmlTut = require('fs').readFileSync('index.html', 'utf8');
for (const id of ['ajudaBtn', 'tutorialDialog', 'tutTitulo', 'tutTexto', 'tutItens', 'tutPontos', 'tutProximo', 'tutVoltar', 'tutPular', 'tutFechar', 'tutContagem', 'tutIcone'])
  assert.ok(htmlTut.includes(`id="${id}"`), `index.html tem #${id}`);

// Aluno de exemplo: só no primeiro acesso, marcado como exemplo, 3 avaliações completas e válidas
assert.equal(A.deveCriarExemplo({}, 0), true);
assert.equal(A.deveCriarExemplo({ exemplo_criado: true }, 0), false, 'apagou o exemplo: não volta');
assert.equal(A.deveCriarExemplo({}, 2), false, 'quem já tem alunos não ganha exemplo');
assert.equal(A.ALUNO_EXEMPLO.exemplo, true); assert.match(A.ALUNO_EXEMPLO.nome, /exemplo/);
{
  const C = require('../calculos.js');
  const avs = A.avaliacoesExemplo('id-x');
  assert.equal(avs.length, 3); assert.ok(avs.every(v => v.aluno_id === 'id-x'));
  for (const v of avs) {
    const ida = A.montarAvaliacao(A.rascunhoDe(v), '2026-11-05');
    assert.deepEqual(ida.erros, [], `exemplo ${v.data} passa nas mesmas faixas do banco`);
    const c = C.calcular(A.ALUNO_EXEMPLO, v);
    for (const k of ['gordura', 'massaMuscular', 'somaDobras', 'supino1RM', 'legPress1RM']) assert.ok(Number.isFinite(c[k]), `${v.data}: ${k}`);
    assert.ok(c.pressao && c.classeLegPress && c.classeSupino, 'todas as classificações aparecem');
  }
  const [g0, , g2] = avs.map(v => C.calcular(A.ALUNO_EXEMPLO, v).gordura);
  assert.ok(g2 < g0, 'o exemplo mostra evolução (gordura caindo)');
  assert.ok(avs[0].dobras.triceps.length === 2, 'mostra dobra com 2 medidas e média');
}
// Sugestão de instalar: só no celular e só fora do app instalado
const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
const UA_AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
assert.equal(A.avisoInstalacao({ ua: UA_IOS }), 'ios');
assert.equal(A.avisoInstalacao({ ua: UA_AND, temPrompt: true }), 'android');
assert.equal(A.avisoInstalacao({ ua: UA_AND }), 'android-menu', 'sem o botão do navegador, ensina pelo menu');
assert.equal(A.avisoInstalacao({ ua: UA_IOS, instalado: true }), null, 'já instalado: nada');
assert.equal(A.avisoInstalacao({ ua: UA_PC }), null, 'computador: nada');
assert.equal(A.avisoInstalacao({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', toques: 5 }), 'ios', 'iPad novo');
for (const k of ['android', 'android-menu', 'ios']) assert.ok(A.TEXTO_INSTALAR[k]?.length > 20, k);
for (const id of ['instalarAviso', 'instalarTexto', 'instalarBtn', 'instalarFechar']) assert.ok(htmlTut.includes(`id="${id}"`), `index.html tem #${id}`);
console.log('App aprovado: convite, inatividade, rotas, formulário da avaliação, aviso de medidas faltando, guia de primeiro acesso, aluno de exemplo e sugestão de instalar.');
