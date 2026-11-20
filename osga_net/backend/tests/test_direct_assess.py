import io
from fastapi.testclient import TestClient
from PIL import Image
import numpy as np

from backend.app.main import app

def test_direct_assess_flow(client):
    """Verify that direct assessment accepts an image, creates a study, runs inference, and returns landmarks + prediction."""
    # Create synthetic test radiograph
    arr = np.random.randint(50, 220, (300, 300), dtype=np.uint8)
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    files = {"file": ("test_hand.png", buf, "image/png")}
    data = {"sex": "male", "chron_years": "11.5", "run_demo": "true"}

    response = client.post("/api/assessments/direct-assess", files=files, data=data)
    assert response.status_code == 201, response.text
    payload = response.json()

    assert "assessment" in payload
    assert "result" in payload
    assert payload["assessment"]["patient_sex"] == "male"
    assert payload["result"]["prediction"]["bone_age_months"] > 0
    assert len(payload["result"]["landmarks"]) == 13
    assert len(payload["result"]["prediction"]["probability_distribution"]) == 228
    assert "radius_distal" in payload["result"]["readout_weights"]
