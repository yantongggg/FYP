#/utis/supabase_manager.py

import os
import uuid
import bcrypt
import base64
import cv2
import numpy as np
import hashlib
import requests
import time
from datetime import datetime
from typing import Dict, Optional, List
from supabase import create_client, Client
import logging
import face_recognition
from flask import request
from utils.ocr_utils import MyKadOCR
mykad_ocr = MyKadOCR()

logger = logging.getLogger(__name__)

BEHAVIORAL_THRESHOLDS = {
    'auto_lock': 0.3,
    'anomaly': 0.6,
    'trust_delta_good': 1,
    'trust_delta_bad': -10
}

class SupabaseManager:
    """Manages all Supabase database operations"""
    
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

    # ========== STEP 1: USER CREDENTIALS ==========
    async def store_user_credentials(self, user_data: Dict) -> Dict:
        """
        Step 1: Store user credentials securely
        - Checks if user exists first
        - Updates if exists, creates if new
        """
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
                # User exists - return existing user ID
                user_id = existing_user.data[0]['id']
                logger.info(f"✅ User already exists, using existing ID: {user_id}")
                
                return {
                    "success": True,
                    "user_id": user_id,
                    "message": "User already exists - using existing account",
                    "existing_user": True
                }
            
            # User doesn't exist - create new user
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
                "created_at": datetime.now().isoformat()
            }
            
            result = self.client.table("users").insert(user_record).execute()
            logger.info(f"✅ Step 1 Complete: New user credentials stored for {user_id}")
            
            return {
                "success": True,
                "user_id": user_id,
                "message": "New user credentials stored successfully",
                "existing_user": False
            }
            
        except Exception as e:
            logger.error(f"Step 1 Error - Credentials storage failed: {e}")
            return {"success": False, "error": str(e)}

    # ========== STEP 2: BIOMETRIC & LIVENESS ==========
    async def store_biometric_data(self, user_id: str, biometric_data: Dict) -> Dict:
        """
        Step 2: Store biometric and liveness data with face image URL
        """
        try:
              # Force flush stdout to see prints immediately
            print(f"DEBUG - store_biometric_data called for user: {user_id}", flush=True)
            print(f"DEBUG - biometric_data keys: {list(biometric_data.keys())}", flush=True)
            print(f"DEBUG - face_url: {biometric_data.get('face_url', 'NOT PROVIDED')}", flush=True)
            
            # Also log to logger
            logger.info(f"Biometric data received - face_url: {biometric_data.get('face_url', 'NOT PROVIDED')}")

            # Generate face embedding
            face_embedding = self._generate_face_embedding(biometric_data['face_data'])
            
            # Get face URL if provided
            face_url = biometric_data.get('face_url', '')
            
            # Store biometric profile with face URL
            biometric_profile = {
                "user_id": user_id,
                "face_template_hash": hashlib.sha256(biometric_data['face_data'].encode()).hexdigest(),
                "face_embedding": [float(x) for x in face_embedding],
                "enrollment_quality": biometric_data['liveness_data'].get('enhanced_face_score', 0.9),
                "enrollment_device_info": {
                    "user_agent": request.headers.get("User-Agent"),
                    "timestamp": datetime.now().isoformat()
                },
                "created_at": datetime.now().isoformat()
            }
            
            # Also store face data in biometric_data table
            biometric_data_record = {
                "user_id": user_id,
                "biometric_type": "face",
                "face_embedding": [float(x) for x in face_embedding],
                "face_image_url": face_url,  # Store URL here too
                "data": {
                    "encoding": face_embedding,
                    "quality_score": biometric_data['liveness_data'].get('enhanced_face_score', 0.9)
                },
                "quality_score": biometric_data['liveness_data'].get('enhanced_face_score', 0.9),
                "capture_timestamp": datetime.now().isoformat()
            }
            
            if self.client:
                # Store biometric profile
                bio_result = self.client.table("biometric_profiles").insert(biometric_profile).execute()
                # Store in biometric_data table
                data_result = self.client.table("biometric_data").insert(biometric_data_record).execute()
                
                # Update user as biometric enrolled
                self.client.table("users").update({
                    "is_biometric_enrolled": True
                }).eq("id", user_id).execute()
                
                logger.info(f"✅ Step 2 Complete: Biometric data stored for {user_id}")
            
            return {
                "success": True,
                "message": "Biometric data stored successfully"
            }
            
        except Exception as e:
            logger.error(f"Step 2 Error - Biometric storage failed: {e}")
            return {"success": False, "error": str(e)}

    # ========== STEP 3: BEHAVIORAL PATTERNS ==========
    async def store_behavioral_pattern(self, user_id: str, behavioral_data: Dict) -> Dict:
        """
        Step 3: Store initial behavioral pattern during registration
        - Processes keystroke dynamics
        - Processes mouse movements
        - Creates baseline behavioral profile
        """
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
                logger.info(f"✅ Step 3 Complete: Behavioral pattern stored for {user_id}")
            
            return {
                "success": True,
                "message": "Behavioral pattern stored successfully",
                "pattern_stats": {
                    "keystroke_features": len(keystroke_features),
                    "mouse_features": len(mouse_features)
                }
            }
            
        except Exception as e:
            logger.error(f"Step 3 Error - Behavioral storage failed: {e}")
            return {"success": False, "error": str(e)}

    async def verify_behavioral_pattern(self, user_id: str, behavioral_data: Dict, session_id: str) -> Dict:
        """
        Step 3 Verification: Compare current behavior against stored pattern
        - Calculates similarity scores
        - Determines if auto-lock or anomaly logging is needed
        - Updates trust score
        """
        try:
            # Get stored pattern
            if not self.client:
                return {"success": False, "error": "Database not available"}
            
            pattern_result = self.client.table("behavioral_patterns") \
                .select("*") \
                .eq("user_id", user_id) \
                .eq("is_active", True) \
                .single() \
                .execute()
            
            if not pattern_result.data:
                return {
                    "success": False,
                    "error": "No behavioral profile found",
                    "similarity_score": 0,
                    "action": "profile_missing"
                }
            
            stored_pattern = pattern_result.data['pattern_data']
            
            # Process current behavioral data
            current_keystroke = self._process_keystrokes(behavioral_data.get('keystrokes', []))
            current_mouse = self._process_mouse_movements(behavioral_data.get('mouseMovements', []))
            
            # Calculate similarities
            keystroke_similarity = self._compare_keystroke_patterns(
                stored_pattern.get('keystroke_features', {}),
                current_keystroke
            )
            
            mouse_similarity = self._compare_mouse_patterns(
                stored_pattern.get('mouse_features', {}),
                current_mouse
            )
            
            # Overall similarity (weighted average)
            overall_similarity = (keystroke_similarity * 0.6 + mouse_similarity * 0.4)
            
            # Determine action based on thresholds
            action = None
            anomaly_logged = False
            
            if overall_similarity < BEHAVIORAL_THRESHOLDS['auto_lock']:
                # AUTO-LOCK: Critical mismatch
                action = 'auto_lock'
                await self._suspend_user(user_id, f"Behavioral similarity critically low: {overall_similarity:.2f}")
                await self._log_anomaly(
                    user_id, session_id, 1 - overall_similarity, 'auto_lock',
                    {'similarity': overall_similarity, 'type': 'critical_behavioral_mismatch'}
                )
                await self._update_trust_score(user_id, BEHAVIORAL_THRESHOLDS['trust_delta_bad'] * 2)
                anomaly_logged = True
                
            elif overall_similarity < BEHAVIORAL_THRESHOLDS['anomaly']:
                # LOG ANOMALY: Suspicious behavior
                action = 'anomaly_logged'
                await self._log_anomaly(
                    user_id, session_id, 1 - overall_similarity, 'monitor',
                    {'similarity': overall_similarity, 'type': 'behavioral_mismatch'}
                )
                await self._update_trust_score(user_id, BEHAVIORAL_THRESHOLDS['trust_delta_bad'])
                anomaly_logged = True
                
            else:
                # NORMAL: Good behavior
                action = 'verified'
                await self._update_trust_score(user_id, BEHAVIORAL_THRESHOLDS['trust_delta_good'])
            
            # Store session data
            await self._store_behavioral_session(
                user_id, session_id, current_keystroke, current_mouse,
                overall_similarity, keystroke_similarity, mouse_similarity,
                anomaly_logged
            )
            
            logger.info(f"✅ Behavioral verification complete for {user_id}: "
                       f"similarity={overall_similarity:.2f}, action={action}")
            
            return {
                "success": action != 'auto_lock',
                "similarity_score": round(overall_similarity, 3),
                "keystroke_similarity": round(keystroke_similarity, 3),
                "mouse_similarity": round(mouse_similarity, 3),
                "anomaly_detected": anomaly_logged,
                "anomaly_score": round(1 - overall_similarity, 3) if anomaly_logged else 0,
                "action": action,
                "thresholds": {
                    "auto_lock": BEHAVIORAL_THRESHOLDS['auto_lock'],
                    "anomaly": BEHAVIORAL_THRESHOLDS['anomaly']
                }
            }
            
        except Exception as e:
            logger.error(f"Behavioral verification error: {e}")
            return {
                "success": False,
                "error": str(e),
                "similarity_score": 0,
                "action": "error"
            }

    # ========== STEP 4: eKYC DOCUMENTS ==========
    async def store_ekyc_documents(self, user_id: str, ekyc_data: Dict) -> Dict:
        """
        Step 4: Store eKYC documents with enhanced LOCAL validation (no face matching)
        Uses OpenCV for image validation and Tesseract OCR for text extraction
        """
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
            
            # Step 1: Decode and validate images using OpenCV
            logger.info(f"🔍 Validating IC images locally for user {user_id}")
            
            # Decode images
            try:
                # Remove data URL prefix if present
                if ',' in front_base64:
                    front_base64 = front_base64.split(',')[1]
                if ',' in back_base64:
                    back_base64 = back_base64.split(',')[1]
                    
                # Decode to numpy arrays
                front_img_data = base64.b64decode(front_base64)
                back_img_data = base64.b64decode(back_base64)
                
                front_nparr = np.frombuffer(front_img_data, np.uint8)
                back_nparr = np.frombuffer(back_img_data, np.uint8)
                
                front_image = cv2.imdecode(front_nparr, cv2.IMREAD_COLOR)
                back_image = cv2.imdecode(back_nparr, cv2.IMREAD_COLOR)
                
                # Convert BGR to RGB
                front_image_rgb = cv2.cvtColor(front_image, cv2.COLOR_BGR2RGB)
                back_image_rgb = cv2.cvtColor(back_image, cv2.COLOR_BGR2RGB)
                
            except Exception as e:
                logger.error(f"Error decoding images: {e}")
                return {
                    "success": False,
                    "error": "Failed to decode IC images"
                }
            
            # Validate image quality using OpenCV
            front_validation = self._validate_ic_image_quality(front_image_rgb)
            back_validation = self._validate_ic_image_quality(back_image_rgb)
            
            if not front_validation['is_valid']:
                verification_results['validation_errors'].append(
                    f"Front IC validation failed: {', '.join(front_validation.get('failed_checks', []))}"
                )
                return {
                    "success": False,
                    "error": "IC front image quality validation failed. Please ensure image is clear with all corners visible.",
                    "validation_errors": verification_results['validation_errors']
                }
            
            if not back_validation['is_valid']:
                verification_results['validation_errors'].append(
                    f"Back IC validation failed: {', '.join(back_validation.get('failed_checks', []))}"
                )
                return {
                    "success": False,
                    "error": "IC back image quality validation failed. Please ensure image is clear with all corners visible.",
                    "validation_errors": verification_results['validation_errors']
                }
            
            # Step 2: Process with OCR
            logger.info("📝 Processing IC with Tesseract OCR")
            
            ocr_result = mykad_ocr.process_mykad_front(front_image_rgb)
            verification_results['ocr_result'] = ocr_result
            
            if not ocr_result['success']:
                verification_results['validation_errors'].append(
                    f"OCR processing failed: {ocr_result.get('error', 'Unknown error')}"
                )
                # Add debug information
                debug_text = ocr_result.get('debug_text', 'No debug text available')
                logger.error(f"OCR failed for user {user_id}. Debug text: {debug_text}")
                
                return {
                    "success": False,
                    "error": f"Could not read text from IC. Debug: {debug_text[:100]}...",
                    "validation_errors": verification_results['validation_errors']
                }
            
            # Extract information
            extracted_info = ocr_result.get('extracted_info', {})
            authenticity = ocr_result.get('authenticity', {})
            
            # Validate essential information
            if not extracted_info.get('ic_number'):
                verification_results['validation_errors'].append(
                    "Could not extract IC number from document"
                )
                return {
                    "success": False,
                    "error": "Could not extract IC number. Please ensure the IC is clearly visible.",
                    "validation_errors": verification_results['validation_errors']
                }
            
            # Enhanced IC authenticity checks
            if not self._validate_ic_authenticity(front_image_rgb, back_image_rgb, ocr_result):
                verification_results['validation_errors'].append(
                    "Document does not appear to be a valid Malaysian IC"
                )
                return {
                    "success": False,
                    "error": "Document authenticity check failed. Please upload a valid Malaysian IC.",
                    "validation_errors": verification_results['validation_errors']
                }
            
            # Check document authenticity score
            confidence = authenticity.get('authenticity_score', 0)
            if confidence < 0.6:  # Increased threshold for better security
                verification_results['validation_errors'].append(
                    f"Document authenticity score too low: {confidence:.0%}"
                )
                return {
                    "success": False,
                    "error": "Document does not appear to be a valid Malaysian IC",
                    "validation_errors": verification_results['validation_errors']
                }
            
            # Process back IC for additional validation
            back_ocr_result = mykad_ocr.process_mykad_back(back_image_rgb)
            if back_ocr_result['success']:
                # Verify IC numbers match
                if back_ocr_result.get('ic_number_back') and back_ocr_result['ic_number_back'] != extracted_info.get('ic_number'):
                    verification_results['validation_errors'].append(
                        "IC numbers on front and back do not match"
                    )
                    return {
                        "success": False,
                        "error": "IC validation failed. Front and back IC numbers do not match.",
                        "validation_errors": verification_results['validation_errors']
                    }
                
                # Check security features
                security_features = back_ocr_result.get('security_features', {})
                security_score = sum(1 for feature, present in security_features.items() if present) / len(security_features)
                
                if security_score < 0.5:  # At least half of security features should be detected
                    verification_results['validation_errors'].append(
                        "Insufficient security features detected on IC back"
                    )
                    return {
                        "success": False,
                        "error": "IC security features validation failed. Please ensure back of IC is clearly visible.",
                        "validation_errors": verification_results['validation_errors']
                    }
            
            # Step 4: Determine verification status
            # Base verification on OCR success and document authenticity only
            verification_status = 'verified' if (
                confidence >= 0.6 and 
                bool(extracted_info.get('ic_number')) and
                self._validate_ic_authenticity(front_image_rgb, back_image_rgb, ocr_result)
            ) else 'rejected'
            
            verification_results['verified'] = (verification_status == 'verified')
            
            # Step 5: Store images in Supabase storage
            storage_results = await self._store_ic_images(user_id, front_base64, back_base64)
            if not storage_results.get("front_url"):
                return {"success": False, "error": "Front IC upload failed"}
                        
            # Step 6: Store eKYC record
            front_record = {
                "user_id": user_id,
                "document_type": "ic_front",
                "id_document_url": storage_results.get('front_url', ''),
                "verification_status": verification_status,
                "extracted_info": extracted_info,
                "face_match_score": 0.0,  # No face matching
                "document_authenticity_score": confidence,
                "created_at": datetime.now().isoformat()
            }
            ekyc_records.append(front_record)
            
            back_record = {
                "user_id": user_id,
                "document_type": "ic_back",
                "id_document_url": storage_results.get('back_url', ''),
                "verification_status": verification_status,
                "created_at": datetime.now().isoformat()
            }
            ekyc_records.append(back_record)
            
            # Insert into database
            if self.client and ekyc_records:
                for record in ekyc_records:
                    self.client.table("ekyc_documents").insert(record).execute()
                
                logger.info(f"✅ Step 4 Complete: eKYC documents processed locally and stored for {user_id}")
            
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
            logger.error(f"Step 4 Error - eKYC processing failed: {e}")
            return {
                "success": False, 
                "error": str(e),
                "validation_errors": ["System error during verification"]
            }

    def upload_debug_face_file(self, user_id: str, binary_data: bytes, timestamp: int) -> str:
        """
        Uploads binary image data to Supabase Storage and returns the public URL.
        """
        try:
            filename = f"{user_id}/face_{timestamp}.jpg"

            url = f"{self.url}/storage/v1/object/biometric-faces/{filename}"

            service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not service_role_key:
                raise Exception("SUPABASE_SERVICE_ROLE_KEY not set in environment.")

            headers = {
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "image/jpeg",
                "x-upsert": "true"
            }

            response = requests.post(url, data=binary_data, headers=headers)
            logger.info(f"Upload status: {response.status_code}")

            if response.status_code in [200, 201]:
                public_url = f"{self.url}/storage/v1/object/public/biometric-faces/{filename}"
                logger.info(f"✅ Face uploaded: {public_url}")
                return public_url
            else:
                raise Exception(f"Upload failed: {response.status_code} - {response.text}")

        except Exception as e:
            logger.error(f"Upload error: {str(e)}")
            return ""
    # ========== HELPER METHODS ==========
    
    # Replace the upload_face_image method in SupabaseManager class:

    def upload_face_image(self, user_id: str, base64_image: str) -> dict:
        """
        Uploads a face image to Supabase Storage and returns the public URL.
        Fixed version that handles both parameter issues and RLS policies.
        """
        try:
            # Sanitize user ID
            safe_user_id = (
                user_id.replace("@", "_")
                    .replace(".", "_")
                    .replace("/", "_")
                    .replace("-", "_")
            )

            # Extract base64 content
            if ',' in base64_image:
                base64_content = base64_image.split(",")[1]
            else:
                base64_content = base64_image
                
            # Decode to binary
            binary_data = base64.b64decode(base64_content)
            
            # Verify it's a valid JPEG
            if len(binary_data) < 2 or binary_data[:2] != b'\xff\xd8':
                logger.error("Invalid JPEG data")
                return {"success": False, "error": "Invalid JPEG format"}

            # Create filename with timestamp
            timestamp = int(time.time())
            filename = f"{safe_user_id}/face_{timestamp}.jpg"
            
            logger.info(f"Attempting to upload: {filename}, size: {len(binary_data)} bytes")

            # Try different upload methods based on Supabase client version
            try:
                # Method 1: Try with file_options (newer versions)
                from io import BytesIO
                file_object = BytesIO(binary_data)
                
                response = self.client.storage.from_("biometric-faces").upload(
                    path=filename,
                    file=file_object,
                    file_options={
                        "content-type": "image/jpeg",
                        "upsert": "true"
                    }
                )
            except TypeError as e:
                if "'options'" in str(e) or "file_options" in str(e):
                    # Method 2: Try without file_options (older versions)
                    logger.info("Trying upload without file_options...")
                    
                    try:
                        # Try with just path and file
                        file_object = BytesIO(binary_data)
                        response = self.client.storage.from_("biometric-faces").upload(
                            filename,  # Just filename, not path=
                            file_object
                        )
                    except:
                        # Try with raw bytes
                        response = self.client.storage.from_("biometric-faces").upload(
                            filename,
                            binary_data
                        )
                else:
                    raise e

            # Check response
            if hasattr(response, 'error') and response.error:
                error_msg = str(response.error)
                logger.error(f"Supabase upload error: {error_msg}")
                
                # If RLS error, try alternative method
                if "row-level security" in error_msg or "403" in error_msg:
                    logger.info("RLS error detected, trying direct API method...")
                    return self.upload_face_image_direct_api(user_id, base64_image, binary_data, filename)
                
                return {"success": False, "error": error_msg}
            
            if isinstance(response, dict):
                if response.get("error"):
                    error_msg = response["error"].get("message", str(response["error"]))
                    logger.error(f"Supabase upload error: {error_msg}")
                    
                    # If RLS error, try alternative method
                    if "row-level security" in error_msg or "403" in error_msg:
                        logger.info("RLS error detected, trying direct API method...")
                        return self.upload_face_image_direct_api(user_id, base64_image, binary_data, filename)
                    
                    return {"success": False, "error": error_msg}
                
                # Success response might have a 'path' key
                if response.get("path"):
                    public_url = self.client.storage.from_("biometric-faces").get_public_url(filename)
                    logger.info(f"✅ Face uploaded successfully: {public_url}")
                    return {"success": True, "public_url": public_url}

            # If we get here, assume success and get public URL
            public_url = self.client.storage.from_("biometric-faces").get_public_url(filename)
            logger.info(f"✅ Face uploaded successfully: {public_url}")
            return {"success": True, "public_url": public_url}

        except Exception as e:
            logger.error(f"Upload error: {str(e)}")
            # Try direct API as last resort
            return self.upload_face_image_direct_api(user_id, base64_image, None, None)

    def upload_face_image_direct_api(self, user_id: str, base64_image: str, binary_data=None, filename=None):
        """
        Direct API upload method that bypasses RLS by using service key
        """
        try:
            import requests
            
            # Prepare data if not provided
            if binary_data is None:
                if ',' in base64_image:
                    base64_content = base64_image.split(",")[1]
                else:
                    base64_content = base64_image
                binary_data = base64.b64decode(base64_content)
            
            if filename is None:
                filename = f"{user_id}/face_{int(time.time())}.jpg"

            # Use service key for authentication (bypasses RLS)
            url = f"{self.url}/storage/v1/object/biometric-faces/{filename}"
            headers = {
                "Authorization": f"Bearer {self.role_key}",  # Service key bypasses RLS
                "Content-Type": "image/jpeg",
                "x-upsert": "true"  # Allow overwriting
            }
            
            response = requests.post(url, data=binary_data, headers=headers)
            
            logger.info(f"Direct API response: {response.status_code}")
            
            if response.status_code in [200, 201]:
                # Construct public URL
                public_url = f"{self.url}/storage/v1/object/public/biometric-faces/{filename}"
                logger.info(f"✅ Face uploaded via direct API: {public_url}")
                return {"success": True, "public_url": public_url}
            else:
                error_msg = f"Status {response.status_code}: {response.text}"
                logger.error(f"Direct API upload failed: {error_msg}")
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            logger.error(f"Direct API error: {str(e)}")
            return {"success": False, "error": str(e)}

    def _generate_face_embedding(self, face_data_b64: str) -> List[float]:
        """Generate face embedding for recognition"""
        try:
            # Remove data URL prefix if present
            if face_data_b64.startswith("data:image"):
                face_data_b64 = face_data_b64.split(",")[1]
            
            # Decode image
            img_data = base64.b64decode(face_data_b64)
            nparr = np.frombuffer(img_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Generate embedding
            face_encodings = face_recognition.face_encodings(rgb_image)
            if face_encodings:
                return face_encodings[0].tolist()
            else:
                return [0] * 128  # Default embedding
                
        except Exception as e:
            logger.error(f"Face embedding error: {e}")
            return [0] * 128

    def _process_keystrokes(self, keystrokes: List[Dict]) -> Dict:
        """Process keystroke dynamics for behavioral analysis"""
        if not keystrokes:
            return {}
        
        features = {}
        
        # Basic metrics
        features['total_keystrokes'] = len(keystrokes)
        
        # Separate event types
        keydown_events = [k for k in keystrokes if k.get('type') == 'keydown']
        keyup_events = [k for k in keystrokes if k.get('type') == 'keyup']
        
        # Calculate dwell times (key hold duration)
        dwell_times = []
        for keydown in keydown_events:
            matching_keyup = next(
                (up for up in keyup_events 
                 if up['key'] == keydown['key'] and up['timestamp'] > keydown['timestamp']),
                None
            )
            if matching_keyup:
                dwell_time = matching_keyup['timestamp'] - keydown['timestamp']
                if 0 < dwell_time < 1000:  # Reasonable limits
                    dwell_times.append(dwell_time)
        
        if dwell_times:
            features['avg_dwell_time'] = np.mean(dwell_times)
            features['std_dwell_time'] = np.std(dwell_times)
        
        # Calculate flight times (time between keystrokes)
        flight_times = []
        for i in range(1, len(keydown_events)):
            flight_time = keydown_events[i]['timestamp'] - keydown_events[i-1]['timestamp']
            if 0 < flight_time < 2000:  # Reasonable limits
                flight_times.append(flight_time)
        
        if flight_times:
            features['avg_flight_time'] = np.mean(flight_times)
            features['std_flight_time'] = np.std(flight_times)
            features['typing_speed'] = 60000 / np.mean(flight_times) if flight_times else 0  # Keys per minute
        
        return features

    def _process_mouse_movements(self, movements: List[Dict]) -> Dict:
        """Process mouse movement patterns"""
        if not movements:
            return {}
        
        features = {}
        
        # Separate event types
        move_events = [m for m in movements if m.get('type') == 'mousemove']
        click_events = [m for m in movements if m.get('type') == 'click']
        
        features['total_movements'] = len(movements)
        features['total_clicks'] = len(click_events)
        
        if len(move_events) > 1:
            # Calculate velocities
            velocities = []
            for i in range(1, len(move_events)):
                curr = move_events[i]
                prev = move_events[i-1]
                
                time_diff = (curr['timestamp'] - prev['timestamp']) / 1000.0  # Convert to seconds
                if time_diff > 0:
                    distance = np.sqrt((curr['x'] - prev['x'])**2 + (curr['y'] - prev['y'])**2)
                    velocity = distance / time_diff
                    velocities.append(velocity)
            
            if velocities:
                features['avg_velocity'] = np.mean(velocities)
                features['std_velocity'] = np.std(velocities)
                features['max_velocity'] = max(velocities)
        
        # Click intervals
        if len(click_events) > 1:
            click_intervals = []
            for i in range(1, len(click_events)):
                interval = click_events[i]['timestamp'] - click_events[i-1]['timestamp']
                click_intervals.append(interval)
            
            if click_intervals:
                features['avg_click_interval'] = np.mean(click_intervals)
        
        return features

    def _compare_keystroke_patterns(self, stored: Dict, current: Dict) -> float:
        """Compare two keystroke patterns and return similarity score (0-1)"""
        if not stored or not current:
            return 0.5  # Default neutral score
        
        similarities = []
        
        # Compare key features
        features_to_compare = ['avg_dwell_time', 'avg_flight_time', 'typing_speed']
        
        for feature in features_to_compare:
            if feature in stored and feature in current:
                stored_val = float(stored[feature])
                current_val = float(current[feature])
                
                if stored_val == 0 and current_val == 0:
                    similarity = 1.0
                elif stored_val == 0 or current_val == 0:
                    similarity = 0.5
                else:
                    # Calculate normalized difference
                    diff = abs(stored_val - current_val) / max(stored_val, current_val)
                    similarity = max(0, 1 - diff)
                
                similarities.append(similarity)
        
        return np.mean(similarities) if similarities else 0.5

    def _compare_mouse_patterns(self, stored: Dict, current: Dict) -> float:
        """Compare two mouse patterns and return similarity score (0-1)"""
        if not stored or not current:
            return 0.5  # Default neutral score
        
        similarities = []
        
        # Compare key features
        features_to_compare = ['avg_velocity', 'avg_click_interval']
        
        for feature in features_to_compare:
            if feature in stored and feature in current:
                stored_val = float(stored[feature])
                current_val = float(current[feature])
                
                if stored_val == 0 and current_val == 0:
                    similarity = 1.0
                elif stored_val == 0 or current_val == 0:
                    similarity = 0.5
                else:
                    # Calculate normalized difference
                    diff = abs(stored_val - current_val) / max(stored_val, current_val)
                    similarity = max(0, 1 - diff)
                
                similarities.append(similarity)
        
        return np.mean(similarities) if similarities else 0.5

    def _generate_device_fingerprint(self, request) -> str:
        """Generate device fingerprint from request"""
        components = [
            request.headers.get("User-Agent", ""),
            request.headers.get("Accept-Language", ""),
            request.headers.get("Accept-Encoding", ""),
            request.remote_addr
        ]
        return hashlib.md5("".join(components).encode()).hexdigest()

    async def _store_behavioral_session(self, user_id: str, session_id: str,
                                      keystroke_features: Dict, mouse_features: Dict,
                                      overall_similarity: float, keystroke_similarity: float,
                                      mouse_similarity: float, anomaly_detected: bool):
        """Store behavioral session data"""
        try:
            session_data = {
                "user_id": user_id,
                "session_id": session_id,
                "keystroke_features": keystroke_features,
                "mouse_features": mouse_features,
                "similarity_scores": {
                    "overall_similarity": overall_similarity,
                    "keystroke_similarity": keystroke_similarity,
                    "mouse_similarity": mouse_similarity
                },
                "anomaly_score": 1 - overall_similarity,
                "is_successful": not anomaly_detected,
                "duration_seconds": 0,  # Can be calculated from timestamps if needed
                "created_at": datetime.now().isoformat()
            }
            
            if self.client:
                self.client.table("behavioral_sessions").insert(session_data).execute()
                
        except Exception as e:
            logger.error(f"Failed to store behavioral session: {e}")

    async def _log_anomaly(self, user_id: str, session_id: str, 
                         anomaly_score: float, action: str, details: Dict):
        """Log anomaly to anomaly_audits table"""
        try:
            # Determine severity based on score
            if anomaly_score > 0.9:
                severity = 'critical'
            elif anomaly_score > 0.7:
                severity = 'high'
            elif anomaly_score > 0.5:
                severity = 'medium'
            else:
                severity = 'low'
            
            anomaly_data = {
                "user_id": user_id,
                "session_id": session_id,
                "anomaly_type": details.get('type', 'behavioral_anomaly'),
                "anomaly_score": anomaly_score,
                "severity": severity,
                "action_taken": action,
                "details": details,
                "created_at": datetime.now().isoformat()
            }
            
            if self.client:
                self.client.table("anomaly_audits").insert(anomaly_data).execute()
                logger.info(f"Anomaly logged for user {user_id}: {severity} severity, action={action}")
                
        except Exception as e:
            logger.error(f"Failed to log anomaly: {e}")

    async def _update_trust_score(self, user_id: str, delta: int):
        """Update user trust score"""
        try:
            if not self.client:
                return
            
            # Get current score
            user_result = self.client.table("users") \
                .select("trust_score") \
                .eq("id", user_id) \
                .single() \
                .execute()
            
            if user_result.data:
                current_score = user_result.data['trust_score']
                new_score = max(0, min(100, current_score + delta))
                
                self.client.table("users") \
                    .update({"trust_score": new_score}) \
                    .eq("id", user_id) \
                    .execute()
                
                logger.info(f"Trust score updated for {user_id}: {current_score} → {new_score}")
                
        except Exception as e:
            logger.error(f"Failed to update trust score: {e}")

    async def _suspend_user(self, user_id: str, reason: str):
        """Suspend user account"""
        try:
            if self.client:
                self.client.table("users").update({
                    "status": "suspended",
                    "suspension_reason": reason,
                    "suspended_at": datetime.now().isoformat()
                }).eq("id", user_id).execute()
                
                logger.warning(f"🔒 User {user_id} suspended: {reason}")
                
        except Exception as e:
            logger.error(f"Failed to suspend user: {e}")

    def _validate_ic_image_quality(self, image_rgb):
        """
        Validate IC image quality using OpenCV
        Returns dict with validation results
        """
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
            
            # Check blur/sharpness using Laplacian variance
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
        """
        Validate IC authenticity using OCR results and image analysis
        """
        try:
            authenticity = ocr_result.get('authenticity', {})
            
            # Check if authenticity score meets minimum threshold
            auth_score = authenticity.get('authenticity_score', 0)
            if auth_score < 0.6:
                return False
            
            # Check if required keywords are found
            found_keywords = authenticity.get('found_keywords', [])
            required_keywords = ['MALAYSIA', 'MYKAD', 'WARGANEGARA']
            
            # At least one required keyword should be found
            has_required_keyword = any(keyword in found_keywords for keyword in required_keywords)
            
            return has_required_keyword and auth_score >= 0.6
            
        except Exception as e:
            logger.error(f"IC authenticity validation error: {e}")
            return False

    async def _store_ic_images(self, user_id: str, front_base64: str, back_base64: str) -> Dict:
        """
        Store IC images in Supabase storage
        Returns dict with storage URLs
        """
        try:
            storage_results = {'front_url': '', 'back_url': ''}
            
            if not self.client:
                logger.warning("No Supabase client - skipping image storage")
                return storage_results
            
            # Upload front image
            try:
                front_result = self.upload_face_image(user_id, f"data:image/jpeg;base64,{front_base64}")
                if front_result.get('success'):
                    storage_results['front_url'] = front_result['public_url']
                    logger.info(f"✅ IC front image uploaded: {storage_results['front_url']}")
            except Exception as e:
                logger.error(f"Failed to upload front IC: {e}")
            
            # Upload back image
            try:
                back_result = self.upload_face_image(user_id, f"data:image/jpeg;base64,{back_base64}")
                if back_result.get('success'):
                    storage_results['back_url'] = back_result['public_url']
                    logger.info(f"✅ IC back image uploaded: {storage_results['back_url']}")
            except Exception as e:
                logger.error(f"Failed to upload back IC: {e}")
            
            return storage_results
            
        except Exception as e:
            logger.error(f"IC storage error: {e}")
            return {'front_url': '', 'back_url': ''}

