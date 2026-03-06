
import { useState, useRef, useEffect } from "react";
// render markdown returned by the API in guest mode as well
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { useNavigate, Link } from "react-router-dom";
import LoginModal from "../Login/LoginModal";
import "./guest.css";

function Guest() {
  const [script, setScript] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const textareaRef = useRef(null);
  const messageEndRef = useRef(null); // Added for auto-scroll
  const navigate = useNavigate();

  // 🔹 Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [script]);

  // 🔹 Auto-scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const analyzeScript = async () => {
    if (!script.trim() || loading) return;

    const currentScript = script;
    setMessages((prev) => [...prev, { role: "user", content: currentScript }]);
    setScript("");
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // request markdown output so guest UI also renders correctly
        body: JSON.stringify({ script: currentScript, format: "markdown" }),
      });

      if (!response.ok) throw new Error("Backend not responding");

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.result, // Flask already formats the AI text
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "⚠️ Connection Error. Please ensure the Flask server is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      analyzeScript();
    }
  };

  return (
    <div className="chatgpt-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <Link to="/" className="logo">
            WebScript AI
          </Link>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "➤" : "◀"}
          </button>
        </div>

        {!collapsed && (
          <div className="sidebar-content">
            <div className="guest-badge">Guest Mode</div>
            <button className="login-button" onClick={() => setShowLogin(true)}>
              Log in
            </button>
            <p className="hint">Log in to save analyses and history.</p>
          </div>
        )}
      </aside>

      {/* Chat Area */}
      <main className="chat-area">
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              <div className="bubble">
                {msg.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-message assistant">
              <div className="bubble thinking">Analyzing script…</div>
            </div>
          )}
          {/* 🔹 Scroll Anchor */}
          <div ref={messageEndRef} />
        </div>

        {/* Chat Input */}
        <div className="chat-input">
          <textarea
            ref={textareaRef}
            placeholder="Paste your script here…"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button onClick={analyzeScript} disabled={loading || !script.trim()}>
            ➤
          </button>
        </div>
      </main>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLoginSuccess={() => {
          setShowLogin(false);
          navigate("/ui");
        }}
      />
    </div>
  );
}

export default Guest;
