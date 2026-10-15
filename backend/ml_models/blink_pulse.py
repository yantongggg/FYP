"""Bilateral, baseline-relative blink-pulse tracking.

This is an *action* detector, not an anti-spoof classifier. A screen replay
can contain valid blink pulses. It requires both eye landmark ratios to
transition open -> closed -> stable open, and does not infer a physical
closure duration from a single sampled frame.
"""

import math
from collections import deque
from statistics import median


class BlinkPulseTracker:
    """Detect a complete bilateral blink at webcam sampling rates.

    A one-frame bilateral closure may count only after a stable open baseline
    and two observed re-open frames. Unlike the legacy implementation it does
    not incorrectly insist that one 15-FPS closed sample proves 100ms closure.
    """

    def __init__(self, cooldown_s=0.8, max_closure_s=0.6):
        self.cooldown_s = cooldown_s
        self.max_closure_s = max_closure_s
        self.open_samples = deque(maxlen=15)
        self.phase = "open"
        self.open_streak = 0
        self.reopen_streak = 0
        self.closed_at = None
        self.reopened_at = None
        self.last_blink_at = None
        self.last_time = None

    def invalidate(self):
        """Drop incomplete eye transitions when a face/landmark is missing."""
        self.phase = "open"
        self.open_streak = 0
        self.reopen_streak = 0
        self.closed_at = None
        self.reopened_at = None

    def _forget_candidate(self):
        self.phase = "open"
        self.open_streak = 0
        self.reopen_streak = 0
        self.closed_at = None
        self.reopened_at = None

    def update(self, left_ear, right_ear, timestamp):
        """Return True only upon a complete, cooldown-separated blink pulse."""
        values = (left_ear, right_ear, timestamp)
        if any(v is None or not math.isfinite(v) for v in values):
            self.invalidate()
            return False
        left_ear = float(left_ear)
        right_ear = float(right_ear)
        timestamp = float(timestamp)
        if not (0 < left_ear < 1.2 and 0 < right_ear < 1.2):
            self.invalidate()
            return False
        if self.last_time is not None and timestamp <= self.last_time:
            self.invalidate()
            self.last_time = timestamp
            return False
        self.last_time = timestamp

        if len(self.open_samples) < 3:
            if left_ear >= 0.26 and right_ear >= 0.26:
                self.open_samples.append((left_ear, right_ear))
                self.open_streak += 1
            else:
                self.open_streak = 0
            return False

        l_base = median(x[0] for x in self.open_samples)
        r_base = median(x[1] for x in self.open_samples)
        # 25-30% drop per eye relative to this person's observed open eyes.
        closed = (left_ear < min(0.245, l_base * 0.72)
                  and right_ear < min(0.245, r_base * 0.72))
        opened = (left_ear >= max(0.26, l_base * 0.84)
                  and right_ear >= max(0.26, r_base * 0.84))

        if self.phase == "open":
            if closed and self.open_streak >= 2:
                self.phase = "closed"
                self.closed_at = timestamp
                self.open_streak = 0
            elif opened:
                self.open_streak += 1
                self.open_samples.append((left_ear, right_ear))
            else:
                self.open_streak = 0
            return False

        if (self.closed_at is not None
                and timestamp - self.closed_at > self.max_closure_s):
            self._forget_candidate()
            return False

        if self.phase == "closed":
            if opened:
                self.phase = "reopening"
                self.reopened_at = timestamp
                self.reopen_streak = 1
            return False

        if self.phase == "reopening":
            if not opened:
                self._forget_candidate()
                return False
            self.reopen_streak += 1
            if self.reopen_streak >= 2:
                valid = (self.last_blink_at is None
                         or timestamp - self.last_blink_at >= self.cooldown_s)
                self._forget_candidate()
                self.open_streak = 2
                self.open_samples.append((left_ear, right_ear))
                if valid:
                    self.last_blink_at = timestamp
                    return True
        return False
