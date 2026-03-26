import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = "https://chat-backend-dpgv.onrender.com";

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { font-family: 'Inter', sans-serif; background: #F0F2F5; color: #1a1a1a; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 2px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

  .fade-in { animation: fadeIn 0.3s ease both; }
  .slide-in { animation: slideIn 0.2s ease both; }

  .input-field {
    width: 100%; padding: 11px 16px;
    border: 1.5px solid #E2E8F0; border-radius: 10px;
    font-size: 14px; font-family: 'Inter', sans-serif;
    color: #1a1a1a; background: white; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .input-field:focus {
    border-color: #2563EB;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }

  .btn-primary {
    background: #2563EB; color: white; border: none;
    padding: 11px 24px; border-radius: 10px;
    font-size: 14px; font-weight: 600;
    font-family: 'Inter', sans-serif; cursor: pointer;
    transition: all 0.2s; width: 100%;
  }
  .btn-primary:hover { background: #1D4ED8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .spinner {
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white; border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  .msg-bubble {
    max-width: 68%; padding: 10px 14px;
    border-radius: 18px; font-size: 14px;
    line-height: 1.5; word-break: break-word;
    position: relative; animation: fadeIn 0.2s ease;
  }
  .msg-sent {
    background: #2563EB; color: white;
    border-bottom-right-radius: 4px;
    margin-left: auto;
  }
  .msg-recv {
    background: white; color: #1a1a1a;
    border-bottom-left-radius: 4px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }

  .user-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; cursor: pointer;
    border-radius: 12px; transition: background 0.15s;
    margin: 2px 8px;
  }
  .user-item:hover { background: #F1F5F9; }
  .user-item.active { background: #EFF6FF; }

  .reaction-btn {
    background: none; border: none; cursor: pointer;
    font-size: 16px; padding: 4px 6px; border-radius: 8px;
    transition: transform 0.15s, background 0.15s;
    line-height: 1;
  }
  .reaction-btn:hover { transform: scale(1.3); background: #F1F5F9; }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .sidebar.show { display: flex !important; }
    .chat-area { width: 100% !important; }
  }
`;

// ─── MOCK DATA ────────────────────────────────────────────────────────────────


let mockMessages = {
  "u1": [
    { _id: "m1", sender_id: "u1", text: "Hey! How are you?", timestamp: new Date(Date.now() - 3600000), status: "read", reactions: [] },
    { _id: "m2", sender_id: "me", text: "I'm great! Working on a new project 🚀", timestamp: new Date(Date.now() - 3500000), status: "read", reactions: [{ emoji: "❤️", from: "u1" }] },
    { _id: "m3", sender_id: "u1", text: "That sounds exciting! What kind of project?", timestamp: new Date(Date.now() - 3400000), status: "read", reactions: [] },
    { _id: "m4", sender_id: "me", text: "A chat app actually 😄", timestamp: new Date(Date.now() - 3300000), status: "delivered", reactions: [] },
  ],
  "u2": [
    { _id: "m5", sender_id: "u2", text: "Did you see the match last night?", timestamp: new Date(Date.now() - 7200000), status: "read", reactions: [] },
    { _id: "m6", sender_id: "me", text: "Yes! Amazing game 🏏", timestamp: new Date(Date.now() - 7100000), status: "read", reactions: [{ emoji: "👍", from: "u2" }] },
  ],
  "u3": [],
  "u4": [],
  "u5": [
    { _id: "m7", sender_id: "u5", text: "Can we catch up this weekend?", timestamp: new Date(Date.now() - 1800000), status: "read", reactions: [] },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const getAvatar = (name) => name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

const AVATAR_COLORS = ["#2563EB", "#7C3AED", "#DB2777", "#059669", "#D97706", "#DC2626", "#0891B2"];
const getAvatarColor = (id) => AVATAR_COLORS[id?.charCodeAt(1) % AVATAR_COLORS.length] || "#2563EB";

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 40, showOnline = false }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: getAvatarColor(user?._id || user?.id),
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontSize: size * 0.35, fontWeight: 700,
      }}>{getAvatar(user?.username) || "?"}</div>
      {showOnline && (
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28,
          borderRadius: "50%", background: user?.is_online ? "#22C55E" : "#94A3B8",
          border: "2px solid white",
        }}/>
      )}
    </div>
  );
}

// ─── STATUS TICKS ─────────────────────────────────────────────────────────────
function StatusTick({ status }) {
  if (status === "sent") return <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>✓</span>;
  if (status === "delivered") return <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>✓✓</span>;
  if (status === "read") return <span style={{ fontSize: 11, color: "#93C5FD" }}>✓✓</span>;
  return null;
}

// ─── LOGIN / REGISTER PAGE ────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.email || !form.password) { setError("Please fill all fields"); return; }
    if (!isLogin && !form.username) { setError("Username is required"); return; }
    setLoading(true); setError("");
    try {
  const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

const res = await fetch(`https://chat-backend-dpgv.onrender.com${endpoint}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: form.email, password: form.password, username: form.username }),
});

const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) {
      // Demo mode fallback
     
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)",
      padding: 24,
    }}>
      <div className="fade-in" style={{ background: "white", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(37,99,235,0.12)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 26 }}>💬</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a" }}>ChatApp</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>{isLogin ? "Sign in to continue" : "Create your account"}</p>
        </div>

        {!isLogin && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Username</label>
            <input className="input-field" placeholder="Your name" value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))}/>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Email</label>
          <input className="input-field" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}/>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
          <input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}/>
        </div>

        {error && <p style={{ fontSize: 13, color: "#EF4444", marginBottom: 14, background: "#FEF2F2", padding: "8px 12px", borderRadius: 8 }}>⚠ {error}</p>}

        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><div className="spinner"/> Loading...</span> : (isLogin ? "Sign In →" : "Create Account →")}
        </button>

        <p style={{ textAlign: "center", fontSize: 14, color: "#64748B", marginTop: 20 }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(""); }} style={{ color: "#2563EB", fontWeight: 600, cursor: "pointer" }}>
            {isLogin ? "Sign Up" : "Sign In"}
          </span>
        </p>

        <div style={{ marginTop: 20, padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, fontSize: 12, color: "#64748B", textAlign: "center" }}>
          💡 Demo mode: Enter any email/password to try
        </div>
      </div>
    </div>
  );
}

// ─── MAIN CHAT APP ────────────────────────────────────────────────────────────
function ChatApp({ currentUser, onLogout }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputText, setInputText] = useState("");
  const [socket, setSocket] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showReaction, setShowReaction] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);

   useEffect(() => {
  fetch("https://chat-backend-dpgv.onrender.com/api/users")
    .then(res => res.json())
    .then(data => setUsers(data))
    .catch(err => console.log(err));
}, []);

  // Initialize with mock messages


  // Socket connection
  useEffect(() => {
  try {
    const s = io(BACKEND_URL, {
      auth: { token: localStorage.getItem("token") },
      timeout: 3000,
    });

    s.on("connect", () => {
      console.log("Socket connected");
      setSocket(s);
      s.emit("user_online", currentUser._id);
    });

    s.on("receive_message", (msg) => {
      console.log("Received:", msg);

      const chatId =
        msg.sender_id === currentUser._id
          ? msg.receiver_id
          : msg.sender_id;

      setMessages(prev => ({
        ...prev,
        [chatId]: [
          ...(prev[chatId] || []),
          msg,
        ],
      }));
    });

    // keep your other events BELOW this (if any)
    s.on("user_status", ({ userId, is_online }) => {
      setUsers(prev =>
        prev.map(u =>
          u._id === userId ? { ...u, is_online } : u
        )
      );
    });

    return () => s.disconnect();

  } catch (err) {
    console.log(err);
  }
}, [currentUser]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser]);

  // Mark as read when opening chat
  useEffect(() => {
    if (selectedUser && socket) {
      socket.emit("message_read", { chatUserId: selectedUser._id });
    }
  }, [selectedUser]);

  const sendMessage = () => {
    if (!inputText.trim() && !imagePreview) return;
    if (!selectedUser) return;

    const msg = {
      _id: `msg_${Date.now()}`,
      sender_id: "me",
      receiver_id: selectedUser._id,
      text: inputText.trim(),
      image_url: imagePreview,
      timestamp: new Date(),
      status: "sent",
      reactions: [],
    };

    // Add to local state
  const sendMessage = () => {
  if (!inputText.trim() || !socket || !selectedUser) return;

  const msg = {
    _id: Date.now(),
    sender_id: currentUser._id,
    receiver_id: selectedUser._id,
    text: inputText,
  };

  socket.emit("send_message", msg);

  setMessages(prev => ({
    ...prev,
    [selectedUser._id]: [
      ...(prev[selectedUser._id] || []),
      msg,
    ],
  }));

  setInputText("");
};

    // Emit via socket
    if (socket?.connected) {
      socket.emit("send_message", msg);
    }

    setInputText(""); setImagePreview(null);

    // Simulate reply after 2-4 seconds
    if (selectedUser.is_online) {
      setTimeout(() => {
        const replies = [
          "That's interesting! 😊",
          "Got it! Thanks 👍",
          "Sure, sounds good!",
          "Haha yes absolutely! 😄",
          "Let me check and get back to you",
          "Okay! 👌",
        ];
        const reply = {
          _id: `msg_${Date.now()}_r`,
          sender_id: selectedUser._id,
          receiver_id: "me",
          text: replies[Math.floor(Math.random() * replies.length)],
          timestamp: new Date(),
          status: "delivered",
          reactions: [],
        };
        setMessages(prev => ({
          ...prev,
          [selectedUser._id]: [...(prev[selectedUser._id] || []), reply],
        }));
      }, 1500 + Math.random() * 2000);
    }
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);
    if (socket?.connected && selectedUser) {
      socket.emit("typing", { to: selectedUser._id });
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const addReaction = (msgId, emoji) => {
    if (!selectedUser) return;
    setMessages(prev => ({
      ...prev,
      [selectedUser._id]: (prev[selectedUser._id] || []).map(m =>
        m._id === msgId ? {
          ...m,
          reactions: m.reactions.some(r => r.from === "me")
            ? m.reactions.map(r => r.from === "me" ? {...r, emoji} : r)
            : [...m.reactions, { emoji, from: "me" }]
        } : m
      ),
    }));
    setShowReaction(null);
  };

  const deleteMessage = (msgId) => {
    if (!selectedUser) return;
    setMessages(prev => ({
      ...prev,
      [selectedUser._id]: (prev[selectedUser._id] || []).map(m =>
        m._id === msgId ? {...m, text: "🚫 This message was deleted", deleted: true, image_url: null} : m
      ),
    }));
  };

  const currentMessages = selectedUser ? (messages[selectedUser._id] || []) : [];
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()));

  // Group messages by date
  const groupedMessages = currentMessages.reduce((groups, msg) => {
    const date = formatDate(msg.timestamp);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  const getLastMessage = (userId) => {
    const msgs = messages[userId] || [];
    return msgs[msgs.length - 1];
  };

  const getUnreadCount = (userId) => {
    return (messages[userId] || []).filter(m => m.sender_id === userId && m.status !== "read").length;
  };

  return (
    <div style={{ height: "100vh", display: "flex", background: "#F0F2F5", overflow: "hidden" }}>
      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <div className="sidebar" style={{
        width: 340, background: "white", display: "flex", flexDirection: "column",
        borderRight: "1px solid #E2E8F0", flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar user={currentUser} size={38} showOnline/>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{currentUser.username}</div>
                <div style={{ fontSize: 12, color: "#22C55E", fontWeight: 500 }}>● Online</div>
              </div>
            </div>
            <button onClick={onLogout} style={{ background: "#FEF2F2", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#EF4444", fontWeight: 600 }}>
              Logout
            </button>
          </div>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#94A3B8" }}>🔍</span>
            <input className="input-field" placeholder="Search conversations..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 36, fontSize: 13, background: "#F8FAFC" }}/>
          </div>
        </div>

        {/* User list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", padding: "8px 24px 4px", letterSpacing: 1, textTransform: "uppercase" }}>
            Messages
          </div>
          {filteredUsers.map(user => {
            const lastMsg = getLastMessage(user._id);
            const unread = getUnreadCount(user._id);
            return (
              <div key={user._id} className={`user-item ${selectedUser?._id === user._id ? "active" : ""}`}
                onClick={() => { setSelectedUser(user); setShowSidebar(false); }}>
                <Avatar user={user} size={46} showOnline/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{user.username}</span>
                    {lastMsg && <span style={{ fontSize: 11, color: "#94A3B8" }}>{formatTime(lastMsg.timestamp)}</span>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 13, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                      {lastMsg ? (lastMsg.sender_id === "me" ? "You: " : "") + (lastMsg.image_url ? "📷 Photo" : lastMsg.text) : "Start a conversation"}
                    </span>
                    {unread > 0 && (
                      <span style={{ background: "#2563EB", color: "white", fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CHAT AREA ─────────────────────────────────────────────────────── */}
      <div className="chat-area" style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F0F2F5", minWidth: 0 }}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div style={{ background: "white", padding: "12px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <Avatar user={selectedUser} size={42} showOnline/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{selectedUser.username}</div>
                <div style={{ fontSize: 12, color: selectedUser.is_online ? "#22C55E" : "#94A3B8", fontWeight: 500 }}>
                  {typing ? <span style={{ animation: "pulse 1s infinite" }}>typing...</span> : selectedUser.is_online ? "● Online" : "● Offline"}
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                {["📞", "📹", "⋯"].map(icon => (
                  <button key={icon} style={{ background: "#F8FAFC", border: "none", borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
                    onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}
                  >{icon}</button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 4 }}
              onClick={() => setShowReaction(null)}>
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "#E2E8F0" }}/>
                    <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, background: "#F0F2F5", padding: "2px 10px", borderRadius: 10 }}>{date}</span>
                    <div style={{ flex: 1, height: 1, background: "#E2E8F0" }}/>
                  </div>

                  {msgs.map((msg, i) => {
                    const isSent = msg.sender_id === "me";
                    return (
                      <div key={msg._id} style={{ display: "flex", flexDirection: "column", alignItems: isSent ? "flex-end" : "flex-start", marginBottom: 4, position: "relative" }}
                        onMouseEnter={() => !msg.deleted && setShowReaction(msg._id)}
                        onMouseLeave={() => setShowReaction(null)}>

                        {/* Reaction popup */}
                        {showReaction === msg._id && !msg.deleted && (
                          <div style={{
                            position: "absolute", [isSent ? "left" : "right"]: "100%",
                            top: "50%", transform: "translateY(-50%)",
                            background: "white", borderRadius: 20, padding: "6px 10px",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                            display: "flex", gap: 4, zIndex: 10,
                            animation: "fadeIn 0.15s ease",
                            marginLeft: isSent ? 0 : 8, marginRight: isSent ? 8 : 0,
                          }} onClick={e => e.stopPropagation()}>
                            {["👍", "❤️", "😂"].map(emoji => (
                              <button key={emoji} className="reaction-btn" onClick={() => addReaction(msg._id, emoji)}>{emoji}</button>
                            ))}
                            {isSent && !msg.deleted && (
                              <button className="reaction-btn" onClick={() => deleteMessage(msg._id)} style={{ fontSize: 14 }}>🗑️</button>
                            )}
                          </div>
                        )}

                        <div className={`msg-bubble ${isSent ? "msg-sent" : "msg-recv"}`} style={{ opacity: msg.deleted ? 0.6 : 1, fontStyle: msg.deleted ? "italic" : "normal" }}>
                          {/* Image */}
                          {msg.image_url && !msg.deleted && (
                            <img src={msg.image_url} alt="shared" style={{ maxWidth: 240, maxHeight: 200, borderRadius: 10, display: "block", marginBottom: msg.text ? 6 : 0, objectFit: "cover" }}/>
                          )}
                          {/* Text */}
                          {msg.text && <span>{msg.text}</span>}
                          {/* Time + status */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                            <span style={{ fontSize: 10, opacity: 0.7 }}>{formatTime(msg.timestamp)}</span>
                            {isSent && <StatusTick status={msg.status}/>}
                          </div>
                        </div>

                        {/* Reactions display */}
                        {msg.reactions?.length > 0 && (
                          <div style={{ display: "flex", gap: 2, marginTop: 3, background: "white", borderRadius: 20, padding: "2px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", fontSize: 13 }}>
                            {msg.reactions.map((r, ri) => <span key={ri}>{r.emoji}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {currentMessages.length === 0 && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8", gap: 12, padding: 40 }}>
                  <div style={{ fontSize: 56 }}>💬</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#475569" }}>No messages yet</p>
                  <p style={{ fontSize: 14 }}>Say hi to {selectedUser.username}!</p>
                </div>
              )}

              {/* Typing indicator */}
              {typing && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <Avatar user={selectedUser} size={28}/>
                  <div className="msg-bubble msg-recv" style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#94A3B8", animation: `pulse 1s ${i * 0.2}s infinite` }}/>)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Image Preview */}
            {imagePreview && (
              <div style={{ padding: "8px 20px", background: "white", borderTop: "1px solid #E2E8F0", display: "flex", gap: 12, alignItems: "center" }}>
                <img src={imagePreview} alt="preview" style={{ height: 60, width: 60, objectFit: "cover", borderRadius: 8 }}/>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>Image ready to send</p>
                  <p style={{ fontSize: 12, color: "#64748B" }}>Click send to share</p>
                </div>
                <button onClick={() => setImagePreview(null)} style={{ background: "#FEF2F2", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "#EF4444", fontWeight: 600, fontSize: 13 }}>✕ Remove</button>
              </div>
            )}

            {/* Input */}
            <div style={{ background: "white", padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Image upload */}
              <button onClick={() => fileRef.current?.click()} style={{ background: "#F8FAFC", border: "none", borderRadius: 10, width: 42, height: 42, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
                onMouseLeave={e => e.currentTarget.style.background = "#F8FAFC"}
              >{uploading ? <div className="spinner" style={{ borderTopColor: "#2563EB", borderColor: "#E2E8F0" }}/> : "📎"}</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload}/>

              {/* Emoji button */}
              <button style={{ background: "#F8FAFC", border: "none", borderRadius: 10, width: 42, height: 42, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>😊</button>

              {/* Text input */}
              <input className="input-field" placeholder="Type a message..." value={inputText} onChange={handleTyping}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                style={{ background: "#F8FAFC", borderRadius: 24, padding: "11px 18px" }}/>

              {/* Send button */}
              <button onClick={sendMessage} disabled={!inputText.trim() && !imagePreview} style={{
                background: inputText.trim() || imagePreview ? "#2563EB" : "#E2E8F0",
                border: "none", borderRadius: 12, width: 42, height: 42,
                cursor: inputText.trim() || imagePreview ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0, transition: "all 0.2s",
                transform: inputText.trim() || imagePreview ? "scale(1)" : "scale(0.95)",
              }}>
                <span style={{ transform: "rotate(45deg)", display: "block", marginLeft: -2 }}>✈️</span>
              </button>
            </div>
          </>
        ) : (
          /* No chat selected */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8", gap: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>💬</div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Welcome to ChatApp</p>
              <p style={{ fontSize: 14, color: "#94A3B8" }}>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });

  const handleLogin = (user) => setCurrentUser(user);
  const handleLogout = () => { localStorage.clear(); setCurrentUser(null); };

  return (
    <>
      <style>{globalStyles}</style>
      {currentUser ? (
        <ChatApp currentUser={currentUser} onLogout={handleLogout}/>
      ) : (
        <AuthPage onLogin={handleLogin}/>
      )}
    </>
  );
}
