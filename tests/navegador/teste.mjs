// Testes no navegador do Avaliação Física (Playwright + axe-core), sem internet e sem dados reais.
// Abre o site num servidor local, troca o Supabase por um falso (supabase-falso.js) e confere:
//  - entrada, senha errada, convite com termo de uso (LGPD) e cada tela do personal e do aluno;
//  - nenhum erro de JavaScript;
//  - acessibilidade (axe, WCAG 2.2 AA): falha com problemas sérios ou críticos;
//  - no computador e no celular. Prints em test-results/navegador/.
// Uso: npm run test:navegador   (CHROME_PATH=/caminho/do/chrome para usar um Chrome já instalado)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const require = createRequire(import.meta.url);
const axeFonte = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const supabaseFalso = fs.readFileSync(path.join(raiz, 'tests/navegador/supabase-falso.js'), 'utf8');
const termoVersao = fs.readFileSync(path.join(raiz, 'app.js'), 'utf8').match(/const TERMO_VERSAO = '([^']+)'/)[1];
const prints = path.join(raiz, 'test-results/navegador');
fs.mkdirSync(prints, { recursive: true });

// Servidor estático mínimo, só com os arquivos do site.
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arq = path.join(raiz, p.endsWith('/') ? p + 'index.html' : p);
  if (!arq.startsWith(raiz) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(arq)] || 'application/octet-stream' });
  // Só no teste: o supabase-js do CDN tem "integrity" (SRI) e o falso não bate com ele. O site publicado continua com SRI.
  if (arq.endsWith('index.html')) return res.end(fs.readFileSync(arq, 'utf8').replace(/(<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/[^"]+")\s+integrity="[^"]+"/, '$1'));
  fs.createReadStream(arq).pipe(res);
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${servidor.address().port}/`;

const navegador = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const problemasA11y = [];
let passos = 0;
const ok = msg => { passos++; console.log('  ✓ ' + msg); };

async function abrir(cenario, tamanho = { width: 1280, height: 860 }, url = base) {
  // bypassCSP só para injetar o axe; o site em si continua com a política normal no ar.
  const ctx = await navegador.newContext({ viewport: tamanho, serviceWorkers: 'block', bypassCSP: true, locale: 'pt-BR', timezoneId: 'America/Fortaleza' });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ contentType: 'text/javascript', body: supabaseFalso }));
  await ctx.route(/supabase\.co/, r => r.abort()); // nenhum pedido ao Supabase real
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await page.addInitScript(([c, v]) => { window.__cenario = c; window.__termoVersao = v; }, [cenario, termoVersao]);
  await page.goto(url);
  return { ctx, page, erros };
}

async function acessibilidade(page, onde) {
  await page.addScriptTag({ content: axeFonte });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], resultTypes: ['violations'] });
    return res.violations.map(v => ({ id: v.id, impacto: v.impact, ajuda: v.help, alvos: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }));
  });
  for (const v of r) if (['serious', 'critical'].includes(v.impacto)) problemasA11y.push({ onde, ...v });
  const leves = r.filter(v => !['serious', 'critical'].includes(v.impacto));
  if (leves.length) console.log(`    (aviso, ${onde}) ` + leves.map(v => `${v.id}: ${v.ajuda}`).join(' | '));
}

async function foto(page, nome) { await page.screenshot({ path: path.join(prints, nome + '.png'), fullPage: true }); }

const A1 = '10000000-0000-4000-8000-000000000001', AV1 = '30000000-0000-4000-8000-000000000001', F1 = '20000000-0000-4000-8000-000000000001';
async function telas(page, lista, prefixo) {
  for (const [hash, alvo, texto] of lista) {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.locator(alvo, { hasText: texto }).first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(250);
    ok(`${prefixo} ${hash || '#inicio'}: mostra "${texto}"`);
    await acessibilidade(page, `${prefixo} ${hash || '#inicio'}`); await foto(page, `${prefixo}-${(hash || 'inicio').replace('#', '').replace(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/g, 'id')}`);
  }
}

try {
  // 1. Entrada
  console.log('Entrada');
  let { ctx, page, erros } = await abrir({ logado: false });
  await page.locator('#loginView').waitFor({ state: 'visible' });
  ok('tela de entrada');
  await acessibilidade(page, 'entrada'); await foto(page, 'entrada');
  await page.fill('#email', 'personal@exemplo.invalid'); await page.fill('#senha', 'errada');
  await page.click('#loginForm button[type=submit]');
  await page.locator('#loginMsg', { hasText: 'E-mail ou senha incorretos' }).waitFor();
  ok('senha errada mostra a mensagem certa');
  await page.fill('#senha', 'senha-correta-123'); await page.click('#loginForm button[type=submit]');
  await page.locator('#appView').waitFor({ state: 'visible' });
  ok('senha certa entra no sistema');
  assert.deepEqual(erros, [], 'erros de JavaScript: ' + erros.join(' | '));
  await ctx.close();

  // 2. Convite do aluno: termo de uso dos dados de saúde (LGPD)
  console.log('Convite do aluno');
  ({ ctx, page, erros } = await abrir({ logado: false }, undefined, base + '?convite=' + 'A'.repeat(43)));
  await page.locator('#conviteView').waitFor({ state: 'visible' });
  await page.locator('#convCampos').waitFor({ state: 'visible' });
  assert.match(await page.locator('#termoAluno').innerText(), /dados de saúde/);
  assert.equal(await page.locator('#termoVersao').innerText(), termoVersao);
  ok('convite mostra o termo de uso dos dados de saúde, na versão atual');
  await acessibilidade(page, 'convite'); await foto(page, 'convite');
  await page.fill('#convEmail', 'aluna@exemplo.invalid'); await page.fill('#convSenha', 'senha-correta-123'); await page.fill('#convSenha2', 'senha-correta-123');
  await page.click('#conviteForm button[type=submit]');
  await page.locator('#convMsg', { hasText: 'aceite o termo' }).waitFor();
  assert.equal((await page.evaluate(() => window.__chamadas)).filter(c => c.acao === 'cadastrar').length, 0);
  ok('sem aceitar o termo, o cadastro não é enviado');
  await ctx.close();

  // 3. Personal: cada tela (computador)
  console.log('Personal');
  ({ ctx, page, erros } = await abrir({ logado: true, papel: 'personal' }));
  await page.locator('#appView').waitFor({ state: 'visible' });
  await telas(page, [
    ['#inicio', '#appView', 'Aluna Exemplo Teste'],
    [`#aluno-${A1}`, '#principal', 'Aluna Exemplo Teste'],
    [`#aluno-${A1}-evolucao`, '#principal', 'Evolução'],
    [`#aluno-${A1}-comparar`, '#principal', 'Compar'],
    [`#aluno-${A1}-treino`, '#principal', 'Supino reto'],
    [`#av-${AV1}`, '#principal', 'Aluna Exemplo Teste'],
    [`#nova-${A1}`, '#principal', 'Nova avaliação'],
    [`#ficha-${F1}`, '#principal', 'Supino reto'],
    [`#ciclo-nova-${A1}`, '#principal', 'Aluna Exemplo Teste'],
    ['#mensagens', '#principal', 'Aluna Exemplo Teste'],
    [`#conversa-${A1}`, '#principal', 'Sua avaliação está pronta']
  ], 'personal');
  await page.evaluate(() => { location.hash = '#inicio'; });
  await page.click('#contaBtn'); await page.click('#sobreBtn');
  await page.locator('#sobreDialog[open]').waitFor();
  ok('Sobre o app abre pelo menu da conta');
  await acessibilidade(page, 'sobre o app'); await page.keyboard.press('Escape');
  assert.deepEqual(erros, [], 'erros de JavaScript (personal): ' + erros.join(' | '));
  ok('nenhum erro de JavaScript (personal)');
  await ctx.close();

  // 4. Aluno: cada aba (celular, que é como o aluno usa)
  console.log('Aluno (celular)');
  ({ ctx, page, erros } = await abrir({ logado: true, papel: 'aluno' }, { width: 390, height: 844 }));
  await page.locator('#areaAluno').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#personaisBtn').isVisible(), false);
  assert.equal(await page.locator('#principal').isVisible(), false);
  ok('aluno não vê a área do personal');
  await telas(page, [
    ['#inicio', '#areaAluno', 'Aluna'],
    ['#avaliacoes', '#areaAluno', 'avalia'],
    ['#evolucao', '#areaAluno', 'Evolução'],
    ['#treino', '#areaAluno', 'Supino reto'],
    ['#mensagens', '#areaAluno', 'Sua avaliação está pronta'],
    ['#perfil', '#areaAluno', 'Aluna Exemplo Teste'],
    [`#av-${AV1}`, '#areaAluno', 'avalia']
  ], 'aluno');
  for (const hash of ['#inicio', '#treino', `#av-${AV1}`]) {
    await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(300);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largura <= 392, `${hash} no celular não pode ter rolagem para o lado (largura ${largura})`);
  }
  ok('celular: telas do aluno sem rolagem lateral');
  assert.deepEqual(erros, [], 'erros de JavaScript (aluno): ' + erros.join(' | '));
  await ctx.close();

  // 5. Personal no celular
  console.log('Personal (celular)');
  ({ ctx, page, erros } = await abrir({ logado: true, papel: 'personal' }, { width: 390, height: 844 }));
  await page.locator('#appView').waitFor({ state: 'visible' });
  for (const hash of ['#inicio', `#aluno-${A1}`, `#av-${AV1}`, `#nova-${A1}`]) {
    await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(400);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largura <= 392, `${hash} no celular não pode ter rolagem para o lado (largura ${largura})`);
    await acessibilidade(page, `personal celular ${hash}`); await foto(page, `personal-celular-${hash.replace('#', '').replace(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/g, 'id')}`);
  }
  ok('celular: telas do personal sem rolagem lateral');
  assert.deepEqual(erros, [], 'erros de JavaScript (personal celular): ' + erros.join(' | '));
  await ctx.close();

  if (problemasA11y.length) {
    console.error('\nProblemas de acessibilidade (sérios ou críticos):');
    for (const p of problemasA11y) console.error(`  - [${p.onde}] ${p.id} (${p.impacto}): ${p.ajuda} → ${p.alvos.join(' ; ')}`);
    throw new Error(`${problemasA11y.length} problema(s) de acessibilidade`);
  }
  console.log(`\nNavegador aprovado: ${passos} verificações, acessibilidade sem problemas sérios. Prints em test-results/navegador/.`);
} finally {
  await navegador.close();
  servidor.close();
}
