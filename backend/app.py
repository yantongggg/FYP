# app.py - Fixed with CDCN integration and proper file structure

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import base64
import logging
import hashlib
import os
import sys
import time
from datetime import datetime
from typing import Dict, Tuple, Optional, List
from dataclasses import dataclass
import json

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import the EXTRACTED working functions 
sys.path.append(os.path.join(os.path.dirname(__file__), 'ml_models'))

try:
    from ml_models.liveness_detector import (
        process_frame_api, 
        initialize_detector,
        DETECTOR
    )
    DETECTOR_AVAILABLE = True
    print("✅ EXACT demo.py + sub_functions.py code imported successfully")
except ImportError as e:
    print(f"❌ Failed to import extracted functions: {e}")
    DETECTOR_AVAILABLE = False

# Check PyTorch for CDCN
PYTORCH_AVAILABLE = False
try:
    import torch
    import torch.nn as nn
    import torchvision.transforms as transforms
    from torchvision import models
    PYTORCH_AVAILABLE = True
    logger.info("✅ PyTorch available for CDCN")
except ImportError:
    logger.warning("⚠️ PyTorch not available - CDCN will be disabled")

# ============================================================================
# CDCN Model for Anti-Spoofing
# ============================================================================

class CDCNModel(nn.Module):
    """CDCN model using ResNet18 backbone"""
    
    def __init__(self, num_classes=2):
        super(CDCNModel, self).__init__()
        self.resnet = models.resnet18(weights=None)
        self.resnet.fc = nn.Linear(self.resnet.fc.in_features, num_classes)
        
    def forward(self, x):
        return self.resnet(x)

class CDCNDetector:
    """CDCN Anti-spoofing detector"""
    
    def __init__(self, model_path: str = None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        if model_path and os.path.exists(model_path):
            self._load_model(model_path)
    
    def _load_model(self, model_path: str):
        """Load CDCN model"""
        try:
            self.model = CDCNModel(num_classes=2)
            checkpoint = torch.load(model_path, map_location=self.device)
            
            if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['state_dict'])
            else:
                self.model.load_state_dict(checkpoint)
            
            self.model.eval()
            self.model = self.model.to(self.device)
            logger.info(f"✅ CDCN model loaded from {model_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to load CDCN model: {str(e)}")
            self.model = None
    
    def predict(self, image: np.ndarray) -> float:
        """Predict face liveness using CDCN"""
        if self.model is None:
            return 0.5  # Fallback
        
        try:
            # Preprocess image
            if len(image.shape) == 3 and image.shape[2] == 3:
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            else:
                image_rgb = image
                
            input_tensor = self.transform(image_rgb).unsqueeze(0).to(self.device)
            
            # Run inference
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = torch.softmax(outputs, dim=1)[0]
                real_prob = probabilities[1].item()  # Class 1 = real
                
            return real_prob
            
        except Exception as e:
            logger.error(f"CDCN prediction error: {str(e)}")
            return 0.5

# Global CDCN detector
CDCN_DETECTOR = None

def initialize_cdcn():
    """Initialize CDCN detector"""
    global CDCN_DETECTOR
    
    # Use your specified model path
    model_path = r"C:\Users\chyey\Downloads\project-bolt-github-xppinb5q (2)\project\backend\models\anti_spoofing_resnet18_cdcn.pth"
    
    if PYTORCH_AVAILABLE and os.path.exists(model_path):
        CDCN_DETECTOR = CDCNDetector(model_path)
        logger.info(f"✅ CDCN initialized with model: {model_path}")
        return True
    else:
        logger.warning(f"⚠️ CDCN model not found: {model_path}")
        return False

# ============================================================================
# Database Storage (Simple JSON for now)
# ============================================================================

USERS_DB = "users_db.json"

def load_users():
    """Load users from JSON file"""
    try:
        if os.path.exists(USERS_DB):
            with open(USERS_DB, 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        logger.error(f"Error loading users: {e}")
        return {}

def save_users(users):
    """Save users to JSON file"""
    try:
        with open(USERS_DB, 'w') as f:
            json.dump(users, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving users: {e}")
        return False

# ============================================================================
# Utility Functions
# ============================================================================

def decode_base64_image(base64_string):
    """Decode base64 image to OpenCV format"""
    try:
        if base64_string.startswith('data:image'):
            base64_string = base64_string.split(',')[1]
        
        image_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        return image
    except Exception as e:
        logger.error(f"Error decoding base64 image: {str(e)}")
        raise ValueError(f"Invalid base64 image data: {str(e)}")

# ============================================================================
# Flask Application Setup
# ============================================================================

app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# ============================================================================
# API Routes
# ============================================================================

@app.route('/api/liveness-detect', methods=['POST', 'OPTIONS'])
def liveness_detect():
    """Enhanced liveness detection with CDCN integration"""
    try:
        if request.method == 'OPTIONS':
            return jsonify({'success': True}), 200
            
        logger.info("Liveness detection request received")
        
        if not DETECTOR_AVAILABLE:
            return jsonify({
                'success': False, 
                'error': 'Extracted detector functions not available'
            }), 500
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data received'}), 400
            
        face_image_b64 = data.get('face_image')
        user_id = data.get('user_id', 'default_user')
        mode = data.get('mode', 'authentication')
        reset_counters = data.get('reset_counters', False)
        
        if not face_image_b64:
            return jsonify({'success': False, 'error': 'Face image is required'}), 400
        
        # Process frame using EXTRACTED functions from demo.py + sub_functions.py
        result = process_frame_api(face_image_b64, user_id, reset_counters)
        
        if result['success']:
            # Enhanced anti-spoofing with CDCN
            enhanced_face_score = result['face_real_score']
            
            if CDCN_DETECTOR:
                try:
                    # Decode image for CDCN
                    face_image = decode_base64_image(face_image_b64)
                    cdcn_score = CDCN_DETECTOR.predict(face_image)
                    
                    # Combine scores (weighted average)
                    enhanced_face_score = (result['face_real_score'] * 0.6 + cdcn_score * 0.4)
                    
                    result['cdcn_score'] = cdcn_score
                    result['enhanced_face_score'] = enhanced_face_score
                    
                    logger.info(f"CDCN Score: {cdcn_score:.3f}, Enhanced Score: {enhanced_face_score:.3f}")
                    
                except Exception as e:
                    logger.error(f"CDCN processing error: {e}")
            
            # Update face real score with enhanced version
            result['face_real_score'] = enhanced_face_score
            
            # Liveness validation logic
            blink_count = result['blink_count']
            mouth_open_count = result['mouth_open_count'] 
            head_movement_count = min(result['head_movement_count'], 2)  # Cap at 2
            
            # Requirements based on mode
            required_blinks = 3 if mode == 'registration' else 2
            required_mouth_opens = 2 if mode == 'registration' else 1
            required_head_movements = 2
            required_face_score = 0.85  # Slightly lower for enhanced score
            
            # Check requirements
            requirements_met = {
                'blinks': blink_count >= required_blinks,
                'mouth': mouth_open_count >= required_mouth_opens,
                'head': head_movement_count >= required_head_movements,
                'face_real': enhanced_face_score > required_face_score
            }
            
            overall_liveness_passed = all(requirements_met.values())
            
            # Add enhanced validation details
            result['liveness_validation'] = {
                'overall_liveness_passed': overall_liveness_passed,
                'requirements_met': requirements_met,
                'required_blinks': required_blinks,
                'required_mouth_opens': required_mouth_opens,
                'required_head_movements': required_head_movements,
                'required_face_score': required_face_score,
                'eye_aspect_ratio': result.get('eye_aspect_ratio', 0.3),
                'mouth_aspect_ratio': result.get('mouth_aspect_ratio', 0.0),
                'face_stability': 0.9 if enhanced_face_score > 0.5 else 0.3,
                'method': 'exact_demo_subfunctions_with_cdcn',
                'cdcn_enabled': CDCN_DETECTOR is not None
            }
            
            logger.info(f"✅ Enhanced detection: Blinks={blink_count}, Mouth={mouth_open_count}, Head={head_movement_count}, Score={enhanced_face_score:.3f}")
            
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in liveness detection: {str(e)}")
        return jsonify({
            'success': False, 
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/reset-detection/<user_id>', methods=['POST'])
def reset_detection_counters(user_id):
    """Reset detection counters"""
    try:
        if DETECTOR_AVAILABLE and DETECTOR:
            DETECTOR.reset_counters()
            logger.info(f"Reset detection counters for user: {user_id}")
            return jsonify({'success': True, 'message': 'Counters reset'})
        else:
            return jsonify({'success': False, 'error': 'Detector not available'})
    except Exception as e:
        logger.error(f"Error resetting counters: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register_user():
    """Complete user registration with biometric data"""
    try:
        if request.method == 'OPTIONS':
            return jsonify({'success': True}), 200
            
        logger.info("User registration request received")
        
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data received'}), 400
        
        # Extract user data
        username = data.get('username')
        email = data.get('email') 
        password = data.get('password')
        face_image = data.get('face_image')
        liveness_data = data.get('liveness_data')
        keystroke_data = data.get('keystroke_data', [])
        scroll_data = data.get('scroll_data', [])
        ekyc_data = data.get('ekyc_data')
        
        # Validate required fields
        if not all([username, email, password, face_image]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        # Load existing users
        users = load_users()
        
        # Check if user already exists
        if email in users:
            return jsonify({'success': False, 'error': 'User already exists'}), 400
        
        # Validate liveness data
        if not liveness_data or not liveness_data.get('overall_liveness_passed'):
            return jsonify({'success': False, 'error': 'Liveness validation failed'}), 400
        
        # Create user ID
        user_id = hashlib.md5(f"{email}_{datetime.utcnow().isoformat()}".encode()).hexdigest()[:16]
        
        # Save user data
        user_record = {
            'user_id': user_id,
            'username': username,
            'email': email,
            'password': hashlib.sha256(password.encode()).hexdigest(),  # Hash password
            'face_image': face_image,
            'liveness_data': liveness_data,
            'keystroke_data': keystroke_data,
            'scroll_data': scroll_data,
            'ekyc_data': ekyc_data,
            'created_at': datetime.utcnow().isoformat(),
            'status': 'active'
        }
        
        users[email] = user_record
        
        # Save to file
        if save_users(users):
            logger.info(f"✅ User registered successfully: {email}")
            return jsonify({
                'success': True,
                'message': 'User registered successfully',
                'user_id': user_id
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to save user data'}), 500
            
    except Exception as e:
        logger.error(f"Error in user registration: {str(e)}")
        return jsonify({'success': False, 'error': f'Registration failed: {str(e)}'}), 500

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login_user():
    """User login with biometric verification"""
    try:
        if request.method == 'OPTIONS':
            return jsonify({'success': True}), 200
            
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No JSON data received'}), 400
        
        email = data.get('email')
        password = data.get('password')
        face_image = data.get('face_image')
        liveness_data = data.get('liveness_data')
        
        if not all([email, password]):
            return jsonify({'success': False, 'error': 'Email and password required'}), 400
        
        # Load users
        users = load_users()
        
        if email not in users:
            return jsonify({'success': False, 'error': 'User not found'}), 401
        
        user = users[email]
        
        # Verify password
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        if user['password'] != password_hash:
            return jsonify({'success': False, 'error': 'Invalid password'}), 401
        
        # If biometric data provided, verify it
        if face_image and liveness_data:
            if not liveness_data.get('overall_liveness_passed'):
                return jsonify({'success': False, 'error': 'Biometric verification failed'}), 401
        
        logger.info(f"✅ User logged in successfully: {email}")
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'email': user['email']
            }
        })
        
    except Exception as e:
        logger.error(f"Error in user login: {str(e)}")
        return jsonify({'success': False, 'error': f'Login failed: {str(e)}'}), 500

@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """Test endpoint"""    
    return jsonify({
        'success': True,
        'message': 'Enhanced Biometric Authentication API',
        'version': '4.0.0',
        'features': {
            'extracted_functions_available': DETECTOR_AVAILABLE,
            'cdcn_available': CDCN_DETECTOR is not None,
            'pytorch_available': PYTORCH_AVAILABLE
        },
        'detection_method': 'exact_demo_subfunctions_with_cdcn',
        'endpoints': [
            '/api/test',
            '/api/liveness-detect',
            '/api/reset-detection/<user_id>',
            '/api/register',
            '/api/login'
        ]
    })

# ============================================================================
# Application Startup
# ============================================================================

@app.before_first_request
def initialize_app():
    """Initialize application components"""
    logger.info("Initializing application...")
    
    # Initialize detectors
    if DETECTOR_AVAILABLE:
        initialize_detector()
    
    if PYTORCH_AVAILABLE:
        initialize_cdcn()

if __name__ == '__main__':
    print("=" * 70)
    print("🔒 ENHANCED MULTIMODAL BIOMETRIC AUTHENTICATION SYSTEM")
    print("🎯 Using EXACT demo.py + sub_functions.py + CDCN Integration")
    print("=" * 70)
    
    # Initialize components
    logger.info("Initializing enhanced system...")
    
    if DETECTOR_AVAILABLE:
        initialize_detector()
        print("✅ Extracted Functions: Initialized")
    else:
        print("❌ Extracted Functions: Failed")
    
    if PYTORCH_AVAILABLE:
        cdcn_success = initialize_cdcn()
        print(f"✅ CDCN Model: {'Initialized' if cdcn_success else 'Failed'}")
    else:
        print("❌ CDCN Model: PyTorch not available")
    
    print("=" * 70)
    print("🚀 Starting Flask application...")
    print("🌐 Frontend URL: http://localhost:5173")
    print("🔧 Backend URL:  http://localhost:5000")
    print("=" * 70)
    
    # Run the application
    app.run(debug=True, host='0.0.0.0', port=5000)