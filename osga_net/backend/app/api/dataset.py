from __future__ import annotations
from pathlib import Path
from fastapi import APIRouter
from osga.validation import DatasetValidator
from ..core.config import settings

router = APIRouter(prefix="/dataset", tags=["Dataset"])


@router.get("/summary")
def get_dataset_summary():
    splits_path = settings.SPLITS_CSV if settings.SPLITS_CSV.is_file() else Path("data/splits.csv")
    validator = DatasetValidator(splits_csv_path=splits_path)
    return validator.get_dataset_summary()


@router.get("/validate")
def validate_dataset_integrity():
    splits_path = settings.SPLITS_CSV if settings.SPLITS_CSV.is_file() else Path("data/splits.csv")
    validator = DatasetValidator(splits_csv_path=splits_path)
    return validator.validate_splits()
