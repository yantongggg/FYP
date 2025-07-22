import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';

// ============= SIMPLIFIED INTERFACES =============
interface UserData {
  uid: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  trust_score?: number;
  status?: string;
  createdAt: Date;
}

interface AuthContextType {
  currentUser: any | null;
  userData: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithFace: (email: string, password: string, faceData: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserData: (updates: Partial<UserData>) => Promise<void>;
}

// ============= SIMPLE CONFIGURATION =============
const API_BASE_URL = 'http://localhost:5000';

// ============= CONTEXT CREATION =============
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============= SIMPLE API HELPER =============
const simpleApiCall = async (endpoint: string, data: any) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      // Remove credentials to avoid CORS issues
      mode: 'cors',
    });

    return response;
  } catch (error) {
    console.warn(`API call to ${endpoint} failed:`, error);
    // Return a mock response to continue development
    return new Response(JSON.stringify({ success: false, error: 'Network error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// ============= SIMPLE AUTH PROVIDER =============
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // ============= INITIALIZATION =============
  useEffect(() => {
    checkAuthState();
  }, []);

  
  const checkAuthState = async () => {
    try {
      setLoading(true);
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setUserData(user);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============= SIMPLE LOGIN (USERNAME + PASSWORD ONLY) =============
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);

      // Handle demo users - ALWAYS WORKS
      if (email === 'demo@user.com' || email === 'admin@demo.com' || email.includes('demo')) {
        const demoUser: UserData = {
          uid: email === 'admin@demo.com' ? 'admin-demo' : 'user-demo',
          email: email,
          username: email === 'admin@demo.com' ? 'Admin Demo' : 'Demo User',
          role: email === 'admin@demo.com' ? 'admin' : 'user',
          trust_score: 95,
          status: 'active',
          createdAt: new Date()
        };

        setCurrentUser({ id: demoUser.uid });
        setUserData(demoUser);
        
        localStorage.setItem('currentUser', JSON.stringify(demoUser));
        localStorage.setItem('auth_token', 'demo-token');
        
        console.log('  Demo login successful');
        return;
      }

      // Real user login - simplified
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        throw new Error('Invalid email or password');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, data.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Complete login immediately - NO BIOMETRIC REQUIRED
      const userData: UserData = {
        uid: data.id,
        email: data.email,
        username: data.username,
        role: (data.role as 'admin' | 'user') || 'user',
        trust_score: data.trust_score,
        status: data.status,
        createdAt: new Date(data.created_at),
      };

      setCurrentUser({ id: data.id });
      setUserData(userData);
      
      localStorage.setItem('currentUser', JSON.stringify(userData));
      localStorage.setItem('auth_token', 'user-token-' + data.id);
      
      // Update last login (optional - non-blocking)
      try {
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.id);
      } catch (dbError) {
        console.warn('Failed to update last login:', dbError);
      }

      console.log('  Login successful');

    } catch (error) {
      console.error('  Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ============= OPTIONAL FACE LOGIN =============
  const loginWithFace = async (email: string, password: string, faceBase64: string) => {
  // First: traditional credential login
  const { data: loginResult, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    throw new Error(loginError.message || 'Credential login failed');
  }

  const userId = loginResult.user?.id;
  if (!userId) throw new Error("User ID not found");

  // Then: face verification API
  const response = await fetch('http://localhost:5000/api/biometric-login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      face_image: faceBase64.split(',')[1]  // remove the data:image/... prefix
    })
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Face verification failed");
  }

  // Optional: store biometric result in context
  setUserData({
    ...loginResult.user,
    biometricVerified: true,
    biometricDetails: result
  });
};


  // ============= SIMPLE REGISTRATION =============
  const register = async (email: string, password: string, username: string) => {
    try {
      setLoading(true);

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user in database
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([
          {
            email,
            username,
            password_hash: passwordHash,
            role: 'user',
            status: 'active',
            trust_score: 85,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (userError || !newUser) {
        throw new Error(userError?.message || 'Failed to create user');
      }

      // Create user data object
      const userData: UserData = {
        uid: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: 'user',
        trust_score: newUser.trust_score,
        status: newUser.status,
        createdAt: new Date(newUser.created_at),
      };

      setCurrentUser({ id: newUser.id });
      setUserData(userData);
      
      localStorage.setItem('currentUser', JSON.stringify(userData));
      localStorage.setItem('auth_token', 'user-token-' + newUser.id);

      console.log('  Registration successful');

    } catch (error) {
      console.error('  Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ============= LOGOUT =============
  const logout = async () => {
    try {
      setLoading(true);
      
      // Clear all stored data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
      
      // Reset state
      setCurrentUser(null);
      setUserData(null);
      
      console.log('  Logout successful');
      
    } catch (error) {
      console.error('  Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============= UPDATE USER DATA =============
  const updateUserData = async (updates: Partial<UserData>) => {
    try {
      if (!userData) {
        throw new Error('No user data to update');
      }

      // Update in database if not demo user
      if (!userData.uid.includes('demo')) {
        const { error } = await supabase
          .from('users')
          .update({
            username: updates.username,
            trust_score: updates.trust_score,
            status: updates.status
          })
          .eq('id', userData.uid);

        if (error) {
          throw error;
        }
      }

      // Update local state
      const updatedUserData = { ...userData, ...updates };
      setUserData(updatedUserData);
      
      localStorage.setItem('currentUser', JSON.stringify(updatedUserData));

      console.log('  User data updated');

    } catch (error) {
      console.error('  Error updating user data:', error);
      throw error;
    }
  };

  // ============= CONTEXT VALUE =============
  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    login,
    loginWithFace,
    register,
    logout,
    updateUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};