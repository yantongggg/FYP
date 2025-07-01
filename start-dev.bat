@echo off
echo Starting Biometric Authentication System...

echo Activating virtual environment and starting Backend (Flask)...
start cmd /k "call venv\Scripts\activate && cd backend && python app.py"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo  Starting Frontend (React)...
start cmd /k "cd src && npm run dev"

echo.
echo  Both servers starting!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:5000
echo  Health Check: http://localhost:5000/api/health
echo.
echo Press any key to continue...
pause > nul
