// Fixed UserHome.tsx with all TypeScript errors resolved

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Clock, 
  Activity, 
  LogOut,
  Eye,
  Keyboard,
  MousePointer,
  Terminal,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import BehavioralMonitor from '../components/BehavioralMonitor';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface BehavioralAnalytics {
  total_sessions: number;
  successful_sessions: number;
  total_anomalies: number;
  recent_anomalies: number;
  avg_similarity_score: number;
  sessions: SessionData[];
  anomalies: AnomalyData[];
}

interface SessionData {
  id: string;
  session_type: string;
  similarity_scores: {
    overall_similarity?: number;
    keystroke_similarity?: number;
    mouse_similarity?: number;
  } | null;
  anomaly_score: number;
  is_successful: boolean;
  created_at: string;
  duration_seconds: number;
}

interface AnomalyData {
  id: string;
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action_taken: string;
  anomaly_score: number;
  created_at: string;
  auto_resolved: boolean;
}

interface ExpandedSections {
  profile: boolean;
  security: boolean;
  behavioral: boolean;
  sessions: boolean;
  anomalies: boolean;
}

interface BiometricStatus {
  face: 'ENROLLED' | 'NOT_ENROLLED';
  keystroke: 'ENROLLED' | 'NOT_ENROLLED';
  behavioral: 'ACTIVE_MONITORING' | 'INACTIVE';
  mouse: 'ACTIVE_MONITORING';
}

interface ThreatLevel {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  color: string;
}

interface SupabaseRealtimePayload {
  new: AnomalyData;
  old: any;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

// =====================================
// MAIN COMPONENT
// =====================================

const UserHome = () => {
  // =====================================
  // HOOKS & STATE
  // =====================================

  const { userData, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [analytics, setAnalytics] = useState<BehavioralAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    profile: true,
    security: true,
    behavioral: false,
    sessions: false,
    anomalies: false
  });
  const [realTimeAnomalies, setRealTimeAnomalies] = useState<AnomalyData[]>([]);

  // =====================================
  // EFFECTS
  // =====================================

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load user behavioral analytics
  useEffect(() => {
    if (userData?.uid) {
      loadBehavioralAnalytics();
      setupRealtimeSubscriptions();
    }
  }, [userData]);

  // =====================================
  // API FUNCTIONS
  // =====================================

  const loadBehavioralAnalytics = async (): Promise<void> => {
    try {
      const response = await fetch(`http://localhost:5000/api/behavioral-analytics/${userData?.uid}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      } else {
        console.warn('Failed to load behavioral analytics');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = (): (() => void) => {
    if (!userData?.uid) return () => {};

    // Subscribe to new anomalies for this user
    const channel = supabase
      .channel(`user_${userData.uid}_anomalies`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anomaly_audits',
          filter: `user_id=eq.${userData.uid}`
        },
        (payload: SupabaseRealtimePayload) => {
          console.log('New anomaly detected:', payload);
          setRealTimeAnomalies(prev => [payload.new, ...prev.slice(0, 4)]);
          loadBehavioralAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // =====================================
  // UI HELPER FUNCTIONS
  // =====================================

  const toggleSection = (section: keyof ExpandedSections): void => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getSuccessRate = (): number => {
    if (!analytics || analytics.total_sessions === 0) return 0;
    return (analytics.successful_sessions / analytics.total_sessions) * 100;
  };

  const getSecurityScore = (): number => {
    if (!analytics) return 50;
    
    const successRate = getSuccessRate();
    const recentAnomalies = analytics.recent_anomalies;
    const avgSimilarity = analytics.avg_similarity_score * 100;
    
    // Calculate composite security score
    const score = (successRate * 0.4) + (avgSimilarity * 0.4) + ((7 - Math.min(recentAnomalies, 7)) / 7 * 20);
    return Math.round(Math.max(0, Math.min(100, score)));
  };

  const getThreatLevel = (): ThreatLevel => {
    const securityScore = getSecurityScore();
    const recentAnomalies = analytics?.recent_anomalies || 0;
    
    if (securityScore > 80 && recentAnomalies === 0) {
      return { level: 'LOW', color: 'text-green-400' };
    }
    if (securityScore > 60 && recentAnomalies < 3) {
      return { level: 'MEDIUM', color: 'text-yellow-400' };
    }
    if (securityScore > 40) {
      return { level: 'HIGH', color: 'text-orange-400' };
    }
    return { level: 'CRITICAL', color: 'text-red-400' };
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-400 border-red-500';
      case 'high': return 'text-orange-400 border-orange-500';
      case 'medium': return 'text-yellow-400 border-yellow-500';
      default: return 'text-blue-400 border-blue-500';
    }
  };

  const formatMemberSince = (userData: any): string => {
    try {
      if (userData?.createdAt) {
        // Handle Firebase Timestamp
        if (typeof userData.createdAt.toDate === 'function') {
          return userData.createdAt.toDate().toLocaleDateString();
        }
        // Handle regular Date object or ISO string
        return new Date(userData.createdAt).toLocaleDateString();
      }
      return 'UNKNOWN';
    } catch (error) {
      console.error('Error formatting member since date:', error);
      return 'UNKNOWN';
    }
  };

  // =====================================
  // COMPUTED VALUES
  // =====================================

  const biometricStatus: BiometricStatus = {
    face: userData?.faceData ? 'ENROLLED' : 'NOT_ENROLLED',
    keystroke: (analytics?.total_sessions || 0) > 0 ? 'ENROLLED' : 'NOT_ENROLLED',
    behavioral: analytics ? 'ACTIVE_MONITORING' : 'INACTIVE',
    mouse: 'ACTIVE_MONITORING'
  };

  const securityScore = getSecurityScore();
  const threatLevel = getThreatLevel();

  // =====================================
  // RENDER GUARDS
  // =====================================

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-green-400 mx-auto mb-4 animate-spin" />
          <p className="text-green-400 font-mono">LOADING_USER_ANALYTICS...</p>
        </div>
      </div>
    );
  }

  // =====================================
  // MAIN RENDER
  // =====================================

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <BehavioralMonitor 
        userId={userData?.uid || ''} 
        isActive={true}
        onVerificationComplete={(result) => {
          if (result.success) {
            loadBehavioralAnalytics(); // Refresh analytics
          }
        }}
      />
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-green-400 mb-2 glitch-text">
              WELCOME, {userData?.username?.toUpperCase() || 'USER'}
            </h1>
            <p className="text-cyan-400 font-mono">USER_DASHBOARD // BEHAVIORAL_ANALYTICS_ACTIVE</p>
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

        {/* Real-time Anomaly Alerts */}
        <AnimatePresence>
          {realTimeAnomalies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                  <span className="text-red-400 font-bold">NEW SECURITY ALERT</span>
                </div>
                <button
                  onClick={() => setRealTimeAnomalies([])}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              <p className="text-red-300 text-sm mt-1">
                {realTimeAnomalies[0].anomaly_type} detected at {formatDate(realTimeAnomalies[0].created_at)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 terminal-border rounded-lg"
          >
            <div 
              className="flex justify-between items-center p-6 cursor-pointer"
              onClick={() => toggleSection('profile')}
            >
              <h2 className="text-2xl font-bold text-green-400 flex items-center">
                <Terminal className="mr-3 h-6 w-6" />
                USER_PROFILE_DATA
              </h2>
              {expandedSections.profile ? <ChevronUp className="h-5 w-5 text-green-400" /> : <ChevronDown className="h-5 w-5 text-green-400" />}
            </div>
            
            <AnimatePresence>
              {expandedSections.profile && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-cyan-400 font-mono">USERNAME:</label>
                        <p className="text-green-400 font-bold font-mono">{userData?.username || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-cyan-400 font-mono">EMAIL:</label>
                        <p className="text-green-400 font-bold font-mono">{userData?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-cyan-400 font-mono">ACCESS_LEVEL:</label>
                        <span className="inline-block px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-sm font-bold font-mono border border-blue-500/30">
                          {userData?.role?.toUpperCase() || 'USER'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-cyan-400 font-mono">MEMBER_SINCE:</label>
                        <p className="text-green-400 font-bold font-mono">
                          {formatMemberSince(userData)}
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
              )}
            </AnimatePresence>
          </motion.div>

          {/* Security Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="terminal-border rounded-lg">
              <div 
                className="flex justify-between items-center p-6 cursor-pointer"
                onClick={() => toggleSection('security')}
              >
                <h3 className="text-lg font-bold text-green-400 flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  SECURITY_SCORE
                </h3>
                {expandedSections.security ? <ChevronUp className="h-5 w-5 text-green-400" /> : <ChevronDown className="h-5 w-5 text-green-400" />}
              </div>
              
              <AnimatePresence>
                {expandedSections.security && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 pb-6"
                  >
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-green-400 mb-2 neon-glow">{securityScore}%</div>
                      <p className="text-cyan-400 text-sm font-mono">
                        {securityScore > 80 ? 'EXCELLENT_SECURITY' : 
                         securityScore > 60 ? 'GOOD_SECURITY' : 
                         securityScore > 40 ? 'FAIR_SECURITY' : 'NEEDS_ATTENTION'}
                      </p>
                    </div>
                    
                    {analytics && (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Success Rate:</span>
                          <span className="text-green-400">{getSuccessRate().toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Avg Similarity:</span>
                          <span className="text-green-400">{(analytics.avg_similarity_score * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Recent Anomalies:</span>
                          <span className={analytics.recent_anomalies > 0 ? "text-yellow-400" : "text-green-400"}>
                            {analytics.recent_anomalies}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="terminal-border rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5" />
                THREAT_LEVEL
              </h3>
              <div className="text-center">
                <div className={`text-2xl font-bold mb-2 ${threatLevel.color}`}>{threatLevel.level}</div>
                <p className="text-cyan-400 text-sm font-mono">
                  {threatLevel.level === 'LOW' ? 'NO_ANOMALIES_DETECTED' :
                   threatLevel.level === 'MEDIUM' ? 'MONITORING_REQUIRED' :
                   threatLevel.level === 'HIGH' ? 'INCREASED_MONITORING' : 'IMMEDIATE_ATTENTION_REQUIRED'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Behavioral Analytics */}
        {analytics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 terminal-border rounded-lg"
          >
            <div 
              className="flex justify-between items-center p-6 cursor-pointer"
              onClick={() => toggleSection('behavioral')}
            >
              <h2 className="text-2xl font-bold text-green-400 flex items-center">
                <BarChart3 className="mr-3 h-6 w-6" />
                BEHAVIORAL_ANALYTICS
              </h2>
              {expandedSections.behavioral ? <ChevronUp className="h-5 w-5 text-green-400" /> : <ChevronDown className="h-5 w-5 text-green-400" />}
            </div>
            
            <AnimatePresence>
              {expandedSections.behavioral && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="text-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                      <Activity className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-400">{analytics.total_sessions}</p>
                      <p className="text-sm text-cyan-400 font-mono">TOTAL_SESSIONS</p>
                    </div>
                    <div className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                      <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-400">{analytics.successful_sessions}</p>
                      <p className="text-sm text-cyan-400 font-mono">SUCCESSFUL</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                      <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-yellow-400">{analytics.total_anomalies}</p>
                      <p className="text-sm text-cyan-400 font-mono">TOTAL_ANOMALIES</p>
                    </div>
                    <div className="text-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                      <TrendingUp className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-400">{(analytics.avg_similarity_score * 100).toFixed(0)}%</p>
                      <p className="text-sm text-cyan-400 font-mono">AVG_SIMILARITY</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Recent Sessions */}
        {analytics && analytics.sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 terminal-border rounded-lg"
          >
            <div 
              className="flex justify-between items-center p-6 cursor-pointer"
              onClick={() => toggleSection('sessions')}
            >
              <h2 className="text-2xl font-bold text-green-400 flex items-center">
                <History className="mr-3 h-6 w-6" />
                RECENT_SESSIONS
              </h2>
              {expandedSections.sessions ? <ChevronUp className="h-5 w-5 text-green-400" /> : <ChevronDown className="h-5 w-5 text-green-400" />}
            </div>
            
            <AnimatePresence>
              {expandedSections.sessions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-6"
                >
                  <div className="space-y-4">
                    {analytics.sessions.map((session: SessionData) => (
                      <div key={session.id} className="glass-card rounded p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center">
                            {session.is_successful ? (
                              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                            )}
                            <span className="text-cyan-400 font-mono text-sm">
                              {session.session_type.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-gray-400 text-sm">
                            {formatDate(session.created_at)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Overall Score:</span>
                            <span className={`ml-2 font-bold ${
                              (session.similarity_scores?.overall_similarity || 0) > 0.7 ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                              {((session.similarity_scores?.overall_similarity || 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Duration:</span>
                            <span className="ml-2 text-cyan-400">{session.duration_seconds}s</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Anomaly Score:</span>
                            <span className={`ml-2 font-bold ${
                              session.anomaly_score > 0.5 ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {(session.anomaly_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Anomaly History */}
        {analytics && analytics.anomalies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 terminal-border rounded-lg"
          >
            <div 
              className="flex justify-between items-center p-6 cursor-pointer"
              onClick={() => toggleSection('anomalies')}
            >
              <h2 className="text-2xl font-bold text-green-400 flex items-center">
                <AlertTriangle className="mr-3 h-6 w-6" />
                ANOMALY_HISTORY
              </h2>
              {expandedSections.anomalies ? <ChevronUp className="h-5 w-5 text-green-400" /> : <ChevronDown className="h-5 w-5 text-green-400" />}
            </div>
            
            <AnimatePresence>
              {expandedSections.anomalies && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-6"
                >
                  <div className="space-y-4">
                    {analytics.anomalies.map((anomaly: AnomalyData) => (
                      <div key={anomaly.id} className={`glass-card rounded p-4 border-l-4 ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center">
                            <AlertTriangle className={`h-5 w-5 mr-2 ${getSeverityColor(anomaly.severity).split(' ')[0]}`} />
                            <span className="font-bold text-white">
                              {anomaly.anomaly_type.toUpperCase().replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              anomaly.severity === 'critical' ? 'bg-red-600/20 text-red-400' :
                              anomaly.severity === 'high' ? 'bg-orange-600/20 text-orange-400' :
                              anomaly.severity === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                              'bg-blue-600/20 text-blue-400'
                            }`}>
                              {anomaly.severity.toUpperCase()}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {formatDate(anomaly.created_at)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Score:</span>
                            <span className="ml-2 text-red-400 font-bold">
                              {(anomaly.anomaly_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Action:</span>
                            <span className="ml-2 text-cyan-400">{anomaly.action_taken}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Status:</span>
                            <span className={`ml-2 ${anomaly.auto_resolved ? 'text-green-400' : 'text-yellow-400'}`}>
                              {anomaly.auto_resolved ? 'RESOLVED' : 'ACTIVE'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Biometric Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
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
                  biometricStatus.behavioral === 'ACTIVE_MONITORING' 
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-600/20 text-red-400 border border-red-500/30'
                }`}>
                  {biometricStatus.behavioral}
                </span>
              </div>
              <h3 className="text-lg font-bold text-green-400 font-mono">BEHAVIORAL_PATTERNS</h3>
              <p className="text-cyan-400 text-sm font-mono">Mouse & interaction analysis</p>
            </div>

            <div className="terminal-border rounded-lg p-4 bg-green-900/10">
              <div className="flex items-center justify-between mb-3">
                <Activity className="h-8 w-8 text-green-400" />
                <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs font-bold font-mono border border-green-500/30">
                  {biometricStatus.mouse}
                </span>
              </div>
              <h3 className="text-lg font-bold text-green-400 font-mono">CONTINUOUS_MONITOR</h3>
              <p className="text-cyan-400 text-sm font-mono">Real-time behavior analysis</p>
            </div>
          </div>
        </motion.div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
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

      {/* Styles */}
      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .terminal-border {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .terminal-button {
          background: linear-gradient(45deg, #059669, #0891b2);
          color: white;
          border: 1px solid #10b981;
          transition: all 0.3s ease;
        }

        .terminal-button:hover:not(:disabled) {
          background: linear-gradient(45deg, #0891b2, #059669);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
          transform: translateY(-2px);
        }

        .glitch-text {
          animation: glitch 2s infinite;
        }

        .neon-glow {
          text-shadow: 0 0 5px #10b981, 0 0 10px #10b981, 0 0 15px #10b981;
        }

        @keyframes glitch {
          0%, 100% { text-shadow: 0 0 5px #10b981; }
          25% { text-shadow: -2px 0 #10b981, 2px 0 #06b6d4; }
          50% { text-shadow: 2px 0 #10b981, -2px 0 #06b6d4; }
          75% { text-shadow: 0 0 5px #10b981; }
        }
      `}</style>
    </div>
  );
};

export default UserHome;