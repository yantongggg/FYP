"""Unit tests for prototype login challenge lifecycle (stdlib only).

Run: python -m unittest discover -s backend/tests -p 'test_liveness_challenge.py'
"""
import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from utils.liveness_challenge import LoginChallengeStore


class LoginChallengeTests(unittest.TestCase):
    def setUp(self):
        self.now = [100.0]
        self.store = LoginChallengeStore(ttl_seconds=30, clock=lambda: self.now[0])
        self.challenge = self.store.issue("alice")

    def test_fails_closed_without_liveness(self):
        self.assertFalse(self.store.is_liveness_completed(self.challenge, "alice"))
        self.assertFalse(self.store.consume(self.challenge, "alice"))

    def test_requires_matching_identity(self):
        self.assertFalse(self.store.is_pending(self.challenge, "bob"))
        self.assertFalse(self.store.mark_liveness_completed(self.challenge, "bob"))
        self.assertFalse(self.store.consume(self.challenge, "bob"))

    def test_complete_then_consume_once(self):
        self.assertTrue(self.store.mark_liveness_completed(self.challenge, "alice"))
        self.assertTrue(self.store.is_liveness_completed(self.challenge, "alice"))
        self.assertTrue(self.store.consume(self.challenge, "alice"))
        self.assertFalse(self.store.consume(self.challenge, "alice"))
        self.assertFalse(self.store.is_liveness_completed(self.challenge, "alice"))

    def test_expiration(self):
        self.now[0] += 30.0
        self.assertFalse(self.store.is_pending(self.challenge, "alice"))
        self.assertFalse(self.store.mark_liveness_completed(self.challenge, "alice"))
        self.assertFalse(self.store.consume(self.challenge, "alice"))

    def test_unrelated_challenge_is_not_authorized(self):
        new_challenge = self.store.issue("alice")
        self.store.mark_liveness_completed(self.challenge, "alice")
        self.assertFalse(self.store.is_liveness_completed(new_challenge, "alice"))

    def test_concurrent_consume_has_one_winner(self):
        self.store.mark_liveness_completed(self.challenge, "alice")
        successes = []
        barrier = threading.Barrier(8)

        def consume():
            barrier.wait()
            successes.append(self.store.consume(self.challenge, "alice"))

        threads = [threading.Thread(target=consume) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(sum(successes), 1)

    def test_missing_and_malformed_identifier(self):
        self.assertFalse(self.store.is_pending(None, "alice"))
        self.assertFalse(self.store.is_pending("", "alice"))
        self.assertFalse(self.store.is_pending({}, "alice"))
        self.assertFalse(self.store.is_pending(self.challenge, None))


if __name__ == "__main__":
    unittest.main()
