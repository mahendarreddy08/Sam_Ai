"""
Unit & Integration Tests for Optional Feedback API (/feedback)
Verifies best-effort execution, database isolation, input validation, and graceful failure handling.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_feedback_without_database_url_returns_saved_false():
    with patch("os.getenv", return_value=""):
        payload = {
            "text": "what is the date",
            "predicted_intent": "time",
            "helpful": False,
            "correct_intent": "chat",
            "session_id": "anon-session-1234"
        }
        response = client.post("/feedback", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["saved"] is False

def test_feedback_mocked_db_success():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    with patch("os.getenv", return_value="postgresql://user:pass@localhost:5432/testdb"), \
         patch("psycopg.connect", return_value=mock_conn):

        payload = {
            "text": "open youtube",
            "predicted_intent": "open_site",
            "helpful": True,
            "session_id": "anon-session-5678"
        }
        response = client.post("/feedback", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["saved"] is True
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

def test_feedback_mocked_db_failure_recovers_gracefully():
    with patch("os.getenv", return_value="postgresql://user:pass@localhost:5432/testdb"), \
         patch("psycopg.connect", side_effect=Exception("Database connection timeout")):

        payload = {
            "text": "search for black holes",
            "predicted_intent": "search",
            "helpful": True,
            "session_id": "anon-session-9999"
        }
        response = client.post("/feedback", json=payload)
        # Failure must NEVER return a 500 status code
        assert response.status_code == 200
        data = response.json()
        assert data["saved"] is False

def test_feedback_validation_invalid_intent():
    payload = {
        "text": "search for black holes",
        "predicted_intent": "invalid_intent_xyz",
        "helpful": True,
    }
    response = client.post("/feedback", json=payload)
    assert response.status_code == 422

def test_feedback_validation_overlong_text():
    payload = {
        "text": "a" * 505,
        "predicted_intent": "chat",
        "helpful": False,
    }
    response = client.post("/feedback", json=payload)
    assert response.status_code == 422
