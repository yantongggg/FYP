import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  Users, 
  Shield, 
  Eye, 
  Activity, 
  FileText, 
  Link, 
  Settings,
  Key,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

const DatabaseSchema = () => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const tables = {
    users: {
      name: 'users',
      description: 'Core user account information and authentication metadata',
      icon: Users,
      color: 'text-blue-400',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()', description: 'Primary key identifier' },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true, description: 'User email address' },
        { name: 'username', type: 'VARCHAR(100)', nullable: false, unique: true, description: 'Unique username' },
        { name: 'full_name', type: 'VARCHAR(255)', nullable: false, description: 'User full name' },
        { name: 'role', type: 'VARCHAR(20)', nullable: false, default: "'user'", description: 'User role (user/admin)' },
        { name: 'status', type: 'VARCHAR(20)', nullable: false, default: "'active'", description: 'Account status' },
        { name: 'trust_score', type: 'DECIMAL(5,2)', nullable: false, default: '100.00', description: 'User trust score (0-100)' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Account creation timestamp' },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Last update timestamp' }
      ],
      indexes: ['idx_users_email', 'idx_users_username', 'idx_users_status'],
      policies: ['Users can view own profile', 'Users can update own profile', 'Admins can view all users']
    },
    biometric_profiles: {
      name: 'biometric_profiles',
      description: 'Encrypted biometric templates and enrollment data',
      icon: Eye,
      color: 'text-purple-400',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()', description: 'Primary key identifier' },
        { name: 'user_id', type: 'UUID', nullable: false, foreign_key: 'users(id)', description: 'Reference to user account' },
        { name: 'face_embedding', type: 'BYTEA', nullable: false, description: 'Encrypted facial biometric template' },
        { name: 'keystroke_pattern', type: 'JSONB', nullable: true, description: 'Keystroke dynamics pattern' },
        { name: 'mouse_pattern', type: 'JSONB', nullable: true, description: 'Mouse behavior pattern' },
        { name: 'enrollment_quality', type: 'DECIMAL(5,2)', nullable: true, description: 'Quality score of enrollment (0-1)' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Enrollment timestamp' },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Last update timestamp' }
      ],
      indexes: ['idx_biometric_profiles_user_id', 'idx_biometric_profiles_quality'],
      policies: ['Users can access own biometric data', 'Admins can view biometric metadata']
    },
    behavioral_sessions: {
      name: 'behavioral_sessions',
      description: 'Real-time behavioral monitoring data and session tracking',
      icon: Activity,
      color: 'text-green-400',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()', description: 'Session identifier' },
        { name: 'user_id', type: 'UUID', nullable: false, foreign_key: 'users(id)', description: 'Reference to user account' },
        { name: 'session_start', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Session start time' },
        { name: 'session_end', type: 'TIMESTAMP', nullable: true, description: 'Session end time' },
        { name: 'keystroke_data', type: 'JSONB', nullable: true, description: 'Keystroke dynamics events' },
        { name: 'mouse_data', type: 'JSONB', nullable: true, description: 'Mouse movement and click events' },
        { name: 'scroll_data', type: 'JSONB', nullable: true, description: 'Scroll behavior patterns' },
        { name: 'device_fingerprint', type: 'TEXT', nullable: true, description: 'Device identification hash' },
        { name: 'ip_address', type: 'INET', nullable: true, description: 'Client IP address' },
        { name: 'user_agent', type: 'TEXT', nullable: true, description: 'Browser user agent string' },
        { name: 'status', type: 'VARCHAR(20)', nullable: false, default: "'active'", description: 'Session status' }
      ],
      indexes: ['idx_behavioral_sessions_user_id', 'idx_behavioral_sessions_start', 'idx_behavioral_sessions_status'],
      policies: ['Users can view own sessions', 'Admins can view all sessions']
    },
    login_audit: {
      name: 'login_audit',
      description: 'Comprehensive authentication attempt logging and audit trail',
      icon: Shield,
      color: 'text-red-400',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()', description: 'Audit log identifier' },
        { name: 'user_id', type: 'UUID', nullable: true, foreign_key: 'users(id)', description: 'Reference to user (if successful)' },
        { name: 'email_attempted', type: 'VARCHAR(255)', nullable: false, description: 'Email used in attempt' },
        { name: 'result', type: 'VARCHAR(20)', nullable: false, description: 'Authentication result' },
        { name: 'face_confidence', type: 'DECIMAL(5,2)', nullable: true, description: 'Facial recognition confidence' },
        { name: 'behavioral_score', type: 'DECIMAL(5,2)', nullable: true, description: 'Behavioral analysis score' },
        { name: 'liveness_passed', type: 'BOOLEAN', nullable: true, description: 'Liveness detection result' },
        { name: 'ip_address', type: 'INET', nullable: false, description: 'Client IP address' },
        { name: 'user_agent', type: 'TEXT', nullable: false, description: 'Browser user agent' },
        { name: 'device_fingerprint', type: 'TEXT', nullable: true, description: 'Device identification' },
        { name: 'session_id', type: 'UUID', nullable: true, description: 'Associated session ID' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Attempt timestamp' }
      ],
      indexes: ['idx_login_audit_user_id', 'idx_login_audit_email', 'idx_login_audit_created_at', 'idx_login_audit_result'],
      policies: ['Users can view own login history', 'Admins can view all login attempts']
    },
    anomaly_audit: {
      name: 'anomaly_audit',
      description: 'Security anomaly detection and incident logging',
      icon: AlertTriangle,
      color: 'text-orange-400',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()', description: 'Anomaly record identifier' },
        { name: 'user_id', type: 'UUID', nullable: true, foreign_key: 'users(id)', description: 'Affected user account' },
        { name: 'session_id', type: 'UUID', nullable: true, description: 'Associated session' },
        { name: 'anomaly_type', type: 'VARCHAR(50)', nullable: false, description: 'Type of anomaly detected' },
        { name: 'severity', type: 'VARCHAR(20)', nullable: false, description: 'Severity level (low/medium/high/critical)' },
        { name: 'confidence_score', type: 'DECIMAL(5,2)', nullable: false, description: 'Anomaly detection confidence' },
        { name: 'description', type: 'TEXT', nullable: true, description: 'Detailed anomaly description' },
        { name: 'raw_data', type: 'JSONB', nullable: true, description: 'Raw anomaly data for analysis' },
        { name: 'action_taken', type: 'VARCHAR(50)', nullable: true, description: 'Automated action taken' },
        { name: 'resolved', type: 'BOOLEAN', nullable: false, default: 'false', description: 'Resolution status' },
        { name: 'ip_address', type: 'INET', nullable: true, description: 'Source IP address' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Detection timestamp' }
      ],
      indexes: ['idx_anomaly_audit_user_id', 'idx_anomaly_audit_type', 'idx_anomaly_audit_severity', 'idx_anomaly_audit_created_at'],
      policies: ['Users can view own anomalies', 'Admins can view all anomalies']
    },
    system_logs: {
      name: 'system_logs',
      description: 'System operation logs and performance monitoring',
      icon: FileText,
      color: 'text-cyan-400',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, default: 'gen_random_uuid()', description: 'Log entry identifier' },
        { name: 'log_level', type: 'VARCHAR(10)', nullable: false, description: 'Log level (DEBUG/INFO/WARN/ERROR)' },
        { name: 'component', type: 'VARCHAR(50)', nullable: false, description: 'System component name' },
        { name: 'message', type: 'TEXT', nullable: false, description: 'Log message content' },
        { name: 'context', type: 'JSONB', nullable: true, description: 'Additional context data' },
        { name: 'user_id', type: 'UUID', nullable: true, foreign_key: 'users(id)', description: 'Associated user' },
        { name: 'session_id', type: 'UUID', nullable: true, description: 'Associated session' },
        { name: 'execution_time', type: 'INTEGER', nullable: true, description: 'Operation execution time (ms)' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'CURRENT_TIMESTAMP', description: 'Log timestamp' }
      ],
      indexes: ['idx_system_logs_level', 'idx_system_logs_component', 'idx_system_logs_created_at'],
      policies: ['Admins can view all system logs']
    }
  };

  const relationships = [
    { from: 'users', to: 'biometric_profiles', type: 'One-to-One', description: 'Each user has one biometric profile' },
    { from: 'users', to: 'behavioral_sessions', type: 'One-to-Many', description: 'User can have multiple sessions' },
    { from: 'users', to: 'login_audit', type: 'One-to-Many', description: 'User has multiple login attempts' },
    { from: 'users', to: 'anomaly_audit', type: 'One-to-Many', description: 'User can have multiple anomalies' },
    { from: 'users', to: 'system_logs', type: 'One-to-Many', description: 'User actions generate system logs' },
    { from: 'behavioral_sessions', to: 'anomaly_audit', type: 'One-to-Many', description: 'Sessions can trigger anomalies' }
  ];

  const securityFeatures = [
    {
      title: 'Row Level Security (RLS)',
      description: 'PostgreSQL RLS policies ensure users can only access their own data',
      icon: Shield,
      color: 'text-blue-400',
      features: ['User data isolation', 'Admin access controls', 'Policy-based security', 'Automatic enforcement']
    },
    {
      title: 'Data Encryption',
      description: 'Client-side AES-256 encryption for all biometric templates',
      icon: Key,
      color: 'text-purple-400',
      features: ['AES-256 encryption', 'Client-side processing', 'Encrypted at rest', 'Key management']
    },
    {
      title: 'Audit Logging',
      description: 'Comprehensive logging of all authentication and system events',
      icon: FileText,
      color: 'text-green-400',
      features: ['Authentication logs', 'Anomaly tracking', 'System monitoring', 'Compliance reporting']
    },
    {
      title: 'Real-time Monitoring',
      description: 'Live behavioral analysis and anomaly detection',
      icon: Activity,
      color: 'text-orange-400',
      features: ['Real-time analysis', 'Behavioral tracking', 'Anomaly alerts', 'Performance metrics']
    }
  ];

  const TableCard = ({ tableKey, table }: { tableKey: string; table: any }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 cursor-pointer transition-all ${
        selectedTable === tableKey ? 'ring-2 ring-blue-400' : ''
      }`}
      onClick={() => setSelectedTable(selectedTable === tableKey ? null : tableKey)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <table.icon className={`h-6 w-6 ${table.color}`} />
          <h3 className="text-xl font-semibold text-white">{table.name}</h3>
        </div>
        <span className="text-xs text-gray-400 bg-white/10 px-2 py-1 rounded">
          {table.columns.length} columns
        </span>
      </div>
      
      <p className="text-gray-300 text-sm mb-4">{table.description}</p>
      
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Key Columns</h4>
          <div className="space-y-1">
            {table.columns.slice(0, 3).map((column: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{column.name}</span>
                <span className="text-gray-500">{column.type}</span>
              </div>
            ))}
            {table.columns.length > 3 && (
              <div className="text-xs text-gray-500">+{table.columns.length - 3} more...</div>
            )}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Security</h4>
          <div className="flex flex-wrap gap-1">
            {table.policies.slice(0, 2).map((policy: string, index: number) => (
              <span key={index} className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                RLS
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (selectedTable) {
    const table = tables[selectedTable as keyof typeof tables];
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-8">
            <button
              onClick={() => setSelectedTable(null)}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
            >
              <span>← Back to Schema</span>
            </button>
            <div className="flex items-center space-x-3">
              <table.icon className={`h-8 w-8 ${table.color}`} />
              <h1 className="text-4xl font-bold text-white">{table.name}</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Table Details */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4">Table Structure</h2>
                <p className="text-gray-300 mb-6">{table.description}</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-white font-medium py-3 px-4">Column</th>
                        <th className="text-left text-white font-medium py-3 px-4">Type</th>
                        <th className="text-left text-white font-medium py-3 px-4">Nullable</th>
                        <th className="text-left text-white font-medium py-3 px-4">Default</th>
                        <th className="text-left text-white font-medium py-3 px-4">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map((column: any, index: number) => (
                        <tr key={index} className="border-b border-white/5">
                          <td className="py-3 px-4 text-blue-400 font-medium">{column.name}</td>
                          <td className="py-3 px-4 text-purple-400">{column.type}</td>
                          <td className="py-3 px-4">
                            {column.nullable ? (
                              <span className="text-green-400">Yes</span>
                            ) : (
                              <span className="text-red-400">No</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-sm">
                            {column.default || '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-300 text-sm">{column.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Table Metadata */}
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-bold text-white mb-4">Indexes</h3>
                <div className="space-y-2">
                  {table.indexes.map((index: string, i: number) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Database className="h-4 w-4 text-yellow-400" />
                      <span className="text-gray-300 text-sm">{index}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-bold text-white mb-4">Security Policies</h3>
                <div className="space-y-2">
                  {table.policies.map((policy: string, i: number) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300 text-sm">{policy}</span>
                    </div>
                  ))}
                </div>
              </div>

              {table.columns.some((col: any) => col.foreign_key) && (
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                  <h3 className="text-xl font-bold text-white mb-4">Foreign Keys</h3>
                  <div className="space-y-2">
                    {table.columns.filter((col: any) => col.foreign_key).map((column: any, i: number) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Link className="h-4 w-4 text-blue-400" />
                        <span className="text-gray-300 text-sm">
                          {column.name} → {column.foreign_key}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

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
            Comprehensive PostgreSQL database design for secure biometric data storage with Supabase
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
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full" />
                      <span className="text-white font-medium">{rel.from}</span>
                    </div>
                    <span className="text-gray-400 text-sm px-3 py-1 bg-white/10 rounded">
                      {rel.type}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full" />
                      <span className="text-white font-medium">{rel.to}</span>
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">{rel.description}</span>
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
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Security Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {securityFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                </div>
                <p className="text-gray-300 mb-4">{feature.description}</p>
                <div className="space-y-2">
                  {feature.features.map((item, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-gray-300 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Migration Script */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Database Migration</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Supabase Migration Script</h3>
              <span className="text-sm text-gray-400">supabase/migrations/001_initial_schema.sql</span>
            </div>
            <div className="bg-gray-900 rounded-lg p-6 overflow-x-auto">
              <pre className="text-sm text-green-400">
{`-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    trust_score DECIMAL(5,2) DEFAULT 100.00 CHECK (trust_score >= 0 AND trust_score <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create biometric_profiles table
CREATE TABLE biometric_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    face_embedding BYTEA NOT NULL,
    keystroke_pattern JSONB,
    mouse_pattern JSONB,
    enrollment_quality DECIMAL(5,2) CHECK (enrollment_quality >= 0 AND enrollment_quality <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can access own biometric data" ON biometric_profiles
    FOR ALL USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_biometric_profiles_user_id ON biometric_profiles(user_id);`}
              </pre>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DatabaseSchema;