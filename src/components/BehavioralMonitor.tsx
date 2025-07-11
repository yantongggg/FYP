// CRITICAL FIXES for Frontend Components - Data Loading & Global Monitoring

// 1. FIXED: Enhanced BehavioralMonitor.tsx - Global Monitoring with Guaranteed Data Saving

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Activity,
  TrendingDown,
  Lock,
  X,
  Eye,
  Shield,
  Database,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BehavioralMonitorProps {
  userId: string;
  onVerificationComplete?: (result: any) => void;
  triggerInterval?: number; // How often to check (in minutes)
  isActive?: boolean;
}

interface BehavioralData {
  keystrokes: any[];
  mouseMovements: any[];
}

const BehavioralMonitor: React.FC<BehavioralMonitorProps> = ({
  userId,
  onVerificationComplete,
  triggerInterval = 2, // Check every 2 minutes for better responsiveness
  isActive = true
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Enhanced state management
  const [showAutoLockModal, setShowAutoLockModal] = useState(false);
  const [autoLockCountdown, setAutoLockCountdown] = useState(5);
  const [showAnomalyAlert, setShowAnomalyAlert] = useState(false);
  const [latestAnomaly, setLatestAnomaly] = useState<any>(null);
  const [monitoringActive, setMonitoringActive] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [checksPerformed, setChecksPerformed] = useState(0);
  const [dataQuality, setDataQuality] = useState({ keystrokes: 0, mouse: 0 });
  const [lastSaveResult, setLastSaveResult] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');
  
  // Refs for data persistence
  const monitoringTimerRef = useRef<NodeJS.Timeout | null>(null);
  const behavioralDataRef = useRef<BehavioralData>({
    keystrokes: [],
    mouseMovements: []
  });

  // CRITICAL: Define sensitive pages that need monitoring
  const sensitivePages = ['/dashboard', '/profile', '/ekyc', '/chat', '/behavioral-test', '/admin', '/userhome'];
  const isOnSensitivePage = sensitivePages.some(page => location.pathname.includes(page));

  // Auto-lock countdown with enhanced functionality
  useEffect(() => {
    if (showAutoLockModal && autoLockCountdown > 0) {
      const timer = setTimeout(() => {
        setAutoLockCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showAutoLockModal && autoLockCountdown === 0) {
      // Auto-logout with cleanup
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      sessionStorage.clear();
      navigate('/login');
    }
  }, [showAutoLockModal, autoLockCountdown, navigate]);

  // CRITICAL: Enhanced continuous data capture with better filtering
  useEffect(() => {
    if (!isActive || !monitoringActive || !isOnSensitivePage || !userId) return;

    console.log(`🔍 Starting enhanced behavioral monitoring for user ${userId} on page: ${location.pathname}`);

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Enhanced filtering - skip system keys and sensitive operations
      if (['F12', 'F11', 'Alt', 'Control', 'Meta', 'Tab', 'Escape'].includes(e.key)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      
      const keystroke = {
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keydown',
        page: location.pathname,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      };
      
      behavioralDataRef.current.keystrokes.push(keystroke);

      // Keep only recent data (last 5 minutes) with size limit
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      behavioralDataRef.current.keystrokes = behavioralDataRef.current.keystrokes
        .filter(k => k.timestamp > fiveMinutesAgo)
        .slice(-150); // Increased limit for better analysis
    };

    const handleKeyUp = (e: globalThis.KeyboardEvent) => {
      if (['F12', 'F11', 'Alt', 'Control', 'Meta', 'Tab', 'Escape'].includes(e.key)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      
      const keystroke = {
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keyup',
        page: location.pathname,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      };
      
      behavioralDataRef.current.keystrokes.push(keystroke);
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const now = Date.now();
      const recentMouse = behavioralDataRef.current.mouseMovements;
      
      // Enhanced throttling with velocity calculation
      if (recentMouse.length === 0 || now - recentMouse[recentMouse.length - 1].timestamp > 100) {
        const lastMove = recentMouse[recentMouse.length - 1];
        let velocity = 0;
        
        if (lastMove) {
          const dx = e.clientX - lastMove.x;
          const dy = e.clientY - lastMove.y;
          const dt = now - lastMove.timestamp;
          velocity = Math.sqrt(dx * dx + dy * dy) / (dt || 1);
        }
        
        const mouseEvent = {
          x: e.clientX,
          y: e.clientY,
          timestamp: now,
          type: 'mousemove',
          page: location.pathname,
          velocity: velocity
        };
        
        behavioralDataRef.current.mouseMovements.push(mouseEvent);

        // Keep only recent data
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        behavioralDataRef.current.mouseMovements = behavioralDataRef.current.mouseMovements
          .filter(m => m.timestamp > fiveMinutesAgo)
          .slice(-200); // Increased limit for better analysis
      }
    };

    const handleClick = (e: globalThis.MouseEvent) => {
      const clickEvent = {
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        type: 'click',
        button: e.button,
        page: location.pathname
      };
      
      behavioralDataRef.current.mouseMovements.push(clickEvent);
    };

    const handleScroll = () => {
      const scrollEvent = {
        x: window.scrollX,
        y: window.scrollY,
        timestamp: Date.now(),
        type: 'scroll',
        page: location.pathname,
        deltaY: 0
      };
      
      behavioralDataRef.current.mouseMovements.push(scrollEvent);
    };

    // Add event listeners with better error handling
    try {
      document.addEventListener('keydown', handleKeyDown, { passive: true });
      document.addEventListener('keyup', handleKeyUp, { passive: true });
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('click', handleClick, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });
    } catch (error) {
      console.error('❌ Error adding event listeners:', error);
      setConnectionStatus('error');
    }

    // Update data quality metrics every 2 seconds
    const qualityInterval = setInterval(() => {
      setDataQuality({
        keystrokes: behavioralDataRef.current.keystrokes.length,
        mouse: behavioralDataRef.current.mouseMovements.length
      });
    }, 2000);

    return () => {
      try {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleClick);
        window.removeEventListener('scroll', handleScroll);
        clearInterval(qualityInterval);
      } catch (error) {
        console.error('❌ Error removing event listeners:', error);
      }
    };
  }, [isActive, monitoringActive, location.pathname, isOnSensitivePage, userId]);

  // CRITICAL: Enhanced periodic monitoring checks with guaranteed data saving
  useEffect(() => {
    if (!isActive || !monitoringActive || !isOnSensitivePage || !userId) return;

    const performBehavioralCheck = async () => {
      const { keystrokes, mouseMovements } = behavioralDataRef.current;
      
      // Need minimum data for meaningful check
      if (keystrokes.length < 8) {
        console.log('🔄 Insufficient behavioral data for monitoring check (need 8+ keystrokes)');
        setConnectionStatus('connected');
        return;
      }

      try {
        console.log(`🔍 Performing enhanced behavioral check for user ${userId} on ${location.pathname}`);
        console.log(`📊 Data quality: ${keystrokes.length} keystrokes, ${mouseMovements.length} mouse events`);
        
        setConnectionStatus('connected');
        
        // CRITICAL: Use the fixed API endpoint with enhanced data
        const response = await fetch('http://localhost:5000/api/behavioral-monitor', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            behavioralData: {
              keystrokes: keystrokes.slice(-80), // Last 80 keystrokes for better analysis
              mouseMovements: mouseMovements.slice(-120) // Last 120 mouse events
            },
            page_context: location.pathname
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setLastCheckTime(new Date());
        setChecksPerformed(prev => prev + 1);
        setLastSaveResult(result);

        console.log('✅ Enhanced behavioral check result:', {
          similarity: result.similarity_score,
          action: result.action_taken,
          page: location.pathname,
          session_id: result.session_id,
          data_saved: result.data_saved
        });

        // CRITICAL: Handle responses based on action taken
        if (result.action_taken === 'auto_lock') {
          console.error('🚨 AUTO-LOCK triggered by continuous monitoring');
          setLatestAnomaly({
            type: 'critical_behavioral_anomaly',
            severity: 'critical',
            similarity: result.similarity_score,
            timestamp: new Date(),
            session_id: result.session_id,
            action: 'auto_lock'
          });
          setShowAutoLockModal(true);
          setAutoLockCountdown(5);

        } else if (result.action_taken === 'anomaly_logged') {
          console.warn('⚠️ Anomaly detected in continuous monitoring');

          setLatestAnomaly({
            type: 'behavioral_monitoring',
            severity: result.severity || 'medium',
            similarity: result.similarity_score,
            timestamp: new Date(),
            session_id: result.session_id,
            action: result.action_taken
          });
          setShowAnomalyAlert(true);

          // Auto-hide non-critical alerts
          if (result.severity !== 'critical') {
            setTimeout(() => setShowAnomalyAlert(false), 10000);
          }
        }

        // CRITICAL: Trigger custom event for other components to listen
        const customEvent = new CustomEvent('behavioralDataUpdated', {
          detail: {
            userId,
            result,
            timestamp: new Date().toISOString(),
            dataQuality,
            page: location.pathname
          }
        });
        window.dispatchEvent(customEvent);

        if (onVerificationComplete) {
          onVerificationComplete(result);
        }

      } catch (error) {
        console.error('❌ Enhanced monitoring error:', error);
        setConnectionStatus('error');
        setChecksPerformed(prev => prev + 1); // Still count as an attempt
        
        // Set connection back to connected after a delay
        setTimeout(() => setConnectionStatus('connected'), 5000);
      }
    };

    // Start periodic checks with initial delay
    const initialDelay = setTimeout(() => {
      monitoringTimerRef.current = setInterval(performBehavioralCheck, triggerInterval * 60 * 1000);
      performBehavioralCheck(); // Run first check immediately
    }, 30000); // 30 seconds initial delay

    return () => {
      clearTimeout(initialDelay);
      if (monitoringTimerRef.current) {
        clearInterval(monitoringTimerRef.current);
      }
    };
  }, [isActive, monitoringActive, triggerInterval, location.pathname, isOnSensitivePage, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringTimerRef.current) {
        clearInterval(monitoringTimerRef.current);
      }
    };
  }, []);

  // Don't render if not active or not on sensitive page
  if (!isActive || !isOnSensitivePage || !userId) return null;

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400 border-green-500/30';
      case 'disconnected': return 'text-yellow-400 border-yellow-500/30';
      case 'error': return 'text-red-400 border-red-500/30';
    }
  };

  return (
    <>
      {/* CRITICAL: Enhanced Monitoring Status Indicator */}
      {monitoringActive && (
        <div className="fixed bottom-4 left-4 z-40">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-lg p-3 cursor-pointer hover:bg-green-900/30 transition-all duration-300"
            onClick={() => setMonitoringActive(!monitoringActive)}
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Activity className="h-5 w-5 text-green-400" />
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse ${
                  connectionStatus === 'connected' ? 'bg-green-400' :
                  connectionStatus === 'disconnected' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
              </div>
              <div className="text-xs">
                <div className="text-green-400 font-bold">ENHANCED MONITOR</div>
                <div className="text-cyan-400">
                  User: {userId.slice(-8)}... | Every {triggerInterval}m
                </div>
                <div className="text-cyan-400">
                  Checks: {checksPerformed} | Status: {connectionStatus.toUpperCase()}
                </div>
                {lastCheckTime && (
                  <div className="text-gray-400">
                    Last: {lastCheckTime.toLocaleTimeString()}
                  </div>
                )}
                <div className="text-yellow-400 text-xs">
                  Data: K:{dataQuality.keystrokes} M:{dataQuality.mouse}
                </div>
                <div className="text-purple-400 text-xs">
                  Page: {location.pathname.split('/').pop() || 'root'}
                </div>
                {lastSaveResult?.data_saved && (
                  <div className="flex items-center text-xs">
                    {lastSaveResult.data_saved.session_saved ? (
                      <CheckCircle className="h-3 w-3 text-green-400 mr-1" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-400 mr-1" />
                    )}
                    <span className={lastSaveResult.data_saved.session_saved ? 'text-green-400' : 'text-red-400'}>
                      DB: {lastSaveResult.data_saved.session_saved ? 'SAVED' : 'FAILED'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Enhanced Anomaly Alert with better information */}
      <AnimatePresence>
        {showAnomalyAlert && latestAnomaly && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50 max-w-sm"
          >
            <div className={`border rounded-lg p-4 ${
              latestAnomaly.severity === 'critical' ? 'border-red-500 bg-red-900/30 text-red-400' :
              latestAnomaly.severity === 'high' ? 'border-orange-500 bg-orange-900/30 text-orange-400' :
              'border-yellow-500 bg-yellow-900/30 text-yellow-400'
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  <div>
                    <div className="font-bold text-sm">🚨 BEHAVIORAL ANOMALY</div>
                    <div className="text-xs opacity-90">
                      User: {userId.slice(-8)}...
                    </div>
                    <div className="text-xs opacity-90">
                      Similarity: {(latestAnomaly.similarity * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs opacity-70">
                      Page: {location.pathname}
                    </div>
                    <div className="text-xs opacity-70">
                      Action: {latestAnomaly.action}
                    </div>
                    {latestAnomaly.session_id && (
                      <div className="text-xs opacity-60">
                        ID: {latestAnomaly.session_id.slice(-8)}
                      </div>
                    )}
                  </div>
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

      {/* CRITICAL: Enhanced Auto-Lock Modal */}
      <AnimatePresence>
        {showAutoLockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-red-900/30 border-2 border-red-500 rounded-lg p-8 max-w-md w-full text-center"
            >
              <div className="mb-4">
                <Lock className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <TrendingDown className="h-8 w-8 text-red-400 mx-auto" />
              </div>
              <h2 className="text-2xl font-bold text-red-500 mb-4">
                🚨 CRITICAL SECURITY BREACH
              </h2>
              <p className="text-white mb-4">
                Your behavioral patterns have changed significantly. 
                For security, your session will be terminated.
              </p>
              <div className="bg-black/30 rounded p-3 mb-4">
                <div className="text-gray-300 text-sm space-y-1">
                  <div>🔍 Enhanced monitoring detected critical anomaly</div>
                  <div>👤 User: {userId.slice(-8)}...</div>
                  <div>📍 Page: {location.pathname}</div>
                  <div>⏰ Session automatically terminated for security</div>
                  <div>📊 Data: {dataQuality.keystrokes}K/{dataQuality.mouse}M events</div>
                  {latestAnomaly?.similarity && (
                    <div>📈 Similarity: {(latestAnomaly.similarity * 100).toFixed(1)}%</div>
                  )}
                </div>
              </div>
              <div className="text-3xl font-bold text-red-400 mb-2">
                LOGGING OUT IN {autoLockCountdown}...
              </div>
              <div className="text-sm text-gray-400">
                Contact administrator if this is an error
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Monitoring Controls */}
      <div className="fixed bottom-4 right-4 z-40">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded p-2"
        >
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => setMonitoringActive(!monitoringActive)}
              className={`w-full px-3 py-1 rounded text-xs font-bold transition-all ${
                monitoringActive 
                  ? 'bg-green-600/30 text-green-400 border border-green-500/30' 
                  : 'bg-gray-600/30 text-gray-400 border border-gray-500/30'
              }`}
            >
              <Eye className="h-3 w-3 mr-1 inline" />
              {monitoringActive ? 'MONITOR ON' : 'MONITOR OFF'}
            </button>
            
            {isOnSensitivePage && (
              <div className="text-xs text-center">
                <div className={`px-2 py-1 rounded text-xs border ${getConnectionStatusColor()}`}>
                  <Database className="h-3 w-3 mr-1 inline" />
                  {connectionStatus.toUpperCase()}
                </div>
                <div className={`px-2 py-1 rounded text-xs mt-1 ${
                  dataQuality.keystrokes > 30 ? 'bg-green-600/20 text-green-400' :
                  dataQuality.keystrokes > 15 ? 'bg-yellow-600/20 text-yellow-400' :
                  'bg-red-600/20 text-red-400'
                }`}>
                  Quality: {dataQuality.keystrokes > 30 ? 'High' : 
                           dataQuality.keystrokes > 15 ? 'Med' : 'Low'}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Styles */}
      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
      `}</style>
    </>
  );
};

export default BehavioralMonitor;