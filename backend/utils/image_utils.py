# utils/image_utils.py
import base64
import cv2
import numpy as np
from PIL import Image
from io import BytesIO

def decode_base64_image(image_data):
    """
    Decode base64 image data to numpy array
    """
    try:
        # Remove data:image header if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        
        # Convert to PIL Image
        pil_image = Image.open(BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Convert to numpy array
        numpy_image = np.array(pil_image)
        
        return numpy_image
    except Exception as e:
        raise ValueError(f"Failed to decode base64 image: {str(e)}")

def preprocess_face_image(image):
    """
    Preprocess image for face recognition
    """
    try:
        # Ensure image is in correct format
        if len(image.shape) == 3:
            # Convert BGR to RGB if needed
            if image.shape[2] == 3:
                # Check if it's BGR (OpenCV default) and convert to RGB
                # Simple heuristic: if blue channel has higher values, it's likely BGR
                b_mean = np.mean(image[:, :, 0])
                r_mean = np.mean(image[:, :, 2])
                if b_mean > r_mean * 1.1:  # Likely BGR
                    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Resize if too large (for performance)
        height, width = image.shape[:2]
        max_size = 1024
        if max(height, width) > max_size:
            scale = max_size / max(height, width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        return image
    except Exception as e:
        raise ValueError(f"Failed to preprocess image: {str(e)}")

# ml_models/face_verification.py (if it doesn't exist)
import cv2
import numpy as np
import face_recognition
from typing import Tuple, Optional

class FaceVerificationModel:
    def __init__(self):
        """Initialize the face verification model"""
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    def extract_face_encoding(self, image) -> Tuple[Optional[np.ndarray], str]:
        """
        Extract face encoding from image
        Returns: (encoding, message)
        """
        try:
            face_encodings = face_recognition.face_encodings(image)
            
            if len(face_encodings) == 0:
                return None, "No face detected in image"
            
            if len(face_encodings) > 1:
                return None, "Multiple faces detected. Only one face allowed."
            
            return face_encodings[0], "Face encoding extracted successfully"
        except Exception as e:
            return None, f"Error extracting face encoding: {str(e)}"
    
    def calculate_quality_score(self, image) -> float:
        """
        Calculate image quality score
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            
            # Calculate sharpness using Laplacian variance
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness_score = min(1.0, laplacian_var / 500.0)
            
            # Calculate brightness
            brightness = np.mean(gray) / 255.0
            brightness_score = 1.0 - abs(brightness - 0.5) * 2
            
            # Calculate contrast
            contrast = np.std(gray) / 255.0
            contrast_score = min(1.0, contrast * 4)
            
            # Face detection score
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            face_score = 1.0 if len(faces) == 1 else 0.5 if len(faces) > 0 else 0.0
            
            # Weighted average
            quality_score = (
                sharpness_score * 0.3 +
                brightness_score * 0.2 +
                contrast_score * 0.2 +
                face_score * 0.3
            )
            
            return quality_score
        except Exception as e:
            return 0.5
    
    def verify_face(self, image, reference_score=0.5) -> float:
        """
        Verify face quality using ML model
        """
        try:
            # Basic quality assessment
            quality = self.calculate_quality_score(image)
            
            # Additional checks
            face_locations = face_recognition.face_locations(image)
            face_landmarks = face_recognition.face_landmarks(image)
            
            if len(face_locations) == 1 and len(face_landmarks) == 1:
                landmark_score = 0.3
            else:
                landmark_score = 0.0
            
            # Combine scores
            final_score = (quality * 0.7) + (landmark_score) + (reference_score * 0.1)
            
            return min(1.0, final_score)
        except Exception as e:
            return 0.5