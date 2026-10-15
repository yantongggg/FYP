"""Regression tests for noisy MTCNN multi-face detection.

The captured boxes below are from consented local diagnostic output,
not fabricated examples. No biometric image or user ID is recorded.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_models.face_count_guard import FaceCountGuard, weak_lower_face_candidate


RECORDED_CANDIDATES = [
    ([[284.0, 154.9, 402.6, 319.7], [156.3, 315.1, 246.7, 439.9]], [1.0, 0.7818]),
    ([[274.2, 143.1, 410.5, 324.2], [155.8, 315.1, 236.5, 423.9]], [1.0, 0.7401]),
    ([[206.9, 135.1, 315.8, 321.2], [154.1, 323.8, 227.4, 418.6]], [0.9902, 0.9059]),
    ([[201.1, 134.1, 311.8, 314.1], [160.5, 321.8, 230.6, 407.4]], [0.9814, 0.9184]),
    ([[210.2, 134.4, 330.0, 321.6], [146.9, 313.2, 237.4, 425.8]], [0.9980, 0.8144]),
]


class FaceCountGuardTests(unittest.TestCase):
    def test_single_spurious_extra_face_does_not_confirm(self):
        g = FaceCountGuard()
        self.assertFalse(g.observe(2))
        self.assertEqual(g.streak, 1)
        self.assertFalse(g.observe(1))
        self.assertFalse(g.ambiguous)

    def test_sustained_multiple_faces_confirms(self):
        g = FaceCountGuard()
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(3))
        self.assertTrue(g.observe(2))

    def test_no_face_resets_consecutive_streak(self):
        g = FaceCountGuard()
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(0))
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(2))
        self.assertTrue(g.observe(2))

    def test_invalid_config_rejected(self):
        with self.assertRaises(ValueError):
            FaceCountGuard(1)
        with self.assertRaises(ValueError):
            FaceCountGuard(3, 2)

    def test_recorded_extra_faces_all_match_uncertain_pattern(self):
        for boxes, scores in RECORDED_CANDIDATES:
            self.assertTrue(weak_lower_face_candidate(boxes, scores))

    def test_exact_observed_frames_dont_prematurely_reject(self):
        g = FaceCountGuard()
        seen = {15: 0, 17: 1, 39: 2, 40: 3, 41: 4}
        for frame in range(1, 42):
            if frame not in seen:
                self.assertFalse(g.observe(1))
            else:
                boxes, scores = RECORDED_CANDIDATES[seen[frame]]
                self.assertFalse(
                    g.observe(2, weak_extra=weak_lower_face_candidate(boxes, scores))
                )
        self.assertEqual(g.streak, 3)
        self.assertEqual(g.strong_streak, 0)

    def test_two_high_confidence_real_faces_still_rejected(self):
        boxes = [[210, 134, 330, 321], [10, 155, 150, 320]]
        self.assertFalse(weak_lower_face_candidate(boxes, [.998, .992]))
        g = FaceCountGuard()
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(2))
        self.assertTrue(g.observe(2))

    def test_persistent_weak_extra_eventually_rejects(self):
        g = FaceCountGuard()
        for i in range(7):
            self.assertFalse(g.observe(2, weak_extra=True))
        self.assertTrue(g.observe(2, weak_extra=True))

    def test_secondary_large_or_above_primary_is_not_weak(self):
        self.assertFalse(weak_lower_face_candidate(
            [[200, 130, 330, 320], [360, 130, 470, 310]], [.99, .78]))
        self.assertFalse(weak_lower_face_candidate(
            [[200, 130, 330, 320], [120, 50, 200, 150]], [.99, .78]))

    def test_missing_and_invalid_confidence_fail_closed(self):
        self.assertFalse(weak_lower_face_candidate(None, None))
        self.assertFalse(weak_lower_face_candidate(
            [[0, 0, 10, 10], [5, 5, 7, 7]], [float("nan"), 0.7]))


if __name__ == "__main__":
    unittest.main()
