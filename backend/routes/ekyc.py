from flask import Blueprint, request, jsonify
import cv2
import numpy as np
import base64
from datetime import datetime
import logging
import face_recognition
from io import BytesIO
from PIL import Image
import requests
import json
import tempfile
import os

from ml_models.face_verification import FaceVerificationModel
from utils.image_utils import decode_base64_image, preprocess_face_image
from utils.supabase_client import supabase_client
from utils.storage_utils import BiometricStorage
from utils.logger import setup_logger

ekyc_bp = Blueprint('ekyc', __name__)
logger = setup_logger(__name__)

# PixLab API Configuration
PIXLAB_API_KEY = "d80d10fc49ca9954b7dfcb4628050fc8"
PIXLAB_DOCSCAN_URL = "https://api.pixlab.io/docscan"

# Initialize models
face_model = FaceVerificationModel()

def validate_image_corners_and_clarity(image: np.ndarray) -> dict:
    """
    Validate image has all 4 corners visible and is not blurry
    """
    try:
        height, width = image.shape[:2]
        
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Check blur using Laplacian variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_sharp = laplacian_var > 100  # Threshold for sharpness
        
        # Check corners using edge detection
        edges = cv2.Canny(gray, 50, 150)
        
        # Define corner regions (top-left, top-right, bottom-left, bottom-right)
        corner_size = min(width, height) // 10
        corners = {
            'top_left': edges[0:corner_size, 0:corner_size],
            'top_right': edges[0:corner_size, width-corner_size:width],
            'bottom_left': edges[height-corner_size:height, 0:corner_size],
            'bottom_right': edges[height-corner_size:height, width-corner_size:width]
        }
        
        # Check if corners have sufficient edges (document present)
        corner_scores = {}
        all_corners_visible = True
        
        for corner_name, corner_region in corners.items():
            edge_pixels = np.sum(corner_region > 0)
            total_pixels = corner_region.size
            edge_ratio = edge_pixels / total_pixels if total_pixels > 0 else 0
            corner_scores[corner_name] = edge_ratio
            
            if edge_ratio < 0.05:  # Less than 5% edges means corner might be cut off
                all_corners_visible = False
        
        return {
            'is_valid': is_sharp and all_corners_visible,
            'is_sharp': is_sharp,
            'sharpness_score': float(laplacian_var),
            'all_corners_visible': all_corners_visible,
            'corner_scores': corner_scores,
            'resolution': {'width': width, 'height': height}
        }
        
    except Exception as e:
        logger.error(f"Error validating image: {str(e)}")
        return {
            'is_valid': False,
            'error': str(e)
        }

def call_pixlab_docscan(image_b64: str) -> dict:
    """
    Call PixLab DOCSCAN API for MyKad processing
    """
    try:
        # Remove data URL prefix if present
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]
        
        # Prepare request
        payload = {
            "img": image_b64,
            "type": "idcard",
            "country": "my",  # Malaysia
            "key": PIXLAB_API_KEY
        }
        
        # Make API call
        logger.info("Calling PixLab DOCSCAN API...")
        response = requests.post(PIXLAB_DOCSCAN_URL, data=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"PixLab response status: {result.get('status')}")
            return result
        else:
            logger.error(f"PixLab API error: {response.status_code} - {response.text}")
            return {"status": "error", "error": f"API error: {response.status_code}"}
            
    except Exception as e:
        logger.error(f"PixLab API call failed: {str(e)}")
        return {"status": "error", "error": str(e)}

def download_and_process_face_url(face_url: str) -> tuple:
    """
    Download face image from PixLab URL and extract embedding
    Returns: (face_image_array, face_embedding)
    """
    try:
        # Download image from URL
        response = requests.get(face_url, timeout=10)
        if response.status_code != 200:
            logger.error(f"Failed to download face from URL: {face_url}")
            return None, None
        
        # Convert to image
        image = Image.open(BytesIO(response.content))
        image_array = np.array(image)
        
        # Ensure RGB format
        if len(image_array.shape) == 2:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_GRAY2RGB)
        elif image_array.shape[2] == 4:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGBA2RGB)
        
        # Extract face encoding
        face_encodings = face_recognition.face_encodings(image_array)
        if not face_encodings:
            logger.error("No face found in downloaded image")
            return image_array, None
        
        return image_array, face_encodings[0]
        
    except Exception as e:
        logger.error(f"Error downloading/processing face: {str(e)}")
        return None, None

def compare_face_with_stored(ic_face_encoding: np.ndarray, user_id: str) -> dict:
    """
    Compare IC face encoding with stored biometric face
    """
    try:
        # Get stored face data including URL
        stored_face_result = supabase_client.table('biometric_data')\
            .select('face_embedding, face_image_url, data')\
            .eq('user_id', user_id)\
            .eq('biometric_type', 'face')\
            .order('capture_timestamp', desc=True)\
            .limit(1)\
            .execute()
        
        if not stored_face_result.data:
            return {
                'match': False,
                'similarity': 0.0,
                'confidence': 'none',
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
                'similarity': 0.0,
                'confidence': 'none',
                'error': 'No valid face encoding in stored data'
            }
        
        # Calculate similarity
        face_distance = face_recognition.face_distance([stored_encoding], ic_face_encoding)[0]
        similarity = 1.0 - face_distance
        
        # Determine match and confidence
        is_match = similarity >= 0.6  # Threshold for matching
        
        if similarity >= 0.8:
            confidence = 'high'
        elif similarity >= 0.6:
            confidence = 'medium'
        else:
            confidence = 'low'
        
        return {
            'match': is_match,
            'similarity': float(similarity),
            'distance': float(face_distance),
            'confidence': confidence,
            'stored_face_url': stored_data.get('face_image_url', '')
        }
        
    except Exception as e:
        logger.error(f"Error comparing faces: {str(e)}")
        return {
            'match': False,
            'similarity': 0.0,
            'confidence': 'error',
            'error': str(e)
        }

def store_ic_face_image(user_id: str, face_image: np.ndarray, ic_type: str = 'front') -> str:
    """
    Store IC face image to Supabase storage
    """
    try:
        # Convert numpy array to bytes
        _, buffer = cv2.imencode('.jpg', cv2.cvtColor(face_image, cv2.COLOR_RGB2BGR))
        image_bytes = buffer.tobytes()
        
        # Upload to Supabase
        result = BiometricStorage.store_ekyc_document(
            user_id, 
            image_bytes, 
            f'ic_face_{ic_type}'
        )
        
        return result.get('public_url', '')
        
    except Exception as e:
        logger.error(f"Error storing IC face: {str(e)}")
        return ''

@ekyc_bp.route('/ekyc-mykad-verify', methods=['POST'])
def ekyc_mykad_verify():
    """
    Complete Malaysian IC (MyKad) eKYC verification with face matching
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
        
        # Step 1: Validate image quality and corners
        front_validation = validate_image_corners_and_clarity(ic_front_image)
        back_validation = validate_image_corners_and_clarity(ic_back_image)
        
        if not front_validation['is_valid']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'IC front image validation failed',
                'details': {
                    'is_sharp': front_validation.get('is_sharp', False),
                    'all_corners_visible': front_validation.get('all_corners_visible', False),
                    'sharpness_score': front_validation.get('sharpness_score', 0)
                }
            })
        
        if not back_validation['is_valid']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'IC back image validation failed',
                'details': back_validation
            })
        
        # Step 2: Process with PixLab
        logger.info(f"Processing IC front with PixLab for user {user_id}")
        pixlab_result = call_pixlab_docscan(ic_front_b64)
        
        # Check PixLab response
        if pixlab_result.get('status') != 'ok':
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': f"PixLab processing failed: {pixlab_result.get('error', 'Unknown error')}"
            })
        
        # Validate it's a document and from Malaysia
        if not pixlab_result.get('is_document'):
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'Uploaded image is not recognized as a valid document'
            })
        
        if pixlab_result.get('country') != 'my':
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': f"Document is not a Malaysian IC (detected: {pixlab_result.get('country', 'unknown')})"
            })
        
        # Check confidence
        confidence = pixlab_result.get('confidence', 0)
        if confidence < 0.9:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': f'Document confidence too low: {confidence:.2f} (required: 0.90)'
            })
        
        # Extract fields
        fields = pixlab_result.get('fields', {})
        extracted_info = {
            'name': fields.get('fullName', ''),
            'ic_number': fields.get('idNumber', '') or fields.get('documentNumber', ''),
            'date_of_birth': fields.get('dateOfBirth', ''),
            'address': fields.get('address', ''),
            'gender': fields.get('gender', ''),
            'religion': fields.get('religion', ''),
            'nationality': fields.get('nationality', 'MALAYSIA')
        }
        
        # Validate IC number extracted
        if not extracted_info['ic_number']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'Could not extract IC number from document'
            })
        
        # Step 3: CRITICAL - Face matching
        face_match_result = {'match': False, 'similarity': 0.0}
        ic_face_url = ''
        
        if pixlab_result.get('face_url'):
            logger.info("Downloading and processing face from PixLab...")
            ic_face_image, ic_face_encoding = download_and_process_face_url(pixlab_result['face_url'])
            
            if ic_face_encoding is not None:
                # Compare with stored biometric face
                face_match_result = compare_face_with_stored(ic_face_encoding, user_id)
                
                # Store IC face image
                if ic_face_image is not None:
                    ic_face_url = store_ic_face_image(user_id, ic_face_image, 'front')
            else:
                face_match_result = {
                    'match': False,
                    'similarity': 0.0,
                    'confidence': 'none',
                    'error': 'Could not extract face encoding from IC'
                }
        else:
            face_match_result = {
                'match': False,
                'similarity': 0.0,
                'confidence': 'none',
                'error': 'No face detected in IC'
            }
        
        # Process back IC
        logger.info("Processing IC back...")
        pixlab_back_result = call_pixlab_docscan(ic_back_b64)
        
        # Calculate scores
        authenticity_score = pixlab_result.get('confidence', 0.9)
        face_match_score = face_match_result['similarity']
        
        # Overall verification (face match is critical)
        is_verified = (
            authenticity_score >= 0.9 and 
            face_match_result['match'] and 
            face_match_score >= 0.6
        )
        
        # Store images
        storage_results = store_ekyc_images(user_id, ic_front_b64, ic_back_b64)
        
        # Store eKYC record
        ekyc_record = {
            'user_id': user_id,
            'document_type': 'mykad',
            'id_document_url': storage_results.get('front_url', ''),
            'id_document_back_url': storage_results.get('back_url', ''),
            'ic_face_url': ic_face_url,
            'extracted_info': extracted_info,
            'verification_status': 'verified' if is_verified else 'rejected',
            'verification_score': authenticity_score,
            'face_match_score': face_match_score,
            'face_match_details': face_match_result,
            'document_authenticity_score': authenticity_score,
            'pixlab_response': {
                'country': pixlab_result.get('country'),
                'document_type': pixlab_result.get('document_type'),
                'confidence': confidence
            },
            'created_at': datetime.utcnow().isoformat(),
            'verified_at': datetime.utcnow().isoformat() if is_verified else None
        }
        
        # Insert into database
        db_result = supabase_client.table('ekyc_documents').insert(ekyc_record).execute()
        
        logger.info(f"eKYC verification - User: {user_id}, Verified: {is_verified}, "
                   f"Face Match: {face_match_result['match']}, Score: {face_match_score:.3f}")
        
        # Prepare response
        response = {
            'success': True,
            'status': 'pass' if is_verified else 'fail',
            'verified': is_verified,
            'verification_score': round(authenticity_score, 3),
            'extracted_info': extracted_info,
            'face_match': {
                'matched': face_match_result['match'],
                'score': round(face_match_score, 3),
                'confidence': face_match_result['confidence'],
                'error': face_match_result.get('error')
            },
            'document_validation': {
                'is_document': pixlab_result.get('is_document', False),
                'country': pixlab_result.get('country'),
                'confidence': round(confidence, 3),
                'corners_visible': front_validation['all_corners_visible'],
                'is_sharp': front_validation['is_sharp']
            },
            'images': {
                'front_url': storage_results.get('front_url', ''),
                'back_url': storage_results.get('back_url', ''),
                'face_url': ic_face_url
            },
            'ekyc_id': db_result.data[0]['id'] if db_result.data else None
        }
        
        if not is_verified:
            reasons = []
            if not face_match_result['match']:
                reasons.append(f"Face does not match biometric capture (score: {face_match_score:.2f})")
            if authenticity_score < 0.9:
                reasons.append(f"Document authenticity score too low: {authenticity_score:.2f}")
            
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