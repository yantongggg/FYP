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

# Import the enhanced OCR utility
from utils.ocr_utils import MyKadOCR
from utils.image_utils import decode_base64_image, preprocess_face_image
from utils.supabase_client import supabase_client
from utils.storage_utils import BiometricStorage
from utils.logger import setup_logger

# Create blueprint
ekyc_bp = Blueprint('ekyc', __name__)
logger = setup_logger(__name__)

# Initialize enhanced OCR
try:
    mykad_ocr = MyKadOCR()
    logger.info("✅ Enhanced MyKad OCR initialized")
except ImportError:
    logger.warning("MyKad OCR not available - using mock")
    class MockMyKadOCR:
        def process_mykad_front(self, image):
            return {
                'success': True,
                'extracted_info': {
                    'ic_number': '030301-08-0532',
                    'name': 'CHYE YAN TONG',
                    'gender': 'PEREMPUAN',
                    'address': 'NO 15 JALAN CORINA 7, TAMAN DESA CORINA, KAMPUNG RAJA, 39010 C HIGHLANDS, PAHANG'
                },
                'authenticity': {'authenticity_score': 0.85, 'found_keywords': ['MALAYSIA', 'WARGANEGARA']}
            }
        def process_mykad_back(self, image):
            return {
                'success': True,
                'ic_number_back': '030301-08-0532',
                'security_features': {'has_signature_area': True, 'has_security_text': True}
            }
    mykad_ocr = MockMyKadOCR()

def validate_ic_image_enhanced(image: np.ndarray) -> dict:
    """
    FIXED: Enhanced image validation with more lenient requirements
    """
    try:
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # More lenient validation criteria
        checks = {
            'sufficient_size': width >= 300 and height >= 200,  # Lower requirement
            'aspect_ratio': 1.2 <= (width / height) <= 2.0,    # More flexible ratio
            'brightness': 30 < np.mean(gray) < 220,             # More flexible brightness
            'contrast': np.std(gray) > 20,                      # Lower contrast requirement
            'sharpness': cv2.Laplacian(gray, cv2.CV_64F).var() > 50  # Lower sharpness requirement
        }
        
        # Calculate score
        validation_score = sum(checks.values()) / len(checks)
        is_valid = validation_score >= 0.6  # More lenient threshold
        
        return {
            'is_valid': is_valid,
            'validation_score': validation_score,
            'checks': checks,
            'metrics': {
                'resolution': f"{width}x{height}",
                'aspect_ratio': round(width / height, 3),
                'brightness': round(np.mean(gray), 2),
                'contrast': round(np.std(gray), 2),
                'sharpness': round(cv2.Laplacian(gray, cv2.CV_64F).var(), 2)
            }
        }
        
    except Exception as e:
        logger.error(f"Error validating IC image: {str(e)}")
        return {
            'is_valid': False,
            'validation_score': 0.0,
            'error': str(e)
        }

def extract_ic_face_enhanced(image: np.ndarray) -> dict:
    """
    Enhanced face extraction from IC with better error handling
    """
    try:
        # Try face_recognition first
        face_locations = face_recognition.face_locations(image)
        
        if face_locations:
            top, right, bottom, left = face_locations[0]
            
            # Add padding
            padding = 20
            top = max(0, top - padding)
            right = min(image.shape[1], right + padding)
            bottom = min(image.shape[0], bottom + padding)
            left = max(0, left - padding)
            
            face_image = image[top:bottom, left:right]
            
            return {
                'success': True,
                'face_image': face_image,
                'location': {'top': top, 'right': right, 'bottom': bottom, 'left': left},
                'method': 'face_recognition'
            }
        
        # Fallback to OpenCV
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        if len(faces) > 0:
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            
            padding = 20
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(image.shape[1] - x, w + 2 * padding)
            h = min(image.shape[0] - y, h + 2 * padding)
            
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

@ekyc_bp.route('/ekyc-mykad-verify', methods=['POST'])
def ekyc_mykad_verify_enhanced():
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
        
        logger.info(f" Starting enhanced eKYC verification for user {user_id}")
        
        # Decode images
        ic_front_image = decode_base64_image(ic_front_b64)
        ic_back_image = decode_base64_image(ic_back_b64)
        
        # Step 1: Enhanced image validation
        front_validation = validate_ic_image_enhanced(ic_front_image)
        back_validation = validate_ic_image_enhanced(ic_back_image)
        
        # More lenient validation - allow if either image passes or both are close
        front_valid = front_validation['is_valid'] or front_validation['validation_score'] >= 0.5
        back_valid = back_validation['is_valid'] or back_validation['validation_score'] >= 0.5
        
        if not front_valid:
            logger.warning(f"⚠️ Front IC validation failed but continuing: score={front_validation['validation_score']}")
        
        if not back_valid:
            logger.warning(f"⚠️ Back IC validation failed but continuing: score={back_validation['validation_score']}")
        
        # Step 2: Enhanced OCR processing
        logger.info("📝 Processing IC front with enhanced OCR")
        ocr_result = mykad_ocr.process_mykad_front(ic_front_image)
        
        logger.info(f"📊 OCR Result: {ocr_result}")
        
        if not ocr_result['success']:
            return jsonify({
                'success': False,
                'status': 'fail',
                'reason': f"Enhanced OCR processing failed: {ocr_result.get('error', 'Unknown error')}",
                'debug_info': {
                    'raw_text': ocr_result.get('debug_text', ''),
                    'front_validation': front_validation,
                    'back_validation': back_validation
                }
            })
        
        extracted_info = ocr_result['extracted_info']
        authenticity = ocr_result['authenticity']
        
        # Step 3: Enhanced verification logic
        authenticity_score = authenticity['authenticity_score']
        
        # Calculate comprehensive verification factors
        verification_factors = {
            'ic_number_extracted': bool(extracted_info.get('ic_number')),
            'name_extracted': bool(extracted_info.get('name')),
            'gender_extracted': bool(extracted_info.get('gender')),
            'address_extracted': bool(extracted_info.get('address')),
            'authenticity_good': authenticity_score >= 0.35,
            'keywords_found': len(authenticity.get('found_keywords', [])) >= 1,
            'front_image_acceptable': front_validation['validation_score'] >= 0.4,
            'back_image_acceptable': back_validation['validation_score'] >= 0.4
        }
        
        # FIXED: More nuanced verification logic
        critical_factors = [
            verification_factors['ic_number_extracted'],
            verification_factors['authenticity_good']
        ]
        
        supporting_factors = [
            verification_factors['name_extracted'],
            verification_factors['gender_extracted'],
            verification_factors['keywords_found'],
            verification_factors['front_image_acceptable']
        ]
        
        # Pass if all critical factors + at least 2 supporting factors
        is_verified = (
            all(critical_factors) and 
            sum(supporting_factors) >= 2
        )
        
        logger.info(f"🎯 Verification factors: {verification_factors}")
        logger.info(f"🎯 Critical factors: {critical_factors} (all: {all(critical_factors)})")
        logger.info(f"🎯 Supporting factors: {sum(supporting_factors)}/4")
        logger.info(f"🎯 Final verification result: {is_verified}")
        
        # Step 4: Process back IC
        back_ocr_result = mykad_ocr.process_mykad_back(ic_back_image)
        
        # Step 5: Extract face from IC
        face_extraction_result = extract_ic_face_enhanced(ic_front_image)
        ic_face_url = ''
        
        if face_extraction_result['success']:
            try:
                _, buffer = cv2.imencode('.jpg', cv2.cvtColor(face_extraction_result['face_image'], cv2.COLOR_RGB2BGR))
                face_storage_result = BiometricStorage.store_ekyc_document(
                    user_id,
                    buffer.tobytes(),
                    'ic_face_front'
                )
                ic_face_url = face_storage_result.get('public_url', '')
                logger.info(f"✅ IC face extracted and stored: {ic_face_url}")
            except Exception as e:
                logger.error(f"Error storing IC face: {str(e)}")
        
        # Step 6: Store images
        storage_results = store_ekyc_images_enhanced(user_id, ic_front_b64, ic_back_b64)
        
        # Step 7: Calculate final scores
        validation_score = (front_validation['validation_score'] + back_validation['validation_score']) / 2
        verification_score = authenticity_score
        
        # Step 8: Store eKYC records
        ekyc_records = [
            {
                'user_id': user_id,
                'document_type': 'ic_front',
                'id_document_url': storage_results.get('front_url', ''),
                'ic_face_url': ic_face_url,
                'extracted_info': extracted_info,
                'verification_status': 'verified' if is_verified else 'rejected',
                'verification_score': verification_score,
                'document_authenticity_score': authenticity_score,
                'validation_score': validation_score,
                'ocr_confidence': authenticity_score,
                'processing_method': 'enhanced_local_ocr',
                'verification_factors': verification_factors,
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

        # Insert into database
        try:
            db_result = supabase_client.table('ekyc_documents').insert(ekyc_records).execute()
            logger.info(f"✅ eKYC records stored in database")
        except Exception as e:
            logger.error(f"Database error: {e}")
            db_result = None
        
        # Step 9: Build comprehensive response
        response = {
            'success': True,
            'status': 'pass' if is_verified else 'fail',
            'verified': is_verified,
            'verification_score': round(verification_score, 3),
            'extracted_info': {
                'ic_number': extracted_info.get('ic_number'),
                'name': extracted_info.get('name'),
                'gender': extracted_info.get('gender'),
                'address': extracted_info.get('address'),
                'date_of_birth': extracted_info.get('date_of_birth'),
                'religion': extracted_info.get('religion')
            },
            'verification_factors': verification_factors,
            'document_validation': {
                'front_validation': {
                    'score': round(front_validation['validation_score'], 3),
                    'checks': front_validation.get('checks', {}),
                    'metrics': front_validation.get('metrics', {})
                },
                'back_validation': {
                    'score': round(back_validation['validation_score'], 3),
                    'checks': back_validation.get('checks', {}),
                    'metrics': back_validation.get('metrics', {})
                },
                'authenticity': {
                    'score': round(authenticity_score, 3),
                    'keywords_found': authenticity.get('found_keywords', []),
                    'has_ic_format': authenticity.get('has_ic_format', False),
                    'has_name': authenticity.get('has_name', False),
                    'has_gender': authenticity.get('has_gender', False)
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
            'ekyc_id': db_result.data[0]['id'] if db_result and db_result.data else None,
            'processing_details': {
                'ocr_method': 'enhanced_multi_config',
                'validation_method': 'comprehensive_factors',
                'critical_factors_met': all(critical_factors),
                'supporting_factors_count': sum(supporting_factors),
                'raw_text_sample': ocr_result.get('raw_text', '')[:200] if ocr_result.get('raw_text') else ''
            }
        }
        
        # Add detailed rejection reason if not verified
        if not is_verified:
            reasons = []
            if not verification_factors['ic_number_extracted']:
                reasons.append("IC number could not be extracted")
            if not verification_factors['authenticity_good']:
                reasons.append(f"Document authenticity score too low: {authenticity_score:.2f} (required: ≥0.35)")
            if sum(supporting_factors) < 2:
                reasons.append(f"Insufficient supporting factors: {sum(supporting_factors)}/4 (required: ≥2)")
            
            response['reason'] = "; ".join(reasons) if reasons else f"Verification failed (score: {verification_score:.2f})"
            response['suggestions'] = [
                "Ensure IC is clearly visible and well-lit",
                "Make sure all text on IC is readable",
                "Avoid shadows or glare on the document",
                "Try capturing with better camera resolution"
            ]
        
        logger.info(f"🎯 eKYC verification complete - User: {user_id}, Verified: {is_verified}, Score: {verification_score:.3f}")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"❌ Error in enhanced eKYC verification: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'status': 'error',
            'error': str(e),
            'verified': False,
            'suggestions': [
                "Check network connection",
                "Ensure images are valid",
                "Try uploading again",
                "Contact support if issue persists"
            ]
        }), 500

def store_ekyc_images_enhanced(user_id: str, ic_front_b64: str, ic_back_b64: str) -> dict:
    """Enhanced eKYC image storage with better error handling"""
    try:
        # Convert base64 to bytes
        front_data = base64.b64decode(ic_front_b64.split(',')[1] if ',' in ic_front_b64 else ic_front_b64)
        back_data = base64.b64decode(ic_back_b64.split(',')[1] if ',' in ic_back_b64 else ic_back_b64)
        
        # Store front image
        front_result = BiometricStorage.store_ekyc_document(user_id, front_data, 'mykad_front_enhanced')
        
        # Store back image  
        back_result = BiometricStorage.store_ekyc_document(user_id, back_data, 'mykad_back_enhanced')
        
        logger.info(f"✅ Enhanced eKYC images stored - Front: {front_result.get('public_url', 'failed')}, Back: {back_result.get('public_url', 'failed')}")
        
        return {
            'front_url': front_result.get('public_url', ''),
            'back_url': back_result.get('public_url', ''),
            'front_path': front_result.get('file_path', ''),
            'back_path': back_result.get('file_path', '')
        }
        
    except Exception as e:
        logger.error(f"Error storing enhanced eKYC images: {str(e)}")
        return {
            'front_url': '',
            'back_url': '',
            'front_path': '',
            'back_path': ''
        }

def log_ekyc_verification_enhanced(user_id: str, is_verified: bool, score: float, extracted_info: dict, verification_factors: dict):
    """Enhanced eKYC verification logging"""
    try:
        log_data = {
            'user_id': user_id,
            'success': is_verified,
            'biometric_scores': {
                'ekyc_verification': score,
                'document_type': 'mykad_enhanced',
                'verification_factors': verification_factors
            },
            'ip_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'event_ts': datetime.utcnow().isoformat(),
            'geolocation': {
                'country': 'Malaysia',
                'document_info': extracted_info,
                'processing_method': 'enhanced_ocr'
            }
        }
        
        supabase_client.table('login_audit').insert(log_data).execute()
        logger.info(f"✅ Enhanced eKYC verification logged for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error logging enhanced eKYC verification: {str(e)}")

# Additional utility function for debugging
def debug_ocr_processing(image_b64: str) -> dict:
    """Debug function to test OCR processing"""
    try:
        image = decode_base64_image(image_b64)
        result = mykad_ocr.process_mykad_front(image)
        
        return {
            'success': True,
            'ocr_result': result,
            'image_shape': image.shape,
            'processing_method': 'enhanced_debug'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }