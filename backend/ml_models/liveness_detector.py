import os
import math
import time
import logging
import base64
import cv2
import numpy as np
import face_recognition
from scipy.spatial import distance as dist
from collections import defaultdict, deque
from facenet_pytorch import MTCNN
import torch
from utils.supabase_manager import SupabaseManager

supabase_manager = SupabaseManager()

ENABLE_STATIC_IMAGE_DETECTION = False 
# Logger setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('liveness.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============= DYNAMIC THRESHOLDS =============
THRESHOLDS = {
    'EAR_THRESHOLD': 0.2,         
    'MAR_THRESHOLD': 0.6,           
    'HEAD_MOVEMENT_THRESHOLD': 8.0, 
    'MIN_BLINKS': 2,               
    'MIN_MOUTH_OPENS': 1,         
    'MIN_HEAD_MOVEMENTS': 1,      
    'SCORE_SMOOTHING_WINDOW': 1,   
    'MOVEMENT_DECAY_RATE': 1.0   ,
    'BLINK_MIN_DURATION': 0.1,
    'BLINK_MAX_DURATION': 5,
    'BLINK_MIN_FRAMES': 1,
    'BLINK_COOLDOWN': 0.8,
    'RANDOM_BLINKS_MIN': 2,
    'RANDOM_BLINKS_MAX': 4,
    'RANDOM_MOUTH_MIN': 1,
    'RANDOM_MOUTH_MAX': 3,
    'ENABLE_RANDOM_CHALLENGES': True,
    'ENABLE_RANDOM_ORDER': True
}

# Initialize models
DEVICE = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
MTCNN_MODEL = None
FAS_MODEL = None

def initialize_models():
    global MTCNN_MODEL, FAS_MODEL

    logger.info(" Starting model initialization...")
    try:
        MTCNN_MODEL = MTCNN(
            keep_all=False, 
            device=DEVICE,
            min_face_size=40, 
            thresholds=[0.6, 0.7, 0.7] 
        )
        logger.info(" MTCNN initialized successfully")
        
        test_img = np.ones((480, 640, 3), dtype=np.uint8) * 128
        boxes, probs = MTCNN_MODEL.detect(test_img)
        logger.info(f" MTCNN test result: boxes={boxes}, probs={probs}")
        
    except Exception as e:
        logger.error(f" MTCNN initialization failed: {e}")
        MTCNN_MODEL = None

# ============= Landmark Processing =============

def get_ear(eye):
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])
    C = dist.euclidean(eye[0], eye[3])
    if C == 0:
        return 0.0
    return (A + B) / (2.0 * C)

def get_eye_aspect_ratio(face_landmarks):
    if not face_landmarks:
        return None
    left_eye = face_landmarks.get('left_eye')
    right_eye = face_landmarks.get('right_eye')
    if not left_eye or not right_eye:
        return None
    ear_left = get_ear(left_eye)
    ear_right = get_ear(right_eye)
    return (ear_left + ear_right) / 2.0

def get_lip_height(lip):
    return np.mean([
        np.linalg.norm(np.subtract(lip[i], lip[12 - i]))
        for i in [2, 3, 4]
    ])

def get_mouth_height(top_lip, bottom_lip):
    return np.mean([
        np.linalg.norm(np.subtract(top_lip[i], bottom_lip[18 - i]))
        for i in [8, 9, 10]
    ])

def get_mouth_aspect_ratio(face_landmarks):
    if not face_landmarks:
        return None
    top_lip = face_landmarks.get("top_lip")
    bottom_lip = face_landmarks.get("bottom_lip")
    if not top_lip or not bottom_lip:
        return None
    mouth_height = get_mouth_height(top_lip, bottom_lip)
    lip_height = min(get_lip_height(top_lip), get_lip_height(bottom_lip))
    return mouth_height / lip_height if lip_height > 0 else 0.0

# ============= Enhanced User State Management =============

class UserState:
    def __init__(self):

        self.previous_landmarks = None
        self.landmark_movements = deque(maxlen=10)
        self.head_poses = deque(maxlen=10)
        # Counters for completed actions
        self.total_blinks = 0
        self.total_mouth_open = 0
        self.total_head_movements = 0
        
        # Frame tracking
        self.eye_closed_frames = 0
        self.mouth_open_frames = 0
        self.frames_processed = 0
        self.eyes_ever_opened = False
        self.mouth_ever_opened = False
        # Previous states for transition detection
        self.last_eye_state = False
        self.last_mouth_state = False
        self.previous_head_pose = None
        self.eye_close_start_time = None  
        self.last_blink_time = None      
        self.blink_phase = 'open'

        # Dynamic scoring with smoothing
        self.real_score_history = deque(maxlen=THRESHOLDS['SCORE_SMOOTHING_WINDOW'])
        self.ear_history = deque(maxlen=10) 
        self.mar_history = deque(maxlen=10)  
        self.head_movement_scores = deque(maxlen=20)

        self.current_detection_phase = "blinking"  # "blinking" -> "mouth" -> "head" -> "complete"
        self.blinks_completed = False
        self.mouth_completed = False
        self.head_completed = False
        
        # Dynamic completion tracking
        self.blinks_completed = False
        self.mouth_completed = False
        self.head_completed = False

        # CRITICAL: Initialize these flags properly
        self.eyes_ever_opened = False
        self.mouth_ever_opened = False
        self.eyes_started_closed = None  # Track initial state
        self.mouth_started_closed = None  # Track initial state
        
        # Add static image detection
        self.static_image_confirmed = False
        self.static_check_frames = 0
        
        # Add noise detection for head movement
        self.head_positions = deque(maxlen=30)
        self.head_movement_threshold_dynamic = THRESHOLDS['HEAD_MOVEMENT_THRESHOLD']

        # additional
        self.blink_phase = 'open'  # Track the phase: 'open' or 'closed'
        self.blink_start_time = None 
        self.last_blink_time = None

        # Real-time metrics
        self.current_real_score = 0.0
        self.current_ear = 0.0
        self.current_mar = 0.0
        self.current_head_movement_score = 0.0


        # Add after existing fields in __init__
        self.mode = 'registration'  # default mode
        self.required_blinks = THRESHOLDS['MIN_BLINKS']
        self.required_mouth_opens = THRESHOLDS['MIN_MOUTH_OPENS']
        self.required_head_movements = THRESHOLDS['MIN_HEAD_MOVEMENTS']
        self.challenge_order = ["blinking", "mouth", "head"]  # Default order
        self.multiple_faces_detected = False
        self.no_face_frames = 0

    def set_mode(self, mode):
        self.mode = mode
        if mode == 'login':
            # Login requirements (less strict)
            self.required_blinks = 2
            self.required_mouth_opens = 1
            self.required_head_movements = 1
        else:
            # Registration requirements (more strict)
            self.required_blinks = 3
            self.required_mouth_opens = 2
            self.required_head_movements = 2
        
        # Randomize requirements if enabled (but respect mode limits)
        if THRESHOLDS['ENABLE_RANDOM_CHALLENGES']:
            import random
            if mode == 'login':
                self.required_blinks = random.randint(2, 3)
                self.required_mouth_opens = random.randint(1, 2)
            else:
                self.required_blinks = random.randint(THRESHOLDS['RANDOM_BLINKS_MIN'], THRESHOLDS['RANDOM_BLINKS_MAX'])
                self.required_mouth_opens = random.randint(THRESHOLDS['RANDOM_MOUTH_MIN'], THRESHOLDS['RANDOM_MOUTH_MAX'])
            
        # Randomize order if enabled
        if THRESHOLDS['ENABLE_RANDOM_ORDER']:
            import random
            self.challenge_order = ["blinking", "mouth", "head"]
            random.shuffle(self.challenge_order[:2])  # Only shuffle first two, keep head last

    def reset(self):
        self.__init__()
    
    def advance_to_next_phase(self):
        """Advance to the next detection phase"""
        if self.current_detection_phase == "blinking" and self.blinks_completed:
            self.current_detection_phase = "mouth"
            logger.info(" Advanced to MOUTH detection phase")
        elif self.current_detection_phase == "mouth" and self.mouth_completed:
            self.current_detection_phase = "head"
            logger.info(" Advanced to HEAD movement detection phase")
        elif self.current_detection_phase == "head" and self.head_completed:
            self.current_detection_phase = "complete"
            logger.info(" Advanced to COMPLETE phase")
    
    def is_phase_active(self, phase: str) -> bool:
        """Check if a specific detection phase is currently active"""
        return self.current_detection_phase == phase
    
    def get_current_phase(self) -> str:
        """Get the current detection phase"""
        return self.current_detection_phase
    
    def get_smoothed_real_score(self):
        """Get smoothed anti-spoofing score - returns Python float"""
        if not self.real_score_history:
            return 0.0
        return float(np.mean(list(self.real_score_history)))
    
    def get_head_movement_score(self):
        """Get dynamic head movement score that decays over time - returns Python float"""
        if not self.head_movement_scores:
            return 0.0
        
        # Apply decay to older scores
        decayed_scores = []
        for i, score in enumerate(self.head_movement_scores):
            decay_factor = THRESHOLDS['MOVEMENT_DECAY_RATE'] ** (len(self.head_movement_scores) - i - 1)
            decayed_scores.append(score * decay_factor)
        
        return float(np.mean(decayed_scores))

# ============= Enhanced LivenessDetector Class =============

class LivenessDetector:
    def __init__(self, supabase_manager):
        self.supabase_manager = supabase_manager
        self.user_states = defaultdict(UserState)

    def get_user_state(self, user_id, mode='registration'):
        if user_id not in self.user_states:
            self.user_states[user_id] = UserState()
        self.user_states[user_id].set_mode(mode)
        return self.user_states[user_id]

    def reset_user_counters(self, user_id):
        if user_id in self.user_states:
            self.user_states[user_id].reset()
        else:
            self.user_states[user_id] = UserState()
        logger.info(f"Reset counters for user: {user_id}")
    
    
    def _get_current_requirement(self, user_state):
        """Get current phase requirement message"""
        phase = user_state.get_current_phase()
        if phase == "blinking":
            return f"Please blink naturally ({user_state.total_blinks}/{user_state.required_blinks})"
        elif phase == "mouth":
            return f"Please open your mouth ({user_state.total_mouth_open}/{user_state.required_mouth_opens})"
        elif phase == "head":
            return f"Please move your head ({user_state.total_head_movements}/{user_state.required_head_movements})"
        else:
            return "Liveness detection complete!"
    
  
 
    def _calculate_simple_liveness_score(self, user_state, is_static_image):
        """Calculate simple liveness score based on movement completion"""
        if is_static_image:
            return 0.0
        
        # Calculate progress percentage for each requirement
        blink_progress = min(1.0, user_state.total_blinks / user_state.required_blinks)
        mouth_progress = min(1.0, user_state.total_mouth_open / user_state.required_mouth_opens)
        head_progress = min(1.0, user_state.total_head_movements / user_state.required_head_movements)
        
        # Simple average of progress
        score = (blink_progress + mouth_progress + head_progress) / 3.0
        
        # Bonus for completing all phases
        if user_state.current_detection_phase == "complete":
            score = min(1.0, score + 0.1)
        
        return float(score)
 
    def _detect_head_movement(self, landmarks, user_state):
        """Enhanced head movement detection with scoring - returns Python types"""
        if not landmarks or 'nose_tip' not in landmarks:
            user_state.head_movement_scores.append(0.0)
            return False, 0.0
            
        nose_tip = landmarks['nose_tip'][2]
        
        if user_state.previous_head_pose is None:
            user_state.previous_head_pose = nose_tip
            user_state.head_movement_scores.append(0.0)
            return False, 0.0
            
        # Calculate movement distance
        movement_distance = float(np.linalg.norm(np.array(nose_tip) - np.array(user_state.previous_head_pose)))
        user_state.previous_head_pose = nose_tip
        
        # Convert distance to score (0-1 range)
        movement_score = float(min(1.0, movement_distance / THRESHOLDS['HEAD_MOVEMENT_THRESHOLD']))
        user_state.head_movement_scores.append(movement_score)
        
        # Update current score
        user_state.current_head_movement_score = user_state.get_head_movement_score()
        
        # Detect significant movement
        if movement_distance > THRESHOLDS['HEAD_MOVEMENT_THRESHOLD']:
            logger.info(f" Head movement detected: {movement_distance:.2f} (score: {movement_score:.3f})")
            return True, movement_score
            
        return False, movement_score

    def _reset_blink_state(self, user_state):
        user_state.total_blinks = 0
        user_state.ear_history.clear()
        user_state.current_ear = 0.0
        user_state.last_eye_state = False
        user_state.blink_phase = 'open'
        user_state.last_blink_time = None
        user_state.blinks_completed = False
        self.eyes_ever_opened = False
        self.mouth_ever_opened = False


    def process_frame_for_user(self, frame, user_id, mode='registration'):
        """
        Process a single frame for liveness detection with enhanced static image detection
        and improved security measures.
        """
        # ============= FRAME VALIDATION =============
        if frame is None or frame.size == 0:
            logger.error("Invalid frame received")
            return self._create_error_response("Invalid frame")

        logger.info(f"Processing frame {user_id} - Frame #{user_state.frames_processed if 'user_state' in locals() else 0}")

        # ============= PREPROCESSING =============
        # Convert to RGB and enhance contrast
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame = cv2.convertScaleAbs(rgb_frame, alpha=1.1, beta=5)

        # Model initialization check
        if MTCNN_MODEL is None:
            logger.error("MTCNN model not initialized")
            return self._create_error_response("MTCNN model not initialized")

        # ============= USER STATE MANAGEMENT =============
        user_state = self.get_user_state(user_id, mode)
        user_state.frames_processed += 1

        # ============= FACE DETECTION =============
        boxes, probs = self._detect_face_with_retries(rgb_frame)

        # No face detected
        if boxes is None or len(boxes) == 0:
            user_state.no_face_frames += 1
            logger.warning(f"No face detected - consecutive frames: {user_state.no_face_frames}")
            
            # If no face for too many frames, might be attack attempt
            if user_state.no_face_frames > 30:
                logger.error("Excessive no-face frames - possible attack")
                
            return self._create_no_face_response(user_state)

        # Multiple faces detected - security risk
        if len(boxes) > 1:
            logger.warning(f"Multiple faces detected: {len(boxes)} - resetting all counters")
            
            # Reset all progress when multiple faces detected
            self._reset_user_state_counters(user_state)
            user_state.multiple_faces_detected = True
            
            return self._create_multiple_faces_response(user_state, len(boxes))

        # ============= SINGLE FACE PROCESSING =============
        # Reset error counters on successful single face detection
        user_state.no_face_frames = 0
        user_state.multiple_faces_detected = False

        # Get best face
        face_detected = True
        best_idx = 0 if probs is None else np.argmax(probs)
        x1, y1, x2, y2 = [int(v) for v in boxes[best_idx]]
        
        # Add padding for better landmark detection
        h, w = rgb_frame.shape[:2]
        padding = 20
        x1, y1 = max(0, x1 - padding), max(0, y1 - padding)
        x2, y2 = min(w, x2 + padding), min(h, y2 + padding)

        # ============= LANDMARK DETECTION =============
        face_locations = [(y1, x2, y2, x1)]
        landmarks = face_recognition.face_landmarks(rgb_frame, face_locations)
        
        # Initialize tracking variables
        current_eye_closed = False
        current_mouth_open = False
        ear_value = 0.0
        mar_value = 0.0
        static_indicators = 0
        
        if landmarks and len(landmarks) > 0:
            lmarks = landmarks[0]
            
            # ============= EYE ASPECT RATIO PROCESSING =============
            ear = get_eye_aspect_ratio(lmarks)
            if ear is not None:
                ear_value = float(ear)
                user_state.current_ear = ear_value
                user_state.ear_history.append(ear_value)
                
                # Track initial eye state (first few frames)
                if user_state.frames_processed <= 5 and user_state.eyes_started_closed is None:
                    user_state.eyes_started_closed = ear <= 0.25
                    logger.info(f"Initial eye state set: {'closed' if user_state.eyes_started_closed else 'open'} (EAR: {ear:.3f})")
                
                # Check if eyes have ever been properly opened
                EAR_OPEN_THRESHOLD = 0.3  # Clear open state
                if ear > EAR_OPEN_THRESHOLD:
                    user_state.eyes_ever_opened = True
                    logger.debug(f"Eyes confirmed open (EAR: {ear:.3f})")
                
                # Determine current eye state
                EAR_CLOSED_THRESHOLD = 0.25
                current_eye_closed = ear <= EAR_CLOSED_THRESHOLD
                
                # Process blinks only if in blinking phase AND eyes have opened before
                phase = user_state.get_current_phase()
                if phase == "blinking" and user_state.eyes_ever_opened:
                    self._process_blink_detection(user_state, ear)
                elif phase == "blinking" and not user_state.eyes_ever_opened:
                    logger.warning("Cannot process blinks - eyes never opened")
            
            # ============= MOUTH ASPECT RATIO PROCESSING =============
            mar = get_mouth_aspect_ratio(lmarks)
            if mar is not None:
                mar_value = float(mar)
                user_state.current_mar = mar_value
                user_state.mar_history.append(mar_value)
                
                # Track initial mouth state
                if user_state.frames_processed <= 5 and user_state.mouth_started_closed is None:
                    user_state.mouth_started_closed = mar <= 0.6
                    logger.info(f"Initial mouth state set: {'closed' if user_state.mouth_started_closed else 'open'} (MAR: {mar:.3f})")
                
                # Check if mouth has ever been properly opened
                MAR_OPEN_THRESHOLD = 0.6
                current_mouth_open = mar > MAR_OPEN_THRESHOLD
                if current_mouth_open:
                    user_state.mouth_ever_opened = True
                    logger.debug(f"Mouth confirmed open (MAR: {mar:.3f})")
                
                # Process mouth opening only if in mouth phase AND mouth has moved before
                phase = user_state.get_current_phase()
                if phase == "mouth" and user_state.mouth_ever_opened:
                    self._process_mouth_detection(user_state, current_mouth_open)
                elif phase == "mouth" and not user_state.mouth_ever_opened:
                    logger.warning("Cannot process mouth - mouth never opened")
            
            # ============= HEAD MOVEMENT PROCESSING =============
            phase = user_state.get_current_phase()
            if phase == "head":
                # Store head position for static detection
                if 'nose_tip' in lmarks:
                    nose_tip = lmarks['nose_tip'][2]
                    user_state.head_positions.append(nose_tip)
                
                # Process head movement with noise filtering
                head_moved, head_score = self._detect_head_movement(lmarks, user_state)
                if head_moved and user_state.total_head_movements < user_state.required_head_movements:
                    user_state.total_head_movements += 1
                    logger.info(f"Head movement #{user_state.total_head_movements}/{user_state.required_head_movements} detected")
        
        # ============= STATIC IMAGE DETECTION =============
        is_static_image = self._detect_static_image_comprehensive(user_state)
        
        # Early exit if static image detected after sufficient frames
        if user_state.frames_processed > 20 and is_static_image:
            logger.error(f"STATIC IMAGE CONFIRMED at frame {user_state.frames_processed}")
            return {
                "success": False,
                "face_detected": True,
                "error": "Static image or photo detected. Please use live camera feed.",
                "alert_type": "static_image",
                "blink_count": 0,
                "mouth_open_count": 0,
                "head_movement_count": 0,
                "face_real_score": 0.0,
                "liveness_passed": False,
                "liveness_score": 0.0,
                "sequential_state": self._get_sequential_state(user_state, False),
                "validation": {
                    "static_image_detected": True,
                    "eyes_ever_opened": user_state.eyes_ever_opened,
                    "mouth_ever_opened": user_state.mouth_ever_opened,
                    "frames_processed": user_state.frames_processed
                }
            }
        
        # ============= PHASE PROGRESSION =============
        # Update detection phase based on completed actions
        self._update_detection_phase(user_state)
        
        # ============= FINAL VALIDATION =============
        # Comprehensive requirements check
        all_requirements_met = (
            user_state.total_blinks >= user_state.required_blinks and
            user_state.total_mouth_open >= user_state.required_mouth_opens and
            user_state.total_head_movements >= user_state.required_head_movements and
            not is_static_image and
            user_state.eyes_ever_opened and  # Must have opened eyes at least once
            user_state.mouth_ever_opened and  # Must have opened mouth at least once
            user_state.frames_processed >= 30  # Minimum frames for validation
        )
        
        # Update completion status
        if all_requirements_met:
            user_state.current_detection_phase = "complete"
            user_state.blinks_completed = True
            user_state.mouth_completed = True
            user_state.head_completed = True
            logger.info(f"LIVENESS DETECTION PASSED for user {user_id}")
        
        # ============= SCORING =============
        # Calculate liveness score with static image penalty
        liveness_score = self._calculate_comprehensive_liveness_score(user_state, is_static_image)
        
        # ============= BUILD RESPONSE =============
        return {
            "success": True,
            "face_detected": bool(face_detected),
            "blink_count": int(user_state.total_blinks),
            "mouth_open_count": int(user_state.total_mouth_open),
            "head_movement_count": int(user_state.total_head_movements),
            "face_real_score": float(liveness_score),
            "liveness_passed": bool(all_requirements_met),
            "liveness_score": float(liveness_score),
            "processing_time": 0.0,
            "sequential_state": self._get_sequential_state(user_state, all_requirements_met),
            "progress": {
                "blinks": f"{user_state.total_blinks}/{user_state.required_blinks}",
                "mouth_opens": f"{user_state.total_mouth_open}/{user_state.required_mouth_opens}", 
                "head_movements": f"{user_state.total_head_movements}/{user_state.required_head_movements}",
                "current_requirement": self._get_current_requirement(user_state)
            },
            "current_state": {
                "eyes_closed": bool(current_eye_closed),
                "mouth_open": bool(current_mouth_open),
                "frames_processed": int(user_state.frames_processed),
                "ear": float(ear_value),
                "mar": float(mar_value),
                "head_movement_score": float(user_state.current_head_movement_score),
                "static_image_detected": bool(is_static_image)
            },
            "validation": {
                "static_image_detected": bool(is_static_image),
                "eyes_ever_opened": bool(user_state.eyes_ever_opened),
                "mouth_ever_opened": bool(user_state.mouth_ever_opened),
                "eyes_started_closed": bool(user_state.eyes_started_closed) if user_state.eyes_started_closed is not None else None,
                "mouth_started_closed": bool(user_state.mouth_started_closed) if user_state.mouth_started_closed is not None else None,
                "variance_ear": float(np.var(list(user_state.ear_history))) if len(user_state.ear_history) > 5 else None,
                "variance_mar": float(np.var(list(user_state.mar_history))) if len(user_state.mar_history) > 5 else None
            }
        }

    # ============= HELPER METHODS TO ADD =============

    def _detect_static_image_comprehensive(self, user_state):
        """Comprehensive static image detection with multiple indicators"""
        # Need minimum frames for detection
        if user_state.frames_processed < 15:
            return False
        
        static_indicators = 0
        reasons = []
        
        # 1. Check if eyes/mouth never opened (strongest indicator)
        if not user_state.eyes_ever_opened:
            static_indicators += 3
            reasons.append("eyes never opened")
        
        if not user_state.mouth_ever_opened:
            static_indicators += 3
            reasons.append("mouth never opened")
        
        # 2. Check if started closed and stayed closed
        if user_state.eyes_started_closed and not user_state.eyes_ever_opened:
            static_indicators += 2
            reasons.append("eyes started and stayed closed")
        
        if user_state.mouth_started_closed and not user_state.mouth_ever_opened:
            static_indicators += 2
            reasons.append("mouth started and stayed closed")
        
        # 3. Check variance in measurements (low variance = static)
        if len(user_state.ear_history) >= 10:
            ear_variance = np.var(list(user_state.ear_history))
            if ear_variance < 0.0005:  # Very low variance threshold
                static_indicators += 2
                reasons.append(f"low EAR variance: {ear_variance:.6f}")
        
        if len(user_state.mar_history) >= 10:
            mar_variance = np.var(list(user_state.mar_history))
            if mar_variance < 0.0005:
                static_indicators += 2
                reasons.append(f"low MAR variance: {mar_variance:.6f}")
        
        # 4. Check head position stability
        if len(user_state.head_positions) >= 15:
            positions = np.array(list(user_state.head_positions))
            position_variance = np.var(positions, axis=0)
            avg_variance = np.mean(position_variance)
            if avg_variance < 0.3:  # Very stable position
                static_indicators += 1
                reasons.append(f"stable head position: {avg_variance:.3f}")
        
        # 5. Frame-to-frame consistency check
        if hasattr(user_state, 'landmark_movements') and len(user_state.landmark_movements) > 5:
            avg_movement = np.mean(list(user_state.landmark_movements))
            if avg_movement < 0.1:
                static_indicators += 1
                reasons.append(f"low landmark movement: {avg_movement:.3f}")
        
        # Determine if static (threshold of 3 indicators)
        is_static = static_indicators >= 3
        
        if is_static:
            user_state.static_image_confirmed = True
            logger.warning(f"STATIC IMAGE DETECTED - Score: {static_indicators}, Reasons: {', '.join(reasons)}")
        
        return is_static

    def _calculate_comprehensive_liveness_score(self, user_state, is_static_image):
        """Calculate liveness score with static image penalties"""
        if is_static_image:
            return 0.0  # Immediate fail for static images
        
        # Base scores for each component
        blink_score = min(1.0, user_state.total_blinks / max(1, user_state.required_blinks))
        mouth_score = min(1.0, user_state.total_mouth_open / max(1, user_state.required_mouth_opens))
        head_score = min(1.0, user_state.total_head_movements / max(1, user_state.required_head_movements))
        
        # Penalties
        penalty = 0.0
        
        # Penalty if eyes/mouth never opened
        if not user_state.eyes_ever_opened:
            penalty += 0.3
        if not user_state.mouth_ever_opened:
            penalty += 0.3
        
        # Penalty for low variance
        if len(user_state.ear_history) > 10:
            ear_var = np.var(list(user_state.ear_history))
            if ear_var < 0.001:
                penalty += 0.2
        
        # Calculate final score
        base_score = (blink_score * 0.4 + mouth_score * 0.3 + head_score * 0.3)
        final_score = max(0.0, base_score - penalty)
        
        # Bonus for completing all phases
        if user_state.current_detection_phase == "complete":
            final_score = min(1.0, final_score + 0.1)
        
        return float(final_score)

    def _reset_user_state_counters(self, user_state):
        """Reset all user state counters"""
        user_state.total_blinks = 0
        user_state.total_mouth_open = 0
        user_state.total_head_movements = 0
        user_state.current_detection_phase = user_state.challenge_order[0]
        user_state.blinks_completed = False
        user_state.mouth_completed = False
        user_state.head_completed = False

    def _get_sequential_state(self, user_state, all_requirements_met):
        """Get sequential state information"""
        return {
            "current_phase": user_state.current_detection_phase,
            "blinks_completed": user_state.total_blinks >= user_state.required_blinks,
            "mouth_completed": user_state.total_mouth_open >= user_state.required_mouth_opens,
            "head_completed": user_state.total_head_movements >= user_state.required_head_movements,
            "all_phases_complete": all_requirements_met,
            "challenge_order": user_state.challenge_order,
            "requirements": {
                "blinks": user_state.required_blinks,
                "mouth": user_state.required_mouth_opens,
                "head": user_state.required_head_movements
            }
        }

    def _create_no_face_response(self, user_state):
        """Create response for no face detected"""
        return {
            "success": False,
            "face_detected": False,
            "error": "No face detected. Please position your face in the camera.",
            "alert_type": "no_face",
            "blink_count": int(user_state.total_blinks),
            "mouth_open_count": int(user_state.total_mouth_open),
            "head_movement_count": int(user_state.total_head_movements),
            "face_real_score": 0.0,
            "liveness_passed": False,
            "liveness_score": 0.0,
            "sequential_state": self._get_sequential_state(user_state, False)
        }

    def _create_multiple_faces_response(self, user_state, face_count):
        """Create response for multiple faces detected"""
        return {
            "success": False,
            "face_detected": True,
            "error": f"Multiple faces detected ({face_count}). Please ensure only one person is in view.",
            "alert_type": "multiple_faces",
            "faces_count": face_count,
            "blink_count": 0,
            "mouth_open_count": 0,
            "head_movement_count": 0,
            "face_real_score": 0.0,
            "liveness_passed": False,
            "liveness_score": 0.0,
            "sequential_state": self._get_sequential_state(user_state, False)
        }
    
    def _update_detection_phase(self, user_state):
        current_phase_index = -1
        for i, phase in enumerate(user_state.challenge_order):
            if phase == "blinking" and user_state.total_blinks < user_state.required_blinks:
                user_state.current_detection_phase = "blinking"
                return
            elif phase == "mouth" and user_state.total_mouth_open < user_state.required_mouth_opens:
                user_state.current_detection_phase = "mouth"
                return
            elif phase == "head" and user_state.total_head_movements < user_state.required_head_movements:
                user_state.current_detection_phase = "head"
                return
        
        # All requirements met
        user_state.current_detection_phase = "complete"
    
    def _create_detailed_debug_log(self, user_state, face_detected, ear_value, mar_value, ear_score, mar_score, liveness_score):
        """Create comprehensive debug log"""
        
        debug_info = {
            "timestamp": time.time(),
            "frame_number": user_state.frames_processed,
            "detection_results": {
                "face_detected": face_detected,
                "ear_value": ear_value,
                "mar_value": mar_value,
                "ear_score": ear_score,
                "mar_score": mar_score,
                "liveness_score": liveness_score
            },
            "thresholds": {
                "ear_closed": THRESHOLDS['EAR_THRESHOLD'],
                "mar_open": THRESHOLDS['MAR_THRESHOLD'],
                "liveness_pass": 0.7
            },
            "history": {
                "ear_history": list(user_state.ear_history) if hasattr(user_state, 'ear_history') else [],
                "mar_history": list(user_state.mar_history) if hasattr(user_state, 'mar_history') else []
            }
        }
        
        return debug_info
    
    def _create_detailed_response(self, user_state, face_detected, liveness_passed, liveness_score, 
                          current_eye_closed, current_mouth_open):
        """Create detailed response with all metrics - JSON serializable"""
        return {
            "success": True,
            "face_detected": bool(face_detected),
            "blink_count": int(user_state.total_blinks),
            "mouth_open_count": int(user_state.total_mouth_open),
            "head_movement_count": int(user_state.total_head_movements),
            "face_real_score": float(user_state.current_real_score),
            "liveness_passed": bool(liveness_passed),
            "liveness_score": float(liveness_score),
            "processing_time": 0.0,
            "sequential_state": {
                "current_phase": user_state.get_current_phase(),
                "blinks_completed": user_state.blinks_completed,
                "mouth_completed": user_state.mouth_completed,
                "head_completed": user_state.head_completed,
                "all_phases_complete": user_state.get_current_phase() == "complete"
            },
            "progress": {
                "blinks": f"{user_state.total_blinks}/{user_state.required_blinks}",
                "mouth_opens": f"{user_state.total_mouth_open}/{user_state.required_mouth_opens}", 
                "head_movements": f"{user_state.total_head_movements}/{user_state.required_head_movements}",
                "current_requirement": self._get_current_requirement(user_state)
            },
            "current_state": {
                "eyes_closed": bool(current_eye_closed),
                "mouth_open": bool(current_mouth_open),
                "frames_processed": int(user_state.frames_processed),
                "ear": float(user_state.current_ear),
                "mar": float(user_state.current_mar),
                "head_movement_score": float(user_state.current_head_movement_score)
            }
        }
    
    def _detect_face_with_retries(self, rgb_frame, max_retries=2):
        """Face detection with retries"""
        for attempt in range(max_retries):
            try:
                boxes, probs = MTCNN_MODEL.detect(rgb_frame)
                if boxes is not None and len(boxes) > 0:
                    return boxes, probs
            except Exception as e:
                logger.error(f" MTCNN detection error on attempt {attempt + 1}: {e}")
        return None, None

    def _process_blink_detection(self, user_state, ear):
        if ear is None:
            return
        current_time = time.time()
        ear_thresh = THRESHOLDS['EAR_THRESHOLD']
        is_eye_closed = ear < ear_thresh
        print(f"    EAR: {ear:.4f}, Threshold: {ear_thresh}, Eyes Closed: {is_eye_closed}")
        # Eyes just closed
        if is_eye_closed and not user_state.last_eye_state:
            user_state.eye_close_start_time = current_time
            user_state.eye_closed_frames = 1
            print(f"    Eyes CLOSED (EAR: {ear:.3f})")
        # Eyes still closed
        elif is_eye_closed and user_state.last_eye_state:
            user_state.eye_closed_frames += 1
        # Eyes just opened
        elif not is_eye_closed and user_state.last_eye_state:
            # Validate only if the start time was set
            if user_state.eye_close_start_time is not None:
                close_duration = current_time - user_state.eye_close_start_time

                min_dur = THRESHOLDS['BLINK_MIN_DURATION']
                max_dur = THRESHOLDS['BLINK_MAX_DURATION']
                min_frames = THRESHOLDS['BLINK_MIN_FRAMES']
                cooldown = THRESHOLDS['BLINK_COOLDOWN']

                if (min_dur <= close_duration <= max_dur and
                    user_state.eye_closed_frames >= min_frames):

                    if (user_state.last_blink_time is None or
                        current_time - user_state.last_blink_time > cooldown):

                        user_state.total_blinks += 1
                        user_state.last_blink_time = current_time
                        print(f"    VALID BLINK #{user_state.total_blinks} - Duration: {close_duration:.2f}s, Frames: {user_state.eye_closed_frames}")
                    else:
                        print("    REJECTED: Blink too soon after previous")
                else:
                    print(f"    REJECTED: Invalid blink - Duration: {close_duration:.2f}s, Frames: {user_state.eye_closed_frames}")

            else:
                print(" Skipped blink validation - start time was not set")

            # Always reset after eyes open
            user_state.eye_closed_frames = 0
            user_state.eye_close_start_time = None

        user_state.last_eye_state = is_eye_closed
        user_state.current_ear = float(ear)


    def _process_mouth_detection(self, user_state, current_mouth_open):
        """Process mouth detection with state transitions"""
        if current_mouth_open and not user_state.last_mouth_state:
            user_state.mouth_open_frames = 1
        elif current_mouth_open:
            user_state.mouth_open_frames += 1
        elif not current_mouth_open and user_state.last_mouth_state:
            if not user_state.mouth_completed:
                user_state.total_mouth_open += 1
                logger.info(f" Mouth open detected! Total: {user_state.total_mouth_open}/{THRESHOLDS['MIN_MOUTH_OPENS']}")
                if user_state.total_mouth_open >= THRESHOLDS['MIN_MOUTH_OPENS']:
                    user_state.mouth_completed = True
            user_state.mouth_open_frames = 0
        user_state.last_mouth_state = current_mouth_open

    def _create_error_response(self, error_message):
        """Create standardized error response - JSON serializable"""
        return {
            "success": False,
            "error": str(error_message),
            "face_detected": False,
            "blink_count": 0,
            "mouth_open_count": 0,
            "head_movement_count": 0,
            "face_real_score": 0.0,
            "liveness_passed": False,
            "liveness_score": 0.0,
            "processing_time": 0.0
        }

    def _create_response(self, user_state, face_detected):
        """Create basic response - JSON serializable"""
        return {
            "success": True,
            "face_detected": bool(face_detected),
            "blink_count": int(user_state.total_blinks),
            "mouth_open_count": int(user_state.total_mouth_open),
            "head_movement_count": int(user_state.total_head_movements),
            "face_real_score": float(user_state.current_real_score),
            "liveness_passed": False,
            "liveness_score": 0.0,
            "processing_time": 0.0
        }



    def reset_counters(self):
        self.user_states.clear()
        logger.info("Reset all user counters")

    def process_frame(self, frame):
        return self.process_frame_for_user(frame, "default_user")

# ============= Singleton Detector =============
DETECTOR = LivenessDetector(supabase_manager)

# ============= API Helper Functions =============
def initialize_detector():
    initialize_models()
    DETECTOR.reset_counters()

def process_base64_image(base64_str):
    if base64_str.startswith("data:image"):
        base64_str = base64_str.split(",")[1]
    img_data = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def process_liveness_request(frame_data: str, reset_counters: bool = False):
    if reset_counters:
        DETECTOR.reset_counters()
    frame = process_base64_image(frame_data)
    return DETECTOR.process_frame(frame)

def update_thresholds(new_thresholds: dict):
    """Update detection thresholds dynamically"""
    global THRESHOLDS
    for key, value in new_thresholds.items():
        if key in THRESHOLDS:
            THRESHOLDS[key] = value
            logger.info(f"Updated threshold {key} to {value}")
    return THRESHOLDS

def ensure_json_serializable(obj):
    """Convert numpy types to Python native types for JSON serialization"""
    if isinstance(obj, dict):
        return {key: ensure_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [ensure_json_serializable(item) for item in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj

def process_frame_api(face_image_b64: str, user_id: str = None, reset_counters: bool = False, mode: str = 'registration'):
    try:
        if user_id is None:
            user_id = "default_user"
        if reset_counters:
            DETECTOR.reset_user_counters(user_id)
        frame = process_base64_image(face_image_b64)
        result = DETECTOR.process_frame_for_user(frame, user_id, mode)
        
        # Ensure all values are JSON serializable
        return ensure_json_serializable(result)
        
    except Exception as e:
        logger.error(f"process_frame_api error: {e}")
        return ensure_json_serializable({
            "success": False,
            "error": str(e),
            "face_detected": False,
            "blink_count": 0,
            "mouth_open_count": 0,
            "head_movement_count": 0,
            "face_real_score": 0.0,
            "liveness_passed": False,
            "processing_time": 0.0
        })