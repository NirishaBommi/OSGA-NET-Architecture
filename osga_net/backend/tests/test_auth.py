from __future__ import annotations


def test_register_and_login(client):
    # Register user
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "username": "dr_alice",
            "email": "alice@hospital.org",
            "password": "Password123!",
            "full_name": "Dr. Alice Smith",
        },
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert data["username"] == "dr_alice"
    assert "osga_access_token" in reg_resp.cookies

    # Duplicate registration should fail
    dup_resp = client.post(
        "/api/auth/register",
        json={
            "username": "dr_alice",
            "email": "alice2@hospital.org",
            "password": "Password123!",
        },
    )
    assert dup_resp.status_code == 400

    # Login
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "dr_alice", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    assert "osga_access_token" in login_resp.cookies

    # Check /me with cookie
    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "dr_alice"

    # Logout
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200
