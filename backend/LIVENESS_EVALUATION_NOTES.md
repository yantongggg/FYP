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
