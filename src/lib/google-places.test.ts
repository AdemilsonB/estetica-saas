import { describe, it, expect, vi, afterEach } from 'vitest'

const ORIGINAL = process.env.GOOGLE_PLACES_API_KEY

afterEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = ORIGINAL
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('google-places', () => {
  it('isGooglePlacesEnabled reflete a presença da chave', async () => {
    process.env.GOOGLE_PLACES_API_KEY = ''
    let mod = await import('./google-places')
    expect(mod.isGooglePlacesEnabled()).toBe(false)
    vi.resetModules()
    process.env.GOOGLE_PLACES_API_KEY = 'chave-x'
    mod = await import('./google-places')
    expect(mod.isGooglePlacesEnabled()).toBe(true)
  })

  it('fetchGoogleRating retorna null sem chave e não chama a rede', async () => {
    process.env.GOOGLE_PLACES_API_KEY = ''
    const fetchSpy = vi.spyOn(global, 'fetch')
    const { fetchGoogleRating } = await import('./google-places')
    expect(await fetchGoogleRating('place-1')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetchGoogleRating mapeia rating e contagem com chave', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'chave-x'
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ rating: 4.8, userRatingCount: 214 }), { status: 200 }),
    )
    const { fetchGoogleRating } = await import('./google-places')
    expect(await fetchGoogleRating('place-1')).toEqual({ rating: 4.8, userRatingCount: 214 })
  })

  it('resolveGooglePlaceId extrai o nome da URL e usa Text Search', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'chave-x'
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ places: [{ id: 'ChIJabc' }] }), { status: 200 }),
    )
    const { resolveGooglePlaceId } = await import('./google-places')
    expect(await resolveGooglePlaceId('https://www.google.com/maps/place/Beleza+Atual/@-25,-49,17z')).toBe('ChIJabc')
  })
})
