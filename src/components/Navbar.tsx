import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Menu, X, LogOut, Terminal, Settings, User, Activity, FileText, Database, Book } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { currentUser, userData, logout } = useAuth();

  // Define navigation items based on user role
  const getNavItems = () => {
    if (!currentUser) {
      // Not logged in - show public pages
      return [
        { path: '/', label: 'HOME', icon: Terminal },
        { path: '/architecture', label: 'ARCHITECTURE', icon: Database },
        { path: '/database', label: 'DATABASE', icon: FileText },
        { path: '/docs', label: 'DOCS', icon: Book },
        { path: '/login', label: 'LOGIN', icon: User },
        { path: '/register', label: 'REGISTER', icon: User },
      ];
      } else if (userData?.role === 'admin') {
        // Admin - only admin pages
        return [
          { path: '/', label: 'HOME', icon: Terminal },
          { path: '/admin', label: 'ADMIN PANEL', icon: Shield },
          { path: '/admin/settings', label: 'SETTINGS', icon: Settings },  // ← FIXED PATH
        ];
    } else {
      // Regular user - user pages + optional docs
      return [
        { path: '/', label: 'HOME', icon: Terminal },
        { path: '/home', label: 'DASHBOARD', icon: Activity },
        { path: '/edit-profile', label: 'SETTINGS', icon: Settings },
        { path: '/my-anomalies', label: 'ANOMALIES', icon: Shield },
        { path: '/architecture', label: 'ARCHITECTURE', icon: Database },
        { path: '/database', label: 'DATABASE', icon: FileText },
        { path: '/docs', label: 'DOCS', icon: Book },
      ];
    }
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="bg-black/90 backdrop-blur-xl border-b border-green-500/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 hover-glow">
              <Terminal className="h-8 w-8 text-green-400 neon-glow" />
              <span className="text-xl font-bold text-green-400 glitch-text" style={{ fontFamily: 'Orbitron' }}>
                BIOMETRIC_AUTH
              </span>
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 text-sm font-bold transition-all duration-300 hover-glow flex items-center space-x-2 ${
                    location.pathname === item.path
                      ? 'text-black bg-green-400 neon-glow rounded'
                      : 'text-green-400 hover:text-cyan-400 hover:neon-glow-mint'
                  }`}
                  style={{ fontFamily: 'IBM Plex Mono' }}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
              
              {currentUser && (
                <div className="flex items-center space-x-4 ml-6 pl-6 border-l border-green-500/30">
                  <div className="text-right">
                    <span className="text-cyan-400 text-sm block" style={{ fontFamily: 'IBM Plex Mono' }}>
                      USER: {userData?.username || userData?.email}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      userData?.role === 'admin' 
                        ? 'bg-red-600/20 text-red-400 border border-red-500/30' 
                        : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    }`} style={{ fontFamily: 'IBM Plex Mono' }}>
                      {userData?.role?.toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded text-sm font-bold transition-all duration-300 hover-glow"
                    style={{ fontFamily: 'IBM Plex Mono' }}
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    LOGOUT
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 text-green-400 hover:text-cyan-400 hover:bg-green-600/20 rounded hover-glow"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="md:hidden glass-modal border-b border-green-500/30"
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2 text-base font-bold transition-all duration-300 hover-glow ${
                  location.pathname === item.path
                    ? 'text-black bg-green-400 rounded'
                    : 'text-green-400 hover:text-cyan-400 hover:bg-green-600/20 rounded'
                }`}
                style={{ fontFamily: 'IBM Plex Mono' }}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
            
            {currentUser && (
              <div className="pt-4 pb-3 border-t border-green-500/30">
                <div className="px-3 py-2">
                  <p className="text-cyan-400 text-sm" style={{ fontFamily: 'IBM Plex Mono' }}>
                    USER: {userData?.username || userData?.email}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                    userData?.role === 'admin' 
                      ? 'bg-red-600/20 text-red-400 border border-red-500/30' 
                      : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  }`} style={{ fontFamily: 'IBM Plex Mono' }}>
                    {userData?.role?.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 text-base font-bold transition-all duration-300 rounded hover-glow"
                  style={{ fontFamily: 'IBM Plex Mono' }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  LOGOUT
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;