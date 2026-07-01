const DETAILS_URL = 'https://places.googleapis.com/v1/places'
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

// Timeout curto para não acoplar o TTFB do SSR (vitrine/portal) à latência do Google.
// Em timeout, o AbortError cai no catch → retorna null (fail-closed).
const FETCH_TIMEOUT_MS = 2500

/** Retorna true se a chave de API do Google Places estiver configurada. */
export function isGooglePlacesEnabled(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY)
}

/** Extrai o nome do estabelecimento de uma URL de perfil do Google Maps. */
function extractPlaceName(url: string): string | null {
  const match = url.match(/\/maps\/place\/([^/@]+)/)
  if (!match) return null
  return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim() || null
}

/** Resolve o Place ID a partir do link colado. Retorna null se não for possível. */
export async function resolveGooglePlaceId(url: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null
  const name = extractPlaceName(url)
  if (!name) return null
  try {
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id',
      },
      body: JSON.stringify({ textQuery: name }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { places?: { id: string }[] }
    return data.places?.[0]?.id ?? null
  } catch {
    return null
  }
}

/** Busca nota + contagem de avaliações (cacheado 5min). Null sem chave ou em erro. */
export async function fetchGoogleRating(
  placeId: string,
): Promise<{ rating: number; userRatingCount: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'rating,userRatingCount',
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { rating?: number; userRatingCount?: number }
    if (typeof data.rating !== 'number' || typeof data.userRatingCount !== 'number') return null
    return { rating: data.rating, userRatingCount: data.userRatingCount }
  } catch {
    return null
  }
}
