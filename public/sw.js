const CACHE_NAME = 'dsc-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Ignora tudo que não seja http/https
  if (!url.startsWith('http')) return;

  // Nunca cacheia supabase (auth, banco de dados)
  if (url.includes('supabase.co')) return;

  // Nunca cacheia requisições de autenticação
  if (url.includes('/auth/') || url.includes('token')) return;

  // Nunca cacheia APIs externas
  if (url.includes('googletagmanager') || url.includes('analytics')) return;

  // Estratégia network-first: tenta rede, cai no cache se offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Só cacheia respostas válidas de GET
        if (
          event.request.method === 'GET' &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
