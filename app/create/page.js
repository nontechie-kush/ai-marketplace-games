'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Send, Loader, Play, Save, ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function CreateGamePage() {
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
  
  const messagesEndRef = useRef(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Mock AI game generation for now (we'll add real AI later)
  async function generateGame(prompt) {
    // This is a mock game - replace with real AI later
    const mockGame = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${prompt}</title>
    <style>
        body { margin: 0; padding: 20px; background: #222; color: white; font-family: Arial; text-align: center; }
        #game { width: 400px; height: 300px; border: 2px solid #fff; margin: 20px auto; position: relative; background: #000; }
        .player { width: 20px; height: 20px; background: #00ff00; position: absolute; top: 140px; left: 190px; }
        .instructions { margin: 20px; }
    </style>
</head>
<body>
    <h1>🎮 ${prompt}</h1>
    <div id="game">
        <div class="player" id="player"></div>
    </div>
    <div class="instructions">
        <p>Use WASD keys to move the green square!</p>
        <p>Game created with AI based on: "${prompt}"</p>
    </div>
    
    <script>
        const player = document.getElementById('player');
        let x = 190, y = 140;
        
        document.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': y = Math.max(0, y - 10); break;
                case 's': y = Math.min(280, y + 10); break;
                case 'a': x = Math.max(0, x - 10); break;
                case 'd': x = Math.min(380, x + 10); break;
            }
            player.style.left = x + 'px';
            player.style.top = y + 'px';
        });
    </script>
</body>
</html>`;
    
    return mockGame;
  }

  async function handleSendMessage() {
    if (!input.trim() || isGenerating) return

    const userMessage = input.trim()
    setInput('')
    
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setIsGenerating(true)

    try {
      // Generate game
      const gameCode = await generateGame(userMessage)
      
      setCurrentGame(gameCode)
      
      // Add AI response
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: "🎮 Your game is ready! You can play it below. Want me to modify anything or create a different game?"
        }
      ])
      
      // Auto-suggest title and description
      const titleSuggestion = userMessage.length > 50 
        ? userMessage.substring(0, 50) + "..." 
        : userMessage
      setGameTitle(titleSuggestion)
      setGameDescription(`A fun game created with AI: ${userMessage}`)
      
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
    if (!currentGame) return

    try {
      const { data, error } = await supabase
        .from('games')
        .insert({
          title: gameTitle,
          description: gameDescription,
          html_content: currentGame,
          creator_name: 'Anonymous Creator',
          plays: 0,
          rating: 0
        })
        .select()
        .single()

      if (error) throw error

      alert('Game published successfully! 🎉')
      setShowPublishForm(false)
      
      // Redirect to homepage to see the published game
      window.location.href = '/'
      
    } catch (error) {
      console.error('Error publishing game:', error)
      alert('Error publishing game. Please try again.')
    }
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
