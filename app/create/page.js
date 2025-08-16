'use client'

import { supabase } from '../../lib/supabase'
import { useState, useRef, useEffect } from 'react'
import { Send, Loader, Play, Save, ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'

// Returns a fresh access token. Refreshes if the current token is near expiry.
async function getFreshToken() {
  const { data: { session } } = await supabase.auth.getSession()
  let token = session?.access_token
  const expMs = session?.expires_at ? session.expires_at * 1000 : 0

  // If token missing or expiring within 60 seconds, refresh it
  if (!token || (expMs && expMs < Date.now() + 60_000)) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    token = refreshed?.session?.access_token || token
  }
  return token
}

export default function CreateGamePage() {
  const [gameId, setGameId] = useState(null)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI game developer. Describe any game you'd like me to create - from simple puzzles to action games. I'll build it for you in minutes! What kind of game are you thinking about?"
    }
  ])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentGame, setCurrentGame] = useState(null)
  const [gameTitle, setGameTitle] = useState('')
  const [gameDescription, setGameDescription] = useState('')
  const [showPublishForm, setShowPublishForm] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/create` }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setAuthChecked(true)
  }
  
  const messagesEndRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    async function run() {
      // 1) Check current user via Supabase
      const { data } = await supabase.auth.getUser()
      if (!isMounted) return

      const u = data?.user ?? null
      setUser(u)
      setAuthChecked(true)

      // 2) Only initialize a game session if the user is signed in
      if (u) {
        await initializeGameSession()
      } else {
        // Ensure we exit the loading state if not signed in
        setIsInitializing(false)
      }

      // 3) Keep the existing behavior of scrolling after mount
      scrollToBottom()
    }

    run()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize new game session
  async function initializeGameSession() {
    try {
      const token = await getFreshToken()
      const response = await fetch('/api/games/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })

      const data = await response.json()

      if (data.success) {
        setGameId(data.gameId)
        console.log('Game session created:', data.gameId)
      } else {
        throw new Error(data.error || 'Failed to create game session')
      }
    } catch (error) {
      console.error('Error initializing game session:', error)
      alert('Failed to initialize game session. Please refresh the page.')
    } finally {
      setIsInitializing(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  async function handleSendMessage() {
    if (!input.trim() || isGenerating || !gameId) return

    const userMessage = input.trim()
    setInput('')
    
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setIsGenerating(true)

    try {
      const token = await getFreshToken()
      const response = await fetch(`/api/games/generate/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prompt: userMessage,
          conversationHistory: newMessages
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setCurrentGame(data.gameCode)
        setMessages(data.conversation)
        
        // Auto-suggest title and description
        const titleSuggestion = userMessage.length > 50 
          ? userMessage.substring(0, 50) + "..." 
          : userMessage
        setGameTitle(titleSuggestion)
        setGameDescription(`A fun game created with AI: ${userMessage}`)
      } else {
        throw new Error(data.error || 'Failed to generate game')
      }
      
    } catch (error) {
      console.error('Error generating game:', error)
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: "Sorry, I had trouble creating your game. Please try describing it differently!"
        }
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  async function handlePublishGame() {
    if (!currentGame || !gameId) return

    try {
      const token = await getFreshToken()
      const response = await fetch(`/api/games/publish/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: gameTitle,
          description: gameDescription
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('Game published successfully! 🎉')
        setShowPublishForm(false)
        
        // Redirect to homepage to see the published game
        window.location.href = '/'
      } else {
        throw new Error(data.error || 'Failed to publish game')
      }
      
    } catch (error) {
      console.error('Error publishing game:', error)
      alert('Error publishing game. Please try again.')
    }
  }

  // Show a quick loading UI while we check auth status
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin mx-auto mb-4 rounded-full border-2 border-purple-400 border-t-transparent" />
          <p className="text-gray-400">Checking your sign‑in…</p>
        </div>
      </div>
    )
  }

  // If not signed in, gate the Create flow behind Google sign-in (Play stays public elsewhere)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-white">Create a game</h1>
          <p className="mt-3 text-gray-400">
            You need to sign in with Google to create and publish games.
            Playing games is open to everyone.
          </p>
          <button
            onClick={signIn}
            className="mt-6 rounded-lg bg-white px-4 py-2 text-black hover:bg-zinc-100"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-400" />
          <p className="text-gray-400">Initializing game session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <Sparkles className="h-6 w-6 text-purple-400" />
              <h1 className="text-xl font-bold">AI Game Creator</h1>
              {gameId && (
                <span className="text-xs text-gray-400 font-mono">
                  ID: {gameId.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>
          
          {currentGame && (
            <button
              onClick={() => setShowPublishForm(true)}
              className="btn-primary"
            >
              <Save className="h-4 w-4 mr-2" />
              Publish Game
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className="w-1/2 flex flex-col border-r border-gray-700">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-100 px-4 py-2 rounded-lg flex items-center">
                  <Loader className="h-4 w-4 animate-spin mr-2" />
                  Creating your game...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Describe your game idea..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                disabled={isGenerating}
              />
              <button
                onClick={handleSendMessage}
                disabled={isGenerating || !input.trim()}
                className="btn-primary"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Game Preview */}
        <div className="w-1/2 bg-gray-800 flex flex-col">
          <div className="border-b border-gray-700 p-4">
            <h2 className="text-lg font-bold flex items-center">
              <Play className="h-5 w-5 mr-2 text-green-400" />
              Game Preview
            </h2>
          </div>
          
          <div className="flex-1 p-4">
            {currentGame ? (
              <iframe
                srcDoc={currentGame}
                className="w-full h-full border border-gray-600 rounded-lg"
                title="Game Preview"
              />
            ) : (
              <div className="w-full h-full border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Your game will appear here once generated</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Publish Form Modal */}
      {showPublishForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Publish Your Game</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Game Title</label>
                <input
                  type="text"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                  placeholder="Enter game title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={gameDescription}
                  onChange={(e) => setGameDescription(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                  rows="3"
                  placeholder="Describe your game"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowPublishForm(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishGame}
                className="flex-1 btn-primary"
                disabled={!gameTitle.trim()}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
