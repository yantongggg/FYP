# Complete ML Dependencies Installation Script
# Run this in your activated virtual environment

echo "🚀 Installing Biometric Authentication Dependencies"
echo "=================================================="

# Core ML Framework Dependencies
echo "📦 Installing TensorFlow..."
pip install tensorflow-cpu  # Use tensorflow-cpu for development, tensorflow for GPU

echo "📦 Installing PyTorch..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Computer Vision Dependencies
echo "📦 Installing Computer Vision libraries..."
pip install opencv-python==4.8.1.78
pip install opencv-contrib-python
pip install Pillow==10.0.1
pip install face-recognition==1.3.0
pip install dlib==19.24.2

# Scientific Computing
echo "📦 Installing Scientific Computing libraries..."
pip install numpy==1.24.3
pip install pandas==2.0.3
pip install scikit-learn==1.3.0
pip install matplotlib==3.7.2
pip install seaborn==0.12.2

# Flask Web Framework
echo "📦 Installing Flask dependencies..."
pip install Flask==2.3.3
pip install Flask-CORS==4.0.0
pip install requests==2.31.0

# Additional ML/AI Libraries
echo "📦 Installing additional ML libraries..."
pip install xgboost==1.7.6
pip install joblib==1.3.2
pip install pytesseract==0.3.10

# Database and Storage
echo "📦 Installing database dependencies..."
pip install supabase==1.0.4
pip install python-dotenv==1.0.0

# System Monitoring
echo "📦 Installing monitoring dependencies..."
pip install psutil==5.9.5

echo "✅ Installation Complete!"
echo ""
echo "🧪 Testing imports..."

# Test critical imports
python -c "
import sys
imports_to_test = [
    ('tensorflow', 'TensorFlow'),
    ('torch', 'PyTorch'), 
    ('cv2', 'OpenCV'),
    ('face_recognition', 'Face Recognition'),
    ('numpy', 'NumPy'),
    ('flask', 'Flask'),
    ('PIL', 'Pillow'),
    ('sklearn', 'Scikit-learn')
]

working = 0
total = len(imports_to_test)

for module, name in imports_to_test:
    try:
        __import__(module)
        print(f'✅ {name} - OK')
        working += 1
    except ImportError as e:
        print(f'❌ {name} - FAILED: {e}')

print(f'')
print(f'📊 Status: {working}/{total} dependencies working')

if working >= 6:
    print('✅ System ready for full biometric authentication!')
else:
    print('⚠️ Some dependencies missing - check errors above')
"

echo ""
echo "🎯 Next Steps:"
echo "1. Restart your Flask server: python app.py"
echo "2. You should see: '✅ TensorFlow: True' in the startup logs"
echo "3. HyperFAS model will be enabled alongside CDCN"
echo "4. Test the enhanced liveness detection"