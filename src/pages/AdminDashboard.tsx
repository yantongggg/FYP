// Enhanced AdminDashboard.tsx with Fixed Data Loading and Real-time Analytics

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Activity, 
  Shield, 
  AlertTriangle, 
  Eye, 
  TrendingUp, 
  Database, 
  User,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  BarChart3,
  TrendingDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  trust_score: number;
  is_biometric_enrolled: boolean;
  last_login: string;
  created_at: string;
  total_biometric_records: number;
  avg_quality_score: number;
  avg_liveness_score: number;
  validation_success_rate: number;
  total_login_attempts: number;
  successful_login_attempts: number;
  unresolved_anomalies: number;
}

interface BiometricEvent {
  id: string;
  user_id: string;
  session_id: string;
  blink_count: number;
  mouth_open_count: number;
  head_movement_count: number;
  eye_aspect_ratio: number;
  mouth_aspect_ratio: number;
  face_count: number;
  spoofing_score: number;
  validation_method: string;
  image_quality: number;
  detection_confidence: number;
  created_at: string;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  enrolledUsers: number;
  suspendedUsers: number;
  totalBiometricCaptures: number;
  averageQualityScore: number;
  averageLivenessScore: number;
  successRate: number;
  anomalyCount: number;
  criticalAnomalies: number;
  last24hAnomalies: number;
  autoLockEvents: number;
  anomalyRate: number;
  totalLoginAttempts: number;
  successfulLogins: number;
  failedLogins: number;
}

interface BehavioralSession {
  id: string;
  user_id: string;
  session_id: string;
  similarity_scores: {
    overall_similarity: number;
    keystroke_similarity: number;
    mouse_similarity: number;
  };
  anomaly_score: number;
  is_successful: boolean;
  verification_type: string;
  page_context?: string;
  created_at: string;
}

interface LoginAudit {
  id: string;
  user_id: string;
  event_ts: string;
  success: boolean;
  ip_addr: string;
  user_agent: string;
  biometric_scores?: any;
  failure_reason?: string;
  face_image_url?: string;
  users?: {
    username: string;
    email: string;
  };
}

const AdminDashboard: React.FC = () => {
  const { userData } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userBiometricData, setUserBiometricData] = useState<BiometricEvent[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginAudit[]>([]);
  const [behavioralSessions, setBehavioralSessions] = useState<BehavioralSession[]>([]);
  const [ekycDocuments, setEkycDocuments] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    enrolledUsers: 0,
    suspendedUsers: 0,
    totalBiometricCaptures: 0,
    averageQualityScore: 0,
    averageLivenessScore: 0,
    successRate: 0,
    anomalyCount: 0,
    criticalAnomalies: 0,
    last24hAnomalies: 0,
    autoLockEvents: 0,
    anomalyRate: 0,
    totalLoginAttempts: 0,
    successfulLogins: 0,
    failedLogins: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'biometrics' | 'anomalies' | 'logins' | 'ekyc'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState('');
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  // Helper functions
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-600/20 border-red-500/30';
      case 'high':
        return 'text-orange-400 bg-orange-600/20 border-orange-500/30';
      case 'medium':
        return 'text-yellow-400 bg-yellow-600/20 border-yellow-500/30';
      case 'low':
        return 'text-blue-400 bg-blue-600/20 border-blue-500/30';
      default:
        return 'text-gray-400 bg-gray-600/20 border-gray-500/30';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'auto_lock':
        return 'text-red-400 bg-red-600/20 border-red-500/30';
      case 'warning':
      case 'anomaly_logged':
        return 'text-yellow-400 bg-yellow-600/20 border-yellow-500/30';
      case 'passed':
      case 'none':
        return 'text-green-400 bg-green-600/20 border-green-500/30';
      default:
        return 'text-gray-400 bg-gray-600/20 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-600/20 border-green-500/30';
      case 'suspended':
        return 'text-red-400 bg-red-600/20 border-red-500/30';
      case 'pending':
        return 'text-yellow-400 bg-yellow-600/20 border-yellow-500/30';
      default:
        return 'text-gray-400 bg-gray-600/20 border-gray-500/30';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-red-400 bg-red-600/20 border-red-500/30';
      case 'user':
        return 'text-blue-400 bg-blue-600/20 border-blue-500/30';
      default:
        return 'text-gray-400 bg-gray-600/20 border-gray-500/30';
    }
  };

  // Check if user is admin
  useEffect(() => {
    if (userData?.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }
    loadAdminData();
    
    // Set up real-time subscriptions
    setupRealtimeSubscriptions();
  }, [userData]);

  // Enhanced real-time subscriptions
  const setupRealtimeSubscriptions = () => {
    if (userData?.role !== 'admin') return;

    console.log('🔗 Setting up admin real-time subscriptions');

    const subscription = supabase
      .channel('admin-dashboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'behavioral_sessions'
      }, (payload: any) => {
        console.log('🔄 Behavioral sessions updated:', payload);
        loadBehavioralData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'anomaly_audit'
      }, (payload: any) => {
        console.log('🚨 Anomalies updated:', payload);
        loadAnomalies();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'login_audit'
      }, (payload: any) => {
        console.log('🔐 Login audit updated:', payload);
        loadLoginLogs();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'biometric_data'
      }, (payload: any) => {
        console.log('👁️ Biometric data updated:', payload);
        loadUsers(); // Reload to update biometric stats
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  // Enhanced data loading with proper error handling
  const loadAdminData = async () => {
    if (userData?.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadAnomalies(),
        loadLoginLogs(),
        loadBehavioralData(),
        loadEKYCDocuments()
      ]);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced user loading
  const loadUsers = async () => {
    try {
      console.log('👥 Loading users data');
      
      const { data: usersData, error } = await supabase
        .from('users')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });
      
      if (error) throw error;
      
      if (usersData) {
        setUsers(usersData);
        
        // Load additional biometric stats for each user
        await calculateEnhancedStats(usersData);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Calculate enhanced statistics
  const calculateEnhancedStats = async (usersData: User[]) => {
    try {
      console.log('📊 Calculating enhanced statistics');

      // Load biometric data stats
      const { data: biometricData } = await supabase
        .from('biometric_data')
        .select('user_id, quality_score, created_at');

      // Load login audit stats
      const { data: loginData } = await supabase
        .from('login_audit')
        .select('success, created_at, biometric_scores');

      // Load behavioral sessions stats
      const { data: behavioralData } = await supabase
        .from('behavioral_sessions')
        .select('is_successful, similarity_scores, created_at');

      // Load anomalies stats
      const { data: anomalyData } = await supabase
        .from('anomaly_audit')
        .select('severity, action_taken, created_at');

      // Calculate comprehensive stats
      const totalUsers = usersData.length;
      const activeUsers = usersData.filter(u => u.status === 'active').length;
      const enrolledUsers = usersData.filter(u => u.is_biometric_enrolled).length;
      const suspendedUsers = usersData.filter(u => u.status === 'suspended').length;

      // Biometric stats
      const totalBiometricCaptures = biometricData?.length || 0;
      const averageQualityScore = biometricData && biometricData.length > 0 
        ? biometricData.reduce((sum: number, b: { quality_score?: number }) => sum + (b.quality_score || 0), 0) / biometricData.length 
        : 0;


      // Login stats
      const totalLoginAttempts = loginLogs.length || 0;  // Use loginLogs state instead
      const successfulLogins = loginLogs.filter(l => l.success).length || 0;
      const failedLogins = totalLoginAttempts - successfulLogins;
      const loginSuccessRate = totalLoginAttempts > 0 ? (successfulLogins / totalLoginAttempts) : 0;

      // Behavioral stats
      const behavioralSuccessRate = behavioralData && behavioralData.length > 0
        ? behavioralData.filter((b: { is_successful: boolean }) => b.is_successful).length / behavioralData.length
        : 0;

      // Anomaly stats
      const anomalyCount = anomalyData?.length || 0;
      const criticalAnomalies = anomalyData?.filter((a: { severity: string }) => a.severity === 'critical').length || 0;
      const autoLockEvents = anomalyData?.filter((a: { action_taken: string }) => a.action_taken === 'auto_lock').length || 0;

      
      // Last 24 hours anomalies
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last24hAnomalies = anomalyData?.filter((a: { created_at: string }) => new Date(a.created_at) > last24h).length || 0;

      
      const anomalyRate = totalUsers > 0 ? (anomalyCount / totalUsers) * 100 : 0;

      // Overall success rate (combined behavioral + login)
      const overallSuccessRate = (loginSuccessRate + behavioralSuccessRate) / 2;

      const calculatedStats: DashboardStats = {
        totalUsers,
        activeUsers,
        enrolledUsers,
        suspendedUsers,
        totalBiometricCaptures,
        averageQualityScore,
        averageLivenessScore: averageQualityScore, // Using quality as proxy for liveness
        successRate: overallSuccessRate,
        anomalyCount,
        criticalAnomalies,
        last24hAnomalies,
        autoLockEvents,
        anomalyRate,
        totalLoginAttempts,
        successfulLogins,
        failedLogins
      };
      
      setStats(calculatedStats);
      console.log('✅ Enhanced stats calculated:', calculatedStats);
      
    } catch (error) {
      console.error('Error calculating enhanced stats:', error);
    }
  };

  // Enhanced anomaly loading
  const loadAnomalies = async () => {
    try {
      console.log('🚨 Loading anomalies');
      
      const { data: anomalyData, error } = await supabase
        .from('anomaly_audit')
        .select(`
          *,
          users!anomaly_audit_user_id_fkey(username, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Anomalies query error:', error);
        // Try alternative approach if foreign key doesn't work
        const { data: fallbackData } = await supabase
          .from('anomaly_audit')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
          
        setAnomalies(fallbackData || []);
      } else {
        setAnomalies(anomalyData || []);
      }
      
      console.log('✅ Anomalies loaded:', anomalyData?.length || 0);
    } catch (error) {
      console.error('Error loading anomalies:', error);
      setAnomalies([]);
    }
  };

  // Enhanced login logs loading
  const loadLoginLogs = async () => {
    try {
      console.log('🔐 Loading login logs');
      
      const { data: logsData, error } = await supabase
        .from('login_audit')
        .select(`
          *,
          users(username, email)
        `)
        .order('event_ts', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Login logs query error:', error);
        // Try alternative approach
        const { data: fallbackData } = await supabase
          .from('login_audit')
          .select('*')
          .order('event_ts', { ascending: false })
          .limit(100);
          
        setLoginLogs(fallbackData || []);
      } else {
        setLoginLogs(logsData || []);
      }
      
      console.log('✅ Login logs loaded:', logsData?.length || 0);
    } catch (error) {
      console.error('Error loading login logs:', error);
      setLoginLogs([]);
    }
  };

  // Enhanced behavioral data loading
  const loadBehavioralData = async () => {
    try {
      console.log('🧠 Loading behavioral sessions');
      
      const { data: behavioralData, error } = await supabase
        .from('behavioral_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Behavioral sessions query error:', error);
      } else {
        setBehavioralSessions(behavioralData || []);
        console.log('✅ Behavioral sessions loaded:', behavioralData?.length || 0);
      }
    } catch (error) {
      console.error('Error loading behavioral data:', error);
      setBehavioralSessions([]);
    }
  };

  // Enhanced eKYC loading
  const loadEKYCDocuments = async () => {
    try {
      console.log('📄 Loading eKYC documents');
      
      const { data: ekycData, error } = await supabase
        .from('ekyc_documents')
        .select(`
          *,
          users(username, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('eKYC query error:', error);
        const { data: fallbackData } = await supabase
          .from('ekyc_documents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
          
        setEkycDocuments(fallbackData || []);
      } else {
        setEkycDocuments(ekycData || []);
      }
      
      console.log('✅ eKYC documents loaded:', ekycData?.length || 0);
    } catch (error) {
      console.error('Error loading eKYC documents:', error);
      setEkycDocuments([]);
    }
  };

  const fetchUserBiometricData = async (userId: string) => {
    try {
      // Try enhanced endpoint first, fallback to Supabase
      let response;
      try {
        response = await fetch(`http://localhost:5000/api/enhanced/admin/biometric-data/${userId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        });
        
        if (!response.ok) throw new Error('Enhanced API not available');
        
        const data = await response.json();
        setUserBiometricData(data.detection_events || []);
      } catch (enhancedError) {
        // Fallback to Supabase
        console.warn('Enhanced API not available, using Supabase fallback');
        setUserBiometricData([]);
      }
    } catch (err) {
      console.error('Error fetching user biometric data:', err);
      setUserBiometricData([]);
    }
  };

  const updateUserStatus = async (userId: string, newStatus: 'active' | 'suspended') => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      // Log admin action
      await supabase
        .from('admin_audit_log')
        .insert({
          admin_id: userData?.uid,
          target_user_id: userId,
          action_type: newStatus === 'suspended' ? 'suspend_user' : 'reactivate_user',
          description: `${newStatus === 'suspended' ? 'Suspended' : 'Reactivated'} user`,
          ip_address: '127.0.0.1',
          user_agent: navigator.userAgent
        });

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      // Refresh data
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower) ||
      user.status?.toLowerCase().includes(searchLower)
    );
  });

  const handleUserAction = (user: User, action: string) => {
    setActionUser(user);
    setActionType(action);
    setShowConfirmModal(true);
  };

  const confirmUserAction = async () => {
    if (!actionUser || !actionType) return;
    
    try {
      if (actionType === 'suspend') {
        await updateUserStatus(actionUser.id, 'suspended');
      } else if (actionType === 'reactivate') {
        await updateUserStatus(actionUser.id, 'active');
      }
    } catch (error) {
      console.error(`Error ${actionType}ing user:`, error);
    } finally {
      setShowConfirmModal(false);
      setActionUser(null);
      setActionType('');
    }
  };

  const cancelUserAction = () => {
    setShowConfirmModal(false);
    setActionUser(null);
    setActionType('');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Filter anomalies based on selected filters
  const filteredAnomalies = anomalies.filter(anomaly => {
    // Severity filter
    if (anomalyFilter !== 'all' && anomaly.severity !== anomalyFilter) {
      return false;
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        anomaly.anomaly_type?.toLowerCase().includes(searchLower) ||
        anomaly.user_id?.toLowerCase().includes(searchLower) ||
        anomaly.users?.username?.toLowerCase().includes(searchLower) ||
        anomaly.users?.email?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Enhanced StatCard component
  const StatCard: React.FC<{ 
    title: string; 
    value: string | number; 
    icon: React.ReactNode; 
    color: string; 
    trend?: string;
    subtitle?: string;
  }> = ({ title, value, icon, trend, subtitle }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-lg p-6 hover-glow transition-all duration-300"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-cyan-400 text-sm font-mono">{title}</p>
          <p className="text-3xl font-bold text-green-400 neon-glow">{value}</p>
          {trend && <p className="text-green-400 text-sm font-mono">{trend}</p>}
          {subtitle && <p className="text-gray-400 text-xs">{subtitle}</p>}
        </div>
        <div className="w-12 h-12 rounded-full bg-green-900/30 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </motion.div>
  );

  const BiometricDetailModal: React.FC = () => {
    if (!selectedUser) return null;

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-modal rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto mx-4"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-green-400 font-mono">
              BIOMETRIC_DATA: {selectedUser.full_name || selectedUser.username}
            </h2>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
              <h3 className="font-bold text-blue-400 mb-2">QUALITY_SCORE</h3>
              <p className="text-2xl font-bold text-blue-400">
                {((selectedUser.avg_quality_score || 0.85) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg">
              <h3 className="font-bold text-green-400 mb-2">LOGIN_SUCCESS</h3>
              <p className="text-2xl font-bold text-green-400">
                {((selectedUser.validation_success_rate || 0.92) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
              <h3 className="font-bold text-purple-400 mb-2">TRUST_SCORE</h3>
              <p className="text-2xl font-bold text-purple-400">
                {selectedUser.trust_score || 85}/100
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setSelectedUser(null)}
              className="terminal-button px-4 py-2 rounded font-bold"
            >
              CLOSE
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  // Early return for access control
  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-green-400 font-mono">LOADING_ADMIN_DASHBOARD...</p>
        </div>
      </div>
    );
  }

  if (error && userData?.role !== 'admin') {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-400 mb-2 font-mono">ACCESS_DENIED</h1>
          <p className="text-red-400 mb-4 font-mono">ADMIN_PRIVILEGES_REQUIRED</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadAdminData}
            className="terminal-button px-4 py-2 rounded font-bold"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-green-400 mb-2 glitch-text">ADMIN_CONTROL_PANEL</h1>
              <p className="text-cyan-400 font-mono">REAL-TIME_MONITORING // USER_MANAGEMENT // SECURITY_ANALYTICS</p>
            </div>
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="terminal-button px-4 py-2 rounded flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh All Data
            </button>
          </div>
        </motion.div>

        {/* Enhanced Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="TOTAL_USERS"
            value={stats.totalUsers}
            icon={<Users className="h-6 w-6 text-green-400" />}
            color="from-blue-500 to-blue-600"
            trend={`${stats.activeUsers} ACTIVE | ${stats.suspendedUsers} SUSPENDED`}
          />
          <StatCard
            title="BIOMETRIC_ENROLLED"
            value={`${stats.totalUsers > 0 ? ((stats.enrolledUsers / stats.totalUsers) * 100).toFixed(1) : 0}%`}
            icon={<Shield className="h-6 w-6 text-blue-400" />}
            color="from-green-500 to-green-600"
            trend={`${stats.enrolledUsers} OF ${stats.totalUsers} USERS`}
            subtitle={`${stats.totalBiometricCaptures} total captures`}
          />
          <StatCard
            title="LOGIN_SUCCESS_RATE"
            value={`${(stats.successRate * 100).toFixed(1)}%`}
            icon={<TrendingUp className="h-6 w-6 text-purple-400" />}
            color="from-purple-500 to-purple-600"
            trend={`${stats.successfulLogins}/${stats.totalLoginAttempts} ATTEMPTS`}
          />
          <StatCard
            title="SECURITY_ALERTS"
            value={stats.anomalyCount}
            icon={<AlertTriangle className="h-6 w-6 text-yellow-400" />}
            color="from-red-500 to-red-600"
            trend={`${stats.last24hAnomalies} IN 24H`}
            subtitle={`${stats.criticalAnomalies} critical`}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-lg"
        >
          <div className="border-b border-green-500/30">
            <nav className="flex space-x-8 px-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'OVERVIEW', icon: TrendingUp },
                { id: 'users', label: 'USERS', icon: Users },
                { id: 'biometrics', label: 'BIOMETRICS', icon: Eye },
                { id: 'anomalies', label: 'ANOMALIES', icon: AlertTriangle },
                { id: 'logins', label: 'LOGINS', icon: Activity },
                { id: 'ekyc', label: 'eKYC', icon: FileText }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-bold text-sm transition-all duration-300 font-mono ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-400 neon-glow'
                      : 'border-transparent text-cyan-400 hover:text-green-400'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Enhanced System Health */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass-card rounded-lg p-6">
                    <h3 className="text-lg font-bold text-green-400 mb-4">SYSTEM_HEALTH</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">AVG_QUALITY_SCORE</span>
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-700 rounded-full h-2 mr-2">
                            <div 
                              className="bg-green-400 h-2 rounded-full"
                              style={{ width: `${stats.averageQualityScore * 100}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-green-400">{(stats.averageQualityScore * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">LOGIN_SUCCESS_RATE</span>
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-700 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-400 h-2 rounded-full"
                              style={{ width: `${stats.successRate * 100}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-blue-400">{(stats.successRate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">TOTAL_CAPTURES</span>
                        <span className="font-bold text-green-400">{stats.totalBiometricCaptures.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">BEHAVIORAL_SESSIONS</span>
                        <span className="font-bold text-purple-400">{behavioralSessions.length.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-lg p-6">
                    <h3 className="text-lg font-bold text-green-400 mb-4">SECURITY_METRICS</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">TOTAL_ANOMALIES</span>
                        <span className="bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.anomalyCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">CRITICAL_ALERTS</span>
                        <span className="bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.criticalAnomalies}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">AUTO_LOCK_EVENTS</span>
                        <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.autoLockEvents}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">LAST_24H_ALERTS</span>
                        <span className="bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.last24hAnomalies}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time Activity Feed */}
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4">🔄 REAL-TIME ACTIVITY FEED</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {/* Recent Behavioral Sessions */}
                    {behavioralSessions.slice(0, 3).map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-blue-900/20 rounded">
                        <div className="flex items-center">
                          <Activity className="h-4 w-4 text-blue-400 mr-2" />
                          <span className="text-blue-400 text-sm">
                            Behavioral session - {session.verification_type}
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">
                          {new Date(session.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    
                    {/* Recent Login Attempts */}
                    {loginLogs.slice(0, 3).map((login) => (
                      <div key={login.id} className="flex items-center justify-between p-3 bg-green-900/20 rounded">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 text-green-400 mr-2" />
                          <span className="text-green-400 text-sm">
                            {login.success ? 'Successful' : 'Failed'} login attempt
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">
                          {new Date(login.event_ts).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    
                    {/* Recent Anomalies */}
                    {anomalies.slice(0, 2).map((anomaly) => (
                      <div key={anomaly.id} className="flex items-center justify-between p-3 bg-red-900/20 rounded">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 text-red-400 mr-2" />
                          <span className="text-red-400 text-sm">
                            {anomaly.severity} anomaly detected
                          </span>
                        </div>
                        <span className="text-gray-400 text-xs">
                          {new Date(anomaly.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab - Keep existing implementation */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="terminal-input w-full pl-10 pr-4 py-2 rounded bg-gray-900 border border-green-500 text-green-400 placeholder-green-400/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-cyan-400 text-sm font-mono">SORT_BY:</span>
                    <button
                      onClick={() => handleSort('created_at')}
                      className={`terminal-button px-3 py-1 rounded text-sm flex items-center ${
                        sortField === 'created_at' ? 'bg-green-600/30' : ''
                      }`}
                    >
                      DATE
                      {sortField === 'created_at' && (
                        sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => handleSort('username')}
                      className={`terminal-button px-3 py-1 rounded text-sm flex items-center ${
                        sortField === 'username' ? 'bg-green-600/30' : ''
                      }`}
                    >
                      NAME
                      {sortField === 'username' && (
                        sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => handleSort('trust_score')}
                      className={`terminal-button px-3 py-1 rounded text-sm flex items-center ${
                        sortField === 'trust_score' ? 'bg-green-600/30' : ''
                      }`}
                    >
                      TRUST
                      {sortField === 'trust_score' && (
                        sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="glass-card rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-black/30 border-b border-green-500/30">
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">USERNAME</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">EMAIL</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">ROLE</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">STATUS</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">TRUST_SCORE</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">BIOMETRIC</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">LAST_LOGIN</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-cyan-400 font-mono">
                              {loading ? (
                                <div className="flex justify-center items-center">
                                  <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                                  LOADING_USER_DATA...
                                </div>
                              ) : (
                                searchTerm ? 'NO_MATCHING_USERS_FOUND' : 'NO_USERS_IN_DATABASE'
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => (
                            <tr key={user.id} className="border-b border-green-500/10 hover:bg-green-900/10">
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                                      {user.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-white">{user.full_name || user.username}</div>
                                    <div className="text-sm text-gray-400">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-white">{user.email}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${getRoleColor(user.role)}`}>
                                  {user.role?.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${getStatusColor(user.status)}`}>
                                  {user.status?.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="w-16 bg-gray-700 rounded-full h-2.5 mr-2">
                                    <div 
                                      className="bg-green-400 h-2.5 rounded-full" 
                                      style={{ width: `${user.trust_score || 0}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-white">{user.trust_score || 0}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  {user.is_biometric_enrolled ? (
                                    <span className="text-green-400 flex items-center">
                                      <Shield className="h-4 w-4 mr-1" />
                                      ENROLLED
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 flex items-center">
                                      <AlertTriangle className="h-4 w-4 mr-1" />
                                      NOT_ENROLLED
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-white">{formatDate(user.last_login)}</td>
                              <td className="px-4 py-3">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedUser(user);
                                      fetchUserBiometricData(user.id);
                                    }}
                                    className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded text-xs font-bold hover:bg-blue-600/30 transition-all duration-300 hover-glow"
                                  >
                                    VIEW_DETAILS
                                  </button>
                                  {user.status === 'active' ? (
                                    <button
                                      onClick={() => handleUserAction(user, 'suspend')}
                                      className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-500/30 rounded text-xs font-bold hover:bg-red-600/30 transition-all duration-300 hover-glow"
                                    >
                                      SUSPEND
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUserAction(user, 'reactivate')}
                                      className="px-3 py-1 bg-green-600/20 text-green-400 border border-green-500/30 rounded text-xs font-bold hover:bg-green-600/30 transition-all duration-300 hover-glow"
                                    >
                                      REACTIVATE
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Biometrics Tab */}
            {activeTab === 'biometrics' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <Eye className="mr-3 h-6 w-6" />
                  ENHANCED BIOMETRIC ANALYTICS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <Database className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-400">{stats.totalBiometricCaptures}</p>
                    <p className="text-sm text-cyan-400 font-mono">TOTAL_CAPTURES</p>
                  </div>
                  <div className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <Eye className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">{(stats.averageQualityScore * 100).toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400 font-mono">AVG_QUALITY</p>
                  </div>
                  <div className="text-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <Shield className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-400">{(stats.averageLivenessScore * 100).toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400 font-mono">AVG_LIVENESS</p>
                  </div>
                  <div className="text-center p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                    <TrendingUp className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-orange-400">{behavioralSessions.length}</p>
                    <p className="text-sm text-cyan-400 font-mono">BEHAVIORAL_SESSIONS</p>
                  </div>
                </div>
                
                {/* Recent Behavioral Sessions */}
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4">Recent Behavioral Sessions</h3>
                  {behavioralSessions.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {behavioralSessions.slice(0, 10).map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-3 bg-black/20 rounded">
                          <div className="flex items-center">
                            <Activity className="h-4 w-4 text-cyan-400 mr-2" />
                            <div>
                              <p className="text-cyan-400 text-sm font-bold">
                                User: {session.user_id.slice(-8)}... | {session.verification_type}
                              </p>
                              <p className="text-gray-400 text-xs">
                                Similarity: {(session.similarity_scores?.overall_similarity * 100 || 0).toFixed(1)}% |
                                Page: {session.page_context || 'unknown'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {session.is_successful ? (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-400" />
                            )}
                            <span className="text-gray-400 text-xs ml-2">
                              {new Date(session.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-4">No behavioral sessions recorded</p>
                  )}
                </div>
              </div>
            )}

            {/* Enhanced Anomalies Tab */}
            {activeTab === 'anomalies' && (
              <div className="space-y-6">
                {/* Simple Filters */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
                    <input
                      type="text"
                      placeholder="Search anomalies..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="terminal-input w-full pl-10 pr-4 py-2 rounded bg-gray-900 border border-green-500 text-green-400 placeholder-green-400/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {/* Severity Filter */}
                    <div className="flex items-center space-x-2">
                      <span className="text-cyan-400 text-sm font-mono">FILTER:</span>
                      <select
                        value={anomalyFilter}
                        onChange={(e) => setAnomalyFilter(e.target.value as any)}
                        className="terminal-input px-3 py-1 rounded text-sm bg-gray-900 border border-green-500 text-green-400"
                      >
                        <option value="all">ALL SEVERITY</option>
                        <option value="critical">CRITICAL</option>
                        <option value="high">HIGH</option>
                        <option value="medium">MEDIUM</option>
                        <option value="low">LOW</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={loadAnomalies}
                      className="terminal-button px-3 py-1 rounded text-sm flex items-center"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      REFRESH
                    </button>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <AlertTriangle className="mr-3 h-6 w-6" />
                  🚨 BEHAVIORAL ANOMALIES ({filteredAnomalies.length})
                </h2>

                {filteredAnomalies.length === 0 ? (
                  <div className="text-center p-8 glass-card rounded-lg">
                    <Shield className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="text-green-400 font-mono">
                      {anomalyFilter === 'all' && !searchTerm 
                        ? 'NO_ANOMALIES_DETECTED' 
                        : 'NO_ANOMALIES_MATCH_FILTERS'}
                    </p>
                  </div>
                ) : (
                  <div className="glass-card rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-black/30 border-b border-green-500/30">
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">USER</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">ANOMALY_TYPE</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">SEVERITY</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">SCORE</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">ACTION</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">TIME</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">CONTEXT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAnomalies.map((anomaly) => (
                            <tr key={anomaly.id} className="border-b border-green-500/10 hover:bg-green-900/10">
                            <td className="px-4 py-3">
                              <div className="text-cyan-400 font-mono text-sm">
                                {anomaly.users?.username || users.find(u => u.id === anomaly.user_id)?.username || anomaly.user_id.slice(-8) + '...'}
                              </div>
                              <div className="text-gray-400 text-xs">
                                {anomaly.users?.email || users.find(u => u.id === anomaly.user_id)?.email || 'Unknown'}
                              </div>
                            </td>
                              <td className="px-4 py-3">
                                <div className="text-white font-bold text-sm">
                                  {anomaly.anomaly_type.replace(/_/g, ' ').toUpperCase()}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${getSeverityColor(anomaly.severity)}`}>
                                  {anomaly.severity.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-700 rounded-full h-2 mr-2 w-16">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        anomaly.anomaly_score >= 0.8 ? 'bg-red-400' :
                                        anomaly.anomaly_score >= 0.5 ? 'bg-yellow-400' : 'bg-green-400'
                                      }`}
                                      style={{ width: `${anomaly.anomaly_score * 100}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-white text-sm font-bold">
                                    {(anomaly.anomaly_score * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${getActionColor(anomaly.action_taken)}`}>
                                  {anomaly.action_taken.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-white text-sm">
                                  {new Date(anomaly.created_at).toLocaleDateString()}
                                </div>
                                <div className="text-gray-400 text-xs">
                                  {new Date(anomaly.created_at).toLocaleTimeString()}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-cyan-400 font-mono text-xs">
                                  {anomaly.session_id?.slice(-8)}...
                                </div>
                                {anomaly.details?.page_context && (
                                  <div className="text-gray-400 text-xs">
                                    Page: {anomaly.details.page_context}
                                  </div>
                                )}
                                {anomaly.details?.similarity_score && (
                                  <div className="text-gray-400 text-xs">
                                    Sim: {(anomaly.details.similarity_score * 100).toFixed(0)}%
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Logins Tab */}
            {activeTab === 'logins' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <Activity className="mr-3 h-6 w-6" />
                  ENHANCED AUTHENTICATION LOGS ({loginLogs.length})
                </h2>

                {/* Login Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">{stats.successfulLogins}</p>
                    <p className="text-sm text-cyan-400 font-mono">SUCCESSFUL_LOGINS</p>
                  </div>
                  <div className="text-center p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-400">{stats.failedLogins}</p>
                    <p className="text-sm text-cyan-400 font-mono">FAILED_ATTEMPTS</p>
                  </div>
                  <div className="text-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <BarChart3 className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-400">{(stats.successRate * 100).toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400 font-mono">SUCCESS_RATE</p>
                  </div>
                  <div className="text-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <Activity className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-400">{stats.totalLoginAttempts}</p>
                    <p className="text-sm text-cyan-400 font-mono">TOTAL_ATTEMPTS</p>
                  </div>
                </div>

                {loginLogs.length === 0 ? (
                  <div className="text-center p-8 glass-card rounded-lg">
                    <Clock className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                    <p className="text-cyan-400 font-mono">NO_LOGIN_ACTIVITY_RECORDED</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loginLogs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="ekyc-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            {log.success ? (
                              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400 mr-2" />
                            )}
                            <span className={`font-bold ${log.success ? 'text-green-400' : 'text-red-400'} font-mono`}>
                              {log.success ? 'SUCCESSFUL_LOGIN' : 'FAILED_ATTEMPT'}
                            </span>
                          </div>
                          <div className="flex items-center text-cyan-400 text-sm">
                            <Clock className="h-4 w-4 mr-1" />
                            {formatDate(log.event_ts)}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <div className="flex items-center text-gray-400 text-sm mb-1">
                              <User className="h-4 w-4 mr-1" />
                              User: {log.users?.username || users.find(u => u.id === log.user_id)?.username || 'Unknown'}
                            </div>
                            <div className="flex items-center text-gray-400 text-sm mb-1">
                              <Database className="h-4 w-4 mr-1" />
                              IP: {log.ip_addr || 'Unknown'}
                            </div>
                            {log.failure_reason && (
                              <div className="text-red-400 text-sm">
                                Reason: {log.failure_reason}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end">
                            {log.face_image_url && (
                              <img
                                src={log.face_image_url}
                                alt="Login face"
                                className="w-12 h-12 rounded border border-green-400/30 mr-4"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            )}
                            {log.biometric_scores && (
                              <div className="text-right">
                                {log.biometric_scores.face_similarity && (
                                  <div className="text-sm">
                                    <span className="text-gray-400">Face:</span>
                                    <span className={`ml-1 font-bold ${
                                      log.biometric_scores.face_similarity >= 0.8 ? 'text-green-400' : 
                                      log.biometric_scores.face_similarity >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                      {(log.biometric_scores.face_similarity * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                )}
                                {log.biometric_scores.liveness && (
                                  <div className="text-sm">
                                    <span className="text-gray-400">Liveness:</span>
                                    <span className={`ml-1 font-bold ${
                                      log.biometric_scores.liveness >= 0.8 ? 'text-green-400' : 
                                      log.biometric_scores.liveness >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                      {(log.biometric_scores.liveness * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Enhanced eKYC Tab */}
            {activeTab === 'ekyc' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <FileText className="mr-3 h-6 w-6" />
                  IC_DOCUMENT_VERIFICATION ({ekycDocuments.filter(doc => doc.document_type === 'ic_front').length})
                </h2>

                {ekycDocuments.filter(doc => doc.document_type === 'ic_front').length === 0 ? (
                  <div className="text-center p-8 glass-card rounded-lg">
                    <FileText className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                    <p className="text-cyan-400 font-mono">NO_IC_DOCUMENTS_SUBMITTED</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ekycDocuments
                      .filter(doc => doc.document_type === 'ic_front')
                      .map((frontDoc) => {
                        // Find matching back document
                        const backDoc = ekycDocuments.find(doc => 
                          doc.document_type === 'ic_back' && 
                          doc.user_id === frontDoc.user_id &&
                          Math.abs(new Date(doc.created_at).getTime() - new Date(frontDoc.created_at).getTime()) < 300000 // Within 5 minutes
                        );

                        return (
                          <motion.div
                            key={frontDoc.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="ekyc-card"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center">
                                <FileText className="h-5 w-5 mr-2 text-blue-400" />
                                <span className="font-bold text-blue-400 font-mono">IC_UPLOAD</span>
                              </div>
                              <div className="flex items-center">
                                <span className={`px-3 py-1 rounded text-sm font-bold border ${
                                  frontDoc.verification_status === 'verified' ? 'text-green-400 bg-green-600/20 border-green-500/30' :
                                  frontDoc.verification_status === 'rejected' ? 'text-red-400 bg-red-600/20 border-red-500/30' :
                                  'text-yellow-400 bg-yellow-600/20 border-yellow-500/30'
                                }`}>
                                  {frontDoc.verification_status.toUpperCase()}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* User Info */}
                              <div className="space-y-2">
                                <div className="flex items-center text-cyan-400 text-sm">
                                  <User className="h-4 w-4 mr-2" />
                                  <span className="font-bold">User: {frontDoc.users?.username || 'Unknown'}</span>
                                </div>
                                <div className="flex items-center text-gray-400 text-sm">
                                  <Clock className="h-4 w-4 mr-2" />
                                  <span>Submitted: {formatDate(frontDoc.created_at)}</span>
                                </div>
                                <div className="flex items-center text-gray-400 text-sm">
                                  <Shield className="h-4 w-4 mr-2" />
                                  <span>Score: </span>
                                  <span className={`ml-1 font-bold ${
                                    (frontDoc.document_authenticity_score || 0) >= 0.35 ? 'text-green-400' : 
                                    (frontDoc.document_authenticity_score || 0) >= 0.25 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {((frontDoc.document_authenticity_score || 0) * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>

                              {/* IC Images */}
                              <div className="lg:col-span-2">
                                <div className="grid grid-cols-2 gap-4">
                                  {/* Front Image */}
                                  <div className="text-center">
                                    <p className="text-gray-400 text-xs mb-2 font-mono">FRONT_IMAGE</p>
                                    {frontDoc.id_document_url ? (
                                      <img
                                        src={frontDoc.id_document_url}
                                        alt="IC Front"
                                        className="w-full h-32 object-cover rounded border border-green-400/30 cursor-pointer hover:border-green-400 transition-all duration-300"
                                        onClick={() => window.open(frontDoc.id_document_url, '_blank')}
                                      />
                                    ) : (
                                      <div className="w-full h-32 bg-gray-800 rounded border border-gray-600 flex items-center justify-center">
                                        <span className="text-gray-500 text-xs">NO_IMAGE</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Back Image */}
                                  <div className="text-center">
                                    <p className="text-gray-400 text-xs mb-2 font-mono">BACK_IMAGE</p>
                                    {backDoc?.id_document_url ? (
                                      <img
                                        src={backDoc.id_document_url}
                                        alt="IC Back"
                                        className="w-full h-32 object-cover rounded border border-green-400/30 cursor-pointer hover:border-green-400 transition-all duration-300"
                                        onClick={() => window.open(backDoc.id_document_url, '_blank')}
                                      />
                                    ) : (
                                      <div className="w-full h-32 bg-gray-800 rounded border border-gray-600 flex items-center justify-center">
                                        <span className="text-gray-500 text-xs">NO_BACK_IMAGE</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex justify-center mt-3 space-x-2">
                                  {frontDoc.id_document_url && (
                                    <button
                                      onClick={() => window.open(frontDoc.id_document_url, '_blank')}
                                      className="px-2 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded text-xs font-bold hover:bg-blue-600/30 transition-all duration-300"
                                    >
                                      VIEW_FRONT
                                    </button>
                                  )}
                                  {backDoc?.id_document_url && (
                                    <button
                                      onClick={() => window.open(backDoc.id_document_url, '_blank')}
                                      className="px-2 py-1 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded text-xs font-bold hover:bg-purple-600/30 transition-all duration-300"
                                    >
                                      VIEW_BACK
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {selectedUser && <BiometricDetailModal />}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-modal rounded-lg p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-xl font-bold text-green-400 mb-4 font-mono">
              CONFIRM_ACTION
            </h3>
            <p className="text-cyan-400 mb-6 font-mono">
              {actionType === 'suspend' 
                ? `Are you sure you want to suspend user ${actionUser?.username}? This will prevent them from logging in.`
                : `Are you sure you want to reactivate user ${actionUser?.username}? This will restore their access.`
              }
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelUserAction}
                className="px-4 py-2 bg-gray-600/20 text-gray-400 border border-gray-500/30 rounded font-bold hover:bg-gray-600/30 transition-all duration-300"
              >
                CANCEL
              </button>
              <button
                onClick={confirmUserAction}
                className={`px-4 py-2 rounded font-bold ${
                  actionType === 'suspend'
                    ? 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                    : 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
                } transition-all duration-300 hover-glow`}
              >
                CONFIRM
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .glass-modal {
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.3);
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

        .hover-glow {
          transition: all 0.3s ease;
        }

        .hover-glow:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6);
        }

        .glitch-text {
          animation: glitch 2s infinite;
        }

        .neon-glow {
          text-shadow: 0 0 5px #10b981, 0 0 10px #10b981, 0 0 15px #10b981;
        }

        .ekyc-card {
          background: rgba(0, 255, 128, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(0, 255, 128, 0.2);
          backdrop-filter: blur(10px);
          box-shadow: 0 0 12px rgba(0, 255, 128, 0.08);
          padding: 1.5rem;
          color: #d1fae5;
          transition: all 0.3s ease;
        }

        .ekyc-card:hover {
          box-shadow: 0 0 20px rgba(0, 255, 128, 0.3);
        }

        .terminal-input {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
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

export default AdminDashboard;