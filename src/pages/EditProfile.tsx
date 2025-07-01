import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  Shield, 
  Eye, 
  EyeOff, 
  Save, 
  AlertCircle, 
  CheckCircle,
  Settings,
  Smartphone,
  Key,
  RefreshCw,
  Camera,
  FileText,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import BiometricCapture from '../components/BiometricCapture';

const EditProfile = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [biometricStatus, setBiometricStatus] = useState({
    face: false,
    keystroke: false,
    behavioral: false
  });

  const [showBiometricCapture, setShowBiometricCapture] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'keystroke' | 'scroll'>('face');

  useEffect(() => {
    if (userData) {
      setFormData(prev => ({
        ...prev,
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || ''
      }));
    }
    
    // Load biometric status
    loadBiometricStatus();
  }, [userData]);

  const loadBiometricStatus = async () => {
    try {
      if (!userData?.uid) return;

      // Check if this is a demo user (non-UUID format)
      const isDemoUser = userData.uid === 'admin-demo' || userData.uid === 'user-demo' || !userData.uid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      if (isDemoUser) {
        // Set default biometric status for demo users
        setBiometricStatus({
          face: true,
          keystroke: true,
          behavioral: true
        });
        return;
      }

      const { data: biometricData } = await supabase
        .from('biometric_data')
        .select('biometric_type')
        .eq('user_id', userData.uid);

      if (biometricData) {
        const types = biometricData.map(item => item.biometric_type);
        setBiometricStatus({
          face: types.includes('face'),
          keystroke: types.includes('keystroke'),
          behavioral: types.includes('mouse') || types.includes('scroll')
        });
      }
    } catch (error) {
      console.error('Error loading biometric status:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (message) setMessage(null);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Check if this is a demo user
      const isDemoUser = userData?.uid === 'admin-demo' || userData?.uid === 'user-demo' || !userData?.uid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      if (isDemoUser) {
        // For demo users, just show success message without actual database update
        setMessage({ type: 'success', text: 'Demo profile updated successfully (simulation)' });
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        setLoading(false);
        return;
      }

      // Validate passwords if changing
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('New passwords do not match');
        }
        if (formData.newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters');
        }
        if (!formData.currentPassword) {
          throw new Error('Current password is required to change password');
        }
      }

      // Update profile information
      const updates: any = {};
      if (formData.username !== userData?.username) updates.username = formData.username;
      if (formData.email !== userData?.email) updates.email = formData.email;
      if (formData.phone !== userData?.phone) updates.phone = formData.phone;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', userData?.uid);

        if (updateError) throw updateError;
      }

      // Update password if provided
      if (formData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword
        });

        if (passwordError) throw passwordError;
      }

      setMessage({ type: 'success', text: 'Profile updated successfully' });
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricReenroll = (type: 'face' | 'keystroke' | 'scroll') => {
    setBiometricType(type);
    setShowBiometricCapture(true);
  };

  const handleBiometricCapture = (data: any) => {
    // In a real implementation, this would send the data to the server
    setMessage({ type: 'success', text: `${biometricType} data captured successfully` });
    setShowBiometricCapture(false);
    
    // Update local state
    setBiometricStatus(prev => ({
      ...prev,
      [biometricType]: true
    }));
  };

  const handleEKYCCapture = (data: any) => {
    setMessage({ type: 'success', text: 'eKYC documents uploaded successfully' });
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-modal rounded-lg p-8"
        >
          <div className="text-center mb-8">
            <Settings className="h-12 w-12 text-green-400 mx-auto mb-4 neon-glow" />
            <h1 className="text-3xl font-bold text-green-400 mb-2 glitch-text" style={{ fontFamily: 'Orbitron' }}>
              EDIT_PROFILE
            </h1>
            <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
              Update your profile information and security settings
            </p>
          </div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg border ${
                message.type === 'success'
                  ? 'bg-green-600/20 border-green-500/30 text-green-400'
                  : 'bg-red-600/20 border-red-500/30 text-red-400'
              }`}
            >
              <div className="flex items-center">
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 mr-2" />
                ) : (
                  <AlertCircle className="h-5 w-5 mr-2" />
                )}
                <span style={{ fontFamily: 'IBM Plex Mono' }}>{message.text}</span>
              </div>
            </motion.div>
          )}

          {/* Tabs */}
          <div className="mb-8 border-b border-green-500/30">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-bold text-sm transition-all duration-300 font-mono ${
                  activeTab === 'profile'
                    ? 'border-green-500 text-green-400 neon-glow'
                    : 'border-transparent text-cyan-400 hover:text-green-400'
                }`}
              >
                <User className="h-4 w-4" />
                <span>PROFILE</span>
              </button>
              
              <button
                onClick={() => setActiveTab('biometrics')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-bold text-sm transition-all duration-300 font-mono ${
                  activeTab === 'biometrics'
                    ? 'border-green-500 text-green-400 neon-glow'
                    : 'border-transparent text-cyan-400 hover:text-green-400'
                }`}
              >
                <Camera className="h-4 w-4" />
                <span>BIOMETRICS</span>
              </button>
              
              <button
                onClick={() => setActiveTab('ekyc')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-bold text-sm transition-all duration-300 font-mono ${
                  activeTab === 'ekyc'
                    ? 'border-green-500 text-green-400 neon-glow'
                    : 'border-transparent text-cyan-400 hover:text-green-400'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>eKYC</span>
              </button>
            </div>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                  USERNAME
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="terminal-input w-full pl-10 pr-4 py-3 rounded"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                  EMAIL_ADDRESS
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="terminal-input w-full pl-10 pr-4 py-3 rounded"
                    placeholder="Enter email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                  PHONE_NUMBER
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="terminal-input w-full pl-10 pr-4 py-3 rounded"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div className="border-t border-green-500/30 pt-6">
                <h3 className="text-lg font-bold text-cyan-400 mb-4">CHANGE_PASSWORD</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                      CURRENT_PASSWORD
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        className="terminal-input w-full pl-10 pr-12 py-3 rounded"
                        placeholder="Enter current password"
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

                  <div>
                    <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                      NEW_PASSWORD
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="terminal-input w-full pl-10 pr-12 py-3 rounded"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400 hover:text-cyan-400"
                      >
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                      CONFIRM_NEW_PASSWORD
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="terminal-input w-full pl-10 pr-4 py-3 rounded"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="terminal-button w-full py-3 px-6 rounded font-bold hover-glow"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                    UPDATING...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Save className="h-5 w-5 mr-2" />
                    UPDATE_PROFILE
                  </div>
                )}
              </button>
            </form>
          )}

          {/* Biometrics Tab */}
          {activeTab === 'biometrics' && (
            <div className="space-y-6">
              {showBiometricCapture ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-green-400">
                      {biometricType === 'face' ? 'FACIAL_RECOGNITION' : 
                       biometricType === 'keystroke' ? 'KEYSTROKE_DYNAMICS' : 'SCROLL_BEHAVIOR'}
                    </h3>
                    <button
                      onClick={() => setShowBiometricCapture(false)}
                      className="terminal-button px-3 py-2 rounded text-sm"
                    >
                      <X className="h-4 w-4 mr-1 inline" />
                      CANCEL
                    </button>
                  </div>
                  
                  <BiometricCapture
                    onFaceCapture={(data) => handleBiometricCapture(data)}
                    onLivenessCapture={(data) => handleBiometricCapture(data)}
                    onKeystrokeCapture={(data) => handleBiometricCapture(data)}
                    onScrollCapture={(data) => handleBiometricCapture(data)}
                    mode="authentication"
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                    <Camera className="mr-3 h-6 w-6" />
                    BIOMETRIC_SETTINGS
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                      <div>
                        <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                          FACIAL_RECOGNITION
                        </h3>
                        <p className="text-gray-400 text-sm">
                          {biometricStatus.face ? 'Enrolled' : 'Not enrolled'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleBiometricReenroll('face')}
                        className="terminal-button px-4 py-2 rounded text-sm font-bold"
                      >
                        <RefreshCw className="h-4 w-4 mr-1 inline" />
                        RE-ENROLL
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                      <div>
                        <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                          KEYSTROKE_DYNAMICS
                        </h3>
                        <p className="text-gray-400 text-sm">
                          {biometricStatus.keystroke ? 'Enrolled' : 'Not enrolled'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleBiometricReenroll('keystroke')}
                        className="terminal-button px-4 py-2 rounded text-sm font-bold"
                      >
                        <RefreshCw className="h-4 w-4 mr-1 inline" />
                        RE-ENROLL
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                      <div>
                        <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                          SCROLL_BEHAVIOR
                        </h3>
                        <p className="text-gray-400 text-sm">
                          {biometricStatus.behavioral ? 'Enrolled' : 'Not enrolled'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleBiometricReenroll('scroll')}
                        className="terminal-button px-4 py-2 rounded text-sm font-bold"
                      >
                        <RefreshCw className="h-4 w-4 mr-1 inline" />
                        RE-ENROLL
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* eKYC Tab */}
          {activeTab === 'ekyc' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                <FileText className="mr-3 h-6 w-6" />
                eKYC_DOCUMENT_VERIFICATION
              </h2>

              <div className="p-4 bg-yellow-600/20 border border-yellow-500/30 rounded-lg mb-6">
                <p className="text-yellow-400 text-sm font-bold mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                  ⚠️ IMPORTANT INSTRUCTIONS:
                </p>
                <ul className="text-yellow-300 text-sm space-y-1" style={{ fontFamily: 'IBM Plex Mono' }}>
                  <li>• Upload BOTH front and back of your Malaysian IC (MyKad)</li>
                  <li>• Ensure images are clear, well-lit, and not blurry</li>
                  <li>• IC must be placed on a plain white background</li>
                  <li>• Face on IC will be matched with your biometric profile</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-green-400 font-bold mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                    IC FRONT (WITH PHOTO)
                  </label>
                  <div className="border-2 border-dashed border-green-500/50 rounded-lg p-6 text-center">
                    <FileText className="h-12 w-12 text-green-400 mx-auto mb-2" />
                    <p className="text-cyan-400 text-sm">Upload IC front side</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="ic-front"
                    />
                    <label
                      htmlFor="ic-front"
                      className="terminal-button mt-3 px-4 py-2 rounded inline-block cursor-pointer"
                    >
                      UPLOAD FRONT
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-green-400 font-bold mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
                    IC BACK (WITH SIGNATURE)
                  </label>
                  <div className="border-2 border-dashed border-green-500/50 rounded-lg p-6 text-center">
                    <FileText className="h-12 w-12 text-green-400 mx-auto mb-2" />
                    <p className="text-cyan-400 text-sm">Upload IC back side</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="ic-back"
                    />
                    <label
                      htmlFor="ic-back"
                      className="terminal-button mt-3 px-4 py-2 rounded inline-block cursor-pointer"
                    >
                      UPLOAD BACK
                    </label>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleEKYCCapture({})}
                className="terminal-button w-full py-3 px-6 rounded font-bold hover-glow mt-4"
              >
                <div className="flex items-center justify-center">
                  <Save className="h-5 w-5 mr-2" />
                  SUBMIT_DOCUMENTS
                </div>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default EditProfile;