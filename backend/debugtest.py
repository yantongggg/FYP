# login_debug_test.py - Test script to debug login issues

import requests
import json
import base64
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_login_flow():
    """Test the complete login flow step by step"""
    
    base_url = "http://localhost:5000/api"
    
    # Test data
    test_email = "demo@user.com"
    test_password = "demo"
    
    print("🚀 Starting login flow test...")
    
    # Step 1: Test basic credentials login
    print("\n📝 Step 1: Testing credentials login...")
    
    login_data = {
        "email": test_email,
        "password": test_password
    }
    
    try:
        response = requests.post(f"{base_url}/login", json=login_data, timeout=10)
        print(f"Login response status: {response.status_code}")
        print(f"Login response: {response.json()}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Login successful - no biometric required")
                return
            elif result.get('error') == 'BIOMETRIC_REQUIRED':
                print("🔐 Biometric verification required")
                user_id = result.get('user_id')
                email = result.get('email')
                
                # Step 2: Test face verification with dummy data
                print("\n📸 Step 2: Testing face verification...")
                test_face_verification(user_id, email)
                
            else:
                print(f"❌ Login failed: {result.get('error')}")
        else:
            print(f"❌ Login request failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Login test error: {e}")

def test_face_verification(user_id, email):
    """Test face verification with dummy base64 image"""
    
    # Create a simple dummy base64 image (1x1 white pixel)
    dummy_image_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHBAiH3NAAAAABJRU5ErkJggg=="
    
    verification_data = {
        "user_id": user_id,
        "face_image": dummy_image_b64
    }
    
    try:
        response = requests.post(
            "http://localhost:5000/api/biometric-login-verify", 
            json=verification_data, 
            timeout=10
        )
        
        print(f"Face verification status: {response.status_code}")
        print(f"Face verification response: {response.json()}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Face verification successful")
            else:
                print(f"❌ Face verification failed: {result.get('error')}")
        else:
            print(f"❌ Face verification request failed")
            
    except Exception as e:
        print(f"❌ Face verification test error: {e}")

def test_database_connection():
    """Test database connection"""
    
    try:
        response = requests.get("http://localhost:5000/api/health", timeout=5)
        print(f"Health check status: {response.status_code}")
        result = response.json()
        
        print("🏥 Health Check Results:")
        print(f"  - Status: {result.get('status')}")
        print(f"  - Detector available: {result.get('detector_available')}")
        print(f"  - Supabase available: {result.get('supabase_available')}")
        print(f"  - Face verifier available: {result.get('face_verifier_available')}")
        
        return result.get('status') == 'online'
        
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_user_creation():
    """Test if demo user exists"""
    
    try:
        check_data = {
            "email": "demo@user.com"
        }
        
        response = requests.post(
            "http://localhost:5000/api/check-user", 
            json=check_data, 
            timeout=5
        )
        
        print(f"User check status: {response.status_code}")
        result = response.json()
        
        if result.get('success'):
            if result.get('exists'):
                print("✅ Demo user exists")
                return True
            else:
                print("❌ Demo user does not exist - please register first")
                return False
        else:
            print(f"❌ User check failed: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ User check error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🐛 LOGIN DEBUG TEST SCRIPT")
    print("=" * 60)
    
    # Test 1: Database connection
    print("\n🔍 Testing database connection...")
    if not test_database_connection():
        print("❌ Database connection failed - check server")
        exit(1)
    
    # Test 2: Demo user existence
    print("\n👤 Checking demo user...")
    if not test_user_creation():
        print("❌ Demo user not found - please register first")
        exit(1)
    
    # Test 3: Login flow
    print("\n🔐 Testing login flow...")
    test_login_flow()
    
    print("\n" + "=" * 60)
    print("🏁 Debug test completed")
    print("=" * 60)