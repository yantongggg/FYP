// Enhanced BehavioralMonitor.tsx - CRITICAL FIX for anomaly detection and saving

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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

interface BehavioralData {
  keystrokes: KeystrokeEvent[];
  mouseMovements: MouseEvent[];
  startTime: number;
  endTime: number;
  pageContext: string;
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
}

const BehavioralMonitor: React.FC<BehavioralMonitorProps> = ({
  userId,
  isActive,
  triggerInterval = 3, // Default 3 minutes
  onVerificationComplete,
  minDataThreshold = 15, // Minimum events before verification
  pageContext = 'unknown'
}) => {
  const { userData } = useAuth();
  const [isCollecting, setIsCollecting] = useState(false);
  const [lastVerification, setLastVerification] = useState<Date | null>(null);
  const [monitoringStats, setMonitoringStats] = useState({
    totalKeystrokes: 0,
    totalMouseEvents: 0,
    verificationsRun: 0,
    anomaliesDetected: 0
  });

  // Data collection refs
  const keystrokesRef = useRef<KeystrokeEvent[]>([]);
  const mouseEventsRef = useRef<MouseEvent[]>([]);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dataCollectionStartRef = useRef<number>(0);

  // ========== CRITICAL: Enhanced Event Handlers ==========

  const handleKeyEvent = useCallback((event: Event) => {
    if (!isActive || !isCollecting) return;

    const keyEvent = event as unknown as KeyboardEvent;
    
    // Skip function keys and modifier-only keys
    if (keyEvent.key.startsWith('F') || 
        ['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Escape'].includes(keyEvent.key)) {
      return;
    }

    const keystrokeEvent: KeystrokeEvent = {
      key: keyEvent.key,
      code: keyEvent.code,
      timestamp: Date.now(),
      type: event.type as 'keydown' | 'keyup',
      ctrlKey: keyEvent.ctrlKey,
      shiftKey: keyEvent.shiftKey,
      altKey: keyEvent.altKey
    };

    keystrokesRef.current.push(keystrokeEvent);
    
    // Update stats
    setMonitoringStats(prev => ({
      ...prev,
      totalKeystrokes: prev.totalKeystrokes + 1
    }));

    console.log(`🔑 Captured keystroke: ${keystrokeEvent.key} (${keystrokeEvent.type})`);
  }, [isActive, isCollecting]);

  const handleMouseEvent = useCallback((event: Event) => {
    if (!isActive || !isCollecting) return;

    const mouseEvent = event as unknown as MouseEvent;
    
    let eventType: 'mousemove' | 'click' | 'scroll' = 'mousemove';
    if (event.type === 'click') eventType = 'click';
    if (event.type === 'wheel') eventType = 'scroll';

    const mouseEventData: MouseEvent = {
      x: (mouseEvent as any).clientX || 0,
      y: (mouseEvent as any).clientY || 0,
      timestamp: Date.now(),
      type: eventType,
      button: (mouseEvent as any).button,
      deltaY: (mouseEvent as any).deltaY
    };

    mouseEventsRef.current.push(mouseEventData);
    
    // Update stats
    setMonitoringStats(prev => ({
      ...prev,
      totalMouseEvents: prev.totalMouseEvents + 1
    }));

  }, [isActive, isCollecting]);

  // ========== CRITICAL: Enhanced Behavioral Verification ==========

  const runBehavioralVerification = useCallback(async () => {
    if (!isActive || !userId) return;

    const keystrokes = keystrokesRef.current;
    const mouseEvents = mouseEventsRef.current;

    console.log(`🔍 Running behavioral verification: ${keystrokes.length} keystrokes, ${mouseEvents.length} mouse events`);

    // Check if we have enough data
    if (keystrokes.length < minDataThreshold && mouseEvents.length < minDataThreshold) {
      console.log(`⚠️ Insufficient data for verification (need ${minDataThreshold} events)`);
      return;
    }

    try {
      const currentPageContext = pageContext || window.location.pathname;
      const sessionId = `monitor_${userId}_${Date.now()}`;

      const behavioralData: BehavioralData = {
        keystrokes,
        mouseMovements: mouseEvents,
        startTime: dataCollectionStartRef.current,
        endTime: Date.now(),
        pageContext: currentPageContext
      };

      console.log(`📡 Sending behavioral verification request for user ${userId}`);

      // CRITICAL: Send to behavioral verification endpoint
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
          page_context: currentPageContext
        })
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('✅ Behavioral verification result:', result);

      // Update stats
      setMonitoringStats(prev => ({
        ...prev,
        verificationsRun: prev.verificationsRun + 1,
        anomaliesDetected: prev.anomaliesDetected + (result.is_anomaly ? 1 : 0)
      }));

      setLastVerification(new Date());

      // CRITICAL: Save detailed results if anomaly detected
      if (result.is_anomaly) {
        console.log(`🚨 Anomaly detected! Similarity: ${result.similarity_score}, Action: ${result.action_taken}`);
        
        // Save behavioral session
        await saveBehavioralSession({
          user_id: userId,
          session_id: sessionId,
          similarity_scores: {
            overall_similarity: result.similarity_score,
            keystroke_similarity: result.keystroke_similarity || result.similarity_score,
            mouse_similarity: result.mouse_similarity || result.similarity_score
          },
          anomaly_score: result.anomaly_score,
          is_successful: !result.is_anomaly,
          verification_type: 'continuous_monitoring',
          duration_seconds: Math.floor((Date.now() - dataCollectionStartRef.current) / 1000),
          page_context: currentPageContext
        });

        // Save anomaly record
        await saveAnomaly({
          user_id: userId,
          session_id: sessionId,
          anomaly_type: 'continuous_behavioral_monitoring',
          score: result.anomaly_score,
          severity: result.severity,
          action_taken: result.action_taken,
          details: {
            similarity_score: result.similarity_score,
            page_context: currentPageContext,
            thresholds: result.thresholds,
            keystroke_count: keystrokes.length,
            mouse_count: mouseEvents.length,
            monitoring_duration: Math.floor((Date.now() - dataCollectionStartRef.current) / 1000)
          }
        });

        // Trigger custom event for real-time updates
        window.dispatchEvent(new CustomEvent('behavioralDataUpdated', {
          detail: { userId, result, sessionId }
        }));
      }

      // Call callback if provided
      if (onVerificationComplete) {
        onVerificationComplete(result);
      }

      // Clear data after successful verification
      keystrokesRef.current = [];
      mouseEventsRef.current = [];
      dataCollectionStartRef.current = Date.now();

    } catch (error) {
      console.error('❌ Behavioral verification error:', error);
    }
  }, [isActive, userId, minDataThreshold, pageContext, onVerificationComplete]);

  // ========== CRITICAL: Data Persistence Functions ==========

  const saveBehavioralSession = async (sessionData: any) => {
    try {
      const response = await fetch('http://localhost:5000/api/save-behavioral-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        throw new Error(`Failed to save session: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Behavioral session saved:', result);
      return result;
    } catch (error) {
      console.error('❌ Error saving behavioral session:', error);
      throw error;
    }
  };

  const saveAnomaly = async (anomalyData: any) => {
    try {
      const response = await fetch('http://localhost:5000/api/save-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anomalyData)
      });

      if (!response.ok) {
        throw new Error(`Failed to save anomaly: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🚨 Anomaly saved:', result);
      return result;
    } catch (error) {
      console.error('❌ Error saving anomaly:', error);
      throw error;
    }
  };

  // ========== CRITICAL: Monitoring Lifecycle Management ==========

  const startMonitoring = useCallback(() => {
    if (!isActive || isCollecting) return;

    console.log(`🚀 Starting behavioral monitoring for user ${userId} (interval: ${triggerInterval}min)`);
    
    setIsCollecting(true);
    dataCollectionStartRef.current = Date.now();
    
    // Clear any existing data
    keystrokesRef.current = [];
    mouseEventsRef.current = [];

    // Set up periodic verification
    monitoringIntervalRef.current = setInterval(() => {
      runBehavioralVerification();
    }, triggerInterval * 60 * 1000); // Convert minutes to milliseconds

    // Add event listeners
    document.addEventListener('keydown', handleKeyEvent, true);
    document.addEventListener('keyup', handleKeyEvent, true);
    document.addEventListener('mousemove', handleMouseEvent, true);
    document.addEventListener('click', handleMouseEvent, true);
    document.addEventListener('wheel', handleMouseEvent, true);

    console.log('✅ Behavioral monitoring started');
  }, [isActive, userId, triggerInterval, handleKeyEvent, handleMouseEvent, runBehavioralVerification]);

  const stopMonitoring = useCallback(() => {
    if (!isCollecting) return;

    console.log('🛑 Stopping behavioral monitoring');
    
    setIsCollecting(false);

    // Clear interval
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }

    // Remove event listeners
    document.removeEventListener('keydown', handleKeyEvent, true);
    document.removeEventListener('keyup', handleKeyEvent, true);
    document.removeEventListener('mousemove', handleMouseEvent, true);
    document.removeEventListener('click', handleMouseEvent, true);
    document.removeEventListener('wheel', handleMouseEvent, true);

    // Run final verification if we have data
    if (keystrokesRef.current.length > 0 || mouseEventsRef.current.length > 0) {
      runBehavioralVerification();
    }

    console.log('✅ Behavioral monitoring stopped');
  }, [isCollecting, handleKeyEvent, handleMouseEvent, runBehavioralVerification]);

  // ========== EFFECT HOOKS ==========

  useEffect(() => {
    if (isActive && userId) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isActive, userId, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  // ========== RENDER ==========

  // This component is invisible but provides monitoring info in console/callbacks
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-4 right-4 bg-black/80 text-green-400 text-xs p-2 rounded border border-green-500/30 font-mono z-50">
        <div>👁️ Behavioral Monitor: {isCollecting ? 'ACTIVE' : 'INACTIVE'}</div>
        <div>📊 Keystrokes: {monitoringStats.totalKeystrokes}</div>
        <div>🖱️ Mouse: {monitoringStats.totalMouseEvents}</div>
        <div>✅ Verifications: {monitoringStats.verificationsRun}</div>
        <div>🚨 Anomalies: {monitoringStats.anomaliesDetected}</div>
        {lastVerification && (
          <div>🕐 Last: {lastVerification.toLocaleTimeString()}</div>
        )}
      </div>
    );
  }

  return null;
};

export default BehavioralMonitor;