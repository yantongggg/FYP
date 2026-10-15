"""Debounce ambiguous face counts without crediting challenge progress.

This is NOT an anti-spoofing classifier. Frames reporting >1 detected face
are never eligible for challenge credit; persistent reports fail closed.
"""


class FaceCountGuard:
    def __init__(self, confirmation_frames=3):
        if confirmation_frames < 2:
            raise ValueError("confirmation_frames must be at least 2")
        self.confirmation_frames = int(confirmation_frames)
        self.streak = 0

    def observe(self, count):
        """Return True when multiple faces persist for N consecutive frames."""
        if count > 1:
            self.streak += 1
        else:
            self.streak = 0
        return self.streak >= self.confirmation_frames

    @property
    def ambiguous(self):
        return self.streak > 0
