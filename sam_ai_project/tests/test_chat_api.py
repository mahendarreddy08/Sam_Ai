"""
API Integration & Contract Tests for FastAPI Backend (/health and /chat)
Tests input validation, contract schema, skill routing, confidence fallback, and mocked Groq integration.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from app import app, client_request_history

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_rate_limits():
    client_request_history.clear()
    yield
    client_request_history.clear()

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] in ["enabled", "disabled"]
    assert data["model"] == "loaded"

def test_chat_time_intent():
    payload = {
        "text": "what time is it right now",
        "history": []
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "time"
    assert data["action"] == "time"
    assert "{time}" in data["reply"]
    assert data["url"] is None
    assert 0.0 <= data["confidence"] <= 1.0

def test_chat_open_site_allowlisted():
    payload = {
        "text": "open youtube please",
        "history": []
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "open_site"
    assert data["url"] == "https://www.youtube.com"
    assert "YouTube" in data["reply"]

def test_chat_open_site_unknown_falls_back_to_google():
    payload = {
        "text": "open untrustedxyzdomain12345",
        "history": []
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Safe handling: does NOT open arbitrary untrusted URL
    assert data["url"].startswith("https://www.google.com/search?q=")

def test_chat_search_intent():
    payload = {
        "text": "search for black hole physics",
        "history": []
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "search"
    assert data["url"] == "https://www.google.com/search?q=black+hole+physics"
    assert "Searching Google" in data["reply"]

def test_confidence_fallback_routes_to_chat():
    # If classifier predicts 'open_site' but with very low confidence (e.g. 0.35 < 0.50),
    # the endpoint must safely route to 'chat'
    with patch("app.classifier.predict", return_value=("open_site", 0.35)), \
         patch("app.get_groq_client", return_value=None):
        payload = {"text": "ambiguous utterance", "history": []}
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == "chat"
        assert "offline mode" in data["reply"].lower()

def test_input_validation_empty_text():
    payload = {"text": "   ", "history": []}
    response = client.post("/chat", json=payload)
    assert response.status_code == 422

def test_input_validation_overlong_text():
    payload = {"text": "a" * 305, "history": []}
    response = client.post("/chat", json=payload)
    assert response.status_code == 422

def test_input_validation_excessive_history():
    history = [{"role": "user", "content": f"msg {i}"} for i in range(12)]
    payload = {"text": "hello", "history": history}
    response = client.post("/chat", json=payload)
    assert response.status_code == 422

def test_input_validation_invalid_role():
    history = [{"role": "admin", "content": "hello"}]
    payload = {"text": "hello", "history": history}
    response = client.post("/chat", json=payload)
    assert response.status_code == 422

def test_chat_missing_groq_key_returns_offline_reply():
    with patch("app.get_groq_client", return_value=None):
        payload = {"text": "explain quantum physics in simple words", "history": []}
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == "chat"
        assert "offline mode" in data["reply"].lower()

def test_chat_mocked_groq_success():
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Quantum physics explains matter at the atomic scale."
    mock_client.chat.completions.create.return_value.choices = [mock_choice]

    with patch("app.get_groq_client", return_value=mock_client):
        payload = {
            "text": "what is quantum physics",
            "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
        }
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == "chat"
        assert "Quantum physics explains" in data["reply"]

def test_chat_mocked_groq_failure_graceful_recovery():
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("Groq connection timeout")

    with patch("app.get_groq_client", return_value=mock_client):
        payload = {"text": "hello what is ai", "history": []}
        response = client.post("/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == "chat"
        assert "trouble connecting" in data["reply"].lower()

def test_rate_limiting_enforcement():
    # Rapidly fire requests exceeding 60 / minute
    payload = {"text": "what time is it", "history": []}
    statuses = []
    for _ in range(65):
        res = client.post("/chat", json=payload)
        statuses.append(res.status_code)

    assert 429 in statuses, "Rate limiter failed to trigger 429 Too Many Requests."
