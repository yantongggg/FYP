// GlobalBehavioralWrapper.tsx - NEW FILE to wrap sensitive pages
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

interface GlobalBehavioralWrapperProps {
  children: React.ReactNode;
}

interface BehavioralData {
  keystrokes: any[];
  mouseMovements: any[];
}

const GlobalBehavioralWrapper: React.FC<GlobalBehavioralWrapperProps> = ({ children }) => {
  const { userData } = useAuth();
  const location = useLocation();
  
  // Track behavioral data globally
  const behavioralDataRef = useRef<BehavioralData>({
    keystrokes: [],
    mouseMovements: []
  });
  
  const lastCheckRef = useRef<number>(Date.now());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Define sensitive pages that need monitoring
  const sensitivePages = ['/dashboard', '/profile', '/ekyc', '/chat', '/behavioral-test'];
  const isOnSensitivePage = sensitivePages.some(page => location.pathname.includes(page));
  
  // Capture behavioral data
  useEffect(() => {
    if (!userData?.uid || !isOnSensitivePage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip sensitive keys
      if (['F12', 'F11', 'Alt', 'Control', 'Meta'].includes(e.key)) return;
      
      behavioralDataRef.current.keystrokes.push({
        key: e.key,
        timestamp: Date.now(),
        type: 'keydown',
        page: location.pathname
      });

      // Keep only recent data (last 5 minutes)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      behavioralDataRef.current.keystrokes = behavioralDataRef.current.keystrokes
        .filter(k => k.timestamp > fiveMinutesAgo)
        .slice(-100); // Max 100 recent keystrokes
    };

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const recentMouse = behavioralDataRef.current.mouseMovements;
      
      // Throttle mouse events (max every 200ms)
      if (recentMouse.length === 0 || now - recentMouse[recentMouse.length - 1].timestamp > 200) {
        behavioralDataRef.current.mouseMovements.push({
          x: e.clientX,
          y: e.clientY,
          timestamp: now,
          type: 'mousemove',
          page: location.pathname
        });

        // Keep only recent data
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        behavioralDataRef.current.mouseMovements = behavioralDataRef.current.mouseMovements
          .filter(m => m.timestamp > fiveMinutesAgo)
          .slice(-150); // Max 150 recent mouse events
      }
    };

    const handleClick = (e: MouseEvent) => {
      behavioralDataRef.current.mouseMovements.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        type: 'click',
        page: location.pathname
      });
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick);
    };
  }, [userData?.uid, location.pathname, isOnSensitivePage]);

  // Periodic behavioral checks
  useEffect(() => {
    if (!userData?.uid || !isOnSensitivePage) return;

    const performBehavioralCheck = async () => {
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheckRef.current;
      
      // Only check every 3 minutes minimum
      if (timeSinceLastCheck < 3 * 60 * 1000) return;
      
      const { keystrokes, mouseMovements } = behavioralDataRef.current;
      
      // Need minimum data for meaningful check
      if (keystrokes.length < 10) {
        console.log('🔄 Insufficient behavioral data for check');
        return;
      }

      try {
        console.log(`🔍 Performing global behavioral check on ${location.pathname}`);
        
        const response = await fetch('http://localhost:5000/api/behavioral-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userData.uid,
            behavioralData: {
              keystrokes: keystrokes.slice(-50), // Last 50 keystrokes
              mouseMovements: mouseMovements.slice(-80) // Last 80 mouse events
            },
            check_type: 'continuous',
            page_context: location.pathname
          })
        });

        const result = await response.json();
        lastCheckRef.current = now;

        console.log('✅ Global behavioral check result:', {
          similarity: result.similarity_score,
          action: result.action_taken,
          page: location.pathname
        });

        // Store session data
        await fetch('http://localhost:5000/api/save-behavioral-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userData.uid,
            session_id: result.session_id || `global_${Date.now()}`,
            similarity_scores: {
              overall_similarity: result.similarity_score,
              keystroke_similarity: result.keystroke_similarity || 0.5,
              mouse_similarity: result.mouse_similarity || 0.5
            },
            anomaly_score: result.anomaly_score,
            is_successful: !result.is_anomaly,
            duration_seconds: Math.floor(timeSinceLastCheck / 1000),
            verification_type: 'global_continuous'
          })
        });

        // Store anomaly if detected
        if (result.is_anomaly && result.action_taken !== 'none') {
          await fetch('http://localhost:5000/api/save-anomaly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userData.uid,
              session_id: result.session_id || `global_${Date.now()}`,
              anomaly_type: 'global_behavioral_monitoring',
              severity: result.severity || 'medium',
              action_taken: result.action_taken,
              score: result.similarity_score,
              details: {
                page: location.pathname,
                check_type: 'continuous',
                keystroke_count: keystrokes.length,
                mouse_count: mouseMovements.length
              }
            })
          });
        }

        // Handle critical anomalies
        if (result.action_taken === 'auto_lock') {
          console.error('🚨 CRITICAL: Auto-lock triggered by global monitoring');
          // Could trigger logout or warning modal here
          alert('Security anomaly detected. Please verify your identity.');
        }

      } catch (error) {
        console.error('❌ Global behavioral check failed:', error);
      }
    };

    // Start periodic checks
    checkIntervalRef.current = setInterval(performBehavioralCheck, 3 * 60 * 1000); // Every 3 minutes

    // Initial check after 30 seconds
    setTimeout(performBehavioralCheck, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [userData?.uid, location.pathname, isOnSensitivePage]);

  return <>{children}</>;
};

export default GlobalBehavioralWrapper;