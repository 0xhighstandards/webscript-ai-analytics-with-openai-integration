import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import "../Guest/guest.css";

function UserUI() {
  const [script, setScript] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const [showProfile, setShowProfile] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const [username, setUsername] = useState("User");
  const [avatar, setAvatar] = useState("https://i.pravatar.cc/40");

  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [dropdownChatId, setDropdownChatId] = useState(null);

  const textareaRef = useRef(null);
  const messageEndRef = useRef(null);
  const navigate = useNavigate();

  const storedEmail = localStorage.getItem("user_email");
  const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

  /* ================= LOAD / SAVE DATA ================= */
  useEffect(() => {
    if (!storedEmail) return;

    const storedChats = JSON.parse(localStorage.getItem(`user_chats_${storedEmail}`)) || [];
    setChats(storedChats);
    if (storedChats.length > 0) {
      setActiveChatId(storedChats[0].id);
      setMessages(storedChats[0].messages);
    }

    const profiles = JSON.parse(localStorage.getItem("user_profiles")) || {};
    const profile = profiles[storedEmail];
    if (profile?.username) setUsername(profile.username);
    else setUsername(storedEmail.split("@")[0]);
    if (profile?.avatar) setAvatar(profile.avatar);
  }, [storedEmail]);

  useEffect(() => {
    if (!storedEmail) return;
    localStorage.setItem(`user_chats_${storedEmail}`, JSON.stringify(chats));
  }, [chats, storedEmail]);

  useEffect(() => {
    if (!storedEmail) return;
    const profiles = JSON.parse(localStorage.getItem("user_profiles")) || {};
    profiles[storedEmail] = { username, avatar };
    localStorage.setItem("user_profiles", JSON.stringify(profiles));
  }, [username, avatar, storedEmail]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [script]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ================= CHAT NAVIGATION ================= */
  const startNewChat = () => {
    const newChat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      pinned: false,
      isEditing: false,
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setMessages([]);
  };

  const openChat = (chat) => {
    setActiveChatId(chat.id);
    setMessages(chat.messages);
  };

  const deleteChat = (e, chatId) => {
    e.stopPropagation();
    const updatedChats = chats.filter((chat) => chat.id !== chatId);
    setChats(updatedChats);

    if (chatId === activeChatId) {
      setMessages([]);
      setActiveChatId(null);
    }
  };

  /* ================= ANALYZE SCRIPT ================= */
  const analyzeScript = async () => {
    if (!script.trim() || loading) return;

    let chatId = activeChatId;
    if (!chatId) {
      const newChat = {
        id: crypto.randomUUID(),
        title: "New Chat",
        messages: [],
        pinned: false,
        isEditing: false,
      };
      setChats((prev) => [newChat, ...prev]);
      chatId = newChat.id;
      setActiveChatId(chatId);
      setMessages([]);
    }

    const currentScript = script;
    const userMessage = { role: "user", content: currentScript };
    const updatedMessages = [...(messages || []), userMessage];

    setMessages(updatedMessages);
    setScript("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: currentScript, format: "markdown" }),
      });

      if (!response.ok) throw new Error("Server error");

      const data = await response.json();
      const assistantMessage = { role: "assistant", content: data.result };
      const finalMessages = [...updatedMessages, assistantMessage];

      setMessages(finalMessages);

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: finalMessages,
                title:
                  chat.title === "New Chat"
                    ? currentScript.slice(0, 20) + "..."
                    : chat.title,
              }
            : chat
        )
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Connection Error. Is your Flask server running?" },
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

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    localStorage.removeItem("user_email");
    setChats([]);
    setMessages([]);
    navigate("/");
  };

  /* ================= DROPDOWN POSITIONING ================= */
  const toggleDropdown = (e, chatId) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (dropdownChatId === chatId) setDropdownChatId(null);
    else {
      setDropdownPos({ top: rect.bottom + 5, left: rect.left });
      setDropdownChatId(chatId);
    }
  };

  useEffect(() => {
    if (!dropdownChatId) return;

    const handleDocClick = () => setDropdownChatId(null);
    const handleEsc = (e) => {
      if (e.key === "Escape") setDropdownChatId(null);
    };

    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [dropdownChatId]);

  /* ================= RENDER ================= */
  return (
    <div className="chatgpt-layout">
      {/* SIDEBAR */}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <Link to="/" className="logo">WebScript AI</Link>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "➤" : "◀"}
          </button>
        </div>

        {!collapsed && (
          <>
            <button className="new-chat-btn" onClick={startNewChat}>+ New Chat</button>

            <div className="chat-list">
              {chats
                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                .map((chat) => (
                  <div
                    key={chat.id}
                    className={`chat-item ${chat.id === activeChatId ? "active" : ""}`}
                    onClick={() => openChat(chat)}
                  >
                    {chat.isEditing ? (
                      <input
                        type="text"
                        value={chat.title}
                        onChange={(e) =>
                          setChats((prev) =>
                            prev.map((c) =>
                              c.id === chat.id ? { ...c, title: e.target.value } : c
                            )
                          )
                        }
                        onBlur={() =>
                          setChats((prev) =>
                            prev.map((c) =>
                              c.id === chat.id ? { ...c, isEditing: false } : c
                            )
                          )
                        }
                        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                        autoFocus
                      />
                    ) : (
                      <span className="chat-title">
                        {chat.title}
                        {chat.pinned && <span className="pinned-badge">Pinned</span>}
                      </span>
                    )}

                    <button
                      className="options-btn"
                      onClick={(e) => toggleDropdown(e, chat.id)}
                    >
                      ⋮
                    </button>
                  </div>
                ))}
            </div>

            <div className="sidebar-bottom">
              <button
                className="feedback-button"
                onClick={() => setShowFeedback(true)}
              >
                💬 Feedback
              </button>
              <button className="logout-button" onClick={handleLogout}>
                🔓 Logout
              </button>
            </div>
          </>
        )}
      </aside>

      {/* DROPDOWN */}
      {dropdownChatId && (
        <div
          className="options-dropdown"
          style={{ top: dropdownPos.top, left: dropdownPos.left, position: "fixed" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChats((prev) =>
                prev.map((c) =>
                  c.id === dropdownChatId ? { ...c, isEditing: true } : c
                )
              );
              setDropdownChatId(null);
            }}
          >
            Rename
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setChats((prev) =>
                prev.map((c) =>
                  c.id === dropdownChatId ? { ...c, pinned: !c.pinned } : c
                )
              );
              setDropdownChatId(null);
            }}
          >
            {chats.find(c => c.id === dropdownChatId)?.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={(e) => {
              const chatId = dropdownChatId;
              setDropdownChatId(null);
              deleteChat(e, chatId);
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* MAIN CHAT */}
      <main className="chat-area">
        <div className="top-bar">
          <div className="user-info">
            <img src={avatar} alt="Avatar" className="avatar" />
            <span className="username">{username}</span>
          </div>
          <button className="settings-btn" onClick={() => setShowProfile(true)}>⚙️</button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="bubble">
                {msg.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-message assistant">
              <div className="bubble thinking">Analyzing script...</div>
            </div>
          )}

          <div ref={messageEndRef} />
        </div>

        <div className="chat-input">
          <textarea
            ref={textareaRef}
            placeholder="Paste your code..."
            value={script}
            onChange={(e) => setScript(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button onClick={analyzeScript} disabled={loading}>➤</button>
        </div>
      </main>

      {/* MODALS */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Profile</h2>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="Avatar URL"
            />
            <button onClick={() => setShowProfile(false)}>Save</button>
          </div>
        </div>
      )}

      {showFeedback && (
        <div className="modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Feedback</h2>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Share your thoughts..."
            />
            <button
              onClick={() => {
                setFeedbackText("");
                setShowFeedback(false);
              }}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserUI;