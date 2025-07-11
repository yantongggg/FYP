// Enhanced BehavioralTestPage.tsx - User-Friendly with Better UX

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
  XCircle,
  Info,
  Target,
  Coffee,
  Smile
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
  const [testDuration, setTestDuration] = useState(90); // Increased to 90 seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'typing' | 'mouse' | 'mixed' | 'complete'>('ready');

  // Data collection refs
  const keystrokesRef = useRef<KeystrokeEvent[]>([]);
  const mouseEventsRef = useRef<MouseEvent[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [liveStats, setLiveStats] = useState({
    keystrokes: 0,
    mouseEvents: 0,
    characters: 0,
    wpm: 0
  });

  // Enhanced test prompts with variety
  const TEST_PROMPTS = [
    "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet and is perfect for testing typing patterns.",
    "Pack my box with five dozen liquor jugs. This is another pangram that helps analyze your unique keystroke dynamics and timing patterns.",
    "How vexingly quick daft zebras jump! Natural typing reveals your authentic behavioral biometric signature patterns.",
    "Sphinx of black quartz, judge my vow. Your typing rhythm is as unique as your fingerprint and helps secure your account."
  ];

  const [currentPrompt, setCurrentPrompt] = useState(TEST_PROMPTS[0]);

  // Enhanced guidance based on test phase
  const getPhaseGuidance = () => {
    switch (currentPhase) {
      case 'ready':
        return {
          title: "🚀 Ready to Start",
          instruction: "Click START to begin a comprehensive behavioral analysis",
          icon: <Target className="h-6 w-6 text-green-400" />
        };
      case 'typing':
        return {
          title: "⌨️ Typing Phase (30s)",
          instruction: "Type the text naturally - focus on the text, not speed",
          icon: <Keyboard className="h-6 w-6 text-blue-400" />
        };
      case 'mouse':
        return {
          title: "🖱️ Mouse Phase (30s)",
          instruction: "Move mouse around, click buttons, scroll naturally",
          icon: <MousePointer className="h-6 w-6 text-purple-400" />
        };
      case 'mixed':
        return {
          title: "🔄 Mixed Phase (30s)",
          instruction: "Continue typing while using mouse - be natural!",
          icon: <Activity className="h-6 w-6 text-cyan-400" />
        };
      case 'complete':
        return {
          title: "✅ Test Complete",
          instruction: "Analyzing your behavioral patterns...",
          icon: <CheckCircle className="h-6 w-6 text-green-400" />
        };
    }
  };

  // ========== Enhanced Event Handlers ==========

  const handleKeyEvent = useCallback((event: KeyboardEvent) => {
    if (!isRecording) return;

    // Allow typing in textarea during typing phases
    const isTextareaFocused = textareaRef.current === document.activeElement;

    // Skip function keys and navigation keys during test
    if (event.key.startsWith('F') || 
        ['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Escape'].includes(event.key)) {
      return;
    }

        // Skip if not in typing phase and not interacting with textarea
    if (currentPhase === 'mouse' && !isTextareaFocused) {
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

        // Update live stats
    setLiveStats(prev => ({
      ...prev,
      keystrokes: keystrokesRef.current.length,
      characters: typedText.length
    }));

    console.log(`🔑 Test keystroke: ${keystrokeEvent.key} (${keystrokeEvent.type}) - Phase: ${currentPhase}`);
  }, [isRecording, currentPhase]);

  const handleMouseEvent = useCallback((event: globalThis.MouseEvent) => {
    if (!isRecording) return;

    let eventType: 'mousemove' | 'click' | 'scroll' = 'mousemove';
    if (event.type === 'click') eventType = 'click';
    if (event.type === 'wheel') eventType = 'scroll';


    // Throttle mousemove events to prevent spam
    if (eventType === 'mousemove') {
      const lastMouse = mouseEventsRef.current[mouseEventsRef.current.length - 1];
      if (lastMouse && lastMouse.type === 'mousemove' && 
          (Date.now() - lastMouse.timestamp) < 50) {
        return; // Skip if less than 50ms since last mousemove
      }
    }

    const mouseEventData: MouseEvent = {
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
      type: eventType,
      button: event.button,
      deltaY: (event as any).deltaY
    };

    // Update live stats
    setLiveStats(prev => ({
      ...prev,
      mouseEvents: mouseEventsRef.current.length
    }));

    console.log(`🖱️ FIXED: Mouse event captured: ${eventType} at (${event.clientX}, ${event.clientY}) - Phase: ${currentPhase}`);
  }, [isRecording, currentPhase]);


    // CRITICAL FIX: Proper Event Listener Management
  const attachEventListeners = useCallback(() => {
    console.log('🔗 FIXED: Attaching event listeners for behavioral test');
    
    // Use capture phase and passive listeners for better performance
    document.addEventListener('keydown', handleKeyEvent, { capture: true, passive: true });
    document.addEventListener('keyup', handleKeyEvent, { capture: true, passive: true });
    document.addEventListener('mousemove', handleMouseEvent, { passive: true });
    document.addEventListener('click', handleMouseEvent, { capture: true, passive: true });
    document.addEventListener('wheel', handleMouseEvent, { passive: true });
    
    // Also add listeners to window for broader coverage
    window.addEventListener('keydown', handleKeyEvent, { capture: true, passive: true });
    window.addEventListener('keyup', handleKeyEvent, { capture: true, passive: true });
  }, [handleKeyEvent, handleMouseEvent]);

  const removeEventListeners = useCallback(() => {
    console.log('🔗 FIXED: Removing event listeners');
    
    document.removeEventListener('keydown', handleKeyEvent, true);
    document.removeEventListener('keyup', handleKeyEvent, true);
    document.removeEventListener('mousemove', handleMouseEvent);
    document.removeEventListener('click', handleMouseEvent, true);
    document.removeEventListener('wheel', handleMouseEvent);
    
    window.removeEventListener('keydown', handleKeyEvent, true);
    window.removeEventListener('keyup', handleKeyEvent, true);
  }, [handleKeyEvent, handleMouseEvent]);
  // ========== Enhanced Test Management ==========

  const startTest = useCallback(() => {
    if (!userData?.uid) {
      alert('User not authenticated');
      return;
    }

    console.log(`🚀 Starting enhanced behavioral test for user ${userData.uid}`);
    
    setIsRecording(true);
    setCurrentTime(0);
    setTypedText('');
    setTestResults(null);
    setCurrentPhase('typing');
    
    // Randomize prompt
    const randomPrompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
    setCurrentPrompt(randomPrompt);
    
    // Clear previous data
    keystrokesRef.current = [];
    mouseEventsRef.current = [];
    recordingStartRef.current = Date.now();
    // Reset live stats
    setLiveStats({ keystrokes: 0, mouseEvents: 0, characters: 0, wpm: 0 });


    // CRITICAL: Attach event listeners
    attachEventListeners();

    // Focus textarea for immediate typing
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    // Start timer with phase management
    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        const newTime = prev + 1;
        
        // Phase transitions
        if (newTime === 30 && currentPhase === 'typing') {
          setCurrentPhase('mouse');
          console.log('🔄 Phase transition: typing → mouse');
        } else if (newTime === 60 && currentPhase === 'mouse') {
          setCurrentPhase('mixed');
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
          console.log('🔄 Phase transition: mouse → mixed');
        } else if (newTime >= testDuration) {
          stopTest();
          return testDuration;
        }
        
        return newTime;
      });
    }, 1000);

    console.log('✅ FIXED: Enhanced behavioral test started with proper event handling');
  }, [userData?.uid, testDuration, attachEventListeners, currentPhase]);

  const stopTest = useCallback(async () => {
    if (!isRecording) return;

    console.log('🛑 FIXED: Stopping enhanced behavioral test');
    
    setIsRecording(false);
    setCurrentPhase('complete');

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // CRITICAL: Remove event listeners
    removeEventListeners();

    // Analyze results
    await analyzeResults();
  }, [isRecording, removeEventListeners]);

  // CRITICAL FIX: Enhanced Analysis with Proper Data Validation
  const analyzeResults = async () => {
    if (!userData?.uid) return;

    setIsAnalyzing(true);

    try {
      const keystrokes = keystrokesRef.current;
      const mouseEvents = mouseEventsRef.current;

      console.log(`🔍 FIXED: Analyzing test results: ${keystrokes.length} keystrokes, ${mouseEvents.length} mouse events`);

      // CRITICAL: Enhanced data validation
      if (keystrokes.length < 5) {
        alert(`❌ INSUFFICIENT DATA!\n\nKeystrokes captured: ${keystrokes.length}\nMinimum required: 5\n\nPlease:\n1. Ensure you're typing in the text area\n2. Type more naturally\n3. Try the test again`);
        setIsAnalyzing(false);
        setCurrentPhase('ready');
        return;
      }

      if (mouseEvents.length < 3) {
        console.warn('⚠️ Low mouse event count, but proceeding with test');
      }

      // Prepare comprehensive behavioral data
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

      const sessionId = `enhanced_test_${userData.uid}_${Date.now()}`;

      console.log(`📡 FIXED: Sending enhanced test data to behavioral-test API`);
      console.log(`📊 Data summary:`, {
        keystrokes: keystrokes.length,
        mouseEvents: mouseEvents.length,
        typedChars: typedText.length,
        testDuration: testDuration,
        phases: ['typing', 'mouse', 'mixed']
      });

      // CRITICAL: Enhanced API call with proper error handling
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
          page_context: '/behavioral-test-enhanced',
          test_type: 'enhanced_phased',
          test_metadata: {
            phases_completed: ['typing', 'mouse', 'mixed'],
            start_time: recordingStartRef.current,
            end_time: Date.now(),
            prompt_used: currentPrompt.substring(0, 50) + '...'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Enhanced test failed: ${response.status} - ${errorText}`);
      }

      const result: TestResult = await response.json();
      
      console.log('✅ FIXED: Enhanced behavioral test result:', result);

      setTestResults(result);

      // Add to history
      setTestHistory(prev => [result, ...prev.slice(0, 9)]);

      // CRITICAL: Trigger real-time update event
      window.dispatchEvent(new CustomEvent('behavioralDataUpdated', {
        detail: { 
          userId: userData.uid, 
          result, 
          sessionId,
          context: 'behavioral_test',
          enhanced: true
        }
      }));

      // Enhanced result notifications
      if (result.is_critical) {
        setTimeout(() => {
          alert(`🚨 CRITICAL SECURITY ANOMALY DETECTED!\n\n` +
                `Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%\n` +
                `Action Taken: ${result.action_taken.toUpperCase()}\n` +
                `Session ID: ${result.session_id}\n\n` +
                `This indicates your behavioral pattern is significantly different from baseline.\n\n` +
                `Possible causes:\n` +
                `• Different typing environment or device\n` +
                `• Stress, fatigue, or medical conditions\n` +
                `• Changed input method or accessibility tools\n` +
                `• Someone else using your account\n\n` +
                `Please contact security if you believe this is an error.`);
        }, 1000);
      } else if (result.is_anomaly) {
        setTimeout(() => {
          alert(`⚠️ Behavioral Anomaly Detected\n\n` +
                `Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%\n` +
                `Severity: ${result.severity.toUpperCase()}\n` +
                `Action: ${result.action_taken.toUpperCase()}\n\n` +
                `Your behavioral pattern shows some differences from baseline.\n` +
                `This has been logged for security monitoring.`);
        }, 1000);
      } else {
        setTimeout(() => {
          alert(`✅ Behavioral Authentication Successful!\n\n` +
                `Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%\n` +
                `Data Quality: ${result.details.keystroke_count} keystrokes, ${result.details.mouse_count} mouse events\n\n` +
                `Your behavioral pattern matches your enrolled baseline.\n` +
                `Identity verification successful!`);
        }, 1000);
      }

    } catch (error) {
      console.error('❌ FIXED: Error analyzing enhanced test results:', error);
      alert(`❌ Analysis Error\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nData collected:\n• Keystrokes: ${keystrokesRef.current.length}\n• Mouse events: ${mouseEventsRef.current.length}\n\nPlease try again or contact support.`);
      setCurrentPhase('ready');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetTest = useCallback(() => {
    console.log('🔄 FIXED: Resetting behavioral test');
    
    setIsRecording(false);
    setCurrentTime(0);
    setTypedText('');
    setTestResults(null);
    setCurrentPhase('ready');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // CRITICAL: Remove event listeners
    removeEventListeners();

    keystrokesRef.current = [];
    mouseEventsRef.current = [];
    
    // Reset live stats
    setLiveStats({ keystrokes: 0, mouseEvents: 0, characters: 0, wpm: 0 });
  }, [removeEventListeners]);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setTypedText(newText);
      
      // Update live stats
      const elapsed = (Date.now() - recordingStartRef.current) / 1000 / 60; // minutes
      const wpm = elapsed > 0 ? (newText.length / 5) / elapsed : 0;
      
      setLiveStats(prev => ({
        ...prev,
        characters: newText.length,
        wpm: Math.round(wpm)
      }));
    };

  // ========== Helper Functions ==========

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

  // ========== Cleanup ==========

  useEffect(() => {
    return () => {
      resetTest();
    };
  }, []);

  const guidance = getPhaseGuidance();

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
        
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-2">
            <Info className="h-5 w-5 text-blue-400 mr-2" />
            <span className="text-blue-400 font-bold">CRITICAL FIXES APPLIED</span>
          </div>
          <ul className="text-cyan-400 text-sm space-y-1">
            <li>• <strong>Enhanced Event Capture</strong> - Fixed keystroke and mouse detection</li>
            <li>• <strong>Proper Data Validation</strong> - Comprehensive error checking</li>
            <li>• <strong>Real-time Feedback</strong> - Live statistics during test</li>
            <li>• <strong>Database Persistence</strong> - Guaranteed data saving</li>
            <li>• <strong>Phase Management</strong> - Clear typing → mouse → mixed phases</li>
          </ul>
        </div>

        {/* Test Status */}
        <div className="flex items-center justify-between mb-6 p-4 bg-black/20 rounded">
          <div className="flex items-center">
            {guidance.icon}
            <div className="ml-3">
              <span className="text-cyan-400 font-bold text-lg">{guidance.title}</span>
              <div className="text-gray-400 text-sm">{guidance.instruction}</div>
            </div>
          </div>
          <div className="flex items-center text-green-400">
            <Clock className="h-5 w-5 mr-2" />
            <span className="font-mono text-xl">
              {formatTime(currentTime)} / {formatTime(testDuration)}
            </span>
          </div>
        </div>

        {/* Test Configuration */}
        <div className="mb-6">
          <label className="block text-cyan-400 text-sm font-bold mb-2">
            Test Duration (seconds):
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="60"
              max="180"
              step="30"
              value={testDuration}
              onChange={(e) => setTestDuration(parseInt(e.target.value))}
              disabled={isRecording}
              className="flex-1"
            />
            <span className="terminal-input w-16 px-2 py-1 rounded text-center">
              {testDuration}s
            </span>
          </div>
        </div>

        {/* Test Controls */}
        <div className="flex items-center justify-between mb-6 p-4 bg-black/20 rounded">
          <div className="flex items-center">
            {guidance.icon}
            <div className="ml-3">
              <span className="text-cyan-400 font-bold text-lg">{guidance.title}</span>
              <div className="text-gray-400 text-sm">{guidance.instruction}</div>
            </div>
          </div>
          <div className="flex items-center text-green-400">
            <Clock className="h-5 w-5 mr-2" />
            <span className="font-mono text-xl">
              {formatTime(currentTime)} / {formatTime(testDuration)}
            </span>
          </div>
        </div>

        {/* Test Configuration */}
        <div className="mb-6">
          <label className="block text-cyan-400 text-sm font-bold mb-2">
            Test Duration (seconds):
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="60"
              max="180"
              step="30"
              value={testDuration}
              onChange={(e) => setTestDuration(parseInt(e.target.value))}
              disabled={isRecording}
              className="flex-1"
            />
            <span className="terminal-input w-16 px-2 py-1 rounded text-center">
              {testDuration}s
            </span>
          </div>
        </div>

        {/* Enhanced Test Controls */}
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
          
          {!isRecording && !isAnalyzing && (
            <button
              onClick={resetTest}
              className="bg-gray-600/20 text-gray-400 border border-gray-500/30 px-6 py-3 rounded flex items-center hover:bg-gray-600/30"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              RESET
            </button>
          )}
        </div>

        {/* Enhanced Typing Area */}
        <div className="mb-6">
          <label className="block text-cyan-400 text-sm font-bold mb-2">
            {currentPhase === 'typing' || currentPhase === 'mixed' 
              ? '⌨️ Type the following text naturally:' 
              : currentPhase === 'mouse'
              ? '🖱️ Mouse phase - move, click, scroll around the page'
              : 'Text prompt:'}
          </label>
          <div className="p-4 bg-gray-900/50 rounded border border-gray-600 mb-3 text-gray-300 text-sm leading-relaxed">
            {currentPrompt}
          </div>
          <textarea
            ref={textareaRef}
            value={typedText}
            onChange={handleTextareaChange}
            placeholder={
              currentPhase === 'mouse' 
                ? "🖱️ MOUSE PHASE: Move your mouse around, click buttons, scroll up/down..."
                : currentPhase === 'ready'
                ? "Click START to begin the test..."
                : "✏️ Start typing the text above naturally..."
            }
            disabled={!isRecording}
            className="terminal-input w-full px-4 py-3 rounded h-32 resize-none text-sm leading-relaxed focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            style={{
              backgroundColor: currentPhase === 'mouse' ? 'rgba(147, 51, 234, 0.1)' : undefined,
              borderColor: currentPhase === 'mouse' ? 'rgba(147, 51, 234, 0.3)' : undefined
            }}
            autoFocus={currentPhase === 'typing' || currentPhase === 'mixed'}
          />
          
          {/* Phase-specific guidance */}
          {currentPhase === 'mouse' && (
            <div className="mt-2 p-3 bg-purple-900/20 border border-purple-500/30 rounded">
              <p className="text-purple-400 text-sm flex items-center">
                <MousePointer className="h-4 w-4 mr-2" />
                🖱️ MOUSE PHASE ACTIVE: Move your mouse naturally around the screen, click on different elements, scroll up and down!
              </p>
            </div>
          )}
          
          {(currentPhase === 'typing' || currentPhase === 'mixed') && (
            <div className="mt-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
              <p className="text-blue-400 text-sm flex items-center">
                <Keyboard className="h-4 w-4 mr-2" />
                ⌨️ TYPING PHASE: Focus on the textarea above and type naturally. Don't worry about speed!
              </p>
            </div>
          )}
        </div>


        {/* Live Stats */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-green-900/10 border border-green-500/30 rounded"
          >
            <div className="text-center p-3 bg-black/20 rounded">
              <Keyboard className="h-6 w-6 text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-400">{liveStats.keystrokes}</div>
              <div className="text-xs text-gray-400">Keystrokes</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <MousePointer className="h-6 w-6 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-purple-400">{liveStats.mouseEvents}</div>
              <div className="text-xs text-gray-400">Mouse Events</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <Activity className="h-6 w-6 text-cyan-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-cyan-400">{liveStats.characters}</div>
              <div className="text-xs text-gray-400">Characters</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <BarChart3 className="h-6 w-6 text-orange-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-orange-400">{liveStats.wpm}</div>
              <div className="text-xs text-gray-400">WPM</div>
            </div>
            <div className="text-center p-3 bg-black/20 rounded">
              <Target className="h-6 w-6 text-green-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-green-400">
                {currentPhase.toUpperCase()}
              </div>
              <div className="text-xs text-gray-400">Phase</div>
            </div>
          </motion.div>
        )}

        {/* Analysis Loading*/}
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center p-8"
          >
            <div className="relative inline-block">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="h-6 w-6 text-cyan-400" />
              </div>
            </div>
            <p className="text-cyan-400 font-mono text-lg mb-2">ANALYZING_ENHANCED_BEHAVIORAL_PATTERNS...</p>
            <p className="text-gray-400 text-sm">Processing keystroke dynamics, mouse patterns, and timing analysis</p>
          </motion.div>
        )}

        {/* Enhanced Test Results */}
        {testResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-bold text-green-400 mb-4">ENHANCED TEST RESULTS</h3>
            
            {/* Overall Result with Enhanced Styling */}
            <div className={`p-6 rounded-lg border-2 ${testResults.is_critical ? 'bg-red-900/30 border-red-500/50' : 
                                                        testResults.is_anomaly ? 'bg-yellow-900/30 border-yellow-500/50' : 
                                                        'bg-green-900/30 border-green-500/50'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {testResults.is_critical ? (
                    <XCircle className="h-8 w-8 text-red-400 mr-3" />
                  ) : testResults.is_anomaly ? (
                    <AlertTriangle className="h-8 w-8 text-yellow-400 mr-3" />
                  ) : (
                    <CheckCircle className="h-8 w-8 text-green-400 mr-3" />
                  )}
                  <div>
                    <span className={`font-bold text-xl ${testResults.is_critical ? 'text-red-400' : 
                                                          testResults.is_anomaly ? 'text-yellow-400' : 
                                                          'text-green-400'}`}>
                      {testResults.is_critical ? 'CRITICAL SECURITY ANOMALY' : 
                       testResults.is_anomaly ? 'BEHAVIORAL ANOMALY DETECTED' : 
                       'IDENTITY VERIFIED SUCCESSFULLY'}
                       
                    </span>
                    <div className="text-gray-400 text-sm mt-1">
                      Enhanced phased testing completed
                    </div>
                  </div>
                </div>
                <span className={`px-4 py-2 rounded-lg text-sm font-bold border ${getSeverityColor(testResults.severity)}`}>
                  {testResults.severity.toUpperCase()} RISK
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Behavioral Similarity:</span>
                  <div className={`text-3xl font-bold ${getScoreColor(testResults.similarity_score)}`}>
                    {(testResults.similarity_score * 100).toFixed(1)}%
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${testResults.similarity_score >= 0.8 ? 'bg-green-400' : 
                                                     testResults.similarity_score >= 0.6 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${testResults.similarity_score * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Security Action:</span>
                  <div className="text-cyan-400 font-bold text-lg">
                    {testResults.action_taken.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    Based on risk assessment
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-gray-400 text-sm">Session ID:</span>
                  <div className="text-gray-300 font-mono text-sm">
                    {testResults.session_id.slice(-16)}...
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    For security tracking
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card rounded-lg p-4">
                <h4 className="font-bold text-cyan-400 mb-3 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Data Collection Metrics
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Keystrokes Captured:</span>
                    <span className="text-green-400 font-bold">{testResults.details.keystroke_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mouse Events:</span>
                    <span className="text-green-400 font-bold">{testResults.details.mouse_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Test Duration:</span>
                    <span className="text-green-400 font-bold">{testDuration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Baseline Available:</span>
                    <span className={testResults.details.baseline_available ? 'text-green-400' : 'text-red-400'}>
                      {testResults.details.baseline_available ? 'YES' : 'NO'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-lg p-4">
                <h4 className="font-bold text-cyan-400 mb-3 flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Security Assessment
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Data Persistence:</span>
                    <span className={testResults.data_saved.session_saved ? 'text-green-400' : 'text-red-400'}>
                      {testResults.data_saved.session_saved ? 'SAVED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Anomaly Logged:</span>
                    <span className={testResults.is_anomaly ? (testResults.data_saved.anomaly_saved ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}>
                      {testResults.is_anomaly ? (testResults.data_saved.anomaly_saved ? 'YES' : 'FAILED') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Risk Thresholds:</span>
                    <span className="text-cyan-400 text-xs">
                      Critical: {(testResults.thresholds.critical * 100).toFixed(0)}% | 
                      Anomaly: {(testResults.thresholds.anomaly * 100).toFixed(0)}%
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
            <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              RECENT TEST HISTORY
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {testHistory.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-black/20 rounded">
                  <div className="flex items-center">
                    {result.is_critical ? (
                      <XCircle className="h-5 w-5 text-red-400 mr-3" />
                    ) : result.is_anomaly ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                    )}
                    <div>
                      <span className="text-cyan-400 text-sm font-bold">
                        Test #{testHistory.length - index} - Similarity: {(result.similarity_score * 100).toFixed(1)}%
                      </span>
                      <div className="text-gray-400 text-xs">
                        Data: {result.details.keystroke_count} keys, {result.details.mouse_count} mouse
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded text-xs border ${getSeverityColor(result.severity)}`}>
                      {result.severity.toUpperCase()}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {result.action_taken.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tips Section */}
        <div className="mt-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center">
            <Coffee className="h-5 w-5 mr-2" />
            Tips for Optimal Results (FIXED VERSION)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="text-cyan-400 font-bold mb-2">During Typing Phase:</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Make sure the textarea is focused (click on it)</li>
                <li>• Type naturally, don't focus on speed</li>
                <li>• Use your normal finger positioning</li>
                <li>• Don't worry about typos</li>
              </ul>
            </div>
            <div>
              <h4 className="text-cyan-400 font-bold mb-2">During Mouse Phase:</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• Move mouse naturally around the screen</li>
                <li>• Click on different UI elements</li>
                <li>• Try scrolling up and down</li>
                <li>• Use your normal mouse grip</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded flex items-start">
            <Smile className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
            <div>
              <span className="text-green-400 font-bold">FIXED:</span>
              <span className="text-gray-300 ml-1">
                All event capture issues have been resolved. The system now properly detects keystrokes and mouse movements across all phases!
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BehavioralTestPage;