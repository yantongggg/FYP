# backend/ml_models/liveness_detector.py

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
# from keras.models import load_model
from facenet_pytorch import MTCNN
import torch
from torchvision import models, transforms
from utils.supabase_manager import SupabaseManager

supabase_manager = SupabaseManager()

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
# Make these easily configurable
THRESHOLDS = {
    'EAR_THRESHOLD': 0.25,          # Lower = more sensitive eye blink detection
    'MAR_THRESHOLD': 0.35,          # Lower = more sensitive mouth open detection  
    'HEAD_MOVEMENT_THRESHOLD': 8.0, # Lower = more sensitive head movement
    'REAL_SCORE_THRESHOLD': 0.5,   # Lower = more lenient anti-spoofing
    'MIN_BLINKS': 2,                # Reduced requirement
    'MIN_MOUTH_OPENS': 2,           # Reduced requirement
    'MIN_HEAD_MOVEMENTS': 1,        # Reduced requirement
    'SCORE_SMOOTHING_WINDOW': 5,    # Frames to average scores over
    'MOVEMENT_DECAY_RATE': 0.95     # How quickly movement scores decay
}

# Initialize models
DEVICE = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
MTCNN_MODEL = None
FAS_MODEL = None

def initialize_models():
    global MTCNN_MODEL, FAS_MODEL

    logger.info("🚀 Starting model initialization...")

    # Initialize MTCNN with better error handling
    try:
        MTCNN_MODEL = MTCNN(
            keep_all=False, 
            device=DEVICE,
            min_face_size=40,  # Minimum face size
            thresholds=[0.6, 0.7, 0.7]  # More lenient thresholds
        )
        logger.info("✅ MTCNN initialized successfully")
        
        # Test MTCNN with a dummy image
        test_img = np.ones((480, 640, 3), dtype=np.uint8) * 128
        boxes, probs = MTCNN_MODEL.detect(test_img)
        logger.info(f"🧪 MTCNN test result: boxes={boxes}, probs={probs}")
        
    except Exception as e:
        logger.error(f"❌ MTCNN initialization failed: {e}")
        MTCNN_MODEL = None

    # Initialize Anti-spoofing model with better path handling
    try:
        model_path = r"C:\\Users\\chyey\\project\\backend\\models\\resnet18.pth"
        
        # Check if model file exists
        if not os.path.exists(model_path):
            logger.error(f"❌ Model file not found: {model_path}")
            FAS_MODEL = None
            return

        logger.info(f"📂 Loading model from: {model_path}")
        
        # Create ResNet18 architecture
        model = models.resnet18(pretrained=False)
        model.fc = torch.nn.Linear(model.fc.in_features, 2)  # 2 classes: [fake, real]

        # Load weights with better error handling
        checkpoint = torch.load(model_path, map_location="cpu")
        
        # Handle different checkpoint formats
        if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
            model.load_state_dict(checkpoint['state_dict'])
        else:
            model.load_state_dict(checkpoint)
            
        model.eval()
        FAS_MODEL = model
        
        logger.info("✅ Anti-spoofing model loaded successfully")
        
        # Test the model with dummy input
        test_input = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            test_output = FAS_MODEL(test_input)
            logger.info(f"🧪 Model test output shape: {test_output.shape}")
            
    except Exception as e:
        logger.error(f"❌ Failed to load anti-spoofing model: {e}", exc_info=True)
        FAS_MODEL = None

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
        # Counters for completed actions
        self.total_blinks = 0
        self.total_mouth_open = 0
        self.total_head_movements = 0
        
        # Frame tracking
        self.eye_closed_frames = 0
        self.mouth_open_frames = 0
        self.frames_processed = 0
        
        # Previous states for transition detection
        self.last_eye_state = False
        self.last_mouth_state = False
        self.previous_head_pose = None
        
        # Dynamic scoring with smoothing
        self.real_score_history = deque(maxlen=THRESHOLDS['SCORE_SMOOTHING_WINDOW'])
        self.ear_history = deque(maxlen=10)  # ✅ FIXED: Ensure proper deque
        self.mar_history = deque(maxlen=10)  # ✅ FIXED: Ensure proper deque
        self.head_movement_scores = deque(maxlen=20)

        # ✅ ADD: Sequential state management
        self.current_detection_phase = "blinking"  # "blinking" -> "mouth" -> "head" -> "complete"
        self.blinks_completed = False
        self.mouth_completed = False
        self.head_completed = False
        
        # Dynamic completion tracking
        self.blinks_completed = False
        self.mouth_completed = False
        self.head_completed = False

        # additional
        self.blink_phase = 'open'  # Track the phase: 'open' or 'closed'
        self.blink_start_time = None 
        self.last_blink_time = None

        # Real-time metrics
        self.current_real_score = 0.0
        self.current_ear = 0.0
        self.current_mar = 0.0
        self.current_head_movement_score = 0.0

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

    def get_user_state(self, user_id):
        return self.user_states[user_id]

    def reset_user_counters(self, user_id):
        if user_id in self.user_states:
            self.user_states[user_id].reset()
        else:
            self.user_states[user_id] = UserState()
        logger.info(f"Reset counters for user: {user_id}")
    
    #####

    # Add this test method to LivenessDetector class:
    def test_antispoofing_model(self):
        """Test if anti-spoofing model is working correctly"""
        print("\n=== TESTING ANTI-SPOOFING MODEL ===")
        
        if FAS_MODEL is None:
            print("❌ No FAS model loaded!")
            return False
        
        try:
            # Test with random noise (should be fake)
            noise_input = torch.randn(1, 3, 224, 224)
            with torch.no_grad():
                output = FAS_MODEL(noise_input)
                probs = torch.nn.functional.softmax(output, dim=1)
                real_prob = probs[0, 0].item()
                
            print(f"Random noise classified as REAL: {real_prob:.3f}")
            
            if real_prob > 0.7:
                print("🚨 MODEL PROBLEM: Random noise getting high real score!")
                return False
            else:
                print("✅ Model seems to work on random input")
                return True
                
        except Exception as e:
            print(f"❌ Model test failed: {e}")
            return False

    # Test your model by calling this method

    #####
    
    
    def _get_current_requirement(self, user_state):
        """Get current phase requirement message"""
        phase = user_state.get_current_phase()
        if phase == "blinking":
            return f"Please blink naturally ({user_state.total_blinks}/{THRESHOLDS['MIN_BLINKS']})"
        elif phase == "mouth":
            return f"Please open your mouth ({user_state.total_mouth_open}/{THRESHOLDS['MIN_MOUTH_OPENS']})"
        elif phase == "head":
            return f"Please move your head ({user_state.total_head_movements}/{THRESHOLDS['MIN_HEAD_MOVEMENTS']})"
        else:
            return "Liveness detection complete!"
    
    # Add this debug method to the LivenessDetector class
    def _debug_anti_spoofing(self, face_crop, user_state):
        """Debug anti-spoofing detection"""
        print(f"\n=== ANTI-SPOOFING DEBUG ===")
        print(f"Face crop shape: {face_crop.shape if face_crop.size > 0 else 'Empty'}")
        print(f"FAS_MODEL available: {FAS_MODEL is not None}")
        
        if FAS_MODEL is None:
            print("❌ FAS_MODEL is None - always returning 0.0!")
            return 0.0
            
        if face_crop.size == 0:
            print("❌ Face crop is empty!")
            return 0.0
        
        # Test the actual model prediction
        try:
            import torchvision.transforms as transforms
            from PIL import Image
            
            # Convert and preprocess
            face_pil = Image.fromarray(face_crop)
            print(f"PIL image mode: {face_pil.mode}, size: {face_pil.size}")
            
            preprocess = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                    std=[0.229, 0.224, 0.225])
            ])
            
            input_tensor = preprocess(face_pil).unsqueeze(0)
            print(f"Input tensor shape: {input_tensor.shape}")
            
            # Model inference with detailed output
            with torch.no_grad():
                raw_output = FAS_MODEL(input_tensor)
                print(f"Raw model output: {raw_output}")
                
                # Get probabilities
                prob_tensor = torch.nn.functional.softmax(raw_output, dim=1)
                print(f"Softmax probabilities: {prob_tensor}")
                
                real_prob = prob_tensor[0, 0].item()  # Real class probability  
                fake_prob = prob_tensor[0, 1].item()  # Fake class probability
                
                print(f"🎯 REAL probability: {real_prob:.4f}")
                print(f"🎯 FAKE probability: {fake_prob:.4f}")
                print(f"🎯 Prediction: {'REAL' if real_prob > fake_prob else 'FAKE'}")
                
                # Check if model is actually working
                if abs(real_prob - 0.5) < 0.1:
                    print("⚠️ WARNING: Model predictions are close to random (0.5)!")
                
                return real_prob
                
        except Exception as e:
            print(f"❌ FAS prediction error: {e}")
            import traceback
            traceback.print_exc()
            return 0.0

    # Add this debug method for scoring
    def _debug_liveness_scoring(self, user_state):
        """Debug liveness score calculation"""
        print(f"\n=== LIVENESS SCORING DEBUG ===")
        
        # Individual scores
        blink_score = min(1.0, float(user_state.total_blinks) / THRESHOLDS['MIN_BLINKS'])
        mouth_score = min(1.0, float(user_state.total_mouth_open) / THRESHOLDS['MIN_MOUTH_OPENS'])
        head_score = float(user_state.current_head_movement_score)
        real_score_raw = float(user_state.current_real_score)
        real_score_normalized = max(0.0, min(1.0, real_score_raw / THRESHOLDS['REAL_SCORE_THRESHOLD']))
        
        print(f"Blink score: {blink_score:.3f} ({user_state.total_blinks}/{THRESHOLDS['MIN_BLINKS']})")
        print(f"Mouth score: {mouth_score:.3f} ({user_state.total_mouth_open}/{THRESHOLDS['MIN_MOUTH_OPENS']})")
        print(f"Head score: {head_score:.3f}")
        print(f"Real score RAW: {real_score_raw:.3f}")
        print(f"Real score NORMALIZED: {real_score_normalized:.3f} (threshold: {THRESHOLDS['REAL_SCORE_THRESHOLD']})")
        
        # Weighted combination
        weights = {'blink': 0.25, 'mouth': 0.25, 'head': 0.25, 'real': 0.25}
        
        contributions = {
            'blink': weights['blink'] * blink_score,
            'mouth': weights['mouth'] * mouth_score,
            'head': weights['head'] * head_score,
            'real': weights['real'] * real_score_normalized
        }
        
        print(f"\nWeighted contributions:")
        for key, value in contributions.items():
            print(f"  {key}: {value:.3f} (weight: {weights[key]})")
        
        final_score = sum(contributions.values())
        print(f"\nFINAL LIVENESS SCORE: {final_score:.3f}")
        print(f"PASSES (>0.7): {final_score > 0.7}")
        
        # WARNING CHECKS
        if real_score_normalized > 0.8 and final_score > 0.7:
            print("⚠️ WARNING: High real score but passing - might be detecting static image as real!")
        
        if real_score_raw < 0.3 and final_score > 0.7:
            print("⚠️ WARNING: Low raw anti-spoofing score but still passing overall!")
            
        return final_score

    # Add this to detect static images
    def _detect_static_image(self, user_state):
        """Detect if this might be a static image"""
        print(f"\n=== STATIC IMAGE DETECTION ===")
        
        # Check for lack of natural variation
        if len(user_state.real_score_history) >= 10:
            scores = list(user_state.real_score_history)
            score_variance = np.var(scores)
            print(f"Real score variance: {score_variance:.6f}")
            
            if score_variance < 0.001:  # Very low variance
                print("🚨 SUSPICIOUS: Very low variance in anti-spoofing scores!")
                return True
        
        # Check EAR patterns
        if len(user_state.ear_history) >= 5:
            ear_values = list(user_state.ear_history)
            ear_variance = np.var(ear_values)
            print(f"EAR variance: {ear_variance:.6f}")
            
            # Static images might have very consistent EAR values
            if ear_variance < 0.0001:
                print("🚨 SUSPICIOUS: Very consistent EAR values!")
                return True
        
        # Check for unnatural blink patterns
        if user_state.total_blinks > 0:
            frames_per_blink = user_state.frames_processed / user_state.total_blinks
            print(f"Frames per blink: {frames_per_blink:.1f}")
            
            if frames_per_blink < 5:  # Too frequent blinking
                print("🚨 SUSPICIOUS: Unnaturally frequent blinking!")
                return True
        
        return False
    
    def _predict_fas(self, face_crop):
        """Enhanced FAS prediction with proper float scoring"""
        
        if FAS_MODEL is None or face_crop.size == 0:
            return 0.0  # Return 0 for no model or invalid crop
            
        try:
            import torchvision.transforms as transforms
            from PIL import Image

            # Convert to PIL Image for model input
            face_pil = Image.fromarray(face_crop)  # face_crop should already be RGB

            # Preprocess for ResNet
            preprocess = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                    std=[0.229, 0.224, 0.225])
            ])
            
            input_tensor = preprocess(face_pil).unsqueeze(0)

            # Model inference
            with torch.no_grad():
                output = FAS_MODEL(input_tensor)
                
                # Get probabilities with proper softmax
                prob_tensor = torch.nn.functional.softmax(output, dim=1)
                
                # Return the "real" probability (index 0 for real, index 1 for fake)
                real_prob = prob_tensor[0, 0].item()  # Real class probability
                
                # Apply slight smoothing to avoid extreme values
                real_prob = max(0.01, min(0.99, real_prob))
                
                logger.info(f"🎯 FAS Real probability: {real_prob:.4f}")
                return real_prob
                
        except Exception as e:
            logger.error(f"❌ _predict_fas ERROR: {e}")
            return 0.0

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
            logger.info(f"🗣️ Head movement detected: {movement_distance:.2f} (score: {movement_score:.3f})")
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

    def process_frame_for_user(self, frame, user_id):

        # ===== FRAME VALIDATION =====
        if frame is None or frame.size == 0:
            logger.error(" Invalid frame received")
            return self._create_error_response("Invalid frame")

        logger.info(f" Processing frame - shape: {frame.shape}, dtype: {frame.dtype}")

        # Convert to RGB and enhance
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame = cv2.convertScaleAbs(rgb_frame, alpha=1.1, beta=5)

        # ===== INITIALIZATION CHECKS =====
        if MTCNN_MODEL is None:
            return self._create_error_response("MTCNN model not initialized")

        user_state = self.get_user_state(user_id)
        user_state.frames_processed += 1

        # ===== FACE DETECTION =====
        boxes, probs = self._detect_face_with_retries(rgb_frame)
        
        if boxes is None or len(boxes) == 0:
            logger.warning(" No face detected")
            user_state.real_score_history.append(0.0)
            user_state.current_real_score = user_state.get_smoothed_real_score()
            return self._create_response(user_state, face_detected=False)

        # ===== PROCESS DETECTED FACE =====
        face_detected = True
        
        # Get best face detection
        best_idx = 0 if probs is None else np.argmax(probs)
        x1, y1, x2, y2 = [int(v) for v in boxes[best_idx]]
        
        # Add padding and ensure bounds
        h, w = rgb_frame.shape[:2]
        padding = 20
        x1, y1 = max(0, x1 - padding), max(0, y1 - padding)
        x2, y2 = min(w, x2 + padding), min(h, y2 + padding)

        # Extract and process face crop
        face_crop = rgb_frame[y1:y2, x1:x2]
        
        # ===== ANTI-SPOOFING OVERRIDE FOR STATIC IMAGES =====
        if user_state.current_real_score > 0.95:  # Suspiciously high confidence
            # Check for static image patterns
            static_indicators = 0
            
            # 1. Check if scores are too consistent
            if len(user_state.real_score_history) >= 5:
                recent_scores = list(user_state.real_score_history)[-5:]
                if all(score > 0.9 for score in recent_scores):
                    static_indicators += 1
                    print("🚨 INDICATOR 1: Consistently high anti-spoofing scores")
            
            # 2. Check if blinks happen too regularly 
            if user_state.total_blinks > 0:
                frames_per_blink = user_state.frames_processed / user_state.total_blinks
                if frames_per_blink < 10:  # Too frequent
                    static_indicators += 1
                    print(f"🚨 INDICATOR 2: Unnatural blink frequency ({frames_per_blink:.1f} frames/blink)")
            
            # 3. Check EAR consistency
            if len(user_state.ear_history) >= 3:
                ear_values = list(user_state.ear_history)
                ear_std = np.std(ear_values)
                if ear_std < 0.01:  # Too consistent
                    static_indicators += 1
                    print(f"🚨 INDICATOR 3: EAR values too consistent (std: {ear_std:.4f})")
            
            # 4. Perfect anti-spoofing score is suspicious
            if user_state.current_real_score >= 0.99:
                static_indicators += 1
                print("🚨 INDICATOR 4: Perfect anti-spoofing score (99%+)")
            
            print(f"🚨 STATIC IMAGE INDICATORS: {static_indicators}/4")
            
            if static_indicators >= 2:
                print("🚨 STATIC IMAGE DETECTED - FAILING LIVENESS")
                return self._create_error_response("Static image detected - anti-spoofing failed")

        # ===== MORE STRICT BLINK DETECTION =====
        # Add minimum time requirement between blinks
        current_time = time.time()
        if hasattr(user_state, 'last_blink_time') and user_state.last_blink_time:
            time_since_last_blink = current_time - user_state.last_blink_time
            if time_since_last_blink < 0.3:  # Less than 300ms between blinks = suspicious
                print(f"🚨 SUSPICIOUS: Blinks too frequent ({time_since_last_blink:.2f}s apart)")
                return self._create_error_response("Unnatural blink pattern detected")

        # ===== ANTI-SPOOFING SCORING =====
        if face_crop.size > 0:
            real_score = float(self._debug_anti_spoofing(face_crop, user_state))  # Debug version
            user_state.real_score_history.append(real_score)
            user_state.current_real_score = user_state.get_smoothed_real_score()
        else:
            user_state.real_score_history.append(0.0)
            user_state.current_real_score = user_state.get_smoothed_real_score()

        # ===== STATIC IMAGE DETECTION =====
        is_static = self._detect_static_image(user_state)
        if is_static:
            print("🚨 STATIC IMAGE DETECTED - FAILING LIVENESS CHECK")
            return self._create_error_response("Static image detected")

        # ===== LANDMARK ANALYSIS =====
        face_locations = [(y1, x2, y2, x1)]
        landmarks = face_recognition.face_landmarks(rgb_frame, face_locations)
        
        current_eye_closed = False
        current_mouth_open = False
        head_movement_detected = False
        
        if landmarks:
            lmarks = landmarks[0]
            
            current_phase = user_state.get_current_phase()
            logger.info(f"🔄 Current detection phase: {current_phase}")
            
            # PHASE 1: BLINKING DETECTION
            if user_state.is_phase_active("blinking"):
                ear = get_eye_aspect_ratio(lmarks)
                if ear is not None:
                    current_time = time.time()

                    if float(ear) < 0.4:
                        if user_state.blink_start_time is None:
                            user_state.blink_start_time = current_time

                        user_state.ear_history.append(float(ear))
                        user_state.current_ear = float(np.mean(list(user_state.ear_history)))
                        current_eye_closed = ear <= THRESHOLDS['EAR_THRESHOLD']
                        
                        self._process_blink_detection(user_state, ear)
                        
                        # Check if blinking phase is complete
                        if user_state.total_blinks >= THRESHOLDS['MIN_BLINKS']:
                            user_state.blinks_completed = True
                            user_state.advance_to_next_phase()
                    else:
                        user_state.ear_history.clear()
            
            # PHASE 2: MOUTH DETECTION (only if blinking is complete)
            elif user_state.is_phase_active("mouth"):
                mar = get_mouth_aspect_ratio(lmarks)
                if mar is not None:
                    user_state.mar_history.append(float(mar))
                    user_state.current_mar = float(np.mean(list(user_state.mar_history)))
                    current_mouth_open = mar > THRESHOLDS['MAR_THRESHOLD']
                    
                    self._process_mouth_detection(user_state, current_mouth_open)
                    
                    # Check if mouth phase is complete
                    if user_state.total_mouth_open >= THRESHOLDS['MIN_MOUTH_OPENS']:
                        user_state.mouth_completed = True
                        user_state.advance_to_next_phase()
            
            # PHASE 3: HEAD MOVEMENT DETECTION (only if blinking and mouth are complete)
            elif user_state.is_phase_active("head"):
                head_moved, movement_score = self._detect_head_movement(lmarks, user_state)
                if head_moved:
                    head_movement_detected = True
                    user_state.total_head_movements += 1  # ✅ Count each detected movement
                    logger.info(f"🎯 Head movement {user_state.total_head_movements}/{THRESHOLDS['MIN_HEAD_MOVEMENTS']} detected!")
                    
                    # Check if head movement phase is complete
                    if user_state.total_head_movements >= THRESHOLDS['MIN_HEAD_MOVEMENTS']:
                        user_state.head_completed = True
                        user_state.advance_to_next_phase()

        # ===== DYNAMIC LIVENESS SCORING =====
        liveness_score = self._debug_liveness_scoring(user_state)  
        liveness_passed = liveness_score > 0.7

        logger.info(f"User {user_id} - Frame {user_state.frames_processed} - Phase: {user_state.get_current_phase()}: "
                    f"EAR: {user_state.current_ear:.3f}, MAR: {user_state.current_mar:.3f}, "
                    f"Real: {user_state.current_real_score:.3f}, Liveness: {liveness_score:.3f}")

        return self._create_detailed_response(user_state, face_detected, liveness_passed, liveness_score, 
                                            current_eye_closed, current_mouth_open)



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
                "blinks": f"{user_state.total_blinks}/{THRESHOLDS['MIN_BLINKS']}",
                "mouth_opens": f"{user_state.total_mouth_open}/{THRESHOLDS['MIN_MOUTH_OPENS']}",
                "head_movements": f"{user_state.total_head_movements}/{THRESHOLDS['MIN_HEAD_MOVEMENTS']}",
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
        """STRICT: More secure blink detection"""
        
        if ear is None:
            return

        current_time = time.time()
        EYE_CLOSED_THRESHOLD = 0.2  # More strict
        is_eye_closed = ear < EYE_CLOSED_THRESHOLD
        
        # Require minimum closed duration
        if is_eye_closed:
            if not hasattr(user_state, 'eye_close_start_time'):
                user_state.eye_close_start_time = current_time
            user_state.eye_closed_frames += 1
        else:
            # Eye opened - check if it was a valid blink
            if hasattr(user_state, 'eye_close_start_time') and user_state.last_eye_state:
                close_duration = current_time - user_state.eye_close_start_time
                
                # Valid blink: 0.1s to 0.5s duration, minimum 3 closed frames
                if (0.1 <= close_duration <= 0.5 and 
                    user_state.eye_closed_frames >= 3):
                    
                    # Check time since last blink
                    if (not hasattr(user_state, 'last_blink_time') or 
                        current_time - user_state.last_blink_time > 0.5):
                        
                        user_state.total_blinks += 1
                        user_state.last_blink_time = current_time
                        print(f"✅ VALID BLINK #{user_state.total_blinks} - Duration: {close_duration:.2f}s, Frames: {user_state.eye_closed_frames}")
                    else:
                        print(f"🚨 REJECTED: Blink too soon after previous blink")
                else:
                    print(f"🚨 REJECTED: Invalid blink - Duration: {close_duration:.2f}s, Frames: {user_state.eye_closed_frames}")
            
            # Reset counters
            user_state.eye_closed_frames = 0
            if hasattr(user_state, 'eye_close_start_time'):
                delattr(user_state, 'eye_close_start_time')
        
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

    def _calculate_dynamic_liveness_score(self, user_state):
        """Calculate dynamic liveness score combining all factors - returns Python float"""
        # Individual component scores (0-1 range)
        blink_score = min(1.0, float(user_state.total_blinks) / THRESHOLDS['MIN_BLINKS'])
        mouth_score = min(1.0, float(user_state.total_mouth_open) / THRESHOLDS['MIN_MOUTH_OPENS'])
        head_score = float(user_state.current_head_movement_score)
        real_score = max(0.0, min(1.0, float(user_state.current_real_score) / THRESHOLDS['REAL_SCORE_THRESHOLD']))
        
        # Weighted combination
        weights = {'blink': 0.25, 'mouth': 0.25, 'head': 0.25, 'real': 0.25}
        
        combined_score = (
            weights['blink'] * blink_score +
            weights['mouth'] * mouth_score +
            weights['head'] * head_score +
            weights['real'] * real_score
        )
        
        return float(combined_score)

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

def process_frame_api(face_image_b64: str, user_id: str = None, reset_counters: bool = False):
    """API wrapper that ensures JSON serializable response"""
    try:
        if user_id is None:
            user_id = "default_user"
        if reset_counters:
            DETECTOR.reset_user_counters(user_id)
        frame = process_base64_image(face_image_b64)
        result = DETECTOR.process_frame_for_user(frame, user_id)
        
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