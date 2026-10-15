import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

type Phase = 'blinking' | 'mouth' | 'head' | 'complete';
type Requirements = { blinks: number; mouth: number; head: number };
type ServerResult = {
  success: boolean;
  error?: string;
  face_detected?: boolean;
  blink_count?: number;
  mouth_open_count?: number;
  head_movement_count?: number;
  liveness_passed?: boolean;
  all_completed?: boolean;
  sequential_state?: {
    current_phase: Phase;
    challenge_order?: Phase[];
    requirements?: Requirements;
    all_phases_complete?: boolean;
    screen_replay_challenge?: {
      status: string;
      stage: string;
      current_action: string;
      step: number;
      total_steps: number;
      prompt: string;
      seconds_remaining?: number | null;
      return_hold_frames?: number | null;
      return_required_frames?: number | null;
      return_hint?: string | null;
      completed: boolean;
    } | null;
  };
};

const INITIAL_REQUIREMENTS: Requirements = { blinks: 2, mouth: 1, head: 1 };
const MAX_SECONDS = 120;

function phaseLabel(phase?: Phase, needs?: Requirements, count?: { blinks: number; mouth: number; head: number }) {
  if (!phase || !needs || !count) return 'Waiting for server challenge...';
  switch (phase) {
    case 'blinking': return `Blink naturally: ${count.blinks}/${needs.blinks}`;
    case 'mouth': return `Open and close your mouth: ${count.mouth}/${needs.mouth}`;
    case 'head': return `Move your head: ${count.head}/${needs.head}`;
    case 'complete': return 'All requested actions completed';
  }
}

/**
 * Developer-only diagnostic page. This does not register, authenticate,
 * save biometrics, or change any identity/OTP/login protections.
 * Every response is computed by the real local Flask detector.
 */
export default function LivenessLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase | undefined>();
  const [order, setOrder] = useState<Phase[]>([]);
  const [requirements, setRequirements] = useState<Requirements>(INITIAL_REQUIREMENTS);
  const [counts, setCounts] = useState({ blinks: 0, mouth: 0, head: 0 });
  const [frames, setFrames] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [facePresent, setFacePresent] = useState(false);
  const [serverPrompt, setServerPrompt] = useState<string | null>(null);
  const [serverStep, setServerStep] = useState<number>(0);
  const [serverStepTotal, setServerStepTotal] = useState<number>(0);
  const [serverDeadline, setServerDeadline] = useState<number | null>(null);
  const [serverAction, setServerAction] = useState<string | null>(null);
  const [returnHint, setReturnHint] = useState<string | null>(null);
  const [returnProgress, setReturnProgress] = useState<{ current: number; required: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    }).then(stream => {
      if (cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      mediaRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    }).catch(err => setError(`Camera unavailable: ${String(err)}`));
    return () => {
      cancelled = true;
      runningRef.current = false;
      controllerRef.current?.abort();
      mediaRef.current?.getTracks().forEach(track => track.stop());
      mediaRef.current = null;
    };
  }, []);

  const stop = () => {
    runningRef.current = false;
    controllerRef.current?.abort();
    setRunning(false);
  };

  const start = async () => {
    if (runningRef.current || !videoRef.current || !canvasRef.current) return;
    if (!cameraReady || !videoRef.current.videoWidth) {
      setError('Camera is still initializing; please try again.');
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Cannot initialize video canvas.');
      return;
    }
    const sessionId = `liveness_lab_${crypto.randomUUID()}`;
    runningRef.current = true;
    setRunning(true);
    setCompleted(false);
    setError('');
    setPhase(undefined);
    setOrder([]);
    setRequirements(INITIAL_REQUIREMENTS);
    setCounts({ blinks: 0, mouth: 0, head: 0 });
    setFrames(0);
    setElapsed(0);
    setFacePresent(false);
    setServerPrompt(null);
    setServerStep(0);
    setServerStepTotal(0);
    setServerDeadline(null);
    setServerAction(null);
    setReturnHint(null);
    setReturnProgress(null);
    const started = performance.now();
    let frameIndex = 0;
    try {
      while (runningRef.current) {
        const seconds = Math.floor((performance.now() - started) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS) {
          setError('Session timed out. Start a new random challenge.');
          break;
        }
        if (!video.videoWidth || !video.videoHeight) {
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const faceImage = canvas.toDataURL('image/jpeg', 0.83);
        controllerRef.current = new AbortController();
        const response = await fetch('http://localhost:5000/api/sequential-liveness-detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: sessionId,
            mode: 'registration',
            current_step: 'liveness_lab',
            reset_counters: frameIndex === 0,
            face_image: faceImage,
          }),
          signal: controllerRef.current.signal,
        });
        frameIndex += 1;
        setFrames(frameIndex);
        const result = await response.json() as ServerResult;
        setFacePresent(result.face_detected === true);

        if (result.sequential_state) {
          if (result.sequential_state.current_phase) {
            setPhase(result.sequential_state.current_phase);
          }
          if (result.sequential_state.requirements) {
            setRequirements(result.sequential_state.requirements);
          }
          // Do not expose future action order to pre-recorded replay tools.
          const active = result.sequential_state.screen_replay_challenge;
          if (active) {
            setServerPrompt(active.prompt);
            setServerStep(active.step);
            setServerStepTotal(active.total_steps);
            setServerDeadline(active.seconds_remaining ?? null);
            setServerAction(active.current_action);
            setReturnHint(active.return_hint ?? null);
            setReturnProgress(
              active.stage === 'return' && active.return_required_frames != null
                ? { current: active.return_hold_frames ?? 0, required: active.return_required_frames }
                : null
            );
            if (active.status !== 'active' && active.status !== 'passed') {
              setError(`Server rejection (${active.status}): ${active.prompt}`);
              break;
            }
          }
        }
        setCounts({
          blinks: result.blink_count ?? 0,
          mouth: result.mouth_open_count ?? 0,
          head: result.head_movement_count ?? 0,
        });

        if (!response.ok && result.error && result.face_detected !== false) {
          setError(`Backend error (${response.status}): ${result.error}`);
          break;
        }
        if (result.liveness_passed === true ||
            result.sequential_state?.all_phases_complete === true ||
            result.all_completed === true) {
          setCompleted(true);
          setPhase('complete');
          break;
        }
        // Camera throughput is bounded by the detector's request duration.
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError('Could not reach Flask on port 5000. Check that python backend/app.py is running.');
      }
    } finally {
      runningRef.current = false;
      controllerRef.current = null;
      setRunning(false);
    }
  };

  const activeCount = { blinks: counts.blinks, mouth: counts.mouth, head: counts.head };
  const labels: Record<Phase, string> = {
    blinking: 'Blink', mouth: 'Mouth', head: 'Head', complete: 'Complete',
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 text-cyan-100">
      <div className="mb-6">
        <p className="font-mono text-sm uppercase tracking-widest text-amber-400">Local development diagnostic · No account required</p>
        <h1 className="mt-2 text-3xl font-bold text-cyan-400">Live Liveness Test Lab</h1>
        <p className="mt-2 text-sm text-slate-400">
          Directly exercises the Flask liveness detector and its randomized challenge.
          Does not send email, register users, save facial images, or authenticate anyone.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-cyan-800 bg-black p-3">
          <video ref={videoRef} muted autoPlay playsInline className="aspect-[4/3] w-full rounded-lg object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={start} disabled={!cameraReady || running}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">
              <Camera size={17} /> {completed ? 'New challenge' : 'Start random challenge'}
            </button>
            <button type="button" onClick={stop} disabled={!running}
              className="inline-flex items-center gap-2 rounded-md border border-red-400 px-4 py-2 text-red-300 disabled:opacity-40">
              Stop
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Camera: {cameraReady ? 'ready' : 'initializing'} · Face: {facePresent ? 'detected' : 'not yet detected'} · Frames: {frames} · Elapsed: {elapsed}s
          </p>
        </div>
        <div className="rounded-xl border border-cyan-800 bg-slate-950/80 p-5">
          <div className="flex items-center gap-2 text-lg font-semibold text-cyan-300">
            {completed ? <CheckCircle size={20} className="text-green-400" /> : <RefreshCw size={20} className={running ? 'animate-spin' : ''} />}
            {completed ? 'Server challenge completed' : running ? 'Challenge running' : 'Ready to begin'}
          </div>
          <div className="mt-5 rounded-lg border border-cyan-700 bg-cyan-900/20 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Current action</p>
            <p className="mt-2 text-xl font-bold text-white">{serverPrompt ?? phaseLabel(phase, requirements, activeCount)}</p>
            {serverAction === 'turn_left' && <p className="mt-3 text-5xl text-cyan-400" aria-label="Turn left">←</p>}
            {serverAction === 'turn_right' && <p className="mt-3 text-5xl text-cyan-400" aria-label="Turn right">→</p>}
            {returnHint && <p className="mt-3 rounded-md border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-200" role="status">
              {returnHint}{returnProgress ? ` · Return hold ${returnProgress.current}/${returnProgress.required}` : ''}
            </p>}
            {serverDeadline !== null && running && <p className="mt-2 text-sm text-amber-300">Time remaining for this step: {serverDeadline.toFixed(1)}s</p>}
          </div>
          <p className="mt-5 text-xs uppercase tracking-wider text-slate-400">Fresh server-issued action</p>
          <p className="mt-2 text-sm text-slate-300">
            {serverStepTotal ? `Step ${serverStep} / ${serverStepTotal}` : 'Waiting for neutral face calibration'}
          </p>
          <p className="mt-1 text-xs text-amber-300">
            The next action remains hidden until the current instruction is verified.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {([
              ['Blinks', counts.blinks, requirements.blinks],
              ['Mouth', counts.mouth, requirements.mouth],
              ['Head', counts.head, requirements.head],
            ] as const).map(([name, observed, required]) => (
              <div key={name} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p className="text-2xl font-semibold text-cyan-300">{observed}/{required}</p>
                <p className="mt-1 text-xs text-slate-400">{name}</p>
              </div>
            ))}
          </div>
          {error && (
            <p className="mt-5 flex items-start gap-2 text-sm text-red-300">
              <AlertCircle size={18} className="shrink-0" />{error}
            </p>
          )}
          <p className="mt-5 text-xs text-amber-300">
            Prompted motion is only one replay-mitigation layer. A completed challenge does not establish camera provenance or independently verified presentation-attack detection.
          </p>
        </div>
      </div>
    </div>
  );
}
