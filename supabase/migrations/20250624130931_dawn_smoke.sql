/*
  # Fix RLS Infinite Recursion

  1. Problem
    - RLS policies on users table were causing infinite recursion
    - Policies were querying the users table from within users table policies

  2. Solution
    - Create a security definer function in public schema to check admin status
    - Replace recursive policies with non-recursive ones using the function
    - Update all affected tables to use the new approach

  3. Changes
    - Drop problematic recursive policies
    - Create new non-recursive policies
    - Add admin management policies where needed
*/

-- Create a security definer function to check if current user is admin
-- This function runs with elevated privileges and bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Drop the problematic recursive policies on users table
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new non-recursive policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update policies in other tables to use the new function
-- Fix biometric_data policies
DROP POLICY IF EXISTS "Admins can read all biometric data" ON biometric_data;
CREATE POLICY "Admins can read all biometric data"
  ON biometric_data
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Fix ml_models policies
DROP POLICY IF EXISTS "Admins can manage models" ON ml_models;
CREATE POLICY "Admins can manage models"
  ON ml_models
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Fix login_audit policies
DROP POLICY IF EXISTS "Admins can read all audit logs" ON login_audit;
CREATE POLICY "Admins can read all audit logs"
  ON login_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Fix anomaly_audit policies
DROP POLICY IF EXISTS "Admins can manage anomaly logs" ON anomaly_audit;
CREATE POLICY "Admins can manage anomaly logs"
  ON anomaly_audit
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Fix admin_audit_log policies
DROP POLICY IF EXISTS "Admins can read all audit logs" ON admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON admin_audit_log;

CREATE POLICY "Admins can read all audit logs"
  ON admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Fix reverify_requests policies
DROP POLICY IF EXISTS "Admins can manage reverify requests" ON reverify_requests;
CREATE POLICY "Admins can manage reverify requests"
  ON reverify_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Fix ekyc_documents policies
DROP POLICY IF EXISTS "Admins can read all eKYC documents" ON ekyc_documents;
DROP POLICY IF EXISTS "Admins can read all ekyc" ON ekyc_documents;

CREATE POLICY "Admins can read all ekyc documents"
  ON ekyc_documents
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage ekyc documents"
  ON ekyc_documents
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());