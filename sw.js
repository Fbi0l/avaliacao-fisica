/* Service worker do app instalável.
   - Guarda SÓ os arquivos do próprio site (telas, estilos, ícones e a biblioteca do Supabase).
   - NUNCA guarda nada do banco (login, alunos, avaliações): esses pedidos passam direto.
   - Rede primeiro: com internet, usa sempre a versão mais nova publicada. */
'use strict';
const VERSAO = 'avaliacao-v0.7.1';
const ARQUIVOS = [
  './', './index.html', './app.js?v=0.7.1', './calculos.js?v=0.7.1', './styles.css?v=0.7.1',
  './manifest.webmanifest', './assets/icone.svg', './assets/icone-192.png', './assets/icone-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'
];
const PERMITIDOS = [self.location.origin, 'https://cdn.jsdelivr.net'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { mode: u.startsWith('http') ? 'cors' : 'same-origin' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', ev => {
  const req = ev.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !PERMITIDOS.includes(url.origin)) return;
  if (url.origin === self.location.origin && !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  ev.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    try {
      const resp = await fetch(req);
      if (resp.ok && (resp.type === 'basic' || resp.type === 'cors')) cache.put(req, resp.clone());
      return resp;
    } catch (_) {
      const salvo = await cache.match(req) || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      return salvo || new Response('Sem conexão.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
