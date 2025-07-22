import React, { useState, useRef, useEffect } from 'react'
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

  const [hasError, setHasError] = useState(false);

// Add error boundary
useEffect(() => {
  const handleError = (error: any) => {
    console.error('  ChatBot error:', error);
    setHasError(true);
    setTimeout(() => setHasError(false), 5000); // Reset after 5s
  };

  window.addEventListener('error', handleError);
  return () => window.removeEventListener('error', handleError);
}, []);

// Add this early return after state declarations
if (hasError) {
  return (
    <motion.button
      onClick={() => setHasError(false)}
      className="fixed bottom-4 right-4 w-16 h-16 bg-red-600 text-white rounded-full shadow-lg z-[9999] flex items-center justify-center"
    >
      <MessageCircle className="h-6 w-6" />
    </motion.button>
  );
}
  // ========== Enhanced Behavioral Monitoring for Chat ==========
  const handleChatKeyEvent = (event: KeyboardEvent) => {
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

    console.log(`  Chat keystroke: ${keystrokeEvent.key} (${keystrokeEvent.type})`)
  }

  const handleChatMouseEvent = (event: globalThis.MouseEvent) => {
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
  }

  // Periodic behavioral check for chat
  const runChatBehavioralCheck = async () => {
    if (!userData?.uid || !behavioralMonitoring || keystrokesRef.current.length < 5) return

    try {
      console.log(`  Running chat behavioral check: ${keystrokesRef.current.length} keystrokes, ${mouseEventsRef.current.length} mouse events`)

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
      console.log('  Chat behavioral check result:', result)

      // Update behavioral status based on result
      if (result.action_taken === 'auto_lock') {
        setBehavioralStatus('anomaly')
        // Show critical alert in chat
        const alertMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: '  **CRITICAL SECURITY ALERT**  \n\nAn unusual behavioral pattern has been detected during our conversation. For your security, this session will be logged and may require additional verification.\n\nIf you are the legitimate user, please continue normally. If you suspect unauthorized access, please contact security immediately.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, alertMessage])
      } else if (result.is_anomaly) {
        setBehavioralStatus('warning')
        console.log('  Chat behavioral warning detected')
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
      console.error('  Chat behavioral check error:', error)
    }
  }

// FIXED: Setup behavioral monitoring when chat opens
useEffect(() => {
  if (!isOpen || !userData?.uid || !behavioralMonitoring) {
    return;
  }

  console.log('  Starting chat behavioral monitoring')
  
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

  // FIXED: Direct event handler functions to avoid re-render loop
  const keyHandler = (event: KeyboardEvent) => {
    if (!isOpen || !behavioralMonitoring || !userData?.uid) return

    const target = event.target as HTMLElement
    const isInChatInput = target.closest('.chat-input-area') !== null
    if (!isInChatInput) return

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
    console.log(`  Chat keystroke: ${keystrokeEvent.key}`)
  };

  const mouseHandler = (event: globalThis.MouseEvent) => {
    if (!isOpen || !behavioralMonitoring || !userData?.uid) return

    const target = event.target as HTMLElement
    const isInChatWindow = target.closest('.chat-window') !== null
    if (!isInChatWindow) return

    let eventType: 'mousemove' | 'click' | 'scroll' = 'mousemove'
    if (event.type === 'click') eventType = 'click'
    if (event.type === 'wheel') eventType = 'scroll'

    if (eventType === 'mousemove') {
      const lastMouse = mouseEventsRef.current[mouseEventsRef.current.length - 1]
      if (lastMouse && (Date.now() - lastMouse.timestamp) < 200) return
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
  };

  // Add event listeners
  document.addEventListener('keydown', keyHandler, true)
  document.addEventListener('keyup', keyHandler, true)
  document.addEventListener('mousemove', mouseHandler, true)
  document.addEventListener('click', mouseHandler, true)
  document.addEventListener('wheel', mouseHandler, true)

  // SIMPLIFIED: Basic periodic check without complex dependencies
  const checkInterval = setInterval(async () => {
    if (keystrokesRef.current.length < 5) return;
    
    try {
      console.log(`  Running simplified behavioral check`);
      // Simplified check without complex callback dependencies
      const sessionId = `chat_${userData.uid}_${Date.now()}`;
      const behavioralData = {
        keystrokes: keystrokesRef.current.slice(-50),
        mouseMovements: mouseEventsRef.current.slice(-30)
      };

      const response = await fetch('http://localhost:5000/api/behavioral-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.uid,
          behavioralData,
          session_id: sessionId,
          check_type: 'chat_monitoring',
          page_context: '/chat'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.is_anomaly) {
          setBehavioralStatus(result.action_taken === 'auto_lock' ? 'anomaly' : 'warning');
        } else {
          setBehavioralStatus('normal');
        }
        setLastBehavioralCheck(new Date());
      }
    } catch (error) {
      console.error('  Chat behavioral check error:', error);
    }
  }, 30000);

  return () => {
    console.log('  Stopping chat behavioral monitoring')
    document.removeEventListener('keydown', keyHandler, true)
    document.removeEventListener('keyup', keyHandler, true)
    document.removeEventListener('mousemove', mouseHandler, true)
    document.removeEventListener('click', mouseHandler, true)
    document.removeEventListener('wheel', mouseHandler, true)
    clearInterval(checkInterval);
  }
}, [isOpen, userData?.uid, behavioralMonitoring]) // FIXED: Only stable dependencies
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

  // Enhanced local fallback processing - refined for actual system
  const processMessageLocally = (message: string): string => {
    const lowerMessage = message.toLowerCase().trim()
    
    // Behavioral Authentication & Keystroke Dynamics
    if (lowerMessage.includes('behavioral') || lowerMessage.includes('typing') || lowerMessage.includes('keystroke') || lowerMessage.includes('pattern')) {
      return "Our behavioral authentication analyzes your unique typing patterns and mouse movements using machine learning. The system tracks:\n\n• **Keystroke Dynamics**: Timing between key presses, rhythm analysis\n• **Mouse Behavior**: Movement patterns, click frequency, scroll patterns\n• **Continuous Learning**: Adaptive authentication models that improve over time\n\nThis creates a unique biometric profile stored encrypted in our Supabase database."
    }
    
    // Facial Recognition & Liveness Detection
    if (lowerMessage.includes('face') || lowerMessage.includes('facial') || lowerMessage.includes('liveness') || lowerMessage.includes('recognition')) {
      return "Our facial recognition system features:\n\n• **Advanced Face Detection**: AI-powered face detection and embedding generation\n• **Liveness Detection**: anti-spoofing technology with EAR MAR calculation\n• **High Accuracy**: 99.8% authentication accuracy\n• **Secure Storage**: Only encrypted face embeddings stored, no raw images\n\nThe system uses OpenCV and DeepFace for processing, with real-time verification in under 2 seconds."
    }
    
    // Security & Anomaly Detection
    if (lowerMessage.includes('anomaly') || lowerMessage.includes('suspicious') || lowerMessage.includes('security') || lowerMessage.includes('fraud')) {
      return "Our AI-powered anomaly detection system monitors:\n\n• **Real-time Analysis**: Continuous behavioral pattern monitoring during sessions\n• **ML Detection**: Machine learning algorithms that detect unusual patterns\n• **Trust Scoring**: Dynamic user trust scores based on behavior\n• **Fraud Prevention**: 95.2% fraud detection rate\n\nAnomalies are logged in our audit system and can indicate unauthorized access attempts or environmental changes."
    }
    
    // System Monitoring & Tracking
    if (lowerMessage.includes('monitor') || lowerMessage.includes('tracking') || lowerMessage.includes('dashboard')) {
      return "Our real-time monitoring system includes:\n\n• **Live Behavioral Analysis**: Continuous keystroke and mouse tracking\n• **Admin Dashboard**: Real-time authentication logs and anomaly detection\n• **Performance Metrics**: System uptime (99.9%), response times (<2s)\n• **Audit Trails**: Comprehensive logging for compliance and security\n\nAdministrators can monitor user activity, authentication success rates, and system performance in real-time."
    }
    
    // Registration & User Setup
    if (lowerMessage.includes('register') || lowerMessage.includes('sign up') || lowerMessage.includes('enrollment')) {
      return "To register in our eKYC system:\n\n• **Account Creation**: Provide email and secure password\n• **Facial Biometric Capture**: Complete face detection and liveness verification\n• **Behavioral Enrollment**: Provide keystroke and mouse behavior samples\n• **Encrypted Storage**: All biometric data encrypted with AES-256\n\nThe system creates a secure biometric profile for multi-factor authentication."
    }
    
    // Login & Authentication
    if (lowerMessage.includes('login') || lowerMessage.includes('sign in') || lowerMessage.includes('authenticate')) {
      return "Authentication process:\n\n• **Credentials**: Enter your email and password\n• **Facial Verification**: Real-time face recognition with liveness detection\n• **Behavioral Monitoring**: Continuous keystroke and mouse pattern analysis\n• **Multi-Factor Security**: Combined biometric modalities for enhanced security\n\n**Demo Accounts:**\n• Admin: admin@example.com / admin123\n• User: user@example.com / user123"
    }
    
    // Technical Architecture
    if (lowerMessage.includes('technical') || lowerMessage.includes('architecture') || lowerMessage.includes('how it works') || lowerMessage.includes('database')) {
      return "Technical Architecture:\n\n• **Frontend**: React with TypeScript and Tailwind CSS\n• **Backend**: Supabase with PostgreSQL database\n• **ML Processing**: Edge Functions for behavioral analysis\n• **Security**: Row Level Security (RLS) and AES-256 encryption\n• **APIs**: RESTful endpoints for integration\n• **Storage**: Encrypted biometric templates, no raw biometric images stored"
    }
    
    // Data Protection & Privacy
    if (lowerMessage.includes('privacy') || lowerMessage.includes('encryption') || lowerMessage.includes('secure') || lowerMessage.includes('data protection')) {
      return "Privacy & Security Features:\n\n• **End-to-End Encryption**: AES-256 encryption for all biometric data\n• **No Raw Storage**: Only encrypted templates stored, never raw biometric images\n• **Row Level Security**: Database-level access controls in Supabase\n• **Audit Logging**: Comprehensive authentication and security event tracking\n• **GDPR Compliance**: Privacy-by-design architecture with user consent management"
    }
    
    // API & Integration
    if (lowerMessage.includes('api') || lowerMessage.includes('integration') || lowerMessage.includes('endpoint')) {
      return "API Integration:\n\n• **Authentication Endpoints**: Register, login, and verification APIs\n• **Monitoring APIs**: User metrics and anomaly logs\n• **Edge Functions**: Supabase functions for behavioral analysis\n• **Webhooks**: Real-time event notifications\n• **Rate Limiting**: Built-in API protection and throttling\n\nRESTful endpoints available for seamless integration with existing systems."
    }
    
    // Performance & Metrics
    if (lowerMessage.includes('performance') || lowerMessage.includes('speed') || lowerMessage.includes('metrics') || lowerMessage.includes('stats')) {
      return "System Performance:\n\n• **Authentication Speed**: <2 seconds response time\n• **Accuracy Rate**: 99.8% authentication accuracy\n• **Fraud Detection**: 95.2% fraud detection rate\n• **System Uptime**: 99.9% availability\n• **Real-time Processing**: Live behavioral analysis during sessions\n\nOptimized for production workloads with scalable cloud architecture."
    }
    
    // Troubleshooting & Support
    if (lowerMessage.includes('help') || lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('trouble') || lowerMessage.includes('error')) {
      return "Support & Troubleshooting:\n\n• **Camera Issues**: Ensure camera permissions enabled for facial recognition\n• **Lighting**: Use well-lit environment for liveness detection\n• **Behavior Capture**: Type and move mouse naturally during enrollment\n• **Browser Support**: Modern browsers with WebRTC support required\n• **Clear Cache**: Clear browser cache if experiencing issues\n\nFor persistent issues, check the admin dashboard or contact system administrator."
    }
    
    // General System Information
    if (lowerMessage.includes('what is') || lowerMessage.includes('explain') || lowerMessage.includes('about')) {
      return "This is a comprehensive Supabase-based eKYC biometric authentication system featuring:\n\n• **Multimodal Biometrics**: Facial recognition, keystroke dynamics, and behavioral patterns\n• **AI-Powered Security**: Machine learning for anomaly detection and pattern recognition\n• **Real-time Monitoring**: Continuous behavioral analysis with live dashboard\n• **Enterprise Security**: AES-256 encryption, audit logging, and compliance features\n\nDesigned for secure identity verification with fraud prevention capabilities."
    }
    
    // Default response
    return "I'm your eKYC biometric authentication assistant. I can help with:\n\n• **Facial Recognition & Liveness Detection**\n• **Behavioral Authentication & Keystroke Dynamics** \n• **Security Features & Anomaly Detection**\n• **System Architecture & Technical Details**\n• **Account Management & Registration**\n• **API Integration & Performance Metrics**\n\nWhat would you like to know about our biometric authentication system?"
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
    {/* FIXED: Enhanced Chat Toggle Button with Better Positioning */}
    <motion.div
      className="fixed bottom-4 right-4 z-[9999]" // Higher z-index
      style={{ zIndex: 9999 }} // Inline style for extra safety
    >
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-gradient-to-r from-green-600 to-cyan-600 text-white rounded-full shadow-2xl hover:shadow-green-400/50 transition-all duration-300 flex items-center justify-center neon-glow relative border-2 border-green-400/30"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{ 
          filter: 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.5))',
          zIndex: 9999 
        }}
      >
        {isOpen ? <X className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
        
        {/* Behavioral Status Indicator */}
        {userData?.uid && behavioralMonitoring && (
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black/90 flex items-center justify-center text-xs border border-green-400/50">
            {getBehavioralStatusIcon()}
          </div>
        )}
        
        {/* Pulse animation for attention */}
        <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
      </motion.button>
    </motion.div>

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