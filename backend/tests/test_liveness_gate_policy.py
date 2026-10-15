"""Regression tests: never treat an unfinished action sequence as a static image."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_models.liveness_gate_policy import may_evaluate_static_image


class StaticImageGuardTests(unittest.TestCase):
    def state(self, **updates):
        state = {
            "frames_processed": 80,
            "total_blinks": 0,
            "required_blinks": 2,
            "total_mouth_open": 0,
            "required_mouth_opens": 1,
            "total_head_movements": 0,
            "required_head_movements": 1,
        }
        state.update(updates)
        return SimpleNamespace(**state)

    def test_missing_mouth_before_prompt_is_not_static_evidence(self):
        self.assertFalse(may_evaluate_static_image(self.state(
            total_blinks=2, total_mouth_open=0, total_head_movements=0
        )))

    def test_missing_blink_is_incomplete_challenge(self):
        self.assertFalse(may_evaluate_static_image(self.state(
            total_blinks=0, total_mouth_open=1, total_head_movements=1
        )))

    def test_complete_movements_still_allow_static_check(self):
        self.assertTrue(may_evaluate_static_image(self.state(
            total_blinks=2, total_mouth_open=1, total_head_movements=1
        )))

    def test_not_enough_frames_never_checks_static(self):
        self.assertFalse(may_evaluate_static_image(self.state(
            frames_processed=29, total_blinks=2,
            total_mouth_open=1, total_head_movements=1
        )))

    def test_exceeding_requirements_still_checks_static(self):
        self.assertTrue(may_evaluate_static_image(self.state(
            frames_processed=40, total_blinks=3,
            total_mouth_open=2, total_head_movements=1
        )))


if __name__ == "__main__":
    unittest.main()
