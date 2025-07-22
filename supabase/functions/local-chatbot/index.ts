// @ts-ignore
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';


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
    this.greetingMessage = "Hello! I'm your Supabase-powered biometric authentication assistant. I can help you with registration, authentication, security features, and system monitoring."
    this.fallbackMessage = "I can help you with:\n• User registration and biometric enrollment\n• Login and authentication process\n• Security features and policies\n• System architecture and database\n• Admin dashboard and monitoring\n• Troubleshooting and support"
  }
  
  processMessage(message: string): string {
    const lowerMessage = message.toLowerCase().trim()
    
    
    
    // Registration related
    if (this.matchesPattern(lowerMessage, ['register', 'registration', 'sign up', 'signup', 'create account', 'new account', 'enroll'])) {
      return "To register in our biometric system:\n\n1. Click 'REGISTER_NEW_USER' button\n2. Fill in your details (email, username, full name, password)\n3. Facial Biometric Capture:\n   • Position your face in the camera frame\n   • Complete liveness detection (follow on-screen prompts)\n   • System captures and encrypts facial template\n4. Behavioral Biometric Enrollment:\n   • Type the reference sentence naturally\n   • Move your mouse normally during capture\n   • System learns your keystroke and mouse patterns\n\nAll biometric data is encrypted client-side before storage in Supabase."
    }
    
    // Login related
    if (this.matchesPattern(lowerMessage, ['login', 'log in', 'sign in', 'signin', 'authenticate', 'access'])) {
      return "Authentication process:\n\n1. Enter your email and password\n2. Supabase Auth verifies your credentials\n3. Facial Verification:\n   • Camera captures your face\n   • System matches against encrypted template\n   • Liveness detection prevents spoofing\n4. Behavioral Monitoring:\n   • Continuous keystroke analysis\n   • Mouse movement pattern verification\n   • Real-time anomaly detection\n\nIf anomalies are detected, the system may require additional verification or temporarily lock your account for security."
    }
    
    // Security related
    if (this.matchesPattern(lowerMessage, ['security', 'secure', 'safety', 'protection', 'encryption', 'privacy'])) {
      return "Our Supabase-based security features:\n\n  **Authentication Security:**\n• Supabase Auth with JWT tokens\n• Multi-factor biometric verification\n• Real-time behavioral monitoring\n\n  **Data Protection:**\n• Client-side AES-256 encryption for biometric data\n• PostgreSQL Row Level Security (RLS)\n• No raw biometric images stored\n• Only encrypted templates in database\n\n  **Monitoring:**\n• Real-time anomaly detection\n• Comprehensive audit logging\n• Trust score tracking\n• Automated threat response"
    }
    
    // Biometric related
    if (this.matchesPattern(lowerMessage, ['biometric', 'face', 'facial', 'recognition', 'liveness', 'keystroke', 'behavioral', 'mouse', 'scroll'])) {
      return "Our biometric authentication system:\n\n👤 **Facial Recognition:**\n• Face-api.js for client-side processing\n• Face embedding generation and matching\n• High accuracy facial verification\n\n✨ **Liveness Detection:**\n• anti-spoofing technology\n• Real-time face movement verification\n• Prevents photo and video attacks\n\n⌨️ **Keystroke Dynamics:**\n• Typing rhythm and timing analysis\n• Individual keystroke pattern recognition\n• Continuous authentication during typing\n\n  **Mouse Behavior:**\n• Movement pattern analysis\n• Click timing and scroll behavior\n• Real-time behavioral verification"
    }
    
    // Technical/Architecture related
    if (this.matchesPattern(lowerMessage, ['architecture', 'technical', 'database', 'api', 'implementation', 'how it works', 'technology', 'supabase'])) {
      return "System Architecture:\n\n🎨 **Frontend:**\n• React 18 with TypeScript\n• Tailwind CSS for styling\n• Framer Motion animations\n• Real-time Supabase subscriptions\n\n⚡ **Backend:**\n• Supabase Platform (Backend-as-a-Service)\n• PostgreSQL 15 database\n• Row Level Security policies\n• Real-time API subscriptions\n\n  **Edge Functions:**\n• behavioral-analysis (Deno/TypeScript)\n• local-chatbot (this assistant)\n• Serverless ML processing\n\n  **Database:**\n• users, biometric_profiles, behavioral_sessions\n• login_audit, anomaly_audit, system_logs\n• Encrypted biometric storage"
    }
    
    // Troubleshooting
    if (this.matchesPattern(lowerMessage, ['help', 'problem', 'issue', 'error', 'trouble', 'not working', 'failed', 'cant', 'camera'])) {
      return "Common troubleshooting:\n\n📷 **Camera Issues:**\n• Allow camera permissions in browser\n• Ensure good lighting for facial recognition\n• Check if other apps are using camera\n\n  **Authentication Problems:**\n• Verify email and password are correct\n• Clear browser cache and cookies\n• Check internet connection\n• Try different browser if issues persist\n\n⌨️ **Behavioral Issues:**\n• Type naturally during enrollment\n• Don't change typing style after registration\n• Use same device for consistent behavior\n\n🆘 **Still having issues?**\n• Check browser console for errors\n• Contact system administrator\n• Review audit logs in admin dashboard"
    }
    
    // Features/Capabilities
    if (this.matchesPattern(lowerMessage, ['features', 'capabilities', 'what can', 'what do', 'functions'])) {
      return "System Capabilities:\n\n  **Core Features:**\n• Multi-modal biometric authentication\n• Real-time behavioral monitoring\n• Anomaly detection and prevention\n• Trust score calculation\n\n👥 **User Management:**\n• Self-service registration\n• Profile management\n• Biometric re-enrollment\n• Personal anomaly history\n\n🛠️ **Admin Features:**\n• User management console\n• Real-time monitoring dashboard\n• Audit trail analysis\n• System performance metrics\n\n🔌 **Integration:**\n• Supabase REST API\n• Real-time subscriptions\n• Webhook notifications\n• Edge Functions processing"
    }
    
    // Admin related
    if (this.matchesPattern(lowerMessage, ['admin', 'administrator', 'dashboard', 'monitoring', 'logs', 'users'])) {
      return "Admin Dashboard Features:\n\n👥 **User Management:**\n• View all registered users\n• Edit user profiles and roles\n• Monitor trust scores\n• Account status management\n\n  **Real-time Monitoring:**\n• Live authentication attempts\n• Behavioral session tracking\n• Anomaly detection alerts\n• System performance metrics\n\n📋 **Audit & Logs:**\n• Complete login history\n• Anomaly investigation tools\n• Security event timeline\n• Export capabilities for compliance\n\n⚙️ **System Management:**\n• Database schema viewing\n• System configuration\n• Performance optimization\n• Security policy management"
    }
    
    // Database related
    if (this.matchesPattern(lowerMessage, ['database', 'tables', 'schema', 'postgresql', 'data'])) {
      return "Database Structure (Supabase PostgreSQL):\n\n📋 **Core Tables:**\n• **users** - Account information, trust scores\n• **biometric_profiles** - Encrypted facial templates\n• **behavioral_sessions** - Real-time behavioral data\n• **login_audit** - Authentication attempt logs\n• **anomaly_audit** - Security anomaly records\n• **system_logs** - Application operation logs\n\n  **Security Features:**\n• Row Level Security (RLS) policies\n• Data encryption at rest\n• Automated backups\n• Real-time replication\n\n  **Data Access:**\n• Users can only access their own data\n• Admins have elevated access with audit trails\n• All queries are logged for security"
    }
    
    // Privacy/Compliance
    if (this.matchesPattern(lowerMessage, ['privacy', 'gdpr', 'compliance', 'data protection', 'personal data'])) {
      return "Privacy & Data Protection:\n\n  **Data Minimization:**\n• No raw biometric images stored\n• Only encrypted templates retained\n• Minimal personal data collection\n• Purpose-limited data processing\n\n📜 **Compliance Features:**\n• GDPR-compliant data handling\n• User consent management\n• Data retention policies\n• Right to deletion support\n• Comprehensive audit trails\n\n  **Technical Safeguards:**\n• Client-side encryption before storage\n• Supabase security compliance\n• Regular security assessments\n• Incident response procedures"
    }
    
    // Performance/Speed
    if (this.matchesPattern(lowerMessage, ['speed', 'performance', 'fast', 'slow', 'time', 'latency'])) {
      return "System Performance:\n\n⚡ **Authentication Speed:**\n• Facial verification: <1 second\n• Complete login process: <3 seconds\n• Real-time behavioral analysis\n• Sub-second anomaly detection\n\n **Accuracy Metrics:**\n• Facial recognition accuracy: 99.5%\n• Behavioral pattern matching: 95%\n• False positive rate: <1%\n• System availability: 99.9%\n\n  **Optimization:**\n• Edge function processing\n• Supabase global infrastructure\n• Real-time data synchronization\n• Optimized database queries"
    }
    
    // Integration
    if (this.matchesPattern(lowerMessage, ['integration', 'api', 'webhook', 'real-time', 'supabase api'])) {
      return "Integration Options:\n\n🔌 **Supabase APIs:**\n• REST API for data operations\n• Real-time subscriptions for live updates\n• Authentication API integration\n• Edge Functions for custom logic\n\n  **Real-time Features:**\n• WebSocket connections\n• Live behavioral monitoring\n• Instant anomaly alerts\n• Real-time dashboard updates\n\n🛠️ **Development:**\n• TypeScript SDK available\n• Comprehensive documentation\n• Code examples provided\n• Postman collection available\n\n  **Webhooks:**\n• Authentication events\n• Anomaly detection alerts\n• User registration notifications\n• System status updates"
    }
    
    // Edge Functions
    if (this.matchesPattern(lowerMessage, ['edge functions', 'serverless', 'behavioral analysis', 'functions'])) {
      return "Supabase Edge Functions:\n\n  **behavioral-analysis:**\n• Real-time behavioral pattern analysis\n• Keystroke and mouse behavior processing\n• Anomaly score calculation\n• ML-powered pattern recognition\n\n  **local-chatbot:**\n• This assistant you're talking to\n• System-specific help and guidance\n• No external AI dependencies\n• Fast local processing\n\n⚡ **Benefits:**\n• Serverless architecture\n• Global edge deployment\n• TypeScript/Deno runtime\n• Automatic scaling\n• Low latency processing"
    }
    
    // Greeting patterns
    if (this.matchesPattern(lowerMessage, ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'])) {
      return this.greetingMessage
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