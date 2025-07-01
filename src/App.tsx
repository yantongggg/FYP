import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import ChatBot from './components/ChatBot';
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

// Dashboard redirect component
const Dashboard = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userData) {
      if (userData.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [userData, navigate]);

  return <div>Redirecting...</div>;
};

function AppContent() {
  return (
    <div className="min-h-screen matrix-bg">
      <div className="matrix-rain"></div>
      
      <div className="relative z-10">
        <Navbar />
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
            
            {/* Dashboard redirect */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* User routes */}
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
            
            {/* Admin routes */}
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
        
        {/* AI Chatbot - Available on all pages */}
        <ChatBot />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;