'use strict';
/* Avaliação Física — telas e lógica. Regras do projeto: nada de HTML montado a partir de dados
   (só createElement/textContent), CSP sem inline, chave publicável apenas. Ver CLAUDE.md. */

// Preenchido quando o projeto do Supabase for criado (endereço e chave PUBLICÁVEL, nunca a secreta).
const SUPABASE_URL = '';
const SUPABASE_KEY = '';
const TERMO_VERSAO = '2026-11-04'; // igual ao da função registrar-aluno
const INATIVIDADE_MS = 30 * 60 * 1000;

const K = typeof module !== 'undefined' ? require('./calculos.js')
  : { PERIMETROS, DOBRAS, EXAMES, ROTULO_ETNIA, idadeEm, lerNumero, mediaDobra, calcular, classeProporcao, classeExame };

/* ---------- Regras puras (testadas em tests/app.cjs) ---------- */
const doisDigitos = n => String(n).padStart(2, '0');
function hojeISO(agora = new Date()) { return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`; }
const fmt = (v, casas = 1) => v == null || !Number.isFinite(Number(v)) ? '—'
  : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Código do convite no endereço (?convite=…): só aceita o formato exato de 43 caracteres. */
function codigoDoLink(search) {
  const c = new URLSearchParams(search || '').get('convite');
  return c && /^[A-Za-z0-9_-]{43}$/.test(c) ? c : null;
}
function linkConvite(base, codigo) { const u = new URL(base); u.search = ''; u.hash = ''; u.searchParams.set('convite', codigo); return u.toString(); }
function expirouPorInatividade(ultima, agora, limite = INATIVIDADE_MS) { const t = Number(ultima); return Number.isFinite(t) && t > 0 && agora - t > limite; }

/** Lê a rota do endereço (#aluno-<id>, #aluno-<id>-evolucao, #av-<id>, #nova-<id>, #editar-<id>). */
function lerRota(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const uuid = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
  let m;
  if ((m = h.match(new RegExp(`^aluno-${uuid}(?:-(evolucao|comparar))?$`)))) return { tela: 'aluno', id: m[1], aba: m[2] || 'avaliacoes' };
  if ((m = h.match(new RegExp(`^av-${uuid}$`)))) return { tela: 'avaliacao', id: m[1] };
  if ((m = h.match(new RegExp(`^nova-${uuid}$`)))) return { tela: 'nova', id: m[1] };
  if ((m = h.match(new RegExp(`^editar-${uuid}$`)))) return { tela: 'editar', id: m[1] };
  return { tela: 'inicio' };
}

const FAIXAS = {
  peso: [20, 300, 'Peso entre 20 e 300 kg.'], altura: [1, 2.4, 'Altura em metros, entre 1,00 e 2,40 (ex.: 1,72).'],
  fc_repouso: [25, 220, 'FC de repouso entre 25 e 220 bpm.'], pas: [60, 260, 'Pressão sistólica entre 60 e 260 mmHg.'], pad: [30, 160, 'Pressão diastólica entre 30 e 160 mmHg.'],
  glicose: [20, 900, 'Glicose entre 20 e 900 mg/dL.'], triglicerideos: [10, 5000, 'Triglicerídeos entre 10 e 5000 mg/dL.'], ldl: [5, 600, 'LDL entre 5 e 600 mg/dL.'], hdl: [5, 200, 'HDL entre 5 e 200 mg/dL.']
};

/** Rascunho vazio do formulário (texto, como digitado). */
function rascunhoVazio(data, altura) {
  return { data, peso: '', altura: altura == null ? '' : String(altura).replace('.', ','), fc_repouso: '', pas: '', pad: '', glicose: '', triglicerideos: '', ldl: '', hdl: '',
    per: {}, dob1: {}, dob2: {}, supC: '', supR: '', legC: '', legR: '', parecer: '' };
}
/** Rascunho a partir de uma avaliação salva (para editar). */
function rascunhoDe(av) {
  const t = v => v == null ? '' : String(v).replace('.', ',');
  const r = rascunhoVazio(av.data, av.altura);
  for (const k of ['peso', 'fc_repouso', 'pas', 'pad', 'glicose', 'triglicerideos', 'ldl', 'hdl']) r[k] = t(av[k]);
  for (const [k] of K.PERIMETROS) r.per[k] = t(av.perimetros?.[k]);
  for (const [k] of K.DOBRAS) { const par = av.dobras?.[k] || []; r.dob1[k] = t(par[0]); r.dob2[k] = t(par[1]); }
  r.supC = t(av.forca?.supino?.carga); r.supR = t(av.forca?.supino?.reps);
  r.legC = t(av.forca?.leg_press?.carga); r.legR = t(av.forca?.leg_press?.reps);
  r.parecer = av.parecer || '';
  return r;
}

/** Converte o rascunho no registro da tabela avaliacoes, com as mesmas faixas do banco. */
function montarAvaliacao(r, hoje = hojeISO()) {
  const erros = [], reg = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data || '') || r.data < '2000-01-01' || r.data > hoje) erros.push('Data da avaliação inválida (não pode ser futura).');
  else reg.data = r.data;
  for (const [k, [min, max, msg]] of Object.entries(FAIXAS)) {
    let v = K.lerNumero(r[k]);
    if (k === 'altura' && v >= 100 && v <= 240) v = v / 100; // digitou em centímetros
    if (v == null) { if (k === 'peso' || k === 'altura') erros.push(msg); reg[k] = null; continue; }
    if (Number.isNaN(v) || v < min || v > max) { erros.push(msg); continue; }
    reg[k] = k === 'altura' ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
    if (['fc_repouso', 'pas', 'pad'].includes(k)) reg[k] = Math.round(v);
  }
  if ((reg.pas == null) !== (reg.pad == null)) erros.push('Preencha as duas medidas da pressão (sistólica e diastólica).');
  if (reg.pas != null && reg.pad != null && reg.pad >= reg.pas) erros.push('A pressão diastólica precisa ser menor que a sistólica.');
  reg.perimetros = {};
  for (const [k, nome] of K.PERIMETROS) {
    const v = K.lerNumero(r.per?.[k]);
    if (v == null) continue;
    if (Number.isNaN(v) || v < 5 || v > 250) erros.push(`${nome}: perímetro entre 5 e 250 cm.`); else reg.perimetros[k] = Math.round(v * 10) / 10;
  }
  reg.dobras = {};
  for (const [k, nome] of K.DOBRAS) {
    const a = K.lerNumero(r.dob1?.[k]), b = K.lerNumero(r.dob2?.[k]);
    if (a == null && b == null) continue;
    const bad = x => x != null && (Number.isNaN(x) || x <= 0 || x > 80);
    if (bad(a) || bad(b)) { erros.push(`${nome}: dobra entre 0,1 e 80 mm.`); continue; }
    if (a == null) { erros.push(`${nome}: preencha a 1ª medida.`); continue; }
    reg.dobras[k] = b == null ? [a] : [a, b];
  }
  reg.forca = {};
  for (const [k, nome, c, rp] of [['supino', 'Supino', r.supC, r.supR], ['leg_press', 'Leg press', r.legC, r.legR]]) {
    const carga = K.lerNumero(c), reps = K.lerNumero(rp);
    if (carga == null && reps == null) continue;
    if (carga == null || reps == null) { erros.push(`${nome}: preencha a carga e as repetições.`); continue; }
    if (Number.isNaN(carga) || carga < 1 || carga > 1000) { erros.push(`${nome}: carga entre 1 e 1000 kg.`); continue; }
    if (!Number.isInteger(reps) || reps < 1 || reps > 30) { erros.push(`${nome}: repetições inteiras, de 1 a 30.`); continue; }
    reg.forca[k] = { carga, reps };
  }
  const parecer = String(r.parecer || '').trim();
  if (parecer.length > 4000) erros.push('O parecer pode ter no máximo 4000 caracteres.');
  reg.parecer = parecer || null;
  return { registro: reg, erros };
}

/** Diferença com sentido: 'bom', 'ruim' ou 'neutro', conforme a direção desejada (1 sobe, -1 desce, 0 tanto faz). */
function sentido(dif, desejado) { return !desejado || !Number.isFinite(dif) || Math.abs(dif) < 0.05 ? 'neutro' : dif * desejado > 0 ? 'bom' : 'ruim'; }

if (typeof module !== 'undefined') {
  module.exports = { TERMO_VERSAO, hojeISO, fmt, codigoDoLink, linkConvite, expirouPorInatividade, lerRota, rascunhoVazio, rascunhoDe, montarAvaliacao, sentido };
} else {
  iniciar();
}

/* ---------- Interface ---------- */
function iniciar() {
  const $ = id => document.getElementById(id);
  // Monta elementos sem HTML em texto: h('div', {class: 'x', onclick: fn}, 'texto', outroElemento)
  function h(tag, props, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (['value', 'checked', 'disabled', 'type', 'id', 'htmlFor', 'inputMode', 'title'].includes(k)) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f instanceof Node ? f : String(f));
    return e;
  }
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...filhos) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); filhos.flat(Infinity).forEach(f => f != null && e.append(f instanceof Node ? f : String(f))); return e; }
  const chip = c => c ? h('span', { class: 'chip ' + (c.tom || '') }, c.texto) : h('span', { class: 'chip' }, '—');
  const dataBR = iso => { const [a, m, d] = String(iso).split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', ''); };
  const dataCurta = iso => { const [, m, d] = String(iso).split('-'); return `${d}/${m}`; };
  const iniciais = n => String(n).trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
  const primeiro = n => String(n || '').trim().split(/\s+/)[0];
  const aviso = (id, texto, ok = false) => { const e = $(id); e.textContent = texto || ''; e.classList.toggle('ok', ok); };
  const mostrar = v => ['bootView', 'loginView', 'conviteView', 'appView'].forEach(x => $(x).classList.toggle('hidden', x !== v));
  const erroBanco = e => /Failed to fetch|NetworkError/i.test(String(e?.message)) ? 'Sem conexão. Verifique sua internet e tente de novo.'
    : e?.code === '23514' ? 'Algum valor está fora da faixa aceita. Confira os campos.' : e?.code === '42501' ? 'Você não tem permissão para isso.'
    : 'Não foi possível salvar agora. Tente de novo.';

  if (!SUPABASE_URL || !SUPABASE_KEY || !window.supabase) {
    mostrar('loginView');
    $('loginBtn').disabled = true;
    aviso('loginMsg', 'O app ainda não está ligado ao banco de dados. Falta configurar o projeto do Supabase.');
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const est = { papel: null, usuario: null, personal: null, alunos: [], resumo: new Map(), avs: new Map(), busca: '', rascunho: null, passo: 0, editandoAluno: null, conviteAluno: null };

  /* ----- Confirmação ----- */
  function confirmar({ titulo, texto, botao = 'Excluir' }) {
    return new Promise(res => {
      $('confTitulo').textContent = titulo; $('confTexto').textContent = texto; $('confSim').textContent = botao;
      const d = $('confirmaDialog'), fim = v => { d.close(); res(v); };
      $('confSim').onclick = () => fim(true); $('confNao').onclick = () => fim(false); d.oncancel = () => res(false);
      d.showModal(); $('confNao').focus();
    });
  }
  document.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  /* ----- Dados ----- */
  async function carregarPersonal() {
    const [p, a, r] = await Promise.all([
      db.from('personais').select('usuario_id,nome,cref').eq('usuario_id', est.usuario.id).single(),
      db.from('alunos').select('id,nome,sexo,nascimento,etnia,contato,usuario_id').order('nome'),
      db.from('avaliacoes').select('aluno_id,data')
    ]);
    if (p.error || a.error || r.error) throw p.error || a.error || r.error;
    est.personal = p.data; est.alunos = a.data;
    est.resumo = new Map();
    for (const x of r.data) { const o = est.resumo.get(x.aluno_id) || { n: 0, ultima: null }; o.n++; if (!o.ultima || x.data > o.ultima) o.ultima = x.data; est.resumo.set(x.aluno_id, o); }
    $('quemSou').textContent = est.personal.nome + (est.personal.cref ? ` · CREF ${est.personal.cref}` : '');
  }
  async function avaliacoesDe(alunoId, recarregar = false) {
    if (!recarregar && est.avs.has(alunoId)) return est.avs.get(alunoId);
    const { data, error } = await db.from('avaliacoes').select('*').eq('aluno_id', alunoId).order('data').order('criado_em');
    if (error) throw error;
    est.avs.set(alunoId, data); return data;
  }
  const alunoPorId = id => est.alunos.find(a => a.id === id);

  /* ----- Lista de alunos ----- */
  function desenharLista(atual) {
    const termo = est.busca.trim().toLowerCase();
    const lista = est.alunos.filter(a => !termo || a.nome.toLowerCase().includes(termo));
    $('qtdAlunos').textContent = String(est.alunos.length);
    if (!lista.length) { $('listaAlunos').replaceChildren(h('p', { class: 'vazio' }, est.alunos.length ? 'Nenhum aluno com esse nome.' : 'Nenhum aluno ainda. Toque em “+ Novo”.')); return; }
    $('listaAlunos').replaceChildren(...lista.map(a => {
      const r = est.resumo.get(a.id);
      return h('button', { class: 'aluno-btn', type: 'button', 'aria-current': String(a.id === atual), onclick: () => ir('aluno-' + a.id) },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(a.nome)),
        h('span', null, h('strong', null, a.nome), h('small', null, r ? `${r.n} aval. · última ${dataBR(r.ultima)}` : 'Sem avaliação')));
    }));
  }

  /* ----- Navegação ----- */
  function ir(hash) { if (location.hash === '#' + hash) rotear(); else location.hash = hash; }
  async function rotear() {
    if (est.papel !== 'personal') return;
    const r = lerRota(location.hash);
    const p = $('principal');
    $('areaPersonal').classList.toggle('com-foco', r.tela !== 'inicio'); // no celular, esconde a lista de alunos
    try {
      if (r.tela === 'aluno' && alunoPorId(r.id)) { desenharLista(r.id); p.replaceChildren(...await telaAluno(alunoPorId(r.id), r.aba)); }
      else if (r.tela === 'avaliacao' || r.tela === 'editar') {
        const av = await acharAvaliacao(r.id);
        if (!av) return ir('inicio');
        desenharLista(av.aluno_id);
        p.replaceChildren(...(r.tela === 'avaliacao' ? telaResultado(alunoPorId(av.aluno_id), av) : telaFormulario(alunoPorId(av.aluno_id), av)));
      } else if (r.tela === 'nova' && alunoPorId(r.id)) { desenharLista(r.id); p.replaceChildren(...telaFormulario(alunoPorId(r.id), null)); }
      else {
        desenharLista(null);
        p.replaceChildren(h('section', { class: 'card' }, h('h2', null, est.alunos.length ? 'Escolha um aluno' : 'Bem-vindo!'),
          h('p', { class: 'sub' }, est.alunos.length ? 'Toque num aluno da lista para ver avaliações e evolução.' : 'Comece cadastrando seu primeiro aluno em “+ Novo”.'),
          est.personal?.nome === 'Personal' ? h('p', { class: 'aviso' }, 'Dica: informe seu nome em “Meus dados”. Seus alunos veem esse nome no app.') : null));
      }
      window.scrollTo({ top: 0 });
    } catch (e) { aviso('msgGlobal', erroBanco(e)); }
  }
  async function acharAvaliacao(id) {
    for (const lista of est.avs.values()) { const a = lista.find(x => x.id === id); if (a) return a; }
    const { data } = await db.from('avaliacoes').select('*').eq('id', id).maybeSingle();
    if (data) await avaliacoesDe(data.aluno_id, true);
    return data;
  }

  /* ----- Tela do aluno (personal) ----- */
  async function telaAluno(a, aba) {
    const avs = await avaliacoesDe(a.id);
    const idade = K.idadeEm(a.nascimento, hojeISO());
    const cab = h('section', { class: 'card' }, h('div', { class: 'perfil' },
      h('div', null, h('h2', null, a.nome), h('div', { class: 'meta' },
        h('span', null, a.sexo === 'F' ? 'Feminino' : 'Masculino'), h('span', { class: 'num' }, `${idade} anos`), h('span', null, K.ROTULO_ETNIA[a.etnia]),
        a.usuario_id ? h('span', { class: 'chip bom' }, 'Acessa o app') : h('span', { class: 'chip' }, 'Sem acesso ao app'))),
      h('div', { class: 'linha' },
        h('button', { class: 'btn', type: 'button', onclick: () => abrirAluno(a) }, 'Editar'),
        h('button', { class: 'btn', type: 'button', onclick: () => abrirConvite(a) }, a.usuario_id ? 'Acesso do aluno' : 'Convidar'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => ir('nova-' + a.id) }, '+ Nova avaliação'))));
    const abas = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Seções do aluno' },
      [['avaliacoes', 'Avaliações', ''], ['evolucao', 'Evolução', '-evolucao'], ['comparar', 'Comparar', '-comparar']].map(([k, t, suf]) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(aba === k), onclick: () => ir('aluno-' + a.id + suf) }, t)));
    let corpo;
    if (!avs.length) corpo = h('section', { class: 'card' }, h('p', { class: 'aviso' }, `${primeiro(a.nome)} ainda não tem avaliação. Toque em “+ Nova avaliação” para registrar a primeira.`));
    else if (aba === 'evolucao') corpo = h('section', { class: 'card' }, h('div', { class: 'card-topo' }, h('div', null, h('h2', null, 'Evolução'), h('p', { class: 'sub' }, `${avs.length} avaliações. Verde quando a mudança vai na direção desejada.`))),
      h('div', { class: 'graficos' }, SERIES.map(sr => grafico(a, avs, sr))));
    else if (aba === 'comparar') corpo = telaComparar(a, avs);
    else corpo = h('section', { class: 'card' }, h('div', { class: 'card-topo' }, h('div', null, h('h2', null, 'Avaliações'), h('p', { class: 'sub' }, 'Toque numa avaliação para ver o resultado completo.'))),
      h('div', { class: 'lista-av' }, [...avs].reverse().map(v => { const c = K.calcular(a, v); return h('button', { class: 'av-item', type: 'button', onclick: () => ir('av-' + v.id) },
        h('span', null, h('strong', null, dataBR(v.data))),
        h('span', null, h('span', { class: 'k' }, 'Peso'), h('span', { class: 'v' }, `${fmt(v.peso)} kg`)),
        h('span', null, h('span', { class: 'k' }, 'Gordura'), h('span', { class: 'v' }, c.gordura == null ? '—' : `${fmt(c.gordura)}%`)),
        h('span', { class: 'some-cel' }, h('span', { class: 'k' }, 'M. muscular'), h('span', { class: 'v' }, c.massaMuscular == null ? '—' : `${fmt(c.massaMuscular)} kg`))); })));
    const voltar = h('div', { class: 'linha so-cel' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => ir('inicio') }, '‹ Alunos'));
    return [voltar, cab, abas, corpo];
  }

  /* ----- Resultado de uma avaliação ----- */
  function telaResultado(a, v) {
    const c = K.calcular(a, v);
    const regua = z => h('td', null, h('div', { class: 'regua', title: `Escore-Z ${fmt(z, 2)}` }, (() => { const i = h('i'); i.style.left = `${Math.max(0, Math.min(100, (z + 3) / 6 * 100))}%`; return i; })()));
    const kpi = (k, valor, un, extra) => h('div', { class: 'kpi' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, valor, un ? h('small', null, un) : null), extra);
    const forca = (nome, f, rm, rel, classe) => h('tr', null, h('td', null, nome), h('td', { class: 'n' }, f ? `${fmt(f.carga, 0)} × ${f.reps}` : '—'), h('td', { class: 'n' }, fmt(rm)), h('td', { class: 'n' }, fmt(rel, 2)), h('td', null, classe));
    return [
      h('div', { class: 'linha nao-imprimir' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => ir('aluno-' + a.id) }, `‹ ${a.nome}`)),
      h('section', { class: 'card' },
        h('div', { class: 'card-topo' }, h('div', null, h('h2', null, `${a.nome} · ${dataBR(v.data)}`), h('p', { class: 'sub num' }, `${c.idade} anos · ${fmt(v.peso)} kg · ${fmt(v.altura, 2)} m · IMC ${fmt(c.imc)}`)),
          h('div', { class: 'linha nao-imprimir' },
            h('button', { class: 'btn perigo-leve', type: 'button', onclick: () => excluirAvaliacao(a, v) }, 'Excluir'),
            h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, 'Imprimir / PDF'),
            h('button', { class: 'btn primary', type: 'button', onclick: () => ir('editar-' + v.id) }, 'Editar'))),
        h('div', { class: 'kpis' },
          kpi('Gordura', fmt(c.gordura), c.gordura == null ? null : '%', chip(c.classeGordura)),
          kpi('Massa muscular', fmt(c.massaMuscular), c.massaMuscular == null ? null : 'kg', chip(c.classeMuscular)),
          kpi('Massa gorda / magra', fmt(c.massaGorda), c.massaGorda == null ? null : `/ ${fmt(c.massaMagra)} kg`),
          kpi('Σ 8 dobras', fmt(c.somaDobras, 0), c.somaDobras == null ? null : 'mm', h('span', { class: 'sub num' }, `Periférico ${fmt(c.dobrasPerifericas, 0)} · Central ${fmt(c.dobrasCentrais, 0)}`)))),
      h('div', { class: 'dois' },
        h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Perímetros (cm)'), h('div', { class: 'tabela' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Local'), h('th', { class: 'n' }, 'Medida'), h('th', null, 'Proporção'), h('th'))),
          h('tbody', null, K.PERIMETROS.filter(([k]) => v.perimetros?.[k] != null).map(([k, n]) => { const z = c.zPerimetros[k];
            return h('tr', null, h('td', null, n), h('td', { class: 'n' }, fmt(v.perimetros[k])), z == null ? h('td') : regua(z), h('td', null, z == null ? null : chip(K.classeProporcao(z)))); }),
            c.perimetroMuscularBraco == null ? null : h('tr', null, h('td', null, 'Perímetro muscular do braço'), h('td', { class: 'n' }, fmt(c.perimetroMuscularBraco)), h('td'), h('td')))))),
        h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Dobras cutâneas (mm)'), h('div', { class: 'tabela' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Dobra'), h('th', { class: 'n' }, 'Média'), h('th', null, 'Proporção'), h('th'))),
          h('tbody', null, K.DOBRAS.filter(([k]) => c.dobras[k] != null).map(([k, n]) => h('tr', null, h('td', null, n), h('td', { class: 'n' }, fmt(c.dobras[k])), regua(c.zDobras[k]), h('td', null, chip(K.classeProporcao(c.zDobras[k])))))))),
          h('p', { class: 'aviso' }, 'Proporção compara a medida com um corpo de referência ajustado à altura do aluno (modelo Phantom). O ponto no meio da régua é a média.'))),
      h('div', { class: 'dois' },
        h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Força (1RM estimado)'), h('div', { class: 'tabela' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Exercício'), h('th', { class: 'n' }, 'Carga × reps'), h('th', { class: 'n' }, '1RM'), h('th', { class: 'n' }, '÷ peso'), h('th', null, 'Classificação'))),
          h('tbody', null, forca('Supino reto', v.forca?.supino, c.supino1RM, c.supinoRelativo, c.supino1RM == null ? null : chip(c.classeSupino)),
            forca('Leg press', v.forca?.leg_press, c.legPress1RM, c.legPressRelativo, c.legPress1RM == null ? null : h('span', { class: 'chip destaque' }, 'Tabela a definir'))))),
          h('p', { class: 'aviso' }, '1RM pela fórmula de Epley. A classificação do leg press depende da tabela de referência a escolher.')),
        h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Coração e exames'), h('div', { class: 'tabela' }, h('table', null, h('tbody', null,
          h('tr', null, h('td', null, 'FC repouso / máxima / reserva'), h('td', { class: 'n' }, `${v.fc_repouso ?? '—'} / ${c.fcMaxima} / ${c.fcReserva ?? '—'} bpm`), h('td')),
          v.pas == null ? null : h('tr', null, h('td', null, 'Pressão arterial'), h('td', { class: 'n' }, `${v.pas}/${v.pad} mmHg`), h('td', null, chip(c.pressao))),
          Object.entries(K.EXAMES).filter(([k]) => v[k] != null).map(([k, e]) => h('tr', null, h('td', null, e.nome, ' ', h('span', { class: 'sub' }, `(ref. ${e.referencia})`)), h('td', { class: 'n' }, `${fmt(v[k], 0)} ${e.unidade}`), h('td', null, chip(K.classeExame(k, Number(v[k])))))))))) ),
      h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Parecer do avaliador'), h('p', { class: 'parecer' }, v.parecer || 'Sem parecer.'))
    ];
  }
  async function excluirAvaliacao(a, v) {
    if (!(await confirmar({ titulo: 'Excluir avaliação?', texto: `A avaliação de ${dataBR(v.data)} de ${a.nome} será apagada. Não dá para desfazer.` }))) return;
    const { error } = await db.from('avaliacoes').delete().eq('id', v.id);
    if (error) { aviso('msgGlobal', erroBanco(error)); return; }
    await avaliacoesDe(a.id, true); await carregarPersonal();
    aviso('msgGlobal', 'Avaliação excluída.', true); ir('aluno-' + a.id);
  }

  /* ----- Gráficos ----- */
  const SERIES = [
    { t: 'Peso', un: 'kg', des: 0, f: (v, c) => Number(v.peso) },
    { t: 'Gordura', un: '%', des: -1, f: (v, c) => c.gordura },
    { t: 'Massa muscular', un: 'kg', des: 1, f: (v, c) => c.massaMuscular },
    { t: 'Σ 8 dobras', un: 'mm', des: -1, f: (v, c) => c.somaDobras },
    { t: 'Cintura', un: 'cm', des: -1, f: v => v.perimetros?.cintura ?? null },
    { t: '1RM supino', un: 'kg', des: 1, f: (v, c) => c.supino1RM }
  ];
  function grafico(a, avs, sr) {
    const pts = avs.map(v => ({ d: v.data, y: sr.f(v, K.calcular(a, v)) })).filter(p => Number.isFinite(p.y));
    if (pts.length < 2) return h('div', { class: 'grafico' }, h('h3', null, sr.t), h('p', { class: 'sub' }, 'Aparece com 2 avaliações que tenham essa medida.'));
    const W = 300, H = 130, L = 38, R = 12, T = 12, B = 22;
    let lo = Math.min(...pts.map(p => p.y)), hi = Math.max(...pts.map(p => p.y));
    const folga = (hi - lo || Math.abs(hi) * 0.05 || 1) * 0.25; lo -= folga; hi += folga;
    const x = i => L + (W - L - R) * (i / (pts.length - 1)), y = val => T + (H - T - B) * (1 - (val - lo) / (hi - lo));
    const marcas = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15], casas = hi - lo < 6 ? 1 : 0;
    const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
    const dif = pts.at(-1).y - pts[0].y;
    return h('div', { class: 'grafico' },
      h('h3', null, h('span', null, sr.t, ' ', h('span', { class: 'sub' }, `(${sr.un})`)), h('span', { class: 'delta ' + sentido(dif, sr.des) }, `${dif > 0 ? '+' : ''}${fmt(dif)} ${sr.un}`)),
      s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${sr.t}: de ${fmt(pts[0].y)} para ${fmt(pts.at(-1).y)} ${sr.un}` },
        marcas.map(m => [s('line', { x1: L, x2: W - R, y1: y(m), y2: y(m), stroke: 'var(--line)', 'stroke-width': 1 }), s('text', { x: L - 6, y: y(m) + 4, 'text-anchor': 'end', class: 'eixo' }, fmt(m, casas))]),
        s('path', { d: `${linha}L${x(pts.length - 1).toFixed(1)},${H - B}L${x(0).toFixed(1)},${H - B}Z`, fill: 'var(--accent-soft)', opacity: '.7' }),
        s('path', { d: linha, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }),
        pts.map((p, i) => [s('circle', { cx: x(i), cy: y(p.y), r: i === pts.length - 1 ? 4.5 : 3, fill: i === pts.length - 1 ? 'var(--accent)' : 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 2 }, s('title', null, `${dataBR(p.d)}: ${fmt(p.y)} ${sr.un}`)),
          s('text', { x: x(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle', class: 'eixo' }, dataCurta(p.d))])));
  }

  /* ----- Comparar ----- */
  function telaComparar(a, avs) {
    if (avs.length < 2) return h('section', { class: 'card' }, h('p', { class: 'aviso' }, 'É preciso ter duas avaliações para comparar.'));
    const sel = (id, padrao) => h('select', { id, onchange: atualizar }, avs.map(v => h('option', { value: v.id, selected: v.id === padrao.id }, dataBR(v.data))));
    const sa = sel('compA', avs[0]), sb = sel('compB', avs.at(-1)), corpo = h('tbody');
    function atualizar() {
      const A = avs.find(v => v.id === sa.value), B = avs.find(v => v.id === sb.value), ca = K.calcular(a, A), cb = K.calcular(a, B);
      const linhas = [['Peso (kg)', +A.peso, +B.peso, 0], ['Gordura (%)', ca.gordura, cb.gordura, -1], ['Massa muscular (kg)', ca.massaMuscular, cb.massaMuscular, 1], ['Massa gorda (kg)', ca.massaGorda, cb.massaGorda, -1],
        ['Σ 8 dobras (mm)', ca.somaDobras, cb.somaDobras, -1], ['Dobras centrais (mm)', ca.dobrasCentrais, cb.dobrasCentrais, -1],
        ...K.PERIMETROS.map(([k, n]) => [`${n} (cm)`, A.perimetros?.[k], B.perimetros?.[k], ['cintura', 'abdomen'].includes(k) ? -1 : 0]),
        ['1RM supino (kg)', ca.supino1RM, cb.supino1RM, 1], ['1RM leg press (kg)', ca.legPress1RM, cb.legPress1RM, 1], ['FC de repouso (bpm)', A.fc_repouso, B.fc_repouso, -1], ['Pressão sistólica (mmHg)', A.pas, B.pas, -1]]
        .filter(([, x, y]) => x != null || y != null);
      corpo.replaceChildren(...linhas.map(([n, x, y, d]) => { const dif = x != null && y != null ? y - x : null;
        return h('tr', null, h('td', null, n), h('td', { class: 'n' }, fmt(x)), h('td', { class: 'n' }, fmt(y)), h('td', { class: 'n' }, dif == null ? '—' : h('span', { class: 'delta ' + sentido(dif, d) }, `${dif > 0 ? '+' : ''}${fmt(dif)}`))); }));
    }
    atualizar();
    return h('section', { class: 'card' }, h('div', { class: 'card-topo' }, h('div', null, h('h2', null, 'Comparar avaliações'), h('p', { class: 'sub' }, 'Escolha quaisquer duas.')),
      h('div', { class: 'linha' }, h('label', { class: 'campo' }, 'Avaliação A', sa), h('label', { class: 'campo' }, 'Avaliação B', sb))),
      h('div', { class: 'tabela' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Medida'), h('th', { class: 'n' }, 'A'), h('th', { class: 'n' }, 'B'), h('th', { class: 'n' }, 'Diferença'))), corpo)));
  }

  /* ----- Nova avaliação / editar, em etapas ----- */
  const PASSOS = ['Básico', 'Exames', 'Perímetros', 'Dobras', 'Força', 'Parecer'];
  function telaFormulario(a, existente) {
    const chave = existente ? 'e:' + existente.id : 'n:' + a.id;
    if (est.rascunhoChave !== chave) {
      const avs = est.avs.get(a.id) || [];
      est.rascunho = existente ? rascunhoDe(existente) : rascunhoVazio(hojeISO(), avs.at(-1)?.altura);
      est.passo = 0; est.rascunhoChave = chave;
    }
    const r = est.rascunho, p = est.passo;
    const campo = (rot, obj, k, extra = {}) => h('label', { class: 'campo' }, rot,
      h('input', { inputMode: extra.modo || 'decimal', value: obj[k] ?? '', autocomplete: 'off', oninput: ev => { obj[k] = ev.target.value; vivo(); }, ...extra.attrs }));
    let corpo;
    if (p === 0) corpo = h('div', { class: 'campos' },
      h('label', { class: 'campo' }, 'Data', h('input', { type: 'date', value: r.data, max: hojeISO(), oninput: ev => { r.data = ev.target.value; } })),
      campo(['Peso ', h('span', { class: 'fraco' }, '(kg)')], r, 'peso'), campo(['Altura ', h('span', { class: 'fraco' }, '(m)')], r, 'altura'),
      campo(['FC de repouso ', h('span', { class: 'fraco' }, '(bpm)')], r, 'fc_repouso', { modo: 'numeric' }),
      campo(['Pressão sistólica ', h('span', { class: 'fraco' }, '(mmHg)')], r, 'pas', { modo: 'numeric' }), campo(['Pressão diastólica ', h('span', { class: 'fraco' }, '(mmHg)')], r, 'pad', { modo: 'numeric' }));
    if (p === 1) corpo = h('div', null, h('p', { class: 'sub' }, 'Opcional. Preencha só os exames que o aluno trouxe.'),
      h('div', { class: 'campos' }, Object.entries(K.EXAMES).map(([k, e]) => campo([e.nome + ' ', h('span', { class: 'fraco' }, `(${e.unidade})`)], r, k))));
    if (p === 2) corpo = h('div', { class: 'campos' }, K.PERIMETROS.map(([k, n]) => campo([n + ' ', h('span', { class: 'fraco' }, '(cm)')], r.per, k)));
    if (p === 3) {
      const medias = new Map();
      const atualizarMedia = k => { const m = K.mediaDobra([K.lerNumero(r.dob1[k]), K.lerNumero(r.dob2[k])].filter(Number.isFinite)); medias.get(k).textContent = m == null ? '—' : fmt(m); };
      corpo = h('div', null, h('div', { class: 'dobra cab' }, h('span', null, 'Dobra (mm)'), h('span', null, '1ª medida'), h('span', null, '2ª medida'), h('span', { class: 'media' }, 'Média')),
        K.DOBRAS.map(([k, n]) => { const m = h('span', { class: 'media num' }, '—'); medias.set(k, m);
          const inp = (obj, rot) => h('input', { inputMode: 'decimal', value: obj[k] ?? '', autocomplete: 'off', 'aria-label': `${n}, ${rot}`, oninput: ev => { obj[k] = ev.target.value; atualizarMedia(k); vivo(); } });
          return h('div', { class: 'dobra' }, h('span', null, n), inp(r.dob1, '1ª medida'), inp(r.dob2, '2ª medida'), m); }));
      queueMicrotask(() => K.DOBRAS.forEach(([k]) => atualizarMedia(k)));
    }
    if (p === 4) corpo = h('div', null, h('p', { class: 'sub' }, 'Carga levantada e repetições até a falha (até 10 para uma boa estimativa).'),
      h('div', { class: 'campos' }, campo(['Supino: carga ', h('span', { class: 'fraco' }, '(kg)')], r, 'supC'), campo('Supino: repetições', r, 'supR', { modo: 'numeric' }),
        campo(['Leg press: carga ', h('span', { class: 'fraco' }, '(kg)')], r, 'legC'), campo('Leg press: repetições', r, 'legR', { modo: 'numeric' })));
    if (p === 5) corpo = h('label', { class: 'campo' }, ['Parecer descritivo ', h('span', { class: 'fraco' }, '(o aluno também vê este texto)')],
      h('textarea', { maxlength: '4000', oninput: ev => { r.parecer = ev.target.value; } }, r.parecer));
    const erro = h('p', { class: 'msg', role: 'alert' });
    const painel = h('aside', { class: 'ao-vivo', 'aria-live': 'polite' });
    function vivo() {
      const { registro, erros } = montarAvaliacao(r);
      if (erros.length || !registro.peso) { painel.replaceChildren(h('div', { class: 'kpi' }, h('span', { class: 'k' }, 'Resultado na hora'), h('span', { class: 'sub' }, 'Aparece conforme você preenche peso, altura, perímetros e dobras.'))); return; }
      const c = K.calcular(a, registro);
      painel.replaceChildren(
        h('div', { class: 'kpi' }, h('span', { class: 'k' }, 'Gordura'), h('span', { class: 'v' }, fmt(c.gordura), c.gordura == null ? null : h('small', null, '%')), c.gordura == null ? h('span', { class: 'sub' }, 'Falta tríceps, subescapular, suprailíaca ou abdominal.') : chip(c.classeGordura)),
        h('div', { class: 'kpi' }, h('span', { class: 'k' }, 'Massa muscular'), h('span', { class: 'v' }, fmt(c.massaMuscular), c.massaMuscular == null ? null : h('small', null, 'kg')), c.massaMuscular == null ? h('span', { class: 'sub' }, 'Precisa de braço D, coxa média D, panturrilha D e as dobras deles.') : chip(c.classeMuscular)));
    }
    const irPasso = n => { est.passo = n; rotear(); };
    async function salvar(botao) {
      const { registro, erros } = montarAvaliacao(r);
      if (erros.length) { erro.textContent = erros.join(' '); return; }
      botao.disabled = true; erro.textContent = '';
      const q = existente ? db.from('avaliacoes').update(registro).eq('id', existente.id).select().single()
        : db.from('avaliacoes').insert({ ...registro, aluno_id: a.id }).select().single();
      const { data, error } = await q;
      botao.disabled = false;
      if (error) { erro.textContent = erroBanco(error); return; }
      est.rascunhoChave = null;
      await avaliacoesDe(a.id, true); await carregarPersonal();
      aviso('msgGlobal', existente ? 'Avaliação atualizada.' : 'Avaliação salva.', true);
      ir('av-' + data.id);
    }
    const ult = p === PASSOS.length - 1;
    const botaoSalvar = h('button', { class: 'btn primary', type: 'button', onclick: ev => salvar(ev.currentTarget) }, existente ? 'Salvar alterações' : 'Salvar avaliação');
    queueMicrotask(vivo);
    return [
      h('div', { class: 'linha' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { est.rascunhoChave = null; ir(existente ? 'av-' + existente.id : 'aluno-' + a.id); } }, '‹ Cancelar')),
      h('section', { class: 'card' },
        h('div', { class: 'card-topo' }, h('div', null, h('h2', null, `${existente ? 'Editar avaliação' : 'Nova avaliação'} · ${a.nome}`), h('p', { class: 'sub' }, `Etapa ${p + 1} de ${PASSOS.length}: ${PASSOS[p]}`)), existente || p > 0 ? botaoSalvar : null),
        h('nav', { class: 'passos', 'aria-label': 'Etapas' }, PASSOS.map((t, i) => h('button', { type: 'button', class: i < p ? 'feito' : '', 'aria-current': i === p ? 'step' : null, onclick: () => irPasso(i) }, `${i + 1}. ${t}`))),
        h('div', { class: 'form-layout' },
          h('div', null, corpo,
            h('div', { class: 'form-pe' }, h('button', { class: 'btn', type: 'button', disabled: p === 0, onclick: () => irPasso(p - 1) }, '‹ Voltar'),
              ult ? h('button', { class: 'btn primary', type: 'button', onclick: ev => salvar(ev.currentTarget) }, existente ? 'Salvar alterações' : 'Salvar avaliação')
                : h('button', { class: 'btn primary', type: 'button', onclick: () => irPasso(p + 1) }, 'Próximo ›')),
            erro),
          painel))
    ];
  }

  /* ----- Cadastro e edição do aluno ----- */
  function abrirAluno(a = null) {
    est.editandoAluno = a;
    $('alunoDlgTitulo').textContent = a ? 'Editar aluno' : 'Novo aluno';
    $('alNome').value = a?.nome || ''; $('alSexo').value = a?.sexo || 'F'; $('alNasc').value = a?.nascimento || ''; $('alNasc').max = hojeISO();
    $('alEtnia').value = a?.etnia || 'branca'; $('alContato').value = a?.contato || '';
    $('alExcluir').classList.toggle('hidden', !a);
    aviso('alunoMsg', ''); $('alunoDialog').showModal(); $('alNome').focus();
  }
  $('alunoForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const dados = { nome: $('alNome').value.trim().replace(/\s+/g, ' '), sexo: $('alSexo').value, nascimento: $('alNasc').value, etnia: $('alEtnia').value, contato: $('alContato').value.trim() || null };
    if (!dados.nome) return aviso('alunoMsg', 'Informe o nome.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.nascimento) || dados.nascimento > hojeISO() || dados.nascimento < '1900-01-01') return aviso('alunoMsg', 'Informe uma data de nascimento válida.');
    $('alSalvar').disabled = true;
    const a = est.editandoAluno;
    const { data, error } = a ? await db.from('alunos').update(dados).eq('id', a.id).select('id').single() : await db.from('alunos').insert(dados).select('id').single();
    $('alSalvar').disabled = false;
    if (error) return aviso('alunoMsg', erroBanco(error));
    $('alunoDialog').close(); await carregarPersonal();
    aviso('msgGlobal', a ? 'Dados do aluno atualizados.' : 'Aluno cadastrado.', true);
    ir('aluno-' + data.id);
  });
  $('alExcluir').addEventListener('click', async () => {
    const a = est.editandoAluno; if (!a) return;
    $('alunoDialog').close();
    if (!(await confirmar({ titulo: 'Excluir aluno e todos os dados?', botao: 'Excluir tudo', texto: `${a.nome}, todas as avaliações${a.usuario_id ? ', o aceite do termo e o acesso ao app' : ''} serão apagados de vez. Use quando o aluno pedir a exclusão dos dados (LGPD). Não dá para desfazer.` }))) return;
    const { data, error } = await db.rpc('excluir_aluno', { p_aluno: a.id });
    if (error || !data) return aviso('msgGlobal', erroBanco(error));
    est.avs.delete(a.id); await carregarPersonal();
    aviso('msgGlobal', 'Aluno e dados excluídos.', true); ir('inicio');
  });
  $('novoAlunoBtn').addEventListener('click', () => abrirAluno());
  $('buscaAluno').addEventListener('input', ev => { est.busca = ev.target.value; desenharLista(lerRota(location.hash).id); });

  /* ----- Meus dados (personal) ----- */
  $('perfilBtn').addEventListener('click', () => { $('pfNome').value = est.personal?.nome === 'Personal' ? '' : est.personal?.nome || ''; $('pfCref').value = est.personal?.cref || ''; aviso('perfilMsg', ''); $('perfilDialog').showModal(); $('pfNome').focus(); });
  $('perfilForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const nome = $('pfNome').value.trim().replace(/\s+/g, ' '), cref = $('pfCref').value.trim() || null;
    if (!nome) return aviso('perfilMsg', 'Informe seu nome.');
    const { error } = await db.from('personais').update({ nome, cref }).eq('usuario_id', est.usuario.id);
    if (error) return aviso('perfilMsg', erroBanco(error));
    $('perfilDialog').close(); await carregarPersonal(); rotear();
  });

  /* ----- Convite do aluno ----- */
  async function abrirConvite(a) {
    est.conviteAluno = a;
    $('convLinkCaixa').classList.add('hidden'); aviso('convDlgMsg', '');
    $('convCompartilhar').classList.add('hidden'); $('convCancelar').classList.add('hidden');
    $('convDlgTitulo').textContent = a.usuario_id ? 'Acesso do aluno' : `Convidar ${primeiro(a.nome)}`;
    $('convGerar').classList.toggle('hidden', !!a.usuario_id);
    if (a.usuario_id) {
      $('convDlgTexto').textContent = `${primeiro(a.nome)} já acessa o app e vê as próprias avaliações, a evolução e o seu parecer. Para tirar o acesso e apagar os dados, use “Editar” › “Excluir aluno e dados”.`;
    } else {
      $('convDlgTexto').textContent = 'Conferindo…';
      const { data } = await db.rpc('convite_do_aluno', { p_aluno: a.id });
      const c = data?.[0];
      const pend = c?.situacao === 'pendente';
      $('convDlgTexto').textContent = pend
        ? `Há um link ativo até ${new Date(c.expira_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Por segurança, o link só aparece na hora em que é gerado. Se precisar dele de novo, gere outro: o anterior deixa de funcionar.`
        : `Gere um link e envie para ${primeiro(a.nome)}. Com ele, o aluno aceita o termo de uso dos dados, cria uma senha e passa a ver a própria evolução. O link vale por 7 dias e funciona uma vez.`;
      $('convGerar').textContent = pend ? 'Gerar outro link' : 'Gerar link';
      $('convCancelar').classList.toggle('hidden', !pend);
    }
    $('conviteDialog').showModal();
  }
  $('convGerar').addEventListener('click', async () => {
    const a = est.conviteAluno; $('convGerar').disabled = true;
    const { data, error } = await db.rpc('criar_convite_aluno', { p_aluno: a.id });
    $('convGerar').disabled = false;
    if (error || !data?.[0]?.codigo) return aviso('convDlgMsg', error?.message?.includes('já tem acesso') ? 'Este aluno já tem acesso.' : erroBanco(error));
    $('convLink').value = linkConvite(location.origin + location.pathname, data[0].codigo);
    $('convLinkCaixa').classList.remove('hidden'); $('convGerar').classList.add('hidden'); $('convCancelar').classList.remove('hidden');
    $('convCompartilhar').classList.toggle('hidden', !navigator.share);
    $('convDlgTexto').textContent = 'Link criado. Copie e envie agora: por segurança, ele não aparece de novo. Vale por 7 dias e funciona uma única vez.';
    $('convLink').select();
  });
  $('convCopiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('convLink').value); aviso('convDlgMsg', 'Link copiado. Agora é só colar na conversa com o aluno.', true); }
    catch (_) { $('convLink').select(); aviso('convDlgMsg', 'Selecione o link e copie.', true); }
  });
  $('convCompartilhar').addEventListener('click', () => navigator.share?.({ title: 'Sua avaliação física', text: 'Crie seu acesso para acompanhar sua evolução (o link vale por 7 dias):', url: $('convLink').value }).catch(() => {}));
  $('convCancelar').addEventListener('click', async () => {
    const { error } = await db.rpc('cancelar_convite_aluno', { p_aluno: est.conviteAluno.id });
    if (error) return aviso('convDlgMsg', erroBanco(error));
    $('conviteDialog').close(); aviso('msgGlobal', 'Convite cancelado: o link parou de funcionar.', true);
  });

  /* ----- Visão do aluno ----- */
  async function telaDoAluno() {
    const [{ data: eu }, { data: avs, error }, { data: pers }] = await Promise.all([
      db.from('alunos').select('id,nome,sexo,nascimento,etnia').eq('usuario_id', est.usuario.id).single(),
      db.from('avaliacoes').select('*').order('data').order('criado_em'),
      db.from('personais').select('nome').limit(1).maybeSingle()]);
    if (error || !eu) throw error || new Error('sem ficha');
    $('quemSou').textContent = eu.nome;
    const area = $('areaAluno'), personal = pers?.nome && pers.nome !== 'Personal' ? pers.nome : 'seu personal';
    if (!avs.length) { area.replaceChildren(h('section', { class: 'card ola' }, h('p', { class: 'sub' }, 'Olá,'), h('h2', null, primeiro(eu.nome)), h('p', { class: 'aviso' }, `Você ainda não tem avaliação registrada. Assim que ${personal} registrar a primeira, ela aparece aqui.`))); return; }
    const ult = avs.at(-1), pri = avs[0], c = K.calcular(eu, ult), c0 = K.calcular(eu, pri), varias = avs.length > 1;
    const delta = (dif, un, d) => !varias || !Number.isFinite(dif) ? null : h('span', { class: 'delta ' + sentido(dif, d) }, `${dif > 0 ? '▲ +' : dif < 0 ? '▼ ' : ''}${fmt(dif)} ${un} desde ${dataCurta(pri.data)}`);
    const kpi = (k, valor, un, ...extra) => h('div', { class: 'kpi' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, fmt(valor), valor == null ? null : h('small', null, un)), ...extra);
    const frase = (nome, dif, un, d, sobe, desce) => !Number.isFinite(dif) ? null : h('li', null, Math.abs(dif) < 0.05 ? `${nome} se manteve estável.` : `${nome} ${dif > 0 ? sobe : desce} ${fmt(Math.abs(dif))} ${un}${sentido(dif, d) === 'bom' ? ' — ótimo sinal.' : '.'}`);
    area.replaceChildren(
      h('section', { class: 'card ola' }, h('p', { class: 'sub' }, 'Olá,'), h('h2', null, `${primeiro(eu.nome)}, aqui está sua evolução`), h('p', { class: 'sub' }, `Última avaliação em ${dataBR(ult.data)} · ${avs.length} ${avs.length === 1 ? 'avaliação' : 'avaliações'} com ${personal}`)),
      h('div', { class: 'grandes' },
        kpi('Gordura corporal', c.gordura, '%', delta(c.gordura - c0.gordura, 'pontos', -1), c.classeGordura ? chip(c.classeGordura) : null),
        kpi('Massa muscular', c.massaMuscular, 'kg', delta(c.massaMuscular - c0.massaMuscular, 'kg', 1)),
        kpi('Peso', Number(ult.peso), 'kg', delta(ult.peso - pri.peso, 'kg', 0)),
        kpi('Cintura', ult.perimetros?.cintura ?? null, 'cm', delta((ult.perimetros?.cintura ?? NaN) - (pri.perimetros?.cintura ?? NaN), 'cm', -1))),
      varias ? h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Em resumo'), h('ul', { class: 'resumo' },
        frase('Sua gordura corporal', c.gordura - c0.gordura, 'pontos percentuais', -1, 'subiu', 'caiu'),
        frase('Sua massa muscular', c.massaMuscular - c0.massaMuscular, 'kg', 1, 'aumentou', 'diminuiu'),
        frase('Sua cintura', (ult.perimetros?.cintura ?? NaN) - (pri.perimetros?.cintura ?? NaN), 'cm', -1, 'aumentou', 'diminuiu'),
        frase('Sua força no supino', (c.supino1RM ?? NaN) - (c0.supino1RM ?? NaN), 'kg', 1, 'aumentou', 'diminuiu'),
        c.pressao ? h('li', null, `Sua pressão na última avaliação: ${ult.pas}/${ult.pad} (${c.pressao.texto.toLowerCase()}).`) : null)) : null,
      varias ? h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Seus gráficos'), h('div', { class: 'graficos' }, SERIES.filter(sr => ['Gordura', 'Massa muscular', 'Peso', 'Cintura'].includes(sr.t)).map(sr => grafico(eu, avs, sr)))) : null,
      h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, `Recado de ${personal}`), h('p', { class: 'parecer' }, ult.parecer || 'Sem recado nesta avaliação.')),
      h('p', { class: 'aviso' }, `Você só vê os seus dados. Para corrigir alguma informação ou pedir a exclusão dos seus dados, fale com ${personal}.`));
  }

  /* ----- Entrar, sair e convite ----- */
  async function entrar(sessao) {
    est.usuario = sessao.user; est.avs.clear();
    const { data: papel, error } = await db.rpc('meu_papel');
    if (error) { mostrar('loginView'); aviso('loginMsg', erroBanco(error)); return; }
    est.papel = papel;
    mostrar('appView');
    $('areaPersonal').classList.toggle('hidden', papel !== 'personal'); $('areaAluno').classList.toggle('hidden', papel !== 'aluno');
    $('perfilBtn').classList.toggle('hidden', papel !== 'personal');
    try {
      if (papel === 'personal') { await carregarPersonal(); rotear(); }
      else if (papel === 'aluno') await telaDoAluno();
      else { $('areaAluno').classList.remove('hidden'); $('areaAluno').replaceChildren(h('section', { class: 'card' }, h('h2', null, 'Acesso sem ficha'), h('p', { class: 'sub' }, 'Este login não está ligado a nenhuma ficha de aluno. Peça um novo convite ao seu personal.'))); }
    } catch (e) { aviso('msgGlobal', erroBanco(e)); }
  }
  function sair() {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    Object.assign(est, { papel: null, usuario: null, personal: null, alunos: [], rascunho: null, rascunhoChave: null });
    est.avs.clear(); $('principal').replaceChildren(); $('areaAluno').replaceChildren(); $('listaAlunos').replaceChildren();
    $('senha').value = ''; mostrar('loginView');
  }
  $('loginForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = $('email').value.trim(), senha = $('senha').value;
    if (!email || !senha) return aviso('loginMsg', 'Informe e-mail e senha.');
    $('loginBtn').disabled = true; aviso('loginMsg', 'Entrando…', true);
    const { error } = await db.auth.signInWithPassword({ email, password: senha });
    $('loginBtn').disabled = false;
    aviso('loginMsg', error ? (/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não foi possível entrar. Verifique a conexão.') : '');
  });
  $('sairBtn').addEventListener('click', async () => { esquecerAtividade(); await db.auth.signOut({ scope: 'local' }); });
  window.addEventListener('hashchange', rotear);

  const codigo = codigoDoLink(location.search), conviteLigado = { sim: new URLSearchParams(location.search).has('convite') };
  async function chamarCadastro(corpo) {
    const { data, error } = await db.functions.invoke('registrar-aluno', { body: corpo });
    if (!error) return data;
    let r = null; try { r = await error.context?.json?.(); } catch (_) { /* sem JSON */ }
    const e = new Error(r?.erro || 'Não foi possível falar com o servidor. Verifique a conexão.'); e.codigo = r?.codigo_erro; throw e;
  }
  function conviteInvalido(msg) { $('convCampos').classList.add('hidden'); $('convTitulo').textContent = 'Convite indisponível'; $('convSub').textContent = ''; aviso('convMsg', msg); $('convIrLogin').classList.remove('hidden'); }
  async function abrirTelaConvite(sessao) {
    mostrar('conviteView');
    if (!codigo) return conviteInvalido('Este link de convite está incompleto. Confira se copiou o link inteiro.');
    if (sessao) return conviteInvalido(`Este aparelho já está conectado como ${sessao.user.email}. Saia dessa conta para usar o convite.`);
    try {
      const r = await chamarCadastro({ acao: 'verificar', codigo });
      $('convTitulo').textContent = r.nome ? `${r.nome}, crie seu acesso` : 'Crie seu acesso';
      $('convSub').textContent = `${r.personal && r.personal !== 'Personal' ? r.personal : 'Seu personal'} convidou você para acompanhar suas avaliações físicas e sua evolução.`;
      $('termoVersao').textContent = r.termo; est.termo = r.termo;
      $('convCampos').classList.remove('hidden');
    } catch (e) { conviteInvalido(e.message); }
  }
  $('conviteForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = $('convEmail').value.trim(), senha = $('convSenha').value;
    if (!$('convAceite').checked) return aviso('convMsg', 'Para continuar, leia e aceite o termo de uso dos seus dados.');
    if (!email) return aviso('convMsg', 'Informe seu e-mail.');
    if (senha.length < 10) return aviso('convMsg', 'A senha precisa ter pelo menos 10 caracteres.');
    if (senha !== $('convSenha2').value) return aviso('convMsg', 'As duas senhas não são iguais.');
    $('convBtn').disabled = true; aviso('convMsg', 'Criando seu acesso…', true);
    try {
      await chamarCadastro({ acao: 'cadastrar', codigo, email, senha, aceite: true, termo: est.termo || TERMO_VERSAO });
      conviteLigado.sim = false; history.replaceState(null, '', location.pathname);
      aviso('convMsg', 'Acesso criado! Entrando…', true);
      const { error } = await db.auth.signInWithPassword({ email, password: senha });
      if (error) { mostrar('loginView'); $('email').value = email; aviso('loginMsg', 'Acesso criado. Entre com sua senha.', true); }
    } catch (e) { aviso('convMsg', e.message); if (e.codigo === 'expirado' || e.codigo === 'invalido') conviteInvalido(e.message); }
    finally { $('convBtn').disabled = false; }
  });
  $('convIrLogin').addEventListener('click', () => { conviteLigado.sim = false; history.replaceState(null, '', location.pathname); mostrar('loginView'); });

  /* ----- Saída por inatividade (30 min sem uso neste aparelho) ----- */
  const ATIV = 'ultimaAtividade';
  const lerAtividade = () => { try { return localStorage.getItem(ATIV); } catch (_) { return null; } };
  const marcarAtividade = () => { try { localStorage.setItem(ATIV, String(Date.now())); } catch (_) { /* sem armazenamento */ } };
  const esquecerAtividade = () => { try { localStorage.removeItem(ATIV); } catch (_) { /* sem armazenamento */ } };
  let marca = 0, sessaoAtual = null;
  ['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, () => { if (sessaoAtual && Date.now() - marca > 30000) { marca = Date.now(); marcarAtividade(); } }, { passive: true, capture: true }));
  async function conferirInatividade() {
    if (!sessaoAtual || !expirouPorInatividade(lerAtividade(), Date.now())) return;
    esquecerAtividade(); await db.auth.signOut({ scope: 'local' });
    aviso('loginMsg', 'Por segurança, você saiu depois de 30 minutos sem usar o app. Entre de novo.', true);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferirInatividade(); });
  setInterval(() => { if (document.visibilityState === 'visible') conferirInatividade(); }, 60000);

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

  db.auth.onAuthStateChange((evento, sessao) => {
    if (conviteLigado.sim) { if (evento === 'INITIAL_SESSION') abrirTelaConvite(sessao); sessaoAtual = sessao; return; }
    if (sessao && evento === 'INITIAL_SESSION' && expirouPorInatividade(lerAtividade(), Date.now())) { sessaoAtual = sessao; conferirInatividade(); return; }
    if (sessao && !sessaoAtual) marcarAtividade();
    const outro = sessao && (!sessaoAtual || sessaoAtual.user.id !== sessao.user.id);
    sessaoAtual = sessao;
    if (outro) setTimeout(() => entrar(sessao), 0); // fora do callback, como recomenda o Supabase
    if (!sessao) sair();
  });
}
