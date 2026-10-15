"""Bounded confirmation for uncertain MTCNN multi-face detections.

No frame containing multiple MTCNN boxes can receive active-challenge
credit. The guard only decides when a session is rejected terminally.
A small low-confidence lower-face candidate may be spurious, but this
heuristic NEVER asserts that the candidate is not another person.
"""


import math


class FaceCountGuard:
    def __init__(self, confirmation_frames=3, weak_confirmation_frames=8):
        if confirmation_frames < 2 or weak_confirmation_frames < confirmation_frames:
            raise ValueError("Invalid face-count confirmation windows")
        self.confirmation_frames = int(confirmation_frames)
        self.weak_confirmation_frames = int(weak_confirmation_frames)
        self.streak = 0
        self.strong_streak = 0

    def observe(self, count, *, weak_extra=False):
        """Confirm strong boxes in 3 frames, uncertain boxes within 8."""
        if count <= 1:
            self.streak = 0
            self.strong_streak = 0
            return False
        self.streak += 1
        if weak_extra:
            self.strong_streak = 0
        else:
            self.strong_streak += 1
        return (self.streak >= self.weak_confirmation_frames
                or self.strong_streak >= self.confirmation_frames)

    @property
    def ambiguous(self):
        return self.streak > 0


def weak_lower_face_candidate(boxes, probs):
    """Detect the *uncertain* extra-box phenotype in field diagnostic logs.

    This is NOT a passive PAD classifier. It never changes enrollment or
    challenge scores. Persistent weak boxes still reject after 8 frames.
    """
    if boxes is None or probs is None or len(boxes) != 2 or len(probs) != 2:
        return False
    try:
        confidences = [float(p) for p in probs]
        rects = [tuple(float(v) for v in box) for box in boxes]
    except (ValueError, TypeError):
        return False
    if not all(math.isfinite(v) for rect in rects for v in rect):
        return False
    if not all(math.isfinite(p) for p in confidences):
        return False
    areas = []
    for x1, y1, x2, y2 in rects:
        if x2 <= x1 or y2 <= y1:
            return False
        areas.append((x2 - x1) * (y2 - y1))
    main_index = max(range(2), key=lambda i: confidences[i])
    other_index = 1 - main_index
    main, other = rects[main_index], rects[other_index]
    return (
        confidences[main_index] >= 0.975
        and confidences[other_index] < 0.94
        and areas[other_index] < 0.65 * areas[main_index]
        and other[1] >= main[3] - 0.10 * (main[3] - main[1])
    )
