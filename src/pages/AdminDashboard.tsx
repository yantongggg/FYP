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
  Settings,
  User,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Camera
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
}

const AdminDashboard: React.FC = () => {
  const { userData } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userBiometricData, setUserBiometricData] = useState<BiometricEvent[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
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
    anomalyCount: 0
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

  // Check if user is admin
  useEffect(() => {
    if (userData?.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }
    loadAdminData();
  }, [userData]);

  const loadAdminData = async () => {
    if (userData?.role !== 'admin') {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load users with Supabase
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });
      
      if (usersData) {
        setUsers(usersData);
        
        // Calculate stats from users data
        const calculatedStats: DashboardStats = {
          totalUsers: usersData.length,
          activeUsers: usersData.filter((u: any) => u.status === 'active').length,
          enrolledUsers: usersData.filter((u: any) => u.is_biometric_enrolled).length,
          suspendedUsers: usersData.filter((u: any) => u.status === 'suspended').length,
          totalBiometricCaptures: usersData.reduce((sum: number, u: any) => sum + (u.total_biometric_records || 0), 0),
          averageQualityScore: usersData.length > 0 ? 
            usersData.reduce((sum: number, u: any) => sum + (u.avg_quality_score || 0), 0) / usersData.length : 0,
          averageLivenessScore: usersData.length > 0 ? 
            usersData.reduce((sum: number, u: any) => sum + (u.avg_liveness_score || 0), 0) / usersData.length : 0,
          successRate: usersData.length > 0 ? 
            usersData.reduce((sum: number, u: any) => sum + (u.validation_success_rate || 0), 0) / usersData.length : 0,
          anomalyCount: usersData.reduce((sum: number, u: any) => sum + (u.unresolved_anomalies || 0), 0)
        };
        
        setStats(calculatedStats);
      }

      // Load anomalies
      const { data: anomalyData } = await supabase
        .from('anomaly_audit')
        .select('*, users!anomaly_audit_user_id_fkey(username, email)')
        .order('event_ts', { ascending: false })
        .limit(50);
      
      if (anomalyData) {
        setAnomalies(anomalyData);
      }

      // Load login logs
      const { data: logsData } = await supabase
        .from('login_audit')
        .select('*, users(username, email)')
        .order('event_ts', { ascending: false })
        .limit(50);
      
      if (logsData) {
        setLoginLogs(logsData);
      }

      // Load eKYC documents
      const { data: ekycData } = await supabase
        .from('ekyc_documents')
        .select('*, users(username, email)')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (ekycData) {
        setEkycDocuments(ekycData);
      }

      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
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

  const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; trend?: string }> = 
    ({ title, value, icon, color, trend }) => (
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
                {((selectedUser.avg_quality_score || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg">
              <h3 className="font-bold text-green-400 mb-2">LIVENESS_SCORE</h3>
              <p className="text-2xl font-bold text-green-400">
                {((selectedUser.avg_liveness_score || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
              <h3 className="font-bold text-purple-400 mb-2">SUCCESS_RATE</h3>
              <p className="text-2xl font-bold text-purple-400">
                {((selectedUser.validation_success_rate || 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-green-400 mb-4">RECENT_FACE_DETECTION_EVENTS</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-black/30 border-b border-green-500/30">
                    <th className="px-4 py-2 text-left text-xs font-bold text-green-400 font-mono">DATE</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-green-400 font-mono">BLINKS</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-green-400 font-mono">MOUTH</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-green-400 font-mono">HEAD</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-green-400 font-mono">FACES</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-green-400 font-mono">QUALITY</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-green-400 font-mono">SPOOF</th>
                  </tr>
                </thead>
                <tbody>
                  {userBiometricData.slice(0, 10).map((event) => (
                    <tr key={event.id} className="border-b border-green-500/10 hover:bg-green-900/10">
                      <td className="px-4 py-2 text-sm text-white font-mono">
                        {formatDate(event.created_at)}
                      </td>
                      <td className="px-4 py-2 text-sm text-white">{event.blink_count}</td>
                      <td className="px-4 py-2 text-sm text-white">{event.mouth_open_count}</td>
                      <td className="px-4 py-2 text-sm text-white">{event.head_movement_count}</td>
                      <td className="px-4 py-2 text-sm text-white">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded border ${
                          event.face_count === 1 ? 'text-green-400 bg-green-600/20 border-green-500/30' : 'text-red-400 bg-red-600/20 border-red-500/30'
                        }`}>
                          {event.face_count}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-white">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-700 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                event.image_quality >= 0.8 ? 'bg-green-400' :
                                event.image_quality >= 0.6 ? 'bg-yellow-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${event.image_quality * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{(event.image_quality * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-white">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-700 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                event.spoofing_score >= 0.7 ? 'bg-green-400' :
                                event.spoofing_score >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${event.spoofing_score * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{(event.spoofing_score * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          <h1 className="text-4xl font-bold text-green-400 mb-2 glitch-text">ADMIN_CONTROL_PANEL</h1>
          <p className="text-cyan-400 font-mono">SYSTEM_MONITORING // USER_MANAGEMENT // SECURITY_CONTROLS</p>
        </motion.div>

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
            value={`${((stats.enrolledUsers / (stats.totalUsers || 1)) * 100).toFixed(1)}%`}
            icon={<Shield className="h-6 w-6 text-blue-400" />}
            color="from-green-500 to-green-600"
            trend={`${stats.enrolledUsers} OF ${stats.totalUsers} USERS`}
          />
          <StatCard
            title="SUCCESS_RATE"
            value={`${(stats.successRate * 100).toFixed(1)}%`}
            icon={<TrendingUp className="h-6 w-6 text-purple-400" />}
            color="from-purple-500 to-purple-600"
            trend="LAST 30 DAYS"
          />
          <StatCard
            title="ANOMALIES"
            value={stats.anomalyCount}
            icon={<AlertTriangle className="h-6 w-6 text-yellow-400" />}
            color="from-red-500 to-red-600"
            trend="UNRESOLVED"
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
                        <span className="text-cyan-400 font-mono">AVG_LIVENESS_SCORE</span>
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-700 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-400 h-2 rounded-full"
                              style={{ width: `${stats.averageLivenessScore * 100}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-blue-400">{(stats.averageLivenessScore * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">TOTAL_CAPTURES</span>
                        <span className="font-bold text-green-400">{stats.totalBiometricCaptures.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card rounded-lg p-6">
                    <h3 className="text-lg font-bold text-green-400 mb-4">USER_STATUS_DISTRIBUTION</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">ACTIVE_USERS</span>
                        <span className="bg-green-600/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.activeUsers}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">SUSPENDED_USERS</span>
                        <span className="bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.suspendedUsers}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cyan-400 font-mono">PENDING_USERS</span>
                        <span className="bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded text-sm font-bold">
                          {stats.totalUsers - stats.activeUsers - stats.suspendedUsers}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {activeTab === 'biometrics' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <Eye className="mr-3 h-6 w-6" />
                  BIOMETRIC_ANALYTICS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                </div>
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <AlertTriangle className="mr-3 h-6 w-6" />
                  SECURITY_ANOMALIES
                </h2>

                {anomalies.length === 0 ? (
                  <div className="text-center p-8 glass-card rounded-lg">
                    <Shield className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="text-green-400 font-mono">NO_SECURITY_ANOMALIES_DETECTED</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {anomalies.map((anomaly) => (
                      <motion.div
                        key={anomaly.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-400" />
                            <span className="font-bold text-yellow-400 font-mono">
                              {anomaly.anomaly_type.toUpperCase().replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center text-cyan-400 text-sm">
                            <Clock className="h-4 w-4 mr-1" />
                            {formatDate(anomaly.event_ts)}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <div className="flex items-center text-gray-400 text-sm mb-1">
                              <User className="h-4 w-4 mr-1" />
                              User: {anomaly.users?.username || 'Unknown'}
                            </div>
                            <div className="flex items-center text-gray-400 text-sm">
                              <Activity className="h-4 w-4 mr-1" />
                              Score: <span className="ml-1 text-yellow-400 font-bold">{(anomaly.score * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center text-gray-400 text-sm mb-1">
                              <Shield className="h-4 w-4 mr-1" />
                              Action: <span className={`ml-1 ${
                                anomaly.action === 'blocked' ? 'text-red-400' : 
                                anomaly.action === 'flagged' ? 'text-yellow-400' : 'text-blue-400'
                              } font-bold`}>
                                {anomaly.action.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center text-gray-400 text-sm">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Status: <span className={`ml-1 ${
                                anomaly.resolved ? 'text-green-400' : 'text-yellow-400'
                              } font-bold`}>
                                {anomaly.resolved ? 'RESOLVED' : 'OPEN'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logins' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <Activity className="mr-3 h-6 w-6" />
                  AUTHENTICATION_LOGS
                </h2>

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
                        className="glass-card rounded-lg p-4"
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
                              User: {log.users?.username || log.users?.email || 'Unknown'}
                            </div>
                            <div className="flex items-center text-gray-400 text-sm">
                              <Database className="h-4 w-4 mr-1" />
                              IP: {log.ip_addr || 'Unknown'}
                            </div>
                          </div>

                          {log.biometric_scores && (
                            <div className="grid grid-cols-2 gap-2">
                              {log.biometric_scores.face !== undefined && (
                                <div className="flex items-center">
                                  <Eye className="h-4 w-4 mr-1" />
                                  <span className="text-gray-400 text-sm mr-1">Face:</span>
                                  <span className={`text-sm font-bold ${
                                    log.biometric_scores.face >= 0.8 ? 'text-green-400' : 
                                    log.biometric_scores.face >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {(log.biometric_scores.face * 100).toFixed(0)}%
                                  </span>
                                </div>
                              )}
                              {log.biometric_scores.liveness !== undefined && (
                                <div className="flex items-center">
                                  <Shield className="h-4 w-4 mr-1" />
                                  <span className="text-gray-400 text-sm mr-1">Liveness:</span>
                                  <span className={`text-sm font-bold ${
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
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ekyc' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                  <FileText className="mr-3 h-6 w-6" />
                  eKYC_DOCUMENT_VERIFICATION
                </h2>

                {ekycDocuments.length === 0 ? (
                  <div className="text-center p-8 glass-card rounded-lg">
                    <FileText className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                    <p className="text-cyan-400 font-mono">NO_eKYC_DOCUMENTS_SUBMITTED</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ekycDocuments.map((doc) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 mr-2 text-blue-400" />
                            <span className="font-bold text-blue-400 font-mono">
                              {doc.document_type.toUpperCase().replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${
                              doc.verification_status === 'verified' ? 'text-green-400 bg-green-600/20 border-green-500/30' :
                              doc.verification_status === 'rejected' ? 'text-red-400 bg-red-600/20 border-red-500/30' :
                              'text-yellow-400 bg-yellow-600/20 border-yellow-500/30'
                            }`}>
                              {doc.verification_status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <div className="flex items-center text-gray-400 text-sm mb-1">
                              <User className="h-4 w-4 mr-1" />
                              User: {doc.users?.username || doc.users?.email || 'Unknown'}
                            </div>
                            <div className="flex items-center text-gray-400 text-sm">
                              <Clock className="h-4 w-4 mr-1" />
                              Submitted: {formatDate(doc.created_at)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center text-gray-400 text-sm mb-1">
                              <Eye className="h-4 w-4 mr-1" />
                              Face Match: <span className={`ml-1 ${
                                (doc.face_match_score || 0) >= 0.8 ? 'text-green-400' : 
                                (doc.face_match_score || 0) >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                              } font-bold`}>
                                {((doc.face_match_score || 0) * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex items-center text-gray-400 text-sm">
                              <Shield className="h-4 w-4 mr-1" />
                              Authenticity: <span className={`ml-1 ${
                                (doc.document_authenticity_score || 0) >= 0.8 ? 'text-green-400' : 
                                (doc.document_authenticity_score || 0) >= 0.6 ? 'text-yellow-400' : 'text-red-400'
                              } font-bold`}>
                                {((doc.document_authenticity_score || 0) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
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