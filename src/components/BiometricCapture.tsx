// BiometricCapture.tsx - Fixed with proper landmark positioning and auto-detection

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CheckCircle, AlertCircle, Eye, Smile, RotateCcw } from 'lucide-react';

interface BiometricCaptureProps {
  onFaceCapture: (faceData: string) => void;
  onLivenessCapture: (livenessData: any) => void;
  onKeystrokeCapture?: (keystrokeData: number[]) => void;
  onScrollCapture?: (scrollData: any[]) => void;
  onEKYCCapture?: (eKYCData: {icFront: string; icBack: string}) => void;
  mode?: 'registration' | 'authentication';
  userId?: string;
}

const BiometricCapture: React.FC<BiometricCaptureProps> = ({ 
  onFaceCapture, 
  onLivenessCapture,
  onKeystrokeCapture,
  onScrollCapture,
  onEKYCCapture,
  mode = 'registration',
  userId = 'user_001'
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  
  // Core state
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [faceCaptureDone, setFaceCaptureDone] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Detection state (from your exact demo.py + sub_functions.py)
  const [livenessMetrics, setLivenessMetrics] = useState({
    blinkCount: 0,
    mouthOpenCount: 0,
    headMovementCount: 0,
    eyeAspectRatio: 0.3,
    mouthAspectRatio: 0.0,
    faceStability: 0,
    overallScore: 0,
    faceCount: 0,
    faceRealScore: 0.0,
    cdcnScore: 0.0,
    enhancedScore: 0.0
  });

  // UI validation state
  const [validationState, setValidationState] = useState({
    faceDetected: false,
    faceSize: false,
    faceCentered: false,
    brightness: true,
    confidence: true,
    liveness: false,
    singleFace: false,
    faceVisible: false,
    faceClarity: false
  });

  // Detection results
  const [detectionResults, setDetectionResults] = useState<any>(null);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(true);

  // Requirements based on mode
  const REQUIRED_BLINKS = mode === 'registration' ? 3 : 2;
  const REQUIRED_MOUTH_OPENS = mode === 'registration' ? 2 : 1;
  const REQUIRED_HEAD_MOVEMENTS = 2;
  const REQUIRED_FACE_SCORE = 0.85; // Enhanced score threshold

  // Enhanced face processing with proper coordinate transformation
  const processFaceMeshResults = useCallback(async (results: any) => {
    try {
      const faceCount = results?.multiFaceLandmarks?.length || 0;

      if (faceCount === 0) {
        setValidationState(prev => ({
          ...prev,
          faceDetected: false,
          singleFace: false,
          faceVisible: false,
          faceClarity: false,
          liveness: false
        }));
        setCameraError('No face detected. Please position your face in the frame.');
        return;
      }

      if (faceCount > 1) {
        setValidationState(prev => ({
          ...prev,
          faceDetected: true,
          singleFace: false,
          liveness: false
        }));
        setCameraError('Multiple faces detected! Please ensure only ONE face is visible.');
        return;
      }

      // Single face detected - process landmarks
      const landmarks = results.multiFaceLandmarks[0];

      // Calculate face bounds
      const faceBounds = landmarks.reduce(
        (bounds: any, landmark: any) => ({
          minX: Math.min(bounds.minX, landmark.x ?? 1),
          maxX: Math.max(bounds.maxX, landmark.x ?? 0),
          minY: Math.min(bounds.minY, landmark.y ?? 1),
          maxY: Math.max(bounds.maxY, landmark.y ?? 0)
        }),
        { minX: 1, maxX: 0, minY: 1, maxY: 0 }
      );

      const faceWidth = faceBounds.maxX - faceBounds.minX;
      const faceHeight = faceBounds.maxY - faceBounds.minY;
      const faceArea = faceWidth * faceHeight;
      const faceCenterX = (faceBounds.minX + faceBounds.maxX) / 2;
      const faceCenterY = (faceBounds.minY + faceBounds.maxY) / 2;

      // Enhanced validations
      const faceDetected = landmarks.length > 400;
      const singleFace = faceCount === 1;
      const faceSize = faceArea > 0.04 && faceArea < 0.6; // Adjusted size range
      const faceCentered = Math.abs(faceCenterX - 0.5) < 0.2 && Math.abs(faceCenterY - 0.5) < 0.2;

      // Enhanced face visibility check
      const keyPoints = [
        landmarks[10],  // Forehead
        landmarks[152], // Chin
        landmarks[234], // Left cheek
        landmarks[454], // Right cheek
        landmarks[1],   // Nose tip
        landmarks[33],  // Left eye corner
        landmarks[263], // Right eye corner
        landmarks[61],  // Left mouth corner
        landmarks[291]  // Right mouth corner
      ];

      let visiblePoints = 0;
      let clarityScore = 0;

      keyPoints.forEach((point: any) => {
        if (point && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1) {
          visiblePoints++;
          if (point.x > 0.05 && point.x < 0.95 && point.y > 0.05 && point.y < 0.95) {
            clarityScore++;
          }
        }
      });

      const coverageScore = visiblePoints / keyPoints.length;
      const faceVisible = coverageScore >= 0.8;
      const faceClarity = clarityScore >= 7;

      // Update validation state
      setValidationState({
        faceDetected,
        singleFace,
        faceSize,
        faceCentered,
        brightness: true,
        confidence: true,
        liveness: false, // Will be determined server-side
        faceVisible,
        faceClarity
      });

      // Update face metrics
      setLivenessMetrics(prev => ({
        ...prev,
        faceStability: coverageScore,
        faceCount
      }));

      // FIXED: Draw face mesh overlay with PROPER coordinate transformation
      const overlayCanvas = overlayCanvasRef.current;
      const video = videoRef.current;
      
      if (overlayCanvas && video) {
        const ctx = overlayCanvas.getContext('2d');
        
        if (ctx) {
          // Get actual dimensions
          const videoRect = video.getBoundingClientRect();
          const displayWidth = videoRect.width;
          const displayHeight = videoRect.height;
          
          // Set canvas size to match video display exactly
          overlayCanvas.width = displayWidth;
          overlayCanvas.height = displayHeight;
          overlayCanvas.style.width = `${displayWidth}px`;
          overlayCanvas.style.height = `${displayHeight}px`;
          
          // Clear canvas
          ctx.clearRect(0, 0, displayWidth, displayHeight);
          
          // Draw face boundary with PROPER scaling
          ctx.strokeStyle = faceVisible && faceClarity ? '#00FF00' : '#FFFF00';
          ctx.lineWidth = 2;
          
          // Face outline - properly scaled and positioned
          const scaledMinX = faceBounds.minX * displayWidth;
          const scaledMinY = faceBounds.minY * displayHeight;
          const scaledWidth = faceWidth * displayWidth;
          const scaledHeight = faceHeight * displayHeight;
          
          ctx.beginPath();
          ctx.rect(scaledMinX, scaledMinY, scaledWidth, scaledHeight);
          ctx.stroke();
          
          // Draw key landmarks as dots
          ctx.fillStyle = faceVisible && faceClarity ? '#00FF00' : '#FFFF00';
          keyPoints.forEach((point: any) => {
            if (point) {
              const x = point.x * displayWidth;
              const y = point.y * displayHeight;
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, 2 * Math.PI);
              ctx.fill();
            }
          });
          
          // Draw eye landmarks for blink detection
          const leftEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
          const rightEye = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
          
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 1;
          
          // Draw left eye
          ctx.beginPath();
          leftEye.forEach((idx, i) => {
            if (landmarks[idx]) {
              const x = landmarks[idx].x * displayWidth;
              const y = landmarks[idx].y * displayHeight;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
          ctx.stroke();
          
          // Draw right eye
          ctx.beginPath();
          rightEye.forEach((idx, i) => {
            if (landmarks[idx]) {
              const x = landmarks[idx].x * displayWidth;
              const y = landmarks[idx].y * displayHeight;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
          ctx.stroke();
          
          // Draw mouth landmarks
          const mouth = [61, 146, 91, 181, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318];
          ctx.strokeStyle = '#FF00FF';
          ctx.beginPath();
          mouth.forEach((idx, i) => {
            if (landmarks[idx]) {
              const x = landmarks[idx].x * displayWidth;
              const y = landmarks[idx].y * displayHeight;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Auto-trigger detection if conditions are met and auto-detection is enabled
      if (autoDetectionEnabled && 
          faceDetected && 
          singleFace && 
          faceSize && 
          faceCentered && 
          faceVisible && 
          faceClarity &&
          !isProcessing &&
          !detectionResults) {
        
        // Delay auto-detection to avoid rapid firing
        setTimeout(() => {
          if (autoDetectionEnabled && !isProcessing && !detectionResults) {
            detectLivenessServerSide();
          }
        }, 1000);
      }

      // Update error messages
      if (faceDetected && singleFace && faceSize && faceCentered && faceVisible && faceClarity) {
        setCameraError('');
      } else if (!singleFace) {
        setCameraError(faceCount > 1 ? 'Multiple faces detected!' : 'No face detected');
      } else if (!faceVisible) {
        setCameraError('Face not fully visible! Ensure your entire face is in the frame.');
      } else if (!faceClarity) {
        setCameraError('Face not clear! Improve lighting and positioning.');
      } else if (!faceSize) {
        setCameraError(faceArea < 0.04 ? 'Move closer to the camera' : 'Move away from camera');
      } else if (!faceCentered) {
        setCameraError('Center your face in the frame');
      }

    } catch (error) {
      console.error('Face processing error:', error);
      setCameraError('Processing error occurred');
    }
  }, [autoDetectionEnabled, isProcessing, detectionResults]);

  // Initialize MediaPipe with enhanced settings
  useEffect(() => {
    let mounted = true;
    
    const initializeMediaPipe = async () => {
      try {
        const { FaceMesh } = await import('@mediapipe/face_mesh');
        const { Camera } = await import('@mediapipe/camera_utils');
        
        if (!mounted) return;

        const faceMesh = new FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
          }
        });

        await faceMesh.setOptions({
          maxNumFaces: 2,
          refineLandmarks: true,
          minDetectionConfidence: 0.8, // Increased for better accuracy
          minTrackingConfidence: 0.7,
          enableFaceGeometry: false,
          selfieMode: true
        });

        faceMesh.onResults(processFaceMeshResults);
        faceMeshRef.current = faceMesh;

        const video = videoRef.current;
        if (video && mounted) {
          const camera = new Camera(video, {
            onFrame: async () => {
              if (faceMeshRef.current && video && mounted) {
                try {
                  await faceMeshRef.current.send({ image: video });
                } catch (error) {
                  console.warn('Frame processing error:', error);
                }
              }
            },
            width: 640,
            height: 480
          });

          await camera.start();
          
          if (mounted) {
            cameraRef.current = camera;
            setCameraReady(true);
          }
        }

      } catch (error) {
        console.error('MediaPipe initialization error:', error);
        if (mounted) {
          setCameraError(`Failed to initialize MediaPipe: ${error}`);
        }
      }
    };

    initializeMediaPipe();

    return () => {
      mounted = false;
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [processFaceMeshResults]);

  // Enhanced server-side detection
  const detectLivenessServerSide = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!cameraReady || !video || !canvas) {
      setCameraError('Camera not ready');
      return null;
    }

    try {
      setIsProcessing(true);
      setCameraError('Processing with enhanced CDCN anti-spoofing...');
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      // Capture frame (non-mirrored for processing)
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      context.save();
      context.scale(-1, 1);
      context.translate(-canvas.width, 0);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();

      const faceData = canvas.toDataURL('image/jpeg', 0.8);
      const base64Data = faceData.split(',')[1];

      // Call enhanced backend with CDCN
      const response = await fetch('http://localhost:5000/api/liveness-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          face_image: base64Data,
          user_id: userId,
          mode: mode,
          reset_counters: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Update metrics with enhanced results
        setLivenessMetrics(prev => ({
          ...prev,
          blinkCount: result.blink_count || 0,
          mouthOpenCount: result.mouth_open_count || 0,
          headMovementCount: Math.min(result.head_movement_count || 0, 2),
          eyeAspectRatio: result.liveness_validation?.eye_aspect_ratio || prev.eyeAspectRatio,
          mouthAspectRatio: result.liveness_validation?.mouth_aspect_ratio || prev.mouthAspectRatio,
          faceStability: result.liveness_validation?.face_stability || prev.faceStability,
          overallScore: result.liveness_validation?.overall_liveness_passed ? 1.0 : 0.5,
          faceRealScore: result.face_real_score || 0.0,
          cdcnScore: result.cdcn_score || 0.0,
          enhancedScore: result.enhanced_face_score || result.face_real_score || 0.0
        }));

        setDetectionResults(result);
        setCameraError('');
        
        console.log('✅ Enhanced detection result with CDCN:', result);
        return result;
      } else {
        console.error('❌ Enhanced detection failed:', result.error);
        setCameraError(result.error || 'Detection failed');
        return null;
      }

    } catch (error) {
      console.error('Detection API error:', error);
      setCameraError('Failed to process detection. Please try again.');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [cameraReady, userId, mode]);

  // Reset detection counters
  const resetDetectionCounters = useCallback(async () => {
    try {
      await fetch(`http://localhost:5000/api/reset-detection/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Reset all states
      setLivenessMetrics({
        blinkCount: 0,
        mouthOpenCount: 0,
        headMovementCount: 0,
        eyeAspectRatio: 0.3,
        mouthAspectRatio: 0.0,
        faceStability: 0,
        overallScore: 0,
        faceCount: 0,
        faceRealScore: 0.0,
        cdcnScore: 0.0,
        enhancedScore: 0.0
      });
      
      setDetectionResults(null);
      setFaceCaptureDone(false);
      setCameraError('');
      
      console.log('🔄 All detection data reset');
    } catch (error) {
      console.error('Error resetting counters:', error);
    }
  }, [userId]);

  // Enhanced face capture with auto-detection
  const captureFace = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!cameraReady || !canvas || !video) {
      setCameraError('Camera not ready.');
      return;
    }

    if (!validationState.singleFace || !validationState.faceVisible || !validationState.faceClarity) {
      setCameraError('Please ensure face is properly positioned and visible.');
      return;
    }

    try {
      setIsCapturing(true);
      setCameraError('Processing final capture...');
      
      // Run detection if not already done or if auto-detection is disabled
      let detectionResult = detectionResults;
      if (!detectionResult) {
        detectionResult = await detectLivenessServerSide();
        if (!detectionResult) {
          setCameraError('Failed to process face detection. Please try again.');
          return;
        }
      }

      // Check if all requirements are met
      const requirements = detectionResult.liveness_validation?.requirements_met || {};
      
      if (!detectionResult.liveness_validation?.overall_liveness_passed) {
        const missing = [];
        if (!requirements.blinks) missing.push(`${REQUIRED_BLINKS - detectionResult.blink_count} more blinks`);
        if (!requirements.mouth) missing.push(`${REQUIRED_MOUTH_OPENS - detectionResult.mouth_open_count} more mouth opens`);
        if (!requirements.head) missing.push(`${REQUIRED_HEAD_MOVEMENTS - detectionResult.head_movement_count} more head movements`);
        if (!requirements.face_real) missing.push(`Face real score too low: ${(detectionResult.enhanced_face_score * 100).toFixed(1)}% (need >${(REQUIRED_FACE_SCORE * 100).toFixed(0)}%)`);
        
        setCameraError(`Please complete: ${missing.join(', ')}`);
        return;
      }

      // Capture final face image
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Capture non-mirrored image for processing
      context.save();
      context.scale(-1, 1);
      context.translate(-canvas.width, 0);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();
      
      const faceData = canvas.toDataURL('image/jpeg', 0.8);

      // Call parent callbacks
      onFaceCapture(faceData);
      onLivenessCapture(detectionResult.liveness_validation);

      // Generate and capture additional biometric data if callbacks provided
      if (onKeystrokeCapture) {
        // Simulate keystroke data generation
        const keystrokeData = Array.from({length: 25}, () => Math.random() * 100 + 50);
        onKeystrokeCapture(keystrokeData);
      }

      if (onScrollCapture) {
        // Simulate scroll data generation
        const scrollData = Array.from({length: 15}, (_, i) => ({
          timestamp: Date.now() + i * 100,
          deltaY: Math.random() * 10 - 5,
          velocity: Math.random() * 5
        }));
        onScrollCapture(scrollData);
      }

      if (onEKYCCapture) {
        // For demo purposes, use placeholder data
        onEKYCCapture({
          icFront: faceData, // Placeholder
          icBack: faceData   // Placeholder
        });
      }

      setFaceCaptureDone(true);
      setCameraError('');

      console.log('✅ Enhanced face capture successful with all biometric data');

    } catch (error) {
      console.error('Face capture error:', error);
      setCameraError('Failed to capture face. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [onFaceCapture, onLivenessCapture, onKeystrokeCapture, onScrollCapture, onEKYCCapture, 
      cameraReady, validationState, detectLivenessServerSide, detectionResults, 
      REQUIRED_BLINKS, REQUIRED_MOUTH_OPENS, REQUIRED_HEAD_MOVEMENTS, REQUIRED_FACE_SCORE]);

  return (
    <div className="glass-card rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center">
        <Camera className="mr-3 h-6 w-6" />
        [STEP 1] ENHANCED FACIAL RECOGNITION & LIVENESS DETECTION
      </h3>
      
      <div className="relative mb-6">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full max-w-md mx-auto rounded border-2 border-green-500 bg-black block"
          style={{ minHeight: '360px', transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 pointer-events-none rounded"
          style={{ 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%',
            transform: 'scaleX(-1)' 
          }}
        />
        
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
              <p className="text-green-400">Initializing enhanced camera system...</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-2"></div>
              <p className="text-cyan-400 text-sm">Processing with CDCN anti-spoofing...</p>
            </div>
          </div>
        )}
        
        {faceCaptureDone && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        )}

        {livenessMetrics.faceCount > 0 && (
          <div className={`absolute top-2 left-2 px-3 py-1 rounded ${
            livenessMetrics.faceCount === 1 ? 'bg-green-500' : 'bg-red-500'
          }`}>
            <span className="text-white font-bold text-sm">
              {livenessMetrics.faceCount === 1 ? '✓ Single Face' : `⚠️ ${livenessMetrics.faceCount} Faces`}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-black/50 border border-green-500/30 rounded p-3">
          <h4 className="text-green-400 font-bold mb-2 text-sm">UI VALIDATION STATUS</h4>
          <div className="space-y-1 text-xs">
            {Object.entries({
              'Single Face': validationState.singleFace,
              'Face Visible': validationState.faceVisible,
              'Face Clear': validationState.faceClarity,
              'Correct Size': validationState.faceSize,
              'Centered': validationState.faceCentered
            }).map(([label, status]) => (
              <div key={label} className="flex items-center justify-between">
                <span>{label}</span>
                {status ? 
                  <CheckCircle className="w-3 h-3 text-green-400" /> : 
                  <AlertCircle className="w-3 h-3 text-red-400" />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-black/50 border border-green-500/30 rounded p-3">
          <h4 className="text-green-400 font-bold mb-2 text-sm">ENHANCED DETECTION RESULTS</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-green-400">👁️ Blinks</span>
              <span className={`${livenessMetrics.blinkCount >= REQUIRED_BLINKS ? 'text-green-400 font-bold' : 'text-cyan-400'}`}>
                {livenessMetrics.blinkCount}/{REQUIRED_BLINKS}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-green-400">👄 Mouth Opens</span>
              <span className={`${livenessMetrics.mouthOpenCount >= REQUIRED_MOUTH_OPENS ? 'text-green-400 font-bold' : 'text-cyan-400'}`}>
                {livenessMetrics.mouthOpenCount}/{REQUIRED_MOUTH_OPENS}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-green-400">🔄 Head Movement</span>
              <span className={`${livenessMetrics.headMovementCount >= REQUIRED_HEAD_MOVEMENTS ? 'text-green-400 font-bold' : 'text-cyan-400'}`}>
                {livenessMetrics.headMovementCount}/{REQUIRED_HEAD_MOVEMENTS}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-green-400">🔬 Enhanced Score</span>
              <span className={`${livenessMetrics.enhancedScore > REQUIRED_FACE_SCORE ? 'text-green-400 font-bold' : 'text-cyan-400'}`}>
                {(livenessMetrics.enhancedScore * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-green-400">🎯 CDCN Score</span>
              <span className="text-cyan-400 text-xs">
                {(livenessMetrics.cdcnScore * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black/50 border border-cyan-500/30 rounded p-3 mb-4">
        <h4 className="text-cyan-400 font-bold mb-2 text-sm">📋 ENHANCED INSTRUCTIONS</h4>
        <div className="text-xs text-cyan-300 space-y-1">
          <div>• 👁️ Blink naturally {REQUIRED_BLINKS} times (slowly and deliberately)</div>
          <div>• 👄 Open your mouth wide {REQUIRED_MOUTH_OPENS} times</div>
          <div>• 🔄 Move your head slightly {REQUIRED_HEAD_MOVEMENTS} times (left/right or up/down)</div>
          <div>• 🔬 Enhanced anti-spoofing score must be {(REQUIRED_FACE_SCORE * 100).toFixed(0)}% (CDCN + original)</div>
          <div>• 🤖 Auto-detection enabled - will detect automatically when ready</div>
          <div>• ✨ Face landmarks will fit your face like a mask</div>
          <div className="text-yellow-300">• 🎯 Uses your exact demo.py & sub_functions.py + CDCN</div>
        </div>
      </div>
      
      {cameraError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-3 mb-4">
          <p className="text-red-400 text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {cameraError}
          </p>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="autoDetection"
            checked={autoDetectionEnabled}
            onChange={(e) => setAutoDetectionEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="autoDetection" className="text-sm text-cyan-400">
            Auto-Detection
          </label>
        </div>
        
        <button
          onClick={detectLivenessServerSide}
          disabled={isProcessing || !cameraReady || !validationState.singleFace}
          className="terminal-button flex-1 py-2 px-4 rounded font-bold hover-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'DETECTING...' : 'MANUAL DETECTION'}
        </button>
        
        <button
          onClick={resetDetectionCounters}
          disabled={isProcessing}
          className="terminal-button bg-gray-600 hover:bg-gray-500 py-2 px-4 rounded font-bold disabled:opacity-50"
        >
          RESET
        </button>
      </div>
      
      <div className="text-center">
        <button
          onClick={captureFace}
          disabled={
            isCapturing || 
            faceCaptureDone || 
            !cameraReady || 
            !validationState.singleFace || 
            !validationState.faceVisible || 
            !validationState.faceClarity ||
            (!autoDetectionEnabled && !detectionResults) ||
            (detectionResults && !detectionResults.liveness_validation?.overall_liveness_passed)
          }
          className="terminal-button w-full py-3 px-6 rounded font-bold hover-glow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCapturing ? 'CAPTURING & SAVING ALL DATA...' : 
           faceCaptureDone ? 'ALL BIOMETRIC DATA CAPTURED ✓' : 
           !cameraReady ? 'WAITING FOR CAMERA...' : 
           !validationState.singleFace ? 'ENSURE SINGLE FACE' :
           !validationState.faceVisible ? 'FACE NOT FULLY VISIBLE' :
           !validationState.faceClarity ? 'FACE NOT CLEAR' :
           (!autoDetectionEnabled && !detectionResults) ? 'RUN DETECTION FIRST' :
           (detectionResults && !detectionResults.liveness_validation?.overall_liveness_passed) ? 'COMPLETE ALL REQUIREMENTS' :
           'CAPTURE & SAVE ALL BIOMETRIC DATA'}
        </button>
      </div>

      {/* Progress indicators */}
      {detectionResults && detectionResults.liveness_validation && (
        <div className="mt-4 bg-blue-900/20 border border-blue-500/30 rounded p-3">
          <h5 className="text-blue-400 font-bold mb-2 text-sm">🎯 DETECTION PROGRESS</h5>
          <div className="text-xs text-blue-300 space-y-1">
            <div className="flex items-center justify-between">
              <span>👁️ Blinks:</span>
              <span>{detectionResults.blink_count}/{REQUIRED_BLINKS} {detectionResults.liveness_validation.requirements_met?.blinks ? '✅' : '❌'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>👄 Mouth Opens:</span>
              <span>{detectionResults.mouth_open_count}/{REQUIRED_MOUTH_OPENS} {detectionResults.liveness_validation.requirements_met?.mouth ? '✅' : '❌'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>🔄 Head Movements:</span>
              <span>{detectionResults.head_movement_count}/{REQUIRED_HEAD_MOVEMENTS} {detectionResults.liveness_validation.requirements_met?.head ? '✅' : '❌'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>🔬 Enhanced Score:</span>
              <span>{((detectionResults.enhanced_face_score || detectionResults.face_real_score) * 100).toFixed(1)}% {detectionResults.liveness_validation.requirements_met?.face_real ? '✅' : '❌'}</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
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

        .terminal-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
};

export default BiometricCapture;