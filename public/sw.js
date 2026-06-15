const CACHE = 'agende-static-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  // Apenas assets estáticos do Next.js — nunca intercepta rotas, RSC ou navegações
  if (!e.request.url.includes('/_next/static/')) return

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request)
      if (cached) return cached
      const response = await fetch(e.request)
      if (response.ok) cache.put(e.request, response.clone())
      return response
    })
  )
})
