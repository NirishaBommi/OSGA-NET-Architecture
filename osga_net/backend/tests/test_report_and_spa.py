import io
from fastapi.testclient import TestClient
from backend.app.main import app

def test_spa_serving(client):
    """Verify that root and deep links return index.html when dist exists."""
    response = client.get("/")
    assert response.status_code == 200
    assert "<!doctype html>" in response.text.lower() or "<div id=\"root\">" in response.text.lower()

    # Deep SPA route fallback
    response_deep = client.get("/architecture")
    assert response_deep.status_code == 200
    assert "<!doctype html>" in response_deep.text.lower() or "<div id=\"root\">" in response_deep.text.lower()


def test_report_generation_pdf(client):
    """Verify that creating an assessment, running demo inference, and generating PDF returns valid PDF bytes."""
    # 1. Register & login
    unique_user = "pdf_tester"
    client.post(
        "/api/auth/register",
        json={"username": unique_user, "email": "pdf@test.org", "password": "password123", "full_name": "PDF Reviewer"},
    )
    login_res = client.post(
        "/api/auth/login",
        json={"username": unique_user, "password": "password123"},
    )
    assert login_res.status_code == 200

    # 2. Create assessment
    create_res = client.post(
        "/api/assessments",
        json={"title": "PDF Test Study", "patient_sex": "male", "notes": "Checking reportlab output"},
    )
    assert create_res.status_code == 201
    assessment_id = create_res.json()["id"]

    # 3. Trigger demo inference
    demo_res = client.post(f"/api/assessments/{assessment_id}/demo-infer")
    assert demo_res.status_code == 200
    assert demo_res.json()["result_source"] == "demonstration"

    # 4. Request PDF report
    pdf_res = client.get(f"/api/assessments/{assessment_id}/report")
    assert pdf_res.status_code == 200
    assert pdf_res.headers.get("content-type") == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-")
    assert len(pdf_res.content) > 1000
