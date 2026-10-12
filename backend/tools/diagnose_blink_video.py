#!/usr/bin/env python3
"""Inspect blink pulses in local videos independently of random challenge order.

Diagnostic only; action pulses in replay videos are NOT proof of PAD security.
Run with the FYP backend Python environment; no images are written.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import cv2
from ml_models import liveness_detector as ld
from ml_models.blink_pulse import BlinkPulseTracker


def run(video):
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError("Cannot open video: " + str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not 1 <= fps <= 120:
        raise RuntimeError("Invalid video FPS: " + str(fps))
    tracker = BlinkPulseTracker()
    frames = faces = landmarks_count = pulses = 0
    accepted_at = []
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            sec = frames / fps
            frames += 1
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb = cv2.convertScaleAbs(rgb, alpha=1.1, beta=5)
            boxes, probs = ld.MTCNN_MODEL.detect(rgb)
            if boxes is None or len(boxes) != 1:
                tracker.invalidate()
                continue
            faces += 1
            x1, y1, x2, y2 = [int(v) for v in boxes[0]]
            h, w = rgb.shape[:2]
            x1, y1 = max(0, x1 - 20), max(0, y1 - 20)
            x2, y2 = min(w, x2 + 20), min(h, y2 + 20)
            marks = ld.face_recognition.face_landmarks(rgb, [(y1, x2, y2, x1)])
            if not marks or not marks[0].get('left_eye') or not marks[0].get('right_eye'):
                tracker.invalidate()
                continue
            landmarks_count += 1
            left = ld.get_ear(marks[0]['left_eye'])
            right = ld.get_ear(marks[0]['right_eye'])
            if tracker.update(left, right, sec):
                pulses += 1
                accepted_at.append(round(sec, 3))
    finally:
        cap.release()
    print(f"{video.name}: frames={frames} faces={faces} landmarks={landmarks_count} "
          f"blink_pulses={pulses} candidate_seconds={accepted_at}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--video", nargs="+", type=Path, required=True)
    args = p.parse_args()
    ld.initialize_models()
    if ld.MTCNN_MODEL is None:
        raise RuntimeError("MTCNN failed to initialize")
    for video in args.video:
        run(video)


if __name__ == "__main__":
    main()
