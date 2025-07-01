/*
  # eKYC Documents Table Migration

  1. New Tables
    - `ekyc_documents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `document_type` (text with constraints)
      - `id_document_url` (text, URL to ID document)
      - `selfie_url` (text, URL to selfie)
      - `extracted_info` (jsonb, OCR data)
      - `verification_status` (text with constraints)
      - `verification_score` (decimal)
      - `face_match_score` (decimal)
      - `document_authenticity_score` (decimal)
      - `created_at` (timestamptz)
      - `verified_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `notes` (text)

  2. Security
    - Enable RLS on `ekyc_documents` table
    - Add policies for users to access own documents
    - Add policies for admins to read all documents

  3. Performance
    - Add indexes for user_id, status, and created_at

  4. Triggers
    - Auto-update verification timestamp when status changes to verified
*/

-- Create eKYC documents table
CREATE TABLE IF NOT EXISTS ekyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  id_document_url text,
  selfie_url text,
  extracted_info jsonb,
  verification_status text DEFAULT 'pending',
  verification_score decimal(5,2),
  face_match_score decimal(5,2),
  document_authenticity_score decimal(5,2),
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  expires_at timestamptz,
  notes text
);

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ekyc_documents_user_id_fkey'
  ) THEN
    ALTER TABLE ekyc_documents 
    ADD CONSTRAINT ekyc_documents_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'ekyc_documents_document_type_check'
  ) THEN
    ALTER TABLE ekyc_documents 
    ADD CONSTRAINT ekyc_documents_document_type_check 
    CHECK (document_type IN ('passport', 'id_card', 'drivers_license', 'other'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'ekyc_documents_verification_status_check'
  ) THEN
    ALTER TABLE ekyc_documents 
    ADD CONSTRAINT ekyc_documents_verification_status_check 
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired'));
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE ekyc_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access own eKYC documents" ON ekyc_documents;
DROP POLICY IF EXISTS "Admins can read all eKYC documents" ON ekyc_documents;

-- RLS Policies for ekyc_documents table
CREATE POLICY "Users can access own eKYC documents" ON ekyc_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all eKYC documents" ON ekyc_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ekyc_documents_user_id ON ekyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_ekyc_documents_status ON ekyc_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_ekyc_documents_created_at ON ekyc_documents(created_at);

-- Function to update verification timestamp
CREATE OR REPLACE FUNCTION update_ekyc_verification_timestamp()
RETURNS trigger AS $$
BEGIN
  -- Check if verification_status column exists and is being updated to 'verified'
  IF TG_OP = 'UPDATE' AND 
     NEW.verification_status = 'verified' AND 
     (OLD.verification_status IS NULL OR OLD.verification_status != 'verified') THEN
    NEW.verified_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_ekyc_verification_timestamp ON ekyc_documents;

-- Trigger to automatically update verification timestamp
CREATE TRIGGER trigger_update_ekyc_verification_timestamp
  BEFORE UPDATE ON ekyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_ekyc_verification_timestamp();

-- Storage bucket policies (these would be set up in Supabase dashboard)
-- Bucket: ekyc-documents
-- Policy: Users can upload/view their own documents
-- Policy: Admins can view all documents

-- Example storage policies (to be applied in Supabase dashboard):
/*
-- Policy for uploading eKYC documents
CREATE POLICY "Users can upload own eKYC documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ekyc-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for viewing eKYC documents
CREATE POLICY "Users can view own eKYC documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ekyc-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for admins to view all eKYC documents
CREATE POLICY "Admins can view all eKYC documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ekyc-documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
*/