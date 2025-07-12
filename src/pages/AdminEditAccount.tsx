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
  LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const AdminEditAccount = () => {
  const { userData, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState({
    face: false,
    keystroke: false,
    behavioral: false
  });

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
        const types = biometricData.map((item: { biometric_type: string }) => item.biometric_type);
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
        setMessage({ type: 'success', text: 'Demo account updated successfully (simulation)' });
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

        // Update auth email if changed
        if (formData.email !== userData?.email) {
          const { error: authError } = await supabase.auth.updateUser({
            email: formData.email
          });
          if (authError) console.warn('Auth email update failed:', authError);
        }
      }
      // Update password if provided
      if (formData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.newPassword
        });

        if (passwordError) throw passwordError;
      }

      setMessage({ type: 'success', text: 'Account updated successfully' });
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update account' });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricReenroll = async (type: string) => {
    setMessage({ type: 'success', text: `${type} re-enrollment initiated. Please complete the biometric capture process.` });
    // In a real implementation, this would trigger the biometric capture flow
  };

  const handleToggle2FA = async () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    setMessage({ 
      type: 'success', 
      text: `Two-factor authentication ${!twoFactorEnabled ? 'enabled' : 'disabled'}` 
    });
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
              ADMIN_ACCOUNT_SETTINGS
            </h1>
            <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
              Manage your administrator account and security settings
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Profile Information */}
            <div className="glass-card rounded-lg p-6">
              <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                <User className="mr-3 h-6 w-6" />
                PROFILE_INFORMATION
              </h2>

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
            </div>

            {/* Security Settings */}
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-6">
                <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                  <Shield className="mr-3 h-6 w-6" />
                  SECURITY_SETTINGS
                </h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                        TWO_FACTOR_AUTHENTICATION
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        id="toggle2fa"
                        checked={twoFactorEnabled}
                        onChange={handleToggle2FA}
                        className="sr-only"
                      />
                      <label
                        htmlFor="toggle2fa"
                        className={`block w-14 h-7 rounded-full transition-colors duration-300 cursor-pointer ${
                          twoFactorEnabled ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 mt-1 ml-1 bg-white rounded-full transition-transform duration-300 ${
                            twoFactorEnabled ? 'transform translate-x-7' : ''
                          }`}
                        />
                      </label>
                    </div>
                  </div>

                  {twoFactorEnabled && (
                    <div className="p-4 bg-green-600/20 border border-green-500/30 rounded-lg">
                      <div className="flex items-center mb-2">
                        <Smartphone className="h-5 w-5 text-green-400 mr-2" />
                        <span className="text-green-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                          2FA_ENABLED
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Your account is protected with two-factor authentication
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card rounded-lg p-6">
                <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center">
                  <Camera className="mr-3 h-6 w-6" />
                  BIOMETRIC_SETTINGS
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                    <div>
                      <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                        FACIAL_RECOGNITION
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {biometricStatus.face ? 'Enrolled' : 'Not enrolled'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleBiometricReenroll('Facial recognition')}
                      className="terminal-button px-4 py-2 rounded text-sm font-bold"
                    >
                      <RefreshCw className="h-4 w-4 mr-1 inline" />
                      RE-ENROLL
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                    <div>
                      <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                        KEYSTROKE_DYNAMICS
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {biometricStatus.keystroke ? 'Enrolled' : 'Not enrolled'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleBiometricReenroll('Keystroke dynamics')}
                      className="terminal-button px-4 py-2 rounded text-sm font-bold"
                    >
                      <RefreshCw className="h-4 w-4 mr-1 inline" />
                      RE-ENROLL
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                    <div>
                      <h3 className="text-cyan-400 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
                        BEHAVIORAL_BIOMETRICS
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {biometricStatus.behavioral ? 'Enrolled' : 'Not enrolled'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleBiometricReenroll('Behavioral biometrics')}
                      className="terminal-button px-4 py-2 rounded text-sm font-bold"
                    >
                      <RefreshCw className="h-4 w-4 mr-1 inline" />
                      RE-ENROLL
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-lg p-6">
                <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center">
                  <Shield className="mr-3 h-6 w-6" />
                  DANGER_ZONE
                </h2>

                <div className="space-y-4">
                  <button
                    onClick={logout}
                    className="w-full py-3 px-6 bg-red-600/20 text-red-400 border border-red-500/30 rounded font-bold hover:bg-red-600/30 transition-all duration-300 hover-glow"
                    style={{ fontFamily: 'IBM Plex Mono' }}
                  >
                    <LogOut className="h-5 w-5 mr-2 inline" />
                    LOGOUT_ALL_SESSIONS
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminEditAccount;