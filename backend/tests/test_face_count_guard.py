"""Pure state tests; actual webcam detection still needs field validation."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_models.face_count_guard import FaceCountGuard


class FaceCountGuardTests(unittest.TestCase):
    def test_single_spurious_extra_face_does_not_confirm(self):
        g = FaceCountGuard(confirmation_frames=3)
        self.assertFalse(g.observe(2))
        self.assertEqual(g.streak, 1)
        self.assertFalse(g.observe(1))
        self.assertFalse(g.ambiguous)

    def test_sustained_multiple_faces_confirms(self):
        g = FaceCountGuard(confirmation_frames=3)
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(3))
        self.assertTrue(g.observe(2))

    def test_no_face_resets_consecutive_streak(self):
        g = FaceCountGuard(confirmation_frames=3)
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(0))
        self.assertFalse(g.observe(2))
        self.assertFalse(g.observe(2))
        self.assertTrue(g.observe(2))

    def test_invalid_config_rejected(self):
        with self.assertRaises(ValueError):
            FaceCountGuard(1)


if __name__ == "__main__":
    unittest.main()
