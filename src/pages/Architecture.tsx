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
      technologies: ['React', 'TypeScript', 'Tailwind CSS', 'WebRTC', 'Canvas API'],
      features: ['Facial Recognition UI', 'Liveness Detection Interface', 'Behavioral Tracking', 'Real-time Feedback']
    },
    'api': {
      title: 'API Gateway',
      description: 'RESTful API endpoints for external system integration',
      technologies: ['Node.js', 'Express', 'JWT', 'Rate Limiting', 'CORS'],
      features: ['Authentication Endpoints', 'Registration API', 'Monitoring Endpoints', 'Webhook Support']
    },
    'biometric': {
      title: 'Biometric Processing',
      description: 'Core biometric analysis and matching algorithms',
      technologies: ['Python', 'OpenCV', 'DeepFace', 'TensorFlow', 'NumPy'],
      features: ['Face Detection', 'Feature Extraction', 'Liveness Detection', 'Behavioral Analysis']
    },
    'ml': {
      title: 'Machine Learning',
      description: 'AI models for pattern recognition and anomaly detection',
      technologies: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'OpenCV'],
      features: ['Face Recognition', 'Anomaly Detection', 'Pattern Matching', 'Continuous Learning']
    },
    'security': {
      title: 'Security Layer',
      description: 'Encryption and secure data handling',
      technologies: ['AES-256', 'RSA', 'TLS/SSL', 'RBAC', 'OAuth 2.0'],
      features: ['Data Encryption', 'Access Control', 'Secure Storage', 'Audit Logging']
    },
    'database': {
      title: 'Database Layer',
      description: 'Secure, scalable data storage with encryption',
      technologies: ['MongoDB', 'Firebase', 'Redis', 'PostgreSQL', 'GridFS'],
      features: ['Encrypted Storage', 'High Availability', 'Backup & Recovery', 'Scalability']
    },
    'monitoring': {
      title: 'Monitoring & Analytics',
      description: 'Real-time system monitoring and performance analytics',
      technologies: ['Grafana', 'Prometheus', 'ELK Stack', 'Winston', 'NewRelic'],
      features: ['Real-time Alerts', 'Performance Metrics', 'Log Analysis', 'Custom Dashboards']
    },
    'cloud': {
      title: 'Cloud Infrastructure',
      description: 'Scalable cloud deployment with auto-scaling capabilities',
      technologies: ['AWS', 'Docker', 'Kubernetes', 'Load Balancers', 'CDN'],
      features: ['Auto Scaling', 'Load Distribution', 'Global CDN', 'Disaster Recovery']
    }
  };

  const dataFlow = [
    { from: 'User Device', to: 'Frontend', description: 'Biometric data capture' },
    { from: 'Frontend', to: 'API Gateway', description: 'Encrypted data transmission' },
    { from: 'API Gateway', to: 'Biometric Processing', description: 'Authentication request' },
    { from: 'Biometric Processing', to: 'ML Models', description: 'Pattern analysis' },
    { from: 'ML Models', to: 'Database', description: 'Template matching' },
    { from: 'Database', to: 'Security Layer', description: 'Encrypted data retrieval' },
    { from: 'Security Layer', to: 'Monitoring', description: 'Audit logging' },
    { from: 'Monitoring', to: 'Admin Dashboard', description: 'Real-time alerts' }
  ];

  const ComponentCard = ({ id, component, icon: Icon, color }: { 
    id: string, 
    component: any, 
    icon: any, 
    color: string 
  }) => (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setSelectedComponent(selectedComponent === id ? null : id)}
      className={`relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 cursor-pointer transition-all duration-300 ${
        selectedComponent === id ? 'ring-2 ring-blue-500 bg-white/10' : 'hover:bg-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <Icon className={`h-8 w-8 ${color}`} />
        <div className={`w-3 h-3 rounded-full ${color.replace('text-', 'bg-')}`} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{component.title}</h3>
      <p className="text-gray-400 text-sm">{component.description}</p>
      
      {selectedComponent === id && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-white/10"
        >
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-2">Technologies</h4>
              <div className="flex flex-wrap gap-2">
                {component.technologies.map((tech: string) => (
                  <span key={tech} className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-2">Key Features</h4>
              <ul className="space-y-1">
                {component.features.map((feature: string) => (
                  <li key={feature} className="text-gray-300 text-xs flex items-center">
                    <div className="w-1 h-1 bg-green-400 rounded-full mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
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
            System Architecture
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Comprehensive overview of the multimodal biometric authentication framework architecture
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
              id="api"
              component={components.api}
              icon={Network}
              color="text-green-400"
            />
            <ComponentCard
              id="biometric"
              component={components.biometric}
              icon={Eye}
              color="text-purple-400"
            />
            <ComponentCard
              id="ml"
              component={components.ml}
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
              id="cloud"
              component={components.cloud}
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
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Data Flow Architecture</h2>
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <div className="relative">
              {/* Flow Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* User Layer */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-center">
                    <Smartphone className="h-8 w-8 text-white mx-auto mb-2" />
                    <p className="text-white font-medium">User Device</p>
                    <p className="text-blue-200 text-sm">Biometric Capture</p>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="h-6 w-6 text-gray-400 rotate-90 md:rotate-0" />
                  </div>
                </div>

                {/* Frontend Layer */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-4 text-center">
                    <Monitor className="h-8 w-8 text-white mx-auto mb-2" />
                    <p className="text-white font-medium">Frontend</p>
                    <p className="text-green-200 text-sm">Data Processing</p>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="h-6 w-6 text-gray-400 rotate-90 md:rotate-0" />
                  </div>
                </div>

                {/* Backend Layer */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-4 text-center">
                    <Server className="h-8 w-8 text-white mx-auto mb-2" />
                    <p className="text-white font-medium">Backend</p>
                    <p className="text-purple-200 text-sm">Authentication</p>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="h-6 w-6 text-gray-400 rotate-90 md:rotate-0" />
                  </div>
                </div>

                {/* Database Layer */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-lg p-4 text-center">
                    <Database className="h-8 w-8 text-white mx-auto mb-2" />
                    <p className="text-white font-medium">Database</p>
                    <p className="text-orange-200 text-sm">Secure Storage</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Integration Endpoints */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">API Integration Endpoints</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">Authentication Endpoints</h3>
              <div className="space-y-4">
                <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-400 font-mono">POST /api/register</span>
                    <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">POST</span>
                  </div>
                  <p className="text-gray-300 text-sm">Register new user with biometric data</p>
                </div>
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400 font-mono">POST /api/authenticate</span>
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">POST</span>
                  </div>
                  <p className="text-gray-300 text-sm">Authenticate user with biometric verification</p>
                </div>
                <div className="bg-purple-600/20 border border-purple-500/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-purple-400 font-mono">GET /api/verify</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">GET</span>
                  </div>
                  <p className="text-gray-300 text-sm">Verify session and get user status</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold text-white mb-4">Monitoring Endpoints</h3>
              <div className="space-y-4">
                <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-400 font-mono">GET /api/logs</span>
                    <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">GET</span>
                  </div>
                  <p className="text-gray-300 text-sm">Retrieve authentication logs and anomalies</p>
                </div>
                <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-red-400 font-mono">POST /api/report_anomaly</span>
                    <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">POST</span>
                  </div>
                  <p className="text-gray-300 text-sm">Report security anomaly or suspicious activity</p>
                </div>
                <div className="bg-cyan-600/20 border border-cyan-500/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-cyan-400 font-mono">GET /api/metrics</span>
                    <span className="text-xs bg-cyan-600 text-white px-2 py-1 rounded">GET</span>
                  </div>
                  <p className="text-gray-300 text-sm">Get system performance metrics</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Security Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Security & Compliance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Lock className="h-10 w-10 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Data Encryption</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• AES-256 encryption at rest</li>
                <li>• TLS 1.3 for data in transit</li>
                <li>• End-to-end encryption</li>
                <li>• Key rotation policies</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Shield className="h-10 w-10 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Access Control</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Role-based access control</li>
                <li>• Multi-factor authentication</li>
                <li>• Session management</li>
                <li>• Audit trail logging</li>
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Globe className="h-10 w-10 text-green-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Compliance</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• GDPR compliance</li>
                <li>• SOC 2 Type II</li>
                <li>• ISO 27001</li>
                <li>• FIDO2 standards</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Architecture;