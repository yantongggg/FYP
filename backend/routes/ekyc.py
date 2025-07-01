from flask import Blueprint, request, jsonify
import cv2
import numpy as np
import base64
from datetime import datetime
import logging
import face_recognition
from io import BytesIO
from PIL import Image

from ml_models.face_verification import FaceVerificationModel
from utils.image_utils import decode_base64_image, preprocess_face_image
from utils.ocr_utils import MyKadOCR
from utils.supabase_client import supabase_client
from utils.storage_utils import BiometricStorage
from utils.logger import setup_logger

ekyc_bp = Blueprint('ekyc', __name__)
logger = setup_logger(__name__)

# Initialize models
face_model = FaceVerificationModel()
mykad_ocr = MyKadOCR()

@ekyc_bp.route('/ekyc-mykad-verify', methods=['POST'])
def ekyc_mykad_verify():
    """
    Complete Malaysian IC (MyKad) eKYC verification
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
        
        # Step 1: Validate image quality
        front_quality = mykad_ocr.validate_image_quality(ic_front_image)
        back_quality = mykad_ocr.validate_image_quality(ic_back_image)
        
        if not front_quality['is_acceptable']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'IC front image quality is too low',
                'quality_details': front_quality
            })
        
        if not back_quality['is_acceptable']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'IC back image quality is too low',
                'quality_details': back_quality
            })
        
        # Step 2: Process IC front and extract information
        front_result = mykad_ocr.process_mykad_front(ic_front_image)
        
        if not front_result['success']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': f"Failed to process IC front: {front_result.get('error', 'Unknown error')}"
            })
        
        extracted_info = front_result['extracted_info']
        
        # Validate that we have essential information
        if not extracted_info.get('ic_number'):
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': 'Could not extract IC number from front image'
            })
        
        # Step 3: Process IC back
        back_result = mykad_ocr.process_mykad_back(ic_back_image)
        
        if not back_result['success']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': f"Failed to process IC back: {back_result.get('error', 'Unknown error')}"
            })
        
        # Step 4: Validate IC number consistency
        ic_front_number = extracted_info['ic_number']
        ic_back_number = back_result.get('ic_number_back')
        
        ic_consistency = True
        if ic_back_number and ic_back_number != ic_front_number:
            ic_consistency = False
            logger.warning(f"IC number mismatch: front={ic_front_number}, back={ic_back_number}")
        
        # Step 5: Extract face from IC front and compare with Step 1 face
        face_match_result = compare_ic_face_with_step1(ic_front_image, user_id)
        
        # Step 6: Calculate verification scores
        authenticity_score = front_result['authenticity']['authenticity_score']
        security_features = back_result['security_features']
        security_score = calculate_security_score(security_features)
        
        # Step 7: Calculate overall verification score
        verification_score = calculate_overall_verification_score({
            'face_match_score': face_match_result.get('similarity', 0),
            'authenticity_score': authenticity_score,
            'security_score': security_score,
            'ic_consistency': ic_consistency,
            'quality_score': (front_quality['quality_score'] + back_quality['quality_score']) / 2
        })
        
        # Determine verification status
        is_verified = verification_score >= 0.75 and face_match_result.get('similarity', 0) >= 0.7
        
        # Step 8: Store images in Supabase Storage
        storage_results = store_ekyc_images(user_id, ic_front_b64, ic_back_b64)
        
        # Step 9: Store eKYC record in database
        ekyc_record = {
            'user_id': user_id,
            'document_type': 'mykad',
            'id_document_url': storage_results.get('front_url', ''),
            'selfie_url': '',  # No selfie required for MyKad verification
            'extracted_info': extracted_info,
            'verification_status': 'verified' if is_verified else 'rejected',
            'verification_score': verification_score,
            'face_match_score': face_match_result.get('similarity', 0),
            'document_authenticity_score': authenticity_score,
            'created_at': datetime.utcnow().isoformat(),
            'verified_at': datetime.utcnow().isoformat() if is_verified else None,
            'notes': f"MyKad verification - Face match: {face_match_result.get('similarity', 0):.3f}, Authenticity: {authenticity_score:.3f}"
        }
        
        # Insert into database
        db_result = supabase_client.table('ekyc_documents').insert(ekyc_record).execute()
        
        # Log the verification attempt
        log_ekyc_verification(user_id, is_verified, verification_score, extracted_info)
        
        logger.info(f"MyKad eKYC verification - User: {user_id}, Verified: {is_verified}, Score: {verification_score:.3f}")
        
        # Prepare response
        response = {
            'success': True,
            'status': 'pass' if is_verified else 'fail',
            'verified': is_verified,
            'verification_score': round(verification_score, 3),
            'extracted_info': extracted_info,
            'face_match': {
                'score': round(face_match_result.get('similarity', 0), 3),
                'confidence': face_match_result.get('confidence', 'low')
            },
            'document_authenticity': {
                'score': round(authenticity_score, 3),
                'is_authentic': front_result['authenticity']['is_authentic'],
                'found_keywords': front_result['authenticity']['found_keywords']
            },
            'security_features': security_features,
            'quality_assessment': {
                'front_quality': round(front_quality['quality_score'], 3),
                'back_quality': round(back_quality['quality_score'], 3),
                'overall_quality': round((front_quality['quality_score'] + back_quality['quality_score']) / 2, 3)
            },
            'ic_consistency': ic_consistency,
            'ekyc_id': db_result.data[0]['id'] if db_result.data else None
        }
        
        if not is_verified:
            response['reason'] = determine_failure_reason(
                face_match_result, authenticity_score, security_score, ic_consistency
            )
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in MyKad eKYC verification: {str(e)}")
        return jsonify({
            'success': False,
            'status': 'error',
            'error': str(e),
            'verified': False
        }), 500

def compare_ic_face_with_step1(ic_image: np.ndarray, user_id: str) -> dict:
    """Compare face from IC with face captured in Step 1"""
    try:
        # Extract face from IC image
        ic_face_locations = face_recognition.face_locations(ic_image)
        
        if not ic_face_locations:
            return {
                'similarity': 0.0,
                'confidence': 'low',
                'error': 'No face detected in IC image'
            }
        
        if len(ic_face_locations) > 1:
            return {
                'similarity': 0.0,
                'confidence': 'low',
                'error': 'Multiple faces detected in IC image'
            }
        
        # Extract face encoding from IC
        ic_face_encodings = face_recognition.face_encodings(ic_image, ic_face_locations)
        
        if not ic_face_encodings:
            return {
                'similarity': 0.0,
                'confidence': 'low',
                'error': 'Could not extract face features from IC'
            }
        
        ic_face_encoding = ic_face_encodings[0]
        
        # Get stored face data from Step 1
        stored_face_result = supabase_client.table('biometric_data')\
            .select('face_embedding, data')\
            .eq('user_id', user_id)\
            .eq('biometric_type', 'face')\
            .order('capture_timestamp', desc=True)\
            .limit(1)\
            .execute()
        
        if not stored_face_result.data:
            return {
                'similarity': 0.0,
                'confidence': 'low',
                'error': 'No stored face data found for user'
            }
        
        stored_face_data = stored_face_result.data[0]
        
        # Get stored face encoding
        if stored_face_data.get('face_embedding'):
            stored_encoding = np.array(stored_face_data['face_embedding'])
        elif stored_face_data.get('data', {}).get('encoding'):
            stored_encoding = np.array(stored_face_data['data']['encoding'])
        else:
            return {
                'similarity': 0.0,
                'confidence': 'low',
                'error': 'No valid face encoding found in stored data'
            }
        
        # Calculate face distance and similarity
        face_distance = face_recognition.face_distance([stored_encoding], ic_face_encoding)[0]
        similarity = 1.0 - face_distance
        
        # Determine confidence level
        if similarity >= 0.8:
            confidence = 'high'
        elif similarity >= 0.6:
            confidence = 'medium'
        else:
            confidence = 'low'
        
        return {
            'similarity': similarity,
            'distance': face_distance,
            'confidence': confidence
        }
        
    except Exception as e:
        logger.error(f"Error comparing IC face with Step 1: {str(e)}")
        return {
            'similarity': 0.0,
            'confidence': 'low',
            'error': str(e)
        }

def calculate_security_score(security_features: dict) -> float:
    """Calculate security score based on detected features"""
    try:
        feature_weights = {
            'has_signature_area': 0.3,
            'has_chip_area': 0.3,
            'has_barcode': 0.2,
            'has_security_text': 0.2
        }
        
        score = 0.0
        for feature, weight in feature_weights.items():
            if security_features.get(feature, False):
                score += weight
        
        return score
        
    except Exception as e:
        logger.error(f"Error calculating security score: {str(e)}")
        return 0.0

def calculate_overall_verification_score(components: dict) -> float:
    """Calculate overall eKYC verification score"""
    try:
        face_match_score = components.get('face_match_score', 0)
        authenticity_score = components.get('authenticity_score', 0)
        security_score = components.get('security_score', 0)
        ic_consistency = components.get('ic_consistency', True)
        quality_score = components.get('quality_score', 0)
        
        # Weighted combination
        verification_score = (
            face_match_score * 0.4 +
            authenticity_score * 0.25 +
            security_score * 0.15 +
            quality_score * 0.15 +
            (1.0 if ic_consistency else 0.0) * 0.05
        )
        
        return min(1.0, max(0.0, verification_score))
        
    except Exception as e:
        logger.error(f"Error calculating verification score: {str(e)}")
        return 0.0

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
        return {
            'front_url': '',
            'back_url': '',
            'front_path': '',
            'back_path': ''
        }

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
                'country': 'Malaysia',  # Assumed for MyKad
                'document_info': {
                    'ic_number': extracted_info.get('ic_number', ''),
                    'name': extracted_info.get('name', '')
                }
            }
        }
        
        supabase_client.table('login_audit').insert(log_data).execute()
        
    except Exception as e:
        logger.error(f"Error logging eKYC verification: {str(e)}")

def determine_failure_reason(face_match_result: dict, authenticity_score: float, 
                           security_score: float, ic_consistency: bool) -> str:
    """Determine the reason for verification failure"""
    reasons = []
    
    if face_match_result.get('similarity', 0) < 0.7:
        reasons.append("Face does not match Step 1 capture")
    
    if authenticity_score < 0.6:
        reasons.append("Document authenticity check failed")
    
    if security_score < 0.5:
        reasons.append("Security features not detected")
    
    if not ic_consistency:
        reasons.append("IC number mismatch between front and back")
    
    if not reasons:
        reasons.append("Overall verification score too low")
    
    return "; ".join(reasons)

@ekyc_bp.route('/ekyc-extract-info', methods=['POST'])
def ekyc_extract_info():
    """
    Extract information from MyKad image (for testing/preview)
    """
    try:
        data = request.get_json()
        ic_image_b64 = data.get('ic_image')
        
        if not ic_image_b64:
            return jsonify({
                'success': False,
                'error': 'IC image is required'
            }), 400
        
        # Decode image
        ic_image = decode_base64_image(ic_image_b64)
        
        # Validate image quality
        quality_result = mykad_ocr.validate_image_quality(ic_image)
        
        if not quality_result['is_acceptable']:
            return jsonify({
                'success': False,
                'error': 'Image quality is too low for processing',
                'quality_details': quality_result
            })
        
        # Process image
        result = mykad_ocr.process_mykad_front(ic_image)
        
        if not result['success']:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to process image')
            })
        
        return jsonify({
            'success': True,
            'extracted_info': result['extracted_info'],
            'authenticity': result['authenticity'],
            'quality': quality_result
        })
        
    except Exception as e:
        logger.error(f"Error in eKYC info extraction: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ekyc_bp.route('/ekyc-validate-quality', methods=['POST'])
def ekyc_validate_quality():
    """
    Validate image quality for eKYC processing
    """
    try:
        data = request.get_json()
        image_b64 = data.get('image')
        
        if not image_b64:
            return jsonify({
                'success': False,
                'error': 'Image is required'
            }), 400
        
        # Decode image
        image = decode_base64_image(image_b64)
        
        # Validate quality
        quality_result = mykad_ocr.validate_image_quality(image)
        
        return jsonify({
            'success': True,
            'quality_result': quality_result,
            'is_acceptable': quality_result['is_acceptable'],
            'recommendations': get_quality_recommendations(quality_result)
        })
        
    except Exception as e:
        logger.error(f"Error validating image quality: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def get_quality_recommendations(quality_result: dict) -> list:
    """Get recommendations for improving image quality"""
    recommendations = []
    
    quality_checks = quality_result.get('quality_checks', {})
    
    if not quality_checks.get('sufficient_resolution'):
        recommendations.append("Use a higher resolution camera or move closer to the document")
    
    if not quality_checks.get('sufficient_sharpness'):
        recommendations.append("Ensure the image is in focus and hold the camera steady")
    
    if not quality_checks.get('good_brightness'):
        recommendations.append("Improve lighting conditions - avoid shadows and glare")
    
    if not quality_checks.get('sufficient_contrast'):
        recommendations.append("Ensure good contrast between the document and background")
    
    if not quality_checks.get('is_color'):
        recommendations.append("Use a color camera - black and white images are not acceptable")
    
    if not recommendations:
        recommendations.append("Image quality is acceptable for processing")
    
    return recommendations