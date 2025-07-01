# debug_model.py - Script to debug model loading and frontend issues

import torch
import torch.nn as nn
from torchvision import models
import os

def inspect_model_file(model_path):
    """Inspect the structure of your trained model"""
    print(f"🔍 Inspecting model file: {model_path}")
    
    if not os.path.exists(model_path):
        print(f"❌ Model file not found: {model_path}")
        return
    
    # Load the state dict
    try:
        state_dict = torch.load(model_path, map_location='cpu')
        print(f"✅ Model file loaded successfully")
        print(f"📊 Model contains {len(state_dict)} parameters")
        
        # Print first few keys to understand structure
        print("\n🔑 First 10 parameter keys:")
        for i, key in enumerate(list(state_dict.keys())[:10]):
            print(f"   {i+1}. {key}")
        
        # Check if it has backbone prefix
        has_backbone = any(key.startswith('backbone.') for key in state_dict.keys())
        has_resnet = any(key.startswith('resnet.') for key in state_dict.keys())
        
        print(f"\n🏗️ Architecture analysis:")
        print(f"   Has 'backbone.' prefix: {has_backbone}")
        print(f"   Has 'resnet.' prefix: {has_resnet}")
        print(f"   Direct ResNet structure: {not has_backbone and not has_resnet}")
        
        # Check final layer
        fc_keys = [key for key in state_dict.keys() if 'fc.' in key]
        print(f"   Final layer keys: {fc_keys}")
        
        if fc_keys:
            fc_key = fc_keys[0]
            fc_weight_shape = state_dict[fc_key].shape
            print(f"   Final layer shape: {fc_weight_shape}")
            print(f"   Number of classes: {fc_weight_shape[0]}")
        
        return state_dict
        
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return None

def create_compatible_model(state_dict):
    """Create a model that matches your trained model"""
    print("\n🏗️ Creating compatible model...")
    
    # Determine the correct architecture
    has_backbone = any(key.startswith('backbone.') for key in state_dict.keys())
    has_resnet = any(key.startswith('resnet.') for key in state_dict.keys())
    
    class CompatibleModel(nn.Module):
        def __init__(self, num_classes=2):
            super(CompatibleModel, self).__init__()
            
            # Create ResNet18
            try:
                self.model = models.resnet18(weights=None)
            except TypeError:
                self.model = models.resnet18(pretrained=False)
            
            # Replace final layer
            self.model.fc = nn.Linear(self.model.fc.in_features, num_classes)
        
        def forward(self, x):
            return self.model(x)
    
    model = CompatibleModel(num_classes=2)
    
    # Try to load the state dict with different strategies
    try:
        # Strategy 1: Direct loading
        model.load_state_dict(state_dict)
        print("✅ Direct loading successful")
        return model
    except:
        try:
            # Strategy 2: Map keys
            new_state_dict = {}
            for key, value in state_dict.items():
                if has_backbone:
                    new_key = key.replace('backbone.', 'model.')
                elif has_resnet:
                    new_key = key.replace('resnet.', 'model.')
                else:
                    new_key = f'model.{key}'
                new_state_dict[new_key] = value
            
            model.load_state_dict(new_state_dict)
            print("✅ Key mapping loading successful")
            return model
        except:
            try:
                # Strategy 3: Partial loading
                model.load_state_dict(new_state_dict, strict=False)
                print("✅ Partial loading successful")
                return model
            except Exception as e:
                print(f"❌ All loading strategies failed: {e}")
                return None

def test_model_inference(model, device='cpu'):
    """Test if the model can perform inference"""
    print("\n🧪 Testing model inference...")
    
    if model is None:
        print("❌ No model to test")
        return False
    
    try:
        model.eval()
        model = model.to(device)
        
        # Create dummy input (batch_size=1, channels=3, height=224, width=224)
        dummy_input = torch.randn(1, 3, 224, 224).to(device)
        
        with torch.no_grad():
            output = model(dummy_input)
            probabilities = torch.softmax(output, dim=1)
            
        print(f"✅ Inference successful!")
        print(f"   Output shape: {output.shape}")
        print(f"   Probabilities: {probabilities[0].cpu().numpy()}")
        print(f"   Predicted class: {torch.argmax(probabilities, dim=1).item()}")
        
        return True
        
    except Exception as e:
        print(f"❌ Inference failed: {e}")
        return False

def check_frontend_files():
    """Check if frontend files exist and suggest issues"""
    print("\n🌐 Checking frontend files...")
    
    frontend_files_to_check = [
        "src/components/BiometricCapture.tsx",
        "src/components/EnhancedFaceCapture.tsx", 
        "src/pages/Register.tsx",
        "src/pages/Login.tsx"
    ]
    
    for file_path in frontend_files_to_check:
        if os.path.exists(file_path):
            print(f"   ✅ {file_path}")
        else:
            print(f"   ❌ {file_path} - NOT FOUND")
    
    print("\n💡 Common issues with blinking/progress:")
    print("   1. MediaPipe not loading properly in frontend")
    print("   2. Camera permissions not granted")
    print("   3. Frontend not calling backend API correctly") 
    print("   4. CORS issues between frontend and backend")
    print("   5. Face detection landmarks not calculated properly")

def main():
    """Main debugging function"""
    print("🔍 CDCN MODEL AND FRONTEND DEBUG SCRIPT")
    print("=" * 60)
    
    # Check for model files
    model_paths = [
        "anti_spoofing_resnet18.pth",
        "models/anti_spoofing_resnet18.pth",
        "backend/anti_spoofing_resnet18.pth",
        "backend/models/anti_spoofing_resnet18.pth"
    ]
    
    model_found = None
    for path in model_paths:
        if os.path.exists(path):
            model_found = path
            break
    
    if model_found:
        # Inspect and test the model
        state_dict = inspect_model_file(model_found)
        if state_dict:
            model = create_compatible_model(state_dict)
            test_model_inference(model)
    else:
        print("❌ No model file found in any expected location")
        print("Expected locations:")
        for path in model_paths:
            print(f"   - {path}")
    
    # Check frontend
    check_frontend_files()
    
    print("\n" + "=" * 60)
    print("🎯 NEXT STEPS:")
    if model_found:
        print("✅ 1. Your model file was found - check the output above")
        print("📝 2. Save the working model architecture code")
        print("🔄 3. Update your app.py with the correct model structure")
    else:
        print("❌ 1. Place your anti_spoofing_resnet18.pth file in the backend folder")
    
    print("🌐 4. Check your frontend console for JavaScript errors")
    print("📹 5. Verify camera permissions are granted")
    print("🔗 6. Test API endpoints: curl http://localhost:5000/api/health")

if __name__ == "__main__":
    main()