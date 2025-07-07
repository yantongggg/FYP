# backend/app.py

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, make_response
import numpy as np
import cv2
import base64
import logging
import os
import sys
import time
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple, List
from dataclasses import dataclass, asdict
import json
import hashlib
import bcrypt
from concurrent.futures import ThreadPoolExecutor
import threading
import face_recognition
import requests
from typing import Dict, Optional, Tuple
from supabase import create_client, Client
from utils.ocr_utils import MyKadOCR
from utils.image_utils import decode_base64_image
from io import BytesIO
from ml_models.liveness_detector import LivenessDetector, initialize_models
from utils.supabase_manager import SupabaseManager
from ml_models.face_verification import FaceVerificationModel
from flask_cors import CORS, cross_origin


supabase_manager = SupabaseManager()




# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import optimized detector - Remove the incorrect import
sys.path.append(os.path.join(os.path.dirname(__file__), 'ml_models'))

# Initialize MyKadOCR (add this after other initializations) - Mock if not available
try:
    from utils.ocr_utils import MyKadOCR
    mykad_ocr = MyKadOCR()
except ImportError:
    logger.warning("MyKadOCR not available - using mock implementation")
    class MockMyKadOCR:
        def process_mykad_front(self, image):
            return {
                'success': True,
                'extracted_info': {'ic_number': '123456-78-9012'},
                'authenticity': {'authenticity_score': 0.8, 'found_keywords': ['MALAYSIA']}
            }
    mykad_ocr = MockMyKadOCR()

try:
    face_verifier = FaceVerificationModel()
    logger.info("✅ Face verification model initialized")
except Exception as e:
    logger.error(f"⚠️ Could not initialize face verification model: {e}")
    face_verifier = None

# Flask App
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000", 
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:5173",  # Vite dev server
            "http://127.0.0.1:5173"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": [
            "Content-Type", 
            "Authorization", 
            "Access-Control-Allow-Credentials",
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Headers",
            "Access-Control-Allow-Methods",
            "X-Requested-With"
        ],
        "supports_credentials": False,  # Set to False to avoid credentials issues
        "expose_headers": ["Content-Type", "Authorization"],
        "max_age": 86400  # 24 hours
    }
})


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



# ============= API Helper Functions =============


def initialize_detector():
    """Initialize the liveness detector models"""
    initialize_models()
    if 'DETECTOR' in globals():
        DETECTOR.reset_counters()

def process_base64_image(base64_str):
    """Convert base64 string to OpenCV image"""
    if base64_str.startswith("data:image"):
        base64_str = base64_str.split(",")[1]
    img_data = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def process_liveness_request(frame_data: str, reset_counters: bool = False):
    """Process liveness detection request (legacy function)"""
    if reset_counters and 'DETECTOR' in globals():
        DETECTOR.reset_counters()
    frame = process_base64_image(frame_data)
    return DETECTOR.process_frame(frame)

def process_frame_api(face_image_b64: str, user_id: str = None, reset_counters: bool = False):
    """Process frame for liveness detection with user-specific tracking"""
    try:
        if user_id is None:
            user_id = "default_user"

        if reset_counters and 'DETECTOR' in globals():
            DETECTOR.reset_user_counters(user_id)

        frame = process_base64_image(face_image_b64)
        result = DETECTOR.process_frame_for_user(frame, user_id)

        # Build liveness_validation field to match frontend expectations
        step_requirements = {
            'blinks_met': result['blink_count'] >= 3,
            'mouth_met': result['mouth_open_count'] >= 2,
            'head_met': result['head_movement_count'] >= 2,
            'score_met': result['face_real_score'] >= 0.2
        }
        all_met = all(step_requirements.values())

        result['liveness_validation'] = {
            'overall_liveness_passed': all_met,
            'step_requirements': step_requirements
        }

        return result

    except Exception as e:
        logger.error(f"process_frame_api error: {e}")
        return {
            "success": False,
            "error": str(e),
            "face_detected": False,
            "blink_count": 0,
            "mouth_open_count": 0,
            "head_movement_count": 0,
            "face_real_score": 0.0,
            "liveness_validation": {
                "overall_liveness_passed": False,
                "step_requirements": {
                    "blinks_met": False,
                    "mouth_met": False,
                    "head_met": False,
                    "score_met": False
                }
            }
        }



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

# ===== API ENDPOINTS =====

# ============= MANUAL CORS HEADERS =============
@app.after_request
def after_request(response):
    # Get the origin from the request
    origin = request.headers.get('Origin')
    
    # List of allowed origins
    allowed_origins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001', 
        'http://127.0.0.1:3001',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ]
    
    # If origin is in allowed list, add CORS headers
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '86400'
        # Do NOT set Access-Control-Allow-Credentials to avoid issues
    
    return response

# ============= PREFLIGHT HANDLER =============
@app.before_request  
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        origin = request.headers.get('Origin')
        
        allowed_origins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001', 
            'http://127.0.0.1:3001',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ]
        
        if origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", origin)
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Max-Age', '86400')
        
        return response

@app.route('/api/health', methods=['GET', 'OPTIONS'])
@cross_origin()
def health_check():
    """Enhanced health check endpoint"""
    return jsonify({
        'status': 'online',
        'detector_available': 'DETECTOR' in globals() and DETECTOR is not None,
        'supabase_available': supabase_manager.client is not None,
        'face_verifier_available': 'face_verifier' in globals() and face_verifier is not None,
        'timestamp': datetime.now().isoformat(),
        'cors_test': 'success'
    })

@app.route('/api/check-user', methods=['POST'])
def check_user():
    """
    Check if a user already exists by username or email
    Used before registration to prevent duplicates
    """
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        
        if not username and not email:
            return jsonify({
                'success': False,
                'error': 'Username or email is required'
            }), 400
        
        logger.info(f"🔍 Checking if user exists: username='{username}', email='{email}'")
        
        if not supabase_manager.client:
            # Mock mode - simulate user check
            return jsonify({
                'success': True,
                'exists': False,
                'message': 'Mock mode - user does not exist'
            })
        
        # Build query conditions
        query_conditions = []
        if username:
            query_conditions.append(f"username.eq.{username}")
        if email:
            query_conditions.append(f"email.eq.{email}")
        
        # Query database for existing user
        user_result = supabase_manager.client.table("users") \
            .select("id, username, email, status, is_biometric_enrolled, created_at") \
            .or_("|".join(query_conditions)) \
            .execute()
        
        if user_result.data and len(user_result.data) > 0:
            # User exists
            existing_user = user_result.data[0]
            
            # Determine what matched
            matched_fields = []
            if existing_user['username'] == username:
                matched_fields.append('username')
            if existing_user['email'] == email:
                matched_fields.append('email')
            
            logger.info(f"✅ User found: {existing_user['id']} (matched: {', '.join(matched_fields)})")
            
            return jsonify({
                'success': True,
                'exists': True,
                'user_info': {
                    'id': existing_user['id'],
                    'username': existing_user['username'],
                    'email': existing_user['email'],
                    'status': existing_user['status'],
                    'is_biometric_enrolled': existing_user['is_biometric_enrolled'],
                    'created_at': existing_user['created_at']
                },
                'matched_fields': matched_fields,
                'message': f"User exists (matched: {', '.join(matched_fields)})"
            })
        else:
            # User does not exist
            logger.info(f"✅ No existing user found for username='{username}', email='{email}'")
            
            return jsonify({
                'success': True,
                'exists': False,
                'message': 'User does not exist - registration can proceed'
            })
            
    except Exception as e:
        logger.error(f"Error checking user existence: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to check user existence'
        }), 500

@app.route('/api/register', methods=['POST'])
def register():
    """
    Complete registration endpoint - Orchestrates all 4 steps
    """
    try:
        data = request.get_json()
        print("DEBUG - Request JSON:", data)
        
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
            supabase_manager.store_biometric_data(
                user_id, 
                {
                    "face_data": data['faceData'],
                    "liveness_data": data['livenessData'],
                    "face_url": data.get('faceUrl', '')
                },
                request.headers.get("User-Agent")
            )
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
        
        # Extract verification results
        verification_results = ekyc_result.get('verification', {})

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

@app.route("/api/upload-face", methods=["POST"])
def upload_face():
    try:
        data = request.get_json()
        user_id = data["user_id"]

        # Read debug_face.jpg from disk
        if not os.path.exists("debug_face.jpg"):
            return jsonify({"success": False, "error": "debug_face.jpg not found"}), 400

        with open("debug_face.jpg", "rb") as f:
            binary_data = f.read()

        timestamp = int(time.time())
        filename = f"{user_id}/face_{timestamp}.jpg"

        # Use the same direct API upload logic
        upload_result = supabase_manager.upload_face_image_direct_api(
            user_id=user_id,
            base64_image=None,   # Not needed since we already have binary_data
            binary_data=binary_data,
            filename=filename
        )

        if upload_result.get("success"):
            return jsonify({
                "success": True,
                "public_url": upload_result.get("public_url")
            })
        else:
            return jsonify({
                "success": False,
                "error": upload_result.get("error", "Upload failed")
            }), 500

    except Exception as e:
        logger.error(f"/api/upload-face error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
@cross_origin()
def login_user():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'success': False, 'error': 'Missing credentials'}), 400

        # Get user by email
        user_result = supabase_manager.client.table('users').select('*').eq('email', email).limit(1).execute()
        if not user_result.data:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        user = user_result.data[0]

        # Validate password (assuming bcrypt)
        if not bcrypt.checkpw(password.encode(), user['password'].encode()):
            return jsonify({'success': False, 'error': 'Invalid password'}), 401

        # If biometric is enrolled, trigger face verification step
        if user.get('is_biometric_enrolled'):
            return jsonify({
                'success': False,
                'error': 'BIOMETRIC_REQUIRED',
                'user_id': user['id'],
                'full_name': user.get('full_name', ''),
                'email': user['email']
            }), 401

        # Otherwise, login success
        return jsonify({
            'success': True,
            'user_id': user['id'],
            'email': user['email'],
            'full_name': user.get('full_name', ''),
            'role': user.get('role', 'user')
        })

    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


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
                   datetime.now() - timedelta(days=7)
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
                if 'DETECTOR' in globals():
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
            # Ensure liveness_validation is always present even on failure
            return jsonify({
                'success': False,
                'face_detected': result.get('face_detected', False),
                'blink_count': result.get('blink_count', 0),
                'mouth_open_count': result.get('mouth_open_count', 0),
                'head_movement_count': result.get('head_movement_count', 0),
                'face_real_score': result.get('face_real_score', 0),
                'enhanced_face_score': result.get('enhanced_face_score', 0),
                'liveness_validation': {
                    'overall_liveness_passed': False,
                    'step_requirements': {
                        'blinks_met': False,
                        'mouth_met': False,
                        'head_met': False,
                        'score_met': False
                    },
                    'current_step': current_step,
                    'mode': mode
                },
                'error': result.get('error', 'Unknown error')
            }), 400
    except Exception as e:
        logger.error(f"Detection error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ekyc', methods=['POST'])
def ekyc_process():
        data = request.get_json()
        base64_image = data.get("image")

        if not base64_image:
            return jsonify({"success": False, "error": "No image provided"}), 400

        # Decode image
        if ',' in base64_image:
            base64_image = base64_image.split(",")[1]
        img_data = base64.b64decode(base64_image)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Call OCR
        ocr_result = mykad_ocr.process_mykad_front(img)
        return jsonify(ocr_result)    
    

# Register blueprints after app is created
def register_blueprints():
    """Register all blueprints to avoid circular imports"""
    try:
        # Import and register blueprints here to avoid circular imports
        from routes.ekyc import ekyc_bp
        app.register_blueprint(ekyc_bp, url_prefix='/api')
        logger.info("✅ eKYC blueprint registered")
    except ImportError as e:
        logger.warning(f"⚠️ Could not import eKYC blueprint: {e}")


@app.route('/api/biometric-login-verify', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'])
def biometric_login_verify():
    """
    Enhanced biometric login verification with better error handling
    """
    try:
        # Handle preflight
        if request.method == 'OPTIONS':
            response = make_response()
            response.headers.add("Access-Control-Allow-Origin", request.headers.get('Origin'))
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
            return response
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        user_id = data.get('user_id')
        face_image_b64 = data.get('face_image')
        
        if not user_id or not face_image_b64:
            return jsonify({
                'success': False,
                'error': 'User ID and face image are required'
            }), 400
        
        logger.info(f"🔍 Starting biometric login verification for user: {user_id}")
        
        # Check if face verifier is available
        if not face_verifier:
            logger.warning("Face verifier not available, using fallback verification")
            return fallback_face_verification(user_id, face_image_b64)
        
        # Get stored face embedding from database
        if not supabase_manager.client:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Query stored biometric data
        stored_result = supabase_manager.client.table("biometric_data") \
            .select("face_embedding, quality_score, created_at") \
            .eq("user_id", user_id) \
            .eq("biometric_type", "face") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not stored_result.data:
            return jsonify({
                'success': False,
                'error': 'No biometric data found for user'
            }), 404
        
        stored_data = stored_result.data[0]
        stored_embedding = stored_data['face_embedding']
        
        if not stored_embedding:
            return jsonify({
                'success': False,
                'error': 'Invalid stored face data'
            }), 400
        
        logger.info(f"📊 Found stored embedding with {len(stored_embedding)} dimensions")
        
        # Process current face image
        try:
            frame = process_base64_image(face_image_b64)
            if frame is None:
                return jsonify({
                    'success': False,
                    'error': 'Failed to process face image'
                }), 400
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Error processing image: {str(e)}'
            }), 400
        
        # Use enhanced face verification model
        verification_result = face_verifier.verify_for_login(frame, stored_embedding)
        
        if not verification_result['success']:
            logger.warning(f"❌ Face verification failed: {verification_result.get('error')}")
            log_failed_attempt(user_id, verification_result)
            
            return jsonify({
                'success': False,
                'error': verification_result.get('error', 'Face verification failed'),
                'similarity': verification_result.get('similarity', 0),
                'threshold': face_verifier.LOGIN_THRESHOLD
            }), 401
        
        # Check if face matches
        is_match = verification_result.get('is_match', False)
        similarity = verification_result.get('similarity', 0)
        
        if is_match:
            logger.info(f"✅ Face verification successful: similarity={similarity:.3f}")
        else:
            logger.warning(f"❌ Face verification failed: similarity={similarity:.3f} below threshold={face_verifier.LOGIN_THRESHOLD}")
        
        # Log the authentication attempt
        log_data = {
            'user_id': user_id,
            'success': is_match,
            'biometric_scores': {
                'face_similarity': float(similarity),
                'face_distance': verification_result.get('distance', 0),
                'quality_score': verification_result.get('quality_score', 0),
                'confidence_level': verification_result.get('confidence_level', 'UNKNOWN')
            },
            'ip_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'event_ts': datetime.now().isoformat(),
            'failure_reason': None if is_match else 'biometric_similarity_low'
        }
        
        try:
            if supabase_manager.client:
                supabase_manager.client.table("login_audit").insert(log_data).execute()
                logger.info("📝 Login attempt logged successfully")
        except Exception as e:
            logger.error(f"Failed to log login attempt: {e}")
        
        # Return verification result
        response_data = {
            'success': is_match,
            'similarity': float(similarity),
            'threshold': face_verifier.LOGIN_THRESHOLD,
            'quality_score': verification_result.get('quality_score', 0),
            'confidence_level': verification_result.get('confidence_level', 'UNKNOWN'),
            'message': 'Face verification successful' if is_match else f'Face similarity too low: {similarity:.3f}'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Biometric login verification error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Internal server error during verification'
        }), 500

def fallback_face_verification(user_id: str, face_image_b64: str):
    """
    Fallback face verification using basic face_recognition library
    """
    try:
        logger.info("🔄 Using fallback face verification")
        
        # Get stored face embedding
        stored_result = supabase_manager.client.table("biometric_data") \
            .select("face_embedding") \
            .eq("user_id", user_id) \
            .eq("biometric_type", "face") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not stored_result.data:
            return jsonify({
                'success': False,
                'error': 'No biometric data found'
            }), 404
        
        stored_embedding = stored_result.data[0]['face_embedding']
        
        # Process current face image
        frame = process_base64_image(face_image_b64)
        
        # Extract face encoding from current image
        face_encodings = face_recognition.face_encodings(frame)
        if not face_encodings:
            return jsonify({
                'success': False,
                'error': 'No face detected in image'
            }), 400
        
        current_encoding = face_encodings[0]
        
        # Compare faces using relaxed threshold
        stored_encoding_array = np.array(stored_embedding)
        distance = face_recognition.face_distance([stored_encoding_array], current_encoding)[0]
        similarity = 1.0 - distance
        
        # Very relaxed threshold for fallback
        FALLBACK_THRESHOLD = 0.35
        is_match = similarity >= FALLBACK_THRESHOLD
        
        logger.info(f"Fallback verification: similarity={similarity:.3f}, threshold={FALLBACK_THRESHOLD}")
        
        # Log the attempt
        log_data = {
            'user_id': user_id,
            'success': is_match,
            'biometric_scores': {
                'face_similarity': float(similarity),
                'face_distance': float(distance),
                'verification_method': 'fallback'
            },
            'ip_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'event_ts': datetime.now().isoformat()
        }
        
        if supabase_manager.client:
            supabase_manager.client.table("login_audit").insert(log_data).execute()
        
        return jsonify({
            'success': is_match,
            'similarity': float(similarity),
            'threshold': FALLBACK_THRESHOLD,
            'verification_method': 'fallback',
            'message': 'Face verification successful (fallback)' if is_match else 'Face verification failed (fallback)'
        })
        
    except Exception as e:
        logger.error(f"Fallback verification error: {e}")
        return jsonify({
            'success': False,
            'error': 'Fallback verification failed'
        }), 500

def log_failed_attempt(user_id: str, verification_result: dict):
    """
    Log failed biometric authentication attempt
    """
    try:
        log_data = {
            'user_id': user_id,
            'success': False,
            'biometric_scores': {
                'face_similarity': verification_result.get('similarity', 0),
                'error': verification_result.get('error', 'Unknown error')
            },
            'ip_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'event_ts': datetime.now().isoformat(),
            'failure_reason': 'biometric_verification_error'
        }
        
        if supabase_manager.client:
            supabase_manager.client.table("login_audit").insert(log_data).execute()
            
    except Exception as e:
        logger.error(f"Failed to log authentication attempt: {e}")

@app.route('/api/check-biometric-enrollment/<user_id>', methods=['GET'])
def check_biometric_enrollment(user_id: str):
    """
    Check if user has biometric data enrolled
    """
    try:
        if not supabase_manager.client:
            return jsonify({
                'enrolled': False,
                'error': 'Database not available'
            }), 500
        
        # Check for face biometric data
        result = supabase_manager.client.table("biometric_data") \
            .select("id, created_at, quality_score") \
            .eq("user_id", user_id) \
            .eq("biometric_type", "face") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        enrolled = bool(result.data)
        
        response_data = {
            'enrolled': enrolled,
            'user_id': user_id
        }
        
        if enrolled:
            biometric_data = result.data[0]
            response_data.update({
                'enrollment_date': biometric_data['created_at'],
                'quality_score': biometric_data.get('quality_score', 0)
            })
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error checking biometric enrollment: {e}")
        return jsonify({
            'enrolled': False,
            'error': 'Failed to check enrollment status'
        }), 500

# ============= DEBUG ROUTES ENDPOINT =============
@app.route('/api/debug/routes', methods=['GET'])
@cross_origin()
def debug_routes():
    """Debug endpoint to check available routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    return jsonify({
        'total_routes': len(routes),
        'routes': routes,
        'cors_enabled': True
    })

# ============= ERROR HANDLERS =============
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'message': 'The requested API endpoint does not exist'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': 'Method not allowed',
        'message': 'The HTTP method is not allowed for this endpoint'
    }), 405

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

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
    try:
        initialize_detector()
        DETECTOR = LivenessDetector(supabase_manager)  # Fix: Initialize without arguments
        logger.info("✅ Liveness detector initialized")
    except Exception as e:
        logger.error(f"⚠️ Could not initialize liveness detector: {e}")
        DETECTOR = None
    
    # Check Supabase
    if supabase_manager.client:
        print("✅ Supabase connected")
    else:
        print("⚠️ Running in mock mode (no Supabase)")
    
    # Register blueprints
    register_blueprints()
    
    print("-" * 60)
    print("📡 Server running on http://localhost:5000")
    print("=" * 60)
    
    app.run(debug=False, host="0.0.0.0", port=5000, threaded=True)