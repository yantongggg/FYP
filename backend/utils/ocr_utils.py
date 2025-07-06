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
    """OCR utilities specifically for Malaysian IC (MyKad) processing"""
    
    def __init__(self):
        # Set Tesseract path for Windows
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

        self.tesseract_configs = [
        '--oem 3 --psm 6',  # Default config without char whitelist
        '--oem 3 --psm 7',  # Single text line
        '--oem 3 --psm 8',  # Single word
        '--oem 3 --psm 13', # Raw line
        '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789-'  # Numbers and dash only
    ]
    
        
        # Configure Tesseract for better OCR results
        self.tesseract_config = '--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/., '
        
        # MyKad specific patterns
        self.ic_number_pattern = r'(\d{6}-\d{2}-\d{4})'
        self.gender_patterns = ['LELAKI', 'PEREMPUAN']
        self.religion_patterns = ['ISLAM', 'KRISTIAN', 'BUDDHA', 'HINDU', 'SIKH', 'LAIN-LAIN']
        
        # Common MyKad keywords for validation
        self.mykad_keywords = [
            'WARGANEGARA', 'MALAYSIA', 'MYKAD', 'LELAKI', 'PEREMPUAN',
            'ISLAM', 'KRISTIAN', 'BUDDHA', 'HINDU'
        ]
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR results using THRESH_TRUNC as per Malaysian IC OCR repo"""
        try:
            # Convert to grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()
            
            # Apply THRESH_TRUNC as per the GitHub repo
            gray = cv2.threshold(gray, 127, 255, cv2.THRESH_TRUNC)[1]
            
            # Apply CLAHE for better contrast
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            
            # Denoise
            denoised = cv2.fastNlMeansDenoising(enhanced)
            
            # Apply additional threshold for better text extraction
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            return thresh
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}")
            return image
        
    def extract_ic_number(self, text: str) -> Optional[str]:
        """Extract IC number from OCR text with multiple patterns"""
        try:
            logger.info(f"OCR extracted text: {repr(text)}")  # Debug logging
            
            # Multiple IC number patterns to try
            patterns = [
                r'(\d{6}-\d{2}-\d{4})',           # Standard format
                r'(\d{6}\s*-\s*\d{2}\s*-\s*\d{4})', # With spaces
                r'(\d{6}\s+\d{2}\s+\d{4})',       # Space separated
                r'(\d{12})',                       # All digits together
                r'(\d{6}[-\s]?\d{2}[-\s]?\d{4})', # Flexible separators
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, text)
                for match in matches:
                    # Normalize the format
                    digits_only = re.sub(r'[^\d]', '', match)
                    if len(digits_only) == 12:
                        formatted = f"{digits_only[:6]}-{digits_only[6:8]}-{digits_only[8:]}"
                        if self.validate_ic_number_format(formatted):
                            logger.info(f"IC number extracted: {formatted}")
                            return formatted
            
            logger.warning(f"No valid IC number found in text: {text[:200]}...")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting IC number: {str(e)}")
            return None
    
    def validate_ic_number_format(self, ic_number: str) -> bool:
        """Validate IC number format and basic checks"""
        try:
            if not ic_number or len(ic_number) != 14:
                return False
            
            # Check format: YYMMDD-XX-XXXX
            if not re.match(r'^\d{6}-\d{2}-\d{4}$', ic_number):
                return False
            
            # Extract date parts
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
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating IC number: {str(e)}")
            return False
    
    def extract_date_of_birth(self, ic_number: str) -> Optional[str]:
        """Extract date of birth from IC number"""
        try:
            if not ic_number or len(ic_number) < 6:
                return None
            
            date_part = ic_number[:6]
            year = int(date_part[:2])
            month = date_part[2:4]
            day = date_part[4:6]
            
            # Determine century (Malaysian IC convention)
            if year >= 0 and year <= 99:
                # Assume 20xx for years 00-30, 19xx for years 31-99
                if year <= 30:
                    full_year = 2000 + year
                else:
                    full_year = 1900 + year
            
            return f"{full_year}-{month}-{day}"
            
        except Exception as e:
            logger.error(f"Error extracting DOB: {str(e)}")
            return None
    
    def extract_gender_from_ic(self, ic_number: str) -> Optional[str]:
        """Extract gender from IC number (last digit)"""
        try:
            if not ic_number or len(ic_number) < 14:
                return None
            
            last_digit = int(ic_number[-1])
            return "LELAKI" if last_digit % 2 == 1 else "PEREMPUAN"
            
        except Exception as e:
            logger.error(f"Error extracting gender from IC: {str(e)}")
            return None
    
    def extract_name(self, text: str, ic_number: str) -> Optional[str]:
        """Extract name from OCR text"""
        try:
            lines = text.split('\n')
            
            # Name is typically in the first few lines, before IC number
            ic_line_index = -1
            for i, line in enumerate(lines):
                if ic_number in line:
                    ic_line_index = i
                    break
            
            # Look for name in lines before IC number
            potential_names = []
            search_lines = lines[:ic_line_index] if ic_line_index > 0 else lines[:5]
            
            for line in search_lines:
                cleaned_line = line.strip()
                # Skip empty lines and lines with only numbers/symbols
                if (len(cleaned_line) > 2 and 
                    not re.match(r'^[\d\-\s]+$', cleaned_line) and
                    not any(keyword in cleaned_line.upper() for keyword in ['WARGANEGARA', 'MALAYSIA'])):
                    
                    # Remove common OCR artifacts
                    cleaned_name = re.sub(r'[^\w\s]', ' ', cleaned_line)
                    cleaned_name = ' '.join(cleaned_name.split())
                    
                    if len(cleaned_name) > 3:
                        potential_names.append(cleaned_name)
            
            # Return the most likely name (usually the longest valid one)
            if potential_names:
                return max(potential_names, key=len).upper()
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting name: {str(e)}")
            return None
    
    def extract_address(self, text: str) -> Optional[str]:
        """Extract address from OCR text"""
        try:
            lines = text.split('\n')
            
            # Address is typically after the name and before religion/gender
            address_lines = []
            start_collecting = False
            
            for line in lines:
                cleaned_line = line.strip()
                
                # Skip empty lines
                if not cleaned_line:
                    continue
                
                # Stop collecting if we hit gender/religion keywords
                if any(keyword in cleaned_line.upper() for keyword in self.gender_patterns + self.religion_patterns):
                    break
                
                # Start collecting after we see a potential name line
                if (len(cleaned_line) > 10 and 
                    not re.match(r'^[\d\-\s]+$', cleaned_line) and
                    not any(keyword in cleaned_line.upper() for keyword in ['WARGANEGARA', 'MALAYSIA'])):
                    start_collecting = True
                    continue
                
                # Collect address lines
                if start_collecting and len(cleaned_line) > 5:
                    # Clean up the line
                    cleaned_address = re.sub(r'[^\w\s,.]', ' ', cleaned_line)
                    cleaned_address = ' '.join(cleaned_address.split())
                    
                    if cleaned_address:
                        address_lines.append(cleaned_address)
            
            # Combine address lines
            if address_lines:
                return ', '.join(address_lines[:3])  # Limit to first 3 lines
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting address: {str(e)}")
            return None
    
    def extract_gender_from_text(self, text: str) -> Optional[str]:
        """Extract gender from OCR text"""
        try:
            text_upper = text.upper()
            
            for gender in self.gender_patterns:
                if gender in text_upper:
                    return gender
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting gender from text: {str(e)}")
            return None
    
    def extract_religion(self, text: str) -> Optional[str]:
        """Extract religion from OCR text"""
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
        """Validate MyKad authenticity based on text content"""
        try:
            text_upper = text.upper()
            
            # Check for required keywords
            found_keywords = []
            for keyword in self.mykad_keywords:
                if keyword in text_upper:
                    found_keywords.append(keyword)
            
            # Calculate authenticity score
            keyword_score = len(found_keywords) / len(self.mykad_keywords)
            
            # Additional checks
            has_ic_format = bool(re.search(self.ic_number_pattern, text))
            has_gender = any(gender in text_upper for gender in self.gender_patterns)
            
            # Overall authenticity score
            authenticity_score = (keyword_score * 0.6 + 
                                (1.0 if has_ic_format else 0.0) * 0.3 + 
                                (1.0 if has_gender else 0.0) * 0.1)
            
            return {
                'authenticity_score': authenticity_score,
                'found_keywords': found_keywords,
                'has_ic_format': has_ic_format,
                'has_gender': has_gender,
                'is_authentic': authenticity_score > 0.6
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
    
    def process_mykad_front(self, image: np.ndarray) -> Dict:
        """Process MyKad front image and extract all information"""
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image)
            
            # Try multiple OCR configurations
            text = None
            ic_number = None
            
            for config in self.tesseract_configs:
                try:
                    text = pytesseract.image_to_string(processed_image, config=config)
                    ic_number = self.extract_ic_number(text)
                    if ic_number:
                        logger.info(f"IC number found with config: {config}")
                        break
                except Exception as e:
                    logger.warning(f"OCR config {config} failed: {e}")
                    continue
            
            if not ic_number:
                # Try with original image if preprocessing failed
                try:
                    text = pytesseract.image_to_string(image, config=self.tesseract_configs[0])
                    ic_number = self.extract_ic_number(text)
                except Exception as e:
                    logger.error(f"Fallback OCR failed: {e}")
            
            if not ic_number:
                return {
                    'success': False,
                    'error': 'Could not extract IC number',
                    'extracted_info': {},
                    'debug_text': text[:500] if text else "No text extracted"
                }
            
            # Rest of your existing extraction code...
            extracted_info = {
                'ic_number': ic_number,
                'name': self.extract_name(text, ic_number),
                'address': self.extract_address(text),
                'gender': self.extract_gender_from_text(text) or self.extract_gender_from_ic(ic_number),
                'date_of_birth': self.extract_date_of_birth(ic_number),
                'religion': self.extract_religion(text)
            }
            
            # Validate authenticity
            authenticity = self.validate_mykad_authenticity(text)
            
            return {
                'success': True,
                'extracted_info': extracted_info,
                'authenticity': authenticity,
                'raw_text': text
            }
            
        except Exception as e:
            logger.error(f"Error processing MyKad front: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'extracted_info': {}
        }

    def preprocess_image_alternative(self, image: np.ndarray) -> np.ndarray:
        """Alternative preprocessing for difficult images"""
        try:
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()
            
            # Try adaptive threshold instead of fixed threshold
            adaptive_thresh = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            return adaptive_thresh
            
        except Exception as e:
            logger.error(f"Alternative preprocessing failed: {e}")
            return image
    
    def process_mykad_back(self, image: np.ndarray) -> Dict:
        """Process MyKad back image and validate"""
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image)
            
            # Extract text using OCR
            text = pytesseract.image_to_string(processed_image, config=self.tesseract_config)
            
            # Extract IC number from back
            ic_number_back = self.extract_ic_number(text)
            
            # Check for security features (simulated)
            security_features = self.detect_security_features(image, text)
            
            return {
                'success': True,
                'ic_number_back': ic_number_back,
                'security_features': security_features,
                'raw_text': text
            }
            
        except Exception as e:
            logger.error(f"Error processing MyKad back: {str(e)}")
            return {
                'success': False,
                'error': str(e)
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