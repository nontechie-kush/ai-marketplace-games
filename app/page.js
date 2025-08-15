// app/page.js
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default async function Home() {
  // Fetch only published games, newest first
  const { data: games, error } = await supabase
    .from('games')
    .select('id, title, description, creator_name, plays, rating, updated_at')
    .eq('game_status', 'published')
    .order('updated_at', { ascending: false })
    .limit(24)

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">AI Game Marketplace</h1>
        <p className="text-red-500">Failed to load games: {error.message}</p>
        <Link href="/create" className="inline-block mt-6 underline">Create your first game →</Link>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">AI Game Marketplace</h1>
        <Link href="/create" className="px-3 py-2 rounded-md bg-black text-white">Create a game</Link>
      </header>

      {(!games || games.length === 0) ? (
        <section className="text-center py-16 border rounded-lg">
          <h2 className="text-xl font-medium mb-2">No published games yet</h2>
          <p className="text-gray-600">Create one now and publish it to see it here.</p>
          <div className="mt-6">
            <Link href="/create" className="px-4 py-2 rounded bg-black text-white">Start creating</Link>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map(g => (
            <article key={g.id} className="border rounded-lg p-4">
              <h3 className="font-semibold">{g.title}</h3>
              <p className="text-sm text-gray-700 line-clamp-3 mt-1">{g.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-600 mt-3">
                <span>Plays: {g.plays ?? 0}</span>
                <span>Rating: {g.rating ?? 0}</span>
              </div>
              <div className="mt-4">
                {/* Optional: Link to a dedicated game page if you add one later */}
                <Link href={`/create?gameId=${g.id}`} className="underline text-sm">Open</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
