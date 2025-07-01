import cv2
import numpy as np
import face_recognition
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)

class FaceVerificationModel:
    """
    Face verification model using face_recognition library and custom enhancements
    """
    
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        
    def extract_face_encoding(self, image):
        """
        Extract face encoding from image
        """
        try:
            # Find face locations
            face_locations = face_recognition.face_locations(image)
            
            if not face_locations:
                return None, "No face detected"
            
            if len(face_locations) > 1:
                return None, "Multiple faces detected"
            
            # Extract face encoding
            face_encodings = face_recognition.face_encodings(image, face_locations)
            
            if not face_encodings:
                return None, "Could not extract face features"
            
            return face_encodings[0], "Success"
            
        except Exception as e:
            logger.error(f"Error extracting face encoding: {str(e)}")
            return None, str(e)
    
    def verify_face(self, image, reference_score=None):
        """
        Verify face quality and extract features
        """
        try:
            # Basic face detection
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            
            if len(faces) == 0:
                return 0.0
            
            if len(faces) > 1:
                return 0.2  # Penalty for multiple faces
            
            # Extract face region
            (x, y, w, h) = faces[0]
            face_region = gray[y:y+h, x:x+w]
            
            # Calculate quality metrics
            quality_score = self.calculate_face_quality(face_region)
            
            # Detect eyes for additional verification
            eyes = self.eye_cascade.detectMultiScale(face_region)
            eye_score = min(1.0, len(eyes) / 2.0)  # Expect 2 eyes
            
            # Combine scores
            final_score = (quality_score * 0.7) + (eye_score * 0.3)
            
            return final_score
            
        except Exception as e:
            logger.error(f"Error in face verification: {str(e)}")
            return 0.0
    
    def calculate_quality_score(self, image):
        """
        Calculate overall face image quality score
        """
        try:
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            else:
                gray = image
            
            # Calculate sharpness using Laplacian variance
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness_score = min(1.0, laplacian_var / 1000.0)
            
            # Calculate brightness score
            brightness = np.mean(gray)
            brightness_score = 1.0 - abs(brightness - 128) / 128.0
            
            # Calculate contrast score
            contrast = np.std(gray)
            contrast_score = min(1.0, contrast / 64.0)
            
            # Detect face landmarks for pose estimation
            face_landmarks = face_recognition.face_landmarks(image)
            pose_score = 1.0 if face_landmarks else 0.5
            
            # Combine quality metrics
            quality_score = (
                sharpness_score * 0.3 +
                brightness_score * 0.2 +
                contrast_score * 0.2 +
                pose_score * 0.3
            )
            
            return quality_score
            
        except Exception as e:
            logger.error(f"Error calculating quality score: {str(e)}")
            return 0.5
    
    def calculate_face_quality(self, face_region):
        """
        Calculate quality metrics for a face region
        """
        try:
            # Sharpness using Laplacian
            laplacian = cv2.Laplacian(face_region, cv2.CV_64F)
            sharpness = laplacian.var()
            sharpness_score = min(1.0, sharpness / 500.0)
            
            # Brightness
            brightness = np.mean(face_region)
            brightness_score = 1.0 - abs(brightness - 128) / 128.0
            
            # Contrast
            contrast = np.std(face_region)
            contrast_score = min(1.0, contrast / 50.0)
            
            # Size score (prefer larger faces)
            height, width = face_region.shape
            size_score = min(1.0, (height * width) / 10000.0)
            
            # Combine scores
            quality = (
                sharpness_score * 0.4 +
                brightness_score * 0.2 +
                contrast_score * 0.2 +
                size_score * 0.2
            )
            
            return quality
            
        except Exception as e:
            logger.error(f"Error calculating face quality: {str(e)}")
            return 0.5
    
    def compare_faces(self, encoding1, encoding2, threshold=0.6):
        """
        Compare two face encodings
        """
        try:
            if encoding1 is None or encoding2 is None:
                return 0.0, False
            
            # Calculate face distance
            distance = face_recognition.face_distance([encoding1], encoding2)[0]
            
            # Convert distance to similarity score
            similarity = 1.0 - distance
            
            # Determine if faces match
            is_match = distance <= threshold
            
            return similarity, is_match
            
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return 0.0, False
    
    def detect_face_landmarks(self, image):
        """
        Detect facial landmarks for pose and expression analysis
        """
        try:
            landmarks = face_recognition.face_landmarks(image)
            
            if not landmarks:
                return None
            
            # Extract key landmark points
            landmark_dict = landmarks[0]
            
            # Calculate pose metrics
            pose_metrics = self.calculate_pose_metrics(landmark_dict)
            
            return {
                'landmarks': landmark_dict,
                'pose_metrics': pose_metrics
            }
            
        except Exception as e:
            logger.error(f"Error detecting face landmarks: {str(e)}")
            return None
    
    def calculate_pose_metrics(self, landmarks):
        """
        Calculate head pose metrics from landmarks
        """
        try:
            # Get key points
            nose_tip = landmarks['nose_tip'][2]
            left_eye = np.mean(landmarks['left_eye'], axis=0)
            right_eye = np.mean(landmarks['right_eye'], axis=0)
            
            # Calculate eye distance
            eye_distance = np.linalg.norm(np.array(left_eye) - np.array(right_eye))
            
            # Calculate nose position relative to eyes
            eye_center = (np.array(left_eye) + np.array(right_eye)) / 2
            nose_offset = np.array(nose_tip) - eye_center
            
            # Calculate pose angles (simplified)
            yaw = nose_offset[0] / eye_distance  # Left-right rotation
            pitch = nose_offset[1] / eye_distance  # Up-down rotation
            
            # Calculate pose quality (prefer frontal poses)
            pose_quality = 1.0 - (abs(yaw) + abs(pitch)) / 2.0
            pose_quality = max(0.0, min(1.0, pose_quality))
            
            return {
                'yaw': yaw,
                'pitch': pitch,
                'eye_distance': eye_distance,
                'pose_quality': pose_quality
            }
            
        except Exception as e:
            logger.error(f"Error calculating pose metrics: {str(e)}")
            return {
                'yaw': 0.0,
                'pitch': 0.0,
                'eye_distance': 0.0,
                'pose_quality': 0.5
            }
    
    def anti_spoofing_check(self, image):
        """
        Basic anti-spoofing checks
        """
        try:
            # Convert to different color spaces for analysis
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
            
            # Check for color distribution (photos tend to have limited color range)
            color_variance = np.var(hsv[:, :, 1])  # Saturation variance
            color_score = min(1.0, color_variance / 1000.0)
            
            # Check for texture patterns
            lbp = self.calculate_lbp(gray)
            texture_score = np.std(lbp) / 255.0
            
            # Check for edge patterns
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            edge_score = min(1.0, edge_density * 10)
            
            # Combine anti-spoofing scores
            spoofing_score = (
                color_score * 0.4 +
                texture_score * 0.3 +
                edge_score * 0.3
            )
            
            return {
                'spoofing_score': spoofing_score,
                'is_live': spoofing_score > 0.5,
                'color_score': color_score,
                'texture_score': texture_score,
                'edge_score': edge_score
            }
            
        except Exception as e:
            logger.error(f"Error in anti-spoofing check: {str(e)}")
            return {
                'spoofing_score': 0.5,
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