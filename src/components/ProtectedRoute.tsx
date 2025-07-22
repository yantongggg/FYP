import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
  adminOnly?: boolean; // Add this for backward compatibility
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole, 
  adminOnly 
}) => {
  const { currentUser, userData, loading } = useAuth();

  // Show loading state while auth is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-green-400 font-mono">AUTHENTICATING...</p>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!currentUser) {
    console.log('  ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Handle adminOnly prop (backward compatibility)
  if (adminOnly && userData?.role !== 'admin') {
    console.log('  ProtectedRoute: Admin required, user is not admin');
    return <Navigate to="/home" replace />;
  }

  // If a specific role is required, check it
  if (requiredRole && userData?.role !== requiredRole) {
    console.log(`  ProtectedRoute: Required role ${requiredRole}, user has ${userData?.role}`);
    // If user doesn't have required role, redirect based on their actual role
    if (userData?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/home" replace />;
    }
  }

  // If all checks pass, render the protected content
  console.log('  ProtectedRoute: Access granted');
  return <>{children}</>;
};

export default ProtectedRoute;