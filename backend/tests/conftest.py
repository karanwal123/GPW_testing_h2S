"""
Pytest fixtures and configuration for backend testing.
Provides mocked Vertex AI, Google Maps, and FastAPI TestClient.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# ─── Mock vertexai BEFORE any imports ──────────────────────────────────────
mock_vertexai_module = Mock()
mock_vertexai_module.init = Mock()
sys.modules["vertexai"] = mock_vertexai_module

mock_generative_models = Mock()
mock_generative_models.GenerativeModel = Mock(return_value=Mock())
mock_generative_models.Tool = Mock()
mock_generative_models.grounding = Mock()
sys.modules["vertexai.generative_models"] = mock_generative_models

# ─── Mock googlemaps BEFORE any imports ──────────────────────────────────────
def mock_googlemaps_client(*args, **kwargs):
    mock_gmaps = Mock()
    mock_gmaps.geocode = Mock(return_value=[
        {
            "formatted_address": "123 Main St, New Delhi, India",
            "geometry": {"location": {"lat": 28.6139, "lng": 77.2090}},
        }
    ])
    mock_gmaps.places_nearby = Mock(return_value={
        "results": [
            {
                "name": "Central School",
                "vicinity": "Main Rd, Delhi",
                "geometry": {"location": {"lat": 28.6140, "lng": 77.2091}},
            }
        ]
    })
    return mock_gmaps

mock_googlemaps = Mock()
mock_googlemaps.Client = mock_googlemaps_client
sys.modules["googlemaps"] = mock_googlemaps


@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Mock environment variables before importing the app."""
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "test-project")
    monkeypatch.setenv("GOOGLE_CLOUD_REGION", "us-central1")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "AIzaSy_test_key_123456789")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")


@pytest.fixture
def client():
    """Provide a FastAPI TestClient for the app."""
    # Import after mocking
    from main import app
    return TestClient(app)


@pytest.fixture
def mock_gemini_response():
    """Mock response from Gemini API."""
    mock_response = Mock()
    mock_response.text = "Test response from Gemini"
    return mock_response


@pytest.fixture
def sample_chat_request():
    """Sample valid chat request payload."""
    return {
        "message": "What are the voting eligibility criteria in India?",
        "session_id": "test-session-123",
    }


@pytest.fixture
def sample_booth_request():
    """Sample valid booth finder request payload."""
    return {
        "address": "Connaught Place, New Delhi",
        "session_id": "test-session-456",
    }


@pytest.fixture
def mock_orchestrator(monkeypatch):
    """Mock the orchestrator to avoid Gemini calls during testing."""
    mock_orch = Mock()
    mock_orch.process = Mock(return_value={
        "route": "general",
        "prompt": "User asked about voting",
        "intent": "general",
        "topic": "voting",
        "entities": {},
        "quick_reply": None,
    })
    
    def mock_get_orchestrator(model_name):
        return mock_orch
    
    monkeypatch.setattr("main.get_orchestrator", mock_get_orchestrator)
    return mock_orch
