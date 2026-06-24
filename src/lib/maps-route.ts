export function isIOS(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function openRoute(address: string): void {
  const query = encodeURIComponent(address)
  const url = isIOS()
    ? `https://maps.apple.com/?address=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
