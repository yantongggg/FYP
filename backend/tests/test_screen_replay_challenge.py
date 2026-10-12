"""Synthetic active-challenge regression tests; not real-world PAD validation."""
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_models.screen_replay_challenge import ScreenReplayChallenge


class ChallengeTests(unittest.TestCase):
    def make(self, seed=7):
        return ScreenReplayChallenge(blinks=2, mouth=1, head=2, rng=random.Random(seed))

    def feed(self, c, frames, now):
        for row in frames:
            now += 0.22
            c.observe(*row, now)
        return now

    OPEN = (0.35, 0.34, 0.14, 0.0)
    BLINK = (0.14, 0.15, 0.14, 0.0)
    MOUTH = (0.34, 0.34, 1.0, 0.0)
    LEFT = (0.34, 0.34, 0.12, -0.18)
    RIGHT = (0.34, 0.34, 0.12, 0.18)

    def run_intended_sequence(self, c):
        now = 0.0
        for action in c.actions:
            self.assertEqual(c.phase, "neutral")
            now = self.feed(c, [self.OPEN] * 3, now)
            self.assertEqual(c.phase, "perform")
            if action == "blink":
                now = self.feed(c, [self.BLINK] + [self.OPEN] * 2, now)
            elif action == "mouth":
                now = self.feed(c, [self.MOUTH] * 2 + [self.OPEN] * 2, now)
            else:
                pose = self.LEFT if action == "turn_left" else self.RIGHT
                now = self.feed(c, [pose] * 2 + [self.OPEN] * 3, now)
        return now

    def test_fresh_random_order_and_both_head_directions(self):
        orders = {self.make(s).actions for s in range(20)}
        self.assertGreater(len(orders), 4)
        self.assertIn("turn_left", next(iter(orders)))
        self.assertIn("turn_right", next(iter(orders)))

    def test_live_sequence_succeeds(self):
        c = self.make()
        self.run_intended_sequence(c)
        self.assertTrue(c.complete)
        self.assertEqual(c.counts, {"blinks": 2, "mouth": 1, "head": 2})
        self.assertEqual(c.metadata()["status"], "passed")

    def test_wrong_direction_cannot_finish_head_step(self):
        c = ScreenReplayChallenge(blinks=1, mouth=1, head=2, rng=random.Random(9))
        c.actions = ("turn_left", "turn_right", "blink", "mouth")
        t = self.feed(c, [self.OPEN] * 3, 0)
        t = self.feed(c, [self.RIGHT] * 4 + [self.OPEN] * 3, t)
        self.assertEqual(c.index, 0)
        self.assertEqual(c.counts["head"], 0)

    def test_face_missing_breaks_movement_streak(self):
        c = self.make()
        c.actions = ("turn_left", "blink", "mouth", "turn_right")
        t = self.feed(c, [self.OPEN] * 3 + [self.LEFT], 0)
        c.observe_missing()
        t = self.feed(c, [self.LEFT] + [self.OPEN] * 3, t)
        self.assertEqual(c.index, 0)

    def test_neutral_frames_cannot_complete_action(self):
        c = self.make()
        t = self.feed(c, [self.OPEN] * 3, 0)
        t = self.feed(c, [self.OPEN] * 25, t)
        self.assertEqual(c.index, 0)

    def test_wrong_fixed_replay_sequence_does_not_pass(self):
        c = self.make()
        # Pre-recorded fixed actions don't adapt to the server's step prompts.
        fixed = ([self.BLINK] + [self.OPEN] * 3
                 + [self.MOUTH] * 2 + [self.OPEN] * 3
                 + [self.LEFT] * 2 + [self.OPEN] * 3)
        t = self.feed(c, [self.OPEN] * 3, 0)
        t = self.feed(c, fixed, t)
        self.assertFalse(c.complete)

    def test_frozen_static_face_never_passes(self):
        c = self.make()
        t = self.feed(c, [self.OPEN] * 3, 0)
        t = self.feed(c, [self.OPEN] * 20, t)
        self.assertFalse(c.complete)
        self.assertEqual(c.index, 0)

    def test_no_client_can_set_pass_without_observations(self):
        c = self.make()
        self.assertFalse(c.complete)
        self.assertEqual(c.counts, {"blinks": 0, "mouth": 0, "head": 0})

    def test_timeout_fails_closed(self):
        c = self.make()
        self.feed(c, [self.OPEN] * 3, 0)
        self.assertFalse(c.observe(*self.OPEN, 15.0))
        self.assertEqual(c.status, "expired")
        self.assertFalse(c.complete)

    def test_repeated_timestamps_fail(self):
        c = self.make()
        c.observe(*self.OPEN, 1.0)
        c.observe(*self.OPEN, 1.0)
        self.assertEqual(c.status, "invalid_timing")

    def test_failure_status_reasons_are_distinct(self):
        c = self.make()
        c.status = "expired"
        self.assertIn("timed out", c.metadata()["prompt"])
        c.status = "invalid_timing"
        self.assertIn("timing", c.metadata()["prompt"])
        c.status = "rejected_multiple_faces"
        self.assertIn("Multiple faces", c.metadata()["prompt"])

    def test_command_metadata_does_not_expose_future_order(self):
        c = self.make()
        meta = c.metadata()
        self.assertNotIn("actions", meta)
        self.assertNotIn("future_actions", meta)
        self.assertEqual(meta["stage"], "neutral")


if __name__ == "__main__":
    unittest.main()
