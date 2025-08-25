// app/page.js
export const dynamic = 'force-dynamic';

import Link from 'next/link'
import { supabase } from '../lib/supabase'

// utils
function fmt(n) {
  try { return new Intl.NumberFormat().format(n ?? 0) } catch { return n ?? 0 }
}
function dateLabel(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch { return '—' }
}

export default async function Home() {
  // Fetch only published games, newest first
  const { data: games, error } = await supabase
    .from('games')
    .select('id, title, description, creator_name, plays, rating, updated_at, storage_path')
    .eq('game_status', 'published')
    .order('updated_at', { ascending: false })
    .limit(60)

  if (error) {
    return (
      <main className="min-h-screen bg-[#0b0f14] text-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="text-3xl font-semibold">AI Game Marketplace</h1>
          <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Failed to load games: {error.message}
          </p>
          <Link href="/create" className="mt-8 inline-block rounded-xl bg-white px-4 py-2 text-black hover:bg-zinc-100">
            Create your first game →
          </Link>
        </div>
      </main>
    )
  }

  const totalGames = games?.length ?? 0
  const totalPlays = (games ?? []).reduce((acc, g) => acc + (g.plays ?? 0), 0)
  const avgRating = (() => {
    const rated = (games ?? []).filter(g => (g.rating ?? 0) > 0)
    const sum = rated.reduce((a, g) => a + Number(g.rating || 0), 0)
    return rated.length ? (sum / rated.length).toFixed(2) : '0.00'
  })()

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      {/* NAV */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0f14]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-bold">AI</span>
            <span className="text-lg font-semibold">Game Marketplace</span>
          </div>
          <Link
            href="/create"
            className="rounded-xl bg-white px-4 py-2 text-black transition hover:bg-zinc-100"
          >
            Create a game
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pt-10">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f1420] to-[#0b0f14] p-6 md:p-8">
          <div className="grid gap-8 md:grid-cols-5">
            <div className="md:col-span-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Build games by talking.
              </h1>
              <p className="mt-3 max-w-xl text-zinc-300">
                Describe your idea, preview instantly, and publish to the marketplace. No engine, no setup — just chat.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/create"
                  className="rounded-xl bg-white px-4 py-2 text-black transition hover:bg-zinc-100"
                >
                  Start creating →
                </Link>
                <a
                  href="#discover"
                  className="rounded-xl border border-white/20 px-4 py-2 text-white hover:bg-white/5"
                >
                  Discover games
                </a>
              </div>
            </div>
            {/* Stats */}
            <div className="md:col-span-2 grid grid-cols-3 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-zinc-400">Published</div>
                <div className="mt-1 text-2xl font-semibold">{fmt(totalGames)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-zinc-400">Total plays</div>
                <div className="mt-1 text-2xl font-semibold">{fmt(totalPlays)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                <div className="text-sm text-zinc-400">Avg rating</div>
                <div className="mt-1 text-2xl font-semibold">{avgRating}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section id="discover" className="mx-auto max-w-6xl px-4 py-10">
        {(!games || games.length === 0) ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <h2 className="text-xl font-medium">No published games yet</h2>
            <p className="mt-2 text-zinc-300">Create one now and publish it to see it here.</p>
            <Link
              href="/create"
              className="mt-6 inline-block rounded-xl bg-white px-4 py-2 text-black hover:bg-zinc-100"
            >
              Start creating
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => {
              const href = g.storage_path ? `/play/${g.id}` : `/create?gameId=${g.id}`
              const updatedLabel = dateLabel(g.updated_at)
              // subtle card art (dynamic gradient from id)
              const hash = [...g.id].reduce((a, c) => a + c.charCodeAt(0), 0)
              const hue = hash % 360
              const gradient = `linear-gradient(135deg, hsl(${hue} 70% 22%), hsl(${(hue+40)%360} 70% 14%))`

              return (
                <Link
                  key={g.id}
                  href={href}
                  target={g.storage_path ? '_blank' : undefined}
                  aria-label={`Open ${g.title}`}
                  className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#0f1420] transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {/* thumbnail / header */}
                  <div
                    className="h-36 w-full"
                    style={{ backgroundImage: gradient }}
                  />
                  {/* body */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-1 text-lg font-semibold">{g.title}</h3>
                      <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
                        {updatedLabel}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-300">
                      {g.description || 'A fun game created with AI.'}
                    </p>

                    <div className="mt-4 flex items-center gap-3 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                        Published
                      </span>
                      <span>•</span>
                      <span>Plays {fmt(g.plays ?? 0)}</span>
                      <span>•</span>
                      <span>Rating {g.rating ?? 0}</span>
                    </div>

                    <div className="mt-5 inline-flex items-center gap-2 text-sm text-white/80">
                      <span className="transition group-hover:translate-x-0.5">Open</span>
                      <svg className="h-4 w-4 opacity-80 transition group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none">
                        <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-zinc-400">
          <span>© {new Date().getFullYear()} AI Game Marketplace</span>
          <Link href="/create" className="underline hover:text-white">Create a game</Link>
        </div>
      </footer>
    </main>
  )
}
