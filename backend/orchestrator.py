"""
Orchestrator Layer for BharatBot
─────────────────────────────────
Handles:
  • Conversation memory (per-session context)
  • NLP-based intent classification via Gemini
  • Entity extraction (states, parties, laws, candidates)
  • Context-aware prompt enrichment
  • Smart routing decisions
"""

import time
import uuid
from collections import defaultdict
from typing import Optional

from vertexai.generative_models import GenerativeModel
import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  Conversation Memory
# ═══════════════════════════════════════════════════════════

class ConversationMemory:
    """In-memory conversation store. Tracks per-session message history,
    extracted entities, and detected topics."""
    
    MAX_HISTORY = 20          # keep last N turns for context
    SESSION_TTL = 3600        # expire after 1 hour of inactivity
    MAX_SESSIONS = 10_000     # cap total sessions to prevent memory exhaustion

    def __init__(self):
        self._sessions: dict = {}

    def _ensure_session(self, session_id: str):
        if session_id not in self._sessions:
            # Evict oldest session if at capacity
            if len(self._sessions) >= self.MAX_SESSIONS:
                self.cleanup_stale()
                # If still at capacity after cleanup, evict the oldest
                if len(self._sessions) >= self.MAX_SESSIONS:
                    oldest = min(self._sessions, key=lambda s: self._sessions[s]["last_active"])
                    del self._sessions[oldest]
            self._sessions[session_id] = {
                "messages": [],
                "entities": {},      # accumulated entities across the conversation
                "topics": [],        # topic trail
                "created_at": time.time(),
                "last_active": time.time(),
            }
        self._sessions[session_id]["last_active"] = time.time()

    def add_message(self, session_id: str, role: str, text: str):
        self._ensure_session(session_id)
        self._sessions[session_id]["messages"].append({
            "role": role,
            "text": text,
            "timestamp": time.time(),
        })
        # Trim to max history
        msgs = self._sessions[session_id]["messages"]
        if len(msgs) > self.MAX_HISTORY:
            self._sessions[session_id]["messages"] = msgs[-self.MAX_HISTORY:]

    def get_history(self, session_id: str) -> list:
        self._ensure_session(session_id)
        return self._sessions[session_id]["messages"]

    def get_context_string(self, session_id: str) -> str:
        """Returns a formatted string of recent conversation for prompt injection."""
        history = self.get_history(session_id)
        if not history:
            return ""
        lines = []
        for msg in history[-10:]:  # last 10 messages for context window
            role_label = "User" if msg["role"] == "user" else "Assistant"
            lines.append(f"{role_label}: {msg['text']}")
        return "\n".join(lines)

    def store_entities(self, session_id: str, entities: dict):
        self._ensure_session(session_id)
        self._sessions[session_id]["entities"].update(entities)

    def get_entities(self, session_id: str) -> dict:
        self._ensure_session(session_id)
        return self._sessions[session_id]["entities"]

    def store_topic(self, session_id: str, topic: str):
        self._ensure_session(session_id)
        topics = self._sessions[session_id]["topics"]
        if not topics or topics[-1] != topic:
            topics.append(topic)
        # Keep last 5 topics
        self._sessions[session_id]["topics"] = topics[-5:]

    def get_topics(self, session_id: str) -> list:
        self._ensure_session(session_id)
        return self._sessions[session_id]["topics"]

    def cleanup_stale(self):
        """Remove expired sessions."""
        now = time.time()
        stale = [sid for sid, s in self._sessions.items()
                 if now - s["last_active"] > self.SESSION_TTL]
        for sid in stale:
            del self._sessions[sid]


# ═══════════════════════════════════════════════════════════
#  NLP Intent Classifier (powered by Gemini)
# ═══════════════════════════════════════════════════════════

CLASSIFICATION_PROMPT = """You are an intent classifier for an Indian Election chatbot. 

Given the user's message and conversation context, classify the intent into EXACTLY ONE of these categories:

- **general**: Broad election questions, news, results, candidates, parties, voting process
- **complex**: Legal/constitutional questions about election laws, acts, EVM technology, court rulings, MCC
- **location**: User is asking to find their polling booth, voting station, or where to vote based on a location/address
- **followup**: A follow-up or clarification to the previous conversation (e.g. "tell me more", "what about X?", "explain that")
- **greeting**: Simple greetings like hi, hello, namaste, thanks
- **out_of_scope**: Questions completely unrelated to Indian elections/politics/governance

Also extract any key entities mentioned. Return your answer in EXACTLY this format (no extra text):

INTENT: <intent>
TOPIC: <1-3 word topic summary>
ENTITIES: state=<if any>, party=<if any>, candidate=<if any>, law=<if any>, address=<if any location/address mentioned>

---
Conversation context:
{context}

User message: {message}"""


class IntentClassifier:
    """Uses Gemini to perform NLP-based intent classification and entity extraction."""

    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model = GenerativeModel(model_name)

    def classify(self, message: str, context: str = "") -> dict:
        """Returns dict with keys: intent, topic, entities"""
        try:
            prompt = CLASSIFICATION_PROMPT.format(
                context=context if context else "(no prior context)",
                message=message
            )
            response = self.model.generate_content(prompt)
            return self._parse_response(response.text)
        except Exception as e:
            logger.warning(f"Intent classification failed, using fallback: {e}", exc_info=True)
            return self._fallback_classify(message)

    def _parse_response(self, text: str) -> dict:
        """Parse the structured classifier output."""
        result = {
            "intent": "general",
            "topic": "elections",
            "entities": {}
        }

        for line in text.strip().split("\n"):
            line = line.strip()
            if line.startswith("INTENT:"):
                intent = line.split(":", 1)[1].strip().lower()
                if intent in ("general", "complex", "location", "followup", "greeting", "out_of_scope"):
                    result["intent"] = intent
            elif line.startswith("TOPIC:"):
                result["topic"] = line.split(":", 1)[1].strip()
            elif line.startswith("ENTITIES:"):
                entity_str = line.split(":", 1)[1].strip()
                for pair in entity_str.split(","):
                    pair = pair.strip()
                    if "=" in pair:
                        key, val = pair.split("=", 1)
                        val = val.strip()
                        if val and val.lower() not in ("none", "n/a", ""):
                            result["entities"][key.strip()] = val

        return result

    def _fallback_classify(self, message: str) -> dict:
        """Keyword-based fallback if Gemini classification fails."""
        msg = message.lower()

        greetings = ["hi", "hello", "namaste", "hey", "thanks", "thank you", "good morning"]
        if any(msg.strip() == g or msg.startswith(g + " ") for g in greetings):
            return {"intent": "greeting", "topic": "greeting", "entities": {}}

        complex_kw = ["representation of the people act", "mcc", "model code of conduct",
                       "evm", "constitution", "legal", "supreme court", "article", "section"]
        if any(kw in msg for kw in complex_kw):
            return {"intent": "complex", "topic": "legal", "entities": {}}

        location_kw = ["booth", "where to vote", "polling station", "find my booth",
                        "nearest booth", "voting center", "where do i vote"]
        if any(kw in msg for kw in location_kw):
            return {"intent": "location", "topic": "booth finder", "entities": {}}

        followup_kw = ["tell me more", "explain", "what about", "elaborate", "why", "how come",
                        "can you clarify", "more details", "go on"]
        if any(kw in msg for kw in followup_kw):
            return {"intent": "followup", "topic": "followup", "entities": {}}

        return {"intent": "general", "topic": "elections", "entities": {}}


# ═══════════════════════════════════════════════════════════
#  Orchestrator — The Brain
# ═══════════════════════════════════════════════════════════

GREETING_RESPONSES = [
    "Namaste! 🇮🇳 I'm BharatBot, your Indian Election Assistant. Ask me anything about elections, voting, candidates, or laws!",
    "Hello! 👋 Ready to help with any election-related questions. What would you like to know?",
    "Hey there! I'm here to help you navigate Indian elections. Fire away! 🗳️",
]

OUT_OF_SCOPE_RESPONSE = (
    "I'm specifically designed to help with **Indian election-related queries** — "
    "voting process, candidates, election laws, results, the Election Commission, etc.\n\n"
    "Could you ask me something related to that? 🇮🇳"
)


class Orchestrator:
    """
    Central decision engine.
    
    Flow:
      1. Receive user message + session_id
      2. Store message in conversation memory
      3. Build context from conversation history
      4. Classify intent using NLP (Gemini)
      5. Extract & store entities
      6. Decide route (greeting / out_of_scope / complex / general / followup)
      7. Enrich prompt with context if needed
      8. Return (enriched_prompt, route, metadata)
    """

    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.memory = ConversationMemory()
        self.classifier = IntentClassifier(model_name)
        self._greeting_index = 0

    def process(self, session_id: str, message: str) -> dict:
        """
        Main entry point.
        
        Returns:
            {
                "route": str,           # "greeting", "out_of_scope", "complex", "general"
                "prompt": str,          # enriched prompt to send to Gemini
                "intent": str,          # raw intent from classifier
                "topic": str,           # detected topic
                "entities": dict,       # extracted entities
                "quick_reply": str|None # if set, skip Gemini and return this directly
            }
        """
        # Cleanup stale sessions periodically
        self.memory.cleanup_stale()

        # 1. Store user message
        self.memory.add_message(session_id, "user", message)

        # 2. Build context
        context = self.memory.get_context_string(session_id)

        # 3. Classify intent via NLP
        classification = self.classifier.classify(message, context)
        intent = classification["intent"]
        topic = classification["topic"]
        entities = classification["entities"]

        # 4. Store entities & topic
        if entities:
            self.memory.store_entities(session_id, entities)
        self.memory.store_topic(session_id, topic)

        # 5. Route decision
        if intent == "greeting":
            reply = GREETING_RESPONSES[self._greeting_index % len(GREETING_RESPONSES)]
            self._greeting_index += 1
            self.memory.add_message(session_id, "assistant", reply)
            return {
                "route": "greeting",
                "prompt": "",
                "intent": intent,
                "topic": topic,
                "entities": entities,
                "quick_reply": reply,
            }

        if intent == "out_of_scope":
            self.memory.add_message(session_id, "assistant", OUT_OF_SCOPE_RESPONSE)
            return {
                "route": "out_of_scope",
                "prompt": "",
                "intent": intent,
                "topic": topic,
                "entities": entities,
                "quick_reply": OUT_OF_SCOPE_RESPONSE,
            }

        # 6. Enrich prompt with context
        enriched_prompt = self._build_enriched_prompt(session_id, message, intent, entities)

        # 7. Determine route
        route = "complex" if intent == "complex" else "general"

        return {
            "route": route,
            "prompt": enriched_prompt,
            "intent": intent,
            "topic": topic,
            "entities": entities,
            "quick_reply": None,
        }

    def store_response(self, session_id: str, response: str):
        """Call this after Gemini responds to store the assistant's reply."""
        self.memory.add_message(session_id, "assistant", response)

    def _build_enriched_prompt(self, session_id: str, message: str,
                                intent: str, new_entities: dict) -> str:
        """Build a context-aware prompt that includes conversation history."""

        parts = []

        # Add conversation context for follow-ups
        history = self.memory.get_history(session_id)
        if len(history) > 1:  # has prior context
            # Get last few exchanges (excluding the current message)
            recent = history[-7:-1]  # last 3 exchanges before current
            if recent:
                context_block = "\n".join(
                    f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['text'][:300]}"
                    for m in recent
                )
                parts.append(f"[Previous conversation for context]\n{context_block}\n")

        # Add accumulated entity context
        all_entities = self.memory.get_entities(session_id)
        if all_entities:
            entity_str = ", ".join(f"{k}: {v}" for k, v in all_entities.items())
            parts.append(f"[Known context — {entity_str}]\n")

        # Add the actual question
        if intent == "followup" and len(history) > 1:
            parts.append(f"[Follow-up question] {message}")
        else:
            parts.append(message)

        return "\n".join(parts)


# ── Singleton instance (created once, reused across requests) ──
_orchestrator_instance: Optional[Orchestrator] = None

def get_orchestrator(model_name: str = "gemini-2.5-flash") -> Orchestrator:
    """Get or create the singleton orchestrator."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = Orchestrator(model_name)
    return _orchestrator_instance
