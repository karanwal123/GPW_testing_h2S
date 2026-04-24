import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

TESTS_ROOT = Path(__file__).resolve().parent
if str(TESTS_ROOT) not in sys.path:
    sys.path.insert(0, str(TESTS_ROOT))

from _stubs import ensure_test_stubs

ensure_test_stubs()

import orchestrator


class FakeClassifier:
    def __init__(self, payload):
        self.payload = payload

    def classify(self, message, context=""):
        return self.payload


class OrchestratorTests(unittest.TestCase):
    def test_parse_response_extracts_intent_and_entities(self):
        with patch.object(orchestrator, "GenerativeModel", autospec=True):
            classifier = orchestrator.IntentClassifier()

        parsed = classifier._parse_response(
            "INTENT: location\nTOPIC: booth finder\nENTITIES: state=Delhi, party=None, address=Connaught Place"
        )

        self.assertEqual(parsed["intent"], "location")
        self.assertEqual(parsed["topic"], "booth finder")
        self.assertEqual(parsed["entities"], {"state": "Delhi", "address": "Connaught Place"})

    def test_process_returns_quick_reply_for_greeting(self):
        orch = orchestrator.Orchestrator()
        orch.classifier = FakeClassifier({"intent": "greeting", "topic": "greeting", "entities": {}})

        result = orch.process("session-1", "hello")

        self.assertEqual(result["route"], "greeting")
        self.assertIsNotNone(result["quick_reply"])
        self.assertIn("BharatBot", result["quick_reply"])

    def test_process_builds_context_for_followup(self):
        orch = orchestrator.Orchestrator()
        orch.classifier = FakeClassifier({"intent": "followup", "topic": "voting", "entities": {"state": "Delhi"}})

        orch.memory.add_message("session-2", "user", "What is voter ID?")
        orch.memory.add_message("session-2", "assistant", "It is an identity document.")

        result = orch.process("session-2", "tell me more")

        self.assertEqual(result["route"], "general")
        self.assertIn("Previous conversation for context", result["prompt"])
        self.assertIn("Known context", result["prompt"])


if __name__ == "__main__":
    unittest.main()