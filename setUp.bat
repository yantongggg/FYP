@echo off
REM =============================================================================
REM eKYC Biometric Authentication System - Windows Setup Script
REM =============================================================================

echo 🚀 eKYC Biometric Authentication System Setup
echo ==============================================
echo.

REM Check if Python is installed
echo 🔍 Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found. Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)
echo ✅ Python found

REM Check if Node.js is installed  
echo 🔍 Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js found

REM Create virtual environment
echo 🐍 Setting up Python virtual environment...
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

echo ✅ Virtual environment activated

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

echo 📦 Installing Python dependencies...
echo =================================

REM Core ML Framework Dependencies
echo Installing TensorFlow...
pip install tensorflow==2.13.0

echo Installing PyTorch...
pip install torch==2.0.1+cpu torchvision==0.15.2+cpu torchaudio==2.0.2+cpu --find-links https://download.pytorch.org/whl/cpu/torch_stable.html

REM Computer Vision Dependencies
echo Installing Computer Vision libraries...
pip install opencv-python==4.8.1.78
pip install opencv-contrib-python==4.8.1.78
pip install Pillow==10.0.1
pip install face-recognition==1.3.0
pip install dlib==19.24.2
pip install facenet-pytorch==2.5.3

REM Scientific Computing
echo Installing Scientific Computing libraries...
pip install numpy==1.24.3
pip install pandas==2.0.3
pip install scipy==1.11.2
pip install scikit-learn==1.3.0
pip install matplotlib==3.7.2
pip install seaborn==0.12.2

REM Flask Web Framework
echo Installing Flask dependencies...
pip install Flask==2.3.3
pip install Flask-CORS==4.0.0
pip install requests==2.31.0

REM Additional ML/AI Libraries
echo Installing additional ML libraries...
pip install xgboost==1.7.6
pip install joblib==1.3.2
pip install pytesseract==0.3.10
pip install easyocr==1.7.0

REM Database and Storage
echo Installing database dependencies...
pip install supabase==1.0.4
pip install python-dotenv==1.0.0

REM Security
echo Installing security dependencies...
pip install bcrypt==4.0.1
pip install cryptography==41.0.4

REM System Monitoring
echo Installing monitoring dependencies...
pip install psutil==5.9.5

REM Additional utilities
echo Installing additional utilities...
pip install email-validator==2.0.0
pip install secure-smtplib==0.1.1
pip install loguru==0.7.1
pip install h5py==3.9.0
pip install imutils==0.5.4
pip install scikit-image==0.21.0

echo ✅ Python dependencies installed

REM Install Node.js dependencies
echo 📦 Installing Node.js dependencies...
echo ===============================

REM Check if package.json exists
if not exist "package.json" (
    echo Creating basic package.json...
    npm init -y
)

REM Install frontend dependencies
echo Installing React and core dependencies...
npm install react@^18.2.0 react-dom@^18.2.0 react-router-dom@^6.15.0

echo Installing UI and animation libraries...
npm install framer-motion@^10.16.0 lucide-react@^0.344.0 clsx@^2.0.0

echo Installing utility libraries...
npm install lodash@^4.17.21 date-fns@^2.30.0

echo Installing Supabase client...
npm install @supabase/supabase-js@^2.38.0

echo Installing chart and PDF libraries...
npm install recharts@^2.8.0 jspdf@^3.0.1 jspdf-autotable@^5.0.2

echo Installing development dependencies...
npm install --save-dev @types/react@^18.2.15 @types/react-dom@^18.2.7 @types/lodash@^4.14.195
npm install --save-dev @vitejs/plugin-react@^4.0.3 vite@^4.4.5
npm install --save-dev typescript@^5.0.2 tailwindcss@^3.3.0 autoprefixer@^10.4.14 postcss@^8.4.27
npm install --save-dev eslint@^8.45.0 @typescript-eslint/eslint-plugin@^6.0.0 @typescript-eslint/parser@^6.0.0

echo ✅ Node.js dependencies installed

REM Test Python imports
echo 🧪 Testing Python imports...
echo ========================

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
    ('sklearn', 'Scikit-learn'),
    ('supabase', 'Supabase'),
    ('bcrypt', 'Bcrypt'),
    ('pandas', 'Pandas'),
    ('scipy', 'SciPy')
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

if working >= 10:
    print('✅ System ready for full biometric authentication!')
else:
    print('⚠️ Some dependencies missing - check errors above')
"

REM Create environment file template if it doesn't exist
if not exist ".env" (
    echo 📝 Creating environment file template...
    (
        echo # =============================================================================
        echo # eKYC Biometric Authentication System - Environment Configuration
        echo # =============================================================================
        echo.
        echo # Supabase Configuration
        echo VITE_SUPABASE_URL=https://your-project.supabase.co
        echo VITE_SUPABASE_ANON_KEY=your_anon_key
        echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
        echo.
        echo # Flask Configuration
        echo FLASK_ENV=development
        echo FLASK_DEBUG=true
        echo SECRET_KEY=your_secret_key_here
        echo.
        echo # ML Model Paths
        echo LIVENESS_MODEL_PATH=./backend/models/liveness_model.pth
        echo FACE_RECOGNITION_MODEL_PATH=./backend/models/face_model.pth
        echo.
        echo # Email Configuration ^(Optional^)
        echo SMTP_SERVER=smtp.gmail.com
        echo SMTP_PORT=587
        echo EMAIL_USER=your_email@gmail.com
        echo EMAIL_PASSWORD=your_app_password
        echo.
        echo # Security Settings
        echo BCRYPT_LOG_ROUNDS=12
        echo JWT_SECRET_KEY=your_jwt_secret_key
        echo.
        echo # Monitoring ^& Logging
        echo LOG_LEVEL=INFO
        echo ENABLE_METRICS=true
    ) > .env
    echo ✅ .env template created
    echo ⚠️ Please edit .env file with your actual configuration
)

REM Create basic project structure
echo 📁 Creating project structure...
mkdir backend\routes 2>nul
mkdir backend\utils 2>nul
mkdir backend\ml_models 2>nul
mkdir backend\models 2>nul
mkdir src\components 2>nul
mkdir src\pages 2>nul
mkdir src\hooks 2>nul
mkdir src\utils 2>nul
mkdir src\types 2>nul
mkdir public 2>nul
mkdir supabase\functions 2>nul
mkdir supabase\migrations 2>nul
echo ✅ Project structure created

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next Steps:
echo 1. Edit the .env file with your Supabase credentials
echo 2. Set up your Supabase database schema
echo 3. Deploy Supabase Edge Functions
echo 4. Start the Flask backend: python backend\app.py
echo 5. Start the React frontend: npm run dev
echo.
echo 📚 Documentation:
echo - Backend API: http://localhost:5000
echo - Frontend: http://localhost:3000
echo - Supabase Dashboard: https://app.supabase.com
echo.

pause