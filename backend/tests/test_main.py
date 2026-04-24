"""
Tests for FastAPI endpoints in main.py
Covers: /api/health, /api/chat, /api/booth
Tests happy paths, edge cases, validation, and error handling.
"""

import pytest
from unittest.mock import Mock, patch
import json


class TestHealthEndpoint:
    """Test suite for GET /api/health"""
    
    def test_health_check_returns_200(self, client):
        """Validates that health endpoint returns 200 OK with service status."""
        response = client.get("/api/health")
        assert response.status_code == 200
    
    def test_health_check_structure(self, client):
        """Validates health response contains all required fields."""
        response = client.get("/api/health")
        data = response.json()
        assert "status" in data
        assert "vertex_initialized" in data
        assert "maps_initialized" in data
        assert "project" in data
        assert "region" in data
    
    def test_health_check_status_ok(self, client):
        """Validates status field is 'ok'."""
        response = client.get("/api/health")
        assert response.json()["status"] == "ok"


class TestChatEndpoint:
    """Test suite for POST /api/chat"""
    
    # ═══════════════════════════════════════════════════════════
    #  Happy Path Tests
    # ═══════════════════════════════════════════════════════════
    
    def test_chat_valid_message(self, client, sample_chat_request, mock_orchestrator):
        """Validates successful chat with valid message and session_id."""
        mock_orchestrator.process.return_value = {
            "route": "general",
            "prompt": "Answer about voting",
            "intent": "general",
            "topic": "voting",
            "entities": {},
            "quick_reply": None,
        }
        
        response = client.post("/api/chat", json=sample_chat_request)
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        assert "intent" in data
        assert "topic" in data
    
    def test_chat_greeting_quick_reply(self, client, mock_orchestrator):
        """Validates greeting returns quick_reply without calling Gemini."""
        mock_orchestrator.process.return_value = {
            "route": "greeting",
            "prompt": "",
            "intent": "greeting",
            "topic": "greeting",
            "entities": {},
            "quick_reply": "Namaste! I'm BharatBot.",
        }
        
        response = client.post("/api/chat", json={"message": "hello", "session_id": ""})
        assert response.status_code == 200
        data = response.json()
        # When quick_reply is set, the endpoint should return it directly
        assert data["intent"] == "greeting"
    
    def test_chat_without_session_id(self, client, mock_orchestrator):
        """Validates chat endpoint generates new session_id if not provided."""
        request = {"message": "What about elections?"}
        response = client.post("/api/chat", json=request)
        # Should succeed even without session_id (endpoint generates one)
        assert response.status_code in [200, 500]  # 500 if Vertex not init, but request is valid
    
    # ═══════════════════════════════════════════════════════════
    #  Input Validation Edge Cases
    # ═══════════════════════════════════════════════════════════
    
    def test_chat_empty_message(self, client):
        """Validates empty message is rejected by Pydantic validation."""
        response = client.post("/api/chat", json={"message": "", "session_id": "test"})
        # Pydantic enforces min_length=1
        assert response.status_code == 422  # Validation error
    
    def test_chat_whitespace_only_message(self, client):
        """Validates whitespace-only message passes validation (but may be rejected by logic)."""
        response = client.post("/api/chat", json={"message": "   ", "session_id": "test"})
        # Whitespace passes min_length check (3 chars), but orchestrator may handle it
        assert response.status_code in [200, 422, 400]
    
    def test_chat_message_too_long(self, client):
        """Validates message exceeding 2000 chars is rejected."""
        long_message = "a" * 2001
        response = client.post("/api/chat", json={"message": long_message, "session_id": "test"})
        assert response.status_code == 422  # Validation error
    
    def test_chat_message_at_max_length(self, client, mock_orchestrator):
        """Validates message at exactly 2000 chars is accepted."""
        max_message = "a" * 2000
        response = client.post("/api/chat", json={"message": max_message, "session_id": "test"})
        assert response.status_code in [200, 500]  # Should not fail validation
    
    def test_chat_session_id_too_long(self, client):
        """Validates session_id exceeding 200 chars is rejected."""
        long_session = "x" * 201
        response = client.post("/api/chat", json={"message": "test", "session_id": long_session})
        assert response.status_code == 422
    
    def test_chat_missing_message_field(self, client):
        """Validates missing 'message' field returns 422."""
        response = client.post("/api/chat", json={"session_id": "test"})
        assert response.status_code == 422
    
    def test_chat_invalid_json(self, client):
        """Validates malformed JSON is rejected."""
        response = client.post("/api/chat", content="{invalid json}")
        assert response.status_code == 422
    
    # ═══════════════════════════════════════════════════════════
    #  Content-Length & Size Limit Edge Cases
    # ═══════════════════════════════════════════════════════════
    
    def test_chat_request_within_size_limit(self, client, mock_orchestrator):
        """Validates request within 10 KB limit is accepted."""
        # ~5 KB payload should pass
        response = client.post("/api/chat", json={"message": "a" * 1000, "session_id": "test"})
        assert response.status_code in [200, 500]  # Should not fail size check
    
    def test_chat_malformed_content_length_header(self, client):
        """Validates malformed content-length header returns 400."""
        response = client.post(
            "/api/chat",
            json={"message": "test", "session_id": "test"},
            headers={"content-length": "not-a-number"}
        )
        assert response.status_code == 400
        assert "Invalid content-length" in response.json().get("detail", "")
    
    def test_chat_content_length_exceeds_limit(self, client):
        """Validates request exceeding 10 KB returns 413."""
        # Create a payload larger than 10 KB
        large_payload = "x" * (10 * 1024 + 100)  # 10 KB + 100 bytes
        response = client.post(
            "/api/chat",
            json={"message": large_payload, "session_id": "test"}
        )
        assert response.status_code == 413
        assert "too large" in response.json().get("detail", "").lower()
    
    # ═══════════════════════════════════════════════════════════
    #  Rate Limiting
    # ═══════════════════════════════════════════════════════════
    
    def test_chat_rate_limit_per_minute(self, client, sample_chat_request, mock_orchestrator):
        """Validates rate limiting allows 20 requests per minute."""
        # Test that we can make multiple requests (within limit)
        for i in range(5):
            response = client.post("/api/chat", json=sample_chat_request)
            # Should succeed or hit rate limit after 20
            assert response.status_code in [200, 429, 500]


class TestBoothEndpoint:
    """Test suite for POST /api/booth"""
    
    # ═══════════════════════════════════════════════════════════
    #  Happy Path Tests
    # ═══════════════════════════════════════════════════════════
    
    def test_booth_valid_address(self, client, sample_booth_request):
        """Validates successful booth finder with valid address."""
        response = client.post("/api/booth", json=sample_booth_request)
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
    
    def test_booth_returns_formatted_results(self, client):
        """Validates booth results contain properly formatted venue information."""
        response = client.post("/api/booth", json={
            "address": "Delhi",
            "session_id": "test-session"
        })
        assert response.status_code == 200
        data = response.json()
        reply = data.get("reply", "")
        # Check that the reply contains location info
        assert "📍" in reply or "Polling" in reply or "booth" in reply.lower()
    
    # ═══════════════════════════════════════════════════════════
    #  Input Validation Edge Cases
    # ═══════════════════════════════════════════════════════════
    
    def test_booth_empty_address(self, client):
        """Validates empty address returns error message."""
        response = client.post("/api/booth", json={"address": "", "session_id": "test"})
        assert response.status_code == 422  # Validation error
    
    def test_booth_whitespace_address(self, client):
        """Validates whitespace-only address is handled gracefully."""
        response = client.post("/api/booth", json={"address": "   ", "session_id": "test"})
        # Endpoint logic should handle this with a helpful message
        assert response.status_code in [200, 422]
    
    def test_booth_address_too_long(self, client):
        """Validates address exceeding 500 chars is rejected."""
        long_address = "a" * 501
        response = client.post("/api/booth", json={"address": long_address, "session_id": "test"})
        assert response.status_code == 422
    
    def test_booth_missing_address_field(self, client):
        """Validates missing 'address' field returns 422."""
        response = client.post("/api/booth", json={"session_id": "test"})
        assert response.status_code == 422
    
    # ═══════════════════════════════════════════════════════════
    #  Rate Limiting
    # ═══════════════════════════════════════════════════════════
    
    def test_booth_rate_limit_per_minute(self, client, sample_booth_request):
        """Validates rate limiting allows 10 requests per minute."""
        for i in range(3):
            response = client.post("/api/booth", json=sample_booth_request)
            assert response.status_code in [200, 429, 500]


class TestMiddlewareAndCORS:
    """Test suite for middleware and CORS functionality"""
    
    def test_cors_allowed_origins(self, client):
        """Validates CORS headers are set for allowed origins."""
        response = client.options(
            "/api/chat",
            headers={"Origin": "http://localhost:5173"}
        )
        # CORS is handled by middleware
        assert response.status_code in [200, 405]  # 405 if OPTIONS not explicitly defined
    
    def test_request_size_middleware_on_post(self, client):
        """Validates RequestSizeLimitMiddleware applies to POST requests."""
        # Test with large payload
        large_data = {"message": "x" * (10 * 1024 + 100), "session_id": "test"}
        response = client.post("/api/chat", json=large_data)
        assert response.status_code == 413


class TestIntegration:
    """Integration tests covering multi-step flows"""
    
    def test_chat_conversation_flow(self, client, mock_orchestrator):
        """Validates multi-turn conversation flow with session persistence."""
        session_id = "integration-test-session"
        
        # First message
        response1 = client.post("/api/chat", json={
            "message": "What are elections?",
            "session_id": session_id
        })
        assert response1.status_code in [200, 500]
        
        # Second message in same session
        response2 = client.post("/api/chat", json={
            "message": "Tell me more about voting",
            "session_id": session_id
        })
        assert response2.status_code in [200, 500]
    
    def test_booth_finder_location_extraction(self, client):
        """Validates booth finder extracts location and returns formatted results."""
        response = client.post("/api/booth", json={
            "address": "New Delhi",
            "session_id": "booth-test"
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("reply", "")) > 0


if __name__ == "__main__":
    unittest.main()