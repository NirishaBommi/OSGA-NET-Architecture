from __future__ import annotations
import os
import time
import json
import logging
from pathlib import Path
from typing import Any
import cv2
import numpy as np
import torch

from ..core.config import settings
from ..db.models import Assessment, AssessmentResult
from osga.predictor import BoneAgePredictor
from osga.landmarks import NODE_NAMES, EDGES

logger = logging.getLogger("inference_service")


class InferenceService:
    _instance: InferenceService | None = None
    predictor: BoneAgePredictor | None = None
    loaded_ckpt_path: str | None = None
    load_error: str | None = None

    @classmethod
    def get_instance(cls) -> InferenceService:
        if cls._instance is None:
            cls._instance = InferenceService()
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        ckpt_path = Path(settings.CKPT_PATH)
        if ckpt_path.is_file():
            try:
                device = "cuda" if torch.cuda.is_available() else "cpu"
                self.predictor = BoneAgePredictor(str(ckpt_path), device=device)
                self.loaded_ckpt_path = str(ckpt_path)
                self.load_error = None
                logger.info("Successfully loaded checkpoint from %s on %s", ckpt_path, device)
            except Exception as e:
                self.predictor = None
                self.loaded_ckpt_path = None
                self.load_error = f"Error loading checkpoint: {str(e)}"
                logger.error("Failed to load checkpoint: %s", str(e))
        else:
            self.predictor = None
            self.loaded_ckpt_path = None
            self.load_error = f"Checkpoint not found at {ckpt_path}"
            logger.info("No checkpoint found at %s. Running in Integration Pending mode.", ckpt_path)

    def reload(self, custom_path: str | None = None):
        if custom_path:
            settings.CKPT_PATH = custom_path
        self.initialize()

    def get_status(self) -> dict[str, Any]:
        has_ckpt = self.predictor is not None
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        mode = "real_inference" if has_ckpt else "integration_pending"
        
        # Read checkpoint metadata if present
        img_size = getattr(self.predictor, "size", 384) if has_ckpt else 384
        use_chron = False
        use_landmark = True
        use_film = True
        use_gat = True
        ordinal = True
        landmark_source = "template"
        
        if has_ckpt and hasattr(self.predictor, "model"):
            m = self.predictor.model
            use_chron = getattr(m, "use_chron", False)
            use_landmark = getattr(m, "use_landmark", True)
            use_film = getattr(m, "use_film", True)
            use_gat = getattr(m, "use_gat", True)
            ordinal = getattr(m, "ordinal", True)
        
        threshold = getattr(self.predictor, "threshold", None) if has_ckpt else None
        
        return {
            "checkpoint_present": Path(settings.CKPT_PATH).is_file(),
            "checkpoint_loaded": has_ckpt,
            "checkpoint_path": self.loaded_ckpt_path,
            "model_name": "OSGA-Net",
            "img_size": img_size,
            "use_chron": use_chron,
            "use_landmark": use_landmark,
            "use_film": use_film,
            "use_gat": use_gat,
            "ordinal": ordinal,
            "landmark_source": landmark_source,
            "device": device,
            "calibration_threshold_p90": threshold,
            "mode": mode,
            "disclaimer": "Research prototype for bone-age assessment. Results are intended for research and educational demonstration and must not be used as the sole basis for clinical decisions."
        }

    def infer(self, assessment: Assessment, image_path: Path, male: bool, chron_months: float | None = None) -> AssessmentResult:
        if self.predictor is None:
            raise RuntimeError(f"No trained checkpoint loaded. Checkpoint path: {settings.CKPT_PATH}")
        
        if not image_path.is_file():
            raise FileNotFoundError(f"Image not found at {image_path}")

        im = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
        if im is None:
            raise ValueError("Could not decode image with OpenCV.")

        t0 = time.perf_counter()
        pred_dict = self.predictor.predict(im, male=male, chron_months=chron_months, return_aux=True)
        timing_ms = (time.perf_counter() - t0) * 1000.0

        months = float(pred_dict["bone_age_months"])
        std = float(pred_dict["uncertainty_std_months"])
        variance = float(std ** 2)
        
        diff_chron = round(months - chron_months, 2) if chron_months is not None else None
        diff_ref = round(months - assessment.reference_bone_age_months, 2) if assessment.reference_bone_age_months is not None else None
        
        p95 = pred_dict.get("interval95_months", [max(1.0, months - 1.96 * std), min(228.0, months + 1.96 * std)])
        
        distribution = pred_dict.get("distribution", [])
        most_prob = float(np.argmax(distribution) + 1) if distribution else months

        landmarks = pred_dict.get("landmarks_details", [])
        node_weights = pred_dict.get("node_weights", {})
        regions = pred_dict.get("regions", [])
        gat_attention = pred_dict.get("gat_attention", None)
        film_summary = pred_dict.get("film", None)
        
        graph_data = {
            "nodes": [{"id": i, "name": n} for i, n in enumerate(NODE_NAMES)],
            "edges": EDGES,
            "attention": gat_attention,
        }

        calibrated = self.predictor.threshold is not None

        result = AssessmentResult(
            assessment_id=assessment.id,
            result_source="real_inference",
            model_name="OSGA-Net",
            model_version="2.0",
            checkpoint_id=Path(self.loaded_ckpt_path).name if self.loaded_ckpt_path else "default",
            img_size=self.predictor.size,
            bone_age_months=round(months, 2),
            bone_age_formatted=pred_dict.get("bone_age", f"{int(months//12)} y {int(round(months%12))} m"),
            most_probable_age_months=round(most_prob, 2),
            difference_from_chronological_months=diff_chron,
            difference_from_reference_months=diff_ref,
            uncertainty_method="ordinal_distribution_std",
            uncertainty_std_months=round(std, 2),
            uncertainty_variance=round(variance, 2),
            interval_95_min=round(float(p95[0]), 2),
            interval_95_max=round(float(p95[1]), 2),
            needs_review=pred_dict.get("needs_review", None),
            calibrated=calibrated,
            calibration_threshold=self.predictor.threshold,
            distribution_json=distribution,
            landmarks_json=landmarks,
            node_weights_json=node_weights,
            regions_json=regions,
            graph_json=graph_data,
            film_json=film_summary,
            timing_ms=round(timing_ms, 1),
            limitations_json=[
                "Trained on RSNA Pediatric Bone Age dataset (U.S. population, 0-19 years).",
                "Landmarks localized via auxiliary soft-argmax head; may be degraded on severe hand deformity or atypical orientation.",
                "Uncertainty interval reflects model distribution spread, not prospective clinical calibration.",
            ]
        )
        return result


inference_service = InferenceService.get_instance()
