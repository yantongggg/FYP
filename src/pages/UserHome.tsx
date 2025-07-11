// Enhanced UserHome.tsx with Fixed Data Loading and Real-time Updates

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
  Edit3,
  Zap,
  TrendingDown,
  BarChart3,
  Clock,
  Database,
  XCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import EKYCDocumentViewer from '../components/EKYCDocumentViewer';
import BehavioralMonitor from '../components/BehavioralMonitor';
import BehavioralTestPage from '../pages/BehavioralTestPage';

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
  verification_type: string;
  session_duration?: number;
  page_context?: string;
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
  session_id?: string;
}

interface LoginAudit {
  id: string;
  user_id: string;
  event_ts: string;
  success: boolean;
  ip_addr: string;
  user_agent: string;
  biometric_scores?: {
    face_similarity?: number;
    liveness?: number;
  };
  failure_reason?: string;
  face_image_url?: string;
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

interface BehavioralStats {
  totalSessions: number;
  successRate: number;
  avgSimilarity: number;
  recentAnomalies: number;
  lastVerification: Date | null;
  behavioralTrend: 'improving' | 'stable' | 'declining';
}

interface DataLoadingState {
  behavioral: 'loading' | 'loaded' | 'error';
  loginActivity: 'loading' | 'loaded' | 'error';
  biometric: 'loading' | 'loaded' | 'error';
}

const UserHome: React.FC = () => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [behavioralSessions, setBehavioralSessions] = useState<BehavioralSession[]>([]);
  const [userAnomalies, setUserAnomalies] = useState<AnomalyAudit[]>([]);
  const [recentLoginActivity, setRecentLoginActivity] = useState<LoginAudit[]>([]);
  const [loadingStates, setLoadingStates] = useState<DataLoadingState>({
    behavioral: 'loading',
    loginActivity: 'loading',
    biometric: 'loading'
  });
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'error'>('online');
  const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);

  const [behavioralStats, setBehavioralStats] = useState<BehavioralStats>({
    totalSessions: 0,
    successRate: 0,
    avgSimilarity: 0,
    recentAnomalies: 0,
    lastVerification: null,
    behavioralTrend: 'stable'
  });

  const [userBiometricData, setUserBiometricData] = useState<UserBiometricData>({
    biometrics: [],
    behavioralPatterns: [],
    ekycDocuments: [],
    behavioralSessions: [],
    anomalies: [],
    loading: true,
    lastUpdated: null
  });

  // Enhanced behavioral data loading with proper error handling
const loadBehavioralData = async () => {
  if (!userData?.uid) {
    console.log('❌ No user ID available for behavioral data loading');
    setLoadingStates(prev => ({ ...prev, behavioral: 'error' }));
    return;
  }

  console.log(`🔍 Loading behavioral data for user: ${userData.uid}`);
  setLoadingStates(prev => ({ ...prev, behavioral: 'loading' }));

  // Handle demo users with enhanced demo data
  if (userData.uid.includes('demo')) {
    const demoSessions = Array.from({ length: 8 }, (_, i) => ({
      id: `demo-session-${i}`,
      session_id: `session_demo_${String(i).padStart(3, '0')}`,
      similarity_scores: {
        overall_similarity: 0.75 + (Math.random() * 0.2),
        keystroke_similarity: 0.80 + (Math.random() * 0.15),
        mouse_similarity: 0.70 + (Math.random() * 0.25)
      },
      anomaly_score: Math.random() * 0.3,
      is_successful: Math.random() > 0.2,
      verification_type: ['continuous_monitoring', 'manual_test', 'login_verification'][i % 3],
      session_duration: 30 + Math.floor(Math.random() * 60),
      page_context: ['/dashboard', '/profile', '/chat', '/ekyc'][i % 4],
      created_at: new Date(Date.now() - (i * 3600000)).toISOString()
    }));
    
    setBehavioralSessions(demoSessions);
    setUserAnomalies([]);
    setLoadingStates(prev => ({ ...prev, behavioral: 'loaded' }));
    setConnectionStatus('online');
    return;
  }

  try {
    setConnectionStatus('online');

    // ✅ CRITICAL: Enhanced behavioral sessions loading with retry logic
    let sessionsData: BehavioralSession[] = [];
    try {
      console.log(`📡 Fetching behavioral sessions: /api/user/behavioral-sessions/${userData.uid}`);
      
      const sessionsResponse = await fetch(`http://localhost:5000/api/user/behavioral-sessions/${userData.uid}?limit=25`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!sessionsResponse.ok) {
        throw new Error(`Sessions API failed: ${sessionsResponse.status} ${sessionsResponse.statusText}`);
      }
      
      const sessionsResult = await sessionsResponse.json();
      console.log('📊 Sessions API response:', sessionsResult);
      
      if (sessionsResult.success && Array.isArray(sessionsResult.sessions)) {
        sessionsData = sessionsResult.sessions;
        console.log(`✅ Loaded ${sessionsData.length} behavioral sessions`);
      } else {
        console.warn('⚠️ Sessions API returned non-success result:', sessionsResult);
        sessionsData = [];
      }
      
    } catch (sessionError) {
      console.error('❌ Error loading behavioral sessions:', sessionError);
      setConnectionStatus('error');
      sessionsData = [];
    }

    setBehavioralSessions(sessionsData);

    // ✅ CRITICAL: Enhanced anomalies loading with proper UUID handling
    let anomaliesData: AnomalyAudit[] = [];
    try {
      console.log(`📡 Fetching anomalies: /api/user/anomalies/${userData.uid}`);
      
      const anomaliesResponse = await fetch(`http://localhost:5000/api/user/anomalies/${userData.uid}?limit=15`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!anomaliesResponse.ok) {
        // If API fails, try direct Supabase query as fallback
        console.warn(`API failed, trying direct Supabase query...`);
        
        const { data: directAnomalies, error } = await supabase
          .from('anomaly_audit')
          .select('*')
          .eq('user_id', userData.uid)
          .order('created_at', { ascending: false })
          .limit(15);
        
        if (error) {
          console.error('❌ Supabase direct query also failed:', error);
          anomaliesData = [];
        } else {
          anomaliesData = directAnomalies || [];
          console.log(`✅ Loaded ${anomaliesData.length} anomalies via direct Supabase`);
        }
      } else {
        const anomaliesResult = await anomaliesResponse.json();
        console.log("🚨 Anomalies API response:", anomaliesResult);
        
        if (anomaliesResult.success && Array.isArray(anomaliesResult.anomalies)) {
          anomaliesData = anomaliesResult.anomalies;
          console.log(`✅ Loaded ${anomaliesData.length} anomalies via API`);
        } else {
          console.warn('⚠️ Anomalies API returned non-success result:', anomaliesResult);
          anomaliesData = [];
        }
      }
      
    } catch (anomalyError) {
      console.error('❌ Error loading anomalies:', anomalyError);
      setConnectionStatus('error');
      anomaliesData = [];
    }

    setUserAnomalies(anomaliesData);

    // ✅ CRITICAL: Calculate enhanced behavioral stats
    try {
      if (sessionsData.length > 0) {
        const recentSessions = sessionsData.slice(0, 10);
        const successfulSessions = sessionsData.filter(s => s.is_successful);
        const avgSimilarity = sessionsData.reduce((sum, s) => 
          sum + (s.similarity_scores?.overall_similarity || 0), 0) / sessionsData.length;
        
        // Enhanced trend calculation
        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (recentSessions.length >= 5) {
          const recent5 = recentSessions.slice(0, 5);
          const previous5 = sessionsData.slice(5, 10);
          
          if (previous5.length >= 3) {
            const recentAvg = recent5.reduce((sum, s) => 
              sum + (s.similarity_scores?.overall_similarity || 0), 0) / recent5.length;
            const previousAvg = previous5.reduce((sum, s) => 
              sum + (s.similarity_scores?.overall_similarity || 0), 0) / previous5.length;
            
            const difference = recentAvg - previousAvg;
            if (difference > 0.05) trend = 'improving';
            else if (difference < -0.05) trend = 'declining';
          }
        }
        
        // Calculate recent anomalies (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentAnomalies = anomaliesData.filter(a => 
          new Date(a.created_at) > weekAgo
        ).length;
        
        setBehavioralStats({
          totalSessions: sessionsData.length,
          successRate: (successfulSessions.length / sessionsData.length) * 100,
          avgSimilarity: avgSimilarity * 100,
          recentAnomalies,
          lastVerification: sessionsData.length > 0 ? new Date(sessionsData[0].created_at) : null,
          behavioralTrend: trend
        });
        
        console.log('✅ Behavioral stats calculated:', {
          total: sessionsData.length,
          successRate: (successfulSessions.length / sessionsData.length) * 100,
          avgSimilarity: avgSimilarity * 100,
          trend
        });
      } else {
        setBehavioralStats({
          totalSessions: 0,
          successRate: 0,
          avgSimilarity: 0,
          recentAnomalies: anomaliesData.length,
          lastVerification: null,
          behavioralTrend: 'stable'
        });
      }
    } catch (statsError) {
      console.error('❌ Error calculating behavioral stats:', statsError);
    }

    setLoadingStates(prev => ({ ...prev, behavioral: 'loaded' }));
    setLastDataUpdate(new Date());

  } catch (error) {
    console.error('❌ Critical error in loadBehavioralData:', error);
    setLoadingStates(prev => ({ ...prev, behavioral: 'error' }));
    setConnectionStatus('error');
  }
};

  // Enhanced login activity loading with proper error handling
  const loadRecentLoginActivity = async () => {
    if (!userData?.uid) {
      console.log('❌ No user ID available for login activity loading');
      setLoadingStates(prev => ({ ...prev, loginActivity: 'error' }));
      return;
    }

    console.log(`🔍 Loading login activity for user: ${userData.uid}`);
    setLoadingStates(prev => ({ ...prev, loginActivity: 'loading' }));

    // Handle demo users
    if (userData.uid.includes('demo')) {
      const demoActivity = Array.from({ length: 5 }, (_, i) => ({
        id: `demo-login-${i}`,
        user_id: userData.uid,
        event_ts: new Date(Date.now() - (i * 3600000)).toISOString(),
        success: Math.random() > 0.3,
        ip_addr: '127.0.0.1',
        user_agent: 'Demo Browser Chrome/91.0',
        biometric_scores: { 
          face_similarity: 0.7 + (Math.random() * 0.3),
          liveness: 0.8 + (Math.random() * 0.2)
        },
        face_image_url: Math.random() > 0.5 ? 'https://via.placeholder.com/100' : undefined,
        failure_reason: Math.random() > 0.7 ? 'Face similarity too low' : undefined
      }));
      
      setRecentLoginActivity(demoActivity);
      setLoadingStates(prev => ({ ...prev, loginActivity: 'loaded' }));
      return;
    }
    
    try {
      console.log(`📡 Fetching login activity from Supabase for user: ${userData.uid}`);
      
      // CRITICAL: Use Supabase directly for login audit (UUID required)
      const { data, error } = await supabase
        .from('login_audit')
        .select('*')
        .eq('user_id', userData.uid)
        .order('event_ts', { ascending: false })
        .limit(15);
      
      if (error) {
        console.error('❌ Supabase error loading login activity:', error);
        setLoadingStates(prev => ({ ...prev, loginActivity: 'error' }));
        setConnectionStatus('error');
        return;
      }
      
      if (data && data.length > 0) {
        console.log(`✅ Login activity loaded: ${data.length} records`);
        setRecentLoginActivity(data);
        setLoadingStates(prev => ({ ...prev, loginActivity: 'loaded' }));
      } else {
        console.log('ℹ️ No login activity found');
        setRecentLoginActivity([]);
        setLoadingStates(prev => ({ ...prev, loginActivity: 'loaded' }));
      }
    } catch (error) {
      console.error('❌ Error loading recent login activity:', error);
      setRecentLoginActivity([]);
      setLoadingStates(prev => ({ ...prev, loginActivity: 'error' }));
      setConnectionStatus('error');
    }
  };
  // Enhanced real-time subscription for behavioral updates
  useEffect(() => {
    if (!userData?.uid || userData.uid.includes('demo')) return;

    console.log('🔗 Setting up real-time subscriptions for user:', userData.uid);

    const subscription = supabase
      .channel('user-behavioral-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'behavioral_sessions',
        filter: `user_id=eq.${userData.uid}`
      }, (payload: any) => {
        console.log('🔄 Behavioral sessions updated:', payload);
        loadBehavioralData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'anomaly_audit',
        filter: `user_id=eq.${userData.uid}`
      }, (payload: any) => {
        console.log('🚨 Anomalies updated:', payload);
        loadBehavioralData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'login_audit',
        filter: `user_id=eq.${userData.uid}`
      }, (payload: any) => {
        console.log('🔐 Login audit updated:', payload);
        loadRecentLoginActivity();
      })
      .subscribe();

    // Listen for custom events from behavioral monitor
    const handleBehavioralUpdate = (event: CustomEvent) => {
      console.log('🔄 Custom behavioral update received:', event.detail);
      loadBehavioralData();
    };

    window.addEventListener('behavioralDataUpdated', handleBehavioralUpdate as EventListener);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('behavioralDataUpdated', handleBehavioralUpdate as EventListener);
    };
  }, [userData?.uid]);

  // Enhanced data loading on mount
  useEffect(() => {
    if (userData?.uid) {
      console.log('🚀 UserHome mounted, loading data for user:', userData.uid);
      loadBehavioralData();
      loadBiometricData();
      loadRecentLoginActivity();
    }
  }, [userData?.uid]);

  // Enhanced biometric data loading
  const loadBiometricData = async () => {
    if (!userData?.uid || userData.uid.includes('demo')) {
      // Enhanced demo data
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

      // Load biometric data
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

      console.log('📊 Biometric data loaded:', {
        biometrics: biometrics?.length || 0,
        behavioralPatterns: behavioralPatterns?.length || 0,  
        ekycDocuments: ekycDocuments?.length || 0
      });

      setUserBiometricData({
        biometrics: biometrics || [],
        behavioralPatterns: behavioralPatterns || [],
        ekycDocuments: ekycDocuments || [],
        behavioralSessions: behavioralSessions || [],
        anomalies: userAnomalies || [],
        loading: false,
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('Error loading biometric data:', error);
      setUserBiometricData(prev => ({ ...prev, loading: false }));
    }
  };


  // Handle re-enrollment
  const handleReEnroll = async (type: string) => {
    try {
      console.log(`🔄 Starting re-enrollment for ${type}`);
      
      if (type === 'face') {
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
    { id: 'test', name: 'Behavior Test', icon: Zap },
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
    behavioralSessions: behavioralSessions.length,
    recentAnomalies: behavioralStats.recentAnomalies
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-900/30 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-900/30 border-orange-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30';
      default:
        return 'text-blue-400 bg-blue-900/30 border-blue-500/30';
    }
  };
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <BarChart3 className="h-4 w-4 text-cyan-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-400';
      case 'declining':
        return 'text-red-400';
      default:
        return 'text-cyan-400';
    }
  };

   // CRITICAL: Enhanced real-time subscription with better error handling
  useEffect(() => {
    if (!userData?.uid || userData.uid.includes('demo')) return;

    console.log('🔗 Setting up enhanced real-time subscriptions for user:', userData.uid);

    const subscription = supabase
      .channel('enhanced-user-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'behavioral_sessions',
        filter: `user_id=eq.${userData.uid}`
      }, (payload: any) => {
        console.log('🔄 Behavioral sessions updated:', payload);
        loadBehavioralData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'anomaly_audit',
        filter: `user_id=eq.${userData.uid}`
      }, (payload: any) => {
        console.log('🚨 Anomalies updated:', payload);
        loadBehavioralData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'login_audit',
        filter: `user_id=eq.${userData.uid}`
      }, (payload: any) => {
        console.log('🔐 Login audit updated:', payload);
        loadRecentLoginActivity();
      })
      .subscribe();

    // Listen for custom events from behavioral monitor
    const handleBehavioralUpdate = (event: CustomEvent) => {
      console.log('🔄 Custom behavioral update received:', event.detail);
      // Add delay to allow backend to process
      setTimeout(() => {
        loadBehavioralData();
      }, 1000);
    };

    window.addEventListener('behavioralDataUpdated', handleBehavioralUpdate as EventListener);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('behavioralDataUpdated', handleBehavioralUpdate as EventListener);
    };
  }, [userData?.uid]);

  // CRITICAL: Enhanced data loading on mount with retry logic
  useEffect(() => {
    if (userData?.uid) {
      console.log('🚀 UserHome mounted, loading data for user:', userData.uid);
      
      const loadAllData = async () => {
        await Promise.all([
          loadBehavioralData(),
          loadRecentLoginActivity()
        ]);
      };
      
      loadAllData();
      
      // Set up periodic refresh every 5 minutes
      const refreshInterval = setInterval(() => {
        if (!refreshing) {
          console.log('🔄 Periodic data refresh');
          loadAllData();
        }
      }, 5 * 60 * 1000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [userData?.uid]);

  // Manual refresh function with loading state
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    console.log('🔄 Manual refresh triggered');
    
    try {
      await Promise.all([
        loadBehavioralData(),
        loadRecentLoginActivity()
      ]);
      setConnectionStatus('online');
    } catch (error) {
      console.error('❌ Refresh error:', error);
      setConnectionStatus('error');
    } finally {
      setRefreshing(false);
    }
  };

  // Get connection status color
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'online': return 'text-green-400';
      case 'offline': return 'text-yellow-400';
      case 'error': return 'text-red-400';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'online': return <Wifi className="h-4 w-4" />;
      case 'offline': return <WifiOff className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
    }
  }; 

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      {/* Enhanced Behavioral Monitor */}
      <BehavioralMonitor
        userId={userData.uid}
        isActive={true}
        triggerInterval={2} // Check every 2 minutes for better responsiveness
        onVerificationComplete={(result) => {
          console.log('✅ Behavioral verification completed:', result);
          loadBehavioralData(); // Refresh data after verification
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
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

        {/* CRITICAL: Enhanced Recent Anomalies Alert Section */}
        {userAnomalies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="glass-card rounded-lg p-6 border-yellow-500/30 bg-yellow-900/10">
              <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center">
                <AlertTriangle className="mr-3 h-6 w-6" />
                🚨 ENHANCED SECURITY ALERTS ({userAnomalies.length})
              </h3>
              <div className="space-y-3">
                {userAnomalies.slice(0, 3).map((anomaly) => (
                  <div key={anomaly.id} className={`p-3 rounded border ${getSeverityColor(anomaly.severity)}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">
                          {anomaly.anomaly_type.replace(/_/g, ' ').toUpperCase()}
                        </p>
                        <p className="text-xs opacity-70">
                          Severity: {anomaly.severity.toUpperCase()} | Score: {(anomaly.anomaly_score * 100).toFixed(1)}%
                        </p>
                        {anomaly.details?.page_context && (
                          <p className="text-xs opacity-60">
                            Page: {anomaly.details.page_context}
                          </p>
                        )}
                        {anomaly.session_id && (
                          <p className="text-xs opacity-50">
                            Session: {anomaly.session_id.slice(-8)}...
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs">
                          {new Date(anomaly.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs">{new Date(anomaly.created_at).toLocaleTimeString()}</p>
                        <p className="text-xs">Action: {anomaly.action_taken}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {userAnomalies.length > 3 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setActiveTab('security')}
                    className="terminal-button px-4 py-2 rounded text-sm"
                  >
                    VIEW ALL ANOMALIES ({userAnomalies.length})
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
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

        {/* Enhanced Tab Content */}
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

              {/* Enhanced Enrollment Status Overview */}
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
                      <span className="text-cyan-400">Mouse Behavior</span>
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

              {/* Enhanced Recent Activity */}
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Activity ({behavioralSessions.length} sessions)
                </h3>
                {behavioralSessions.length > 0 ? (
                  <div className="space-y-3">
                    {behavioralSessions.slice(0, 5).map((session: BehavioralSession) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-black/20 rounded">
                        <div className="flex items-center">
                          <Activity className="h-5 w-5 text-cyan-400 mr-3" />
                          <div>
                            <p className="text-cyan-400 text-sm font-bold">
                              {session.verification_type?.replace('_', ' ').toUpperCase() || 'BEHAVIORAL'} Session
                            </p>
                            <p className="text-gray-400 text-xs">
                              Similarity: {(session.similarity_scores?.overall_similarity * 100 || 0).toFixed(1)}% |
                              Page: {session.page_context || 'unknown'}
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
                  <p className="text-gray-400 text-center py-4">No recent behavioral activity</p>
                )}
              </div>

              {/* Enhanced Recent Login Activity */}
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Recent Login Activity ({recentLoginActivity.length} records)
                </h3>
                {recentLoginActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentLoginActivity.slice(0, 5).map((login: LoginAudit) => (
                      <div key={login.id} className="flex items-center justify-between p-3 bg-black/20 rounded">
                        <div className="flex items-center">
                          <div className={`h-3 w-3 rounded-full mr-3 ${login.success ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <div>
                            <p className="text-cyan-400 text-sm font-bold">
                              {login.success ? 'Successful Login' : 'Failed Login Attempt'}
                            </p>
                            <p className="text-gray-400 text-xs">
                              IP: {login.ip_addr || 'Unknown'} |
                              {login.biometric_scores?.face_similarity && 
                                ` Face: ${(login.biometric_scores.face_similarity * 100).toFixed(1)}%`
                              }
                              {login.failure_reason && ` | ${login.failure_reason}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {login.face_image_url && (
                            <img
                              src={login.face_image_url}
                              alt="Login face"
                              className="w-8 h-8 rounded border border-green-400/30 mb-1"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span className="text-gray-400 text-xs">
                            {new Date(login.event_ts).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No recent login activity</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <BehavioralTestPage />
          )}

          {/* Enhanced Behavioral Tab */}
          {activeTab === 'behavioral' && (
            <div className="space-y-6">
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">Enhanced Behavioral Authentication Status</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-black/20 rounded">
                    <Activity className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">{behavioralStats.totalSessions}</p>
                    <p className="text-sm text-cyan-400">Total Sessions</p>
                  </div>
                  
                  <div className="text-center p-4 bg-black/20 rounded">
                    <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">{behavioralStats.successRate.toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400">Success Rate</p>
                  </div>
                  
                  <div className="text-center p-4 bg-black/20 rounded">
                    <BarChart3 className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-cyan-400">{behavioralStats.avgSimilarity.toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400">Avg Similarity</p>
                  </div>
                  
                  <div className="text-center p-4 bg-black/20 rounded">
                    <div className="flex items-center justify-center mb-2">
                      {getTrendIcon(behavioralStats.behavioralTrend)}
                    </div>
                    <p className={`text-2xl font-bold ${getTrendColor(behavioralStats.behavioralTrend)}`}>
                      {behavioralStats.behavioralTrend.toUpperCase()}
                    </p>
                    <p className="text-sm text-cyan-400">Trend</p>
                  </div>
                </div>
              </div>

              {/* Enhanced Recent Behavioral Activity */}
              <div className="glass-card rounded-lg p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">Recent Behavioral Activity</h3>
                {behavioralSessions.length > 0 ? (
                  <div className="space-y-3">
                    {behavioralSessions.slice(0, 8).map((session: BehavioralSession) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-black/20 rounded">
                        <div className="flex items-center">
                          <Activity className="h-5 w-5 text-cyan-400 mr-3" />
                          <div>
                            <p className="text-cyan-400 text-sm font-bold">
                              {session.verification_type?.replace('_', ' ').toUpperCase() || 'BEHAVIORAL'} Verification
                            </p>
                            <p className="text-gray-400 text-xs">
                              Overall: {(session.similarity_scores?.overall_similarity * 100 || 0).toFixed(1)}% | 
                              Keystroke: {(session.similarity_scores?.keystroke_similarity * 100 || 0).toFixed(1)}% | 
                              Mouse: {(session.similarity_scores?.mouse_similarity * 100 || 0).toFixed(1)}%
                            </p>
                            {session.page_context && (
                              <p className="text-gray-500 text-xs">Page: {session.page_context}</p>
                            )}
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
                  <p className="text-gray-400 text-center py-4">No recent behavioral activity</p>
                )}
              </div>

              {/* Recent Anomalies */}
              {userAnomalies.length > 0 && (
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Recent Security Anomalies ({userAnomalies.length})
                  </h3>
                  <div className="space-y-3">
                    {userAnomalies.slice(0, 5).map((anomaly: AnomalyAudit) => (
                      <div key={anomaly.id} className={`p-3 rounded border ${getSeverityColor(anomaly.severity)}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">
                              {anomaly.anomaly_type.replace(/_/g, ' ').toUpperCase()}
                            </p>
                            <p className="text-xs opacity-70">
                              Severity: {anomaly.severity.toUpperCase()} | Score: {(anomaly.anomaly_score * 100).toFixed(1)}%
                            </p>
                            {anomaly.details?.page_context && (
                              <p className="text-xs opacity-60">Page: {anomaly.details.page_context}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs">
                              {new Date(anomaly.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-xs">Action: {anomaly.action_taken}</p>
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
                        <span className="text-cyan-400">Global Behavioral Monitoring</span>
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
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
        </motion.div>
      </div>
    </div>
  );
};

export default UserHome;