"""
Debug script to test liveness detection logic
Run this to see what's happening with the counters
"""

import requests
import base64
import time
import cv2
import numpy as np

def create_test_image():
    """Create a simple test image"""
    img = np.ones((480, 640, 3), dtype=np.uint8) * 255
    cv2.putText(img, "TEST FRAME", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 0), 3)
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')

def test_liveness_api():
    """Test the liveness detection API"""
    base_url = "http://localhost:5000/api/sequential-liveness-detect"
    user_id = "test_debug_user"
    
    # Test 1: Reset counters
    print("\n=== TEST 1: Reset Counters ===")
    response = requests.post(base_url, json={
        "user_id": user_id,
        "face_image": f"data:image/jpeg;base64,{create_test_image()}",
        "mode": "registration",
        "reset_counters": True,
        "current_step": "ready"
    })
    print(f"Response: {response.json()}")
    
    # Test 2: Multiple calls without reset
    print("\n=== TEST 2: Multiple Calls Without Reset ===")
    for i in range(3):
        time.sleep(1)
        response = requests.post(base_url, json={
            "user_id": user_id,
            "face_image": f"data:image/jpeg;base64,{create_test_image()}",
            "mode": "registration",
            "reset_counters": False,
            "current_step": "blink_prompt"
        })
        result = response.json()
        print(f"\nCall {i+1}:")
        print(f"  Blinks: {result.get('blink_count', 0)}")
        print(f"  Mouth: {result.get('mouth_open_count', 0)}")
        print(f"  Head: {result.get('head_movement_count', 0)}")
    
    # Test 3: Reset and check
    print("\n=== TEST 3: Reset and Check ===")
    response = requests.post(base_url, json={
        "user_id": user_id,
        "face_image": f"data:image/jpeg;base64,{create_test_image()}",
        "mode": "registration",
        "reset_counters": True,
        "current_step": "ready"
    })
    result = response.json()
    print(f"After reset:")
    print(f"  Blinks: {result.get('blink_count', 0)}")
    print(f"  Mouth: {result.get('mouth_open_count', 0)}")
    print(f"  Head: {result.get('head_movement_count', 0)}")

if __name__ == "__main__":
    print("Starting Liveness Detection Debug Test...")
    print("Make sure your Flask server is running on http://localhost:5000")
    input("Press Enter to continue...")
    
    try:
        test_liveness_api()
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure the Flask server is running!")