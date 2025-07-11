import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  LogIn,
  Camera,
  User,
  CheckCircle,
  Loader2,
  Shield,
  Clock,
  RefreshCw,
  Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginState {
  email: string;
  password: string;
}

interface FaceVerificationStep {
  user_id: string;
  email: string;
  full_name: string;
}

interface OTPStep {
  user_id: string;
  email: string;
  otp_id: string;
  attempts: number;
  expires_in_minutes: number;
  dev_otp?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginWithFace, loading } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState<LoginState>({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Multi-step login state
  const [currentStep, setCurrentStep] = useState<'credentials' | 'face' | 'otp'>('credentials');
  const [faceStep, setFaceStep] = useState<FaceVerificationStep | null>(null);
  const [otpStep, setOTPStep] = useState<OTPStep | null>(null);
  
  // Face verification state
  const [faceData, setFaceData] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [faceAttempts, setFaceAttempts] = useState(0);
  
  // OTP state
  const [otpCode, setOTPCode] = useState('');
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [otpCountdown, setOTPCountdown] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ============= FORM HANDLERS =============
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  // ============= STEP 1: CREDENTIALS LOGIN =============
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setError('');
      
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (result.success) {
        // Complete login (no biometric required)
        await login(formData.email, formData.password);
        navigate('/dashboard');
      } else if (result.error === 'BIOMETRIC_REQUIRED') {
        // Move to face verification step
        setFaceStep({
          user_id: result.user_id,
          email: result.email,
          full_name: result.full_name || result.email
        });
        setCurrentStep('face');
        setError('');
      } else if (result.error === 'ACCOUNT_LOCKED') {
        setError(`Account locked. ${result.message || 'Please try again later.'}`);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error: any) {
      setError('Network error. Please check your connection.');
    }
  };

  // ============= STEP 2: FACE VERIFICATION =============
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      setError('Camera access denied. Please allow camera access or use email verification.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Flip horizontally for mirror effect
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const capturedData = canvas.toDataURL('image/jpeg', 0.8);
    setFaceData(capturedData);
    
    // Stop camera
    const stream = video.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const handleFaceVerification = async () => {
    if (!faceData || !faceStep) {
      setError('Please capture your face first');
      return;
    }

    try {
      setError('');
      
      const response = await fetch('http://localhost:5000/api/biometric-login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: faceStep.user_id,
          face_image: faceData
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Face verification successful - complete login
        await login(formData.email, formData.password);
        navigate('/dashboard');
      } else {
        // Face verification failed
        const newAttempts = faceAttempts + 1;
        setFaceAttempts(newAttempts);
        
        if (newAttempts >= 3) {
          // 🔥 NEW: After 3 failures, automatically show email option
          setError(`Face verification failed ${newAttempts} times. Switching to email verification for security.`);
          // Auto-trigger email OTP
          setTimeout(() => {
            requestOTP();
          }, 2000);
        } else {
          setError(`Face verification failed (${newAttempts}/3 attempts). ${result.message || 'Please try again.'}`);
        }
        
        // Reset face data for retry
        setFaceData('');
      }
    } catch (error: any) {
      setError('Network error during face verification');
    }
  };

  // ============= STEP 3: EMAIL OTP FALLBACK =============
  const requestOTP = async () => {
    if (!faceStep) return;
    
    setSendingOTP(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5000/api/send-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: faceStep.user_id,
          email: faceStep.email,
          reason: faceAttempts >= 3 ? 'face_verification_failed' : 'user_requested'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setOTPStep({
          user_id: faceStep.user_id,
          email: faceStep.email,
          otp_id: result.otp_id,
          attempts: 0,
          expires_in_minutes: result.expires_in_minutes,
          dev_otp: result.dev_otp
        });
        setCurrentStep('otp');
        
        // Start countdown
        setOTPCountdown(result.expires_in_minutes * 60);
        const countdown = setInterval(() => {
          setOTPCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdown);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
      } else {
        setError(result.error || 'Failed to send verification code');
      }
    } catch (error) {
      setError('Network error while sending verification code');
    } finally {
      setSendingOTP(false);
    }
  };

  const handleOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode || !otpStep) {
      setError('Please enter the verification code');
      return;
    }

    setVerifyingOTP(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5000/api/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: otpStep.user_id,
          email: otpStep.email,
          otp_code: otpCode
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // OTP verification successful - complete login
        await login(formData.email, formData.password);
        navigate('/dashboard');
      } else {
        const newAttempts = otpStep.attempts + 1;
        setOTPStep(prev => prev ? { ...prev, attempts: newAttempts } : null);
        
        if (newAttempts >= 5) {
          setError('Too many failed attempts. Please restart the login process.');
          // Reset to credentials step
          setTimeout(() => {
            setCurrentStep('credentials');
            setFaceStep(null);
            setOTPStep(null);
            setFaceAttempts(0);
            setOTPCode('');
            setError('');
          }, 3000);
        } else {
          setError(`Invalid code (${newAttempts}/5 attempts). ${result.error || 'Please try again.'}`);
        }
      }
    } catch (error) {
      setError('Network error during verification');
    } finally {
      setVerifyingOTP(false);
    }
  };

  // ============= DEMO LOGIN SHORTCUTS =============
  const loginAsDemo = async (type: 'user' | 'admin') => {
    const email = type === 'admin' ? 'admin@demo.com' : 'demo@user.com';
    try {
      await login(email, 'demo');
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Demo login failed');
    }
  };

  // ============= RENDER HELPERS =============
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-modal rounded-lg p-8 w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <LogIn className="h-12 w-12 text-green-400 mx-auto mb-4 neon-glow" />
          <h1 className="text-3xl font-bold text-green-400 mb-2 glitch-text" style={{ fontFamily: 'Orbitron' }}>
            ACCESS TERMINAL
          </h1>
          <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
            {currentStep === 'credentials' && 'Secure authentication system'}
            {currentStep === 'face' && 'Biometric verification required'}
            {currentStep === 'otp' && 'Email verification fallback'}
          </p>
        </div>

        {/* Demo Login Shortcuts */}
        {currentStep === 'credentials' && (
          <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded">
            <p className="text-blue-400 text-sm mb-3 font-bold">🚀 Quick Demo Access:</p>
            <div className="flex gap-2">
              <button
                onClick={() => loginAsDemo('user')}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold"
              >
                <User className="h-4 w-4 inline mr-1" />
                Demo User
              </button>
              <button
                onClick={() => loginAsDemo('admin')}
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-sm font-bold"
              >
                <User className="h-4 w-4 inline mr-1" />
                Demo Admin
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: CREDENTIALS LOGIN */}
        {currentStep === 'credentials' && (
          <form onSubmit={handleCredentialsLogin} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-bold text-green-400 mb-2">
                EMAIL
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="terminal-input w-full pl-10 pr-4 py-3 rounded"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-bold text-green-400 mb-2">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="terminal-input w-full pl-10 pr-12 py-3 rounded"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400 hover:text-cyan-400"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                <p className="text-red-400 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {error}
                </p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="terminal-button w-full py-3 rounded font-bold hover-glow flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  SECURE LOGIN
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: FACE VERIFICATION */}
        {currentStep === 'face' && faceStep && (
          <div className="space-y-6">
            <div className="text-center">
              <Camera className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-cyan-400 mb-2">Face Verification Required</h2>
              <p className="text-green-400 text-sm">
                Welcome back, {faceStep.full_name}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Your account has biometric protection enabled
              </p>
            </div>

            {/* Face Verification Attempts */}
            {faceAttempts > 0 && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                <p className="text-yellow-400 text-sm">
                  Attempts: {faceAttempts}/3
                  {faceAttempts >= 3 && ' - Switching to email verification for security'}
                </p>
              </div>
            )}

            {/* Camera View */}
            {cameraActive && faceAttempts < 3 && (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-64 bg-black rounded transform scale-x-[-1]"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-64 border-2 border-green-400/50 rounded-xl"></div>
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
            )}

            {/* Face Preview */}
            {faceData && faceAttempts < 3 && (
              <div className="text-center">
                <img
                  src={faceData}
                  alt="Captured face"
                  className="w-32 h-32 mx-auto rounded-lg border-2 border-green-400"
                />
                <CheckCircle className="h-6 w-6 text-green-400 mx-auto mt-2" />
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                <p className="text-red-400 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {error}
                </p>
              </div>
            )}

            {/* Camera Controls - Only show if less than 3 attempts */}
            {faceAttempts < 3 && (
              <div className="flex gap-4">
                {!cameraActive && !faceData && (
                  <button
                    onClick={startCamera}
                    className="flex-1 terminal-button py-3 rounded font-bold hover-glow"
                  >
                    <Camera className="h-5 w-5 mr-2 inline" />
                    Start Camera
                  </button>
                )}

                {cameraActive && (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="flex-1 terminal-button py-3 rounded font-bold hover-glow"
                    >
                      <Camera className="h-5 w-5 mr-2 inline" />
                      Capture
                    </button>
                    <button
                      onClick={stopCamera}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 rounded font-bold"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {faceData && (
                  <>
                    <button
                      onClick={handleFaceVerification}
                      disabled={loading}
                      className="flex-1 terminal-button py-3 rounded font-bold hover-glow"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 mr-2 inline animate-spin" />
                      ) : (
                        <Shield className="h-5 w-5 mr-2 inline" />
                      )}
                      Verify Face
                    </button>
                    <button
                      onClick={() => {
                        setFaceData('');
                        setError('');
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 rounded font-bold"
                    >
                      Retake
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Manual OTP Request (before 3 attempts) */}
            {faceAttempts < 3 && faceAttempts > 0 && (
              <div className="border-t border-gray-600 pt-4">
                <p className="text-yellow-400 text-sm mb-3 text-center">
                  Having trouble with face verification?
                </p>
                <button
                  onClick={requestOTP}
                  disabled={sendingOTP}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded font-bold flex items-center justify-center"
                >
                  {sendingOTP ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Use Email Verification Instead
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Back to Credentials */}
            <div className="text-center">
              <button
                onClick={() => {
                  setCurrentStep('credentials');
                  setFaceStep(null);
                  setFaceAttempts(0);
                  setFaceData('');
                  setError('');
                  stopCamera();
                }}
                className="text-gray-400 hover:text-cyan-400 text-sm underline"
              >
                ← Back to login
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP VERIFICATION */}
        {currentStep === 'otp' && otpStep && (
          <div className="space-y-6">
            <div className="text-center">
              <Mail className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-yellow-400 mb-2">Email Verification</h2>
              <p className="text-green-400 text-sm">
                {faceAttempts >= 3 ? 
                  "For security, we've sent a verification code to:" :
                  "We've sent a 6-digit code to:"
                }
              </p>
              <p className="text-cyan-400 font-bold">{otpStep.email}</p>
              {otpStep.dev_otp && (
                <p className="text-green-400 text-xs mt-2">
                  Dev Mode: Use code {otpStep.dev_otp}
                </p>
              )}
            </div>

            {/* Countdown Timer */}
            {otpCountdown > 0 && (
              <div className="text-center">
                <div className="flex items-center justify-center text-yellow-400">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="text-sm">
                    Code expires in: {formatTime(otpCountdown)}
                  </span>
                </div>
              </div>
            )}

            {/* OTP Form */}
            <form onSubmit={handleOTPVerification} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-green-400 mb-2">
                  VERIFICATION CODE
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOTPCode(value);
                    if (error) setError('');
                  }}
                  className="terminal-input w-full py-3 rounded text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
                <p className="text-gray-400 text-xs mt-1 text-center">
                  Enter the 6-digit code from your email
                </p>
              </div>

              {/* OTP Attempts */}
              {otpStep.attempts > 0 && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                  <p className="text-yellow-400 text-sm">
                    Attempts: {otpStep.attempts}/5
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                  <p className="text-red-400 text-sm flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {error}
                  </p>
                </div>
              )}

              {/* Verify Button */}
              <button
                type="submit"
                disabled={verifyingOTP || otpCode.length !== 6}
                className="terminal-button w-full py-3 rounded font-bold hover-glow flex items-center justify-center disabled:opacity-50"
              >
                {verifyingOTP ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    VERIFYING...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    VERIFY CODE
                  </>
                )}
              </button>
            </form>

            {/* Resend OTP */}
            {otpCountdown === 0 && (
              <div className="text-center">
                <button
                  onClick={requestOTP}
                  disabled={sendingOTP}
                  className="text-cyan-400 hover:text-green-400 text-sm underline flex items-center justify-center mx-auto"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${sendingOTP ? 'animate-spin' : ''}`} />
                  Resend Code
                </button>
              </div>
            )}

            {/* Back Navigation */}
            <div className="text-center">
              <button
                onClick={() => {
                  if (faceAttempts < 3) {
                    setCurrentStep('face');
                  } else {
                    setCurrentStep('credentials');
                    setFaceStep(null);
                    setFaceAttempts(0);
                  }
                  setOTPStep(null);
                  setOTPCode('');
                  setError('');
                }}
                className="text-gray-400 hover:text-cyan-400 text-sm underline"
              >
                ← {faceAttempts < 3 ? 'Back to face verification' : 'Back to login'}
              </button>
            </div>
          </div>
        )}

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
            Need an account?{' '}
            <Link to="/register" className="text-green-400 hover:text-cyan-400 font-bold transition-colors">
              CREATE NEW PROFILE
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;