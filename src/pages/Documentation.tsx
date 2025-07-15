import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Book, 
  Code, 
  Settings, 
  Shield, 
  Users, 
  Database, 
  Globe, 
  Cpu,
  FileText,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

const Documentation = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const sections = {
    overview: {
      title: 'System Overview',
      icon: Book,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Supabase-Based Biometric Authentication Framework</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              This framework provides a comprehensive Supabase-powered solution for securing user authentication through multiple biometric modalities. 
              It combines facial recognition, liveness detection, and behavioral biometrics using Supabase's backend-as-a-service platform 
              with PostgreSQL database, real-time capabilities, and edge functions for serverless processing.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-3">Key Features</h4>
              <ul className="text-gray-300 space-y-2">
                <li>• Supabase-powered authentication</li>
                <li>• Real-time behavioral monitoring</li>
                <li>• PostgreSQL with RLS security</li>
                <li>• Edge functions for ML processing</li>
                <li>• Client-side biometric encryption</li>
                <li>• Comprehensive admin dashboard</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-3">Technology Stack</h4>
              <ul className="text-gray-300 space-y-2">
                <li>• Frontend: React + TypeScript</li>
                <li>• Backend: Supabase Platform</li>
                <li>• Database: PostgreSQL 15</li>
                <li>• Functions: Supabase Edge Functions</li>
                <li>• Auth: Supabase Auth</li>
                <li>• Hosting: Supabase + Vercel</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    implementation: {
      title: 'Implementation Guide',
      icon: Code,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Getting Started</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Follow these steps to set up and deploy the biometric authentication system using Supabase.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="text-xl font-semibold text-white mb-4">1. Supabase Project Setup</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Initial Setup Commands</span>
                  <button
                    onClick={() => handleCopyCode('supabase-setup')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'supabase-setup' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-green-400 overflow-x-auto">
{`# 1. Create new Supabase project at supabase.com
# 2. Install Supabase CLI
npm install -g supabase

# 3. Initialize local project
supabase init

# 4. Link to your Supabase project
supabase login
supabase link --project-ref your-project-ref

# 5. Run database migrations
supabase db reset`}
                </pre>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-white mb-4">2. Environment Configuration</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">.env Configuration</span>
                  <button
                    onClick={() => handleCopyCode('env-config')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'env-config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-purple-400 overflow-x-auto">
{`# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Encryption Configuration
ENCRYPTION_PASSPHRASE=your_strong_encryption_passphrase

# Behavioral Monitoring Configuration
BEHAVIORAL_MONITORING_ENDPOINT=https://your-project.supabase.co/functions/v1/behavioral-analysis
ANOMALY_THRESHOLD=0.7
MONITORING_WINDOW_SIZE=100
MONITORING_SEND_INTERVAL=30000`}
                </pre>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-white mb-4">3. Database Setup</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">SQL - Database Schema</span>
                  <button
                    onClick={() => handleCopyCode('database-setup')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'database-setup' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-purple-400 overflow-x-auto">
{`-- Execute in Supabase SQL Editor
-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    trust_score DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create biometric_profiles table
CREATE TABLE biometric_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    face_embedding BYTEA NOT NULL,
    keystroke_pattern JSONB,
    mouse_pattern JSONB,
    enrollment_quality DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can access own biometric data" ON biometric_profiles
    FOR ALL USING (user_id = auth.uid());`}
                </pre>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-white mb-4">4. Deploy Edge Functions</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Edge Function Deployment</span>
                  <button
                    onClick={() => handleCopyCode('edge-functions')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'edge-functions' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-yellow-400 overflow-x-auto">
{`# Deploy behavioral analysis function
supabase functions deploy behavioral-analysis

# Deploy local chatbot function
supabase functions deploy local-chatbot

# Set environment secrets for functions
supabase secrets set ENCRYPTION_PASSPHRASE=your_passphrase

# Test function deployment
supabase functions invoke behavioral-analysis --data '{"test": true}'`}
                </pre>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-white mb-4">5. Frontend Integration</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">React Integration</span>
                  <button
                    onClick={() => handleCopyCode('frontend-integration')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'frontend-integration' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-cyan-400 overflow-x-auto">
{`// supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Install dependencies
npm install @supabase/supabase-js
npm install

# Start development server
npm run dev`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )
    },
    api: {
      title: 'API Reference',
      icon: Globe,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Supabase API Endpoints</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Complete reference for Supabase REST API, Real-time API, and Edge Functions integration.
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">User Registration</h4>
                <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">POST</span>
              </div>
              <p className="text-gray-300 mb-4">Register new user with biometric enrollment</p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Endpoint</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-green-400">{`POST https://your-project.supabase.co/auth/v1/signup`}</pre>
                  </div>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Request Body</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-blue-400">{`{
  "email": "user@example.com",
  "password": "secure_password",
  "user_metadata": {
    "full_name": "John Doe",
    "username": "johndoe"
  }
}`}</pre>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Biometric Enrollment (Separate Call)</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-purple-400">{`// After user registration, enroll biometrics
POST https://your-project.supabase.co/rest/v1/biometric_profiles

{
  "user_id": "user-uuid",
  "face_embedding": "encrypted_base64_data",
  "keystroke_pattern": {...},
  "mouse_pattern": {...},
  "enrollment_quality": 0.95
}`}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Biometric Authentication</h4>
                <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full">POST</span>
              </div>
              <p className="text-gray-300 mb-4">Authenticate user with biometric verification</p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Endpoint</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-green-400">{`POST https://your-project.supabase.co/auth/v1/token?grant_type=password`}</pre>
                  </div>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Request Body</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-blue-400">{`{
  "email": "user@example.com",
  "password": "user_password"
}

// Then verify biometrics via Edge Function
POST https://your-project.supabase.co/functions/v1/behavioral-analysis

{
  "user_id": "user-uuid",
  "biometric_data": {
    "face_image": "base64_image",
    "keystroke_sample": {...},
    "mouse_behavior": {...}
  },
  "session_id": "current-session-uuid"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Response</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-cyan-400">{`{
  "access_token": "jwt_token",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "user_metadata": {...}
  },
  "biometric_verification": {
    "status": "verified",
    "confidence": 0.92,
    "anomaly_score": 0.15
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Real-time Monitoring</h4>
                <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full">WebSocket</span>
              </div>
              <p className="text-gray-300 mb-4">Real-time behavioral monitoring subscription</p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Real-time Subscription</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-purple-400">{`// Subscribe to behavioral sessions
const subscription = supabase
  .channel('behavioral-monitoring')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'behavioral_sessions',
      filter: \`user_id=eq.\${user.id}\`
    }, 
    (payload) => {
      console.log('New behavioral data:', payload.new)
    }
  )
  .subscribe()

// Subscribe to anomaly alerts
const anomalySubscription = supabase
  .channel('anomaly-alerts')
  .on('postgres_changes',
    {
      event: 'INSERT',
      schema: 'public', 
      table: 'anomaly_audit'
    },
    (payload) => {
      console.log('Anomaly detected:', payload.new)
    }
  )
  .subscribe()`}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Edge Functions</h4>
                <span className="px-3 py-1 bg-orange-600 text-white text-sm rounded-full">Functions</span>
              </div>
              <p className="text-gray-300 mb-4">Serverless functions for ML processing and analysis</p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Behavioral Analysis Function</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-orange-400">{`POST https://your-project.supabase.co/functions/v1/behavioral-analysis

{
  "user_id": "user-uuid",
  "session_data": {
    "keystroke_events": [...],
    "mouse_events": [...],
    "scroll_events": [...]
  },
  "window_size": 100,
  "analysis_type": "real-time"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Local Chatbot Function</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-cyan-400">{`POST https://your-project.supabase.co/functions/v1/local-chatbot

{
  "message": "How do I register for biometric authentication?"
}`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    security: {
      title: 'Security Guidelines',
      icon: Shield,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Supabase Security Best Practices</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Essential security considerations for implementing and maintaining the Supabase-based biometric authentication system.
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-400" />
                Row Level Security (RLS)
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Enable RLS on all tables:</strong> Ensure users can only access their own data through PostgreSQL row-level security policies
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Secure API endpoints:</strong> Use Supabase's automatic RLS enforcement for REST API calls
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Policy testing:</strong> Thoroughly test RLS policies with different user roles and scenarios
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Database className="h-5 w-5 mr-2 text-purple-400" />
                Biometric Data Protection
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Client-side encryption:</strong> Encrypt biometric templates using AES-256 before storing in Supabase
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>No raw biometric storage:</strong> Never store actual facial images or raw biometric data
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Template-only approach:</strong> Store only processed, encrypted biometric templates
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Key management:</strong> Use environment variables for encryption keys, rotate regularly
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-green-400" />
                Authentication Security
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>JWT token security:</strong> Use Supabase's secure JWT implementation with proper expiration
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Session management:</strong> Implement proper session timeout and refresh token rotation
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Multi-factor verification:</strong> Require multiple biometric factors for high-security operations
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Rate limiting:</strong> Use Supabase's built-in rate limiting and implement additional client-side controls
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Cpu className="h-5 w-5 mr-2 text-orange-400" />
                Edge Function Security
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Environment secrets:</strong> Store sensitive keys using Supabase secrets management
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Input validation:</strong> Validate all inputs in Edge Functions before processing
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>CORS configuration:</strong> Properly configure CORS headers for Edge Functions
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Error handling:</strong> Implement secure error handling that doesn't leak sensitive information
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-red-600/10 border border-red-500/50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-red-400 mb-3">⚠️ Critical Security Warnings</h4>
            <ul className="text-gray-300 space-y-2">
              <li>• Never expose Supabase service role key in client-side code</li>
              <li>• Always use HTTPS in production environments</li>
              <li>• Implement proper biometric template irreversibility</li>
              <li>• Regular security audits and dependency updates</li>
              <li>• Comply with biometric privacy regulations (GDPR, CCPA, BIPA)</li>
              <li>• Monitor Supabase auth logs for suspicious activities</li>
              <li>• Use strong encryption passphrases and rotate regularly</li>
            </ul>
          </div>
        </div>
      )
    },
    deployment: {
      title: 'Deployment Guide',
      icon: Settings,
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">Supabase Production Deployment</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Step-by-step guide for deploying the biometric authentication system to production using Supabase platform.
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">Production Environment Setup</h4>
              <div className="space-y-4">
                <div>
                  <h5 className="text-lg font-medium text-purple-400 mb-2">1. Supabase Project Configuration</h5>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-purple-400">
{`# Production Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key

# Security Configuration
ENCRYPTION_PASSPHRASE=your_super_secure_production_passphrase

# Monitoring Configuration
BEHAVIORAL_MONITORING_ENDPOINT=https://your-project.supabase.co/functions/v1/behavioral-analysis
ANOMALY_THRESHOLD=0.7
MONITORING_WINDOW_SIZE=100
MONITORING_SEND_INTERVAL=30000

# Rate Limiting
RATE_LIMIT_WINDOW=900
RATE_LIMIT_MAX_REQUESTS=100`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h5 className="text-lg font-medium text-blue-400 mb-2">2. Database Production Setup</h5>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-blue-400">
{`-- Production database configuration
-- 1. Enable Point-in-Time Recovery (PITR)
-- 2. Configure automated backups
-- 3. Set up read replicas for scaling
-- 4. Enable database logging

-- Production RLS policies
CREATE POLICY "Production user access" ON users
    FOR ALL TO authenticated
    USING (auth.uid() = id OR auth.jwt()->>'role' = 'admin');

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_biometric_profiles_user_id ON biometric_profiles(user_id);
CREATE INDEX idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX idx_anomaly_audit_user_id ON anomaly_audit(user_id);`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h5 className="text-lg font-medium text-green-400 mb-2">3. Edge Functions Deployment</h5>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-green-400">
{`# Deploy all Edge Functions to production
supabase functions deploy behavioral-analysis --project-ref your-project-ref
supabase functions deploy local-chatbot --project-ref your-project-ref

# Set production secrets
supabase secrets set ENCRYPTION_PASSPHRASE=your_production_passphrase --project-ref your-project-ref

# Verify function deployment
supabase functions list --project-ref your-project-ref

# Test functions in production
curl -X POST 'https://your-project.supabase.co/functions/v1/behavioral-analysis' \\
  -H 'Authorization: Bearer your-anon-key' \\
  -H 'Content-Type: application/json' \\
  -d '{"test": true}'`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h5 className="text-lg font-medium text-orange-400 mb-2">4. Frontend Production Build</h5>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-orange-400">
{`# Build for production
npm run build

# Deploy to Vercel (recommended)
npm install -g vercel
vercel --prod

# Or deploy to Netlify
npm install -g netlify-cli
netlify deploy --prod --dir=dist

# Or deploy to Supabase hosting
supabase deploy

# Environment variables for deployment platform:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">Security Hardening</h4>
              <div className="space-y-4">
                <div>
                  <h5 className="text-lg font-medium text-red-400 mb-2">Production Security Checklist</h5>
                  <ul className="text-gray-300 space-y-2">
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Enable Supabase RLS on all tables
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Configure custom SMTP for auth emails
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Set up domain allowlists for auth
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Enable rate limiting on auth endpoints
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Configure JWT expiration times
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Set up database backups and PITR
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Enable audit logging
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3" />
                      ✅ Configure SSL/TLS certificates
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">Monitoring & Maintenance</h4>
              <div className="space-y-4">
                <div>
                  <h5 className="text-lg font-medium text-cyan-400 mb-2">Production Monitoring Setup</h5>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-cyan-400">
{`-- Set up monitoring in Supabase Dashboard
-- 1. Enable real-time monitoring
-- 2. Configure alerting for:
--    - High error rates
--    - Unusual authentication patterns
--    - Database performance issues
--    - Edge function failures

-- Monitor key metrics:
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as login_attempts,
  COUNT(CASE WHEN result = 'success' THEN 1 END) as successful_logins,
  COUNT(CASE WHEN result = 'failed' THEN 1 END) as failed_logins
FROM login_audit 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;

-- Monitor anomaly patterns
SELECT 
  user_id,
  COUNT(*) as anomaly_count,
  MAX(severity) as max_severity
FROM anomaly_audit 
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 5;`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  };

  const handleCopyCode = (codeId: string) => {
    setCopiedCode(codeId);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent mb-4">
            Documentation
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Complete guide for implementing and maintaining the Supabase-based biometric authentication framework
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 sticky top-24">
              <h3 className="text-lg font-semibold text-white mb-4">Contents</h3>
              <nav className="space-y-2">
                {Object.entries(sections).map(([key, section]) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === key
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-400/20'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <section.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{section.title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
            >
              <div className="flex items-center space-x-3 mb-6">
                {React.createElement(sections[activeSection as keyof typeof sections].icon, { 
                  className: "h-8 w-8 text-blue-400" 
                })}
                <h2 className="text-3xl font-bold text-white">
                  {sections[activeSection as keyof typeof sections].title}
                </h2>
              </div>
              {sections[activeSection as keyof typeof sections].content}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;