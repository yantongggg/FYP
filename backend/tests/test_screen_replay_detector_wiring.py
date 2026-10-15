"""Backend wiring regression: generic motion cannot bypass live server prompt.

Requires the FYP Python virtualenv; fake face/landmarks only. No real
video, camera, DB, Supabase, or recognized human faces are used.
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ml_models import liveness_detector as ld


class StaticFaceDetector:
    def detect(self, _rgb):
        return np.array([[15, 15, 100, 100]], dtype=float), np.array([0.99])


class PromptBindingTests(unittest.TestCase):
    def test_unprompted_motion_is_not_credited_by_detector(self):
        detector = ld.LivenessDetector(None)
        landmarks = {
            "left_eye": [(35, 35)] * 6,
            "right_eye": [(65, 35)] * 6,
            "nose_tip": [(50, 55)] * 5,
        }
        img = np.zeros((128, 128, 3), dtype=np.uint8)
        with (patch.object(ld, "MTCNN_MODEL", StaticFaceDetector()),
              patch.object(ld.face_recognition, "face_landmarks", return_value=[landmarks]),
              patch.object(ld, "get_eye_aspect_ratio", return_value=0.35),
              patch.object(ld, "get_ear", return_value=0.35),
              patch.object(ld, "get_mouth_aspect_ratio", return_value=0.15)):
            result = None
            for _ in range(9):
                result = detector.process_frame_for_user(
                    img, "test_video_replay", mode="registration"
                )
        self.assertTrue(result["success"])
        self.assertFalse(result["liveness_passed"])
        self.assertEqual(result["blink_count"], 0)
        self.assertEqual(result["mouth_open_count"], 0)
        self.assertEqual(result["head_movement_count"], 0)
        self.assertIn(
            result["sequential_state"]["screen_replay_challenge"]["status"],
            {"active", "expired"},
        )


if __name__ == "__main__":
    unittest.main()
