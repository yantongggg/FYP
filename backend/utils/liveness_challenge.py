"""In-process, single-use challenge binding for the prototype login flow.

Do not use this store as a production distributed session backend. Deployments with
multiple workers must use a shared transactional store, consistent rate limiting,
and server-issued authenticated sessions.
"""
import secrets
import threading
import time


class LoginChallengeStore:
    def __init__(self, ttl_seconds=300, clock=None):
        self.ttl_seconds = ttl_seconds
        self.clock = clock or time.monotonic
        self._lock = threading.Lock()
        self._challenges = {}

    def _lookup(self, challenge_id, user_id, now):
        if not isinstance(challenge_id, str) or not challenge_id:
            return None
        if not user_id:
            return None
        item = self._challenges.get(challenge_id)
        if (
            item is None
            or item["user_id"] != str(user_id)
            or item["used"]
            or now < item["issued_at"]
            or now - item["issued_at"] >= self.ttl_seconds
        ):
            return None
        return item

    def issue(self, user_id):
        if not user_id:
            raise ValueError("user_id required")
        with self._lock:
            now = self.clock()
            self._challenges = {
                key: val for key, val in self._challenges.items()
                if not val["used"] and 0 <= now - val["issued_at"] < self.ttl_seconds
            }
            challenge_id = secrets.token_urlsafe(32)
            self._challenges[challenge_id] = {
                "user_id": str(user_id),
                "issued_at": now,
                "liveness_completed": False,
                "used": False,
            }
            return challenge_id

    def is_pending(self, challenge_id, user_id):
        with self._lock:
            return self._lookup(challenge_id, user_id, self.clock()) is not None

    def mark_liveness_completed(self, challenge_id, user_id):
        with self._lock:
            item = self._lookup(challenge_id, user_id, self.clock())
            if item is None:
                return False
            item["liveness_completed"] = True
            return True

    def is_liveness_completed(self, challenge_id, user_id):
        with self._lock:
            item = self._lookup(challenge_id, user_id, self.clock())
            return bool(item is not None and item["liveness_completed"])

    def consume(self, challenge_id, user_id):
        """Atomically grant one successful face verification per completed challenge."""
        with self._lock:
            item = self._lookup(challenge_id, user_id, self.clock())
            if item is None or not item["liveness_completed"]:
                return False
            item["used"] = True
            return True
