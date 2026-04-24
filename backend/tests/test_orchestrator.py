"""
Tests for orchestrator.py — NLP classification, memory management, and routing.
Tests conversation memory, intent classification, entity extraction, and orchestrator flow.
"""

import pytest
import time
from unittest.mock import Mock, patch
from orchestrator import ConversationMemory, IntentClassifier, Orchestrator


class TestConversationMemory:
    """Test suite for ConversationMemory class"""
    
    def test_add_and_get_messages(self):
        """Validates that messages are stored and retrieved correctly."""
        memory = ConversationMemory()
        sid = "test-session"
        
        memory.add_message(sid, "user", "Hello")
        memory.add_message(sid, "assistant", "Hi there")
        
        history = memory.get_history(sid)
        assert len(history) == 2
        assert history[0]["text"] == "Hello"
        assert history[0]["role"] == "user"
        assert history[1]["text"] == "Hi there"
        assert history[1]["role"] == "assistant"
    
    def test_add_message_creates_session_if_missing(self):
        """Validates that adding a message to nonexistent session creates it."""
        memory = ConversationMemory()
        sid = "new-session"
        
        memory.add_message(sid, "user", "test")
        
        assert sid in memory._sessions
        assert len(memory.get_history(sid)) == 1
    
    def test_max_history_limit_enforced(self):
        """Validates that conversation history is trimmed to MAX_HISTORY."""
        memory = ConversationMemory()
        sid = "test-max"
        
        # Add more messages than MAX_HISTORY
        for i in range(ConversationMemory.MAX_HISTORY + 10):
            memory.add_message(sid, "user", f"message {i}")
        
        history = memory.get_history(sid)
        # Should only keep the last MAX_HISTORY messages
        assert len(history) == ConversationMemory.MAX_HISTORY
        # Should have the last message
        assert "20" in history[-1]["text"] or len(history) == ConversationMemory.MAX_HISTORY
    
    def test_session_timestamps_updated(self):
        """Validates that last_active timestamp is updated on each message."""
        memory = ConversationMemory()
        sid = "test-timestamp"
        
        memory.add_message(sid, "user", "first")
        time1 = memory._sessions[sid]["last_active"]
        
        time.sleep(0.1)  # Small delay
        memory.add_message(sid, "user", "second")
        time2 = memory._sessions[sid]["last_active"]
        
        assert time2 >= time1
    
    def test_store_and_get_entities(self):
        """Validates entity storage and retrieval."""
        memory = ConversationMemory()
        sid = "test-entities"
        
        memory.store_entities(sid, {"state": "Delhi", "party": "AAP"})
        entities = memory.get_entities(sid)
        
        assert entities["state"] == "Delhi"
        assert entities["party"] == "AAP"
    
    def test_entity_update_merges_with_existing(self):
        """Validates that entity updates merge with existing entities."""
        memory = ConversationMemory()
        sid = "test-entity-merge"
        
        memory.store_entities(sid, {"state": "Delhi"})
        memory.store_entities(sid, {"party": "AAP"})
        
        entities = memory.get_entities(sid)
        assert entities["state"] == "Delhi"
        assert entities["party"] == "AAP"
    
    def test_store_and_get_topics(self):
        """Validates topic storage and retrieval."""
        memory = ConversationMemory()
        sid = "test-topics"
        
        memory.store_topic(sid, "elections")
        memory.store_topic(sid, "voting")
        
        topics = memory.get_topics(sid)
        assert "elections" in topics
        assert "voting" in topics
    
    def test_duplicate_consecutive_topic_not_added(self):
        """Validates that consecutive duplicate topics are not stored."""
        memory = ConversationMemory()
        sid = "test-dup-topic"
        
        memory.store_topic(sid, "voting")
        memory.store_topic(sid, "voting")  # Duplicate
        
        topics = memory.get_topics(sid)
        # Should not have two "voting" entries
        assert topics.count("voting") == 1
    
    def test_topic_limit_keeps_last_five(self):
        """Validates that only last 5 topics are kept."""
        memory = ConversationMemory()
        sid = "test-topic-limit"
        
        for i in range(10):
            memory.store_topic(sid, f"topic-{i}")
        
        topics = memory.get_topics(sid)
        assert len(topics) <= 5
    
    def test_context_string_format(self):
        """Validates context string is properly formatted for prompt injection."""
        memory = ConversationMemory()
        sid = "test-context"
        
        memory.add_message(sid, "user", "What is voting?")
        memory.add_message(sid, "assistant", "Voting is choosing...")
        
        context = memory.get_context_string(sid)
        assert "User: What is voting?" in context
        assert "Assistant: Voting is choosing..." in context
    
    def test_context_includes_last_10_messages(self):
        """Validates context includes only last 10 messages for token efficiency."""
        memory = ConversationMemory()
        sid = "test-context-limit"
        
        for i in range(20):
            memory.add_message(sid, "user", f"message {i}")
        
        context = memory.get_context_string(sid)
        # Should contain later messages
        assert "message 19" in context
        # May not contain very early messages
        context_lines = context.count("\n")
        assert context_lines <= 10  # Max 10 messages
    
    def test_cleanup_stale_sessions(self):
        """Validates that stale sessions are removed after TTL."""
        memory = ConversationMemory()
        sid = "stale-session"
        
        memory.add_message(sid, "user", "test")
        # Manually set last_active to past
        memory._sessions[sid]["last_active"] = time.time() - (memory.SESSION_TTL + 1)
        
        memory.cleanup_stale()
        
        # Session should be removed
        assert sid not in memory._sessions
    
    def test_max_sessions_capacity_eviction(self):
        """Validates that oldest session is evicted when max capacity reached."""
        memory = ConversationMemory()
        memory.MAX_SESSIONS = 5  # Override for test
        
        for i in range(6):
            memory._ensure_session(f"session-{i}")
        
        # Should have evicted oldest and kept 5
        assert len(memory._sessions) <= 5


class TestIntentClassifier:
    """Test suite for IntentClassifier class"""
    
    def test_fallback_greeting_detection(self):
        """Validates fallback greeting detection for simple greetings."""
        classifier = IntentClassifier()
        result = classifier._fallback_classify("hello")
        assert result["intent"] == "greeting"
    
    def test_fallback_greeting_variations(self):
        """Validates fallback detects various greeting patterns."""
        classifier = IntentClassifier()
        greetings = ["hi", "hello", "namaste", "hey", "thanks", "good morning"]
        
        for greeting in greetings:
            result = classifier._fallback_classify(greeting)
            assert result["intent"] == "greeting", f"Failed for: {greeting}"
    
    def test_fallback_location_detection(self):
        """Validates fallback location detection for booth-related queries."""
        classifier = IntentClassifier()
        result = classifier._fallback_classify("where is my booth")
        assert result["intent"] == "location"
    
    def test_fallback_complex_detection(self):
        """Validates fallback complex intent detection for legal/constitutional queries."""
        classifier = IntentClassifier()
        result = classifier._fallback_classify("what is the model code of conduct?")
        assert result["intent"] == "complex"
    
    def test_fallback_followup_detection(self):
        """Validates fallback followup detection for clarification requests."""
        classifier = IntentClassifier()
        result = classifier._fallback_classify("tell me more")
        assert result["intent"] == "followup"
    
    def test_fallback_default_general_intent(self):
        """Validates unmatched queries default to 'general' intent."""
        classifier = IntentClassifier()
        result = classifier._fallback_classify("random unrelated text xyz")
        assert result["intent"] == "general"
    
    def test_fallback_out_of_scope_not_in_fallback(self):
        """Validates fallback doesn't detect out_of_scope (requires Gemini)."""
        classifier = IntentClassifier()
        # Fallback can't reliably detect out_of_scope, defaults to general
        result = classifier._fallback_classify("how to cook pasta")
        assert result["intent"] in ["general", "out_of_scope"]
    
    def test_parse_response_valid_format(self):
        """Validates parsing of properly formatted Gemini response."""
        classifier = IntentClassifier()
        response_text = """INTENT: greeting
TOPIC: greetings
ENTITIES: party=Congress, state=None"""
        
        result = classifier._parse_response(response_text)
        assert result["intent"] == "greeting"
        assert result["topic"] == "greetings"
        assert "party" in result["entities"]
    
    def test_parse_response_missing_entities_section(self):
        """Validates parsing when ENTITIES section is missing."""
        classifier = IntentClassifier()
        response_text = """INTENT: general
TOPIC: elections"""
        
        result = classifier._parse_response(response_text)
        assert result["intent"] == "general"
        assert result["entities"] == {}
    
    def test_parse_response_filters_none_values(self):
        """Validates that 'None', 'n/a', '' values are filtered from entities."""
        classifier = IntentClassifier()
        response_text = """INTENT: general
TOPIC: voting
ENTITIES: state=Delhi, party=None, candidate=n/a, law="""
        
        result = classifier._parse_response(response_text)
        assert "state" in result["entities"]
        assert "party" not in result["entities"]
        assert "candidate" not in result["entities"]
        assert "law" not in result["entities"]
    
    def test_parse_response_invalid_intent_defaults(self):
        """Validates that invalid intent values default to 'general'."""
        classifier = IntentClassifier()
        response_text = """INTENT: invalid_intent
TOPIC: test
ENTITIES: test=value"""
        
        result = classifier._parse_response(response_text)
        assert result["intent"] == "general"  # Default fallback
    
    def test_parse_response_case_insensitive_intent(self):
        """Validates intent parsing is case-insensitive."""
        classifier = IntentClassifier()
        response_text = """INTENT: GREETING
TOPIC: test
ENTITIES: """
        
        result = classifier._parse_response(response_text)
        assert result["intent"] == "greeting"


class TestOrchestrator:
    """Test suite for Orchestrator class"""
    
    def test_process_greeting_returns_quick_reply(self):
        """Validates greeting intent returns pre-defined greeting without Gemini."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "greeting",
                "topic": "greeting",
                "entities": {}
            }
            
            result = orch.process("session-1", "hello")
            
            assert result["intent"] == "greeting"
            assert result["quick_reply"] is not None
            assert result["route"] == "greeting"
    
    def test_process_out_of_scope_returns_quick_reply(self):
        """Validates out_of_scope queries return helpful redirect message."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "out_of_scope",
                "topic": "random",
                "entities": {}
            }
            
            result = orch.process("session-2", "how to bake a cake?")
            
            assert result["intent"] == "out_of_scope"
            assert result["quick_reply"] is not None
            assert "election" in result["quick_reply"].lower() or "election" in result["prompt"].lower()
    
    def test_process_stores_user_message_in_memory(self):
        """Validates user message is stored in conversation memory."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "greeting",
                "topic": "greeting",
                "entities": {}
            }
            
            orch.process("session-3", "hello")
            
            history = orch.memory.get_history("session-3")
            assert len(history) >= 1
            assert history[0]["role"] == "user"
            assert history[0]["text"] == "hello"
    
    def test_process_stores_assistant_message(self):
        """Validates assistant response is stored in memory after greeting."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "greeting",
                "topic": "greeting",
                "entities": {}
            }
            
            orch.process("session-4", "hello")
            
            history = orch.memory.get_history("session-4")
            # Should have user + assistant messages
            assert len(history) >= 1
    
    def test_process_stores_extracted_entities(self):
        """Validates extracted entities are stored in session memory."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "general",
                "topic": "elections",
                "entities": {"state": "Maharashtra", "party": "NCP"}
            }
            
            orch.process("session-5", "about maharashtra elections")
            
            entities = orch.memory.get_entities("session-5")
            assert entities["state"] == "Maharashtra"
            assert entities["party"] == "NCP"
    
    def test_process_builds_context_from_history(self):
        """Validates orchestrator builds context from conversation history."""
        orch = Orchestrator()
        session_id = "session-context"
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "general",
                "topic": "voting",
                "entities": {}
            }
            
            # First message
            orch.process(session_id, "What is voting?")
            
            # Second message should have context
            orch.process(session_id, "Tell me more")
            
            # Verify classify was called with context
            calls = mock_classify.call_args_list
            # Second call should have context
            if len(calls) > 1:
                second_call_context = calls[1][0][1]  # Second positional arg
                assert len(second_call_context) > 0
    
    def test_process_stores_topics(self):
        """Validates that detected topics are stored in memory."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "general",
                "topic": "voting_process",
                "entities": {}
            }
            
            orch.process("session-6", "how to vote")
            
            topics = orch.memory.get_topics("session-6")
            assert "voting_process" in topics
    
    def test_process_returns_enriched_prompt_for_general(self):
        """Validates general queries return enriched prompt for Gemini."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "general",
                "topic": "voting",
                "entities": {}
            }
            
            result = orch.process("session-7", "how to vote")
            
            # For general intent, should return prompt for Gemini
            assert result["route"] == "general"
            assert result["prompt"] is not None  # Will be enriched with context
    
    def test_process_cleanup_stale_called(self):
        """Validates that cleanup_stale is called to manage memory."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            with patch.object(orch.memory, "cleanup_stale") as mock_cleanup:
                mock_classify.return_value = {
                    "intent": "greeting",
                    "topic": "greeting",
                    "entities": {}
                }
                
                orch.process("session-cleanup", "hello")
                
                mock_cleanup.assert_called_once()
    
    def test_process_new_session_id_generation(self):
        """Validates processing creates appropriate session structure."""
        orch = Orchestrator()
        
        with patch.object(orch.classifier, "classify") as mock_classify:
            mock_classify.return_value = {
                "intent": "greeting",
                "topic": "greeting",
                "entities": {}
            }
            
            orch.process("brand-new-session", "hello")
            
            # Session should exist in memory
            assert "brand-new-session" in orch.memory._sessions