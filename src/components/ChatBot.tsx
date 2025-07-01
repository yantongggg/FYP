import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, X, Bot, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your biometric authentication assistant. How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Try Supabase Edge Function first
      const { data, error } = await supabase.functions.invoke('local-chatbot', {
        body: { message: inputMessage }
      })

      let assistantResponse = ''

      if (error || !data?.reply) {
        // Fallback to local processing if Supabase function fails
        assistantResponse = processMessageLocally(inputMessage)
      } else {
        assistantResponse = data.reply
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Fallback to local processing
      const fallbackResponse = processMessageLocally(inputMessage)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallbackResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Local fallback processing when Supabase is not available
  const processMessageLocally = (message: string): string => {
    const lowerMessage = message.toLowerCase().trim()
    
    // Simple keyword matching for local fallback
    if (lowerMessage.includes('register') || lowerMessage.includes('sign up')) {
      return "To register, click the 'REGISTER_NEW_USER' button and complete the biometric enrollment process."
    }
    
    if (lowerMessage.includes('login') || lowerMessage.includes('sign in')) {
      return "To log in, enter your credentials and complete biometric verification. Demo accounts: admin@example.com/admin123 or user@example.com/user123"
    }
    
    if (lowerMessage.includes('security') || lowerMessage.includes('safe')) {
      return "We use multi-factor biometric authentication, encryption, and continuous behavioral monitoring for maximum security."
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return "I can help with registration, login, security questions, and system features. What would you like to know?"
    }
    
    return "I'm running in offline mode. I can help with basic questions about registration, login, and security features."
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-green-600 to-cyan-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 flex items-center justify-center neon-glow"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-96 h-[500px] glass-modal rounded-2xl shadow-2xl z-40 flex flex-col border border-green-500/30"
          >
            {/* Header */}
            <div className="p-4 border-b border-green-500/30">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-cyan-600 rounded-full flex items-center justify-center neon-glow">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-green-400 font-bold" style={{ fontFamily: 'Orbitron' }}>
                    BIOMETRIC_ASSISTANT
                  </h3>
                  <p className="text-cyan-400 text-xs" style={{ fontFamily: 'IBM Plex Mono' }}>
                    Local AI-powered support
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-blue-600' 
                        : 'bg-gradient-to-r from-green-600 to-cyan-600'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600/20 border border-blue-500/30'
                        : 'bg-green-600/20 border border-green-500/30'
                    }`}>
                      <p className="text-white text-sm whitespace-pre-line" style={{ fontFamily: 'IBM Plex Mono' }}>
                        {message.content}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex items-start space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-cyan-600 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-green-500/30">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about biometric authentication..."
                  className="flex-1 terminal-input px-3 py-2 rounded-lg text-sm"
                  style={{ fontFamily: 'IBM Plex Mono' }}
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="w-10 h-10 bg-gradient-to-r from-green-600 to-cyan-600 text-white rounded-lg hover:from-green-700 hover:to-cyan-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover-glow"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ChatBot