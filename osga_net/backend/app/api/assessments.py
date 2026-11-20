from __future__ import annotations
import os
import uuid
import time
from pathlib import Path
from typing import Literal
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Response, status
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.deps import get_db, get_current_user, get_current_user_or_guest
from ..db.models import User, Assessment, AssessmentResult, AuditEvent
from ..schemas.assessment import (
    AssessmentCreate,
    AssessmentOut,
    PredictionResultSchema,
    DirectAssessmentResponse,
    LandmarkCoord,
    RegionBox,
)
from ..services.inference_service import inference_service
from ..services.report_service import generate_pdf_report
from osga.landmarks import NODE_NAMES, EDGES

router = APIRouter(prefix="/assessments", tags=["Assessments"])

MAGIC_BYTES = {
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpeg",
}


def validate_image_upload(content: bytes) -> tuple[str, int, int, str | None]:
    if len(content) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file exceeds maximum limit of {settings.MAX_UPLOAD_MB} MB",
        )

    # Check magic bytes
    ext = None
    for magic, filetype in MAGIC_BYTES.items():
        if content.startswith(magic):
            ext = filetype
            break
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image format. Only valid PNG and JPEG radiographs are supported (no DICOM).",
        )

    # Decode image
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image corrupt or undecodable by image processing harness.",
        )

    h, w = img.shape
    if h < 128 or w < 128:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image dimensions too small ({w}x{h}). Minimum required: 128x128.",
        )

    advisory = None
    std = float(np.std(img))
    if std < 5.0:
        advisory = "Warning: Low image contrast detected. Verification recommended."

    return ext, w, h, advisory


def build_demo_result(assessment: Assessment, w: int, h: int) -> AssessmentResult:
    S = max(w, h)
    px = (S - w) // 2
    py = (S - h) // 2

    # Deterministic but personalized demo value based on chronological age if given, else 138.4 (~11y 6m)
    if assessment.chronological_age_months:
        demo_months = round(float(assessment.chronological_age_months) + (2.4 if assessment.patient_sex == "male" else -1.8), 1)
    else:
        demo_months = 138.4
    demo_std = 7.8

    # Synthetic but realistic Gaussian probability distribution over 228 bins
    bins = np.arange(1, 229)
    dist = np.exp(-((bins - demo_months) ** 2) / (2 * (demo_std ** 2)))
    dist = (dist / dist.sum()).tolist()

    from osga.landmarks import TEMPLATE
    landmarks_list = []
    for i, name in enumerate(NODE_NAMES):
        u, v = float(TEMPLATE[i, 0]), float(TEMPLATE[i, 1])
        landmarks_list.append({
            "node_id": i,
            "name": name,
            "x_norm": round(u, 4),
            "y_norm": round(v, 4),
            "x_orig_px": round(u * S - px, 1),
            "y_orig_px": round(v * S - py, 1),
        })

    # Anatomically grounded attention weights (distal radius and carpals slightly higher)
    weights_raw = [0.12, 0.10, 0.09, 0.09, 0.08, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.06, 0.06]
    total_w = sum(weights_raw)
    node_weights = {name: round(weights_raw[i] / total_w, 4) for i, name in enumerate(NODE_NAMES)}

    regions_list = [
        {
            "node_id": i,
            "name": NODE_NAMES[i],
            "box_norm": [round(lm["x_norm"] - 0.08, 4), round(lm["y_norm"] - 0.08, 4),
                         round(lm["x_norm"] + 0.08, 4), round(lm["y_norm"] + 0.08, 4)],
            "box_orig_px": [round(lm["x_orig_px"] - 0.08 * S, 1), round(lm["y_orig_px"] - 0.08 * S, 1),
                            round(lm["x_orig_px"] + 0.08 * S, 1), round(lm["y_orig_px"] + 0.08 * S, 1)]
        }
        for i, lm in enumerate(landmarks_list)
    ]

    graph_data = {
        "nodes": [{"id": i, "name": n} for i, n in enumerate(NODE_NAMES)],
        "edges": EDGES,
        "attention": None,
    }

    diff_chron = round(demo_months - assessment.chronological_age_months, 2) if assessment.chronological_age_months else None
    diff_ref = round(demo_months - assessment.reference_bone_age_months, 2) if assessment.reference_bone_age_months else None
    y = int(demo_months // 12)
    m = int(round(demo_months % 12))

    return AssessmentResult(
        assessment_id=assessment.id,
        result_source="demonstration",
        model_name="OSGA-Net (Demo)",
        model_version="2.0-demo",
        checkpoint_id="demonstration_fixture",
        img_size=384,
        bone_age_months=demo_months,
        bone_age_formatted=f"{y} y {m} m",
        most_probable_age_months=round(demo_months),
        difference_from_chronological_months=diff_chron,
        difference_from_reference_months=diff_ref,
        uncertainty_method="ordinal_distribution_std",
        uncertainty_std_months=demo_std,
        uncertainty_variance=round(demo_std ** 2, 2),
        interval_95_min=round(demo_months - 1.96 * demo_std, 1),
        interval_95_max=round(demo_months + 1.96 * demo_std, 1),
        needs_review=False,
        calibrated=False,
        calibration_threshold=14.5,
        distribution_json=dist,
        landmarks_json=landmarks_list,
        node_weights_json=node_weights,
        regions_json=regions_list,
        graph_json=graph_data,
        film_json={
            "gamma_summary": {"min": -0.12, "max": 0.15, "mean": 0.01},
            "beta_summary": {"min": -0.08, "max": 0.09, "mean": -0.005},
            "pre_film_norm": [1.0] * 13,
            "post_film_norm": [1.02] * 13,
        },
        timing_ms=145.2,
        limitations_json=[
            "DEMONSTRATION SAMPLE: Synthetic results for interface validation and educational walkthrough.",
            "Never use demonstration outputs for medical, diagnostic, or clinical evaluation."
        ]
    )


def serialize_prediction_result(res: AssessmentResult, assessment: Assessment) -> PredictionResultSchema:
    landmarks_payload = [
        LandmarkCoord(
            node_id=lm["node_id"],
            name=lm["name"],
            x_norm=lm["x_norm"],
            y_norm=lm["y_norm"],
            x_orig_px=lm["x_orig_px"],
            y_orig_px=lm["y_orig_px"],
        )
        for lm in res.landmarks_json
    ]

    regions_payload = [
        RegionBox(
            node_id=r["node_id"],
            name=r["name"],
            box_norm=r["box_norm"],
            box_orig_px=r["box_orig_px"],
        )
        for r in (res.regions_json or [])
    ] if res.regions_json else None

    return PredictionResultSchema(
        result_source=res.result_source,
        model={
            "name": res.model_name,
            "version": res.model_version,
            "checkpoint_id": res.checkpoint_id,
            "img_size": res.img_size,
        },
        input={
            "width": assessment.image_original_width or 384,
            "height": assessment.image_original_height or 384,
            "preprocessing": [
                "Grayscale conversion",
                "CLAHE (clipLimit=2.0, tileGridSize=(8, 8))",
                "Square padding (border median)",
                f"Resize to {res.img_size}x{res.img_size}",
                "ImageNet mean/std normalization",
            ]
        },
        metadata={
            "sex": assessment.patient_sex,
            "chronological_age_months": assessment.chronological_age_months,
            "reference_bone_age_months": assessment.reference_bone_age_months,
        },
        prediction={
            "bone_age_months": res.bone_age_months,
            "bone_age_formatted": res.bone_age_formatted,
            "most_probable_age_months": res.most_probable_age_months,
            "probability_distribution": res.distribution_json,
            "difference_from_chronological_months": res.difference_from_chronological_months,
            "difference_from_reference_months": res.difference_from_reference_months,
        },
        uncertainty={
            "method": res.uncertainty_method,
            "variance": res.uncertainty_variance,
            "standard_deviation": res.uncertainty_std_months,
            "central_95_mass_interval_months": [res.interval_95_min, res.interval_95_max],
            "needs_review": res.needs_review,
            "calibrated": res.calibrated,
            "calibration_threshold": res.calibration_threshold,
        },
        landmarks=landmarks_payload,
        readout_weights=res.node_weights_json or {},
        regions=regions_payload,
        graph=res.graph_json,
        film=res.film_json,
        timing_ms=res.timing_ms,
        limitations=res.limitations_json,
    )


@router.post("/direct-assess", response_model=DirectAssessmentResponse, status_code=status.HTTP_201_CREATED)
async def direct_assess(
    file: UploadFile = File(...),
    sex: str = Form("male"),
    chron_years: float | None = Form(None),
    run_demo: bool = Form(False),
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    """End-to-end direct assessment endpoint for single-click inference from the web workstation."""
    content = await file.read()
    ext, w, h, advisory = validate_image_upload(content)

    chron_months = float(chron_years) * 12.0 if chron_years is not None and chron_years > 0 else None

    assessment = Assessment(
        user_id=current_user.id,
        title=f"Study {time.strftime('%Y%m%d-%H%M')}",
        patient_sex=sex.lower(),
        chronological_age_months=chron_months,
        notes=f"[{advisory}]" if advisory else None,
        status="uploaded",
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    filename = f"{assessment.id}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = settings.UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)

    assessment.image_filename = filename
    assessment.image_original_width = w
    assessment.image_original_height = h

    # Check if checkpoint is loaded and not demo requested
    is_real = (inference_service.predictor is not None) and (not run_demo)

    if is_real:
        try:
            male = sex.lower() == "male"
            result = inference_service.infer(assessment, filepath, male=male, chron_months=chron_months)
            db.add(result)
            assessment.status = "completed"
            db.commit()
            db.refresh(assessment)
        except Exception as e:
            assessment.status = "failed"
            db.commit()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference error: {str(e)}")
    else:
        result = build_demo_result(assessment, w, h)
        db.add(result)
        assessment.status = "completed"
        db.commit()
        db.refresh(assessment)

    db.add(AuditEvent(
        user_id=current_user.id,
        event_type="DIRECT_ASSESSMENT_COMPLETED",
        details=f"Direct assessment {assessment.id} completed ({result.result_source})"
    ))
    db.commit()
    db.refresh(assessment)
    return DirectAssessmentResponse(
        assessment=assessment,
        result=serialize_prediction_result(result, assessment)
    )



@router.post("", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
def create_assessment(
    assessment_in: AssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = Assessment(
        user_id=current_user.id,
        title=assessment_in.title or f"Study {time.strftime('%Y%m%d-%H%M')}",
        patient_sex=assessment_in.patient_sex,
        chronological_age_months=assessment_in.chronological_age_months,
        reference_bone_age_months=assessment_in.reference_bone_age_months,
        notes=assessment_in.notes,
        status="created",
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    db.add(AuditEvent(user_id=current_user.id, event_type="ASSESSMENT_CREATED", details=f"Assessment {assessment.id} created"))
    db.commit()
    return assessment


@router.get("", response_model=list[AssessmentOut])
def list_assessments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Enforce strict user isolation
    q = db.query(Assessment).filter(Assessment.user_id == current_user.id)
    if status_filter:
        q = q.filter(Assessment.status == status_filter)
    assessments = q.order_by(Assessment.created_at.desc()).offset(skip).limit(limit).all()
    return assessments


@router.get("/{id}", response_model=AssessmentOut)
def get_assessment(
    id: str,
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return assessment


@router.post("/{id}/image", response_model=AssessmentOut)
async def upload_assessment_image(
    id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    content = await file.read()
    ext, w, h, advisory = validate_image_upload(content)

    filename = f"{assessment.id}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = settings.UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(content)

    assessment.image_filename = filename
    assessment.image_original_width = w
    assessment.image_original_height = h
    assessment.status = "uploaded"
    if advisory and assessment.notes:
        assessment.notes = f"{assessment.notes}\n[{advisory}]"
    elif advisory:
        assessment.notes = f"[{advisory}]"

    db.commit()
    db.refresh(assessment)

    db.add(AuditEvent(user_id=current_user.id, event_type="IMAGE_UPLOADED", details=f"Image {filename} uploaded for study {id}"))
    db.commit()
    return assessment


@router.get("/{id}/image-file")
def get_assessment_image_file(
    id: str,
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment or not assessment.image_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    
    filepath = settings.UPLOAD_DIR / assessment.image_filename
    if not filepath.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file missing on server")
    return FileResponse(filepath)


@router.post("/{id}/infer")
def run_inference(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    if not assessment.image_filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No radiograph uploaded for this assessment")

    image_path = settings.UPLOAD_DIR / assessment.image_filename
    if not image_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radiograph image file not found on disk")

    if inference_service.predictor is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Checkpoint not available at {settings.CKPT_PATH}. Train a model or switch to Demonstration Mode.",
        )

    try:
        male = assessment.patient_sex.lower() == "male"
        chron = assessment.chronological_age_months

        # Delete any previous result
        if assessment.result:
            db.delete(assessment.result)
            db.commit()

        result = inference_service.infer(assessment, image_path, male=male, chron_months=chron)
        db.add(result)
        assessment.status = "completed"
        db.commit()
        db.refresh(assessment)

        db.add(AuditEvent(user_id=current_user.id, event_type="INFERENCE_COMPLETED", details=f"Study {id} inference finished"))
        db.commit()
        return {"status": "success", "assessment_id": assessment.id, "result_id": result.id}
    except Exception as e:
        assessment.status = "failed"
        db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference error: {str(e)}")


@router.post("/{id}/demo-infer")
def run_demonstration_inference(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates clearly labelled demonstration data for viva and workflow presentation."""
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    w = assessment.image_original_width or 384
    h = assessment.image_original_height or 384
    S = max(w, h)
    px = (S - w) // 2
    py = (S - h) // 2

    demo_months = 138.4  # ~11 years 6 months
    demo_std = 7.8
    male = assessment.patient_sex == "male"

    # Synthetic but realistic Gaussian probability distribution over 228 bins
    bins = np.arange(1, 229)
    dist = np.exp(-((bins - demo_months) ** 2) / (2 * (demo_std ** 2)))
    dist = (dist / dist.sum()).tolist()

    # Fixed demo coordinates
    from osga.landmarks import TEMPLATE
    landmarks_list = []
    for i, name in enumerate(NODE_NAMES):
        u, v = float(TEMPLATE[i, 0]), float(TEMPLATE[i, 1])
        landmarks_list.append({
            "node_id": i,
            "name": name,
            "x_norm": round(u, 4),
            "y_norm": round(v, 4),
            "x_orig_px": round(u * S - px, 1),
            "y_orig_px": round(v * S - py, 1),
        })

    node_weights = {name: round(float(0.04 + 0.08 * (i % 4) / 3), 4) for i, name in enumerate(NODE_NAMES)}
    total_w = sum(node_weights.values())
    node_weights = {k: round(v / total_w, 4) for k, v in node_weights.items()}

    regions_list = [
        {
            "node_id": i,
            "name": NODE_NAMES[i],
            "box_norm": [round(lm["x_norm"] - 0.08, 4), round(lm["y_norm"] - 0.08, 4),
                         round(lm["x_norm"] + 0.08, 4), round(lm["y_norm"] + 0.08, 4)],
            "box_orig_px": [round(lm["x_orig_px"] - 0.08 * S, 1), round(lm["y_orig_px"] - 0.08 * S, 1),
                            round(lm["x_orig_px"] + 0.08 * S, 1), round(lm["y_orig_px"] + 0.08 * S, 1)]
        }
        for i, lm in enumerate(landmarks_list)
    ]

    graph_data = {
        "nodes": [{"id": i, "name": n} for i, n in enumerate(NODE_NAMES)],
        "edges": EDGES,
        "attention": None,
    }

    if assessment.result:
        db.delete(assessment.result)
        db.commit()

    diff_chron = round(demo_months - assessment.chronological_age_months, 2) if assessment.chronological_age_months else None
    diff_ref = round(demo_months - assessment.reference_bone_age_months, 2) if assessment.reference_bone_age_months else None

    result = AssessmentResult(
        assessment_id=assessment.id,
        result_source="demonstration",
        model_name="OSGA-Net (Demo)",
        model_version="2.0-demo",
        checkpoint_id="demonstration_fixture",
        img_size=384,
        bone_age_months=demo_months,
        bone_age_formatted="11 y 6 m",
        most_probable_age_months=138.0,
        difference_from_chronological_months=diff_chron,
        difference_from_reference_months=diff_ref,
        uncertainty_method="ordinal_distribution_std",
        uncertainty_std_months=demo_std,
        uncertainty_variance=round(demo_std ** 2, 2),
        interval_95_min=123.0,
        interval_95_max=154.0,
        needs_review=False,
        calibrated=False,
        calibration_threshold=14.5,
        distribution_json=dist,
        landmarks_json=landmarks_list,
        node_weights_json=node_weights,
        regions_json=regions_list,
        graph_json=graph_data,
        film_json={
            "gamma_summary": {"min": -0.12, "max": 0.15, "mean": 0.01},
            "beta_summary": {"min": -0.08, "max": 0.09, "mean": -0.005},
            "pre_film_norm": [1.0] * 13,
            "post_film_norm": [1.02] * 13,
        },
        timing_ms=145.2,
        limitations_json=[
            "DEMONSTRATION SAMPLE: Synthetic results for interface validation and educational walkthrough.",
            "Never use demonstration outputs for medical, diagnostic, or clinical evaluation."
        ]
    )
    db.add(result)
    assessment.status = "completed"
    db.commit()
    db.refresh(assessment)

    db.add(AuditEvent(user_id=current_user.id, event_type="DEMO_INFERENCE_GENERATED", details=f"Study {id} demo generated"))
    db.commit()
    return {"status": "success", "assessment_id": assessment.id, "result_id": result.id, "result_source": "demonstration"}


@router.get("/{id}/results", response_model=PredictionResultSchema)
def get_assessment_results(
    id: str,
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    if not assessment.result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No inference results found for this assessment")

    return serialize_prediction_result(assessment.result, assessment)



@router.get("/{id}/report")
def get_assessment_pdf_report(
    id: str,
    current_user: User = Depends(get_current_user_or_guest),
    db: Session = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    pdf_buffer = generate_pdf_report(assessment, assessment.result)
    filename = f"OSGA_Report_{assessment.id}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assessment(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assessment = db.query(Assessment).filter(Assessment.id == id, Assessment.user_id == current_user.id).first()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    if assessment.image_filename:
        img_path = settings.UPLOAD_DIR / assessment.image_filename
        if img_path.is_file():
            try:
                os.remove(img_path)
            except OSError:
                pass

    db.delete(assessment)
    db.commit()
    db.add(AuditEvent(user_id=current_user.id, event_type="ASSESSMENT_DELETED", details=f"Study {id} deleted"))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
