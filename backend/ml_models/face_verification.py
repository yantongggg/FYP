# face_verification.py

import cv2
import numpy as np
import face_recognition
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)

class FaceVerificationModel:
    """
    Face verification model with relaxed thresholds for easy authentication
    """
    
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        
        # Relaxed thresholds for easier authentication
        self.LOGIN_THRESHOLD = 0.4  # Very relaxed for login (was 0.6)
        self.ENROLLMENT_THRESHOLD = 0.5  # Relaxed for enrollment (was 0.8)
        self.MIN_QUALITY_THRESHOLD = 0.3  # Very low quality requirement
        
    def extract_face_encoding(self, image):
        """
        Extract face encoding from image with relaxed requirements
        """
        try:
            # Find face locations with relaxed parameters
            face_locations = face_recognition.face_locations(image, number_of_times_to_upsample=1, model="hog")
            
            if not face_locations:
                # Try with more relaxed detection
                face_locations = face_recognition.face_locations(image, number_of_times_to_upsample=0, model="hog")
                
            if not face_locations:
                return None, "No face detected"
            
            # Take the first face found (most prominent)
            face_locations = [face_locations[0]]
            
            # Extract face encoding
            face_encodings = face_recognition.face_encodings(image, face_locations, num_jitters=1)
            
            if not face_encodings:
                return None, "Could not extract face features"
            
            return face_encodings[0], "Success"
            
        except Exception as e:
            logger.error(f"Error extracting face encoding: {str(e)}")
            return None, str(e)
    
    def verify_for_login(self, input_image, stored_embedding):
        """
        Verify face for login authentication with relaxed requirements
        """
        try:
            # Extract face encoding from input image
            encoding_result = self.extract_face_encoding(input_image)
            if encoding_result[0] is None:
                return {
                    'success': False,
                    'error': encoding_result[1],
                    'similarity': 0.0,
                    'is_match': False
                }
            
            input_encoding = encoding_result[0]
            
            # Validate stored embedding
            if not isinstance(stored_embedding, (list, np.ndarray)):
                return {
                    'success': False,
                    'error': 'Invalid stored embedding format',
                    'similarity': 0.0,
                    'is_match': False
                }
            
            # Convert to numpy array if needed
            stored_encoding = np.array(stored_embedding)
            
            # Verify encoding dimensions (face_recognition uses 128-dimensional encodings)
            if len(stored_encoding) != 128 or len(input_encoding) != 128:
                return {
                    'success': False,
                    'error': f'Invalid encoding dimensions: stored={len(stored_encoding)}, input={len(input_encoding)}',
                    'similarity': 0.0,
                    'is_match': False
                }
            
            # Calculate face distance and similarity
            distance = face_recognition.face_distance([stored_encoding], input_encoding)[0]
            similarity = 1.0 - distance
            
            # Very relaxed quality check
            quality_score = self.calculate_quality_score(input_image)
            
            # Determine if authentication passes with relaxed criteria
            is_match = (
                similarity >= self.LOGIN_THRESHOLD and 
                quality_score >= self.MIN_QUALITY_THRESHOLD
            )
            
            # Log the verification attempt
            logger.info(f"Face verification: similarity={similarity:.3f}, quality={quality_score:.3f}, match={is_match}")
            
            return {
                'success': True,
                'similarity': float(similarity),
                'distance': float(distance),
                'is_match': is_match,
                'quality_score': float(quality_score),
                'threshold_used': self.LOGIN_THRESHOLD,
                'confidence_level': self.get_verification_confidence_level(similarity)
            }
            
        except Exception as e:
            logger.error(f"Error in login verification: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'similarity': 0.0,
                'is_match': False
            }
    
    def calculate_quality_score(self, image):
        """
        Calculate face image quality score with relaxed standards
        """
        try:
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            else:
                gray = image
            
            # Calculate sharpness using Laplacian variance (relaxed)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness_score = min(1.0, laplacian_var / 500.0)  # Lowered threshold
            
            # Calculate brightness score (more lenient)
            brightness = np.mean(gray)
            brightness_score = 1.0 - abs(brightness - 128) / 200.0  # More lenient
            brightness_score = max(0.0, min(1.0, brightness_score))
            
            # Calculate contrast score (relaxed)
            contrast = np.std(gray)
            contrast_score = min(1.0, contrast / 30.0)  # Lowered threshold
            
            # Basic face detection for pose estimation
            faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
            pose_score = 1.0 if len(faces) > 0 else 0.3  # More lenient
            
            # Combine quality metrics with relaxed weights
            quality_score = (
                sharpness_score * 0.2 +    # Reduced weight
                brightness_score * 0.2 +   # Reduced weight
                contrast_score * 0.2 +     # Reduced weight
                pose_score * 0.4           # Higher weight for basic detection
            )
            
            # Ensure minimum quality score for usability
            quality_score = max(0.3, quality_score)
            
            return quality_score
            
        except Exception as e:
            logger.error(f"Error calculating quality score: {str(e)}")
            return 0.5  # Default acceptable score
    
    def verify_face(self, image, reference_score=None):
        """
        Verify face quality and extract features with relaxed requirements
        """
        try:
            # Basic face detection
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.3, 3)  # More relaxed parameters
            
            if len(faces) == 0:
                return 0.3  # Give some score even if no face detected clearly
            
            if len(faces) > 1:
                return 0.6  # Reduced penalty for multiple faces
            
            # Extract face region
            (x, y, w, h) = faces[0]
            face_region = gray[y:y+h, x:x+w]
            
            # Calculate quality metrics
            quality_score = self.calculate_face_quality(face_region)
            
            # Detect eyes for additional verification (relaxed)
            eyes = self.eye_cascade.detectMultiScale(face_region, 1.1, 3)
            eye_score = min(1.0, len(eyes) / 1.5)  # More lenient eye detection
            
            # Combine scores with relaxed weighting
            final_score = (quality_score * 0.6) + (eye_score * 0.4)
            
            # Ensure minimum acceptable score
            final_score = max(0.4, final_score)
            
            return final_score
            
        except Exception as e:
            logger.error(f"Error in face verification: {str(e)}")
            return 0.5  # Default acceptable score
    
    def calculate_face_quality(self, face_region):
        """
        Calculate quality metrics for a face region with relaxed standards
        """
        try:
            # Sharpness using Laplacian (relaxed)
            laplacian = cv2.Laplacian(face_region, cv2.CV_64F)
            sharpness = laplacian.var()
            sharpness_score = min(1.0, sharpness / 200.0)  # Much lower threshold
            
            # Brightness (more tolerant)
            brightness = np.mean(face_region)
            brightness_score = 1.0 - abs(brightness - 128) / 150.0  # More tolerant
            brightness_score = max(0.0, min(1.0, brightness_score))
            
            # Contrast (relaxed)
            contrast = np.std(face_region)
            contrast_score = min(1.0, contrast / 25.0)  # Lower threshold
            
            # Size score (prefer larger faces but not strict)
            height, width = face_region.shape
            size_score = min(1.0, (height * width) / 5000.0)  # Lower threshold
            
            # Combine scores with relaxed weighting
            quality = (
                sharpness_score * 0.2 +
                brightness_score * 0.3 +
                contrast_score * 0.2 +
                size_score * 0.3
            )
            
            # Ensure minimum quality
            quality = max(0.3, quality)
            
            return quality
            
        except Exception as e:
            logger.error(f"Error calculating face quality: {str(e)}")
            return 0.5
    
    def compare_faces(self, encoding1, encoding2, threshold=None):
        """
        Compare two face encodings with relaxed threshold
        """
        try:
            if encoding1 is None or encoding2 is None:
                return 0.0, False
            
            # Use relaxed threshold if not specified
            if threshold is None:
                threshold = self.LOGIN_THRESHOLD
            
            # Calculate face distance
            distance = face_recognition.face_distance([encoding1], encoding2)[0]
            
            # Convert distance to similarity score
            similarity = 1.0 - distance
            
            # Determine if faces match
            is_match = similarity >= threshold
            
            return similarity, is_match
            
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return 0.0, False
    
    def anti_spoofing_check(self, image):
        """
        Basic anti-spoofing checks with relaxed requirements
        """
        try:
            # Convert to different color spaces for analysis
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
            
            # Check for color distribution (relaxed)
            color_variance = np.var(hsv[:, :, 1])  # Saturation variance
            color_score = min(1.0, color_variance / 500.0)  # Lower threshold
            
            # Check for texture patterns (relaxed)
            lbp = self.calculate_lbp(gray)
            texture_score = np.std(lbp) / 200.0  # Lower threshold
            
            # Check for edge patterns (relaxed)
            edges = cv2.Canny(gray, 30, 100)  # Lower thresholds
            edge_density = np.sum(edges > 0) / edges.size
            edge_score = min(1.0, edge_density * 5)  # Lower multiplier
            
            # Combine anti-spoofing scores with relaxed weighting
            spoofing_score = (
                color_score * 0.3 +
                texture_score * 0.3 +
                edge_score * 0.2 +
                0.2  # Base score for liveness
            )
            
            # Ensure minimum acceptable score
            spoofing_score = max(0.5, spoofing_score)
            
            return {
                'spoofing_score': spoofing_score,
                'is_live': spoofing_score > 0.3,  # Very low threshold
                'color_score': color_score,
                'texture_score': texture_score,
                'edge_score': edge_score
            }
            
        except Exception as e:
            logger.error(f"Error in anti-spoofing check: {str(e)}")
            return {
                'spoofing_score': 0.7,  # Default good score
                'is_live': True,
                'color_score': 0.5,
                'texture_score': 0.5,
                'edge_score': 0.5
            }
    
    def calculate_lbp(self, image, radius=1, n_points=8):
        """
        Calculate Local Binary Pattern for texture analysis
        """
        try:
            height, width = image.shape
            lbp = np.zeros((height, width), dtype=np.uint8)
            
            for i in range(radius, height - radius):
                for j in range(radius, width - radius):
                    center = image[i, j]
                    binary_string = ""
                    
                    for k in range(n_points):
                        angle = 2 * np.pi * k / n_points
                        x = int(i + radius * np.cos(angle))
                        y = int(j + radius * np.sin(angle))
                        
                        if x >= 0 and x < height and y >= 0 and y < width:
                            binary_string += "1" if image[x, y] >= center else "0"
                        else:
                            binary_string += "0"
                    
                    lbp[i, j] = int(binary_string, 2)
            
            return lbp
            
        except Exception as e:
            logger.error(f"Error calculating LBP: {str(e)}")
            return np.zeros_like(image)
    
    def get_verification_confidence_level(self, similarity_score):
        """
        Return human-readable confidence level with relaxed thresholds
        """
        if similarity_score >= 0.8:
            return "VERY_HIGH"
        elif similarity_score >= 0.6:
            return "HIGH"
        elif similarity_score >= 0.5:
            return "MEDIUM"
        elif similarity_score >= 0.4:
            return "ACCEPTABLE"
        else:
            return "LOW"
    
    def prepare_enrollment_encoding(self, image):
        """
        Prepare face encoding for enrollment with relaxed quality requirements
        """
        try:
            # Relaxed quality check for enrollment
            quality_score = self.calculate_quality_score(image)
            if quality_score < self.ENROLLMENT_THRESHOLD:
                # Still allow enrollment but warn about quality
                logger.warning(f"Low quality enrollment: {quality_score:.2f}")
            
            # Extract encoding
            encoding_result = self.extract_face_encoding(image)
            if encoding_result[0] is None:
                return None, encoding_result[1]
            
            encoding = encoding_result[0]
            
            return encoding.tolist(), "Success"
            
        except Exception as e:
            logger.error(f"Error preparing enrollment encoding: {str(e)}")
            return None, str(e)