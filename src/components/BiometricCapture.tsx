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
  mode: "registration" | "login" |"authentication";
  userId?: string;
  
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
  userId = "user_001"
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

  const [livenessMetrics, setLivenessMetrics] = useState<LivenessMetrics>({
    blinkCount: 0,
    mouthOpenCount: 0,
    headMovementCount: 0,
    faceCount: 0,
    faceRealScore: 0,
    cdcnScore: 0,
    enhancedScore: 0
  });

  const REQUIRED_BLINKS = mode === "registration" ? 3 : 2;
  const REQUIRED_MOUTH_OPENS = mode === "registration" ? 2 : 1;
  const REQUIRED_HEAD_MOVEMENTS = 2;
  


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

  const getStepPrompt = (step: WorkflowStep): string => {
    const metrics = livenessMetrics;
    switch (step) {
      case "ready":
        return "Position your face in the center and click Start";
      case "capturing_face":
        return "Hold still, capturing reference face...";
      case "blink_prompt":
        return `Please blink ${REQUIRED_BLINKS} times (${metrics.blinkCount}/${REQUIRED_BLINKS})`;
      case "mouth_prompt":
        return `Open your mouth ${REQUIRED_MOUTH_OPENS} times (${metrics.mouthOpenCount}/${REQUIRED_MOUTH_OPENS})`;
      case "head_prompt":
        return `Move your head slowly in different directions (${metrics.headMovementCount}/${REQUIRED_HEAD_MOVEMENTS})`;
      case "antispoofing":
        return "Analyzing liveness and anti-spoofing...";
      case "saving":
        return "Saving biometric data to secure storage...";
      case "complete":
        return "Biometric capture complete! ✅";
      default:
        return "";
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
    const frameData = captureFrame();
    if (!frameData) {
      console.error("Failed to capture frame");
      return null;
    }

    try {
      const response = await fetch("http://localhost:5000/api/sequential-liveness-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          face_image: frameData,
          mode: mode,
          reset_counters: resetCounters,
          current_step: currentStep
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", errorText);
        setCameraError(`Detection error: ${response.statusText}`);
        return null;
      }

      const result: LivenessResponse = await response.json();
      
      if (result.success) {
        // Update metrics
        setLivenessMetrics({
          blinkCount: result.blink_count,
          mouthOpenCount: result.mouth_open_count,
          headMovementCount: result.head_movement_count,
          faceCount: 1,
          faceRealScore: result.face_real_score,
          cdcnScore: result.cdcn_score || 0,
          enhancedScore: result.enhanced_face_score || result.face_real_score
        });
      }
      if (result.success && result.face_detected) {
        setSingleFaceConfirmed(true);
      } else {
        setSingleFaceConfirmed(false);
      }


      return result;
    } catch (error) {
      console.error("Detection error:", error);
      setCameraError("Network error. Please check backend connection.");
      return null;
    }
  }, [captureFrame, userId, mode, currentStep]);

  const saveToSupabase = useCallback(async (faceData: string, livenessData: LivenessResponse) => {
    try {
      // Add this at the start of saveToSupabase to debug auth
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current auth session:', session);
      console.log('User ID:', session?.user?.id);
      console.log('User role:', session?.user?.role);
      // Extract user ID from props or generate temporary one
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
        return false; // ✅ Added return false
      }

      if (!uploadData) {
        console.error('No upload data returned');
        setCameraError('Upload failed: No data returned');
        return false; // ✅ Added check for uploadData
      }
      
      // Get public URL for the uploaded face
      const { data: { publicUrl } } = supabase.storage
        .from('biometric-faces')
        .getPublicUrl(uploadData.path);
      
      console.log('✅ Face image uploaded to Supabase:', publicUrl);
      console.log('✅ Upload data:', uploadData); // ✅ Add this debug line
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
  const waitForLivenessStep = async (
    stepName: WorkflowStep,
    checkComplete: (result: LivenessResponse) => boolean,
    errorMessage: string
  ) => {
    setCurrentStep(stepName);
    let complete = false;
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds at 500ms intervals

    while (!complete && attempts < maxAttempts) {
      const result = await runSequentialDetection(false);
      if (result && checkComplete(result)) {
        complete = true;
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!complete) throw new Error(errorMessage);
  };

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

      // Step 2: Blink detection
      await waitForLivenessStep(
        "blink_prompt",
        (result) => result.blink_count >= REQUIRED_BLINKS,
        "Blink detection timeout"
      );

      // Step 3: Mouth open detection
      await waitForLivenessStep(
        "mouth_prompt",
        (result) => result.mouth_open_count >= REQUIRED_MOUTH_OPENS,
        "Mouth detection timeout"
      );

      // Step 4: Head movement detection
      await waitForLivenessStep(
        "head_prompt",
        (result) => result.head_movement_count >= REQUIRED_HEAD_MOVEMENTS,
        "Head movement detection timeout"
      );

      // Step 5: Final anti-spoofing check
      setCurrentStep("antispoofing");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalResult = await runSequentialDetection(false);
      if (!finalResult || !finalResult.liveness_validation?.overall_liveness_passed) {
        throw new Error("Liveness validation failed");
      }

      // Step 6: Process and validate data
      setCurrentStep("saving");
      console.log('DEBUG - Calling onFaceCapture with face data length:', referenceFace.length);
      // onFaceCapture(referenceFace); // ❌ REMOVED - saveToSupabase will call it with URL
      const saved = await saveToSupabase(referenceFace, finalResult);


      // Complete
      setCurrentStep("complete");
      // onFaceCapture(referenceFace); // This will now include the URL in the callback
      onLivenessCapture(finalResult);

    } catch (error: any) {
      console.error("Workflow error:", error);
      setCameraError(error.message || "Workflow failed");
      setCurrentStep("ready");
    } finally {
      setIsProcessing(false);
    }
  }, [runSequentialDetection, captureFrame, saveToSupabase, onFaceCapture, onLivenessCapture, REQUIRED_BLINKS, REQUIRED_MOUTH_OPENS, REQUIRED_HEAD_MOVEMENTS]);

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
          
          {/* Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-80 border-2 border-green-400/50 rounded-xl"></div>
            </div>

            {/* Status overlay */}
            <div className="absolute top-4 left-4 right-4">
              <div className="glass-card rounded-lg p-3">
                <div className="text-sm font-bold text-green-400 mb-2">
                  {getStepPrompt(currentStep)}
                </div>
                {isProcessing && (
                  <div className="flex items-center text-cyan-400 text-xs">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </div>
                )}
              </div>
            </div>

            {/* Metrics overlay */}
            {currentStep !== "ready" && currentStep !== "complete" && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="glass-card rounded-lg p-3">
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-cyan-400 font-bold">{livenessMetrics.blinkCount}</div>
                      <div className="text-gray-400">Blinks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-cyan-400 font-bold">{livenessMetrics.mouthOpenCount}</div>
                      <div className="text-gray-400">Mouth</div>
                    </div>
                    <div className="text-center">
                      <div className="text-cyan-400 font-bold">{livenessMetrics.headMovementCount}</div>
                      <div className="text-gray-400">Head</div>
                    </div>
                    <div className="text-center">
                      <div className="text-cyan-400 font-bold">
                        {(livenessMetrics.faceRealScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-gray-400">Score</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      </div>

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