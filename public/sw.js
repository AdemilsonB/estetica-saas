const CACHE = 'agende-shell-v2'
const SHELL = ['/']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        SHELL.map((url) =>
          fetch(url).then((res) => {
            if (!res.ok) return
            return c.put(url, res)
          })
        )
      )
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return
  if (e.request.url.includes('/api/')) return

  // Navegações HTML vão direto para a rede — SSR com auth não deve ser interceptado pelo SW
  if (e.request.mode === 'navigate') return

  // Assets estáticos: network-first com fallback de cache
  e.respondWith(
    fetch(e.request).catch(async () => {
      const cached = await caches.match(e.request)
      return cached ?? Response.error()
    })
  )
})
