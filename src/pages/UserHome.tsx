import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  User,
  Shield,
  Camera,
  FileText,
  Activity,
  CheckCircle,
  AlertTriangle,
  Eye,
  Fingerprint,
  Keyboard,
  MousePointer,
  RefreshCw,
  TrendingUp,
  Loader2,
  Upload,
  Edit3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import EKYCDocumentViewer from '../components/EKYCDocumentViewer';

interface BiometricData {
  id: string;
  biometric_type: string;
  face_embedding?: number[];
  face_image_url?: string;
  quality_score: number;
  capture_timestamp: string;
  enrollment_device_info?: any;
  created_at: string;
}

interface BehavioralPattern {
  id: string;
  user_id: string;
  pattern_data: {
    keystroke_features?: any;
    mouse_features?: any;
    enrollment_metadata?: any;
  };
  is_active: boolean;
  created_at: string;
}

interface EKYCDocument {
  id: string;
  document_type: string;
  verification_status: string;
  face_match_score: number;
  document_authenticity_score: number;
  created_at: string;
  extracted_info?: any;
  id_document_url?: string;
}

interface BehavioralSession {
  id: string;
  session_id: string;
  similarity_scores: {
    overall_similarity: number;
    keystroke_similarity: number;
    mouse_similarity: number;
  };
  anomaly_score: number;
  is_successful: boolean;
  created_at: string;
}

interface AnomalyAudit {
  id: string;
  anomaly_type: string;
  anomaly_score: number;
  severity: string;
  action_taken: string;
  created_at: string;
  details?: any;
}

interface UserBiometricData {
  biometrics: BiometricData[];
  behavioralPatterns: BehavioralPattern[];
  ekycDocuments: EKYCDocument[];
  behavioralSessions: BehavioralSession[];
  anomalies: AnomalyAudit[];
  loading: boolean;
  lastUpdated: Date | null;
}

const UserHome: React.FC = () => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Properly typed state for user biometric data
  const [userBiometricData, setUserBiometricData] = useState<UserBiometricData>({
    biometrics: [],
    behavioralPatterns: [],
    ekycDocuments: [],
    behavioralSessions: [],
    anomalies: [],
    loading: true,
    lastUpdated: null
  });

  // Load all biometric data with proper user ID handling
  const loadBiometricData = async () => {
    if (!userData?.uid || userData.uid.includes('demo')) {
      // Demo data
      setUserBiometricData({
        biometrics: [{
          id: 'demo-bio-1',
          biometric_type: 'face',
          quality_score: 0.95,
          capture_timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          face_image_url: 'https://via.placeholder.com/150'
        }],
        behavioralPatterns: [{
          id: 'demo-behavioral-1',
          user_id: userData?.uid ?? '',
          pattern_data: {
            keystroke_features: { avg_dwell_time: 120, typing_speed: 45 },
            mouse_features: { avg_velocity: 150 },
            enrollment_metadata: { total_keystrokes: 150, total_mouse_events: 80 }
          },
          is_active: true,
          created_at: new Date().toISOString()
        }],
        ekycDocuments: [{
          id: 'demo-ekyc-1',
          document_type: 'ic_front',
          verification_status: 'verified',
          face_match_score: 0.92,
          document_authenticity_score: 0.88,
          created_at: new Date().toISOString()
        }],
        behavioralSessions: [],
        anomalies: [],
        loading: false,
        lastUpdated: new Date()
      });
      return;
    }

    try {
      setUserBiometricData(prev => ({ ...prev, loading: true }));
      
      console.log('🔍 Loading biometric data for user:', userData.uid);

      // Load biometric data - try both user_id formats
      const { data: biometrics, error: bioError } = await supabase
        .from('biometric_data')
        .select('*')
        .eq('user_id', userData.uid)
        .order('created_at', { ascending: false });

      if (bioError) {
        console.error('Error loading biometric data:', bioError);
      }

      // Load behavioral patterns
      const { data: behavioralPatterns, error: behavError } = await supabase
        .from('behavioral_patterns')
        .select('*')
        .eq('user_id', userData.uid)
        .order('created_at', { ascending: false });

      if (behavError) {
        console.error('Error loading behavioral patterns:', behavError);
      }

      // Load eKYC documents  
      const { data: ekycDocuments, error: ekycError } = await supabase
        .from('ekyc_documents')
        .select('*')
        .eq('user_id', userData.uid)
        .order('created_at', { ascending: false });

      if (ekycError) {
        console.error('Error loading eKYC documents:', ekycError);
      }

      // Load behavioral sessions - note: this table uses user_id as text
      const { data: behavioralSessions, error: sessError } = await supabase
        .from('behavioral_sessions')
        .select('*')
        .eq('user_id', userData.uid)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessError) {
        console.error('Error loading behavioral sessions:', sessError);
      }

      // Load anomaly audits - note: this table uses user_id as text  
      const { data: anomalies, error: anomError } = await supabase
        .from('anomaly_audits')
        .select('*')
        .eq('user_id', userData.uid)
        .order('created_at', { ascending: false })
        .limit(5);

      if (anomError) {
        console.error('Error loading anomalies:', anomError);
      }

      console.log('📊 Loaded data:', {
        biometrics: biometrics?.length || 0,
        behavioralPatterns: behavioralPatterns?.length || 0,  
        ekycDocuments: ekycDocuments?.length || 0,
        behavioralSessions: behavioralSessions?.length || 0,
        anomalies: anomalies?.length || 0
      });

      setUserBiometricData({
        biometrics: biometrics || [],
        behavioralPatterns: behavioralPatterns || [],
        ekycDocuments: ekycDocuments || [],
        behavioralSessions: behavioralSessions || [],
        anomalies: anomalies || [],
        loading: false,
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('Error loading biometric data:', error);
      setUserBiometricData(prev => ({ ...prev, loading: false }));
    }
  };

  // Real-time subscription for biometric data updates
  useEffect(() => {
    if (!userData?.uid || userData.uid.includes('demo')) return;

    const subscription = supabase
      .channel('user-biometric-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'biometric_data',
        filter: `user_id=eq.${userData.uid}`
      }, () => {
        console.log('Biometric data updated, refreshing...');
        loadBiometricData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public', 
        table: 'behavioral_patterns',
        filter: `user_id=eq.${userData.uid}`
      }, () => {
        console.log('Behavioral patterns updated, refreshing...');
        loadBiometricData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ekyc_documents',
        filter: `user_id=eq.${userData.uid}`
      }, () => {
        console.log('eKYC documents updated, refreshing...');
        loadBiometricData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'behavioral_sessions',
        filter: `user_id=eq.${userData.uid}`
      }, () => {
        console.log('Behavioral sessions updated, refreshing...');
        loadBiometricData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userData?.uid]);

  // Initial load
  useEffect(() => {
    loadBiometricData();
  }, [userData?.uid]);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBiometricData();
    setRefreshing(false);
  };

  // Handle re-enrollment
  const handleReEnroll = async (type: string) => {
    try {
      console.log(`🔄 Starting re-enrollment for ${type}`);
      
      if (type === 'face') {
        // Redirect to registration page or open biometric capture modal
        alert('Face re-enrollment will open biometric capture. Redirect to registration page.');
      } else if (type === 'keystroke') {
        alert('Keystroke re-enrollment will start behavioral capture. Redirect to registration page.');
      } else if (type === 'scroll') {
        alert('Scroll behavior re-enrollment will start behavioral capture. Redirect to registration page.');
      }
      
    } catch (error) {
      console.error('Re-enrollment error:', error);
    }
  };

  if (!userData) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-cyan-400">Loading user data...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: User },
    { id: 'biometric', name: 'Biometric', icon: Fingerprint },
    { id: 'behavioral', name: 'Behavioral', icon: Activity },
    { id: 'ekyc', name: 'eKYC', icon: FileText },
    { id: 'security', name: 'Security', icon: Shield }
  ];

  // Calculate enhanced statistics
  const biometricStats = {
    faceEnrolled: userBiometricData.biometrics.some((bio: BiometricData) => bio.biometric_type === 'face'),
    keystrokeEnrolled: userBiometricData.behavioralPatterns.some((pattern: BehavioralPattern) => 
      pattern.pattern_data?.keystroke_features && Object.keys(pattern.pattern_data.keystroke_features).length > 0
    ),
    scrollEnrolled: userBiometricData.behavioralPatterns.some((pattern: BehavioralPattern) => 
      pattern.pattern_data?.mouse_features && Object.keys(pattern.pattern_data.mouse_features).length > 0
    ),
    ekycVerified: userBiometricData.ekycDocuments.some((doc: EKYCDocument) => doc.verification_status === 'verified'),
    behavioralSessions: userBiometricData.behavioralSessions.length,
    recentAnomalies: userBiometricData.anomalies.filter((anomaly: AnomalyAudit) => {
      const anomalyDate = new Date(anomaly.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return anomalyDate > weekAgo;
    }).length
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-green-400 mb-2" style={{ fontFamily: 'Orbitron' }}>
                USER PROFILE TERMINAL
              </h1>
              <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
                Welcome back, {userData.username}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {userBiometricData.lastUpdated && (
                <div className="text-sm text-gray-400">
                  Last updated: {userBiometricData.lastUpdated.toLocaleTimeString()}
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="terminal-button px-4 py-2 rounded flex items-center"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Face Biometric</p>
                <p className={`text-lg font-bold ${biometricStats.faceEnrolled ? 'text-green-400' : 'text-red-400'}`}>
                  {biometricStats.faceEnrolled ? 'ENROLLED' : 'NOT_ENROLLED'}
                </p>
              </div>
              <Camera className={`h-8 w-8 ${biometricStats.faceEnrolled ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Keystroke Dynamics</p>
                <p className={`text-lg font-bold ${biometricStats.keystrokeEnrolled ? 'text-green-400' : 'text-red-400'}`}>
                  {biometricStats.keystrokeEnrolled ? 'ENROLLED' : 'NOT_ENROLLED'}
                </p>
              </div>
              <Keyboard className={`h-8 w-8 ${biometricStats.keystrokeEnrolled ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Scroll Behavior</p>
                <p className={`text-lg font-bold ${biometricStats.scrollEnrolled ? 'text-green-400' : 'text-red-400'}`}>
                  {biometricStats.scrollEnrolled ? 'ENROLLED' : 'NOT_ENROLLED'}
                </p>
              </div>
              <MousePointer className={`h-8 w-8 ${biometricStats.scrollEnrolled ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
          </div>

          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">eKYC Status</p>
                <p className={`text-lg font-bold ${biometricStats.ekycVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                  {biometricStats.ekycVerified ? 'VERIFIED' : 'PENDING'}
                </p>
              </div>
              <FileText className={`h-8 w-8 ${biometricStats.ekycVerified ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                    : 'text-gray-400 hover:text-cyan-400'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* User Information */}
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">User Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Username</p>
                    <p className="text-cyan-400 font-bold">{userData.username}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="text-cyan-400">{userData.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Role</p>
                    <p className="text-cyan-400">{userData.role?.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Trust Score</p>
                    <p className="text-yellow-400">{userData.trust_score || 85}/100</p>
                  </div>
                </div>
              </div>

              {/* Enrollment Status Overview */}
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">Biometric Enrollment Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                    <div className="flex items-center">
                      <Camera className={`h-5 w-5 mr-3 ${biometricStats.faceEnrolled ? 'text-green-400' : 'text-red-400'}`} />
                      <span className="text-cyan-400">Face Recognition</span>
                    </div>
                    {biometricStats.faceEnrolled ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <button
                        onClick={() => handleReEnroll('face')}
                        className="terminal-button px-2 py-1 text-xs rounded"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                    <div className="flex items-center">
                      <Keyboard className={`h-5 w-5 mr-3 ${biometricStats.keystrokeEnrolled ? 'text-green-400' : 'text-red-400'}`} />
                      <span className="text-cyan-400">Keystroke Dynamics</span>
                    </div>
                    {biometricStats.keystrokeEnrolled ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <button
                        onClick={() => handleReEnroll('keystroke')}
                        className="terminal-button px-2 py-1 text-xs rounded"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                    <div className="flex items-center">
                      <MousePointer className={`h-5 w-5 mr-3 ${biometricStats.scrollEnrolled ? 'text-green-400' : 'text-red-400'}`} />
                      <span className="text-cyan-400">Scroll Behavior</span>
                    </div>
                    {biometricStats.scrollEnrolled ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <button
                        onClick={() => handleReEnroll('scroll')}
                        className="terminal-button px-2 py-1 text-xs rounded"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                    <div className="flex items-center">
                      <FileText className={`h-5 w-5 mr-3 ${biometricStats.ekycVerified ? 'text-green-400' : 'text-yellow-400'}`} />
                      <span className="text-cyan-400">eKYC Documents</span>
                    </div>
                    {biometricStats.ekycVerified ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">Recent Activity</h3>
                {userBiometricData.behavioralSessions.length > 0 ? (
                  <div className="space-y-3">
                    {userBiometricData.behavioralSessions.slice(0, 5).map((session: BehavioralSession) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-black/20 rounded">
                        <div className="flex items-center">
                          <Activity className="h-5 w-5 text-cyan-400 mr-3" />
                          <div>
                            <p className="text-cyan-400 text-sm">Behavioral Session</p>
                            <p className="text-gray-400 text-xs">
                              Similarity: {(session.similarity_scores?.overall_similarity * 100 || 0).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {session.is_successful ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                          )}
                          <span className="text-gray-400 text-xs ml-2">
                            {new Date(session.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No recent activity</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'biometric' && (
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">Biometric Enrollment Status</h3>
                
                {userBiometricData.loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-4" />
                    <p className="text-cyan-400">Loading biometric data...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userBiometricData.biometrics.map((biometric: BiometricData) => (
                      <div key={biometric.id} className="flex items-center justify-between p-4 bg-black/20 rounded">
                        <div className="flex items-center">
                          <Camera className="h-6 w-6 text-green-400 mr-3" />
                          <div>
                            <p className="text-cyan-400 font-bold">{biometric.biometric_type.toUpperCase()}</p>
                            <p className="text-gray-400 text-sm">
                              Quality: {(biometric.quality_score * 100).toFixed(1)}%
                            </p>
                            <p className="text-gray-400 text-xs">
                              Enrolled: {new Date(biometric.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {biometric.face_image_url && (
                            <img
                              src={biometric.face_image_url}
                              alt="Face biometric"
                              className="w-16 h-16 rounded border-2 border-green-400 mr-4"
                            />
                          )}
                          <CheckCircle className="h-6 w-6 text-green-400" />
                        </div>
                      </div>
                    ))}
                    
                    {userBiometricData.biometrics.length === 0 && (
                      <div className="text-center py-8">
                        <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400">No biometric data enrolled</p>
                        <button
                          onClick={() => handleReEnroll('face')}
                          className="terminal-button mt-4 px-4 py-2 rounded"
                        >
                          Enroll Face Biometric
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'behavioral' && (
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">Behavioral Patterns</h3>
                
                {userBiometricData.behavioralPatterns.length > 0 ? (
                  <div className="space-y-4">
                    {userBiometricData.behavioralPatterns.map((pattern: BehavioralPattern) => (
                      <div key={pattern.id} className="p-4 bg-black/20 rounded">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <Activity className="h-5 w-5 text-cyan-400 mr-3" />
                            <span className="text-cyan-400 font-bold">
                              Behavioral Pattern {pattern.is_active && '(Active)'}
                            </span>
                          </div>
                          <span className="text-gray-400 text-sm">
                            {new Date(pattern.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-green-400 font-bold mb-2">Keystroke Dynamics</h4>
                            {pattern.pattern_data?.keystroke_features ? (
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Typing Speed:</span>
                                  <span className="text-cyan-400">
                                    {pattern.pattern_data.keystroke_features.typing_speed?.toFixed(1) || 'N/A'} WPM
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Avg Dwell Time:</span>
                                  <span className="text-cyan-400">
                                    {pattern.pattern_data.keystroke_features.avg_dwell_time?.toFixed(1) || 'N/A'} ms
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Total Keystrokes:</span>
                                  <span className="text-cyan-400">
                                    {pattern.pattern_data.enrollment_metadata?.total_keystrokes || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-red-400 text-sm">Not enrolled</p>
                            )}
                          </div>
                          
                          <div>
                            <h4 className="text-green-400 font-bold mb-2">Mouse Patterns</h4>
                            {pattern.pattern_data?.mouse_features ? (
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Avg Velocity:</span>
                                  <span className="text-cyan-400">
                                    {pattern.pattern_data.mouse_features.avg_velocity?.toFixed(1) || 'N/A'} px/s
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Total Movements:</span>
                                  <span className="text-cyan-400">
                                    {pattern.pattern_data.mouse_features.total_movements || 'N/A'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Total Clicks:</span>
                                  <span className="text-cyan-400">
                                    {pattern.pattern_data.mouse_features.total_clicks || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-red-400 text-sm">Not enrolled</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MousePointer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">No behavioral patterns enrolled</p>
                    <button
                      onClick={() => handleReEnroll('keystroke')}
                      className="terminal-button mt-4 px-4 py-2 rounded"
                    >
                      Enroll Behavioral Patterns
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Sessions */}
              {userBiometricData.behavioralSessions.length > 0 && (
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4">Recent Sessions</h3>
                  <div className="space-y-3">
                    {userBiometricData.behavioralSessions.map((session: BehavioralSession) => (
                      <div key={session.id} className="p-3 bg-black/20 rounded">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-cyan-400 font-bold">Session {session.session_id}</span>
                          <div className="flex items-center">
                            {session.is_successful ? (
                              <CheckCircle className="h-4 w-4 text-green-400 mr-2" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-400 mr-2" />
                            )}
                            <span className="text-gray-400 text-sm">
                              {new Date(session.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <p className="text-gray-400">Overall</p>
                            <p className="text-cyan-400 font-bold">
                              {((session.similarity_scores?.overall_similarity || 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-400">Keystroke</p>
                            <p className="text-green-400 font-bold">
                              {((session.similarity_scores?.keystroke_similarity || 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-400">Mouse</p>
                            <p className="text-blue-400 font-bold">
                              {((session.similarity_scores?.mouse_similarity || 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {userBiometricData.anomalies.length > 0 && (
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-red-400 mb-4">Security Anomalies</h3>
                  <div className="space-y-3">
                    {userBiometricData.anomalies.map((anomaly: AnomalyAudit) => (
                      <div key={anomaly.id} className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-red-400 font-bold">
                              {anomaly.anomaly_type.replace(/_/g, ' ').toUpperCase()}
                            </p>
                            <p className="text-gray-400 text-sm">
                              Severity: {anomaly.severity.toUpperCase()} | Score: {(anomaly.anomaly_score * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400 text-xs">
                              {new Date(anomaly.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-yellow-400 text-sm">Action: {anomaly.action_taken}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ekyc' && userData?.uid && (
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">eKYC Document Verification</h3>
                
                {/* FIXED: Use EKYCDocumentViewer component instead of custom rendering */}
                <EKYCDocumentViewer userId={userData.uid} />
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">Security Overview</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                      <div className="flex items-center">
                        <Shield className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-cyan-400">Multi-Factor Authentication</span>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                      <div className="flex items-center">
                        <Eye className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-cyan-400">Biometric Verification</span>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                      <div className="flex items-center">
                        <Activity className="h-5 w-5 text-green-400 mr-3" />
                        <span className="text-cyan-400">Behavioral Monitoring</span>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-center p-6 bg-gradient-to-br from-green-900/20 to-cyan-900/20 rounded">
                      <TrendingUp className="h-12 w-12 text-green-400 mx-auto mb-4" />
                      <p className="text-2xl font-bold text-green-400 mb-2">
                        {userData.trust_score || 85}/100
                      </p>
                      <p className="text-gray-400">Trust Score</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UserHome;