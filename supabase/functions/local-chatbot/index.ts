import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ChatRequest {
  message: string
}

interface ChatResponse {
  reply: string
}

class LocalChatbot {
  private greetingMessage: string
  private fallbackMessage: string
  
  constructor() {
    this.greetingMessage = "Hello! I'm your biometric authentication assistant. How can I help you today?"
    this.fallbackMessage = "I'm sorry, I don't understand that question. Try asking about registration, login, security, or biometric authentication."
  }
  
  processMessage(message: string): string {
    const lowerMessage = message.toLowerCase().trim()
    
    // Greeting patterns
    if (this.matchesPattern(lowerMessage, ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'])) {
      return this.greetingMessage
    }
    
    // Registration related
    if (this.matchesPattern(lowerMessage, ['register', 'registration', 'sign up', 'signup', 'create account', 'new account', 'enroll'])) {
      return "To register, click the 'REGISTER_NEW_USER' button and follow these steps:\n1. Enter your personal information\n2. Capture your facial biometric data\n3. Complete liveness detection\n4. Provide keystroke and behavioral samples\n\nThe system will create an encrypted biometric profile for secure authentication."
    }
    
    // Login related
    if (this.matchesPattern(lowerMessage, ['login', 'log in', 'sign in', 'signin', 'authenticate', 'access'])) {
      return "To log in:\n1. Enter your email and password\n2. The system will verify your facial biometrics\n3. Complete liveness detection if prompted\n4. Your behavioral patterns will be continuously monitored\n\nFor demo purposes, you can use:\n• Admin: admin@example.com / admin123\n• User: user@example.com / user123"
    }
    
    // Security related
    if (this.matchesPattern(lowerMessage, ['security', 'secure', 'safety', 'protection', 'encryption', 'privacy'])) {
      return "Our security features include:\n• Multi-factor biometric authentication\n• AES-256 encryption for all biometric data\n• Real-time behavioral monitoring\n• Liveness detection to prevent spoofing\n• Continuous anomaly detection\n• Row-level security policies\n• Comprehensive audit logging"
    }
    
    // Biometric related
    if (this.matchesPattern(lowerMessage, ['biometric', 'face', 'facial', 'recognition', 'liveness', 'keystroke', 'behavioral', 'mouse', 'scroll'])) {
      return "Our biometric system uses:\n• Facial Recognition: AI-powered face detection and matching\n• Liveness Detection: Color-based anti-spoofing technology\n• Keystroke Dynamics: Typing pattern analysis\n• Behavioral Biometrics: Mouse movement and scroll pattern recognition\n• Continuous Monitoring: Real-time behavioral analysis during sessions"
    }
    
    // Technical/Architecture related
    if (this.matchesPattern(lowerMessage, ['architecture', 'technical', 'database', 'api', 'implementation', 'how it works', 'technology'])) {
      return "Technical Architecture:\n• Frontend: React with TypeScript and Tailwind CSS\n• Backend: Supabase with PostgreSQL database\n• ML Processing: Edge Functions for behavioral analysis\n• Storage: Encrypted biometric templates (no raw images)\n• APIs: RESTful endpoints for integration\n• Security: Row-level security and audit trails"
    }
    
    // Troubleshooting
    if (this.matchesPattern(lowerMessage, ['help', 'problem', 'issue', 'error', 'trouble', 'not working', 'failed', 'cant'])) {
      return "Common troubleshooting steps:\n• Ensure your camera is enabled for facial recognition\n• Check that you're in a well-lit environment\n• Type naturally during keystroke capture\n• Move your mouse normally during behavioral sampling\n• Clear your browser cache if experiencing issues\n• Contact support if problems persist"
    }
    
    // Features/Capabilities
    if (this.matchesPattern(lowerMessage, ['features', 'capabilities', 'what can', 'what do', 'functions'])) {
      return "System capabilities:\n• Multi-modal biometric authentication\n• Real-time anomaly detection\n• Behavioral pattern learning\n• Administrative monitoring dashboard\n• Comprehensive audit trails\n• API integration support\n• Scalable cloud architecture\n• GDPR compliance features"
    }
    
    // Admin related
    if (this.matchesPattern(lowerMessage, ['admin', 'administrator', 'dashboard', 'monitoring', 'logs', 'users'])) {
      return "Admin features:\n• User management console\n• Real-time authentication logs\n• Anomaly detection dashboard\n• System performance metrics\n• Security event monitoring\n• User trust score tracking\n• Export capabilities for compliance"
    }
    
    // Privacy/Compliance
    if (this.matchesPattern(lowerMessage, ['privacy', 'gdpr', 'compliance', 'data protection', 'personal data'])) {
      return "Privacy & Compliance:\n• No raw biometric images stored\n• Only encrypted templates retained\n• GDPR-compliant data handling\n• User consent management\n• Data retention policies\n• Right to deletion support\n• Audit trail for compliance reporting"
    }
    
    // Performance/Speed
    if (this.matchesPattern(lowerMessage, ['speed', 'performance', 'fast', 'slow', 'time', 'latency'])) {
      return "Performance metrics:\n• Authentication time: <2 seconds\n• System accuracy: 99.8%\n• Fraud detection rate: 95.2%\n• System uptime: 99.9%\n• Real-time behavioral analysis\n• Optimized for production workloads"
    }
    
    // Integration
    if (this.matchesPattern(lowerMessage, ['integration', 'api', 'sdk', 'embed', 'implement'])) {
      return "Integration options:\n• RESTful API endpoints\n• JavaScript SDK available\n• Webhook support for events\n• Docker deployment ready\n• Kubernetes compatible\n• Comprehensive documentation\n• Code examples provided"
    }
    
    // Default fallback
    return this.fallbackMessage
  }
  
  private matchesPattern(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword))
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const requestBody: ChatRequest = await req.json()
    
    if (!requestBody.message || typeof requestBody.message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Process message with local chatbot
    const chatbot = new LocalChatbot()
    const reply = chatbot.processMessage(requestBody.message)
    
    const response: ChatResponse = { reply }
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('Error in local chatbot:', error)
    
    return new Response(
      JSON.stringify({ 
        reply: "I'm sorry, I'm experiencing technical difficulties. Please try again in a moment."
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})