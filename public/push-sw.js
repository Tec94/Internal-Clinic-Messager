self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(
    payload.title || 'YKSG Messenger',
    {
      body: payload.body || 'You have a new operational update.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: safePath(payload.url) },
      tag: payload.tag || 'yksg-update',
    },
  ))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = safePath(event.notification.data?.url)
  event.waitUntil(self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  }).then((clients) => {
    const existing = clients.find((client) => (
      new URL(client.url).origin === self.location.origin
    ))
    if (existing) {
      existing.navigate(target)
      return existing.focus()
    }
    return self.clients.openWindow(target)
  }))
})

function safePath(value) {
  return typeof value === 'string' && value.startsWith('/')
    && !value.startsWith('//')
    ? value
    : '/inbox'
}
