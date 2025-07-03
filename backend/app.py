# backend/app_refactored.py
# Clean implementation of 4-step multimodal biometric authentication

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import base64
import logging
import os
import sys
import time
import asyncio
from datetime import datetime
from typing import Dict, Optional, Tuple, List
from dataclasses import dataclass, asdict
import json
import hashlib
import bcrypt
from concurrent.futures import ThreadPoolExecutor
import threading
import face_recognition

# Supabase imports
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import optimized detector
sys.path.append(os.path.join(os.path.dirname(__file__), 'ml_models'))
from ml_models.liveness_detector import (
    process_frame_api,
    initialize_detector,
    DETECTOR
)

# Flask App
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


def convert_numpy_types(obj):
    """
    Recursively convert NumPy data types in a dict to native Python types
    """
    if isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(v) for v in obj]
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    else:
        return obj


# Thread pool for async processing
executor = ThreadPoolExecutor(max_workers=4)

# ===== CONFIGURATION =====
BEHAVIORAL_THRESHOLDS = {
    'auto_lock': 0.3,      # Below this = auto-lock account
    'anomaly': 0.6,        # Below this = log anomaly
    'trust_delta_good': 1,  # Trust score increase for good behavior
    'trust_delta_bad': -10  # Trust score decrease for anomalies
}

# ===== DATABASE MANAGER =====
class SupabaseManager:
    """Manages all Supabase database operations"""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.service_key = os.getenv("SUPABASE_SERVICE_KEY")
        
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
        - Hashes password with bcrypt
        - Creates user record in users table
        """
        try:
            # Generate user ID
            user_id = f"user_{hashlib.md5(user_data['email'].encode()).hexdigest()[:8]}_{int(time.time())}"
            
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
                "trust_score": 85,  # Initial trust score
                "status": "active",
                "created_at": datetime.now().isoformat()
            }
            
            if self.client:
                result = self.client.table("users").insert(user_record).execute()
                logger.info(f"✅ Step 1 Complete: User credentials stored for {user_id}")
            
            return {
                "success": True,
                "user_id": user_id,
                "message": "Credentials stored successfully"
            }
            
        except Exception as e:
            logger.error(f"Step 1 Error - Credentials storage failed: {e}")
            return {"success": False, "error": str(e)}

    # ========== STEP 2: BIOMETRIC & LIVENESS ==========
    async def store_biometric_data(self, user_id: str, biometric_data: Dict) -> Dict:
        """
        Step 2: Store biometric and liveness data
        - Stores face embedding
        - Records liveness detection results
        """
        try:
            # Generate face embedding
            face_embedding = self._generate_face_embedding(biometric_data['face_data'])
            
            # Store biometric profile
            biometric_profile = {
                "user_id": user_id,
                "face_template_hash": hashlib.sha256(biometric_data['face_data'].encode()).hexdigest(),
                "face_embedding": face_embedding,
                "enrollment_quality": biometric_data['liveness_data'].get('enhanced_face_score', 0.9),
                "enrollment_device_info": {
                    "user_agent": request.headers.get("User-Agent"),
                    "timestamp": datetime.now().isoformat()
                },
                "created_at": datetime.now().isoformat()
            }
            
            # Store liveness data
            liveness_record = {
                "user_id": user_id,
                "session_id": f"reg_{user_id}_{int(time.time())}",
                "blink_count": biometric_data['liveness_data']['blink_count'],
                "mouth_open_count": biometric_data['liveness_data']['mouth_open_count'],
                "head_movement_count": biometric_data['liveness_data']['head_movement_count'],
                "face_real_score": biometric_data['liveness_data']['face_real_score'],
                "enhanced_score": biometric_data['liveness_data'].get('enhanced_face_score', 0),
                "overall_passed": biometric_data['liveness_data']['liveness_validation']['overall_liveness_passed'],
                "step_requirements": biometric_data['liveness_data']['liveness_validation']['step_requirements'],
                "mode": "registration",
                "created_at": datetime.now().isoformat()
            }
            
            if self.client:
                # Store biometric profile
                bio_result = self.client.table("biometric_profiles").insert(biometric_profile).execute()
                # Store liveness data
                liveness_result = self.client.table("liveness_data").insert(liveness_record).execute()
                
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
        Step 4: Store eKYC documents
        - Stores document URLs
        - Records verification status
        """
        try:
            ekyc_records = []
            
            # Store front document
            if ekyc_data.get('frontUrl'):
                front_record = {
                    "user_id": user_id,
                    "document_type": "ic_front",
                    "document_url": ekyc_data['frontUrl'],
                    "verification_status": "pending",
                    "created_at": datetime.now().isoformat()
                }
                ekyc_records.append(front_record)
            
            # Store back document
            if ekyc_data.get('backUrl'):
                back_record = {
                    "user_id": user_id,
                    "document_type": "ic_back",
                    "document_url": ekyc_data['backUrl'],
                    "verification_status": "pending",
                    "created_at": datetime.now().isoformat()
                }
                ekyc_records.append(back_record)
            
            if self.client and ekyc_records:
                for record in ekyc_records:
                    self.client.table("ekyc_documents").insert(record).execute()
                
                logger.info(f"✅ Step 4 Complete: eKYC documents stored for {user_id}")
            
            return {
                "success": True,
                "message": "eKYC documents stored successfully",
                "documents_count": len(ekyc_records)
            }
            
        except Exception as e:
            logger.error(f"Step 4 Error - eKYC storage failed: {e}")
            return {"success": False, "error": str(e)}

    # ========== HELPER METHODS ==========
    
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

# Initialize Supabase manager
supabase_manager = SupabaseManager()

# ===== API ENDPOINTS =====

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'online',
        'detector_available': DETECTOR is not None,
        'supabase_available': supabase_manager.client is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/register', methods=['POST'])
def register():
    """
    Complete registration endpoint - Orchestrates all 4 steps
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['username', 'email', 'password', 'faceData', 'livenessData', 'behavioralData', 'ekycFiles']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        logger.info(f"📝 Starting registration for {data['email']}")
        
        # Step 1: Store user credentials
        credentials_result = asyncio.run(
            supabase_manager.store_user_credentials({
                'username': data['username'],
                'email': data['email'],
                'password': data['password']
            })
        )
        
        if not credentials_result['success']:
            return jsonify(credentials_result), 400
        
        user_id = credentials_result['user_id']
        
        # Step 2: Store biometric data
        biometric_result = asyncio.run(
            supabase_manager.store_biometric_data(user_id, {
                'face_data': data['faceData'],
                'liveness_data': data['livenessData']
            })
        )
        
        if not biometric_result['success']:
            return jsonify(biometric_result), 400
        
        # Step 3: Store behavioral pattern
        behavioral_result = asyncio.run(
            supabase_manager.store_behavioral_pattern(user_id, data['behavioralData'])
        )
        
        if not behavioral_result['success']:
            return jsonify(behavioral_result), 400
        
        # Step 4: Store eKYC documents
        ekyc_result = asyncio.run(
            supabase_manager.store_ekyc_documents(user_id, data['ekycFiles'])
        )
        
        if not ekyc_result['success']:
            return jsonify(ekyc_result), 400
        
        # All steps completed successfully
        logger.info(f"✅ Registration completed successfully for {user_id}")
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'message': 'Registration completed successfully',
            'steps_completed': {
                'credentials': True,
                'biometric': True,
                'behavioral': True,
                'ekyc': True
            }
        })
        
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/behavioral-verify', methods=['POST'])
def behavioral_verify():
    """
    Behavioral verification endpoint - Used during login and continuous monitoring
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData')
        typed_text = data.get('typedText', '')
        session_id = data.get('session_id', f"verify_{user_id}_{int(time.time())}")
        
        if not user_id or not behavioral_data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: user_id and behavioralData'
            }), 400
        
        # For strict verification, ensure the reference sentence is typed correctly
        REFERENCE_SENTENCE = "The quick brown fox jumps over the lazy dog."
        if typed_text and typed_text != REFERENCE_SENTENCE:
            return jsonify({
                'success': False,
                'error': 'Text mismatch. Please type the exact sentence.',
                'expected': REFERENCE_SENTENCE,
                'received': typed_text
            }), 400
        
        logger.info(f"🔍 Starting behavioral verification for {user_id}")
        
        # Perform verification
        result = asyncio.run(
            supabase_manager.verify_behavioral_pattern(user_id, behavioral_data, session_id)
        )
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Behavioral verification error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/behavioral-monitor', methods=['POST'])
def behavioral_monitor():
    """
    Continuous behavioral monitoring endpoint - Non-blocking background processing
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData', {})
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Process in background (non-blocking)
        executor.submit(
            asyncio.run,
            supabase_manager.verify_behavioral_pattern(
                user_id, 
                behavioral_data, 
                f"monitor_{user_id}_{int(time.time())}"
            )
        )
        
        return jsonify({
            'success': True,
            'message': 'Behavioral data queued for processing'
        })
        
    except Exception as e:
        logger.error(f"Monitor error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/behavioral-analytics/<user_id>', methods=['GET'])
def get_behavioral_analytics(user_id: str):
    """
    Get user's behavioral analytics summary
    """
    try:
        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        # Get recent sessions
        sessions_result = supabase_manager.client.table('behavioral_sessions') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(50) \
            .execute()
        
        # Get anomalies
        anomalies_result = supabase_manager.client.table('anomaly_audits') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(20) \
            .execute()
        
        sessions = sessions_result.data or []
        anomalies = anomalies_result.data or []
        
        # Calculate analytics
        analytics = {
            'total_sessions': len(sessions),
            'successful_sessions': len([s for s in sessions if s.get('is_successful')]),
            'total_anomalies': len(anomalies),
            'recent_anomalies': len([
                a for a in anomalies 
                if datetime.fromisoformat(a['created_at'].replace('Z', '+00:00')) > 
                   datetime.now() - time(days=7)
            ]),
            'avg_similarity_score': np.mean([
                s.get('similarity_scores', {}).get('overall_similarity', 0) 
                for s in sessions if s.get('similarity_scores')
            ]) if sessions else 0,
            'sessions': sessions[:10],  # Return latest 10 sessions
            'anomalies': anomalies[:5]   # Return latest 5 anomalies
        }
        
        return jsonify({
            'success': True,
            'analytics': analytics
        })
        
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ===== ENHANCED SESSION MANAGEMENT =====
@dataclass
class EnhancedLivenessSession:
    user_id: str
    start_time: float
    mode: str = "registration"
    current_step: str = "ready"
    required_blinks: int = 3
    required_mouth: int = 2
    required_head: int = 2
    required_score: float = 0.85
    all_requirements_met: bool = False
    completion_time: float = 0.0
    last_face_score: float = 0.0
    last_enhanced_score: float = 0.0
    registration_data: dict = None  # Store registration data temporarily

USER_SESSIONS = {}
session_lock = threading.Lock()

@app.route('/api/sequential-liveness-detect', methods=['POST'])
def sequential_liveness_detect_optimized():
    """Optimized liveness detection endpoint"""
    try:
        data = request.get_json()
        user_id = data.get("user_id", "default_user")
        mode = data.get("mode", "registration")
        reset_counters = data.get("reset_counters", False)
        current_step = data.get("current_step", "ready")
        face_image_b64 = data.get("face_image")

        if not face_image_b64:
            return jsonify({'success': False, 'error': 'Face image required'}), 400

        # Get or create session
        with session_lock:
            if reset_counters or user_id not in USER_SESSIONS:
                USER_SESSIONS[user_id] = EnhancedLivenessSession(
                    user_id=user_id,
                    start_time=time.time(),
                    mode=mode,
                    required_blinks=3 if mode == "registration" else 2,
                    required_mouth=2 if mode == "registration" else 1
                )
                DETECTOR.reset_user_counters(user_id)
            
            session = USER_SESSIONS[user_id]
            session.current_step = current_step

        # If requirements already met, return cached response
        if session.all_requirements_met:
            return jsonify({
                'success': True,
                'blink_count': session.required_blinks,
                'mouth_open_count': session.required_mouth,
                'head_movement_count': session.required_head,
                'face_real_score': session.last_face_score,
                'enhanced_face_score': session.last_enhanced_score,
                'liveness_validation': {
                    'overall_liveness_passed': True,
                    'step_requirements': {
                        'blinks_met': True,
                        'mouth_met': True,
                        'head_met': True,
                        'score_met': True
                    }
                },
                'all_completed': True,
                'cached_response': True
            })

        # Process frame with requirements
        requirements = {
            'blinks': session.required_blinks,
            'mouth': session.required_mouth,
            'head': session.required_head
        }
        
        # Process frame
        result = process_frame_api(face_image_b64, user_id, reset_counters)

        if result['success']:
            # Update session
            session.last_face_score = result['face_real_score']
            session.last_enhanced_score = result.get('enhanced_face_score', result['face_real_score'])
            
            # Check completion
            actions_completed = result.get('actions_completed', {})
            step_requirements = {
                'blinks_met': result['blink_count'] >= session.required_blinks or actions_completed.get('blinks', False),
                'mouth_met': result['mouth_open_count'] >= session.required_mouth or actions_completed.get('mouth', False),
                'head_met': result['head_movement_count'] >= session.required_head or actions_completed.get('head', False),
                'score_met': session.last_enhanced_score > session.required_score
            }
            
            all_met = all(step_requirements.values())
            if all_met and not session.all_requirements_met:
                session.all_requirements_met = True
                session.completion_time = time.time() - session.start_time
                logger.info(f"✅ User {user_id} completed all requirements in {session.completion_time:.2f}s")

            # Build response
            response_data = {
                'success': True,
                'face_detected': result.get('face_detected', True),
                'blink_count': min(result['blink_count'], session.required_blinks),
                'mouth_open_count': min(result['mouth_open_count'], session.required_mouth),
                'head_movement_count': min(result['head_movement_count'], session.required_head),
                'face_real_score': result['face_real_score'],
                'enhanced_face_score': session.last_enhanced_score,
                'processing_time': result.get('processing_time', 0),
                'liveness_validation': {
                    'overall_liveness_passed': all_met,
                    'step_requirements': step_requirements,
                    'current_step': current_step,
                    'mode': mode
                },
                'all_completed': session.all_requirements_met
            }
            
            return jsonify(response_data)
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Detection error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 MULTIMODAL BIOMETRIC AUTHENTICATION SYSTEM")
    print("=" * 60)
    print("Step 1: User Credentials ✅")
    print("Step 2: Liveness Detection ✅")
    print("Step 3: Behavioral Patterns ✅")
    print("Step 4: eKYC Verification ✅")
    print("-" * 60)
    
    # Initialize detector
    print("Initializing liveness detector...")
    initialize_detector()
    
    # Check Supabase
    if supabase_manager.client:
        print("✅ Supabase connected")
    else:
        print("⚠️ Running in mock mode (no Supabase)")
    
    print("-" * 60)
    print("📡 Server running on http://localhost:5000")
    print("=" * 60)
    
    app.run(debug=False, host="0.0.0.0", port=5000, threaded=True)