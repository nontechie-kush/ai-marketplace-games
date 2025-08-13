'use client'

import { useState, useEffect } from 'react'
import { Play, Star, Users, TrendingUp, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const [games, setGames] = useState([
    // Sample games for demo
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
              <Link href="/games" className="hover:text-purple-400 transition-colors">
                Browse Games
              </Link>
              <Link href="/create" className="hover:text-purple-400 transition-colors">
                Create Game
              </Link>
              <Link href="/auth" className="btn-primary">
                Sign In
              </Link>
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
              <Link href="/create" className="btn-primary text-lg px-8 py-4 inline-flex items-center">
                Create Your First Game
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link href="/games" className="btn-secondary text-lg px-8 py-4 inline-flex items-center">
                Play Games
                <Play className="ml-2 h-5 w-5" />
              </Link>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredGames.map((game) => (
              <GameCard key={game.id} game={game} featured />
            ))}
          </div>
        </div>
      </section>

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
          <Link href="/create" className="bg-white text-purple-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 transform hover:scale-105 inline-block">
