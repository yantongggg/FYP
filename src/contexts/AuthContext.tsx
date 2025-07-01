import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserData {
  uid: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  phone?: string;
  trust_score?: number;
  status?: string;
  faceData?: string;
  keystrokeData?: number[];
  scrollData?: any[];
  createdAt: Date;
}

interface AuthContextType {
  currentUser: any | null;
  userData: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, faceData?: string, keystrokeData?: number[], scrollData?: any[]) => Promise<void>;
  logout: () => Promise<void>;
  updateUserData: (updates: Partial<UserData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    // Handle demo credentials
    if (email === 'admin@example.com' && password === 'admin123') {
      // Create a mock user for admin
      const mockAdminUser = {
        uid: 'admin-demo',
        email: 'admin@example.com'
      };
      
      const adminData: UserData = {
        uid: 'admin-demo',
        email: 'admin@example.com',
        username: 'System Administrator',
        role: 'admin',
        trust_score: 100,
        status: 'active',
        createdAt: new Date()
      };
      
      setCurrentUser(mockAdminUser);
      setUserData(adminData);
      return;
    }
    
    if (email === 'user@example.com' && password === 'user123') {
      // Create a mock user for regular user
      const mockUser = {
        uid: 'user-demo',
        email: 'user@example.com'
      };
      
      const userData: UserData = {
        uid: 'user-demo',
        email: 'user@example.com',
        username: 'Demo User',
        role: 'user',
        trust_score: 95,
        status: 'active',
        createdAt: new Date()
      };
      
      setCurrentUser(mockUser);
      setUserData(userData);
      return;
    }

    // For real Supabase authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    if (data.user) {
      await fetchUserData(data.user.id);
      setCurrentUser(data.user);
    }
  };

  const register = async (
    email: string, 
    password: string, 
    username: string, 
    faceData?: string, 
    keystrokeData?: number[],
    scrollData?: any[]
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          role: 'user'
        }
      }
    });
    
    if (error) throw error;
    
    if (data.user) {
      const newUserData: any = {
        id: data.user.id,
        email,
        username,
        role: 'user',
        is_biometric_enrolled: !!faceData,
        trust_score: 100,
        status: 'active',
        created_at: new Date().toISOString()
      };

      // Insert user data into users table
      const { error: insertError } = await supabase
        .from('users')
        .insert(newUserData);
      
      if (insertError) throw insertError;
      
      // Store biometric data if provided
      if (faceData) {
        const { error: bioError } = await supabase
          .from('biometric_data')
          .insert({
            user_id: data.user.id,
            biometric_type: 'face',
            data: { face_image: faceData },
            quality_score: 0.9,
            capture_timestamp: new Date().toISOString()
          });
        
        if (bioError) throw bioError;
      }
      
      // Store behavioral data if provided
      if (keystrokeData && keystrokeData.length > 0) {
        const { error: keystrokeError } = await supabase
          .from('biometric_data')
          .insert({
            user_id: data.user.id,
            biometric_type: 'keystroke',
            data: { keystroke_pattern: keystrokeData },
            quality_score: 0.85,
            capture_timestamp: new Date().toISOString()
          });
        
        if (keystrokeError) throw keystrokeError;
      }
      
      if (scrollData && scrollData.length > 0) {
        const { error: scrollError } = await supabase
          .from('biometric_data')
          .insert({
            user_id: data.user.id,
            biometric_type: 'scroll',
            data: { scroll_pattern: scrollData },
            quality_score: 0.8,
            capture_timestamp: new Date().toISOString()
          });
        
        if (scrollError) throw scrollError;
      }
      
      setCurrentUser(data.user);
      setUserData({
        uid: data.user.id,
        email,
        username,
        role: 'user',
        trust_score: 100,
        status: 'active',
        faceData,
        keystrokeData,
        scrollData,
        createdAt: new Date()
      });
    }
  };

  const logout = async () => {
    // Handle demo users
    if (currentUser?.uid === 'admin-demo' || currentUser?.uid === 'user-demo') {
      setCurrentUser(null);
      setUserData(null);
      return;
    }
    
    // For real Supabase authentication
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    setCurrentUser(null);
    setUserData(null);
  };

  const updateUserData = async (updates: Partial<UserData>) => {
    if (!currentUser || !userData) {
      throw new Error('No user logged in');
    }

    // Handle demo users
    if (currentUser.uid === 'admin-demo' || currentUser.uid === 'user-demo') {
      setUserData({ ...userData, ...updates });
      return;
    }

    // For real Supabase users
    const { error } = await supabase
      .from('users')
      .update({
        username: updates.username || userData.username,
        email: updates.email || userData.email,
        phone: updates.phone || userData.phone,
        // Add other fields as needed
      })
      .eq('id', currentUser.id);

    if (error) throw error;

    // Update local state
    setUserData({ ...userData, ...updates });
  };

  const fetchUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setUserData({
          uid: data.id,
          email: data.email,
          username: data.username,
          role: data.role,
          phone: data.phone,
          trust_score: data.trust_score,
          status: data.status,
          createdAt: new Date(data.created_at)
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        
        if (data.session?.user) {
          setCurrentUser(data.session.user);
          await fetchUserData(data.session.user.id);
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setCurrentUser(session.user);
          await fetchUserData(session.user.id);
        } else {
          setCurrentUser(null);
          setUserData(null);
        }
      }
    );
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    login,
    register,
    logout,
    updateUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};