// Enhanced BehavioralTestPage.tsx - CRITICAL FIX for anomaly detection and saving

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  Square, 
  RotateCcw,
  Activity,
  Keyboard,
  MousePointer,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Shield,
  Eye,
  XCircle
} from 'lucide-react';
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

interface TestResult {
  success: boolean;
  similarity_score: number;
  is_anomaly: boolean;
  is_critical: boolean;
  action_taken: string;
  severity: string;
  session_id: string;
  thresholds: {
    anomaly: number;
    critical: number;
  };
  details: {
    keystroke_count: number;
    mouse_count: number;
    current_features: any;
    baseline_available: boolean;
  };
  data_saved: {
    session_saved: boolean;
    anomaly_saved: boolean;
  };
}

const BehavioralTestPage: React.FC = () => {
  const { userData } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [testDuration, setTestDuration] = useState(30); // seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);

  // Data collection refs
  const keystrokesRef = useRef<KeystrokeEvent[]>([]);
  const mouseEventsRef = useRef<MouseEvent[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);

  // Test prompt
  const TEST_PROMPT = "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet and is perfect for testing typing patterns. Please type this text naturally and move your mouse around occasionally.";

  // ========== CRITICAL: Enhanced Event Handlers ==========

  const handleKeyEvent = useCallback((event: KeyboardEvent) => {
    if (!isRecording) return;

    // Skip function keys and navigation keys during test
    if (event.key.startsWith('F') || 
        ['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Escape'].includes(event.key)) {
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
    console.log(`🔑 Test keystroke: ${keystrokeEvent.key} (${keystrokeEvent.type})`);
  }, [isRecording]);

  const handleMouseEvent = useCallback((event: globalThis.MouseEvent) => {
    if (!isRecording) return;

    let eventType: 'mousemove' | 'click' | 'scroll' = 'mousemove';
    if (event.type === 'click') eventType = 'click';
    if (event.type === 'wheel') eventType = 'scroll';

    const mouseEventData: MouseEvent = {
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
      type: eventType,
      button: event.button,
      deltaY: (event as any).deltaY
    };

    mouseEventsRef.current.push(mouseEventData);
  }, [isRecording]);

  // ========== CRITICAL: Test Management ==========

  const startTest = useCallback(() => {
    if (!userData?.uid) {
      alert('User not authenticated');
      return;
    }

    console.log(`🚀 Starting behavioral test for user ${userData.uid}`);
    
    setIsRecording(true);
    setCurrentTime(0);
    setTypedText('');
    setTestResults(null);
    
    // Clear previous data
    keystrokesRef.current = [];
    mouseEventsRef.current = [];
    recordingStartRef.current = Date.now();

    // Add event listeners
    document.addEventListener('keydown', handleKeyEvent, true);
    document.addEventListener('keyup', handleKeyEvent, true);
    document.addEventListener('mousemove', handleMouseEvent, true);
    document.addEventListener('click', handleMouseEvent, true);
    document.addEventListener('wheel', handleMouseEvent, true);

    // Start timer
    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        if (newTime >= testDuration) {
          stopTest();
          return testDuration;
        }
        return newTime;
      });
    }, 1000);

    console.log('✅ Behavioral test started');
  }, [userData?.uid, testDuration, handleKeyEvent, handleMouseEvent]);

  const stopTest = useCallback(async () => {
    if (!isRecording) return;

    console.log('🛑 Stopping behavioral test');
    
    setIsRecording(false);

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Remove event listeners
    document.removeEventListener('keydown', handleKeyEvent, true);
    document.removeEventListener('keyup', handleKeyEvent, true);
    document.removeEventListener('mousemove', handleMouseEvent, true);
    document.removeEventListener('click', handleMouseEvent, true);
    document.removeEventListener('wheel', handleMouseEvent, true);

    // Analyze results
    await analyzeResults();
  }, [isRecording, handleKeyEvent, handleMouseEvent]);

  const analyzeResults = async () => {
    if (!userData?.uid) return;

    setIsAnalyzing(true);

    try {
      const keystrokes = keystrokesRef.current;
      const mouseEvents = mouseEventsRef.current;

      console.log(`🔍 Analyzing test results: ${keystrokes.length} keystrokes, ${mouseEvents.length} mouse events`);

      if (keystrokes.length < 5) {
        alert('Not enough keystroke data collected. Please try again and type more.');
        setIsAnalyzing(false);
        return;
      }

      const behavioralData = {
        keystrokes,
        mouseMovements: mouseEvents
      };

      const sessionId = `test_${userData.uid}_${Date.now()}`;

      console.log(`📡 Sending test data to behavioral-test API`);

      // CRITICAL: Send to behavioral test endpoint
      const response = await fetch('http://localhost:5000/api/behavioral-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userData.uid,
          behavioralData,
          session_id: sessionId,
          test_mode: true,
          typed_text: typedText,
          test_duration: testDuration,
          page_context: '/behavioral-test'
        })
      });

      if (!response.ok) {
        throw new Error(`Test failed: ${response.status} ${response.statusText}`);
      }

      const result: TestResult = await response.json();
      
      console.log('✅ Behavioral test result:', result);

      setTestResults(result);

      // Add to history
      setTestHistory(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results

      // CRITICAL: Trigger real-time update event
      window.dispatchEvent(new CustomEvent('behavioralDataUpdated', {
        detail: { userId: userData.uid, result, sessionId }
      }));

      // Show result notification
      if (result.is_critical) {
        alert(`🚨 CRITICAL ANOMALY DETECTED!\nSimilarity: ${(result.similarity_score * 100).toFixed(1)}%\nAction: ${result.action_taken}`);
      } else if (result.is_anomaly) {
        alert(`⚠️ Anomaly detected.\nSimilarity: ${(result.similarity_score * 100).toFixed(1)}%\nSeverity: ${result.severity}`);
      }

    } catch (error) {
      console.error('❌ Error analyzing test results:', error);
      alert(`Error analyzing results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetTest = () => {
    setIsRecording(false);
    setCurrentTime(0);
    setTypedText('');
    setTestResults(null);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Remove event listeners
    document.removeEventListener('keydown', handleKeyEvent, true);
    document.removeEventListener('keyup', handleKeyEvent, true);
    document.removeEventListener('mousemove', handleMouseEvent, true);
    document.removeEventListener('click', handleMouseEvent, true);
    document.removeEventListener('wheel', handleMouseEvent, true);

    keystrokesRef.current = [];
    mouseEventsRef.current = [];
  };

  // ========== HELPER FUNCTIONS ==========

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-900/30 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-900/30 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/30';
      default: return 'text-blue-400 bg-blue-900/30 border-blue-500/30';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ========== CLEANUP ==========

  useEffect(() => {
    return () => {
      resetTest();
    };
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-lg p-6"
      >
        <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center">
          <Zap className="mr-3 h-6 w-6" />
          BEHAVIORAL AUTHENTICATION TEST
        </h2>
        
        <p className="text-cyan-400 mb-6">
          This test captures your typing and mouse behavior patterns to verify your identity. 
          The system will analyze your behavioral biometrics and detect any anomalies.
        </p>

        {/* Test Configuration */}
        <div className="mb-6">
          <label className="block text-cyan-400 text-sm font-bold mb-2">
            Test Duration (seconds):
          </label>
          <input
            type="number"
            min="10"
            max="120"
            value={testDuration}
            onChange={(e) => setTestDuration(parseInt(e.target.value))}
            disabled={isRecording}
            className="terminal-input w-24 px-3 py-1 rounded"
          />
        </div>

        {/* Test Status */}
        <div className="flex items-center justify-between mb-6 p-4 bg-black/20 rounded">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-cyan-400 font-bold">
              {isRecording ? 'RECORDING' : isAnalyzing ? 'ANALYZING' : 'READY'}
            </span>
          </div>
          <div className="flex items-center text-green-400">
            <Clock className="h-4 w-4 mr-2" />
            <span className="font-mono text-lg">
              {formatTime(currentTime)} / {formatTime(testDuration)}
            </span>
          </div>
        </div>

        {/* Test Controls */}
        <div className="flex space-x-4 mb-6">
          {!isRecording && !isAnalyzing && (
            <button
              onClick={startTest}
              className="terminal-button px-6 py-2 rounded flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              START TEST
            </button>
          )}
          
          {isRecording && (
            <button
              onClick={stopTest}
              className="bg-red-600/20 text-red-400 border border-red-500/30 px-6 py-2 rounded flex items-center hover:bg-red-600/30"
            >
              <Square className="h-4 w-4 mr-2" />
              STOP TEST
            </button>
          )}
          
          {!isRecording && !isAnalyzing && (
            <button
              onClick={resetTest}
              className="bg-gray-600/20 text-gray-400 border border-gray-500/30 px-6 py-2 rounded flex items-center hover:bg-gray-600/30"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              RESET
            </button>
          )}
        </div>

        {/* Typing Area */}
        <div className="mb-6">
          <label className="block text-cyan-400 text-sm font-bold mb-2">
            Type the following text naturally:
          </label>
          <div className="p-3 bg-gray-900/50 rounded border border-gray-600 mb-2 text-gray-300 text-sm">
            {TEST_PROMPT}
          </div>
          <textarea
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder="Start typing here..."
            disabled={!isRecording}
            className="terminal-input w-full px-3 py-2 rounded h-24 resize-none"
          />
        </div>

        {/* Live Stats */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
          >
            <div className="text-center p-3 bg-black/20 rounded">
              <Keyboard className="h-6 w-6 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-400">{keystrokesRef.current.length}</div>
              <div className="text-xs text-gray-400">Keystrokes</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <MousePointer className="h-6 w-6 text-green-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-green-400">{mouseEventsRef.current.length}</div>
              <div className="text-xs text-gray-400">Mouse Events</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <Activity className="h-6 w-6 text-cyan-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-cyan-400">{typedText.length}</div>
              <div className="text-xs text-gray-400">Characters</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <BarChart3 className="h-6 w-6 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-purple-400">
                {Math.round((typedText.length / (currentTime || 1)) * 60)}
              </div>
              <div className="text-xs text-gray-400">WPM</div>
            </div>
          </motion.div>
        )}

        {/* Analysis Loading */}
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center p-8"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-cyan-400 font-mono">ANALYZING_BEHAVIORAL_PATTERNS...</p>
          </motion.div>
        )}

        {/* Test Results */}
        {testResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold text-green-400 mb-4">TEST RESULTS</h3>
            
            {/* Overall Result */}
            <div className={`p-4 rounded border ${testResults.is_critical ? 'bg-red-900/20 border-red-500/30' : 
                                                  testResults.is_anomaly ? 'bg-yellow-900/20 border-yellow-500/30' : 
                                                  'bg-green-900/20 border-green-500/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {testResults.is_critical ? (
                    <XCircle className="h-6 w-6 text-red-400 mr-2" />
                  ) : testResults.is_anomaly ? (
                    <AlertTriangle className="h-6 w-6 text-yellow-400 mr-2" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-green-400 mr-2" />
                  )}
                  <span className={`font-bold text-lg ${testResults.is_critical ? 'text-red-400' : 
                                                        testResults.is_anomaly ? 'text-yellow-400' : 
                                                        'text-green-400'}`}>
                    {testResults.is_critical ? 'CRITICAL ANOMALY' : 
                     testResults.is_anomaly ? 'ANOMALY DETECTED' : 
                     'VERIFICATION PASSED'}
                  </span>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-bold border ${getSeverityColor(testResults.severity)}`}>
                  {testResults.severity.toUpperCase()}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">Similarity Score:</span>
                  <div className={`text-2xl font-bold ${getScoreColor(testResults.similarity_score)}`}>
                    {(testResults.similarity_score * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Action Taken:</span>
                  <div className="text-cyan-400 font-bold">
                    {testResults.action_taken.toUpperCase()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Session ID:</span>
                  <div className="text-gray-300 font-mono text-xs">
                    {testResults.session_id.slice(-12)}...
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card rounded p-4">
                <h4 className="font-bold text-cyan-400 mb-2">Data Collection</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Keystrokes:</span>
                    <span className="text-green-400">{testResults.details.keystroke_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mouse Events:</span>
                    <span className="text-green-400">{testResults.details.mouse_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Baseline Available:</span>
                    <span className={testResults.details.baseline_available ? 'text-green-400' : 'text-red-400'}>
                      {testResults.details.baseline_available ? 'YES' : 'NO'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded p-4">
                <h4 className="font-bold text-cyan-400 mb-2">Data Persistence</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Session Saved:</span>
                    <span className={testResults.data_saved.session_saved ? 'text-green-400' : 'text-red-400'}>
                      {testResults.data_saved.session_saved ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Anomaly Saved:</span>
                    <span className={testResults.data_saved.anomaly_saved ? 'text-green-400' : 'text-gray-400'}>
                      {testResults.is_anomaly ? (testResults.data_saved.anomaly_saved ? 'YES' : 'NO') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Thresholds:</span>
                    <span className="text-cyan-400 text-xs">
                      A:{(testResults.thresholds.anomaly * 100).toFixed(0)}% 
                      C:{(testResults.thresholds.critical * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Test History */}
        {testHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <h3 className="text-xl font-bold text-green-400 mb-4">RECENT TEST HISTORY</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {testHistory.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-black/20 rounded">
                  <div className="flex items-center">
                    {result.is_critical ? (
                      <XCircle className="h-4 w-4 text-red-400 mr-2" />
                    ) : result.is_anomaly ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-400 mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-400 mr-2" />
                    )}
                    <span className="text-cyan-400 text-sm">
                      Similarity: {(result.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs border ${getSeverityColor(result.severity)}`}>
                      {result.severity.toUpperCase()}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {result.action_taken.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default BehavioralTestPage;