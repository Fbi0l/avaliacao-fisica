// Cadastro do aluno por convite, com banco e Auth simulados (sem rede).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tratarCadastro, validarSenha, senhaVazada, hashCodigo, TERMO_VERSAO } from '../supabase/functions/registrar-aluno/cadastro.js';

const sha = s => createHash('sha256').update(s).digest('hex');
const CODIGO = 'A'.repeat(20) + '_-' + 'b9'.repeat(10) + 'x';
assert.equal(CODIGO.length, 43);
assert.equal(await hashCodigo(CODIGO), sha(CODIGO), 'hash igual ao do banco (sha256 hex)');

// Senhas
assert.match(validarSenha('curta'), /10 caracteres/);
assert.match(validarSenha('aaaaaaaaaaaa'), /previsível/);
assert.match(validarSenha('mariana2026!!', 'mariana@x.com'), /e-mail/);
assert.equal(validarSenha('cavalo-azul-bateria', 'ana@x.com'), null);
const sha1 = s => createHash('sha1').update(s).digest('hex').toUpperCase();
const hibp = async () => ({ ok: true, text: async () => `${sha1('senha-muito-vazada').slice(5)}:1234\n` });
assert.equal(await senhaVazada('senha-muito-vazada', hibp), true);
assert.equal(await senhaVazada('x', async () => { throw new Error('offline'); }), false);
const hibpLimpo = async () => ({ ok: true, text: async () => '' });

// Banco simulado: tabelas como listas; update ... returning é atômico (como no Postgres).
function ambiente({ falharCriacao = false, atraso = 0, falharConsentimento = false, alunoJaLigado = false, extraConvite = {} } = {}) {
  const futuro = new Date(Date.now() + 864e5).toISOString();
  const db = {
    convites_aluno: [{ id: 'c1', aluno_id: 'al1', personal_id: 'p1', codigo_hash: sha(CODIGO), usado_em: null, cancelado_em: null, expira_em: futuro, usado_por: null, ...extraConvite }],
    alunos: [{ id: 'al1', nome: 'Mariana Costa', usuario_id: alunoJaLigado ? 'outro' : null }],
    personais: [{ usuario_id: 'p1', nome: 'Fabio' }],
    consentimentos: []
  };
  const usuarios = [{ id: 'u0', email: 'ja@existe.com' }];
  const admin = {
    auth: { admin: {
      createUser: async ({ email, password, email_confirm }) => {
        await new Promise(r => setTimeout(r, atraso));
        assert.equal(email_confirm, true);
        if (falharCriacao || usuarios.some(u => u.email === email)) return { data: null, error: { message: 'A user with this email address has already been registered' } };
        const user = { id: 'novo-' + usuarios.length, email, password }; usuarios.push(user); return { data: { user }, error: null };
      },
      deleteUser: async id => { const i = usuarios.findIndex(u => u.id === id); if (i >= 0) usuarios.splice(i, 1); return { error: null }; }
    } },
    from(tabela) {
      assert.ok(tabela in db, `tabela ${tabela}`);
      let filtros = [], acao = 'select', valores = null;
      const passa = l => filtros.every(([op, c, v]) => op === 'gt' ? l[c] > v : l[c] === v);
      const q = {
        select() { return q; }, update(v) { acao = 'update'; valores = v; return q; },
        insert(v) {
          if (tabela === 'consentimentos' && falharConsentimento) return Promise.resolve({ error: { code: '23503' } });
          db[tabela].push({ ...v }); return Promise.resolve({ error: null });
        },
        eq(c, v) { filtros.push(['eq', c, v]); return q; }, is(c, v) { filtros.push(['is', c, v]); return q; }, gt(c, v) { filtros.push(['gt', c, v]); return q; },
        maybeSingle() { return Promise.resolve({ data: db[tabela].filter(passa)[0] ?? null, error: null }); },
        then(res, rej) {
          const alvo = db[tabela].filter(passa);
          if (acao === 'update') alvo.forEach(l => Object.assign(l, valores));
          return Promise.resolve({ data: alvo.map(l => ({ ...l })), error: null }).then(res, rej);
        }
      };
      return q;
    }
  };
  return { admin, db, usuarios };
}
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' };
const pedir = (corpo, origem = 'https://fbi0l.github.io', bruto) => new Request('https://x/functions/v1/registrar-aluno', { method: 'POST', headers: { origin: origem, 'content-type': 'application/json' }, body: bruto ?? JSON.stringify(corpo) });
async function rodar(req, amb, fetchFn = hibpLimpo) {
  let chave;
  const r = await tratarCadastro(req, { env: ENV, fetchFn, criarCliente: (u, k) => { chave = k; return amb.admin; } });
  return { status: r.status, corpo: r.status === 204 ? null : await r.json(), chave };
}

// Entrada e CORS
let amb = ambiente();
assert.equal((await rodar(pedir({ acao: 'verificar', codigo: CODIGO }, 'https://malicioso.com'), amb)).status, 403);
assert.equal((await rodar(pedir(null, undefined, '{'), amb)).status, 400);
assert.equal((await rodar(pedir(null, undefined, '{"a":"' + 'x'.repeat(5000) + '"}'), amb)).status, 413);
for (const ruim of ['', 'curto', CODIGO + 'a', CODIGO.slice(1) + '!'])
  assert.equal((await rodar(pedir({ acao: 'verificar', codigo: ruim }), amb)).corpo.codigo_erro, 'invalido');

// Verificar: mostra só o primeiro nome do aluno e o nome do personal
let v = await rodar(pedir({ acao: 'verificar', codigo: CODIGO }), amb);
assert.deepEqual([v.status, v.corpo.nome, v.corpo.personal, v.corpo.termo, v.chave], [200, 'Mariana', 'Fabio', TERMO_VERSAO, 'service']);
for (const extra of [{ usado_em: new Date().toISOString() }, { cancelado_em: new Date().toISOString() }, { expira_em: new Date(Date.now() - 1000).toISOString() }])
  assert.equal((await rodar(pedir({ acao: 'verificar', codigo: CODIGO }), ambiente({ extraConvite: extra }))).corpo.codigo_erro, 'expirado');

// Cadastrar exige o aceite do termo na versão atual
const base = { acao: 'cadastrar', codigo: CODIGO, email: ' Mariana@Exemplo.com ', senha: 'cavalo-azul-bateria', aceite: true, termo: TERMO_VERSAO };
for (const semAceite of [{ aceite: false }, { aceite: 'true' }, { termo: '2020-01-01' }]) {
  const r = await rodar(pedir({ ...base, ...semAceite }), amb);
  assert.deepEqual([r.status, r.corpo.codigo_erro], [400, 'termo'], JSON.stringify(semAceite));
}
assert.equal(amb.usuarios.length, 1, 'sem aceite, nenhuma conta criada');
let r = await rodar(pedir({ ...base, senha: 'senha-muito-vazada' }), amb, hibp);
assert.match(r.corpo.erro, /vazamentos/);

// Sucesso: conta criada, ligada à ficha, aceite registrado, convite usado
amb = ambiente();
r = await rodar(pedir(base), amb);
assert.deepEqual([r.status, r.corpo.ok], [201, true]);
const nova = amb.usuarios.at(-1);
assert.equal(nova.email, 'mariana@exemplo.com', 'e-mail normalizado');
assert.equal(amb.db.alunos[0].usuario_id, nova.id, 'login ligado à ficha');
assert.deepEqual(amb.db.consentimentos, [{ aluno_id: 'al1', usuario_id: nova.id, versao_termo: TERMO_VERSAO }]);
assert.equal(amb.db.convites_aluno[0].usado_por, nova.id);
r = await rodar(pedir({ ...base, email: 'outra@x.com' }), amb);
assert.deepEqual([r.status, r.corpo.codigo_erro], [410, 'expirado'], 'convite não serve de novo');

// E-mail já existente: resposta genérica e convite devolvido
amb = ambiente();
r = await rodar(pedir({ ...base, email: 'ja@existe.com' }), amb);
assert.equal(r.status, 400); assert.ok(!/existe|registrad|cadastrad/i.test(r.corpo.erro), 'não revela que o e-mail existe');
assert.equal((await rodar(pedir(base), amb)).status, 201, 'convite devolvido após a falha');

// Falha ao registrar o aceite: conta apagada, ficha solta e convite devolvido
amb = ambiente({ falharConsentimento: true });
r = await rodar(pedir(base), amb);
assert.equal(r.status, 500);
assert.deepEqual([amb.usuarios.length, amb.db.alunos[0].usuario_id, amb.db.convites_aluno[0].usado_em], [1, null, null], 'tudo desfeito');

// Ficha já ligada a outro login: não sequestra a ficha, desfaz a conta
amb = ambiente({ alunoJaLigado: true });
r = await rodar(pedir(base), amb);
assert.equal(r.status, 500); assert.equal(amb.db.alunos[0].usuario_id, 'outro'); assert.equal(amb.usuarios.length, 1);

// Dois cadastros ao mesmo tempo com o mesmo link: só um passa
amb = ambiente({ atraso: 30 });
const [a, b] = await Promise.all([rodar(pedir({ ...base, email: 'um@x.com' }), amb), rodar(pedir({ ...base, email: 'dois@x.com' }), amb)]);
assert.deepEqual([a.status, b.status].sort(), [201, 410]); assert.equal(amb.usuarios.length, 2);

assert.equal((await rodar(pedir({ acao: 'apagar', codigo: CODIGO }), amb)).status, 400);
console.log('Cadastro do aluno aprovado: código, CORS, aceite do termo, senha, ligação à ficha, desfazer em falha, uso único e corrida.');
