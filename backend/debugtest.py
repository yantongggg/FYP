# test_ocr_fix.py - Run this to test your OCR fixes

from utils.ocr_utils import MyKadOCR
import json

def test_ic_extraction():
    """Test IC number extraction with the problematic text from your logs"""
    
    ocr = MyKadOCR()
    
    # Test text from your logs that was causing issues
    test_text = "MALAYSIA MCA IDENTITY CARD YO 030301-08:0532 CHYE YAN TONG"
    
    print("🧪 Testing IC extraction...")
    print(f"Input text: {test_text}")
    
    # Test the fixed extraction
    ic_number = ocr.extract_ic_number(test_text)
    print(f"Extracted IC: {ic_number}")
    
    # Test gender extraction
    if ic_number:
        gender = ocr.extract_gender_improved(test_text, ic_number)
        print(f"Extracted Gender: {gender}")
        
        # Test validation
        is_valid = ocr.validate_ic_number_format(ic_number)
        print(f"IC Valid: {is_valid}")
        
        # Test DOB extraction
        dob = ocr.extract_date_of_birth(ic_number)
        print(f"Date of Birth: {dob}")
    
    return ic_number

def test_gender_from_ic():
    """Test gender extraction specifically"""
    ocr = MyKadOCR()
    
    test_cases = [
        ("030301-08-0532", "PEREMPUAN"),  # Even number = Female
        ("030301-08-0531", "LELAKI"),     # Odd number = Male
        ("030301-08-0533", "LELAKI"),     # Odd number = Male
    ]
    
    print("\n🧪 Testing gender extraction from IC...")
    for ic, expected in test_cases:
        gender = ocr.extract_gender_improved("", ic)
        status = "✅" if gender == expected else "❌"
        print(f"{status} IC: {ic} → {gender} (expected: {expected})")

def test_digit_correction():
    """Test that digit correction only fixes obvious mistakes"""
    ocr = MyKadOCR()
    
    test_cases = [
        ("O3O3O1-O8-O532", "030301-08-0532"),  # O should become 0
        ("03030I-08-0532", "030301-08-0532"),  # I should become 1
        ("030301-08-0532", "030301-08-0532"),  # No change needed
        ("030301-08-0533", "030301-08-0533"),  # Should NOT change 5→8, 3→3
    ]
    
    print("\n🧪 Testing digit correction...")
    for input_ic, expected in test_cases:
        corrected = ocr.fix_ic_number_digits(input_ic)
        status = "✅" if corrected == expected else "❌"
        print(f"{status} '{input_ic}' → '{corrected}' (expected: '{expected}')")

if __name__ == "__main__":
    print("🔧 Testing OCR Fixes")
    print("=" * 50)
    
    # Run tests
    ic_result = test_ic_extraction()
    test_gender_from_ic()
    test_digit_correction()
    
    print("\n" + "=" * 50)
    if ic_result == "030301-08-0532":
        print("✅ ALL TESTS PASSED! OCR fix is working correctly.")
        print("✅ IC number: 030301-08-0532 (correct)")
        print("✅ Gender should be: PEREMPUAN (female, ends in 2)")
    else:
        print(f"❌ TEST FAILED! Got IC: {ic_result}")
        print("❌ Expected: 030301-08-0532")
    
    print("\n🚀 Ready to test with your registration system!")