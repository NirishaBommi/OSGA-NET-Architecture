"""Inference wrapper used by the Gradio app and the REST API."""
from __future__ import annotations
import json, os
import cv2
import numpy as np
import torch

from .dataset import prepare_image, to_tensor
from .model import build_model
from .landmarks import NODE_NAMES

DISCLAIMER = ("Research prototype - NOT a medical device and not validated for clinical use. "
              "Any estimate must be reviewed by a qualified radiologist.")


def fmt_age(months: float) -> str:
    y, m = divmod(int(round(months)), 12)
    return f"{y} y {m} m"


class BoneAgePredictor:
    def __init__(self, ckpt: str, device: str | None = None):
        self.dev = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        ck = torch.load(ckpt, map_location=self.dev, weights_only=False)
        m_kwargs = dict(ck.get("model_kwargs", {}))
        m_kwargs["pretrained"] = False
        self.model = build_model(ck["model_name"], **m_kwargs).to(self.dev)
        self.model.load_state_dict(ck["model"]); self.model.eval()
        self.size = ck["img_size"]
        cal = os.path.join(os.path.dirname(os.path.abspath(ckpt)), "calibration.json")
        self.threshold = json.load(open(cal))["uncertainty_threshold_p90"] if os.path.exists(cal) else None

    @torch.no_grad()
    def predict(self, image: np.ndarray, male: bool, chron_months: float | None = None, return_aux: bool = False) -> dict:
        gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        gray = gray.astype(np.uint8) if gray.dtype != np.uint8 else gray
        sq, (px, py, S, w, h) = prepare_image(gray, self.size)
        x = to_tensor(sq).unsqueeze(0).to(self.dev)
        m = torch.tensor([1.0 if male else 0.0], device=self.dev)
        c = torch.tensor([chron_months or 0.0], device=self.dev)
        cm = torch.tensor([0.0 if chron_months is None else 1.0], device=self.dev)
        o = self.model(x, m, c, cm, return_aux=return_aux)
        months, std = float(o["pred"][0]), float(o["std"][0])
        res = {"bone_age_months": months, "bone_age": fmt_age(months), "uncertainty_std_months": std,
               "disclaimer": DISCLAIMER, "needs_review": None,
               "pad_info": {"pad_x": int(px), "pad_y": int(py), "side": int(S), "orig_w": int(w), "orig_h": int(h)}}
        if "probs" in o:
            p = o["probs"][0].cpu().numpy(); cdf = np.cumsum(p)
            res["interval95_months"] = [float(np.searchsorted(cdf, 0.025) + 1), float(np.searchsorted(cdf, 0.975) + 1)]
            res["distribution"] = p.tolist()
            if self.threshold is not None:
                res["needs_review"] = bool(std > self.threshold)
        if o.get("coords") is not None:
            coords_np = o["coords"][0].cpu().numpy()
            res["landmarks"] = {n: [float(u), float(v)] for n, (u, v) in zip(NODE_NAMES, coords_np)}
            res["landmarks_details"] = [
                {
                    "node_id": i,
                    "name": n,
                    "x_norm": float(u),
                    "y_norm": float(v),
                    "x_orig_px": round(float(u * S - px), 1),
                    "y_orig_px": round(float(v * S - py), 1),
                }
                for i, (n, (u, v)) in enumerate(zip(NODE_NAMES, coords_np))
            ]
            res["node_weights"] = dict(zip(NODE_NAMES, o["node_weights"][0].cpu().numpy().round(4).tolist()))
        
        if return_aux:
            if o.get("roi_boxes") is not None:
                boxes_np = o["roi_boxes"][0].cpu().numpy()
                res["regions"] = [
                    {
                        "node_id": i,
                        "name": NODE_NAMES[i],
                        "box_norm": [round(float(val), 4) for val in boxes_np[i]],
                        "box_orig_px": [
                            round(float(boxes_np[i][0] * S - px), 1),
                            round(float(boxes_np[i][1] * S - py), 1),
                            round(float(boxes_np[i][2] * S - px), 1),
                            round(float(boxes_np[i][3] * S - py), 1),
                        ]
                    }
                    for i in range(len(NODE_NAMES))
                ]
            if o.get("gat_attention"):
                res["gat_attention"] = [
                    layer_a[0].cpu().numpy().round(4).tolist()
                    for layer_a in o["gat_attention"]
                ]
            if o.get("film_gamma") is not None and o.get("film_beta") is not None:
                g = o["film_gamma"][0].cpu().numpy()
                b = o["film_beta"][0].cpu().numpy()
                pre_n = o["pre_film_norm"][0].cpu().numpy() if o.get("pre_film_norm") is not None else None
                post_n = o["post_film_norm"][0].cpu().numpy() if o.get("post_film_norm") is not None else None
                res["film"] = {
                    "gamma_summary": {"min": round(float(g.min()), 4), "max": round(float(g.max()), 4), "mean": round(float(g.mean()), 4)},
                    "beta_summary": {"min": round(float(b.min()), 4), "max": round(float(b.max()), 4), "mean": round(float(b.mean()), 4)},
                    "pre_film_norm": [round(float(v), 4) for v in pre_n] if pre_n is not None else None,
                    "post_film_norm": [round(float(v), 4) for v in post_n] if post_n is not None else None,
                }
            if o.get("heat") is not None:
                heat_np = o["heat"][0].cpu().numpy()  # (13, H, W)
                res["heatmaps_shape"] = list(heat_np.shape)
                res["heatmaps_peak"] = [round(float(heat_np[i].max()), 4) for i in range(len(NODE_NAMES))]

        res["overlay"] = self._overlay(sq, res.get("landmarks"), res.get("node_weights"))
        return res

    @staticmethod
    def _overlay(sq, landmarks, weights):
        im = cv2.cvtColor(sq, cv2.COLOR_GRAY2RGB)
        if landmarks:
            S = im.shape[0]; wmax = max(weights.values()) if weights else 1
            for n, (u, v) in landmarks.items():
                r = int(4 + 8 * (weights[n] / wmax)) if weights else 5
                cv2.circle(im, (int(u * S), int(v * S)), r, (255, 80, 0), 2)
        return im
