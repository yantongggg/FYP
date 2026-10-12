"""Per-session, server-timed active challenge for prerecorded-screen replay mitigation.

This is NOT a passive/learned PAD classifier. It makes a previously recorded,
non-responsive action sequence substantially harder to reuse by requiring a
fresh, unpredictable action order, head-direction signs, neutral resets and
short action windows. It does not establish camera provenance or guarantee
resistance to adaptive replay, screen injection, or precomputed long loops.
"""
import math
import secrets
from statistics import median


class ScreenReplayChallenge:
    ACTION_DEADLINE_S = 10.0
    # A genuine user needs a fresh bounded window AFTER the turn is verified.
    HEAD_RETURN_DEADLINE_S = 8.0
    NEUTRAL_DEADLINE_S = 8.0
    MAX_SESSION_S = 110.0
    NEUTRAL_FRAMES = 3
    GESTURE_FRAMES = 2
    YAW_DELTA = 0.11
    # Guarded hysteresis; this remains below YAW_DELTA=0.11.
    # Independently calibrate these thresholds on diverse genuine users.
    YAW_RETURN = 0.075
    RETURN_MIN_REVERSAL = 0.06

    def __init__(self, blinks=2, mouth=1, head=2, *, rng=None):
        if not (1 <= blinks <= 6 and 1 <= mouth <= 4 and 2 <= head <= 4):
            raise ValueError("Invalid action counts")
        random = rng or secrets.SystemRandom()
        actions = ["blink"] * blinks + ["mouth"] * mouth + ["turn_left", "turn_right"]
        for _ in range(head - 2):
            actions.append(random.choice(["turn_left", "turn_right"]))
        random.shuffle(actions)
        self.actions = tuple(actions)
        self.index = 0
        self.phase = "neutral"
        self.neutral_streak = 0
        self.baseline_yaw = None
        self.neutral_yaws = []
        self.action_streak = 0
        self.return_streak = 0
        self.turn_peak = 0.0
        self.mouth_open_seen = False
        self.eye_closed_seen = False
        self.blink_open_streak = 0
        self.started_at = None
        self.deadline = None
        self.last_timestamp = None
        self.status = "active"
        self.counts = {"blinks": 0, "mouth": 0, "head": 0}
        self.completed_events = []

    @property
    def complete(self):
        return self.status == "passed"

    @property
    def action(self):
        return self.actions[self.index] if self.index < len(self.actions) else "complete"

    @property
    def public_phase(self):
        return {"blink": "blinking", "mouth": "mouth",
                "turn_left": "head", "turn_right": "head",
                "complete": "complete"}[self.action]

    def _expire(self, now):
        self.status = "expired"
        self.deadline = now

    def _set_next(self, now):
        current = self.action
        bucket = "blinks" if current == "blink" else "mouth" if current == "mouth" else "head"
        self.counts[bucket] += 1
        self.completed_events.append(current)
        self.index += 1
        if self.index == len(self.actions):
            self.status = "passed"
            self.phase = "complete"
            return
        self.phase = "neutral"
        self.neutral_streak = 0
        self.neutral_yaws = []
        self.action_streak = 0
        self.return_streak = 0
        self.turn_peak = 0.0
        self.mouth_open_seen = False
        self.eye_closed_seen = False
        self.blink_open_streak = 0
        self.deadline = now + self.NEUTRAL_DEADLINE_S

    def observe_missing(self):
        # A lost face cannot continue a gesture or count as the neutral return.
        self.neutral_streak = 0
        self.action_streak = 0
        self.return_streak = 0
        self.blink_open_streak = 0

    def observe(self, left_ear, right_ear, mar, yaw, now):
        """Update on server-side measurements and server monotonic time.

        yaw is the measured horizontal nose-vs-eye ratio; it is calibrated
        relative to each session's initial forward-facing neutral position.
        A gesture must start after its unpredictable instruction was issued.
        """
        if self.status != "active":
            return False
        if self.last_timestamp is not None and now <= self.last_timestamp:
            self.status = "invalid_timing"
            return False
        self.last_timestamp = now
        if self.started_at is None:
            self.started_at = now
            self.deadline = now + self.NEUTRAL_DEADLINE_S
        if now - self.started_at > self.MAX_SESSION_S or now > self.deadline:
            self._expire(now)
            return False
        measurements = [left_ear, right_ear, mar, yaw]
        if any(x is None or not math.isfinite(float(x)) for x in measurements):
            self.observe_missing()
            return False
        left_ear, right_ear, mar, yaw = map(float, measurements)
        if not (0.05 < left_ear < 1.3 and 0.05 < right_ear < 1.3
                and 0 <= mar < 5 and abs(yaw) < 1.0):
            self.observe_missing()
            return False

        if self.baseline_yaw is None:
            # Initial neutral must have clearly open eyes and closed mouth.
            neutral = (left_ear >= 0.27 and right_ear >= 0.27
                       and mar <= 0.5 and abs(yaw) <= 0.22)
        else:
            neutral = (left_ear >= 0.27 and right_ear >= 0.27
                       and mar <= 0.5
                       and abs(yaw - self.baseline_yaw) <= self.YAW_RETURN)

        if self.phase == "neutral":
            if neutral:
                self.neutral_streak += 1
                self.neutral_yaws.append(yaw)
            else:
                self.neutral_streak = 0
                self.neutral_yaws = []
            if self.neutral_streak >= self.NEUTRAL_FRAMES:
                if self.baseline_yaw is None:
                    self.baseline_yaw = median(self.neutral_yaws)
                self.phase = "perform"
                self.deadline = now + self.ACTION_DEADLINE_S
                self.action_streak = 0
                self.return_streak = 0
                self.turn_peak = 0.0
                self.mouth_open_seen = False
                self.eye_closed_seen = False
                self.blink_open_streak = 0
            return False

        if self.phase == "perform":
            if self.action == "blink":
                # A simultaneous bilateral closure -> stable reopening.
                closed = left_ear < 0.245 and right_ear < 0.245
                opened = left_ear >= 0.27 and right_ear >= 0.27
                if closed:
                    self.eye_closed_seen = True
                    self.blink_open_streak = 0
                elif self.eye_closed_seen and opened:
                    self.blink_open_streak += 1
                    if self.blink_open_streak >= 2:
                        self._set_next(now)
                        return True
                elif self.eye_closed_seen:
                    self.blink_open_streak = 0
                return False

            if self.action == "mouth":
                if mar >= 0.80:
                    self.action_streak += 1
                    if self.action_streak >= self.GESTURE_FRAMES:
                        self.mouth_open_seen = True
                elif self.mouth_open_seen and mar <= 0.5:
                    self.return_streak += 1
                    if self.return_streak >= self.GESTURE_FRAMES:
                        self._set_next(now)
                        return True
                else:
                    if not self.mouth_open_seen:
                        self.action_streak = 0
                    self.return_streak = 0
                return False

            # LEFT/RIGHT sign is defined in landmark-image coordinates;
            # frontend must describe this direction consistently with video.
            diff = yaw - self.baseline_yaw
            directed_offset = -diff if self.action == "turn_left" else diff
            target = directed_offset >= self.YAW_DELTA
            if target:
                self.action_streak += 1
                self.turn_peak = max(self.turn_peak, directed_offset)
                self.return_streak = 0
                if self.action_streak >= self.GESTURE_FRAMES:
                    self.phase = "return"
                    # Do not start the return countdown until the actual
                    # requested turn has been confirmed. Never extend it
                    # every frame, so a stalled return still fails closed.
                    self.deadline = now + self.HEAD_RETURN_DEADLINE_S
            else:
                self.action_streak = 0
            return False

        if self.phase == "return":
            # Tolerance for natural re-centering stays smaller than the
            # required initial turn. Also demand actual counter-movement
            # back from the measured peak turn, plus stable open eyes and
            # closed mouth for three consecutive processed frames.
            directed_offset = (self.baseline_yaw - yaw if self.action == "turn_left"
                               else yaw - self.baseline_yaw)
            sufficient_reversal = (
                self.turn_peak >= self.YAW_DELTA
                and self.turn_peak - directed_offset >= self.RETURN_MIN_REVERSAL
            )
            if neutral and sufficient_reversal:
                self.return_streak += 1
                if self.return_streak >= self.NEUTRAL_FRAMES:
                    self._set_next(now)
                    return True
            else:
                self.return_streak = 0
        return False

    def metadata(self, now=None):
        remaining = None
        if now is not None and self.deadline is not None and self.status == "active":
            remaining = round(max(0., self.deadline - now), 1)
        if self.status != "active":
            prompt = {
                "passed": "Challenge completed",
                "expired": "Challenge timed out. Start a new session.",
                "invalid_timing": "Frame timing validation failed. Start a new session.",
                "rejected_multiple_faces": "Multiple faces detected. Start a new session.",
            }.get(self.status, "Challenge rejected. Start a new session.")
        elif self.phase == "neutral":
            prompt = "Look straight at the camera, close your mouth and keep eyes open"
        elif self.phase == "return":
            prompt = "Head turn detected. Face the camera again and hold steady"
        else:
            prompt = {"blink": "Blink once naturally",
                      "mouth": "Open and close your mouth",
                      "turn_left": "Rotate your head toward the LEFT arrow and return",
                      "turn_right": "Rotate your head toward the RIGHT arrow and return"}[self.action]
        return {
            "status": self.status,
            "stage": self.phase,
            "current_action": self.action,
            "step": self.index + 1 if not self.complete else len(self.actions),
            "total_steps": len(self.actions),
            "prompt": prompt,
            "seconds_remaining": remaining,
            # Non-sensitive progress for feedback; never expose landmarks.
            "return_hold_frames": self.return_streak if self.phase == "return" else None,
            "return_required_frames": self.NEUTRAL_FRAMES if self.phase == "return" else None,
            "completed": self.complete,
        }
