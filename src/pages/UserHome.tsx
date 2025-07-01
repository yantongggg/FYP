import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Shield, 
  Clock, 
  Activity, 
  LogOut,
  Eye,
  Keyboard,
  MousePointer,
  Terminal,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const UserHome = () => {
  const { userData, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const biometricStatus = {
    face: userData?.faceData ? 'ENROLLED' : 'NOT_ENROLLED',
    keystroke: userData?.keystrokeData ? 'ENROLLED' : 'NOT_ENROLLED',
    scroll: userData?.scrollData ? 'ENROLLED' : 'NOT_ENROLLED',
    mouse: 'ACTIVE_MONITORING'
  };

  const securityScore = 95; // Mock security score
  const threatLevel = 'LOW';

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-green-400 mb-2 glitch-text">
              WELCOME, {userData?.username?.toUpperCase()}
            </h1>
            <p className="text-cyan-400 font-mono">USER_DASHBOARD // BIOMETRIC_SECURITY_ACTIVE</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-green-400 font-mono text-sm">SYSTEM_TIME</p>
              <p className="text-cyan-400 font-mono">{currentTime.toLocaleTimeString()}</p>
            </div>
            <button
              onClick={handleLogout}
              className="terminal-button px-4 py-2 rounded font-bold"
            >
              <LogOut className="h-4 w-4 mr-2 inline" />
              LOGOUT
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 terminal-border rounded-lg p-6"
          >
            <h2 className="text-2xl font-bold text-green-400 mb-6 flex items-center">
              <Terminal className="mr-3 h-6 w-6" />
              USER_PROFILE_DATA
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-cyan-400 font-mono">USERNAME:</label>
                  <p className="text-green-400 font-bold font-mono">{userData?.username}</p>
                </div>
                <div>
                  <label className="text-sm text-cyan-400 font-mono">EMAIL:</label>
                  <p className="text-green-400 font-bold font-mono">{userData?.email}</p>
                </div>
                <div>
                  <label className="text-sm text-cyan-400 font-mono">ACCESS_LEVEL:</label>
                  <span className="inline-block px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-sm font-bold font-mono border border-blue-500/30">
                    {userData?.role?.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-cyan-400 font-mono">MEMBER_SINCE:</label>
                  <p className="text-green-400 font-bold font-mono">
                    {userData?.createdAt?.toDate?.()?.toLocaleDateString() || 'UNKNOWN'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-cyan-400 font-mono">LAST_LOGIN:</label>
                  <p className="text-green-400 font-bold font-mono">
                    {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-cyan-400 font-mono">STATUS:</label>
                  <span className="inline-block px-3 py-1 bg-green-600/20 text-green-400 rounded text-sm font-bold font-mono border border-green-500/30">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Security Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="terminal-border rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                SECURITY_SCORE
              </h3>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-400 mb-2 neon-glow">{securityScore}%</div>
                <p className="text-cyan-400 text-sm font-mono">EXCELLENT_SECURITY</p>
              </div>
            </div>

            <div className="terminal-border rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5" />
                THREAT_LEVEL
              </h3>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400 mb-2">{threatLevel}</div>
                <p className="text-cyan-400 text-sm font-mono">NO_ANOMALIES_DETECTED</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Biometric Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 terminal-border rounded-lg p-6"
        >
          <h2 className="text-2xl font-bold text-green-400 mb-6">BIOMETRIC_AUTHENTICATION_STATUS</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="terminal-border rounded-lg p-4 bg-green-900/10">
              <div className="flex items-center justify-between mb-3">
                <Eye className="h-8 w-8 text-green-400" />
                <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${
                  biometricStatus.face === 'ENROLLED' 
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-600/20 text-red-400 border border-red-500/30'
                }`}>
                  {biometricStatus.face}
                </span>
              </div>
              <h3 className="text-lg font-bold text-green-400 font-mono">FACIAL_RECOGNITION</h3>
              <p className="text-cyan-400 text-sm font-mono">Face template for authentication</p>
            </div>

            <div className="terminal-border rounded-lg p-4 bg-green-900/10">
              <div className="flex items-center justify-between mb-3">
                <Keyboard className="h-8 w-8 text-green-400" />
                <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${
                  biometricStatus.keystroke === 'ENROLLED' 
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-600/20 text-red-400 border border-red-500/30'
                }`}>
                  {biometricStatus.keystroke}
                </span>
              </div>
              <h3 className="text-lg font-bold text-green-400 font-mono">KEYSTROKE_DYNAMICS</h3>
              <p className="text-cyan-400 text-sm font-mono">Typing pattern recognition</p>
            </div>

            <div className="terminal-border rounded-lg p-4 bg-green-900/10">
              <div className="flex items-center justify-between mb-3">
                <MousePointer className="h-8 w-8 text-green-400" />
                <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${
                  biometricStatus.scroll === 'ENROLLED' 
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-600/20 text-red-400 border border-red-500/30'
                }`}>
                  {biometricStatus.scroll}
                </span>
              </div>
              <h3 className="text-lg font-bold text-green-400 font-mono">SCROLL_BEHAVIOR</h3>
              <p className="text-cyan-400 text-sm font-mono">Mouse scroll pattern analysis</p>
            </div>

            <div className="terminal-border rounded-lg p-4 bg-green-900/10">
              <div className="flex items-center justify-between mb-3">
                <Activity className="h-8 w-8 text-green-400" />
                <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs font-bold font-mono border border-green-500/30">
                  {biometricStatus.mouse}
                </span>
              </div>
              <h3 className="text-lg font-bold text-green-400 font-mono">BEHAVIORAL_MONITOR</h3>
              <p className="text-cyan-400 text-sm font-mono">Real-time behavior analysis</p>
            </div>
          </div>
        </motion.div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 terminal-border rounded-lg p-6"
        >
          <h2 className="text-2xl font-bold text-green-400 mb-6 flex items-center">
            <Clock className="mr-3 h-6 w-6" />
            SYSTEM_STATUS
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2 neon-glow" />
              <p className="text-green-400 font-bold font-mono">AUTHENTICATION_ACTIVE</p>
              <p className="text-cyan-400 text-sm font-mono">All systems operational</p>
            </div>
            <div className="text-center">
              <Shield className="h-12 w-12 text-green-400 mx-auto mb-2 neon-glow" />
              <p className="text-green-400 font-bold font-mono">ENCRYPTION_ENABLED</p>
              <p className="text-cyan-400 text-sm font-mono">Data secured with AES-256</p>
            </div>
            <div className="text-center">
              <Activity className="h-12 w-12 text-green-400 mx-auto mb-2 neon-glow" />
              <p className="text-green-400 font-bold font-mono">MONITORING_ACTIVE</p>
              <p className="text-cyan-400 text-sm font-mono">Real-time threat detection</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UserHome;