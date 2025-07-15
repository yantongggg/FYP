import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Server, 
  Database, 
  Shield, 
  Eye, 
  Keyboard, 
  MousePointer, 
  Cloud, 
  Lock,
  Smartphone,
  Monitor,
  ArrowRight,
  ArrowDown,
  Cpu,
  Network,
  Globe
} from 'lucide-react';

const Architecture = () => {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  const components = {
    'frontend': {
      title: 'Frontend Layer',
      description: 'React-based web application with real-time biometric capture capabilities',
      technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Web Crypto API'],
      features: ['Facial Recognition UI', 'Liveness Detection Interface', 'Behavioral Tracking', 'Real-time Feedback']
    },
    'supabase': {
      title: 'Supabase Backend',
      description: 'Complete backend-as-a-service with authentication and real-time capabilities',
      technologies: ['Supabase Auth', 'PostgreSQL', 'Row Level Security', 'Real-time API', 'PostgREST'],
      features: ['User Authentication', 'Database Management', 'Real-time Updates', 'API Gateway']
    },
    'biometric': {
      title: 'Biometric Processing',
      description: 'Client-side biometric analysis and pattern recognition',
      technologies: ['Face-api.js', 'Web Crypto API', 'Canvas API', 'MediaDevices API', 'JavaScript ML'],
      features: ['Face Detection', 'Feature Extraction', 'Liveness Detection', 'Behavioral Analysis']
    },
    'edge_functions': {
      title: 'Edge Functions',
      description: 'Serverless functions for behavioral analysis and ML processing',
      technologies: ['Deno Runtime', 'TypeScript', 'Supabase Functions', 'WebAssembly', 'HTTP APIs'],
      features: ['Behavioral Analysis', 'Anomaly Detection', 'Chatbot Processing', 'Data Validation']
    },
    'security': {
      title: 'Security Layer',
      description: 'Comprehensive security with Supabase Auth and encryption',
      technologies: ['Supabase Auth', 'AES-256 Encryption', 'JWT Tokens', 'RLS Policies', 'TLS/SSL'],
      features: ['Multi-factor Auth', 'Data Encryption', 'Access Control', 'Audit Logging']
    },
    'database': {
      title: 'PostgreSQL Database',
      description: 'Supabase PostgreSQL with advanced security and real-time features',
      technologies: ['PostgreSQL 15', 'Row Level Security', 'pgcrypto', 'Real-time subscriptions', 'Vector Extensions'],
      features: ['Encrypted Storage', 'Real-time Updates', 'Backup & Recovery', 'Vector Similarity']
    },
    'monitoring': {
      title: 'Monitoring & Analytics',
      description: 'Built-in Supabase monitoring with custom analytics dashboard',
      technologies: ['Supabase Dashboard', 'Real-time Metrics', 'Database Logs', 'Custom Analytics', 'JavaScript Tracking'],
      features: ['Real-time Alerts', 'Performance Metrics', 'User Analytics', 'Anomaly Tracking']
    },
    'deployment': {
      title: 'Supabase Hosting',
      description: 'Serverless deployment with global CDN and edge computing',
      technologies: ['Supabase Platform', 'Edge Functions', 'Global CDN', 'Auto-scaling', 'Git Integration'],
      features: ['Global Distribution', 'Auto-scaling', 'CI/CD Pipeline', 'Environment Management']
    }
  };

  const ComponentCard = ({ id, component, icon: Icon, color }: any) => (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 cursor-pointer transition-all ${
        selectedComponent === id ? 'ring-2 ring-blue-400' : ''
      }`}
      onClick={() => setSelectedComponent(selectedComponent === id ? null : id)}
    >
      <Icon className={`h-12 w-12 ${color} mb-4`} />
      <h3 className="text-xl font-semibold text-white mb-2">{component.title}</h3>
      <p className="text-gray-300 text-sm mb-4">{component.description}</p>
      
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Technologies</h4>
          <div className="flex flex-wrap gap-1">
            {component.technologies.map((tech: string, index: number) => (
              <span key={index} className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                {tech}
              </span>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Features</h4>
          <ul className="text-xs text-gray-300 space-y-1">
            {component.features.map((feature: string, index: number) => (
              <li key={index} className="flex items-center">
                <div className="w-1 h-1 bg-green-400 rounded-full mr-2" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );

  const dataFlow = [
    { from: 'User Interface', to: 'Biometric Capture', description: 'User initiates authentication' },
    { from: 'Biometric Capture', to: 'Client Processing', description: 'Extract facial features & patterns' },
    { from: 'Client Processing', to: 'Supabase Auth', description: 'Send encrypted biometric data' },
    { from: 'Supabase Auth', to: 'PostgreSQL', description: 'Query encrypted templates' },
    { from: 'PostgreSQL', to: 'Edge Functions', description: 'Behavioral analysis processing' },
    { from: 'Edge Functions', to: 'Real-time API', description: 'Return authentication result' },
    { from: 'Real-time API', to: 'User Interface', description: 'Display authentication status' }
  ];

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent mb-4">
            System Architecture
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Comprehensive overview of the Supabase-based biometric authentication framework architecture
          </p>
        </motion.div>

        {/* Architecture Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">System Components</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ComponentCard
              id="frontend"
              component={components.frontend}
              icon={Monitor}
              color="text-blue-400"
            />
            <ComponentCard
              id="supabase"
              component={components.supabase}
              icon={Database}
              color="text-green-400"
            />
            <ComponentCard
              id="biometric"
              component={components.biometric}
              icon={Eye}
              color="text-purple-400"
            />
            <ComponentCard
              id="edge_functions"
              component={components.edge_functions}
              icon={Cpu}
              color="text-orange-400"
            />
            <ComponentCard
              id="security"
              component={components.security}
              icon={Shield}
              color="text-red-400"
            />
            <ComponentCard
              id="database"
              component={components.database}
              icon={Database}
              color="text-cyan-400"
            />
            <ComponentCard
              id="monitoring"
              component={components.monitoring}
              icon={Server}
              color="text-yellow-400"
            />
            <ComponentCard
              id="deployment"
              component={components.deployment}
              icon={Cloud}
              color="text-pink-400"
            />
          </div>
        </motion.div>

        {/* Data Flow Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Authentication Data Flow</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <div className="space-y-4">
              {dataFlow.map((flow, index) => (
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
                      <span className="text-white font-medium">{flow.from}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full" />
                      <span className="text-white font-medium">{flow.to}</span>
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">{flow.description}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Security Architecture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Security Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <Lock className="h-8 w-8 text-red-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Client-Side Security</h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• AES-256 biometric encryption</li>
                <li>• Secure biometric capture</li>
                <li>• Local pattern analysis</li>
                <li>• No raw biometric storage</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <Shield className="h-8 w-8 text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Supabase Security</h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• Row Level Security policies</li>
                <li>• Database encryption at rest</li>
                <li>• API rate limiting</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <Eye className="h-8 w-8 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Monitoring Security</h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• Real-time anomaly detection</li>
                <li>• Comprehensive audit logging</li>
                <li>• Behavioral pattern monitoring</li>
                <li>• Automated threat response</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Integration Architecture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Integration Points</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">External APIs</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Supabase REST API</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Supabase Real-time API</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Edge Functions API</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-4">System Integrations</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Local Chatbot</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-300">Behavioral Analytics</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Architecture;