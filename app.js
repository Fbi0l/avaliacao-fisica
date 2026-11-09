'use strict';
/* Avaliação Física — telas e lógica. Regras do projeto: nada de HTML montado a partir de dados
   (só createElement/textContent), CSP sem inline, chave publicável apenas. Ver CLAUDE.md. */

// Projeto Supabase "avaliacao-fisica" (São Paulo). Só o endereço e a chave PUBLICÁVEL; nunca a secreta.
const SUPABASE_URL = 'https://rsgbuvjrkrrybzoacjrh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_x1nqjAFBALSgKIXoaDxrXg_pBHxArki';
const TERMO_VERSAO = '2026-11-09'; // igual ao da função registrar-aluno
const TERMO_PERSONAL_VERSAO = '2026-11-05'; // igual ao da função registrar-aluno
const INATIVIDADE_MS = 30 * 60 * 1000;

const K = typeof module !== 'undefined' ? require('./calculos.js')
  : { POSTURA, POSTURA_OBS_MAX, posturaAvaliada, FLEXITESTE, MIN_FLEXITESTE_SUGERIDO, paceTexto, ZONAS_CARGA, zonaCarga, cargasPorZona, zonasFC, PERIMETROS, DOBRAS, EXAMES, MAX_OUTROS_EXERCICIOS, SUGESTOES_EXERCICIOS, chaveExercicio, EQUACOES_GORDURA, equacaoDe, idadeEm, lerNumero, mediaDobra, calcular, classeProporcao, classeExame };

/* ---------- Regras puras (testadas em tests/app.cjs) ---------- */
const doisDigitos = n => String(n).padStart(2, '0');
function hojeISO(agora = new Date()) { return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`; }
const fmt = (v, casas = 1) => v == null || !Number.isFinite(Number(v)) ? '—'
  : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Código do convite no endereço (?convite=… do aluno, ?convite_personal=… do personal): só o formato exato de 43 caracteres. */
function codigoDoLink(search, param = 'convite') {
  const c = new URLSearchParams(search || '').get(param);
  return c && /^[A-Za-z0-9_-]{43}$/.test(c) ? c : null;
}
/** Qual convite o endereço traz: { tipo: 'aluno' | 'personal' | null, codigo }. */
function conviteDoLink(search) {
  const q = new URLSearchParams(search || '');
  if (q.has('convite_personal')) return { tipo: 'personal', codigo: codigoDoLink(search, 'convite_personal') };
  if (q.has('convite')) return { tipo: 'aluno', codigo: codigoDoLink(search, 'convite') };
  return { tipo: null, codigo: null };
}
function linkConvite(base, codigo, param = 'convite') { const u = new URL(base); u.search = ''; u.hash = ''; u.searchParams.set(param, codigo); return u.toString(); }
/** Texto da situação de um convite de personal, para a lista do administrador. */
function situacaoConvite(c) {
  const quando = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  switch (c?.situacao) {
    case 'pendente': return { texto: 'Aguardando', detalhe: `vale até ${quando(c.expira_em)}`, tom: 'atencao', cancelavel: true };
    case 'em_uso': return { texto: 'Em uso agora', detalhe: 'a pessoa está criando o acesso', tom: 'atencao', cancelavel: false };
    case 'usado': return { texto: 'Aceito', detalhe: c.personal_nome ? `por ${c.personal_nome}` : 'acesso criado', tom: 'bom', cancelavel: false };
    case 'cancelado': return { texto: 'Cancelado', detalhe: 'o link não funciona mais', tom: '', cancelavel: false };
    case 'vencido': return { texto: 'Vencido', detalhe: 'passou do prazo de 3 dias', tom: '', cancelavel: false };
    default: return { texto: '—', detalhe: '', tom: '', cancelavel: false };
  }
}
function expirouPorInatividade(ultima, agora, limite = INATIVIDADE_MS) { const t = Number(ultima); return Number.isFinite(t) && t > 0 && agora - t > limite; }

/** Lê a rota do endereço (#aluno-<id>, #aluno-<id>-evolucao, #av-<id>, #nova-<id>, #editar-<id>, #conversa-<id>, #mensagens). */
function lerRota(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const uuid = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
  let m;
  if ((m = h.match(new RegExp(`^aluno-${uuid}(?:-(evolucao|comparar))?$`)))) return { tela: 'aluno', id: m[1], aba: m[2] || 'avaliacoes' };
  if ((m = h.match(new RegExp(`^av-${uuid}$`)))) return { tela: 'avaliacao', id: m[1] };
  if ((m = h.match(new RegExp(`^nova-${uuid}$`)))) return { tela: 'nova', id: m[1] };
  if ((m = h.match(new RegExp(`^editar-${uuid}$`)))) return { tela: 'editar', id: m[1] };
  if ((m = h.match(new RegExp(`^conversa-${uuid}$`)))) return { tela: 'conversa', id: m[1] };
  if (/^(inicio|avaliacoes|evolucao|perfil|mensagens)$/.test(h)) return { tela: h };
  return { tela: 'inicio' };
}

const FAIXAS = {
  peso: [20, 300, 'Peso entre 20 e 300 kg.'], altura: [1, 2.4, 'Altura em metros, entre 1,00 e 2,40 (ex.: 1,72).'],
  fc_repouso: [25, 220, 'FC de repouso entre 25 e 220 bpm.'], pas: [60, 260, 'Pressão sistólica entre 60 e 260 mmHg.'], pad: [30, 160, 'Pressão diastólica entre 30 e 160 mmHg.'],
  glicose: [20, 900, 'Glicose entre 20 e 900 mg/dL.'], triglicerideos: [10, 5000, 'Triglicerídeos entre 10 e 5000 mg/dL.'], ldl: [5, 600, 'LDL entre 5 e 600 mg/dL.'], hdl: [5, 200, 'HDL entre 5 e 200 mg/dL.']
};

/** Campos dos testes físicos no rascunho (texto, como digitado). */
const testesVazios = () => ({ flexao: '', abdominal: '', aerTipo: '', aerDist: '', aerTempo: '', aerFc: '', flex: {} });
/** Rascunho vazio do formulário (texto, como digitado). */
function rascunhoVazio(data, altura) {
  return { data, peso: '', altura: altura == null ? '' : String(altura).replace('.', ','), fc_repouso: '', pas: '', pad: '', glicose: '', triglicerideos: '', ldl: '', hdl: '',
    per: {}, dob1: {}, dob2: {}, equacao: 'faulkner', supC: '', supR: '', legC: '', legR: '', outros: [], testes: testesVazios(), postura: { feita: false, itens: {}, obs: '' }, parecer: '' };
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
  r.outros = (Array.isArray(av.forca?.outros) ? av.forca.outros : []).map(o => ({ nome: o.nome || '', c: t(o.carga), r: t(o.reps) }));
  const ts = av.testes || {};
  r.testes = { flexao: t(ts.flexao), abdominal: t(ts.abdominal), aerTipo: ts.aerobico?.tipo || '', aerDist: t(ts.aerobico?.distancia),
    aerTempo: t(ts.aerobico?.tempo), aerFc: t(ts.aerobico?.fc_final), flex: Object.fromEntries(Object.entries(ts.flexiteste || {}).map(([k, v]) => [k, String(v)])) };
  r.postura = { feita: !!(av.postura && av.postura.itens), itens: { ...(av.postura?.itens || {}) }, obs: av.postura?.obs || '' };
  r.equacao = K.equacaoDe(av);
  r.parecer = av.parecer || '';
  return r;
}

/** Testes físicos do rascunho para o registro, com as mesmas faixas do banco (privado.testes_valida). */
function montarTestes(t, erros) {
  const out = {};
  for (const [k, nome] of [['flexao', 'Flexão de braço'], ['abdominal', 'Abdominal']]) {
    const v = K.lerNumero(t[k]);
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 0 || v > 150) { erros.push(`${nome}: repetições inteiras, de 0 a 150.`); continue; }
    out[k] = v;
  }
  if (t.aerTipo === 'cooper' || t.aerTipo === 'livre') {
    const dist = K.lerNumero(String(t.aerDist ?? '').replace(/\.(?=\d{3}(?!\d))/g, '')); // 2.400 m = 2400
    const tempo = K.lerNumero(t.aerTempo), fc = K.lerNumero(t.aerFc);
    const a = { tipo: t.aerTipo };
    let okAer = true;
    if (dist == null || Number.isNaN(dist) || dist < 100 || dist > 10000) { erros.push('Teste aeróbico: distância em metros, de 100 a 10000.'); okAer = false; }
    else a.distancia = Math.round(dist);
    if (t.aerTipo === 'livre') {
      if (tempo == null || Number.isNaN(tempo) || tempo < 1 || tempo > 300) { erros.push('Teste aeróbico: tempo em minutos, de 1 a 300.'); okAer = false; }
      else a.tempo = Math.round(tempo * 10) / 10;
    }
    if (fc != null) {
      if (!Number.isInteger(fc) || fc < 40 || fc > 230) { erros.push('Teste aeróbico: FC final entre 40 e 230 bpm.'); okAer = false; }
      else a.fc_final = fc;
    }
    if (okAer) out.aerobico = a;
  }
  const flex = {};
  for (const [k] of K.FLEXITESTE) {
    const v = t.flex?.[k];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 4) { erros.push(`Flexiteste ${k}: nota de 0 a 4.`); continue; }
    flex[k] = n;
  }
  if (Object.keys(flex).length) out.flexiteste = flex;
  return out;
}

/** Avaliação postural do rascunho: {} se não foi feita; { itens, obs? } se foi (mesmas regras do banco). */
function montarPostura(p, erros) {
  if (!p || !p.feita) return {};
  const itens = {};
  for (const [, grupo] of K.POSTURA) for (const [k, , opcoes] of grupo) if (opcoes.some(([v]) => v === p.itens?.[k])) itens[k] = p.itens[k];
  const obs = String(p.obs || '').trim();
  if (obs.length > K.POSTURA_OBS_MAX) erros.push(`Observações da postura: no máximo ${K.POSTURA_OBS_MAX} caracteres.`);
  return obs ? { itens, obs } : { itens };
}

/** Converte o rascunho no registro da tabela avaliacoes, com as mesmas faixas do banco. */
function montarAvaliacao(r, hoje = hojeISO()) {
  const erros = [], reg = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data || '') || r.data < '2000-01-01' || r.data > hoje) erros.push('Data da avaliação inválida (não pode ser futura).');
  else reg.data = r.data;
  for (const [k, [min, max, msg]] of Object.entries(FAIXAS)) {
    let v = K.lerNumero(r[k]);
    if (k === 'altura' && v >= 100 && v <= 240) v = v / 100; // digitou em centímetros
    if (v == null) { reg[k] = null; continue; }
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
  reg.equacao_gordura = K.EQUACOES_GORDURA[r.equacao] ? r.equacao : 'faulkner';
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
  /** Confere carga e repetições de um exercício; devolve { carga, reps }, null (vazio) ou undefined (erro já anotado). */
  const cargaReps = (nome, c, rp) => {
    const carga = K.lerNumero(c), reps = K.lerNumero(rp);
    if (carga == null && reps == null) return null;
    if (carga == null || reps == null) { erros.push(`${nome}: preencha a carga e as repetições.`); return undefined; }
    if (Number.isNaN(carga) || carga < 1 || carga > 1000) { erros.push(`${nome}: carga entre 1 e 1000 kg.`); return undefined; }
    if (!Number.isInteger(reps) || reps < 1 || reps > 30) { erros.push(`${nome}: repetições inteiras, de 1 a 30.`); return undefined; }
    return { carga, reps };
  };
  for (const [k, nome, c, rp] of [['supino', 'Supino', r.supC, r.supR], ['leg_press', 'Leg press', r.legC, r.legR]]) {
    const v = cargaReps(nome, c, rp);
    if (v) reg.forca[k] = v;
  }
  const outros = [], vistos = new Set(['supino', 'supino reto', 'leg press']);
  for (const o of (r.outros || [])) {
    const nome = String(o.nome || '').trim().replace(/\s+/g, ' ');
    const vazio = !nome && K.lerNumero(o.c) == null && K.lerNumero(o.r) == null;
    if (vazio) continue;
    if (!nome) { erros.push('Dê um nome ao exercício que você acrescentou.'); continue; }
    if (nome.length > 40) { erros.push(`${nome.slice(0, 20)}…: nome do exercício com no máximo 40 letras.`); continue; }
    const chave = K.chaveExercicio(nome);
    if (vistos.has(chave)) { erros.push(`${nome}: este exercício já está na lista.`); continue; }
    vistos.add(chave);
    const v = cargaReps(nome, o.c, o.r);
    if (v === null) { erros.push(`${nome}: preencha a carga e as repetições.`); continue; }
    if (v) outros.push({ nome, ...v });
  }
  if (outros.length > K.MAX_OUTROS_EXERCICIOS) erros.push(`No máximo ${K.MAX_OUTROS_EXERCICIOS} exercícios além do supino e do leg press.`);
  else if (outros.length) reg.forca.outros = outros;
  reg.testes = montarTestes(r.testes || testesVazios(), erros);
  reg.postura = montarPostura(r.postura, erros);
  const parecer = String(r.parecer || '').trim();
  if (parecer.length > 4000) erros.push('O parecer pode ter no máximo 4000 caracteres.');
  reg.parecer = parecer || null;
  // Etapas independentes (0.10.0): nenhuma é obrigatória, mas a avaliação precisa ter alguma coisa.
  if (!erros.length && !temAlgumaMedida(reg)) erros.push('Preencha pelo menos uma medida (de qualquer etapa) ou o parecer.');
  return { registro: reg, erros };
}

/** Para o painel do aluno: o 1RM mais recente de cada exercício (pelo nome, sem acento nem maiúscula) e as zonas de FC
    da avaliação mais recente que tem FC de repouso (Karvonen); sem nenhuma, as da última avaliação (% da FC máxima). */
function zonasDoAluno(aluno, avs) {
  if (!avs.length) return null;
  const calc = avs.map(v => ({ v, c: K.calcular(aluno, v) }));
  const comRepouso = [...calc].reverse().find(x => x.v.fc_repouso != null) || calc.at(-1);
  const exercicios = new Map();
  for (const { v, c } of calc) for (const e of c.exercicios1RM) exercicios.set(K.chaveExercicio(e.nome), { ...e, data: v.data });
  return { fc: comRepouso.c.zonasFC, dataFC: comRepouso.v.data, exercicios: [...exercicios.values()] };
}

/** Filtros da lista de alunos: reavaliar (sem avaliação ou a última tem mais de DIAS_REAVALIAR dias) e sem acesso ao app.
    O aluno de exemplo não entra em nenhum dos dois. */
const DIAS_REAVALIAR = 90;
function filtrosDoAluno(aluno, resumo, hoje = hojeISO()) {
  if (aluno.exemplo) return { reavaliar: false, semAcesso: false };
  const dias = resumo?.ultima ? Math.round((Date.parse(hoje) - Date.parse(resumo.ultima)) / 86400000) : Infinity;
  return { reavaliar: dias > DIAS_REAVALIAR, semAcesso: !aluno.usuario_id };
}

/** A avaliação tem alguma medida ou parecer? (qualquer etapa serve) */
function temAlgumaMedida(reg) {
  const cheio = o => o && typeof o === 'object' && Object.keys(o).length > 0;
  return Object.keys(FAIXAS).some(k => reg[k] != null) || cheio(reg.perimetros) || cheio(reg.dobras) || cheio(reg.forca) || cheio(reg.testes)
    || cheio(reg.postura) || !!reg.parecer;
}

/** Diferença com sentido: 'bom', 'ruim' ou 'neutro', conforme a direção desejada (1 sobe, -1 desce, 0 tanto faz). */
/* ---------- Mensagens (1.0.0): conversa de cada aluno com o personal dele ---------- */
const MENSAGEM_MAX = 2000;
const INTERVALO_MENSAGENS_MS = 20000; // procura mensagens novas a cada 20 s, com o app aberto na tela
/** Texto pronto para enviar: sem espaços nas pontas; null se vazio. */
function limparMensagem(t) { const x = String(t ?? '').trim(); return x || null; }
/** Por aluno: a última mensagem e quantas o usuário ainda não leu (as que ele mesmo enviou não contam). */
function resumoConversas(msgs, eu) {
  const r = new Map();
  for (const m of msgs || []) {
    const o = r.get(m.aluno_id) || { ultima: null, naoLidas: 0 };
    if (!o.ultima || m.criado_em > o.ultima.criado_em) o.ultima = m;
    if (m.autor !== eu && !m.lida_em) o.naoLidas++;
    r.set(m.aluno_id, o);
  }
  return r;
}
const diaDe = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Dias entre a data da mensagem e hoje (0 = hoje, 1 = ontem), no fuso do aparelho. */
const diasAtras = (iso, agora = new Date()) => Math.round((diaDe(agora) - diaDe(new Date(iso))) / 864e5);
/** Separador da conversa: "Hoje", "Ontem" ou "14 de outubro" (com o ano, se for de outro ano). */
function rotuloDia(iso, agora = new Date()) {
  const n = diasAtras(iso, agora), d = new Date(iso);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: d.getFullYear() === agora.getFullYear() ? undefined : 'numeric' });
}
const horaCurta = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
/** Na lista de conversas: hora (hoje), "Ontem", dia da semana (até 6 dias) ou dd/mm. */
function quandoNaLista(iso, agora = new Date()) {
  const n = diasAtras(iso, agora), d = new Date(iso);
  if (n <= 0) return horaCurta(iso);
  if (n === 1) return 'Ontem';
  if (n < 7) { const w = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''); return w[0].toUpperCase() + w.slice(1); }
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}`;
}

function sentido(dif, desejado) { return !desejado || !Number.isFinite(dif) || Math.abs(dif) < 0.05 ? 'neutro' : dif * desejado > 0 ? 'bom' : 'ruim'; }


/** O que falta na avaliação para calcular gordura (equação escolhida) e massa muscular (Lee). Devolve os nomes, para avisar o personal. */
const PRECISA_MUSCULAR = { dobras: ['triceps', 'coxa', 'panturrilha'], perimetros: ['bracoD', 'coxaMedD', 'pantD'] };
function faltasDoCalculo(av) {
  const nome = (lista, k) => (lista.find(([c]) => c === k) || [k, k])[1];
  const tem = x => x != null && Number.isFinite(Number(Array.isArray(x) ? x[0] : x));
  const falta = req => [
    ...req.perimetros.filter(k => !tem(av?.perimetros?.[k])).map(k => nome(K.PERIMETROS, k)),
    ...req.dobras.filter(k => !tem(av?.dobras?.[k])).map(k => 'dobra ' + nome(K.DOBRAS, k).toLowerCase())
  ];
  return { gordura: falta({ dobras: K.EQUACOES_GORDURA[K.equacaoDe(av)].dobras, perimetros: [] }), muscular: falta(PRECISA_MUSCULAR) };
}
const listaFalta = nomes => nomes.length <= 2 ? nomes.join(' e ') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;

/* ---------- Tutorial de primeiro acesso ---------- */
// Toda versão nova: revise os passos abaixo (personal e aluno) e suba este número para a versão do package.json.
// O teste tests/app.cjs recusa publicar com o guia sem revisão.
const GUIA_REVISADO_NA_VERSAO = '1.0.2';
const PASSOS_TUTORIAL_PERSONAL = [
  { icone: '✦', titulo: 'Bem-vindo ao app de avaliação física',
    texto: 'Aqui você cadastra seus alunos, registra avaliações e acompanha a evolução de cada um. Os cálculos saem prontos.',
    itens: ['Criamos um aluno de exemplo, a Mariana, com 3 avaliações fictícias, para você ver todas as telas funcionando.', 'Seus alunos e avaliações são só seus: nenhum outro personal vê nada.'] },
  { icone: '◉', titulo: '1. Seus alunos',
    texto: 'A lista de alunos fica ao lado (no celular, ocupa a tela). Toque num aluno para abrir a ficha dele.',
    itens: ['“Novo aluno” cadastra um aluno: nome, sexo e data de nascimento. No celular, é o botão laranja embaixo, à direita.', 'Os filtros “Reavaliar” (última avaliação há mais de 3 meses) e “Sem acesso” (ainda não entrou no app) ajudam a achar quem precisa de atenção.', '“Editar” corrige os dados ou exclui o aluno com tudo dele.'] },
  { icone: '＋', titulo: '2. Nova avaliação em 8 etapas',
    texto: 'Básico, exames, perímetros, dobras, força, testes, postura e parecer. Nenhuma etapa é obrigatória: preencha só o que mediu (por exemplo, só os testes, ou perímetros sem dobras).',
    itens: ['A barra de progresso mostra em que etapa você está; no celular, “Voltar” e “Próximo” ficam fixos embaixo.', 'Gordura e massa muscular aparecem ao lado enquanto você preenche.', 'Nas dobras, dá para anotar 1ª e 2ª medida: o app tira a média.', 'Você escolhe a equação de gordura: Faulkner ou Petroski (1995, feita com brasileiros).', 'Na etapa Força, além de supino e leg press, “+ Outro exercício” testa o 1RM em qualquer exercício.', 'Na etapa Testes: flexão de braço, abdominal em 1 minuto, teste aeróbico (Cooper ou distância e tempo livres) e flexiteste, todos opcionais.', 'Na etapa Postura: checklist visual de frente, de lado e de costas, com observações.'] },
  { icone: '▤', titulo: '3. O resultado completo',
    texto: 'Cada avaliação vira uma ficha com tudo calculado. Os números principais ficam no topo e cada parte (perímetros, força, testes, postura, coração, zonas) abre e fecha com um toque.',
    itens: ['Gordura, massa muscular, massa gorda e magra, soma das dobras.', 'Perímetros e dobras com a régua de proporção (modelo Phantom).', 'Força (1RM) com classificação, coração, exames e o seu parecer. “Imprimir / PDF” gera o relatório.', 'Testes físicos com classificação: flexão, abdominal, VO₂máx do Cooper e notas do flexiteste.', 'Avaliação postural: as alterações encontradas em cada vista.', 'Zonas de treino: faixas de frequência cardíaca e de carga (% do 1RM), com uma calculadora de carga.'] },
  { icone: '↗', titulo: '4. Evolução e comparação',
    texto: 'Na ficha do aluno, as abas mostram a evolução em gráficos e comparam quaisquer duas avaliações.',
    itens: ['Verde quando a mudança vai na direção desejada (por exemplo, gordura caindo).', 'Abra a Mariana: ela já tem 3 avaliações para você ver os gráficos.'] },
  { icone: '✉', titulo: '5. Convide o aluno',
    texto: 'Na ficha do aluno, “Convidar” gera um link de uso único para ele.',
    itens: ['O aluno aceita o termo de uso dos dados (LGPD), cria uma senha e vê só a própria evolução, em linguagem simples.', 'O aluno de exemplo não recebe convite. Quando não precisar mais dele, apague em “Editar”.'] },
  { icone: '✎', titulo: '6. Mensagens',
    texto: 'Converse com cada aluno pelo próprio app, sem misturar com o WhatsApp.',
    itens: ['O balão no topo abre as conversas; o número em coral mostra quantas mensagens você ainda não leu.', 'Na ficha do aluno, “Mensagem” abre a conversa com ele. Pelo clipe, você envia uma avaliação: o aluno toca no cartão e ela abre.', 'Só alunos com acesso ao app conversam. Quem ainda não entrou aparece com “Convidar”.', 'As mensagens são dados do aluno: só vocês dois leem e elas são apagadas junto se ele pedir a exclusão.'] },
  { icone: '?', titulo: 'Pronto para começar',
    texto: 'Informe seu nome (e CREF, se quiser) em “Meus dados”: seus alunos veem isso no app.',
    itens: ['“Meus dados”, “Personais”, o tema (Auto, igual ao aparelho, Claro ou Escuro) e “Sair” ficam no menu da conta: o círculo com as suas iniciais, no topo à direita.', 'Por segurança, o app sai sozinho depois de 30 minutos sem uso.', 'Para rever este guia, toque em “?” no topo.'] }
];
const PASSOS_TUTORIAL_ALUNO = [
  { icone: '✦', titulo: 'Bem-vindo!',
    texto: 'Aqui você acompanha as avaliações físicas que o seu personal registra.',
    itens: ['Você só vê os seus dados. Ninguém mais tem acesso pelo app.', 'As abas embaixo levam a cada parte: Início, Avaliações, Evolução, Mensagens e Perfil.'] },
  { icone: '⌂', titulo: 'Início',
    texto: 'Os principais resultados da última avaliação: gordura, massa muscular, peso e cintura, e o recado do seu personal.',
    itens: ['As setas mostram o que mudou desde a primeira avaliação. Verde quer dizer que mudou na direção boa.', '“Ver a avaliação completa” abre todos os detalhes.'] },
  { icone: '▤', titulo: 'Avaliações',
    texto: 'Todas as suas avaliações, da mais recente para a mais antiga.',
    itens: ['Em cada uma, os números principais ficam no topo e as partes (perímetros, força, testes físicos, avaliação postural, coração, zonas de treino) abrem com um toque.', '“Imprimir / PDF” gera o relatório.'] },
  { icone: '↗', titulo: 'Evolução e zonas',
    texto: 'O gráfico mostra como cada medida mudou; escolha a medida nos botões acima dele.',
    itens: ['Zonas de frequência cardíaca: em que batimentos treinar cada intensidade.', 'Zonas de carga: digite a carga de um exercício e veja se está em resistência, hipertrofia ou força.', 'A cada nova avaliação, tudo se atualiza sozinho.'] },
  { icone: '✎', titulo: 'Mensagens',
    texto: 'Converse com o seu personal pelo app: dúvidas sobre a avaliação, o treino ou o que precisar.',
    itens: ['O número em coral na aba Mensagens mostra quantas você ainda não leu.', 'Quando o personal envia uma avaliação, toque no cartão para abrir.', '“lida” embaixo da sua mensagem quer dizer que o personal já viu.', 'Só você e o seu personal leem a conversa.'] },
  { icone: '?', titulo: 'Perfil e seus dados',
    texto: 'Na aba Perfil você revê este guia e sai do app.',
    itens: ['Para corrigir alguma informação ou pedir a exclusão dos seus dados, fale com o seu personal.', 'No círculo com as suas iniciais, no topo, você escolhe o tema: Auto (igual ao celular), Claro ou Escuro.', 'Para rever este guia, toque em “?” no topo ou em “Como usar o app”, no Perfil.'] }
];
/** Mostra o guia sozinho só se a pessoa ainda não o viu (no perfil dela ou neste aparelho). */
function deveMostrarTutorial(metadados, vistoNoAparelho) {
  return !(metadados && metadados.tutorial_visto === true) && vistoNoAparelho !== '1';
}

/* ---------- Aluno de exemplo (primeiro acesso do personal) ---------- */
const ALUNO_EXEMPLO = { nome: 'Mariana Costa (exemplo)', sexo: 'F', nascimento: '1994-03-12', contato: null, exemplo: true };
const PERIM_EX = ['bracoD', 'bracoE', 'antD', 'antE', 'torax', 'cintura', 'abdomen', 'quadril', 'coxaSupD', 'coxaSupE', 'coxaMedD', 'coxaMedE', 'pantD', 'pantE'];
const DOBRA_EX = ['triceps', 'subesc', 'biceps', 'iliaca', 'supraesp', 'abdominal', 'coxa', 'panturrilha'];
/** As 3 avaliações fictícias da Mariana (junho, agosto e outubro de 2026), prontas para gravar. */
function avaliacoesExemplo(alunoId) {
  const av = (data, peso, fc, pas, pad, ex, per, dob, sup, leg, agach, testes, postura, parecer, equacao = 'faulkner') => ({
    aluno_id: alunoId, data, peso, altura: 1.65, fc_repouso: fc, pas, pad,
    glicose: ex[0], triglicerideos: ex[1], ldl: ex[2], hdl: ex[3],
    perimetros: Object.fromEntries(PERIM_EX.map((k, i) => [k, per[i]])),
    dobras: Object.fromEntries(DOBRA_EX.map((k, i) => [k, [dob[i][0], dob[i][1] ?? null].filter((x, j) => j === 0 || x != null)])),
    forca: { supino: { carga: sup[0], reps: sup[1] }, leg_press: { carga: leg[0], reps: leg[1] }, outros: [{ nome: 'Agachamento livre', carga: agach[0], reps: agach[1] }] }, testes, postura,
    equacao_gordura: equacao, parecer });
  return [
    av('2026-06-08', 66.4, 74, 124, 82, [96, 142, 128, 52],
      [28.4, 28.0, 23.6, 23.3, 88.0, 74.5, 82.0, 102.5, 59.5, 59.0, 55.0, 54.6, 36.0, 35.8],
      [[26, 26.4], [22, 21.6], [11], [26, 26.2], [15], [30, 30.4], [31], [19]], [30, 8], [120, 10], [40, 8],
      { flexao: 12, abdominal: 24, aerobico: { tipo: 'cooper', distancia: 1750 }, flexiteste: { IV: 2, V: 2, IX: 2, XII: 3, XIX: 2 } },
      { itens: { ombros_sagital: 'protusos', lombar: 'hiperlordose', pelve_sagital: 'anteversao', joelhos_frontal: 'valgo' }, obs: 'Joelho valgo mais visível no agachamento. Reavaliar em 4 meses.' },
      'Primeira avaliação. Boa disposição e técnica razoável nos testes.\nPrioridade: reduzir gordura central e ganhar força de membros superiores.\nPróximos passos: treino 4x por semana e cardio leve 2x.'),
    av('2026-08-10', 64.9, 70, 120, 80, [92, 128, 121, 55],
      [28.6, 28.3, 23.8, 23.5, 87.0, 72.8, 80.1, 101.0, 59.6, 59.3, 55.3, 55.0, 36.2, 36.0],
      [[24], [20], [10], [23], [13], [27], [29], [18]], [34, 8], [140, 10], [46, 8],
      { flexao: 16, abdominal: 28, aerobico: { tipo: 'cooper', distancia: 1900 }, flexiteste: { IV: 2, V: 3, IX: 2, XII: 3, XIX: 3 } },
      {},
      'Boa evolução em dois meses: menos gordura central e mais força no supino.\nManter a frequência e aumentar a carga do leg press aos poucos.'),
    av('2026-10-14', 63.8, 66, 116, 76, [89, 112, 115, 58],
      [29.0, 28.6, 24.0, 23.7, 86.5, 71.0, 78.5, 100.0, 59.8, 59.5, 55.6, 55.2, 36.4, 36.2],
      [[22], [19], [9], [21], [12], [24], [27], [17]], [38, 8], [160, 10], [52, 8],
      { flexao: 21, abdominal: 31, aerobico: { tipo: 'cooper', distancia: 2050, fc_final: 176 }, flexiteste: { IV: 3, V: 3, IX: 3, XII: 3, XIX: 3 } },
      { itens: { ombros_sagital: 'protusos', joelhos_frontal: 'valgo' } },
      'Excelente adesão. Gordura em queda constante e massa muscular subindo.\nFC de repouso melhorou (66 bpm). Próxima fase: hipertrofia de membros inferiores.')
  ];
}
/** Cria o exemplo só para quem acabou de chegar: sem nenhum aluno e sem ter ganhado o exemplo antes. */
function deveCriarExemplo(metadados, qtdAlunos) {
  return qtdAlunos === 0 && !(metadados && metadados.exemplo_criado === true);
}

/* ---------- Sugestão de instalar o app (celular) ---------- */
/** Que aviso de instalação mostrar: null (já instalado ou não é celular), 'android' (botão Instalar),
    'android-menu' (sem o botão do navegador: ensinar pelo menu) ou 'ios' (ensinar pelo Compartilhar). */
function avisoInstalacao({ ua = '', instalado = false, temPrompt = false, toques = 0 } = {}) {
  if (instalado) return null;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && toques > 1); // iPad novo se apresenta como Mac
  if (ios) return 'ios';
  if (/Android/i.test(ua)) return temPrompt ? 'android' : 'android-menu';
  return null;
}
const TEXTO_INSTALAR = {
  android: 'Instale o app na tela inicial: ele abre com um toque, em tela cheia, como um aplicativo.',
  'android-menu': 'Instale o app na tela inicial: toque no menu ⋮ do navegador e depois em “Instalar app” ou “Adicionar à tela inicial”.',
  ios: 'Instale o app na tela de início: toque em Compartilhar (o quadrado com a seta ↑) e depois em “Adicionar à Tela de Início”.'
};

if (typeof module !== 'undefined') {
  module.exports = { GUIA_REVISADO_NA_VERSAO, avisoInstalacao, TEXTO_INSTALAR, PASSOS_TUTORIAL_PERSONAL, PASSOS_TUTORIAL_ALUNO, deveMostrarTutorial, ALUNO_EXEMPLO, avaliacoesExemplo, deveCriarExemplo, conviteDoLink, situacaoConvite, TERMO_PERSONAL_VERSAO, faltasDoCalculo, listaFalta, zonasDoAluno, filtrosDoAluno, temAlgumaMedida, DIAS_REAVALIAR, TERMO_VERSAO, hojeISO, fmt, MENSAGEM_MAX, limparMensagem, resumoConversas, rotuloDia, quandoNaLista, codigoDoLink, linkConvite, expirouPorInatividade, lerRota, rascunhoVazio, rascunhoDe, montarAvaliacao, testesVazios, montarPostura, sentido };
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
  /** Só os elementos de verdade: partes opcionais da tela (null, undefined, false) somem em vez de virar texto. */
  const soElementos = itens => [itens].flat(Infinity).filter(x => x != null && x !== false && x !== true);
  /** Seção que abre e fecha: título e resumo sempre à vista; o detalhe quando a pessoa quiser (como nas configurações do celular). */
  const secao = (titulo, resumo, aberto, ...corpo) => h('details', { class: 'card secao', open: !!aberto },
    h('summary', null, h('span', { class: 's-tit' }, h('strong', null, titulo), resumo ? h('span', { class: 's-res' }, resumo) : null)),
    h('div', { class: 's-corpo' }, corpo));
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
  const est = { papel: null, usuario: null, personal: null, alunos: [], resumo: new Map(), avs: new Map(), busca: '', filtro: 'todos', aluno: null, rascunho: null, passo: 0, editandoAluno: null, conviteAluno: null, chat: { resumo: new Map(), aberto: null } };

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
      db.from('alunos').select('id,nome,sexo,nascimento,contato,usuario_id,exemplo').order('exemplo').order('nome'),
      db.from('avaliacoes').select('aluno_id,data')
    ]);
    if (p.error || a.error || r.error) throw p.error || a.error || r.error;
    est.personal = p.data; est.alunos = a.data;
    est.resumo = new Map();
    for (const x of r.data) { const o = est.resumo.get(x.aluno_id) || { n: 0, ultima: null }; o.n++; if (!o.ultima || x.data > o.ultima) o.ultima = x.data; est.resumo.set(x.aluno_id, o); }
    mostrarQuem(est.personal.nome, est.personal.cref ? `CREF ${est.personal.cref}` : '');
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
    est.listaAtual = atual;
    const termo = est.busca.trim().toLowerCase();
    const hoje = hojeISO(), contas = { todos: est.alunos.length, reavaliar: 0, sem_acesso: 0 };
    for (const a of est.alunos) { const f = filtrosDoAluno(a, est.resumo.get(a.id), hoje); if (f.reavaliar) contas.reavaliar++; if (f.semAcesso) contas.sem_acesso++; }
    if (!contas[est.filtro] && est.filtro !== 'todos') est.filtro = 'todos';
    $('filtroAlunos').replaceChildren(...[['todos', 'Todos'], ['reavaliar', 'Reavaliar'], ['sem_acesso', 'Sem acesso']].filter(([k]) => k === 'todos' || contas[k])
      .map(([k, t]) => h('button', { type: 'button', 'aria-pressed': String(est.filtro === k), onclick: () => { est.filtro = k; desenharLista(atual); } }, `${t} · ${contas[k]}`)));
    $('filtroAlunos').classList.toggle('hidden', est.alunos.length < 2);
    const lista = est.alunos.filter(a => (!termo || a.nome.toLowerCase().includes(termo))
      && (est.filtro === 'todos' || (f => est.filtro === 'reavaliar' ? f.reavaliar : f.semAcesso)(filtrosDoAluno(a, est.resumo.get(a.id), hoje))));
    $('qtdAlunos').textContent = String(est.alunos.length);
    if (!lista.length) { $('listaAlunos').replaceChildren(h('p', { class: 'vazio' }, est.alunos.length ? 'Nenhum aluno com esse nome.' : 'Nenhum aluno ainda. Toque em “Novo aluno”.')); return; }
    $('listaAlunos').replaceChildren(...lista.map(a => {
      const r = est.resumo.get(a.id), f = filtrosDoAluno(a, r, hoje);
      const naoLidas = est.chat.resumo.get(a.id)?.naoLidas || 0;
      return h('button', { class: 'aluno-btn', type: 'button', 'aria-current': String(a.id === atual), onclick: () => ir('aluno-' + a.id) },
        h('span', { class: 'avatar com-badge', 'aria-hidden': naoLidas ? null : 'true' }, h('span', { 'aria-hidden': 'true' }, iniciais(a.nome)),
          naoLidas ? h('span', { class: 'badge' }, String(naoLidas), h('span', { class: 'sr-only' }, naoLidas === 1 ? ' mensagem não lida' : ' mensagens não lidas')) : null),
        h('span', null, h('strong', null, a.nome), h('small', { class: f.reavaliar ? 'reavaliar' : null },
          (a.exemplo ? 'Exemplo · ' : '') + (f.reavaliar ? (r ? `Reavaliar · última em ${dataBR(r.ultima)}` : 'Reavaliar · sem avaliação') : r ? `${r.n} aval. · última ${dataBR(r.ultima)}` : 'Sem avaliação'))));
    }));
  }

  /* ----- Navegação ----- */
  function ir(hash) { if (location.hash === '#' + hash) rotear(); else location.hash = hash; }
  async function rotear() {
    if (est.papel !== 'personal') return;
    const r = lerRota(location.hash);
    const p = $('principal');
    est.chat.aberto = null;
    $('areaPersonal').classList.toggle('com-foco', r.tela !== 'inicio'); // no celular, esconde a lista de alunos
    $('msgBtn').setAttribute('aria-current', r.tela === 'mensagens' || r.tela === 'conversa' ? 'page' : 'false');
    try {
      if (r.tela === 'aluno' && alunoPorId(r.id)) { desenharLista(r.id); p.replaceChildren(...soElementos(await telaAluno(alunoPorId(r.id), r.aba))); }
      else if (r.tela === 'avaliacao' || r.tela === 'editar') {
        const av = await acharAvaliacao(r.id);
        if (!av) return ir('inicio');
        desenharLista(av.aluno_id);
        p.replaceChildren(...soElementos(r.tela === 'avaliacao' ? telaResultado(alunoPorId(av.aluno_id), av) : telaFormulario(alunoPorId(av.aluno_id), av)));
      } else if (r.tela === 'mensagens') { desenharLista(null); p.replaceChildren(...soElementos(telaMensagens())); }
      else if (r.tela === 'conversa' && podeConversar(alunoPorId(r.id))) {
        const a = alunoPorId(r.id), avs = await avaliacoesDe(a.id), ult = avs.at(-1);
        desenharLista(a.id);
        p.replaceChildren(telaConversa({ alunoId: a.id, nome: a.nome, detalhe: ult ? `Última avaliação em ${dataMsg(ult.data)}` : 'Sem avaliação ainda', voltar: '#mensagens', ficha: '#aluno-' + a.id, avaliacoes: avs }));
        atualizarConversa(); return;
      } else if (r.tela === 'nova' && alunoPorId(r.id)) { desenharLista(r.id); p.replaceChildren(...soElementos(telaFormulario(alunoPorId(r.id), null))); }
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
      h('div', { class: 'ficha-cab' }, h('span', { class: 'avatar grande', 'aria-hidden': 'true' }, iniciais(a.nome)), h('div', null, h('h2', null, a.nome), h('div', { class: 'meta' },
        h('span', null, a.sexo === 'F' ? 'Feminino' : 'Masculino'), h('span', { class: 'num' }, `${idade} anos`),
        a.exemplo ? h('span', { class: 'chip destaque' }, 'Aluno de exemplo: dados fictícios') : a.usuario_id ? h('span', { class: 'chip bom' }, 'Acessa o app') : h('span', { class: 'chip' }, 'Sem acesso ao app')))),
      h('div', { class: 'linha' },
        h('button', { class: 'btn', type: 'button', onclick: () => abrirAluno(a) }, 'Editar'),
        a.exemplo ? null : h('button', { class: 'btn', type: 'button', onclick: () => abrirConvite(a) }, a.usuario_id ? 'Acesso do aluno' : 'Convidar'),
        podeConversar(a) ? h('a', { class: 'btn', href: '#conversa-' + a.id }, ic('M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z', 18), 'Mensagem',
          est.chat.resumo.get(a.id)?.naoLidas ? h('span', { class: 'badge' }, String(est.chat.resumo.get(a.id).naoLidas), h('span', { class: 'sr-only' }, ' não lidas')) : null) : null,
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
        h('span', null, h('span', { class: 'k' }, 'Peso'), h('span', { class: 'v' }, v.peso == null ? '—' : `${fmt(v.peso)} kg`)),
        h('span', null, h('span', { class: 'k' }, 'Gordura'), h('span', { class: 'v' }, c.gordura == null ? '—' : `${fmt(c.gordura)}%`)),
        h('span', { class: 'some-cel' }, h('span', { class: 'k' }, 'M. muscular'), h('span', { class: 'v' }, c.massaMuscular == null ? '—' : `${fmt(c.massaMuscular)} kg`))); })));
    const voltar = h('div', { class: 'linha so-cel' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => ir('inicio') }, '‹ Alunos'));
    return [voltar, cab, abas, corpo];
  }

  /* ----- Resultado de uma avaliação ----- */
  function telaResultado(a, v, { paraAluno = false } = {}) {
    const c = K.calcular(a, v);
    const regua = z => h('td', null, h('div', { class: 'regua', title: `Escore-Z ${fmt(z, 2)}` }, (() => { const i = h('i'); i.style.left = `${Math.max(0, Math.min(100, (z + 3) / 6 * 100))}%`; return i; })()));
    const kpi = (k, valor, un, extra) => h('div', { class: 'kpi' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, valor, un ? h('small', null, un) : null), extra);
    const falta = faltasDoCalculo(v);
    const faltaTexto = nomes => h('span', { class: 'sub' }, `Para calcular, falta: ${listaFalta(nomes)}.`);
    const forca = (nome, f, rm, rel, classe) => h('tr', null, h('td', null, nome), h('td', { class: 'n' }, f ? `${fmt(f.carga, 0)} × ${f.reps}` : '—'), h('td', { class: 'n' }, fmt(rm)), h('td', { class: 'n' }, fmt(rel, 2)), h('td', null, classe));
    const nPer = K.PERIMETROS.filter(([k]) => v.perimetros?.[k] != null).length, nDob = K.DOBRAS.filter(([k]) => c.dobras[k] != null).length;
    const abre = !paraAluno; // o personal vê tudo aberto; o aluno vê o resumo e abre o que quiser
    const resumoForca = c.exercicios1RM.map(e => `${e.nome.split(' ')[0]} ${fmt(e.rm, 0)} kg`).join(' · ');
    const resumoCoracao = [v.pas != null ? `Pressão ${v.pas}/${v.pad}${c.pressao ? ' ' + c.pressao.texto.toLowerCase() : ''}` : null, v.fc_repouso != null ? `FC repouso ${v.fc_repouso}` : null].filter(Boolean).join(' · ');
    return [
      paraAluno ? h('div', { class: 'linha nao-imprimir' }, h('a', { class: 'btn ghost', href: '#avaliacoes' }, '‹ Avaliações'))
        : h('div', { class: 'linha nao-imprimir' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => ir('aluno-' + a.id) }, `‹ ${a.nome}`)),
      h('section', { class: 'card' },
        h('div', { class: 'card-topo' }, h('div', null, h('h2', null, paraAluno ? dataBR(v.data) : `${a.nome} · ${dataBR(v.data)}`), h('p', { class: 'sub num' }, [`${c.idade} anos`, c.peso != null ? `${fmt(c.peso)} kg` : null, c.altura != null ? `${fmt(c.altura, 2)} m` : null, c.imc != null ? `IMC ${fmt(c.imc)}` : null].filter(Boolean).join(' · '))),
          h('div', { class: 'linha nao-imprimir' },
            paraAluno ? null : h('button', { class: 'btn perigo-leve', type: 'button', onclick: () => excluirAvaliacao(a, v) }, 'Excluir'),
            h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, 'Imprimir / PDF'),
            paraAluno ? null : h('button', { class: 'btn primary', type: 'button', onclick: () => ir('editar-' + v.id) }, 'Editar'))),
        c.gordura != null || nDob || c.massaMuscular != null ? h('div', { class: 'kpis' },
          // Só o que foi medido: um número que não dá para calcular por falta de uma etapa não aparece.
          c.gordura != null || nDob ? kpi(`Gordura · ${K.EQUACOES_GORDURA[c.equacaoGordura].nome}`, fmt(c.gordura), c.gordura == null ? null : '%', c.gordura == null ? faltaTexto(falta.gordura) : chip(c.classeGordura)) : null,
          c.massaMuscular != null ? kpi('Massa muscular', fmt(c.massaMuscular), 'kg', chip(c.classeMuscular)) : null,
          c.massaGorda != null ? kpi('Massa gorda / magra', fmt(c.massaGorda), `/ ${fmt(c.massaMagra)} kg`) : null,
          c.somaDobras != null ? kpi('Σ 8 dobras', fmt(c.somaDobras, 0), 'mm', h('span', { class: 'sub num' }, `Periférico ${fmt(c.dobrasPerifericas, 0)} · Central ${fmt(c.dobrasCentrais, 0)}`)) : null) : null),
      nPer || nDob ? secao('Perímetros e dobras', [nPer ? `${nPer} ${nPer === 1 ? 'perímetro' : 'perímetros'}` : null, nDob ? `${nDob} ${nDob === 1 ? 'dobra' : 'dobras'}` : null].filter(Boolean).join(' · '), abre,
        h('div', { class: 'dois' },
          nPer ? h('div', null, h('h3', { class: 'titulo-secao' }, 'Perímetros (cm)'), h('div', { class: 'tabela' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Local'), h('th', { class: 'n' }, 'Medida'), h('th', null, 'Proporção'), h('th'))),
          h('tbody', null, K.PERIMETROS.filter(([k]) => v.perimetros?.[k] != null).map(([k, n]) => { const z = c.zPerimetros[k];
            return h('tr', null, h('td', null, n), h('td', { class: 'n' }, fmt(v.perimetros[k])), z == null ? h('td') : regua(z), h('td', null, z == null ? null : chip(K.classeProporcao(z)))); }),
            c.perimetroMuscularBraco == null ? null : h('tr', null, h('td', null, 'Perímetro muscular do braço'), h('td', { class: 'n' }, fmt(c.perimetroMuscularBraco)), h('td'), h('td')))))) : null,
          nDob ? h('div', null, h('h3', { class: 'titulo-secao' }, 'Dobras cutâneas (mm)'), h('div', { class: 'tabela' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Dobra'), h('th', { class: 'n' }, 'Média'), h('th', null, 'Proporção'), h('th'))),
          h('tbody', null, K.DOBRAS.filter(([k]) => c.dobras[k] != null).map(([k, n]) => h('tr', null, h('td', null, n), h('td', { class: 'n' }, fmt(c.dobras[k])), regua(c.zDobras[k]), h('td', null, chip(K.classeProporcao(c.zDobras[k]))))))))) : null),
        c.altura == null ? h('p', { class: 'aviso' }, 'Sem a altura nesta avaliação, a proporção (modelo Phantom) não é calculada.') : h('p', { class: 'aviso' }, 'Proporção compara a medida com um corpo de referência ajustado à altura do aluno (modelo Phantom). O ponto no meio da régua é a média.')) : null,
      c.exercicios1RM.length ? secao('Força (1RM)', resumoForca, abre, h('div', { class: 'tabela' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Exercício'), h('th', { class: 'n' }, 'Carga × reps'), h('th', { class: 'n' }, '1RM'), h('th', { class: 'n' }, '÷ peso'), h('th', null, 'Classificação'))),
          h('tbody', null, forca('Supino reto', v.forca?.supino, c.supino1RM, c.supinoRelativo, c.supino1RM == null ? null : chip(c.classeSupino)),
            forca('Leg press', v.forca?.leg_press, c.legPress1RM, c.legPressRelativo, c.legPress1RM == null ? null : chip(c.classeLegPress)),
            c.outrosExercicios.map(o => forca(o.nome, o, o.rm, o.relativo, h('span', { class: 'sub' }, 'sem tabela')))))), h('p', { class: 'aviso' }, '1RM pela fórmula de Epley. Supino e leg press têm tabela de classificação; os outros exercícios mostram o 1RM para acompanhar a evolução. Leg press classificado pela tabela do ACSM, feita em leg press de cadeira: no leg press 45° a carga costuma ser maior e a classificação pode sair acima do real.')) : null,
      cardTestes(c.testes, abre),
      cardPostura(c, abre),
      v.fc_repouso != null || v.pas != null || Object.keys(K.EXAMES).some(k => v[k] != null) ? secao('Coração e exames', resumoCoracao || null, abre, h('div', { class: 'tabela' }, h('table', null, h('tbody', null,
          h('tr', null, h('td', null, 'FC repouso / máxima / reserva ', h('span', { class: 'sub' }, '(máxima por Tanaka)')), h('td', { class: 'n' }, `${v.fc_repouso ?? '—'} / ${c.fcMaxima} / ${c.fcReserva ?? '—'} bpm`), h('td')),
          v.pas == null ? null : h('tr', null, h('td', null, 'Pressão arterial'), h('td', { class: 'n' }, `${v.pas}/${v.pad} mmHg`), h('td', null, chip(c.pressao))),
          Object.entries(K.EXAMES).filter(([k]) => v[k] != null).map(([k, e]) => h('tr', null, h('td', null, e.nome, ' ', h('span', { class: 'sub' }, `(ref. ${e.referencia})`)), h('td', { class: 'n' }, `${fmt(v[k], 0)} ${e.unidade}`), h('td', null, chip(K.classeExame(k, Number(v[k])))))))))) : null,
      secaoZonas({ fc: c.zonasFC, exercicios: c.exercicios1RM, paraAluno, aberto: false }),
      h('section', { class: 'card' + (paraAluno ? ' recado' : '') }, h('h3', { class: 'titulo-secao' }, paraAluno ? 'Recado do seu personal' : 'Parecer do avaliador'), h('p', { class: 'parecer' }, v.parecer || (paraAluno ? 'Sem recado nesta avaliação.' : 'Sem parecer.')))
    ];
  }
  /** Testes físicos de uma avaliação: resistência, aeróbico e flexiteste. Nada aplicado, nada mostrado. */
  function cardTestes(tt, aberto = true) {
    const a = tt.aerobico;
    const linhas = [
      tt.flexao == null ? null : h('tr', null, h('td', null, 'Flexão de braço ', h('span', { class: 'sub' }, '(até a falha)')), h('td', { class: 'n' }, `${tt.flexao} rep.`), h('td', null, chip(tt.classeFlexao))),
      tt.abdominal == null ? null : h('tr', null, h('td', null, 'Abdominal ', h('span', { class: 'sub' }, '(1 minuto)')), h('td', { class: 'n' }, `${tt.abdominal} rep.`), h('td', null, chip(tt.classeAbdominal))),
      !a ? null : h('tr', null, h('td', null, a.tipo === 'cooper' ? 'Cooper (12 min)' : `Corrida livre (${fmt(a.tempo, Number.isInteger(a.tempo) ? 0 : 1)} min)`),
        h('td', { class: 'n' }, `${fmt(a.distancia, 0)} m`), h('td', null, h('span', { class: 'sub num' }, `${K.paceTexto(a.pace) ?? '—'} · ${fmt(a.kmh)} km/h`))),
      tt.vo2 == null ? null : h('tr', null, h('td', null, 'VO₂máx estimado'), h('td', { class: 'n' }, `${fmt(tt.vo2)} ml/kg/min`), h('td', null, chip(tt.classeVO2))),
      a?.fcFinal == null ? null : h('tr', null, h('td', null, 'FC ao final do teste'), h('td', { class: 'n' }, `${a.fcFinal} bpm`), h('td'))
    ].filter(Boolean);
    const flex = tt.flexiteste;
    if (!linhas.length && !flex.length) return null;
    const resumo = [tt.flexao != null ? 'flexão' : null, tt.abdominal != null ? 'abdominal' : null, a ? (a.tipo === 'cooper' ? 'Cooper' : 'corrida') : null,
      flex.length ? 'flexiteste' : null].filter(Boolean).join(', ');
    return secao('Testes físicos', resumo ? resumo[0].toUpperCase() + resumo.slice(1) : null, aberto,
      h('div', { class: 'dois-zonas' },
        h('div', null, linhas.length ? h('div', { class: 'tabela' }, h('table', null, h('tbody', null, linhas))) : h('p', { class: 'sub' }, 'Sem testes de resistência ou aeróbico nesta avaliação.'),
          linhas.length ? h('p', { class: 'aviso' }, 'Flexão: CSEP/ACSM (mulheres com os joelhos no chão). Abdominal: Pollock e Wilmore (1993). VO₂máx pela distância do Cooper, classificado pelo Cooper Institute.') : null),
        h('div', null, flex.length ? [
          h('h4', { class: 'sub-titulo' }, `Flexiteste · ${tt.flexindice != null ? `Flexíndice ${tt.flexindice} de 80` : `soma ${tt.somaFlexiteste} de ${flex.length * 4} (${flex.length} movimentos)`}`),
          h('ul', { class: 'lista-flex' }, flex.map(m => h('li', null, h('span', null, h('span', { class: 'num fraco' }, m.chave), ` ${m.articulacao}: ${m.nome.toLowerCase()}`),
            h('span', { class: 'notas', 'aria-label': `nota ${m.nota} de 4` }, [0, 1, 2, 3].map(i => h('span', { class: i < m.nota ? 'cheia' : '' })), h('b', { class: 'num' }, m.nota))))),
          h('p', { class: 'aviso' }, 'Nota de 0 (amplitude muito pequena) a 4 (muito grande), pelo Flexiteste de Araújo.')
        ] : h('p', { class: 'sub' }, 'Flexiteste não aplicado nesta avaliação.'))));
  }

  /** Avaliação postural: alterações por vista, ou "nenhuma alteração". Não feita, nada mostrado. */
  function cardPostura(c, aberto = true) {
    if (!c.posturaAvaliada) return null;
    const alt = c.alteracoesPosturais;
    return secao('Postura', alt.length ? `${alt.length} ${alt.length === 1 ? 'ponto' : 'pontos'} de atenção: ${[...new Set(alt.map(x => x.nome.split(' (')[0].toLowerCase()))].slice(0, 3).join(', ')}` : 'Nenhuma alteração observada', aberto,
      alt.length ? h('div', { class: 'postura-vistas' }, K.POSTURA.map(([vista]) => { const da = alt.filter(x => x.vista === vista);
        return da.length ? h('div', null, h('h4', { class: 'sub-titulo' }, `Vista ${vista.toLowerCase()}`),
          h('ul', { class: 'lista-postura' }, da.map(x => h('li', null, h('strong', null, x.nome), `: ${x.texto}`)))) : null; }))
        : h('p', null, 'Nenhuma alteração observada.'),
      c.obsPostura ? h('p', { class: 'parecer' }, c.obsPostura) : null,
      h('p', { class: 'aviso' }, 'Triagem visual (checklist por vistas, Kendall et al.): não substitui diagnóstico. Desvios acentuados ou com dor devem ser avaliados por um fisioterapeuta ou médico.'));
  }

  /** kg sem casa decimal quando é inteiro (32 em vez de 32,0). */
  const kgCurto = v => Number.isInteger(v) ? fmt(v, 0) : fmt(v);
  /** Zonas de treino: FC (Karvonen ou % da FC máxima) e carga por % do 1RM, com calculadora. */
  function secaoZonas({ fc, exercicios, paraAluno, dataFC, aberto }) {
    const tabelaFC = !fc ? null : h('div', null,
      h('h4', { class: 'sub-titulo' }, 'Frequência cardíaca'),
      h('div', { class: 'tabela' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Zona'), h('th', { class: 'n' }, 'bpm'), h('th', null, 'Para quê'))),
        h('tbody', null, fc.zonas.map(z => h('tr', null, h('td', null, h('span', { class: `zona z${z.zona}` }, z.zona), ' ', z.nome, ' ', h('span', { class: 'sub' }, `${z.de}–${z.ate}%`)),
          h('td', { class: 'n' }, `${z.min}–${z.max}`), h('td', { class: 'sub' }, z.uso)))))),
      h('p', { class: 'aviso' }, fc.metodo === 'karvonen'
        ? `Pela FC de reserva (Karvonen), com a FC máxima de Tanaka e a FC de repouso${dataFC ? ` de ${dataBR(dataFC)}` : ''}. Mudam a cada avaliação.`
        : 'Pela % da FC máxima (Tanaka). Com a FC de repouso registrada na avaliação, as zonas ficam mais precisas (Karvonen).'));
    let calc = null;
    if (exercicios.length) {
      const sel = h('select', { 'aria-label': 'Exercício' }, exercicios.map((e, i) => h('option', { value: String(i) }, e.nome)));
      const carga = h('input', { inputMode: 'decimal', autocomplete: 'off', placeholder: 'ex.: 30', 'aria-label': 'Carga usada em kg' });
      const saida = h('p', { class: 'calc-saida', 'aria-live': 'polite' }, 'Digite a carga para ver a zona.');
      const atualizar = () => {
        const e = exercicios[Number(sel.value)], kg = K.lerNumero(carga.value), z = K.zonaCarga(kg, e.rm);
        if (!z) { saida.replaceChildren('Digite a carga para ver a zona.'); return; }
        saida.replaceChildren(h('strong', null, `${kgCurto(kg)} kg = ${fmt(z.pct, 0)}% do 1RM`), h('span', { class: `chip zona-${z.chave}` }, z.nome), h('span', { class: 'sub' }, `(${z.reps})`),
          ...(z.pct > 100 ? [h('span', { class: 'sub' }, 'Acima do 1RM estimado: hora de refazer o teste.')] : []));
      };
      sel.addEventListener('change', atualizar); carga.addEventListener('input', atualizar);
      calc = h('div', null,
        h('h4', { class: 'sub-titulo' }, 'Carga (% do 1RM)'),
        h('div', { class: 'lista-cargas' }, exercicios.map(e => h('div', { class: 'carga-ex' },
          h('div', { class: 'carga-topo' }, h('span', null, e.nome), h('span', { class: 'sub num' }, `1RM ${kgCurto(Math.round(e.rm * 2) / 2)} kg`)),
          h('div', { class: 'carga-faixas' }, K.cargasPorZona(e.rm).map(z => h('div', { class: `faixa zona-${z.chave}` },
            h('span', { class: 'faixa-nome' }, z.curto), h('span', { class: 'num' }, z.min == null ? `até ${kgCurto(z.max)}` : `${kgCurto(z.min)}–${kgCurto(z.max)}`))))))),
        h('div', { class: 'calc-carga' },
          h('p', { class: 'sub' }, paraAluno ? 'Quanto você está usando? Escolha o exercício e digite a carga:' : 'Calculadora: escolha o exercício e digite a carga usada no treino.'),
          h('div', { class: 'calc-linha' }, h('label', { class: 'campo' }, 'Exercício', sel), h('label', { class: 'campo' }, 'Carga (kg)', carga)), saida),
        h('p', { class: 'aviso' }, 'Valores em kg, pela % do 1RM estimado: Resistência muscular abaixo de 67%, Hipertrofia de 67% a 85%, Força de 85% para cima.'));
    }
    if (!tabelaFC && !calc) return null;
    const conteudo = h('div', { class: 'dois-zonas' }, tabelaFC, calc || h('p', { class: 'sub' }, 'As zonas de carga aparecem quando houver teste de força (1RM).'));
    if (aberto !== undefined) return secao('Zonas de treino', exercicios.length ? 'Frequência cardíaca e carga por exercício' : 'Frequência cardíaca', aberto, conteudo);
    return h('section', { class: 'card zonas' }, h('h3', { class: 'titulo-secao' }, 'Zonas de treino'), conteudo);
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
    { t: 'Peso', un: 'kg', des: 0, f: (v, c) => c.peso },
    { t: 'Gordura', un: '%', des: -1, f: (v, c) => c.gordura },
    { t: 'Massa muscular', un: 'kg', des: 1, f: (v, c) => c.massaMuscular },
    { t: 'Σ 8 dobras', un: 'mm', des: -1, f: (v, c) => c.somaDobras },
    { t: 'Cintura', un: 'cm', des: -1, f: v => v.perimetros?.cintura ?? null },
    { t: '1RM supino', un: 'kg', des: 1, f: (v, c) => c.supino1RM },
    { t: 'Flexão de braço', un: 'rep.', des: 1, f: (v, c) => c.testes.flexao },
    { t: 'Abdominal (1 min)', un: 'rep.', des: 1, f: (v, c) => c.testes.abdominal },
    { t: 'VO₂máx (Cooper)', un: 'ml/kg/min', des: 1, f: (v, c) => c.testes.vo2 }
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
  /** Flexiteste na comparação: cada movimento testado em alguma das duas avaliações. */
  function linhasFlexiteste(ca, cb) {
    const nota = (c, k) => c.testes.flexiteste.find(m => m.chave === k)?.nota ?? null;
    return K.FLEXITESTE.filter(([k]) => nota(ca, k) != null || nota(cb, k) != null)
      .map(([k, nome, art]) => [`Flexiteste ${k} · ${art.toLowerCase()}, ${nome.split(' (')[0].toLowerCase()} (0 a 4)`, nota(ca, k), nota(cb, k), 1]);
  }
  /** Linhas de 1RM dos outros exercícios, casando pelo nome (sem acento nem maiúsculas) entre as duas avaliações. */
  function linhasOutros(ca, cb) {
    const mapa = new Map();
    for (const [i, c] of [[0, ca], [1, cb]]) for (const o of c.outrosExercicios) {
      const k = K.chaveExercicio(o.nome);
      if (!mapa.has(k)) mapa.set(k, [`1RM ${o.nome.toLowerCase()} (kg)`, null, null, 1]);
      mapa.get(k)[i + 1] = o.rm;
    }
    return [...mapa.values()];
  }
  function telaComparar(a, avs) {
    if (avs.length < 2) return h('section', { class: 'card' }, h('p', { class: 'aviso' }, 'É preciso ter duas avaliações para comparar.'));
    const sel = (id, padrao) => h('select', { id, onchange: atualizar }, avs.map(v => h('option', { value: v.id, selected: v.id === padrao.id }, dataBR(v.data))));
    const sa = sel('compA', avs[0]), sb = sel('compB', avs.at(-1)), corpo = h('tbody');
    function atualizar() {
      const A = avs.find(v => v.id === sa.value), B = avs.find(v => v.id === sb.value), ca = K.calcular(a, A), cb = K.calcular(a, B);
      const linhas = [['Peso (kg)', ca.peso, cb.peso, 0], ['Gordura (%)', ca.gordura, cb.gordura, -1], ['Massa muscular (kg)', ca.massaMuscular, cb.massaMuscular, 1], ['Massa gorda (kg)', ca.massaGorda, cb.massaGorda, -1],
        ['Σ 8 dobras (mm)', ca.somaDobras, cb.somaDobras, -1], ['Dobras centrais (mm)', ca.dobrasCentrais, cb.dobrasCentrais, -1],
        ...K.PERIMETROS.map(([k, n]) => [`${n} (cm)`, A.perimetros?.[k], B.perimetros?.[k], ['cintura', 'abdomen'].includes(k) ? -1 : 0]),
        ['1RM supino (kg)', ca.supino1RM, cb.supino1RM, 1], ['1RM leg press (kg)', ca.legPress1RM, cb.legPress1RM, 1], ...linhasOutros(ca, cb),
        ['Flexão de braço (rep.)', ca.testes.flexao, cb.testes.flexao, 1], ['Abdominal em 1 min (rep.)', ca.testes.abdominal, cb.testes.abdominal, 1],
        ['VO₂máx Cooper (ml/kg/min)', ca.testes.vo2, cb.testes.vo2, 1], ...linhasFlexiteste(ca, cb),
        ['Alterações posturais', ca.posturaAvaliada ? ca.alteracoesPosturais.length : null, cb.posturaAvaliada ? cb.alteracoesPosturais.length : null, -1], ['FC de repouso (bpm)', A.fc_repouso, B.fc_repouso, -1], ['Pressão sistólica (mmHg)', A.pas, B.pas, -1]]
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
  const PASSOS = ['Básico', 'Exames', 'Perímetros', 'Dobras', 'Força', 'Testes', 'Postura', 'Parecer'];
  function telaFormulario(a, existente) {
    const chave = existente ? 'e:' + existente.id : 'n:' + a.id;
    if (est.rascunhoChave !== chave) {
      const avs = est.avs.get(a.id) || [];
      est.rascunho = existente ? rascunhoDe(existente) : rascunhoVazio(hojeISO(), avs.at(-1)?.altura);
      est.passo = 0; est.rascunhoChave = chave;
    }
    const r = est.rascunho, p = est.passo;
    // O rótulo vai num só <span>: assim "Peso (kg)" fica na mesma linha e os campos lado a lado se alinham.
    const campo = (rot, obj, k, extra = {}) => h('label', { class: 'campo' }, h('span', { class: 'rotulo' }, rot),
      h('input', { inputMode: extra.modo || 'decimal', value: obj[k] ?? '', autocomplete: 'off', oninput: ev => { obj[k] = ev.target.value; vivo(); }, ...extra.attrs }));
    let corpo;
    if (p === 0) corpo = h('div', null, h('p', { class: 'sub' }, 'Nenhuma etapa é obrigatória: preencha só o que mediu. Sem peso e altura, o app não calcula IMC, massa gorda, massa muscular e força relativa, e o resto sai normal.'), h('div', { class: 'campos' },
      h('label', { class: 'campo' }, 'Data', h('input', { type: 'date', value: r.data, max: hojeISO(), oninput: ev => { r.data = ev.target.value; } })),
      campo(['Peso ', h('span', { class: 'fraco' }, '(kg)')], r, 'peso'), campo(['Altura ', h('span', { class: 'fraco' }, '(m)')], r, 'altura'),
      campo(['FC de repouso ', h('span', { class: 'fraco' }, '(bpm)')], r, 'fc_repouso', { modo: 'numeric' }),
      campo(['Pressão sistólica ', h('span', { class: 'fraco' }, '(mmHg)')], r, 'pas', { modo: 'numeric' }), campo(['Pressão diastólica ', h('span', { class: 'fraco' }, '(mmHg)')], r, 'pad', { modo: 'numeric' })));
    if (p === 1) corpo = h('div', null, h('p', { class: 'sub' }, 'Opcional. Preencha só os exames que o aluno trouxe.'),
      h('div', { class: 'campos' }, Object.entries(K.EXAMES).map(([k, e]) => campo([e.nome + ' ', h('span', { class: 'fraco' }, `(${e.unidade})`)], r, k))));
    if (p === 2) corpo = h('div', { class: 'campos' }, K.PERIMETROS.map(([k, n]) => campo([n + ' ', h('span', { class: 'fraco' }, '(cm)')], r.per, k)));
    if (p === 3) {
      const medias = new Map();
      const atualizarMedia = k => { const m = K.mediaDobra([K.lerNumero(r.dob1[k]), K.lerNumero(r.dob2[k])].filter(Number.isFinite)); medias.get(k).textContent = m == null ? '—' : fmt(m); };
      const escolha = h('label', { class: 'campo equacao' }, 'Equação do % de gordura',
        h('select', { onchange: ev => { r.equacao = ev.target.value; ajuda.textContent = ajudaEquacao(); vivo(); } },
          Object.entries(K.EQUACOES_GORDURA).map(([k, e]) => h('option', { value: k, selected: r.equacao === k }, e.referencia))));
      const ajudaEquacao = () => `Usa as dobras: ${listaFalta(K.EQUACOES_GORDURA[r.equacao].dobras.map(k => K.DOBRAS.find(([c]) => c === k)[1].toLowerCase()))}.`
        + (r.equacao === 'petroski' ? ' Feita com adultos brasileiros; para mulheres, considera também peso e altura.' : '');
      const ajuda = h('p', { class: 'sub' }, ajudaEquacao());
      corpo = h('div', null, escolha, ajuda, h('div', { class: 'dobra cab' }, h('span', null, 'Dobra (mm)'), h('span', null, '1ª medida'), h('span', null, '2ª medida'), h('span', { class: 'media' }, 'Média')),
        K.DOBRAS.map(([k, n]) => { const m = h('span', { class: 'media num' }, '—'); medias.set(k, m);
          const inp = (obj, rot) => h('input', { inputMode: 'decimal', value: obj[k] ?? '', autocomplete: 'off', 'aria-label': `${n}, ${rot}`, oninput: ev => { obj[k] = ev.target.value; atualizarMedia(k); vivo(); } });
          return h('div', { class: 'dobra' }, h('span', null, n), inp(r.dob1, '1ª medida'), inp(r.dob2, '2ª medida'), m); }));
      queueMicrotask(() => K.DOBRAS.forEach(([k]) => atualizarMedia(k)));
    }
    if (p === 4) {
      r.outros = r.outros || [];
      const refazer = focarUltimo => rotear().then(() => { if (focarUltimo) [...document.querySelectorAll('.exercicio input')].at(-3)?.focus(); });
      const cheio = r.outros.length >= K.MAX_OUTROS_EXERCICIOS;
      corpo = h('div', null, h('p', { class: 'sub' }, 'Carga levantada e repetições até a falha (até 10 para uma boa estimativa). Preencha só os exercícios que testou.'),
        h('div', { class: 'campos' }, campo(['Supino: carga ', h('span', { class: 'fraco' }, '(kg)')], r, 'supC'), campo('Supino: repetições', r, 'supR', { modo: 'numeric' }),
          campo(['Leg press: carga ', h('span', { class: 'fraco' }, '(kg)')], r, 'legC'), campo('Leg press: repetições', r, 'legR', { modo: 'numeric' })),
        h('h3', { class: 'titulo-secao outros-titulo' }, 'Outros exercícios'),
        h('p', { class: 'sub' }, 'Escolha qualquer exercício para o teste de 1RM. Sem tabela de classificação: o app mostra o 1RM e a evolução entre avaliações.'),
        h('datalist', { id: 'sugestoesExercicios' }, K.SUGESTOES_EXERCICIOS.map(n => h('option', { value: n }))),
        r.outros.map((o, i) => h('div', { class: 'exercicio' },
          h('label', { class: 'campo' }, 'Exercício', h('input', { value: o.nome, maxlength: '40', list: 'sugestoesExercicios', autocomplete: 'off', oninput: ev => { o.nome = ev.target.value; } })),
          campo('Carga (kg)', o, 'c'), campo('Repetições', o, 'r', { modo: 'numeric' }),
          h('button', { class: 'btn ghost', type: 'button', 'aria-label': `Remover ${o.nome || 'exercício'}`, onclick: () => { r.outros.splice(i, 1); refazer(false); } }, 'Remover'))),
        h('button', { class: 'btn', type: 'button', disabled: cheio, onclick: () => { r.outros.push({ nome: '', c: '', r: '' }); refazer(true); } }, '+ Outro exercício'),
        cheio ? h('p', { class: 'sub' }, `Até ${K.MAX_OUTROS_EXERCICIOS} exercícios além do supino e do leg press.`) : null);
    }
    if (p === 5) {
      const t = r.testes = r.testes || testesVazios();
      const ajudaSexo = a.sexo === 'F' ? 'Mulher: flexão com os joelhos no chão.' : 'Homem: flexão normal, apoiado nos pés.';
      const camposAer = h('div', { class: 'campos' });
      const desenharAer = () => camposAer.replaceChildren(...(t.aerTipo ? [
        campo(t.aerTipo === 'cooper' ? 'Distância em 12 min (m)' : 'Distância (m)', t, 'aerDist', { modo: 'numeric' }),
        t.aerTipo === 'livre' ? campo('Tempo (min)', t, 'aerTempo') : null,
        campo(['FC ao final ', h('span', { class: 'fraco' }, '(bpm, opcional)')], t, 'aerFc', { modo: 'numeric' })].filter(Boolean) : []));
      desenharAer();
      const contagem = h('span', { class: 'sub' });
      const contar = () => { const n = K.FLEXITESTE.filter(([k]) => t.flex[k] !== undefined && t.flex[k] !== '').length;
        contagem.textContent = `${n} de 20 movimentos${n && n < K.MIN_FLEXITESTE_SUGERIDO ? ` (sugestão: pelo menos ${K.MIN_FLEXITESTE_SUGERIDO})` : ''}`; };
      contar();
      let articulacao = null;
      corpo = h('div', null, h('p', { class: 'sub' }, 'Opcional. Preencha só os testes que aplicou.'),
        h('h3', { class: 'titulo-secao' }, 'Resistência muscular'),
        h('div', { class: 'campos' },
          campo(['Flexão de braço ', h('span', { class: 'fraco' }, '(repetições até a falha)')], t, 'flexao', { modo: 'numeric' }),
          campo(['Abdominal ', h('span', { class: 'fraco' }, '(repetições em 1 minuto)')], t, 'abdominal', { modo: 'numeric' })),
        h('p', { class: 'sub' }, `${ajudaSexo} Classificação da flexão pela CSEP/ACSM e do abdominal por Pollock e Wilmore.`),
        h('h3', { class: 'titulo-secao outros-titulo' }, 'Teste aeróbico'),
        h('label', { class: 'campo equacao' }, 'Tipo de teste', h('select', { onchange: ev => { t.aerTipo = ev.target.value; desenharAer(); vivo(); } },
          [['', 'Não aplicado'], ['cooper', 'Cooper (12 minutos)'], ['livre', 'Distância e tempo livres']].map(([v, n]) => h('option', { value: v, selected: t.aerTipo === v }, n)))),
        camposAer,
        h('p', { class: 'sub' }, 'No Cooper, o app estima o VO₂máx e classifica (Cooper Institute). No livre, mostra o ritmo (pace) e a velocidade para acompanhar a evolução.'),
        h('h3', { class: 'titulo-secao outros-titulo' }, 'Flexiteste'),
        h('p', { class: 'sub' }, 'Nota de 0 (amplitude muito pequena) a 4 (muito grande) em cada movimento testado. Deixe "—" nos que não testou. ', contagem),
        h('div', { class: 'flexiteste' }, K.FLEXITESTE.map(([k, nome, art]) => {
          const cab = art !== articulacao ? h('div', { class: 'flex-art' }, art) : null; articulacao = art;
          return [cab, h('label', { class: 'flex-mov' }, h('span', null, h('span', { class: 'num fraco' }, k), ' ', nome),
            h('select', { 'aria-label': `${art}: ${nome}`, onchange: ev => { if (ev.target.value === '') delete t.flex[k]; else t.flex[k] = ev.target.value; contar(); } },
              [['', '—'], ...[0, 1, 2, 3, 4].map(n => [String(n), String(n)])].map(([v, n]) => h('option', { value: v, selected: (t.flex[k] ?? '') === v }, n))))];
        })));
    }
    if (p === 6) {
      const po = r.postura = r.postura || { feita: false, itens: {}, obs: '' };
      const lista = h('div', { class: po.feita ? '' : 'hidden' },
        K.POSTURA.map(([vista, grupo]) => [h('h3', { class: 'titulo-secao outros-titulo' }, `Vista ${vista.toLowerCase()}`),
          h('div', { class: 'flexiteste' }, grupo.map(([k, nome, opcoes]) => h('label', { class: 'flex-mov postura-item' }, h('span', null, nome),
            h('select', { 'aria-label': `${vista}: ${nome}`, onchange: ev => { if (ev.target.value) po.itens[k] = ev.target.value; else delete po.itens[k]; } },
              [['', 'Normal'], ...opcoes].map(([v, t]) => h('option', { value: v, title: t, selected: (po.itens[k] || '') === v }, t[0].toUpperCase() + t.split(' (')[0].slice(1)))))))]),
        h('label', { class: 'campo outros-titulo' }, ['Observações ', h('span', { class: 'fraco' }, '(opcional; o aluno também vê)')],
          h('textarea', { maxlength: String(K.POSTURA_OBS_MAX), rows: '3', oninput: ev => { po.obs = ev.target.value; } }, po.obs)));
      corpo = h('div', null,
        h('p', { class: 'sub' }, 'Opcional. Avaliação visual com o aluno em pé, de frente, de lado e de costas. Deixe "Normal" no que não tiver alteração.'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: po.feita, onchange: ev => { po.feita = ev.target.checked; lista.classList.toggle('hidden', !po.feita); } }), ' Fiz a avaliação postural nesta avaliação'),
        lista,
        h('p', { class: 'aviso outros-titulo' }, 'É uma triagem visual: não substitui diagnóstico. Desvios acentuados ou com dor: encaminhe para um fisioterapeuta ou médico.'));
    }
    if (p === 7) corpo = h('label', { class: 'campo' }, ['Parecer descritivo ', h('span', { class: 'fraco' }, '(o aluno também vê este texto)')],
      h('textarea', { maxlength: '4000', oninput: ev => { r.parecer = ev.target.value; } }, r.parecer));
    const erro = h('p', { class: 'msg', role: 'alert' });
    const painel = h('aside', { class: 'ao-vivo', 'aria-live': 'polite' });
    function vivo() {
      const { registro, erros } = montarAvaliacao(r);
      if (erros.length || !(registro.dobras && Object.keys(registro.dobras).length) && !(registro.peso && registro.altura)) { painel.replaceChildren(h('div', { class: 'kpi' }, h('span', { class: 'k' }, 'Resultado na hora'), h('span', { class: 'sub' }, 'Aparece conforme você preenche peso, altura, perímetros e dobras.'))); return; }
      const c = K.calcular(a, registro);
      painel.replaceChildren(
        h('div', { class: 'kpi' }, h('span', { class: 'k' }, 'Gordura'), h('span', { class: 'v' }, fmt(c.gordura), c.gordura == null ? null : h('small', null, '%')), c.gordura == null ? h('span', { class: 'sub' }, `Para calcular, falta: ${listaFalta(faltasDoCalculo(registro).gordura)}.`) : chip(c.classeGordura)),
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
        (() => { const barra = h('i'); barra.style.width = `${Math.round((p + 1) / PASSOS.length * 100)}%`;
          return h('div', { class: 'progresso', role: 'progressbar', 'aria-label': 'Progresso da avaliação', 'aria-valuemin': '1', 'aria-valuemax': String(PASSOS.length), 'aria-valuenow': String(p + 1) }, barra); })(),
        h('nav', { class: 'passos', 'aria-label': 'Etapas' }, PASSOS.map((t, i) => h('button', { type: 'button', class: i < p ? 'feito' : '', 'aria-current': i === p ? 'step' : null, onclick: () => irPasso(i) }, i < p ? `✓ ${t}` : `${i + 1}. ${t}`))),
        h('div', { class: 'form-layout' },
          h('div', null, corpo,
            h('div', { class: 'form-pe' }, h('button', { class: 'btn', type: 'button', disabled: p === 0, onclick: () => irPasso(p - 1) }, '‹ Voltar'),
              ult ? h('button', { class: 'btn primary', type: 'button', onclick: ev => salvar(ev.currentTarget) }, existente ? 'Salvar alterações' : 'Salvar avaliação')
                : h('button', { class: 'btn primary', type: 'button', onclick: () => irPasso(p + 1) }, `Próximo: ${PASSOS[p + 1]} ›`)),
            erro),
          painel))
    ];
  }

  /* ----- Cadastro e edição do aluno ----- */
  function abrirAluno(a = null) {
    est.editandoAluno = a;
    $('alunoDlgTitulo').textContent = a ? 'Editar aluno' : 'Novo aluno';
    $('alNome').value = a?.nome || ''; $('alSexo').value = a?.sexo || 'F'; $('alNasc').value = a?.nascimento || ''; $('alNasc').max = hojeISO();
    $('alContato').value = a?.contato || '';
    $('alExcluir').classList.toggle('hidden', !a);
    aviso('alunoMsg', ''); $('alunoDialog').showModal(); $('alNome').focus();
  }
  $('alunoForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const dados = { nome: $('alNome').value.trim().replace(/\s+/g, ' '), sexo: $('alSexo').value, nascimento: $('alNasc').value, contato: $('alContato').value.trim() || null };
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
    if (!(await confirmar({ titulo: 'Excluir aluno e todos os dados?', botao: 'Excluir tudo', texto: `${a.nome}, todas as avaliações${a.usuario_id ? ', as mensagens, o aceite do termo e o acesso ao app' : ''} serão apagados de vez. Use quando o aluno pedir a exclusão dos dados (LGPD). Não dá para desfazer.` }))) return;
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

  /* ----- Convite de personal (só o administrador) ----- */
  async function desenharConvitesPersonal() {
    const { data, error } = await db.rpc('listar_convites_personal');
    if (error) { $('persLista').replaceChildren(h('li', { class: 'vazio' }, erroBanco(error))); return; }
    if (!data.length) { $('persLista').replaceChildren(h('li', { class: 'vazio' }, 'Nenhum convite ainda.')); return; }
    $('persLista').replaceChildren(...data.map(c => {
      const s = situacaoConvite(c);
      return h('li', null,
        h('span', { class: 'info' }, h('strong', null, c.rotulo || 'Convite sem nome'), h('small', null, s.detalhe)),
        h('span', { class: 'chip ' + s.tom }, s.texto),
        s.cancelavel ? h('button', { class: 'btn perigo-leve', type: 'button', onclick: async ev => {
          ev.currentTarget.disabled = true;
          const { error: e } = await db.rpc('cancelar_convite_personal', { p_id: c.id });
          aviso('persMsg', e ? erroBanco(e) : 'Convite cancelado: o link parou de funcionar.', !e);
          desenharConvitesPersonal();
        } }, 'Cancelar') : null);
    }));
  }
  $('personaisBtn').addEventListener('click', () => {
    $('persRotulo').value = ''; $('persLink').value = ''; aviso('persMsg', '');
    $('persLinkCaixa').classList.add('hidden'); $('persCompartilhar').classList.add('hidden'); $('persGerar').classList.remove('hidden');
    $('persLista').replaceChildren(h('li', { class: 'vazio' }, 'Carregando…'));
    $('personaisDialog').showModal(); desenharConvitesPersonal();
  });
  $('persGerar').addEventListener('click', async () => {
    $('persGerar').disabled = true;
    const { data, error } = await db.rpc('criar_convite_personal', { p_rotulo: $('persRotulo').value.trim() || null });
    $('persGerar').disabled = false;
    if (error || !data?.[0]?.codigo) return aviso('persMsg', /pendentes/.test(error?.message || '') ? error.message : erroBanco(error));
    $('persLink').value = linkConvite(location.origin + location.pathname, data[0].codigo, 'convite_personal');
    $('persLinkCaixa').classList.remove('hidden'); $('persGerar').classList.add('hidden');
    $('persCompartilhar').classList.toggle('hidden', !navigator.share);
    aviso('persMsg', 'Link criado. Copie e envie agora: por segurança, ele não aparece de novo.', true);
    $('persLink').select(); desenharConvitesPersonal();
  });
  $('persCopiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('persLink').value); aviso('persMsg', 'Link copiado. Agora é só colar na conversa com o personal.', true); }
    catch (_) { $('persLink').select(); aviso('persMsg', 'Selecione o link e copie.', true); }
  });
  $('persCompartilhar').addEventListener('click', () => navigator.share?.({ title: 'Convite: Avaliação Física', text: 'Crie seu acesso de personal no app de avaliação física (o link vale por 3 dias):', url: $('persLink').value }).catch(() => {}));

  /* ----- Visão do aluno ----- */
  /* ----- Área do aluno: abas embaixo (Início, Avaliações, Evolução, Perfil), como nos apps de saúde ----- */
  async function carregarAluno() {
    const [{ data: eu }, { data: avs, error }, { data: pers }] = await Promise.all([
      db.from('alunos').select('id,nome,sexo,nascimento').eq('usuario_id', est.usuario.id).single(),
      db.from('avaliacoes').select('*').order('data').order('criado_em'),
      db.from('personais').select('nome').limit(1).maybeSingle()]);
    if (error || !eu) throw error || new Error('sem ficha');
    est.aluno = { eu, avs, personal: pers?.nome && pers.nome !== 'Personal' ? pers.nome : 'seu personal', serie: 'Gordura' };
    mostrarQuem(eu.nome);
  }
  function rotearAluno() {
    if (est.papel !== 'aluno' || !est.aluno) return;
    const r = lerRota(location.hash), { eu, avs } = est.aluno;
    const v = r.tela === 'avaliacao' ? avs.find(x => x.id === r.id) : null;
    const aba = v ? 'avaliacoes' : ['avaliacoes', 'evolucao', 'perfil', 'mensagens'].includes(r.tela) ? r.tela : 'inicio';
    est.chat.aberto = null;
    document.querySelectorAll('#navAluno a').forEach(a => a.setAttribute('aria-current', a.dataset.aba === aba ? 'page' : 'false'));
    const tela = v ? telaResultado(eu, v, { paraAluno: true }) : aba === 'avaliacoes' ? alunoAvaliacoes() : aba === 'evolucao' ? alunoEvolucao() : aba === 'perfil' ? alunoPerfil() : aba === 'mensagens' ? alunoMensagens() : alunoInicio();
    $('areaAluno').replaceChildren(...soElementos(tela));
    window.scrollTo({ top: 0 });
    if (aba === 'mensagens') atualizarConversa();
  }
  function alunoInicio() {
    const { eu, avs, personal } = est.aluno;
    const ola = h('section', { class: 'card ola' }, h('p', { class: 'sub' }, 'Olá,'), h('h2', null, primeiro(eu.nome)),
      avs.length ? h('p', { class: 'sub' }, `Última avaliação em ${dataBR(avs.at(-1).data)} · ${avs.length} ${avs.length === 1 ? 'avaliação' : 'avaliações'} com ${personal}`) : null);
    if (!avs.length) return [ola, h('p', { class: 'aviso' }, `Você ainda não tem avaliação registrada. Assim que ${personal} registrar a primeira, ela aparece aqui.`)];
    const ult = avs.at(-1), pri = avs[0], c = K.calcular(eu, ult), c0 = K.calcular(eu, pri), varias = avs.length > 1;
    const delta = (dif, un, d) => !varias || !Number.isFinite(dif) ? null
      : h('span', { class: 'delta ' + sentido(dif, d) }, `${dif > 0 ? '▲ +' : dif < 0 ? '▼ ' : ''}${fmt(dif)} ${un}${sentido(dif, d) === 'bom' ? ' · melhorou' : ''}`);
    const kpi = (k, valor, un, ...extra) => h('div', { class: 'kpi' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, fmt(valor), valor == null ? null : h('small', null, un)), ...extra);
    return [ola,
      h('div', { class: 'grandes' },
        kpi('Gordura corporal', c.gordura, '%', delta(c.gordura - c0.gordura, 'pontos', -1), c.classeGordura ? chip(c.classeGordura) : null),
        kpi('Massa muscular', c.massaMuscular, 'kg', delta(c.massaMuscular - c0.massaMuscular, 'kg', 1)),
        kpi('Peso', c.peso, 'kg', delta((c.peso ?? NaN) - (c0.peso ?? NaN), 'kg', 0)),
        kpi('Cintura', ult.perimetros?.cintura ?? null, 'cm', delta((ult.perimetros?.cintura ?? NaN) - (pri.perimetros?.cintura ?? NaN), 'cm', -1))),
      h('section', { class: 'card recado' }, h('h3', { class: 'titulo-secao' }, `Recado de ${personal}`), h('p', { class: 'parecer' }, ult.parecer || 'Sem recado nesta avaliação.'),
        h('a', { class: 'btn', href: '#mensagens' }, ic('M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z', 18), `Conversar com ${personal}`)),
      h('a', { class: 'btn primary grande', href: '#av-' + ult.id }, 'Ver a avaliação completa ›')];
  }
  function alunoAvaliacoes() {
    const { eu, avs } = est.aluno;
    if (!avs.length) return h('p', { class: 'aviso' }, 'Nenhuma avaliação ainda.');
    return [h('h2', { class: 'titulo-pagina' }, 'Avaliações'),
      h('div', { class: 'lista-av' }, [...avs].reverse().map((v, i) => { const c = K.calcular(eu, v);
        return h('a', { class: 'linha-lista', href: '#av-' + v.id },
          h('span', { class: 's-tit' }, h('strong', null, dataBR(v.data), i === 0 ? h('span', { class: 'chip destaque-coral' }, 'Mais recente') : null),
            h('span', null, [c.gordura == null ? null : `Gordura ${fmt(c.gordura)}%`, c.massaMuscular == null ? null : `Músculo ${fmt(c.massaMuscular)} kg`, c.peso == null ? null : `${fmt(c.peso)} kg`].filter(Boolean).join(' · '))),
          h('span', { class: 'seta-dir', 'aria-hidden': 'true' })); }))];
  }
  function alunoEvolucao() {
    const { eu, avs } = est.aluno;
    const titulo = h('h2', { class: 'titulo-pagina' }, 'Evolução');
    const z = zonasDoAluno(eu, avs);
    const zonas = z ? secaoZonas({ fc: z.fc, exercicios: z.exercicios, paraAluno: true, dataFC: z.dataFC }) : null;
    if (avs.length < 2) return [titulo, h('p', { class: 'aviso' }, 'Os gráficos de evolução aparecem a partir da sua segunda avaliação.'), zonas];
    const ordem = ['Gordura', 'Massa muscular', 'Peso', 'Cintura', 'VO₂máx (Cooper)'];
    const series = ordem.map(t => SERIES.find(sr => sr.t === t)).filter(sr => sr && avs.filter(v => Number.isFinite(sr.f(v, K.calcular(eu, v)))).length >= 2);
    if (!series.some(sr => sr.t === est.aluno.serie)) est.aluno.serie = series[0]?.t;
    const atual = series.find(sr => sr.t === est.aluno.serie);
    const pri = avs[0], ult = avs.at(-1), c0 = K.calcular(eu, pri), c = K.calcular(eu, ult);
    const mud = [['Gordura', c0.gordura, c.gordura, '%', -1], ['Massa muscular', c0.massaMuscular, c.massaMuscular, 'kg', 1], ['Cintura', pri.perimetros?.cintura, ult.perimetros?.cintura, 'cm', -1],
      ['Supino (1RM)', c0.supino1RM, c.supino1RM, 'kg', 1], ['Flexão de braço', c0.testes.flexao, c.testes.flexao, 'rep.', 1, 0], ['Abdominal (1 min)', c0.testes.abdominal, c.testes.abdominal, 'rep.', 1, 0],
      ['VO₂máx', c0.testes.vo2, c.testes.vo2, '', 1], ['Peso', c0.peso, c.peso, 'kg', 0]]
      .filter(([, x, y]) => Number.isFinite(x) && Number.isFinite(y));
    return [titulo,
      series.length > 1 ? h('div', { class: 'seletor', role: 'group', 'aria-label': 'Medida do gráfico' }, series.map(sr => h('button', { type: 'button', 'aria-pressed': String(sr === atual),
        onclick: () => { est.aluno.serie = sr.t; rotearAluno(); } }, { 'Massa muscular': 'Músculo', 'VO₂máx (Cooper)': 'VO₂' }[sr.t] || sr.t))) : null,
      atual ? h('section', { class: 'card' }, grafico(eu, avs, atual)) : null,
      mud.length ? h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, `Desde a primeira avaliação (${dataBR(pri.data)})`),
        h('ul', { class: 'lista-mudancas' }, mud.map(([n, x, y, un, d, casas = 1]) => { const dif = y - x, sn = sentido(dif, d);
          return h('li', null, h('span', null, n), h('span', { class: 'de' }, `${fmt(x, casas)} → ${fmt(y, casas)}${un ? ' ' + un : ''}`),
            h('span', { class: 'delta ' + sn }, `${dif > 0 ? '▲ +' : dif < 0 ? '▼ ' : ''}${fmt(dif, casas)}`, sn === 'bom' ? h('span', { 'aria-hidden': 'true' }, ' ✓') : null, sn === 'bom' ? h('span', { class: 'sr-only' }, ' (melhorou)') : null)); })),
        h('p', { class: 'sub' }, 'Verde com ✓: mudou na direção que você quer.')) : null,
      zonas];
  }
  function alunoPerfil() {
    const { eu, personal } = est.aluno;
    return [h('h2', { class: 'titulo-pagina' }, 'Perfil'),
      h('section', { class: 'card' }, h('div', { class: 'ficha-cab' }, h('span', { class: 'avatar grande', 'aria-hidden': 'true' }, iniciais(eu.nome)),
        h('div', null, h('h2', null, eu.nome), h('p', { class: 'sub' }, `Seu personal: ${personal}`)))),
      h('section', { class: 'card' }, h('h3', { class: 'titulo-secao' }, 'Seus dados'),
        h('p', { class: 'parecer' }, `Só você e ${personal} veem as suas avaliações pelo app. As mensagens de vocês também. Para corrigir alguma informação ou pedir a exclusão completa dos seus dados (avaliações e mensagens), fale com ${personal}.`)),
      h('div', { class: 'linha' }, h('button', { class: 'btn', type: 'button', onclick: abrirTutorial }, 'Como usar o app'),
        h('button', { class: 'btn perigo-leve', type: 'button', onclick: () => $('sairBtn').click() }, 'Sair'))];
  }

  /* ----- Mensagens: conversa do aluno com o personal (1.0.0) ----- */
  const ic = (d, tam = 22) => s('svg', { width: tam, height: tam, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, [].concat(d).map(x => s('path', { d: x })));
  const IC_ANEXO = 'M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9';
  const IC_ENVIAR = ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'];
  const IC_FICHA = ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 8h6M9 12h6M9 16h4'];
  const CAMPOS_MSG = 'id,aluno_id,autor,texto,avaliacao_id,criado_em,lida_em';
  /** O aluno de exemplo e quem ainda não tem acesso ao app não conversam. */
  const podeConversar = a => !!a && !a.exemplo && !!a.usuario_id;
  async function carregarResumoMensagens() {
    if (!est.usuario) return;
    const { data, error } = await db.from('mensagens').select('aluno_id,autor,texto,avaliacao_id,criado_em,lida_em').order('criado_em', { ascending: false }).limit(1000);
    if (error) return; // sem conexão: tenta de novo na próxima volta
    est.chat.resumo = resumoConversas(data, est.usuario.id);
    atualizarBadges();
    if (est.papel === 'personal' && lerRota(location.hash).tela === 'mensagens' && !est.chat.aberto) $('principal').replaceChildren(...soElementos(telaMensagens()));
  }
  function atualizarBadges() {
    let total = 0; for (const o of est.chat.resumo.values()) total += o.naoLidas;
    const texto = total > 99 ? '99+' : String(total), rotulo = total ? `Mensagens, ${total} não ${total === 1 ? 'lida' : 'lidas'}` : 'Mensagens';
    for (const id of ['msgBadge', 'navMsgBadge']) { $(id).textContent = texto; $(id).classList.toggle('hidden', !total); }
    $('msgBtn').setAttribute('aria-label', rotulo); $('msgBtn').title = rotulo;
    document.querySelector('#navAluno a[data-aba="mensagens"]')?.setAttribute('aria-label', rotulo);
    if (est.papel === 'personal' && !$('listaAlunos').contains(document.activeElement)) desenharLista(est.listaAtual ?? null);
  }
  /** "14 out" (com o ano se não for deste ano), como nos cartões do design. */
  const dataMsg = iso => { const [y, m, d] = String(iso).split('-').map(Number), t = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ');
    return y === new Date().getFullYear() ? t : `${t} ${y}`; };
  const previa = m => (m.autor === est.usuario.id ? 'Você: ' : '') + (m.texto || 'Avaliação enviada');

  /** Personal: lista de conversas, as mais recentes primeiro (como nos apps de mensagem). */
  function telaMensagens() {
    const alunos = est.alunos.filter(a => !a.exemplo), r = est.chat.resumo;
    const comConversa = alunos.filter(podeConversar).sort((x, y) => (r.get(y.id)?.ultima?.criado_em || '').localeCompare(r.get(x.id)?.ultima?.criado_em || '') || x.nome.localeCompare(y.nome));
    const semAcesso = alunos.filter(a => !podeConversar(a));
    const item = a => { const o = r.get(a.id), m = o?.ultima;
      return h('a', { class: 'conversa-item' + (o?.naoLidas ? ' nova' : ''), href: '#conversa-' + a.id },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(a.nome)),
        h('span', { class: 'c-meio' }, h('strong', null, a.nome), h('span', { class: 'c-previa' }, m ? previa(m) : 'Nenhuma mensagem ainda. Toque para começar.')),
        h('span', { class: 'c-fim' }, m ? h('span', { class: 'c-hora' }, quandoNaLista(m.criado_em)) : null,
          o?.naoLidas ? h('span', { class: 'badge' }, String(o.naoLidas), h('span', { class: 'sr-only' }, o.naoLidas === 1 ? ' não lida' : ' não lidas')) : null)); };
    return [h('div', { class: 'linha so-cel' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => ir('inicio') }, '‹ Alunos')),
      h('section', { class: 'card' }, h('div', { class: 'card-topo' }, h('div', null, h('h2', null, 'Mensagens'), h('p', { class: 'sub' }, 'Conversas com os seus alunos.'))),
        comConversa.length ? h('div', { class: 'lista-conversas' }, comConversa.map(item))
          : h('p', { class: 'aviso' }, alunos.length ? 'Nenhum aluno com acesso ao app ainda. Convide um aluno para conversar com ele por aqui.' : 'Cadastre e convide um aluno para conversar com ele por aqui.'),
        semAcesso.length ? h('div', { class: 'lista-conversas sem-acesso' }, h('h3', { class: 'titulo-secao' }, 'Sem acesso ao app'),
          semAcesso.map(a => h('div', { class: 'conversa-item' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(a.nome)),
            h('span', { class: 'c-meio' }, h('strong', null, a.nome), h('span', { class: 'c-previa' }, 'Convide para conversar pelo app')),
            h('button', { class: 'btn', type: 'button', onclick: () => abrirConvite(a) }, 'Convidar')))) : null,
        h('p', { class: 'sub nota-chat' }, 'Só você e o aluno veem a conversa. As mensagens fazem parte dos dados do aluno e são apagadas junto quando ele pede a exclusão.'))];
  }

  /** Tela da conversa (personal e aluno). A lista se atualiza sozinha sem apagar o que está sendo digitado. */
  function telaConversa({ alunoId, nome, detalhe, paraAluno, voltar, ficha, avaliacoes }) {
    const lista = h('div', { class: 'chat-lista', role: 'log', 'aria-label': `Conversa com ${nome}`, 'aria-live': 'polite' }, h('p', { class: 'vazio' }, 'Carregando…'));
    const campo = h('textarea', { class: 'chat-campo', rows: '1', maxlength: String(MENSAGEM_MAX), placeholder: 'Mensagem', 'aria-label': `Mensagem para ${nome}` });
    const msg = h('p', { class: 'msg', role: 'status', 'aria-live': 'polite' });
    const enviarBtn = h('button', { class: 'chat-enviar', type: 'submit', 'aria-label': 'Enviar mensagem' }, ic(IC_ENVIAR));
    const ajustar = () => { campo.style.height = 'auto'; campo.style.height = Math.min(campo.scrollHeight, 140) + 'px'; };
    campo.addEventListener('input', ajustar);
    campo.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && matchMedia('(pointer: fine)').matches) { ev.preventDefault(); form.requestSubmit(); } });
    let painel = null, anexoBtn = null;
    if (avaliacoes) {
      painel = h('div', { class: 'chat-anexos hidden', id: 'chatAnexos' }, h('p', { class: 'sub' }, avaliacoes.length ? 'Enviar uma avaliação para o aluno abrir pelo app:' : 'Este aluno ainda não tem avaliação.'),
        [...avaliacoes].reverse().slice(0, 6).map(v => h('button', { class: 'btn', type: 'button', onclick: () => { painel.classList.add('hidden'); anexoBtn.setAttribute('aria-expanded', 'false'); enviar({ avaliacao_id: v.id }); } }, `Avaliação de ${dataMsg(v.data)}`)));
      anexoBtn = h('button', { class: 'chat-anexo', type: 'button', 'aria-label': 'Anexar uma avaliação', 'aria-expanded': 'false', 'aria-controls': 'chatAnexos',
        onclick: () => { const abrir = painel.classList.contains('hidden'); painel.classList.toggle('hidden', !abrir); anexoBtn.setAttribute('aria-expanded', String(abrir)); } }, ic(IC_ANEXO));
    }
    async function enviar(dados) {
      enviarBtn.disabled = true; msg.textContent = '';
      const { error } = await db.from('mensagens').insert({ aluno_id: alunoId, ...dados });
      enviarBtn.disabled = false;
      if (error) { msg.textContent = /Failed to fetch|NetworkError/i.test(String(error.message)) ? 'Sem conexão. A mensagem não foi enviada.' : 'Não foi possível enviar. Tente de novo.'; return false; }
      await atualizarConversa(true); return true;
    }
    const form = h('form', { class: 'chat-form', onsubmit: async ev => {
      ev.preventDefault();
      const texto = limparMensagem(campo.value);
      if (!texto) return campo.focus();
      if (await enviar({ texto })) { campo.value = ''; ajustar(); campo.focus(); }
    } }, anexoBtn, campo, enviarBtn);
    const cab = h('div', { class: 'chat-cab' },
      voltar ? h('a', { class: 'btn ghost icone', href: voltar, 'aria-label': 'Voltar para as mensagens' }, ic('M19 12H5M12 19l-7-7 7-7')) : null,
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(nome)),
      h('span', { class: 'c-meio' }, h('strong', null, nome), detalhe ? h('span', { class: 'c-previa' }, detalhe) : null),
      ficha ? h('a', { class: 'btn', href: ficha }, ic(IC_FICHA, 18), 'Ficha') : null);
    est.chat.aberto = { alunoId, lista, paraAluno, nome, assinatura: '', divisor: undefined };
    return h('section', { class: 'card chat' + (paraAluno ? ' do-aluno' : '') }, cab, lista, h('div', { class: 'chat-pe' }, painel, msg, form));
  }
  /** Busca a conversa aberta, desenha (se mudou) e marca como lidas as mensagens recebidas. */
  async function atualizarConversa(rolarSempre = false) {
    const c = est.chat.aberto; if (!c) return;
    const { data, error } = await db.from('mensagens').select(CAMPOS_MSG).eq('aluno_id', c.alunoId).order('criado_em').limit(500);
    if (est.chat.aberto !== c) return; // trocou de tela enquanto buscava
    if (error) { if (!c.assinatura) c.lista.replaceChildren(h('p', { class: 'aviso' }, 'Não foi possível abrir a conversa. Verifique a internet.')); return; }
    const eu = est.usuario.id, recebidasNovas = data.filter(m => m.autor !== eu && !m.lida_em);
    if (c.divisor === undefined) c.divisor = recebidasNovas[0]?.id || null; // "N novas" só na hora de abrir
    if (est.papel === 'aluno' && data.some(m => m.avaliacao_id && !est.aluno.avs.some(v => v.id === m.avaliacao_id))) { await carregarAluno().catch(() => {}); if (est.chat.aberto !== c) return; }
    const assinatura = data.map(m => m.id + (m.lida_em ? '+' : '')).join(',');
    if (assinatura !== c.assinatura) {
      const pertoDoFim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
      c.assinatura = assinatura; desenharMensagens(c, data);
      if (rolarSempre || pertoDoFim || c.primeira !== false) window.scrollTo({ top: document.documentElement.scrollHeight });
      c.primeira = false;
    }
    if (recebidasNovas.length && document.visibilityState === 'visible') {
      const { error: e2 } = await db.from('mensagens').update({ lida_em: new Date().toISOString() }).eq('aluno_id', c.alunoId).is('lida_em', null).neq('autor', eu);
      if (!e2) { const o = est.chat.resumo.get(c.alunoId); if (o) { o.naoLidas = 0; atualizarBadges(); } }
    } else if (est.chat.resumo.get(c.alunoId)?.naoLidas) carregarResumoMensagens();
  }
  function desenharMensagens(c, msgs) {
    if (!msgs.length) { c.lista.replaceChildren(h('p', { class: 'chat-vazio' }, c.paraAluno ? `Mande uma mensagem para ${c.nome}: dúvidas sobre a avaliação, o treino ou o que precisar.` : `Nenhuma mensagem ainda. Escreva para ${primeiro(c.nome)} ou envie uma avaliação pelo clipe.`)); return; }
    const eu = est.usuario.id, avs = est.papel === 'aluno' ? est.aluno.avs : est.avs.get(c.alunoId) || [];
    const novas = c.divisor ? msgs.slice(msgs.findIndex(m => m.id === c.divisor)).filter(m => m.autor !== eu).length : 0;
    const itens = []; let dia = null;
    for (const m of msgs) {
      const rot = rotuloDia(m.criado_em);
      if (rot !== dia) { dia = rot; itens.push(h('p', { class: 'chat-dia' }, rot)); }
      if (m.id === c.divisor) itens.push(h('p', { class: 'chat-novas' }, novas === 1 ? '1 nova' : `${novas} novas`));
      const minha = m.autor === eu, rodape = h('span', { class: 'chat-hora' }, horaCurta(m.criado_em) + (minha && m.lida_em ? ' · lida' : ''));
      const v = m.avaliacao_id ? avs.find(x => x.id === m.avaliacao_id) : null;
      const cartao = m.avaliacao_id ? h('a', { class: 'chat-av', href: '#av-' + m.avaliacao_id },
        h('span', { class: 'chat-av-ic', 'aria-hidden': 'true' }, ic(IC_FICHA)),
        h('span', null, h('strong', null, v ? `Avaliação de ${dataMsg(v.data)}` : 'Avaliação'), h('span', { class: 'c-previa' }, minha ? 'Enviada' : 'Toque para ver'))) : null;
      itens.push(h('div', { class: 'bolha ' + (minha ? 'minha' : 'dele') }, cartao, m.texto ? h('p', null, m.texto) : null, rodape));
    }
    c.lista.replaceChildren(...itens);
  }
  /** Volta de tempos em tempos (e ao voltar para o app) para trazer mensagens novas. */
  async function verificarMensagens() {
    if (!est.usuario || !est.papel || document.visibilityState !== 'visible') return;
    if (est.chat.aberto) await atualizarConversa(); else await carregarResumoMensagens();
    if (est.chat.aberto) carregarResumoMensagens();
  }
  setInterval(verificarMensagens, INTERVALO_MENSAGENS_MS);
  document.addEventListener('visibilitychange', verificarMensagens);
  function alunoMensagens() {
    const { eu, personal } = est.aluno;
    return telaConversa({ alunoId: eu.id, nome: personal === 'seu personal' ? 'Seu personal' : personal, detalhe: personal === 'seu personal' ? null : 'Seu personal', paraAluno: true });
  }

  /* ----- Guia de primeiro acesso e aluno de exemplo ----- */
  const tut = { passos: [], passo: 0 };
  const chaveTutorial = id => 'tutorialVisto:' + id;
  function desenharPasso() {
    const total = tut.passos.length, p = tut.passos[tut.passo], ultimo = tut.passo === total - 1;
    $('tutContagem').textContent = `Passo ${tut.passo + 1} de ${total}`;
    $('tutIcone').textContent = p.icone; $('tutTitulo').textContent = p.titulo; $('tutTexto').textContent = p.texto;
    $('tutItens').replaceChildren(...p.itens.map(t => h('li', null, t)));
    $('tutPontos').replaceChildren(...tut.passos.map((q, i) => h('button', { class: 'tut-ponto', type: 'button', 'aria-label': `Ir para o passo ${i + 1}: ${q.titulo}`, 'aria-current': i === tut.passo ? 'step' : null, onclick: () => { tut.passo = i; desenharPasso(); } })));
    $('tutVoltar').classList.toggle('hidden', tut.passo === 0);
    $('tutPular').classList.toggle('hidden', ultimo);
    const exemplo = est.papel === 'personal' && est.alunos.find(a => a.exemplo);
    $('tutProximo').textContent = ultimo ? (exemplo ? 'Ver o aluno de exemplo' : 'Começar') : 'Próximo';
  }
  function abrirTutorial() {
    if ($('tutorialDialog').open || !est.papel) return;
    tut.passos = est.papel === 'aluno' ? PASSOS_TUTORIAL_ALUNO : PASSOS_TUTORIAL_PERSONAL; tut.passo = 0;
    desenharPasso(); $('tutorialDialog').showModal(); $('tutProximo').focus();
  }
  function marcarTutorialVisto() {
    if (!est.usuario) return;
    try { localStorage.setItem(chaveTutorial(est.usuario.id), '1'); } catch (_) { /* sem armazenamento */ }
    if (est.usuario.user_metadata?.tutorial_visto !== true) db.auth.updateUser({ data: { tutorial_visto: true } }).catch(() => { /* fica só neste aparelho */ });
  }
  function talvezMostrarTutorial() {
    let visto = null;
    try { visto = localStorage.getItem(chaveTutorial(est.usuario.id)); } catch (_) { /* sem armazenamento */ }
    if (deveMostrarTutorial(est.usuario.user_metadata, visto)) abrirTutorial();
  }
  $('ajudaBtn').addEventListener('click', abrirTutorial);
  /* ----- Menu da conta (avatar no topo) ----- */
  const menuConta = aberto => { $('contaMenu').classList.toggle('hidden', !aberto); $('contaBtn').setAttribute('aria-expanded', String(aberto)); };
  $('contaBtn').addEventListener('click', ev => { ev.stopPropagation(); const abrir = $('contaMenu').classList.contains('hidden'); menuConta(abrir);
    if (abrir) $('contaMenu').querySelector('button:not(.hidden)')?.focus(); });
  $('contaMenu').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b && !b.dataset.tema) menuConta(false); });
  /* ----- Tema: automático (segue o aparelho), claro ou escuro; guardado só neste aparelho ----- */
  function aplicarTema(t) {
    if (t === 'claro' || t === 'escuro') document.documentElement.dataset.theme = t === 'escuro' ? 'dark' : 'light';
    else delete document.documentElement.dataset.theme;
    document.querySelectorAll('[data-tema]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tema === (t || 'auto'))));
    const escuro = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#171412' : '#f6f3ef');
  }
  let temaSalvo = null;
  try { temaSalvo = localStorage.getItem('tema'); } catch (_) { /* sem armazenamento */ }
  aplicarTema(temaSalvo);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema(temaSalvo));
  document.querySelectorAll('[data-tema]').forEach(b => b.addEventListener('click', () => {
    temaSalvo = b.dataset.tema === 'auto' ? null : b.dataset.tema;
    try { if (temaSalvo) localStorage.setItem('tema', temaSalvo); else localStorage.removeItem('tema'); } catch (_) { /* sem armazenamento */ }
    aplicarTema(temaSalvo);
  }));
  document.addEventListener('click', ev => { if (!ev.target.closest('.conta')) menuConta(false); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('contaMenu').classList.contains('hidden')) { menuConta(false); $('contaBtn').focus(); } });
  const mostrarQuem = (nome, detalhe) => { $('quemSou').textContent = detalhe ? `${nome} · ${detalhe}` : nome; $('contaNome').textContent = nome; $('contaIniciais').textContent = iniciais(nome) || '·'; };
  $('tutProximo').addEventListener('click', () => {
    if (tut.passo < tut.passos.length - 1) { tut.passo++; desenharPasso(); $('tutProximo').focus(); return; }
    const exemplo = est.papel === 'personal' && est.alunos.find(a => a.exemplo);
    $('tutorialDialog').close();
    if (exemplo) ir('aluno-' + exemplo.id + '-evolucao');
  });
  $('tutVoltar').addEventListener('click', () => { if (tut.passo > 0) { tut.passo--; desenharPasso(); } });
  ['tutPular', 'tutFechar'].forEach(id => $(id).addEventListener('click', () => $('tutorialDialog').close()));
  $('tutorialDialog').addEventListener('keydown', ev => {
    if (ev.target.closest?.('.tut-pontos')) return;
    if (ev.key === 'ArrowRight' && tut.passo < tut.passos.length - 1) { tut.passo++; desenharPasso(); }
    if (ev.key === 'ArrowLeft' && tut.passo > 0) { tut.passo--; desenharPasso(); }
  });
  // Fechou de qualquer jeito (Começar, Pular, ✕ ou Esc): conta como visto.
  $('tutorialDialog').addEventListener('close', () => { if (est.usuario) marcarTutorialVisto(); });

  /** Primeiro acesso de um personal novo: cria a Mariana de exemplo com 3 avaliações. Falhou no meio? Desfaz. */
  async function criarAlunoExemplo() {
    const { data: al, error } = await db.from('alunos').insert({ ...ALUNO_EXEMPLO }).select('id').single();
    if (error || !al) return false;
    const { error: e2 } = await db.from('avaliacoes').insert(avaliacoesExemplo(al.id));
    if (e2) { await db.from('alunos').delete().eq('id', al.id); return false; }
    db.auth.updateUser({ data: { exemplo_criado: true } }).catch(() => { /* sem a marca, só cria de novo se ele ficar sem alunos */ });
    return true;
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
    $('msgBtn').classList.toggle('hidden', papel !== 'personal');
    est.chat = { resumo: new Map(), aberto: null };
    $('personaisBtn').classList.add('hidden');
    if (papel === 'personal') db.rpc('sou_administrador').then(({ data }) => $('personaisBtn').classList.toggle('hidden', data !== true)).catch(() => {});
    try {
      if (papel === 'personal') {
        await carregarPersonal();
        if (deveCriarExemplo(est.usuario.user_metadata, est.alunos.length) && await criarAlunoExemplo()) await carregarPersonal();
        await carregarResumoMensagens(); rotear(); talvezMostrarTutorial();
      }
      else if (papel === 'aluno') { await carregarAluno(); await carregarResumoMensagens(); $('navAluno').classList.remove('hidden'); document.body.classList.add('com-nav'); rotearAluno(); talvezMostrarTutorial(); }
      else { $('areaAluno').classList.remove('hidden'); $('areaAluno').replaceChildren(h('section', { class: 'card' }, h('h2', null, 'Acesso sem ficha'), h('p', { class: 'sub' }, 'Este login não está ligado a nenhuma ficha de aluno. Peça um novo convite ao seu personal.'))); }
    } catch (e) { aviso('msgGlobal', erroBanco(e)); }
  }
  function sair() {
    Object.assign(est, { papel: null, usuario: null }); // antes de fechar: fechar o guia ao sair não conta como visto
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    Object.assign(est, { papel: null, usuario: null, personal: null, alunos: [], rascunho: null, rascunhoChave: null });
    est.avs.clear(); est.aluno = null; $('principal').replaceChildren(); $('areaAluno').replaceChildren(); $('listaAlunos').replaceChildren();
    $('navAluno').classList.add('hidden'); document.body.classList.remove('com-nav'); menuConta(false);
    est.chat = { resumo: new Map(), aberto: null }; $('msgBtn').classList.add('hidden'); atualizarBadges();
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
  window.addEventListener('hashchange', () => (est.papel === 'aluno' ? rotearAluno() : rotear()));

  const convite = conviteDoLink(location.search), codigo = convite.codigo, ehPersonal = convite.tipo === 'personal', conviteLigado = { sim: convite.tipo !== null };
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
    if (ehPersonal) {
      try {
        const r = await chamarCadastro({ tipo: 'personal', acao: 'verificar', codigo });
        $('convTitulo').textContent = 'Crie seu acesso de personal';
        $('convSub').textContent = `${r.convidou && r.convidou !== 'Personal' ? r.convidou : 'O administrador'} convidou você para usar o app como personal: avaliar seus próprios alunos e acompanhar a evolução deles.`;
        $('termoAluno').classList.add('hidden'); $('termoPersonal').classList.remove('hidden'); $('convNomeCampo').classList.remove('hidden');
        $('convAceiteTexto').textContent = 'Li e aceito o termo de uso para personais';
        $('termoPVersao').textContent = r.termo; est.termo = r.termo;
        $('convCampos').classList.remove('hidden'); $('convNome').focus();
      } catch (e) { conviteInvalido(e.message); }
      return;
    }
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
    if (!$('convAceite').checked) return aviso('convMsg', ehPersonal ? 'Para continuar, leia e aceite o termo de uso para personais.' : 'Para continuar, leia e aceite o termo de uso dos seus dados.');
    const nome = $('convNome').value.trim();
    if (ehPersonal && nome.length < 2) return aviso('convMsg', 'Informe seu nome.');
    if (!email) return aviso('convMsg', 'Informe seu e-mail.');
    if (senha.length < 10) return aviso('convMsg', 'A senha precisa ter pelo menos 10 caracteres.');
    if (senha !== $('convSenha2').value) return aviso('convMsg', 'As duas senhas não são iguais.');
    $('convBtn').disabled = true; aviso('convMsg', 'Criando seu acesso…', true);
    try {
      await chamarCadastro(ehPersonal
        ? { tipo: 'personal', acao: 'cadastrar', codigo, nome, email, senha, aceite: true, termo: est.termo || TERMO_PERSONAL_VERSAO }
        : { acao: 'cadastrar', codigo, email, senha, aceite: true, termo: est.termo || TERMO_VERSAO });
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

  /* ----- Sugestão de instalar (celular, sempre que abrir pelo navegador) ----- */
  const inst = { prompt: null };
  const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const dispensadoNestaVisita = () => { try { return sessionStorage.getItem('instalarDepois') === '1'; } catch (_) { return false; } };
  function mostrarInstalar() {
    const tipo = dispensadoNestaVisita() ? null : avisoInstalacao({ ua: navigator.userAgent, instalado: instalado(), temPrompt: !!inst.prompt, toques: navigator.maxTouchPoints || 0 });
    $('instalarAviso').classList.toggle('hidden', !tipo);
    document.body.classList.toggle('com-instalar', !!tipo); // espaço embaixo para o aviso não cobrir a página
    if (!tipo) return;
    $('instalarTexto').textContent = TEXTO_INSTALAR[tipo];
    $('instalarBtn').classList.toggle('hidden', tipo !== 'android');
  }
  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); inst.prompt = ev; mostrarInstalar(); });
  window.addEventListener('appinstalled', () => { inst.prompt = null; $('instalarAviso').classList.add('hidden'); document.body.classList.remove('com-instalar'); });
  $('instalarBtn').addEventListener('click', async () => {
    if (!inst.prompt) return;
    inst.prompt.prompt();
    try { await inst.prompt.userChoice; } catch (_) { /* fechou a janela */ }
    inst.prompt = null; mostrarInstalar();
  });
  $('instalarFechar').addEventListener('click', () => {
    try { sessionStorage.setItem('instalarDepois', '1'); } catch (_) { /* sem armazenamento */ }
    $('instalarAviso').classList.add('hidden'); document.body.classList.remove('com-instalar');
  });
  mostrarInstalar();

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
