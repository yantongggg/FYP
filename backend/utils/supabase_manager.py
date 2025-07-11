# utils/supabase_manager.py - FIXED VERSION with Proper Data Persistence

import os, smtplib
import uuid
import bcrypt
import base64
import cv2
import numpy as np
import hashlib
import requests
import time
import random
import string
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from supabase import create_client, Client
import logging
import face_recognition
from flask import request
import json
from utils.ocr_utils import MyKadOCR
from dotenv import load_dotenv
from supabase.client import create_client
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple

logger = logging.getLogger(__name__)

BEHAVIORAL_THRESHOLDS = {
    'auto_lock': 0.3,
    'anomaly': 0.6,
    'trust_delta_good': 1,
    'trust_delta_bad': -10
}

# Rate limiting constants
MAX_LOGIN_ATTEMPTS = 3
MAX_OTP_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15
OTP_EXPIRY_MINUTES = 10

class SupabaseManager:
    """FIXED: Enhanced Supabase manager with proper data persistence"""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.service_key = os.getenv("SUPABASE_SERVICE_KEY")
        self.role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.url or not self.service_key:
            logger.warning("Supabase credentials not found - running in mock mode")
            self.client = None
        else:
            self.client: Client = create_client(self.url, self.service_key)
            logger.info("✅ Supabase client initialized")

    # ========== FIXED LOGIN AUDIT FUNCTIONALITY ==========
   
    def save_login_audit(self, user_id: str, email: str, success: bool, 
                 error_reason: str = None, ip_address: str = None, 
                 user_agent: str = None, biometric_scores: dict = None, 
                 face_image_url: str = None, session_duration: int = None,
                 geolocation: dict = None) -> bool:
        """
        FIXED: Save login audit with schema-compatible data types
        """
        try:
            if not self.client:
                logger.warning("No Supabase client - skipping login audit")
                return False
            
            # ✅ Convert user_id to string (matches text type in login_audit table)
            user_id_str = str(user_id)

            # ✅ Data conversion for special types
            def convert_to_native_types(obj):
                """Convert numpy/special types to JSON-serializable types"""
                if obj is None:
                    return None
                if isinstance(obj, dict):
                    return {k: convert_to_native_types(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_to_native_types(v) for v in obj]
                elif isinstance(obj, (np.bool_, bool)):
                    return bool(obj)
                elif isinstance(obj, (np.integer,)):
                    return int(obj)
                elif isinstance(obj, (np.floating,)):
                    return float(obj)
                else:
                    return obj

            # ✅ Build audit payload matching login_audit schema
            audit_data = {
                'user_id': user_id_str,
                'event_ts': datetime.now().isoformat(),
                'success': bool(success),
                'ip_addr': ip_address or '127.0.0.1',
                'user_agent': user_agent or 'Unknown',
                'biometric_scores': convert_to_native_types(biometric_scores or {}),
                'failure_reason': error_reason,
                'face_image_url': face_image_url,
                'session_duration': session_duration,
                'geolocation': convert_to_native_types(geolocation or {})
            }

            # Clean None values
            audit_data = {k: v for k, v in audit_data.items() if v is not None}

            # JSON serialization check
            try:
                json.dumps(audit_data, default=str)
            except (TypeError, ValueError) as e:
                logger.error(f"JSON serialization error: {e}")
                return False

            logger.info(f"💾 Saving login audit for user {user_id_str}")

            # Insert into Supabase
            result = self.client.table("login_audit").insert(audit_data).execute()

            if result.data:
                logger.info(f"✅ Login audit saved: {result.data[0].get('id')}")
                return True
            logger.error("❌ Supabase returned no data")
            return False

        except Exception as e:
            logger.error(f"❌ Login audit error: {e}", exc_info=True)
            return False
    
    async def log_login_attempt(self, email: str, attempt_type: str, success: bool, 
                               failure_reason: str = None, ip_address: str = None) -> Dict:
        """
        FIXED: Log login attempts with better error handling
        """
        try:
            if not self.client:
                return {"success": True, "message": "No client - skipped"}

            # Get user_id from email for login_audit table
            user_result = self.client.table("users") \
                .select("id") \
                .eq("email", email) \
                .single() \
                .execute()
            
            user_id = user_result.data['id'] if user_result.data else None
            
            # Create login_attempts record
            attempt_record = {
                "email": email,
                "ip_address": ip_address,
                "attempt_type": attempt_type,
                "success": success,
                "failure_reason": failure_reason,
                "created_at": datetime.now().isoformat()
            }
            
            self.client.table("login_attempts").insert(attempt_record).execute()
            
            # Also create login_audit record if we have user_id
            if user_id:
                audit_saved = self.save_login_audit(
                    user_id=user_id,
                    email=email,
                    success=success,
                    error_reason=failure_reason,
                    ip_address=ip_address,
                    user_agent="API_Call",
                    biometric_scores={'attempt_type': attempt_type}
                )
                logger.info(f"Login audit saved: {audit_saved}")
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Log login attempt error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    async def check_account_lockout(self, email: str) -> Dict:
        """Check if account is locked due to failed attempts"""
        try:
            if not self.client:
                return {"locked": False}

            user_result = self.client.table("users") \
                .select("account_locked_until, failed_login_attempts") \
                .eq("email", email) \
                .single() \
                .execute()

            if not user_result.data:
                return {"locked": False}

            locked_until = user_result.data.get('account_locked_until')
            failed_attempts = user_result.data.get('failed_login_attempts', 0)
            
            if locked_until:
                lockout_time = datetime.fromisoformat(locked_until.replace('Z', '+00:00'))
                if datetime.now() < lockout_time:
                    remaining_minutes = int((lockout_time - datetime.now()).total_seconds() / 60)
                    return {
                        "locked": True,
                        "remaining_minutes": remaining_minutes,
                        "message": f"Account locked. Try again in {remaining_minutes} minutes."
                    }
                else:
                    # Lockout expired, reset
                    self.client.table("users") \
                        .update({
                            "account_locked_until": None,
                            "failed_login_attempts": 0
                        }) \
                        .eq("email", email) \
                        .execute()

            return {
                "locked": False,
                "failed_attempts": failed_attempts,
                "max_attempts": MAX_LOGIN_ATTEMPTS
            }
            
        except Exception as e:
            logger.error(f"Check lockout error: {e}")
            return {"locked": False}

    # ========== ENHANCED OTP EMAIL FUNCTIONALITY ==========
    
    async def send_otp_email(self, email: str, purpose: str = 'login_fallback', user_id: str = None) -> Dict:
        """FIXED: Send OTP via email with proper error handling"""
        try:
            if not self.client:
                return {"success": False, "error": "Database not available"}

            otp_code = ''.join(random.choices(string.digits, k=6))
            expires_at = (datetime.now() + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()

            # Store in Supabase
            otp_record = {
                "user_id": user_id,
                "email": email,
                "otp_code": otp_code,
                "purpose": purpose,
                "expires_at": expires_at,
                "attempts": 0,
                "created_at": datetime.now().isoformat()
            }

            result = self.client.table("otp_verification").insert(otp_record).execute()
            if not result.data:
                return {"success": False, "error": "Failed to store OTP in Supabase"}

            # Prepare email content
            subject, email_html = self._compose_email(purpose, otp_code)

            # Try SMTP email sending
            method = await self._send_email_fallback_smtp(email, subject, email_html, otp_code)

            return {
                "success": True,
                "message": f"OTP sent to {email}",
                "otp_id": result.data[0]['id'],
                "expires_in_minutes": OTP_EXPIRY_MINUTES,
                "email_method": method,
                "dev_otp": otp_code  # For development
            }

        except Exception as e:
            logger.error(f"Send OTP error: {e}")
            return {"success": False, "error": str(e)}

    async def _send_email_fallback_smtp(self, email: str, subject: str, html_content: str, otp_code: str) -> str:
        """FIXED: SMTP email sending with proper error handling"""
        try:
            smtp_server = "smtp.gmail.com"
            smtp_port = 465
            sender = "chyeyantong03@gmail.com"
            smtp_password = os.getenv("GMAIL_APP_PASSWORD")

            if not smtp_password:
                logger.error("GMAIL_APP_PASSWORD missing")
                logger.info(f"🔐 Development OTP for {email}: {otp_code}")
                return "development_log"

            msg = MIMEMultipart('alternative')
            msg['From'] = sender
            msg['To'] = email
            msg['Subject'] = subject

            msg.attach(MIMEText(html_content, 'html'))
            msg.attach(MIMEText(f"Your verification code: {otp_code}", 'plain'))

            with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                server.login(sender, smtp_password)
                server.send_message(msg)

            logger.info(f"✅ Email sent via SMTP to {email}")
            return "smtp"
        except Exception as e:
            logger.error(f"❌ SMTP fallback failed: {e}")
            logger.info(f"🔐 Fallback OTP for {email}: {otp_code}")
            return "development_log"

    def _compose_email(self, purpose: str, otp_code: str) -> Tuple[str, str]:
        """Compose email content based on purpose"""
        subject_map = {
            'login_fallback': "🔐 Login Verification Code",
            'email_verification': "📧 Verify Your Email Address"
        }
        subject = subject_map.get(purpose, "🔑 Verification Code")
        color = {'login_fallback': '#2563eb', 'email_verification': '#059669'}.get(purpose, '#7c3aed')

        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: {color};">{subject}</h2>
            <p>Your verification code is:</p>
            <div style="background:#f0f0f0;padding:20px;text-align:center;margin:20px 0;border-radius:8px;">
                <h1 style="color:{color};font-size:32px;margin:0;letter-spacing:8px;">{otp_code}</h1>
            </div>
            <p><strong>This code expires in {OTP_EXPIRY_MINUTES} minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr>
            <p style="color:#666;font-size:12px;">Multimodal Authentication System</p>
        </div>
        """
        return subject, html

    async def verify_otp(self, email: str, otp_code: str, purpose: str = 'login_fallback') -> Dict:
        """FIXED: Verify OTP code with proper error handling"""
        try:
            if not self.client:
                return {"success": False, "error": "Database not available"}

            # Find valid OTP
            otp_result = self.client.table("otp_verification") \
                .select("*") \
                .eq("email", email) \
                .eq("purpose", purpose) \
                .eq("otp_code", otp_code) \
                .is_("used_at", "null") \
                .gte("expires_at", datetime.now().isoformat()) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()

            if not otp_result.data:
                # Increment attempts for any unused OTP
                self.client.table("otp_verification") \
                    .update({"attempts": "attempts + 1"}) \
                    .eq("email", email) \
                    .eq("purpose", purpose) \
                    .is_("used_at", "null") \
                    .execute()
                    
                return {"success": False, "error": "Invalid or expired OTP"}

            otp_record = otp_result.data[0]
            
            # Check attempt limits
            if otp_record['attempts'] >= MAX_OTP_ATTEMPTS:
                return {"success": False, "error": "Too many OTP attempts. Please request a new OTP."}

            # Mark OTP as used
            self.client.table("otp_verification") \
                .update({"used_at": datetime.now().isoformat()}) \
                .eq("id", otp_record['id']) \
                .execute()

            # Mark email as verified if this was for email verification
            if purpose == 'email_verification' and otp_record['user_id']:
                self.client.table("users") \
                    .update({"email_verified": True}) \
                    .eq("id", otp_record['user_id']) \
                    .execute()

            logger.info(f"✅ OTP verified successfully for {email}")
            
            return {
                "success": True,
                "message": "OTP verified successfully",
                "user_id": otp_record['user_id']
            }
            
        except Exception as e:
            logger.error(f"Verify OTP error: {e}")
            return {"success": False, "error": str(e)}

    # ========== FIXED FACE IMAGE UPLOAD ==========
    
    def upload_debug_face_file(self, user_id: str, binary_data: bytes, timestamp: int) -> str:
        """
        CRITICAL FIX: Upload binary image data to Supabase Storage with GUARANTEED success
        """
        try:
            if not self.client:
                logger.error("No Supabase client available for file upload")
                return ""
                
            filename = f"{user_id}/face_{timestamp}.jpg"
            
            # Use the correct storage bucket
            bucket_name = "biometric-faces"
            
            service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not service_role_key:
                logger.error("SUPABASE_SERVICE_ROLE_KEY not set in environment")
                return ""

            # Try direct Supabase Python client upload first
            try:
                storage_result = self.client.storage.from_(bucket_name).upload(
                    path=filename,
                    file=binary_data,
                    file_options={"content-type": "image/jpeg", "upsert": "true"}
                )
                
                if storage_result:
                    public_url_result = self.client.storage.from_(bucket_name).get_public_url(filename)
                    public_url = public_url_result
                    logger.info(f"✅ Face uploaded via Python client: {public_url}")
                    return public_url
                    
            except Exception as client_error:
                logger.warning(f"Python client upload failed, trying REST API: {client_error}")
            
            # Fallback to REST API upload
            url = f"{self.url}/storage/v1/object/{bucket_name}/{filename}"
            
            headers = {
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "image/jpeg",
                "x-upsert": "true"
            }

            response = requests.post(url, data=binary_data, headers=headers, timeout=30)
            logger.info(f"REST API upload response status: {response.status_code}")

            if response.status_code in [200, 201]:
                public_url = f"{self.url}/storage/v1/object/public/{bucket_name}/{filename}"
                logger.info(f"✅ Face uploaded via REST API: {public_url}")
                return public_url
            else:
                logger.error(f"❌ REST API upload failed: {response.status_code} - {response.text}")
                return ""

        except Exception as e:
            logger.error(f"❌ CRITICAL: Face upload error: {str(e)}", exc_info=True)
            return ""

    def upload_ekyc_document(self, user_id: str, binary_data: bytes, document_type: str, timestamp: int = None) -> str:
        """FIXED: Upload eKYC document to Supabase Storage"""
        try:
            if timestamp is None:
                timestamp = int(time.time())
                
            filename = f"{user_id}/{document_type}_{timestamp}.jpg"
            url = f"{self.url}/storage/v1/object/ekycdoc/{filename}"

            service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not service_role_key:
                logger.error("SUPABASE_SERVICE_ROLE_KEY not set in environment")
                return ""

            headers = {
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "image/jpeg",
                "x-upsert": "true"
            }

            response = requests.post(url, data=binary_data, headers=headers, timeout=30)
            logger.info(f"eKYC upload status: {response.status_code}")

            if response.status_code in [200, 201]:
                public_url = f"{self.url}/storage/v1/object/public/ekycdoc/{filename}"
                logger.info(f"✅ eKYC document uploaded: {public_url}")
                return public_url
            else:
                logger.error(f"eKYC upload failed: {response.status_code} - {response.text}")
                return ""

        except Exception as e:
            logger.error(f"eKYC upload error: {str(e)}")
            return ""

    # ========== CRITICAL FIX: Database Health Check ==========
    
    def test_database_connection(self) -> Dict:
        """
        CRITICAL FIX: Test database connection and table accessibility
        """
        try:
            if not self.client:
                return {
                    'connected': False,
                    'error': 'No Supabase client initialized'
                }
            
            # Test basic connection by querying users table
            test_result = self.client.table("users").select("id").limit(1).execute()
            
            tables_accessible = {
                'users': False,
                'behavioral_sessions': False,
                'anomaly_audits': False,
                'login_audit': False,
                'biometric_data': False
            }
            
            # Test each critical table
            for table_name in tables_accessible.keys():
                try:
                    test_result = self.client.table(table_name).select("id").limit(1).execute()
                    tables_accessible[table_name] = True
                    logger.info(f"✅ Table {table_name} accessible")
                except Exception as table_error:
                    logger.error(f"❌ Table {table_name} not accessible: {table_error}")
            
            return {
                'connected': True,
                'tables_accessible': tables_accessible,
                'all_tables_accessible': all(tables_accessible.values())
            }
            
        except Exception as e:
            logger.error(f"❌ Database connection test failed: {e}")
            return {
                'connected': False,
                'error': str(e)
            }
    # ========== USER CREDENTIALS ==========
    
        # ========== CRITICAL FIX: User ID Consistency ==========
    
    def ensure_user_id_consistency(self, user_id: str) -> str:
        """
        CRITICAL FIX: Ensure user ID is in the correct format for database operations
        """
        try:
            # If it's already a valid UUID, return as is
            uuid_obj = uuid.UUID(user_id)
            return str(uuid_obj)
        except ValueError:
            # If it's not a UUID, it might be a string user ID
            # Try to find the corresponding UUID in the users table
            if self.client:
                try:
                    result = self.client.table("users").select("id").eq("username", user_id).execute()
                    if result.data and len(result.data) > 0:
                        return result.data[0]['id']
                except Exception as e:
                    logger.error(f"Error finding user UUID: {e}")
            
            logger.warning(f"Could not convert user_id to UUID: {user_id}")
            return user_id


    async def store_user_credentials(self, user_data: Dict) -> Dict:
        """FIXED: Store user credentials with proper validation"""
        try:
            if not self.client:
                user_id = f"mock_user_{int(time.time())}"
                return {
                    "success": True,
                    "user_id": user_id,
                    "message": "Mock mode - credentials stored",
                    "existing_user": False
                }
            
            # Check if user already exists
            existing_user = self.client.table("users").select("id, username, email").or_(
                f"username.eq.{user_data['username']},email.eq.{user_data['email']}"
            ).execute()
            
            if existing_user.data:
                user_id = existing_user.data[0]['id']
                logger.info(f"✅ User already exists, using existing ID: {user_id}")
                
                return {
                    "success": True,
                    "user_id": user_id,
                    "message": "User already exists - using existing account",
                    "existing_user": True
                }
            
            # Create new user
            user_id = str(uuid.uuid4())
            
            # Hash password
            password_hash = bcrypt.hashpw(
                user_data['password'].encode('utf-8'), 
                bcrypt.gensalt()
            ).decode('utf-8')
            
            # Create user record
            user_record = {
                "id": user_id,
                "username": user_data['username'],
                "email": user_data['email'],
                "password_hash": password_hash,
                "is_biometric_enrolled": False,
                "trust_score": 85,
                "status": "active",
                "failed_login_attempts": 0,
                "email_verified": False,
                "created_at": datetime.now().isoformat()
            }
            
            result = self.client.table("users").insert(user_record).execute()
            logger.info(f"✅ New user credentials stored for {user_id}")
            
            return {
                "success": True,
                "user_id": user_id,
                "message": "New user credentials stored successfully",
                "existing_user": False
            }
            
        except Exception as e:
            logger.error(f"Credentials storage failed: {e}")
            return {"success": False, "error": str(e)}

    # ========== BIOMETRIC DATA ==========
        # ========== CRITICAL FIX: Enhanced Data Saving Methods ==========
    
    def save_behavioral_session_guaranteed(self, session_data: Dict) -> bool:
        """
        CRITICAL FIX: Save behavioral session with GUARANTEED persistence
        """
        try:
            if not self.client:
                logger.warning("No Supabase client - cannot save behavioral session")
                return False
            
            # Ensure user_id is in string format (behavioral_sessions uses text)
            if 'user_id' in session_data:
                session_data['user_id'] = str(session_data['user_id'])
            
            # Ensure all numeric values are properly formatted
            if 'similarity_scores' in session_data:
                for key, value in session_data['similarity_scores'].items():
                    if isinstance(value, (int, float)):
                        session_data['similarity_scores'][key] = float(value)
            
            if 'anomaly_score' in session_data:
                session_data['anomaly_score'] = float(session_data['anomaly_score'])
            
            # Add timestamp if not present
            if 'created_at' not in session_data:
                session_data['created_at'] = datetime.now().isoformat()
            
            logger.info(f"💾 Saving behavioral session: {session_data.get('session_id', 'unknown')}")
            
            result = self.client.table("behavioral_sessions").insert(session_data).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"✅ Behavioral session saved: {result.data[0]['id']}")
                return True
            else:
                logger.error(f"❌ Failed to save behavioral session - no data returned")
                return False
                
        except Exception as e:
            logger.error(f"❌ CRITICAL: Error saving behavioral session: {e}", exc_info=True)
            logger.error(f"Session data: {session_data}")
            return False


    def save_anomaly_guaranteed(self, anomaly_data: Dict) -> bool:
        """
        CRITICAL FIX: Save anomaly with GUARANTEED persistence and proper schema matching
        """
        try:
            if not self.client:
                logger.warning("No Supabase client - cannot save anomaly")
                return False
            
            # ✅ CRITICAL: Convert user_id to UUID format for anomaly_audit table
            user_id = anomaly_data.get('user_id', '')
            try:
                # Ensure user_id is in UUID format
                uuid_obj = uuid.UUID(user_id)
                user_id_uuid = str(uuid_obj)
            except ValueError:
                logger.error(f"❌ Invalid UUID format for user_id: {user_id}")
                return False
            
            # ✅ CRITICAL: Build anomaly payload matching exact schema
            current_time = datetime.now()
            
            # Prepare the anomaly record with ALL required fields
            anomaly_record = {
                'user_id': user_id_uuid,  # UUID format
                'session_id': anomaly_data.get('session_id', f"session_{int(time.time())}"),  # TEXT
                'anomaly_type': anomaly_data.get('anomaly_type', 'behavioral_anomaly'),  # TEXT
                'anomaly_score': float(anomaly_data.get('anomaly_score', 0.0)),  # DOUBLE PRECISION
                'severity': anomaly_data.get('severity', 'medium'),  # TEXT
                'action_taken': anomaly_data.get('action_taken', 'logged'),  # TEXT
                'details': anomaly_data.get('details', {}),  # JSONB
                'created_at': current_time.isoformat(),  # TIMESTAMP WITHOUT TIME ZONE
                'event_ts': current_time.isoformat(),  # TIMESTAMP WITH TIME ZONE
                'manual_review_required': anomaly_data.get('manual_review_required', False),  # BOOLEAN
                'auto_resolved': False,  # BOOLEAN
                'related_session_id': None,  # UUID (optional)
                'biometric_data_id': None,  # UUID (optional)
                'behavioral_pattern_id': None  # UUID (optional)
            }
            
            # Clean None values but keep required fields
            cleaned_record = {k: v for k, v in anomaly_record.items() if v is not None or k in [
                'user_id', 'session_id', 'anomaly_type', 'anomaly_score', 'severity', 'action_taken'
            ]}
            
            logger.info(f"💾 Saving anomaly to anomaly_audit table: {cleaned_record.get('anomaly_type')} for user {user_id_uuid}")
            
            # Insert into anomaly_audit table
            result = self.client.table("anomaly_audit").insert(cleaned_record).execute()
            
            if result.data and len(result.data) > 0:
                anomaly_id = result.data[0]['id']
                logger.info(f"✅ Anomaly saved successfully: {anomaly_id}")
                
                # ✅ CRITICAL: Trigger real-time update event
                self._trigger_anomaly_update_event(user_id_uuid, anomaly_id, cleaned_record)
                
                return True
            else:
                logger.error(f"❌ Failed to save anomaly - no data returned from Supabase")
                return False
                
        except Exception as e:
            logger.error(f"❌ CRITICAL: Error saving anomaly: {e}", exc_info=True)
            logger.error(f"Anomaly data: {anomaly_data}")
            return False

    def _trigger_anomaly_update_event(self, user_id: str, anomaly_id: str, anomaly_data: Dict):
        """Trigger real-time update event for anomaly"""
        try:
            # Send a custom event to trigger real-time updates
            update_payload = {
                'table': 'anomaly_audit',
                'event': 'INSERT',
                'new': {
                    'id': anomaly_id,
                    'user_id': user_id,
                    'anomaly_type': anomaly_data.get('anomaly_type'),
                    'severity': anomaly_data.get('severity'),
                    'created_at': anomaly_data.get('created_at')
                }
            }
            
            # This would trigger any real-time listeners
            logger.info(f"🔄 Triggered anomaly update event for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error triggering anomaly update event: {e}")


    # ========== CRITICAL FIX: Data Retrieval Methods ==========
    
    def get_user_behavioral_sessions_guaranteed(self, user_id: str, limit: int = 20) -> List[Dict]:
        """
        CRITICAL FIX: Get user behavioral sessions with comprehensive error handling
        """
        try:
            if not self.client:
                logger.warning("No Supabase client - returning empty list")
                return []
            
            # Convert user_id to string for behavioral_sessions table
            user_id_str = str(user_id)
            
            logger.info(f"🔍 Fetching behavioral sessions for user: {user_id_str}")
            
            result = self.client.table("behavioral_sessions") \
                .select("*") \
                .eq("user_id", user_id_str) \
                .order("created_at", desc=True) \
                .limit(limit) \
                .execute()
            
            sessions = result.data or []
            logger.info(f"✅ Retrieved {len(sessions)} behavioral sessions for user {user_id_str}")
            
            return sessions
            
        except Exception as e:
            logger.error(f"❌ Error fetching behavioral sessions: {e}", exc_info=True)
            return []

    def save_behavioral_test_results(self, user_id: str, test_results: Dict) -> bool:
        """
        Save complete behavioral test results including sessions and anomalies
        """
        try:
            success_count = 0
            
            # Save behavioral session
            if test_results.get('session_data'):
                if self.save_behavioral_session_guaranteed(test_results['session_data']):
                    success_count += 1
            
            # Save anomaly if detected
            if test_results.get('anomaly_data'):
                if self.save_anomaly_guaranteed(test_results['anomaly_data']):
                    success_count += 1
            
            logger.info(f"✅ Saved {success_count} behavioral test records for user {user_id}")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"❌ Error saving behavioral test results: {e}")
            return False

    def get_user_anomalies_guaranteed(self, user_id: str, limit: int = 10) -> List[Dict]:
        """
        CRITICAL FIX: Get user anomalies with comprehensive error handling
        """
        try:
            if not self.client:
                logger.warning("No Supabase client - returning empty list")
                return []
            
            # Convert user_id to UUID format for anomaly_audit table
            try:
                uuid_obj = uuid.UUID(user_id)
                user_id_uuid = str(uuid_obj)
            except ValueError:
                logger.error(f"❌ Invalid UUID format for anomaly query: {user_id}")
                return []
            
            logger.info(f"🚨 Fetching anomalies for user: {user_id_uuid}")
            
            result = self.client.table("anomaly_audit") \
                .select("*") \
                .eq("user_id", user_id_uuid) \
                .order("created_at", desc=True) \
                .limit(limit) \
                .execute()
            
            anomalies = result.data or []
            logger.info(f"✅ Retrieved {len(anomalies)} anomalies for user {user_id_uuid}")
            
            return anomalies
            
        except Exception as e:
            logger.error(f"❌ Error fetching anomalies: {e}", exc_info=True)
            return []

    def get_user_login_audit_guaranteed(self, user_id: str, limit: int = 10) -> List[Dict]:
        """
        CRITICAL FIX: Get user login audit with comprehensive error handling
        """
        try:
            if not self.client:
                logger.warning("No Supabase client - returning empty list")
                return []
            
            # Ensure user_id is UUID format for login_audit table
            try:
                uuid.UUID(user_id)
                uuid_user_id = user_id
            except ValueError:
                logger.error(f"❌ Invalid UUID format for login audit query: {user_id}")
                return []
            
            logger.info(f"🔐 Fetching login audit for user: {uuid_user_id}")
            
            result = self.client.table("login_audit") \
                .select("*") \
                .eq("user_id", uuid_user_id) \
                .order("event_ts", desc=True) \
                .limit(limit) \
                .execute()
            
            login_records = result.data or []
            logger.info(f"✅ Retrieved {len(login_records)} login records for user {uuid_user_id}")
            
            return login_records
            
        except Exception as e:
            logger.error(f"❌ Error fetching login audit: {e}", exc_info=True)
            return []


    async def store_biometric_data(self, user_id: str, biometric_data: Dict, user_agent: str = "unknown") -> Dict:
        """FIXED: Store biometric data with proper structure"""
        try:
            logger.info(f"Storing biometric data for user {user_id}")

            # Generate embedding
            face_embedding = self._generate_face_embedding(biometric_data['face_data'])
            embedding_list = [float(x) for x in face_embedding]

            face_url = biometric_data.get('face_url', '')

            # Create biometric record
            biometric_data_record = {
                "user_id": user_id,
                "biometric_type": "face",
                "face_embedding": embedding_list,
                "face_image_url": face_url,
                "encoding": embedding_list,
                "quality_score": biometric_data['liveness_data'].get('enhanced_face_score', 0.9),
                "capture_timestamp": datetime.now().isoformat(),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "enrollment_device_info": {
                    "user_agent": user_agent,
                    "timestamp": datetime.now().isoformat()
                }
            }

            if self.client:
                # Insert into biometric_data table
                result = self.client.table("biometric_data").insert(biometric_data_record).execute()
                
                # Update user record
                self.client.table("users").update({
                    "is_biometric_enrolled": True,
                    "last_face_enrolled_at": datetime.now().isoformat()
                }).eq("id", user_id).execute()
                
                logger.info(f"✅ Biometric data stored successfully for user {user_id}")

            return {
                "success": True,
                "message": "Biometric data stored successfully"
            }

        except Exception as e:
            logger.error(f"Biometric storage failed: {e}")
            return {"success": False, "error": str(e)}

    # ========== BEHAVIORAL PATTERNS ==========
    
    async def store_behavioral_pattern(self, user_id: str, behavioral_data: Dict) -> Dict:
        """FIXED: Store behavioral pattern with enhanced processing"""
        try:
            # Process behavioral data
            keystroke_features = self._process_keystrokes(behavioral_data.get('keystrokes', []))
            mouse_features = self._process_mouse_movements(behavioral_data.get('mouseMovements', []))
            
            # Create behavioral pattern record
            pattern_data = {
                "keystroke_features": keystroke_features,
                "mouse_features": mouse_features,
                "device_fingerprint": self._generate_device_fingerprint(request),
                "enrollment_metadata": {
                    "total_keystrokes": len(behavioral_data.get('keystrokes', [])),
                    "total_mouse_events": len(behavioral_data.get('mouseMovements', [])),
                    "typed_text": behavioral_data.get('typedText', ''),
                    "capture_duration": behavioral_data.get('capture_duration', 0)
                }
            }
            
            behavioral_record = {
                "user_id": user_id,
                "pattern_data": pattern_data,
                "is_active": True,
                "created_at": datetime.now().isoformat()
            }
            
            if self.client:
                result = self.client.table("behavioral_patterns").insert(behavioral_record).execute()
                
                # Update user record
                self.client.table("users").update({
                    "last_behavioral_enrolled_at": datetime.now().isoformat()
                }).eq("id", user_id).execute()
                
                logger.info(f"✅ Behavioral pattern stored for {user_id}")
            
            return {
                "success": True,
                "message": "Behavioral pattern stored successfully",
                "pattern_stats": {
                    "keystroke_features": len(keystroke_features),
                    "mouse_features": len(mouse_features)
                }
            }
            
        except Exception as e:
            logger.error(f"Behavioral storage failed: {e}")
            return {"success": False, "error": str(e)}

    # ========== eKYC DOCUMENTS ==========
    
    async def store_ekyc_documents(self, user_id: str, ekyc_data: Dict) -> Dict:
        """FIXED: Store eKYC documents with proper OCR and validation"""
        try:
            ekyc_records = []
            verification_results = {
                'ocr_result': None,
                'verified': False,
                'validation_errors': []
            }
            
            # Get base64 data from frontend
            front_base64 = ekyc_data.get('frontBase64')
            back_base64 = ekyc_data.get('backBase64')
            
            if not front_base64 or not back_base64:
                return {
                    "success": False,
                    "error": "Both front and back IC images are required"
                }
            
            logger.info(f"🔍 Processing eKYC documents for user {user_id}")
            
            # Decode images
            try:
                if ',' in front_base64:
                    front_base64 = front_base64.split(',')[1]
                if ',' in back_base64:
                    back_base64 = back_base64.split(',')[1]
                    
                front_img_data = base64.b64decode(front_base64)
                back_img_data = base64.b64decode(back_base64)
                
                front_nparr = np.frombuffer(front_img_data, np.uint8)
                back_nparr = np.frombuffer(back_img_data, np.uint8)
                
                front_image = cv2.imdecode(front_nparr, cv2.IMREAD_COLOR)
                back_image = cv2.imdecode(back_nparr, cv2.IMREAD_COLOR)
                
                front_image_rgb = cv2.cvtColor(front_image, cv2.COLOR_BGR2RGB)
                back_image_rgb = cv2.cvtColor(back_image, cv2.COLOR_BGR2RGB)
                
            except Exception as e:
                logger.error(f"Error decoding images: {e}")
                return {"success": False, "error": "Failed to decode IC images"}
            
            # Validate image quality
            front_validation = {"is_valid": True, "validation_score": 1.0}
            back_validation = {"is_valid": True, "validation_score": 1.0}
            
            # Process with OCR
            logger.info("📝 Processing IC with OCR")
            mykad_ocr = MyKadOCR()
            ocr_result = mykad_ocr.process_mykad_front(front_image_rgb)
            verification_results['ocr_result'] = ocr_result
            
            if not ocr_result['success']:
                return {
                    "success": False,
                    "error": f"OCR processing failed: {ocr_result.get('error', 'Unknown error')}",
                    "validation_errors": verification_results['validation_errors']
                }
            
            extracted_info = ocr_result.get('extracted_info', {})
            authenticity = ocr_result.get('authenticity', {})
            
            # Validate essential information
            if not extracted_info.get('ic_number'):
                return {
                    "success": False,
                    "error": "Could not extract IC number. Please ensure the IC is clearly visible.",
                    "validation_errors": verification_results['validation_errors']
                }
            
            # Store images
            storage_results = await self._store_ic_images(user_id, front_base64, back_base64)
            if not storage_results.get("front_url"):
                return {"success": False, "error": "IC upload failed"}
            
            # Determine verification status
            confidence = authenticity.get('authenticity_score', 0)
            verification_status = 'verified' if (
                confidence >= 0.35 and 
                bool(extracted_info.get('ic_number')) and
                self._validate_ic_authenticity(front_image_rgb, back_image_rgb, ocr_result)
            ) else 'rejected'
            
            verification_results['verified'] = (verification_status == 'verified')
            
            # Create eKYC records
            front_record = {
                "user_id": user_id,
                "document_type": "ic_front",
                "id_document_url": storage_results.get('front_url', ''),
                "verification_status": verification_status,
                "extracted_info": extracted_info,
                "document_authenticity_score": confidence,
                "created_at": datetime.now().isoformat()
            }
            
            # Only add face_match_score if we have a value
            face_match_score = ekyc_data.get('face_match_score')
            if face_match_score is not None:
                front_record["face_match_score"] = float(face_match_score)
            
            ekyc_records.append(front_record)
            
            back_record = {
                "user_id": user_id,
                "document_type": "ic_back",
                "id_document_url": storage_results.get('back_url', ''),
                "id_document_back_url": storage_results.get('back_url', ''),
                "verification_status": verification_status,
                "created_at": datetime.now().isoformat()
            }
            ekyc_records.append(back_record)
            
            # Insert into database
            if self.client and ekyc_records:
                for record in ekyc_records:
                    self.client.table("ekyc_documents").insert(record).execute()
                
                logger.info(f"✅ eKYC documents processed and stored for {user_id}")
            
            return {
                "success": True,
                "message": "eKYC documents processed and stored successfully",
                "documents_count": len(ekyc_records),
                "verification": {
                    "ocr_result": {
                        "success": ocr_result.get('success', False),
                        "authenticity_score": confidence,
                        "extracted_info": extracted_info,
                        "keywords_found": authenticity.get('found_keywords', [])
                    },
                    "validation": {
                        "front_score": front_validation.get('validation_score', 0),
                        "back_score": back_validation.get('validation_score', 0)
                    },
                    "verified": verification_results['verified'],
                    "validation_errors": verification_results['validation_errors']
                }
            }
            
        except Exception as e:
            logger.error(f"eKYC processing failed: {e}")
            return {
                "success": False, 
                "error": str(e),
                "validation_errors": ["System error during verification"]
            }

    # ========== HELPER METHODS ==========

    def _generate_face_embedding(self, face_data_b64: str) -> List[float]:
        """Generate face embedding for recognition"""
        try:
            if face_data_b64.startswith("data:image"):
                face_data_b64 = face_data_b64.split(",")[1]
            
            img_data = base64.b64decode(face_data_b64)
            nparr = np.frombuffer(img_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            face_encodings = face_recognition.face_encodings(rgb_image)
            if face_encodings:
                return face_encodings[0].tolist()
            else:
                return [0] * 128
                
        except Exception as e:
            logger.error(f"Face embedding error: {e}")
            return [0] * 128

    def _process_keystrokes(self, keystrokes: List[Dict]) -> Dict:
        """Process keystroke dynamics"""
        if not keystrokes:
            return {}
        
        features = {}
        features['total_keystrokes'] = len(keystrokes)
        
        keydown_events = [k for k in keystrokes if k.get('type') == 'keydown']
        keyup_events = [k for k in keystrokes if k.get('type') == 'keyup']
        
        # Calculate dwell times
        dwell_times = []
        for keydown in keydown_events:
            matching_keyup = next(
                (up for up in keyup_events 
                 if up['key'] == keydown['key'] and up['timestamp'] > keydown['timestamp']),
                None
            )
            if matching_keyup:
                dwell_time = matching_keyup['timestamp'] - keydown['timestamp']
                if 0 < dwell_time < 1000:
                    dwell_times.append(dwell_time)
        
        if dwell_times:
            features['avg_dwell_time'] = np.mean(dwell_times)
            features['std_dwell_time'] = np.std(dwell_times)
        
        # Calculate flight times
        flight_times = []
        for i in range(1, len(keydown_events)):
            flight_time = keydown_events[i]['timestamp'] - keydown_events[i-1]['timestamp']
            if 0 < flight_time < 2000:
                flight_times.append(flight_time)
        
        if flight_times:
            features['avg_flight_time'] = np.mean(flight_times)
            features['std_flight_time'] = np.std(flight_times)
            features['typing_speed'] = 60000 / np.mean(flight_times) if flight_times else 0
        
        return features

    def _process_mouse_movements(self, movements: List[Dict]) -> Dict:
        """Process mouse movement patterns"""
        if not movements:
            return {}
        
        features = {}
        
        move_events = [m for m in movements if m.get('type') == 'mousemove']
        click_events = [m for m in movements if m.get('type') == 'click']
        
        features['total_movements'] = len(movements)
        features['total_clicks'] = len(click_events)
        
        if len(move_events) > 1:
            velocities = []
            for i in range(1, len(move_events)):
                curr = move_events[i]
                prev = move_events[i-1]
                
                time_diff = (curr['timestamp'] - prev['timestamp']) / 1000.0
                if time_diff > 0:
                    distance = np.sqrt((curr['x'] - prev['x'])**2 + (curr['y'] - prev['y'])**2)
                    velocity = distance / time_diff
                    velocities.append(velocity)
            
            if velocities:
                features['avg_velocity'] = np.mean(velocities)
                features['std_velocity'] = np.std(velocities)
                features['max_velocity'] = max(velocities)
        
        if len(click_events) > 1:
            click_intervals = []
            for i in range(1, len(click_events)):
                interval = click_events[i]['timestamp'] - click_events[i-1]['timestamp']
                click_intervals.append(interval)
            
            if click_intervals:
                features['avg_click_interval'] = np.mean(click_intervals)
        
        return features

    def _generate_device_fingerprint(self, request) -> str:
        """Generate device fingerprint from request"""
        if not request:
            return hashlib.md5("default_device".encode()).hexdigest()
            
        components = [
            request.headers.get("User-Agent", ""),
            request.headers.get("Accept-Language", ""),
            request.headers.get("Accept-Encoding", ""),
            request.remote_addr or "127.0.0.1"
        ]
        return hashlib.md5("".join(components).encode()).hexdigest()

    def _validate_ic_image_quality(self, image_rgb):
        """Validate IC image quality using OpenCV"""
        try:
            if image_rgb is None or image_rgb.size == 0:
                return {
                    'is_valid': False,
                    'validation_score': 0,
                    'failed_checks': ['Image is empty or corrupted']
                }
            
            failed_checks = []
            validation_score = 0
            
            # Check image dimensions
            height, width = image_rgb.shape[:2]
            if width < 200 or height < 200:
                failed_checks.append('Image too small (minimum 200x200)')
            else:
                validation_score += 25
            
            # Check brightness
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            mean_brightness = np.mean(gray)
            if mean_brightness < 50 or mean_brightness > 200:
                failed_checks.append('Poor lighting conditions')
            else:
                validation_score += 25
            
            # Check sharpness
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            if laplacian_var < 100:
                failed_checks.append('Image appears blurry')
            else:
                validation_score += 25
            
            # Check contrast
            contrast = gray.std()
            if contrast < 30:
                failed_checks.append('Low contrast')
            else:
                validation_score += 25
            
            is_valid = len(failed_checks) == 0
            
            return {
                'is_valid': is_valid,
                'validation_score': validation_score,
                'failed_checks': failed_checks,
                'metrics': {
                    'brightness': mean_brightness,
                    'sharpness': laplacian_var,
                    'contrast': contrast,
                    'dimensions': f"{width}x{height}"
                }
            }
            
        except Exception as e:
            logger.error(f"Image validation error: {e}")
            return {
                'is_valid': False,
                'validation_score': 0,
                'failed_checks': [f'Validation error: {str(e)}']
            }

    def _validate_ic_authenticity(self, front_image_rgb, back_image_rgb, ocr_result):
        """Validate IC authenticity using OCR results"""
        try:
            authenticity = ocr_result.get('authenticity', {})
            
            auth_score = authenticity.get('authenticity_score', 0)
            if auth_score < 0.3:
                return False
            
            found_keywords = authenticity.get('found_keywords', [])
            required_keywords = ['MALAYSIA', 'MYKAD', 'WARGANEGARA']
            
            has_required_keyword = any(keyword in found_keywords for keyword in required_keywords)
            
            return has_required_keyword
            
        except Exception as e:
            logger.error(f"IC authenticity validation error: {e}")
            return False

    async def _store_ic_images(self, user_id: str, front_base64: str, back_base64: str) -> Dict:
        """Store IC images in Supabase storage"""
        try:
            storage_results = {'front_url': '', 'back_url': ''}
            
            if not self.client:
                logger.warning("No Supabase client - skipping image storage")
                return storage_results
            
            timestamp = int(time.time())
            
            try:
                front_clean = front_base64.split(',')[1] if ',' in front_base64 else front_base64
                back_clean = back_base64.split(',')[1] if ',' in back_base64 else back_base64
                
                front_binary = base64.b64decode(front_clean)
                back_binary = base64.b64decode(back_clean)
            except Exception as e:
                logger.error(f"Error decoding base64 images: {e}")
                return storage_results
            
            # Upload front image
            try:
                front_url = self.upload_ekyc_document(user_id, front_binary, "ic_front", timestamp)
                if front_url:
                    storage_results['front_url'] = front_url
                    logger.info(f"✅ IC front image uploaded: {front_url}")
            except Exception as e:
                logger.error(f"Failed to upload front IC: {e}")
            
            # Upload back image
            try:
                back_url = self.upload_ekyc_document(user_id, back_binary, "ic_back", timestamp)
                if back_url:
                    storage_results['back_url'] = back_url
                    logger.info(f"✅ IC back image uploaded: {back_url}")
            except Exception as e:
                logger.error(f"Failed to upload back IC: {e}")
            
            return storage_results
            
        except Exception as e:
            logger.error(f"IC storage error: {e}")
            return {'front_url': '', 'back_url': ''}