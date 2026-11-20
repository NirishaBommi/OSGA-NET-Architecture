from __future__ import annotations
import uuid
import time
from pathlib import Path
from typing import Any
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.deps import get_db, get_current_user_or_guest
from ..db.models import User, Assessment, AssessmentResult
from ..services.inference_service import inference_service
from ..api.assessments import validate_image_upload, serialize_prediction_result
from osga.landmarks import NODE_NAMES, EDGES

router = APIRouter(tags=["Prediction"])


@router.post("/predict")
async def direct_predict(
    file: UploadFile = File(...),
    sex: str = Form(..., description="'male' or 'female' (case-insensitive)"),
    chronological_age: float | None = Form(None, description="Optional chronological age in years"),
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    """Direct, immediate inference endpoint returning 13 landmarks, 228 probabilities, GAT attention, and variance."""
    content = await file.read()
    ext, w, h, advisory = validate_image_upload(content)

    # Normalize sex
    sex_clean = sex.strip().lower()
    if sex_clean in ("male", "m", "1", "true"):
        is_male = True
    elif sex_clean in ("female", "f", "0", "false"):
        is_male = False
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid sex value: {sex}. Expected 'male' or 'female'.",
        )

    chron_months = float(chronological_age * 12.0) if chronological_age is not None else None

    # Persist image to disk
    assessment_id = f"OSGA-{uuid.uuid4().hex[:8].upper()}"
    filename = f"{assessment_id}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = settings.UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)

    assessment = Assessment(
        id=assessment_id,
        user_id=current_user.id,
        image_filename=filename,
        image_original_width=w,
        image_original_height=h,
        patient_sex="male" if is_male else "female",
        chronological_age_months=chron_months,
        status="processing",
    )
    db.add(assessment)
    db.commit()

    # Check if a real checkpoint is loaded
    if inference_service.predictor is not None:
        try:
            result = inference_service.infer(
                assessment=assessment,
                image_path=filepath,
                male=is_male,
                chron_months=chron_months,
            )
            assessment.status = "completed"
            db.add(result)
            db.commit()
            db.refresh(result)
            serialized = serialize_prediction_result(result, assessment)
            return serialized
        except Exception as e:
            assessment.status = "failed"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Inference execution failed: {str(e)}")

    # Integration Pending / Demonstration mode
    # Note: Clearly labelled with result_source: "demonstration"
    from ..api.assessments import build_demo_result
    demo_result = build_demo_result(assessment, w, h)
    db.add(demo_result)
    assessment.status = "completed"
    db.commit()
    db.refresh(demo_result)
    return serialize_prediction_result(demo_result, assessment)


@router.get("/predictions/history")
def get_prediction_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    """Fetches recent prediction records."""
    assessments = (
        db.query(Assessment)
        .filter(Assessment.user_id == current_user.id)
        .order_by(Assessment.created_at.desc())
        .limit(limit)
        .all()
    )

    history = []
    for a in assessments:
        res = a.result
        item = {
            "id": a.id,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "sex": a.patient_sex,
            "chronological_age_years": round(a.chronological_age_months / 12.0, 1) if a.chronological_age_months else None,
            "status": a.status,
            "has_result": res is not None,
            "result_source": res.result_source if res else None,
            "predicted_bone_age_months": res.bone_age_months if res else None,
            "predicted_bone_age_years": round(res.bone_age_months / 12.0, 1) if res else None,
            "predicted_bone_age_formatted": res.bone_age_formatted if res else None,
            "uncertainty_variance": res.uncertainty_variance if res else None,
            "image_filename": a.image_filename,
        }
        history.append(item)
    return {"history": history, "total": len(history)}
