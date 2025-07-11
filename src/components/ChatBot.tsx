import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, X, Bot, User, Shield, Activity, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface KeystrokeEvent {
  key: string
  code: string
  timestamp: number
  type: 'keydown' | 'keyup'
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

interface MouseEvent {
  x: number
  y: number
  timestamp: number
  type: 'mousemove' | 'click' | 'scroll'
  button?: number
  deltaY?: number
}

const ChatBot: React.FC = () => {
  const { userData } = useAuth()
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

  // Behavioral monitoring state
  const [behavioralMonitoring, setBehavioralMonitoring] = useState(true)
  const [chatBehavioralData, setChatBehavioralData] = useState({
    keystrokes: [] as KeystrokeEvent[],
    mouseEvents: [] as MouseEvent[],
    startTime: 0,
    lastCheck: 0
  })
  const [behavioralStatus, setBehavioralStatus] = useState<'normal' | 'warning' | 'anomaly'>('normal')
  const [lastBehavioralCheck, setLastBehavioralCheck] = useState<Date | null>(null)

  // Refs for behavioral data collection
  const keystrokesRef = useRef<KeystrokeEvent[]>([])
  const mouseEventsRef = useRef<MouseEvent[]>([])
  const behavioralIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ========== Enhanced Behavioral Monitoring for Chat ==========

  const handleChatKeyEvent = useCallback((event: KeyboardEvent) => {
    if (!isOpen || !behavioralMonitoring || !userData?.uid) return

    // Only monitor when chat is open and user is typing
    const target = event.target as HTMLElement
    const isInChatInput = target.closest('.chat-input-area') !== null

    if (!isInChatInput) return

    // Skip function keys and navigation keys
    if (event.key.startsWith('F') || 
        ['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Escape'].includes(event.key)) {
      return
    }

    const keystrokeEvent: KeystrokeEvent = {
      key: event.key,
      code: event.code,
      timestamp: Date.now(),
      type: event.type as 'keydown' | 'keyup',
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    }

    keystrokesRef.current.push(keystrokeEvent)
    
    // Update state for UI display
    setChatBehavioralData(prev => ({
      ...prev,
      keystrokes: [...prev.keystrokes, keystrokeEvent].slice(-100) // Keep last 100
    }))

    console.log(`💬 Chat keystroke: ${keystrokeEvent.key} (${keystrokeEvent.type})`)
  }, [isOpen, behavioralMonitoring, userData?.uid])

  const handleChatMouseEvent = useCallback((event: globalThis.MouseEvent) => {
    if (!isOpen || !behavioralMonitoring || !userData?.uid) return

    // Only monitor mouse events within the chat window
    const target = event.target as HTMLElement
    const isInChatWindow = target.closest('.chat-window') !== null

    if (!isInChatWindow) return

    let eventType: 'mousemove' | 'click' | 'scroll' = 'mousemove'
    if (event.type === 'click') eventType = 'click'
    if (event.type === 'wheel') eventType = 'scroll'

    // Throttle mousemove events
    if (eventType === 'mousemove') {
      const lastMouse = mouseEventsRef.current[mouseEventsRef.current.length - 1]
      if (lastMouse && (Date.now() - lastMouse.timestamp) < 200) {
        return
      }
    }

    const mouseEventData: MouseEvent = {
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
      type: eventType,
      button: event.button,
      deltaY: (event as any).deltaY
    }

    mouseEventsRef.current.push(mouseEventData)
    
    // Update state for UI display
    setChatBehavioralData(prev => ({
      ...prev,
      mouseEvents: [...prev.mouseEvents, mouseEventData].slice(-50) // Keep last 50
    }))
  }, [isOpen, behavioralMonitoring, userData?.uid])

  // Periodic behavioral check for chat
  const runChatBehavioralCheck = useCallback(async () => {
    if (!userData?.uid || !behavioralMonitoring || keystrokesRef.current.length < 5) return

    try {
      console.log(`💬 Running chat behavioral check: ${keystrokesRef.current.length} keystrokes, ${mouseEventsRef.current.length} mouse events`)

      const sessionId = `chat_${userData.uid}_${Date.now()}`
      const behavioralData = {
        keystrokes: keystrokesRef.current.slice(-50), // Last 50 keystrokes
        mouseMovements: mouseEventsRef.current.slice(-30) // Last 30 mouse events
      }

      const response = await fetch('http://localhost:5000/api/behavioral-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userData.uid,
          behavioralData,
          session_id: sessionId,
          check_type: 'chat_monitoring',
          page_context: '/chat'
        })
      })

      if (!response.ok) {
        throw new Error(`Chat behavioral check failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('💬 Chat behavioral check result:', result)

      // Update behavioral status based on result
      if (result.action_taken === 'auto_lock') {
        setBehavioralStatus('anomaly')
        // Show critical alert in chat
        const alertMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: '🚨 **CRITICAL SECURITY ALERT** 🚨\n\nAn unusual behavioral pattern has been detected during our conversation. For your security, this session will be logged and may require additional verification.\n\nIf you are the legitimate user, please continue normally. If you suspect unauthorized access, please contact security immediately.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, alertMessage])
      } else if (result.is_anomaly) {
        setBehavioralStatus('warning')
        console.log('⚠️ Chat behavioral warning detected')
      } else {
        setBehavioralStatus('normal')
      }

      setLastBehavioralCheck(new Date())

      // Save behavioral session if anomaly detected
      if (result.is_anomaly) {
        await fetch('http://localhost:5000/api/save-behavioral-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userData.uid,
            session_id: sessionId,
            similarity_scores: {
              overall_similarity: result.similarity_score,
              keystroke_similarity: result.keystroke_similarity || result.similarity_score,
              mouse_similarity: result.mouse_similarity || result.similarity_score
            },
            anomaly_score: result.anomaly_score,
            is_successful: !result.is_anomaly,
            verification_type: 'chat_monitoring',
            duration_seconds: Math.floor((Date.now() - chatBehavioralData.startTime) / 1000),
            page_context: '/chat'
          })
        })

        // Save anomaly if detected
        await fetch('http://localhost:5000/api/save-anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userData.uid,
            session_id: sessionId,
            anomaly_type: 'chat_behavioral_monitoring',
            score: result.anomaly_score,
            severity: result.severity,
            action_taken: result.action_taken,
            details: {
              similarity_score: result.similarity_score,
              page_context: '/chat',
              chat_context: 'ai_assistant_interaction',
              keystroke_count: keystrokesRef.current.length,
              mouse_count: mouseEventsRef.current.length
            }
          })
        })

        // Trigger real-time update
        window.dispatchEvent(new CustomEvent('behavioralDataUpdated', {
          detail: { userId: userData.uid, result, sessionId, context: 'chat' }
        }))
      }

      // Clear old data to avoid memory buildup
      keystrokesRef.current = keystrokesRef.current.slice(-25)
      mouseEventsRef.current = mouseEventsRef.current.slice(-15)

    } catch (error) {
      console.error('❌ Chat behavioral check error:', error)
    }
  }, [userData?.uid, behavioralMonitoring, chatBehavioralData.startTime])

  // Setup behavioral monitoring when chat opens
  useEffect(() => {
    if (isOpen && userData?.uid && behavioralMonitoring) {
      console.log('💬 Starting chat behavioral monitoring')
      
      // Reset behavioral data
      keystrokesRef.current = []
      mouseEventsRef.current = []
      setChatBehavioralData(prev => ({
        ...prev,
        startTime: Date.now(),
        keystrokes: [],
        mouseEvents: []
      }))
      setBehavioralStatus('normal')

      // Add event listeners
      document.addEventListener('keydown', handleChatKeyEvent, true)
      document.addEventListener('keyup', handleChatKeyEvent, true)
      document.addEventListener('mousemove', handleChatMouseEvent, true)
      document.addEventListener('click', handleChatMouseEvent, true)
      document.addEventListener('wheel', handleChatMouseEvent, true)

      // Start periodic checks every 30 seconds
      behavioralIntervalRef.current = setInterval(runChatBehavioralCheck, 30000)

      return () => {
        console.log('💬 Stopping chat behavioral monitoring')
        document.removeEventListener('keydown', handleChatKeyEvent, true)
        document.removeEventListener('keyup', handleChatKeyEvent, true)
        document.removeEventListener('mousemove', handleChatMouseEvent, true)
        document.removeEventListener('click', handleChatMouseEvent, true)
        document.removeEventListener('wheel', handleChatMouseEvent, true)
        
        if (behavioralIntervalRef.current) {
          clearInterval(behavioralIntervalRef.current)
          behavioralIntervalRef.current = null
        }
      }
    }
  }, [isOpen, userData?.uid, behavioralMonitoring, handleChatKeyEvent, handleChatMouseEvent, runChatBehavioralCheck])

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

    // Run immediate behavioral check on message send
    if (userData?.uid && behavioralMonitoring && keystrokesRef.current.length > 3) {
      setTimeout(runChatBehavioralCheck, 1000) // Delay to capture full typing pattern
    }

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

  // Enhanced local fallback processing
  const processMessageLocally = (message: string): string => {
    const lowerMessage = message.toLowerCase().trim()
    
    // Enhanced keyword matching for local fallback
    if (lowerMessage.includes('behavioral') || lowerMessage.includes('typing') || lowerMessage.includes('pattern')) {
      return "Behavioral authentication analyzes your unique typing patterns and mouse movements. Each person has a distinctive way of typing that can be used for identity verification. This system continuously monitors your behavior to detect unauthorized access."
    }
    
    if (lowerMessage.includes('anomaly') || lowerMessage.includes('suspicious') || lowerMessage.includes('security')) {
      return "Security anomalies are unusual patterns detected in your behavior. The system compares your current typing and mouse patterns with your enrolled baseline. If significant differences are detected, it may indicate:\n\n• Stress or fatigue affecting your behavior\n• Different environment or device\n• Potential unauthorized access\n\nThe system logs these events for security analysis."
    }
    
    if (lowerMessage.includes('monitor') || lowerMessage.includes('tracking')) {
      return "Our behavioral monitoring system tracks:\n\n• **Keystroke Dynamics**: Timing between key presses, dwell time\n• **Mouse Patterns**: Movement velocity, click patterns\n• **Session Behavior**: Page interactions, navigation patterns\n\nThis creates a unique biometric profile that helps protect your account from unauthorized access."
    }
    
    if (lowerMessage.includes('test') || lowerMessage.includes('verify')) {
      return "You can test your behavioral patterns using our Enhanced Behavioral Test. This 90-second test captures your typing and mouse behavior in three phases:\n\n1. **Typing Phase** (30s): Natural text input\n2. **Mouse Phase** (30s): Mouse movement and clicks\n3. **Mixed Phase** (30s): Combined interaction\n\nThe test analyzes your patterns against your enrolled baseline."
    }
    
    if (lowerMessage.includes('register') || lowerMessage.includes('sign up')) {
      return "To register, click the 'REGISTER_NEW_USER' button and complete the biometric enrollment process. This includes:\n\n• Face capture with liveness detection\n• Behavioral pattern enrollment\n• eKYC document verification\n• Account setup and verification"
    }
    
    if (lowerMessage.includes('login') || lowerMessage.includes('sign in')) {
      return "To log in, enter your credentials and complete biometric verification. Demo accounts:\n\n• **Admin**: admin@example.com / admin123\n• **User**: user@example.com / user123\n\nThe system will verify your face and monitor your behavioral patterns during the session."
    }
    
    if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
      return "I can help with:\n\n• **Behavioral Authentication**: How typing patterns work\n• **Security Features**: Anomaly detection, monitoring\n• **Account Management**: Registration, login, verification\n• **Testing**: Behavioral pattern analysis\n• **Troubleshooting**: Common issues and solutions\n\nWhat would you like to know more about?"
    }
    
    return "I'm your biometric authentication assistant. I can help with questions about behavioral authentication, security monitoring, account management, and system features. I'm currently running in enhanced mode with behavioral monitoring active."
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const getBehavioralStatusColor = () => {
    switch (behavioralStatus) {
      case 'normal': return 'text-green-400'
      case 'warning': return 'text-yellow-400'
      case 'anomaly': return 'text-red-400'
    }
  }

  const getBehavioralStatusIcon = () => {
    switch (behavioralStatus) {
      case 'normal': return '🟢'
      case 'warning': return '🟡'
      case 'anomaly': return '🔴'
    }
  }

  return (
    <>
      {/* Enhanced Chat Toggle Button with Behavioral Status */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-green-600 to-cyan-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 flex items-center justify-center neon-glow relative"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        
        {/* Behavioral Status Indicator */}
        {isOpen && userData?.uid && behavioralMonitoring && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/80 flex items-center justify-center text-xs">
            {getBehavioralStatusIcon()}
          </div>
        )}
      </motion.button>

      {/* Enhanced Chat Window with Behavioral Monitoring */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-96 h-[600px] glass-modal rounded-2xl shadow-2xl z-40 flex flex-col border border-green-500/30 chat-window"
          >
            {/* Enhanced Header with Behavioral Status */}
            <div className="p-4 border-b border-green-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-cyan-600 rounded-full flex items-center justify-center neon-glow">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-green-400 font-bold" style={{ fontFamily: 'Orbitron' }}>
                      BIOMETRIC_ASSISTANT
                    </h3>
                    <p className="text-cyan-400 text-xs" style={{ fontFamily: 'IBM Plex Mono' }}>
                      Enhanced with behavioral monitoring
                    </p>
                  </div>
                </div>
                
                {/* Behavioral Monitoring Toggle */}
                {userData?.uid && (
                  <button
                    onClick={() => setBehavioralMonitoring(!behavioralMonitoring)}
                    className={`p-2 rounded transition-all duration-300 ${
                      behavioralMonitoring 
                        ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                        : 'bg-gray-600/20 text-gray-400 border border-gray-500/30'
                    }`}
                    title={behavioralMonitoring ? 'Behavioral monitoring enabled' : 'Behavioral monitoring disabled'}
                  >
                    <Shield className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Behavioral Status Bar */}
              {userData?.uid && behavioralMonitoring && (
                <div className="mt-3 p-2 bg-black/20 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Activity className="h-3 w-3 mr-1" />
                      <span className={getBehavioralStatusColor()}>
                        Behavioral Status: {behavioralStatus.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-gray-400">
                      Keys: {chatBehavioralData.keystrokes.length} | Mouse: {chatBehavioralData.mouseEvents.length}
                    </div>
                  </div>
                  {lastBehavioralCheck && (
                    <div className="text-gray-400 mt-1">
                      Last check: {lastBehavioralCheck.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}
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

            {/* Enhanced Input with Behavioral Monitoring */}
            <div className="p-4 border-t border-green-500/30 chat-input-area">
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
              
              {/* Behavioral Warning Display */}
              {behavioralStatus === 'warning' && (
                <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded flex items-center text-xs">
                  <AlertTriangle className="h-3 w-3 text-yellow-400 mr-1" />
                  <span className="text-yellow-400">Behavioral pattern variation detected</span>
                </div>
              )}
              
              {behavioralStatus === 'anomaly' && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded flex items-center text-xs">
                  <AlertTriangle className="h-3 w-3 text-red-400 mr-1" />
                  <span className="text-red-400">Security anomaly detected - session monitored</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ChatBot