# Physical Screen Replay: Threat Model & Validation Protocol

## Observed attack (12 Oct 2026)
A prerecorded human-face video was played from a second physical display and
filmed by the Mac webcam. The original random-count liveness flow accepted
that presentation: 4/4 blinks, 1/1 mouth, 2/2 head, ~24 s, 104 frames.
Three genuine webcam sessions were reported as accepted. These are
exploratory observations, not a statistically valid biometric PAD benchmark.

## Root cause
The former backend credited generic EAR/MAR/nose displacement events even if
a presentation did not act on *the newly issued prompt*. A screen can show the
same landmarks and movements as a real person. Head movement was an absolute
pixel jump, not a direction-calibrated yaw measurement. Randomizing only
blink/mouth order and their counts did not bind measured motions to a
fresh request.

## Mitigation added to the draft
`ScreenReplayChallenge` is instantiated separately for each server session.
It produces a cryptographically randomized sequence containing bilateral
blinks, open/close mouth gestures and at least one turn of each signed
direction. It reveals **only the current prompt**, never future steps.
Before each gesture it requires neutral eye/mouth/head measurements, and
after a head turn it requires returning to the original neutral pose.
Independent action windows expire on the backend's monotonic clock; the
client cannot provide timestamps, counts or advance the sequence.

The active challenge's *credited* counts, not historical raw motion counts,
drive `process_frame_for_user` -> `liveness_passed` -> the Flask API
authentication decision. The API returns active prompt/stage/remaining time
in `sequential_state.screen_replay_challenge`; UI shows these instructions.
Face/landmark loss does not count toward a gesture; multiple detected faces
reject the session. The gate requires two consecutive frames for mouth and
head gesture detection and three for neutral calibration.

## Security scope and limitations
This gate is a **mitigation for fixed prerecorded physical-screen replay**.
It is NOT a learned presentation-attack detection (PAD) classifier. It does
not prove sensor provenance, detect screen pixels or moire reliably, or
guarantee protection from longer looping clips, lucky sequence matches,
adaptive replay, real-time remote operators, virtual cameras, injection,
masks, or high-quality displays. An accurate passive screen-PAD model must
be independently trained/validated on appropriate real camera captures
before claiming PAD/ISO 30107 performance. No such trained model is bundled
with this patch.

Direction labels are defined in **unmirrored camera image coordinates**.
`LivenessLab` no longer flips the preview; users must confirm that the
displayed arrow corresponds to a recognized left/right nose-vs-eye change.
The yaw ratio threshold was not calibrated from a multi-person dataset and
may need independent, held-out subject calibration. Never tune it using
only the single known successful replay clip.

## Controlled manual test
1. Save baseline clips, responses and scores; do NOT overwrite existing
   `results/pilot_*` files.
2. On the patch commit, complete **at least 3 independent genuine sessions**
   without database access via `/liveness-lab`. Log action sequence, actual
   completion time, prompt direction errors, frames, and final state.
3. With the same external display, brightness, camera, distance, angle,
   surroundings and prerecorded clip as the baseline successful replay,
   start a *new* server challenge. Do not change the source video in
   response to new instructions. Attempt at least 3 distinct challenges.
4. Repeat with other prerecorded clips, lengths, display sizes and
   distances; distinguish passive print/photo from moving-screen attack.
5. Investigate **every replay acceptance** with trace-level timing and
   video evidence; a success proves remaining vulnerability. Failures can
   mean timing/order mismatch, face tracking failure, or actual PAD defense.
6. Estimate APCER, BPCER and ACER only after subject-disjoint, attack-
   instrument-diverse repeated trials, explicit labeling and complete logs.
   Three genuine trials and one replay success are not enough.
7. Keep identifiable raw footage local and consented.

## Remaining hardening
- A validated passive face presentation-attack classifier (trained and
  assessed on printed/screen/video/injection attacks) with fail-closed
  release policy.
- Server session rate limiting and expiry/cleanup.
- Persistent server-side login challenge storage for multi-worker hosting.
- Frontend auth paths bypassing challenge enforcement, if any, need
  end-to-end review before production deployment.
- A proper enrollment/authentication API test with a real configured DB;
  Flask unit tests running in mock mode do not validate that integration.
