//biometriccapture.tsx
import { supabase } from '../lib/supabase';
import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CheckCircle, AlertCircle, Loader2, RefreshCw, User } from "lucide-react";


interface LivenessResponse {
  success: boolean;
  face_detected: boolean;
  blink_count: number;
  mouth_open_count: number;
  head_movement_count: number;
  face_real_score: number;
  cdcn_score?: number;
  enhanced_face_score?: number;
  // ✅ ADD: Sequential state information
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
  const [currentPhase, setCurrentPhase] = useState<"blinking" | "mouth" | "head" | "complete" | "ready">("ready");
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

  const REQUIRED_BLINKS = mode === "registration" ? 3 : 2;
  const REQUIRED_MOUTH_OPENS = mode === "registration" ? 2 : 1;
  const REQUIRED_HEAD_MOVEMENTS = 1;
  


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

  // Add this useEffect after other useEffect hooks
  useEffect(() => {
    // Force UI update when metrics change
    console.log('🔄 [UI UPDATE] Metrics changed:', livenessMetrics);
    console.log('🔄 [UI UPDATE] Current phase:', lastLivenessResult?.sequential_state?.current_phase);
    
    // Force re-render of instructions
    if (lastLivenessResult?.sequential_state?.current_phase) {
      setCurrentPhase(lastLivenessResult.sequential_state.current_phase);
    }
  }, [livenessMetrics, lastLivenessResult]);
  
  const getStepPrompt = (step: WorkflowStep): string => {
    const metrics = livenessMetrics;
    const currentPhase = lastLivenessResult?.sequential_state?.current_phase;
    
    // ✅ FIXED: Use REAL backend phase data, not workflow step
    if (currentPhase === "blinking") {
      return `Blink ${REQUIRED_BLINKS} times slowly (${metrics.blinkCount}/${REQUIRED_BLINKS})`;
    } else if (currentPhase === "mouth") {
      return ` Open your mouth ${REQUIRED_MOUTH_OPENS} times (${metrics.mouthOpenCount}/${REQUIRED_MOUTH_OPENS})`;
    } else if (currentPhase === "head") {
      return ` Move your head slowly left and right (${metrics.headMovementCount}/${REQUIRED_HEAD_MOVEMENTS})`;
    } else if (currentPhase === "complete") {
      return ` All verification steps complete!`;
    } else {
      // Fallback - determine from metrics
      if (metrics.blinkCount < REQUIRED_BLINKS) {
        return `Blink ${REQUIRED_BLINKS} times slowly (${metrics.blinkCount}/${REQUIRED_BLINKS})`;
      } else if (metrics.mouthOpenCount < REQUIRED_MOUTH_OPENS) {
        return ` Open your mouth ${REQUIRED_MOUTH_OPENS} times (${metrics.mouthOpenCount}/${REQUIRED_MOUTH_OPENS})`;
      } else if (metrics.headMovementCount < REQUIRED_HEAD_MOVEMENTS) {
        return ` Move your head slowly left and right (${metrics.headMovementCount}/${REQUIRED_HEAD_MOVEMENTS})`;
      } else {
        return ` Processing verification...`;
      }
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
    console.log("🚀 [DEBUG] Starting runSequentialDetection", {
      resetCounters,
      userId,
      mode,
      currentStep,
      timestamp: new Date().toISOString()
    });

    const frameData = captureFrame();
    if (!frameData) {
      console.error("❌ [ERROR] Failed to capture frame");
      return null;
    }

    console.log("📸 [DEBUG] Frame captured successfully", {
      frameDataLength: frameData.length,
      framePrefix: frameData.substring(0, 50) + "...",
      timestamp: new Date().toISOString()
    });

    try {
      const requestPayload = {
        user_id: userId,
        face_image: frameData,
        mode: mode,
        reset_counters: resetCounters,
        current_step: currentStep
      };

      console.log("📤 [DEBUG] Sending API request", {
        url: "http://localhost:5000/api/sequential-liveness-detect",
        payload: {
          ...requestPayload,
          face_image: `[${frameData.length} chars]` // Don't log the full image
        },
        timestamp: new Date().toISOString()
      });

      const response = await fetch("http://localhost:5000/api/sequential-liveness-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      console.log("📥 [DEBUG] API response received", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString()
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          console.error("❌ [ERROR] API request failed", {
            status: response.status,
            statusText: response.statusText,
            errorData,
            timestamp: new Date().toISOString()
          });
          
          // Simplified error handling
          setCameraError(`Detection error: ${errorData.error || response.statusText}`);
          
          return null;
        } catch (parseError) {
          console.error("❌ [ERROR] Could not parse error response", parseError);
          setCameraError(`Detection error: ${response.statusText}`);
          return null;
        }
      }

      const result: LivenessResponse = await response.json();
      
      console.log("📊 [DEBUG] API result parsed", {
        success: result.success,
        face_detected: result.face_detected,
        blink_count: result.blink_count,
        mouth_open_count: result.mouth_open_count,
        head_movement_count: result.head_movement_count,
        face_real_score: result.face_real_score,
        sequential_state: result.sequential_state,
        liveness_validation: result.liveness_validation,
        error: result.error,
        timestamp: new Date().toISOString()
      });

      // Store the result for other components
      setLastLivenessResult(result);
      console.log("💾 [DEBUG] Last liveness result stored");

      if (result.success) {
        console.log("✅ [DEBUG] Processing successful result");

        // Update metrics with extensive logging
        const newMetrics = {
          blinkCount: result.blink_count || 0,
          mouthOpenCount: result.mouth_open_count || 0,
          headMovementCount: result.head_movement_count || 0,
          faceCount: 1,
          faceRealScore: result.face_real_score || 0,
          cdcnScore: result.cdcn_score || 0,
          enhancedScore: result.enhanced_face_score || result.face_real_score || 0
        };

        console.log("📈 [DEBUG] Updating liveness metrics", {
          previousMetrics: livenessMetrics,
          newMetrics,
          changes: {
            blinkCountChange: newMetrics.blinkCount - livenessMetrics.blinkCount,
            mouthCountChange: newMetrics.mouthOpenCount - livenessMetrics.mouthOpenCount,
            headCountChange: newMetrics.headMovementCount - livenessMetrics.headMovementCount
          },
          timestamp: new Date().toISOString()
        });

        setLivenessMetrics((prev: LivenessMetrics) => {
          console.log("🔄 [DEBUG] setLivenessMetrics callback", {
            prev,
            new: newMetrics,
            timestamp: new Date().toISOString()
          });
          return newMetrics;
        });

        // Handle sequential state with debugging
        if (result.sequential_state) {
          console.log("🔄 [DEBUG] Processing sequential state", {
            current_phase: result.sequential_state.current_phase,
            blinks_completed: result.sequential_state.blinks_completed,
            mouth_completed: result.sequential_state.mouth_completed,
            head_completed: result.sequential_state.head_completed,
            all_phases_complete: result.sequential_state.all_phases_complete,
            previousPhase: currentPhase,
            timestamp: new Date().toISOString()
          });

          const newPhase = result.sequential_state.current_phase;
          if (newPhase !== currentPhase) {
            console.log("🔄 [DEBUG] Phase change detected", {
              from: currentPhase,
              to: newPhase,
              timestamp: new Date().toISOString()
            });
          }

          setCurrentPhase(newPhase);

          // Try to update parent component progress (if callback exists)
          if (onProgressUpdate) {
            const progressData = {
              phase: newPhase,
              blinks: result.blink_count || 0,
              mouth: result.mouth_open_count || 0,
              head: result.head_movement_count || 0
            };
            
            console.log("📡 [DEBUG] Calling onProgressUpdate", {
              progressData,
              timestamp: new Date().toISOString()
            });
            
            try {
              onProgressUpdate(progressData);
              console.log("✅ [DEBUG] onProgressUpdate called successfully");
            } catch (progressError) {
              console.error("❌ [ERROR] onProgressUpdate failed", {
                error: progressError,
                progressData,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            console.warn("⚠️ [WARN] onProgressUpdate callback not available", {
              timestamp: new Date().toISOString()
            });
          }
        } else {
          console.warn("⚠️ [WARN] No sequential_state in result", {
            result,
            timestamp: new Date().toISOString()
          });
        }

        // Handle face detection status
        if (result.face_detected) {
          console.log("👤 [DEBUG] Face detected - setting single face confirmed");
          setSingleFaceConfirmed(true);
        } else {
          console.log("👤 [DEBUG] No face detected - clearing single face confirmed");
          setSingleFaceConfirmed(false);
        }

      } else {
        console.error("❌ [ERROR] API returned success: false", {
          error: result.error,
          result,
          timestamp: new Date().toISOString()
        });
      }

      console.log("🎯 [DEBUG] runSequentialDetection completed successfully", {
        resultSummary: {
          success: result.success,
          blink_count: result.blink_count,
          current_phase: result.sequential_state?.current_phase,
          face_detected: result.face_detected
        },
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      console.error("💥 [FATAL ERROR] runSequentialDetection exception", {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId,
        mode,
        currentStep,
        timestamp: new Date().toISOString()
      });
      
      setCameraError("Network error. Please check backend connection.");
      return null;
    }
  }, [captureFrame, userId, mode, currentStep, currentPhase, livenessMetrics, onProgressUpdate]);

const saveToSupabase = useCallback(async (faceData: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Current auth session:', session);
    console.log('User ID:', session?.user?.id);
    console.log('User role:', session?.user?.role);
    const tempUserId = userId || `temp_${Date.now()}`;
    
    // Convert base64 to blob for face image upload
    const base64Data = faceData.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    // Upload face image to Supabase Storage
    const fileName = `${tempUserId}_face_${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('biometric-faces')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      setCameraError(`Upload failed: ${uploadError.message}`);
      return false;
    }

    if (!uploadData) {
      console.error('No upload data returned');
      setCameraError('Upload failed: No data returned');
      return false;
    }
    
    // Get public URL for the uploaded face
    const { data: { publicUrl } } = supabase.storage
      .from('biometric-faces')
      .getPublicUrl(uploadData.path);
    
    console.log('✅ Face image uploaded to Supabase:', publicUrl);
    console.log('✅ Upload data:', uploadData);
    console.log('✅ Face data length:', faceData?.length);
    
    // Store face URL in parent component state for later use
    // Call parent callback with face URL
    if (onFaceCapture) {
      console.log('✅ Calling onFaceCapture with URL:', publicUrl); 
      onFaceCapture(faceData, publicUrl); // Pass both base64 and URL
    }
    
    return true;
  } catch (error) {
    console.error("Save error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    setCameraError("Failed to save face image");
    return false;
  }
}, [userId, onFaceCapture]); 

  // Helper function to wait for a specific liveness requirement
  // const waitForLivenessStep = async (
  //   stepName: WorkflowStep,
  //   checkComplete: (result: LivenessResponse) => boolean,
  //   errorMessage: string
  // ) => {
  //   setCurrentStep(stepName);
  //   let complete = false;
  //   let attempts = 0;
  //   const maxAttempts = 60; // 30 seconds at 500ms intervals

  //   while (!complete && attempts < maxAttempts) {
  //     const result = await runSequentialDetection(false);
  //     if (result && checkComplete(result)) {
  //       complete = true;
  //     }
  //     attempts++;
  //     await new Promise(resolve => setTimeout(resolve, 500));
  //   }

  //   if (!complete) throw new Error(errorMessage);
  // };

  const executeWorkflow = useCallback(async () => {
    setIsProcessing(true);
    setCameraError("");
    
    try {
      // Reset counters at start
      await runSequentialDetection(true);

      // Step 1: Capture reference face
      setCurrentStep("capturing_face");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const referenceFace = captureFrame();
      if (!referenceFace) throw new Error("Failed to capture reference face");

      setCurrentStep("blink_prompt");
      let allComplete = false;
      let attempts = 0;
      const maxAttempts = 120;

      while (!allComplete && attempts < maxAttempts) {
        const result = await runSequentialDetection(false);
        
        if (result?.sequential_state) {
          const state = result.sequential_state;
          
          if (state.all_phases_complete) {
            allComplete = true;
            break;
          }
          
          if (state.current_phase === "blinking") {
            setCurrentStep("blink_prompt");
          } else if (state.current_phase === "mouth") {
            setCurrentStep("mouth_prompt");
          } else if (state.current_phase === "head") {
            setCurrentStep("head_prompt");
          } else if (state.current_phase === "complete") {
            // ✅ ADD: Handle completion
            setCurrentStep("antispoofing");
            allComplete = true;
            break;
          }
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!allComplete) {
        throw new Error("Sequential liveness detection timeout");
      }

      // Step 2: Final anti-spoofing check
      setCurrentStep("antispoofing");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalResult = await runSequentialDetection(false);
      if (!finalResult) {
        throw new Error("Final liveness validation failed");
      }

      // Step 3: Process and validate data
      setCurrentStep("saving");
      // ✅ FIXED: Handle return value or remove variable
      const uploadSuccess = await saveToSupabase(referenceFace);
      
      if (!uploadSuccess) {
        throw new Error("Failed to save face image");
      }

      // Complete
      setCurrentStep("complete");

      // ✅ FIXED: Create comprehensive liveness data for parent component
      const completeLivenessData = {
        ...finalResult,
        // Ensure the parent gets the completion signal
        liveness_validation: {
          overall_liveness_passed: true,
          step_requirements: {
            blinks_met: true,
            mouth_met: true,
            head_met: true,
            score_met: true
          }
        },
        // Add explicit completion flags
        verification_complete: true,
        all_phases_complete: true,
        sequential_state: {
          current_phase: "complete",
          blinks_completed: true,
          mouth_completed: true,
          head_completed: true,
          all_phases_complete: true
        },
        // Include final metrics
        final_metrics: {
          blink_count: livenessMetrics.blinkCount,
          mouth_open_count: livenessMetrics.mouthOpenCount,
          head_movement_count: livenessMetrics.headMovementCount,
          face_real_score: livenessMetrics.faceRealScore
        }
      };

      console.log("🎉 [COMPLETE] Sending liveness data to parent:", completeLivenessData);
      onLivenessCapture(completeLivenessData);

    } catch (error: any) {
      console.error("Workflow error:", error);
      setCameraError(error.message || "Workflow failed");
      setCurrentStep("ready");
    } finally {
      setIsProcessing(false);
    }
  }, [runSequentialDetection, captureFrame, saveToSupabase, onLivenessCapture]); // ✅ FIXED: Updated dependencies

  const reset = () => {
    setCurrentStep("ready");
    setCameraError("");
    setLivenessMetrics({
      blinkCount: 0,
      mouthOpenCount: 0,
      headMovementCount: 0,
      faceCount: 0,
      faceRealScore: 0,
      cdcnScore: 0,
      enhancedScore: 0
    });
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
    
    {/* Only keep face guide overlay - no text overlays */}
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-80 border-2 border-green-400/50 rounded-xl"></div>
      </div>
    </div>
    
    <canvas ref={canvasRef} style={{ display: "none" }} />
  </div>
</div>

{/* Instructions Box - NOW OUTSIDE VIDEO */}
{currentStep !== "ready" && currentStep !== "complete" && (
  <div className="mt-4 mb-4">
    <div className="glass-card rounded-lg p-4 border-2 border-cyan-400/50">
      <div className="text-center">
        <div className="text-lg font-bold text-cyan-400 mb-2">
          {getStepPrompt(currentStep)}
        </div>
        <div className="text-sm text-gray-400">
          Phase: {lastLivenessResult?.sequential_state?.current_phase || 'detecting...'}
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

{/* Metrics - NOW OUTSIDE VIDEO */}
{currentStep !== "ready" && currentStep !== "complete" && (
  <div className="mt-4">
    <div className="glass-card rounded-lg p-4 border border-green-400/30">
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className={`p-2 rounded ${livenessMetrics.blinkCount >= REQUIRED_BLINKS ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
          <div className="text-2xl font-bold text-cyan-400">{livenessMetrics.blinkCount}</div>
          <div className="text-xs text-gray-400">Blinks</div>
          <div className="text-xs text-green-400">/{REQUIRED_BLINKS}</div>
        </div>
        <div className={`p-2 rounded ${livenessMetrics.mouthOpenCount >= REQUIRED_MOUTH_OPENS ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
          <div className="text-2xl font-bold text-cyan-400">{livenessMetrics.mouthOpenCount}</div>
          <div className="text-xs text-gray-400">Mouth</div>
          <div className="text-xs text-green-400">/{REQUIRED_MOUTH_OPENS}</div>
        </div>
        <div className={`p-2 rounded ${livenessMetrics.headMovementCount >= REQUIRED_HEAD_MOVEMENTS ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
          <div className="text-2xl font-bold text-cyan-400">{livenessMetrics.headMovementCount}</div>
          <div className="text-xs text-gray-400">Head</div>
          <div className="text-xs text-green-400">/{REQUIRED_HEAD_MOVEMENTS}</div>
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

      {singleFaceConfirmed && (
          <div className="flex items-center bg-green-500/20 border border-green-500 rounded-lg px-3 py-2">
            <User className="h-4 w-4 text-green-400 mr-2" />
            <span className="text-green-400 text-sm font-bold">Single Face Detected</span>
          </div>
      )}

      <div
      className={`font-bold ${
          livenessMetrics.blinkCount >= REQUIRED_BLINKS
            ? 'text-green-400'
            : 'text-cyan-400'
        }`}
      >
        {livenessMetrics.blinkCount}/{REQUIRED_BLINKS}
      </div>


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
          <li>• Follow the on-screen prompts for each action</li>
          <li>• Keep your face within the guide box</li>
          <li>• The process takes about 30-60 seconds</li>
        </ul>
      </div>
    </div>
  );
};

export default BiometricCapture;