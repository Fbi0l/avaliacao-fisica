// Cadastro pelo link de convite (função "registrar-aluno", sem login prévio):
// - do ALUNO, pelo convite do personal (padrão);
// - de um novo PERSONAL, pelo convite do administrador (corpo com tipo: 'personal').
// Segurança (mesmo modelo do Financeiro):
// - O código do link tem 43 caracteres aleatórios; o banco só conhece o hash SHA-256 dele.
// - O convite é RESERVADO numa única operação antes de criar a conta: dois cadastros simultâneos não passam.
// - O aluno precisa aceitar o termo de uso dos dados de saúde (LGPD); o aceite fica registrado com a versão.
// - Se qualquer passo falhar depois de criar a conta, a conta é apagada e o convite volta a valer.
// - A chave de serviço (service_role) só existe aqui no servidor, nunca no site.
// - A resposta não revela se um e-mail já tem conta. Senhas vazadas são recusadas (k-anonimato).
// Testado em tests/registrar-aluno.mjs.

export const TERMO_VERSAO = '2026-11-04';
export const TERMO_PERSONAL_VERSAO = '2026-11-05'; // igual ao do app.js
const ORIGENS = ['https://fbi0l.github.io', 'http://localhost:8098'];
const RE_CODIGO = /^[A-Za-z0-9_-]{43}$/;
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

function cabecalhos(origem) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
  if (ORIGENS.includes(origem)) {
    h['Access-Control-Allow-Origin'] = origem;
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}
const resposta = (origem, status, corpo) => new Response(JSON.stringify(corpo), { status, headers: cabecalhos(origem) });

async function hexDigest(algoritmo, texto) {
  const buf = await crypto.subtle.digest(algoritmo, new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const hashCodigo = codigo => hexDigest('SHA-256', codigo);

/** Regras da senha. Devolve a mensagem de erro ou null. */
export function validarSenha(senha, email = '') {
  const s = String(senha ?? '');
  if (s.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.';
  if (s.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (/^(.)\1+$/.test(s)) return 'Escolha uma senha menos previsível.';
  const usuario = String(email).split('@')[0].toLowerCase();
  if (usuario.length >= 4 && s.toLowerCase().includes(usuario)) return 'A senha não pode conter o seu e-mail.';
  return null;
}

/** true se a senha já apareceu em vazamentos conhecidos (k-anonimato). Em caso de falha do serviço, false. */
export async function senhaVazada(senha, fetchFn = fetch) {
  try {
    const sha1 = (await hexDigest('SHA-1', senha)).toUpperCase();
    const resp = await fetchFn(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' } });
    if (!resp.ok) return false;
    const resto = sha1.slice(5);
    return (await resp.text()).split('\n').some(l => { const [suf, n] = l.trim().split(':'); return suf === resto && Number(n) > 0; });
  } catch (_) { return false; }
}

const primeiroNome = nome => String(nome || '').trim().split(/\s+/)[0] || '';

export async function tratarCadastro(req, { env, criarCliente, fetchFn = fetch }) {
  const origem = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecalhos(origem) });
  if (req.method !== 'POST') return resposta(origem, 405, { erro: 'Método não permitido.' });
  if (origem && !ORIGENS.includes(origem)) return resposta(origem, 403, { erro: 'Origem não permitida.' });

  const bruto = await req.text();
  if (bruto.length > 4000) return resposta(origem, 413, { erro: 'Pedido grande demais.' });
  let corpo;
  try { corpo = JSON.parse(bruto); } catch (_) { return resposta(origem, 400, { erro: 'Pedido inválido.' }); }
  const codigo = String(corpo?.codigo ?? '');
  if (!RE_CODIGO.test(codigo)) return resposta(origem, 400, { erro: 'Este link de convite está incompleto ou inválido.', codigo_erro: 'invalido' });

  const admin = criarCliente(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const hash = await hashCodigo(codigo);
  const agoraIso = new Date().toISOString();
  const valido = q => q.eq('codigo_hash', hash).is('usado_em', null).is('cancelado_em', null).gt('expira_em', agoraIso);
  const INVALIDO = { erro: 'Este convite não é mais válido: ele já foi usado, foi cancelado ou venceu. Peça um novo link ao seu personal.', codigo_erro: 'expirado' };

  try {
    if (corpo.tipo === 'personal') return await cadastroPersonal({ corpo, origem, admin, hash, agoraIso, fetchFn });
    if (corpo.acao === 'verificar') {
      const { data: conv, error } = await valido(admin.from('convites_aluno').select('aluno_id,personal_id,expira_em')).maybeSingle();
      if (error) throw error;
      if (!conv) return resposta(origem, 410, INVALIDO);
      const { data: aluno } = await admin.from('alunos').select('nome').eq('id', conv.aluno_id).maybeSingle();
      const { data: personal } = await admin.from('personais').select('nome').eq('usuario_id', conv.personal_id).maybeSingle();
      return resposta(origem, 200, { valido: true, nome: primeiroNome(aluno?.nome), personal: personal?.nome || '', termo: TERMO_VERSAO, expira_em: conv.expira_em });
    }

    if (corpo.acao === 'cadastrar') {
      if (corpo.aceite !== true || corpo.termo !== TERMO_VERSAO) return resposta(origem, 400, { erro: 'Para criar o acesso, leia e aceite o termo de uso dos seus dados.', codigo_erro: 'termo' });
      const email = String(corpo.email ?? '').trim().toLowerCase();
      const senha = String(corpo.senha ?? '');
      if (!RE_EMAIL.test(email) || email.length > 254) return resposta(origem, 400, { erro: 'Informe um e-mail válido.' });
      const fraca = validarSenha(senha, email);
      if (fraca) return resposta(origem, 400, { erro: fraca });
      if (await senhaVazada(senha, fetchFn)) return resposta(origem, 400, { erro: 'Essa senha já apareceu em vazamentos de dados na internet. Escolha outra.' });

      // 1) Reserva atômica: só um pedido consegue marcar o convite.
      const { data: reservado, error: errR } = await valido(admin.from('convites_aluno').update({ usado_em: agoraIso })).select('id,aluno_id');
      if (errR) throw errR;
      if (!reservado?.length) return resposta(origem, 410, INVALIDO);
      const { id: idConvite, aluno_id: idAluno } = reservado[0];
      const devolverConvite = () => admin.from('convites_aluno').update({ usado_em: null }).eq('id', idConvite);

      // 2) Cria a conta já confirmada (o convite comprova o acesso).
      const { data: criado, error: errC } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (errC || !criado?.user) {
        await devolverConvite();
        const msg = String(errC?.message || '').toLowerCase();
        if (msg.includes('password') && (msg.includes('weak') || msg.includes('short'))) return resposta(origem, 400, { erro: 'Senha fraca demais. Use uma senha mais longa e variada.' });
        return resposta(origem, 400, { erro: 'Não foi possível criar o acesso com este e-mail. Confira o e-mail ou fale com seu personal.' });
      }
      const idUsuario = criado.user.id;

      // 3) Liga o login à ficha do aluno e registra o aceite do termo. Falhou? Desfaz tudo.
      const { data: ligado, error: errL } = await admin.from('alunos').update({ usuario_id: idUsuario }).eq('id', idAluno).is('usuario_id', null).select('id');
      const { error: errT } = (!errL && ligado?.length)
        ? await admin.from('consentimentos').insert({ aluno_id: idAluno, usuario_id: idUsuario, versao_termo: TERMO_VERSAO })
        : { error: errL || { code: 'sem_aluno' } };
      if (errL || !ligado?.length || errT) {
        if (ligado?.length) await admin.from('alunos').update({ usuario_id: null }).eq('id', idAluno);
        await admin.auth.admin.deleteUser(idUsuario);
        await devolverConvite();
        console.error('registrar-aluno: cadastro desfeito', errL?.code || errT?.code || '');
        return resposta(origem, 500, { erro: 'Não foi possível concluir agora. Tente de novo em instantes.' });
      }

      // 4) Registra quem usou o convite. A conta já vale, então tenta de novo se falhar.
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        const { error: errU } = await admin.from('convites_aluno').update({ usado_por: idUsuario }).eq('id', idConvite);
        if (!errU) break;
        if (tentativa === 3) console.error('registrar-aluno: convite usado sem registrar quem usou', errU?.code || '');
      }
      return resposta(origem, 201, { ok: true });
    }

    return resposta(origem, 400, { erro: 'Ação desconhecida.' });
  } catch (e) {
    console.error('registrar-aluno: erro interno', e?.code || '', e?.name || '');
    return resposta(origem, 500, { erro: 'Não foi possível concluir agora. Tente de novo em instantes.' });
  }
}

/** Convite de PERSONAL: mesma segurança do convite do aluno (reserva atômica, desfaz tudo em falha). */
async function cadastroPersonal({ corpo, origem, admin, hash, agoraIso, fetchFn }) {
  const valido = q => q.eq('codigo_hash', hash).is('usado_em', null).is('cancelado_em', null).gt('expira_em', agoraIso);
  const INVALIDO = { erro: 'Este convite não é mais válido: ele já foi usado, foi cancelado ou venceu. Peça um novo link a quem convidou você.', codigo_erro: 'expirado' };

  if (corpo.acao === 'verificar') {
    // O "para quem" (rotulo) é uma anotação de quem convidou: não vai para a pessoa convidada.
    const { data: conv, error } = await valido(admin.from('convites_personal').select('criado_por,expira_em')).maybeSingle();
    if (error) throw error;
    if (!conv) return resposta(origem, 410, INVALIDO);
    const { data: quem } = await admin.from('personais').select('nome').eq('usuario_id', conv.criado_por).maybeSingle();
    return resposta(origem, 200, { valido: true, tipo: 'personal', convidou: quem?.nome || '', termo: TERMO_PERSONAL_VERSAO, expira_em: conv.expira_em });
  }

  if (corpo.acao === 'cadastrar') {
    if (corpo.aceite !== true || corpo.termo !== TERMO_PERSONAL_VERSAO) return resposta(origem, 400, { erro: 'Para criar o acesso, leia e aceite o termo de uso.', codigo_erro: 'termo' });
    const nome = String(corpo.nome ?? '').trim().replace(/\s+/g, ' ');
    if (nome.length < 2 || nome.length > 80) return resposta(origem, 400, { erro: 'Informe seu nome (de 2 a 80 letras).' });
    const email = String(corpo.email ?? '').trim().toLowerCase();
    const senha = String(corpo.senha ?? '');
    if (!RE_EMAIL.test(email) || email.length > 254) return resposta(origem, 400, { erro: 'Informe um e-mail válido.' });
    const fraca = validarSenha(senha, email);
    if (fraca) return resposta(origem, 400, { erro: fraca });
    if (await senhaVazada(senha, fetchFn)) return resposta(origem, 400, { erro: 'Essa senha já apareceu em vazamentos de dados na internet. Escolha outra.' });

    // 1) Reserva atômica do convite.
    const { data: reservado, error: errR } = await valido(admin.from('convites_personal').update({ usado_em: agoraIso })).select('id');
    if (errR) throw errR;
    if (!reservado?.length) return resposta(origem, 410, INVALIDO);
    const idConvite = reservado[0].id;
    const devolverConvite = () => admin.from('convites_personal').update({ usado_em: null }).eq('id', idConvite);

    // 2) Conta já confirmada (o convite comprova o acesso).
    const { data: criado, error: errC } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (errC || !criado?.user) {
      await devolverConvite();
      const msg = String(errC?.message || '').toLowerCase();
      if (msg.includes('password') && (msg.includes('weak') || msg.includes('short'))) return resposta(origem, 400, { erro: 'Senha fraca demais. Use uma senha mais longa e variada.' });
      return resposta(origem, 400, { erro: 'Não foi possível criar o acesso com este e-mail. Confira o e-mail ou fale com quem convidou você.' });
    }
    const idUsuario = criado.user.id;

    // 3) Ficha do personal com o aceite do termo. Falhou? Apaga a conta e devolve o convite.
    const { error: errP } = await admin.from('personais').insert({ usuario_id: idUsuario, nome, termo_versao: TERMO_PERSONAL_VERSAO, termo_aceito_em: agoraIso });
    if (errP) {
      await admin.auth.admin.deleteUser(idUsuario);
      await devolverConvite();
      console.error('registrar-aluno: cadastro de personal desfeito', errP?.code || '');
      return resposta(origem, 500, { erro: 'Não foi possível concluir agora. Tente de novo em instantes.' });
    }

    // 4) Registra quem usou o convite.
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const { error: errU } = await admin.from('convites_personal').update({ usado_por: idUsuario }).eq('id', idConvite);
      if (!errU) break;
      if (tentativa === 3) console.error('registrar-aluno: convite de personal usado sem registrar quem usou', errU?.code || '');
    }
    return resposta(origem, 201, { ok: true });
  }

  return resposta(origem, 400, { erro: 'Ação desconhecida.' });
}
