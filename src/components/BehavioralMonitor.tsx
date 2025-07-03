// Fixed BehavioralMonitor.tsx with all TypeScript errors resolved

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Keyboard, 
  MousePointer, 
  CheckCircle, 
  AlertTriangle, 
  X,
  RefreshCw,
  Loader2,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// =====================================
// TYPE DEFINITIONS
// =====================================

interface BehavioralMonitorProps {
  userId: string;
  onVerificationComplete?: (result: VerificationResult) => void;
  triggerInterval?: number; // How often to request verification (in minutes)
  isActive?: boolean; // Allow external control
}

interface VerificationResult {
  success: boolean;
  similarity_score?: number;
  keystroke_similarity?: number;
  mouse_similarity?: number;
  anomaly_detected?: boolean;
  error?: string;
  action?: string;
  session_id?: string;
}

interface AnomalyNotification {
  id: string;
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action_taken: string;
  created_at: string;
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
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

interface MouseEvent {
  x: number;
  y: number;
  timestamp: number;
  type: 'mousemove' | 'click' | 'scroll';
  button?: number;
  velocity?: number;
  pressure?: number;
  deltaX?: number;
  deltaY?: number;
  deltaZ?: number;
  detail?: number;
}

interface SessionStats {
  verificationsCount: number;
  anomaliesDetected: number;
  avgSimilarityScore: number;
  lastAnomalyTime: Date | null;
}

interface SupabaseRealtimePayload {
  new: any;
  old: any;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

// =====================================
// CONSTANTS
// =====================================

const REFERENCE_SENTENCE = "The quick brown fox jumps over the lazy dog.";

// =====================================
// MAIN COMPONENT
// =====================================

const BehavioralMonitor: React.FC<BehavioralMonitorProps> = ({
  userId,
  onVerificationComplete,
  triggerInterval = 15, // Default: every 15 minutes
  isActive = true
}) => {
  // =====================================
  // STATE MANAGEMENT
  // =====================================

  // Core state
  const [showVerification, setShowVerification] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [typedText, setTypedText] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastVerification, setLastVerification] = useState<Date | null>(null);
  
  // Auto-lock state
  const [showAutoLockModal, setShowAutoLockModal] = useState<boolean>(false);
  const [autoLockCountdown, setAutoLockCountdown] = useState<number>(5);
  
  // Real-time notifications
  const [anomalyNotifications, setAnomalyNotifications] = useState<AnomalyNotification[]>([]);
  const [showAnomalyAlert, setShowAnomalyAlert] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  
  // Behavioral data collection
  const [behavioralData, setBehavioralData] = useState<BehavioralData>({
    keystrokes: [],
    mouseMovements: []
  });
  
  // Performance monitoring
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    verificationsCount: 0,
    anomaliesDetected: 0,
    avgSimilarityScore: 0,
    lastAnomalyTime: null
  });
  
  // Refs
  const navigate = useNavigate();
  const realtimeChannelRef = useRef<any>(null);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // =====================================
  // REAL-TIME SUBSCRIPTIONS
  // =====================================

  useEffect(() => {
    if (!userId || !isActive) return;

    // Subscribe to anomaly alerts for this user
    const channel = supabase
      .channel(`user_monitoring_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anomaly_audits',
          filter: `user_id=eq.${userId}`
        },
        (payload: SupabaseRealtimePayload) => {
          console.log('🚨 Real-time anomaly detected:', payload);
          handleRealtimeAnomaly(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`
        },
        (payload: SupabaseRealtimePayload) => {
          console.log('👤 User status changed:', payload);
          handleUserStatusChange(payload.new);
        }
      )
      .subscribe((status: string) => {
        console.log('📡 Realtime subscription status:', status);
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [userId, isActive]);

  // =====================================
  // PERIODIC VERIFICATION TIMER
  // =====================================

  useEffect(() => {
    if (!isActive || showVerification || isCapturing) return;

    const startPeriodicVerification = () => {
      verificationTimerRef.current = setInterval(() => {
        if (!showVerification && !isCapturing) {
          console.log('⏰ Triggering periodic behavioral verification');
          setShowVerification(true);
        }
      }, triggerInterval * 60 * 1000);
    };

    // Start timer with initial delay
    const initialDelay = setTimeout(startPeriodicVerification, 5000);

    return () => {
      clearTimeout(initialDelay);
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
      }
    };
  }, [triggerInterval, isActive, showVerification, isCapturing]);

  // =====================================
  // REAL-TIME EVENT HANDLERS
  // =====================================

  const handleRealtimeAnomaly = useCallback((anomalyData: any) => {
    const notification: AnomalyNotification = {
      id: anomalyData.id,
      anomaly_type: anomalyData.anomaly_type,
      severity: anomalyData.severity,
      action_taken: anomalyData.action_taken,
      created_at: anomalyData.created_at
    };

    setAnomalyNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep last 5
    setShowAnomalyAlert(true);

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      anomaliesDetected: prev.anomaliesDetected + 1,
      lastAnomalyTime: new Date()
    }));

    // Auto-hide after 5 seconds for low severity
    if (notification.severity === 'low') {
      setTimeout(() => setShowAnomalyAlert(false), 5000);
    }

    // Critical anomalies might trigger immediate verification
    if (notification.severity === 'critical' && !showVerification) {
      setShowVerification(true);
    }
  }, [showVerification]);

  const handleUserStatusChange = useCallback((userData: any) => {
    if (userData.status === 'suspended') {
      console.log('🔒 User account suspended via real-time update');
      setShowAutoLockModal(true);
      setAutoLockCountdown(5);
    }
  }, []);

  // =====================================
  // AUTO-LOCK COUNTDOWN
  // =====================================

  useEffect(() => {
    if (showAutoLockModal && autoLockCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoLockCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showAutoLockModal && autoLockCountdown === 0) {
      // Clear auth tokens and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      sessionStorage.clear();
      navigate('/login');
    }
  }, [showAutoLockModal, autoLockCountdown, navigate]);

  // =====================================
  // BEHAVIORAL DATA CAPTURE
  // =====================================

  useEffect(() => {
    if (isCapturing) {
      const keystrokes: KeystrokeEvent[] = [];
      const mouseMovements: MouseEvent[] = [];

      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        keystrokes.push({
          key: e.key,
          code: e.code,
          timestamp: Date.now(),
          type: 'keydown',
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey
        });
      };

      const handleKeyUp = (e: globalThis.KeyboardEvent) => {
        keystrokes.push({
          key: e.key,
          code: e.code,
          timestamp: Date.now(),
          type: 'keyup',
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey
        });
      };

      const handleMouseMove = (e: globalThis.MouseEvent) => {
        // Enhanced mouse tracking with velocity
        if (mouseMovements.length === 0 || 
            Date.now() - mouseMovements[mouseMovements.length - 1].timestamp > 50) {
          const lastMove = mouseMovements[mouseMovements.length - 1];
          const velocity = lastMove ? 
            Math.sqrt(
              Math.pow(e.clientX - lastMove.x, 2) + 
              Math.pow(e.clientY - lastMove.y, 2)
            ) / (Date.now() - lastMove.timestamp) : 0;

          mouseMovements.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: Date.now(),
            type: 'mousemove',
            velocity,
            pressure: (e as any).pressure || 0 // For devices that support it
          });
        }
      };

      const handleClick = (e: globalThis.MouseEvent) => {
        mouseMovements.push({
          x: e.clientX,
          y: e.clientY,
          button: e.button,
          timestamp: Date.now(),
          type: 'click',
          detail: e.detail // Click count
        });
      };

      const handleScroll = (e: WheelEvent) => {
        mouseMovements.push({
          x: e.clientX,
          y: e.clientY,
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          timestamp: Date.now(),
          type: 'scroll'
        });
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('click', handleClick);
      document.addEventListener('wheel', handleScroll);

      // Update behavioral data in real-time
      const updateInterval = setInterval(() => {
        setBehavioralData({
          keystrokes: [...keystrokes],
          mouseMovements: [...mouseMovements]
        });
      }, 100);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleClick);
        document.removeEventListener('wheel', handleScroll);
        clearInterval(updateInterval);
        
        // Save final data
        setBehavioralData({
          keystrokes,
          mouseMovements
        });
      };
    }
  }, [isCapturing]);

  // =====================================
  // VERIFICATION LOGIC
  // =====================================

  const startCapture = useCallback(() => {
    setIsCapturing(true);
    setTypedText('');
    setVerificationResult(null);
    setBehavioralData({
      keystrokes: [],
      mouseMovements: []
    });

    // Generate session ID
    const sessionId = `behavioral_${userId}_${Date.now()}`;
    setActiveSession(sessionId);
  }, [userId]);

  const verifyBehavior = useCallback(async () => {
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/behavioral-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          behavioralData: behavioralData,
          typedText: typedText,
          session_id: activeSession,
          verification_type: 'periodic'
        })
      });

      const result: VerificationResult = await response.json();
      setVerificationResult(result);
      setLastVerification(new Date());

      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        verificationsCount: prev.verificationsCount + 1,
        avgSimilarityScore: (prev.avgSimilarityScore * prev.verificationsCount + (result.similarity_score || 0)) / (prev.verificationsCount + 1)
      }));

      // Handle different response scenarios
      if (result.action === 'auto_lock') {
        console.error('🚨 AUTO-LOCK triggered:', result);
        setShowAutoLockModal(true);
        setAutoLockCountdown(5);
      } else if (result.success) {
        console.log('✅ Behavioral verification passed:', result);
        
        // Auto-close after successful verification
        if (result.similarity_score && result.similarity_score > 0.7) {
          setTimeout(() => {
            handleClose();
          }, 3000);
        }
      } else {
        console.error('❌ Behavioral verification failed:', result);
      }

      if (onVerificationComplete) {
        onVerificationComplete(result);
      }

      // Store verification in local state for analytics
      await storeVerificationResult(result);

    } catch (error) {
      console.error('Network error:', error);
      setVerificationResult({
        success: false,
        error: 'Network error occurred'
      });
    } finally {
      setLoading(false);
      setIsCapturing(false);
    }
  }, [userId, behavioralData, typedText, activeSession, onVerificationComplete]);

  const storeVerificationResult = useCallback(async (result: VerificationResult) => {
    try {
      // Also send to continuous monitoring endpoint
      await fetch('http://localhost:5000/api/behavioral-monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          behavioralData: behavioralData,
          verificationResult: result,
          session_id: activeSession
        })
      });
    } catch (error) {
      console.warn('Failed to store verification result:', error);
    }
  }, [userId, behavioralData, activeSession]);

  const handleClose = useCallback(() => {
    setShowVerification(false);
    setIsCapturing(false);
    setTypedText('');
    setVerificationResult(null);
    setActiveSession(null);
    setBehavioralData({
      keystrokes: [],
      mouseMovements: []
    });
  }, []);

  // =====================================
  // UTILITY FUNCTIONS
  // =====================================

  const getSimilarityColor = useCallback((score: number): string => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  }, []);

  const getSimilarityLabel = useCallback((score: number): string => {
    if (score >= 0.8) return 'Excellent Match';
    if (score >= 0.7) return 'Good Match';
    if (score >= 0.6) return 'Fair Match';
    return 'Poor Match';
  }, []);

  const getSeverityColor = useCallback((severity: string): string => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-900/30 text-red-400';
      case 'high': return 'border-orange-500 bg-orange-900/30 text-orange-400';
      case 'medium': return 'border-yellow-500 bg-yellow-900/30 text-yellow-400';
      default: return 'border-blue-500 bg-blue-900/30 text-blue-400';
    }
  }, []);

  // =====================================
  // RENDER GUARDS
  // =====================================

  if (!isActive) {
    return null;
  }

  // =====================================
  // RENDERING
  // =====================================

  return (
    <>
      {/* Background monitoring indicator */}
      {!showVerification && isActive && (
        <div className="fixed bottom-4 right-4 z-40">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-full p-3 cursor-pointer hover:bg-green-900/30"
            onClick={() => setShowVerification(true)}
          >
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-green-400" />
              <div className="text-xs text-green-400 font-mono">
                MONITORING
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-2 inline-block"></div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Session Stats */}
      {sessionStats.verificationsCount > 0 && (
        <div className="fixed top-20 right-4 z-30">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card rounded p-3 text-xs"
          >
            <div className="text-cyan-400 font-mono">SESSION STATS</div>
            <div className="text-green-400">Verifications: {sessionStats.verificationsCount}</div>
            <div className="text-green-400">Avg Score: {(sessionStats.avgSimilarityScore * 100).toFixed(0)}%</div>
            {sessionStats.anomaliesDetected > 0 && (
              <div className="text-yellow-400">Anomalies: {sessionStats.anomaliesDetected}</div>
            )}
          </motion.div>
        </div>
      )}

      {/* Anomaly Alert Notification */}
      <AnimatePresence>
        {showAnomalyAlert && anomalyNotifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50"
          >
            <div className={`border rounded-lg p-4 max-w-sm ${getSeverityColor(anomalyNotifications[0].severity)}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm">ANOMALY DETECTED</div>
                  <div className="text-xs">{anomalyNotifications[0].anomaly_type.toUpperCase()}</div>
                  <div className="text-xs opacity-70">Action: {anomalyNotifications[0].action_taken}</div>
                </div>
                <button
                  onClick={() => setShowAnomalyAlert(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Verification Modal */}
      <AnimatePresence>
        {showVerification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-modal rounded-lg p-6 max-w-2xl w-full"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                  <Shield className="h-6 w-6 text-green-400" />
                  <h2 className="text-xl font-bold text-green-400">
                    Behavioral Authentication Required
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              {!isCapturing && !verificationResult && (
                <div className="text-center py-8">
                  <div className="flex justify-center space-x-6 mb-6">
                    <div className="text-center">
                      <Keyboard className="h-12 w-12 text-cyan-400 mx-auto mb-2" />
                      <p className="text-cyan-400 text-sm">Keystroke Pattern</p>
                    </div>
                    <div className="text-center">
                      <MousePointer className="h-12 w-12 text-cyan-400 mx-auto mb-2" />
                      <p className="text-cyan-400 text-sm">Mouse Movement</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 mb-6">
                    For security purposes, we need to verify your identity through your typing pattern.
                    This helps protect your account from unauthorized access.
                  </p>
                  
                  {lastVerification && (
                    <p className="text-gray-400 text-sm mb-4">
                      Last verified: {lastVerification.toLocaleTimeString()}
                    </p>
                  )}
                  
                  <button
                    onClick={startCapture}
                    className="terminal-button px-6 py-3 rounded font-bold hover-glow"
                  >
                    START VERIFICATION
                  </button>
                </div>
              )}

              {/* Capture Interface */}
              {isCapturing && (
                <div className="space-y-4">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-400 font-bold mb-2">
                      Please type this sentence exactly:
                    </p>
                    <p className="text-cyan-400 text-lg font-mono">
                      {REFERENCE_SENTENCE}
                    </p>
                  </div>

                  <div className="relative">
                    <textarea
                      value={typedText}
                      onChange={(e) => setTypedText(e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        return false;
                      }}
                      placeholder="Start typing the sentence above..."
                      className="w-full h-32 bg-black/30 border border-green-500/30 rounded p-4 text-green-400 resize-none font-mono"
                      disabled={loading}
                    />
                    
                    <div className="mt-2 flex justify-between items-center text-sm">
                      <div className="flex items-center space-x-4">
                        <span className="text-cyan-400">
                          Characters: {typedText.length} / {REFERENCE_SENTENCE.length}
                        </span>
                        <span className="text-cyan-400">
                          Keystrokes: {behavioralData.keystrokes.length}
                        </span>
                        <span className="text-cyan-400">
                          Mouse events: {behavioralData.mouseMovements.length}
                        </span>
                      </div>
                      
                      {typedText && (
                        <span className={
                          REFERENCE_SENTENCE.startsWith(typedText) 
                            ? "text-green-400" 
                            : "text-red-400"
                        }>
                          {REFERENCE_SENTENCE.startsWith(typedText) ? "✓ Matching" : "✗ Mismatch"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleClose}
                      disabled={loading}
                      className="terminal-button bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={verifyBehavior}
                      disabled={loading || typedText !== REFERENCE_SENTENCE}
                      className="terminal-button px-4 py-2 rounded font-bold hover-glow disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                          Verifying...
                        </>
                      ) : (
                        'VERIFY'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Results Display */}
              {verificationResult && (
                <div className="space-y-4">
                  {verificationResult.success ? (
                    <>
                      <div className="text-center py-4">
                        <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-green-400 mb-2">
                          Verification Successful
                        </h3>
                        
                        <div className="grid grid-cols-3 gap-4 mt-6">
                          <div className="glass-card rounded p-3">
                            <p className="text-gray-400 text-sm">Overall Score</p>
                            <p className={`text-2xl font-bold ${getSimilarityColor(verificationResult.similarity_score || 0)}`}>
                              {((verificationResult.similarity_score || 0) * 100).toFixed(0)}%
                            </p>
                            <p className="text-xs text-gray-400">
                              {getSimilarityLabel(verificationResult.similarity_score || 0)}
                            </p>
                          </div>
                          
                          <div className="glass-card rounded p-3">
                            <p className="text-gray-400 text-sm">Keystroke Match</p>
                            <p className={`text-2xl font-bold ${getSimilarityColor(verificationResult.keystroke_similarity || 0)}`}>
                              {((verificationResult.keystroke_similarity || 0) * 100).toFixed(0)}%
                            </p>
                          </div>
                          
                          <div className="glass-card rounded p-3">
                            <p className="text-gray-400 text-sm">Mouse Pattern</p>
                            <p className={`text-2xl font-bold ${getSimilarityColor(verificationResult.mouse_similarity || 0)}`}>
                              {((verificationResult.mouse_similarity || 0) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        
                        {verificationResult.anomaly_detected && (
                          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
                            <p className="text-yellow-400 text-sm flex items-center justify-center">
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Unusual pattern detected - Additional monitoring active
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-red-400 mb-2">
                        Verification Failed
                      </h3>
                      <p className="text-gray-300 mb-4">
                        {verificationResult.error || 'Unable to verify behavioral pattern'}
                      </p>
                      
                      <button
                        onClick={startCapture}
                        className="terminal-button px-4 py-2 rounded font-bold hover-glow"
                      >
                        <RefreshCw className="h-4 w-4 mr-2 inline" />
                        Try Again
                      </button>
                    </div>
                  )}
                  
                  {verificationResult.success && (
                    <div className="text-center">
                      <button
                        onClick={handleClose}
                        className="terminal-button bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Lock Modal */}
      <AnimatePresence>
        {showAutoLockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-red-900/20 border-2 border-red-500 rounded-lg p-8 max-w-md w-full text-center"
            >
              <Lock className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-500 mb-4">
                ACCOUNT SUSPENDED
              </h2>
              <p className="text-white mb-6">
                Your account has been suspended due to suspicious behavior.
              </p>
              <p className="text-gray-300 mb-2">
                Behavioral similarity score: {((verificationResult?.similarity_score || 0) * 100).toFixed(0)}%
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Required minimum: 40%
              </p>
              <div className="text-3xl font-bold text-red-400">
                Redirecting in {autoLockCountdown}...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styles */}
      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .glass-modal {
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .terminal-button {
          background: linear-gradient(45deg, #059669, #0891b2);
          color: white;
          border: 1px solid #10b981;
          transition: all 0.3s ease;
        }

        .terminal-button:hover:not(:disabled) {
          background: linear-gradient(45deg, #0891b2, #059669);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
          transform: translateY(-2px);
        }

        .hover-glow {
          transition: all 0.3s ease;
        }

        .hover-glow:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6);
        }
      `}</style>
    </>
  );
};

export default BehavioralMonitor;