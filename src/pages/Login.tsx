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
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginWithFace, loading } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Face verification state
  const [showFaceOption, setShowFaceOption] = useState(false);
  const [faceData, setFaceData] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ============= SIMPLE FORM HANDLERS =============
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  // ============= SIMPLE LOGIN (NO FACE) =============
  const handleSimpleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (error: any) {
      if (error.message === 'BIOMETRIC_REQUIRED') {
        setShowFaceOption(true);
      } else {
        setError(error.message || 'Login failed');
      }
    }
  };

  // ============= CAMERA FUNCTIONS =============
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
      setError('Camera access denied. Face login will be skipped.');
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
    capturedData.split(',')[1]  // this is clean base64
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

  // ============= FACE LOGIN =============
  const handleFaceLogin = async () => {
    if (!faceData) {
      setError('Please capture your face first');
      return;
    }

    try {
      await loginWithFace(formData.email, formData.password, faceData);
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Login failed');
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
            Secure authentication system
          </p>
        </div>

        {/* Demo Login Shortcuts */}
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

        {/* Regular Login Form */}
        {!showFaceOption ? (
          <form onSubmit={handleSimpleLogin} className="space-y-6">
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
        ) : (
          /* Face Verification Mode */
          <div className="space-y-6">
            <div className="text-center">
              <Camera className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-cyan-400 mb-2">Face Verification Required</h2>
              <p className="text-green-400 text-sm">
                This account has biometric protection enabled
              </p>
            </div>

            {/* Camera View */}
            {cameraActive && (
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
            {faceData && (
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

            {/* Camera Controls */}
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
                    onClick={handleFaceLogin}
                    disabled={loading}
                    className="flex-1 terminal-button py-3 rounded font-bold hover-glow"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 mr-2 inline animate-spin" />
                    ) : (
                      <LogIn className="h-5 w-5 mr-2 inline" />
                    )}
                    Login with Face
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

            {/* Skip Face Verification */}
            <div className="text-center">
              <button
                onClick={async () => {
                  try {
                    await login(formData.email, formData.password);
                    navigate('/dashboard');
                  } catch (error: any) {
                    setError(error.message || 'Login failed');
                  }
                }}
                className="text-yellow-400 hover:text-yellow-300 text-sm underline"
              >
                Skip face verification (less secure)
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