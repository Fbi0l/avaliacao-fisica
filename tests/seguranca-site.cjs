// Segurança do site, sem rede: CSP restrita, scripts externos com integridade (SRI), nada inline,
// nenhum HTML montado a partir de dados, só chave publicável, app instalável seguro e versão consistente.
const fs = require('fs'), assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const externos = [...html.matchAll(/<script\s[^>]*src="(https?:[^"]+)"[^>]*>/g)];
assert.ok(externos.length >= 1, 'scripts externos encontrados');
for (const [tag, src] of externos) {
  assert.match(tag, /integrity="sha384-[A-Za-z0-9+/=]{64}"/, `sem integridade em ${src}`);
  assert.match(tag, /crossorigin="anonymous"/, `sem crossorigin em ${src}`);
  assert.match(src, /@\d+\.\d+\.\d+\//, `versão exata em ${src}`);
}
assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(html), 'script inline');
assert.ok(!/\son[a-z]+=/i.test(html), 'atributo on* inline');
assert.ok(!/\sstyle=/i.test(html), 'atributo style inline');
assert.ok(!/<style/i.test(html), 'bloco <style> inline');
for (const arquivo of ['app.js', 'calculos.js', 'tema.js'])
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|setAttribute\(\s*['"]style/.test(fs.readFileSync(arquivo, 'utf8')), `${arquivo} monta HTML ou código a partir de texto`);
const locais = [...html.matchAll(/<script\s[^>]*src="([^":]+?)(\?[^"]*)?"/g)].map(m => m[1]);
assert.deepEqual(locais.sort(), ['app.js', 'calculos.js', 'tema.js']);

const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
assert.ok(csp, 'política CSP ausente');
const diretiva = nome => ((csp.match(new RegExp(`(?:^|;\\s*)${nome} ([^;]+)`)) || [])[1] || '').trim().split(/\s+/).sort();
assert.deepEqual(diretiva('script-src'), ["'self'", 'https://cdn.jsdelivr.net'].sort());
assert.deepEqual(diretiva('style-src'), ["'self'"]);
assert.deepEqual(diretiva('object-src'), ["'none'"]);
assert.deepEqual(diretiva('frame-src'), ["'none'"]);

// O site só conversa com o Supabase do próprio projeto (enquanto não configurado, com nada além dele mesmo).
const url = (app.match(/const SUPABASE_URL = '([^']*)'/) || [])[1];
const chave = (app.match(/const SUPABASE_KEY = '([^']*)'/) || [])[1];
assert.ok(url !== undefined && chave !== undefined, 'constantes de configuração');
if (url) {
  assert.match(url, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  const host = url.replace('https://', '');
  assert.deepEqual(diretiva('connect-src'), ["'self'", `https://${host}`, `wss://${host}`].sort());
  assert.match(chave, /^sb_publishable_[A-Za-z0-9_-]+$/, 'só a chave publicável');
} else {
  assert.equal(chave, '', 'sem endereço, sem chave');
  assert.deepEqual(diretiva('connect-src'), ["'self'"]);
}
const todos = ['index.html', 'app.js', 'calculos.js', 'styles.css', 'sw.js', ...fs.readdirSync('supabase/functions/registrar-aluno').map(f => 'supabase/functions/registrar-aluno/' + f)];
for (const arquivo of todos) assert.ok(!/sb_secret_[A-Za-z0-9]|eyJhbGciOi/.test(fs.readFileSync(arquivo, 'utf8')), `${arquivo}: possível chave secreta`);

// App instalável
const manifesto = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifesto.display, 'standalone'); assert.equal(manifesto.scope, '/avaliacao-fisica/');
for (const i of manifesto.icons) assert.ok(fs.existsSync(i.src), `ícone ${i.src}`);
const sw = fs.readFileSync('sw.js', 'utf8');
assert.ok(!/supabase\.co/.test(sw), 'service worker não menciona o banco');
assert.match(sw, /req\.method !== 'GET' \|\| !PERMITIDOS\.includes\(url\.origin\)\) return;/, 'só GET do próprio site e do CDN');

// Versão igual em todos os lugares
const versoes = [...new Set([...html.matchAll(/\?v=(\d+\.\d+\.\d+)/g)].map(m => m[1]))];
assert.equal(versoes.length, 1, 'uma só versão nos arquivos da página');
const v = versoes[0];
assert.deepEqual([...new Set([...html.matchAll(/Versão (\d+\.\d+\.\d+)/g)].map(m => m[1]))], [v], 'versão mostrada igual à dos arquivos');
assert.equal(pkg.version, v, 'package.json');
assert.ok(sw.includes(`'avaliacao-v${v}'`), 'nome do cache');
for (const arq of ['app.js', 'calculos.js', 'styles.css']) assert.ok(sw.includes(`./${arq}?v=${v}`), `sw.js guarda ${arq} na versão da página`);
console.log('Site aprovado: CSP restrita, integridade, nada inline, só chave publicável, app instalável e versão consistente.');
