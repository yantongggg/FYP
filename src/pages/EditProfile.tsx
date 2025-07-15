import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Eye, 
  EyeOff, 
  Save, 
  AlertCircle, 
  CheckCircle,
  Settings,
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
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [biometricStatus, setBiometricStatus] = useState({
    face: false,
    keystroke: false,
    behavioral: false
  });

  // const [showBiometricCapture, setShowBiometricCapture] = useState(false);
  // const [biometricType, setBiometricType] = useState<'face' | 'keystroke' | 'scroll'>('face');

  useEffect(() => {
    if (userData) {
      setFormData(prev => ({
        ...prev,
        username: userData.username || '',
        email: userData.email || '',
      }));
    }
    
    // Load biometric status
    loadBiometricStatus();
  }, [userData]);

  useEffect(() => {
    if (userData?.uid && message?.text === 'Auth session missing!') {
      setMessage(null);
    }
  }, [userData?.uid, message]);

  const loadBiometricStatus = async () => {
    try {
      if (!userData?.uid) {
        console.log('❌ No userData.uid found');
        return;
      }

      console.log('🔍 Checking biometric status for user:', userData.uid);

      // Check if this is a demo user (non-UUID format)
      const isDemoUser = userData.uid === 'admin-demo' || userData.uid === 'user-demo' || !userData.uid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
      if (isDemoUser) {
        console.log('✅ Demo user detected, setting all biometrics to true');
        setBiometricStatus({
          face: true,
          keystroke: true,
          behavioral: true
        });
        return;
      }

      const { data: biometricData, error } = await supabase
        .from('biometric_data')
        .select('biometric_type, user_id, created_at')
        .eq('user_id', userData.uid);

      console.log('📊 Biometric query result:', { biometricData, error });

      if (biometricData) {
        const types = biometricData.map((item: { biometric_type: string }) => item.biometric_type);
        console.log('🎯 Found biometric types:', types);
        
        setBiometricStatus({
          face: types.includes('face'),
          keystroke: types.includes('keystroke'),
          behavioral: types.includes('mouse') || types.includes('scroll') || types.includes('behavioral')
        });
        console.log("🌟 Final biometricStatus:", biometricStatus);
        
        console.log('✅ Biometric status set:', {
          face: types.includes('face'),
          keystroke: types.includes('keystroke'),
          behavioral: types.includes('mouse') || types.includes('scroll') || types.includes('behavioral')
        });
      }
    } catch (error) {
      console.error('❌ Error loading biometric status:', error);
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
      if (!userData?.uid) {
        setMessage({ type: 'error', text: 'Authentication session expired. Please login again.' });
        setLoading(false);
        return;
      }

      // Check if this is a demo user
      const isDemoUser = userData?.uid === 'admin-demo' || userData?.uid === 'user-demo' || !userData?.uid?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
      if (isDemoUser) {
        setMessage({ type: 'success', text: 'Demo profile updated successfully (simulation)' });
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        setLoading(false);
        return;
      }

      // Enhanced validation
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setMessage({ type: 'error', text: 'New passwords do not match. Please check and try again.' });
          setLoading(false);
          return;
        }
        if (formData.newPassword.length < 6) {
          setMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
          setLoading(false);
          return;
        }
        if (!formData.currentPassword) {
          setMessage({ type: 'error', text: 'Current password is required to change password.' });
          setLoading(false);
          return;
        }
      }

      // Show progress message
      setMessage({ type: 'success', text: 'Updating profile...' });

      // 🔧 UNIFIED API CALL - handles both profile and password updates
      const updatePayload: any = {
        user_id: userData.uid,
        username: formData.username,
        email: formData.email
      };

      // Only include password fields if changing password
      if (formData.newPassword) {
        updatePayload.current_password = formData.currentPassword;
        updatePayload.new_password = formData.newPassword;
      }

      const response = await fetch('http://localhost:5000/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();
      
      if (!result.success) {
        setMessage({ type: 'error', text: `Update failed: ${result.error}` });
        setLoading(false);
        return;
      }

      // Determine what was updated
      const updatedFields = result.updated_fields || [];
      let successMessage = '';
      
      if (updatedFields.includes('password_hash') && updatedFields.length > 1) {
        successMessage = '✅ Profile information and password updated successfully!';
      } else if (updatedFields.includes('password_hash')) {
        successMessage = '✅ Password updated successfully!';
      } else if (updatedFields.length > 0) {
        successMessage = '✅ Profile information updated successfully!';
      } else {
        successMessage = 'ℹ️ No changes were made to your profile.';
      }

      setMessage({ type: 'success', text: successMessage });

      // Clear password fields after successful update
      if (formData.newPassword) {
        setFormData(prev => ({ 
          ...prev, 
          currentPassword: '', 
          newPassword: '', 
          confirmPassword: '' 
        }));
      }

      // Clear the success message after 5 seconds
      setTimeout(() => {
        setMessage(null);
      }, 5000);

    } catch (error: any) {
      console.error('Unexpected error during profile update:', error);
      setMessage({ 
        type: 'error', 
        text: `Update failed: ${error.message || 'Network error. Please try again.'}` 
      });
    } finally {
      setLoading(false);
    }
  };
  // const handleBiometricReenroll = (type: 'face' | 'keystroke' | 'scroll') => {
  //   setBiometricType(type);
  //   setShowBiometricCapture(true);
  // };

  // const handleBiometricCapture = (data: any) => {
  //   // In a real implementation, this would send the data to the server
  //   setMessage({ type: 'success', text: `${biometricType} data captured successfully` });
  //   setShowBiometricCapture(false);
    
  //   // Update local state
  //   setBiometricStatus(prev => ({
  //     ...prev,
  //     [biometricType]: true
  //   }));
  // };

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
              className={`mb-6 p-4 rounded-lg border-2 ${
                message.type === 'success'
                  ? 'bg-green-600/20 border-green-500/50 text-green-400'
                  : 'bg-red-600/20 border-red-500/50 text-red-400'
              }`}
            >
              <div className="flex items-center">
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                )}
                <span style={{ fontFamily: 'IBM Plex Mono' }} className="font-medium">
                  {message.text}
                </span>
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
              {/* <div>
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
              </div> */}

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
              <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                <Camera className="mr-3 h-6 w-6" />
                BIOMETRIC_SETTINGS
              </h2>

              <div className="p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-lg mb-6">
                <p className="text-yellow-400 font-mono text-sm mb-2">
                  ⚠️ SECURITY_NOTICE
                </p>
                <p className="text-gray-300 font-mono text-sm">
                  Biometric re-enrollment requires administrator approval for security reasons.
                  Contact your system administrator to update biometric data.
                </p>
              </div>

              <div className="space-y-4">
                {biometricStatus.face && (
                  <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                    <div>
                      <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                        BIOMETRIC ENROLLMENT
                      </h3>
                      <p className="text-gray-400 text-sm">
                        ✅ Enrolled and Active
                      </p>
                    </div>
                    <div className="text-green-400 font-mono text-sm">
                      ACTIVE
                    </div>
                  </div>
                )}

                {biometricStatus.keystroke && (
                  <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                    <div>
                      <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                        KEYSTROKE_DYNAMICS
                      </h3>
                      <p className="text-gray-400 text-sm">
                        ✅ Enrolled and Active
                      </p>
                    </div>
                    <div className="text-green-400 font-mono text-sm">
                      ACTIVE
                    </div>
                  </div>
                )}

                {biometricStatus.behavioral && (
                  <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                    <div>
                      <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                        SCROLL_BEHAVIOR
                      </h3>
                      <p className="text-gray-400 text-sm">
                        ✅ Enrolled and Active
                      </p>
                    </div>
                    <div className="text-green-400 font-mono text-sm">
                      ACTIVE
                    </div>
                  </div>
                )}
              </div>


            </div>
          )}
          {activeTab === 'ekyc' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                <FileText className="mr-3 h-6 w-6" />
                eKYC_DOCUMENT_VERIFICATION
              </h2>

              <div className="p-4 bg-green-900/30 border border-green-500/30 rounded-lg">
                <p className="text-green-400 font-mono text-sm mb-2">
                  ✅ Your eKYC documents have been submitted successfully.
                </p>
                <p className="text-gray-400 font-mono text-sm">
                  eKYC documents are securely stored and cannot be re-uploaded.
                  Contact support for any verification issues.
                </p>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
};

export default EditProfile;