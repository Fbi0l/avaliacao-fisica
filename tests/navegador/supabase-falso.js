/* Supabase FALSO para os testes no navegador (tests/navegador/teste.mjs).
   Substitui o supabase-js do CDN: nada sai para a internet e os dados são fictícios.
   As avaliações vêm de avaliacoesExemplo() do próprio app.js (as mesmas da Mariana de exemplo).
   O cenário vem de window.__cenario (definido pelo teste antes de a página carregar). */
(function () {
  'use strict';
  const cen = Object.assign({ logado: false, papel: 'personal', senha: 'senha-correta-123' }, window.__cenario || {});
  const chamadas = window.__chamadas = [];
  const P = '00000000-0000-4000-8000-0000000000a1', U_ALUNO = '00000000-0000-4000-8000-0000000000b1';
  const A1 = '10000000-0000-4000-8000-000000000001', F1 = '20000000-0000-4000-8000-000000000001';
  const usuario = () => cen.papel === 'aluno'
    ? { id: U_ALUNO, email: 'aluna@exemplo.invalid', user_metadata: { tutorial_visto: true } }
    : { id: P, email: 'personal@exemplo.invalid', user_metadata: { tutorial_visto: true, exemplo_criado: true } };
  const hoje = new Date().toISOString().slice(0, 10);
  let avaliacoes = null;
  const avs = () => avaliacoes || (avaliacoes = (typeof avaliacoesExemplo === 'function' ? avaliacoesExemplo(A1) : []).map((x, i) => ({
    id: `30000000-0000-4000-8000-00000000000${i + 1}`, personal_id: P, criado_em: `${x.data}T12:00:00Z`, atualizado_em: `${x.data}T12:00:00Z`, ...x, aluno_id: A1 })));
  const ficha = { id: F1, aluno_id: A1, personal_id: P, objetivo: 'hipertrofia', divisao: 'ab', inicio: hoje, semanas: 6, vezes_semana: 4, observacao: '',
    encerrada_em: null, ciclo_id: null, bloco: null, criado_em: `${hoje}T12:00:00Z`, atualizado_em: `${hoje}T12:00:00Z`,
    treinos: [{ nome: 'A', exercicios: [{ nome: 'Supino reto', grupo: 'peito', series: 3, reps: '10', carga: 40 }] },
              { nome: 'B', exercicios: [{ nome: 'Agachamento livre', grupo: 'pernas', series: 3, reps: '10', carga: 50 }] }] };
  const tabelas = () => ({
    personais: [{ usuario_id: P, nome: 'Personal Exemplo', cref: '000000-G/PA' }],
    alunos: [{ id: A1, personal_id: P, nome: 'Aluna Exemplo Teste', sexo: 'F', nascimento: '1994-03-12', contato: null, usuario_id: U_ALUNO, exemplo: false }],
    avaliacoes: avs(),
    fichas: [ficha],
    treinos_feitos: [],
    ciclos: [],
    mensagens: [{ id: '40000000-0000-4000-8000-000000000001', aluno_id: A1, personal_id: P, autor: P, texto: 'Olá! Sua avaliação está pronta.', avaliacao_id: null, criado_em: `${hoje}T12:00:00Z`, lida_em: null }]
  });

  function consulta(nome) {
    let linhas = (tabelas()[nome] || []).slice();
    const q = {
      select: () => q, order: () => q, limit: n => { linhas = linhas.slice(0, n); return q; },
      eq: (c, v) => { linhas = linhas.filter(l => l[c] === v); return q; },
      neq: (c, v) => { linhas = linhas.filter(l => l[c] !== v); return q; },
      is: (c, v) => { linhas = linhas.filter(l => (l[c] ?? null) === v); return q; },
      gte: () => q, lte: () => q,
      insert: d => { chamadas.push({ tipo: 'insert', tabela: nome, dados: d }); linhas = [Object.assign({ id: 'novo' }, Array.isArray(d) ? d[0] : d)]; return q; },
      update: d => { chamadas.push({ tipo: 'update', tabela: nome, dados: d }); return q; },
      delete: () => { chamadas.push({ tipo: 'delete', tabela: nome }); return q; },
      single: async () => ({ data: linhas[0] || null, error: linhas[0] ? null : { message: 'sem linha' } }),
      maybeSingle: async () => ({ data: linhas[0] || null, error: null }),
      then: (ok, erro) => Promise.resolve({ data: linhas, error: null }).then(ok, erro)
    };
    return q;
  }

  let ouvinte = null;
  const sessao = () => ({ user: usuario(), access_token: 'falso' });
  const avisar = (ev, s) => setTimeout(() => ouvinte && ouvinte(ev, s), 0);

  window.supabase = {
    createClient: () => ({
      auth: {
        onAuthStateChange: cb => { ouvinte = cb; avisar('INITIAL_SESSION', cen.logado ? sessao() : null); return { data: { subscription: { unsubscribe() {} } } }; },
        getSession: async () => ({ data: { session: cen.logado ? sessao() : null } }),
        signInWithPassword: async ({ password }) => {
          chamadas.push({ tipo: 'login' });
          if (password !== cen.senha) return { data: null, error: { message: 'Invalid login credentials', status: 400 } };
          cen.logado = true; avisar('SIGNED_IN', sessao()); return { data: { session: sessao() }, error: null };
        },
        signOut: async () => { cen.logado = false; avisar('SIGNED_OUT', null); return { error: null }; },
        updateUser: async () => ({ data: {}, error: null })
      },
      from: consulta,
      rpc: async (nome, args) => {
        chamadas.push({ tipo: 'rpc', nome, args });
        if (nome === 'meu_papel') return { data: cen.papel, error: null };
        if (nome === 'sou_administrador') return { data: cen.papel === 'personal', error: null };
        if (nome === 'listar_convites_personal') return { data: [], error: null };
        if (nome === 'convite_do_aluno') return { data: [], error: null };
        return { data: true, error: null };
      },
      functions: {
        invoke: async (nome, { body } = {}) => {
          chamadas.push({ tipo: 'funcao', nome, acao: body && body.acao });
          if (nome === 'registrar-aluno' && body && body.acao === 'verificar')
            return { data: { valido: true, nome: 'Aluna', personal: 'Personal Exemplo', termo: window.__termoVersao, expira_em: new Date(Date.now() + 864e5).toISOString() }, error: null };
          return { data: { ok: true }, error: null };
        }
      }
    })
  };
})();
