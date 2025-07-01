/*
  # Add Admin Audit Log and Reverify Requests Tables

  1. New Tables
    - `admin_audit_log`
      - `id` (uuid, primary key)
      - `admin_id` (uuid, foreign key to users)
      - `target_user_id` (uuid, foreign key to users)
      - `action_type` (text)
      - `description` (text)
      - `ip_address` (inet)
      - `user_agent` (text)
      - `timestamp` (timestamp)
    
    - `reverify_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `admin_id` (uuid, foreign key to users)
      - `verification_type` (text)
      - `reason` (text)
      - `status` (text)
      - `requested_at` (timestamp)
      - `completed_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for secure access
*/

-- Create admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  description text,
  ip_address inet,
  user_agent text,
  timestamp timestamptz DEFAULT now()
);

-- Create reverify requests table
CREATE TABLE IF NOT EXISTS reverify_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  verification_type text NOT NULL CHECK (verification_type IN ('face', 'ekyc', 'behavior', 'all')),
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverify_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_audit_log
CREATE POLICY "Admins can read all audit logs" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert audit logs" ON admin_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for reverify_requests
CREATE POLICY "Admins can manage reverify requests" ON reverify_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view their own reverify requests" ON reverify_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_timestamp ON admin_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_reverify_requests_user_id ON reverify_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_reverify_requests_status ON reverify_requests(status);

-- Function to update completion timestamp
CREATE OR REPLACE FUNCTION update_reverify_completion_timestamp()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update completion timestamp
CREATE TRIGGER trigger_update_reverify_completion_timestamp
  BEFORE UPDATE ON reverify_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_reverify_completion_timestamp();