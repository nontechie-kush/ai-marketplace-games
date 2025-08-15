// app/play/[gameId]/route.js
export const runtime = 'edge' // fast

export async function GET(_req, { params }) {
  const { gameId } = params
  if (!gameId) return new Response('Missing gameId', { status: 400 })

  const publicBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const url = `${publicBase}/storage/v1/object/public/games/${gameId}/index.html`

  // no-store to avoid stale CDN variants while we iterate
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const msg = await res.text()
    return new Response(`Failed to fetch game: ${msg}`, { status: res.status })
  }

  const html = await res.text()
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, stale-while-revalidate=300'
    }
  })
}
