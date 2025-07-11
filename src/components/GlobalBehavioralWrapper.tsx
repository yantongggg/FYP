// FIXED GlobalBehavioralWrapper.tsx - Proper Global Behavioral Monitoring

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface GlobalBehavioralWrapperProps {
  children: React.ReactNode;
}

interface BehavioralData {
  keystrokes: KeystrokeEvent[];
  mouseMovements: MouseEvent[];
}

interface KeystrokeEvent {
  key: string;
  code: string;
  timestamp: number;
  type: 'keydown' | 'keyup';
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  page: string;
}

interface MouseEvent {
  x: number;
  y: number;
  timestamp: number;
  type: 'mousemove' | 'click' | 'scroll';
  button?: number;
  deltaY?: number;
  page: string;
}

interface VerificationResult {
  success: boolean;
  similarity_score: number;
  is_anomaly: boolean;
  action_taken: string;
  severity: string;
  session_id: string;
}

const GlobalBehavioralWrapper: React.FC<GlobalBehavioralWrapperProps> = ({ children }) => {
  const { userData } = useAuth();
  
  // CRITICAL FIX: Proper state management for global monitoring
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'error'>('online');
  
  // Enhanced data collection with proper typing
  const behavioralDataRef = useRef<BehavioralData>({
    keystrokes: [],
    mouseMovements: []
  });
  
  const lastCheckRef = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pageStartTimeRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const monitoringStatsRef = useRef({
    totalChecks: 0,
    anomaliesDetected: 0,
    averageSimilarity: 0,
    lastSimilarity: 0
  });

  // CRITICAL FIX: Enhanced sensitive pages detection
  const SENSITIVE_PAGES = [
    '/dashboard', '/home', '/profile', '/ekyc', '/chat', 
    '/behavioral-test', '/admin', '/settings', '/account',
    '/userhome', '/my-anomalies', '/edit-profile'
  ];

  const isOnSensitivePage = useCallback(() => {
    const currentPath = window.location.pathname.toLowerCase();
    
    // Check if current path matches any sensitive page
    const isSensitive = SENSITIVE_PAGES.some(page => 
      currentPath.includes(page.toLowerCase()) || 
      currentPath === '/' || // Home page
      currentPath === '' // Default route
    );
    
    console.log(`🔍 FIXED Global: Page check - ${currentPath} is ${isSensitive ? 'SENSITIVE' : 'NOT SENSITIVE'}`);
    return isSensitive;
  }, []);

  const getCurrentPageContext = useCallback(() => {
    const path = window.location.pathname.toLowerCase();
    
    // Map paths to readable contexts
    if (path.includes('/dashboard') || path.includes('/home') || path.includes('/userhome')) return '/dashboard';
    if (path.includes('/profile') || path.includes('/edit-profile')) return '/profile';
    if (path.includes('/ekyc')) return '/ekyc';
    if (path.includes('/chat')) return '/chat';
    if (path.includes('/behavioral-test')) return '/behavioral-test';
    if (path.includes('/admin')) return '/admin';
    if (path.includes('/settings')) return '/settings';
    if (path.includes('/my-anomalies')) return '/my-anomalies';
    if (path === '/' || path === '') return '/home';
    
    return path;
  }, []);

  // CRITICAL FIX: Enhanced keyboard event handler with proper validation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!userData?.uid || !isMonitoring || !isOnSensitivePage()) return;

    // Skip function keys, system keys, and navigation keys
    const skipKeys = [
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
      'Alt', 'Control', 'Meta', 'Shift', 'CapsLock', 'NumLock', 'ScrollLock', 
      'Pause', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown',
      'PrintScreen', 'ContextMenu', 'Help'
    ];

    if (skipKeys.includes(e.key)) {
      return;
    }

    // CRITICAL FIX: Avoid capturing sensitive input fields
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const inputType = (target as any).type?.toLowerCase();
    
    // Skip password fields, hidden inputs, and sensitive data attributes
    if (inputType === 'password' || 
        target.getAttribute('data-sensitive') === 'true' ||
        target.getAttribute('data-private') === 'true' ||
        target.classList.contains('sensitive-input')) {
      return;
    }

    const keystrokeEvent: KeystrokeEvent = {
      key: e.key.length > 1 ? e.key : 'char', // Anonymize actual characters for privacy
      code: e.code,
      timestamp: Date.now(),
      type: 'keydown',
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      page: getCurrentPageContext()
    };

    behavioralDataRef.current.keystrokes.push(keystrokeEvent);

    // CRITICAL FIX: Maintain rolling window of data (last 15 minutes max)
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    behavioralDataRef.current.keystrokes = behavioralDataRef.current.keystrokes
      .filter(k => k.timestamp > fifteenMinutesAgo)
      .slice(-200); // Max 200 recent keystrokes

    console.log(`🔑 FIXED Global: Keystroke captured on ${getCurrentPageContext()} (Total: ${behavioralDataRef.current.keystrokes.length})`);
  }, [userData?.uid, isMonitoring, isOnSensitivePage, getCurrentPageContext]);

  // CRITICAL FIX: Enhanced keyup handler for complete keystroke dynamics
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!userData?.uid || !isMonitoring || !isOnSensitivePage()) return;

    const skipKeys = [
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
      'Alt', 'Control', 'Meta', 'Shift', 'CapsLock', 'NumLock', 'ScrollLock'
    ];

    if (skipKeys.includes(e.key)) return;

    const target = e.target as HTMLElement;
    const inputType = (target as any).type?.toLowerCase();
    
    if (inputType === 'password' || target.getAttribute('data-sensitive') === 'true') {
      return;
    }

    const keystrokeEvent: KeystrokeEvent = {
      key: e.key.length > 1 ? e.key : 'char',
      code: e.code,
      timestamp: Date.now(),
      type: 'keyup',
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      page: getCurrentPageContext()
    };

    behavioralDataRef.current.keystrokes.push(keystrokeEvent);
  }, [userData?.uid, isMonitoring, isOnSensitivePage, getCurrentPageContext]);

  // CRITICAL FIX: Enhanced mouse event handler with proper throttling
  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!userData?.uid || !isMonitoring || !isOnSensitivePage()) return;

    const now = Date.now();
    const recentMouse = behavioralDataRef.current.mouseMovements;
    
    // CRITICAL FIX: Throttle mouse events (max every 200ms for global monitoring)
    if (recentMouse.length === 0 || now - recentMouse[recentMouse.length - 1].timestamp > 200) {
      const mouseEvent: MouseEvent = {
        x: Math.round(e.clientX / 10) * 10, // Anonymize precise coordinates
        y: Math.round(e.clientY / 10) * 10,
        timestamp: now,
        type: 'mousemove',
        page: getCurrentPageContext()
      };

      behavioralDataRef.current.mouseMovements.push(mouseEvent);

      // CRITICAL FIX: Maintain rolling window of data (last 15 minutes)
      const fifteenMinutesAgo = now - (15 * 60 * 1000);
      behavioralDataRef.current.mouseMovements = behavioralDataRef.current.mouseMovements
        .filter(m => m.timestamp > fifteenMinutesAgo)
        .slice(-300); // Max 300 recent mouse events
    }
  }, [userData?.uid, isMonitoring, isOnSensitivePage, getCurrentPageContext]);

  // CRITICAL FIX: Enhanced click and scroll handlers
  const handleClick = useCallback((e: globalThis.MouseEvent) => {
    if (!userData?.uid || !isMonitoring || !isOnSensitivePage()) return;

    const clickEvent: MouseEvent = {
      x: Math.round(e.clientX / 10) * 10, // Anonymize coordinates
      y: Math.round(e.clientY / 10) * 10,
      timestamp: Date.now(),
      type: 'click',
      button: e.button,
      page: getCurrentPageContext()
    };

    behavioralDataRef.current.mouseMovements.push(clickEvent);
    console.log(`🖱️ FIXED Global: Click captured on ${getCurrentPageContext()}`);
  }, [userData?.uid, isMonitoring, isOnSensitivePage, getCurrentPageContext]);

  const handleScroll = useCallback((e: WheelEvent) => {
    if (!userData?.uid || !isMonitoring || !isOnSensitivePage()) return;

    const scrollEvent: MouseEvent = {
      x: Math.round(e.clientX / 10) * 10,
      y: Math.round(e.clientY / 10) * 10,
      timestamp: Date.now(),
      type: 'scroll',
      deltaY: Math.sign(e.deltaY), // Anonymize scroll amount, keep direction
      page: getCurrentPageContext()
    };

    behavioralDataRef.current.mouseMovements.push(scrollEvent);
  }, [userData?.uid, isMonitoring, isOnSensitivePage, getCurrentPageContext]);

  // CRITICAL FIX: Enhanced behavioral analysis with comprehensive error handling
  const performBehavioralCheck = useCallback(async () => {
    if (!userData?.uid || !isMonitoring || !isOnSensitivePage()) {
      console.log('🔄 FIXED Global: Skipping behavioral check - conditions not met');
      return;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckRef.current;
    
    // CRITICAL FIX: Only check every 3 minutes minimum for global monitoring
    const minCheckInterval = 3 * 60 * 1000; // 3 minutes
    if (timeSinceLastCheck < minCheckInterval) {
      console.log(`🔄 FIXED Global: Skipping check - too soon (${Math.floor(timeSinceLastCheck / 1000)}s ago, need ${Math.floor(minCheckInterval / 1000)}s)`);
      return;
    }
    
    const { keystrokes, mouseMovements } = behavioralDataRef.current;
    
    // CRITICAL FIX: Need minimum data for meaningful global check
    if (keystrokes.length < 8 && mouseMovements.length < 10) {
      console.log(`🔄 FIXED Global: Insufficient data - K:${keystrokes.length}/8, M:${mouseMovements.length}/10`);
      return;
    }

    try {
      setConnectionStatus('online');
      const currentPage = getCurrentPageContext();
      const sessionId = `global_${userData.uid}_${now}`;
      const sessionDuration = Math.floor((now - sessionStartRef.current) / 1000);
      const pageDuration = Math.floor((now - pageStartTimeRef.current) / 1000);

      console.log(`🔍 FIXED Global: Running behavioral check on ${currentPage}`);
      console.log(`📊 FIXED Global: Data: ${keystrokes.length} keystrokes, ${mouseMovements.length} mouse events`);
      
      // CRITICAL FIX: Prepare anonymized behavioral data
      const behavioralData = {
        keystrokes: keystrokes.slice(-60).map(k => ({
          key: k.key,
          code: k.code,
          timestamp: k.timestamp,
          type: k.type,
          ctrlKey: k.ctrlKey,
          shiftKey: k.shiftKey,
          altKey: k.altKey
        })),
        mouseMovements: mouseMovements.slice(-100).map(m => ({
          x: m.x,
          y: m.y,
          timestamp: m.timestamp,
          type: m.type,
          button: m.button,
          deltaY: m.deltaY
        }))
      };

      // CRITICAL FIX: Enhanced API call with proper error handling
      const response = await fetch('http://localhost:5000/api/behavioral-check', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user_id: userData.uid,
          behavioralData,
          session_id: sessionId,
          check_type: 'global_continuous',
          page_context: currentPage,
          monitoring_metadata: {
            session_duration: sessionDuration,
            page_duration: pageDuration,
            total_keystrokes: keystrokes.length,
            total_mouse: mouseMovements.length,
            check_interval: Math.floor(timeSinceLastCheck / 1000),
            is_global: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FIXED Global: API failed: ${response.status} - ${errorText}`);
      }

      const result: VerificationResult = await response.json();
      lastCheckRef.current = now;

      // CRITICAL FIX: Update monitoring statistics
      monitoringStatsRef.current.totalChecks++;
      monitoringStatsRef.current.lastSimilarity = result.similarity_score || 0;
      
      if (result.is_anomaly) {
        monitoringStatsRef.current.anomaliesDetected++;
      }
      
      // Calculate running average
      const totalChecks = monitoringStatsRef.current.totalChecks;
      monitoringStatsRef.current.averageSimilarity = 
        (monitoringStatsRef.current.averageSimilarity * (totalChecks - 1) + 
         (result.similarity_score || 0)) / totalChecks;

      console.log('✅ FIXED Global: Behavioral check result:', {
        similarity: result.similarity_score,
        action: result.action_taken,
        page: currentPage,
        anomaly: result.is_anomaly,
        severity: result.severity,
        stats: monitoringStatsRef.current
      });

      // CRITICAL FIX: Store session data with enhanced metadata
      try {
        const sessionSaveResponse = await fetch('http://localhost:5000/api/save-behavioral-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userData.uid,
            session_id: sessionId,
            keystroke_features: {
              total_keystrokes: keystrokes.length,
              avg_typing_speed: keystrokes.length / (pageDuration || 1),
              key_variety: new Set(keystrokes.map(k => k.code)).size
            },
            mouse_features: {
              total_mouse_events: mouseMovements.length,
              click_count: mouseMovements.filter(m => m.type === 'click').length,
              scroll_count: mouseMovements.filter(m => m.type === 'scroll').length
            },
            similarity_scores: {
              overall_similarity: result.similarity_score || 0,
              keystroke_similarity: result.similarity_score || 0,
              mouse_similarity: result.similarity_score || 0
            },
            anomaly_score: 1 - (result.similarity_score || 0),
            is_successful: !result.is_anomaly,
            verification_type: 'global_continuous',
            duration_seconds: Math.floor(timeSinceLastCheck / 1000),
            page_context: currentPage,
            created_at: new Date().toISOString()
          })
        });

        if (sessionSaveResponse.ok) {
          console.log('✅ FIXED Global: Session saved successfully');
        } else {
          console.error('❌ FIXED Global: Failed to save session');
        }
      } catch (sessionError) {
        console.error('❌ FIXED Global: Session save error:', sessionError);
      }

      // CRITICAL FIX: Store anomaly if detected with enhanced details
      if (result.is_anomaly && result.action_taken !== 'none') {
        console.log(`🚨 FIXED Global: Anomaly detected: ${result.severity} - ${result.action_taken}`);
        
        try {
          const anomalySaveResponse = await fetch('http://localhost:5000/api/save-anomaly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userData.uid,
              session_id: sessionId,
              anomaly_type: 'global_behavioral_monitoring',
              severity: result.severity || 'medium',
              action_taken: result.action_taken,
              anomaly_score: 1 - (result.similarity_score || 0),
              details: {
                page: currentPage,
                check_type: 'global_continuous',
                keystroke_count: keystrokes.length,
                mouse_count: mouseMovements.length,
                session_duration: sessionDuration,
                page_duration: pageDuration,
                similarity_score: result.similarity_score,
                monitoring_stats: monitoringStatsRef.current,
                behavioral_summary: {
                  total_keystrokes: keystrokes.length,
                  total_mouse: mouseMovements.length,
                  page_switches: 1,
                  avg_similarity: monitoringStatsRef.current.averageSimilarity
                }
              },
              created_at: new Date().toISOString()
            })
          });

          if (anomalySaveResponse.ok) {
            console.log('✅ FIXED Global: Anomaly saved successfully');
          } else {
            console.error('❌ FIXED Global: Failed to save anomaly');
          }
        } catch (anomalyError) {
          console.error('❌ FIXED Global: Anomaly save error:', anomalyError);
        }

        // CRITICAL FIX: Trigger enhanced real-time update event
        window.dispatchEvent(new CustomEvent('behavioralDataUpdated', {
          detail: { 
            userId: userData.uid, 
            result, 
            sessionId,
            context: 'global_monitoring',
            page: currentPage,
            severity: result.severity,
            enhanced: true,
            stats: monitoringStatsRef.current,
            source: 'GlobalBehavioralWrapper'
          }
        }));
      }

      // CRITICAL FIX: Handle critical anomalies with enhanced user experience
      if (result.action_taken === 'auto_lock' || result.severity === 'critical') {
        console.error('🚨 FIXED Global: CRITICAL auto-lock triggered by global monitoring');
        
        const criticalAlert = `🚨 CRITICAL SECURITY ALERT 🚨\n\n` +
          `Unusual behavioral patterns detected during your session.\n\n` +
          `📍 Page: ${currentPage}\n` +
          `📊 Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%\n` +
          `⏱️ Session Duration: ${Math.floor(sessionDuration / 60)} minutes\n` +
          `🔍 Total Checks: ${monitoringStatsRef.current.totalChecks}\n` +
          `📈 Average Similarity: ${(monitoringStatsRef.current.averageSimilarity * 100).toFixed(1)}%\n\n` +
          `Your account has been flagged for security review.\n\n` +
          `If you are the legitimate user, this may be due to:\n` +
          `• Changed typing environment or device\n` +
          `• Stress, fatigue, or medical conditions\n` +
          `• Different input method or accessibility tools\n` +
          `• Shared computer or different user\n\n` +
          `Please contact security if you believe this is an error.\n` +
          `Session ID: ${sessionId}`;
          
        alert(criticalAlert);
        
        // Optional: Auto-logout for critical security breaches
        if (result.action_taken === 'auto_lock') {
          console.log('🔒 FIXED Global: Auto-logout triggered due to critical anomaly');
          // Uncomment to enable auto-logout:
          // window.location.href = '/login?reason=security_anomaly';
        }
      }

      // CRITICAL FIX: Clear processed data to maintain rolling window
      const processedTime = now - (5 * 60 * 1000); // Keep last 5 minutes after processing
      behavioralDataRef.current.keystrokes = behavioralDataRef.current.keystrokes.filter(k => k.timestamp > processedTime);
      behavioralDataRef.current.mouseMovements = behavioralDataRef.current.mouseMovements.filter(m => m.timestamp > processedTime);

    } catch (error) {
      console.error('❌ FIXED Global: Behavioral check failed:', error);
      setConnectionStatus('error');
      
      // Don't spam errors - only log once per minute
      const errorKey = `global_error_${Math.floor(Date.now() / 60000)}`;
      if (!localStorage.getItem(errorKey)) {
        localStorage.setItem(errorKey, 'true');
        console.error('❌ FIXED Global: Network or API error in behavioral monitoring');
      }
    }
  }, [userData?.uid, isMonitoring, isOnSensitivePage, getCurrentPageContext]);

  // CRITICAL FIX: Enhanced monitoring lifecycle management
  const startGlobalMonitoring = useCallback(() => {
    if (!userData?.uid || !isOnSensitivePage() || isMonitoring) {
      console.log('🔄 FIXED Global: Cannot start monitoring - conditions not met');
      return;
    }

    console.log(`🚀 FIXED Global: Starting monitoring for ${userData.uid} on ${getCurrentPageContext()}`);
    
    setIsMonitoring(true);
    pageStartTimeRef.current = Date.now();
    
    if (!sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }

    // Reset monitoring stats for new session
    monitoringStatsRef.current = {
      totalChecks: 0,
      anomaliesDetected: 0,
      averageSimilarity: 0,
      lastSimilarity: 0
    };

    // Clear any existing data
    behavioralDataRef.current = { keystrokes: [], mouseMovements: [] };

    // CRITICAL FIX: Attach event listeners with proper options
    console.log('🔗 FIXED Global: Attaching enhanced event listeners');
    
    document.addEventListener('keydown', handleKeyDown, { capture: true, passive: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true, passive: true });
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('click', handleClick, { capture: true, passive: true });
    document.addEventListener('wheel', handleScroll, { passive: true });

    // Also add to window for broader coverage
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true, passive: true });

    // CRITICAL FIX: Set up periodic checks every 3 minutes
    checkIntervalRef.current = setInterval(() => {
      performBehavioralCheck();
    }, 3 * 60 * 1000);

    // Initial check after 2 minutes to establish baseline
    setTimeout(() => {
      performBehavioralCheck();
    }, 2 * 60 * 1000);

    console.log('✅ FIXED Global: Enhanced monitoring started with proper event handling');
  }, [userData?.uid, isOnSensitivePage, isMonitoring, getCurrentPageContext, handleKeyDown, handleKeyUp, handleMouseMove, handleClick, handleScroll, performBehavioralCheck]);

  const stopGlobalMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    console.log('🛑 FIXED Global: Stopping monitoring');
    
    setIsMonitoring(false);

    // Clear interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    // CRITICAL FIX: Remove event listeners properly
    console.log('🔗 FIXED Global: Removing event listeners');
    
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('wheel', handleScroll);

    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);

    // CRITICAL FIX: Run final verification if we have enough data
    const { keystrokes, mouseMovements } = behavioralDataRef.current;
    if ((keystrokes.length >= 5 || mouseMovements.length >= 8) && userData?.uid) {
      console.log('🔍 FIXED Global: Running final check before stop');
      performBehavioralCheck();
    }

    console.log('✅ FIXED Global: Monitoring stopped cleanly');
  }, [isMonitoring, handleKeyDown, handleKeyUp, handleMouseMove, handleClick, handleScroll, performBehavioralCheck, userData?.uid]);

  // CRITICAL FIX: Enhanced effect for monitoring lifecycle
  useEffect(() => {
    if (userData?.uid && isOnSensitivePage() && !isMonitoring) {
      startGlobalMonitoring();
    } else if ((!userData?.uid || !isOnSensitivePage()) && isMonitoring) {
      stopGlobalMonitoring();
    }

    return () => {
      stopGlobalMonitoring();
    };
  }, [userData?.uid, isOnSensitivePage, startGlobalMonitoring, stopGlobalMonitoring]);

  // CRITICAL FIX: Handle page navigation changes
  useEffect(() => {
    const handleLocationChange = () => {
      const newPageContext = getCurrentPageContext();
      console.log(`🔄 FIXED Global: Page changed to ${newPageContext}`);
      
      if (isMonitoring && !isOnSensitivePage()) {
        console.log('🔄 FIXED Global: Left sensitive page, stopping monitoring');
        stopGlobalMonitoring();
      } else if (!isMonitoring && isOnSensitivePage() && userData?.uid) {
        console.log('🔄 FIXED Global: Entered sensitive page, starting monitoring');
        startGlobalMonitoring();
      } else if (isMonitoring && isOnSensitivePage()) {
        // Page change within sensitive areas - reset page timer
        pageStartTimeRef.current = Date.now();
        console.log('🔄 FIXED Global: Page changed within sensitive area, resetting timer');
      }
    };

    // Listen for navigation changes
    window.addEventListener('popstate', handleLocationChange);
    
    // CRITICAL FIX: Override pushState and replaceState for SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(handleLocationChange, 100);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(handleLocationChange, 100);
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [isMonitoring, isOnSensitivePage, userData?.uid, getCurrentPageContext, startGlobalMonitoring, stopGlobalMonitoring]);

  // CRITICAL FIX: Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGlobalMonitoring();
    };
  }, [stopGlobalMonitoring]);

  // CRITICAL FIX: Enhanced connection status monitoring
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/health-check');
        setConnectionStatus(response.ok ? 'online' : 'error');
      } catch {
        setConnectionStatus('error');
      }
    };

    const connectionInterval = setInterval(checkConnection, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(connectionInterval);
  }, []);

  // CRITICAL FIX: Debug UI for development (hidden in production)
  const showDebugUI = process.env.NODE_ENV === 'development' && isOnSensitivePage() && isMonitoring;

  return (
    <>
      {children}
      
      {/* CRITICAL FIX: Enhanced Debug UI (dev only) */}
      {showDebugUI && (
        <div className="fixed bottom-4 left-4 bg-black/90 backdrop-blur-md text-green-400 text-xs p-3 rounded-lg border border-green-500/30 font-mono z-50 min-w-[250px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <span className="mr-2">
                {connectionStatus === 'online' ? '🟢' : connectionStatus === 'offline' ? '🟡' : '🔴'}
              </span>
              <span>🌐 FIXED Global Monitor</span>
            </div>
            <span className={`font-bold ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
              {isMonitoring ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>📍 Page:</span>
              <span className="text-cyan-400">{getCurrentPageContext()}</span>
            </div>
            <div className="flex justify-between">
              <span>🔑 Keystrokes:</span>
              <span className="text-cyan-400">{behavioralDataRef.current.keystrokes.length}</span>
            </div>
            <div className="flex justify-between">
              <span>🖱️ Mouse Events:</span>
              <span className="text-cyan-400">{behavioralDataRef.current.mouseMovements.length}</span>
            </div>
            <div className="flex justify-between">
              <span>✅ Total Checks:</span>
              <span className="text-purple-400">{monitoringStatsRef.current.totalChecks}</span>
            </div>
            <div className="flex justify-between">
              <span>🚨 Anomalies:</span>
              <span className={monitoringStatsRef.current.anomaliesDetected > 0 ? 'text-red-400' : 'text-green-400'}>
                {monitoringStatsRef.current.anomaliesDetected}
              </span>
            </div>
            <div className="flex justify-between">
              <span>📈 Avg Similarity:</span>
              <span className="text-yellow-400">
                {(monitoringStatsRef.current.averageSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>⏱️ Session Time:</span>
              <span className="text-blue-400">
                {Math.floor((Date.now() - sessionStartRef.current) / 60000)}m
              </span>
            </div>
            <div className="flex justify-between">
              <span>🔄 Next Check:</span>
              <span className="text-orange-400">
                {Math.max(0, Math.floor((3 * 60 * 1000 - (Date.now() - lastCheckRef.current)) / 1000))}s
              </span>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-green-400 border-t border-green-500/20 pt-1">
           
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalBehavioralWrapper;