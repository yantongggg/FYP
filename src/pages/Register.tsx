import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  AlertCircle, 
  CheckCircle, 
  Terminal, 
  Database, 
  Shield,
  Camera,
  FileText,
  MousePointer,
  Keyboard,
  Upload,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import BiometricCapture from '../components/BiometricCapture';
import { supabase } from '../lib/supabase';

interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface BiometricData {
  faceData: string;
  livenessData: any;
}

interface BehavioralData {
  keystrokes: any[];
  mouseMovements: any[];
}

interface EKYCData {
  frontFile: File | null;
  backFile: File | null;
  frontPreview: string;
  backPreview: string;
  frontUrl: string;
  backUrl: string;
}

const Register = () => {
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Form data
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  // Biometric data
  const [biometricData, setBiometricData] = useState<BiometricData>({
    faceData: '',
    livenessData: null
  });
  
  // Behavioral data
  const [behavioralData, setBehavioralData] = useState<BehavioralData>({
    keystrokes: [],
    mouseMovements: []
  });
  
  // eKYC data
  const [ekycData, setEKYCData] = useState<EKYCData>({
    frontFile: null,
    backFile: null,
    frontPreview: '',
    backPreview: '',
    frontUrl: '',
    backUrl: ''
  });
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [behavioralCaptureActive, setBehavioralCaptureActive] = useState(false);
  const [behavioralCaptureComplete, setBehavioralCaptureComplete] = useState(false);
  
  const navigate = useNavigate();

  // Behavioral capture effect
  useEffect(() => {
    if (behavioralCaptureActive) {
      const keystrokes: any[] = [];
      const mouseMovements: any[] = [];
      
      const handleKeyDown = (e: KeyboardEvent) => {
        keystrokes.push({
          key: e.key,
          code: e.code,
          timestamp: Date.now(),
          type: 'keydown'
        });
      };
      
      const handleKeyUp = (e: KeyboardEvent) => {
        keystrokes.push({
          key: e.key,
          code: e.code,
          timestamp: Date.now(),
          type: 'keyup'
        });
      };
      
      const handleMouseMove = (e: MouseEvent) => {
        mouseMovements.push({
          x: e.clientX,
          y: e.clientY,
          timestamp: Date.now(),
          type: 'mousemove'
        });
      };
      
      const handleClick = (e: MouseEvent) => {
        mouseMovements.push({
          x: e.clientX,
          y: e.clientY,
          button: e.button,
          timestamp: Date.now(),
          type: 'click'
        });
      };
      
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('click', handleClick);
      
      // Auto-complete after 30 seconds or sufficient data
      const timer = setTimeout(() => {
        setBehavioralData({ keystrokes, mouseMovements });
        setBehavioralCaptureActive(false);
        setBehavioralCaptureComplete(true);
      }, 30000);
      
      // Check for sufficient data every 5 seconds
      const checkTimer = setInterval(() => {
        if (keystrokes.length >= 50 && mouseMovements.length >= 100) {
          setBehavioralData({ keystrokes, mouseMovements });
          setBehavioralCaptureActive(false);
          setBehavioralCaptureComplete(true);
          clearTimeout(timer);
          clearInterval(checkTimer);
        }
      }, 5000);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleClick);
        clearTimeout(timer);
        clearInterval(checkTimer);
      };
    }
  }, [behavioralCaptureActive]);

  // Validation functions
  const validateStep1 = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    if (!biometricData.faceData) {
      setErrors({ biometric: 'Face capture is required' });
      return false;
    }
    
    if (!biometricData.livenessData || !biometricData.livenessData.overall_liveness_passed) {
      setErrors({ biometric: 'Liveness detection must be completed successfully' });
      return false;
    }
    
    setErrors({});
    return true;
  };

  const validateStep3 = () => {
    if (!behavioralCaptureComplete) {
      setErrors({ behavioral: 'Behavioral capture must be completed' });
      return false;
    }
    
    if (behavioralData.keystrokes.length < 20) {
      setErrors({ behavioral: 'Insufficient keystroke data captured' });
      return false;
    }
    
    if (behavioralData.mouseMovements.length < 50) {
      setErrors({ behavioral: 'Insufficient mouse movement data captured' });
      return false;
    }
    
    setErrors({});
    return true;
  };

  const validateStep4 = () => {
    if (!ekycData.frontFile || !ekycData.backFile) {
      setErrors({ ekyc: 'Both front and back IC images are required' });
      return false;
    }
    
    setErrors({});
    return true;
  };

  // Step navigation
  const nextStep = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 1:
        isValid = validateStep1();
        break;
      case 2:
        isValid = validateStep2();
        break;
      case 3:
        isValid = validateStep3();
        break;
      case 4:
        isValid = validateStep4();
        break;
      default:
        isValid = true;
    }
    
    if (isValid && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Input handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Biometric handlers
  const handleFaceCapture = (faceData: string) => {
    setBiometricData(prev => ({ ...prev, faceData }));
    console.log('✅ Face data captured');
  };

  const handleLivenessCapture = (livenessData: any) => {
    setBiometricData(prev => ({ ...prev, livenessData }));
    console.log('✅ Liveness data captured:', livenessData);
  };

  // eKYC handlers
  const handleFileSelect = (type: 'front' | 'back', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setEKYCData(prev => ({
        ...prev,
        [`${type}File`]: file,
        [`${type}Preview`]: preview
      }));
    };
    reader.readAsDataURL(file);
  };


const uploadEKYCFiles = async () => {
  if (!ekycData.frontFile || !ekycData.backFile) {
    throw new Error('Both IC files are required');
  }

  const userId = `user_${Date.now()}`;

  // Upload front
  const frontFileName = `${userId}_ic_front_${Date.now()}.jpg`;
  const { data: frontData, error: frontError } = await supabase.storage
    .from('ekyc-documents')
    .upload(frontFileName, ekycData.frontFile);

  if (frontError) throw frontError;

  // Upload back
  const backFileName = `${userId}_ic_back_${Date.now()}.jpg`;
  const { data: backData, error: backError } = await supabase.storage
    .from('ekyc-documents')
    .upload(backFileName, ekycData.backFile);

  if (backError) throw backError;

  // Get public URLs
  const { publicUrl: frontUrl } = supabase.storage
    .from('ekyc-documents')
    .getPublicUrl(frontData.path);

  const { publicUrl: backUrl } = supabase.storage
    .from('ekyc-documents')
    .getPublicUrl(backData.path);


  return {
    frontUrl,
    backUrl
  };
};





  // Final submission
  const handleSubmit = async () => {
    if (!validateStep4()) return;

    setLoading(true);
    try {
      console.log('🚀 Starting registration process...');

      // Upload eKYC files first
      const { frontUrl, backUrl } = await uploadEKYCFiles();
      
      // Prepare complete registration data
      const registrationData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        faceData: biometricData.faceData,
        livenessData: biometricData.livenessData,
        behavioralData: behavioralData,
        ekycFiles: {
          frontUrl,
          backUrl
        }
      };

      console.log('📊 Registration data prepared:', {
        username: registrationData.username,
        email: registrationData.email,
        faceData: registrationData.faceData ? 'Present' : 'Missing',
        livenessData: registrationData.livenessData ? 'Present' : 'Missing',
        behavioralData: `${registrationData.behavioralData.keystrokes.length} keystrokes, ${registrationData.behavioralData.mouseMovements.length} mouse events`,
        ekycFiles: 'URLs present'
      });

      // Send to backend
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Registration successful:', result);
        setSuccess(true);
        
        // Redirect to login after delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        console.error('❌ Registration failed:', result);
        setErrors({ submit: result.error || 'Registration failed' });
      }

    } catch (error: any) {
      console.error('❌ Registration error:', error);
      setErrors({ submit: error.message || 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-modal rounded-lg p-8 text-center max-w-md"
        >
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4 neon-glow" />
          <h2 className="text-2xl font-bold text-green-400 mb-2 glitch-text" style={{ fontFamily: 'Orbitron' }}>
            REGISTRATION SUCCESSFUL!
          </h2>
          <p className="text-cyan-400 mb-4" style={{ fontFamily: 'IBM Plex Mono' }}>
            Complete biometric profile created with eKYC verification
          </p>
          <div className="text-green-400 text-sm" style={{ fontFamily: 'IBM Plex Mono' }}>
            Redirecting to login terminal...
          </div>
        </motion.div>
      </div>
    );
  }

  const steps = [
    { number: 1, title: 'Credentials', icon: User, description: 'Basic account information' },
    { number: 2, title: 'Biometric', icon: Camera, description: 'Face capture & liveness detection' },
    { number: 3, title: 'Behavioral', icon: MousePointer, description: 'Keystroke & mouse patterns' },
    { number: 4, title: 'eKYC', icon: FileText, description: 'Identity document verification' },
    { number: 5, title: 'Review', icon: Shield, description: 'Final verification & submission' }
  ];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-modal rounded-lg p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <Terminal className="h-12 w-12 text-green-400 mx-auto mb-4 neon-glow" />
            <h1 className="text-3xl font-bold text-green-400 mb-2 glitch-text" style={{ fontFamily: 'Orbitron' }}>
              MULTIMODAL REGISTRATION
            </h1>
            <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
              Complete biometric enrollment with eKYC verification
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {steps.map((step, index) => (
                <div key={step.number} className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                    currentStep >= step.number
                      ? 'border-green-400 bg-green-400/20 text-green-400'
                      : 'border-gray-600 text-gray-400'
                  }`}>
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div className="mt-2 text-center">
                    <div className={`text-sm font-bold ${
                      currentStep >= step.number ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500 max-w-20">
                      {step.description}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`absolute top-6 w-16 h-0.5 ${
                      currentStep > step.number ? 'bg-green-400' : 'bg-gray-600'
                    }`} style={{ left: `${(index + 1) * 20}%` }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: Credentials */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-cyan-400 mb-6">User Credentials</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-green-400 mb-2">
                        USERNAME
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          className={`terminal-input w-full pl-10 pr-4 py-3 rounded ${
                            errors.username ? 'border-red-500' : ''
                          }`}
                          placeholder="Enter username"
                        />
                      </div>
                      {errors.username && (
                        <p className="mt-1 text-sm text-red-400 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.username}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-green-400 mb-2">
                        EMAIL ADDRESS
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`terminal-input w-full pl-10 pr-4 py-3 rounded ${
                            errors.email ? 'border-red-500' : ''
                          }`}
                          placeholder="Enter email"
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-400 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.email}
                        </p>
                      )}
                    </div>

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
                          className={`terminal-input w-full pl-10 pr-12 py-3 rounded ${
                            errors.password ? 'border-red-500' : ''
                          }`}
                          placeholder="Enter password (min 6 chars)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400 hover:text-cyan-400"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-sm text-red-400 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-green-400 mb-2">
                        CONFIRM PASSWORD
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className={`terminal-input w-full pl-10 pr-12 py-3 rounded ${
                            errors.confirmPassword ? 'border-red-500' : ''
                          }`}
                          placeholder="Confirm password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400 hover:text-cyan-400"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-400 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Biometric Capture */}
              {currentStep === 2 && (
                <div>
                  <BiometricCapture
                    onFaceCapture={handleFaceCapture}
                    onLivenessCapture={handleLivenessCapture}
                    mode="registration"
                    userId={formData.email || 'temp_user'}
                  />
                  
                  {errors.biometric && (
                    <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
                      <p className="text-red-400 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {errors.biometric}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Behavioral Capture */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-cyan-400 mb-6">Behavioral Pattern Capture</h2>
                  
                  <div className="glass-card rounded-lg p-6">
                    <div className="text-center mb-6">
                      <div className="flex justify-center space-x-8 mb-6">
                        <div className="text-center">
                          <Keyboard className="h-12 w-12 text-green-400 mx-auto mb-2" />
                          <p className="text-green-400 font-bold">Keystroke Dynamics</p>
                          <p className="text-cyan-400 text-sm">
                            {behavioralData.keystrokes.length} events captured
                          </p>
                        </div>
                        <div className="text-center">
                          <MousePointer className="h-12 w-12 text-green-400 mx-auto mb-2" />
                          <p className="text-green-400 font-bold">Mouse Patterns</p>
                          <p className="text-cyan-400 text-sm">
                            {behavioralData.mouseMovements.length} events captured
                          </p>
                        </div>
                      </div>
                      
                      {!behavioralCaptureActive && !behavioralCaptureComplete && (
                        <div>
                          <p className="text-cyan-400 mb-4">
                            Click the button below to start capturing your behavioral patterns.
                            Type naturally and move your mouse around for 30 seconds.
                          </p>
                          <button
                            onClick={() => setBehavioralCaptureActive(true)}
                            className="terminal-button px-6 py-3 rounded font-bold hover-glow"
                          >
                            START BEHAVIORAL CAPTURE
                          </button>
                        </div>
                      )}
                      
                      {behavioralCaptureActive && (
                        <div>
                          <div className="animate-pulse mb-4">
                            <div className="w-16 h-16 bg-green-400/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                              <div className="w-8 h-8 bg-green-400 rounded-full animate-ping"></div>
                            </div>
                          </div>
                          <p className="text-green-400 font-bold mb-2">CAPTURING BEHAVIORAL PATTERNS...</p>
                          <p className="text-cyan-400 text-sm mb-4">
                            Please type naturally and move your mouse around. 
                            Capture will complete automatically when sufficient data is collected.
                          </p>
                          <div className="bg-black/30 rounded p-4">
                            <textarea
                              placeholder="Type anything here to capture your keystroke dynamics..."
                              className="w-full h-32 bg-transparent border border-green-500/30 rounded p-3 text-green-400 resize-none"
                              style={{ fontFamily: 'IBM Plex Mono' }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {behavioralCaptureComplete && (
                        <div>
                          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                          <p className="text-green-400 font-bold mb-2">BEHAVIORAL CAPTURE COMPLETE!</p>
                          <p className="text-cyan-400 text-sm">
                            Successfully captured {behavioralData.keystrokes.length} keystroke events 
                            and {behavioralData.mouseMovements.length} mouse movement events.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {errors.behavioral && (
                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                      <p className="text-red-400 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {errors.behavioral}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: eKYC Upload */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-cyan-400 mb-6">eKYC Document Verification</h2>
                  
                  <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
                    <p className="text-yellow-400 text-sm font-bold mb-2">
                      ⚠️ IMPORTANT INSTRUCTIONS:
                    </p>
                    <ul className="text-yellow-300 text-sm space-y-1">
                      <li>• Upload BOTH front and back of your Malaysian IC (MyKad)</li>
                      <li>• Ensure images are clear, well-lit, and not blurry</li>
                      <li>• IC must be placed on a plain background</li>
                      <li>• Face on IC will be matched with your biometric profile</li>
                    </ul>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Front IC Upload */}
                    <div>
                      <label className="block text-green-400 font-bold mb-2">
                        IC FRONT (WITH PHOTO)
                      </label>
                      <div className="border-2 border-dashed border-green-500/50 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                        {ekycData.frontPreview ? (
                          <div>
                            <img
                              src={ekycData.frontPreview}
                              alt="IC Front Preview"
                              className="max-w-full h-48 object-contain mx-auto mb-4 rounded"
                            />
                            <p className="text-green-400 text-sm">✅ Front IC uploaded</p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="h-12 w-12 text-green-400 mx-auto mb-2" />
                            <p className="text-cyan-400 text-sm mb-2">Upload IC front side</p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect('front', file);
                          }}
                          className="hidden"
                          id="ic-front"
                        />
                        <label
                          htmlFor="ic-front"
                          className="terminal-button mt-3 px-4 py-2 rounded inline-block cursor-pointer"
                        >
                          {ekycData.frontPreview ? 'CHANGE FRONT' : 'UPLOAD FRONT'}
                        </label>
                      </div>
                    </div>
                    
                    {/* Back IC Upload */}
                    <div>
                      <label className="block text-green-400 font-bold mb-2">
                        IC BACK (WITH SIGNATURE)
                      </label>
                      <div className="border-2 border-dashed border-green-500/50 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                        {ekycData.backPreview ? (
                          <div>
                            <img
                              src={ekycData.backPreview}
                              alt="IC Back Preview"
                              className="max-w-full h-48 object-contain mx-auto mb-4 rounded"
                            />
                            <p className="text-green-400 text-sm">✅ Back IC uploaded</p>
                          </div>
                        ) : (
                          <div>
                            <Upload className="h-12 w-12 text-green-400 mx-auto mb-2" />
                            <p className="text-cyan-400 text-sm mb-2">Upload IC back side</p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect('back', file);
                          }}
                          className="hidden"
                          id="ic-back"
                        />
                        <label
                          htmlFor="ic-back"
                          className="terminal-button mt-3 px-4 py-2 rounded inline-block cursor-pointer"
                        >
                          {ekycData.backPreview ? 'CHANGE BACK' : 'UPLOAD BACK'}
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {errors.ekyc && (
                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                      <p className="text-red-400 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {errors.ekyc}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Review & Submit */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-cyan-400 mb-6">Registration Review</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* User Information */}
                    <div className="glass-card rounded-lg p-4">
                      <h3 className="text-lg font-bold text-green-400 mb-3">User Information</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Username:</span>
                          <span className="text-cyan-400">{formData.username}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Email:</span>
                          <span className="text-cyan-400">{formData.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Biometric Status */}
                    <div className="glass-card rounded-lg p-4">
                      <h3 className="text-lg font-bold text-green-400 mb-3">Biometric Status</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Face Recognition:</span>
                          <span className="text-green-400">✅ Captured</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Liveness Detection:</span>
                          <span className="text-green-400">✅ Verified</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Behavioral Patterns:</span>
                          <span className="text-green-400">✅ Captured</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">eKYC Documents:</span>
                          <span className="text-green-400">✅ Uploaded</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Status */}
                  {biometricData.livenessData && (
                    <div className="glass-card rounded-lg p-4">
                      <h3 className="text-lg font-bold text-green-400 mb-3">Liveness Detection Details</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-cyan-400 font-bold">
                            {biometricData.livenessData.blink_count || 0}/3
                          </div>
                          <div className="text-gray-400">Blinks</div>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-400 font-bold">
                            {biometricData.livenessData.mouth_open_count || 0}/2
                          </div>
                          <div className="text-gray-400">Mouth Opens</div>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-400 font-bold">
                            {biometricData.livenessData.head_movement_count || 0}/2
                          </div>
                          <div className="text-gray-400">Head Movements</div>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-400 font-bold">
                            {((biometricData.livenessData.face_real_score || 0) * 100).toFixed(0)}%
                          </div>
                          <div className="text-gray-400">Face Score</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {errors.submit && (
                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                      <p className="text-red-400 text-sm flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {errors.submit}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="terminal-button bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              PREVIOUS
            </button>

            {currentStep < 5 ? (
              <button
                onClick={nextStep}
                className="terminal-button px-6 py-3 rounded font-bold hover-glow flex items-center"
              >
                NEXT
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="terminal-button px-6 py-3 rounded font-bold hover-glow flex items-center disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    REGISTERING...
                  </>
                ) : (
                  <>
                    COMPLETE REGISTRATION
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
              Already have an account?{' '}
              <Link to="/login" className="text-green-400 hover:text-cyan-400 font-bold transition-colors">
                ACCESS LOGIN TERMINAL
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;