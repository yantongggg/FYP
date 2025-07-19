/*
  # eKYC Biometric Authentication Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `email` (text, unique)
      - `password_hash` (text)
      - `created_at` (timestamp)
      - `role` (text, default 'user')
      - `is_face_enrolled` (boolean, default false)
    
    - `biometric_data`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `biometric_type` (text)
      - `capture_timestamp` (timestamp)
      - `data` (jsonb)
      - `session_id` (uuid)
      - `face_embedding` (vector)
      - `encrypted_biometric_blob` (bytea)
    
    - `ml_models`
      - `id` (uuid, primary key)
      - `model_name` (text)
      - `version` (text)
      - `training_date` (timestamp)
      - `accuracy` (numeric)
      - `model_path` (text)
      - `biometric_types_used` (text array)

  2. Security
    - Enable RLS on all tables
    - Add policies for secure access
    - Create audit tables for monitoring

  3. Extensions
    - Enable pgcrypto for encryption
    - Enable vector extension for face embeddings
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table: Core user information and authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_face_enrolled boolean DEFAULT false,
  last_login timestamptz,
  trust_score decimal(5,2) DEFAULT 100.00,
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending'))
);

-- Biometric data table: Stores all biometric information
CREATE TABLE IF NOT EXISTS biometric_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  biometric_type text NOT NULL CHECK (biometric_type IN ('face', 'keystroke', 'mouse', 'scroll', 'liveness')),
  capture_timestamp timestamptz DEFAULT now(),
  data jsonb NOT NULL,
  session_id uuid,
  face_embedding vector(512), -- 512-dimensional face embedding vector
  encrypted_biometric_blob bytea, -- Encrypted raw biometric data
  quality_score decimal(5,2), -- Quality assessment of the biometric sample
  device_info jsonb, -- Device information during capture
  ip_address inet -- IP address during capture
);

-- ML Models table: Tracks machine learning models and versions
CREATE TABLE IF NOT EXISTS ml_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  version text NOT NULL,
  training_date timestamptz NOT NULL,
  accuracy numeric(5,4), -- Model accuracy percentage (0.0000 to 1.0000)
  model_path text, -- Path to model file in storage
  biometric_types_used text[] NOT NULL, -- Array of biometric types this model handles
  is_active boolean DEFAULT false, -- Whether this model is currently in use
  performance_metrics jsonb, -- Additional performance metrics
  created_at timestamptz DEFAULT now()
);

-- Login audit table: Track all authentication attempts
CREATE TABLE IF NOT EXISTS login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_ts timestamptz DEFAULT now(),
  success boolean NOT NULL,
  ip_addr inet,
  user_agent text,
  biometric_scores jsonb, -- Scores from different biometric modalities
  failure_reason text, -- Reason for failure if success = false
  session_duration interval, -- How long the session lasted
  geolocation jsonb -- Geographic location if available
);

-- Anomaly audit table: Track suspicious activities and anomalies
CREATE TABLE IF NOT EXISTS anomaly_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_ts timestamptz DEFAULT now(),
  anomaly_type text NOT NULL, -- Type of anomaly detected
  score numeric(5,4) NOT NULL, -- Anomaly score (0.0000 to 1.0000)
  action text NOT NULL, -- Action taken (alert, block, monitor)
  details jsonb, -- Additional details about the anomaly
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Behavioral sessions table: Track continuous behavioral monitoring
CREATE TABLE IF NOT EXISTS behavioral_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_start timestamptz DEFAULT now(),
  session_end timestamptz,
  keystroke_events jsonb, -- Keystroke timing data
  mouse_events jsonb, -- Mouse movement and click data
  scroll_events jsonb, -- Scroll behavior data
  anomaly_score decimal(5,2) DEFAULT 0.00,
  device_fingerprint text, -- Device identification
  is_active boolean DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for biometric_data table
CREATE POLICY "Users can access own biometric data" ON biometric_data
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all biometric data" ON biometric_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for ml_models table
CREATE POLICY "Authenticated users can read active models" ON ml_models
  FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "Admins can manage models" ON ml_models
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for audit tables
CREATE POLICY "Users can read own audit logs" ON login_audit
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all audit logs" ON login_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can read own anomaly logs" ON anomaly_audit
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage anomaly logs" ON anomaly_audit
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for behavioral sessions
CREATE POLICY "Users can access own behavioral sessions" ON behavioral_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_biometric_data_user_id ON biometric_data(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_data_type ON biometric_data(biometric_type);
CREATE INDEX IF NOT EXISTS idx_biometric_data_timestamp ON biometric_data(capture_timestamp);
CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_timestamp ON login_audit(event_ts);
CREATE INDEX IF NOT EXISTS idx_anomaly_audit_user_id ON anomaly_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_audit_timestamp ON anomaly_audit(event_ts);
CREATE INDEX IF NOT EXISTS idx_behavioral_sessions_user_id ON behavioral_sessions(user_id);

-- Functions for encryption/decryption
CREATE OR REPLACE FUNCTION encrypt_biometric_data(data_text text, passphrase text)
RETURNS bytea AS $$
BEGIN
  RETURN pgp_sym_encrypt(data_text, passphrase);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_biometric_data(encrypted_data bytea, passphrase text)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, passphrase);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate user trust score
CREATE OR REPLACE FUNCTION calculate_trust_score(user_uuid uuid)
RETURNS decimal AS $$
DECLARE
  base_score decimal := 100.00;
  failed_logins integer;
  anomaly_count integer;
  days_since_registration integer;
BEGIN
  -- Count failed logins in last 30 days
  SELECT COUNT(*) INTO failed_logins
  FROM login_audit
  WHERE user_id = user_uuid 
    AND success = false 
    AND event_ts > now() - interval '30 days';
  
  -- Count anomalies in last 30 days
  SELECT COUNT(*) INTO anomaly_count
  FROM anomaly_audit
  WHERE user_id = user_uuid 
    AND event_ts > now() - interval '30 days';
  
  -- Get days since registration
  SELECT EXTRACT(days FROM now() - created_at) INTO days_since_registration
  FROM users WHERE id = user_uuid;
  
  -- Calculate adjusted score
  base_score := base_score - (failed_logins * 5) - (anomaly_count * 10);
  
  -- Bonus for long-term users
  IF days_since_registration > 365 THEN
    base_score := base_score + 5;
  END IF;
  
  -- Ensure score is between 0 and 100
  RETURN GREATEST(0, LEAST(100, base_score));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update trust score
CREATE OR REPLACE FUNCTION update_user_trust_score()
RETURNS trigger AS $$
BEGIN
  UPDATE users 
  SET trust_score = calculate_trust_score(NEW.user_id)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trust_score_login
  AFTER INSERT ON login_audit
  FOR EACH ROW
  EXECUTE FUNCTION update_user_trust_score();

CREATE TRIGGER trigger_update_trust_score_anomaly
  AFTER INSERT ON anomaly_audit
  FOR EACH ROW
  EXECUTE FUNCTION update_user_trust_score();