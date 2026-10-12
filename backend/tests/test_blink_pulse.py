"""Synthetic action-detector tests. These are not presentation-attack tests."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_models.blink_pulse import BlinkPulseTracker


class BlinkPulseTests(unittest.TestCase):
    @staticmethod
    def feed(tracker, timeline, fps=15):
        return [
            tracker.update(left, right, index / fps)
            for index, (left, right) in enumerate(timeline)
        ]

    @staticmethod
    def open_eyes(n):
        return [(0.36, 0.34)] * n

    def test_bilateral_single_sample_blink_at_15fps(self):
        rows = self.open_eyes(5) + [(0.17, 0.16)] + self.open_eyes(3)
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 1)

    def test_bilateral_single_sample_blink_at_30fps(self):
        rows = self.open_eyes(5) + [(0.17, 0.16)] + self.open_eyes(3)
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows, fps=30)), 1)

    def test_single_eye_artifact_is_not_blink(self):
        rows = self.open_eyes(5) + [(0.15, 0.33)] + self.open_eyes(3)
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 0)

    def test_one_bad_frame_without_two_open_recoveries_is_not_blink(self):
        rows = self.open_eyes(5) + [(0.15, 0.15), (0.34, 0.33)]
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 0)

    def test_missing_landmark_breaks_candidate(self):
        rows = (self.open_eyes(5) + [(0.15, 0.15), (None, None)]
                + self.open_eyes(3))
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 0)

    def test_long_eye_closure_is_not_blink(self):
        rows = self.open_eyes(5) + [(0.15, 0.15)] * 15 + self.open_eyes(3)
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 0)

    def test_no_stable_open_baseline(self):
        rows = [(0.15, 0.15)] * 4 + self.open_eyes(2)
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 0)

    def test_small_fluctuations_do_not_count(self):
        rows = self.open_eyes(5) + [(0.28, 0.29), (0.30, 0.30)] + self.open_eyes(2)
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 0)

    def test_cooldown_separates_blips(self):
        rows = (self.open_eyes(5) + [(0.15, 0.15)] + self.open_eyes(2)
                + [(0.15, 0.15)] + self.open_eyes(3))
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 1)

    def test_replay_blinks_are_not_spoof_proof(self):
        rows = self.open_eyes(5) + [(0.14, 0.14)] + self.open_eyes(3)
        self.assertEqual(sum(self.feed(BlinkPulseTracker(), rows)), 1)

    def test_clock_reversal_never_counts(self):
        tracker = BlinkPulseTracker()
        for i in range(5):
            tracker.update(0.36, 0.34, i / 15)
        tracker.update(0.15, 0.15, 5 / 15)
        self.assertFalse(tracker.update(0.36, 0.34, 4 / 15))
        self.assertFalse(tracker.update(0.36, 0.34, 6 / 15))


if __name__ == "__main__":
    unittest.main()
