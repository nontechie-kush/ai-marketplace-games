'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Play, Star, Sparkles, ArrowRight } from 'lucide-react'

export default function HomePage() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGames()
  }, [])

  async function fetchGames() {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(12)
      
      if (error) throw error
      setGames(data || [])
    } catch (error) {
      console.error('Error fetching games:', error)
      // Fallback to mock games if database fails
      setGames([
        {
          id: 1,
          title: "Dodge the Angry Mom's Chappals",
          description: "A hilarious game where you dodge flying slippers from your angry mother using arrow keys!",
          creator_name: "GameMaster",
          plays: 1250,
          rating: 4.8
        },
        {
          id: 2,
          title: "Cat vs Mouse Chase",
          description: "Control a cat to catch mice while keeping your finger pressed on the mouse. Unique gameplay!",
          creator_name: "CatLover",
          plays: 890,
          rating: 4.6
        },
        {
          id: 3,
          title: "Space Shooter Mania",
          description: "Classic space shooter with modern twist. Defend Earth from alien invasion!",
          creator_name: "SpaceExplorer",
          plays: 2100,
          rating: 4.9
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const featuredGames = games.slice(0, 3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-8 w-8 text-purple-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                GameGenius AI
              </h1>
            </div>
            
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/games" className="hover:text-purple-400 transition-colors">
                Browse Games
              </a>
              <a href="/create" className="hover:text-purple-400 transition-colors">
                Create Game
              </a>
              <a href="/auth" className="btn-primary">
                Sign In
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-5xl md:text-7xl font-bold mb-6">
              Create Games with 
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                {' '}AI Magic
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Describe your game idea in plain English. Our AI builds it in minutes. 
              No coding required. No limits to creativity.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a href="/create" className="btn-primary text-lg px-8 py-4 inline-flex items-center justify-center">
                Create Your First Game
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a href="/games" className="btn-secondary text-lg px-8 py-4 inline-flex items-center justify-center">
                Play Games
                <Play className="ml-2 h-5 w-5" />
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">{games.length}+</div>
                <div className="text-gray-400">Games Created</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">4.2K+</div>
                <div className="text-gray-400">Games Played</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">150+</div>
                <div className="text-gray-400">Active Creators</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold mb-8 text-center">
            🔥 Featured Games
          </h3>
          
          {loading ? (
            <div className="text-center text-gray-400">
              <div className="text-lg">Loading games...</div>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center text-gray-400">
              <div className="text-lg mb-4">No games yet! Be the first to create one.</div>
              <a href="/create" className="btn-primary">
                Create First Game
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* All Games Section */}
      {games.length > 3 && (
        <section className="py-16 bg-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-3xl font-bold mb-8 text-center">
              🌟 All Games
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.slice(3).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Create Game CTA */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-4xl font-bold mb-6">
            🎮 Create a Game in 1 Minute
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Just describe your idea: "Make a game where a ninja fights robots" 
            and watch AI create it instantly!
          </p>
          <a href="/create" className="bg-white text-purple-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 transform hover:scale-105 inline-block">
            Start Creating Now →
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-4xl font-bold mb-12 text-center">
            How It Works
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h4 className="text-xl font-bold mb-2">Describe Your Game</h4>
              <p className="text-gray-400">
                Tell our AI what kind of game you want. Be as creative as you like!
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h4 className="text-xl font-bold mb-2">AI Creates Your Game</h4>
              <p className="text-gray-400">
                Watch as AI generates your complete, playable game in minutes.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h4 className="text-xl font-bold mb-2">Play & Share</h4>
              <p className="text-gray-400">
                Play your game instantly and share it with the world!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>&copy; 2024 GameGenius AI. Making game creation accessible to everyone.</p>
        </div>
      </footer>
    </div>
  )
}

// Game Card Component
function GameCard({ game }) {
  return (
    <div className="game-card">
      <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg mb-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="h-12 w-12 text-white opacity-80" />
        </div>
      </div>
      
      <h4 className="font-bold text-lg mb-2">{game.title}</h4>
      <p className="text-gray-400 text-sm mb-3">{game.description}</p>
      
      <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <Play className="h-4 w-4 mr-1" />
            {game.plays || 0}
          </span>
          <span className="flex items-center">
            <Star className="h-4 w-4 mr-1" />
            {game.rating || 0}
          </span>
        </div>
        <span>by {game.creator_name || 'Anonymous'}</span>
      </div>
      
      <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300">
        Play Game
      </button>
    </div>
  )
}
