import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Clock, 
  Shield, 
  Activity, 
  Calendar, 
  MapPin, 
  Smartphone, 
  Info,
  CheckCircle,
  XCircle,
  Eye,
  Keyboard,
  MousePointer,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface LoginLog {
  id: string;
  event_ts: string;
  success: boolean;
  ip_addr?: string;
  user_agent?: string;
  biometric_scores?: {
    face?: number;
    keystroke?: number;
    mouse?: number;
    liveness?: number;
  };
  geolocation?: {
    country?: string;
    city?: string;
  };
}

interface Anomaly {
  id: string;
  event_ts: string;
  anomaly_type: string;
  score: number;
  action: string;
  details?: any;
  resolved: boolean;
}

interface TrustScoreData {
  date: string;
  score: number;
}

const MyAnomalies = () => {
  const { userData } = useAuth();
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [trustScoreHistory, setTrustScoreHistory] = useState<TrustScoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logins');

  useEffect(() => {
    if (userData?.uid) {
      loadUserData();
    }
  }, [userData]);

  const isDemoUser = (userId: string) => {
    return userId === 'user-demo' || userId === 'admin-demo' || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  };

  const generateMockLoginLogs = (): LoginLog[] => {
    const mockLogs: LoginLog[] = [];
    const now = new Date();
    
    for (let i = 0; i < 8; i++) {
      const date = new Date(now);
      date.setHours(now.getHours() - i * 3);
      
      mockLogs.push({
        id: `mock-login-${i}`,
        event_ts: date.toISOString(),
        success: Math.random() > 0.2, // 80% success rate
        ip_addr: `192.168.1.${100 + i}`,
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        biometric_scores: {
          face: 0.85 + Math.random() * 0.1,
          keystroke: 0.78 + Math.random() * 0.15,
          mouse: 0.82 + Math.random() * 0.12,
          liveness: 0.91 + Math.random() * 0.08
        },
        geolocation: {
          country: 'United States',
          city: 'San Francisco'
        }
      });
    }
    
    return mockLogs;
  };

  const generateMockAnomalies = (): Anomaly[] => {
    const mockAnomalies: Anomaly[] = [];
    const now = new Date();
    const anomalyTypes = ['unusual_location', 'device_change', 'behavior_pattern', 'time_anomaly'];
    const actions = ['flagged', 'blocked', 'monitored', 'verified'];
    
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i * 2);
      
      mockAnomalies.push({
        id: `mock-anomaly-${i}`,
        event_ts: date.toISOString(),
        anomaly_type: anomalyTypes[i % anomalyTypes.length],
        score: 0.2 + Math.random() * 0.6,
        action: actions[i % actions.length],
        details: {
          description: `Anomaly detected in ${anomalyTypes[i % anomalyTypes.length].replace('_', ' ')}`,
          confidence: Math.random() * 0.5 + 0.5
        },
        resolved: Math.random() > 0.5
      });
    }
    
    return mockAnomalies;
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Check if this is a demo user
      if (isDemoUser(userData?.uid || '')) {
        // Use mock data for demo users
        setLoginLogs(generateMockLoginLogs());
        setAnomalies(generateMockAnomalies());
        generateMockTrustScoreHistory();
      } else {
        // Load real data for actual users
        // Load login logs
        const { data: logs } = await supabase
          .from('login_audit')
          .select('*')
          .eq('user_id', userData?.uid)
          .order('event_ts', { ascending: false })
          .limit(20);
        
        if (logs) {
          setLoginLogs(logs);
        }

        // Load anomalies
        const { data: anomalyData } = await supabase
          .from('anomaly_audit')
          .select('*')
          .eq('user_id', userData?.uid)
          .order('event_ts', { ascending: false })
          .limit(20);
        
        if (anomalyData) {
          setAnomalies(anomalyData);
        }

        // Generate mock trust score history (in a real app, this would come from the database)
        generateMockTrustScoreHistory();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockTrustScoreHistory = () => {
    const today = new Date();
    const data: TrustScoreData[] = [];
    
    // Generate 30 days of data
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      
      // Start with base score (user's current trust score or 90)
      let baseScore = userData?.trust_score || 90;
      
      // Add some random variation
      const variation = Math.random() * 10 - 5; // -5 to +5
      let score = baseScore + variation;
      
      // Ensure score is between 0 and 100
      score = Math.max(0, Math.min(100, score));
      
      data.push({
        date: date.toISOString().split('T')[0],
        score: parseFloat(score.toFixed(1))
      });
    }
    
    setTrustScoreHistory(data);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getBiometricScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAnomalyScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-red-400';
    if (score >= 0.5) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const renderLoginLogs = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
        <Activity className="mr-3 h-6 w-6" />
        RECENT_AUTHENTICATION_ATTEMPTS
      </h2>

      {loginLogs.length === 0 ? (
        <div className="text-center p-8 glass-card rounded-lg">
          <Clock className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
          <p className="text-cyan-400 font-mono">No login activity recorded yet</p>
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
                  <span className={`font-bold ${log.success ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: 'IBM Plex Mono' }}>
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
                    <Smartphone className="h-4 w-4 mr-1" />
                    {log.user_agent?.split(' ')[0] || 'Unknown Device'}
                  </div>
                  {log.ip_addr && (
                    <div className="flex items-center text-gray-400 text-sm">
                      <MapPin className="h-4 w-4 mr-1" />
                      {log.ip_addr} {log.geolocation?.country ? `(${log.geolocation.country})` : ''}
                    </div>
                  )}
                </div>

                {log.biometric_scores && (
                  <div className="grid grid-cols-2 gap-2">
                    {log.biometric_scores.face !== undefined && (
                      <div className="flex items-center">
                        <Eye className="h-4 w-4 mr-1" />
                        <span className="text-gray-400 text-sm mr-1">Face:</span>
                        <span className={`text-sm font-bold ${getBiometricScoreColor(log.biometric_scores.face)}`}>
                          {(log.biometric_scores.face * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {log.biometric_scores.liveness !== undefined && (
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-1" />
                        <span className="text-gray-400 text-sm mr-1">Liveness:</span>
                        <span className={`text-sm font-bold ${getBiometricScoreColor(log.biometric_scores.liveness)}`}>
                          {(log.biometric_scores.liveness * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {log.biometric_scores.keystroke !== undefined && (
                      <div className="flex items-center">
                        <Keyboard className="h-4 w-4 mr-1" />
                        <span className="text-gray-400 text-sm mr-1">Keystroke:</span>
                        <span className={`text-sm font-bold ${getBiometricScoreColor(log.biometric_scores.keystroke)}`}>
                          {(log.biometric_scores.keystroke * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {log.biometric_scores.mouse !== undefined && (
                      <div className="flex items-center">
                        <MousePointer className="h-4 w-4 mr-1" />
                        <span className="text-gray-400 text-sm mr-1">Mouse:</span>
                        <span className={`text-sm font-bold ${getBiometricScoreColor(log.biometric_scores.mouse)}`}>
                          {(log.biometric_scores.mouse * 100).toFixed(0)}%
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
  );

  const renderAnomalies = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
        <AlertTriangle className="mr-3 h-6 w-6" />
        SECURITY_ANOMALIES
      </h2>

      {anomalies.length === 0 ? (
        <div className="text-center p-8 glass-card rounded-lg">
          <Shield className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <p className="text-green-400 font-mono">No security anomalies detected</p>
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
                  <AlertTriangle className={`h-5 w-5 mr-2 ${getAnomalyScoreColor(anomaly.score)}`} />
                  <span className={`font-bold ${getAnomalyScoreColor(anomaly.score)}`} style={{ fontFamily: 'IBM Plex Mono' }}>
                    {anomaly.anomaly_type.toUpperCase().replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center text-cyan-400 text-sm">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatDate(anomaly.event_ts)}
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-center mb-1">
                  <Info className="h-4 w-4 mr-1 text-gray-400" />
                  <span className="text-gray-400 text-sm mr-1">Severity:</span>
                  <span className={`text-sm font-bold ${getAnomalyScoreColor(anomaly.score)}`}>
                    {anomaly.score >= 0.8 ? 'HIGH' : anomaly.score >= 0.5 ? 'MEDIUM' : 'LOW'}
                    ({(anomaly.score * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-1 text-gray-400" />
                  <span className="text-gray-400 text-sm mr-1">Action:</span>
                  <span className="text-cyan-400 text-sm font-bold">
                    {anomaly.action.toUpperCase()}
                  </span>
                </div>
              </div>

              {anomaly.details && (
                <div className="mt-2 p-2 bg-black/30 rounded text-xs text-gray-400">
                  <pre className="whitespace-pre-wrap font-mono">
                    {JSON.stringify(anomaly.details, null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTrustScore = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center">
        <BarChart3 className="mr-3 h-6 w-6" />
        TRUST_SCORE_HISTORY
      </h2>

      <div className="glass-card rounded-lg p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-gray-400 text-sm">Current Trust Score:</span>
            <div className="text-3xl font-bold text-green-400">{userData?.trust_score || 95}%</div>
          </div>
          <div className={`px-3 py-1 rounded text-xs font-bold ${
            (userData?.trust_score || 95) >= 90 ? 'bg-green-600/20 text-green-400 border border-green-500/30' :
            (userData?.trust_score || 95) >= 70 ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30' :
            'bg-red-600/20 text-red-400 border border-red-500/30'
          }`}>
            {(userData?.trust_score || 95) >= 90 ? 'EXCELLENT' :
             (userData?.trust_score || 95) >= 70 ? 'GOOD' : 'NEEDS ATTENTION'}
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trustScoreHistory}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(160, 255, 160, 0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="#A0FFA0" 
                tick={{ fill: '#A0FFA0' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="#A0FFA0" 
                tick={{ fill: '#A0FFA0' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  border: '1px solid rgba(160, 255, 160, 0.3)',
                  color: '#A0FFA0'
                }}
                labelStyle={{ color: '#A0FFA0' }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#A0FFA0" 
                strokeWidth={2}
                dot={{ fill: '#A0FFA0', r: 4 }}
                activeDot={{ fill: '#00FFD1', r: 6, stroke: '#A0FFA0', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-gray-400 text-sm">30-Day Average</div>
            <div className="text-cyan-400 font-bold">
              {(trustScoreHistory.reduce((sum, item) => sum + item.score, 0) / trustScoreHistory.length).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Highest Score</div>
            <div className="text-green-400 font-bold">
              {Math.max(...trustScoreHistory.map(item => item.score)).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Lowest Score</div>
            <div className="text-yellow-400 font-bold">
              {Math.min(...trustScoreHistory.map(item => item.score)).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-lg p-4">
        <h3 className="text-lg font-bold text-cyan-400 mb-3">TRUST_SCORE_FACTORS</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
              <span className="text-gray-400">Successful logins</span>
            </div>
            <span className="text-green-400">+5 points</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-gray-400">Failed login attempts</span>
            </div>
            <span className="text-red-400">-5 points each</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
              <span className="text-gray-400">Security anomalies</span>
            </div>
            <span className="text-yellow-400">-10 points each</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-blue-400 mr-2" />
              <span className="text-gray-400">Account age (1+ year)</span>
            </div>
            <span className="text-blue-400">+5 points</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-green-400 font-mono">LOADING_DATA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-green-400 mb-2 glitch-text">SECURITY_MONITORING</h1>
          <p className="text-cyan-400 font-mono">AUTHENTICATION_LOGS // ANOMALY_DETECTION // TRUST_SCORE</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-400 text-sm font-mono">TRUST_SCORE</p>
                <p className="text-3xl font-bold text-green-400 neon-glow">{userData?.trust_score || 95}%</p>
                <p className="text-green-400 text-sm font-mono">EXCELLENT</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-900/30 flex items-center justify-center">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-400 text-sm font-mono">RECENT_LOGINS</p>
                <p className="text-3xl font-bold text-green-400 neon-glow">{loginLogs.length}</p>
                <p className="text-green-400 text-sm font-mono">
                  {loginLogs.filter(log => log.success).length} SUCCESSFUL
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-900/30 flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-lg p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-400 text-sm font-mono">ANOMALIES</p>
                <p className="text-3xl font-bold text-yellow-400 neon-glow">{anomalies.length}</p>
                <p className="text-yellow-400 text-sm font-mono">
                  {anomalies.filter(a => !a.resolved).length} UNRESOLVED
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-900/30 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-400" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-lg"
        >
          <div className="border-b border-green-500/30">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('logins')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-bold text-sm transition-all duration-300 font-mono ${
                  activeTab === 'logins'
                    ? 'border-green-500 text-green-400 neon-glow'
                    : 'border-transparent text-cyan-400 hover:text-green-400'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>LOGINS</span>
              </button>
              
              <button
                onClick={() => setActiveTab('anomalies')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-bold text-sm transition-all duration-300 font-mono ${
                  activeTab === 'anomalies'
                    ? 'border-green-500 text-green-400 neon-glow'
                    : 'border-transparent text-cyan-400 hover:text-green-400'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>ANOMALIES</span>
              </button>
              
              <button
                onClick={() => setActiveTab('trust')}
                className={`flex items-center space-x-2 py-4 border-b-2 font-bold text-sm transition-all duration-300 font-mono ${
                  activeTab === 'trust'
                    ? 'border-green-500 text-green-400 neon-glow'
                    : 'border-transparent text-cyan-400 hover:text-green-400'
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>TRUST_SCORE</span>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'logins' && renderLoginLogs()}
            {activeTab === 'anomalies' && renderAnomalies()}
            {activeTab === 'trust' && renderTrustScore()}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MyAnomalies;