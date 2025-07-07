from flask import Blueprint, request, jsonify, current_app
import cv2
import numpy as np
import base64
from datetime import datetime
import logging
import face_recognition
from io import BytesIO
from PIL import Image
import json
import os
from ml_models.face_verification import FaceVerificationModel
from utils.image_utils import decode_base64_image, preprocess_face_image
from utils.supabase_client import supabase_client
from utils.storage_utils import BiometricStorage
from utils.logger import setup_logger
from utils.ocr_utils import MyKadOCR  # Import the existing OCR utility

# Create blueprint instead of importing app
ekyc_bp = Blueprint('ekyc', __name__)
logger = setup_logger(__name__)

# Initialize models
try:
    face_model = FaceVerificationModel()
except ImportError:
    logger.warning("Face verification model not available")
    face_model = None

try:
    mykad_ocr = MyKadOCR()  # Initialize the MyKad OCR processor
except ImportError:
    logger.warning("MyKad OCR not available - using mock")
    class MockMyKadOCR:
        def process_mykad_front(self, image):
            return {
                'success': True,
                'extracted_info': {'ic_number': '123456-78-9012'},
                'authenticity': {'authenticity_score': 0.8, 'found_keywords': ['MALAYSIA']}
            }
        def process_mykad_back(self, image):
            return {
                'success': True,
                'ic_number_back': '123456-78-9012',
                'security_features': {'hologram': True, 'microtext': True}
            }
    mykad_ocr = MockMyKadOCR()

def validate_ic_image_opencv(image: np.ndarray) -> dict:
    """
    Validate image using OpenCV to ensure it's a clear IC-like document
    Checks: resolution, aspect ratio, corners visibility, clarity
    """
    try:
        height, width = image.shape[:2]
        
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # 1. Check minimum resolution (800x500 pixels)
        # min_width, min_height = 800, 500
        # has_sufficient_resolution = width >= min_width and height >= min_height
        
        # 2. Check aspect ratio (Malaysian IC is approximately 85.6mm × 54mm ≈ 1.585:1)
        aspect_ratio = width / height
        expected_ratio = 1.585
        aspect_ratio_tolerance = 0.3
        has_valid_aspect_ratio = abs(aspect_ratio - expected_ratio) <= aspect_ratio_tolerance
        
        # 3. Check image sharpness using Laplacian variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_sharp = laplacian_var > 100  # Threshold for sharpness
        
        # 4. Check all 4 corners are visible using edge detection
        edges = cv2.Canny(gray, 50, 150)
        
        # Define corner regions (10% of image size)
        corner_size = min(width, height) // 10
        corners = {
            'top_left': edges[0:corner_size, 0:corner_size],
            'top_right': edges[0:corner_size, width-corner_size:width],
            'bottom_left': edges[height-corner_size:height, 0:corner_size],
            'bottom_right': edges[height-corner_size:height, width-corner_size:width]
        }
        
        # Check if corners have sufficient edges
        corner_scores = {}
        all_corners_visible = True
        
        for corner_name, corner_region in corners.items():
            edge_pixels = np.sum(corner_region > 0)
            total_pixels = corner_region.size
            edge_ratio = edge_pixels / total_pixels if total_pixels > 0 else 0
            corner_scores[corner_name] = edge_ratio
            
            # If less than 5% edges, corner might be cut off
            if edge_ratio < 0.05:
                all_corners_visible = False
        
        # 5. Check brightness and contrast
        brightness = np.mean(gray)
        contrast = np.std(gray)
        has_good_brightness = 50 < brightness < 200
        has_good_contrast = contrast > 30
        
        # 6. Detect if it's likely a card/document (rectangular shape)
        # Find contours and look for large rectangular shapes
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        has_card_shape = False
        
        for contour in contours:
            # Approximate contour to polygon
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Check if it's a quadrilateral with significant area
            if len(approx) == 4:
                area = cv2.contourArea(contour)
                image_area = width * height
                # Card should occupy at least 30% of the image
                if area > 0.3 * image_area:
                    has_card_shape = True
                    break
        
        # Calculate overall validation score
        validation_checks = {
            # 'resolution': has_sufficient_resolution,
            'aspect_ratio': has_valid_aspect_ratio,
            'sharpness': is_sharp,
            'corners_visible': all_corners_visible,
            'brightness': has_good_brightness,
            'contrast': has_good_contrast,
            'card_shape': has_card_shape
        }
        
        # Image is valid if it passes most checks
        passed_checks = sum(validation_checks.values())
        is_valid = passed_checks >= 5  # At least 5 out of 6 checks
        
        return {
            'is_valid': is_valid,
            'validation_score': passed_checks / 6.0,
            'checks': validation_checks,
            'metrics': {
                # 'resolution': f"{width}x{height}",
                'aspect_ratio': round(aspect_ratio, 3),
                'sharpness_score': round(laplacian_var, 2),
                'brightness': round(brightness, 2),
                'contrast': round(contrast, 2)
            },
            'corner_scores': corner_scores
        }
        
    except Exception as e:
        logger.error(f"Error validating IC image: {str(e)}")
        return {
            'is_valid': False,
            'error': str(e)
        }

def extract_ic_face(image: np.ndarray) -> dict:
    """
    Extract face from IC image using face_recognition or OpenCV
    Returns cropped face image and location
    """
    try:
        # Method 1: Try face_recognition first (more accurate)
        face_locations = face_recognition.face_locations(image)
        
        if face_locations:
            # Get the first face found
            top, right, bottom, left = face_locations[0]
            
            # Add some padding around the face
            padding = 20
            top = max(0, top - padding)
            right = min(image.shape[1], right + padding)
            bottom = min(image.shape[0], bottom + padding)
            left = max(0, left - padding)
            
            # Crop the face
            face_image = image[top:bottom, left:right]
            
            return {
                'success': True,
                'face_image': face_image,
                'location': {'top': top, 'right': right, 'bottom': bottom, 'left': left},
                'method': 'face_recognition'
            }
        
        # Method 2: Fallback to OpenCV Haar Cascade
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        if len(faces) > 0:
            # Get the largest face
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            
            # Add padding
            padding = 20
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(image.shape[1] - x, w + 2 * padding)
            h = min(image.shape[0] - y, h + 2 * padding)
            
            # Crop the face
            face_image = image[y:y+h, x:x+w]
            
            return {
                'success': True,
                'face_image': face_image,
                'location': {'x': x, 'y': y, 'width': w, 'height': h},
                'method': 'opencv_cascade'
            }
        
        return {
            'success': False,
            'error': 'No face detected in IC image'
        }
        
    except Exception as e:
        logger.error(f"Error extracting face from IC: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def compare_faces_local(ic_face_image: np.ndarray, user_id: str) -> dict:
    """
    Compare IC face with stored biometric face (optional - can skip if too complex)
    """
    try:
        # Get stored face encoding
        stored_face_result = supabase_client.table('biometric_data')\
            .select('face_embedding, data')\
            .eq('user_id', user_id)\
            .eq('biometric_type', 'face')\
            .order('capture_timestamp', desc=True)\
            .limit(1)\
            .execute()
        
        if not stored_face_result.data:
            return {
                'match': False,
                'confidence': 0.0,
                'error': 'No stored biometric face data found'
            }
        
        stored_data = stored_face_result.data[0]
        
        # Get stored encoding
        if stored_data.get('face_embedding'):
            stored_encoding = np.array(stored_data['face_embedding'])
        elif stored_data.get('data', {}).get('encoding'):
            stored_encoding = np.array(stored_data['data']['encoding'])
        else:
            return {
                'match': False,
                'confidence': 0.0,
                'error': 'No valid face encoding in stored data'
            }
        
        # Extract encoding from IC face
        ic_face_encodings = face_recognition.face_encodings(ic_face_image)
        
        if not ic_face_encodings:
            return {
                'match': False,
                'confidence': 0.0,
                'error': 'Could not extract face encoding from IC'
            }
        
        ic_face_encoding = ic_face_encodings[0]
        
        # Compare faces
        face_distance = face_recognition.face_distance([stored_encoding], ic_face_encoding)[0]
        similarity = 1.0 - face_distance
        
        # Determine match (threshold: 0.6)
        is_match = similarity >= 0.6
        
        return {
            'match': is_match,
            'confidence': float(similarity),
            'distance': float(face_distance)
        }
        
    except Exception as e:
        logger.error(f"Error comparing faces: {str(e)}")
        return {
            'match': False,
            'confidence': 0.0,
            'error': str(e)
        }

@ekyc_bp.route('/ekyc-mykad-verify', methods=['POST'])
def ekyc_mykad_verify():
    """
    Complete Malaysian IC (MyKad) eKYC verification using local processing
    No external APIs - uses OpenCV for validation and Tesseract for OCR
    """
    try:
        data = request.get_json()
        ic_front_b64 = data.get('ic_front')
        ic_back_b64 = data.get('ic_back')
        user_id = data.get('user_id')
        
        if not all([ic_front_b64, ic_back_b64, user_id]):
            return jsonify({
                'success': False,
                'error': 'IC front, IC back, and user_id are required'
            }), 400
        
        # Decode images
        ic_front_image = decode_base64_image(ic_front_b64)
        ic_back_image = decode_base64_image(ic_back_b64)
        
        # Step 1: Validate image quality using OpenCV
        logger.info(f"🔍 Validating IC images for user {user_id}")
        
        front_validation = validate_ic_image_opencv(ic_front_image)
        back_validation = validate_ic_image_opencv(ic_back_image)
        
        if not front_validation['is_valid']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'IC front image validation failed',
                'details': {
                    'validation_score': front_validation.get('validation_score', 0),
                    'failed_checks': [k for k, v in front_validation.get('checks', {}).items() if not v],
                    'metrics': front_validation.get('metrics', {})
                }
            })
        
        if not back_validation['is_valid']:
            return jsonify({
                'success': False,
                'status': 'fail', 
                'reason': 'IC back image validation failed',
                'details': {
                    'validation_score': back_validation.get('validation_score', 0),
                    'failed_checks': [k for k, v in back_validation.get('checks', {}).items() if not v]
                }
            })
        
        # Step 2: Process front IC with OCR
        logger.info("📝 Processing IC front with Tesseract OCR")
        
        ocr_result = mykad_ocr.process_mykad_front(ic_front_image)
        
        if not ocr_result['success']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': f"OCR processing failed: {ocr_result.get('error', 'Unknown error')}"
            })
        
        extracted_info = ocr_result['extracted_info']
        authenticity = ocr_result['authenticity']
        
        # Validate that we got essential information
        if not extracted_info.get('ic_number'):
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'Could not extract IC number from document'
            })
        
        # Check authenticity based on OCR text
        if not authenticity['is_authentic']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'Document does not appear to be a valid Malaysian IC',
                'details': {
                    'authenticity_score': authenticity['authenticity_score'],
                    'found_keywords': authenticity['found_keywords']
                }
            })
        
        # Step 3: Process back IC for validation
        logger.info("📝 Processing IC back")
        
        back_ocr_result = mykad_ocr.process_mykad_back(ic_back_image)
        
        # Step 4: Extract face from IC (optional)
        face_extraction_result = extract_ic_face(ic_front_image)
        ic_face_url = ''
        # face_match_result = {'match': False, 'confidence': 0.0}
        
        if face_extraction_result['success']:
            logger.info("✅ Face extracted from IC")
            
            # Store the extracted face
            try:
                _, buffer = cv2.imencode('.jpg', cv2.cvtColor(face_extraction_result['face_image'], cv2.COLOR_RGB2BGR))
                face_storage_result = BiometricStorage.store_ekyc_document(
                    user_id,
                    buffer.tobytes(),
                    'ic_face_front'
                )
                ic_face_url = face_storage_result.get('public_url', '')
            except Exception as e:
                logger.error(f"Error storing IC face: {str(e)}")
            
            # Optional: Compare faces (can be skipped if too complex)
            # Uncomment the following lines if you want face comparison
            # face_match_result = compare_faces_local(face_extraction_result['face_image'], user_id)
            # logger.info(f"Face comparison result: {face_match_result}")
        else:
            logger.warning("⚠️ Could not extract face from IC")
        
        # Calculate scores
        authenticity_score = authenticity['authenticity_score']
        validation_score = (front_validation['validation_score'] + back_validation['validation_score']) / 2
        
        # Overall verification based on OCR and validation
        # Since face matching is optional, we base verification on OCR success and document authenticity
        is_verified = (
            authenticity_score >= 0.6 and  # Document appears authentic based on text
            validation_score >= 0.7 and    # Images pass quality checks
            bool(extracted_info.get('ic_number'))  # Essential info extracted
        )
        
        # Store images
        storage_results = store_ekyc_images(user_id, ic_front_b64, ic_back_b64)
        
        # Store eKYC record
        ekyc_records = [
            {
                'user_id': user_id,
                'document_type': 'ic_front',
                'id_document_url': storage_results.get('front_url', ''),
                'ic_face_url': ic_face_url,
                'extracted_info': extracted_info,
                'verification_status': 'verified' if is_verified else 'rejected',
                'verification_score': authenticity_score,
                'document_authenticity_score': authenticity_score,
                'validation_score': validation_score,
                'ocr_confidence': authenticity_score,
                'processing_method': 'local_ocr',
                'created_at': datetime.utcnow().isoformat(),
                'verified_at': datetime.utcnow().isoformat() if is_verified else None
            },
            {
                'user_id': user_id,
                'document_type': 'ic_back',
                'id_document_url': storage_results.get('back_url', ''),  
                'document_authenticity_score': authenticity_score,        
                'validation_score': back_validation['validation_score'], 
                'verification_status': 'verified' if is_verified else 'rejected',
                'created_at': datetime.utcnow().isoformat()
            }
]


        # Insert both into database
        try:
            db_result = supabase_client.table('ekyc_documents').insert(ekyc_records).execute()
        except Exception as e:
            logger.error(f"Database error: {e}")
            db_result = None
        
        logger.info(f"eKYC verification - User: {user_id}, Verified: {is_verified}, "
                   f"Authenticity: {authenticity_score:.3f}, Validation: {validation_score:.3f}")
        
        # Prepare response
        response = {
            'success': True,
            'status': 'pass' if is_verified else 'fail',
            'verified': is_verified,
            'verification_score': round(authenticity_score, 3),
            'extracted_info': extracted_info,
            'document_validation': {
                'front_validation': {
                    'score': round(front_validation['validation_score'], 3),
                    'checks': front_validation['checks'],
                    'metrics': front_validation['metrics']
                },
                'back_validation': {
                    'score': round(back_validation['validation_score'], 3),
                    'checks': back_validation['checks']
                },
                'authenticity': {
                    'score': round(authenticity_score, 3),
                    'keywords_found': authenticity['found_keywords'],
                    'has_ic_format': authenticity['has_ic_format']
                }
            },
            'face_extraction': {
                'extracted': face_extraction_result['success'],
                'method': face_extraction_result.get('method'),
                'face_url': ic_face_url
            },
            'images': {
                'front_url': storage_results.get('front_url', ''),
                'back_url': storage_results.get('back_url', ''),
                'face_url': ic_face_url
            },
            'ekyc_id': db_result.data[0]['id'] if db_result and db_result.data else None
        }
        
        # Add reason if not verified
        if not is_verified:
            reasons = []
            if authenticity_score < 0.6:
                reasons.append(f"Document authenticity score too low: {authenticity_score:.2f}")
            if validation_score < 0.7:
                reasons.append(f"Image quality validation score too low: {validation_score:.2f}")
            if not extracted_info.get('ic_number'):
                reasons.append("Could not extract IC number")
            
            response['reason'] = "; ".join(reasons) if reasons else "Verification failed"
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in eKYC verification: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'status': 'error',
            'error': str(e),
            'verified': False
        }), 500

# Keep existing helper functions
def store_ekyc_images(user_id: str, ic_front_b64: str, ic_back_b64: str) -> dict:
    """Store eKYC images in Supabase Storage"""
    try:
        # Convert base64 to bytes
        front_data = base64.b64decode(ic_front_b64.split(',')[1] if ',' in ic_front_b64 else ic_front_b64)
        back_data = base64.b64decode(ic_back_b64.split(',')[1] if ',' in ic_back_b64 else ic_back_b64)
        
        # Store front image
        front_result = BiometricStorage.store_ekyc_document(user_id, front_data, 'mykad_front')
        
        # Store back image
        back_result = BiometricStorage.store_ekyc_document(user_id, back_data, 'mykad_back')
        
        return {
            'front_url': front_result.get('public_url', ''),
            'back_url': back_result.get('public_url', ''),
            'front_path': front_result.get('file_path', ''),
            'back_path': back_result.get('file_path', '')
        }
        
    except Exception as e:
        logger.error(f"Error storing eKYC images: {str(e)}")
        return {}

def log_ekyc_verification(user_id: str, is_verified: bool, score: float, extracted_info: dict):
    """Log eKYC verification attempt"""
    try:
        log_data = {
            'user_id': user_id,
            'success': is_verified,
            'biometric_scores': {
                'ekyc_verification': score,
                'document_type': 'mykad'
            },
            'ip_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'event_ts': datetime.utcnow().isoformat(),
            'geolocation': {
                'country': 'Malaysia',
                'document_info': {
                    'ic_number': extracted_info.get('ic_number', ''),
                    'name': extracted_info.get('name', '')
                }
            }
        }
        
        supabase_client.table('login_audit').insert(log_data).execute()
        
    except Exception as e:
        logger.error(f"Error logging eKYC verification: {str(e)}")