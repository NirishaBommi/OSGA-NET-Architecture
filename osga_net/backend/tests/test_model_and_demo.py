from __future__ import annotations
import io
import cv2
import numpy as np


def test_model_status_and_demo(client):
    # Register user
    client.post(
        "/api/auth/register",
        json={"username": "radiologist", "email": "rad@hospital.org", "password": "Password123!"},
    )

    # 1. Model status should report truthfully
    status_resp = client.get("/api/model/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert "mode" in status_data
    assert "disclaimer" in status_data

    # 2. Architecture endpoint
    arch_resp = client.get("/api/model/architecture")
    assert arch_resp.status_code == 200
    arch_data = arch_resp.json()
    assert arch_data["num_nodes"] == 13
    assert arch_data["num_edges"] == 20
    assert len(arch_data["layers"]) == 6

    # 3. Create study and upload image
    study_resp = client.post(
        "/api/assessments",
        json={"title": "Demo Study", "patient_sex": "male", "chronological_age_months": 135.0},
    )
    study_id = study_resp.json()["id"]

    im = np.full((200, 200), 100, dtype=np.uint8)
    _, im_bytes = cv2.imencode(".png", im)
    client.post(
        f"/api/assessments/{study_id}/image",
        files={"file": ("hand.png", io.BytesIO(im_bytes), "image/png")},
    )

    # 4. If checkpoint is missing, infer returns 503
    infer_resp = client.post(f"/api/assessments/{study_id}/infer")
    if not status_data["checkpoint_loaded"]:
        assert infer_resp.status_code == 503

    # 5. Run demonstration inference
    demo_resp = client.post(f"/api/assessments/{study_id}/demo-infer")
    assert demo_resp.status_code == 200
    assert demo_resp.json()["result_source"] == "demonstration"

    # 6. Retrieve results
    results_resp = client.get(f"/api/assessments/{study_id}/results")
    assert results_resp.status_code == 200
    res_data = results_resp.json()
    assert res_data["result_source"] == "demonstration"
    assert len(res_data["landmarks"]) == 13
    assert len(res_data["prediction"]["probability_distribution"]) == 228

    # 7. Download PDF report
    pdf_resp = client.get(f"/api/assessments/{study_id}/report")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 1000
