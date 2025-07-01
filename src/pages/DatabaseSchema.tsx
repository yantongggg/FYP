import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  Key, 
  Link, 
  Shield, 
  Clock, 
  User, 
  Activity, 
  AlertTriangle,
  FileText,
  Hash,
  Calendar,
  MapPin,
  Smartphone
} from 'lucide-react';

const DatabaseSchema = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const tables = {
    users: {
      name: 'users',
      description: 'Core user information and account details',
      icon: User,
      color: 'text-blue-400',
      fields: [
        { name: 'id', type: 'UUID', primary: true, description: 'Unique user identifier' },
        { name: 'email', type: 'VARCHAR(255)', unique: true, description: 'User email address' },
        { name: 'full_name', type: 'VARCHAR(255)', description: 'Full name of the user' },
        { name: 'phone', type: 'VARCHAR(20)', description: 'Phone number' },
        { name: 'status', type: 'ENUM', description: 'Account status (active, suspended, pending)' },
        { name: 'trust_score', type: 'DECIMAL(5,2)', description: 'Dynamic trust score (0-100)' },
        { name: 'created_at', type: 'TIMESTAMP', description: 'Account creation timestamp' },
        { name: 'updated_at', type: 'TIMESTAMP', description: 'Last profile update' },
        { name: 'last_login', type: 'TIMESTAMP', description: 'Last successful login' }
      ]
    },
    biometric_profiles: {
      name: 'biometric_profiles',
      description: 'Encrypted biometric templates and embeddings',
      icon: Shield,
      color: 'text-green-400',
      fields: [
        { name: 'id', type: 'UUID', primary: true, description: 'Profile identifier' },
        { name: 'user_id', type: 'UUID', foreign: 'users.id', description: 'Reference to user' },
        { name: 'face_embedding', type: 'BYTEA', description: 'Encrypted facial feature vector' },
        { name: 'face_template_hash', type: 'VARCHAR(128)', description: 'Hash of face template' },
        { name: 'keystroke_pattern', type: 'JSONB', description: 'Encrypted keystroke dynamics' },
        { name: 'mouse_pattern', type: 'JSONB', description: 'Encrypted mouse behavior pattern' },
        { name: 'enrollment_quality', type: 'DECIMAL(5,2)', description: 'Template quality score' },
        { name: 'algorithm_version', type: 'VARCHAR(50)', description: 'Algorithm version used' },
        { name: 'created_at', type: 'TIMESTAMP', description: 'Template creation time' },
        { name: 'updated_at', type: 'TIMESTAMP', description: 'Last template update' }
      ]
    },
    authentication_logs: {
      name: 'authentication_logs',
      description: 'Detailed logs of all authentication attempts',
      icon: FileText,
      color: 'text-purple-400',
      fields: [
        { name: 'id', type: 'UUID', primary: true, description: 'Log entry identifier' },
        { name: 'user_id', type: 'UUID', foreign: 'users.id', description: 'User who attempted auth' },
        { name: 'session_id', type: 'VARCHAR(128)', description: 'Unique session identifier' },
        { name: 'auth_method', type: 'VARCHAR(50)', description: 'Authentication method used' },
        { name: 'face_match_score', type: 'DECIMAL(5,2)', description: 'Facial recognition confidence' },
        { name: 'liveness_score', type: 'DECIMAL(5,2)', description: 'Liveness detection score' },
        { name: 'keystroke_score', type: 'DECIMAL(5,2)', description: 'Keystroke pattern match' },
        { name: 'mouse_score', type: 'DECIMAL(5,2)', description: 'Mouse behavior match' },
        { name: 'overall_score', type: 'DECIMAL(5,2)', description: 'Combined authentication score' },
        { name: 'result', type: 'ENUM', description: 'Success, failure, or blocked' },
        { name: 'ip_address', type: 'INET', description: 'Client IP address' },
        { name: 'user_agent', type: 'TEXT', description: 'Browser/device information' },
        { name: 'geolocation', type: 'JSONB', description: 'Location data if available' },
        { name: 'timestamp', type: 'TIMESTAMP', description: 'Authentication attempt time' }
      ]
    },
    behavioral_sessions: {
      name: 'behavioral_sessions',
      description: 'Continuous behavioral monitoring during active sessions',
      icon: Activity,
      color: 'text-orange-400',
      fields: [
        { name: 'id', type: 'UUID', primary: true, description: 'Session identifier' },
        { name: 'user_id', type: 'UUID', foreign: 'users.id', description: 'User in session' },
        { name: 'session_start', type: 'TIMESTAMP', description: 'Session start time' },
        { name: 'session_end', type: 'TIMESTAMP', description: 'Session end time' },
        { name: 'keystroke_events', type: 'JSONB', description: 'Keystroke timing data' },
        { name: 'mouse_events', type: 'JSONB', description: 'Mouse movement data' },
        { name: 'anomaly_score', type: 'DECIMAL(5,2)', description: 'Behavioral anomaly score' },
        { name: 'device_fingerprint', type: 'VARCHAR(128)', description: 'Device identification hash' },
        { name: 'is_active', type: 'BOOLEAN', description: 'Whether session is active' },
        { name: 'risk_level', type: 'ENUM', description: 'Low, medium, high risk' }
      ]
    },
    security_anomalies: {
      name: 'security_anomalies',
      description: 'Detected security anomalies and suspicious activities',
      icon: AlertTriangle,
      color: 'text-red-400',
      fields: [
        { name: 'id', type: 'UUID', primary: true, description: 'Anomaly identifier' },
        { name: 'user_id', type: 'UUID', foreign: 'users.id', description: 'Affected user' },
        { name: 'session_id', type: 'UUID', foreign: 'behavioral_sessions.id', description: 'Related session' },
        { name: 'anomaly_type', type: 'VARCHAR(100)', description: 'Type of anomaly detected' },
        { name: 'severity', type: 'ENUM', description: 'Low, medium, high, critical' },
        { name: 'confidence', type: 'DECIMAL(5,2)', description: 'Detection confidence score' },
        { name: 'description', type: 'TEXT', description: 'Detailed anomaly description' },
        { name: 'raw_data', type: 'JSONB', description: 'Raw data that triggered anomaly' },
        { name: 'action_taken', type: 'VARCHAR(100)', description: 'Response action taken' },
        { name: 'resolved', type: 'BOOLEAN', description: 'Whether anomaly is resolved' },
        { name: 'false_positive', type: 'BOOLEAN', description: 'Marked as false positive' },
        { name: 'detected_at', type: 'TIMESTAMP', description: 'Anomaly detection time' },
        { name: 'resolved_at', type: 'TIMESTAMP', description: 'Resolution timestamp' }
      ]
    },
    admin_actions: {
      name: 'admin_actions',
      description: 'Audit trail of all administrative actions',
      icon: Key,
      color: 'text-yellow-400',
      fields: [
        { name: 'id', type: 'UUID', primary: true, description: 'Action identifier' },
        { name: 'admin_id', type: 'UUID', foreign: 'users.id', description: 'Admin who performed action' },
        { name: 'target_user_id', type: 'UUID', foreign: 'users.id', description: 'Target user if applicable' },
        { name: 'action_type', type: 'VARCHAR(100)', description: 'Type of action performed' },
        { name: 'description', type: 'TEXT', description: 'Detailed action description' },
        { name: 'ip_address', type: 'INET', description: 'Admin IP address' },
        { name: 'user_agent', type: 'TEXT', description: 'Admin browser/device info' },
        { name: 'timestamp', type: 'TIMESTAMP', description: 'Action timestamp' }
      ]
    }
  };

  const relationships = [
    { from: 'users', to: 'biometric_profiles', type: 'one-to-one', description: 'Each user has one biometric profile' },
    { from: 'users', to: 'authentication_logs', type: 'one-to-many', description: 'Users can have multiple auth attempts' },
    { from: 'users', to: 'behavioral_sessions', type: 'one-to-many', description: 'Users can have multiple sessions' },
    { from: 'behavioral_sessions', to: 'security_anomalies', type: 'one-to-many', description: 'Sessions can have multiple anomalies' },
    { from: 'users', to: 'admin_actions', type: 'one-to-many', description: 'Users can be targets of admin actions' }
  ];

  const getTypeColor = (type: string) => {
    if (type.includes('UUID')) return 'text-blue-400';
    if (type.includes('VARCHAR') || type.includes('TEXT')) return 'text-green-400';
    if (type.includes('TIMESTAMP')) return 'text-purple-400';
    if (type.includes('DECIMAL') || type.includes('BOOLEAN')) return 'text-yellow-400';
    if (type.includes('JSONB') || type.includes('BYTEA')) return 'text-pink-400';
    if (type.includes('ENUM')) return 'text-orange-400';
    return 'text-gray-400';
  };

  const TableCard = ({ tableKey, table }: { tableKey: string, table: any }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={() => setSelectedTable(selectedTable === tableKey ? null : tableKey)}
      className={`bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 cursor-pointer transition-all duration-300 ${
        selectedTable === tableKey ? 'ring-2 ring-blue-500 bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <table.icon className={`h-8 w-8 ${table.color}`} />
          <div>
            <h3 className="text-lg font-semibold text-white">{table.name}</h3>
            <p className="text-gray-400 text-sm">{table.description}</p>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full ${table.color.replace('text-', 'bg-')}`} />
      </div>

      {selectedTable === tableKey && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-4 border-t border-white/10"
        >
          <h4 className="text-sm font-medium text-blue-400 mb-3">Fields</h4>
          <div className="space-y-2">
            {table.fields.map((field: any) => (
              <div key={field.name} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {field.primary && <Key className="h-3 w-3 text-yellow-400" />}
                    {field.foreign && <Link className="h-3 w-3 text-blue-400" />}
                    {field.unique && <Hash className="h-3 w-3 text-green-400" />}
                  </div>
                  <span className="text-white font-mono text-sm">{field.name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono ${getTypeColor(field.type)}`}>
                    {field.type}
                  </span>
                  {field.description && (
                    <p className="text-gray-400 text-xs mt-1">{field.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent mb-4">
            Database Schema
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Comprehensive database design for secure biometric data storage and authentication logging
          </p>
        </motion.div>

        {/* Schema Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Database Tables</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(tables).map(([key, table]) => (
              <TableCard key={key} tableKey={key} table={table} />
            ))}
          </div>
        </motion.div>

        {/* Relationships */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Table Relationships</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <div className="space-y-4">
              {relationships.map((rel, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center space-x-4">
                    <div className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm font-mono">
                      {rel.from}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      <div className="w-8 h-0.5 bg-gray-400" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    </div>
                    <div className="px-3 py-1 bg-green-600/20 text-green-300 rounded-full text-sm font-mono">
                      {rel.to}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-purple-400 text-sm font-medium">{rel.type}</span>
                    <p className="text-gray-400 text-xs">{rel.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Security Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Security & Privacy Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Shield className="h-10 w-10 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Data Encryption</h3>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Biometric templates encrypted with AES-256</li>
                <li>• Field-level encryption for sensitive data</li>
                <li>• Encrypted database connections (TLS)</li>
                <li>• Key management with rotation policies</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Database className="h-10 w-10 text-green-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Access Control</h3>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Role-based database access</li>
                <li>• Row-level security policies</li>
                <li>• Audit logging for all operations</li>
                <li>• Principle of least privilege</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Clock className="h-10 w-10 text-purple-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Data Retention</h3>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Configurable data retention policies</li>
                <li>• Automatic archiving of old logs</li>
                <li>• Secure data deletion procedures</li>
                <li>• Compliance with privacy regulations</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Sample Queries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Sample Database Queries</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">User Authentication Query</h3>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                <div className="text-blue-400">SELECT</div>
                <div className="text-white ml-4">u.id, u.email, u.status, u.trust_score,</div>
                <div className="text-white ml-4">bp.face_embedding, bp.keystroke_pattern</div>
                <div className="text-purple-400">FROM</div>
                <div className="text-white ml-4">users u</div>
                <div className="text-purple-400">JOIN</div>
                <div className="text-white ml-4">biometric_profiles bp ON u.id = bp.user_id</div>
                <div className="text-purple-400">WHERE</div>
                <div className="text-white ml-4">u.email = $1 AND u.status = 'active';</div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Anomaly Detection Query</h3>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                <div className="text-blue-400">SELECT</div>
                <div className="text-white ml-4">sa.anomaly_type, sa.severity,</div>
                <div className="text-white ml-4">COUNT(*) as occurrence_count</div>
                <div className="text-purple-400">FROM</div>
                <div className="text-white ml-4">security_anomalies sa</div>
                <div className="text-purple-400">WHERE</div>
                <div className="text-white ml-4">sa.detected_at {'>'}= NOW() - INTERVAL '24 hours'</div>
                <div className="text-purple-400">GROUP BY</div>
                <div className="text-white ml-4">sa.anomaly_type, sa.severity</div>
                <div className="text-purple-400">ORDER BY</div>
                <div className="text-white ml-4">occurrence_count DESC;</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DatabaseSchema;