import cv2
import numpy as np
import pytesseract
import re
from PIL import Image
import logging
from typing import Dict, Optional, Tuple
import json

logger = logging.getLogger(__name__)

class MyKadOCR:
    """OCR utilities specifically for Malaysian IC (MyKad) processing with improved parsing"""
    
    def __init__(self):
        # Set Tesseract path for Windows
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

        self.tesseract_configs = [
            '--oem 3 --psm 6',  # Default config
            '--oem 3 --psm 7',  # Single text line
            '--oem 3 --psm 8',  # Single word
            '--oem 3 --psm 13', # Raw line
            '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789-'  # Numbers and dash only for IC
        ]
        
        # Configure Tesseract for better OCR results
        self.tesseract_config = '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/., '
        
        # Improved patterns for Malaysian IC
        self.ic_number_patterns = [
            r'(\d{6}-\d{2}-\d{4})',           # Standard format: 030301-08-0833
            r'(\d{6}\s*-\s*\d{2}\s*-\s*\d{4})', # With spaces: 030301 - 08 - 0833
            r'(\d{6}\s+\d{2}\s+\d{4})',       # Space separated: 030301 08 0833
            r'(\d{12})',                       # All digits: 030301080833
            r'(\d{6}[-\s]?\d{2}[-\s]?\d{4})', # Flexible separators
        ]
        
        # FIXED: More targeted digit corrections - only for specific contexts
        self.digit_corrections_in_ic = {
            'O': '0', 'o': '0', 'Q': '0',
            'I': '1', 'l': '1', '|': '1',
            'S': '5', 's': '5',
            'G': '6', 'b': '6',
            'T': '7', 't': '7',
            'B': '8', 'g': '9'
        }
        
        # Gender patterns
        self.gender_patterns = ['LELAKI', 'PEREMPUAN']
        self.religion_patterns = ['ISLAM', 'KRISTIAN', 'BUDDHA', 'HINDU', 'SIKH', 'LAIN-LAIN']
        
        # Common MyKad keywords for validation
        self.mykad_keywords = [
            'WARGANEGARA', 'MALAYSIA', 'MYKAD', 'LELAKI', 'PEREMPUAN',
            'ISLAM', 'KRISTIAN', 'BUDDHA', 'HINDU', 'IDENTITY', 'CARD'
        ]
        
        # Known problematic OCR patterns to clean
        self.noise_patterns = [
            r'[^\w\s\-\.,]',  # Remove special characters except basic ones
            r'\s+',           # Multiple spaces to single space
            r'(?i)suis\s*en\s*tity\s*card',  # Common OCR mistake for "IDENTITY CARD"
        ]
    
    def clean_ocr_text(self, text: str) -> str:
        """Clean common OCR errors and noise - FIXED VERSION"""
        try:
            cleaned = text.upper()
            
            # FIXED: Don't apply digit corrections globally - only to potential IC numbers
            # Just clean noise patterns for now
            for pattern in self.noise_patterns:
                if pattern == r'\s+':
                    cleaned = re.sub(pattern, ' ', cleaned)
                elif 'suis' in pattern.lower():
                    cleaned = re.sub(pattern, 'IDENTITY CARD', cleaned, flags=re.IGNORECASE)
                else:
                    cleaned = re.sub(pattern, '', cleaned)
            
            return cleaned.strip()
            
        except Exception as e:
            logger.error(f"Error cleaning OCR text: {e}")
            return text
    
    def fix_ic_number_digits(self, potential_ic: str) -> str:
        """Apply digit corrections specifically to potential IC numbers"""
        fixed = potential_ic
        for mistake, correction in self.digit_corrections_in_ic.items():
            fixed = fixed.replace(mistake, correction)
        return fixed
    
    def extract_ic_number(self, text: str) -> Optional[str]:
        """Extract IC number with improved error correction - FIXED VERSION"""
        try:
            cleaned_text = self.clean_ocr_text(text)
            logger.info(f"🧹 Cleaned OCR text: {repr(cleaned_text[:200])}...")

            # First pass: standard IC patterns with early digit correction
            for pattern in self.ic_number_patterns:
                matches = re.findall(pattern, cleaned_text)
                for match in matches:
                    raw = match.strip()
                    digits_only = re.sub(r'[^\d]', '', raw)

                    if len(digits_only) == 12:
                        formatted = f"{digits_only[:6]}-{digits_only[6:8]}-{digits_only[8:]}"
                        
                        # 🛠 Try correcting first (IC back is often noisy)
                        corrected = self.fix_ic_number_digits(formatted)
                        if self.validate_ic_number_format(corrected):
                            logger.info(f"✅ IC number extracted (corrected): {corrected}")
                            return corrected
                        
                        # Then try uncorrected version
                        if self.validate_ic_number_format(formatted):
                            logger.info(f"✅ IC number extracted (raw): {formatted}")
                            return formatted

            # Second pass: lenient regex pattern to catch OCR confusion
            potential_ics = re.findall(r'[0-9O|Il]{6}[-\s]?[0-9O|Il]{2}[-\s]?[0-9O|Il]{4}', cleaned_text, re.IGNORECASE)

            for potential in potential_ics:
                corrected = self.fix_ic_number_digits(potential)
                digits_only = re.sub(r'[^\d]', '', corrected)

                if len(digits_only) == 12:
                    formatted = f"{digits_only[:6]}-{digits_only[6:8]}-{digits_only[8:]}"
                    if self.validate_ic_number_format(formatted):
                        logger.info(f"✅ IC number extracted (lenient fallback): {formatted}")
                        return formatted

            logger.warning(f"❌ No valid IC number found in text: {cleaned_text[:200]}...")
            return None

        except Exception as e:
            logger.error(f"❌ Error extracting IC number: {str(e)}")
            return None

    def validate_ic_number_format(self, ic_number: str) -> bool:
        """Enhanced IC number validation"""
        try:
            if not ic_number or len(ic_number) != 14:
                return False
            
            # Check format: YYMMDD-XX-XXXX
            if not re.match(r'^\d{6}-\d{2}-\d{4}$', ic_number):
                return False
            
            # Extract date parts for validation
            date_part = ic_number[:6]
            year = int(date_part[:2])
            month = int(date_part[2:4])
            day = int(date_part[4:6])
            
            # Basic date validation
            if month < 1 or month > 12:
                return False
            
            if day < 1 or day > 31:
                return False
            
            # Month-specific day validation
            if month in [4, 6, 9, 11] and day > 30:
                return False
            
            if month == 2 and day > 29:
                return False
            
            # Check state code (last 2 digits of place code)
            place_code = ic_number[7:9]  # Characters 7-8 (after first dash)
            # Valid Malaysian state codes: 01-16, 21-59, 82-83
            place_num = int(place_code)
            valid_states = (1 <= place_num <= 16) or (21 <= place_num <= 59) or (82 <= place_num <= 83)
            
            if not valid_states:
                logger.debug(f"Invalid state code: {place_code} ({place_num})")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating IC number: {str(e)}")
            return False
    
    def extract_name_improved(self, text: str, ic_number: str) -> Optional[str]:
        """Improved name extraction with better filtering"""
        try:
            lines = text.split('\n')
            cleaned_text = self.clean_ocr_text(text)
            
            # Find IC number line index
            ic_line_index = -1
            for i, line in enumerate(lines):
                if ic_number and ic_number.replace('-', '') in line.replace('-', '').replace(' ', ''):
                    ic_line_index = i
                    break
            
            # Look for name in lines before IC number
            search_lines = lines[:ic_line_index] if ic_line_index > 0 else lines[:5]
            
            potential_names = []
            for line in search_lines:
                cleaned_line = self.clean_ocr_text(line)
                
                # Skip obvious non-name lines
                skip_patterns = [
                    'MALAYSIA', 'WARGANEGARA', 'IDENTITY', 'CARD', 'MYKAD',
                    'KAD', 'PENGENALAN', 'NO', 'JALAN', 'TAMAN'
                ]
                
                if any(pattern in cleaned_line for pattern in skip_patterns):
                    continue
                
                # Skip lines with only numbers or too short
                if re.match(r'^[\d\-\s]+$', cleaned_line) or len(cleaned_line) < 3:
                    continue
                
                # Valid name should have letters and reasonable length
                if re.search(r'[A-Z]{2,}', cleaned_line) and 3 <= len(cleaned_line) <= 50:
                    # Remove common OCR artifacts
                    name_candidate = re.sub(r'[^\w\s]', ' ', cleaned_line)
                    name_candidate = ' '.join(name_candidate.split())
                    
                    if 3 <= len(name_candidate) <= 50:
                        potential_names.append(name_candidate)
            
            if potential_names:
                # Prefer names with multiple words (more likely to be full names)
                multi_word_names = [name for name in potential_names if len(name.split()) > 1]
                if multi_word_names:
                    return multi_word_names[0]
                return potential_names[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting name: {str(e)}")
            return None
    
    def extract_gender_improved(self, text: str, ic_number: str = None) -> Optional[str]:
        """Improved gender extraction with IC number fallback - FIXED VERSION"""
        try:
            cleaned_text = self.clean_ocr_text(text)
            
            # Method 1: Direct pattern matching from OCR text
            for gender in self.gender_patterns:
                if gender in cleaned_text:
                    logger.info(f"✅ Gender found in OCR text: {gender}")
                    return gender
            
            # Method 2: Fuzzy matching for common OCR errors
            gender_variants = {
                'LELAKI': ['LELAK1', 'L3LAKI', 'LELAK!', 'LELAK', 'LELA', 'LELK'],
                'PEREMPUAN': ['P3REMPUAN', 'PEREMPUAN', 'P3R3MPUAN', 'PEREM PUAN', 'PEREMPUA']
            }
            
            for correct_gender, variants in gender_variants.items():
                for variant in variants:
                    if variant in cleaned_text:
                        logger.info(f"✅ Gender found via fuzzy match: {correct_gender} (matched: {variant})")
                        return correct_gender
            
            # Method 3: 🔥 FIXED: Extract gender from IC number (most reliable)
            if ic_number:
                gender_from_ic = self.extract_gender_from_ic(ic_number)
                if gender_from_ic:
                    logger.info(f"✅ Gender derived from IC number: {gender_from_ic}")
                    return gender_from_ic
            
            logger.warning(f"⚠️ Could not determine gender from text or IC number")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting gender: {str(e)}")
            return None
    
    def extract_address_improved(self, text: str, ic_number: str) -> Optional[str]:
        """Improved address extraction"""
        try:
            lines = text.split('\n')
            
            # Find patterns that indicate address
            address_indicators = ['JALAN', 'NO', 'TAMAN', 'KAMPUNG', 'KG', 'LORONG']
            address_lines = []
            
            for line in lines:
                cleaned_line = self.clean_ocr_text(line)
                
                # Skip IC number line and other non-address content
                if (ic_number and ic_number.replace('-', '') in cleaned_line.replace('-', '').replace(' ', '')) or \
                   any(keyword in cleaned_line for keyword in ['MALAYSIA', 'WARGANEGARA', 'LELAKI', 'PEREMPUAN']):
                    continue
                
                # Look for address indicators or lines with numbers (house numbers)
                if (any(indicator in cleaned_line for indicator in address_indicators) or 
                    re.search(r'\d+', cleaned_line)) and len(cleaned_line) > 5:
                    
                    # Clean and format address line
                    address_line = re.sub(r'[^\w\s,.]', ' ', cleaned_line)
                    address_line = ' '.join(address_line.split())
                    
                    if address_line and len(address_line) > 3:
                        address_lines.append(address_line)
            
            if address_lines:
                # Combine first few address lines
                return ', '.join(address_lines[:3])
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting address: {str(e)}")
            return None
    
    def process_mykad_front(self, image: np.ndarray) -> Dict:
        """Process MyKad front image with improved OCR and parsing - FIXED VERSION"""
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image)
            
            # Try multiple OCR configurations
            text = None
            ic_number = None
            best_confidence = 0
            best_text = ""
            
            for config in self.tesseract_configs:
                try:
                    current_text = pytesseract.image_to_string(processed_image, config=config)
                    logger.info(f"OCR with config {config}: {repr(current_text[:100])}...")
                    
                    current_ic = self.extract_ic_number(current_text)
                    
                    if current_ic:
                        # Calculate confidence based on text quality
                        confidence = self.calculate_text_confidence(current_text)
                        logger.info(f"IC found with config {config}: {current_ic}, confidence: {confidence:.2f}")
                        
                        if confidence > best_confidence:
                            text = current_text
                            ic_number = current_ic
                            best_confidence = confidence
                            best_text = current_text
                        
                    # Keep best text even if no IC found yet
                    if not best_text or len(current_text) > len(best_text):
                        best_text = current_text
                        
                except Exception as e:
                    logger.warning(f"OCR config {config} failed: {e}")
                    continue
            
            # Fallback: try with original image
            if not ic_number:
                try:
                    fallback_text = pytesseract.image_to_string(image, config=self.tesseract_configs[0])
                    logger.info(f"Fallback OCR: {repr(fallback_text[:100])}...")
                    ic_number = self.extract_ic_number(fallback_text)
                    if ic_number:
                        text = fallback_text
                        logger.info(f"IC found in fallback: {ic_number}")
                except Exception as e:
                    logger.error(f"Fallback OCR failed: {e}")
            
            # Use best text if we have it
            if not text:
                text = best_text
            
            if not ic_number:
                return {
                    'success': False,
                    'error': 'Could not extract IC number from document',
                    'extracted_info': {},
                    'confidence': best_confidence,
                    'debug_text': text[:500] if text else "No text extracted"
                }
            
            # Extract information with improved methods
            extracted_info = {
                'ic_number': ic_number,
                'name': self.extract_name_improved(text, ic_number),
                'address': self.extract_address_improved(text, ic_number),
                'gender': self.extract_gender_improved(text) or self.extract_gender_from_ic(ic_number),
                'date_of_birth': self.extract_date_of_birth(ic_number),
                'religion': self.extract_religion(text)
            }
            
            # Clean extracted info - set to None if looks like garbage
            if extracted_info['name'] and (
                len(extracted_info['name']) < 3 or 
                'SUIS EN TITY' in extracted_info['name'] or
                any(char in extracted_info['name'] for char in ['@', '#', '$', '%', '&'])
            ):
                extracted_info['name'] = None
                logger.warning("Name appears to be OCR garbage, setting to None")
            
            if extracted_info['address'] and (
                len(extracted_info['address']) < 5 or
                'KAM WAR' == extracted_info['address'].strip()
            ):
                extracted_info['address'] = None
                logger.warning("Address appears to be OCR garbage, setting to None")
            
            # Validate authenticity
            authenticity = self.validate_mykad_authenticity(text)
            
            # Overall success if we have IC number and reasonable authenticity
            success = bool(ic_number) and authenticity['authenticity_score'] > 0.3
            
            logger.info(f"✅ OCR Processing complete - IC: {ic_number}, Success: {success}")
            
            return {
                'success': success,
                'extracted_info': extracted_info,
                'authenticity': authenticity,
                'confidence': best_confidence,
                'raw_text': text
            }
            
        except Exception as e:
            logger.error(f"Error processing MyKad front: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'extracted_info': {},
                'confidence': 0
            }
    
    def calculate_text_confidence(self, text: str) -> float:
        """Calculate confidence score based on text quality"""
        try:
            if not text:
                return 0.0
            
            # Factors for confidence
            has_malaysia = 'MALAYSIA' in text.upper()
            has_ic_format = bool(re.search(r'\d{6}[-\s]?\d{2}[-\s]?\d{4}', text))
            has_gender = any(gender in text.upper() for gender in self.gender_patterns)
            has_warganegara = 'WARGANEGARA' in text.upper()
            
            # Character quality (ratio of alphanumeric to total)
            alnum_chars = sum(1 for c in text if c.isalnum())
            char_quality = alnum_chars / len(text) if text else 0
            
            # Length factor (reasonable text length)
            length_factor = min(1.0, len(text) / 200)
            
            confidence = (
                (0.3 if has_malaysia else 0) +
                (0.3 if has_ic_format else 0) +
                (0.2 if has_gender else 0) +
                (0.1 if has_warganegara else 0) +
                (char_quality * 0.1)
            ) * length_factor
            
            return min(1.0, confidence)
            
        except Exception as e:
            logger.error(f"Error calculating confidence: {e}")
            return 0.0
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Enhanced image preprocessing for better OCR"""
        try:
            # Convert to grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()
            
            # Apply THRESH_TRUNC as per Malaysian IC OCR best practices
            gray = cv2.threshold(gray, 127, 255, cv2.THRESH_TRUNC)[1]
            
            # Enhance contrast with CLAHE
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            
            # Denoise
            denoised = cv2.fastNlMeansDenoising(enhanced)
            
            # Apply morphological operations to improve text clarity
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
            processed = cv2.morphologyEx(denoised, cv2.MORPH_CLOSE, kernel)
            
            # Final threshold for clean text
            _, thresh = cv2.threshold(processed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            return thresh
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}")
            return image
    
    # Keep existing methods for compatibility
    def extract_date_of_birth(self, ic_number: str) -> Optional[str]:
        """Extract date of birth from IC number (unchanged)"""
        try:
            if not ic_number or len(ic_number) < 6:
                return None
            
            date_part = ic_number[:6]
            year = int(date_part[:2])
            month = date_part[2:4]
            day = date_part[4:6]
            
            # Determine century (Malaysian IC convention)
            if year >= 0 and year <= 99:
                if year <= 30:
                    full_year = 2000 + year
                else:
                    full_year = 1900 + year
            
            return f"{full_year}-{month}-{day}"
            
        except Exception as e:
            logger.error(f"Error extracting DOB: {str(e)}")
            return None
    
    def extract_gender_from_ic(self, ic_number: str) -> Optional[str]:
        """Extract gender from IC number (unchanged)"""
        try:
            if not ic_number or len(ic_number) < 14:
                return None
            
            last_digit = int(ic_number[-1])
            return "LELAKI" if last_digit % 2 == 1 else "PEREMPUAN"
            
        except Exception as e:
            logger.error(f"Error extracting gender from IC: {str(e)}")
            return None
    
    def extract_religion(self, text: str) -> Optional[str]:
        """Extract religion from OCR text (unchanged)"""
        try:
            text_upper = text.upper()
            
            for religion in self.religion_patterns:
                if religion in text_upper:
                    return religion
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting religion: {str(e)}")
            return None
    
    def validate_mykad_authenticity(self, text: str) -> Dict:
        """Validate MyKad authenticity (unchanged)"""
        try:
            text_upper = text.upper()
            
            found_keywords = []
            for keyword in self.mykad_keywords:
                if keyword in text_upper:
                    found_keywords.append(keyword)
            
            keyword_score = len(found_keywords) / len(self.mykad_keywords)
            
            has_ic_format = bool(re.search(r'\d{6}[-\s]?\d{2}[-\s]?\d{4}', text))
            has_gender = any(gender in text_upper for gender in self.gender_patterns)
            
            authenticity_score = (keyword_score * 0.6 + 
                                (1.0 if has_ic_format else 0.0) * 0.3 + 
                                (1.0 if has_gender else 0.0) * 0.1)
            
            return {
                'authenticity_score': authenticity_score,
                'found_keywords': found_keywords,
                'has_ic_format': has_ic_format,
                'has_gender': has_gender,
                'is_authentic': authenticity_score > 0.35
            }
            
        except Exception as e:
            logger.error(f"Error validating authenticity: {str(e)}")
            return {
                'authenticity_score': 0.0,
                'found_keywords': [],
                'has_ic_format': False,
                'has_gender': False,
                'is_authentic': False
            }
    
    def process_mykad_back(self, image: np.ndarray) -> Dict:
        """Simplified MyKad back image processing with basic success check"""
        try:
            logger.info("🔁 Starting MyKad back image processing")

            # Step 1: Preprocess image
            processed_image = self.preprocess_image(image)
            logger.info("🧪 Image preprocessing complete")

            # Step 2: Extract text via OCR
            text = pytesseract.image_to_string(processed_image, config=self.tesseract_config)
            logger.info(f"🔍 OCR extracted text: {repr(text[:200])}")

            # Step 3: Extract IC number
            ic_number_back = self.extract_ic_number(text)
            if ic_number_back:
                logger.info(f"✅ IC number found on back: {ic_number_back}")
            else:
                logger.warning("⚠️ No IC number found on back")

            # Step 4: Detect security features
            security_features = self.detect_security_features(image, text)
            logger.info(f"🔒 Security features: {json.dumps(security_features)}")

            # Step 5: Consider it a success if we get either IC or any security hint
            has_any_feature = any(security_features.values())
            success = bool(ic_number_back) or has_any_feature

            logger.info(f"🎯 Back scan result: {'PASS' if success else 'FAIL'}")

            return {
                'success': success,
                'ic_number_back': ic_number_back,
                'security_features': security_features,
                'raw_text': text
            }

        except Exception as e:
            logger.error(f"❌ Error processing MyKad back: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'ic_number_back': None,
                'security_features': {},
                'raw_text': ""
            }


    
    def detect_security_features(self, image: np.ndarray, text: str) -> Dict:
        """Detect security features on MyKad back"""
        try:
            features = {
                'has_signature_area': False,
                'has_chip_area': False,
                'has_barcode': False,
                'has_security_text': False
            }
            
            # Convert to grayscale for analysis
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect signature area (usually a rectangular region)
            contours, _ = cv2.findContours(gray, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                area = cv2.contourArea(contour)
                if 1000 < area < 10000:  # Signature area size range
                    features['has_signature_area'] = True
                    break
            
            # Detect chip area (metallic contact points)
            # Look for small rectangular regions with high contrast
            edges = cv2.Canny(gray, 50, 150)
            chip_contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for contour in chip_contours:
                area = cv2.contourArea(contour)
                if 100 < area < 1000:  # Chip contact area
                    features['has_chip_area'] = True
                    break
            
            # Check for security text
            text_upper = text.upper()
            security_keywords = ['TOUCH', 'GO', 'MALAYSIA', 'GOVERNMENT']
            if any(keyword in text_upper for keyword in security_keywords):
                features['has_security_text'] = True
            
            # Detect barcode-like patterns
            # Look for parallel lines (simplified barcode detection)
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
            detected_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, horizontal_kernel)
            if np.sum(detected_lines) > 1000:  # Threshold for barcode presence
                features['has_barcode'] = True
            
            return features
            
        except Exception as e:
            logger.error(f"Error detecting security features: {str(e)}")
            return {
                'has_signature_area': False,
                'has_chip_area': False,
                'has_barcode': False,
                'has_security_text': False
            }
    
    def validate_image_quality(self, image: np.ndarray) -> Dict:
        """Validate image quality for MyKad processing"""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Check image dimensions
            height, width = gray.shape
            min_width, min_height = 800, 500
            
            # Calculate sharpness using Laplacian variance
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # Calculate brightness
            brightness = np.mean(gray)
            
            # Calculate contrast
            contrast = np.std(gray)
            
            # Quality checks
            quality_checks = {
                # 'sufficient_resolution': width >= min_width and height >= min_height,
                'sufficient_sharpness': laplacian_var > 100,  # Threshold for sharpness
                'good_brightness': 50 < brightness < 200,     # Good brightness range
                'sufficient_contrast': contrast > 30,         # Minimum contrast
                'is_color': len(image.shape) == 3             # Must be color image
            }
            
            # Calculate overall quality score
            quality_score = sum(quality_checks.values()) / len(quality_checks)
            
            return {
                'quality_score': quality_score,
                'quality_checks': quality_checks,
                'metrics': {
                    # 'resolution': f"{width}x{height}",
                    'sharpness': laplacian_var,
                    'brightness': brightness,
                    'contrast': contrast
                },
                'is_acceptable': quality_score >= 0.8
            }
            
        except Exception as e:
            logger.error(f"Error validating image quality: {str(e)}")
            return {
                'quality_score': 0.0,
                'quality_checks': {},
                'metrics': {},
                'is_acceptable': False
            }