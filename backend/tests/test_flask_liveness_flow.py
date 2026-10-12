"""Isolated Flask API flow tests using a fake database and face comparator.

These are NOT performance/PAD tests. No Supabase connection, credentials,
camera, or real biometric data are used.

Run with Python environment containing FYP backend dependencies:
  python -m unittest discover -s backend/tests -p 'test_flask_liveness_flow.py' -v
"""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as backend_app
from utils.liveness_challenge import LoginChallengeStore


class FakeQuery:
    def __init__(self, response):
        self.response = response

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def single(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return self.response


class FakeDatabase:
    def table(self, name):
        if name == "users":
            return FakeQuery(SimpleNamespace(data={"email": "alice@example.invalid"}))
        if name == "biometric_data":
            return FakeQuery(SimpleNamespace(data=[{"face_embedding": [0.0] * 128}]))
        raise AssertionError("Unexpected table: " + name)


class FlaskLivenessFlowTests(unittest.TestCase):
    def setUp(self):
        self.now = [1000.0]
        self.store = LoginChallengeStore(ttl_seconds=30, clock=lambda: self.now[0])
        self.patches = [
            patch.object(backend_app, "LOGIN_LIVENESS_CHALLENGES", self.store),
            patch.object(backend_app.supabase_manager, "client", FakeDatabase()),
            patch.object(backend_app.supabase_manager, "save_login_audit", return_value=True),
            patch.object(backend_app.supabase_manager, "upload_debug_face_file", return_value=""),
            patch.object(backend_app, "face_verifier", SimpleNamespace(
                LOGIN_THRESHOLD=0.55, compare_faces=Mock(return_value=(0.90, True))
            )),
        ]
        for active in self.patches:
            active.start()
            self.addCleanup(active.stop)
        backend_app.USER_SESSIONS.clear()
        self.addCleanup(backend_app.USER_SESSIONS.clear)
        self.client = backend_app.app.test_client()

    def face(self, user="alice", challenge=None, forge=False):
        data = {
            "user_id": user,
            "face_image": "dGVzdC1mYWtlLWltYWdl",
            "login_challenge_id": challenge,
        }
        if forge:
            data["liveness_data"] = {
                "liveness_validation": {"overall_liveness_passed": True}
            }
        return self.client.post("/api/biometric-login-verify", json=data)

    def liveness(self, user="alice", challenge=None):
        return self.client.post(
            "/api/sequential-liveness-detect",
            json={
                "user_id": user,
                "mode": "login",
                "login_challenge_id": challenge,
                "face_image": "dGVzdC1mYWtlLWltYWdl",
            },
        )

    def test_missing_challenge_rejected_at_both_endpoints(self):
        self.assertEqual(self.liveness().status_code, 403)
        self.assertEqual(self.face(forge=True).status_code, 403)

    def test_forged_client_liveness_does_not_pass(self):
        challenge = self.store.issue("alice")
        response = self.face(challenge=challenge, forge=True)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.store.is_liveness_completed(challenge, "alice"))

    def test_wrong_user_and_expiration_rejected(self):
        challenge = self.store.issue("alice")
        self.assertEqual(self.liveness("bob", challenge).status_code, 403)
        self.assertEqual(self.face("bob", challenge).status_code, 403)
        self.now[0] += 31
        self.assertEqual(self.liveness("alice", challenge).status_code, 403)
        self.assertEqual(self.face("alice", challenge).status_code, 403)

    def test_detector_failure_does_not_authorize_face(self):
        challenge = self.store.issue("alice")
        with patch.object(backend_app, "process_frame_api", return_value={
            "success": True,
            "face_detected": True,
            "blink_count": 2,
            "mouth_open_count": 1,
            "head_movement_count": 1,
            "liveness_score": 0.8,
            "liveness_passed": False,
        }):
            response = self.liveness(challenge=challenge)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["all_completed"])
        self.assertEqual(self.face(challenge=challenge).status_code, 403)

    def test_simulated_liveness_allows_one_face_verification(self):
        challenge = self.store.issue("alice")
        with patch.object(backend_app, "process_frame_api", return_value={
            "success": True,
            "face_detected": True,
            "blink_count": 2,
            "mouth_open_count": 1,
            "head_movement_count": 1,
            "liveness_score": 0.8,
            "liveness_passed": True,
        }):
            response = self.liveness(challenge=challenge)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["all_completed"])
        self.assertTrue(self.store.is_liveness_completed(challenge, "alice"))
        first = self.face(challenge=challenge)
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.get_json()["success"])
        self.assertEqual(self.face(challenge=challenge).status_code, 403)

    def test_cached_completion_is_not_reused_for_fresh_challenge(self):
        first = self.store.issue("alice")
        with patch.object(backend_app, "process_frame_api", return_value={
            "success": True,
            "face_detected": True,
            "blink_count": 2,
            "mouth_open_count": 1,
            "head_movement_count": 1,
            "liveness_score": 0.8,
            "liveness_passed": True,
        }):
            self.assertTrue(self.liveness(challenge=first).get_json()["all_completed"])
        second = self.store.issue("alice")
        with patch.object(backend_app, "process_frame_api", return_value={
            "success": True,
            "face_detected": True,
            "blink_count": 0,
            "mouth_open_count": 0,
            "head_movement_count": 0,
            "liveness_score": 0.0,
            "liveness_passed": False,
        }):
            response = self.liveness(challenge=second)
        self.assertFalse(response.get_json()["all_completed"])
        self.assertFalse(self.store.is_liveness_completed(second, "alice"))
        self.assertEqual(self.face(challenge=second).status_code, 403)


    def test_api_preserves_detector_randomized_requirements(self):
        challenge = self.store.issue("alice")
        with patch.object(backend_app, "process_frame_api", return_value={
            "success": True,
            "face_detected": True,
            "blink_count": 2,
            "mouth_open_count": 0,
            "head_movement_count": 0,
            "liveness_score": 0.0,
            "liveness_passed": False,
            "sequential_state": {
                "current_phase": "mouth",
                "challenge_order": ["mouth", "blinking", "head"],
                "requirements": {"blinks": 4, "mouth": 2, "head": 2},
            },
        }):
            response = self.liveness(challenge=challenge)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertFalse(data["all_completed"])
        self.assertEqual(data["sequential_state"]["current_phase"], "mouth")
        self.assertEqual(data["sequential_state"]["requirements"]["blinks"], 4)
        self.assertFalse(data["liveness_validation"]["step_requirements"]["blinks_met"])

    def test_detector_error_preserves_reason_and_type(self):
        challenge = self.store.issue("alice")
        with patch.object(backend_app, "process_frame_api", return_value={
            "success": False,
            "face_detected": True,
            "error": "Static image or photo detected. Please use live camera feed.",
            "alert_type": "static_image",
            "blink_count": 0,
            "mouth_open_count": 0,
            "head_movement_count": 0,
            "liveness_score": 0.0,
            "sequential_state": {"current_phase": "blinking"},
        }):
            response = self.liveness(challenge=challenge)
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertEqual(data["alert_type"], "static_image")
        self.assertIn("Static image", data["error"])
        self.assertEqual(data["sequential_state"]["current_phase"], "blinking")



if __name__ == "__main__":
    unittest.main()
