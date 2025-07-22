
import React, { useState, useEffect } from 'react';
import { exportLogsToPDF } from '../../backend/utils/exportUtils';
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
  TrendingDown,
  Edit,        
  UserX,       
  UserCheck,   
  X,          
  Save         
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
  is_active: boolean;                    
  biometric_enrolled: boolean;          
  behavioral_enrolled: boolean;          
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

interface EditingUser {
  id: string;
  username: string;
  email: string;
  role: string;
  trust_score: number;
  is_active: boolean;
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
  user_name: string;
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
  const [allUsers, setAllUsers] = useState<User[]>([]);         
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null); 
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUserData, setEditingUserData] = useState({
    username: '',
    email: '',
    status: 'active',
    role: 'user'
  });
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
  const [success, setSuccess] = useState<string>('');              //   ADD THIS
  const [updating, setUpdating] = useState(false);                 //   ADD THIS
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'biometrics' | 'anomalies' | 'logins' | 'ekyc'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState('');
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  //   ADD: Missing functions
  const handleEditUser = (user: User) => {
    setEditingUser({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      trust_score: user.trust_score,
      is_active: user.is_active
    });
    setError('');
    setSuccess('');
  };

  const handleUpdateUser = async () => {
    if (!editingUser || updating) return;

    setUpdating(true);
    setError('');
    setSuccess('');

    try {
      console.log('Updating user:', editingUser.id);

      const response = await fetch('http://localhost:5000/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingUser)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('User updated successfully');
        setEditingUser(null);
        loadUsers(); // Reload users to get updated data
      } else {
        setError(result.error || 'Update failed');
      }
    } catch (err) {
      console.error('  User update error:', err);
      setError('Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      setError('');
      setSuccess('');

      const response = await fetch('http://localhost:5000/api/admin/toggle-user-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          is_active: !currentStatus
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        loadUsers();
      } else {
        setError(result.error || 'Status update failed');
      }
    } catch (err) {
      console.error('  User status toggle error:', err);
      setError('Network error');
    }
  };

  const handleResetBiometric = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s biometric data? This action cannot be undone.')) {
      return;
    }

    try {
      setError('');
      setSuccess('');

      const response = await fetch('http://localhost:5000/api/admin/reset-biometric', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          admin_id: userData?.uid
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Biometric data reset successfully');
        loadUsers();
      } else {
        setError(result.error || 'Reset failed');
      }
    } catch (err) {
      console.error('  Biometric reset error:', err);
      setError('Network error');
    }
  };

  //   ADD: Filter and sort users
  useEffect(() => {
    let filtered = allUsers;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((user: User) =>
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'username':
          aValue = a.username || '';
          bValue = b.username || '';
          break;
        case 'trust_score':
          aValue = a.trust_score || 0;
          bValue = b.trust_score || 0;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredUsers(filtered);
  }, [allUsers, searchTerm, sortField, sortDirection]);

  const handleSaveUserChanges = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch('http://localhost:5000/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          username: editingUserData.username,
          email: editingUserData.email,
          status: editingUserData.status,
          role: editingUserData.role,
          admin_id: userData?.uid
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh users list
        loadUsers();
        setShowEditModal(false);
        setSelectedUser(null);
      } else {
        alert(`Update failed: ${result.error}`);
      }
    } catch (error) {
      alert('Network error while updating user');
    }
  };

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

    console.log('  Setting up admin real-time subscriptions');

    const subscription = supabase
      .channel('admin-dashboard-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'behavioral_sessions'
      }, (payload: any) => {
        console.log('  Behavioral sessions updated:', payload);
        loadBehavioralData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'anomaly_audit'
      }, (payload: any) => {
        console.log('  Anomalies updated:', payload);
        loadAnomalies();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'login_audit'
      }, (payload: any) => {
        console.log('  Login audit updated:', payload);
        loadLoginLogs();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'biometric_data'
      }, (payload: any) => {
        console.log('  Biometric data updated:', payload);
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

  const loadUsersFromBackend = async () => {
    try {
      console.log('👥 Loading users from backend API');
      
      const response = await fetch('http://localhost:5000/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load users from backend');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setUsers(result.users);
        setAllUsers(result.users);
        console.log('  Users loaded from backend:', result.users.length);
        await calculateEnhancedStats(result.users);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Backend API failed, falling back to direct Supabase:', error);
      // Fallback to the fixed Supabase version above
      // await loadUsers();
      await loadUsersFromBackend();
    }
  };
  const loadUsers = async () => {
    try {
      console.log('👥 Loading users data with real enrollment status');
      
      const { data: usersData, error } = await supabase
        .from('users')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });
      
      if (error) throw error;
      
      if (usersData) {
        const processedUsers = await Promise.all(
          usersData.map(async (user: any) => {
            // Check if user has face biometric data
            const { data: biometricData } = await supabase
              .from('biometric_data')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);

            // Check if user has behavioral patterns
            const { data: behavioralData } = await supabase
              .from('behavioral_patterns')
              .select('id')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .limit(1);

            // Alternative: Check behavioral_sessions if no behavioral_patterns table
            const { data: behavioralSessions } = await supabase
              .from('behavioral_sessions')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);

            return {
              ...user,
              is_active: user.is_active !== false,
              biometric_enrolled: (biometricData && biometricData.length > 0), //   Real check
              behavioral_enrolled: (behavioralData && behavioralData.length > 0) || (behavioralSessions && behavioralSessions.length > 0), //   Real check
              trust_score: user.trust_score || 85
            };
          })
        );

        setUsers(processedUsers);
        setAllUsers(processedUsers); 
        
        console.log('  Users loaded with real enrollment status:', processedUsers.length);
        
        // Load additional biometric stats for each user
        await calculateEnhancedStats(processedUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Calculate enhanced statistics
  const calculateEnhancedStats = async (usersData: User[]) => {
    try {
      console.log('Calculating enhanced statistics');

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
      
      //   FIX: Use the correct property name 'biometric_enrolled' instead of 'is_biometric_enrolled'
      const enrolledUsers = usersData.filter(u => u.biometric_enrolled).length;
      
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
        enrolledUsers, //   This will now show the correct count
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
      console.log('  Enhanced stats calculated:', calculatedStats);
      console.log('  Debug - enrolledUsers:', enrolledUsers, 'totalUsers:', totalUsers);
      
    } catch (error) {
      console.error('Error calculating enhanced stats:', error);
    }
  };

  // Enhanced anomaly loading
  const loadAnomalies = async () => {
    try {
      console.log('  Loading anomalies');
      
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
      
      console.log('  Anomalies loaded:', anomalyData?.length || 0);
    } catch (error) {
      console.error('Error loading anomalies:', error);
      setAnomalies([]);
    }
  };

  // Enhanced login logs loading
  const loadLoginLogs = async () => {
    try {
      console.log('  Loading login logs');
      
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
      
      console.log('  Login logs loaded:', logsData?.length || 0);
    } catch (error) {
      console.error('Error loading login logs:', error);
      setLoginLogs([]);
    }
  };

  // Enhanced behavioral data loading
  const loadBehavioralData = async () => {
    try {
      console.log('  Loading behavioral sessions');
      
      const { data: behavioralData, error } = await supabase
        .from('behavioral_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Behavioral sessions query error:', error);
      } else {
        setBehavioralSessions(behavioralData || []);
        console.log('  Behavioral sessions loaded:', behavioralData?.length || 0);
      }
    } catch (error) {
      console.error('Error loading behavioral data:', error);
      setBehavioralSessions([]);
    }
  };

  // Enhanced eKYC loading
  const loadEKYCDocuments = async () => {
    try {
      console.log('  Loading eKYC documents');
      
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
      
      console.log('  eKYC documents loaded:', ekycData?.length || 0);
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
          <p className="text-green-400 font-mono">LOADING ADMIN DASHBOARD...</p>
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
              <h1 className="text-4xl font-bold text-green-400 mb-2 glitch-text">ADMIN CONTROL PANEL</h1>
              <p className="text-cyan-400 font-mono">REAL-TIME MONITORING // USER MANAGEMENT // SECURITY ANALYTICS</p>
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
            title="TOTAL USERS"
            value={stats.totalUsers}
            icon={<Users className="h-6 w-6 text-green-400" />}
            color="from-blue-500 to-blue-600"
            trend={`${stats.activeUsers} ACTIVE | ${stats.suspendedUsers} SUSPENDED`}
          />
          <StatCard
            title="BIOMETRIC ENROLLED"
            value={`${stats.totalUsers > 0 ? ((stats.enrolledUsers / stats.totalUsers) * 100).toFixed(1) : 0}%`}
            icon={<Shield className="h-6 w-6 text-blue-400" />}
            color="from-green-500 to-green-600"
            trend={`${stats.enrolledUsers} OF ${stats.totalUsers} USERS`}
            subtitle={`${stats.totalBiometricCaptures} total captures`}
          />
          <StatCard
            title="LOGIN SUCCESS RATE"
            value={`${(stats.successRate * 100).toFixed(1)}%`}
            icon={<TrendingUp className="h-6 w-6 text-purple-400" />}
            color="from-purple-500 to-purple-600"
            trend={`${stats.successfulLogins}/${stats.totalLoginAttempts} ATTEMPTS`}
          />
          <StatCard
            title="SECURITY ALERTS"
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

                    <h3 className="text-lg font-bold text-green-400 mb-4">SYSTEM HEALTH</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">AVG QUALITY SCORE</span>
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
                        <span className="text-cyan-400 font-mono">LOGIN SUCCESS RATE</span>
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
                        <span className="text-cyan-400 font-mono">TOTAL CAPTURES</span>
                        <span className="font-bold text-green-400">{stats.totalBiometricCaptures.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">BEHAVIORAL SESSIONS</span>
                        <span className="font-bold text-purple-400">{behavioralSessions.length.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-lg p-6">
                    <h3 className="text-lg font-bold text-green-400 mb-4">SECURITY METRICS</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">TOTAL ANOMALIES</span>
                        <span className="bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.anomalyCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">CRITICAL ALERTS</span>
                        <span className="bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.criticalAnomalies}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">AUTO LOCK EVENTS</span>
                        <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.autoLockEvents}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">LAST 24H ALERTS</span>
                        <span className="bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.last24hAnomalies}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time Activity Feed */}
                <div className="glass-card rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-400 mb-4">  REAL-TIME ACTIVITY FEED</h3>
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

            {activeTab === 'users' && (
              <div className="space-y-6">
                {/* Header with Export Button */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-green-400 flex items-center">
                    <Users className="mr-3 h-6 w-6" />
                    USER MANAGEMENT ({filteredUsers.length})
                  </h2>
                  <button 
                    onClick={() => exportLogsToPDF('users', filteredUsers)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold transition-all duration-300 hover:shadow-lg"
                  >
                    <FileText className="h-4 w-4" />
                    Export Users PDF
                  </button>
                </div>

                {/* Search and Controls Section */}
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
                    <button
                      onClick={loadUsers}
                      disabled={loading}
                      className="terminal-button px-3 py-1 rounded text-sm flex items-center bg-cyan-600/20 border border-cyan-500/30"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      REFRESH
                    </button>
                  </div>
                </div>

                {/* Status Messages */}
                {error && (
                  <div className="p-4 bg-red-900/30 border border-red-500/30 rounded text-red-400 font-mono">
                    ERROR: {error}
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-900/30 border border-green-500/30 rounded text-green-400 font-mono">
                    SUCCESS: {success}
                  </div>
                )}

                {/* Users Statistics Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="glass-card rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{allUsers.length}</div>
                    <div className="text-sm text-cyan-400 font-mono">TOTAL USERS</div>
                  </div>
                  <div className="glass-card rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {allUsers.filter(u => u.is_active !== false).length}
                    </div>
                    <div className="text-sm text-cyan-400 font-mono">ACTIVE USERS</div>
                  </div>
                  <div className="glass-card rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-cyan-400">
                      {allUsers.filter(u => u.biometric_enrolled).length}
                    </div>
                    <div className="text-sm text-cyan-400 font-mono">BIOMETRIC ENROLLED</div>
                  </div>
                  <div className="glass-card rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400">
                      {allUsers.filter(u => u.role === 'admin').length}
                    </div>
                    <div className="text-sm text-cyan-400 font-mono">ADMIN USERS</div>
                  </div>
                </div>

                {/* Users Table */}
                <div className="glass-card rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-black/30 border-b border-green-500/30">
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">USER</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">EMAIL</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">ROLE</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">STATUS</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">TRUST_SCORE</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">BIOMETRIC</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">LAST LOGIN</th>
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
                                  LOADING USER_DATA...
                                </div>
                              ) : (
                                searchTerm ? 'NO_MATCHING_USERS_FOUND' : 'NO_USERS_IN_DATABASE'
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => (
                            <tr key={user.id} className="border-b border-green-500/10 hover:bg-green-900/10">
                              {/* User Info Column */}
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                                      {user.username?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-white">{user.username || 'N/A'}</div>
                                    <div className="text-xs text-gray-400">
                                      Created: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Email Column */}
                              <td className="px-4 py-3">
                                <div className="text-white text-sm">{user.email}</div>
                              </td>

                              {/* Role Column */}
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${getRoleColor(user.role)}`}>
                                  {user.role?.toUpperCase() || 'USER'}
                                </span>
                              </td>

                              {/* Status Column */}
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                  user.is_active !== false 
                                    ? 'text-green-400 bg-green-900/30 border-green-500/30' 
                                    : 'text-red-400 bg-red-900/30 border-red-500/30'
                                }`}>
                                  {user.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </td>

                              {/* Trust Score Column */}
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="w-16 bg-gray-700 rounded-full h-2.5 mr-2">
                                    <div 
                                      className={`h-2.5 rounded-full ${
                                        (user.trust_score || 85) >= 80 ? 'bg-green-400' :
                                        (user.trust_score || 85) >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                                      }`}
                                      style={{ width: `${user.trust_score || 85}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-sm font-bold ${
                                    (user.trust_score || 85) >= 80 ? 'text-green-400' :
                                    (user.trust_score || 85) >= 60 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {user.trust_score || 85}%
                                  </span>
                                </div>
                              </td>

                              {/* Biometric Column */}
                              <td className="px-4 py-3">
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center">
                                    {user.biometric_enrolled ? (
                                      <span className="text-green-400 flex items-center text-xs">
                                        <Shield className="h-3 w-3 mr-1" />
                                        FACE: ✓
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 flex items-center text-xs">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        FACE: ✗
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center">
                                    {user.behavioral_enrolled ? (
                                      <span className="text-green-400 flex items-center text-xs">
                                        <Activity className="h-3 w-3 mr-1" />
                                        BEHAV: ✓
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 flex items-center text-xs">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        BEHAV: ✗
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Last Login Column */}
                              <td className="px-4 py-3">
                                <div className="text-white text-sm">
                                  {user.last_login ? formatDate(user.last_login) : 'Never'}
                                </div>
                              </td>

                              {/* Actions Column */}
                              <td className="px-4 py-3">
                                <div className="flex flex-col space-y-1">
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => handleEditUser(user)}
                                      className="px-2 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded text-xs font-bold hover:bg-blue-600/30 transition-all duration-300 hover-glow flex items-center"
                                      title="Edit User"
                                    >
                                      <Edit className="h-3 w-3 mr-1" />
                                      EDIT
                                    </button>
                                    <button
                                      onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                      className={`px-2 py-1 rounded text-xs font-bold transition-all duration-300 hover-glow flex items-center ${
                                        user.is_active !== false 
                                          ? 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30' 
                                          : 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
                                      }`}
                                      title={user.is_active !== false ? 'Deactivate User' : 'Activate User'}
                                    >
                                      {user.is_active !== false ? (
                                        <>
                                          <UserX className="h-3 w-3 mr-1" />
                                          DEACTIVATE
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="h-3 w-3 mr-1" />
                                          ACTIVATE
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => {
                                        setSelectedUser(user);
                                        fetchUserBiometricData && fetchUserBiometricData(user.id);
                                      }}
                                      className="px-2 py-1 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 rounded text-xs font-bold hover:bg-cyan-600/30 transition-all duration-300 hover-glow flex items-center"
                                      title="View Details"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      DETAILS
                                    </button>
                                    <button
                                      onClick={() => handleResetBiometric(user.id)}
                                      className="px-2 py-1 bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 rounded text-xs font-bold hover:bg-yellow-600/30 transition-all duration-300 hover-glow flex items-center"
                                      title="Reset Biometric"
                                    >
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      RESET
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination (if needed) */}
                {filteredUsers.length > 0 && (
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-400 font-mono">
                      Showing {filteredUsers.length} of {allUsers.length} users
                    </div>
                    <div className="text-sm text-cyan-400 font-mono">
                      Last updated: {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Edit User Modal - Add this OUTSIDE the users tab but inside your component */}
            {editingUser && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card rounded-lg p-6 w-full max-w-md mx-4 border border-green-500/30"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-green-400 font-mono">EDIT_USER</h3>
                    <button
                      onClick={() => setEditingUser(null)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-cyan-400 font-mono mb-2 text-sm">USERNAME</label>
                      <input
                        type="text"
                        value={editingUser.username}
                        onChange={(e) => setEditingUser(prev => prev ? {...prev, username: e.target.value} : null)}
                        className="w-full px-4 py-3 bg-black/30 border border-cyan-500/30 rounded text-white focus:border-cyan-400 transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-cyan-400 font-mono mb-2 text-sm">EMAIL</label>
                      <input
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser(prev => prev ? {...prev, email: e.target.value} : null)}
                        className="w-full px-4 py-3 bg-black/30 border border-cyan-500/30 rounded text-white focus:border-cyan-400 transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-cyan-400 font-mono mb-2 text-sm">ROLE</label>
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser(prev => prev ? {...prev, role: e.target.value} : null)}
                        className="w-full px-4 py-3 bg-black/30 border border-cyan-500/30 rounded text-white focus:border-cyan-400 transition-colors font-mono"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-cyan-400 font-mono mb-2 text-sm">TRUST_SCORE</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingUser.trust_score}
                        onChange={(e) => setEditingUser(prev => prev ? {...prev, trust_score: parseInt(e.target.value) || 0} : null)}
                        className="w-full px-4 py-3 bg-black/30 border border-cyan-500/30 rounded text-white focus:border-cyan-400 transition-colors font-mono"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={editingUser.is_active}
                        onChange={(e) => setEditingUser(prev => prev ? {...prev, is_active: e.target.checked} : null)}
                        className="rounded border-cyan-500/30 bg-black/30 text-cyan-400"
                      />
                      <label htmlFor="is_active" className="text-cyan-400 font-mono text-sm">
                        ACCOUNT_ACTIVE
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-4 mt-6">
                    <button
                      onClick={handleUpdateUser}
                      disabled={updating}
                      className="flex-1 py-3 px-6 bg-green-600/20 text-green-400 border border-green-500/30 rounded font-bold hover:bg-green-600/30 transition-all duration-300 disabled:opacity-50 font-mono"
                    >
                      {updating ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-2 inline animate-spin" />
                          UPDATING...
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5 mr-2 inline" />
                          UPDATE_USER
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setEditingUser(null)}
                      className="px-6 py-3 bg-gray-600/20 text-gray-400 border border-gray-500/30 rounded font-bold hover:bg-gray-600/30 transition-all duration-300 font-mono"
                    >
                      CANCEL
                    </button>
                  </div>

                  {/* Biometric Re-enrollment Notice */}
                  <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm font-mono">
                      ℹ️ BIOMETRIC_RE_ENROLLMENT_REQUIRED?
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      If user needs biometric or behavioral pattern updates, they should contact administrator
                    </p>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Enhanced Biometrics Tab */}
            {activeTab === 'biometrics' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <Eye className="mr-3 h-6 w-6" />
                  BIOMETRIC ANALYTICS
                </h2>
                      <button 
        onClick={() => exportLogsToPDF('biometrics', behavioralSessions)}
        className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
      >
        <FileText className="h-4 w-4" />
        Export Biometrics
      </button>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <Database className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-400">{stats.totalBiometricCaptures}</p>
                    <p className="text-sm text-cyan-400 font-mono">TOTAL CAPTURES</p>
                  </div>
                  <div className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <Eye className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">{(stats.averageQualityScore * 100).toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400 font-mono">AVG QUALITY</p>
                  </div>
                  <div className="text-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <Shield className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-400">{(stats.averageLivenessScore * 100).toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400 font-mono">AVG LIVENESS</p>
                  </div>
                  <div className="text-center p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                    <TrendingUp className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-orange-400">{behavioralSessions.length}</p>
                    <p className="text-sm text-cyan-400 font-mono">BEHAVIORAL SESSIONS</p>
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

{/* Enhanced Anomalies Tab - FIXED */}
            {activeTab === 'anomalies' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                    <AlertTriangle className="mr-3 h-6 w-6" />
                    BEHAVIORAL ANOMALIES ({filteredAnomalies.length})
                  </h2>
                  <button 
                    onClick={() => exportLogsToPDF('anomaly', anomalies)}
                    className="flex items-center gap-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </button>
                </div>

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
                            <th className="px-4 py-3 text-left text-sm font-bold text-green-400 font-mono">ANOMALY TYPE</th>
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
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-cyan-400">Login Activity</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => exportLogsToPDF('login', loginLogs)}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                    >
                      <FileText className="h-4 w-4" />
                      Export PDF
                    </button>
                  </div>
                </div>

                {/* Login Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-400">{stats.successfulLogins}</p>
                    <p className="text-sm text-cyan-400 font-mono">SUCCESSFUL LOGINS</p>
                  </div>
                  <div className="text-center p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-400">{stats.failedLogins}</p>
                    <p className="text-sm text-cyan-400 font-mono">FAILED ATTEMPTS</p>
                  </div>
                  <div className="text-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <BarChart3 className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-400">{(stats.successRate * 100).toFixed(1)}%</p>
                    <p className="text-sm text-cyan-400 font-mono">SUCCESS RATE</p>
                  </div>
                  <div className="text-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <Activity className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-400">{stats.totalLoginAttempts}</p>
                    <p className="text-sm text-cyan-400 font-mono">TOTAL ATTEMPTS</p>
                  </div>
                </div>

                {loginLogs.length === 0 ? (
                  <div className="text-center p-8 glass-card rounded-lg">
                    <Clock className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                    <p className="text-cyan-400 font-mono">NO LOGIN ACTIVITY RECORDED</p>
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
                              {log.success ? 'SUCCESSFUL LOGIN' : 'FAILED ATTEMPT'}
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
                  IC DOCUMENT VERIFICATION ({ekycDocuments.filter(doc => doc.document_type === 'ic_front').length})
                </h2>

                {ekycDocuments.filter(doc => doc.document_type === 'ic_front').length === 0 ? (
                  <div className="text-center p-8 glass-card rounded-lg">
                    <FileText className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                    <p className="text-cyan-400 font-mono">NO IC DOCUMENTS SUBMITTED</p>
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
                                <span className="font-bold text-blue-400 font-mono">IC UPLOAD</span>
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
                                    <p className="text-gray-400 text-xs mb-2 font-mono">FRONT IMAGE</p>
                                    {frontDoc.id_document_url ? (
                                      <img
                                        src={frontDoc.id_document_url}
                                        alt="IC Front"
                                        className="w-full h-32 object-cover rounded border border-green-400/30 cursor-pointer hover:border-green-400 transition-all duration-300"
                                        onClick={() => window.open(frontDoc.id_document_url, '_blank')}
                                      />
                                    ) : (
                                      <div className="w-full h-32 bg-gray-800 rounded border border-gray-600 flex items-center justify-center">
                                        <span className="text-gray-500 text-xs">NO IMAGE</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Back Image */}
                                  <div className="text-center">
                                    <p className="text-gray-400 text-xs mb-2 font-mono">BACK IMAGE</p>
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
                                      FRONT
                                    </button>
                                  )}
                                  {backDoc?.id_document_url && (
                                    <button
                                      onClick={() => window.open(backDoc.id_document_url, '_blank')}
                                      className="px-2 py-1 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded text-xs font-bold hover:bg-purple-600/30 transition-all duration-300"
                                    >
                                      BACK
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