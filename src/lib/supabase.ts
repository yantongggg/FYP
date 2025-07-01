import { createClient } from '@supabase/supabase-js'

// Supabase configuration with fallback handling
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if environment variables are properly configured
const isValidUrl = supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co' && supabaseUrl.startsWith('https://')
const isValidKey = supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key' && supabaseAnonKey.length > 20

if (!isValidUrl || !isValidKey) {
  console.warn('⚠️ Supabase not configured properly. Using mock mode.')
  console.warn('To fix this:')
  console.warn('1. Create a Supabase project at https://supabase.com')
  console.warn('2. Get your project URL and anon key from the API settings')
  console.warn('3. Update the .env file with your actual credentials')
}

// Mock Query Builder class for chainable methods
class MockQueryBuilder {
  private tableName: string;
  private selectFields: string = '*';
  private filters: any[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private isSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then(resolve: (result: any) => void, reject?: (error: any) => void) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (error) {
      if (reject) reject(error);
    }
  }

  private async execute() {
    // Return mock data based on table name
    const mockData = this.getMockData();
    
    if (this.isSingle) {
      return { 
        data: mockData.length > 0 ? mockData[0] : null, 
        error: mockData.length === 0 ? { message: 'No data found' } : null 
      };
    }

    return { data: mockData, error: null };
  }

  private getMockData() {
    switch (this.tableName) {
      case 'users':
        return [
          {
            id: 'mock-user-1',
            username: 'demo_user',
            email: 'demo@example.com',
            role: 'user',
            status: 'active',
            is_biometric_enrolled: true,
            trust_score: 85,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          },
          {
            id: 'mock-admin-1',
            username: 'admin_user',
            email: 'admin@example.com',
            role: 'admin',
            status: 'active',
            is_biometric_enrolled: true,
            trust_score: 95,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
        ];
      
      case 'ekyc_documents':
        return [
          {
            id: 'mock-doc-1',
            user_id: 'mock-user-1',
            document_type: 'passport',
            verification_status: 'verified',
            verification_score: 0.95,
            extracted_info: { name: 'Demo User', document_number: 'P123456789' },
            created_at: new Date().toISOString(),
            verified_at: new Date().toISOString()
          }
        ];
      
      case 'anomaly_audit':
        return [
          {
            id: 'mock-anomaly-1',
            user_id: 'mock-user-1',
            anomaly_type: 'unusual_login_time',
            score: 0.7,
            action: 'flagged',
            details: { login_time: '03:00 AM', usual_time: '09:00 AM' },
            event_ts: new Date().toISOString(),
            resolved: false
          }
        ];
      
      case 'admin_audit_log':
        return [
          {
            id: 'mock-action-1',
            admin_id: 'mock-admin-1',
            target_user_id: 'mock-user-1',
            action_type: 'view_user',
            description: 'Viewed user details',
            timestamp: new Date().toISOString()
          }
        ];
      
      case 'login_audit':
        return [
          {
            id: 'mock-login-1',
            user_id: 'mock-user-1',
            event_ts: new Date().toISOString(),
            success: true,
            ip_addr: '192.168.1.1',
            user_agent: 'Mozilla/5.0...',
            biometric_scores: { face: 0.95, keystroke: 0.87 },
            session_duration: '01:30:00'
          }
        ];
      
      case 'reverify_requests':
        return [];
      
      default:
        return [];
    }
  }
}

// Mock Channel class for real-time subscriptions
class MockChannel {
  private channelName: string;
  private listeners: any[] = [];

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(event: string, config: any, callback: (payload: any) => void) {
    this.listeners.push({ event, config, callback });
    return this;
  }

  subscribe() {
    console.log(`Mock subscription created for channel: ${this.channelName}`);
    return {
      unsubscribe: () => {
        console.log(`Mock subscription unsubscribed for channel: ${this.channelName}`);
      }
    };
  }
}

// Create a mock client for development when Supabase is not configured
const createMockClient = () => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  functions: {
    invoke: () => Promise.resolve({ 
      data: { 
        response: 'Supabase is not configured. Please set up your Supabase project to enable the chatbot functionality.' 
      }, 
      error: null 
    })
  },
  from: (tableName: string) => new MockQueryBuilder(tableName),
  channel: (channelName: string) => new MockChannel(channelName)
})

// Create Supabase client or mock client
export const supabase = (isValidUrl && isValidKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: 'Bearer ' + supabaseAnonKey },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : createMockClient()

// Database types
export interface User {
  id: string
  username: string
  email: string
  password_hash: string
  created_at: string
  role: 'user' | 'admin'
  is_biometric_enrolled: boolean
  last_login?: string
  trust_score: number
  status: 'active' | 'suspended' | 'pending'
}

export interface BiometricData {
  id: string
  user_id: string
  biometric_type: 'face' | 'keystroke' | 'mouse' | 'scroll' | 'liveness'
  capture_timestamp: string
  data: any
  session_id?: string
  face_embedding?: number[]
  encrypted_biometric_blob?: Uint8Array
  quality_score?: number
  device_info?: any
  ip_address?: string
}

export interface LoginAudit {
  id: string
  user_id?: string
  event_ts: string
  success: boolean
  ip_addr?: string
  user_agent?: string
  biometric_scores?: any
  failure_reason?: string
  session_duration?: string
  geolocation?: any
}

export interface AnomalyAudit {
  id: string
  user_id?: string
  event_ts: string
  anomaly_type: string
  score: number
  action: string
  details?: any
  resolved: boolean
  resolved_at?: string
  resolved_by?: string
}

// CRUD Operations
export class SupabaseCRUD {
  // Users CRUD
  static async createUser(userData: Partial<User>) {
    return this.makeRequest(async () => {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  }

  static async getUser(userId: string) {
    return this.makeRequest(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      return data
    })
  }

  static async updateUser(userId: string, updates: Partial<User>) {
    return this.makeRequest(async () => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  }

  static async deleteUser(userId: string) {
    return this.makeRequest(async () => {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
      
      if (error) throw error
      return true
    })
  }

  static async getAllUsers() {
    return this.makeRequest(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    })
  }

  // Biometric Data CRUD
  static async storeBiometricData(biometricData: Partial<BiometricData>) {
    return this.makeRequest(async () => {
      const { data, error } = await supabase
        .from('biometric_data')
        .insert(biometricData)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  }

  static async getBiometricData(userId: string, type?: string) {
    return this.makeRequest(async () => {
      let query = supabase
        .from('biometric_data')
        .select('*')
        .eq('user_id', userId)
      
      if (type) {
        query = query.eq('biometric_type', type)
      }
      
      const { data, error } = await query.order('capture_timestamp', { ascending: false })
      
      if (error) throw error
      return data
    })
  }

  // Login Audit CRUD
  static async logLoginAttempt(auditData: Partial<LoginAudit>) {
    return this.makeRequest(async () => {
      const { data, error } = await supabase
        .from('login_audit')
        .insert(auditData)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  }

  static async getLoginLogs(userId?: string, limit = 100) {
    return this.makeRequest(async () => {
      let query = supabase
        .from('login_audit')
        .select('*')
      
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query
        .order('event_ts', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data
    })
  }

  // Anomaly Audit CRUD
  static async logAnomaly(anomalyData: Partial<AnomalyAudit>) {
    return this.makeRequest(async () => {
      const { data, error } = await supabase
        .from('anomaly_audit')
        .insert(anomalyData)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  }

  static async getAnomalies(userId?: string, limit = 100) {
    return this.makeRequest(async () => {
      let query = supabase
        .from('anomaly_audit')
        .select('*')
      
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query
        .order('event_ts', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data
    })
  }

  // Helper method for error handling
  private static async makeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      return await requestFn()
    } catch (error) {
      console.error('Supabase request error:', error)
      throw error
    }
  }
}

// Encryption utilities using Web Crypto API
export class BiometricEncryption {
  private static async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  static async encryptData(data: string, passphrase: string): Promise<{ encrypted: ArrayBuffer, salt: Uint8Array, iv: Uint8Array }> {
    const encoder = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    const key = await this.deriveKey(passphrase, salt)
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(data)
    )
    
    return { encrypted, salt, iv }
  }

  static async decryptData(encrypted: ArrayBuffer, salt: Uint8Array, iv: Uint8Array, passphrase: string): Promise<string> {
    const key = await this.deriveKey(passphrase, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    )
    
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  }
}

// Behavioral monitoring utilities
export class BehavioralMonitoring {
  private static keystrokeBuffer: any[] = []
  private static mouseBuffer: any[] = []
  private static scrollBuffer: any[] = []
  private static sendInterval: number = 30000 // 30 seconds
  private static windowSize: number = 100 // events
  
  static startMonitoring(config: {
    windowSize?: number
    sendInterval?: number
    apiEndpoint?: string
    anomalyThreshold?: number
  } = {}) {
    this.windowSize = config.windowSize || 100
    this.sendInterval = config.sendInterval || 30000
    
    // Keystroke monitoring
    document.addEventListener('keydown', (e) => {
      this.keystrokeBuffer.push({
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keydown'
      })
      this.trimBuffer(this.keystrokeBuffer)
    })
    
    document.addEventListener('keyup', (e) => {
      this.keystrokeBuffer.push({
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keyup'
      })
      this.trimBuffer(this.keystrokeBuffer)
    })
    
    // Mouse monitoring
    document.addEventListener('mousemove', (e) => {
      this.mouseBuffer.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        type: 'mousemove'
      })
      this.trimBuffer(this.mouseBuffer)
    })
    
    document.addEventListener('click', (e) => {
      this.mouseBuffer.push({
        x: e.clientX,
        y: e.clientY,
        button: e.button,
        timestamp: Date.now(),
        type: 'click'
      })
      this.trimBuffer(this.mouseBuffer)
    })
    
    // Scroll monitoring
    document.addEventListener('wheel', (e) => {
      this.scrollBuffer.push({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        timestamp: Date.now(),
        type: 'scroll'
      })
      this.trimBuffer(this.scrollBuffer)
    })
    
    // Send data periodically
    setInterval(() => {
      this.sendBehavioralData(config.apiEndpoint)
    }, this.sendInterval)
  }
  
  private static trimBuffer(buffer: any[]) {
    if (buffer.length > this.windowSize) {
      buffer.splice(0, buffer.length - this.windowSize)
    }
  }
  
  private static async sendBehavioralData(apiEndpoint?: string) {
    if (!apiEndpoint) return
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const behavioralData = {
      user_id: user.id,
      keystroke_events: [...this.keystrokeBuffer],
      mouse_events: [...this.mouseBuffer],
      scroll_events: [...this.scrollBuffer],
      timestamp: Date.now()
    }
    
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(behavioralData)
      })
      
      if (!response.ok) {
        console.error('Failed to send behavioral data:', response.statusText)
      }
    } catch (error) {
      console.error('Error sending behavioral data:', error)
    }
  }
  
  static getBehavioralSnapshot() {
    return {
      keystroke_events: [...this.keystrokeBuffer],
      mouse_events: [...this.mouseBuffer],
      scroll_events: [...this.scrollBuffer],
      timestamp: Date.now()
    }
  }
}

// Example usage functions
export const examples = {
  // Fetch all users (admin only)
  async fetchAllUsers() {
    try {
      const users = await SupabaseCRUD.getAllUsers()
      console.log('All users:', users)
      return users
    } catch (error) {
      console.error('Error fetching users:', error)
      throw error
    }
  },

  // Store face biometric data
  async storeFaceBiometric(userId: string, faceData: any, embedding: number[]) {
    try {
      const biometricData = await SupabaseCRUD.storeBiometricData({
        user_id: userId,
        biometric_type: 'face',
        data: faceData,
        face_embedding: embedding,
        quality_score: 0.95,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        }
      })
      console.log('Face biometric stored:', biometricData)
      return biometricData
    } catch (error) {
      console.error('Error storing face biometric:', error)
      throw error
    }
  },

  // Log successful login
  async logSuccessfulLogin(userId: string, biometricScores: any) {
    try {
      const loginLog = await SupabaseCRUD.logLoginAttempt({
        user_id: userId,
        success: true,
        ip_addr: await this.getClientIP(),
        user_agent: navigator.userAgent,
        biometric_scores: biometricScores
      })
      console.log('Login logged:', loginLog)
      return loginLog
    } catch (error) {
      console.error('Error logging login:', error)
      throw error
    }
  },

  // Get client IP (simplified)
  async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
  }
}