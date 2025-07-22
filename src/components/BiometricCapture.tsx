//biometriccapture.tsx - FIXED VERSION WITH DEBUG
import { supabase } from '../lib/supabase';
import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CheckCircle, AlertCircle, Loader2, RefreshCw, User } from "lucide-react";

//   UPDATED: Match actual backend response format
interface LivenessResponse {
  success: boolean;
  face_detected: boolean;
  blink_count: number;
  mouth_open_count: number;
  head_movement_count: number;
  face_real_score: number;
  cdcn_score?: number;
  enhanced_face_score?: number;
  
  //   NEW: Handle both old and new response formats
  all_completed?: boolean;  // New backend format
  cached_response?: boolean;
  
  //   OPTIONAL: Legacy format (if backend still sends this)
  sequential_state?: {
    current_phase: "blinking" | "mouth" | "head" | "complete";
    blinks_completed: boolean;
    mouth_completed: boolean;
    head_completed: boolean;
    all_phases_complete: boolean;
  };
  liveness_validation?: {
    overall_liveness_passed: boolean;
    step_requirements: {
      blinks_met: boolean;
      mouth_met: boolean;
      head_met: boolean;
      score_met: boolean;
    };
  };
  error?: string;
}

interface LivenessMetrics {
  blinkCount: number;
  mouthOpenCount: number;
  headMovementCount: number;
  faceCount: number;
  faceRealScore: number;
  cdcnScore: number;
  enhancedScore: number;
}

interface BiometricCaptureProps {
  onFaceCapture: (faceData: string, faceUrl?: string) => void;
  onLivenessCapture: (livenessData: any) => void;
  mode: "registration" | "login" | "authentication";
  userId?: string;
  onProgressUpdate?: (progress: {
    phase: string;
    blinks: number;
    mouth: number;
    head: number;
  }) => void;
}

type WorkflowStep =
  | "ready"
  | "capturing_face"
  | "blink_prompt"
  | "mouth_prompt"
  | "head_prompt"
  | "antispoofing"
  | "saving"
  | "complete";

const BiometricCapture: React.FC<BiometricCaptureProps> = ({
  onFaceCapture,
  onLivenessCapture,
  mode = "registration",
  userId = "user_001",
  onProgressUpdate
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [singleFaceConfirmed, setSingleFaceConfirmed] = useState(false);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("ready");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<"ready" | "blinking" | "mouth" | "head" | "complete">("ready");
  const [phaseCompleted, setPhaseCompleted] = useState({
    blinks: false,
    mouth: false,
    head: false
  });
  
  const [livenessMetrics, setLivenessMetrics] = useState<LivenessMetrics>({
    blinkCount: 0,
    mouthOpenCount: 0,
    headMovementCount: 0,
    faceCount: 0,
    faceRealScore: 0,
    cdcnScore: 0,
    enhancedScore: 0
  });
  const [lastLivenessResult, setLastLivenessResult] = useState<LivenessResponse | null>(null);

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setCameraReady(true);
          setCameraError("");
        }
      } catch (err) {
        console.error("Camera init error:", err);
        setCameraError("Camera access denied. Please allow camera permissions.");
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const determineCurrentPhase = useCallback((metrics: LivenessMetrics, isAllCompleted: boolean) => {
    console.log("  [PHASE LOGIC] Determining current phase", {
      metrics,
      isAllCompleted,
      phaseCompleted
    });

    // If backend says all completed, only then show complete
    if (isAllCompleted) {
      console.log("  [PHASE LOGIC] Backend confirms all completed");
      return "complete";
    }

    // Determine phase based on what's not yet completed
    if (metrics.blinkCount < 2) {
      console.log("  [PHASE LOGIC] Still need blinks", {
        current: metrics.blinkCount,
        required: 2
      });
      return "blinking";
    } else if (metrics.mouthOpenCount < 1) {
      console.log("  [PHASE LOGIC] Still need mouth opens", {
        current: metrics.mouthOpenCount,
        required: 1
      });
      return "mouth";
    } else if (metrics.headMovementCount < 1) {
      console.log(" [PHASE LOGIC] Still need head movements", {
        current: metrics.headMovementCount,
        required: 1
      });
      return "head";
    } else {
      console.log("[PHASE LOGIC] All metrics met (2 blinks, 1 mouth, 1 head), waiting for backend confirmation");
      return "head"; // Keep in head phase until backend confirms completion
    }
  }, [phaseCompleted]);

  const getStepPrompt = (step: WorkflowStep): string => {
    const metrics = livenessMetrics;
    
    console.log("  [PROMPT] Getting step prompt", {
      step,
      currentPhase,
      metrics,
      phaseCompleted
    });

    // Use our own phase logic instead of relying on backend sequential_state
    if (currentPhase === "blinking") {
      return `Please blink 2 times slowly (${metrics.blinkCount}/2)`;
    } else if (currentPhase === "mouth") {
      return `Please open your mouth 1 time (${metrics.mouthOpenCount}/1)`;
    } else if (currentPhase === "head") {
      return `Please move your head slowly left and right (${metrics.headMovementCount}/1)`;
    } else if (currentPhase === "complete") {
      return "All verification steps completed successfully!";
    } else {
      return "Preparing verification...";
    }
  };

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Flip horizontally for mirror effect
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  const runSequentialDetection = useCallback(async (resetCounters: boolean = false): Promise<LivenessResponse | null> => {
    console.log(" [API] Starting runSequentialDetection", {
      resetCounters,
      userId,
      mode,
      currentStep,
      currentPhase,
      timestamp: new Date().toISOString()
    });

    const frameData = captureFrame();
    if (!frameData) {
      console.error(" [ERROR] Failed to capture frame");
      return null;
    }

    try {
      const requestPayload = {
        user_id: userId,
        face_image: frameData,
        mode: mode,
        reset_counters: resetCounters,
        current_step: currentStep
      };

      console.log(" [API] Sending request to backend", {
        url: "http://localhost:5000/api/sequential-liveness-detect",
        payload: {
          ...requestPayload,
          face_image: `[${frameData.length} chars]`
        }
      });

      const response = await fetch("http://localhost:5000/api/sequential-liveness-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(" [API ERROR]", errorData);
        setCameraError(`Detection error: ${errorData.error || response.statusText}`);
        return null;
      }

      const result: LivenessResponse = await response.json();
      
      console.log("[API RESPONSE] Full response received:", {
        fullResult: result,
        resultKeys: Object.keys(result),
        resultTypes: Object.fromEntries(Object.entries(result).map(([k, v]) => [k, typeof v])),
        timestamp: new Date().toISOString()
      });

      console.log(" [RESPONSE FORMAT] Analyzing response format:", {
        hasSequentialState: !!result.sequential_state,
        hasAllCompleted: !!result.all_completed,
        sequentialState: result.sequential_state,
        allCompleted: result.all_completed,
        cachedResponse: result.cached_response
      });

      setLastLivenessResult(result);

      if (result.success) {
        const safeBlinks = Math.min(result.blink_count || 0, 2);
        const safeMouth = Math.min(result.mouth_open_count || 0, 1);
        const safeHead = Math.min(result.head_movement_count || 0, 1);
        
        if ((result.blink_count || 0) > 2) {
          console.warn(" [BACKEND BUG] Backend sent blink count > 2:", result.blink_count);
        }
        if ((result.mouth_open_count || 0) > 1) {
          console.warn(" [BACKEND BUG] Backend sent mouth count > 1:", result.mouth_open_count);
        }
        if ((result.head_movement_count || 0) > 1) {
          console.warn(" [BACKEND BUG] Backend sent head count > 1:", result.head_movement_count);
        }

        const newMetrics = {
          blinkCount: safeBlinks,
          mouthOpenCount: safeMouth,
          headMovementCount: safeHead,
          faceCount: 1,
          faceRealScore: result.face_real_score || 0,
          cdcnScore: result.cdcn_score || 0,
          enhancedScore: result.enhanced_face_score || result.face_real_score || 0
        };

        console.log(" [METRICS UPDATE] Updating metrics", {
          previousMetrics: livenessMetrics,
          newMetrics,
          changes: {
            blinkChange: newMetrics.blinkCount - livenessMetrics.blinkCount,
            mouthChange: newMetrics.mouthOpenCount - livenessMetrics.mouthOpenCount,
            headChange: newMetrics.headMovementCount - livenessMetrics.headMovementCount
          }
        });

        setLivenessMetrics(newMetrics);

        const newPhaseCompleted = {
          blinks: newMetrics.blinkCount >= 2,   
          mouth: newMetrics.mouthOpenCount >= 1, 
          head: newMetrics.headMovementCount >= 1 
        };

        console.log(" [PHASE COMPLETION] Updating phase completion", {
          previousPhaseCompleted: phaseCompleted,
          newPhaseCompleted
        });

        setPhaseCompleted(newPhaseCompleted);
        let isAllCompleted = false;
        
        if (result.sequential_state) {
          // Use legacy format if available
          isAllCompleted = result.sequential_state.all_phases_complete;
          console.log("  [PHASE] Using legacy sequential_state format", {
            current_phase: result.sequential_state.current_phase,
            all_phases_complete: result.sequential_state.all_phases_complete
          });
        } else if (result.all_completed !== undefined) {
          // Use new format
          isAllCompleted = result.all_completed;
          console.log(" [PHASE] Using new all_completed format", {
            all_completed: result.all_completed,
            cached_response: result.cached_response
          });
        } else {
          // Fallback: determine based on metrics
          isAllCompleted = newPhaseCompleted.blinks && newPhaseCompleted.mouth && newPhaseCompleted.head;
          console.log("  [PHASE] Using fallback metrics-based completion", {
            isAllCompleted,
            phaseCompleted: newPhaseCompleted
          });
        }

        //   FIXED: Only update phase, don't prematurely complete
        const determinedPhase = determineCurrentPhase(newMetrics, isAllCompleted);
        console.log("  [PHASE UPDATE] Phase determination result", {
          previousPhase: currentPhase,
          determinedPhase,
          isAllCompleted,
          shouldTransition: determinedPhase !== currentPhase
        });

        if (determinedPhase !== currentPhase) {
          console.log("  [PHASE TRANSITION]", {
            from: currentPhase,
            to: determinedPhase,
            trigger: "backend response"
          });
          setCurrentPhase(determinedPhase);
        }

        // Handle face detection
        if (result.face_detected) {
          setSingleFaceConfirmed(true);
        } else {
          setSingleFaceConfirmed(false);
        }

        // Progress callback
        if (onProgressUpdate) {
          const progressData = {
            phase: determinedPhase,
            blinks: newMetrics.blinkCount,
            mouth: newMetrics.mouthOpenCount,
            head: newMetrics.headMovementCount
          };
          
          console.log("  [PROGRESS] Calling onProgressUpdate", progressData);
          onProgressUpdate(progressData);
        }

      } else {
        console.error("  [API] Backend returned success: false", result.error);
      }

      return result;

    } catch (error) {
      console.error(" [FATAL ERROR] API request failed", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestDetails: {
          userId,
          mode,
          currentStep,
          resetCounters,
          frameDataLength: frameData ? frameData.length : 0
        },
        timestamp: new Date().toISOString()
      });
      
      //   ENHANCED: Better error messages for common issues
      let errorMessage = "Network error. Please check backend connection.";
      
      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage = "Cannot connect to backend. Is the Python server running on localhost:5000?";
      }
      
      setCameraError(errorMessage);
      return null;
    }
  }, [captureFrame, userId, mode, currentStep, currentPhase, livenessMetrics, phaseCompleted, onProgressUpdate, determineCurrentPhase]);

  const saveToSupabase = useCallback(async (faceData: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('  [SUPABASE] Saving face data', {
        hasSession: !!session,
        userId: session?.user?.id || userId
      });
      
      const tempUserId = userId || `temp_${Date.now()}`;
      
      // Convert base64 to blob
      const base64Data = faceData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      // Upload to Supabase
      const fileName = `${tempUserId}_face_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('biometric-faces')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('  [SUPABASE] Upload error:', uploadError);
        setCameraError(`Upload failed: ${uploadError.message}`);
        return false;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('biometric-faces')
        .getPublicUrl(uploadData.path);
    
      console.log('[SUPABASE] Upload successful:', publicUrl);
      
      if (onFaceCapture) {
        onFaceCapture(faceData, publicUrl);
      }
      
      return true;
    } catch (error) {
      console.error("[SUPABASE] Save error:", error);
      setCameraError("Failed to save face image");
      return false;
    }
  }, [userId, onFaceCapture]);

  const executeWorkflow = useCallback(async () => {
    console.log("[WORKFLOW] Starting biometric capture workflow");
    setIsProcessing(true);
    setCameraError("");
    
    try {
      console.log("[WORKFLOW] Resetting counters and state");
      setCurrentPhase("ready");
      setPhaseCompleted({
        blinks: false,
        mouth: false,
        head: false
      });
      
      await runSequentialDetection(true);

      // Capture reference face
      setCurrentStep("capturing_face");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const referenceFace = captureFrame();
      if (!referenceFace) throw new Error("Failed to capture reference face");

      // Start sequential detection phases
      setCurrentStep("blink_prompt");
      setCurrentPhase("blinking");
      
      let allComplete = false;
      let attempts = 0;
      const maxAttempts = 240; // 2 minutes timeout

      console.log("  [WORKFLOW] Starting sequential detection loop");

      while (!allComplete && attempts < maxAttempts) {
        const result = await runSequentialDetection(false);
        
        if (result) {
          const metrics = {
            blinkCount: result.blink_count || 0,
            mouthOpenCount: result.mouth_open_count || 0,
            headMovementCount: result.head_movement_count || 0,
            faceCount: 1,
            faceRealScore: result.face_real_score || 0,
            cdcnScore: result.cdcn_score || 0,
            enhancedScore: result.enhanced_face_score || result.face_real_score || 0
          };

          // Check if backend confirms all completed
          const backendConfirmsComplete = result.all_completed || 
            (result.sequential_state && result.sequential_state.all_phases_complete);

          console.log("  [WORKFLOW] Loop iteration", {
            attempt: attempts,
            metrics,
            backendConfirmsComplete,
            currentPhase,
            result: {
              all_completed: result.all_completed,
              sequential_state: result.sequential_state
            }
          });

          if (backendConfirmsComplete) {
            console.log("[WORKFLOW] Backend confirms all phases complete");
            allComplete = true;
            setCurrentPhase("complete");
            break;
          }

          // Update workflow step based on current phase
          if (currentPhase === "blinking") {
            setCurrentStep("blink_prompt");
          } else if (currentPhase === "mouth") {
            setCurrentStep("mouth_prompt");
          } else if (currentPhase === "head") {
            setCurrentStep("head_prompt");
          }
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!allComplete) {
        throw new Error("Sequential liveness detection timeout - please try again");
      }

      // Final steps
      setCurrentStep("antispoofing");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCurrentStep("saving");
      const uploadSuccess = await saveToSupabase(referenceFace);
      
      if (!uploadSuccess) {
        throw new Error("Failed to save face image");
      }

      // Complete
      setCurrentStep("complete");
      const completeLivenessData = {
        success: true,
        face_detected: true,
        blink_count: livenessMetrics.blinkCount,
        mouth_open_count: livenessMetrics.mouthOpenCount,
        head_movement_count: livenessMetrics.headMovementCount,
        face_real_score: livenessMetrics.faceRealScore,
        enhanced_face_score: livenessMetrics.enhancedScore,
        all_completed: true,
        verification_complete: true,
        final_metrics: {
          blink_count: livenessMetrics.blinkCount,
          mouth_open_count: livenessMetrics.mouthOpenCount,
          head_movement_count: livenessMetrics.headMovementCount,
          face_real_score: livenessMetrics.faceRealScore
        },
        liveness_validation: {
          overall_liveness_passed: true,
          step_requirements: {
            blinks_met: true,
            mouth_met: true,
            head_met: true,
            score_met: true
          }
        }
      };

      console.log("🎉 [WORKFLOW] Sending completion data to parent:", completeLivenessData);
      onLivenessCapture(completeLivenessData);

    } catch (error: any) {
      console.error("  [WORKFLOW ERROR]", error);
      setCameraError(error.message || "Workflow failed");
      setCurrentStep("ready");
      setCurrentPhase("ready");
    } finally {
      setIsProcessing(false);
    }
  }, [runSequentialDetection, captureFrame, saveToSupabase, onLivenessCapture, livenessMetrics, currentPhase]);

  const reset = () => {
    console.log("  [RESET] Resetting biometric capture");
    setCurrentStep("ready");
    setCurrentPhase("ready");
    setCameraError("");
    setPhaseCompleted({
      blinks: false,
      mouth: false,
      head: false
    });
    setLivenessMetrics({
      blinkCount: 0,
      mouthOpenCount: 0,
      headMovementCount: 0,
      faceCount: 0,
      faceRealScore: 0,
      cdcnScore: 0,
      enhancedScore: 0
    });
    setLastLivenessResult(null);
  };

  const isComplete = currentStep === "complete";
  const canStart = cameraReady && currentStep === "ready" && !isProcessing;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-cyan-400 mb-6">Biometric Face Capture</h2>

      {/* Camera View */}
      <div className="relative mx-auto" style={{ maxWidth: "640px" }}>
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-auto transform scale-x-[-1]"
            style={{ maxHeight: "480px" }}
          />
          
          {/* Face guide overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-80 border-2 border-green-400/50 rounded-xl"></div>
            </div>
          </div>
          
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      </div>

      {/* Instructions Box */}
      {currentStep !== "ready" && currentStep !== "complete" && (
        <div className="mt-4 mb-4">
          <div className="glass-card rounded-lg p-4 border-2 border-cyan-400/50">
            <div className="text-center">
              <div className="text-lg font-bold text-cyan-400 mb-2">
                {getStepPrompt(currentStep)}
              </div>
              <div className="text-sm text-gray-400">
              
              </div>
              {isProcessing && (
                <div className="flex items-center justify-center text-cyan-400 text-sm mt-2">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {currentStep !== "ready" && currentStep !== "complete" && (
        <div className="mt-4">
          <div className="glass-card rounded-lg p-4 border border-green-400/30">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className={`p-2 rounded transition-all duration-300 ${
                phaseCompleted.blinks 
                  ? 'bg-green-500/20 border border-green-500 shadow-green-500/20 shadow-lg' 
                  : 'bg-gray-700/50'
              }`}>
                <div className="text-2xl font-bold text-cyan-400">{livenessMetrics.blinkCount}</div>
                <div className="text-xs text-gray-400">Blinks</div>
                <div className="text-xs text-green-400">/2</div>
                {/*   Show completion indicator */}
                {phaseCompleted.blinks && (
                  <div className="text-xs text-green-400 mt-1">✓ Complete</div>
                )}
              </div>
              <div className={`p-2 rounded transition-all duration-300 ${
                phaseCompleted.mouth 
                  ? 'bg-green-500/20 border border-green-500 shadow-green-500/20 shadow-lg' 
                  : 'bg-gray-700/50'
              }`}>
                <div className="text-2xl font-bold text-cyan-400">{livenessMetrics.mouthOpenCount}</div>
                <div className="text-xs text-gray-400">Mouth</div>
                <div className="text-xs text-green-400">/1</div>
                {/*   Show completion indicator */}
                {phaseCompleted.mouth && (
                  <div className="text-xs text-green-400 mt-1">✓ Complete</div>
                )}
              </div>
              <div className={`p-2 rounded transition-all duration-300 ${
                phaseCompleted.head 
                  ? 'bg-green-500/20 border border-green-500 shadow-green-500/20 shadow-lg' 
                  : 'bg-gray-700/50'
              }`}>
                <div className="text-2xl font-bold text-cyan-400">{livenessMetrics.headMovementCount}</div>
                <div className="text-xs text-gray-400">Head</div>
                <div className="text-xs text-green-400">/1</div>
                {/*   Show completion indicator */}
                {phaseCompleted.head && (
                  <div className="text-xs text-green-400 mt-1">✓ Complete</div>
                )}
              </div>
              <div className="p-2 rounded bg-blue-500/20">
                <div className="text-2xl font-bold text-cyan-400">
                  {(livenessMetrics.faceRealScore * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-400">Score</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center space-x-4">
        {!isComplete && (
          <button
            onClick={executeWorkflow}
            disabled={!canStart}
            className={`terminal-button px-6 py-3 rounded font-bold flex items-center ${
              canStart ? "hover-glow" : "opacity-50 cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Camera className="h-5 w-5 mr-2" />
                Start Biometric Capture
              </>
            )}
          </button>
        )}

        {isComplete && (
          <button
            onClick={reset}
            className="terminal-button bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded font-bold flex items-center"
          >
            <RefreshCw className="h-5 w-5 mr-2" />
            Recapture
          </button>
        )}
      </div>

      {/* Error display */}
      {cameraError && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded">
          <p className="text-red-400 text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {cameraError}
          </p>
        </div>
      )}

      {/* Face detection status */}
      {singleFaceConfirmed && currentStep !== "ready" && (
        <div className="flex items-center bg-green-500/20 border border-green-500 rounded-lg px-3 py-2">
          <User className="h-4 w-4 text-green-400 mr-2" />
          <span className="text-green-400 text-sm font-bold">Single Face Detected</span>
        </div>
      )}

      {/* Success display */}
      {isComplete && (
        <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded">
          <div className="flex items-center text-green-400">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span className="font-bold">Biometric capture successful!</span>
          </div>
          <p className="text-green-300 text-sm mt-1">
            Face data and liveness verification have been securely stored.
          </p>
        </div>
      )}

     

      {/* Instructions */}
      <div className="glass-card rounded-lg p-4 text-sm">
        <h3 className="text-green-400 font-bold mb-2">Instructions:</h3>
        <ul className="text-cyan-300 space-y-1">
          <li>• Ensure good lighting and face the camera directly</li>
          <li>• Remove glasses if they cause glare</li>
          <li>• Keep your face within the guide box</li>
          <li>• You will need to: <strong>blink exactly 2 times</strong>, <strong>open mouth exactly 1 time</strong>, and <strong>move head left/right exactly 1 time</strong></li>
          <li>• Counts stop automatically when requirements are met</li>
          <li>• Follow the on-screen prompts for each action</li>
          <li>• The process takes about 30-45 seconds</li>
          <li>• Each phase must be completed before moving to the next</li>
        </ul>
      </div>
    </div>
  );
};

export default BiometricCapture;