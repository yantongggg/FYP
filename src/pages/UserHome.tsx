  // UserHome.tsx with Fixed Data Loading and Real-time Updates
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
    WifiOff,
    Bell,
    Save,  
    Info
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

  interface RealTimeStats {
    isMonitoring: boolean;
    currentSessionData: {
      keystrokes: number;
      mouseEvents: number;
      duration: number;
    };
    lastVerificationResult?: {
      similarity: number;
      timestamp: Date;
      anomaly: boolean;
    };
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
    const [profileEditData, setProfileEditData] = useState({
      username: '',
      email: '',
      newPassword: '',
      confirmPassword: ''
    });
    const [profileUpdateError, setProfileUpdateError] = useState('');
    const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
    const [updatingProfile, setUpdatingProfile] = useState(false);

    // Initialize profile data when user data loads
    useEffect(() => {
      if (userData) {
        setProfileEditData({
          username: userData.username || '',
          email: userData.email || '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    }, [userData]);
    const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'error'>('online');
    const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);
    const [realTimeStats, setRealTimeStats] = useState<RealTimeStats>({
      isMonitoring: false,
      currentSessionData: { keystrokes: 0, mouseEvents: 0, duration: 0 }
    });

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

    // behavioral data loading with better error handling
    const loadBehavioralData = async () => {
      if (!userData?.uid) {
        console.log('❌ FIXED UserHome: No user ID available');
        setLoadingStates(prev => ({ ...prev, behavioral: 'error' }));
        return;
      }

      console.log(`🔍 FIXED UserHome: Loading behavioral data for user: ${userData.uid}`);
      setLoadingStates(prev => ({ ...prev, behavioral: 'loading' }));

      // demo user handling
      if (userData.uid.includes('demo')) {
        const demoSessions = Array.from({ length: 12 }, (_, i) => ({
          id: `demo-session-${i}`,
          session_id: `session_demo_${String(i).padStart(3, '0')}`,
          similarity_scores: {
            overall_similarity: 0.70 + (Math.random() * 0.25),
            keystroke_similarity: 0.75 + (Math.random() * 0.20),
            mouse_similarity: 0.65 + (Math.random() * 0.30)
          },
          anomaly_score: Math.random() * 0.35,
          is_successful: Math.random() > 0.15,
          verification_type: ['continuous_monitoring', 'manual_test', 'login_verification', 'global_continuous'][i % 4],
          session_duration: 30 + Math.floor(Math.random() * 90),
          page_context: ['/dashboard', '/profile', '/chat', '/ekyc', '/behavioral-test'][i % 5],
          created_at: new Date(Date.now() - (i * 2 * 3600000)).toISOString()
        }));
        
        const demoAnomalies = Array.from({ length: 3 }, (_, i) => ({
          id: `demo-anomaly-${i}`,
          anomaly_type: ['global_behavioral_monitoring', 'continuous_monitoring', 'behavioral_mismatch'][i],
          anomaly_score: 0.3 + (Math.random() * 0.4),
          severity: ['medium', 'low', 'high'][i],
          action_taken: ['logged', 'warning', 'monitor'][i],
          created_at: new Date(Date.now() - (i * 24 * 3600000)).toISOString(),
          details: {
            page_context: ['/dashboard', '/profile', '/chat'][i],
            similarity_score: 0.4 + (Math.random() * 0.3)
          }
        }));
        
        setBehavioralSessions(demoSessions);
        setUserAnomalies(demoAnomalies);
        setLoadingStates(prev => ({ ...prev, behavioral: 'loaded' }));
        setConnectionStatus('online');
        return;
      }

      try {
        setConnectionStatus('online');

        // behavioral sessions loading with multiple fallbacks
        let sessionsData: BehavioralSession[] = [];
        try {
          console.log(`📡 FIXED UserHome: Fetching behavioral sessions from  API`);
          
          const sessionsResponse = await fetch(`http://localhost:5000/api/user/behavioral-sessions/${userData.uid}?limit=30`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (!sessionsResponse.ok) {
            throw new Error(`FIXED UserHome: Sessions API failed: ${sessionsResponse.status}`);
          }
          
          const sessionsResult = await sessionsResponse.json();
          console.log('📊 FIXED UserHome: Sessions API response:', sessionsResult);
          
          if (sessionsResult.success && Array.isArray(sessionsResult.sessions)) {
            sessionsData = sessionsResult.sessions;
            console.log(`✅ FIXED UserHome: Loaded ${sessionsData.length} behavioral sessions via API`);
          } else {
            console.warn('⚠️ FIXED UserHome: Sessions API returned non-success, trying direct Supabase');
            
            // Fallback to direct Supabase query
            const { data: directSessions, error } = await supabase
              .from('behavioral_sessions')
              .select('*')
              .eq('user_id', userData.uid)
              .order('created_at', { ascending: false })
              .limit(30);
            
            if (error) {
              console.error('❌ FIXED UserHome: Supabase direct query failed:', error);
              sessionsData = [];
            } else {
              sessionsData = directSessions || [];
              console.log(`✅ FIXED UserHome: Loaded ${sessionsData.length} sessions via direct Supabase`);
            }
          }
          
        } catch (sessionError) {
          console.error('❌ FIXED UserHome: Error loading behavioral sessions:', sessionError);
          setConnectionStatus('error');
          sessionsData = [];
        }

        setBehavioralSessions(sessionsData);

        // anomalies loading with better UUID handling
        let anomaliesData: AnomalyAudit[] = [];
        try {
          console.log(`📡 FIXED UserHome: Fetching anomalies from  API`);
          
          const anomaliesResponse = await fetch(`http://localhost:5000/api/user/anomalies/${userData.uid}?limit=20`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (!anomaliesResponse.ok) {
            console.warn(`⚠️ FIXED UserHome: Anomalies API failed, trying direct Supabase`);
            
            // Fallback to direct Supabase query
            const { data: directAnomalies, error } = await supabase
              .from('anomaly_audit')
              .select('*')
              .eq('user_id', userData.uid)
              .order('created_at', { ascending: false })
              .limit(20);
            
            if (error) {
              console.error('❌ FIXED UserHome: Supabase anomalies query failed:', error);
              anomaliesData = [];
            } else {
              anomaliesData = directAnomalies || [];
              console.log(`✅ FIXED UserHome: Loaded ${anomaliesData.length} anomalies via direct Supabase`);
            }
          } else {
            const anomaliesResult = await anomaliesResponse.json();
            console.log("🚨 FIXED UserHome: Anomalies API response:", anomaliesResult);
            
            if (anomaliesResult.success && Array.isArray(anomaliesResult.anomalies)) {
              anomaliesData = anomaliesResult.anomalies;
              console.log(`✅ FIXED UserHome: Loaded ${anomaliesData.length} anomalies via API`);
            } else {
              console.warn('⚠️ FIXED UserHome: Anomalies API returned non-success result');
              anomaliesData = [];
            }
          }
          
        } catch (anomalyError) {
          console.error('❌ FIXED UserHome: Error loading anomalies:', anomalyError);
          setConnectionStatus('error');
          anomaliesData = [];
        }

        setUserAnomalies(anomaliesData);

        // behavioral stats calculation
        try {
          if (sessionsData.length > 0) {
            const recentSessions = sessionsData.slice(0, 15);
            const successfulSessions = sessionsData.filter(s => s.is_successful);
            const avgSimilarity = sessionsData.reduce((sum, s) => 
              sum + (s.similarity_scores?.overall_similarity || 0), 0) / sessionsData.length;
            
            //trend calculation with more sophisticated logic
            let trend: 'improving' | 'stable' | 'declining' = 'stable';
            if (recentSessions.length >= 6) {
              const recent6 = recentSessions.slice(0, 6);
              const previous6 = sessionsData.slice(6, 12);
              
              if (previous6.length >= 4) {
                const recentAvg = recent6.reduce((sum, s) => 
                  sum + (s.similarity_scores?.overall_similarity || 0), 0) / recent6.length;
                const previousAvg = previous6.reduce((sum, s) => 
                  sum + (s.similarity_scores?.overall_similarity || 0), 0) / previous6.length;
                
                const difference = recentAvg - previousAvg;
                if (difference > 0.08) trend = 'improving';
                else if (difference < -0.08) trend = 'declining';
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
            
            console.log('FIXED UserHome:  behavioral stats calculated:', {
              total: sessionsData.length,
              successRate: (successfulSessions.length / sessionsData.length) * 100,
              avgSimilarity: avgSimilarity * 100,
              trend,
              recentAnomalies
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
          console.error('❌ FIXED UserHome: Error calculating behavioral stats:', statsError);
        }

        setLoadingStates(prev => ({ ...prev, behavioral: 'loaded' }));
        setLastDataUpdate(new Date());

      } catch (error) {
        console.error('FIXED UserHome: Critical error in loadBehavioralData:', error);
        setLoadingStates(prev => ({ ...prev, behavioral: 'error' }));
        setConnectionStatus('error');
      }
    };

    //  login activity loading
    const loadRecentLoginActivity = async () => {
      if (!userData?.uid) {
        console.log('FIXED UserHome: No user ID for login activity');
        setLoadingStates(prev => ({ ...prev, loginActivity: 'error' }));
        return;
      }

      console.log(`🔍 FIXED UserHome: Loading login activity for user: ${userData.uid}`);
      setLoadingStates(prev => ({ ...prev, loginActivity: 'loading' }));

      //  demo user handling
      if (userData.uid.includes('demo')) {
        const demoActivity = Array.from({ length: 8 }, (_, i) => ({
          id: `demo-login-${i}`,
          user_id: userData.uid,
          event_ts: new Date(Date.now() - (i * 4 * 3600000)).toISOString(),
          success: Math.random() > 0.25,
          ip_addr: `192.168.1.${100 + i}`,
          user_agent: 'Mozilla/5.0 ( Demo Browser)',
          biometric_scores: { 
            face_similarity: 0.75 + (Math.random() * 0.20),
            liveness: 0.85 + (Math.random() * 0.15)
          },
          face_image_url: Math.random() > 0.4 ? 'https://via.placeholder.com/100' : undefined,
          failure_reason: Math.random() > 0.8 ? 'Face similarity below threshold' : undefined
        }));
        
        setRecentLoginActivity(demoActivity);
        setLoadingStates(prev => ({ ...prev, loginActivity: 'loaded' }));
        return;
      }
      
      try {
        console.log(`📡 FIXED UserHome: Fetching login activity from Supabase for user: ${userData.uid}`);
        
        // Use Supabase directly for login audit (UUID required)
        const { data, error } = await supabase
          .from('login_audit')
          .select('*')
          .eq('user_id', userData.uid)
          .order('event_ts', { ascending: false })
          .limit(20);
        
        if (error) {
          console.error('❌ FIXED UserHome: Supabase error loading login activity:', error);
          setLoadingStates(prev => ({ ...prev, loginActivity: 'error' }));
          setConnectionStatus('error');
          return;
        }
        
        if (data && data.length > 0) {
          console.log(`✅ FIXED UserHome: Login activity loaded: ${data.length} records`);
          setRecentLoginActivity(data);
          setLoadingStates(prev => ({ ...prev, loginActivity: 'loaded' }));
        } else {
          console.log('ℹ️ FIXED UserHome: No login activity found');
          setRecentLoginActivity([]);
          setLoadingStates(prev => ({ ...prev, loginActivity: 'loaded' }));
        }
      } catch (error) {
        console.error('FXED UserHome: Error loading recent login activity:', error);
        setRecentLoginActivity([]);
        setLoadingStates(prev => ({ ...prev, loginActivity: 'error' }));
        setConnectionStatus('error');
      }
    };

    // Creal-time subscription for behavioral updates
    useEffect(() => {
      if (!userData?.uid || userData.uid.includes('demo')) return;

      console.log('FIXED UserHome: Setting up  real-time subscriptions for user:', userData.uid);

      const subscription = supabase
        .channel('user-behavioral-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'behavioral_sessions',
          filter: `user_id=eq.${userData.uid}`
        }, (payload: any) => {
          console.log('🔄 FIXED UserHome: Behavioral sessions updated:', payload);
          loadBehavioralData();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'anomaly_audit',
          filter: `user_id=eq.${userData.uid}`
        }, (payload: any) => {
          console.log('🚨 FIXED UserHome: Anomalies updated:', payload);
          loadBehavioralData();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'login_audit',
          filter: `user_id=eq.${userData.uid}`
        }, (payload: any) => {
          console.log(' FIXED UserHome: Login audit updated:', payload);
          loadRecentLoginActivity();
        })
        .subscribe();

      // CRITICAL FIX:  custom event listeners for behavioral monitor updates
      const handleBehavioralUpdate = (event: CustomEvent) => {
        console.log('FIXED UserHome: Custom behavioral update received:', event.detail);
        
        // Update real-time stats if available
        if (event.detail.stats) {
          setRealTimeStats(prev => ({
            ...prev,
            lastVerificationResult: {
              similarity: event.detail.result?.similarity_score || 0,
              timestamp: new Date(),
              anomaly: event.detail.result?.is_anomaly || false
            }
          }));
        }
        
        // Reload data with a small delay to allow backend processing
        setTimeout(() => {
          loadBehavioralData();
        }, 2000);
      };

      const handleGlobalMonitoringUpdate = (event: CustomEvent) => {
        console.log('🌐 FIXED UserHome: Global monitoring update received:', event.detail);
        
        // Update monitoring status
        setRealTimeStats(prev => ({
          ...prev,
          isMonitoring: true,
          lastVerificationResult: event.detail.result ? {
            similarity: event.detail.result.similarity_score || 0,
            timestamp: new Date(),
            anomaly: event.detail.result.is_anomaly || false
          } : prev.lastVerificationResult
        }));
      };

      window.addEventListener('behavioralDataUpdated', handleBehavioralUpdate as EventListener);
      window.addEventListener('globalMonitoringUpdate', handleGlobalMonitoringUpdate as EventListener);

      return () => {
        subscription.unsubscribe();
        window.removeEventListener('behavioralDataUpdated', handleBehavioralUpdate as EventListener);
        window.removeEventListener('globalMonitoringUpdate', handleGlobalMonitoringUpdate as EventListener);
      };
    }, [userData?.uid]);

    //  data loading on mount
    useEffect(() => {
      if (userData?.uid) {
        console.log(' FIXED UserHome:  mounting, loading data for user:', userData.uid);
        loadBehavioralData();
        loadBiometricData();
        loadRecentLoginActivity();
      }
    }, [userData?.uid]);

    //  biometric data loading
    const loadBiometricData = async () => {
      if (!userData?.uid || userData.uid.includes('demo')) {
        //  demo data
        setUserBiometricData({
          biometrics: [{
            id: 'demo-bio-1',
            biometric_type: 'face',
            quality_score: 0.96,
            capture_timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            face_image_url: 'https://via.placeholder.com/150'
          }],
          behavioralPatterns: [{
            id: 'demo-behavioral-1',
            user_id: userData?.uid ?? '',
            pattern_data: {
              keystroke_features: { avg_dwell_time: 125, typing_speed: 47, rhythm_consistency: 0.85 },
              mouse_features: { avg_velocity: 155, movement_smoothness: 0.78 },
              enrollment_metadata: { total_keystrokes: 180, total_mouse_events: 95, quality_score: 0.92 }
            },
            is_active: true,
            created_at: new Date().toISOString()
          }],
          ekycDocuments: [{
            id: 'demo-ekyc-1',
            document_type: 'ic_front',
            verification_status: 'verified',
            face_match_score: 0.94,
            document_authenticity_score: 0.91,
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
        
        console.log('FIXED UserHome: Loading  biometric data for user:', userData.uid);

        // Load biometric data
        const { data: biometrics, error: bioError } = await supabase
          .from('biometric_data')
          .select('*')
          .eq('user_id', userData.uid)
          .order('created_at', { ascending: false });

        if (bioError) {
          console.error('FIXED UserHome: Error loading biometric data:', bioError);
        }

        // Load behavioral patterns
        const { data: behavioralPatterns, error: behavError } = await supabase
          .from('behavioral_patterns')
          .select('*')
          .eq('user_id', userData.uid)
          .order('created_at', { ascending: false });

        if (behavError) {
          console.error('❌ FIXED UserHome: Error loading behavioral patterns:', behavError);
        }

        // Load eKYC documents  
        const { data: ekycDocuments, error: ekycError } = await supabase
          .from('ekyc_documents')
          .select('*')
          .eq('user_id', userData.uid)
          .order('created_at', { ascending: false });

        if (ekycError) {
          console.error('FIXED UserHome: Error loading eKYC documents:', ekycError);
        }

        console.log('FXED UserHome:  biometric data loaded:', {
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
        console.error('FIXED UserHome: Error loading biometric data:', error);
        setUserBiometricData(prev => ({ ...prev, loading: false }));
      }
    };

    //  re-enrollment handler
    const handleReEnroll = async (type: string) => {
      try {
        console.log(`🔄 FIXED UserHome: Starting re-enrollment for ${type}`);
        
        if (type === 'face') {
          alert('Face re-enrollment will open biometric capture. This will redirect to the registration page with pre-filled information.');
        } else if (type === 'keystroke') {
          alert('Keystroke re-enrollment will start behavioral capture. You will be guided through typing exercises to update your keystroke pattern.');
        } else if (type === 'scroll') {
          alert('Mouse behavior re-enrollment will capture your natural mouse movements and click patterns.');
        }
        
      } catch (error) {
        console.error('FIXED UserHome: Re-enrollment error:', error);
      }
    };

    //  manual refresh with comprehensive data reload
    const handleRefresh = async () => {
      if (refreshing) return;
      
      setRefreshing(true);
      console.log('🔄 FIXED UserHome:  manual refresh triggered');
      
      try {
        await Promise.all([
          loadBehavioralData(),
          loadRecentLoginActivity(),
          loadBiometricData()
        ]);
        setConnectionStatus('online');
        setLastDataUpdate(new Date());
      } catch (error) {
        console.error('FIXED UserHome:  refresh error:', error);
        setConnectionStatus('error');
      } finally {
        setRefreshing(false);
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

    // Calculate  statistics
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

    const handleProfileUpdate = async () => {
      if (updatingProfile) return;
      
      setProfileUpdateError('');
      setProfileUpdateSuccess(false);
      
      // Validation
      if (!profileEditData.username.trim()) {
        setProfileUpdateError('Username is required');
        return;
      }
      
      if (!profileEditData.email.trim()) {
        setProfileUpdateError('Email is required');
        return;
      }
      
      if (profileEditData.newPassword && profileEditData.newPassword !== profileEditData.confirmPassword) {
        setProfileUpdateError('Passwords do not match');
        return;
      }
      
      if (profileEditData.newPassword && profileEditData.newPassword.length < 6) {
        setProfileUpdateError('Password must be at least 6 characters');
        return;
      }
      
      setUpdatingProfile(true);
      
      try {
        console.log('🔄 FIXED UserHome: Updating profile for user:', userData.uid);
        
        const payload: {
          user_id: string;
          username: string;
          email: string;
          new_password?: string;  // Optional password field
        } = {
          user_id: userData.uid,
          username: profileEditData.username.trim(),
          email: profileEditData.email.trim()
        };
        
        // Only include password if provided
        if (profileEditData.newPassword) {
          payload.new_password = profileEditData.newPassword;
        }
        
        const response = await fetch('http://localhost:5000/api/update-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.success) {
          setProfileUpdateSuccess(true);
          setProfileEditData(prev => ({
            ...prev,
            newPassword: '',
            confirmPassword: ''
          }));
          
          // Update local user data context
          if (userData) {
            const updatedUserData = {
              ...userData,
              username: profileEditData.username,
              email: profileEditData.email
            };
            // You might need to update this based on your auth context implementation
          }
          
          setTimeout(() => setProfileUpdateSuccess(false), 5000);
          
        } else {
          setProfileUpdateError(result.error || 'Update failed');
        }
        
      } catch (error) {
        console.error('FIXED UserHome: Profile update error:', error);
        setProfileUpdateError('Network error. Please try again.');
      } finally {
        setUpdatingProfile(false);
      }
    };

    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        {/* Behavioral Monitor */}
        <BehavioralMonitor
          userId={userData.uid}
          isActive={true}
          triggerInterval={2}
          onVerificationComplete={(result) => {
            console.log('FIXED UserHome:  behavioral verification completed:', result);
            
            // Update real-time stats
            setRealTimeStats(prev => ({
              ...prev,
              lastVerificationResult: {
                similarity: result.similarity_score,
                timestamp: new Date(),
                anomaly: result.is_anomaly
              }
            }));
            
            // Refresh data after verification
            setTimeout(() => {
              loadBehavioralData();
            }, 1500);
          }}
        />
        <div className="max-w-7xl mx-auto">
          {/*  Header with Real-time Status */}
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
                {/*  connection status indicator */}
                <div className={`flex items-center space-x-2 ${getConnectionStatusColor()}`}>
                  {getConnectionStatusIcon()}
                  <span className="text-sm font-mono">
                    {connectionStatus.toUpperCase()}
                  </span>
                </div>
                
                {/* Real-time monitoring status */}
                {realTimeStats.isMonitoring && (
                  <div className="flex items-center space-x-2 text-green-400">
                    <Eye className="h-4 w-4 animate-pulse" />
                    <span className="text-sm font-mono">MONITORING</span>
                  </div>
                )}
                
                {lastDataUpdate && (
                  <div className="text-sm text-gray-400">
                    Last updated: {lastDataUpdate.toLocaleTimeString()}
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

          {/* Real-time Behavioral Status */}
          {realTimeStats.lastVerificationResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className={`glass-card rounded-lg p-4 border-2 ${
                realTimeStats.lastVerificationResult.anomaly 
                  ? 'border-yellow-500/30 bg-yellow-900/10' 
                  : 'border-green-500/30 bg-green-900/10'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Activity className={`h-5 w-5 mr-3 ${
                      realTimeStats.lastVerificationResult.anomaly ? 'text-yellow-400' : 'text-green-400'
                    }`} />
                    <div>
                      <h3 className={`font-bold ${
                        realTimeStats.lastVerificationResult.anomaly ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        🔄 LATEST BEHAVIORAL VERIFICATION
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Last check: {realTimeStats.lastVerificationResult.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <span className="text-gray-400 text-sm">Similarity:</span>
                      <div className={`text-lg font-bold ${
                        realTimeStats.lastVerificationResult.similarity >= 0.7 ? 'text-green-400' : 
                        realTimeStats.lastVerificationResult.similarity >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(realTimeStats.lastVerificationResult.similarity * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="text-gray-400 text-sm">Status:</span>
                      <div className={`text-sm font-bold ${
                        realTimeStats.lastVerificationResult.anomaly ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {realTimeStats.lastVerificationResult.anomaly ? 'ANOMALY' : 'NORMAL'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Recent Anomalies Alert Section */}
          {userAnomalies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="glass-card rounded-lg p-6 border-yellow-500/30 bg-yellow-900/10">
                <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center">
                  <AlertTriangle className="mr-3 h-6 w-6" />
                  SECURITY ALERTS ({userAnomalies.length})
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
                  <h3 className="text-lg font-bold text-green-400 mb-4"> User Information</h3>
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
                      <p className="text-sm text-gray-400"> Trust Score</p>
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className="bg-green-400 h-2 rounded-full" 
                            style={{ width: `${userData.trust_score || 85}%` }}
                          ></div>
                        </div>
                        <span className="text-yellow-400 font-bold">{userData.trust_score || 85}/100</span>
                      </div>
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

                {/* Recent Activity */}
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

                {/* Recent Login Activity */}
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

            {/* Behavioral Tab */}
            {activeTab === 'behavioral' && (
              <div className="space-y-6">
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4">Behavioral Authentication Status</h3>
                  
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
                      <p className="text-sm text-cyan-400"> Trend</p>
                    </div>
                  </div>
                </div>

                {/* Recent Behavioral Activity */}
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4"> Recent Behavioral Activity</h3>
                  {behavioralSessions.length > 0 ? (
                    <div className="space-y-3">
                      {behavioralSessions.slice(0, 10).map((session: BehavioralSession) => (
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
                              {session.session_duration && (
                                <p className="text-gray-500 text-xs">Duration: {session.session_duration}s</p>
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
                    <p className="text-gray-400 text-center py-4">No recent  behavioral activity</p>
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
                      {userAnomalies.slice(0, 6).map((anomaly: AnomalyAudit) => (
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
                              {anomaly.details?.similarity_score && (
                                <p className="text-xs opacity-60">
                                  Similarity: {(anomaly.details.similarity_score * 100).toFixed(1)}%
                                </p>
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
                  <h3 className="text-lg font-bold text-green-400 mb-4"> eKYC Document Verification</h3>
                  <EKYCDocumentViewer userId={userData.uid} />
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4"> Security Overview</h3>
                  
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
                          <span className="text-cyan-400"> Biometric Verification</span>
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-black/20 rounded">
                        <div className="flex items-center">
                          <Activity className="h-5 w-5 text-green-400 mr-3" />
                          <span className="text-cyan-400"> Global Behavioral Monitoring</span>
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
                        <p className="text-gray-400"> Trust Score</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

  {activeTab === 'biometric' && (
    <div className="space-y-6">


      {/* Biometric Status (Read-only) */}
      <div className="glass-card rounded-lg p-6">
        <h3 className="text-green-400 font-bold mb-4 flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          BIOMETRIC_STATUS
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <p className="text-white font-mono text-sm">FACE_RECOGNITION</p>
              <p className="text-gray-400 text-xs">
                {biometricStats.faceEnrolled ? '✅ Enrolled' : '❌ Not enrolled'}
              </p>
            </div>
            <span className="text-green-400 text-sm">ACTIVE</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <p className="text-white font-mono text-sm">BEHAVIORAL_PATTERNS</p>
              <p className="text-gray-400 text-xs">
                {userBiometricData.behavioralPatterns.length > 0 ? '✅ Enrolled' : '❌ Not enrolled'}
              </p>
            </div>
            <span className="text-green-400 text-sm">ACTIVE</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm font-mono">
            ℹ️ BIOMETRIC_RE_ENROLLMENT_REQUIRED?
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Contact administrator for biometric or behavioral pattern updates
          </p>
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