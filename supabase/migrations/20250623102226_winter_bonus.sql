/*
  # Add eKYC Documents Table

  1. New Tables
    - `ekyc_documents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `document_type` (text)
      - `id_document_url` (text)
      - `selfie_url` (text)
      - `extracted_info` (jsonb)
      - `verification_status` (text)
      - `verification_score` (decimal)
      - `created_at` (timestamp)
      - `verified_at` (timestamp)

  2. Security
    - Enable RLS on ekyc_documents table
    - Add policies for secure access

  3. Storage
    - Create storage buckets for eKYC documents
    - Set up RLS policies for storage access
*/

-- Create eKYC documents table
CREATE TABLE IF NOT EXISTS ekyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('passport', 'id_card', 'drivers_license', 'other')),
  id_document_url text, -- URL to ID document in Supabase Storage
  selfie_url text, -- URL to selfie in Supabase Storage
  extracted_info jsonb, -- OCR extracted information
  verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  verification_score decimal(5,2), -- Overall verification score
  face_match_score decimal(5,2), -- Face matching score
  document_authenticity_score decimal(5,2), -- Document authenticity score
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  expires_at timestamptz, -- Document expiry date
  notes text -- Additional notes or failure reasons
);

-- Enable Row Level Security
ALTER TABLE ekyc_documents ENABLE ROW LEVEL SECURITY;

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
  IF NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
    NEW.verified_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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