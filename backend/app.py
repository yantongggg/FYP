# backend/app.py - FIXED VERSION

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
from dataclasses import dataclass, asdict, field
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
from ml_models.liveness_detector import DETECTOR, initialize_models
from utils.supabase_manager import SupabaseManager
from ml_models.face_verification import FaceVerificationModel
from flask_cors import CORS, cross_origin
from utils.liveness_challenge import LoginChallengeStore
import scipy.stats  
import math  
from ml_models.face_verification import FaceVerificationModel

face_verifier = FaceVerificationModel()
supabase_manager = SupabaseManager()

# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import optimized detector
sys.path.append(os.path.join(os.path.dirname(__file__), 'ml_models'))

# Initialize OCR and Face Verifier
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
    logger.info("Face verification model initialized")
except Exception as e:
    logger.error(f"Could not initialize face verification model: {e}")
    face_verifier = None

# Flask App with CORS
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173", "http://127.0.0.1:5173"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": [
            "Content-Type", "Authorization", "Access-Control-Allow-Credentials",
            "Access-Control-Allow-Origin", "Access-Control-Allow-Headers",
            "Access-Control-Allow-Methods", "X-Requested-With"
        ],
        "supports_credentials": False,
        "expose_headers": ["Content-Type", "Authorization"],
        "max_age": 86400
    }
})


GLOBAL_MONITORING_STATE = {
    'active_users': {},
    'recent_anomalies': [],
    'system_stats': {
        'total_checks': 0,
        'anomalies_detected': 0,
        'last_update': datetime.now().isoformat()
    }
}

MONITORING_LOCK = threading.Lock()

def convert_numpy_types(obj):
    """Recursively convert NumPy data types in a dict to native Python types"""
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

# Configuration
BEHAVIORAL_THRESHOLDS = {
    'auto_lock': 0.3,
    'anomaly': 0.6,
    'trust_delta_good': 1,
    'trust_delta_bad': -10
}

# Session management
@dataclass
class EnhancedLivenessSession:
    user_id: str
    start_time: float
    mode: str = "registration"
    current_step: str = "ready"
    required_blinks: int = 2
    required_mouth: int = 1  
    required_head: int = 1
    required_score: float = 0.2
    all_requirements_met: bool = False
    completion_time: float = 0.0
    last_face_score: float = 0.0
    last_enhanced_score: float = 0.0
    registration_data: dict = field(default_factory=dict)
    login_challenge_id: str = ''
    
    def __post_init__(self):
        """Ensure all attributes are properly initialized"""
        if not hasattr(self, 'all_requirements_met'):
            self.all_requirements_met = False
        if not hasattr(self, 'completion_time'):
            self.completion_time = 0.0
        if not hasattr(self, 'last_face_score'):
            self.last_face_score = 0.0
        if not hasattr(self, 'last_enhanced_score'):
            self.last_enhanced_score = 0.0
        if not hasattr(self, 'registration_data'):
            self.registration_data = {}

USER_SESSIONS = {}
session_lock = threading.Lock()
LOGIN_LIVENESS_CHALLENGES = LoginChallengeStore(ttl_seconds=300)

# ============= CORS HEADERS =============
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    allowed_origins = [
        'http://localhost:3000', 'http://127.0.0.1:3000',
        'http://localhost:3001', 'http://127.0.0.1:3001',
        'http://localhost:5173', 'http://127.0.0.1:5173'
    ]
    
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        response.headers['Access-Control-Max-Age'] = '86400'
    
    return response

@app.before_request  
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        origin = request.headers.get('Origin')
        allowed_origins = [
            'http://localhost:3000', 'http://127.0.0.1:3000',
            'http://localhost:3001', 'http://127.0.0.1:3001',
            'http://localhost:5173', 'http://127.0.0.1:5173'
        ]
        
        if origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", origin)
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Max-Age', '86400')
        
        return response

# ============= REAL-TIME MONITORING FUNCTIONS =============

def update_global_monitoring_state(user_id: str, behavioral_data: dict, anomaly_detected: bool = False):
  
    with MONITORING_LOCK:
        current_time = datetime.now()
        
        # Update user's behavioral status
        GLOBAL_MONITORING_STATE['active_users'][user_id] = {
            'last_check': current_time.isoformat(),
            'similarity_score': behavioral_data.get('similarity_score', 0.5),
            'status': 'ANOMALY' if anomaly_detected else 'NORMAL',
            'keystroke_count': behavioral_data.get('keystroke_count', 0),
            'mouse_count': behavioral_data.get('mouse_count', 0),
            'page_context': behavioral_data.get('page_context', 'unknown')
        }
        
        # Update system stats
        GLOBAL_MONITORING_STATE['system_stats']['total_checks'] += 1
        if anomaly_detected:
            GLOBAL_MONITORING_STATE['system_stats']['anomalies_detected'] += 1
            
            # Add to recent anomalies (keep last 10)
            anomaly_entry = {
                'user_id': user_id,
                'timestamp': current_time.isoformat(),
                'similarity_score': behavioral_data.get('similarity_score', 0),
                'severity': behavioral_data.get('severity', 'medium'),
                'page': behavioral_data.get('page_context', 'unknown')
            }
            GLOBAL_MONITORING_STATE['recent_anomalies'].insert(0, anomaly_entry)
            GLOBAL_MONITORING_STATE['recent_anomalies'] = GLOBAL_MONITORING_STATE['recent_anomalies'][:10]
        
        GLOBAL_MONITORING_STATE['system_stats']['last_update'] = current_time.isoformat()

@app.route('/api/monitoring/status', methods=['GET'])
@cross_origin()
def get_monitoring_status():
    try:
        with MONITORING_LOCK:
            # Clean up old entries (older than 5 minutes)
            current_time = datetime.now()
            cutoff_time = current_time - timedelta(minutes=5)
            
            active_users = {}
            for user_id, data in GLOBAL_MONITORING_STATE['active_users'].items():
                last_check = datetime.fromisoformat(data['last_check'])
                if last_check > cutoff_time:
                    active_users[user_id] = data
            
            GLOBAL_MONITORING_STATE['active_users'] = active_users
            
            return jsonify({
                'success': True,
                'monitoring_data': {
                    'active_users': active_users,
                    'recent_anomalies': GLOBAL_MONITORING_STATE['recent_anomalies'],
                    'system_stats': GLOBAL_MONITORING_STATE['system_stats'],
                    'total_active_users': len(active_users)
                },
                'timestamp': current_time.isoformat()
            })
            
    except Exception as e:
        logger.error(f"Error getting monitoring status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/monitoring/user/<user_id>', methods=['GET'])
@cross_origin()
def get_user_monitoring_status(user_id):
    try:
        with MONITORING_LOCK:
            user_data = GLOBAL_MONITORING_STATE['active_users'].get(user_id)
            
            if user_data:
                return jsonify({
                    'success': True,
                    'user_monitoring': user_data,
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'success': True,
                    'user_monitoring': {
                        'status': 'INACTIVE',
                        'last_check': None,
                        'similarity_score': 0,
                        'keystroke_count': 0,
                        'mouse_count': 0
                    },
                    'timestamp': datetime.now().isoformat()
                })
                
    except Exception as e:
        logger.error(f" Error getting user monitoring status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ============= ASYNC HELPER FUNCTIONS =============
def run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

# ============= API ENDPOINTS =============

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
    """Check if a user already exists by username or email"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        
        if not username and not email:
            return jsonify({
                'success': False,
                'error': 'Username or email is required'
            }), 400
        
        logger.info(f"Checking if user exists: username='{username}', email='{email}'")
        
        if not supabase_manager.client:
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
            .select("id, username, email, status, is_face_enrolled, created_at") \
            .or_("|".join(query_conditions)) \
            .execute()
        
        if user_result.data and len(user_result.data) > 0:
            existing_user = user_result.data[0]
            
            matched_fields = []
            if existing_user['username'] == username:
                matched_fields.append('username')
            if existing_user['email'] == email:
                matched_fields.append('email')
            
            logger.info(f"User found: {existing_user['id']} (matched: {', '.join(matched_fields)})")
            
            return jsonify({
                'success': True,
                'exists': True,
                'user_info': {
                    'id': existing_user['id'],
                    'username': existing_user['username'],
                    'email': existing_user['email'],
                    'status': existing_user['status'],
                    'is_face_enrolled': existing_user['is_face_enrolled'],
                    'created_at': existing_user['created_at']
                },
                'matched_fields': matched_fields,
                'message': f"User exists (matched: {', '.join(matched_fields)})"
            })
        else:
            logger.info(f"No existing user found for username='{username}', email='{email}'")
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
    """Complete registration endpoint - Orchestrates all 4 steps"""
    try:
        data = request.get_json()
        logger.info(f"Starting registration for {data.get('email', 'unknown')}")
        
        # Validate required fields
        required_fields = ['username', 'email', 'password', 'faceData', 'livenessData', 'behavioralData', 'ekycFiles']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Step 1: Store user credentials
        credentials_result = run_async(
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
        biometric_result = run_async(
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
        behavioral_result = run_async(
            supabase_manager.store_behavioral_pattern(user_id, data['behavioralData'])
        )
        
        if not behavioral_result['success']:
            return jsonify(behavioral_result), 400
        
        # Step 4: Store eKYC documents
        ekyc_result = run_async(
            supabase_manager.store_ekyc_documents(user_id, data['ekycFiles'])
        )
        
        if not ekyc_result['success']:
            return jsonify(ekyc_result), 400
        
        # All steps completed successfully
        logger.info(f"Registration completed successfully for {user_id}")
        
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

# =============  LOGIN WITH FACE VERIFICATION =============

@app.route('/api/login', methods=['POST'])
@cross_origin()
def login_user():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        ip_address = request.remote_addr

        if not email or not password:
            return jsonify({'success': False, 'error': 'Missing credentials'}), 400

        # Step 1: Check account lockout
        lockout_result = run_async(supabase_manager.check_account_lockout(email))
        if lockout_result.get('locked'):
            run_async(supabase_manager.log_login_attempt(
                email, 'password', False, 'account_locked', ip_address
            ))
            return jsonify({
                'success': False,
                'error': 'ACCOUNT_LOCKED',
                'message': lockout_result.get('message'),
                'remaining_minutes': lockout_result.get('remaining_minutes')
            }), 423  # HTTP 423 Locked

        # Step 2: Validate credentials
        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        user_result = supabase_manager.client.table('users').select('*').eq('email', email).limit(1).execute()
        if not user_result.data:
            run_async(supabase_manager.log_login_attempt(
                email, 'password', False, 'user_not_found', ip_address
            ))
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 404

        user = user_result.data[0]

        # Validate password
        try:
            if not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
                run_async(supabase_manager.log_login_attempt(
                    email, 'password', False, 'invalid_password', ip_address
                ))
                return jsonify({'success': False, 'error': 'Invalid email or password'}), 401
        except Exception as pwd_error:
            logger.error(f"Password verification error: {pwd_error}")
            return jsonify({'success': False, 'error': 'Authentication error'}), 401

        if user.get('email') == 'admin@example.com' and user.get('role') == 'admin':
            logger.info(f" Admin demo {user['email']} bypassing biometric verification")
            run_async(supabase_manager.log_login_attempt(
                email, 'password', True, 'admin_demo_bypass', ip_address
            ))
            return jsonify({
                'success': True,
                'user_id': user['id'],
                'email': user['email'],
                'username': user.get('username', ''),
                'role': user.get('role', 'admin'),
                'message': 'Admin demo login successful without biometric'
            })

        # Step 4: Check enrollment status and enforce biometric verification for ALL other users
        if user.get('is_fully_enrolled'):
            # User has completed both face and behavioral enrollment - proceed to biometric verification
            logger.info(f" User {user['id']} is fully enrolled - face verification required")
            
            run_async(supabase_manager.log_login_attempt(
                email, 'password', True, 'requires_biometric_verification', ip_address
            ))
            
            challenge_id = LOGIN_LIVENESS_CHALLENGES.issue(user['id'])
            return jsonify({
                'login_challenge_id': challenge_id,
                'success': False,
                'error': 'BIOMETRIC_REQUIRED',
                'user_id': user['id'],
                'full_name': user.get('username', ''),
                'email': user['email'],
                'message': 'Face verification required'
            }), 200
            
        elif user.get('is_face_enrolled'):
            # User has face enrolled but not fully enrolled (missing behavioral)
            logger.info(f" User {user['id']} has face but missing behavioral enrollment")
            run_async(supabase_manager.log_login_attempt(
                email, 'password', True, 'incomplete_behavioral_enrollment', ip_address
            ))
            
            return jsonify({
                'success': False,
                'error': 'BEHAVIORAL_ENROLLMENT_REQUIRED',
                'user_id': user['id'],
                'email': user['email'],
                'username': user.get('username', ''),
                'message': 'Please complete behavioral pattern enrollment to access your account',
                'enrollment_status': {
                    'face_enrolled': True,
                    'behavioral_enrolled': False,
                    'fully_enrolled': False
                }
            }), 200
            
        else:
            # User doesn't have face enrollment - needs complete registration
            logger.info(f" User {user['id']} needs to complete face enrollment")
            run_async(supabase_manager.log_login_attempt(
                email, 'password', True, 'incomplete_face_enrollment', ip_address
            ))
            
            return jsonify({
                'success': False,
                'error': 'FACE_ENROLLMENT_REQUIRED',
                'user_id': user['id'],
                'email': user['email'],
                'username': user.get('username', ''),
                'message': 'Please complete face enrollment to access your account',
                'enrollment_status': {
                    'face_enrolled': False,
                    'behavioral_enrolled': False,
                    'fully_enrolled': False
                }
            }), 200

    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
    
# ============= OTP FALLBACK ENDPOINTS =============

@app.route('/api/send-login-otp', methods=['POST'])
@cross_origin()
def send_login_otp():
    """Send OTP for login fallback when face verification fails"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        
        if not user_id or not email:
            return jsonify({
                'success': False,
                'error': 'User ID and email are required'
            }), 400
        
        logger.info(f"Sending login fallback OTP to {email}")
        
        if not supabase_manager.client:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Check if user exists and is valid
        user_result = supabase_manager.client.table("users") \
            .select("id, email, failed_login_attempts") \
            .eq("id", user_id) \
            .eq("email", email) \
            .single() \
            .execute()
        
        if not user_result.data:
            return jsonify({
                'success': False,
                'error': 'Invalid user credentials'
            }), 404
        
        # Check if too many failed attempts
        failed_attempts = user_result.data.get('failed_login_attempts', 0)
        if failed_attempts >= 3:
            return jsonify({
                'success': False,
                'error': 'Too many failed login attempts. Account temporarily locked.'
            }), 423
        
        # Send OTP
        otp_result = run_async(supabase_manager.send_otp_email(
            email, 'login_fallback', user_id
        ))
        
        if otp_result['success']:
            logger.info(f"Login OTP sent to {email}")
            return jsonify({
                'success': True,
                'message': f'OTP sent to {email}',
                'otp_id': otp_result['otp_id'],
                'expires_in_minutes': otp_result['expires_in_minutes'],
                'dev_otp': otp_result.get('dev_otp')  # For development only
            })
        else:
            return jsonify({
                'success': False,
                'error': otp_result.get('error', 'Failed to send OTP')
            }), 500
            
    except Exception as e:
        logger.error(f"Send login OTP error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to send OTP'
        }), 500

@app.route('/api/verify-login-otp', methods=['POST'])
@cross_origin()
def verify_login_otp():
    """Verify OTP for login fallback"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        otp_code = data.get('otp_code')
        
        if not user_id or not email or not otp_code:
            return jsonify({
                'success': False,
                'error': 'User ID, email, and OTP code are required'
            }), 400
        
        logger.info(f"Verifying login OTP for {email}")
        
        # Verify OTP
        verification_result = run_async(supabase_manager.verify_otp(
            email, otp_code, 'login_fallback'
        ))
        
        if verification_result['success']:
            # Log successful OTP login
            run_async(supabase_manager.log_login_attempt(
                email, 'otp', True, None, request.remote_addr
            ))
            
            # Get user details for response
            if not supabase_manager.client:
                return jsonify({
                    'success': False,
                    'error': 'Database not available'
                }), 500
                
            user_result = supabase_manager.client.table("users") \
                .select("id, email, username, role") \
                .eq("id", user_id) \
                .single() \
                .execute()
            
            if user_result.data:
                user = user_result.data
                logger.info(f"OTP login successful for {email}")
                
                return jsonify({
                    'success': True,
                    'user_id': user['id'],
                    'email': user['email'],
                    'username': user['username'],
                    'role': user.get('role', 'user'),
                    'login_method': 'otp_fallback'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'User not found after OTP verification'
                }), 404
        else:
            # Log failed OTP attempt
            run_async(supabase_manager.log_login_attempt(
                email, 'otp', False, verification_result.get('error'), request.remote_addr
            ))
            
            return jsonify({
                'success': False,
                'error': verification_result.get('error', 'Invalid OTP')
            }), 401
            
    except Exception as e:
        logger.error(f"Verify login OTP error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to verify OTP'
        }), 500

# ============= EMAIL VERIFICATION FOR REGISTRATION =============

@app.route('/api/send-email-verification', methods=['POST'])
@cross_origin()
def send_email_verification():
    """Send email verification OTP during registration"""
    try:
        data = request.get_json()
        email = data.get('email')
        user_id = data.get('user_id')  # Optional for registration
        
        if not email:
            return jsonify({
                'success': False,
                'error': 'Email is required'
            }), 400
        
        logger.info(f"Sending email verification OTP to {email}")
        
        # Send OTP
        otp_result = run_async(supabase_manager.send_otp_email(
            email, 'email_verification', user_id
        ))
        
        if otp_result['success']:
            logger.info(f"Email verification OTP sent to {email}")
            return jsonify({
                'success': True,
                'message': f'Verification code sent to {email}',
                'otp_id': otp_result['otp_id'],
                'expires_in_minutes': otp_result['expires_in_minutes'],
                'dev_otp': otp_result.get('dev_otp')  # For development only
            })
        else:
            return jsonify({
                'success': False,
                'error': otp_result.get('error', 'Failed to send verification email')
            }), 500
            
    except Exception as e:
        logger.error(f"Send email verification error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to send verification email'
        }), 500

@app.route('/api/verify-email-otp', methods=['POST'])
@cross_origin()
def verify_email_otp():
    """Verify email OTP during registration"""
    try:
        data = request.get_json()
        email = data.get('email')
        otp_code = data.get('otp_code')
        
        if not email or not otp_code:
            return jsonify({
                'success': False,
                'error': 'Email and OTP code are required'
            }), 400
        
        logger.info(f"Verifying email OTP for {email}")
        
        # Verify OTP
        verification_result = run_async(supabase_manager.verify_otp(
            email, otp_code, 'email_verification'
        ))
        
        if verification_result['success']:
            logger.info(f"Email verification successful for {email}")
            
            return jsonify({
                'success': True,
                'message': 'Email verified successfully',
                'user_id': verification_result.get('user_id')
            })
        else:
            return jsonify({
                'success': False,
                'error': verification_result.get('error', 'Invalid verification code')
            }), 401
            
    except Exception as e:
        logger.error(f"Verify email OTP error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to verify email'
        }), 500

# ============= EXISTING ENDPOINTS =============

@app.route("/api/upload-face", methods=["POST"])
def upload_face():
    try:
        data = request.get_json()
        user_id = data["user_id"]

        if not os.path.exists("debug_face.jpg"):
            return jsonify({"success": False, "error": "debug_face.jpg not found"}), 400

        with open("debug_face.jpg", "rb") as f:
            binary_data = f.read()

        timestamp = int(time.time())
        filename = f"{user_id}/face_{timestamp}.jpg"

        upload_result = supabase_manager.upload_face_image_direct_api(
            user_id=user_id,
            base64_image=None,
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

@app.route('/api/update-profile', methods=['POST'])
@cross_origin()
def update_profile():
    """Update user profile (username, email, password)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        username = data.get('username')
        email = data.get('email')
        new_password = data.get('new_password')
        
        logger.info(f" Updating profile for user {user_id}")
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        # Check if user exists
        user_check = supabase_manager.client.table("users") \
            .select("id, username, email, password_hash") \
            .eq("id", user_id) \
            .execute()
        
        if not user_check.data:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        user_data = user_check.data[0]

        # Check for duplicate username/email (excluding current user)
        if username:
            existing_username = supabase_manager.client.table("users") \
                .select("id") \
                .eq("username", username) \
                .neq("id", user_id) \
                .execute()
            
            if existing_username.data:
                return jsonify({'success': False, 'error': 'Username already taken'}), 400
        
        if email:
            existing_email = supabase_manager.client.table("users") \
                .select("id") \
                .eq("email", email) \
                .neq("id", user_id) \
                .execute()
            
            if existing_email.data:
                return jsonify({'success': False, 'error': 'Email already registered'}), 400
        
        # Prepare update data
        update_data = {}
        
        if username and username.strip():
            update_data['username'] = username.strip()
            
        if email and email.strip():
            update_data['email'] = email.strip()

        # If changing password, validate current password first
        if new_password:
            if not data.get('current_password'):
                return jsonify({'success': False, 'error': 'Current password required'}), 400
            
            # Validate current password
            if not bcrypt.checkpw(data['current_password'].encode('utf-8'), user_data['password_hash'].encode('utf-8')):
                return jsonify({'success': False, 'error': 'Current password is incorrect'}), 401

        if new_password:
            password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            update_data['password_hash'] = password_hash
        
        if not update_data:
            return jsonify({'success': False, 'error': 'No data to update'}), 400
        
        
        # Update user record
        result = supabase_manager.client.table("users") \
            .update(update_data) \
            .eq("id", user_id) \
            .execute()
        
        if result.data:
            logger.info(f" Profile updated for user {user_id}: {list(update_data.keys())}")
            
            # Log the profile update for audit
            try:
                import asyncio
                asyncio.create_task(supabase_manager.log_login_attempt(
                    update_data.get('email', 'unknown'), 
                    'profile_update', 
                    True, 
                    f"Updated: {', '.join(update_data.keys())}", 
                    request.remote_addr
                ))
            except:
                pass 
            
            return jsonify({
                'success': True,
                'message': 'Profile updated successfully',
                'updated_fields': list(update_data.keys())
            })
        else:
            return jsonify({'success': False, 'error': 'Update failed'}), 500
            
    except Exception as e:
        logger.error(f"Profile update error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Update failed'}), 500

@app.route('/api/admin/users', methods=['GET'])
@cross_origin()
def admin_get_users():
    """Get all users for admin dashboard"""
    try:
        logger.info("Admin fetching all users")
        
        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        # Get all users with basic info
        result = supabase_manager.client.table("users") \
            .select("id, username, email, role, trust_score, is_active, created_at, last_login") \
            .order("created_at", desc=True) \
            .execute()
        
        users = []
        for user in result.data:
            # Check biometric enrollment
            bio_check = supabase_manager.client.table("biometric_data") \
                .select("id") \
                .eq("user_id", user['id']) \
                .limit(1) \
                .execute()
            
            behavioral_check = supabase_manager.client.table("behavioral_patterns") \
                .select("id") \
                .eq("user_id", user['id']) \
                .eq("is_active", True) \
                .limit(1) \
                .execute()
            
            users.append({
                **user,
                'biometric_enrolled': len(bio_check.data) > 0,
                'behavioral_enrolled': len(behavioral_check.data) > 0,
                'trust_score': user.get('trust_score', 85)
            })
        
        logger.info(f" Loaded {len(users)} users for admin")
        
        return jsonify({
            'success': True,
            'users': users
        })
        
    except Exception as e:
        logger.error(f"Admin users endpoint error: {e}")
        return jsonify({'success': False, 'error': 'Failed to load users'}), 500


@app.route('/api/admin/ekyc', methods=['GET'])
@cross_origin()
def admin_get_ekyc():
    try:
        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        result = supabase_manager.client.table("ekyc_documents") \
            .select("*, users(username, email)") \
            .order("created_at", desc=True) \
            .limit(100) \
            .execute()
        
        return jsonify({
            'success': True,
            'documents': result.data or []
        })
        
    except Exception as e:
        logger.error(f"Admin eKYC endpoint error: {e}")
        return jsonify({'success': False, 'error': 'Failed to load eKYC data'}), 500

@app.route('/api/admin/logins', methods=['GET'])
@cross_origin()
def admin_get_logins():
    try:
        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        result = supabase_manager.client.table("login_audit") \
            .select("*, users(username, email)") \
            .order("event_ts", desc=True) \
            .limit(200) \
            .execute()
        
        return jsonify({
            'success': True,
            'logins': result.data or []
        })
        
    except Exception as e:
        logger.error(f"Admin logins endpoint error: {e}")
        return jsonify({'success': False, 'error': 'Failed to load login data'}), 500
    
@app.route('/api/admin/update-user', methods=['POST'])
@cross_origin()
def admin_update_user():
    """Admin endpoint to update any user's profile"""
    try:
        data = request.get_json()
        user_id = data.get('id')  # Note: using 'id' to match frontend
        username = data.get('username')
        email = data.get('email')
        role = data.get('role')
        trust_score = data.get('trust_score')
        is_active = data.get('is_active')
        
        logger.info(f" Admin updating user {user_id}")
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        # Prepare update data
        update_data = {}
        
        if username:
            update_data['username'] = username.strip()
        if email:
            update_data['email'] = email.strip()
        if role:
            update_data['role'] = role
        if trust_score is not None:
            update_data['trust_score'] = trust_score
        if is_active is not None:
            update_data['is_active'] = is_active
            
        update_data['updated_at'] = datetime.now().isoformat()
        
        # Update user
        result = supabase_manager.client.table("users") \
            .update(update_data) \
            .eq("id", user_id) \
            .execute()
        
        if result.data:
            logger.info(f" Admin updated user {user_id}: {list(update_data.keys())}")
            
            return jsonify({
                'success': True,
                'message': 'User updated successfully',
                'user': result.data[0]
            })
        else:
            return jsonify({'success': False, 'error': 'Update failed'}), 500
            
    except Exception as e:
        logger.error(f"Admin user update error: {e}")
        return jsonify({'success': False, 'error': 'Update failed'}), 500

@app.route('/api/admin/toggle-user-status', methods=['POST'])
@cross_origin()
def admin_toggle_user_status():
    """Toggle user active status"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        is_active = data.get('is_active')
        
        logger.info(f" Admin toggling user status: {user_id} -> {is_active}")
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Update user status
        result = supabase_manager.client.table("users") \
            .update({
                'is_active': is_active,
                'updated_at': datetime.now().isoformat()
            }) \
            .eq("id", user_id) \
            .execute()
        
        if result.data:
            status_text = "activated" if is_active else "deactivated"
            logger.info(f" User {user_id} {status_text}")
            
            return jsonify({
                'success': True,
                'message': f'User {status_text} successfully',
                'user': result.data[0]
            })
        else:
            return jsonify({'success': False, 'error': 'Status update failed'}), 500
            
    except Exception as e:
        logger.error(f"User status toggle error: {e}")
        return jsonify({'success': False, 'error': 'Status update failed'}), 500

@app.route('/api/behavioral-monitor', methods=['POST'])
@cross_origin()
def continuous_behavioral_monitor_fixed():
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData')
        page_context = data.get('page_context', 'unknown')
        
        if not user_id or not behavioral_data:
            return jsonify({'success': False, 'error': 'Missing data'}), 400
        
        logger.info(f" FIXED: Continuous monitoring for user {user_id} on {page_context}")
        
        keystrokes = behavioral_data.get('keystrokes', [])
        mouse_movements = behavioral_data.get('mouseMovements', [])
        
        if len(keystrokes) < 3:
            update_global_monitoring_state(user_id, {
                'similarity_score': 0.8,
                'keystroke_count': len(keystrokes),
                'mouse_count': len(mouse_movements),
                'page_context': page_context,
                'severity': 'low'
            }, anomaly_detected=False)
            
            return jsonify({
                'success': True,
                'similarity_score': 0.8,
                'is_anomaly': False,
                'action_taken': 'insufficient_data',
                'monitoring_updated': True
            })
        
        try:
            current_features = calculate_simple_behavioral_features(keystrokes, mouse_movements)
        except Exception as e:
            logger.error(f" Error calculating features: {e}")
            current_features = {
                'typing_speed': 40.0,
                'avg_velocity': 100.0,
                'keystroke_count': len(keystrokes),
                'mouse_count': len(mouse_movements)
            }
        
        # Calculate similarity with stored pattern
        similarity_score = calculate_basic_similarity(current_features, user_id)
        
        AUTO_LOCK_THRESHOLD = 0.15   # Only auto-lock if extremely different
        ANOMALY_THRESHOLD = 0.25     # Flag anomaly if quite different
        
        is_anomaly = similarity_score < ANOMALY_THRESHOLD
        is_critical = similarity_score < AUTO_LOCK_THRESHOLD
        
        if is_critical:
            action_taken = 'auto_lock'
            severity = 'critical'
            
            # Actually lock the user
            if supabase_manager.client:
                try:
                    lock_result = supabase_manager.client.table("users") \
                        .update({
                            "is_active": False,
                            "status": "suspended",
                            "suspension_reason": f"Critical behavioral anomaly detected - similarity: {similarity_score:.3f}"
                        }) \
                        .eq("id", user_id) \
                        .execute()
                    logger.warning(f"User {user_id} auto-locked due to critical behavioral anomaly")
                except Exception as e:
                    logger.error(f"Failed to auto-lock user {user_id}: {e}")
        elif is_anomaly:
            action_taken = 'warning'
            severity = 'medium'
        else:
            action_taken = 'none'
            severity = 'low'
        update_global_monitoring_state(user_id, {
            'similarity_score': similarity_score,
            'keystroke_count': len(keystrokes),
            'mouse_count': len(mouse_movements),
            'page_context': page_context,
            'severity': severity,
            'action_taken': action_taken
        }, anomaly_detected=is_anomaly)
        
        if supabase_manager.client:
            try:
                session_data = {
                    'user_id': str(user_id),
                    'session_id': f"monitor_{user_id}_{int(time.time())}",
                    'similarity_scores': {
                        'overall_similarity': float(similarity_score)
                    },
                    'anomaly_score': float(1 - similarity_score),
                    'is_successful': not is_anomaly,
                    'verification_type': 'continuous_monitoring',
                    'page_context': page_context,
                    'behavioral_metrics': {
                        'keystroke_count': len(keystrokes),
                        'mouse_count': len(mouse_movements),
                        'typing_speed': current_features.get('typing_speed', 0)
                    },
                    'created_at': datetime.now().isoformat()
                }
                
                # Save asynchronously to avoid blocking
                executor.submit(save_monitoring_session, session_data)
                
            except Exception as e:
                logger.error(f"Error saving monitoring session: {e}")
        
        if is_anomaly:
            try:
                anomaly_data = {
                    'user_id': str(user_id),
                    'session_id': f"monitor_{user_id}_{int(time.time())}",
                    'anomaly_type': 'continuous_monitoring_anomaly',
                    'anomaly_score': float(1 - similarity_score),
                    'severity': severity,
                    'action_taken': action_taken,
                    'details': {
                        'page_context': page_context,
                        'similarity_score': float(similarity_score),
                        'keystroke_count': len(keystrokes),
                        'mouse_count': len(mouse_movements)
                    },
                    'created_at': datetime.now().isoformat()
                }
                
                # Save asynchronously
                executor.submit(save_monitoring_anomaly, anomaly_data)
                
            except Exception as e:
                logger.error(f"Error saving monitoring anomaly: {e}")
        
        logger.info(f" FIXED: Continuous monitoring completed - similarity: {similarity_score:.3f}, anomaly: {is_anomaly}")
        
        return jsonify({
            'success': True,
            'similarity_score': float(similarity_score),
            'is_anomaly': is_anomaly,
            'is_critical': is_critical,
            'action_taken': action_taken,
            'severity': severity,
            'monitoring_updated': True,
            'thresholds': {
                'anomaly': ANOMALY_THRESHOLD,
                'critical': AUTO_LOCK_THRESHOLD
            }
        })
        
    except Exception as e:
        logger.error(f" FIXED: Continuous monitoring error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'monitoring_updated': False
        }), 500

@app.route('/api/behavioral-verify', methods=['POST'])
def behavioral_verify_adapted():
    """Enhanced behavioral verification endpoint - adapted for existing schema"""
    try:
        data = request.get_json()
        
        user_id = data.get('user_id')  # TEXT in your schema
        behavioral_data = data.get('behavioralData')
        typed_text = data.get('typedText', '')
        session_id = data.get('session_id', f"verify_{user_id}_{int(time.time())}")
        verification_type = data.get('verification_type', 'manual')
        
        if not user_id or not behavioral_data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: user_id and behavioralData'
            }), 400
        
        REFERENCE_SENTENCE = "The quick brown fox jumps over the lazy dog."
        if typed_text and typed_text != REFERENCE_SENTENCE:
            return jsonify({
                'success': False,
                'error': 'Text mismatch. Please type the exact sentence.',
                'expected': REFERENCE_SENTENCE,
                'received': typed_text
            }), 400
        
        logger.info(f" Starting behavioral verification for {user_id} (type: {verification_type})")
        
        # Enhanced verification with anomaly detection
        result = run_async(
            verify_behavioral_pattern_adapted(
                user_id, 
                behavioral_data, 
                session_id,
                verification_type=verification_type
            )
        )
        
        # Check for critical anomalies that require immediate action
        similarity_score = result.get('similarity_score', 0)
        anomaly_score = result.get('anomaly_score', 0)
        
        if similarity_score < 0.3:  # AUTO_LOCK_THRESHOLD
            result['action'] = 'auto_lock'
            result['severity'] = 'critical'
            
            # Update user status (convert to UUID if needed)
            if supabase_manager.client:
                try:
                    supabase_manager.client.table("users") \
                        .update({"status": "suspended"}) \
                        .eq("id", user_id) \
                        .execute()
                except Exception as e:
                    logger.error(f"Failed to suspend user: {e}")
            
            # Log critical anomaly
            anomaly_data = {
                'user_id': str(user_id),
                'session_id': session_id,
                'anomaly_type': 'behavioral_verification_failed',
                'anomaly_score': float(anomaly_score),
                'severity': 'critical',
                'action_taken': 'auto_lock',
                'details': {
                    'verification_type': verification_type,
                    'similarity_score': float(similarity_score),
                    'threshold': 0.3
                },
                'ip_address': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', ''),
                'event_ts': datetime.now().isoformat()
            }
            
            if supabase_manager.client:
                try:
                    supabase_manager.client.table("anomaly_audit") \
                        .insert(anomaly_data) \
                        .execute()
                except Exception as e:
                    logger.error(f"Failed to log critical anomaly: {e}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Behavioral verification error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

async def verify_behavioral_pattern_adapted(user_id: str, behavioral_data: dict, session_id: str, continuous_mode: bool = False, verification_type: str = 'manual'):
    """Behavioral pattern verification adapted for existing schema with TEXT user_id"""
    try:
        if not supabase_manager.client:
            return {
                'success': False,
                'error': 'Database not available',
                'similarity_score': 0,
                'anomaly_score': 0
            }
        
        # Get stored behavioral pattern using UUID user_id for behavioral_patterns table
        stored_result = supabase_manager.client.table("behavioral_patterns") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("is_active", True) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not stored_result.data:
            return {
                'success': False,
                'error': 'No stored behavioral pattern found',
                'similarity_score': 0,
                'anomaly_score': 1.0
            }
        
        stored_pattern = stored_result.data[0]
        
        # Calculate behavioral similarities
        keystroke_similarity = calculate_keystroke_similarity(
            behavioral_data.get('keystrokes', []),
            stored_pattern['pattern_data'].get('keystroke_features', {})
        )
        
        mouse_similarity = calculate_mouse_similarity(
            behavioral_data.get('mouseMovements', []),
            stored_pattern['pattern_data'].get('mouse_features', {})
        )
        
        # Overall similarity score (weighted average)
        overall_similarity = (keystroke_similarity * 0.6) + (mouse_similarity * 0.4)
        
        # Calculate anomaly score (inverse of similarity)
        anomaly_score = 1.0 - overall_similarity
        
        # Determine success based on threshold
        success_threshold = 0.4 if continuous_mode else 0.5
        is_successful = overall_similarity >= success_threshold
        
        # Store session record using TEXT user_id
        session_data = {
            'user_id': str(user_id),  # Store as TEXT
            'session_id': session_id,
            'similarity_scores': {
                'overall_similarity': float(overall_similarity),
                'keystroke_similarity': float(keystroke_similarity),
                'mouse_similarity': float(mouse_similarity)
            },
            'anomaly_score': float(anomaly_score),
            'is_successful': is_successful,
            'verification_type': verification_type,
            'session_duration': behavioral_data.get('session_duration', 0),
            'behavioral_metrics': {
                'keystroke_count': len(behavioral_data.get('keystrokes', [])),
                'mouse_count': len(behavioral_data.get('mouseMovements', [])),
                'typing_speed': extract_typing_speed(behavioral_data.get('keystrokes', [])),
                'mouse_velocity': extract_mouse_velocity(behavioral_data.get('mouseMovements', []))
            },
            'ip_address': '127.0.0.1',  # You can get actual IP in your endpoint
            'user_agent': 'System',
            'created_at': datetime.now().isoformat()
        }
        
        # Insert session record
        supabase_manager.client.table("behavioral_sessions") \
            .insert(session_data) \
            .execute()
        
        return {
            'success': is_successful,
            'similarity_score': float(overall_similarity),
            'keystroke_similarity': float(keystroke_similarity),
            'mouse_similarity': float(mouse_similarity),
            'anomaly_score': float(anomaly_score),
            'session_id': session_id,
            'verification_type': verification_type,
            'threshold_met': overall_similarity >= success_threshold,
            'anomaly_detected': anomaly_score > 0.6
        }
        
    except Exception as e:
        logger.error(f"Behavioral verification error: {e}")
        return {
            'success': False,
            'error': str(e),
            'similarity_score': 0,
            'anomaly_score': 1.0
        }

def calculate_keystroke_similarity(current_keystrokes: list, stored_features: dict) -> float:
    """Calculate keystroke pattern similarity"""
    if not current_keystrokes or not stored_features:
        return 0.5  # Default similarity for missing data
    
    # Extract features from current keystrokes
    current_features = extract_keystroke_features(current_keystrokes)
    
    # Compare key features
    similarities = []
    
    # Typing speed similarity
    if 'typing_speed' in stored_features and 'typing_speed' in current_features:
        speed_diff = abs(stored_features['typing_speed'] - current_features['typing_speed'])
        speed_similarity = max(0, 1 - (speed_diff / 100))  # Normalize by WPM
        similarities.append(speed_similarity)
    
    # Dwell time similarity
    if 'avg_dwell_time' in stored_features and 'avg_dwell_time' in current_features:
        dwell_diff = abs(stored_features['avg_dwell_time'] - current_features['avg_dwell_time'])
        dwell_similarity = max(0, 1 - (dwell_diff / 200))  # Normalize by ms
        similarities.append(dwell_similarity)
    
    return sum(similarities) / len(similarities) if similarities else 0.5

def calculate_mouse_similarity(current_movements: list, stored_features: dict) -> float:
    """Calculate mouse movement pattern similarity"""
    if not current_movements or not stored_features:
        return 0.5  # Default similarity for missing data
    
    # Extract features from current movements
    current_features = extract_mouse_features(current_movements)
    
    # Compare key features
    similarities = []
    
    # Average velocity similarity
    if 'avg_velocity' in stored_features and 'avg_velocity' in current_features:
        velocity_diff = abs(stored_features['avg_velocity'] - current_features['avg_velocity'])
        velocity_similarity = max(0, 1 - (velocity_diff / 500))  # Normalize by px/s
        similarities.append(velocity_similarity)
    
    return sum(similarities) / len(similarities) if similarities else 0.5

def extract_keystroke_features(keystrokes: list) -> dict:
    """Extract keystroke timing features"""
    if len(keystrokes) < 2:
        return {'typing_speed': 0, 'avg_dwell_time': 0}
    
    # Calculate typing speed (basic)
    total_time = (keystrokes[-1]['timestamp'] - keystrokes[0]['timestamp']) / 1000  # Convert to seconds
    total_chars = len([k for k in keystrokes if k['type'] == 'keydown'])
    typing_speed = (total_chars / 5) / (total_time / 60) if total_time > 0 else 0  # WPM calculation
    
    # Calculate average dwell time (simplified)
    dwell_times = []
    key_press_times = {}
    for keystroke in keystrokes:
        key = keystroke['key']
        timestamp = keystroke['timestamp']
        event_type = keystroke['type']
        
        if event_type == 'keydown':
            key_press_times[key] = timestamp
        elif event_type == 'keyup' and key in key_press_times:
            dwell_time = timestamp - key_press_times[key]
            dwell_times.append(dwell_time)
            del key_press_times[key]
    
    avg_dwell_time = sum(dwell_times) / len(dwell_times) if dwell_times else 0
    
    return {
        'typing_speed': typing_speed,
        'avg_dwell_time': avg_dwell_time,
        'total_keystrokes': len(keystrokes)
    }

def extract_mouse_features(movements: list) -> dict:
    """Extract mouse movement features"""
    if len(movements) < 2:
        return {'avg_velocity': 0, 'total_movements': 0}
    
    velocities = []
    
    # Calculate velocities
    for i in range(1, len(movements)):
        prev = movements[i-1]
        curr = movements[i]
        
        if prev['type'] == 'mousemove' and curr['type'] == 'mousemove':
            dx = curr['x'] - prev['x']
            dy = curr['y'] - prev['y']
            dt = curr['timestamp'] - prev['timestamp']
            
            if dt > 0:
                distance = (dx**2 + dy**2)**0.5
                velocity = distance / dt
                velocities.append(velocity)
    
    return {
        'avg_velocity': sum(velocities) / len(velocities) if velocities else 0,
        'total_movements': len(movements),
        'total_clicks': len([m for m in movements if m['type'] == 'click'])
    }

def extract_typing_speed(keystrokes: list) -> float:
    """Extract typing speed from keystrokes"""
    if len(keystrokes) < 2:
        return 0
    
    total_time = (keystrokes[-1]['timestamp'] - keystrokes[0]['timestamp']) / 1000
    total_chars = len([k for k in keystrokes if k['type'] == 'keydown'])
    return (total_chars / 5) / (total_time / 60) if total_time > 0 else 0

def extract_mouse_velocity(movements: list) -> float:
    """Extract average mouse velocity"""
    if len(movements) < 2:
        return 0
    
    velocities = []
    for i in range(1, len(movements)):
        prev = movements[i-1]
        curr = movements[i]
        
        if prev['type'] == 'mousemove' and curr['type'] == 'mousemove':
            dx = curr['x'] - prev['x']
            dy = curr['y'] - prev['y']
            dt = curr['timestamp'] - prev['timestamp']
            
            if dt > 0:
                distance = (dx**2 + dy**2)**0.5
                velocity = distance / dt
                velocities.append(velocity)
    
    return sum(velocities) / len(velocities) if velocities else 0

@app.route('/api/admin/anomalies/recent', methods=['GET'])
@cross_origin()
def get_recent_anomalies_enhanced():
    """Get recent anomalies with better error handling and real-time updates"""
    try:
        limit = request.args.get('limit', 50, type=int)
        severity_filter = request.args.get('severity', 'all')
        
        if not supabase_manager.client:
            logger.warning("No Supabase client - returning mock data")
            return jsonify({
                'success': True,
                'anomalies': [],
                'total': 0,
                'mock': True
            })
        
        logger.info(f" Fetching recent anomalies (limit: {limit}, severity: {severity_filter})")
        
        # Build query with proper error handling
        try:
            query = supabase_manager.client.table("anomaly_audit") \
                .select("*") \
                .order("created_at", desc=True) \
                .limit(limit)
            
            if severity_filter != 'all':
                query = query.eq('severity', severity_filter)
            
            result = query.execute()
            
            anomalies = result.data or []
            
            # Try to get user information for each anomaly
            enhanced_anomalies = []
            for anomaly in anomalies:
                try:
                    # Try to get user info
                    user_result = supabase_manager.client.table("users") \
                        .select("username, email") \
                        .eq("id", anomaly['user_id']) \
                        .single() \
                        .execute()
                    
                    if user_result.data:
                        anomaly['users'] = user_result.data
                    else:
                        anomaly['users'] = {'username': 'Unknown', 'email': 'Unknown'}
                        
                except Exception as user_error:
                    logger.warning(f"Could not fetch user info for anomaly {anomaly.get('id')}: {user_error}")
                    anomaly['users'] = {'username': 'Unknown', 'email': 'Unknown'}
                
                enhanced_anomalies.append(anomaly)
            
            logger.info(f"Retrieved {len(enhanced_anomalies)} anomalies")
            
            return jsonify({
                'success': True,
                'anomalies': enhanced_anomalies,
                'total': len(enhanced_anomalies),
                'filter': severity_filter,
                'enhanced': True
            })
            
        except Exception as query_error:
            logger.error(f" Query error: {query_error}")
            # Fallback to basic query
            try:
                fallback_result = supabase_manager.client.table("anomaly_audit") \
                    .select("*") \
                    .order("created_at", desc=True) \
                    .limit(limit) \
                    .execute()
                
                return jsonify({
                    'success': True,
                    'anomalies': fallback_result.data or [],
                    'total': len(fallback_result.data or []),
                    'fallback': True,
                    'error': 'Used fallback query due to enhanced query failure'
                })
            except Exception as fallback_error:
                logger.error(f" Even fallback query failed: {fallback_error}")
                return jsonify({
                    'success': False,
                    'error': f'Database query failed: {str(fallback_error)}'
                }), 500
        
    except Exception as e:
        logger.error(f" Error fetching anomalies: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/user/anomalies/<user_id>', methods=['GET'])
@cross_origin()
def get_user_anomalies_fixed(user_id):
    """
     Get anomalies with proper UUID handling
    """
    try:
        limit = request.args.get('limit', 10, type=int)
        
        if not supabase_manager.client:
            logger.warning("No Supabase client - returning mock data")
            return jsonify({
                'success': True,
                'anomalies': [],
                'total': 0,
                'mock': True
            })
        
        logger.info(f" Fetching anomalies for user {user_id}")
        
        # CRITICAL: Ensure proper UUID format
        user_id_uuid = ensure_uuid_format(user_id)
        
        # Enhanced query with retry logic
        max_retries = 2
        for attempt in range(max_retries):
            try:
                result = supabase_manager.client.table("anomaly_audit") \
                    .select("*") \
                    .eq("user_id", user_id_uuid) \
                    .order("created_at", desc=True) \
                    .limit(limit) \
                    .execute()
                
                anomalies = result.data or []
                logger.info(f"Found {len(anomalies)} anomalies for user {user_id_uuid} on attempt {attempt + 1}")
                
                return jsonify({
                    'success': True,
                    'anomalies': anomalies,
                    'total': len(anomalies),
                    'user_id': user_id_uuid,
                    'fixed': True,
                    'attempt': attempt + 1
                })
                
            except Exception as e:
                logger.error(f" Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    return jsonify({
                        'success': False,
                        'error': f'Failed to fetch anomalies after {max_retries} attempts: {str(e)}'
                    }), 500
                
                time.sleep(0.5)
        
    except Exception as e:
        logger.error(f" Error fetching anomalies: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500
    
@app.route('/api/user/behavioral-sessions/<user_id>', methods=['GET'])
@cross_origin()
def get_user_behavioral_sessions_fixed(user_id):
    """
     Get behavioral sessions with proper UUID handling
    """
    try:
        limit = request.args.get('limit', 20, type=int)
        
        if not supabase_manager.client:
            logger.warning("No Supabase client - returning mock data")
            return jsonify({
                'success': True,
                'sessions': [],
                'total': 0,
                'mock': True
            })
        
        logger.info(f" Fetching behavioral sessions for user {user_id}")
        
        # Ensure proper UUID format
        user_id_uuid = ensure_uuid_format(user_id)
        
        #  retry logic
        max_retries = 2
        for attempt in range(max_retries):
            try:
                result = supabase_manager.client.table("behavioral_sessions") \
                    .select("*") \
                    .eq("user_id", user_id_uuid) \
                    .order("created_at", desc=True) \
                    .limit(limit) \
                    .execute()
                
                sessions = result.data or []
                logger.info(f" Found {len(sessions)} sessions for user {user_id_uuid} on attempt {attempt + 1}")
                
                return jsonify({
                    'success': True,
                    'sessions': sessions,
                    'total': len(sessions),
                    'user_id': user_id_uuid,
                    'fixed': True,
                    'attempt': attempt + 1
                })
                
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    return jsonify({
                        'success': False,
                        'error': f'Failed to fetch sessions after {max_retries} attempts: {str(e)}'
                    }), 500
                
                time.sleep(0.5)
        
    except Exception as e:
        logger.error(f"Error fetching behavioral sessions: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/save-behavioral-session', methods=['POST'])
@cross_origin()
def save_behavioral_session_enhanced():
    """ Save behavioral session with guaranteed persistence"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id is required'
            }), 400
        
        logger.info(f"  ENHANCED: Saving behavioral session for user {user_id}")
        
        # Build comprehensive session record
        current_time = datetime.now()
        
        session_record = {
            'user_id': str(user_id),  # TEXT type for behavioral_sessions table
            'session_id': data.get('session_id', f"session_{int(current_time.timestamp())}"),
            'similarity_scores': data.get('similarity_scores', {}),
            'anomaly_score': float(data.get('anomaly_score', 0.0)),
            'is_successful': data.get('is_successful', True),
            'verification_type': data.get('verification_type', 'continuous'),
            'duration_seconds': data.get('duration_seconds', 0),
            'page_context': data.get('page_context', 'unknown'),
            'session_duration': data.get('session_duration', 0),
            'behavioral_metrics': data.get('behavioral_metrics', {}),
            'ip_address': request.remote_addr or '127.0.0.1',
            'user_agent': request.headers.get('User-Agent', 'Unknown'),
            'created_at': current_time.isoformat()
        }
        
        # Clean None values
        cleaned_record = {k: v for k, v in session_record.items() if v is not None}
        
        # Ensure numeric fields are properly formatted
        if 'similarity_scores' in cleaned_record:
            for key, value in cleaned_record['similarity_scores'].items():
                if isinstance(value, (int, float)):
                    cleaned_record['similarity_scores'][key] = float(value)
        
        if not supabase_manager.client:
            logger.warning("No Supabase client - using mock save")
            return jsonify({
                "success": True, 
                "message": "Session saved (mock mode)",
                "session_id": cleaned_record['session_id']
            }), 200
        
        # CRITICAL: Save with retry logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = supabase_manager.client.table("behavioral_sessions").insert(cleaned_record).execute()
                
                if result.data and len(result.data) > 0:
                    session_db_id = result.data[0]['id']
                    logger.info(f" Behavioral session saved on attempt {attempt + 1}: {session_db_id}")
                    
                    return jsonify({
                        "success": True, 
                        "message": "Session saved successfully",
                        "session_id": cleaned_record['session_id'],
                        "database_id": session_db_id,
                        "attempt": attempt + 1
                    }), 200
                else:
                    raise Exception("No data returned from Supabase insert")
                    
            except Exception as e:
                logger.error(f" Attempt {attempt + 1} failed to save session: {e}")
                if attempt == max_retries - 1:
                    logger.error(f" All {max_retries} attempts failed to save session")
                    return jsonify({
                        "success": False, 
                        "error": f"Failed to save session after {max_retries} attempts: {str(e)}"
                    }), 500
                
                # Wait before retry
                import time
                time.sleep(0.5 * (attempt + 1))
        
    except Exception as e:
        logger.error(f"save session error: {e}", exc_info=True)
        return jsonify({
            "success": False, 
            "error": f"Internal server error: {str(e)}"
        }), 500

@app.route('/api/sequential-liveness-detect', methods=['POST'])
def sequential_liveness_detect_optimized():
    """FIXED: Sequential liveness detection with proper error handling"""
    try:
        data = request.get_json()
        user_id = data.get("user_id", "default_user")
        mode = data.get("mode", "registration")
        reset_counters = data.get("reset_counters", False)
        current_step = data.get("current_step", "ready")
        face_image_b64 = data.get("face_image")
        challenge_id = data.get("login_challenge_id")

        if mode == 'login' and not LOGIN_LIVENESS_CHALLENGES.is_pending(challenge_id, user_id):
            return jsonify({'success': False, 'error': 'Valid login challenge required'}), 403

        logger.info(f"[API] Request: user={user_id}, mode={mode}, step={current_step}, reset={reset_counters}")

        if not face_image_b64:
            logger.error(" [API] No face image provided")
            return jsonify({'success': False, 'error': 'Face image required'}), 400

        #  Proper session creation with all required fields
        with session_lock:
            if reset_counters or user_id not in USER_SESSIONS:
                logger.info(f"[SESSION] Creating new session for user {user_id}")
                
                #  Create session with ALL fields initialized
                session = EnhancedLivenessSession(
                    user_id=user_id,
                    start_time=time.time(),
                    mode=mode,
                    current_step=current_step,
                    required_blinks=2,          
                    required_mouth=1,           
                    required_head=1,           
                    required_score=0.2,
                    all_requirements_met=False,  
                    completion_time=0.0,
                    last_face_score=0.0,
                    last_enhanced_score=0.0,
                    registration_data={},
                    login_challenge_id=challenge_id if mode == 'login' else ''
                )
                
                USER_SESSIONS[user_id] = session
                
                if 'DETECTOR' in globals():
                    DETECTOR.reset_user_counters(user_id)
                    
                logger.info("[SESSION] Created for user=%s mode=%s (challenge ID redacted)", user_id, mode)
            else:
                session = USER_SESSIONS[user_id]
                if mode == 'login' and session.login_challenge_id != challenge_id:
                    # Never carry completed state across independently issued challenges.
                    session.all_requirements_met = False
                    session.login_challenge_id = challenge_id
                    DETECTOR.reset_user_counters(user_id)
                session.current_step = current_step
                
                if not hasattr(session, 'all_requirements_met'):
                    logger.warning(f"[FIX] Adding missing all_requirements_met to session")
                    session.all_requirements_met = False
                if not hasattr(session, 'last_face_score'):
                    session.last_face_score = 0.0
                if not hasattr(session, 'last_enhanced_score'):
                    session.last_enhanced_score = 0.0

        logger.info(f" [SESSION] State - all_met: {getattr(session, 'all_requirements_met', 'MISSING')}")

        if getattr(session, 'all_requirements_met', False):
            logger.info(f" [CACHE] Returning cached completion for user {user_id}")
            return jsonify({
                'success': True,
                'face_detected': True,
                'blink_count': 2,  
                'mouth_open_count': 1, 
                'head_movement_count': 1,
                'face_real_score': getattr(session, 'last_face_score', 0.9),
                'enhanced_face_score': getattr(session, 'last_enhanced_score', 0.9),
                'sequential_state': {
                    'current_phase': 'complete',
                    'blinks_completed': True,
                    'mouth_completed': True,
                    'head_completed': True,
                    'all_phases_complete': True
                },
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

        logger.info(f"  [PROCESSING] Processing frame for user {user_id}")
        result = process_frame_api(face_image_b64, user_id, reset_counters, mode=mode)

        if result['success']:
            session.last_face_score = result.get('liveness_score', 0.0)
            session.last_enhanced_score = result.get('enhanced_face_score', result.get('liveness_score', 0.0))
            
            raw_blinks = result.get('blink_count', 0)
            raw_mouth = result.get('mouth_open_count', 0)
            raw_head = result.get('head_movement_count', 0)
            
            capped_blinks = min(raw_blinks, 2)
            capped_mouth = min(raw_mouth, 1)
            capped_head = min(raw_head, 1)
            
            logger.info(f"[COUNTS] Raw: B{raw_blinks}/M{raw_mouth}/H{raw_head} → Capped: B{capped_blinks}/M{capped_mouth}/H{capped_head}")
            
            # Use per-session requirements, not the UI's 2/1/1 display caps.
            detector_state = result.get('sequential_state') or {}
            requirements = detector_state.get('requirements') or {}
            req_blinks = requirements.get('blinks', session.required_blinks)
            req_mouth = requirements.get('mouth', session.required_mouth)
            req_head = requirements.get('head', session.required_head)
            step_requirements = {
                'blinks_met': raw_blinks >= req_blinks,
                'mouth_met': raw_mouth >= req_mouth,
                'head_met': raw_head >= req_head,
                'score_met': session.last_enhanced_score > 0.2
            }
            
            all_met = all(step_requirements.values())
            
            # The detector's own validation takes precedence over API counters.
            all_met = bool(result.get('liveness_passed', False))
            if all_met and mode == 'login':
                all_met = LOGIN_LIVENESS_CHALLENGES.mark_liveness_completed(challenge_id, user_id)
            if all_met and not getattr(session, 'all_requirements_met', False):
                session.all_requirements_met = True
                session.completion_time = time.time() - session.start_time
                logger.info(f" [COMPLETE] User {user_id} completed in {session.completion_time:.2f}s")

            if all_met:
                current_phase = "complete"
            else:
                current_phase = detector_state.get('current_phase') or 'blinking'

            sequential_state = {
                'current_phase': current_phase,
                'blinks_completed': raw_blinks >= req_blinks,
                'mouth_completed': raw_mouth >= req_mouth,
                'head_completed': raw_head >= req_head,
                'all_phases_complete': all_met,
                'challenge_order': [],  # Do not leak or misstate future active steps.
                'screen_replay_challenge': detector_state.get('screen_replay_challenge'),
                'requirements': {
                    'blinks': req_blinks, 'mouth': req_mouth, 'head': req_head
                }
            }

            response_data = {
                'success': True,
                'face_detected': result.get('face_detected', True),
                'blink_count': raw_blinks,        
                'mouth_open_count': raw_mouth,  
                'head_movement_count': raw_head, 
                'face_real_score': result.get('liveness_score', 0),
                'enhanced_face_score': session.last_enhanced_score,
                'sequential_state': sequential_state,
                'liveness_validation': {
                    'overall_liveness_passed': all_met,
                    'step_requirements': step_requirements,
                    'current_step': current_step,
                    'mode': mode
                },
                'all_completed': getattr(session, 'all_requirements_met', False),
                'debug_info': {
                    'raw_counts': f"B{raw_blinks}/M{raw_mouth}/H{raw_head}",
                    'capped_counts': f"B{capped_blinks}/M{capped_mouth}/H{capped_head}",
                    'requirements': sequential_state['requirements']
                }
            }

            logger.info(f" [RESPONSE] Success: phase={current_phase}, all_met={all_met}")
            return jsonify(response_data)
        else:
            logger.error(f" [PROCESSING] Failed: {result.get('error', 'Unknown')}")
            return jsonify({
                'success': False,
                'face_detected': result.get('face_detected', False),
                'blink_count': result.get('blink_count', 0),
                'mouth_open_count': result.get('mouth_open_count', 0),
                'head_movement_count': result.get('head_movement_count', 0),
                'face_real_score': result.get('liveness_score', 0),
                'enhanced_face_score': 0,
                'alert_type': result.get('alert_type'),
                'sequential_state': result.get('sequential_state', {}),
                'liveness_validation': {
                    'overall_liveness_passed': False,
                    'step_requirements': {
                        'blinks_met': False,
                        'mouth_met': False,
                        'head_met': False,
                        'score_met': False
                    }
                },
                'error': result.get('error', 'Processing failed')
            }), 400
            
    except Exception as e:
        logger.error(f" [FATAL ERROR] Detection error: {e}", exc_info=True)
        return jsonify({
            'success': False, 
            'error': f'Internal server error: {str(e)}',
            'error_type': type(e).__name__,
            'traceback': str(e)
        }), 500

@app.route('/api/behavioral-check', methods=['POST'])
@cross_origin()
def enhanced_behavioral_check_fixed():
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData')
        session_id = data.get('session_id', f"check_{user_id}_{int(time.time())}")
        check_type = data.get('check_type', 'enhanced_continuous')
        page_context = data.get('page_context', 'unknown')
        
        if not user_id or not behavioral_data:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        logger.info(f"  behavioral check for user {user_id}")
        
        try:
            validated_data = validate_enhanced_behavioral_data(behavioral_data)
            keystrokes = validated_data['keystrokes']
            mouse_movements = validated_data['mouseMovements']
        except Exception as e:
            logger.error(f"Data validation error: {e}")
            return jsonify({
                'success': False,
                'error': f'Data validation failed: {str(e)}'
            }), 400
        
        if len(keystrokes) < 5:
            # Update monitoring state even with insufficient data
            update_global_monitoring_state(user_id, {
                'similarity_score': 0.8,
                'keystroke_count': len(keystrokes),
                'mouse_count': len(mouse_movements),
                'page_context': page_context,
                'severity': 'low'
            }, anomaly_detected=False)
            
            return jsonify({
                'success': True,
                'similarity_score': 0.8,
                'is_anomaly': False,
                'action_taken': 'insufficient_data',
                'message': f'Insufficient keystroke data (got {len(keystrokes)}, need at least 5)',
                'monitoring_updated': True
            })
        
        # Extract features with proper error handling
        try:
            current_features = extract_basic_behavioral_features(validated_data)
        except Exception as e:
            logger.error(f"Feature extraction error: {e}")
            # Use fallback feature calculation
            current_features = {
                'keystroke_features': {
                    'typing_speed': calculate_typing_speed(keystrokes),
                    'avg_dwell_time': 100.0
                },
                'mouse_features': {
                    'avg_velocity': calculate_mouse_velocity(mouse_movements)
                }
            }
        
        # Get stored pattern with error handling
        stored_pattern = get_stored_pattern_safe(user_id)
        
        # Calculate similarity with proper error handling
        try:
            similarity_results = calculate_enhanced_similarity_safe(current_features, stored_pattern)
            overall_similarity = similarity_results['overall_similarity']
        except Exception as e:
            logger.error(f" Similarity calculation error: {e}")
            overall_similarity = 0.5  # Default safe score
            similarity_results = {
                'overall_similarity': 0.5,
                'keystroke_similarity': 0.5,
                'mouse_similarity': 0.5
            }
        
        # Enhanced thresholds
        ANOMALY_THRESHOLD = 0.35
        CRITICAL_THRESHOLD = 0.15
        
        is_anomaly = overall_similarity < ANOMALY_THRESHOLD
        is_critical = overall_similarity < CRITICAL_THRESHOLD
        
        if is_critical:
            action_taken = 'auto_lock'
            severity = 'critical'
        elif is_anomaly:
            action_taken = 'warning'
            severity = 'high'
        else:
            action_taken = 'passed'
            severity = 'low'
        
        # Update monitoring state for real-time updates
        update_global_monitoring_state(user_id, {
            'similarity_score': overall_similarity,
            'keystroke_count': len(keystrokes),
            'mouse_count': len(mouse_movements),
            'page_context': page_context,
            'severity': severity,
            'action_taken': action_taken
        }, anomaly_detected=is_anomaly)
        
        #  Save data with guaranteed persistence
        session_saved = save_behavioral_session_safe(user_id, session_id, {
            'similarity_score': overall_similarity,
            'keystroke_count': len(keystrokes),
            'mouse_count': len(mouse_movements),
            'is_successful': not is_anomaly,
            'verification_type': check_type,
            'page_context': page_context
        })
        
        anomaly_saved = False
        if is_anomaly:
            anomaly_saved = save_anomaly_safe(user_id, session_id, {
                'anomaly_score': 1 - overall_similarity,
                'severity': severity,
                'action_taken': action_taken,
                'similarity_score': overall_similarity,
                'keystroke_count': len(keystrokes),
                'mouse_count': len(mouse_movements),
                'page_context': page_context
            })
        
        logger.info(f" behavioral check completed - similarity: {overall_similarity:.3f}, anomaly: {is_anomaly}")
        
        return jsonify({
            'success': True,
            'similarity_score': float(overall_similarity),
            'keystroke_similarity': float(similarity_results.get('keystroke_similarity', 0.5)),
            'mouse_similarity': float(similarity_results.get('mouse_similarity', 0.5)),
            'is_anomaly': is_anomaly,
            'is_critical': is_critical,
            'action_taken': action_taken,
            'severity': severity,
            'session_id': session_id,
            'monitoring_updated': True,
            'data_saved': {
                'session_saved': session_saved,
                'anomaly_saved': anomaly_saved
            }
        })
        
    except Exception as e:
        logger.error(f" behavioral check error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'monitoring_updated': False
        }), 500


@app.route('/api/ekyc', methods=['POST'])
def ekyc_process():
    """FIXED: Enhanced eKYC processing with corrected OCR"""
    try:
        data = request.get_json()
        base64_image = data.get("image")
        side = data.get("side", "front")  # Either 'front' or 'back'
        user_id = data.get("user_id", "unknown")

        if not base64_image:
            return jsonify({"success": False, "error": "No image provided"}), 400

        logger.info(f"  Processing eKYC for user: {user_id} ({side} side)")

        # Decode image
        if ',' in base64_image:
            base64_image = base64_image.split(",")[1]
        img_data = base64.b64decode(base64_image)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"success": False, "error": "Invalid image format"}), 400

        logger.info(" Starting MyKad OCR processing...")

        if side == "front":
            ocr_result = mykad_ocr.process_mykad_front(img)
        else:
            ocr_result = mykad_ocr.process_mykad_back(img)

        logger.info(f" OCR result: {ocr_result.get('success', False)}")
        
        if ocr_result.get('success'):
            ic_number = ocr_result.get('ic_number_back') if side == 'back' else ocr_result.get('extracted_info', {}).get('ic_number')
            logger.info(f"IC number extracted: {ic_number}")
            
            if side == 'front':
                extracted_info = ocr_result.get('extracted_info', {})
                authenticity = ocr_result.get('authenticity', {})
                
                overall_success = bool(ic_number) and authenticity.get('authenticity_score', 0) >= 0.35
                
                if not extracted_info.get('gender') and ic_number:
                    try:
                        last_digit = int(ic_number[-1])
                        gender = "LELAKI" if last_digit % 2 == 1 else "PEREMPUAN"
                        extracted_info['gender'] = gender
                        logger.info(f"Gender extracted from IC: {gender} (last digit: {last_digit})")
                    except Exception as e:
                        logger.error(f"Error extracting gender from IC: {e}")
                
                # Enhanced response
                return jsonify({
                    'success': overall_success,
                    'extracted_info': extracted_info,
                    'authenticity': ocr_result.get('authenticity', {}),
                    'confidence': ocr_result.get('confidence', 0.8),
                    'processing_details': {
                        'side': side,
                        'ic_extracted': bool(ic_number),
                        'gender_extracted': bool(extracted_info.get('gender')),
                        'name_extracted': bool(extracted_info.get('name')),
                        'address_extracted': bool(extracted_info.get('address'))
                    }
                })
            else:
                # Back side response
                return jsonify({
                    'success': True,
                    'ic_number_back': ic_number,
                    'security_features': ocr_result.get('security_features', {}),
                    'side': side
                })
        else:
            logger.warning(f" OCR failed: {ocr_result.get('error', 'Unknown error')}")
            return jsonify({
                'success': False,
                'error': ocr_result.get('error', 'OCR processing failed'),
                'debug_info': {
                    'side': side,
                    'confidence': ocr_result.get('confidence', 0),
                    'debug_text': ocr_result.get('debug_text', '')[:200]
                }
            })

    except Exception as e:
        logger.error(f"eKYC process error: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500

# ============= LIVENESS DETECTION ENDPOINTS =============

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

def process_frame_api(face_image_b64: str, user_id: str = None, reset_counters: bool = False, mode: str = 'registration'):
    """Process frame for liveness detection with user-specific tracking"""
    try:
        if user_id is None:
            user_id = "default_user"

        if reset_counters and 'DETECTOR' in globals():
            DETECTOR.reset_user_counters(user_id)

        frame = process_base64_image(face_image_b64)
        result = DETECTOR.process_frame_for_user(frame, user_id, mode)

        # Build liveness_validation field to match frontend expectations
        # Report the detector's actual challenge counts, not unrelated API defaults.
        state = DETECTOR.get_user_state(user_id, mode)
        step_requirements = {
            'blinks_met': result['blink_count'] >= state.required_blinks,
            'mouth_met': result['mouth_open_count'] >= state.required_mouth_opens,
            'head_met': result['head_movement_count'] >= state.required_head_movements,
            'score_met': result['liveness_score'] >= 0.2
        }
        all_met = bool(result.get('liveness_passed', False))

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

@app.route('/api/biometric-login-verify', methods=['POST', 'OPTIONS'])
@cross_origin()
def biometric_login_verify():
    try:
        if request.method == 'OPTIONS':
            response = make_response()
            response.headers.add("Access-Control-Allow-Origin", request.headers.get('Origin'))
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
            return response

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data provided'}), 400

        user_id = data.get('user_id')
        face_image_b64 = data.get('face_image')
        login_challenge_id = data.get('login_challenge_id')
        ip_address = request.remote_addr
        user_agent = request.headers.get('User-Agent', '')

        if not user_id or not face_image_b64:
            return jsonify({'success': False, 'error': 'User ID and face image are required'}), 400
        if not LOGIN_LIVENESS_CHALLENGES.is_liveness_completed(login_challenge_id, user_id):
            return jsonify({'success': False, 'error': 'Server-verified liveness challenge required'}), 403

        logger.info(f" Starting biometric login verification for user: {user_id}")

        if not supabase_manager.client:
            return jsonify({'success': False, 'error': 'Database not available'}), 500

        # Get user email for logging
        user_result = supabase_manager.client.table("users") \
            .select("email") \
            .eq("id", user_id) \
            .single() \
            .execute()

        user_email = user_result.data['email'] if user_result.data else 'unknown'
        
        face_image_url = ''
        try:
            # Convert base64 to binary for storage
            if ',' in face_image_b64:
                base64_content = face_image_b64.split(',')[1]
            else:
                base64_content = face_image_b64
            
            binary_data = base64.b64decode(base64_content)
            timestamp = int(time.time())
            
            # Upload face image for audit
            face_image_url = supabase_manager.upload_debug_face_file(
                user_id, binary_data, timestamp
            )
            logger.info(f"📸 Login face image saved: {face_image_url}")
            
        except Exception as upload_error:
            logger.error(f"Failed to save login face image: {upload_error}")
            # Continue with verification even if image save fails

        enrolled_biometric = supabase_manager.client.table("biometric_data") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("biometric_type", "face") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if not enrolled_biometric.data:
            # Log failed attempt
            supabase_manager.save_login_audit(
                user_id=user_id,
                email=user_email,
                success=False,
                error_reason="No enrolled biometric data found",
                ip_address=ip_address,
                user_agent=user_agent,
                face_image_url=face_image_url
            )
            return jsonify({
                'success': False, 
                'error': 'No enrolled biometric data found'
            }), 400

        enrolled_face = enrolled_biometric.data[0]
        stored_embedding = enrolled_face.get('face_embedding', [])
        
        if not face_verifier:
            logger.error("Face verifier not initialized")
            return jsonify({'success': False, 'error': 'Face verification service unavailable'}), 500
        
        # Compare faces with proper data types
        similarity_score, is_match = face_verifier.compare_faces(
            stored_embedding,  # List from database
            face_image_b64     # Base64 string to be processed
        )
        
        # Log the login attempt
        audit_result = supabase_manager.save_login_audit(
            user_id=user_id,
            email=user_email,
            success=is_match,
            error_reason=None if is_match else f"Face similarity too low: {similarity_score:.3f}",
            ip_address=ip_address,
            user_agent=user_agent,
            biometric_scores={
                'face_similarity': similarity_score,
                'threshold_used': face_verifier.LOGIN_THRESHOLD
            },
            face_image_url=face_image_url
        )
        
        if is_match:
            if not LOGIN_LIVENESS_CHALLENGES.consume(login_challenge_id, user_id):
                return jsonify({'success': False, 'error': 'Liveness challenge expired or already used'}), 403
            logger.info(f"Biometric login successful for user {user_id}")
            return jsonify({
                'success': True,
                'similarity_score': similarity_score,
                'message': 'Biometric verification successful'
            })
        else:
            logger.warning(f" Biometric login failed for user {user_id} - similarity: {similarity_score:.3f}")
            return jsonify({
                'success': False,
                'error': 'Face verification failed',
                'similarity_score': similarity_score,
                # 'message': f'Face similarity ({similarity_score:.3f}) below threshold ({face_verifier.LOGIN_THRESHOLD})'
            }), 401

    except Exception as e:
        logger.error(f"Error in biometric login verification: {str(e)}", exc_info=True)
        
        # Try to save failed audit if possible
        try:
            if 'user_id' in locals() and 'user_email' in locals():
                supabase_manager.save_login_audit(
                    user_id=user_id,
                    email=user_email,
                    success=False,
                    error_reason=f"System error: {str(e)}",
                    ip_address=request.remote_addr,
                    user_agent=request.headers.get('User-Agent', ''),
                    face_image_url=face_image_url if 'face_image_url' in locals() else ''
                )
        except Exception as audit_error:
            logger.error(f"Failed to save error audit: {audit_error}")
        
        return jsonify({
            'success': False, 
            'error': 'Internal server error during biometric verification'
        }), 500
    
# ============= SIMPLIFIED BEHAVIORAL ENDPOINTS =============

@app.route('/api/behavioral-test', methods=['POST'])
@cross_origin()
def behavioral_test_simple():
    """SIMPLIFIED: Behavioral test with GUARANTEED anomaly saving"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData')
        session_id = data.get('session_id', f"test_{user_id}_{int(time.time())}")
        
        if not user_id or not behavioral_data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: user_id and behavioralData'
            }), 400
        
        logger.info(f" SIMPLE: Running behavioral test for user {user_id}")
        
        # Extract data
        keystrokes = behavioral_data.get('keystrokes', [])
        mouse_movements = behavioral_data.get('mouseMovements', [])
        
        print(f"DATA RECEIVED: {len(keystrokes)} keystrokes, {len(mouse_movements)} mouse events")
        
        if len(keystrokes) < 5:
            return jsonify({
                'success': False,
                'error': f'Insufficient keystroke data (got {len(keystrokes)}, need at least 5)'
            }), 400
        
        # SIMPLIFIED: Calculate basic features
        current_features = calculate_simple_features(keystrokes, mouse_movements)
        
        # Get or use default baseline
        stored_pattern = get_stored_pattern_simple(user_id)
        
        # SIMPLIFIED: Calculate similarity
        similarity_score = calculate_simple_similarity(current_features, stored_pattern)
        
        print(f"SIMILARITY CALCULATED: {similarity_score:.3f}")
        
        # SIMPLIFIED: Anomaly detection with LOWER thresholds for easier testing
        ANOMALY_THRESHOLD = 0.6   # 60% similarity threshold (easier to trigger)
        CRITICAL_THRESHOLD = 0.3  # 30% for auto-lock
        
        is_anomaly = similarity_score < ANOMALY_THRESHOLD
        is_critical = similarity_score < CRITICAL_THRESHOLD
        
        # Determine action and severity
        if is_critical:
            action_taken = 'auto_lock'
            severity = 'critical'
        elif is_anomaly:
            action_taken = 'warning'
            severity = 'high'
        else:
            action_taken = 'passed'
            severity = 'low'
        
        print(f"ANOMALY STATUS: is_anomaly={is_anomaly}, action={action_taken}, severity={severity}")
        
        # STEP 1: Save behavioral session (GUARANTEED)
        session_saved = save_behavioral_session_simple(user_id, session_id, {
            'similarity_score': similarity_score,
            'keystroke_count': len(keystrokes),
            'mouse_count': len(mouse_movements),
            'is_successful': not is_anomaly,
            'action_taken': action_taken
        })
        
        # STEP 2: Save anomaly if detected (GUARANTEED)
        anomaly_saved = False
        if is_anomaly:
            anomaly_saved = save_anomaly_simple(user_id, session_id, {
                'anomaly_score': 1 - similarity_score,
                'severity': severity,
                'action_taken': action_taken,
                'similarity_score': similarity_score,
                'keystroke_count': len(keystrokes),
                'mouse_count': len(mouse_movements)
            })
            
            print(f" ANOMALY SAVE RESULT: {anomaly_saved}")
        
        # Return comprehensive results
        result = {
            'success': True,
            'similarity_score': float(similarity_score),
            'is_anomaly': is_anomaly,
            'action_taken': action_taken,
            'severity': severity,
            'session_id': session_id,
            'details': {
                'keystroke_count': len(keystrokes),
                'mouse_count': len(mouse_movements)
            },
            'data_saved': {
                'session_saved': session_saved,
                'anomaly_saved': anomaly_saved
            }
        }
        
        print(f"BEHAVIORAL TEST COMPLETE: similarity={similarity_score:.3f}, anomaly={is_anomaly}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f" SIMPLE: Behavioral test error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/behavioral-test', methods=['POST'])
@cross_origin()
def behavioral_test_fixed():
    """
    CRITICAL FIX: Enhanced behavioral test with guaranteed data persistence
    """
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        behavioral_data = data.get('behavioralData')
        session_id = data.get('session_id', f"test_{user_id}_{int(time.time())}")
        test_mode = data.get('test_mode', True)
        
        if not user_id or not behavioral_data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: user_id and behavioralData'
            }), 400
        
        logger.info(f"Running enhanced behavioral test for user {user_id}")
        
        # CRITICAL: Ensure UUID format
        user_id_uuid = ensure_uuid_format(user_id)
        
        # CRITICAL: Validate and clean data
        validated_data = validate_behavioral_data(behavioral_data)
        
        keystrokes = validated_data['keystrokes']
        mouse_movements = validated_data['mouseMovements']
        
        if len(keystrokes) < 5:
            return jsonify({
                'success': False,
                'error': f'Insufficient keystroke data (got {len(keystrokes)}, need at least 5)',
                'debug_info': {
                    'keystrokes_received': len(behavioral_data.get('keystrokes', [])),
                    'keystrokes_validated': len(keystrokes),
                    'mouse_events_received': len(behavioral_data.get('mouseMovements', [])),
                    'mouse_events_validated': len(mouse_movements)
                }
            }), 400
        
        # CRITICAL: Calculate enhanced features
        current_features = calculate_features(validated_data)
        
        # Get stored baseline pattern
        stored_pattern = None
        if supabase_manager.client:
            try:
                pattern_result = supabase_manager.client.table("behavioral_patterns") \
                    .select("pattern_data") \
                    .eq("user_id", user_id_uuid) \
                    .eq("is_active", True) \
                    .order("created_at", desc=True) \
                    .limit(1) \
                    .execute()
                
                if pattern_result.data:
                    stored_pattern = pattern_result.data[0]['pattern_data']
                    logger.info(f" Found stored behavioral pattern for user {user_id_uuid}")
                else:
                    logger.warning(f" No stored pattern found for user {user_id_uuid}")
            except Exception as e:
                logger.error(f"Error getting stored pattern: {e}")
        
        # Use enhanced baseline if no stored pattern
        if not stored_pattern:
            stored_pattern = {
                'keystroke_features': {
                    'typing_speed': 45.0,
                    'avg_dwell_time': 120.0,
                    'avg_flight_time': 200.0,
                    'rhythm_consistency': 0.7
                },
                'mouse_features': {
                    'avg_velocity': 150.0,
                    'avg_distance': 50.0,
                    'avg_click_interval': 1500.0
                }
            }
            logger.info("Using enhanced default baseline pattern")
        
        # CRITICAL: Calculate detailed similarity
        similarity_results = calculate_similarity(current_features, stored_pattern)
        overall_similarity = similarity_results['overall_similarity']
        
        # Enhanced anomaly detection with configurable thresholds
        ANOMALY_THRESHOLD = 0.4   # 40% similarity threshold
        CRITICAL_THRESHOLD = 0.2  # 20% for auto-lock
        
        is_anomaly = overall_similarity < ANOMALY_THRESHOLD
        is_critical = overall_similarity < CRITICAL_THRESHOLD
        
        # Determine action and severity
        if is_critical:
            action_taken = 'auto_lock'
            severity = 'critical'
        elif is_anomaly:
            action_taken = 'warning'
            severity = 'high'
        else:
            action_taken = 'passed'
            severity = 'low'
        
        # CRITICAL: Save behavioral session with enhanced data
        session_data = {
            'user_id': user_id_uuid,  # UUID format for behavioral_sessions table
            'session_id': session_id,
            'keystroke_features': current_features.get('keystroke_features', {}),
            'mouse_features': current_features.get('mouse_features', {}),
            'similarity_scores': {
                'overall_similarity': float(overall_similarity),
                'keystroke_similarity': float(similarity_results['keystroke_similarity']),
                'mouse_similarity': float(similarity_results['mouse_similarity'])
            },
            'anomaly_score': float(1 - overall_similarity),
            'is_successful': not is_anomaly,
            'verification_type': 'behavioral_test',
            'duration_seconds': int(current_features.get('overall_metrics', {}).get('session_duration', 0)),
            'page_context': '/behavioral-test',
            'created_at': datetime.now().isoformat()
        }
        
        session_saved = supabase_manager.save_behavioral_session_guaranteed(session_data)
        logger.info(f"Session save result: {session_saved}")
        
        # CRITICAL: Save anomaly if detected with enhanced details
        anomaly_saved = False
        if is_anomaly:
            anomaly_data = {
                'user_id': user_id_uuid,  # UUID format for anomaly_audit table
                'session_id': session_id,
                'anomaly_type': 'behavioral_test_anomaly',
                'anomaly_score': float(1 - overall_similarity),
                'severity': severity,
                'action_taken': action_taken,
                'details': {
                    'test_mode': test_mode,
                    'similarity_score': float(overall_similarity),
                    'similarity_breakdown': similarity_results['feature_breakdown'],
                    'threshold': ANOMALY_THRESHOLD,
                    'features': current_features,
                    'page_context': '/behavioral-test',
                    'test_timestamp': datetime.now().isoformat(),
                    'data_quality': {
                        'keystrokes_count': len(keystrokes),
                        'mouse_events_count': len(mouse_movements),
                        'session_duration': current_features.get('overall_metrics', {}).get('session_duration', 0)
                    }
                },
                'manual_review_required': is_critical,
                'created_at': datetime.now().isoformat()
            }
            
            anomaly_saved = supabase_manager.save_anomaly_guaranteed(anomaly_data)
            logger.info(f"Anomaly save result: {anomaly_saved}")
            
            if anomaly_saved:
                logger.info(f" Anomaly saved for test: user={user_id_uuid}, similarity={overall_similarity:.3f}")
            else:
                logger.error(f" Failed to save anomaly for test: user={user_id_uuid}")
        
        # CRITICAL: Auto-lock user if critical anomaly
        if is_critical and supabase_manager.client:
            try:
                supabase_manager.client.table("users") \
                    .update({"status": "suspended", "suspension_reason": f"Critical behavioral test anomaly: {overall_similarity:.3f}"}) \
                    .eq("id", user_id_uuid) \
                    .execute()
                logger.warning(f" User {user_id_uuid} auto-locked due to critical behavioral anomaly")
            except Exception as e:
                logger.error(f" Failed to auto-lock user: {e}")
        
        # Return comprehensive results
        result = {
            'success': True,
            'similarity_score': float(overall_similarity),
            'keystroke_similarity': float(similarity_results['keystroke_similarity']),
            'mouse_similarity': float(similarity_results['mouse_similarity']),
            'is_anomaly': is_anomaly,
            'is_critical': is_critical,
            'action_taken': action_taken,
            'severity': severity,
            'session_id': session_id,
            'thresholds': {
                'anomaly': ANOMALY_THRESHOLD,
                'critical': CRITICAL_THRESHOLD
            },
            'details': {
                'keystroke_count': len(keystrokes),
                'mouse_count': len(mouse_movements),
                'current_features': current_features,
                'baseline_available': stored_pattern is not None,
                'similarity_breakdown': similarity_results['feature_breakdown']
            },
            'data_saved': {
                'session_saved': session_saved,
                'anomaly_saved': anomaly_saved
            }
        }
        
        logger.info(f" Behavioral test completed for user {user_id_uuid}: similarity={overall_similarity:.3f}, anomaly={is_anomaly}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f" Behavioral test error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'debug_info': {
                'user_id': data.get('user_id') if 'data' in locals() else 'unknown',
                'data_keys': list(data.keys()) if 'data' in locals() and data else []
            }
        }), 500


@app.route('/api/save-anomaly', methods=['POST'])
@cross_origin()
def save_anomaly_enhanced():
    """ENHANCED: Save anomaly with guaranteed database persistence"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id is required'
            }), 400
        
        # Convert user_id to UUID format for anomaly_audit table
        try:
            uuid_obj = uuid.UUID(user_id)
            user_id_uuid = str(uuid_obj)
        except ValueError:
            logger.error(f" Invalid UUID format for user_id: {user_id}")
            return jsonify({
                'success': False,
                'error': 'Invalid user_id format - must be UUID'
            }), 400
        
        logger.info(f" Saving anomaly for user {user_id_uuid}")
        
        # Build comprehensive anomaly record matching exact schema
        current_time = datetime.now()
        
        anomaly_record = {
            'user_id': user_id_uuid,  # UUID type
            'session_id': data.get('session_id', f"session_{int(current_time.timestamp())}"),  # TEXT type
            'anomaly_type': data.get('anomaly_type', 'behavioral_anomaly'),  # TEXT type
            'anomaly_score': float(data.get('score', data.get('anomaly_score', 0.0))),  # DOUBLE PRECISION type
            'severity': data.get('severity', 'medium'),  # TEXT type
            'action_taken': data.get('action_taken', 'logged'),  # TEXT type
            'details': data.get('details', {}),  # JSONB type
            'created_at': current_time.isoformat(),  # TIMESTAMP WITHOUT TIME ZONE
            'event_ts': current_time.isoformat(),  # TIMESTAMP WITH TIME ZONE
            'manual_review_required': data.get('manual_review_required', False),  # BOOLEAN
            'auto_resolved': False,  # BOOLEAN
            'reviewed_by': None,  # UUID (optional)
            'reviewed_at': None,  # TIMESTAMP WITH TIME ZONE (optional)
            'auto_resolved_at': None,  # TIMESTAMP WITH TIME ZONE (optional)
            'related_session_id': None,  # UUID (optional)
            'biometric_data_id': None,  # UUID (optional)
            'behavioral_pattern_id': None  # UUID (optional)
        }
        
        # Clean None values but keep required fields
        cleaned_record = {k: v for k, v in anomaly_record.items() if v is not None}
        
        # Validate JSON serialization
        try:
            json.dumps(cleaned_record, default=str)
        except (TypeError, ValueError) as e:
            logger.error(f"JSON serialization error: {e}")
            return jsonify({
                'success': False,
                'error': 'Data serialization failed'
            }), 400
        
        if not supabase_manager.client:
            logger.warning("No Supabase client - using mock save")
            return jsonify({
                "success": True, 
                "message": "Anomaly saved (mock mode)",
                "anomaly_id": f"mock_{int(current_time.timestamp())}"
            }), 200
        
        # CRITICAL: Save to anomaly_audit table with retry logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = supabase_manager.client.table("anomaly_audit").insert(cleaned_record).execute()
                
                if result.data and len(result.data) > 0:
                    anomaly_id = result.data[0]['id']
                    logger.info(f"Anomaly saved successfully on attempt {attempt + 1}: {anomaly_id}")
                    
                    # Trigger real-time notification
                    trigger_anomaly_notification(user_id_uuid, anomaly_id, cleaned_record)
                    
                    return jsonify({
                        "success": True, 
                        "message": "Anomaly saved successfully",
                        "anomaly_id": anomaly_id,
                        "attempt": attempt + 1
                    }), 200
                else:
                    raise Exception("No data returned from Supabase insert")
                    
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed to save anomaly: {e}")
                if attempt == max_retries - 1:  # Last attempt
                    logger.error(f"CRITICAL: All {max_retries} attempts failed to save anomaly")
                    return jsonify({
                        "success": False, 
                        "error": f"Failed to save anomaly after {max_retries} attempts: {str(e)}"
                    }), 500
                
                # Wait before retry
                import time
                time.sleep(0.5 * (attempt + 1))
        
    except Exception as e:
        logger.error(f"CRITICAL: Enhanced save anomaly error: {e}", exc_info=True)
        return jsonify({
            "success": False, 
            "error": f"Internal server error: {str(e)}"
        }), 500

def trigger_anomaly_notification(user_id: str, anomaly_id: str, anomaly_data: dict):
    """Trigger real-time anomaly notifications"""
    try:
        # Create notification payload
        notification_payload = {
            'type': 'anomaly_detected',
            'user_id': user_id,
            'anomaly_id': anomaly_id,
            'severity': anomaly_data.get('severity', 'medium'),
            'action_taken': anomaly_data.get('action_taken', 'logged'),
            'timestamp': datetime.now().isoformat(),
            'anomaly_type': anomaly_data.get('anomaly_type', 'behavioral'),
            'details': {
                'page': anomaly_data.get('details', {}).get('page', 'unknown'),
                'score': anomaly_data.get('anomaly_score', 0)
            }
        }
        
        # Send to real-time channels (if configured)
        if supabase_manager.client:
            try:
                # You could implement real-time notifications here
                # For now, we'll just log it
                logger.info(f"Real-time notification triggered for anomaly {anomaly_id}")
            except Exception as e:
                logger.error(f"Failed to send real-time notification: {e}")
        
        # Trigger browser event for immediate UI updates
        logger.info(f" Anomaly notification prepared for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error triggering anomaly notification: {e}")

# ============= HELPER FUNCTIONS =============

def calculate_simple_behavioral_features(keystrokes: List, mouse_movements: List) -> Dict:
    features = {
        'typing_speed': 0.0,
        'avg_velocity': 0.0,
        'keystroke_count': len(keystrokes),
        'mouse_count': len(mouse_movements)
    }
    
    try:
        # Typing speed calculation
        if len(keystrokes) > 1:
            time_span = (keystrokes[-1]['timestamp'] - keystrokes[0]['timestamp']) / 1000.0
            if time_span > 0:
                features['typing_speed'] = len(keystrokes) / time_span * 60  # keys per minute
    except Exception as e:
        logger.error(f"Error calculating typing speed: {e}")
        features['typing_speed'] = 40.0  # Default
    
    try:
        # Mouse velocity calculation
        if len(mouse_movements) > 1:
            velocities = []
            for i in range(1, len(mouse_movements)):
                prev = mouse_movements[i-1]
                curr = mouse_movements[i]
                
                if prev.get('type') == 'mousemove' and curr.get('type') == 'mousemove':
                    dx = curr['x'] - prev['x']
                    dy = curr['y'] - prev['y']
                    dt = curr['timestamp'] - prev['timestamp']
                    
                    if dt > 0:
                        distance = math.sqrt(dx*dx + dy*dy)
                        velocity = distance / dt
                        velocities.append(velocity)
            
            if velocities:
                features['avg_velocity'] = sum(velocities) / len(velocities)
    except Exception as e:
        logger.error(f"Error calculating mouse velocity: {e}")
        features['avg_velocity'] = 100.0  # Default
    
    return features

def calculate_basic_similarity(current_features: Dict, user_id: str) -> float:
    try:
        stored_pattern = get_stored_pattern_safe(user_id)
        
        similarities = []
        
        # Typing speed comparison
        current_speed = current_features.get('typing_speed', 40)
        stored_speed = stored_pattern.get('keystroke_features', {}).get('typing_speed', 40)
        if stored_speed > 0:
            speed_diff = abs(current_speed - stored_speed) / stored_speed
            speed_similarity = max(0, 1 - speed_diff)
            similarities.append(speed_similarity)
        
        # Mouse velocity comparison
        current_velocity = current_features.get('avg_velocity', 100)
        stored_velocity = stored_pattern.get('mouse_features', {}).get('avg_velocity', 100)
        if stored_velocity > 0:
            velocity_diff = abs(current_velocity - stored_velocity) / stored_velocity
            velocity_similarity = max(0, 1 - velocity_diff)
            similarities.append(velocity_similarity)
        
        # Return average similarity
        final_similarity = sum(similarities) / len(similarities) if similarities else 0.5
        return max(0.0, min(1.0, final_similarity))
        
    except Exception as e:
        logger.error(f" Error calculating similarity: {e}")
        return 0.5  # Default safe score

def get_stored_pattern_safe(user_id: str) -> Dict:
    try:
        if supabase_manager.client:
            result = supabase_manager.client.table("behavioral_patterns") \
                .select("pattern_data") \
                .eq("user_id", user_id) \
                .eq("is_active", True) \
                .limit(1).execute()
            
            if result.data:
                return result.data[0]['pattern_data']
    except Exception as e:
        logger.error(f"Error getting stored pattern: {e}")
    
    # Return default pattern
    return {
        'keystroke_features': {
            'typing_speed': 45.0,
            'avg_dwell_time': 120.0
        },
        'mouse_features': {
            'avg_velocity': 150.0
        }
    }

def extract_basic_behavioral_features(behavioral_data: Dict) -> Dict:
    features = {
        'keystroke_features': {},
        'mouse_features': {}
    }
    
    keystrokes = behavioral_data.get('keystrokes', [])
    mouse_events = behavioral_data.get('mouseMovements', [])
    
    # Basic keystroke features
    if keystrokes:
        keydown_events = [k for k in keystrokes if k.get('type') == 'keydown']
        
        if len(keydown_events) > 1:
            duration = (keydown_events[-1]['timestamp'] - keydown_events[0]['timestamp']) / 1000.0
            if duration > 0:
                features['keystroke_features']['typing_speed'] = len(keydown_events) / duration * 60
                
        # Simple dwell time calculation
        features['keystroke_features']['avg_dwell_time'] = 120.0  # Default
    
    # Basic mouse features
    if mouse_events:
        move_events = [m for m in mouse_events if m.get('type') == 'mousemove']
        
        if len(move_events) > 1:
            velocities = []
            for i in range(1, len(move_events)):
                prev = move_events[i-1]
                curr = move_events[i]
                
                dx = curr['x'] - prev['x']
                dy = curr['y'] - prev['y']
                dt = curr['timestamp'] - prev['timestamp']
                
                if dt > 0:
                    distance = math.sqrt(dx*dx + dy*dy)
                    velocity = distance / dt
                    velocities.append(velocity)
            
            if velocities:
                features['mouse_features']['avg_velocity'] = sum(velocities) / len(velocities)
    
    return features

def calculate_enhanced_similarity_safe(current_features: Dict, stored_features: Dict) -> Dict:
    try:
        similarities = {
            'keystroke_similarity': 0.5,
            'mouse_similarity': 0.5,
            'overall_similarity': 0.5
        }
        
        # Keystroke similarity
        if current_features.get('keystroke_features') and stored_features.get('keystroke_features'):
            current_ks = current_features['keystroke_features']
            stored_ks = stored_features['keystroke_features']
            
            keystroke_sims = []
            for feature in ['typing_speed', 'avg_dwell_time']:
                if feature in current_ks and feature in stored_ks:
                    curr_val = float(current_ks[feature])
                    stored_val = float(stored_ks[feature])
                    
                    if stored_val > 0:
                        diff = abs(curr_val - stored_val) / stored_val
                        similarity = max(0, 1 - diff)
                        keystroke_sims.append(similarity)
            
            if keystroke_sims:
                similarities['keystroke_similarity'] = sum(keystroke_sims) / len(keystroke_sims)
        
        # Mouse similarity
        if current_features.get('mouse_features') and stored_features.get('mouse_features'):
            current_ms = current_features['mouse_features']
            stored_ms = stored_features['mouse_features']
            
            if 'avg_velocity' in current_ms and 'avg_velocity' in stored_ms:
                curr_vel = float(current_ms['avg_velocity'])
                stored_vel = float(stored_ms['avg_velocity'])
                
                if stored_vel > 0:
                    diff = abs(curr_vel - stored_vel) / stored_vel
                    similarities['mouse_similarity'] = max(0, 1 - diff)
        
        # Overall similarity
        similarities['overall_similarity'] = (similarities['keystroke_similarity'] * 0.6 + 
                                            similarities['mouse_similarity'] * 0.4)
        
        return similarities
        
    except Exception as e:
        logger.error(f" Error calculating enhanced similarity: {e}")
        return {
            'keystroke_similarity': 0.5,
            'mouse_similarity': 0.5,
            'overall_similarity': 0.5
        }

def validate_enhanced_behavioral_data(behavioral_data: Dict) -> Dict:
    validated_data = {
        'keystrokes': [],
        'mouseMovements': []
    }
    
    try:
        # Validate keystrokes
        if 'keystrokes' in behavioral_data and isinstance(behavioral_data['keystrokes'], list):
            for keystroke in behavioral_data['keystrokes']:
                if isinstance(keystroke, dict) and 'key' in keystroke and 'timestamp' in keystroke:
                    validated_keystroke = {
                        'key': str(keystroke.get('key', '')),
                        'timestamp': float(keystroke.get('timestamp', 0)),
                        'type': str(keystroke.get('type', 'keydown'))
                    }
                    validated_data['keystrokes'].append(validated_keystroke)
        
        # Validate mouse movements
        if 'mouseMovements' in behavioral_data and isinstance(behavioral_data['mouseMovements'], list):
            for mouse_event in behavioral_data['mouseMovements']:
                if isinstance(mouse_event, dict) and 'x' in mouse_event and 'y' in mouse_event:
                    validated_mouse = {
                        'x': int(mouse_event.get('x', 0)),
                        'y': int(mouse_event.get('y', 0)),
                        'timestamp': float(mouse_event.get('timestamp', 0)),
                        'type': str(mouse_event.get('type', 'mousemove'))
                    }
                    validated_data['mouseMovements'].append(validated_mouse)
    
    except Exception as e:
        logger.error(f"Data validation error: {e}")
    
    return validated_data

def save_behavioral_session_safe(user_id: str, session_id: str, data: Dict) -> bool:
    try:
        if not supabase_manager.client:
            return False
        
        session_data = {
            'user_id': str(user_id),
            'session_id': session_id,
            'similarity_scores': {
                'overall_similarity': float(data.get('similarity_score', 0.5))
            },
            'anomaly_score': float(1 - data.get('similarity_score', 0.5)),
            'is_successful': data.get('is_successful', True),
            'verification_type': data.get('verification_type', 'continuous'),
            'page_context': data.get('page_context', 'unknown'),
            'behavioral_metrics': {
                'keystroke_count': data.get('keystroke_count', 0),
                'mouse_count': data.get('mouse_count', 0)
            },
            'created_at': datetime.now().isoformat()
        }
        
        result = supabase_manager.client.table("behavioral_sessions").insert(session_data).execute()
        return bool(result.data)
        
    except Exception as e:
        logger.error(f"Error saving behavioral session: {e}")
        return False

def save_anomaly_safe(user_id: str, session_id: str, data: Dict) -> bool:
    try:
        if not supabase_manager.client:
            return False
        
        # Convert user_id to UUID if needed
        try:
            import uuid
            user_id_uuid = str(uuid.UUID(user_id))
        except ValueError:
            try:
                user_result = supabase_manager.client.table("users").select("id").eq("username", user_id).execute()
                if user_result.data:
                    user_id_uuid = user_result.data[0]['id']
                else:
                    return False
            except:
                return False
        
        anomaly_data = {
            'user_id': user_id_uuid,
            'session_id': session_id,
            'anomaly_type': 'behavioral_monitoring_anomaly',
            'anomaly_score': float(data.get('anomaly_score', 0.5)),
            'severity': data.get('severity', 'medium'),
            'action_taken': data.get('action_taken', 'logged'),
            'details': {
                'similarity_score': float(data.get('similarity_score', 0.5)),
                'keystroke_count': data.get('keystroke_count', 0),
                'mouse_count': data.get('mouse_count', 0),
                'page_context': data.get('page_context', 'unknown')
            },
            'created_at': datetime.now().isoformat(),
            'event_ts': datetime.now().isoformat()
        }
        
        result = supabase_manager.client.table("anomaly_audit").insert(anomaly_data).execute()
        return bool(result.data)
        
    except Exception as e:
        logger.error(f" Error saving anomaly: {e}")
        return False

def save_monitoring_session(session_data: Dict):
    try:
        if supabase_manager.client:
            supabase_manager.client.table("behavioral_sessions").insert(session_data).execute()
            logger.info(f"  Monitoring session saved: {session_data['session_id']}")
    except Exception as e:
        logger.error(f" Error saving monitoring session: {e}")

def save_monitoring_anomaly(anomaly_data: Dict):
    try:
        if supabase_manager.client:
            # Convert user_id to UUID if needed
            try:
                import uuid
                user_id_uuid = str(uuid.UUID(anomaly_data['user_id']))
                anomaly_data['user_id'] = user_id_uuid
            except ValueError:
                try:
                    user_result = supabase_manager.client.table("users").select("id").eq("username", anomaly_data['user_id']).execute()
                    if user_result.data:
                        anomaly_data['user_id'] = user_result.data[0]['id']
                except:
                    pass
            
            anomaly_data['event_ts'] = anomaly_data['created_at']
            supabase_manager.client.table("anomaly_audit").insert(anomaly_data).execute()
            logger.info(f"Monitoring anomaly saved: {anomaly_data['session_id']}")
    except Exception as e:
        logger.error(f"Error saving monitoring anomaly: {e}")

def calculate_typing_speed(keystrokes: List) -> float:
    """Calculate typing speed safely"""
    try:
        if len(keystrokes) > 1:
            time_span = (keystrokes[-1]['timestamp'] - keystrokes[0]['timestamp']) / 1000.0
            if time_span > 0:
                return len(keystrokes) / time_span * 60
    except:
        pass
    return 40.0  # Default

def calculate_mouse_velocity(mouse_movements: List) -> float:
    """Calculate mouse velocity safely"""
    try:
        if len(mouse_movements) > 1:
            velocities = []
            for i in range(1, len(mouse_movements)):
                prev = mouse_movements[i-1]
                curr = mouse_movements[i]
                
                if prev.get('type') == 'mousemove' and curr.get('type') == 'mousemove':
                    dx = curr['x'] - prev['x']
                    dy = curr['y'] - prev['y']
                    dt = curr['timestamp'] - prev['timestamp']
                    
                    if dt > 0:
                        distance = math.sqrt(dx*dx + dy*dy)
                        velocity = distance / dt
                        velocities.append(velocity)
            
            if velocities:
                return sum(velocities) / len(velocities)
    except:
        pass
    return 100.0 

def ensure_uuid_format(user_id: str) -> str:
    """
    Ensure user_id is in proper UUID format for database operations
    """
    try:
        # If it's already a valid UUID, return as string
        uuid_obj = uuid.UUID(user_id)
        return str(uuid_obj)
    except ValueError:
        # If it's not a UUID, try to find the corresponding UUID in users table
        if supabase_manager.client:
            try:
                result = supabase_manager.client.table("users").select("id").eq("username", user_id).execute()
                if result.data and len(result.data) > 0:
                    return str(result.data[0]['id'])
            except Exception as e:
                logger.error(f"Error finding user UUID: {e}")
        
        logger.warning(f"Could not convert user_id to UUID: {user_id}")
        return user_id
    

def validate_behavioral_data(behavioral_data: Dict) -> Dict:
    """
    CRITICAL FIX: Validate and clean behavioral data structure
    """
    validated_data = {
        'keystrokes': [],
        'mouseMovements': []
    }
    
    # Validate keystrokes
    if 'keystrokes' in behavioral_data and isinstance(behavioral_data['keystrokes'], list):
        for keystroke in behavioral_data['keystrokes']:
            if isinstance(keystroke, dict) and all(key in keystroke for key in ['key', 'timestamp', 'type']):
                validated_keystroke = {
                    'key': str(keystroke.get('key', '')),
                    'code': str(keystroke.get('code', '')),
                    'timestamp': int(keystroke.get('timestamp', 0)),
                    'type': str(keystroke.get('type', 'keydown')),
                    'ctrlKey': bool(keystroke.get('ctrlKey', False)),
                    'shiftKey': bool(keystroke.get('shiftKey', False)),
                    'altKey': bool(keystroke.get('altKey', False))
                }
                validated_data['keystrokes'].append(validated_keystroke)
    
    # Validate mouse movements
    if 'mouseMovements' in behavioral_data and isinstance(behavioral_data['mouseMovements'], list):
        for mouse_event in behavioral_data['mouseMovements']:
            if isinstance(mouse_event, dict) and all(key in mouse_event for key in ['x', 'y', 'timestamp', 'type']):
                validated_mouse = {
                    'x': int(mouse_event.get('x', 0)),
                    'y': int(mouse_event.get('y', 0)),
                    'timestamp': int(mouse_event.get('timestamp', 0)),
                    'type': str(mouse_event.get('type', 'mousemove')),
                    'button': mouse_event.get('button'),
                    'deltaY': mouse_event.get('deltaY')
                }
                validated_data['mouseMovements'].append(validated_mouse)
    
    logger.info(f" Validated behavioral data - {len(validated_data['keystrokes'])} keystrokes, {len(validated_data['mouseMovements'])} mouse events")
    return validated_data

def extract_advanced_behavioral_features(behavioral_data: Dict, enhanced_features: Dict = None) -> Dict:
    """
    ENHANCED: Extract advanced behavioral features with multiple algorithms
    """
    features = {
        'keystroke_features': {},
        'mouse_features': {},
        'timing_features': {},
        'pattern_features': {},
        'overall_metrics': {}
    }
    
    keystrokes = behavioral_data.get('keystrokes', [])
    mouse_events = behavioral_data.get('mouseMovements', [])
    
    # Enhanced keystroke analysis
    if keystrokes:
        keydown_events = [k for k in keystrokes if k.get('type') == 'keydown']
        keyup_events = [k for k in keystrokes if k.get('type') == 'keyup']
        
        if keydown_events:
            # Advanced timing features
            features['keystroke_features'] = calculate_advanced_keystroke_features(keydown_events, keyup_events)
            
            # Pattern recognition features
            features['pattern_features']['keystroke_patterns'] = analyze_keystroke_patterns(keydown_events)
    
    # Enhanced mouse analysis
    if mouse_events:
        move_events = [m for m in mouse_events if m.get('type') == 'mousemove']
        click_events = [m for m in mouse_events if m.get('type') == 'click']
        
        if move_events:
            # Advanced mouse features
            features['mouse_features'] = calculate_advanced_mouse_features(move_events, click_events)
            
            # Trajectory analysis
            features['pattern_features']['mouse_patterns'] = analyze_mouse_trajectories(move_events)
    
    # Cross-modal features (combining keyboard and mouse)
    if keystrokes and mouse_events:
        features['timing_features'] = calculate_cross_modal_features(keystrokes, mouse_events)
    
    # Overall session metrics
    features['overall_metrics'] = {
        'total_keystrokes': len(keystrokes),
        'total_mouse_events': len(mouse_events),
        'session_duration': calculate_session_duration(keystrokes, mouse_events),
        'activity_intensity': calculate_activity_intensity(keystrokes, mouse_events),
        'multitasking_indicators': detect_multitasking_patterns(keystrokes, mouse_events)
    }
    
    # Incorporate enhanced features from frontend if available
    if enhanced_features:
        features['frontend_features'] = enhanced_features
    
    return features


def calculate_advanced_keystroke_features(keydown_events: List, keyup_events: List) -> Dict:
    """Calculate advanced keystroke dynamics features"""
    features = {}
    
    if len(keydown_events) < 2:
        return features
    
    # Dwell times (key hold duration)
    dwell_times = []
    for keydown in keydown_events:
        matching_keyup = next(
            (up for up in keyup_events 
             if up['code'] == keydown['code'] and up['timestamp'] > keydown['timestamp']),
            None
        )
        if matching_keyup:
            dwell_time = matching_keyup['timestamp'] - keydown['timestamp']
            if 0 < dwell_time < 1000:  # Reasonable bounds
                dwell_times.append(dwell_time)
    
    if dwell_times:
        features['avg_dwell_time'] = float(np.mean(dwell_times))
        features['std_dwell_time'] = float(np.std(dwell_times))
        features['dwell_time_variance'] = float(np.var(dwell_times))
        features['dwell_time_skewness'] = float(scipy.stats.skew(dwell_times)) if len(dwell_times) > 2 else 0.0
    
    # Flight times (time between keystrokes)
    flight_times = []
    for i in range(1, len(keydown_events)):
        flight_time = keydown_events[i]['timestamp'] - keydown_events[i-1]['timestamp']
        if 0 < flight_time < 5000:  # Reasonable bounds
            flight_times.append(flight_time)
    
    if flight_times:
        features['avg_flight_time'] = float(np.mean(flight_times))
        features['std_flight_time'] = float(np.std(flight_times))
        features['flight_time_variance'] = float(np.var(flight_times))
        features['flight_time_skewness'] = float(scipy.stats.skew(flight_times)) if len(flight_times) > 2 else 0.0
    
    # Typing rhythm analysis
    if len(keydown_events) > 5:
        timestamps = [k['timestamp'] for k in keydown_events]
        features['typing_speed'] = float(len(keydown_events) / ((timestamps[-1] - timestamps[0]) / 60000))  # keys per minute
        
        # Rhythm consistency
        if flight_times:
            mean_flight = np.mean(flight_times)
            features['rhythm_consistency'] = float(1.0 / (1.0 + np.std(flight_times) / (mean_flight + 1)))
    
    # Advanced features
    features['total_keystrokes'] = len(keydown_events)
    features['unique_keys'] = len(set(k['code'] for k in keydown_events))
    features['modifier_usage'] = sum(1 for k in keydown_events if k.get('ctrlKey') or k.get('shiftKey') or k.get('altKey'))
    
    return features


def calculate_advanced_mouse_features(move_events: List, click_events: List) -> Dict:
    """Calculate advanced mouse dynamics features"""
    features = {}
    
    if len(move_events) < 2:
        return features
    
    # Calculate velocities and distances
    velocities = []
    distances = []
    accelerations = []
    
    for i in range(1, len(move_events)):
        curr = move_events[i]
        prev = move_events[i-1]
        
        # Distance calculation
        dx = curr['x'] - prev['x']
        dy = curr['y'] - prev['y']
        distance = math.sqrt(dx * dx + dy * dy)
        distances.append(distance)
        
        # Velocity calculation
        time_diff = (curr['timestamp'] - prev['timestamp']) / 1000.0  # Convert to seconds
        if time_diff > 0:
            velocity = distance / time_diff
            velocities.append(velocity)
            
            # Acceleration calculation
            if i > 1 and len(velocities) > 1:
                prev_velocity = velocities[-2] if len(velocities) > 1 else 0
                acceleration = (velocity - prev_velocity) / time_diff
                accelerations.append(acceleration)
    
    # Basic velocity features
    if velocities:
        features['avg_velocity'] = float(np.mean(velocities))
        features['std_velocity'] = float(np.std(velocities))
        features['max_velocity'] = float(max(velocities))
        features['min_velocity'] = float(min(velocities))
        features['velocity_variance'] = float(np.var(velocities))
    
    # Distance features
    if distances:
        features['avg_distance'] = float(np.mean(distances))
        features['total_distance'] = float(sum(distances))
        features['distance_variance'] = float(np.var(distances))
    
    # Acceleration features
    if accelerations:
        features['avg_acceleration'] = float(np.mean(accelerations))
        features['std_acceleration'] = float(np.std(accelerations))
        features['acceleration_variance'] = float(np.var(accelerations))
    
    # Movement smoothness (jerk analysis)
    if len(accelerations) > 1:
        jerks = []
        for i in range(1, len(accelerations)):
            jerk = abs(accelerations[i] - accelerations[i-1])
            jerks.append(jerk)
        
        if jerks:
            features['movement_smoothness'] = float(1.0 / (1.0 + np.mean(jerks)))
            features['jerk_variance'] = float(np.var(jerks))
    
    # Click pattern analysis
    if click_events and len(click_events) > 1:
        click_intervals = []
        for i in range(1, len(click_events)):
            interval = click_events[i]['timestamp'] - click_events[i-1]['timestamp']
            click_intervals.append(interval)
        
        if click_intervals:
            features['avg_click_interval'] = float(np.mean(click_intervals))
            features['std_click_interval'] = float(np.std(click_intervals))
            features['click_rate'] = float(len(click_events) / ((move_events[-1]['timestamp'] - move_events[0]['timestamp']) / 1000.0))
    
    features['total_moves'] = len(move_events)
    features['total_clicks'] = len(click_events)
    
    return features


def analyze_keystroke_patterns(keydown_events: List) -> Dict:
    """Analyze keystroke patterns for behavioral signatures"""
    patterns = {}
    
    if len(keydown_events) < 3:
        return patterns
    
    # Burst detection
    burst_threshold = 2000  # 2 seconds
    bursts = []
    current_burst = [keydown_events[0]]
    
    for i in range(1, len(keydown_events)):
        time_gap = keydown_events[i]['timestamp'] - keydown_events[i-1]['timestamp']
        if time_gap <= burst_threshold:
            current_burst.append(keydown_events[i])
        else:
            if len(current_burst) >= 3:
                bursts.append(current_burst)
            current_burst = [keydown_events[i]]
    
    if len(current_burst) >= 3:
        bursts.append(current_burst)
    
    patterns['burst_count'] = len(bursts)
    patterns['avg_burst_length'] = float(np.mean([len(burst) for burst in bursts])) if bursts else 0.0
    
    # Pause analysis
    pauses = []
    for i in range(1, len(keydown_events)):
        gap = keydown_events[i]['timestamp'] - keydown_events[i-1]['timestamp']
        if gap > burst_threshold:
            pauses.append(gap)
    
    if pauses:
        patterns['pause_count'] = len(pauses)
        patterns['avg_pause_duration'] = float(np.mean(pauses))
        patterns['pause_variance'] = float(np.var(pauses))
    
    return patterns


def analyze_mouse_trajectories(move_events: List) -> Dict:
    """Analyze mouse movement trajectories"""
    patterns = {}
    
    if len(move_events) < 5:
        return patterns
    
    # Direction changes
    direction_changes = 0
    prev_direction = None
    
    for i in range(1, len(move_events)):
        dx = move_events[i]['x'] - move_events[i-1]['x']
        dy = move_events[i]['y'] - move_events[i-1]['y']
        
        if dx != 0 or dy != 0:
            current_direction = math.atan2(dy, dx)
            
            if prev_direction is not None:
                angle_diff = abs(current_direction - prev_direction)
                if angle_diff > math.pi:
                    angle_diff = 2 * math.pi - angle_diff
                
                if angle_diff > math.pi / 4:  # 45 degrees threshold
                    direction_changes += 1
            
            prev_direction = current_direction
    
    patterns['direction_changes'] = direction_changes
    patterns['direction_change_rate'] = float(direction_changes / len(move_events)) if move_events else 0.0
    
    # Curvature analysis
    curvatures = []
    for i in range(1, len(move_events) - 1):
        p1 = (move_events[i-1]['x'], move_events[i-1]['y'])
        p2 = (move_events[i]['x'], move_events[i]['y'])
        p3 = (move_events[i+1]['x'], move_events[i+1]['y'])
        
        # Calculate curvature
        area = abs((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p3[0] - p1[0]) * (p2[1] - p1[1]))
        dist = math.sqrt((p3[0] - p1[0])**2 + (p3[1] - p1[1])**2)
        
        if dist > 0:
            curvature = area / (dist ** 1.5)
            curvatures.append(curvature)
    
    if curvatures:
        patterns['avg_curvature'] = float(np.mean(curvatures))
        patterns['curvature_variance'] = float(np.var(curvatures))
    
    return patterns


def calculate_cross_modal_features(keystrokes: List, mouse_events: List) -> Dict:
    """Calculate features that combine keyboard and mouse behavior"""
    features = {}
    
    if not keystrokes or not mouse_events:
        return features
    
    # Coordination analysis
    all_events = keystrokes + mouse_events
    all_events.sort(key=lambda x: x['timestamp'])
    
    # Input switching frequency
    switches = 0
    prev_type = None
    
    for event in all_events:
        current_type = 'keyboard' if 'key' in event else 'mouse'
        if prev_type and prev_type != current_type:
            switches += 1
        prev_type = current_type
    
    features['input_switches'] = switches
    features['switch_rate'] = float(switches / len(all_events)) if all_events else 0.0
    
    # Temporal patterns
    keyboard_intervals = []
    mouse_intervals = []
    
    keyboard_events = [e for e in all_events if 'key' in e]
    mouse_events_sorted = [e for e in all_events if 'x' in e]
    
    if len(keyboard_events) > 1:
        for i in range(1, len(keyboard_events)):
            interval = keyboard_events[i]['timestamp'] - keyboard_events[i-1]['timestamp']
            keyboard_intervals.append(interval)
    
    if len(mouse_events_sorted) > 1:
        for i in range(1, len(mouse_events_sorted)):
            interval = mouse_events_sorted[i]['timestamp'] - mouse_events_sorted[i-1]['timestamp']
            mouse_intervals.append(interval)
    
    if keyboard_intervals and mouse_intervals:
        features['keyboard_mouse_tempo_ratio'] = float(np.mean(keyboard_intervals) / np.mean(mouse_intervals))
    
    return features


def calculate_session_duration(keystrokes: List, mouse_events: List) -> float:
    """Calculate total session duration"""
    all_events = keystrokes + mouse_events
    if len(all_events) < 2:
        return 0.0
    
    timestamps = [e['timestamp'] for e in all_events]
    return float((max(timestamps) - min(timestamps)) / 1000.0)  # Convert to seconds


def calculate_activity_intensity(keystrokes: List, mouse_events: List) -> float:
    """Calculate activity intensity (events per second)"""
    duration = calculate_session_duration(keystrokes, mouse_events)
    if duration == 0:
        return 0.0
    
    total_events = len(keystrokes) + len(mouse_events)
    return float(total_events / duration)


def detect_multitasking_patterns(keystrokes: List, mouse_events: List) -> Dict:
    """Detect patterns that suggest multitasking"""
    patterns = {}
    
    # Long pauses might indicate attention switches
    all_events = keystrokes + mouse_events
    all_events.sort(key=lambda x: x['timestamp'])
    
    long_pauses = 0
    pause_threshold = 5000  # 5 seconds
    
    for i in range(1, len(all_events)):
        gap = all_events[i]['timestamp'] - all_events[i-1]['timestamp']
        if gap > pause_threshold:
            long_pauses += 1
    
    patterns['long_pauses'] = long_pauses
    patterns['attention_switches'] = long_pauses  # Proxy for attention switches
    
    return patterns


def calculate_enhanced_similarity(current_features: Dict, stored_features: Dict) -> Dict:
    """
    ENHANCED: Calculate detailed similarity scores with multiple algorithms
    """
    similarities = {
        'keystroke_similarity': 0.5,
        'mouse_similarity': 0.5,
        'timing_similarity': 0.5,
        'pattern_similarity': 0.5,
        'overall_similarity': 0.5,
        'feature_breakdown': {},
        'algorithm_results': {}
    }
    
    # Enhanced keystroke similarity
    if current_features.get('keystroke_features') and stored_features.get('keystroke_features'):
        keystroke_sim = calculate_feature_similarity(
            current_features['keystroke_features'],
            stored_features['keystroke_features'],
            ['avg_dwell_time', 'avg_flight_time', 'typing_speed', 'rhythm_consistency']
        )
        similarities['keystroke_similarity'] = keystroke_sim
        similarities['algorithm_results']['keystroke'] = keystroke_sim
    
    # Enhanced mouse similarity
    if current_features.get('mouse_features') and stored_features.get('mouse_features'):
        mouse_sim = calculate_feature_similarity(
            current_features['mouse_features'],
            stored_features['mouse_features'],
            ['avg_velocity', 'movement_smoothness', 'avg_distance', 'avg_click_interval']
        )
        similarities['mouse_similarity'] = mouse_sim
        similarities['algorithm_results']['mouse'] = mouse_sim
    
    # Timing pattern similarity
    if current_features.get('timing_features') and stored_features.get('timing_features'):
        timing_sim = calculate_feature_similarity(
            current_features['timing_features'],
            stored_features['timing_features'],
            ['input_switches', 'switch_rate']
        )
        similarities['timing_similarity'] = timing_sim
        similarities['algorithm_results']['timing'] = timing_sim
    
    # Pattern similarity
    if current_features.get('pattern_features') and stored_features.get('pattern_features'):
        pattern_sim = calculate_pattern_similarity(
            current_features['pattern_features'],
            stored_features['pattern_features']
        )
        similarities['pattern_similarity'] = pattern_sim
        similarities['algorithm_results']['pattern'] = pattern_sim
    
    # Calculate weighted overall similarity
    weights = {
        'keystroke': 0.35,
        'mouse': 0.30,
        'timing': 0.20,
        'pattern': 0.15
    }
    
    overall_sim = (
        similarities['keystroke_similarity'] * weights['keystroke'] +
        similarities['mouse_similarity'] * weights['mouse'] +
        similarities['timing_similarity'] * weights['timing'] +
        similarities['pattern_similarity'] * weights['pattern']
    )
    
    similarities['overall_similarity'] = overall_sim
    
    # Detailed feature breakdown
    similarities['feature_breakdown'] = {
        'keystroke_weight': weights['keystroke'],
        'mouse_weight': weights['mouse'],
        'timing_weight': weights['timing'],
        'pattern_weight': weights['pattern'],
        'weighted_contributions': {
            'keystroke': similarities['keystroke_similarity'] * weights['keystroke'],
            'mouse': similarities['mouse_similarity'] * weights['mouse'],
            'timing': similarities['timing_similarity'] * weights['timing'],
            'pattern': similarities['pattern_similarity'] * weights['pattern']
        }
    }
    
    return similarities


def calculate_feature_similarity(current_features: Dict, stored_features: Dict, feature_names: List) -> float:
    """Calculate similarity between specific features"""
    similarities = []
    
    for feature in feature_names:
        if feature in current_features and feature in stored_features:
            curr_val = float(current_features[feature])
            stored_val = float(stored_features[feature])
            
            if stored_val == 0 and curr_val == 0:
                similarity = 1.0
            elif stored_val == 0:
                similarity = 0.5
            else:
                # Normalized similarity with tolerance
                diff = abs(curr_val - stored_val) / stored_val
                similarity = max(0, 1 - diff)
            
            similarities.append(similarity)
    
    return float(np.mean(similarities)) if similarities else 0.5


def calculate_pattern_similarity(current_patterns: Dict, stored_patterns: Dict) -> float:
    """Calculate similarity between behavioral patterns"""
    similarities = []
    
    # Compare keystroke patterns
    if 'keystroke_patterns' in current_patterns and 'keystroke_patterns' in stored_patterns:
        curr_kp = current_patterns['keystroke_patterns']
        stored_kp = stored_patterns['keystroke_patterns']
        
        pattern_features = ['burst_count', 'avg_burst_length', 'pause_count']
        for feature in pattern_features:
            if feature in curr_kp and feature in stored_kp:
                similarity = calculate_single_feature_similarity(curr_kp[feature], stored_kp[feature])
                similarities.append(similarity)
    
    # Compare mouse patterns
    if 'mouse_patterns' in current_patterns and 'mouse_patterns' in stored_patterns:
        curr_mp = current_patterns['mouse_patterns']
        stored_mp = stored_patterns['mouse_patterns']
        
        pattern_features = ['direction_changes', 'avg_curvature']
        for feature in pattern_features:
            if feature in curr_mp and feature in stored_mp:
                similarity = calculate_single_feature_similarity(curr_mp[feature], stored_mp[feature])
                similarities.append(similarity)
    
    return float(np.mean(similarities)) if similarities else 0.5


def calculate_single_feature_similarity(current_val: float, stored_val: float) -> float:
    """Calculate similarity between two feature values"""
    if stored_val == 0 and current_val == 0:
        return 1.0
    elif stored_val == 0:
        return 0.5
    else:
        diff = abs(current_val - stored_val) / stored_val
        return max(0, 1 - diff)


def get_enhanced_default_baseline() -> Dict:
    """Get enhanced default baseline pattern for comparison"""
    return {
        'keystroke_features': {
            'avg_dwell_time': 120.0,
            'avg_flight_time': 200.0,
            'typing_speed': 45.0,
            'rhythm_consistency': 0.7,
            'std_dwell_time': 25.0,
            'std_flight_time': 50.0
        },
        'mouse_features': {
            'avg_velocity': 150.0,
            'movement_smoothness': 0.75,
            'avg_distance': 25.0,
            'avg_click_interval': 1500.0,
            'std_velocity': 75.0
        },
        'timing_features': {
            'input_switches': 5,
            'switch_rate': 0.1
        },
        'pattern_features': {
            'keystroke_patterns': {
                'burst_count': 3,
                'avg_burst_length': 5.0,
                'pause_count': 2
            },
            'mouse_patterns': {
                'direction_changes': 10,
                'avg_curvature': 0.5
            }
        }
    }


def convert_numpy_types(obj):
    """
    CRITICAL FIX: Recursively convert NumPy data types to native Python types
    """
    if isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_numpy_types(v) for v in obj)
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj

def calculate_features(behavioral_data: Dict) -> Dict:
    """
    CRITICAL FIX: Calculate comprehensive behavioral features
    """
    features = {
        'keystroke_features': {},
        'mouse_features': {},
        'overall_metrics': {}
    }
    
    keystrokes = behavioral_data.get('keystrokes', [])
    mouse_events = behavioral_data.get('mouseMovements', [])
    
    # Enhanced keystroke analysis
    if keystrokes:
        keydown_events = [k for k in keystrokes if k.get('type') == 'keydown']
        keyup_events = [k for k in keystrokes if k.get('type') == 'keyup']
        
        if keydown_events:
            # Typing speed calculation
            if len(keydown_events) > 1:
                duration = (keydown_events[-1]['timestamp'] - keydown_events[0]['timestamp']) / 1000.0
                if duration > 0:
                    features['keystroke_features']['typing_speed'] = len(keydown_events) / duration * 60  # keys per minute
                    features['keystroke_features']['characters_per_second'] = len(keydown_events) / duration
            
            # Dwell time analysis
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
                features['keystroke_features']['avg_dwell_time'] = np.mean(dwell_times)
                features['keystroke_features']['std_dwell_time'] = np.std(dwell_times)
                features['keystroke_features']['dwell_time_variance'] = np.var(dwell_times)
            
            # Flight time analysis (time between keystrokes)
            flight_times = []
            for i in range(1, len(keydown_events)):
                flight_time = keydown_events[i]['timestamp'] - keydown_events[i-1]['timestamp']
                if 0 < flight_time < 2000:  # Reasonable limits
                    flight_times.append(flight_time)
            
            if flight_times:
                features['keystroke_features']['avg_flight_time'] = np.mean(flight_times)
                features['keystroke_features']['std_flight_time'] = np.std(flight_times)
                features['keystroke_features']['flight_time_variance'] = np.var(flight_times)
                
                # Rhythm consistency
                if len(flight_times) > 5:
                    mean_flight = np.mean(flight_times)
                    std_flight = np.std(flight_times)
                    features['keystroke_features']['rhythm_consistency'] = 1.0 / (1.0 + std_flight / (mean_flight + 1))
    
    # Enhanced mouse analysis
    if mouse_events:
        move_events = [m for m in mouse_events if m.get('type') == 'mousemove']
        click_events = [m for m in mouse_events if m.get('type') == 'click']
        
        if move_events and len(move_events) > 1:
            # Movement analysis
            distances = []
            velocities = []
            accelerations = []
            
            for i in range(1, len(move_events)):
                curr = move_events[i]
                prev = move_events[i-1]
                
                # Distance calculation
                distance = np.sqrt((curr['x'] - prev['x'])**2 + (curr['y'] - prev['y'])**2)
                distances.append(distance)
                
                # Velocity calculation
                time_diff = (curr['timestamp'] - prev['timestamp']) / 1000.0
                if time_diff > 0:
                    velocity = distance / time_diff
                    velocities.append(velocity)
                    
                    # Acceleration calculation
                    if i > 1 and len(velocities) > 1:
                        prev_velocity = velocities[-2] if len(velocities) > 1 else 0
                        acceleration = (velocity - prev_velocity) / time_diff
                        accelerations.append(acceleration)
            
            if distances:
                features['mouse_features']['avg_distance'] = np.mean(distances)
                features['mouse_features']['total_distance'] = sum(distances)
                features['mouse_features']['distance_variance'] = np.var(distances)
            
            if velocities:
                features['mouse_features']['avg_velocity'] = np.mean(velocities)
                features['mouse_features']['std_velocity'] = np.std(velocities)
                features['mouse_features']['max_velocity'] = max(velocities)
                features['mouse_features']['velocity_variance'] = np.var(velocities)
            
            if accelerations:
                features['mouse_features']['avg_acceleration'] = np.mean(accelerations)
                features['mouse_features']['std_acceleration'] = np.std(accelerations)
        
        # Click pattern analysis
        if click_events and len(click_events) > 1:
            click_intervals = []
            for i in range(1, len(click_events)):
                interval = click_events[i]['timestamp'] - click_events[i-1]['timestamp']
                click_intervals.append(interval)
            
            if click_intervals:
                features['mouse_features']['avg_click_interval'] = np.mean(click_intervals)
                features['mouse_features']['std_click_interval'] = np.std(click_intervals)
                features['mouse_features']['click_rate'] = len(click_events) / ((mouse_events[-1]['timestamp'] - mouse_events[0]['timestamp']) / 1000.0) if mouse_events else 0
    
    # Overall session metrics
    features['overall_metrics'] = {
        'total_keystrokes': len(keystrokes),
        'total_mouse_events': len(mouse_events),
        'session_duration': (max([k['timestamp'] for k in keystrokes] + [m['timestamp'] for m in mouse_events]) - 
                           min([k['timestamp'] for k in keystrokes] + [m['timestamp'] for m in mouse_events])) / 1000.0 if (keystrokes or mouse_events) else 0,
        'keystroke_to_mouse_ratio': len(keystrokes) / len(mouse_events) if mouse_events else float('inf')
    }
    
    logger.info(f"Calculated enhanced behavioral features")
    return features

def calculate_similarity(current_features: Dict, stored_features: Dict) -> Dict:
    """
    CRITICAL FIX: Calculate detailed similarity scores between behavioral patterns
    """
    similarities = {
        'keystroke_similarity': 0.5,
        'mouse_similarity': 0.5,
        'overall_similarity': 0.5,
        'feature_breakdown': {}
    }
    
    # Keystroke similarity
    if current_features.get('keystroke_features') and stored_features.get('keystroke_features'):
        keystroke_sims = []
        current_ks = current_features['keystroke_features']
        stored_ks = stored_features['keystroke_features']
        
        # Compare key features
        key_features = ['typing_speed', 'avg_dwell_time', 'avg_flight_time', 'rhythm_consistency']
        for feature in key_features:
            if feature in current_ks and feature in stored_ks:
                curr_val = float(current_ks[feature])
                stored_val = float(stored_ks[feature])
                
                if stored_val == 0 and curr_val == 0:
                    similarity = 1.0
                elif stored_val == 0:
                    similarity = 0.5
                else:
                    # Normalized difference with tolerance
                    diff = abs(curr_val - stored_val) / stored_val
                    similarity = max(0, 1 - diff)
                
                keystroke_sims.append(similarity)
                similarities['feature_breakdown'][f'keystroke_{feature}'] = similarity
        
        if keystroke_sims:
            similarities['keystroke_similarity'] = np.mean(keystroke_sims)
    
    # Mouse similarity
    if current_features.get('mouse_features') and stored_features.get('mouse_features'):
        mouse_sims = []
        current_ms = current_features['mouse_features']
        stored_ms = stored_features['mouse_features']
        
        # Compare key features
        key_features = ['avg_velocity', 'avg_distance', 'avg_click_interval']
        for feature in key_features:
            if feature in current_ms and feature in stored_ms:
                curr_val = float(current_ms[feature])
                stored_val = float(stored_ms[feature])
                
                if stored_val == 0 and curr_val == 0:
                    similarity = 1.0
                elif stored_val == 0:
                    similarity = 0.5
                else:
                    # Normalized difference with tolerance
                    diff = abs(curr_val - stored_val) / stored_val
                    similarity = max(0, 1 - diff)
                
                mouse_sims.append(similarity)
                similarities['feature_breakdown'][f'mouse_{feature}'] = similarity
        
        if mouse_sims:
            similarities['mouse_similarity'] = np.mean(mouse_sims)
    
    # Overall similarity (weighted average)
    similarities['overall_similarity'] = (similarities['keystroke_similarity'] * 0.6 + 
                                        similarities['mouse_similarity'] * 0.4)
    
    logger.info(f" Calculated similarity scores - Overall: {similarities['overall_similarity']:.3f}, Keystroke: {similarities['keystroke_similarity']:.3f}, Mouse: {similarities['mouse_similarity']:.3f}")
    return similarities

def calculate_simple_features(keystrokes, mouse_movements):
    """Calculate simple behavioral features"""
    features = {
        'keystroke_count': len(keystrokes),
        'mouse_count': len(mouse_movements),
        'typing_speed': 0,
        'avg_velocity': 0
    }
    
    # Simple typing speed calculation
    if len(keystrokes) > 1:
        total_time = (keystrokes[-1]['timestamp'] - keystrokes[0]['timestamp']) / 1000.0
        if total_time > 0:
            features['typing_speed'] = len(keystrokes) / total_time * 60  # Keys per minute
    
    # Simple mouse velocity calculation
    if len(mouse_movements) > 1:
        velocities = []
        for i in range(1, len(mouse_movements)):
            prev = mouse_movements[i-1]
            curr = mouse_movements[i]
            
            if prev.get('type') == 'mousemove' and curr.get('type') == 'mousemove':
                dx = curr['x'] - prev['x']
                dy = curr['y'] - prev['y']
                dt = curr['timestamp'] - prev['timestamp']
                
                if dt > 0:
                    distance = (dx**2 + dy**2)**0.5
                    velocity = distance / dt
                    velocities.append(velocity)
        
        if velocities:
            features['avg_velocity'] = sum(velocities) / len(velocities)
    
    return features

def get_stored_pattern_simple(user_id):
    """Get stored pattern or use default"""
    if supabase_manager.client:
        try:
            result = supabase_manager.client.table("behavioral_patterns") \
                .select("pattern_data") \
                .eq("user_id", user_id) \
                .eq("is_active", True) \
                .limit(1).execute()
            
            if result.data:
                return result.data[0]['pattern_data']
        except Exception as e:
            print(f"Error getting stored pattern: {e}")
    
    # Default pattern for testing
    return {
        'keystroke_features': {'typing_speed': 45},
        'mouse_features': {'avg_velocity': 150}
    }

def calculate_simple_similarity(current_features, stored_pattern):
    """Calculate simple similarity score (0-1)"""
    try:
        similarities = []
        
        # Typing speed comparison
        current_speed = current_features.get('typing_speed', 0)
        stored_speed = stored_pattern.get('keystroke_features', {}).get('typing_speed', 45)
        if stored_speed > 0:
            speed_diff = abs(current_speed - stored_speed) / stored_speed
            speed_similarity = max(0, 1 - speed_diff)
            similarities.append(speed_similarity)
        
        # Mouse velocity comparison
        current_velocity = current_features.get('avg_velocity', 0)
        stored_velocity = stored_pattern.get('mouse_features', {}).get('avg_velocity', 150)
        if stored_velocity > 0:
            velocity_diff = abs(current_velocity - stored_velocity) / stored_velocity
            velocity_similarity = max(0, 1 - velocity_diff)
            similarities.append(velocity_similarity)
        
        # Return average similarity (0-1)
        final_similarity = sum(similarities) / len(similarities) if similarities else 0.5
        
        # ADD RANDOMNESS for easier testing (remove in production)
        import random
        if random.random() < 0.3:  # 30% chance of anomaly for testing
            final_similarity = random.uniform(0.1, 0.5)  # Force anomaly
        
        return final_similarity
        
    except Exception as e:
        print(f"Similarity calculation error: {e}")
        return 0.5

def save_behavioral_session_simple(user_id, session_id, data):
    """Save behavioral session - GUARANTEED"""
    try:
        if not supabase_manager.client:
            print(" No Supabase client")
            return False
        
        session_data = {
            'user_id': str(user_id),
            'session_id': session_id,
            'similarity_scores': {
                'overall_similarity': float(data['similarity_score'])
            },
            'anomaly_score': float(1 - data['similarity_score']),
            'is_successful': data['is_successful'],
            'verification_type': 'behavioral_test',
            'page_context': '/behavioral-test',
            'created_at': datetime.now().isoformat()
        }
        
        result = supabase_manager.client.table("behavioral_sessions").insert(session_data).execute()
        
        if result.data:
            print(f" Session saved: {result.data[0]['id']}")
            return True
        else:
            print(" Session save failed - no data returned")
            return False
            
    except Exception as e:
        print(f"Session save error: {e}")
        return False

def save_anomaly_simple(user_id, session_id, data):
    """Save anomaly - GUARANTEED with FIXED UUID handling"""
    try:
        if not supabase_manager.client:
            print("No Supabase client")
            return False
        
        # CRITICAL: Convert user_id to UUID if needed
        try:
            import uuid
            user_id_uuid = str(uuid.UUID(user_id))
        except ValueError:
            # If not UUID, try to find it in users table
            try:
                user_result = supabase_manager.client.table("users").select("id").eq("username", user_id).execute()
                if user_result.data:
                    user_id_uuid = user_result.data[0]['id']
                else:
                    print(f"  Could not convert user_id to UUID: {user_id}")
                    return False
            except:
                print(f"  UUID conversion failed: {user_id}")
                return False
        
        # Build anomaly record
        anomaly_data = {
            'user_id': user_id_uuid,  # UUID format
            'session_id': session_id,  # TEXT format
            'anomaly_type': 'behavioral_test_anomaly',
            'anomaly_score': float(data['anomaly_score']),
            'severity': data['severity'],
            'action_taken': data['action_taken'],
            'details': {
                'similarity_score': float(data['similarity_score']),
                'keystroke_count': data['keystroke_count'],
                'mouse_count': data['mouse_count'],
                'test_type': 'simplified_behavioral_test',
                'page_context': '/behavioral-test'
            },
            'created_at': datetime.now().isoformat(),
            'event_ts': datetime.now().isoformat()
        }
        
        print(f"  Saving anomaly to anomaly_audit table...")
        print(f"   User ID (UUID): {user_id_uuid}")
        print(f"   Session ID: {session_id}")
        print(f"   Severity: {data['severity']}")
        
        result = supabase_manager.client.table("anomaly_audit").insert(anomaly_data).execute()
        
        if result.data:
            anomaly_id = result.data[0]['id']
            print(f"  ANOMALY SAVED SUCCESSFULLY: {anomaly_id}")
            return True
        else:
            print("  Anomaly save failed - no data returned")
            return False
            
    except Exception as e:
        print(f"  CRITICAL: Anomaly save error: {e}")
        import traceback
        traceback.print_exc()
        return False

    
def store_behavioral_result(user_id, session_id, similarity_score, is_anomaly, action_taken, severity):
    """Store results in Supabase"""
    try:
        if not supabase_manager.client:
            return False
        
        # Store session
        session_data = {
            'user_id': str(user_id),
            'session_id': session_id,
            'similarity_scores': {
                'overall_similarity': float(similarity_score),
                'keystroke_similarity': float(similarity_score),
                'mouse_similarity': float(similarity_score)
            },
            'anomaly_score': float(1 - similarity_score),
            'is_successful': not is_anomaly,
            'created_at': datetime.now().isoformat()
        }
        
        supabase_manager.client.table("behavioral_sessions").insert(session_data).execute()
        
        # Store anomaly if detected
        if is_anomaly:
            anomaly_data = {
                'user_id': str(user_id),
                'session_id': session_id,
                'anomaly_type': 'behavioral_test_anomaly',
                'anomaly_score': float(1 - similarity_score),
                'severity': severity,
                'action_taken': action_taken,
                'details': {
                    'similarity_score': float(similarity_score),
                    'test_mode': True
                },
                'created_at': datetime.now().isoformat()
            }
            
            supabase_manager.client.table("anomaly_audit").insert(anomaly_data).execute()
        
        return True
        
    except Exception as e:
        logger.error(f"Store error: {e}")
        return False

# ============= HELPER METHODS =============

def fallback_face_verification(user_id: str, face_image_b64: str, email: str, ip_address: str):
    """Fallback face verification using basic face_recognition library"""
    try:
        logger.info("  Using fallback face verification")
        
        if not supabase_manager.client:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Get stored face embedding
        stored_result = supabase_manager.client.table("biometric_data") \
            .select("face_embedding") \
            .eq("user_id", user_id) \
            .eq("biometric_type", "face") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not stored_result.data:
            run_async(supabase_manager.log_login_attempt(
                email, 'face', False, 'no_biometric_data_fallback', ip_address
            ))
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
            run_async(supabase_manager.log_login_attempt(
                email, 'face', False, 'no_face_detected_fallback', ip_address
            ))
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
        run_async(supabase_manager.log_login_attempt(
            email, 'face', is_match, None if is_match else 'fallback_similarity_low', ip_address
        ))
        
        return jsonify({
            'success': is_match,
            'similarity': float(similarity),
            'threshold': FALLBACK_THRESHOLD,
            'verification_method': 'fallback',
            'message': 'Face verification successful (fallback)' if is_match else 'Face verification failed (fallback)',
            'can_request_otp': not is_match
        })
        
    except Exception as e:
        logger.error(f"Fallback verification error: {e}")
        run_async(supabase_manager.log_login_attempt(
            email, 'face', False, f'fallback_error_{str(e)}', ip_address
        ))
        return jsonify({
            'success': False,
            'error': 'Fallback verification failed',
            'can_request_otp': True
        }), 500

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
    print("  MULTIMODAL BIOMETRIC AUTHENTICATION SYSTEM")
    print("=" * 60)
    print("  Face Verification After Login")
    print("  OTP Fallback for Failed Face Verification")
    print("  Account Lockout Protection")
    print("  Login Attempt Tracking")
    print("  Enhanced OCR Processing")
    print("  Real Email Sending")
    print("-" * 60)
    
    # Initialize detector
    print("Initializing liveness detector...")
    try:
        initialize_detector()
        logger.info("  Liveness detector initialized")
    except Exception as e:
        logger.error(f"  Could not initialize liveness detector: {e}")
        DETECTOR = None
    
    # Check Supabase
    if supabase_manager.client:
        print("  Supabase connected")
    else:
        print("  Running in mock mode (no Supabase)")
    
    print("-" * 60)
    print("  Server running on http://localhost:5000")
    print("  Rate limiting: 3 failed attempts = 15min lockout")
    print("  OTP fallback: Available after 3 failed face attempts")
    print("  Real email sending: Gmail SMTP + Supabase Auth")
    print("=" * 60)
    
    app.run(debug=False, host="0.0.0.0", port=5000, threaded=True)