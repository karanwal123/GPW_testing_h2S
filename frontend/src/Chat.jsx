import React, { useEffect, useRef, useState } from "react";
import { Send, Globe, Sparkles, Vote, Scale, Landmark, BookOpen } from "lucide-react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  trackAPIError,
  trackChatMessageSent,
  trackChatResponseReceived,
} from "./analytics";

const SUGGESTIONS = [
  { icon: Vote, text: "How do I register to vote in India?", tag: "Voting" },
  { icon: Scale, text: "Explain the Model Code of Conduct", tag: "Legal" },
  {
    icon: Landmark,
    text: "What are the functions of the Election Commission?",
    tag: "ECI",
  },
  { icon: BookOpen, text: "Who can contest elections in India?", tag: "Rules" },
];

const FILTERS = ["Suggested", "Voting", "Legal", "Results", "Know ECI"];

function BotAvatar() {
  return (
    <div className="chat-avatar chat-avatar-bot" aria-hidden="true">
      BB
    </div>
  );
}

export default function Chat({ username = "User" }) {
  const safeUsername =
    typeof username === "string" && username.trim() ? username.trim() : "User";
  const userInitial = safeUsername.charAt(0).toUpperCase();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [sessionId] = useState(
    () =>
      `${safeUsername}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [input]);

  const send = async (override) => {
    const text = (override ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text }]);
    setIsLoading(true);
    const startTime = Date.now();
    trackChatMessageSent("user_input", text.length, sessionId);

    try {
      const { data } = await axios.post("/api/chat", {
        message: text,
        session_id: sessionId,
      });
      const responseTime = Date.now() - startTime;
      trackChatResponseReceived(data.intent || "unknown", responseTime);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "bot", text: data.reply || "No response." },
      ]);
    } catch (error) {
      trackAPIError("/api/chat", error.response?.status || 0, error.message);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: "Couldn't reach the server. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  if (!messages.length) {
    return (
      <div className="chat-shell chat-empty-shell">
        <section className="chat-empty">
          <div className="chat-empty-brand">
            <BotAvatar />
            <div>
              <h2>BharatBot</h2>
              <p>Election Assistant</p>
            </div>
          </div>

          <h1>
            Your questions about
            <br />
            Indian elections, answered.
          </h1>
          <p className="chat-empty-copy">
            Ask anything about voting, candidates, laws, or election results in
            plain language.
          </p>

          <div className="chat-composer">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about voting, elections, laws…"
              rows={1}
              aria-label="Ask a question about Indian elections"
            />
            <div className="chat-composer-actions">
              <button
                type="button"
                className={`chat-web-toggle ${webSearch ? "on" : "off"}`}
                onClick={() => setWebSearch((value) => !value)}
                aria-pressed={webSearch}
                aria-label={webSearch ? "Turn off web search" : "Turn on web search"}
              >
                <Globe size={14} />
                Web Search
              </button>
              <button
                type="button"
                className="chat-send"
                onClick={() => send()}
                disabled={!input.trim() || isLoading}
                title="Send"
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          <div className="chat-filters" aria-hidden="true">
            {FILTERS.map((filter, index) => (
              <span key={filter} className={index === 0 ? "active" : ""}>
                {filter}
              </span>
            ))}
          </div>

          <div className="chat-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.text}
                type="button"
                className="chat-suggestion"
                onClick={() => send(suggestion.text)}
              >
                <div className="chat-suggestion-main">
                  <suggestion.icon size={16} />
                  <span>{suggestion.text}</span>
                </div>
                <span className="chat-suggestion-tag">{suggestion.tag}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="chat-shell">
      <header className="chat-header">
        <div className="chat-header-brand">
          <BotAvatar />
          <div>
            <h2>BharatBot</h2>
            <p>Online</p>
          </div>
        </div>
        <button
          type="button"
          className={`chat-web-toggle ${webSearch ? "on" : "off"}`}
          onClick={() => setWebSearch((value) => !value)}
          aria-pressed={webSearch}
          aria-label={webSearch ? "Turn off web search" : "Turn on web search"}
        >
          <Globe size={14} />
          {webSearch ? "Web On" : "Web Off"}
        </button>
      </header>

      <div className="chat-messages" aria-live="polite" aria-relevant="additions text">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-message ${message.role === "user" ? "user" : "bot"}`}
          >
            <div className="chat-avatar">
              {message.role === "user" ? userInitial : <BotAvatar />}
            </div>
            <div className="chat-bubble">
              <span className="chat-author">
                {message.role === "user" ? "You" : "BharatBot"}
              </span>
              {message.role === "user" ? (
                <p>{message.text}</p>
              ) : (
                <div className="chat-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </article>
        ))}

        {isLoading && (
          <article className="chat-message bot">
            <div className="chat-avatar">
              <BotAvatar />
            </div>
            <div className="chat-bubble">
              <span className="chat-author">BharatBot</span>
              <div className="chat-loading">
                <span className="bb-dot" />
                <span className="bb-dot" />
                <span className="bb-dot" />
                <span>{webSearch ? "Searching the web…" : "Thinking…"}</span>
              </div>
            </div>
          </article>
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-footer">
        <div className="chat-composer">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a follow-up…"
            rows={1}
            aria-label="Ask a follow-up question"
          />
          <div className="chat-composer-actions">
            <button
              type="button"
              className={`chat-web-toggle ${webSearch ? "on" : "off"}`}
              onClick={() => setWebSearch((value) => !value)}
              aria-pressed={webSearch}
              aria-label={webSearch ? "Turn off web search" : "Turn on web search"}
            >
              <Globe size={14} />
            </button>
            <button
              type="button"
              className="chat-send"
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        <p className="chat-disclaimer">
          BharatBot may make mistakes. Verify important info on{" "}
          <a href="https://eci.gov.in" target="_blank" rel="noopener noreferrer">
            eci.gov.in
          </a>
        </p>
      </footer>
    </div>
  );
}
