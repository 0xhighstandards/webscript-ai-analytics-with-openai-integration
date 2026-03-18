import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import PageLoader from "../PageLoader/PageLoader";
import "../Guest/guest.css";

function UserUI() {
  const [script, setScript] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const [showProfile, setShowProfile] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const [username, setUsername] = useState("User");
  const [avatar, setAvatar] = useState("https://i.pravatar.cc/40");

  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [dropdownChatId, setDropdownChatId] = useState(null);

  // ← NEW: track if we're on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const textareaRef = useRef(null);
  const messageEndRef = useRef(null);
  const lineChartRef = useRef(null);
  const donutChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartInstance = useRef(null);
  const donutChartInstance = useRef(null);
  const barChartInstance = useRef(null);

  const navigate = useNavigate();
  const storedEmail = localStorage.getItem("user_email");
  const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

  /* ================= PAGE LOADER ================= */
  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  /* ================= MOBILE DETECTION ================= */
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Auto-collapse sidebar on mobile
      if (mobile) setCollapsed(true);
      else setCollapsed(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  /* ================= ANALYTICS CALCULATIONS ================= */
  const computeAnalytics = useCallback(() => {
    const allMessages = chats.flatMap((c) => c.messages || []);
    const userMessages = allMessages.filter((m) => m.role === "user");
    const totalAnalyses = userMessages.length;

    const languageCounts = {};
    chats.forEach((chat) => {
      (chat.languages || []).forEach((lang) => {
        if (
          lang &&
          lang !== "Unknown" &&
          lang !== "Not a valid script" &&
          lang !== "Not a valid programming script."
        ) {
          languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        }
      });
    });

    const dayCounts = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    chats.forEach((chat) => {
      if (chat.createdAt) {
        const day = dayNames[new Date(chat.createdAt).getDay()];
        dayCounts[day]++;
      }
    });

    const recentChats = [...chats]
      .filter((c) => c.createdAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-7);
    const timeLabels = recentChats.map((c) =>
      new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    const timeCounts = recentChats.map((c) =>
      (c.messages || []).filter((m) => m.role === "user").length
    );

    return { totalAnalyses, languageCounts, dayCounts, timeLabels, timeCounts };
  }, [chats]);

  /* ================= DRAW CHARTS ================= */
  useEffect(() => {
    if (!showAnalytics) return;

    const initCharts = () => {
      const analytics = computeAnalytics();
      const Chart = window.Chart;

      const commonFont = { family: "'Inter', sans-serif", size: 11 };
      const gridColor = "rgba(255,255,255,0.06)";
      const labelColor = "#94a3b8";

      if (lineChartInstance.current) lineChartInstance.current.destroy();
      if (donutChartInstance.current) donutChartInstance.current.destroy();
      if (barChartInstance.current) barChartInstance.current.destroy();

      // DONUT CHART — Most Used Languages
      if (donutChartRef.current) {
        const langLabels = Object.keys(analytics.languageCounts);
        const langData = Object.values(analytics.languageCounts);
        const isSingle = langLabels.length <= 1;

        const palette = [
          "#4fd1c5", "#38b2ac", "#0f6e56", "#22c55e",
          "#a0aec0", "#2c5364", "#81e6d9", "#e6fffa",
        ];

        donutChartInstance.current = new Chart(donutChartRef.current, {
          type: "doughnut",
          data: {
            labels: langLabels.length > 0 ? langLabels : ["No data"],
            datasets: [{
              data: langData.length > 0 ? langData : [1],
              backgroundColor: langLabels.length > 0
                ? palette.slice(0, langLabels.length)
                : ["rgba(255,255,255,0.05)"],
              borderWidth: isSingle ? 0 : 2,
              borderColor: "#203a43",
              borderRadius: isSingle ? 0 : 4,
            }],
          },
          options: {
            responsive: true,
            cutout: "65%",
            plugins: {
              legend: {
                display: true,
                position: "bottom",
                labels: {
                  color: "#cbd5f5",
                  font: { family: "'Inter', sans-serif", size: 12 },
                  boxWidth: 12,
                  padding: 16,
                  generateLabels: (chart) => {
                    return chart.data.labels.map((label, i) => ({
                      text: label.length > 25 ? label.slice(0, 25) + "…" : label,
                      fillStyle: chart.data.datasets[0].backgroundColor[i],
                      strokeStyle: "transparent",
                      hidden: false,
                      index: i,
                      fontColor: "#cbd5f5",
                      color: "#cbd5f5",
                    }));
                  },
                },
              },
              tooltip: {
                bodyFont: commonFont,
                titleFont: commonFont,
              },
            },
          },
        });
      }

      // LINE CHART — Analyses Over Time
      if (lineChartRef.current) {
        lineChartInstance.current = new Chart(lineChartRef.current, {
          type: "line",
          data: {
            labels: analytics.timeLabels.length > 0 ? analytics.timeLabels : ["No data"],
            datasets: [{
              label: "Analyses",
              data: analytics.timeCounts.length > 0 ? analytics.timeCounts : [0],
              borderColor: "#4fd1c5",
              backgroundColor: "rgba(79,209,197,0.12)",
              borderWidth: 2,
              pointBackgroundColor: "#4fd1c5",
              pointRadius: 4,
              tension: 0.4,
              fill: true,
            }],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              tooltip: { bodyFont: commonFont, titleFont: commonFont },
            },
            scales: {
              x: { ticks: { color: labelColor, font: commonFont }, grid: { color: gridColor } },
              y: { ticks: { color: labelColor, font: commonFont, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
            },
          },
        });
      }

      // BAR CHART — Activity by Day
      if (barChartRef.current) {
        barChartInstance.current = new Chart(barChartRef.current, {
          type: "bar",
          data: {
            labels: Object.keys(analytics.dayCounts),
            datasets: [{
              label: "Sessions",
              data: Object.values(analytics.dayCounts),
              backgroundColor: "rgba(79,209,197,0.6)",
              borderColor: "#4fd1c5",
              borderWidth: 1,
              borderRadius: 6,
              hoverBackgroundColor: "#38b2ac",
            }],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              tooltip: { bodyFont: commonFont, titleFont: commonFont },
            },
            scales: {
              x: { ticks: { color: labelColor, font: commonFont }, grid: { color: gridColor } },
              y: { ticks: { color: labelColor, font: commonFont, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
            },
          },
        });
      }
    };

    if (window.Chart) {
      initCharts();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      script.onload = initCharts;
      document.head.appendChild(script);
    }

    return () => {
      if (lineChartInstance.current) lineChartInstance.current.destroy();
      if (donutChartInstance.current) donutChartInstance.current.destroy();
      if (barChartInstance.current) barChartInstance.current.destroy();
    };
  }, [showAnalytics, computeAnalytics]);

  /* ================= CHAT NAVIGATION ================= */
  const startNewChat = () => {
    const newChat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      languages: [],
      pinned: false,
      isEditing: false,
      createdAt: new Date().toISOString(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setMessages([]);
  };

  const openChat = (chat) => {
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    // Close sidebar on mobile after selecting a chat
    if (isMobile) setCollapsed(true);
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
        languages: [],
        pinned: false,
        isEditing: false,
        createdAt: new Date().toISOString(),
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

      const detectedLanguage = data.language || "Unknown";
      const isValidLanguage =
        detectedLanguage !== "Unknown" &&
        detectedLanguage !== "Not a valid script" &&
        detectedLanguage !== "Not a valid programming script.";

      setMessages(finalMessages);
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: finalMessages,
                languages: isValidLanguage
                  ? [...(chat.languages || []), detectedLanguage]
                  : chat.languages || [],
                title: chat.title === "New Chat" ? currentScript.slice(0, 20) + "..." : chat.title,
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

  /* ================= DROPDOWN ================= */
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
    const handleEsc = (e) => { if (e.key === "Escape") setDropdownChatId(null); };
    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [dropdownChatId]);

  const analytics = computeAnalytics();

  /* ================= RENDER ================= */
  return (
    <div className="chatgpt-layout">
      <PageLoader visible={pageLoading} />

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

            {/* Hide chat list on mobile */}
            {!isMobile && (
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
                          onChange={(e) => setChats((prev) => prev.map((c) => c.id === chat.id ? { ...c, title: e.target.value } : c))}
                          onBlur={() => setChats((prev) => prev.map((c) => c.id === chat.id ? { ...c, isEditing: false } : c))}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          autoFocus
                        />
                      ) : (
                        <span className="chat-title">
                          {chat.title}
                          {chat.pinned && <span className="pinned-badge">Pinned</span>}
                        </span>
                      )}
                      <button className="options-btn" onClick={(e) => toggleDropdown(e, chat.id)}>⋮</button>
                    </div>
                  ))}
              </div>
            )}

            <div className="sidebar-bottom">
              <button className="analytics-button" onClick={() => setShowAnalytics(true)}>📊 Analytics</button>
              <button className="feedback-button" onClick={() => setShowFeedback(true)}>💬 Feedback</button>
              <button className="logout-button" onClick={handleLogout}>🔓 Logout</button>
            </div>
          </>
        )}
      </aside>

      {/* DROPDOWN */}
      {dropdownChatId && (
        <div className="options-dropdown" style={{ top: dropdownPos.top, left: dropdownPos.left, position: "fixed" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={(e) => { e.stopPropagation(); setChats((prev) => prev.map((c) => c.id === dropdownChatId ? { ...c, isEditing: true } : c)); setDropdownChatId(null); }}>Rename</button>
          <button onClick={(e) => { e.stopPropagation(); setChats((prev) => prev.map((c) => c.id === dropdownChatId ? { ...c, pinned: !c.pinned } : c)); setDropdownChatId(null); }}>
            {chats.find(c => c.id === dropdownChatId)?.pinned ? "Unpin" : "Pin"}
          </button>
          <button onClick={(e) => { const chatId = dropdownChatId; setDropdownChatId(null); deleteChat(e, chatId); }}>Delete</button>
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
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
          <textarea ref={textareaRef} placeholder="Paste your code..." value={script} onChange={(e) => setScript(e.target.value)} onKeyDown={handleKeyDown} rows={1} disabled={loading} />
          <button onClick={analyzeScript} disabled={loading}>➤</button>
        </div>
      </main>

      {/* ANALYTICS MODAL */}
      {showAnalytics && (
        <div className="modal-overlay" onClick={() => setShowAnalytics(false)}>
          <div className="analytics-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Your Analytics</h2>

            <div className="analytics-row analytics-row-center">
              <div className="analytics-section analytics-section-donut">
                <p className="analytics-section-title">Most Used Languages</p>
                {Object.keys(analytics.languageCounts).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 13 }}>
                    No language data yet — analyze some scripts first!
                  </div>
                ) : (
                  <div className="analytics-donut-wrap">
                    <canvas ref={donutChartRef} />
                  </div>
                )}
              </div>
            </div>

            <div className="analytics-row analytics-row-split">
              <div className="analytics-section analytics-section-half">
                <p className="analytics-section-title">Analyses Over Time</p>
                <div className="analytics-chart-wrap">
                  <canvas ref={lineChartRef} />
                </div>
              </div>

              <div className="analytics-section analytics-section-half">
                <p className="analytics-section-title">Activity by Day</p>
                <div className="analytics-chart-wrap">
                  <canvas ref={barChartRef} />
                </div>
              </div>
            </div>

            <button className="analytics-close-btn" onClick={() => setShowAnalytics(false)}>Close</button>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Profile</h2>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
            <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="Avatar URL" />
            <button onClick={() => setShowProfile(false)}>Save</button>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {showFeedback && (
        <div className="modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Feedback</h2>
            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Share your thoughts..." />
            <button onClick={() => { setFeedbackText(""); setShowFeedback(false); }}>Submit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserUI;