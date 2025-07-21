// FIXED BehavioralMonitor.tsx - Proper Continuous Monitoring with Real-time Updates

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Activity, AlertTriangle, CheckCircle, Clock, Mouse, Keyboard } from 'lucide-react';


interface KeystrokeEvent {
  key: string;
  code: string;
  timestamp: number;
  type: 'keydown' | 'keyup';
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

interface MouseEvent {
  x: number;
  y: number;
  timestamp: number;
  type: 'mousemove' | 'click' | 'scroll';
  button?: number;
  deltaY?: number;
}

interface VerificationResult {
  success: boolean;
  similarity_score: number;
  is_anomaly: boolean;
  action_taken: string;
  severity: string;
  session_id: string;
}

interface BehavioralMonitorProps {
  userId: string;
  isActive: boolean;
  triggerInterval?: number; // minutes
  onVerificationComplete?: (result: VerificationResult) => void;
  minDataThreshold?: number;
  pageContext?: string;
  showDebugUI?: boolean;
}

const BehavioralMonitor: React.FC<BehavioralMonitorProps> = ({
  userId,
  isActive,
  triggerInterval = 2,
  onVerificationComplete,
  minDataThreshold = 10,
  pageContext = 'unknown',
  showDebugUI = true
}) => {
  const { userData } = useAuth();
  const [isCollecting, setIsCollecting] = useState(false);
  const [lastVerification, setLastVerification] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'error'>('online');
  
  // Real-time stats
  const [monitoringStats, setMonitoringStats] = useState({
    totalKeystrokes: 0,
    totalMouseEvents: 0,
    verificationsRun: 0,
    anomaliesDetected: 0,
    currentSessionKeystrokes: 0,
    currentSessionMouse: 0,
    averageSimilarity: 0,
    lastSimilarity: 0
  });

  // CRITICAL FIX: Proper data collection refs
  const keystrokesRef = useRef<KeystrokeEvent[]>([]);
  const mouseEventsRef = useRef<MouseEvent[]>([]);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dataCollectionStartRef = useRef<number>(0);
  const statsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastVerificationTimeRef = useRef<number>(0);

  // Get current page context
  const getCurrentPageContext = useCallback(() => {
    const path = window.location.pathname;
    if (path.includes('/chat')) return '/chat';
    if (path.includes('/behavioral-test')) return '/behavioral-test';
    if (path.includes('/dashboard')) return '/dashboard';
    if (path.includes('/profile')) return '/profile';
    if (path.includes('/admin')) return '/admin';
    return pageContext || path;
  }, [pageContext]);

  // Check if we should monitor this page
  const shouldMonitorPage = useCallback(() => {
    const sensitivePages = ['/dashboard', '/profile', '/chat', '/behavioral-test', '/admin'];
    const currentPath = window.location.pathname;
    return sensitivePages.some(page => currentPath.includes(page));
  }, []);

  const handleKeyEvent = useCallback((event: KeyboardEvent) => {
    if (!isActive || !isCollecting || !shouldMonitorPage()) return;

    // Skip function keys, system keys, and navigation keys
    if (event.key.startsWith('F') || 
        ['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Escape', 'CapsLock', 'NumLock', 'ScrollLock'].includes(event.key)) {
      return;
    }

    // Skip if typing in password fields
    const target = event.target as HTMLElement;
    if ((target as any).type === 'password' || target.getAttribute('data-sensitive') === 'true') {
      return;
    }

    const keystrokeEvent: KeystrokeEvent = {
      key: event.key,
      code: event.code,
      timestamp: Date.now(),
      type: event.type as 'keydown' | 'keyup',
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    };

    keystrokesRef.current.push(keystrokeEvent);
    
    // Update real-time stats
    setMonitoringStats(prev => ({
      ...prev,
      totalKeystrokes: prev.totalKeystrokes + 1,
      currentSessionKeystrokes: keystrokesRef.current.length
    }));

    console.log(`🔑 FIXED Monitor: Keystroke captured: ${keystrokeEvent.key} (${keystrokeEvent.type}) on ${getCurrentPageContext()}`);
  }, [isActive, isCollecting, shouldMonitorPage, getCurrentPageContext]);

  const handleMouseEvent = useCallback((event: globalThis.MouseEvent) => {
    if (!isActive || !isCollecting || !shouldMonitorPage()) return;

    let eventType: 'mousemove' | 'click' | 'scroll' = 'mousemove';
    if (event.type === 'click') eventType = 'click';
    if (event.type === 'wheel') eventType = 'scroll';

    // Throttle mousemove events to avoid spam (every 200ms)
    if (eventType === 'mousemove') {
      const lastMouse = mouseEventsRef.current[mouseEventsRef.current.length - 1];
      if (lastMouse && lastMouse.type === 'mousemove' && 
          (Date.now() - lastMouse.timestamp) < 200) {
        return;
      }
    }

    const mouseEventData: MouseEvent = {
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
      type: eventType,
      button: (event as any).button,
      deltaY: (event as any).deltaY
    };

    mouseEventsRef.current.push(mouseEventData);
    
    // Update real-time stats
    setMonitoringStats(prev => ({
      ...prev,
      totalMouseEvents: prev.totalMouseEvents + 1,
      currentSessionMouse: mouseEventsRef.current.length
    }));

    console.log(` FIXED Monitor: Mouse event captured: ${eventType} at (${event.clientX}, ${event.clientY})`);
  }, [isActive, isCollecting, shouldMonitorPage]);

  const runBehavioralVerification = useCallback(async () => {
    if (!isActive || !userId || !shouldMonitorPage()) {
      console.log('⏭FIXED Monitor: Skipping verification - not active or not on monitored page');
      return;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - lastVerificationTimeRef.current;
    
    // Only check every 2 minutes minimum for continuous monitoring
    const minCheckInterval = triggerInterval * 60 * 1000;
    if (timeSinceLastCheck < minCheckInterval) {
      console.log(`⏭ FIXED Monitor: Skipping verification - too soon (${Math.floor(timeSinceLastCheck / 1000)}s ago)`);
      return;
    }

    const keystrokes = [...keystrokesRef.current];
    const mouseEvents = [...mouseEventsRef.current];

    // Check if we have enough data
    if (keystrokes.length < minDataThreshold && mouseEvents.length < minDataThreshold) {
      console.log(`⏭FIXED Monitor: Insufficient data for verification - keystrokes: ${keystrokes.length}, mouse: ${mouseEvents.length}, threshold: ${minDataThreshold}`);
      return;
    }

    try {
      setConnectionStatus('online');
      const currentPageContext = getCurrentPageContext();
      const sessionId = `monitor_${userId}_${now}`;

      console.log(` FIXED Monitor: Running behavioral verification for user ${userId} on ${currentPageContext}`);
      console.log(` FIXED Monitor: Data: ${keystrokes.length} keystrokes, ${mouseEvents.length} mouse events`);

      const behavioralData = {
        keystrokes: keystrokes.map(k => ({
          key: k.key,
          code: k.code,
          timestamp: k.timestamp,
          type: k.type,
          ctrlKey: k.ctrlKey,
          shiftKey: k.shiftKey,
          altKey: k.altKey
        })),
        mouseMovements: mouseEvents.map(m => ({
          x: m.x,
          y: m.y,
          timestamp: m.timestamp,
          type: m.type,
          button: m.button,
          deltaY: m.deltaY
        }))
      };
      const response = await fetch('http://localhost:5000/api/behavioral-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          behavioralData,
          session_id: sessionId,
          check_type: 'continuous_monitoring',
          page_context: currentPageContext,
          monitoring_metadata: {
            trigger_interval: triggerInterval,
            data_threshold: minDataThreshold,
            session_duration: Math.floor((now - dataCollectionStartRef.current) / 1000),
            is_continuous: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`FIXED Monitor: Verification failed: ${response.status} ${response.statusText}`);
      }

      const result: VerificationResult = await response.json();
      
      console.log('✅ FIXED Monitor: Behavioral verification result:', {
        similarity: result.similarity_score,
        action: result.action_taken,
        page: currentPageContext,
        anomaly: result.is_anomaly,
        severity: result.severity,
        session_id: result.session_id
      });

      // Update stats with verification results
      setMonitoringStats(prev => ({
        ...prev,
        verificationsRun: prev.verificationsRun + 1,
        anomaliesDetected: prev.anomaliesDetected + (result.is_anomaly ? 1 : 0),
        lastSimilarity: result.similarity_score || 0,
        averageSimilarity: prev.verificationsRun > 0 
          ? (prev.averageSimilarity * prev.verificationsRun + (result.similarity_score || 0)) / (prev.verificationsRun + 1)
          : (result.similarity_score || 0)
      }));

      setLastVerification(new Date());
      lastVerificationTimeRef.current = now;

      // CRITICAL: Save behavioral session data for persistence
      try {
        const sessionSaveResponse = await fetch('http://localhost:5000/api/save-behavioral-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            session_id: sessionId,
            similarity_scores: {
              overall_similarity: result.similarity_score,
              keystroke_similarity: result.similarity_score, // API doesn't separate these yet
              mouse_similarity: result.similarity_score
            },
            anomaly_score: 1 - (result.similarity_score || 0),
            is_successful: !result.is_anomaly,
            verification_type: 'continuous_monitoring',
            duration_seconds: Math.floor((now - dataCollectionStartRef.current) / 1000),
            page_context: currentPageContext,
            created_at: new Date().toISOString()
          })
        });

        if (sessionSaveResponse.ok) {
          console.log('✅ FIXED Monitor: Behavioral session saved successfully');
        } else {
          console.error('❌ FIXED Monitor: Failed to save behavioral session');
        }
      } catch (sessionError) {
        console.error('❌ FIXED Monitor: Error saving behavioral session:', sessionError);
      }

      // CRITICAL: Save anomaly if detected
      if (result.is_anomaly && result.action_taken !== 'none') {
        console.log(`🚨 FIXED Monitor: Anomaly detected: ${result.severity} - ${result.action_taken}`);
        
        try {
          const anomalySaveResponse = await fetch('http://localhost:5000/api/save-anomaly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              session_id: sessionId,
              anomaly_type: 'continuous_behavioral_monitoring',
              severity: result.severity || 'medium',
              action_taken: result.action_taken,
              score: 1 - (result.similarity_score || 0),
              anomaly_score: 1 - (result.similarity_score || 0),
              details: {
                page: currentPageContext,
                check_type: 'continuous_monitoring',
                keystroke_count: keystrokes.length,
                mouse_count: mouseEvents.length,
                session_duration: Math.floor((now - dataCollectionStartRef.current) / 1000),
                similarity_score: result.similarity_score,
                trigger_interval: triggerInterval,
                monitoring_metadata: {
                  total_session_keystrokes: keystrokesRef.current.length,
                  total_session_mouse: mouseEventsRef.current.length
                }
              },
              created_at: new Date().toISOString()
            })
          });

          if (anomalySaveResponse.ok) {
            console.log('✅ FIXED Monitor: Anomaly saved successfully');
          } else {
            console.error('❌ FIXED Monitor: Failed to save anomaly');
          }
        } catch (anomalyError) {
          console.error('❌ FIXED Monitor: Error saving anomaly:', anomalyError);
        }

        // Trigger real-time update event
        window.dispatchEvent(new CustomEvent('behavioralDataUpdated', {
          detail: { 
            userId, 
            result, 
            sessionId,
            context: 'continuous_monitoring',
            page: currentPageContext,
            severity: result.severity,
            fixed: true
          }
        }));
      }

      // Handle critical anomalies
      if (result.action_taken === 'auto_lock') {
        console.error('🚨 FIXED Monitor: CRITICAL auto-lock triggered by continuous monitoring');
        
        const criticalAlert = `🚨 CRITICAL SECURITY ALERT 🚨\n\n` +
          `Unusual behavioral patterns detected during continuous monitoring.\n\n` +
          `Page: ${currentPageContext}\n` +
          `Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%\n` +
          `Session: ${sessionId}\n\n` +
          `Your account has been flagged for security review.\n` +
          `Please contact security if you believe this is an error.`;
          
        alert(criticalAlert);
      }

      // Call callback if provided
      if (onVerificationComplete) {
        onVerificationComplete(result);
      }

      // Clear data after successful verification to start fresh collection
      keystrokesRef.current = [];
      mouseEventsRef.current = [];
      dataCollectionStartRef.current = Date.now();

      // Reset session counters
      setMonitoringStats(prev => ({
        ...prev,
        currentSessionKeystrokes: 0,
        currentSessionMouse: 0
      }));

    } catch (error) {
      console.error('❌ FIXED Monitor: Behavioral verification error:', error);
      setConnectionStatus('error');
    }
  }, [isActive, userId, minDataThreshold, getCurrentPageContext, shouldMonitorPage, onVerificationComplete, triggerInterval]);

  // CRITICAL FIX: Enhanced Monitoring Lifecycle Management
  const startMonitoring = useCallback(() => {
    if (!isActive || isCollecting || !shouldMonitorPage()) {
      console.log('⏭️ FIXED Monitor: Cannot start - not active, already collecting, or not on monitored page');
      return;
    }

    console.log(`🚀 FIXED Monitor: Starting behavioral monitoring for user ${userId} on ${getCurrentPageContext()} (interval: ${triggerInterval}min)`);
    
    setIsCollecting(true);
    dataCollectionStartRef.current = Date.now();
    lastVerificationTimeRef.current = 0; // Reset to allow immediate first check
    
    // Clear any existing data
    keystrokesRef.current = [];
    mouseEventsRef.current = [];

    // Reset stats for new session
    setMonitoringStats(prev => ({
      ...prev,
      currentSessionKeystrokes: 0,
      currentSessionMouse: 0
    }));

    // CRITICAL FIX: Proper event listener attachment
    console.log('🔗 FIXED Monitor: Attaching event listeners with proper capture');
    
    // Use capture phase for broader event coverage
    document.addEventListener('keydown', handleKeyEvent, { capture: true, passive: true });
    document.addEventListener('keyup', handleKeyEvent, { capture: true, passive: true });
    document.addEventListener('mousemove', handleMouseEvent, { passive: true });
    document.addEventListener('click', handleMouseEvent, { capture: true, passive: true });
    document.addEventListener('wheel', handleMouseEvent, { passive: true });

    // Also add to window for even broader coverage
    window.addEventListener('keydown', handleKeyEvent, { capture: true, passive: true });
    window.addEventListener('keyup', handleKeyEvent, { capture: true, passive: true });

    // Set up periodic verification
    monitoringIntervalRef.current = setInterval(() => {
      runBehavioralVerification();
    }, triggerInterval * 60 * 1000);

    // Set up stats updates every 5 seconds
    statsUpdateIntervalRef.current = setInterval(() => {
      setMonitoringStats(prev => ({
        ...prev,
        currentSessionKeystrokes: keystrokesRef.current.length,
        currentSessionMouse: mouseEventsRef.current.length
      }));
    }, 5000);

    console.log('✅ FIXED Monitor: Behavioral monitoring started with enhanced event handling');
  }, [isActive, userId, triggerInterval, handleKeyEvent, handleMouseEvent, runBehavioralVerification, shouldMonitorPage, getCurrentPageContext]);

  const stopMonitoring = useCallback(() => {
    if (!isCollecting) return;

    console.log('🛑 FIXED Monitor: Stopping behavioral monitoring');
    
    setIsCollecting(false);

    // Clear intervals
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }

    if (statsUpdateIntervalRef.current) {
      clearInterval(statsUpdateIntervalRef.current);
      statsUpdateIntervalRef.current = null;
    }

    // CRITICAL FIX: Proper event listener removal
    console.log('🔗 FIXED Monitor: Removing event listeners');
    
    document.removeEventListener('keydown', handleKeyEvent, true);
    document.removeEventListener('keyup', handleKeyEvent, true);
    document.removeEventListener('mousemove', handleMouseEvent);
    document.removeEventListener('click', handleMouseEvent, true);
    document.removeEventListener('wheel', handleMouseEvent);

    window.removeEventListener('keydown', handleKeyEvent, true);
    window.removeEventListener('keyup', handleKeyEvent, true);

    // Run final verification if we have data
    if (keystrokesRef.current.length > 0 || mouseEventsRef.current.length > 0) {
      console.log('🔍 FIXED Monitor: Running final verification before stop');
      runBehavioralVerification();
    }

    console.log('✅ FIXED Monitor: Behavioral monitoring stopped');
  }, [isCollecting, handleKeyEvent, handleMouseEvent, runBehavioralVerification]);

  // Effect for managing monitoring lifecycle
  useEffect(() => {
    if (isActive && userId && shouldMonitorPage()) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isActive, userId, startMonitoring, stopMonitoring, shouldMonitorPage]);

  // Handle page changes
  useEffect(() => {
    const handleLocationChange = () => {
      if (isCollecting && !shouldMonitorPage()) {
        console.log('🔄 FIXED Monitor: Page changed to non-monitored page, stopping monitoring');
        stopMonitoring();
      } else if (!isCollecting && shouldMonitorPage() && isActive && userId) {
        console.log('🔄 FIXED Monitor: Page changed to monitored page, starting monitoring');
        startMonitoring();
      }
    };

    // Listen for navigation changes
    window.addEventListener('popstate', handleLocationChange);
    
    // For SPA navigation, override pushState and replaceState
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
  }, [isCollecting, shouldMonitorPage, isActive, userId, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  // Connection status helpers
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'online': return 'text-green-400';
      case 'offline': return 'text-yellow-400';
      case 'error': return 'text-red-400';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'online': return '🟢';
      case 'offline': return '🟡';
      case 'error': return '🔴';
    }
  };

  // Only show debug UI in development and on monitored pages
  const shouldShowDebugUI = process.env.NODE_ENV === 'development' && showDebugUI && shouldMonitorPage();

  if (!shouldShowDebugUI) {
    return null; // Hidden in production or non-monitored pages
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 backdrop-blur-md text-green-400 text-xs p-3 rounded-lg border border-green-500/30 font-mono z-50 min-w-[220px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="mr-2">{getConnectionStatusIcon()}</span>
          <span>👁️ FIXED Monitor</span>
        </div>
        <span className={`font-bold ${isCollecting ? 'text-green-400' : 'text-gray-400'}`}>
          {isCollecting ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>📊 Session Keys:</span>
          <span className="text-cyan-400">{monitoringStats.currentSessionKeystrokes}</span>
        </div>
        <div className="flex justify-between">
          <span>🖱️ Session Mouse:</span>
          <span className="text-cyan-400">{monitoringStats.currentSessionMouse}</span>
        </div>
        <div className="flex justify-between">
          <span>✅ Verifications:</span>
          <span className="text-cyan-400">{monitoringStats.verificationsRun}</span>
        </div>
        <div className="flex justify-between">
          <span>🚨 Anomalies:</span>
          <span className={monitoringStats.anomaliesDetected > 0 ? 'text-red-400' : 'text-green-400'}>
            {monitoringStats.anomaliesDetected}
          </span>
        </div>
        <div className="flex justify-between">
          <span>📈 Avg Similarity:</span>
          <span className="text-purple-400">
            {(monitoringStats.averageSimilarity * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>🔄 Total K/M:</span>
          <span className="text-blue-400">
            {monitoringStats.totalKeystrokes}/{monitoringStats.totalMouseEvents}
          </span>
        </div>
        {lastVerification && (
          <div className="text-gray-400 text-xs pt-1 border-t border-green-500/20">
            🕐 Last: {lastVerification.toLocaleTimeString()}
          </div>
        )}
        <div className="text-gray-400 text-xs">
          📍 Page: {getCurrentPageContext()}
        </div>
        <div className="text-gray-400 text-xs">
          ⏱️ Interval: {triggerInterval}m
        </div>
      </div>
      
      {connectionStatus === 'error' && (
        <div className="mt-2 text-red-400 text-xs">
          ⚠️ Connection Error
        </div>
      )}
      
      <div className="mt-2 text-xs text-green-400">
       
      </div>
    </div>
  );
};

export default BehavioralMonitor;