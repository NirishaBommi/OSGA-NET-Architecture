"""RSNA Bone Age dataset + shared preprocessing (used identically at train and inference)."""
from __future__ import annotations
import numpy as np
import cv2
import pandas as pd
import torch
from torch.utils.data import Dataset

from .landmarks import (NUM_NODES, LandmarkTable, template_landmarks, render_heatmaps)

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def prepare_image(gray: np.ndarray, img_size: int):
    """uint8 gray (H,W) -> CLAHE -> pad to square (border median) -> resize.
    Returns (square_uint8[img_size,img_size], (pad_x, pad_y, S)) where S is the padded side."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    g = clahe.apply(gray)
    h, w = g.shape
    S = max(h, w)
    border = np.concatenate([g[0], g[-1], g[:, 0], g[:, -1]])
    fill = int(np.median(border))
    px, py = (S - w) // 2, (S - h) // 2
    sq = np.full((S, S), fill, np.uint8)
    sq[py:py + h, px:px + w] = g
    sq = cv2.resize(sq, (img_size, img_size), interpolation=cv2.INTER_AREA if S > img_size else cv2.INTER_LINEAR)
    return sq, (px, py, S, w, h)


def to_tensor(sq: np.ndarray) -> torch.Tensor:
    x = np.repeat(sq[..., None], 3, axis=2).astype(np.float32) / 255.0
    x = (x - MEAN) / STD
    return torch.from_numpy(x.transpose(2, 0, 1).copy())


def read_gray(path: str) -> np.ndarray:
    im = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if im is None:
        raise FileNotFoundError(path)
    return im


class BoneAgeDataset(Dataset):
    """Expects the split CSV written by scripts/prepare_data.py:
    columns id, path, boneage (months), male (0/1), split, fold [, chron_months]."""

    def __init__(self, df: pd.DataFrame, img_size=384, train=False, landmark_source="template",
                 landmark_csv=None, heat_div=8, sigma=1.5):
        self.df = df.reset_index(drop=True)
        self.img_size, self.train = img_size, train
        self.landmark_source = landmark_source
        self.table = LandmarkTable(landmark_csv) if landmark_source == "csv" else None
        self.heat_size = img_size // heat_div * 1   # heatmap head output size is img_size//8
        self.sigma = sigma

    def __len__(self):
        return len(self.df)

    def _augment(self, sq, lm):
        S = self.img_size
        ang = np.random.uniform(-15, 15)
        sc = np.random.uniform(0.9, 1.1)
        tx, ty = np.random.uniform(-0.05, 0.05, 2) * S
        M = cv2.getRotationMatrix2D((S / 2, S / 2), ang, sc)
        M[:, 2] += (tx, ty)
        fill = int(np.median(np.concatenate([sq[0], sq[-1], sq[:, 0], sq[:, -1]])))
        sq = cv2.warpAffine(sq, M, (S, S), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=fill)
        if lm is not None:
            pts = lm * S
            pts = pts @ M[:, :2].T + M[:, 2]
            lm = pts / S
        a, b = np.random.uniform(0.85, 1.15), np.random.uniform(-15, 15)
        sq = np.clip(sq.astype(np.float32) * a + b, 0, 255).astype(np.uint8)
        return sq, lm

    def __getitem__(self, i):
        r = self.df.iloc[i]
        gray = read_gray(r["path"])
        sq, (px, py, S, w, h) = prepare_image(gray, self.img_size)
        lm, valid = None, np.zeros(NUM_NODES, np.float32)
        if self.landmark_source == "csv":
            raw = self.table.get(r["id"])
            if raw is not None:
                lm = np.stack([(raw[:, 0] * w + px) / S, (raw[:, 1] * h + py) / S], 1).astype(np.float32)
                valid = (~np.isnan(lm).any(1)).astype(np.float32)
                lm = np.nan_to_num(lm, nan=0.5)
        if self.train:
            sq, lm = self._augment(sq, lm)
        if self.landmark_source == "template":
            lm = template_landmarks(sq)
            valid = np.ones(NUM_NODES, np.float32)
        if lm is None:
            lm = np.full((NUM_NODES, 2), 0.5, np.float32)
        valid = valid * ((lm >= 0) & (lm <= 1)).all(1).astype(np.float32)
        heat = render_heatmaps(lm, valid, self.heat_size, self.sigma)
        chron = float(r["chron_months"]) if "chron_months" in r and not pd.isna(r["chron_months"]) else np.nan
        return {
            "img": to_tensor(sq),
            "male": torch.tensor(float(r["male"])),
            "age": torch.tensor(float(r["boneage"])),
            "chron": torch.tensor(0.0 if np.isnan(chron) else chron),
            "chron_mask": torch.tensor(0.0 if np.isnan(chron) else 1.0),
            "heat": torch.from_numpy(heat),
            "heat_valid": torch.from_numpy(valid),
            "id": str(r["id"]),
        }
