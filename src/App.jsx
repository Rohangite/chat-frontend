import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = "https://chat-backend-dpgv.onrender.com";

// ─── HELPERS ─────────────────────────────────────────
const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const getAvatar = (name) =>
  name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// ─── AUTH PAGE ───────────────────────────────────────
function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: "", email: "", password: "" });

  const handleSubmit = async () => {
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    onLogin(data.user);
  };

  return (
    <div style={{ padding: 40 }}>
      {!isLogin && (
        <input placeholder="username" onChange={(e) => setForm({ ...form, username: e.target.value })} />
      )}
      <input placeholder="email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="password" type="password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button onClick={handleSubmit}>{isLogin ? "Login" : "Register"}</button>
      <button onClick={() => setIsLogin(!isLogin)}>Switch</button>
    </div>
  );
}

// ─── CHAT APP ────────────────────────────────────────
function ChatApp({ currentUser, onLogout }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputText, setInputText] = useState("");
  const [socket, setSocket] = useState(null);

  // USERS
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/users`)
      .then((res) => res.json())
      .then(setUsers);
  }, []);

  // SOCKET
  useEffect(() => {
    const s = io(BACKEND_URL);

    s.on("connect", () => {
      setSocket(s);
      s.emit("user_online", currentUser._id);
    });

    s.on("receive_message", (msg) => {
      const chatId =
        msg.sender_id === currentUser._id
          ? msg.receiver_id
          : msg.sender_id;

      setMessages((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), msg],
      }));
    });

    return () => s.disconnect();
  }, [currentUser]);

  // FETCH MESSAGES
  useEffect(() => {
    if (!selectedUser) return;

    fetch(`${BACKEND_URL}/api/messages/${selectedUser._id}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages((prev) => ({
          ...prev,
          [selectedUser._id]: data,
        }));
      });
  }, [selectedUser]);

  // SEND MESSAGE
  const sendMessage = () => {
    if (!inputText || !socket || !selectedUser) return;

    const msg = {
      sender_id: currentUser._id,
      receiver_id: selectedUser._id,
      text: inputText,
    };

    socket.emit("send_message", msg);

    setMessages((prev) => ({
      ...prev,
      [selectedUser._id]: [...(prev[selectedUser._id] || []), msg],
    }));

    setInputText("");
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* USERS */}
      <div style={{ width: 250, borderRight: "1px solid gray" }}>
        {users.map((u) => (
          <div key={u._id} onClick={() => setSelectedUser(u)}>
            {u.username}
          </div>
        ))}
      </div>

      {/* CHAT */}
      <div style={{ flex: 1 }}>
        {selectedUser && (
          <>
            <div>
              {(messages[selectedUser._id] || []).map((m, i) => (
                <div key={i}>
                  <b>{m.sender_id === currentUser._id ? "Me" : "Them"}:</b> {m.text}
                </div>
              ))}
            </div>

            <input value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <button onClick={sendMessage}>Send</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user")));

  return user ? (
    <ChatApp currentUser={user} onLogout={() => setUser(null)} />
  ) : (
    <AuthPage onLogin={setUser} />
  );
}