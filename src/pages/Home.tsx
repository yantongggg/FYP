import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Eye, 
  MousePointer, 
  Keyboard, 
  Activity, 
  Database, 
  Lock,
  ArrowRight,
  Users,
  BarChart3,
  Terminal,
  Cpu,
  Zap
} from 'lucide-react';

const Home = () => {
  const features = [
    {
      icon: Eye,
      title: 'FACIAL RECOGNITION',
      description: 'Advanced AI-powered facial recognition with high accuracy and anti-spoofing capabilities.'
    },
    {
      icon: Activity,
      title: 'LIVENESS DETECTION',
      description: 'Face flashing technology with colored light patterns to verify real human presence.'
    },
    {
      icon: Keyboard,
      title: 'KEYSTROKE DYNAMICS',
      description: 'Unique typing patterns analysis including rhythm, hold time, and inter-key delays.'
    },
    {
      icon: MousePointer,
      title: 'BEHAVIORAL BIOMETRICS',
      description: 'Mouse movement and scroll pattern recognition for continuous authentication.'
    },
    {
      icon: Shield,
      title: 'REAL-TIME MONITORING',
      description: 'Continuous behavioral analysis with instant anomaly detection and response.'
    },
    {
      icon: Database,
      title: 'SECURE STORAGE',
      description: 'AES-256 encrypted biometric data storage with cloud-compatible architecture.'
    }
  ];

  const stats = [
    { label: 'AUTHENTICATION ACCURACY', value: '99.8%' },
    { label: 'FRAUD DETECTION RATE', value: '95.2%' },
    { label: 'RESPONSE TIME', value: '<2s' },
    { label: 'SYSTEM UPTIME', value: '99.9%' }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="flex justify-center mb-8">
              <Terminal className="h-20 w-20 text-green-400 neon-glow" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-green-400 mb-6 glitch-text" style={{ fontFamily: 'Orbitron' }}>
              MULTIMODAL BIOMETRIC
              <br />
              <span className="text-cyan-400">AUTHENTICATION SYSTEM</span>
            </h1>
            <p className="text-xl text-cyan-400 mb-8 max-w-4xl mx-auto" style={{ fontFamily: 'IBM Plex Mono' }}>
              Next-generation security framework combining facial recognition, AI-powered liveness detection, 
              and behavioral biometrics to prevent fraud and enhance eKYC security.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="terminal-button inline-flex items-center px-8 py-4 rounded font-bold text-lg hover-glow"
              >
                INITIALIZE USER
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/architecture"
                className="inline-flex items-center px-8 py-4 bg-transparent border border-green-500 text-green-400 font-bold rounded hover:bg-green-500/10 transition-all duration-300 hover-glow"
                style={{ fontFamily: 'IBM Plex Mono' }}
              >
                VIEW ARCHITECTURE
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="cyber-grid">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center glass-card rounded-lg p-6 hover-glow"
              >
                <div className="text-3xl md:text-4xl font-bold text-green-400 mb-2 neon-glow" style={{ fontFamily: 'Orbitron' }}>
                  {stat.value}
                </div>
                <div className="text-cyan-400 text-sm" style={{ fontFamily: 'IBM Plex Mono' }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-green-400 mb-4 glitch-text" style={{ fontFamily: 'Orbitron' }}>
              ADVANCED SECURITY FEATURES
            </h2>
            <p className="text-xl text-cyan-400 max-w-2xl mx-auto" style={{ fontFamily: 'IBM Plex Mono' }}>
              Comprehensive biometric authentication with multiple layers of security
            </p>
          </motion.div>

          <div className="cyber-grid">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card rounded-lg p-8 hover-glow transition-all duration-300"
              >
                <div className="mb-6">
                  <feature.icon className="h-12 w-12 text-green-400 neon-glow" />
                </div>
                <h3 className="text-xl font-bold text-green-400 mb-4" style={{ fontFamily: 'Orbitron' }}>
                  {feature.title}
                </h3>
                <p className="text-cyan-400 leading-relaxed text-sm" style={{ fontFamily: 'IBM Plex Mono' }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="glass-modal rounded-lg p-12"
          >
            <Cpu className="h-16 w-16 text-green-400 mx-auto mb-6 neon-glow" />
            <h2 className="text-3xl font-bold text-green-400 mb-4 glitch-text" style={{ fontFamily: 'Orbitron' }}>
              READY?
            </h2>
            <p className="text-xl text-cyan-400 mb-8" style={{ fontFamily: 'IBM Plex Mono' }}>
              Experience the future of authentication with our comprehensive framework
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="terminal-button inline-flex items-center px-8 py-4 rounded font-bold hover-glow"
              >
                <Users className="mr-2 h-5 w-5" />
                TRY REGISTRATION
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-8 py-4 bg-transparent border border-cyan-400 text-cyan-400 font-bold rounded hover:bg-cyan-400/10 transition-all duration-300 hover-glow"
                style={{ fontFamily: 'IBM Plex Mono' }}
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                ACCESS ADMIN DASHBOARD
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;