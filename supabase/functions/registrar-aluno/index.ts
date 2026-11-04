// Função "registrar-aluno": o aluno cria o próprio acesso pelo link do personal (sem login prévio).
// A lógica fica em cadastro.js (testada em tests/registrar-aluno.mjs).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { tratarCadastro } from './cadastro.js';

Deno.serve((req: Request) => tratarCadastro(req, { env: Deno.env.toObject(), criarCliente: createClient }));
