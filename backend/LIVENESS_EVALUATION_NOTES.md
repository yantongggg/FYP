# Liveness and authentication evaluation notes

This branch is an **experimental repair** of the original prototype. It is not
a claim of a production-secure eKYC authentication solution or a measured PAD
performance improvement.

## Changes

- Freeze per-session randomized liveness requirements.
- Correct list-slice shuffling; note that the frontend still expects a fixed
  phase order and must be made dynamic before randomized-order UX is enabled
  in a production workflow.
- Forward the login/registration mode into the detector.
- Make the backend liveness decision use `liveness_passed` rather than only
  separate hardcoded action counts.
- Bind biometric verification to a short-lived server-generated login
  challenge, issued only after `/api/login` validates a password and sees a
  fully enrolled user.
- Consume a completed challenge at most once on matching face verification.
- Invalidate per-user cached completion on a different login challenge.

## Local verification

```sh
python -m unittest discover -s backend/tests -p 'test_liveness_challenge.py' -v
python -m py_compile backend/app.py backend/ml_models/liveness_detector.py backend/utils/liveness_challenge.py
```

Then run an integration test against a locally isolated prototype:

1. Authenticate using the normal credentials flow and get a challenge ID.
2. Check that biometric verification fails without an approved challenge.
3. Complete genuine liveness and verify the face with that challenge.
4. Check that the same challenge cannot authorize another verification.
5. Check swapped user IDs, expired challenges, missing challenges, and a fresh
   challenge sent to a previously completed session.
6. Exercise registration and OTP recovery paths and compare prototype UX.
7. Check that no secrets or sensitive biometric media leak to public logging or
   storage and delete test records according to privacy policy.

## Critical outstanding limitations

- The browser `AuthContext.login` still checks passwords using client-side
  database reads and creates `localStorage` authentication state independently
  of these Flask verification endpoints. **Server-side enforcement is not
  end-to-end until this architecture is replaced.**
- Admin/demo shortcuts and OTP fallback require independent threat modeling and
  credential/session binding. OTP is a deliberately different recovery path,
  not an equivalent liveness measurement.
- The challenge store is in-process memory. For multiple workers or production,
  replace it with a shared atomic TTL store (for example, Redis with an atomic
  consume operation), issue authenticated server sessions, apply rate limits,
  and scope sessions to both identity and authenticated client.
- The frontend uses fixed action prompts; order/count randomization must be
  reflected in prompts, transitions, and tests before making a security claim
  about unpredictability.
- No model was retrained and no live face or PAD dataset was evaluated here.
- The code updates themselves do not establish lower spoof success, lower
  APCER/BPCER/ACER, or superior full-fusion security.

## Scientific reporting

Keep original and repaired prototype evaluations separate. Record exact
commit SHA, device, camera/video replay mode, frame sampling and timing, dataset
permissions, subject-disjoint splits, thresholds and selection procedure, all
failure/retry policies, and frame- vs video-level aggregation.

Without jointly sampled multimodal observations, do not report an empirical
full-fusion ablation or infer a joint spoof success rate from independent
LFW, NUAA, and CMU evaluations.

## Oct 12 local pilot failure diagnosis (not a validated PAD benchmark)

Two user-recorded 12-second 15-FPS videos (one bona fide; one screen
replay) were evaluated in registration mode. Both were rejected. This
yielded pilot-only APCER 0%, BPCER 100%, ACER 50% (N=1 per class), which
must **not** be reported as evidence of spoof resistance or generalization.

Inspection of Flask responses found that MTCNN does find faces on sampled
frames but the sessions remained in blinking with B/M/H counts at zero.
Server logs included `STATIC IMAGE DETECTED` due only to mouth never
opening, while the user had been instructed not to open their mouth until
after an initial blink phase; separate logs included `eyes never opened`
and transient `No face detected`. The logs are not correlated to
individual clips, so do not assign specific errors to a clip without a
per-frame trace.

This change **defers passive static-image classification until all
requested action counts have been observed**. An incomplete challenge
continues to fail liveness; it is not mislabeled as confirmed static-media
evidence. The static check remains enabled after all motions are complete.
For local diagnosis, the detector emits a `LIVENESS_DIAG` line every 15
successfully processed frames, including EAR/MAR and stage counts. No
EAR threshold was changed because its sensitivity has not been calibrated.

The evaluation script `eval_replay_api.py` already paces frames to the
recording timestamps; slow/fast replay must be assessed using measured
`p95_sampling_lag_ms`, not inferred from a zero count. Its original trace
omitted status/face/error information, so the updated external evaluator
must be used to distinguish actual model rejection from missing frames.
The user-recorded clip followed fixed prompts (2 blinks / 1 mouth /
head), which **do not necessarily match** random registration challenge
order or minimum counts. Fixing the software cannot make these pilot
videos into a valid challenge-aligned test set.

Before recording any new video, rerun the same private clips as a
separately versioned diagnostic only, with a new trace directory and the
exact backend commit SHA recorded. Do not merge this draft or report
performance improvement until a separate challenge-matched evaluation
and genuine/spoof tests have been completed.

## Oct 12 follow-up: blink/mouth/UI action reliability patch

The earlier 15-FPS sample contained three isolated mean-EAR drops below
0.2 in the bona fide clip and four in the replay clip. A single low-EAR
frame does not prove a 100-ms physical eye closure, and an action pulse
does not prove the subject is live. The original detector used a fixed
100-ms server-clock requirement, while the UI showed fixed 2/1/1 prompts
despite randomized backend requirements up to 4 blinks, 3 mouth opens,
and 2 head movements. The mouth counter also stopped at the first
completion of its fixed default rather than the session's random goal.

The draft changes add `BlinkPulseTracker`: paired eye EAR readings,
a stable open-eye baseline, bilateral drop relative to the baseline,
and two confirmed open frames following a possible closure. Even one
low-EAR sample may produce a pulse if surrounding frames strongly
support a full transition. These are candidate actions for a
challenge, not PAD/spoof scores. The detector refuses unilateral
landmark drops, ambiguous recovery, prolonged eye closure, missing
landmarks, and rapid repeated pulses. It uses a monotonic clock for
cooldown. No assertion is made that this heuristic generalizes from
the two pilot recordings.

The mouth counter now uses `required_mouth_opens`. API responses
return uncapped action counts and server-owned challenge requirements
and order; the React capture prompts and progress reflect that state.

Regression tests: `backend/tests/test_blink_pulse.py` (pure unit),
`backend/tests/test_flask_liveness_flow.py` (mocked Flask integration).
CI checks the pure tests and frontend build; a local repeat evaluation
on untouched source videos is still required. Keep results separated
by commit and filename; do not overwrite the original baseline.
A valid presentation attack evaluation further requires matched,
freshly prompted randomized challenges and explicit security outcome
labels. Server-enforced authentication and frontend Supabase bypass
remain separately unresolved production concerns.
