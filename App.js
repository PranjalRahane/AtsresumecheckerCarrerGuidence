import axios from "axios";
import "./App.css";
import { useState, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:8001";

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ════════════════════════════════════════════════════════════════════════════
//  AUTH PAGE
// ════════════════════════════════════════════════════════════════════════════
function AuthPage({ onLogin }) {
  const [mode, setMode]     = useState("login");
  const [form, setForm]     = useState({ name: "", email: "", password: "", confirm: "" });
  const [msg,  setMsg]      = useState({ text: "", ok: false });
  const [busy, setBusy]     = useState(false);
  const [showPw, setShowPw] = useState(false);

  const field = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const info  = (text, ok = false) => setMsg({ text, ok });

  const stableOnLogin = useCallback(onLogin, [onLogin]);

  useEffect(() => {
    if (!window.google || mode === "forgot") return;
    const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
    if (GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") return;
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setBusy(true);
          try {
            const res = await axios.post(`${API}/auth/google`, { credential });
            localStorage.setItem("token", res.data.access_token);
            localStorage.setItem("user", JSON.stringify({ name: res.data.name, email: res.data.email }));
            stableOnLogin(res.data.access_token);
          } catch (e) {
            info(e.response?.data?.detail || "Google login failed");
          }
          setBusy(false);
        },
      });
      const gBtn = document.getElementById("g-btn");
      if (gBtn) window.google.accounts.id.renderButton(gBtn, { theme: "filled_black", size: "large", width: 340 });
    } catch (error) {
      console.error("Failed to initialize Google auth:", error);
    }
  }, [mode, stableOnLogin]);

  const submit = async () => {
    setMsg({ text: "", ok: false });
    setBusy(true);
    try {
      if (mode === "forgot") {
        await axios.post(`${API}/forgot-password`, { email: form.email });
        info("Reset link sent! Check your inbox.", true);
        setBusy(false);
        return;
      }
      if (mode === "signup") {
        if (form.password !== form.confirm) { info("Passwords don't match"); setBusy(false); return; }
        if (form.password.length < 6) { info("Password must be at least 6 characters"); setBusy(false); return; }
        await axios.post(`${API}/register`, { name: form.name, email: form.email, password: form.password });
        info("Account created! You can now log in.", true);
        setBusy(false);
        return;
      }
      const params = new URLSearchParams();
      params.append("username", form.email);
      params.append("password", form.password);
      const res = await axios.post(`${API}/login`, params);
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user", JSON.stringify({ name: res.data.name, email: res.data.email }));
      stableOnLogin(res.data.access_token);
    } catch (e) {
      info(e.response?.data?.detail || "Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  const titles = { login: "Welcome back", signup: "Create account", forgot: "Reset password" };
  const subs   = { login: "Sign in to your ATS Checker account", signup: "Start analysing your resume for free", forgot: "Enter your email to receive a reset link" };

  return (
    <div className="auth-bg">
      <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
      <div className="auth-card">
        <div className="brand"><div className="brand-icon">⚡</div><span className="brand-name">ATS Checker</span></div>
        <h1 className="auth-heading">{titles[mode]}</h1>
        <p className="auth-sub">{subs[mode]}</p>
        {mode !== "forgot" && (
          <div className="tabs">
            {["login","signup"].map(m => (
              <button key={m} className={`tab ${mode===m?"active":""}`}
                onClick={() => { setMode(m); setMsg({ text:"", ok:false }); }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>
        )}
        <div className="form">
          {mode === "signup" && <Field label="Full Name" name="name" placeholder="Jane Doe" value={form.name} onChange={field} />}
          <Field label="Email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={field} />
          {mode !== "forgot" && (
            <div className="field">
              <label>Password</label>
              <div className="pw-wrap">
                <input name="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={field} />
                <button className="eye" type="button" onClick={() => setShowPw(v => !v)}>{showPw ? "🙈" : "👁️"}</button>
              </div>
            </div>
          )}
          {mode === "signup" && <Field label="Confirm Password" name="confirm" type="password" placeholder="••••••••" value={form.confirm} onChange={field} />}
          {msg.text && <div className={`flash ${msg.ok ? "flash-ok" : "flash-err"}`}>{msg.ok ? "✅" : "⚠️"} {msg.text}</div>}
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <span className="spinner" /> : (mode === "login" ? "Log In →" : mode === "signup" ? "Create Account →" : "Send Reset Link →")}
          </button>
          {mode !== "forgot" && (<><div className="or"><span>or</span></div><div id="g-btn" className="g-btn-wrap" /></>)}
          <div className="auth-links">
            {mode === "login" && (<>
              <button className="link-btn" onClick={() => { setMode("forgot"); setMsg({text:"",ok:false}); }}>Forgot password?</button>
              <button className="link-btn" onClick={() => { setMode("signup"); setMsg({text:"",ok:false}); }}>No account? Sign Up</button>
            </>)}
            {(mode === "signup" || mode === "forgot") && (
              <button className="link-btn" onClick={() => { setMode("login"); setMsg({text:"",ok:false}); }}>← Back to Log In</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, type="text", placeholder, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input name={name} type={type} placeholder={placeholder} value={value} onChange={onChange} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function Dashboard({ token, onLogout }) {
  const [file,     setFile]     = useState(null);
  const [result,   setResult]   = useState(null);
  const [roadmap,  setRoadmap]  = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapErr,     setRoadmapErr]     = useState("");
  const [history,  setHistory]  = useState([]);
  const [tab,      setTab]      = useState("analyze");
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState("");
  const [showDel,  setShowDel]  = useState(false);

  let user = {};
  try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch { user = {}; }

  useEffect(() => {
    if (token) {
      axios.get(`${API}/analyses`, { headers: authHeader(token) })
        .then(r => setHistory(r.data.analyses))
        .catch(fetchErr => console.error("Failed to load history:", fetchErr));
    }
  }, [token, result]);

  const analyze = async () => {
    if (!file) return alert("Select a PDF or DOCX first");
    setBusy(true);
    setErr("");
    setResult(null);
    setRoadmap(null);
    setRoadmapErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/analyze`, fd, { headers: authHeader(token) });
      setResult(res.data);
      setTab("analyze");
    } catch (e) {
      if (e.response?.status === 401) onLogout();
      else setErr(e.response?.data?.detail || "Analysis failed. Please try again.");
    }
    setBusy(false);
  };

  const fetchRoadmap = async () => {
    if (!result) return;
    setRoadmapLoading(true);
    setRoadmapErr("");
    setRoadmap(null);
    try {
      const res = await axios.post(
        `${API}/roadmap`,
        { missing_skills: result.missing_skills, score: result.score, filename: file?.name || "resume" },
        { headers: authHeader(token) }
      );
      setRoadmap(res.data);
    } catch (e) {
      if (e.response?.status === 401) onLogout();
      else setRoadmapErr(e.response?.data?.detail || "Failed to generate roadmap. Try again.");
    }
    setRoadmapLoading(false);
  };

  const deleteAccount = async () => {
    try {
      await axios.delete(`${API}/me`, { headers: authHeader(token) });
      onLogout();
    } catch (e) {
      alert("Failed to delete account. Please try again.");
    }
  };

  return (
    <div className="dash">
      <aside className="sidebar">
        <div className="sb-brand">⚡ ATS</div>
        <nav className="sb-nav">
          <button className={tab === "analyze" ? "sb-item active" : "sb-item"} onClick={() => setTab("analyze")}>📄 Analyze</button>
          <button className={tab === "history" ? "sb-item active" : "sb-item"} onClick={() => setTab("history")}>🕒 History</button>
        </nav>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="sb-avatar">{(user.name || "U")[0].toUpperCase()}</div>
            <div>
              <div className="sb-name">{user.name || "User"}</div>
              <div className="sb-email">{user.email || ""}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>Log Out</button>
          <button className="del-btn" onClick={() => setShowDel(true)}>Delete Account</button>
        </div>
      </aside>

      <main className="dash-main">
        {/* ── ANALYZE TAB ── */}
        {tab === "analyze" && (
          <div className="panel">
            <h2 className="panel-title">Analyze Resume</h2>
            <p className="panel-sub">Upload a PDF or DOCX and get your ATS score instantly.</p>

            <div className="upload-area" onClick={() => document.getElementById("file-inp").click()}>
              <input id="file-inp" type="file" accept=".pdf,.docx" style={{ display:"none" }}
                onChange={e => { setFile(e.target.files[0]); setResult(null); setRoadmap(null); }} />
              {file
                ? <><span className="upload-icon">📄</span><span className="upload-name">{file.name}</span></>
                : <><span className="upload-icon">☁️</span><span className="upload-hint">Click to choose file</span></>
              }
            </div>

            <button className="btn-primary" onClick={analyze} disabled={busy}>
              {busy ? <><span className="spinner" /> Analyzing…</> : "Analyze Resume →"}
            </button>

            {err && <div className="flash flash-err">⚠️ {err}</div>}

            {/* ── Score Result ── */}
            {result && (
              <>
                <ScoreCard data={result} />

                {/* ── Career Roadmap Button ── */}
                <div style={{ marginTop: 24, borderTop: "1px solid #2a2a2a", paddingTop: 24 }}>
                  <h3 style={{ color: "#fff", marginBottom: 6 }}>🗺️ Career Recommendation & Roadmap</h3>
                  <p style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>
                    Let AI analyze your results and suggest careers, skill gaps, and a personalized learning path.
                  </p>
                  {!roadmap && !roadmapLoading && (
                    <button className="btn-primary" onClick={fetchRoadmap} style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                      ✨ Generate Career Roadmap
                    </button>
                  )}
                  {roadmapLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#aaa" }}>
                      <span className="spinner" /> Generating your personalized roadmap…
                    </div>
                  )}
                  {roadmapErr && <div className="flash flash-err">⚠️ {roadmapErr}</div>}
                  {roadmap && <RoadmapCard data={roadmap} onRegenerate={fetchRoadmap} />}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="panel">
            <h2 className="panel-title">Past Analyses</h2>
            <p className="panel-sub">Your last 20 resume analyses — newest first.</p>
            {history.length === 0
              ? <div className="empty-state">No analyses yet. Upload a resume to get started!</div>
              : <div className="history-list">
                  {history.map((h, i) => (
                    <div className="history-card" key={i}>
                      <div className="hc-left">
                        <span className="hc-file">📄 {h.filename}</span>
                        <span className="hc-date">
                          {new Date(h.analyzed_at.endsWith("Z") ? h.analyzed_at : h.analyzed_at + "Z").toLocaleString()}
                        </span>
                      </div>
                      <div className="hc-right">
                        <ScoreBadge score={h.score} />
                        <span className="hc-msg">{h.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}
      </main>

      {showDel && (
        <div className="modal-bg">
          <div className="modal">
            <h3>Delete Account?</h3>
            <p>This permanently deletes your account and all resume history. This cannot be undone.</p>
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowDel(false)}>Cancel</button>
              <button className="btn-danger" onClick={deleteAccount}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  CAREER ROADMAP CARD
// ════════════════════════════════════════════════════════════════════════════
function RoadmapCard({ data, onRegenerate }) {
  const [openSection, setOpenSection] = useState("careers");

  const toggle = (s) => setOpenSection(prev => prev === s ? null : s);

  const priorityColor = (p) =>
    p === "High" ? "#ef4444" : p === "Medium" ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ marginTop: 20, background: "#111", borderRadius: 16, border: "1px solid #2a2a2a", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #1e1b4b, #1e1240)", borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>🎯 Best Career Match</div>
            <div style={{ color: "#a78bfa", fontSize: 20, fontWeight: 800, marginTop: 4 }}>{data.top_career}</div>
          </div>
          <button onClick={onRegenerate}
            style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", color: "#aaa", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
            🔄 Regenerate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a2a2a" }}>
        {[
          { key: "careers",   label: "🎯 Careers" },
          { key: "gaps",      label: "🔧 Skill Gaps" },
          { key: "roadmap",   label: "🗺️ Roadmap" },
          { key: "resources", label: "📚 Resources" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => toggle(key)}
            style={{
              flex: 1, padding: "12px 4px", background: openSection === key ? "#1e1b4b" : "transparent",
              border: "none", color: openSection === key ? "#a78bfa" : "#666",
              fontWeight: openSection === key ? 700 : 400, cursor: "pointer", fontSize: 13,
              borderBottom: openSection === key ? "2px solid #7c3aed" : "2px solid transparent"
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>

        {/* Suggested Careers */}
        {openSection === "careers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(data.suggested_careers || []).map((c, i) => (
              <div key={i} style={{ background: "#1a1a1a", borderRadius: 12, padding: 16, border: "1px solid #2a2a2a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ color: "#fff", fontWeight: 700 }}>{c.title}</span>
                  <span style={{ background: "#14532d", color: "#86efac", padding: "2px 10px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{c.match}</span>
                </div>
                <p style={{ color: "#888", fontSize: 13, margin: 0 }}>{c.reason}</p>
              </div>
            ))}
          </div>
        )}

        {/* Skill Gaps */}
        {openSection === "gaps" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(data.skill_gaps || []).map((g, i) => (
              <div key={i} style={{ background: "#1a1a1a", borderRadius: 12, padding: 14, border: "1px solid #2a2a2a", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ background: priorityColor(g.priority) + "22", color: priorityColor(g.priority), padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {g.priority}
                </span>
                <div>
                  <div style={{ color: "#fff", fontWeight: 600, marginBottom: 2 }}>{g.skill}</div>
                  <div style={{ color: "#888", fontSize: 13 }}>{g.why}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Learning Roadmap */}
        {openSection === "roadmap" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {(data.learning_roadmap || []).map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 20, position: "relative" }}>
                {/* connector line */}
                {i < data.learning_roadmap.length - 1 && (
                  <div style={{ position: "absolute", left: 19, top: 40, width: 2, height: "calc(100% - 20px)", background: "#2a2a2a" }} />
                )}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                  {step.step}
                </div>
                <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 14, border: "1px solid #2a2a2a", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "#fff", fontWeight: 700 }}>{step.title}</span>
                    <span style={{ color: "#7c3aed", fontSize: 12 }}>⏱ {step.duration}</span>
                  </div>
                  <p style={{ color: "#888", fontSize: 13, margin: 0 }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resources */}
        {openSection === "resources" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(data.recommended_resources || []).map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer"
                style={{ background: "#1a1a1a", borderRadius: 12, padding: 14, border: "1px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 600, marginBottom: 2 }}>{r.name}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>{r.type}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {r.free && <span style={{ background: "#14532d", color: "#86efac", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>FREE</span>}
                  <span style={{ color: "#7c3aed", fontSize: 18 }}>→</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SCORE CARD
// ════════════════════════════════════════════════════════════════════════════
function ScoreCard({ data }) {
  const color = data.score > 80 ? "#22c55e" : data.score > 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="score-card">
      <div className="score-ring" style={{ "--c": color }}>
        <span className="score-num">{data.score}</span>
        <span className="score-unit">/ 100</span>
      </div>
      <p className="score-verdict" style={{ color }}>{data.message}</p>
      <div className="sections">
        <Section title="Missing Skills" items={data.missing_skills} emoji="🔧" empty="All key skills present!" />
        <Section title="Grammar Issues" items={data.grammar_issues} emoji="✍️" empty="No grammar issues!" />
        <Section title="Format Issues"  items={data.format_issues}  emoji="📐" empty="Format looks great!" />
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const bg = score > 80 ? "#14532d" : score > 60 ? "#451a03" : "#450a0a";
  const c  = score > 80 ? "#86efac" : score > 60 ? "#fde68a" : "#fca5a5";
  return (
    <span style={{ background: bg, color: c, padding: "4px 12px", borderRadius: 20, fontWeight: 700, fontSize: 13 }}>
      {score}/100
    </span>
  );
}

function Section({ title, items, emoji, empty }) {
  return (
    <div className="sec">
      <h4>{emoji} {title}</h4>
      {items.length === 0
        ? <p className="sec-empty">{empty}</p>
        : <ul>{items.map((s,i) => <li key={i}>{s}</li>)}</ul>
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RESET PASSWORD PAGE
// ════════════════════════════════════════════════════════════════════════════
function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [pw,  setPw]  = useState("");
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw || pw.length < 6) { setMsg({ text: "Password must be at least 6 characters", ok: false }); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/reset-password`, { token, password: pw });
      setMsg({ text: "Password reset! You can now log in.", ok: true });
    } catch (e) {
      setMsg({ text: e.response?.data?.detail || "Failed to reset password", ok: false });
    }
    setBusy(false);
  };

  return (
    <div className="auth-bg">
      <div className="blob blob-1" /><div className="blob blob-2" />
      <div className="auth-card" style={{ maxWidth: 400 }}>
        <div className="brand"><div className="brand-icon">⚡</div><span className="brand-name">ATS Checker</span></div>
        <h1 className="auth-heading">New Password</h1>
        <p className="auth-sub">Choose a strong password.</p>
        <div className="form">
          <Field label="New Password" name="pw" type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} />
          {msg.text && <div className={`flash ${msg.ok?"flash-ok":"flash-err"}`}>{msg.text}</div>}
          {!msg.ok && <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? <span className="spinner" /> : "Set Password →"}</button>}
          {msg.ok && <button className="btn-primary" onClick={() => window.location.href = "/"}>Back to Log In →</button>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  VERIFY PAGE
// ════════════════════════════════════════════════════════════════════════════
function VerifyPage() {
  const [status, setStatus] = useState("verifying");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) { setStatus("invalid"); return; }
    axios.get(`${API}/verify-email?token=${t}`)
      .then(() => { setStatus("success"); setTimeout(() => { window.location.href = "/"; }, 2000); })
      .catch(() => { setStatus("invalid"); setTimeout(() => { window.location.href = "/"; }, 2000); });
  }, []);
  return (
    <div className="auth-bg">
      <div className="auth-card" style={{ maxWidth: 400, textAlign: "center" }}>
        <div className="brand"><div className="brand-icon">⚡</div><span className="brand-name">ATS Checker</span></div>
        {status === "verifying" && <p className="auth-sub">Verifying your email…</p>}
        {status === "success"   && <p className="auth-sub">✅ Email verified! Redirecting…</p>}
        {status === "invalid"   && <p className="auth-sub">⚠️ Invalid or expired link. Redirecting…</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ROOT
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  if (window.location.pathname === "/reset-password") return <ResetPasswordPage />;
  if (window.location.pathname === "/verify") return <VerifyPage />;
  const handleLogin  = (t) => setToken(t);
  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setToken(""); };
  if (!token) return <AuthPage onLogin={handleLogin} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
