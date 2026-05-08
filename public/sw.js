const CACHE_NAME = 'dsc-cache-v4';

self.addEventListener('install', (event) => {
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

  // Ignora tudo que não seja GET
  if (event.request.method !== 'GET') return;

  // Ignora URLs não http/https
  if (!url.startsWith('http')) return;

  // Ignora Supabase
  if (url.includes('supabase.co')) return;

  // Ignora API Anthropic
  if (url.includes('anthropic.com')) return;

  // Ignora navegação entre rotas do app (deixa o React Router cuidar)
  if (event.request.mode === 'navigate') return;

  // Cache apenas assets estáticos
  if (url.includes('/assets/') || url.includes('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
