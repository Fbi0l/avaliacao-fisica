/* Fichas de treino (1.1.0). Regras puras: nada aqui acessa a tela ou o banco; testado em tests/treino.cjs.
   As chaves de GRUPOS, OBJETIVOS e DIVISOES são as mesmas aceitas pelo banco (migração fichas_treino):
   mudou uma, mude a outra com migração nova. Zonas de carga pela NSCA (ver calculos.js). */

const TREINO_LIMITES = { treinos: 10, exercicios: 30, nomeTreino: 40, nomeExercicio: 60, reps: 20, obs: 200, observacao: 1000, series: 20, carga: 1000, descanso: 900 };

const GRUPOS = [
  ['peito', 'Peito'], ['costas', 'Costas'], ['ombros', 'Ombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'],
  ['pernas', 'Pernas'], ['gluteos', 'Glúteos'], ['panturrilha', 'Panturrilha'], ['abdomen', 'Abdômen'], ['cardio', 'Cardio'], ['outro', 'Outro']
];
const NOME_GRUPO = Object.fromEntries(GRUPOS);

/** Lista pronta para escolher rápido; o personal pode digitar qualquer outro. */
const EXERCICIOS = [
  ['Supino reto', 'peito'], ['Supino inclinado', 'peito'], ['Supino declinado', 'peito'], ['Supino com halteres', 'peito'], ['Crucifixo', 'peito'],
  ['Crossover', 'peito'], ['Peck deck', 'peito'], ['Flexão de braço', 'peito'],
  ['Puxada frontal', 'costas'], ['Remada curvada', 'costas'], ['Remada baixa', 'costas'], ['Remada unilateral', 'costas'], ['Barra fixa', 'costas'],
  ['Pulldown', 'costas'], ['Levantamento terra', 'costas'], ['Hiperextensão lombar', 'costas'],
  ['Desenvolvimento', 'ombros'], ['Desenvolvimento com halteres', 'ombros'], ['Elevação lateral', 'ombros'], ['Elevação frontal', 'ombros'],
  ['Crucifixo invertido', 'ombros'], ['Encolhimento', 'ombros'], ['Remada alta', 'ombros'],
  ['Rosca direta', 'biceps'], ['Rosca alternada', 'biceps'], ['Rosca martelo', 'biceps'], ['Rosca Scott', 'biceps'], ['Rosca concentrada', 'biceps'],
  ['Tríceps pulley', 'triceps'], ['Tríceps testa', 'triceps'], ['Tríceps francês', 'triceps'], ['Tríceps corda', 'triceps'], ['Mergulho', 'triceps'],
  ['Agachamento livre', 'pernas'], ['Agachamento no Smith', 'pernas'], ['Leg press', 'pernas'], ['Hack', 'pernas'], ['Cadeira extensora', 'pernas'],
  ['Mesa flexora', 'pernas'], ['Cadeira flexora', 'pernas'], ['Stiff', 'pernas'], ['Afundo', 'pernas'], ['Agachamento búlgaro', 'pernas'], ['Cadeira adutora', 'pernas'],
  ['Elevação pélvica', 'gluteos'], ['Cadeira abdutora', 'gluteos'], ['Glúteo no cabo', 'gluteos'], ['Coice', 'gluteos'],
  ['Panturrilha em pé', 'panturrilha'], ['Panturrilha sentado', 'panturrilha'], ['Panturrilha no leg press', 'panturrilha'],
  ['Abdominal supra', 'abdomen'], ['Abdominal infra', 'abdomen'], ['Prancha', 'abdomen'], ['Abdominal oblíquo', 'abdomen'], ['Abdominal na polia', 'abdomen'],
  ['Esteira', 'cardio'], ['Bicicleta', 'cardio'], ['Elíptico', 'cardio'], ['Escada', 'cardio'], ['Remo', 'cardio'], ['Pular corda', 'cardio']
].map(([nome, grupo]) => ({ nome, grupo }));

/** Objetivo da ficha: repetições usuais e faixa de % do 1RM (NSCA) para sugerir a carga. */
const OBJETIVOS = {
  hipertrofia: { nome: 'Hipertrofia', reps: '8–12', de: 67, ate: 85 },
  forca: { nome: 'Força', reps: '3–6', de: 85, ate: 95 },
  emagrecimento: { nome: 'Emagrecimento', reps: '12–15', de: 50, ate: 67 },
  resistencia: { nome: 'Resistência', reps: '15–20', de: 40, ate: 67 },
  saude: { nome: 'Saúde', reps: '10–15', de: 50, ate: 70 },
  outro: { nome: 'Outro', reps: '', de: null, ate: null }
};

/** Modelos de divisão. O personal pode renomear, acrescentar e tirar treinos depois. */
const DIVISOES = {
  corpo: { nome: 'Corpo inteiro', desc: '1 treino, repetido na semana', treinos: ['Corpo inteiro'], vezes: 3 },
  ab: { nome: 'AB · Superior / Inferior', desc: '2 treinos, 4× por semana', treinos: ['A · Superior', 'B · Inferior'], vezes: 4 },
  abc: { nome: 'ABC', desc: '3 treinos', treinos: ['A · Peito e tríceps', 'B · Costas e bíceps', 'C · Pernas e ombros'], vezes: 3 },
  ppl: { nome: 'Empurrar / Puxar / Pernas', desc: '3 treinos por padrão de movimento', treinos: ['Empurrar', 'Puxar', 'Pernas'], vezes: 3 },
  abcd: { nome: 'ABCD', desc: '4 treinos', treinos: ['A', 'B', 'C', 'D'], vezes: 4 },
  abcde: { nome: 'ABCDE', desc: '5 treinos', treinos: ['A', 'B', 'C', 'D', 'E'], vezes: 5 },
  semana: { nome: 'Por dia da semana', desc: 'Um treino para cada dia marcado', treinos: ['Segunda', 'Quarta', 'Sexta'], vezes: 3 },
  personalizada: { nome: 'Personalizada', desc: 'Quantos treinos quiser, com o nome que escolher', treinos: ['Treino 1'], vezes: null }
};

const numeroOuNulo = x => { if (x == null || x === '') return null; const n = Number(String(x).replace(',', '.').trim()); return Number.isFinite(n) ? n : NaN; };
const textoOuNulo = x => { const t = String(x ?? '').trim(); return t || null; };

/** Troca o modelo da divisão sem perder exercícios: os treinos ganham os nomes do modelo pela posição;
    um treino a mais que já tem exercícios fica, com o nome que tinha. */
function trocarDivisao(treinos, divisao) {
  const modelo = DIVISOES[divisao] || DIVISOES.personalizada, atuais = treinos || [];
  const n = Math.max(modelo.treinos.length, ...atuais.map((t, i) => (t.exercicios?.length ? i + 1 : 0)));
  return Array.from({ length: n }, (_, i) => ({ nome: modelo.treinos[i] || atuais[i]?.nome || `Treino ${i + 1}`, exercicios: atuais[i]?.exercicios ? [...atuais[i].exercicios] : [] }));
}

/** Confere o rascunho do formulário e devolve o registro para o banco (ou o primeiro erro, em português). */
function montarFicha(r) {
  const L = TREINO_LIMITES;
  if (!OBJETIVOS[r.objetivo]) return { erro: 'Escolha o objetivo da ficha.' };
  if (!DIVISOES[r.divisao]) return { erro: 'Escolha como dividir o treino.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.inicio || ''))) return { erro: 'Informe a data de início.' };
  const semanas = numeroOuNulo(r.semanas), vezes = numeroOuNulo(r.vezes_semana);
  if (semanas !== null && (!Number.isInteger(semanas) || semanas < 1 || semanas > 52)) return { erro: 'A duração vai de 1 a 52 semanas.' };
  if (vezes !== null && (!Number.isInteger(vezes) || vezes < 1 || vezes > 7)) return { erro: 'Os treinos por semana vão de 1 a 7.' };
  const observacao = textoOuNulo(r.observacao);
  if (observacao && observacao.length > L.observacao) return { erro: `A observação pode ter até ${L.observacao} letras.` };
  const lista = r.treinos || [];
  if (!lista.length) return { erro: 'A ficha precisa de pelo menos um treino.' };
  if (lista.length > L.treinos) return { erro: `A ficha pode ter até ${L.treinos} treinos.` };
  const nomes = new Set(), treinos = [];
  for (const [i, t] of lista.entries()) {
    const nome = textoOuNulo(t.nome);
    if (!nome) return { erro: `Dê um nome ao treino ${i + 1}.` };
    if (nome.length > L.nomeTreino) return { erro: `O nome do treino pode ter até ${L.nomeTreino} letras.` };
    if (nomes.has(nome.toLowerCase())) return { erro: `Há dois treinos chamados “${nome}”.` };
    nomes.add(nome.toLowerCase());
    const exs = (t.exercicios || []).filter(e => textoOuNulo(e.nome)); // linha sem nome é ignorada
    if (exs.length > L.exercicios) return { erro: `O treino “${nome}” pode ter até ${L.exercicios} exercícios.` };
    const exercicios = [];
    for (const e of exs) {
      const en = textoOuNulo(e.nome), onde = `“${en}” (${nome})`;
      if (en.length > L.nomeExercicio) return { erro: `O nome do exercício pode ter até ${L.nomeExercicio} letras.` };
      const series = numeroOuNulo(e.series), carga = numeroOuNulo(e.carga), descanso = numeroOuNulo(e.descanso);
      if (series !== null && (!Number.isInteger(series) || series < 1 || series > L.series)) return { erro: `Séries de ${onde}: de 1 a ${L.series}.` };
      if (carga !== null && (Number.isNaN(carga) || carga < 0 || carga > L.carga)) return { erro: `Carga de ${onde}: um número em kg.` };
      if (descanso !== null && (!Number.isInteger(descanso) || descanso < 0 || descanso > L.descanso)) return { erro: `Descanso de ${onde}: em segundos, até ${L.descanso}.` };
      const reps = textoOuNulo(e.reps), obs = textoOuNulo(e.obs);
      if (reps && reps.length > L.reps) return { erro: `Repetições de ${onde}: até ${L.reps} letras (ex.: 8–12).` };
      if (obs && obs.length > L.obs) return { erro: `Observação de ${onde}: até ${L.obs} letras.` };
      const x = { nome: en };
      if (e.grupo && NOME_GRUPO[e.grupo]) x.grupo = e.grupo;
      if (series !== null) x.series = series;
      if (reps) x.reps = reps;
      if (carga !== null) x.carga = Math.round(carga * 10) / 10;
      if (descanso !== null) x.descanso = descanso;
      if (obs) x.obs = obs;
      exercicios.push(x);
    }
    treinos.push({ nome, exercicios });
  }
  if (!treinos.some(t => t.exercicios.length)) return { erro: 'Coloque pelo menos um exercício na ficha.' };
  return { dados: { objetivo: r.objetivo, divisao: r.divisao, inicio: r.inicio, semanas, vezes_semana: vezes, observacao, treinos } };
}

/** Rascunho do formulário a partir de uma ficha salva (ou de um modelo, para ficha nova). */
function rascunhoDaFicha(f, hoje) {
  if (f) return { objetivo: f.objetivo, divisao: f.divisao, inicio: f.inicio, semanas: f.semanas ?? '', vezes_semana: f.vezes_semana ?? '', observacao: f.observacao || '',
    treinos: f.treinos.map(t => ({ nome: t.nome, exercicios: t.exercicios.map(e => ({ nome: e.nome, grupo: e.grupo || '', series: e.series ?? '', reps: e.reps || '', carga: e.carga ?? '', descanso: e.descanso ?? '', obs: e.obs || '' })) })) };
  return { objetivo: 'hipertrofia', divisao: 'ab', inicio: hoje, semanas: 6, vezes_semana: DIVISOES.ab.vezes, observacao: '', treinos: trocarDivisao([], 'ab') };
}

const diaMs = 86400000;
const diaUTC = iso => Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z');
const ordemFeitos = feitos => [...(feitos || [])].sort((a, b) => (a.data === b.data ? String(a.criado_em || '').localeCompare(String(b.criado_em || '')) : a.data < b.data ? -1 : 1));

/** Treino sugerido: o seguinte ao último feito nesta ficha (volta ao primeiro depois do último). */
function proximoTreino(ficha, feitos) {
  const n = ficha?.treinos?.length || 0;
  if (!n) return null;
  const ult = ordemFeitos((feitos || []).filter(x => x.ficha_id === ficha.id)).at(-1);
  return ult ? (ult.treino + 1) % n : 0;
}

/** Semana da ficha (1 = a do início) e se ela já passou da duração prevista. */
function semanaDaFicha(ficha, hoje) {
  if (!ficha?.inicio) return null;
  const dias = Math.floor((diaUTC(hoje) - diaUTC(ficha.inicio)) / diaMs);
  if (dias < 0) return { semana: 0, comecou: false, terminou: false };
  const semana = Math.floor(dias / 7) + 1;
  return { semana, comecou: true, terminou: ficha.semanas != null && semana > ficha.semanas };
}

/** Frequência: treinos feitos na ficha, por semana (últimas `quantas`), e % da meta (vezes por semana). */
function frequencia(ficha, feitos, hoje, quantas = 4) {
  const meus = ordemFeitos((feitos || []).filter(x => x.ficha_id === ficha.id));
  const sem = semanaDaFicha(ficha, hoje);
  const atual = sem?.comecou ? sem.semana : 0;
  const porSemana = [];
  for (let s = Math.max(1, atual - quantas + 1); s <= atual; s++) {
    const ini = diaUTC(ficha.inicio) + (s - 1) * 7 * diaMs, fim = ini + 7 * diaMs;
    porSemana.push({ semana: s, dias: Array.from({ length: 7 }, (_, d) => meus.filter(x => diaUTC(x.data) === ini + d * diaMs).map(x => x.treino)), total: meus.filter(x => diaUTC(x.data) >= ini && diaUTC(x.data) < fim).length });
  }
  // Meta: semanas completas mais a atual proporcional aos dias passados
  let meta = null;
  if (ficha.vezes_semana && atual > 0) {
    const diasPassados = Math.floor((diaUTC(hoje) - diaUTC(ficha.inicio)) / diaMs) + 1;
    const esperado = ficha.vezes_semana * diasPassados / 7;
    meta = esperado > 0 ? Math.min(999, Math.round(meus.length / esperado * 100)) : null;
  }
  return { total: meus.length, ultimo: meus.at(-1)?.data || null, semana: atual, porSemana, meta };
}

/** Carga anotada mais recente de cada exercício da ficha, comparada com a carga prescrita. */
function cargasAnotadas(ficha, feitos) {
  const meus = ordemFeitos((feitos || []).filter(x => x.ficha_id === ficha.id));
  const out = [];
  ficha.treinos.forEach((t, ti) => t.exercicios.forEach((e, ei) => {
    const ult = [...meus].reverse().find(x => x.treino === ti && x.exercicios?.[ei]?.carga != null);
    if (!ult) return;
    const usada = Number(ult.exercicios[ei].carga);
    out.push({ treino: t.nome, nome: e.nome, prescrita: e.carga ?? null, usada, data: ult.data, dif: e.carga != null ? Math.round((usada - e.carga) * 10) / 10 : null });
  }));
  return out;
}

/** Sugestão de carga pelo 1RM medido na avaliação (mesmo nome de exercício) e pela faixa do objetivo. */
function sugestaoCarga(nomeExercicio, objetivo, exercicios1RM, chave) {
  const k = chave(nomeExercicio);
  const e = k && (exercicios1RM || []).find(x => chave(x.nome) === k);
  if (!e || !(e.rm > 0)) return null;
  const o = OBJETIVOS[objetivo];
  const kg = pct => Math.round(e.rm * pct / 100 * 2) / 2;
  return { rm: e.rm, de: o?.de != null ? kg(o.de) : null, ate: o?.ate != null ? kg(o.ate) : null, pct: carga => (carga > 0 ? Math.round(carga / e.rm * 100) : null) };
}

/** "4 × 8–12 · 27 kg · 90 s" */
function prescricao(e) {
  const partes = [];
  if (e.series || e.reps) partes.push([e.series, e.reps].filter(x => x != null && x !== '').join(' × '));
  if (e.carga != null) partes.push(`${String(e.carga).replace('.', ',')} kg`);
  if (e.descanso != null) partes.push(e.descanso >= 60 && e.descanso % 60 === 0 ? `${e.descanso / 60} min` : `${e.descanso} s`);
  return partes.join(' · ');
}

if (typeof module !== 'undefined') {
  module.exports = { TREINO_LIMITES, GRUPOS, NOME_GRUPO, EXERCICIOS, OBJETIVOS, DIVISOES, trocarDivisao, montarFicha, rascunhoDaFicha, proximoTreino, semanaDaFicha, frequencia, cargasAnotadas, sugestaoCarga, prescricao };
}
