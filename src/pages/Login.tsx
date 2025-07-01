import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle, LogIn, Terminal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, userData } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      // Navigation will be handled by the useEffect in App.tsx based on user role
    } catch (error: any) {
      setError(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  // Demo credentials helper
  const fillDemoCredentials = (type: 'admin' | 'user') => {
    if (type === 'admin') {
      setFormData({ email: 'admin@example.com', password: 'admin123' });
    } else {
      setFormData({ email: 'user@example.com', password: 'user123' });
    }
    setError('');
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-modal rounded-lg p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Terminal className="h-12 w-12 text-green-400 mx-auto mb-4 neon-glow" />
          <h1 className="text-3xl font-bold text-green-400 mb-2 glitch-text" style={{ fontFamily: 'Orbitron' }}>
            ACCESS TERMINAL
          </h1>
          <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
            Authenticate to enter system
          </p>
        </div>

        {/* Demo Credentials */}
        <div className="mb-6 p-4 glass-card rounded-lg">
          <p className="text-sm text-green-400 mb-3 font-bold" style={{ fontFamily: 'IBM Plex Mono' }}>
            DEMO CREDENTIALS:
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fillDemoCredentials('admin')}
              className="flex-1 px-3 py-2 bg-red-600/20 text-red-400 text-xs rounded border border-red-500/30 hover:bg-red-600/30 transition-all duration-300 hover-glow"
              style={{ fontFamily: 'IBM Plex Mono' }}
            >
              ADMIN_ACCESS
            </button>
            <button
              onClick={() => fillDemoCredentials('user')}
              className="flex-1 px-3 py-2 bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-500/30 hover:bg-blue-600/30 transition-all duration-300 hover-glow"
              style={{ fontFamily: 'IBM Plex Mono' }}
            >
              USER_ACCESS
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
              EMAIL_ADDRESS
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="terminal-input w-full pl-10 pr-4 py-3 rounded"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-green-400 mb-2" style={{ fontFamily: 'IBM Plex Mono' }}>
              PASSWORD
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="terminal-input w-full pl-10 pr-12 py-3 rounded"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-400 hover:text-cyan-400 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 glass-card rounded-lg bg-red-900/20 border-red-500/30">
              <p className="text-sm text-red-400 flex items-center" style={{ fontFamily: 'IBM Plex Mono' }}>
                <AlertCircle className="h-4 w-4 mr-2" />
                ERROR: {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="terminal-button w-full py-3 rounded font-bold hover-glow"
          >
            {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-cyan-400" style={{ fontFamily: 'IBM Plex Mono' }}>
            Need access credentials?{' '}
            <Link to="/register" className="text-green-400 hover:text-cyan-400 font-bold transition-colors">
              REGISTER_NEW_USER
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;