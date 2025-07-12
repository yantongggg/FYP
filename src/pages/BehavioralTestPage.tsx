// FIXED BehavioralTestPage.tsx - GUARANTEED Event Capture

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, RotateCcw, Activity, Keyboard, MousePointer, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TestResult {
  success: boolean;
  similarity_score: number;
  is_anomaly: boolean;
  action_taken: string;
  severity: string;
  session_id: string;
  details: {
    keystroke_count: number;
    mouse_count: number;
  };
}

const BehavioralTestPage: React.FC = () => {
  const { userData } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  // FIXED: Live counters for real-time feedback
  const [liveKeystrokes, setLiveKeystrokes] = useState(0);
  const [liveMouseEvents, setLiveMouseEvents] = useState(0);

  // FIXED: Direct refs for data collection
  const keystrokesRef = useRef<any[]>([]);
  const mouseEventsRef = useRef<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // SIMPLIFIED: Test prompt
  const TEST_PROMPT = "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.";

  // CRITICAL FIX: Proper Event Handlers with Live Updates
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;
    
    // Don't capture system keys
    if (['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }

    console.log(`🔑 KEYSTROKE CAPTURED: ${e.key} (${e.code})`);
    
    const keystroke = {
      key: e.key,
      code: e.code,
      timestamp: Date.now(),
      type: 'keydown',
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    };

    keystrokesRef.current.push(keystroke);
    setLiveKeystrokes(keystrokesRef.current.length);
    
    console.log(`📊 Total keystrokes now: ${keystrokesRef.current.length}`);
  }, [isRecording]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return;
    
    if (['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }
    
    const keystroke = {
      key: e.key,
      code: e.code,
      timestamp: Date.now(),
      type: 'keyup',
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    };

    keystrokesRef.current.push(keystroke);
    setLiveKeystrokes(keystrokesRef.current.length);
  }, [isRecording]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isRecording) return;
    
    // Throttle mouse events
    const now = Date.now();
    const lastMouse = mouseEventsRef.current[mouseEventsRef.current.length - 1];
    if (lastMouse && lastMouse.type === 'mousemove' && (now - lastMouse.timestamp) < 100) {
      return;
    }
    
    console.log(`🖱️ MOUSE MOVE: (${e.clientX}, ${e.clientY})`);
    
    const mouseEvent = {
      x: e.clientX,
      y: e.clientY,
      timestamp: now,
      type: 'mousemove'
    };

    mouseEventsRef.current.push(mouseEvent);
    setLiveMouseEvents(mouseEventsRef.current.length);
  }, [isRecording]);

  const handleMouseClick = useCallback((e: MouseEvent) => {
    if (!isRecording) return;
    
    console.log(`🖱️ MOUSE CLICK: (${e.clientX}, ${e.clientY}) button: ${e.button}`);
    
    const mouseEvent = {
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now(),
      type: 'click',
      button: e.button
    };

    mouseEventsRef.current.push(mouseEvent);
    setLiveMouseEvents(mouseEventsRef.current.length);
  }, [isRecording]);

  const handleMouseWheel = useCallback((e: WheelEvent) => {
    if (!isRecording) return;
    
    const mouseEvent = {
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now(),
      type: 'scroll',
      deltaY: e.deltaY
    };

    mouseEventsRef.current.push(mouseEvent);
    setLiveMouseEvents(mouseEventsRef.current.length);
  }, [isRecording]);

  // CRITICAL FIX: Proper Event Attachment
  const attachEventListeners = useCallback(() => {
    console.log('🔗 ATTACHING EVENT LISTENERS');
    
    // Attach to multiple targets for maximum coverage
    document.addEventListener('keydown', handleKeyDown, { capture: true, passive: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true, passive: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true, passive: true });
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('click', handleMouseClick, { capture: true, passive: true });
    document.addEventListener('wheel', handleMouseWheel, { passive: true });
    
    // Also attach to textarea specifically
    if (textAreaRef.current) {
      textAreaRef.current.addEventListener('keydown', handleKeyDown as any);
      textAreaRef.current.addEventListener('keyup', handleKeyUp as any);
      console.log('🎯 Attached listeners to textarea specifically');
    }

    console.log('✅ All event listeners attached');
  }, [handleKeyDown, handleKeyUp, handleMouseMove, handleMouseClick, handleMouseWheel]);

  const removeEventListeners = useCallback(() => {
    console.log('🔗 REMOVING EVENT LISTENERS');
    
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleMouseClick, true);
    document.removeEventListener('wheel', handleMouseWheel);
    
    if (textAreaRef.current) {
      textAreaRef.current.removeEventListener('keydown', handleKeyDown as any);
      textAreaRef.current.removeEventListener('keyup', handleKeyUp as any);
    }

    console.log('✅ All event listeners removed');
  }, [handleKeyDown, handleKeyUp, handleMouseMove, handleMouseClick, handleMouseWheel]);

  const startTest = useCallback(() => {
    if (!userData?.uid) {
      alert('Please log in first');
      return;
    }

    console.log('🚀 STARTING TEST WITH DIRECT EVENT ATTACHMENT');
    
    setIsRecording(true);
    setCurrentTime(0);
    setTypedText('');
    setTestResults(null);
    setLiveKeystrokes(0);
    setLiveMouseEvents(0);
    
    keystrokesRef.current = [];
    mouseEventsRef.current = [];
    recordingStartRef.current = Date.now();

    // CRITICAL FIX: Direct event handler functions
    const keyDownHandler = (e: KeyboardEvent) => {
      console.log(`🔑 KEY DOWN: ${e.key}`);
      keystrokesRef.current.push({
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keydown',
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      });
      setLiveKeystrokes(keystrokesRef.current.length);
    };

    const keyUpHandler = (e: KeyboardEvent) => {
      console.log(`🔑 KEY UP: ${e.key}`);
      keystrokesRef.current.push({
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
        type: 'keyup',
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      });
      setLiveKeystrokes(keystrokesRef.current.length);
    };

    const mouseMoveHandler = (e: MouseEvent) => {
      const now = Date.now();
      const lastMouse = mouseEventsRef.current[mouseEventsRef.current.length - 1];
      if (lastMouse && (now - lastMouse.timestamp) < 100) return;
      
      console.log(`🖱️ MOUSE MOVE: (${e.clientX}, ${e.clientY})`);
      mouseEventsRef.current.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: now,
        type: 'mousemove'
      });
      setLiveMouseEvents(mouseEventsRef.current.length);
    };

    const mouseClickHandler = (e: MouseEvent) => {
      console.log(`🖱️ MOUSE CLICK: (${e.clientX}, ${e.clientY})`);
      mouseEventsRef.current.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        type: 'click',
        button: e.button
      });
      setLiveMouseEvents(mouseEventsRef.current.length);
    };

    // Store handlers for cleanup
    (window as any).testHandlers = {
      keyDown: keyDownHandler,
      keyUp: keyUpHandler,
      mouseMove: mouseMoveHandler,
      mouseClick: mouseClickHandler
    };

    // ATTACH DIRECTLY TO DOCUMENT
    document.addEventListener('keydown', keyDownHandler, true);
    document.addEventListener('keyup', keyUpHandler, true);
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('click', mouseClickHandler, true);

    console.log('✅ Event listeners attached directly');

    // Focus textarea
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    }, 100);

    // Timer
    let seconds = 0;
    timerRef.current = setInterval(() => {
      seconds++;
      setCurrentTime(seconds);
      if (seconds >= 60) {
        stopTest();
      }
    }, 1000);

  }, [userData?.uid]);

  const stopTest = useCallback(async () => {
  if (!isRecording) return;

  console.log('🛑 STOPPING TEST');
  setIsRecording(false);

  // Remove handlers
  const handlers = (window as any).testHandlers;
  if (handlers) {
    document.removeEventListener('keydown', handlers.keyDown, true);
    document.removeEventListener('keyup', handlers.keyUp, true);
    document.removeEventListener('mousemove', handlers.mouseMove);
    document.removeEventListener('click', handlers.mouseClick, true);
    delete (window as any).testHandlers;
  }

  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  console.log(`📊 FINAL COUNT: ${keystrokesRef.current.length} keystrokes, ${mouseEventsRef.current.length} mouse events`);
  
  await analyzeResults();
}, [isRecording]);

const analyzeResults = async () => {
  if (!userData?.uid) return;

  setIsAnalyzing(true);

  try {
    const keystrokes = [...keystrokesRef.current];
    const mouseEvents = [...mouseEventsRef.current];

    console.log(`📊 ANALYSIS: ${keystrokes.length} keystrokes, ${mouseEvents.length} mouse events`);

    // CRITICAL: Must have at least 5 keystrokes
    if (keystrokes.length < 5) {
      alert(`❌ INSUFFICIENT DATA!\n\nKeystrokes captured: ${keystrokes.length}\nMinimum required: 5\n\nPlease:\n1. Click in the text area\n2. Type the full sentence\n3. Try again`);
      setIsAnalyzing(false);
      return;
    }

    const sessionId = `test_${userData.uid}_${Date.now()}`;

    console.log('📡 Sending to /api/behavioral-test');
    
    // Send to backend
    const response = await fetch('http://localhost:5000/api/behavioral-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userData.uid,
        behavioralData: {
          keystrokes: keystrokes,
          mouseMovements: mouseEvents
        },
        session_id: sessionId,
        test_mode: true,
        typed_text: typedText,
        test_duration: 60,
        page_context: '/behavioral-test'
      })
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status}`);
    }

    const result: TestResult = await response.json();
    
    console.log('✅ TEST RESULT:', result);
    setTestResults(result);

    // User-friendly notifications
    if (result.is_anomaly) {
      if (result.action_taken === 'auto_lock') {
        alert(`🚨 CRITICAL ANOMALY DETECTED!\n\nSimilarity: ${(result.similarity_score * 100).toFixed(1)}%\nAction: ${result.action_taken.toUpperCase()}\n\nYour behavioral pattern is significantly different from baseline.\nContact security if this is an error.`);
      } else {
        alert(`⚠️ Behavioral Anomaly Detected\n\nSimilarity: ${(result.similarity_score * 100).toFixed(1)}%\nSeverity: ${result.severity.toUpperCase()}\n\nThis has been logged for review.`);
      }
    } else {
      alert(`✅ Test Successful!\n\nSimilarity: ${(result.similarity_score * 100).toFixed(1)}%\nData: ${result.details.keystroke_count} keystrokes, ${result.details.mouse_count} mouse events\n\nYour behavioral pattern matches your baseline!`);
    }

  } catch (error) {
    console.error('❌ ANALYSIS ERROR:', error);
    alert(`❌ Analysis Failed\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nData collected:\n• Keystrokes: ${keystrokesRef.current.length}\n• Mouse events: ${mouseEventsRef.current.length}`);
  } finally {
    setIsAnalyzing(false);
  }
};

  // FIXED: Reset
  const resetTest = () => {
    console.log('🔄 RESETTING TEST');
    
    setIsRecording(false);
    setCurrentTime(0);
    setTypedText('');
    setTestResults(null);
    setLiveKeystrokes(0);
    setLiveMouseEvents(0);
    
    removeEventListeners();
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    keystrokesRef.current = [];
    mouseEventsRef.current = [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeEventListeners();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [removeEventListeners]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-lg p-6"
      >
        <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center">
          <Activity className="mr-3 h-6 w-6" />
          FIXED BEHAVIORAL TEST - GUARANTEED CAPTURE
        </h2>
        // Add this button in your controls section
<button
  onClick={() => {
    console.log('🧪 MANUAL TEST');
    console.log('Keystrokes:', keystrokesRef.current.length);
    console.log('Mouse events:', mouseEventsRef.current.length);
    
    // Manually add test data if needed
    keystrokesRef.current.push({
      key: 'test',
      code: 'KeyT',
      timestamp: Date.now(),
      type: 'keydown',
      ctrlKey: false,
      shiftKey: false,
      altKey: false
    });
    setLiveKeystrokes(keystrokesRef.current.length);
  }}
  className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded"
>
  🧪 Manual Test
</button>
        {/* Status */}
        <div className="flex items-center justify-between mb-6 p-4 bg-black/20 rounded">
          <div className="flex items-center">
            <Activity className="h-5 w-5 mr-2 text-cyan-400" />
            <div>
              <span className="text-cyan-400 font-bold text-lg">
                {isRecording ? '🟢 RECORDING - TYPE NOW!' : isAnalyzing ? '🔄 ANALYZING' : '⏸️ READY'}
              </span>
              <div className="text-gray-400 text-sm">
                {isRecording ? 'Focus the text area and type naturally' : 
                 isAnalyzing ? 'Processing your behavioral data...' : 
                 'Click START to begin 60-second test'}
              </div>
            </div>
          </div>
          <div className="text-green-400 font-mono text-xl">
            {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')} / 1:00
          </div>
        </div>

        {/* Controls */}
        <div className="flex space-x-4 mb-6">
          {!isRecording && !isAnalyzing && (
            <button
              onClick={startTest}
              className="terminal-button px-6 py-3 rounded flex items-center text-lg"
            >
              <Play className="h-5 w-5 mr-2" />
              START FIXED TEST
            </button>
          )}
          
          {isRecording && (
            <button
              onClick={stopTest}
              className="bg-red-600/20 text-red-400 border border-red-500/30 px-6 py-3 rounded flex items-center text-lg hover:bg-red-600/30"
            >
              <Square className="h-5 w-5 mr-2" />
              STOP TEST
            </button>
          )}
          
          <button
            onClick={resetTest}
            className="bg-gray-600/20 text-gray-400 border border-gray-500/30 px-6 py-3 rounded flex items-center hover:bg-gray-600/30"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            RESET
          </button>
        </div>

        {/* ENHANCED: Live Stats with Real-time Updates */}
        {isRecording && (
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-green-900/10 border border-green-500/30 rounded">
            <div className="text-center p-3 bg-black/20 rounded">
              <Keyboard className="h-6 w-6 text-blue-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-blue-400">{liveKeystrokes}</div>
              <div className="text-xs text-gray-400">Live Keystrokes</div>
              <div className="text-xs text-green-400 mt-1">
                {liveKeystrokes >= 5 ? '✅ Enough data' : `❌ Need ${5 - liveKeystrokes} more`}
              </div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <MousePointer className="h-6 w-6 text-purple-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-purple-400">{liveMouseEvents}</div>
              <div className="text-xs text-gray-400">Live Mouse Events</div>
              <div className="text-xs text-purple-400 mt-1">Move mouse around</div>
            </div>
          </div>
        )}

        {/* Text Area */}
        <div className="mb-6">
          <label className="block text-cyan-400 text-sm font-bold mb-2">
            📝 Type the following text naturally (click the box first):
          </label>
          <div className="p-4 bg-gray-900/50 rounded border border-gray-600 mb-3 text-gray-300 text-sm">
            {TEST_PROMPT}
          </div>
          <textarea
            ref={textAreaRef}
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder={isRecording ? "👈 CLICK HERE FIRST, then type the text above..." : "Click START to begin the test..."}
            disabled={!isRecording}
            className="terminal-input w-full px-4 py-3 rounded h-32 resize-none text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            style={{ fontSize: '14px', lineHeight: '1.4' }}
          />
          {isRecording && (
            <div className="text-xs text-cyan-400 mt-2">
              💡 TIP: Click inside this text box first, then type naturally. The system will capture your keystrokes and mouse movements.
            </div>
          )}
        </div>

        {/* Analysis Loading */}
        {isAnalyzing && (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-cyan-400 font-mono text-lg">ANALYZING_BEHAVIORAL_PATTERNS...</p>
            <div className="text-gray-400 text-sm mt-2">
              Processing {keystrokesRef.current.length} keystrokes and {mouseEventsRef.current.length} mouse events
            </div>
          </div>
        )}

        {/* Results */}
        {testResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold text-green-400">TEST RESULTS</h3>
            
            <div className={`p-6 rounded-lg border-2 ${
              testResults.is_anomaly ? 'bg-red-900/30 border-red-500/50' : 'bg-green-900/30 border-green-500/50'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {testResults.is_anomaly ? (
                    <AlertTriangle className="h-8 w-8 text-red-400 mr-3" />
                  ) : (
                    <CheckCircle className="h-8 w-8 text-green-400 mr-3" />
                  )}
                  <div>
                    <span className={`font-bold text-xl ${
                      testResults.is_anomaly ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {testResults.is_anomaly ? 'ANOMALY DETECTED' : 'TEST PASSED'}
                    </span>
                    <div className="text-gray-400 text-sm">
                      Action: {testResults.action_taken.replace('_', ' ').toUpperCase()} | Severity: {testResults.severity.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Similarity Score:</span>
                  <div className={`text-2xl font-bold ${
                    testResults.similarity_score >= 0.7 ? 'text-green-400' : 
                    testResults.similarity_score >= 0.4 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {(testResults.similarity_score * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Keystrokes:</span>
                  <div className="text-cyan-400 font-bold text-lg">
                    {testResults.details.keystroke_count}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Mouse Events:</span>
                  <div className="text-purple-400 font-bold text-lg">
                    {testResults.details.mouse_count}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default BehavioralTestPage;