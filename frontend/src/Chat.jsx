import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Globe,
  Sparkles,
  ArrowRight,
  Vote,
  Scale,
  Landmark,
  Search,
  BookOpen,
  Mic,
  ChevronRight,
} from "lucide-react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Font + Global Styles Injection ────────────────────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  * { box-sizing: border-box; }

  body, #root {
    font-family: 'DM Sans', sans-serif;
    background: #F5F4F0;
  }

  .bb-display { font-family: 'Sora', sans-serif; }

  /* Scrollbar */
  .bb-scroll::-webkit-scrollbar { width: 4px; }
  .bb-scroll::-webkit-scrollbar-track { background: transparent; }
  .bb-scroll::-webkit-scrollbar-thumb { background: #D1CECC; border-radius: 99px; }

  /* Animations */
  @keyframes bb-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bb-scale-in {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes bb-pulse-dot {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes bb-shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  .bb-fade-up { animation: bb-fade-up 0.45s cubic-bezier(.22,.68,0,1.2) both; }
  .bb-scale-in { animation: bb-scale-in 0.3s cubic-bezier(.22,.68,0,1.1) both; }

  .bb-s1 { animation-delay: 0.05s; }
  .bb-s2 { animation-delay: 0.12s; }
  .bb-s3 { animation-delay: 0.19s; }
  .bb-s4 { animation-delay: 0.26s; }
  .bb-s5 { animation-delay: 0.33s; }

  /* Typing dots */
  .bb-dot { width: 7px; height: 7px; border-radius: 50%; background: #B4A9FF; animation: bb-pulse-dot 1.2s infinite ease-in-out; }
  .bb-dot:nth-child(2) { animation-delay: 0.2s; }
  .bb-dot:nth-child(3) { animation-delay: 0.4s; }

  /* Prose overrides for assistant messages */
  .bb-prose p { margin: 0.5rem 0; line-height: 1.7; }
  .bb-prose h1, .bb-prose h2, .bb-prose h3 { font-family: 'Sora', sans-serif; font-weight: 600; margin: 1rem 0 0.4rem; color: #0D1B2A; }
  .bb-prose ul, .bb-prose ol { padding-left: 1.25rem; margin: 0.5rem 0; }
  .bb-prose li { margin: 0.25rem 0; }
  .bb-prose a { color: #7B5CFA; text-decoration: underline; text-underline-offset: 2px; }
  .bb-prose strong { font-weight: 600; color: #0D1B2A; }
  .bb-prose code { background: #EEF0F8; padding: 0.1em 0.4em; border-radius: 4px; font-size: 0.88em; }
  .bb-prose blockquote { border-left: 3px solid #E8E2FF; padding-left: 1rem; color: #6B7A8D; margin: 0.75rem 0; font-style: italic; }
  .bb-prose table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
  .bb-prose th { background: #F0EDFF; padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; }
  .bb-prose td { border-top: 1px solid #EEE; padding: 0.5rem 0.75rem; }

  /* Input textarea reset */
  .bb-textarea { resize: none; outline: none; border: none; background: transparent; width: 100%; font-family: 'DM Sans', sans-serif; }
  .bb-textarea::placeholder { color: #A9A4A0; }

  /* Hover lift */
  .bb-card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .bb-card-hover:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.07); }

  /* Gradient text shimmer on brand text */
  .bb-brand-shimmer {
    background: linear-gradient(90deg, #7B5CFA 0%, #FF6B35 40%, #7B5CFA 80%);
    background-size: 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: bb-shimmer 4s linear infinite;
  }

  /* Pill active */
  .bb-pill-active { background: #0D1B2A; color: #fff; }
  .bb-pill { background: #EDEAE6; color: #5A5550; }
  .bb-pill:hover { background: #E0DDD8; }

  /* Send button */
  .bb-send { background: #0D1B2A; transition: transform 0.15s ease, background 0.15s ease; }
  .bb-send:hover:not(:disabled) { background: #1C2E45; transform: scale(1.04); }
  .bb-send:disabled { opacity: 0.3; cursor: not-allowed; }

  /* Web search toggle */
  .bb-search-on { background: #EEF0FF; color: #7B5CFA; border: 1.5px solid #D3CBFF; }
  .bb-search-off { background: transparent; color: #A09A95; border: 1.5px solid transparent; }
  .bb-search-off:hover { background: #EDEAE6; color: #5A5550; }

  /* Chat surfaces */
  .bb-user-bubble { background: #0D1B2A; color: #F2EFE8; }
  .bb-bot-bubble { background: #FFFFFF; color: #1E293B; border: 1px solid #EAE7E1; }

  /* Suggestion row */
  .bb-suggestion { background: #FFFFFF; border: 1px solid #EAE7E1; transition: background 0.15s, border-color 0.15s, box-shadow 0.15s; }
  .bb-suggestion:hover { background: #FDFBFF; border-color: #D3CBFF; box-shadow: 0 4px 16px rgba(123,92,250,0.08); }
  .bb-suggestion:hover .bb-suggestion-icon { background: #F0EDFF; color: #7B5CFA; }
  .bb-suggestion:hover .bb-suggestion-arrow { color: #7B5CFA; transform: translateX(2px); }
  .bb-suggestion-icon { background: #F2F0EC; color: #7A7470; transition: background 0.15s, color 0.15s; }
  .bb-suggestion-arrow { color: #C8C3BD; transition: color 0.15s, transform 0.15s; }

  /* Input container */
  .bb-input-container { background: #FFFFFF; border: 1.5px solid #E5E2DC; border-radius: 18px; transition: border-color 0.2s, box-shadow 0.2s; }
  .bb-input-container:focus-within { border-color: #C5BAFF; box-shadow: 0 0 0 4px rgba(123,92,250,0.08); }
`;

// ─── Constants ──────────────────────────────────────────────────────────────
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

const PILLS = [
  { label: "Suggested", icon: Sparkles, active: true },
  { label: "Voting", icon: Vote },
  { label: "Legal", icon: Scale },
  { label: "Results", icon: Search },
  { label: "Know ECI", icon: Landmark },
];

// ─── Icon: BharatBot Avatar ─────────────────────────────────────────────────
const BotAvatar = ({ size = 32 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 10,
      background: "linear-gradient(135deg, #EEF0FF 0%, #F8F0FF 100%)",
      border: "1.5px solid #E0D8FF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.52,
      flexShrink: 0,
    }}
  >
    🇮🇳
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Chat({ username = "User" }) {
  // Normalize display name so avatar rendering never crashes on empty input.
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

  // Inject global styles once
  useEffect(() => {
    if (document.getElementById("bb-global-styles")) return;
    const s = document.createElement("style");
    s.id = "bb-global-styles";
    s.textContent = GLOBAL_STYLES;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  const send = async (override) => {
    const text = (override ?? input).trim();
    if (!text || isLoading) return;
    setInput("");
    setMessages((p) => [...p, { id: Date.now(), role: "user", text }]);
    setIsLoading(true);
    try {
      const { data } = await axios.post("/api/chat", {
        message: text,
        session_id: sessionId,
      });
      setMessages((p) => [
        ...p,
        { id: Date.now() + 1, role: "bot", text: data.reply || "No response." },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
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

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ═══ EMPTY STATE ═══════════════════════════════════════════════════════════
  if (!messages.length) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px 32px",
          minHeight: "100vh",
          background: "#F5F4F0",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {/* ── Hero ─────────────────────────────── */}
          <div
            className="bb-fade-up"
            style={{ textAlign: "center", marginBottom: 36 }}
          >
            {/* Logo lockup */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #EEF0FF, #F8F0FF)",
                  border: "1.5px solid #DDD6FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  boxShadow: "0 4px 16px rgba(123,92,250,0.12)",
                }}
              >
                🇮🇳
              </div>
              <div style={{ textAlign: "left" }}>
                <div
                  className="bb-display"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0D1B2A",
                    letterSpacing: "-0.3px",
                  }}
                >
                  BharatBot
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#9B9690",
                    fontWeight: 500,
                    letterSpacing: "0.4px",
                    textTransform: "uppercase",
                  }}
                >
                  Election Assistant
                </div>
              </div>
            </div>

            <h1
              className="bb-display"
              style={{
                fontSize: "clamp(32px, 6vw, 48px)",
                fontWeight: 700,
                color: "#0D1B2A",
                lineHeight: 1.15,
                letterSpacing: "-1px",
                margin: 0,
                marginBottom: 14,
              }}
            >
              Your questions about
              <br />
              <span className="bb-brand-shimmer">Indian elections,</span>{" "}
              answered.
            </h1>
            <p
              style={{
                fontSize: 15.5,
                color: "#7A7470",
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 420,
                marginInline: "auto",
              }}
            >
              Ask anything about voting, candidates, laws, or election results —
              in plain language.
            </p>
          </div>

          {/* ── Input Card ──────────────────────── */}
          <div
            className="bb-fade-up bb-s2 bb-input-container"
            style={{ marginBottom: 12 }}
          >
            <div style={{ padding: "14px 16px 0" }}>
              <textarea
                ref={textareaRef}
                className="bb-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask about voting, elections, laws…"
                rows={1}
                style={{ fontSize: 16, color: "#1E293B", lineHeight: 1.6 }}
                aria-label="Ask a question about Indian elections"
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px 12px",
              }}
            >
              {/* Left controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  title="Voice input"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#A9A4A0",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  aria-label="Voice input disabled"
                  aria-disabled="true"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F2F0EC";
                    e.currentTarget.style.color = "#5A5550";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#A9A4A0";
                  }}
                >
                  <Mic size={16} />
                </button>
                <button
                  type="button"
                  className={webSearch ? "bb-search-on" : "bb-search-off"}
                  onClick={() => setWebSearch((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "DM Sans, sans-serif",
                    transition: "all 0.15s",
                  }}
                  aria-pressed={webSearch}
                  aria-label={
                    webSearch ? "Turn off web search" : "Turn on web search"
                  }
                >
                  <Globe size={14} />
                  Web Search
                </button>
              </div>

              {/* Right controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    color: "#B0AAA4",
                    fontWeight: 500,
                  }}
                >
                  <Sparkles size={12} />
                  Gemini 2.5
                </div>
                <button
                  type="button"
                  className="bb-send"
                  onClick={() => send()}
                  disabled={!input.trim()}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                  aria-label="Send message"
                >
                  <Send size={15} style={{ marginLeft: 1 }} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Category Pills ───────────────────── */}
          <div
            className="bb-fade-up bb-s3"
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              marginBottom: 16,
              paddingBottom: 2,
            }}
          >
            {PILLS.map((p, i) => (
              <button
                key={i}
                type="button"
                className={p.active ? "bb-pill-active" : "bb-pill"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 20,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "DM Sans, sans-serif",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <p.icon size={13} />
                {p.label}
              </button>
            ))}
          </div>

          {/* ── Suggestion Rows ──────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className={`bb-fade-up bb-card-hover bb-suggestion bb-s${i + 3}`}
                onClick={() => send(s.text)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 18px",
                  borderRadius: 14,
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                  textAlign: "left",
                }}
              >
                <div
                  className="bb-suggestion-icon"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <s.icon size={16} />
                </div>

                <span
                  style={{
                    flex: 1,
                    fontSize: 14.5,
                    color: "#3D3A36",
                    fontWeight: 400,
                    lineHeight: 1.4,
                  }}
                >
                  {s.text}
                </span>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "#F2F0EC",
                      color: "#908B86",
                      textTransform: "uppercase",
                      letterSpacing: "0.4px",
                    }}
                  >
                    {s.tag}
                  </span>
                  <ArrowRight size={15} className="bb-suggestion-arrow" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══ ACTIVE CHAT ═══════════════════════════════════════════════════════════
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#F5F4F0",
        fontFamily: "DM Sans, sans-serif",
      }}
    >
      {/* ── Top bar ───────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "#F5F4F0",
          borderBottom: "1px solid #EAE7E1",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BotAvatar size={36} />
          <div>
            <div
              className="bb-display"
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0D1B2A",
                letterSpacing: "-0.2px",
              }}
            >
              BharatBot
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: "#74C98A",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4ADE80",
                  display: "inline-block",
                }}
              />
              Online
            </div>
          </div>
        </div>

        {/* Web search indicator */}
        <button
          type="button"
          className={webSearch ? "bb-search-on" : "bb-search-off"}
          onClick={() => setWebSearch((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "DM Sans, sans-serif",
          }}
          aria-pressed={webSearch}
          aria-label={webSearch ? "Turn off web search" : "Turn on web search"}
        >
          <Globe size={14} />
          {webSearch ? "Web On" : "Web Off"}
        </button>
      </div>

      {/* ── Messages ─────────────────────────────── */}
      <div
        className="bb-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className="bb-fade-up"
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animationDelay: `${idx * 0.025}s`,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                alignItems: "flex-end",
                gap: 10,
                maxWidth: "82%",
              }}
            >
              {/* Avatar */}
              {msg.role === "user" ? (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: "#0D1B2A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#F2EFE8",
                    fontFamily: "Sora, sans-serif",
                    marginBottom: 20,
                  }}
                >
                  {userInitial}
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <BotAvatar size={32} />
                </div>
              )}

              {/* Message group */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#B0AAA4",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    paddingInline: 4,
                  }}
                >
                  {msg.role === "user" ? "You" : "BharatBot"}
                </span>

                <div
                  className={
                    msg.role === "user" ? "bb-user-bubble" : "bb-bot-bubble"
                  }
                  style={{
                    padding: "12px 18px",
                    borderRadius:
                      msg.role === "user"
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
                    fontSize: 15,
                    lineHeight: 1.65,
                    boxShadow:
                      msg.role === "user"
                        ? "0 4px 16px rgba(13,27,42,0.15)"
                        : "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                >
                  {msg.role === "user" ? (
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {msg.text}
                    </p>
                  ) : (
                    <div className="bb-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div
            className="bb-fade-up"
            style={{ display: "flex", alignItems: "flex-end", gap: 10 }}
            aria-live="polite"
            aria-atomic="true"
          >
            <BotAvatar size={32} />
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#B0AAA4",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 4,
                  paddingLeft: 4,
                }}
              >
                BharatBot
              </div>
              <div
                className="bb-bot-bubble"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 18px",
                  borderRadius: "16px 16px 16px 4px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", gap: 5 }}>
                  <div className="bb-dot" />
                  <div className="bb-dot" />
                  <div className="bb-dot" />
                </div>
                <span
                  style={{ fontSize: 13, color: "#A09A95", fontWeight: 500 }}
                >
                  {webSearch ? "Searching the web…" : "Thinking…"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom Input ─────────────────────────── */}
      <div
        style={{
          padding: "12px 20px 20px",
          background: "linear-gradient(to top, #F5F4F0 80%, transparent)",
        }}
      >
        <div
          className="bb-input-container"
          style={{
            padding: "4px 4px 4px 16px",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <textarea
            ref={textareaRef}
            className="bb-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask a follow-up…"
            rows={1}
            style={{
              fontSize: 15,
              color: "#1E293B",
              lineHeight: 1.6,
              paddingBlock: "10px",
              minHeight: 40,
              maxHeight: 140,
            }}
            aria-label="Ask a follow-up question"
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 6px 6px 0",
            }}
          >
            {/* Web toggle */}
            <button
              type="button"
              className={webSearch ? "bb-search-on" : "bb-search-off"}
              onClick={() => setWebSearch((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 10px",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "DM Sans, sans-serif",
              }}
              title={webSearch ? "Web search on" : "Web search off"}
              aria-pressed={webSearch}
              aria-label={
                webSearch ? "Turn off web search" : "Turn on web search"
              }
            >
              <Globe size={14} />
              <span style={{ display: "none" }}>Search</span>
            </button>

            {/* Send */}
            <button
              type="button"
              className="bb-send"
              onClick={() => send()}
              disabled={!input.trim() || isLoading}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
              }}
              aria-label="Send message"
            >
              <Send size={16} style={{ marginLeft: 1 }} />
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <p
          style={{
            textAlign: "center",
            fontSize: 11.5,
            color: "#B0AAA4",
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          BharatBot may make mistakes. Verify important info on{" "}
          <a
            href="https://eci.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#7B5CFA",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            eci.gov.in
          </a>
        </p>
      </div>
    </div>
  );
}
