from __future__ import annotations
import io
import cv2
import numpy as np


def test_upload_validation(client):
    # Register user
    client.post(
        "/api/auth/register",
        json={"username": "uploader", "email": "uploader@hospital.org", "password": "Password123!"},
    )

    # Create study
    study_resp = client.post(
        "/api/assessments",
        json={"title": "Upload Test Study", "patient_sex": "female"},
    )
    study_id = study_resp.json()["id"]

    # 1. Reject fake text file
    fake_txt = io.BytesIO(b"This is just plain text, not a radiograph")
    resp_txt = client.post(
        f"/api/assessments/{study_id}/image",
        files={"file": ("fake.png", fake_txt, "image/png")},
    )
    assert resp_txt.status_code == 415

    # 2. Reject undersized image
    tiny_im = np.zeros((64, 64), dtype=np.uint8)
    _, tiny_bytes = cv2.imencode(".png", tiny_im)
    resp_tiny = client.post(
        f"/api/assessments/{study_id}/image",
        files={"file": ("tiny.png", io.BytesIO(tiny_bytes), "image/png")},
    )
    assert resp_tiny.status_code == 422

    # 3. Accept valid PNG radiograph (192x192)
    valid_im = np.full((192, 192), 128, dtype=np.uint8)
    cv2.circle(valid_im, (96, 96), 40, 200, -1)
    _, valid_bytes = cv2.imencode(".png", valid_im)
    resp_valid = client.post(
        f"/api/assessments/{study_id}/image",
        files={"file": ("valid_hand.png", io.BytesIO(valid_bytes), "image/png")},
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["status"] == "uploaded"
    assert resp_valid.json()["image_original_width"] == 192
