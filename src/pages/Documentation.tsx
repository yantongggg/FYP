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
            <h3 className="text-2xl font-bold text-white mb-4">Multimodal Biometric Authentication Framework</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              This framework provides a comprehensive solution for securing user authentication through multiple biometric modalities. 
              It combines facial recognition, liveness detection, and behavioral biometrics to create a robust authentication system 
              that can be integrated into existing applications.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-3">Key Features</h4>
              <ul className="text-gray-300 space-y-2">
                <li>• Multi-factor biometric authentication</li>
                <li>• Real-time anomaly detection</li>
                <li>• Behavioral pattern analysis</li>
                <li>• Encrypted biometric storage</li>
                <li>• RESTful API integration</li>
                <li>• Admin monitoring dashboard</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-3">Use Cases</h4>
              <ul className="text-gray-300 space-y-2">
                <li>• Financial services eKYC</li>
                <li>• Healthcare patient verification</li>
                <li>• Government identity services</li>
                <li>• Corporate access control</li>
                <li>• Remote work authentication</li>
                <li>• Mobile app security</li>
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
              Follow these steps to integrate the biometric authentication framework into your application.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <h4 className="text-xl font-semibold text-white mb-4">1. Frontend Integration</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">JavaScript - Facial Recognition Setup</span>
                  <button
                    onClick={() => handleCopyCode('face-recognition')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'face-recognition' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-green-400 overflow-x-auto">
{`// Initialize facial recognition
const faceRecognition = new BiometricAuth({
  apiKey: 'your-api-key',
  endpoint: 'https://api.biometricauth.com',
  features: ['face', 'liveness', 'behavior']
});

// Capture face for registration
const registerFace = async () => {
  try {
    const result = await faceRecognition.captureFace({
      quality: 'high',
      livenessCheck: true
    });
    
    // Send to backend for enrollment
    await enrollUser(result.faceData);
  } catch (error) {
    console.error('Face capture failed:', error);
  }
};`}
                </pre>
              </div>
            </div>

            <div>
              <h4 className="text-xl font-semibold text-white mb-4">2. Backend Integration</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Python - Authentication Processing</span>
                  <button
                    onClick={() => handleCopyCode('backend-auth')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'backend-auth' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-blue-400 overflow-x-auto">
{`from biometric_auth import BiometricProcessor
import cv2
import numpy as np

class AuthenticationService:
    def __init__(self):
        self.processor = BiometricProcessor()
        
    async def authenticate_user(self, user_data):
        # Process facial recognition
        face_result = await self.processor.verify_face(
            user_data['face_image'],
            user_data['stored_template']
        )
        
        # Check liveness
        liveness_result = await self.processor.check_liveness(
            user_data['face_sequence']
        )
        
        # Analyze behavioral patterns
        behavior_result = await self.processor.analyze_behavior(
            user_data['keystroke_data'],
            user_data['mouse_data']
        )
        
        # Calculate combined score
        combined_score = self.calculate_combined_score(
            face_result, liveness_result, behavior_result
        )
        
        return {
            'authenticated': combined_score > 0.85,
            'confidence': combined_score,
            'factors': {
                'face': face_result.confidence,
                'liveness': liveness_result.score,
                'behavior': behavior_result.match_score
            }
        }`}
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
{`-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    trust_score DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create biometric profiles table
CREATE TABLE biometric_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    face_embedding BYTEA NOT NULL,
    keystroke_pattern JSONB,
    mouse_pattern JSONB,
    enrollment_quality DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable row level security
ALTER TABLE biometric_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for secure access
CREATE POLICY "Users can only access own biometric data"
    ON biometric_profiles
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());`}
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
            <h3 className="text-2xl font-bold text-white mb-4">API Endpoints</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Complete reference for all available API endpoints and their usage.
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">POST /api/register</h4>
                <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">POST</span>
              </div>
              <p className="text-gray-300 mb-4">Register a new user with biometric data</p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Request Body</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-green-400">{`{
  "email": "user@example.com",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "biometricData": {
    "faceImage": "base64_encoded_image",
    "keystrokePattern": [...],
    "mousePattern": [...]
  }
}`}</pre>
                  </div>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Response</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-blue-400">{`{
  "success": true,
  "userId": "uuid-string",
  "message": "User registered successfully",
  "enrollmentQuality": 0.95
}`}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">POST /api/authenticate</h4>
                <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full">POST</span>
              </div>
              <p className="text-gray-300 mb-4">Authenticate user with biometric verification</p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Request Body</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-green-400">{`{
  "email": "user@example.com",
  "biometricData": {
    "faceImage": "base64_encoded_image",
    "livenessSequence": [...],
    "keystrokeData": [...],
    "mouseData": [...]
  },
  "deviceInfo": {
    "userAgent": "browser_info",
    "ipAddress": "192.168.1.1"
  }
}`}</pre>
                  </div>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Response</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-blue-400">{`{
  "authenticated": true,
  "sessionId": "session-uuid",
  "confidence": 0.92,
  "factors": {
    "face": 0.95,
    "liveness": 0.88,
    "keystroke": 0.91,
    "mouse": 0.89
  },
  "riskLevel": "low"
}`}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">GET /api/logs</h4>
                <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full">GET</span>
              </div>
              <p className="text-gray-300 mb-4">Retrieve authentication logs and anomalies</p>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Query Parameters</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-green-400">{`?userId=uuid&timeRange=24h&severity=high&limit=100`}</pre>
                  </div>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-blue-400 mb-2">Response</h5>
                  <div className="bg-gray-900 rounded p-3 text-sm">
                    <pre className="text-blue-400">{`{
  "logs": [
    {
      "id": "log-uuid",
      "userId": "user-uuid",
      "timestamp": "2024-01-15T14:30:00Z",
      "result": "success",
      "confidence": 0.92,
      "anomalies": []
    }
  ],
  "totalCount": 1,
  "hasMore": false
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
            <h3 className="text-2xl font-bold text-white mb-4">Security Best Practices</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Essential security considerations for implementing and maintaining the biometric authentication system.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-400" />
                Data Protection
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Encryption at Rest:</strong> All biometric templates are encrypted using AES-256 before storage
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Encryption in Transit:</strong> TLS 1.3 for all API communications
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Key Management:</strong> Regular key rotation and secure key storage
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Data Minimization:</strong> Store only necessary biometric features, not raw images
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-green-400" />
                Access Control
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>RBAC Implementation:</strong> Role-based access control for all system components
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Principle of Least Privilege:</strong> Users and services have minimal required permissions
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Session Management:</strong> Secure session handling with timeout policies
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Audit Logging:</strong> Comprehensive logging of all access attempts
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Database className="h-5 w-5 mr-2 text-purple-400" />
                Database Security
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Row Level Security:</strong> Database-level access controls for sensitive data
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Connection Security:</strong> Encrypted database connections with certificate validation
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Backup Encryption:</strong> All database backups are encrypted
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Regular Updates:</strong> Keep database software updated with security patches
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Cpu className="h-5 w-5 mr-2 text-orange-400" />
                System Hardening
              </h4>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Rate Limiting:</strong> Implement rate limiting to prevent brute force attacks
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Input Validation:</strong> Strict validation of all input data
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Error Handling:</strong> Secure error messages that don't leak sensitive information
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <strong>Monitoring:</strong> Real-time security monitoring and alerting
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-red-600/10 border border-red-500/50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-red-400 mb-3">⚠️ Critical Security Warnings</h4>
            <ul className="text-gray-300 space-y-2">
              <li>• Never store raw biometric images - only processed templates</li>
              <li>• Implement proper key management and rotation policies</li>
              <li>• Regular security audits and penetration testing</li>
              <li>• Comply with relevant privacy regulations (GDPR, CCPA, etc.)</li>
              <li>• Implement proper incident response procedures</li>
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
            <h3 className="text-2xl font-bold text-white mb-4">Production Deployment</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Step-by-step guide for deploying the biometric authentication system in production environments.
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">Infrastructure Requirements</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-lg font-medium text-blue-400 mb-3">Minimum Requirements</h5>
                  <ul className="text-gray-300 space-y-2">
                    <li>• CPU: 4 cores, 2.5GHz</li>
                    <li>• RAM: 16GB</li>
                    <li>• Storage: 500GB SSD</li>
                    <li>• Network: 1Gbps</li>
                    <li>• GPU: Optional (for ML acceleration)</li>
                  </ul>
                </div>
                <div>
                  <h5 className="text-lg font-medium text-green-400 mb-3">Recommended (Production)</h5>
                  <ul className="text-gray-300 space-y-2">
                    <li>• CPU: 8+ cores, 3.0GHz</li>
                    <li>• RAM: 32GB+</li>
                    <li>• Storage: 1TB+ NVMe SSD</li>
                    <li>• Network: 10Gbps</li>
                    <li>• GPU: NVIDIA Tesla/RTX series</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">Docker Deployment</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">docker-compose.yml</span>
                  <button
                    onClick={() => handleCopyCode('docker-compose')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'docker-compose' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-blue-400 overflow-x-auto">
{`version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:5000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/biometric_auth
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-secret-key
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=biometric_auth
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:`}
                </pre>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">Kubernetes Deployment</h4>
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">deployment.yaml</span>
                  <button
                    onClick={() => handleCopyCode('k8s-deployment')}
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === 'k8s-deployment' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <pre className="text-sm text-green-400 overflow-x-auto">
{`apiVersion: apps/v1
kind: Deployment
metadata:
  name: biometric-auth-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: biometric-auth-backend
  template:
    metadata:
      labels:
        app: biometric-auth-backend
    spec:
      containers:
      - name: backend
        image: biometric-auth:latest
        ports:
        - containerPort: 5000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
---
apiVersion: v1
kind: Service
metadata:
  name: biometric-auth-service
spec:
  selector:
    app: biometric-auth-backend
  ports:
  - port: 80
    targetPort: 5000
  type: LoadBalancer`}
                </pre>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">Environment Configuration</h4>
              <div className="space-y-4">
                <div>
                  <h5 className="text-lg font-medium text-purple-400 mb-2">Production Environment Variables</h5>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <pre className="text-sm text-purple-400">
{`# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/biometric_auth
REDIS_URL=redis://redis-host:6379

# Security
JWT_SECRET=your-super-secure-jwt-secret
ENCRYPTION_KEY=your-aes-256-encryption-key
API_KEY_SECRET=your-api-key-secret

# Biometric Processing
FACE_RECOGNITION_MODEL=deepface
LIVENESS_DETECTION_MODEL=custom
BEHAVIOR_ANALYSIS_MODEL=ml_model_v2

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
SENTRY_DSN=your-sentry-dsn

# Rate Limiting
RATE_LIMIT_WINDOW=900
RATE_LIMIT_MAX_REQUESTS=100`}
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
            Complete guide for implementing and maintaining the biometric authentication framework
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
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <section.icon className="h-5 w-5" />
                    <span>{section.title}</span>
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
              {sections[activeSection as keyof typeof sections].content}
            </motion.div>
          </div>
        </div>

        {/* Additional Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Additional Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <FileText className="h-10 w-10 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Technical Papers</h3>
              <p className="text-gray-400 text-sm mb-4">
                Research papers and technical documentation on biometric authentication methods.
              </p>
              <a href="#" className="text-blue-400 hover:text-blue-300 text-sm flex items-center">
                View Papers <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Code className="h-10 w-10 text-green-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Code Examples</h3>
              <p className="text-gray-400 text-sm mb-4">
                Complete code examples and integration samples for various platforms.
              </p>
              <a href="#" className="text-green-400 hover:text-green-300 text-sm flex items-center">
                Browse Examples <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Users className="h-10 w-10 text-purple-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Community Support</h3>
              <p className="text-gray-400 text-sm mb-4">
                Join our community for support, discussions, and feature requests.
              </p>
              <a href="#" className="text-purple-400 hover:text-purple-300 text-sm flex items-center">
                Join Community <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Documentation;