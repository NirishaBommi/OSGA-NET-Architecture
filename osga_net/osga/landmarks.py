"""Ossification-region landmarks: node names, anatomical adjacency, landmark sources.

RSNA ships NO landmark annotations. Three honest options are supported:
  * "csv"      - you supply real landmark annotations (e.g. from a hand-pose model such as
                 Escobar et al., or manual clicks). Preferred.
  * "template" - a classical-CV *approximation*: Otsu hand segmentation -> bounding box ->
                 fixed anatomical template mapped into that box. It assumes an upright hand
                 (fingers up, thumb on image right). It is weak supervision, NOT ground truth.
  * "none"     - no landmark supervision (heatmap loss weight is effectively 0); the landmark
                 head then learns only through the end-to-end age loss.
"""
from __future__ import annotations
import numpy as np
import cv2
import pandas as pd

NUM_NODES = 13
NODE_NAMES = [
    "radius_distal", "ulna_distal",
    "carpal_scaphoid_lunate", "carpal_capitate", "carpal_hamate", "carpal_triquetrum",
    "mc1_epiphysis", "mc2_epiphysis", "mc3_epiphysis", "mc4_epiphysis", "mc5_epiphysis",
    "phalanx_thumb_prox", "phalanx_mid_prox",
]
# Fixed anatomical adjacency (undirected). radius/ulna -> carpals -> metacarpals -> phalanges,
# plus cross-ray edges between neighbouring metacarpals (symmetric ossification centres).
EDGES = [
    (0, 1),
    (0, 2), (0, 3), (1, 4), (1, 5),
    (2, 3), (3, 4), (4, 5),
    (2, 6), (2, 7), (3, 8), (4, 9), (5, 10),
    (6, 7), (7, 8), (8, 9), (9, 10),
    (6, 11), (8, 12), (11, 12),
]


def build_adjacency() -> np.ndarray:
    A = np.eye(NUM_NODES, dtype=np.float32)
    for i, j in EDGES:
        A[i, j] = A[j, i] = 1.0
    return A


# Approximate normalised (x, y) inside the hand bounding box. Fingers up, thumb on image right.
TEMPLATE = np.array([
    [0.65, 0.93], [0.35, 0.93],
    [0.60, 0.80], [0.50, 0.76], [0.40, 0.77], [0.33, 0.80],
    [0.82, 0.62], [0.68, 0.45], [0.52, 0.42], [0.38, 0.45], [0.24, 0.52],
    [0.90, 0.48], [0.52, 0.28],
], dtype=np.float32)


def hand_bbox(gray: np.ndarray):
    """Return (x0, y0, x1, y1) normalised bbox of the hand in a uint8 gray image."""
    h, w = gray.shape
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    border = np.concatenate([gray[0], gray[-1], gray[:, 0], gray[:, -1]])
    if border.mean() > 127:          # inverted film: make the hand the bright foreground
        blur = 255 - blur
    _, m = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return 0.05, 0.05, 0.95, 0.95
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x, y, bw, bh, area = stats[k]
    if area < 0.05 * h * w:
        return 0.05, 0.05, 0.95, 0.95
    return x / w, y / h, (x + bw) / w, (y + bh) / h


def template_landmarks(gray: np.ndarray) -> np.ndarray:
    x0, y0, x1, y1 = hand_bbox(gray)
    lm = TEMPLATE.copy()
    lm[:, 0] = x0 + lm[:, 0] * (x1 - x0)
    lm[:, 1] = y0 + lm[:, 1] * (y1 - y0)
    return np.clip(lm, 0, 1)


class LandmarkTable:
    """Reads a CSV: id, x0,y0,...,x12,y12 with coordinates normalised to the ORIGINAL image
    (0..1 of width/height). NaN = missing landmark."""

    def __init__(self, path: str):
        df = pd.read_csv(path)
        df["id"] = df["id"].astype(str)
        cols = [f"{a}{i}" for i in range(NUM_NODES) for a in ("x", "y")]
        missing = [c for c in cols if c not in df.columns]
        if missing:
            raise ValueError(f"landmark csv missing columns, e.g. {missing[:4]}")
        self.table = {r["id"]: r[cols].to_numpy(np.float32).reshape(NUM_NODES, 2) for _, r in df.iterrows()}

    def get(self, image_id: str):
        return self.table.get(str(image_id))


def render_heatmaps(lm: np.ndarray, valid: np.ndarray, size: int, sigma: float = 1.5) -> np.ndarray:
    """lm (13,2) normalised coords in the padded square frame -> (13,size,size), peak = 1."""
    xs = (np.arange(size, dtype=np.float32) + 0.5) / size
    out = np.zeros((NUM_NODES, size, size), np.float32)
    s = sigma / size
    for k in range(NUM_NODES):
        if not valid[k]:
            continue
        gx = np.exp(-((xs - lm[k, 0]) ** 2) / (2 * s * s))
        gy = np.exp(-((xs - lm[k, 1]) ** 2) / (2 * s * s))
        out[k] = np.outer(gy, gx)
    return out
