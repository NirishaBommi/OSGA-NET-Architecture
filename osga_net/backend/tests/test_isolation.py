from __future__ import annotations


def test_user_data_isolation(client):
    # Register User A
    resp_a = client.post(
        "/api/auth/register",
        json={"username": "user_a", "email": "a@hospital.org", "password": "Password123!"},
    )
    assert resp_a.status_code == 201

    # User A creates an assessment
    study_resp = client.post(
        "/api/assessments",
        json={"title": "Patient A Hand X-Ray", "patient_sex": "male", "chronological_age_months": 120.0},
    )
    assert study_resp.status_code == 201
    study_id = study_resp.json()["id"]

    # Verify User A sees the study in list
    list_a = client.get("/api/assessments")
    assert any(s["id"] == study_id for s in list_a.json())

    # Register & Login User B
    resp_b = client.post(
        "/api/auth/register",
        json={"username": "user_b", "email": "b@hospital.org", "password": "Password123!"},
    )
    assert resp_b.status_code == 201

    # User B list must NOT contain User A's study
    list_b = client.get("/api/assessments")
    assert not any(s["id"] == study_id for s in list_b.json())

    # User B direct access by ID should return 404
    get_b = client.get(f"/api/assessments/{study_id}")
    assert get_b.status_code == 404

    # User B delete attempt should return 404
    del_b = client.delete(f"/api/assessments/{study_id}")
    assert del_b.status_code == 404
