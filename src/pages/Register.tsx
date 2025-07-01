// Register.tsx - Fixed with complete biometric integration

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, AlertCircle, CheckCircle, Terminal, Database, Shield } from 'lucide-react';
import BiometricCapture from '../components/BiometricCapture';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Biometric data states
  const [faceData, setFaceData] = useState<string>('');
  const [livenessData, setLivenessData] = useState<any>(null);
  const [keystrokeData, setKeystrokeData] = useState<number[]>([]);
  const [scrollData, setScrollData] = useState<any[]>([]);
  const [eKYCData, setEKYCData] = useState<{icFront: string; icBack: string} | null>(null);
  
  // UI states
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'credentials' | 'biometric' | 'review'>('credentials');

  const navigate = useNavigate();

  const validateCredentials = () => {
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

  const validateBiometricData = () => {
    const newErrors: {[key: string]: string} = {};

    if (!faceData) {
      newErrors.faceData = 'Face image is required';
    }

    if (!livenessData) {
      newErrors.livenessData = 'Liveness detection must be completed';
    } else if (!livenessData.overall_liveness_passed) {
      newErrors.livenessData = 'Liveness verification failed. Please complete all requirements.';
    }

    if (keystrokeData.length < 20) {
      newErrors.keystrokeData = 'Insufficient keystroke data captured';
    }

    if (scrollData.length < 10) {
      newErrors.scrollData = 'Insufficient scroll behavior data captured';
    }

    if (!eKYCData || !eKYCData.icFront || !eKYCData.icBack) {
      newErrors.eKYCData = 'eKYC verification data is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCredentialsNext = () => {
    if (validateCredentials()) {
      setStep('biometric');
      setErrors({});
    }
  };

  const handleBiometricNext = () => {
    if (validateBiometricData()) {
      setStep('review');
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateCredentials() || !validateBiometricData()) {
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 Starting enhanced registration process...');

      // Prepare complete registration data
      const registrationData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        face_image: faceData,
        liveness_data: livenessData,
        keystroke_data: keystrokeData,
        scroll_data: scrollData,
        ekyc_data: eKYCData
      };

      console.log('📊 Registration data prepared:', {
        username: registrationData.username,
        email: registrationData.email,
        face_image: registrationData.face_image ? 'Present' : 'Missing',
        liveness_data: registrationData.liveness_data ? 'Present' : 'Missing',
        keystroke_data: `${registrationData.keystroke_data.length} entries`,
        scroll_data: `${registrationData.scroll_data.length} entries`,
        ekyc_data: registrationData.ekyc_data ? 'Present' : 'Missing'
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
        setStep('review'); // Go back to review step to show error
      }

    } catch (error: any) {
      console.error('❌ Registration error:', error);
      setErrors({ submit: error.message || 'Network error occurred' });
      setStep('review');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Biometric data handlers
  const handleFaceCapture = (data: string) => {
    setFaceData(data);
    console.log('✅ Face data captured');
    if (errors.faceData) {
      setErrors(prev => ({ ...prev, faceData: '' }));
    }
  };

  const handleLivenessCapture = (data: any) => {
    setLivenessData(data);
    console.log('✅ Liveness data captured:', data);
    if (errors.livenessData) {
      setErrors(prev => ({ ...prev, livenessData: '' }));
    }
  };

  const handleKeystrokeCapture = (data: number[]) => {
    setKeystrokeData(data);
    console.log('✅ Keystroke data captured:', data.length, 'entries');
    if (errors.keystrokeData) {
      setErrors(prev => ({ ...prev, keystrokeData: '' }));
    }
  };

  const handleScrollCapture = (data: any[]) => {
    setScrollData(data);
    console.log('✅ Scroll data captured:', data.length, 'entries');
    if (errors.scrollData) {
      setErrors(prev => ({ ...prev, scrollData: '' }));
    }
  };

  const handleEKYCCapture = (data: {icFront: string; icBack: string}) => {
    setEKYCData(data);
    console.log('✅ eKYC data captured');
    if (errors.eKYCData) {
      setErrors(prev => ({ ...prev, eKYCData: '' }));
    }
  };

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
            Enhanced biometric profile created with CDCN anti-spoofing
          </p>
          <div className="text-green-400 text-sm" style={{ fontFamily: 'IBM Plex Mono' }}>
            Redirecting to login terminal...
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-modal rounded-lg p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <Terminal className="h-12 w-12 text-green-400 mx-auto mb-4 neon-glow" />
            <h1 className="text-3xl font-bold text-green-400 mb-2 glitch-text" style={{ fontFamily: 'Orbitron' }}>
              ENHANCED BIOMETRIC REGISTRATION
            </h1>
            <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
              Multi-modal authentication with CDCN anti-spoofing + Malaysian eKYC
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-4">
              {[
                { key: 'credentials', label: 'Credentials', icon: User },
                { key: 'biometric', label: 'Biometric', icon: Shield },
                { key: 'review', label: 'Review', icon: Database }
              ].map(({ key, label, icon: Icon }, index) => (
                <div key={key} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step === key 
                      ? 'border-green-400 bg-green-400/20 text-green-400' 
                      : index < ['credentials', 'biometric', 'review'].indexOf(step)
                        ? 'border-green-400 bg-green-400 text-black'
                        : 'border-gray-600 text-gray-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    step === key ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {label}
                  </span>
                  {index < 2 && (
                    <div className={`ml-4 w-12 h-0.5 ${
                      index < ['credentials', 'biometric', 'review'].indexOf(step)
                        ? 'bg-green-400'
                        : 'bg-gray-600'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          {step === 'credentials' && (
            <div className="glass-card rounded-lg p-6">
              <h2 className="text-xl font-bold text-cyan-400 mb-6" style={{ fontFamily: 'Orbitron' }}>
                USER CREDENTIALS
              </h2>
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
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`terminal-input w-full pl-10 pr-4 py-3 rounded ${
                        errors.password ? 'border-red-500' : ''
                      }`}
                      placeholder="Enter password (min 6 chars)"
                    />
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
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`terminal-input w-full pl-10 pr-4 py-3 rounded ${
                        errors.confirmPassword ? 'border-red-500' : ''
                      }`}
                      placeholder="Confirm password"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-400 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={handleCredentialsNext}
                  className="terminal-button py-3 px-8 rounded font-bold hover-glow"
                >
                  PROCEED TO BIOMETRIC CAPTURE
                </button>
              </div>
            </div>
          )}

          {step === 'biometric' && (
            <div>
              <BiometricCapture
                onFaceCapture={handleFaceCapture}
                onLivenessCapture={handleLivenessCapture}
                onKeystrokeCapture={handleKeystrokeCapture}
                onScrollCapture={handleScrollCapture}
                onEKYCCapture={handleEKYCCapture}
                mode="registration"
                userId={formData.email || 'temp_user'}
              />

              {/* Biometric Data Status */}
              <div className="glass-card rounded-lg p-6 mt-6">
                <h3 className="text-lg font-bold text-cyan-400 mb-4">BIOMETRIC DATA STATUS</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Face Image', data: faceData, icon: '👤' },
                    { label: 'Liveness', data: livenessData?.overall_liveness_passed, icon: '🎯' },
                    { label: 'Keystroke', data: keystrokeData.length >= 20, icon: '⌨️' },
                    { label: 'Scroll', data: scrollData.length >= 10, icon: '🖱️' },
                    { label: 'eKYC', data: eKYCData, icon: '🆔' }
                  ].map(({ label, data, icon }) => (
                    <div key={label} className="text-center">
                      <div className={`text-2xl mb-2 ${data ? 'text-green-400' : 'text-gray-400'}`}>
                        {icon}
                      </div>
                      <div className={`text-sm font-medium ${data ? 'text-green-400' : 'text-gray-400'}`}>
                        {label}
                      </div>
                      <div className={`text-xs ${data ? 'text-green-400' : 'text-red-400'}`}>
                        {data ? '✅ Ready' : '❌ Missing'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 text-center">
                  <button
                    onClick={handleBiometricNext}
                    disabled={!faceData || !livenessData?.overall_liveness_passed || keystrokeData.length < 20 || scrollData.length < 10 || !eKYCData}
                    className="terminal-button py-3 px-8 rounded font-bold hover-glow disabled:opacity-50"
                  >
                    PROCEED TO REVIEW
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="glass-card rounded-lg p-6">
              <h2 className="text-xl font-bold text-cyan-400 mb-6">
                REGISTRATION REVIEW
              </h2>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3">User Information</h3>
                  <div className="space-y-2">
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

                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3">Biometric Status</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Face Recognition:</span>
                      <span className="text-green-400">✅ Captured</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Liveness Detection:</span>
                      <span className="text-green-400">✅ Verified</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Behavioral:</span>
                      <span className="text-green-400">✅ Captured</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">eKYC Verification:</span>
                      <span className="text-green-400">✅ Complete</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liveness Details */}
              {livenessData && (
                <div className="bg-black/30 rounded p-4 mb-6">
                  <h4 className="text-green-400 font-semibold mb-2">Enhanced Liveness Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-300">Blinks:</span>
                      <span className="text-cyan-400 ml-2">{livenessData.blink_count || 0}/3</span>
                    </div>
                    <div>
                      <span className="text-gray-300">Mouth Opens:</span>
                      <span className="text-cyan-400 ml-2">{livenessData.mouth_open_count || 0}/2</span>
                    </div>
                    <div>
                      <span className="text-gray-300">Head Movements:</span>
                      <span className="text-cyan-400 ml-2">{livenessData.head_movement_count || 0}/2</span>
                    </div>
                    <div>
                      <span className="text-gray-300">Anti-Spoofing:</span>
                      <span className="text-cyan-400 ml-2">{livenessData.cdcn_enabled ? 'CDCN+Original' : 'Original'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {Object.keys(errors).length > 0 && (
                <div className="bg-red-900/20 border border-red-500/30 rounded p-4 mb-6">
                  <h4 className="text-red-400 font-bold mb-2">Registration Errors:</h4>
                  {Object.entries(errors).map(([key, error]) => (
                    <p key={key} className="text-sm text-red-400 flex items-center mb-1">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {error}
                    </p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => setStep('credentials')}
                  className="terminal-button bg-gray-600 hover:bg-gray-500 py-3 px-6 rounded font-bold"
                >
                  EDIT CREDENTIALS
                </button>
                <button
                  onClick={() => setStep('biometric')}
                  className="terminal-button bg-gray-600 hover:bg-gray-500 py-3 px-6 rounded font-bold"
                >
                  RETAKE BIOMETRIC
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="terminal-button flex-1 py-3 px-6 rounded font-bold hover-glow disabled:opacity-50"
                >
                  {loading ? 'CREATING ACCOUNT...' : 'COMPLETE REGISTRATION'}
                </button>
              </div>
            </div>
          )}

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

      <style>{`
        .glass-modal {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .glass-card {
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(5px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .terminal-input {
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid #10b981;
          color: #10b981;
          font-family: 'IBM Plex Mono', monospace;
        }

        .terminal-input:focus {
          outline: none;
          border-color: #059669;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
        }

        .terminal-button {
          background: linear-gradient(45deg, #059669, #0891b2);
          color: white;
          border: 1px solid #10b981;
          transition: all 0.3s ease;
          font-family: 'IBM Plex Mono', monospace;
        }

        .terminal-button:hover:not(:disabled) {
          background: linear-gradient(45deg, #0891b2, #059669);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
          transform: translateY(-2px);
        }

        .hover-glow {
          transition: all 0.3s ease;
        }

        .hover-glow:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6);
        }

        .terminal-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .neon-glow {
          filter: drop-shadow(0 0 10px currentColor);
        }

        .glitch-text {
          position: relative;
        }

        .glitch-text::before {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
          color: #ff0000;
          transform: translate(-1px, -1px);
          opacity: 0.1;
        }
      `}</style>
    </div>
  );
};

export default Register;