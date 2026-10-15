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

    def test_late_verified_turn_gets_separate_return_window(self):
        c = self.make()
        c.actions = ("turn_left", "blink", "mouth", "turn_right")
        self.feed(c, [self.OPEN] * 3, 0)
        self.assertEqual(c.phase, "perform")
        perform_deadline = c.deadline
        # The valid turn begins just before the 10-second perform deadline.
        self.assertLess(9.9, perform_deadline)
        c.observe(*self.LEFT, perform_deadline - 0.7)
        c.observe(*self.LEFT, perform_deadline - 0.3)
        self.assertEqual(c.phase, "return")
        self.assertGreater(c.deadline, perform_deadline + 6.0)
        # The user can now return AFTER the former deadline, but before
        # the fresh bounded return deadline.
        for seconds in (perform_deadline + 0.5,
                        perform_deadline + 0.9,
                        perform_deadline + 1.3):
            c.observe(*self.OPEN, seconds)
        self.assertEqual(c.index, 1)
        self.assertEqual(c.counts["head"], 1)

    def test_small_head_centering_offset_is_tolerated_after_real_turn(self):
        c = self.make()
        c.actions = ("turn_left", "blink", "mouth", "turn_right")
        t = self.feed(c, [self.OPEN] * 3 + [self.LEFT] * 2, 0)
        self.assertEqual(c.phase, "return")
        offset_center = (0.35, 0.34, 0.14, -0.068)
        t = self.feed(c, [offset_center] * 2, t)
        self.assertEqual(c.index, 0, "Return still needs 3 steady frames")
        info = c.metadata(t)
        self.assertEqual(info["return_hold_frames"], 2)
        self.assertEqual(info["return_required_frames"], 3)
        t = self.feed(c, [offset_center], t)
        self.assertEqual(c.index, 1)
        self.assertEqual(c.counts["head"], 1)

    def test_return_needs_verified_counter_motion_and_cannot_credit_jitter(self):
        c = self.make()
        c.actions = ("turn_left", "blink", "mouth", "turn_right")
        t = self.feed(c, [self.OPEN] * 3, 0)
        t = self.feed(c, [
            (0.35, 0.34, 0.14, -0.09),
            (0.35, 0.34, 0.14, -0.09),
            self.OPEN, self.OPEN, self.OPEN,
        ], t)
        self.assertEqual(c.index, 0)
        self.assertEqual(c.phase, "perform")
        t = self.feed(c, [self.RIGHT] * 2 + [self.OPEN] * 3, t)
        self.assertEqual(c.index, 0)
        self.assertEqual(c.counts["head"], 0)

    def test_missing_frame_interrupts_return_hold(self):
        c = self.make()
        c.actions = ("turn_left", "blink", "mouth", "turn_right")
        t = self.feed(c, [self.OPEN] * 3 + [self.LEFT] * 2, 0)
        t = self.feed(c, [self.OPEN] * 2, t)
        self.assertEqual(c.return_streak, 2)
        c.observe_missing()
        self.assertEqual(c.return_streak, 0)
        t = self.feed(c, [self.OPEN] * 2, t)
        self.assertEqual(c.index, 0)
        t = self.feed(c, [self.OPEN], t)
        self.assertEqual(c.index, 1)

    def test_expired_return_still_fails_closed(self):
        c = self.make()
        c.actions = ("turn_left", "blink", "mouth", "turn_right")
        t = self.feed(c, [self.OPEN] * 3 + [self.LEFT] * 2, 0)
        self.assertEqual(c.phase, "return")
        self.assertFalse(c.observe(*self.OPEN, c.deadline + .01))
        self.assertEqual(c.status, "expired")
        self.assertFalse(c.complete)
        self.assertEqual(c.counts["head"], 0)

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
