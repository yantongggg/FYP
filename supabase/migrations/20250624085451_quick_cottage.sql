/*
  # eKYC Documents Table Migration

  1. New Tables
    - `ekyc_documents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `document_type` (text, constrained values)
      - `id_document_url` (text, URL to ID document)
      - `selfie_url` (text, URL to selfie)
      - `extracted_info` (jsonb, OCR data)
      - `verification_status` (text, constrained values)
      - `verification_score` (decimal, overall score)
      - `face_match_score` (decimal, face matching score)
      - `document_authenticity_score` (decimal, document authenticity)
      - `created_at` (timestamptz, creation time)
      - `verified_at` (timestamptz, verification time)
      - `expires_at` (timestamptz, document expiry)
      - `notes` (text, additional notes)

  2. Security
    - Enable RLS on `ekyc_documents` table
    - Add policy for users to access own documents
    - Add policy for admins to read all documents

  3. Functions & Triggers
    - Function to update verification timestamp
    - Trigger to automatically set verified_at when status changes
*/

-- Drop table if it exists to start fresh
DROP TABLE IF EXISTS ekyc_documents CASCADE;

-- Create eKYC documents table with all constraints inline
CREATE TABLE ekyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('passport', 'id_card', 'drivers_license', 'other')),
  id_document_url text,
  selfie_url text,
  extracted_info jsonb,
  verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  verification_score decimal(5,2),
  face_match_score decimal(5,2),
  document_authenticity_score decimal(5,2),
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  expires_at timestamptz,
  notes text
);

-- Enable Row Level Security
ALTER TABLE ekyc_documents ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_ekyc_documents_user_id ON ekyc_documents(user_id);
CREATE INDEX idx_ekyc_documents_status ON ekyc_documents(verification_status);
CREATE INDEX idx_ekyc_documents_created_at ON ekyc_documents(created_at);

-- Function to update verification timestamp
CREATE OR REPLACE FUNCTION update_ekyc_verification_timestamp()
RETURNS trigger AS $$
BEGIN
  -- Update verified_at when status changes to 'verified'
  IF TG_OP = 'UPDATE' AND 
     NEW.verification_status = 'verified' AND 
     (OLD.verification_status IS NULL OR OLD.verification_status != 'verified') THEN
    NEW.verified_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update verification timestamp
CREATE TRIGGER trigger_update_ekyc_verification_timestamp
  BEFORE UPDATE ON ekyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_ekyc_verification_timestamp();

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

-- Storage bucket policies would be set up in Supabase dashboard
-- Example policies for reference:
/*
-- Bucket: ekyc-documents

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