import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

TESTS_ROOT = Path(__file__).resolve().parent
if str(TESTS_ROOT) not in sys.path:
    sys.path.insert(0, str(TESTS_ROOT))

from _stubs import ensure_test_stubs

ensure_test_stubs()

import main


class FakeOrchestrator:
    def __init__(self, decision):
        self.decision = decision
        self.stored = []

    def process(self, session_id, message):
        return self.decision

    def store_response(self, session_id, response):
        self.stored.append((session_id, response))


class FakeMaps:
    def geocode(self, address):
        return [{"geometry": {"location": {"lat": 28.63, "lng": 77.21}}, "formatted_address": "Connaught Place, New Delhi"}]

    def places_nearby(self, location, radius, keyword):
        return {
            "results": [
                {
                    "name": "Community Hall",
                    "vicinity": "Connaught Place",
                    "geometry": {"location": {"lat": 28.63, "lng": 77.21}},
                }
            ]
        }


class MainTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_check_reports_google_service_state(self):
        with patch.object(main, "vertex_initialized", True), patch.object(main, "gmaps", object()):
            result = await main.health_check()

        self.assertEqual(result["status"], "ok")
        self.assertTrue(result["vertex_initialized"])
        self.assertTrue(result["maps_initialized"])

    async def test_chat_endpoint_returns_quick_reply(self):
        decision = {"quick_reply": "Hello", "intent": "greeting", "topic": "greeting", "entities": {}, "prompt": "", "route": "greeting"}
        fake_orch = FakeOrchestrator(decision)

        with patch.object(main, "vertex_initialized", True), patch.object(main, "get_orchestrator", return_value=fake_orch):
            result = await main.chat_endpoint(SimpleNamespace(headers={"content-length": "10"}, method="POST"), main.ChatRequest(message="hello", session_id="abc"))

        self.assertEqual(result["reply"], "Hello")
        self.assertEqual(result["intent"], "greeting")

    async def test_chat_endpoint_location_route_uses_maps(self):
        decision = {"quick_reply": None, "intent": "location", "topic": "booth finder", "entities": {"address": "Connaught Place"}, "prompt": "", "route": "general"}
        fake_orch = FakeOrchestrator(decision)

        with patch.object(main, "vertex_initialized", True), patch.object(main, "gmaps", FakeMaps()), patch.object(main, "get_orchestrator", return_value=fake_orch):
            result = await main.chat_endpoint(SimpleNamespace(headers={"content-length": "10"}, method="POST"), main.ChatRequest(message="find my booth near Connaught Place", session_id="abc"))

        self.assertEqual(result["intent"], "location")
        self.assertIn("Open in Google Maps", result["reply"])

    async def test_request_size_limit_rejects_large_payload(self):
        async def next_handler(request):
            return {"ok": True}

        middleware = main.RequestSizeLimitMiddleware(app=main.app)
        request = SimpleNamespace(method="POST", headers={"content-length": str(main.MAX_REQUEST_BODY_BYTES + 1)})

        response = await middleware.dispatch(request, next_handler)

        self.assertEqual(response.status_code, 413)

    async def test_request_size_limit_rejects_invalid_content_length(self):
        async def next_handler(request):
            return {"ok": True}

        middleware = main.RequestSizeLimitMiddleware(app=main.app)
        request = SimpleNamespace(method="POST", headers={"content-length": "not-a-number"})

        response = await middleware.dispatch(request, next_handler)

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()