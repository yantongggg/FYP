// Enhanced BehavioralTestPage.tsx - Better UI + Proper Data Flow

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Keyboard, 
  MousePointer, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  BarChart3,
  Zap,
  Shield,
  TrendingDown,
  Database,
  Edit3,
  Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TestResult {
  similarity_score: number;
  is_anomaly: boolean;
  action_taken: string;
  severity: string;
  session_id: string;
  supabase_saved: boolean;
  threshold: number;
}

interface BehavioralData {
  keystrokes: any[];
  mouseMovements: any[];
}

const BehavioralTestPage: React.FC = () => {
  const { userData } = useAuth();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [behavioralData, setBehavioralData] = useState<BehavioralData>({
    keystrokes: [],
    mouseMovements: []
  });
  
  // Enhanced UI state
  const [typedText, setTypedText] = useState('');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [testPhase, setTestPhase] = useState<'typing' | 'scrolling' | 'complete'>('typing');
  
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const REFERENCE_TEXT = "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the alphabet and is commonly used for typing tests. Please type this sentence naturally to establish your baseline behavioral pattern.";

  // Start the enhanced test
  const startTest = () => {
    if (!userData?.uid) return;
    
    setIsTestRunning(true);
    setCountdown(30); // Extended to 30 seconds for better data
    setTestResult(null);
    setTypedText('');
    setScrollPosition(0);
    setTestPhase('typing');
    setBehavioralData({ keystrokes: [], mouseMovements: [] });
    
    // Start countdown
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 16) {
          // Switch to scrolling phase at 15 seconds
          if (prev === 16) {
            setTestPhase('scrolling');
          }
        }
        if (prev <= 1) {
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Enhanced test completion
  const finishTest = async () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    setIsTestRunning(false);
    setTestPhase('complete');
    
    if (!userData?.uid || behavioralData.keystrokes.length === 0) {
      alert('Not enough data collected. Please type and move mouse during the test.');
      return;
    }

    try {
      console.log('🔍 Sending enhanced behavioral data:', {
        keystrokeCount: behavioralData.keystrokes.length,
        mouseCount: behavioralData.mouseMovements.length,
        typedText: typedText,
        scrollDistance: scrollPosition
      });

      const response = await fetch('http://localhost:5000/api/behavioral-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userData.uid,
          behavioralData: {
            ...behavioralData,
            typedText: typedText,
            scrollDistance: scrollPosition,
            testDuration: 30,
            expectedText: REFERENCE_TEXT
          },
          session_id: `test_${userData.uid}_${Date.now()}`,
          test_mode: true
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTestResult(result);
        console.log('✅ Enhanced test completed:', result);
        
        // Trigger a refresh of parent data if available
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage({ type: 'BEHAVIORAL_DATA_UPDATED' }, '*');
        }
      } else {
        alert(`Test failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Test error:', error);
      alert('Failed to run behavioral test');
    }
  };

  // Enhanced behavioral event capture
  useEffect(() => {
    if (!isTestRunning) return;

    const keystrokes: any[] = [];
    const mouseMovements: any[] = [];

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!isTestRunning) return;
      
      keystrokes.push({
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keydown',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey
      });
    };

    const handleKeyUp = (e: globalThis.KeyboardEvent) => {
      if (!isTestRunning) return;
      
      keystrokes.push({
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keyup',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey
      });
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isTestRunning) return;
      
      // Enhanced mouse tracking with velocity
      if (mouseMovements.length === 0 || 
          Date.now() - mouseMovements[mouseMovements.length - 1].timestamp > 50) {
        
        const lastMove = mouseMovements[mouseMovements.length - 1];
        let velocity = 0;
        if (lastMove) {
          const dx = e.clientX - lastMove.x;
          const dy = e.clientY - lastMove.y;
          const dt = Date.now() - lastMove.timestamp;
          velocity = Math.sqrt(dx * dx + dy * dy) / dt;
        }
        
        mouseMovements.push({
          x: e.clientX,
          y: e.clientY,
          timestamp: Date.now(),
          type: 'mousemove',
          velocity: velocity
        });
      }
    };

    const handleClick = (e: globalThis.MouseEvent) => {
      if (!isTestRunning) return;
      
      mouseMovements.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        type: 'click',
        button: e.button
      });
    };

    const handleScroll = (e: globalThis.Event) => {
      if (!isTestRunning || testPhase !== 'scrolling') return;
      
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setScrollPosition(scrollY);
      
      mouseMovements.push({
        x: 0,
        y: scrollY,
        timestamp: Date.now(),
        type: 'scroll',
        delta: scrollY - scrollPosition
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    // Update behavioral data every 100ms
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
      window.removeEventListener('scroll', handleScroll);
      clearInterval(updateInterval);
    };
  }, [isTestRunning, testPhase, scrollPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const getPhaseInstruction = () => {
    switch (testPhase) {
      case 'typing':
        return "Phase 1: Type the reference text naturally in the box below";
      case 'scrolling':
        return "Phase 2: Scroll up and down in the content area to capture mouse patterns";
      case 'complete':
        return "Test completed! Analyzing your behavioral patterns...";
      default:
        return "Click start to begin the behavioral analysis test";
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-lg p-6">
        <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center">
          <Activity className="mr-3 h-6 w-6" />
          ENHANCED BEHAVIORAL TEST
        </h3>
        
        <p className="text-cyan-400 mb-6">
          This enhanced test captures comprehensive typing and mouse patterns through structured phases. 
          Complete both typing and scrolling phases for accurate behavioral analysis.
        </p>

        {/* Test Controls */}
        {!isTestRunning && !testResult && (
          <div className="text-center">
            <button
              onClick={startTest}
              className="terminal-button px-6 py-3 rounded font-bold hover-glow"
              disabled={!userData?.uid}
            >
              <Zap className="h-5 w-5 mr-2 inline" />
              START 30-SECOND ENHANCED TEST
            </button>
            {!userData?.uid && (
              <p className="text-red-400 text-sm mt-2">Please log in to run the test</p>
            )}
          </div>
        )}

        {/* Test Running */}
        {isTestRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
              <h4 className="text-2xl font-bold text-green-400 mb-2">
                🧪 TEST IN PROGRESS
              </h4>
              <div className="text-6xl font-bold text-cyan-400 mb-4">
                {countdown}
              </div>
              <p className="text-green-400 mb-4">
                {getPhaseInstruction()}
              </p>
              
              {/* Live Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="glass-card rounded p-3">
                  <Keyboard className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-cyan-400">
                    {behavioralData.keystrokes.length}
                  </div>
                  <div className="text-xs text-gray-400">Keystrokes</div>
                </div>
                <div className="glass-card rounded p-3">
                  <MousePointer className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-blue-400">
                    {behavioralData.mouseMovements.length}
                  </div>
                  <div className="text-xs text-gray-400">Mouse Events</div>
                </div>
                <div className="glass-card rounded p-3">
                  <Edit3 className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-purple-400">
                    {typedText.length}
                  </div>
                  <div className="text-xs text-gray-400">Characters</div>
                </div>
                <div className="glass-card rounded p-3">
                  <Activity className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-orange-400">
                    {Math.round(scrollPosition)}
                  </div>
                  <div className="text-xs text-gray-400">Scroll (px)</div>
                </div>
              </div>
            </div>

            {/* Typing Phase */}
            {testPhase === 'typing' && (
              <div className="glass-card rounded-lg p-6">
                <h5 className="text-lg font-bold text-cyan-400 mb-4">
                  📝 Phase 1: Typing Analysis
                </h5>
                <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded">
                  <p className="text-blue-300 text-sm mb-2">Reference Text:</p>
                  <p className="text-white">{REFERENCE_TEXT}</p>
                </div>
                <textarea
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder="Type the reference text above naturally..."
                  className="w-full h-32 p-4 bg-gray-900 border border-green-500 text-green-400 rounded resize-none focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>
            )}

            {/* Scrolling Phase */}
            {testPhase === 'scrolling' && (
              <div className="glass-card rounded-lg p-6">
                <h5 className="text-lg font-bold text-orange-400 mb-4">
                  🖱️ Phase 2: Mouse & Scroll Analysis
                </h5>
                <p className="text-orange-300 mb-4">
                  Scroll up and down in this content area naturally. Move your mouse around the content.
                </p>
                <div 
                  ref={scrollAreaRef}
                  className="h-64 overflow-y-auto bg-gray-900 border border-orange-500 rounded p-4"
                >
                  <div className="space-y-4 text-gray-300">
                    <p>This is a scrolling test area. Please scroll up and down naturally.</p>
                    <p>Your mouse movements and scrolling patterns are being captured.</p>
                    <p>This helps establish your unique behavioral signature.</p>
                    <p>Continue scrolling to generate more data points.</p>
                    <p>The system analyzes velocity, acceleration, and timing patterns.</p>
                    <p>Each person has a unique way of interacting with content.</p>
                    <p>This creates a behavioral biometric profile.</p>
                    <p>Scroll more content to improve accuracy.</p>
                    <p>Move your mouse around this text area.</p>
                    <p>Click in different areas as well.</p>
                    <p>All interactions are recorded for analysis.</p>
                    <p>This creates a comprehensive behavioral baseline.</p>
                    <p>Keep scrolling until the timer reaches zero.</p>
                    <p>Your patterns will be compared in future logins.</p>
                    <p>This ensures only you can access your account.</p>
                    <p>Behavioral biometrics are very secure.</p>
                    <p>They're hard to replicate or steal.</p>
                    <p>Continue your natural scrolling behavior.</p>
                    <p>The test will finish automatically.</p>
                    <p>Thank you for completing the behavioral test!</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Test Results */}
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className={`border rounded-lg p-6 ${
              testResult.is_anomaly 
                ? 'border-red-500 bg-red-900/20' 
                : 'border-green-500 bg-green-900/20'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold">🔍 ENHANCED TEST RESULTS</h4>
                {testResult.is_anomaly ? (
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-green-400" />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-cyan-400" />
                  <div className="text-2xl font-bold text-cyan-400">
                    {(testResult.similarity_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-400">Similarity Score</div>
                </div>

                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    testResult.is_anomaly ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {testResult.is_anomaly ? '⚠️ ANOMALY' : '✅ NORMAL'}
                  </div>
                  <div className="text-sm text-gray-400">Classification</div>
                </div>

                <div className="text-center">
                  <Database className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                  <div className={`text-2xl font-bold ${
                    testResult.supabase_saved ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {testResult.supabase_saved ? '✅ SAVED' : '❌ FAILED'}
                  </div>
                  <div className="text-sm text-gray-400">Database Status</div>
                </div>

                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                  <div className={`text-2xl font-bold ${
                    testResult.action_taken === 'auto_lock' ? 'text-red-400' :
                    testResult.action_taken === 'warning' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {testResult.action_taken.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-400">Action Taken</div>
                </div>
              </div>

              {/* Enhanced Results Info */}
              <div className="mt-4 pt-4 border-t border-gray-500/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Test Duration:</span>
                    <span className="text-cyan-400 ml-2 font-bold">30 seconds</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Phases Completed:</span>
                    <span className="text-cyan-400 ml-2 font-bold">Typing + Scrolling</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Data Quality:</span>
                    <span className="text-cyan-400 ml-2 font-bold">
                      {behavioralData.keystrokes.length > 50 ? 'High' : 
                       behavioralData.keystrokes.length > 20 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Threshold:</span>
                    <span className="text-cyan-400 ml-2 font-bold">
                      {(testResult.threshold * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Messages */}
              {testResult.is_anomaly && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded">
                  <p className="text-red-400 text-sm flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {testResult.action_taken === 'auto_lock' 
                      ? '🔒 CRITICAL: Your behavioral pattern differs significantly. In production, account would be locked!'
                      : '⚠️ WARNING: Your behavioral pattern shows variations. Additional monitoring active.'
                    }
                  </p>
                </div>
              )}

              {testResult.supabase_saved && (
                <div className="mt-4 p-3 bg-green-900/30 border border-green-500/30 rounded">
                  <p className="text-green-400 text-sm flex items-center">
                    <Database className="h-4 w-4 mr-2" />
                    ✅ Enhanced results saved to Supabase. Check Admin Dashboard for real-time updates.
                  </p>
                </div>
              )}
            </div>

            {/* Run Another Test */}
            <div className="text-center">
              <button
                onClick={startTest}
                className="terminal-button px-4 py-2 rounded font-bold hover-glow"
              >
                🔄 RUN ANOTHER ENHANCED TEST
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Enhanced Instructions */}
      <div className="glass-card rounded-lg p-4">
        <h4 className="text-green-400 font-bold mb-2">🔍 Enhanced Test Process:</h4>
        <ul className="text-cyan-300 text-sm space-y-1">
          <li>• <strong>Phase 1 (0-15s):</strong> Type reference text naturally</li>
          <li>• <strong>Phase 2 (15-30s):</strong> Scroll and mouse interaction</li>
          <li>• <strong>Detection:</strong> Analyzes typing speed, mouse velocity, scroll patterns</li>
          <li>• <strong>Thresholds:</strong> Warning (30%) → Auto-lock (15%)</li>
          <li>• <strong>Storage:</strong> All results saved to behavioral_sessions table</li>
          <li>• <strong>Analysis:</strong> Creates comprehensive behavioral fingerprint</li>
        </ul>
      </div>

      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(34, 197, 94, 0.2);
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

        .hover-glow:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(16, 185, 129, 0.6);
        }
      `}</style>
    </div>
  );
};

export default BehavioralTestPage;