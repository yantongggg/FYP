# eKYC Biometric Authentication System

A comprehensive Supabase-based eKYC biometric authentication system with multimodal biometric capture, real-time behavioral monitoring, and AI-powered anomaly detection.

##   Features

### Core Authentication
- **Facial Recognition**: Advanced face detection and embedding generation
- **Liveness Detection**: Anti-spoofing with color-based liveness checks
- **Keystroke Dynamics**: Typing pattern analysis for behavioral authentication
- **Mouse/Scroll Behavior**: Continuous behavioral monitoring
- **Multi-factor Authentication**: Combining multiple biometric modalities

### Security & Privacy
- **End-to-End Encryption**: AES-256 encryption for biometric data
- **Row Level Security**: Database-level access controls
- **Audit Logging**: Comprehensive authentication and anomaly tracking
- **Real-time Monitoring**: Live anomaly detection and alerting

### AI & Machine Learning
- **Behavioral Analysis**: ML-powered pattern recognition
- **Anomaly Detection**: Real-time suspicious activity detection
- **GPT-powered Chatbot**: AI assistant for user support
- **Continuous Learning**: Adaptive authentication models

## 🛠️ Setup Instructions

### 1. Supabase Project Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and API keys
3. Run the database migration:

```sql
-- Execute the SQL in supabase/migrations/001_initial_schema.sql
-- This creates all necessary tables, RLS policies, and functions
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key


### 3. Deploy Edge Functions

Deploy the Supabase Edge Functions:

```bash
# Deploy behavioral analysis function
supabase functions deploy behavioral-analysis

```

### 4. Install Dependencies

```bash
npm install
```

### 5. Start Development Server

```bash
npm run dev
```

##   Database Schema

### Core Tables

#### `users`
- User account information and authentication data
- Includes trust scoring and account status

#### `biometric_data`
- Encrypted biometric templates and embeddings
- Supports multiple biometric modalities
- Vector embeddings for face recognition

#### `behavioral_sessions`
- Continuous behavioral monitoring data
- Real-time keystroke and mouse tracking

#### `login_audit` & `anomaly_audit`
- Comprehensive audit trails
- Security event logging and monitoring

##   Security Features

### Data Encryption
```typescript
// Client-side encryption using Web Crypto API
const encrypted = await BiometricEncryption.encryptData(biometricData, passphrase)

// Server-side encryption using pgcrypto
SELECT encrypt_biometric_data('sensitive_data', 'passphrase')
```

### Row Level Security
```sql
-- Users can only access their own data
CREATE POLICY "Users can access own biometric data" ON biometric_data
  FOR ALL USING (auth.uid() = user_id);
```

### Behavioral Monitoring
```typescript
// Start continuous monitoring
useBehavioralMonitoring({
  windowSize: 100,
  sendInterval: 30000,
  anomalyThreshold: 0.7
})
```

## 🤖 AI Integration

### Behavioral Analysis
The system uses machine learning to analyze user behavior patterns:

- **Keystroke Dynamics**: Timing patterns, rhythm analysis
- **Mouse Behavior**: Movement patterns, click frequency
- **Scroll Patterns**: Speed, direction, acceleration

### Anomaly Detection
Real-time scoring system that detects:
- Unusual typing patterns
- Abnormal mouse behavior
- Suspicious login attempts
- Device fingerprint changes

### GPT Chatbot
AI-powered support assistant that helps with:
- Authentication troubleshooting
- Security feature explanations
- Account management guidance

##  Monitoring & Analytics

### Real-time Dashboard
- Live user activity monitoring
- Authentication success rates
- Anomaly detection alerts
- System performance metrics

### Audit Trails
- Complete login history
- Security event logging
- Anomaly investigation tools
- Compliance reporting

##   API Reference

### Authentication Endpoints

#### Register User
```typescript
POST /api/register
{
  "email": "user@example.com",
  "password": "secure_password",
  "biometric_data": {
    "face_embedding": [...],
    "keystroke_pattern": {...},
    "mouse_behavior": {...}
  }
}
```

#### Authenticate User
```typescript
POST /api/authenticate
{
  "email": "user@example.com",
  "biometric_data": {
    "face_image": "base64_image",
    "keystroke_sample": {...},
    "behavioral_data": {...}
  }
}
```

### Monitoring Endpoints

#### Get User Metrics
```typescript
GET /api/users/{userId}/metrics
```

#### Get Anomaly Logs
```typescript
GET /api/anomalies?user_id={userId}&limit=100
```

##   Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   # Set production environment variables
   VITE_SUPABASE_URL=your_production_url
   VITE_SUPABASE_ANON_KEY=your_production_key
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Deploy Edge Functions**
   ```bash
   supabase functions deploy --project-ref your_project_ref
   ```

4. **Configure Storage Policies**
   ```sql
   -- Set up storage bucket policies for biometric data
   CREATE POLICY "Users can upload own biometric data"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'biometric-data' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

##   Security Best Practices

1. **Never store raw biometric images** - Only processed templates
2. **Implement proper key rotation** - Regular encryption key updates
3. **Monitor for anomalies** - Real-time threat detection
4. **Regular security audits** - Penetration testing and code reviews
5. **Compliance adherence** - GDPR, CCPA, and biometric privacy laws

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Biometric Authentication Standards](https://fidoalliance.org/)
- [Privacy Regulations Compliance](https://gdpr.eu/)
- [Security Best Practices](https://owasp.org/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

##   License

This project is licensed under the MIT License - see the LICENSE file for details.

##   Disclaimer

This system is designed for educational and demonstration purposes. For production use, ensure compliance with local biometric privacy laws and regulations."# FYP" 
