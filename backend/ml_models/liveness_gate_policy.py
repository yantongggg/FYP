"""Explicit guard for passive static-image checks during action challenges.

An incomplete blink/mouth/head challenge is an authentication rejection, not by
itself evidence that a physical photograph was presented. Running variance
heuristics on the initial stationary frames would reject legitimate users
before they were prompted to act.

This helper does not certify that a successful challenge is resistant to video
replay. That must be measured separately with presentation-attack datasets.
"""


def may_evaluate_static_image(user_state):
    """Run a static-image heuristic only after all requested movements exist."""
    return (
        user_state.frames_processed >= 30
        and user_state.total_blinks >= user_state.required_blinks
        and user_state.total_mouth_open >= user_state.required_mouth_opens
        and user_state.total_head_movements >= user_state.required_head_movements
    )
