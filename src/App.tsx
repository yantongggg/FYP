// FIXED App.tsx - Enhanced with GlobalBehavioralWrapper Integration

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import ChatBot from './components/ChatBot';
import GlobalBehavioralWrapper from './components/GlobalBehavioralWrapper';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import UserHome from './pages/UserHome';
import AdminDashboard from './pages/AdminDashboard';
import AdminEditAccount from './pages/AdminEditAccount';
import EditProfile from './pages/EditProfile';
import MyAnomalies from './pages/MyAnomalies';
import Architecture from './pages/Architecture';
import DatabaseSchema from './pages/DatabaseSchema';
import Documentation from './pages/Documentation';

// Enhanced Dashboard redirect component
const Dashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userData) {
      console.log(`🔄 FIXED App: Redirecting user ${userData.username} (${userData.role}) to appropriate dashboard`);
      if (userData.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    } else {
      console.log('🔄 FIXED App: No user data, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [userData, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-4"></div>
        <p className="text-green-400 font-mono">REDIRECTING_TO_DASHBOARD...</p>
      </div>
    </div>
  );
};

// Enhanced AppContent with Global Behavioral Monitoring
function AppContent() {
  const { userData } = useAuth();

  // CRITICAL FIX: Log app initialization and user status
  useEffect(() => {
    console.log('🚀 FIXED App: Enhanced behavioral monitoring app initialized');
    if (userData) {
      console.log(`👤 FIXED App: User authenticated: ${userData.username} (${userData.role})`);
    } else {
      console.log('👤 FIXED App: No authenticated user');
    }
  }, [userData]);

  return (
    <div className="min-h-screen matrix-bg">
      <div className="matrix-rain"></div>
      
      <div className="relative z-10">
        <Navbar />
        
        {/* CRITICAL FIX: Wrap all content with GlobalBehavioralWrapper for comprehensive monitoring */}
        <GlobalBehavioralWrapper>
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Home />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              
              {/* Public documentation routes (available to all) */}
              <Route path="/architecture" element={<Architecture />} />
              <Route path="/database" element={<DatabaseSchema />} />
              <Route path="/docs" element={<Documentation />} />
              
              {/* Enhanced Dashboard redirect with behavioral monitoring */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              {/* Enhanced User routes with behavioral monitoring */}
              <Route path="/home" element={
                <ProtectedRoute requiredRole="user">
                  <UserHome />
                </ProtectedRoute>
              } />
              <Route path="/edit-profile" element={
                <ProtectedRoute requiredRole="user">
                  <EditProfile />
                </ProtectedRoute>
              } />
              <Route path="/my-anomalies" element={
                <ProtectedRoute requiredRole="user">
                  <MyAnomalies />
                </ProtectedRoute>
              } />
              
              {/* Enhanced Admin routes with behavioral monitoring */}
              <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/edit" element={
                <ProtectedRoute requiredRole="admin">
                  <AdminEditAccount />
                </ProtectedRoute>
              } />
              
              {/* Catch all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.main>
        </GlobalBehavioralWrapper>
        
        {/* Enhanced AI Chatbot - Available on all pages */}
        <ChatBot />
        
        {/* CRITICAL FIX: Enhanced Debug Information (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-4 right-4 bg-black/90 backdrop-blur-md text-green-400 text-xs p-2 rounded border border-green-500/30 font-mono z-40">
            <div className="text-green-400 font-bold mb-1">🔧 FIXED DEV MODE</div>
            <div>User: {userData?.username || 'Not logged in'}</div>
            <div>Role: {userData?.role || 'None'}</div>
            <div>Page: {window.location.pathname}</div>
            <div>Monitoring: {userData ? '✅ Active' : '❌ Inactive'}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced Main App Component with Error Boundary
function App() {
  // CRITICAL FIX: Global error handler for behavioral monitoring
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('🚨 FIXED App: Global error in behavioral monitoring:', event.error);
      
      // Don't crash the app for behavioral monitoring errors
      if (event.error?.message?.includes('behavioral') || 
          event.error?.message?.includes('monitoring')) {
        event.preventDefault();
        console.log('🛡️ FIXED App: Prevented behavioral monitoring error from crashing app');
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🚨 FIXED App: Unhandled promise rejection:', event.reason);
      
      // Don't crash the app for API failures
      if (event.reason?.message?.includes('behavioral') || 
          event.reason?.message?.includes('fetch')) {
        event.preventDefault();
        console.log('🛡️ FIXED App: Prevented API error from crashing app');
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Log app startup
    console.log('🚀 FIXED App: Enhanced behavioral monitoring application started');
    console.log('🔧 FIXED App: Global error handlers registered');

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // CRITICAL FIX: Enhanced performance monitoring
  useEffect(() => {
    const logPerformance = () => {
      if (performance.mark) {
        performance.mark('app-loaded');
        console.log('📊 FIXED App: Performance mark set - app loaded');
      }
    };

    // Log performance after initial render
    setTimeout(logPerformance, 1000);
  }, []);

  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;