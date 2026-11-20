"""Dataset validation and integrity verification module for OSGA-Net."""
from __future__ import annotations
import os
import json
from pathlib import Path
from typing import Any
import pandas as pd
import numpy as np
import cv2


class DatasetValidator:
    """Validates the structure, integrity, and clinical metadata of RSNA Bone Age data."""

    def __init__(self, splits_csv_path: str | Path | None = None, raw_data_dir: str | Path | None = None):
        self.splits_path = Path(splits_csv_path) if splits_csv_path else None
        self.raw_dir = Path(raw_data_dir) if raw_data_dir else None

    def validate_splits(self, splits_df: pd.DataFrame | None = None) -> dict[str, Any]:
        """Validates a splits DataFrame or file for missing files, duplicates, invalid values, and leakage."""
        if splits_df is None:
            if not self.splits_path or not self.splits_path.is_file():
                return {
                    "valid": False,
                    "error": f"Splits file not found: {self.splits_path}",
                    "splits_present": False,
                }
            splits_df = pd.read_csv(self.splits_path)

        required_cols = {"id", "path", "boneage", "male", "split"}
        missing_cols = required_cols - set(splits_df.columns)
        if missing_cols:
            return {
                "valid": False,
                "error": f"Missing required columns in splits CSV: {list(missing_cols)}",
                "splits_present": True,
            }

        total_rows = len(splits_df)
        report: dict[str, Any] = {
            "valid": True,
            "splits_present": True,
            "total_samples": total_rows,
            "columns": list(splits_df.columns),
            "splits": {},
            "integrity_checks": {},
            "issues": [],
            "warnings": [],
        }

        # 1. Duplicate detection
        duplicate_ids = splits_df[splits_df.duplicated(subset=["id"], keep=False)]["id"].unique().tolist()
        report["integrity_checks"]["duplicate_id_count"] = len(duplicate_ids)
        if duplicate_ids:
            report["issues"].append(f"Found {len(duplicate_ids)} duplicate sample IDs: {duplicate_ids[:5]}")
            report["valid"] = False

        # 2. Data leakage across splits
        splits_by_id = splits_df.groupby("id")["split"].nunique()
        leaked_ids = splits_by_id[splits_by_id > 1].index.tolist()
        report["integrity_checks"]["split_leakage_count"] = len(leaked_ids)
        if leaked_ids:
            report["issues"].append(f"Data leakage detected! {len(leaked_ids)} IDs exist in multiple splits: {leaked_ids[:5]}")
            report["valid"] = False

        # 3. Missing image detection & resolution check
        missing_images = []
        corrupt_images = []
        resolutions = []
        for _, row in splits_df.iterrows():
            img_path = Path(str(row["path"]))
            if not img_path.is_file():
                missing_images.append(str(row["id"]))
            else:
                # Fast header read with cv2
                im = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
                if im is None:
                    corrupt_images.append(str(row["id"]))
                else:
                    h, w = im.shape
                    resolutions.append((w, h))

        report["integrity_checks"]["missing_images"] = len(missing_images)
        report["integrity_checks"]["corrupt_images"] = len(corrupt_images)
        if missing_images:
            report["issues"].append(f"{len(missing_images)} sample paths do not exist on disk: {missing_images[:5]}")
            report["valid"] = False
        if corrupt_images:
            report["issues"].append(f"{len(corrupt_images)} image files could not be decoded: {corrupt_images[:5]}")
            report["valid"] = False

        if resolutions:
            ws, hs = zip(*resolutions)
            report["integrity_checks"]["resolution_summary"] = {
                "min_width": int(min(ws)), "max_width": int(max(ws)),
                "min_height": int(min(hs)), "max_height": int(max(hs)),
                "aspect_ratio_mean": round(float(np.mean([w / h for w, h in resolutions])), 3),
            }

        # 4. Age range validation (RSNA standard: 1 to 228 months)
        invalid_age = splits_df[(splits_df["boneage"] < 1.0) | (splits_df["boneage"] > 240.0)]
        report["integrity_checks"]["out_of_range_ages"] = len(invalid_age)
        if len(invalid_age) > 0:
            report["warnings"].append(f"{len(invalid_age)} samples have bone age outside expected 1-228 month range")

        # 5. Sex encoding validation (0/1 or bool)
        invalid_sex = splits_df[~splits_df["male"].isin([0, 1, True, False])]
        report["integrity_checks"]["invalid_sex_encoding"] = len(invalid_sex)
        if len(invalid_sex) > 0:
            report["issues"].append(f"{len(invalid_sex)} samples have invalid sex values")
            report["valid"] = False

        # 6. Per-split statistics
        for sp in splits_df["split"].unique():
            sub = splits_df[splits_df["split"] == sp]
            male_cnt = int(sub["male"].astype(int).sum())
            fem_cnt = len(sub) - male_cnt
            male_pct = round(100.0 * male_cnt / max(1, len(sub)), 1)
            report["splits"][sp] = {
                "count": len(sub),
                "male_count": male_cnt,
                "female_count": fem_cnt,
                "male_percentage": male_pct,
                "age_min_months": round(float(sub["boneage"].min()), 1),
                "age_max_months": round(float(sub["boneage"].max()), 1),
                "age_mean_months": round(float(sub["boneage"].mean()), 1),
                "age_std_months": round(float(sub["boneage"].std()), 1) if len(sub) > 1 else 0.0,
            }

        return report

    def get_dataset_summary(self) -> dict[str, Any]:
        """Provides an API-friendly overview of dataset availability and distribution."""
        val_result = self.validate_splits()
        if not val_result.get("splits_present", False):
            # Check if raw files exist
            raw_train_dir = Path("data/sample_rsna/package/boneage-training-dataset")
            has_raw = raw_train_dir.is_dir()
            return {
                "available": False,
                "splits_present": False,
                "raw_present": has_raw,
                "status": "pending_data_preparation",
                "message": "No splits.csv found. Run data preparation or use the training panel to initialize data.",
                "total_samples": 0,
                "splits": {},
            }

        return {
            "available": val_result["valid"],
            "splits_present": True,
            "total_samples": val_result["total_samples"],
            "splits": val_result["splits"],
            "integrity_checks": val_result["integrity_checks"],
            "issues": val_result["issues"],
            "warnings": val_result["warnings"],
            "status": "ready" if val_result["valid"] else "has_integrity_issues",
            "message": "Dataset verified and ready for model training." if val_result["valid"] else "Dataset has issues."
        }
