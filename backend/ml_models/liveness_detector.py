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
from collections import defaultdict
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

# Constants
EAR_THRESHOLD = 0.25
MAR_THRESHOLD = 0.5
HEAD_MOVEMENT_THRESHOLD = 12

# Initialize models
DEVICE = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
MTCNN_MODEL = None
FAS_MODEL = None

def initialize_models():
    global MTCNN_MODEL, FAS_MODEL

    # Initialize MTCNN
    try:
        MTCNN_MODEL = MTCNN(keep_all=False, device=DEVICE)
        logger.info("MTCNN initialized successfully")
    except Exception as e:
        logger.error(f"MTCNN initialization failed: {e}")

    # Initialize ResNet18 anti-spoofing model
    try:
        from torchvision import models

        # Create ResNet18 architecture
        model = models.resnet18(pretrained=False)
        model.fc = torch.nn.Linear(model.fc.in_features, 2)  # 2 output classes: [fake, real]

        # Load weights
        model.load_state_dict(torch.load(
            r"C:\\Users\\chyey\\Downloads\\models\\anti_spoofing_resnet18.pth",
            map_location="cpu"
        ))
        model.eval()
        FAS_MODEL = model

        logger.info("ResNet18 anti-spoofing model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load ResNet18 model: {e}")

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

# ============= User State Management =============

class UserState:
    def __init__(self):
        self.total_blinks = 0
        self.total_mouth_open = 0
        self.total_head_movements = 0
        self.eye_closed_frames = 0
        self.mouth_open_frames = 0
        self.previous_head_pose = None
        self.last_eye_state = False
        self.last_mouth_state = False
        self.frames_processed = 0
        self.blinks_completed = False
        self.mouth_completed = False
        self.head_completed = False

    def reset(self):
        self.__init__()

# ============= LivenessDetector Class =============

class LivenessDetector:
    def __init__(self, supabase_manager):
        self.ear_threshold = EAR_THRESHOLD
        self.mar_threshold = MAR_THRESHOLD
        self.user_states = defaultdict(UserState)
        self.supabase_manager = supabase_manager
       

    def get_user_state(self, user_id):
        return self.user_states[user_id]

    def reset_user_counters(self, user_id):
        if user_id in self.user_states:
            self.user_states[user_id].reset()
        else:
            self.user_states[user_id] = UserState()
        logger.info(f"Reset counters for user: {user_id}")


    def _predict_fas(self, face_crop):
        """Predict face anti-spoofing score"""
        if FAS_MODEL is None or face_crop.size == 0:
            return 0.5
        try:
            import torchvision.transforms as transforms
            from PIL import Image

            # Convert to PIL Image
            from PIL import Image
            face_pil = Image.fromarray(cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB))
            print("face",face_pil)
            # Preprocess: resize, normalize
            preprocess = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                    std=[0.229, 0.224, 0.225])
            ])
            input_tensor = preprocess(face_pil).unsqueeze(0)

            # Inference
            with torch.no_grad():
                output = FAS_MODEL(input_tensor)
                # FIX: Return REAL probability (index 1) instead of FAKE probability (index 0)
                prob = torch.nn.functional.softmax(output, dim=1)[0, 1].item()  # ← Changed from [0, 0] to [0, 1]
            
            print("Real probability:", prob)
            return prob
            
        except Exception as e:
            logger.error(f"ResNet18 prediction error: {e}")
            return 0.5

    def _detect_head_movement(self, landmarks, user_state):
        if not landmarks or 'nose_tip' not in landmarks:
            return False
        nose_tip = landmarks['nose_tip'][2]
        if user_state.previous_head_pose is None:
            user_state.previous_head_pose = nose_tip
            return False
        movement = np.linalg.norm(np.array(nose_tip) - np.array(user_state.previous_head_pose))
        user_state.previous_head_pose = nose_tip
        if movement > 15:
            logger.info(f"Head movement detected: {movement:.2f}")
            return True
        return False

    def process_frame_for_user(self, frame, user_id):
        """Enhanced process_frame_for_user with complete debugging"""
        
        # ===== CONFIGURABLE THRESHOLDS =====
        REAL_SCORE_THRESHOLD = 0.2
        MIN_BLINKS = 3
        MIN_MOUTH_OPENS = 2  
        MIN_HEAD_MOVEMENTS = 2
        
        # ===== INITIALIZATION CHECKS =====
        if MTCNN_MODEL is None:
            return {
                "success": False,
                "error": "MTCNN model not initialized",
                "face_detected": False,
                "blink_count": 0,
                "mouth_open_count": 0,
                "head_movement_count": 0,
                "face_real_score": 0.0,
                "liveness_passed": False
            }

        user_state = self.get_user_state(user_id)
        if not hasattr(user_state, "reference_photo_saved"):
            user_state.reference_photo_saved = False
        user_state.frames_processed += 1

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        boxes, probs = MTCNN_MODEL.detect(rgb_frame)

        face_detected = False
        real_score = 0.0
        current_eye_closed = False
        current_mouth_open = False
        ear = None
        mar = None

        if boxes is not None and len(boxes) > 0:
            face_detected = True
            x1, y1, x2, y2 = [int(v) for v in boxes[0]]
            h, w = rgb_frame.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            face_crop = rgb_frame[y1:y2, x1:x2]
            cv2.imwrite("debug_face.jpg", cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR))
            logger.info("Saved debug face crop as debug_face.jpg")


            if face_crop.size > 0:
                logger.info(f"Face crop shape: {face_crop.shape}")
                real_score = self._predict_fas(face_crop)
                logger.info(f"🎯 Anti-spoofing score: {real_score:.3f} (threshold: {REAL_SCORE_THRESHOLD})")

            face_locations = [(y1, x2, y2, x1)]
            landmarks = face_recognition.face_landmarks(rgb_frame, face_locations)
            if landmarks:
                lmarks = landmarks[0]
                ear = get_eye_aspect_ratio(lmarks)
                mar = get_mouth_aspect_ratio(lmarks)
                if ear is not None and mar is not None:
                    logger.info(f"EAR: {ear:.3f} (threshold: {self.ear_threshold}) | MAR: {mar:.3f} (threshold: {self.mar_threshold})")
                current_eye_closed = ear is not None and ear <= self.ear_threshold
                current_mouth_open = mar is not None and mar > self.mar_threshold

                if current_eye_closed and not user_state.last_eye_state:
                    user_state.eye_closed_frames = 1
                elif current_eye_closed and user_state.last_eye_state:
                    user_state.eye_closed_frames += 1
                elif not current_eye_closed and user_state.last_eye_state:
                    if not user_state.blinks_completed:
                        user_state.total_blinks += 1
                        logger.info(f"User {user_id}: Blink detected! Total: {user_state.total_blinks}")
                        if user_state.total_blinks >= 3:
                            user_state.blinks_completed = True
                    user_state.eye_closed_frames = 0
                user_state.last_eye_state = current_eye_closed

                if current_mouth_open and not user_state.last_mouth_state:
                    user_state.mouth_open_frames = 1
                elif current_mouth_open and user_state.last_mouth_state:
                    user_state.mouth_open_frames += 1
                elif not current_mouth_open and user_state.last_mouth_state:
                    if not user_state.mouth_completed:
                        user_state.total_mouth_open += 1
                        logger.info(f"✨ User {user_id}: Mouth open detected! Total: {user_state.total_mouth_open}/{MIN_MOUTH_OPENS}")
                        if user_state.total_mouth_open >= MIN_MOUTH_OPENS:
                            user_state.mouth_completed = True
                    user_state.mouth_open_frames = 0
                user_state.last_mouth_state = current_mouth_open

                if self._detect_head_movement(lmarks, user_state):
                    if not user_state.head_completed:
                        user_state.total_head_movements += 1
                        logger.info(f"User {user_id}: Head movement detected! Total: {user_state.total_head_movements}")
                        if user_state.total_head_movements >= 2:
                            user_state.head_completed = True

        logger.info(f"User {user_id} - Frame {user_state.frames_processed}: "
                    f"Eyes {'closed' if current_eye_closed else 'open'}, "
                    f"Mouth {'open' if current_mouth_open else 'closed'}, "
                    f"Score: {real_score:.2f}")

        liveness_passed = (
            user_state.total_blinks >= 3 and
            user_state.total_mouth_open >= 2 and
            real_score > 0.45 and
            user_state.total_head_movements >= 2
        )

        return {
            "success": True,
            "face_detected": face_detected,
            "blink_count": user_state.total_blinks,
            "mouth_open_count": user_state.total_mouth_open,
            "head_movement_count": min(user_state.total_head_movements, 2),
            "face_real_score": real_score,
            "liveness_passed": liveness_passed,
            "current_state": {
                "eyes_closed": current_eye_closed,
                "mouth_open": current_mouth_open,
                "frames_processed": user_state.frames_processed
            }
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

# def process_frame_api(face_image_b64: str, user_id: str = None, reset_counters: bool = False):
#     try:
#         if user_id is None:
#             user_id = "default_user"
#         if reset_counters:
#             DETECTOR.reset_user_counters(user_id)
#         frame = process_base64_image(face_image_b64)
#         result = DETECTOR.process_frame_for_user(frame, user_id)
#         return result
#     except Exception as e:
#         logger.error(f"process_frame_api error: {e}")
#         return {
#             "success": False,
#             "error": str(e),
#             "face_detected": False,
#             "blink_count": 0,
#             "mouth_open_count": 0,
#             "head_movement_count": 0,
#             "face_real_score": 0.0,
#             "liveness_passed": False
#         }