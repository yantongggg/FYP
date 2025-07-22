# ml_models/face_verification.py - FIXED VERSION

import cv2
import numpy as np
import face_recognition
import base64
import logging

logger = logging.getLogger(__name__)

class FaceVerificationModel:
    
    def __init__(self):
        # Very relaxed thresholds for easy authentication
        self.LOGIN_THRESHOLD = 0.55  # Very relaxed threshold
        
    def extract_face_encoding_from_base64(self, base64_image):
        try:
            # Clean base64 string
            if ',' in base64_image:
                base64_image = base64_image.split(',')[1]
            
            # Decode image
            img_data = base64.b64decode(base64_image)
            nparr = np.frombuffer(img_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return None, "Failed to decode image"
            
            # Convert BGR to RGB (OpenCV uses BGR, face_recognition uses RGB)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Find face locations with relaxed parameters
            face_locations = face_recognition.face_locations(
                rgb_image, 
                number_of_times_to_upsample=1, 
                model="hog"
            )
            
            if not face_locations:
                logger.warning("No face detected in image")
                return None, "No face detected"
            
            # Take the first/largest face
            face_locations = [face_locations[0]]
            
            # Extract face encoding
            face_encodings = face_recognition.face_encodings(
                rgb_image, 
                face_locations, 
                num_jitters=1
            )
            
            if not face_encodings:
                return None, "Could not extract face features"
            
            # Return as list for consistency
            return face_encodings[0].tolist(), "Success"
            
        except Exception as e:
            logger.error(f"Error extracting face encoding: {str(e)}")
            return None, str(e)
    
    def compare_faces(self, stored_embedding, current_face_base64):
        try:
            logger.info("Starting face comparison...")
            
            # Validate stored embedding
            if not stored_embedding or not isinstance(stored_embedding, (list, np.ndarray)):
                logger.error("Invalid stored embedding format")
                return 0.0, False
            
            # Convert stored embedding to numpy array
            stored_encoding = np.array(stored_embedding, dtype=np.float64)
            
            if len(stored_encoding) != 128:
                logger.error(f"Invalid stored encoding dimension: {len(stored_encoding)}")
                return 0.0, False
            
            # Extract encoding from current image
            current_encoding, error_msg = self.extract_face_encoding_from_base64(current_face_base64)
            
            if current_encoding is None:
                logger.error(f"Failed to extract current encoding: {error_msg}")
                return 0.0, False
            
            # Convert current encoding to numpy array
            current_encoding = np.array(current_encoding, dtype=np.float64)
            
            if len(current_encoding) != 128:
                logger.error(f"Invalid current encoding dimension: {len(current_encoding)}")
                return 0.0, False
            
            # Calculate face distance using face_recognition library
            distance = face_recognition.face_distance([stored_encoding], current_encoding)[0]
            
            # Convert distance to similarity (0-1 scale)
            similarity = 1.0 - distance
            
            # Determine if faces match using relaxed threshold
            is_match = similarity >= self.LOGIN_THRESHOLD
            
            logger.info(f"Face comparison result: similarity={similarity:.3f}, threshold={self.LOGIN_THRESHOLD}, match={is_match}")
            
            return float(similarity), is_match
            
        except Exception as e:
            logger.error(f"Error in face comparison: {str(e)}", exc_info=True)
            return 0.0, False
    
    def verify_for_login(self, current_face_base64, stored_embedding):
        """
        FIXED: Main verification method for login
        """
        try:
            similarity, is_match = self.compare_faces(stored_embedding, current_face_base64)
            
            return {
                'success': is_match,
                'similarity': similarity,
                'threshold_used': self.LOGIN_THRESHOLD,
                'is_match': is_match,
                'confidence_level': self.get_confidence_level(similarity)
            }
            
        except Exception as e:
            logger.error(f"  Login verification error: {str(e)}")
            return {
                'success': False,
                'similarity': 0.0,
                'threshold_used': self.LOGIN_THRESHOLD,
                'is_match': False,
                'error': str(e)
            }
    
    def get_confidence_level(self, similarity_score):
        """Return human-readable confidence level"""
        if similarity_score >= 0.8:
            return "VERY_HIGH"
        elif similarity_score >= 0.6:
            return "HIGH"
        elif similarity_score >= 0.5:
            return "MEDIUM"
        elif similarity_score >= 0.35:
            return "ACCEPTABLE"
        else:
            return "LOW"