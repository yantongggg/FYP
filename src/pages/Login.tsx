import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  LogIn,
  User,
  CheckCircle,
  Loader2,
  Shield,
  Clock,
  RefreshCw,
  Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BiometricCapture from '../components/BiometricCapture';

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
  const { login, loading } = useAuth();
  const [biometricProgress, setBiometricProgress] = useState({
    phase: 'ready', // 'ready', 'blinking', 'mouth', 'head', 'complete'
    blinks: 0,
    mouth: 0,
    head: 0,
    requiredBlinks: 2,
    requiredMouth: 1,
    requiredHead: 1
  });
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
  
  // Biometric verification state
  const [faceData, setFaceData] = useState<string>('');
  const [livenessData, setLivenessData] = useState<any>(null);
  const [biometricCaptureComplete, setBiometricCaptureComplete] = useState(false);
  const [faceAttempts, setFaceAttempts] = useState(0);
  
  // OTP state
  const [otpCode, setOTPCode] = useState('');
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [otpCountdown, setOTPCountdown] = useState(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Cleanup function to prevent memory leaks
    return () => {
      // Clear any running intervals when component unmounts
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);
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
      console.log('🔐 LOGIN ATTEMPT:', {
        email: formData.email,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      console.log('🔐 LOGIN RESPONSE:', {
        status: response.status,
        result: result,
        timestamp: new Date().toISOString()
      });
      
      if (result.success) {
        // Complete login (only for admin_demo or users without biometric requirements)
        console.log('✅ LOGIN SUCCESS - No biometric required:', {
          user_id: result.user_id,
          email: result.email,
          role: result.role
        });
        await login(formData.email, formData.password);
        navigate('/dashboard');
        
      } else if (result.error === 'BIOMETRIC_REQUIRED') {
        // Move to face verification step
        console.log('🔐 BIOMETRIC REQUIRED - Moving to face verification:', {
          user_id: result.user_id,
          email: result.email,
          full_name: result.full_name
        });
        setFaceStep({
          user_id: result.user_id,
          email: result.email,
          full_name: result.full_name || result.email
        });
        setCurrentStep('face');
        setError('');
        
      } else if (result.error === 'BEHAVIORAL_ENROLLMENT_REQUIRED') {
        // User needs to complete behavioral enrollment
        console.log('⚠️ BEHAVIORAL ENROLLMENT REQUIRED:', {
          user_id: result.user_id,
          email: result.email,
          enrollment_status: result.enrollment_status
        });
        setError(`${result.message || 'Behavioral pattern enrollment required'} - Redirecting to complete registration...`);
        setTimeout(() => {
          console.log('🔀 REDIRECTING to behavioral enrollment');
          navigate('/register', { 
            state: { 
              step: 'behavioral', 
              user_id: result.user_id,
              email: result.email,
              username: result.username 
            } 
          });
        }, 3000);
        
      } else if (result.error === 'FACE_ENROLLMENT_REQUIRED') {
        // User needs to complete face enrollment
        console.log('⚠️ FACE ENROLLMENT REQUIRED:', {
          user_id: result.user_id,
          email: result.email,
          enrollment_status: result.enrollment_status
        });
        setError(`${result.message || 'Face enrollment required'} - Redirecting to complete registration...`);
        setTimeout(() => {
          console.log('🔀 REDIRECTING to face enrollment');
          navigate('/register', { 
            state: { 
              step: 'biometric', 
              user_id: result.user_id,
              email: result.email,
              username: result.username 
            } 
          });
        }, 3000);
        
      } else if (result.error === 'ACCOUNT_LOCKED') {
        console.log('🔒 ACCOUNT LOCKED:', {
          email: formData.email,
          message: result.message,
          remaining_minutes: result.remaining_minutes
        });
        setError(`Account locked. ${result.message || 'Please try again later.'}`);
        
      } else {
        // Generic error handling
        console.log('❌ LOGIN FAILED:', {
          email: formData.email,
          error: result.error,
          message: result.message,
          full_result: result
        });
        setError(result.error || 'Login failed');
      }
      
    } catch (error: any) {
      console.error('❌ NETWORK ERROR during login:', {
        email: formData.email,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      setError('Network error. Please check your connection.');
    }
  };

  // ============= STEP 2: BIOMETRIC CAPTURE HANDLERS =============
  const handleFaceCapture = (faceDataUrl: string, faceUrl?: string) => {
    console.log('Face captured for login:', faceDataUrl.length);
    setFaceData(faceDataUrl);
    setBiometricCaptureComplete(true);
  };

  const handleLivenessCapture = (livenessResult: any) => {
    console.log('🎯 LIVENESS DATA RECEIVED:', livenessResult);
    setLivenessData(livenessResult);
    
    // ✅ CRITICAL: Update progress immediately
    setBiometricProgress(prev => ({
      ...prev,
      blinks: livenessResult.blink_count || 0,
      mouth: livenessResult.mouth_open_count || 0,
      head: livenessResult.head_movement_count || 0,
      phase: livenessResult.sequential_state?.current_phase || prev.phase
    }));
    
    // ✅ LOG FOR DEBUGGING
    console.log('👁️ UI BLINK COUNT UPDATE:', {
      received: livenessResult.blink_count,
      setting_to: livenessResult.blink_count || 0
    });
    
    // Validate liveness requirements
    if (livenessResult?.liveness_validation?.overall_liveness_passed) {
      console.log('✅ Liveness validation passed for login');
      setBiometricProgress(prev => ({ ...prev, phase: 'complete' }));
    } else if (livenessResult?.error) {
      setError('Liveness detection failed. Please try again.');
    }
  };

  const handleFaceVerification = async () => {
    if (!faceData || !faceStep) {
      setError('Please complete biometric capture first');
      return;
    }

    // Check liveness validation
    if (!livenessData?.liveness_validation?.overall_liveness_passed) {
      setError('Liveness verification required. Please complete all liveness tests.');
      return;
    }

    try {
      setError('');
      
      const response = await fetch('http://localhost:5000/api/biometric-login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: faceStep.user_id,
          face_image: faceData.includes(',') ? faceData.split(',')[1] : faceData, // Remove data:image prefix if exists
          liveness_data: livenessData // Include liveness validation data
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
          // After 3 failures, automatically show email option
          setError(`Face verification failed ${newAttempts} times. Switching to email verification for security.`);
          // Auto-trigger email OTP
          setTimeout(() => {
            requestOTP();
          }, 2000);
        } else {
          setError(`Face verification failed (${newAttempts}/3 attempts). ${result.message || 'Please try again.'}`);
        }
        
        // Reset biometric data for retry
        setFaceData('');
        setLivenessData(null);
        setBiometricCaptureComplete(false);
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
          setError(`Invalid code (${newAttempts}/5 attempts). 'Please try again.`);
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
    const demoCredentials = {
      user: { email: 'user@example.com', password: 'user123' },
      admin: { email: 'admin@example.com', password: 'admin123' }
    };
    
    const creds = demoCredentials[type];
    setFormData(creds); // Also populate the form
    
    try {
      await login(creds.email, creds.password);
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Demo login failed');
    }
  };

  // ============= UTILITY FUNCTIONS =============
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetBiometricData = () => {
    setFaceData('');
    setLivenessData(null);
    setBiometricCaptureComplete(false);
    setError('');
  };

  const resetToCredentials = () => {
    setCurrentStep('credentials');
    setFaceStep(null);
    setOTPStep(null);
    setFaceAttempts(0);
    setOTPCode('');
    setOTPCountdown(0); // Add this
    setSendingOTP(false); // Add this
    setVerifyingOTP(false); // Add this
    resetBiometricData();
    setError('');
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="glass-modal rounded-lg p-8 w-full max-w-md">
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

        {/* STEP 2: FACE VERIFICATION WITH LIVENESS */}
        {currentStep === 'face' && faceStep && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Shield className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-cyan-400 mb-2">Biometric Verification</h2>
              <p className="text-green-400 text-sm">
                Welcome back, {faceStep.full_name}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Complete liveness detection and face verification
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

            {/* Use BiometricCapture component for login */}
            {faceAttempts < 3 && (
            <BiometricCapture
              onFaceCapture={handleFaceCapture}
              onLivenessCapture={handleLivenessCapture}
              mode="login"
              userId={faceStep.user_id}
              onProgressUpdate={(progress) => {
                setBiometricProgress(prev => ({
                  ...prev,
                  phase: progress.phase as any,
                  blinks: progress.blinks,
                  mouth: progress.mouth,
                  head: progress.head
                }));
              }}
            />
          )}
            {/* Enhanced BiometricCapture with progress indicators */}
{faceAttempts < 3 && (
  <div className="space-y-4">
    {/* Clear Progress Header */}
    <div className="glass-card rounded-lg p-4 border border-cyan-400/30">
      {/* <h3 className="text-cyan-400 font-bold text-center mb-3">
        {biometricProgress.phase === 'ready' && '🔄 Initializing Camera...'}
        {biometricProgress.phase === 'blinking' && '👁️ Please Blink Slowly'}
        {biometricProgress.phase === 'mouth' && '👄 Open Your Mouth'}
        {biometricProgress.phase === 'head' && '🗣️ Move Your Head Gently'}
        {biometricProgress.phase === 'complete' && '✅ Verification Complete!'}
      </h3> */}
      
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Progress</span>
          <span>{Math.min(100, Math.round(((biometricProgress.blinks + biometricProgress.mouth + biometricProgress.head) / 
            (biometricProgress.requiredBlinks + biometricProgress.requiredMouth + biometricProgress.requiredHead)) * 100))}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-cyan-400 to-green-400 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, ((biometricProgress.blinks + biometricProgress.mouth + biometricProgress.head) / 
                (biometricProgress.requiredBlinks + biometricProgress.requiredMouth + biometricProgress.requiredHead)) * 100)}%`
            }}
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between mt-4 text-xs">
        <div className={`flex items-center ${biometricProgress.blinks >= biometricProgress.requiredBlinks ? 'text-green-400' : 'text-gray-400'}`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${biometricProgress.blinks >= biometricProgress.requiredBlinks ? 'bg-green-400' : 'bg-gray-600'}`}></span>
          Blink ({biometricProgress.blinks}/{biometricProgress.requiredBlinks})
        </div>
        <div className={`flex items-center ${biometricProgress.mouth >= biometricProgress.requiredMouth ? 'text-green-400' : 'text-gray-400'}`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${biometricProgress.mouth >= biometricProgress.requiredMouth ? 'bg-green-400' : 'bg-gray-600'}`}></span>
          Mouth ({biometricProgress.mouth}/{biometricProgress.requiredMouth})
        </div>
        <div className={`flex items-center ${biometricProgress.head >= biometricProgress.requiredHead ? 'text-green-400' : 'text-gray-400'}`}>
          <span className={`w-2 h-2 rounded-full mr-2 ${biometricProgress.head >= biometricProgress.requiredHead ? 'bg-green-400' : 'bg-gray-600'}`}></span>
          Head ({biometricProgress.head}/{biometricProgress.requiredHead})
        </div>
      </div>
    </div>

    {/* Current Instruction Card
    <div className="glass-card rounded-lg p-4 border border-yellow-400/30 bg-yellow-900/10">
      <div className="text-center">
        {biometricProgress.phase === 'ready' && (
          <div>
            <div className="text-2xl mb-2">📱</div>
            <p className="text-yellow-400 font-bold">Position your face in the camera</p>
            <p className="text-gray-400 text-sm">Look directly at the camera and wait for instructions</p>
          </div>
        )}
        {biometricProgress.phase === 'blinking' && (
          <div>
            <div className="text-2xl mb-2 animate-pulse">👁️</div>
            <p className="text-yellow-400 font-bold">Blink {biometricProgress.requiredBlinks} times slowly</p>
            <p className="text-gray-400 text-sm">Close your eyes completely, then open them</p>
          </div>
        )}
        {biometricProgress.phase === 'mouth' && (
          <div>
            <div className="text-2xl mb-2">👄</div>
            <p className="text-yellow-400 font-bold">Open your mouth wide</p>
            <p className="text-gray-400 text-sm">Open and close your mouth clearly</p>
          </div>
        )}
        {biometricProgress.phase === 'head' && (
          <div>
            <div className="text-2xl mb-2">🗣️</div>
            <p className="text-yellow-400 font-bold">Move your head slowly</p>
            <p className="text-gray-400 text-sm">Turn your head left and right gently</p>
          </div>
        )}
        {biometricProgress.phase === 'complete' && (
          <div>
            <div className="text-2xl mb-2">✅</div>
            <p className="text-green-400 font-bold">All checks complete!</p>
            <p className="text-gray-400 text-sm">Processing your verification...</p>
          </div>
        )}
      </div>
    </div> */}
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

            {/* Show captured face preview and verification button */}
            {faceData && biometricCaptureComplete && faceAttempts < 3 && (
              <div className="mt-4 glass-card rounded-lg p-4">
                <h3 className="text-green-400 font-bold mb-2">Captured Face Preview</h3>
                <img 
                  src={faceData} 
                  alt="Captured face" 
                  className="w-32 h-32 rounded-lg mx-auto object-cover border border-green-400/30"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleFaceVerification}
                    disabled={loading}
                    className="flex-1 terminal-button py-2 rounded hover-glow"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        VERIFYING...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        VERIFY BIOMETRICS
                      </>
                    )}
                  </button>
                  <button
                    onClick={resetBiometricData}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold"
                  >
                    Retake
                  </button>
                </div>
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
                onClick={resetToCredentials}
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
                  {/* Dev Mode: Use code {otpStep.dev_otp} */}
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
                    resetToCredentials();
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
      </div>
    </div>
  );
};

export default Login;