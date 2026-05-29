import { useState, useEffect, useRef } from "react";
function getAPI() {
  // Local dev
  if (window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  // HuggingFace embeds the app in an iframe — use the actual Space URL directly
  if (window.location.hostname.includes("huggingface.co")) {
    return "https://nihalnimmagadda-blitz.hf.space/api";
  }
  // Direct Space URL or self-hosted
  return `${window.location.protocol}//${window.location.hostname}/api`;
}
const API = getAPI();

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function SimpleMarkdown({ text }) {
  const lines = text.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return <div key={i} style={{ color: "#38bdf8", fontWeight: 700, fontSize: 12, letterSpacing: 1, marginTop: 10, marginBottom: 4 }}>{line.slice(4)}</div>;
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4)
          return <div key={i} style={{ color: "#f1f5f9", fontWeight: 700, marginBottom: 2 }}>{line.slice(2, -2)}</div>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
              <span style={{ color: "#38bdf8", flexShrink: 0 }}>·</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ marginBottom: 3, lineHeight: 1.6 }}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} style={{ color: "#f1f5f9" }}>{part.slice(2, -2)}</strong>
      : part
  );
}

function WelcomePage({ onStart }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#0a0f1e", minHeight: "100dvh", width: "100vw", color: "#e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%,100% { text-shadow: 0 0 20px rgba(56,189,248,0.4); } 50% { text-shadow: 0 0 40px rgba(56,189,248,0.8), 0 0 80px rgba(56,189,248,0.3); } }
        .welcome-btn:hover { background: #0284c7 !important; box-shadow: 0 0 40px rgba(56,189,248,0.5) !important; transform: translateY(-1px); }
        .welcome-btn:active { transform: translateY(1px); }
      `}</style>

      {/* Grid background */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />
      {/* Radial glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, background: "radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Logo */}
      <div style={{ animation: "fadeUp 0.5s ease both", textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🏈</div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: 10, color: "#38bdf8", animation: "shimmer 3s ease infinite" }}>BLITZ</div>
        <div style={{ fontSize: 10, letterSpacing: 5, color: "#334155", marginTop: 6 }}>FANTASY FOOTBALL OPTIMIZER</div>
      </div>

      {/* Tagline */}
      <div style={{ animation: "fadeUp 0.5s 0.12s ease both", textAlign: "center", marginBottom: 32, maxWidth: 500 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "#f1f5f9", marginBottom: 12, lineHeight: 1.4 }}>Stop guessing. Start winning.</div>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.8 }}>
          Your AI-powered fantasy co-manager, built on real NFL data, machine learning projections, and a live AI chat assistant.
        </div>
      </div>

      {/* CTA */}
      <div style={{ animation: "fadeUp 0.5s 0.2s ease both", textAlign: "center", marginBottom: 44 }}>
        <button onClick={onStart} className="welcome-btn" style={{ background: "#0ea5e9", border: "none", color: "#fff", padding: "15px 52px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, letterSpacing: 3, boxShadow: "0 0 24px rgba(56,189,248,0.3)", transition: "all 0.2s" }}>
          GET STARTED →
        </button>
        <span style={{ marginLeft: 16, fontSize: 10, color: "#1e3a5f", letterSpacing: 1 }}>FREE · NO ACCOUNT NEEDED · REAL NFL DATA</span>
      </div>

      {/* Feature list */}
      <div style={{ animation: "fadeUp 0.5s 0.3s ease both", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, width: "100%", maxWidth: 580 }}>
        {[
          { icon: "📊", title: "ML Projections", desc: "XGBoost predictions with SHAP factor breakdowns — know exactly why a player is trending." },
          { icon: "📉", title: "Floor & Ceiling", desc: "See your upside and downside for every player, derived from real game volatility." },
          { icon: "🔍", title: "Waiver Wire", desc: "Search any NFL player and get instant stats, projections, and injury status." },
          { icon: "💬", title: "AI Co-Manager", desc: "Ask Blitz about trades, lineup decisions, or breakout candidates — 24/7." },
        ].map(f => (
          <div key={f.title} style={{ borderLeft: "2px solid #1e3a5f", paddingLeft: 14, paddingTop: 2, paddingBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", letterSpacing: 2 }}>{f.title.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.7 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Minimal seed roster — only name and position, everything else loads from backend
const SEED_ROSTER = [
  { name: "Josh Allen",           pos: "QB" },
  { name: "CeeDee Lamb",          pos: "WR" },
  { name: "Christian McCaffrey",  pos: "RB" },
  { name: "Amon-Ra St. Brown",    pos: "WR" },
  { name: "Travis Kelce",         pos: "TE" },
  { name: "Tyreek Hill",          pos: "WR" },
  { name: "Breece Hall",          pos: "RB" },
  { name: "Sam LaPorta",          pos: "TE" },
  { name: "Drake Maye",           pos: "QB" },
];

function defaultPlayer(name, pos) {
  return {
    name,
    pos,
    proj: null,
    trend: 0,
    injury: "—",
    news: "hold",
    // no salary — it's fake
  };
}

// Derive injury label from news articles
function deriveInjury(newsArticles) {
  if (!newsArticles || newsArticles.length === 0) return "—";
  const INJURY_KEYWORDS = ["limited", "questionable", "doubtful", "out", "ir", "injured", "day-to-day", "scratch"];
  const allText = newsArticles.map(a => (a.title || "").toLowerCase()).join(" ");
  for (const kw of INJURY_KEYWORDS) {
    if (allText.includes(kw)) return kw.charAt(0).toUpperCase() + kw.slice(1);
  }
  return "Healthy";
}

const newsColors = { buy: "#22c55e", hold: "#fbbf24", sell: "#ef4444" };
const newsLabels = { buy: "↑ Buy", hold: "→ Hold", sell: "↓ Sell" };

function injuryColor(injury) {
  if (!injury || injury === "—") return "#475569";
  if (injury === "Healthy") return "#22c55e";
  if (["Out", "Ir", "Doubtful"].includes(injury)) return "#ef4444";
  return "#fbbf24";
}

function DropModal({ player, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#0a1628", border: "1px solid #ef4444", borderRadius: 12, padding: 28, width: "min(340px, 90vw)", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Drop {player.name}?</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 24 }}>This will remove them from your roster permanently.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>CANCEL</button>
          <button onClick={onConfirm} style={{ background: "#ef4444", border: "none", color: "#fff", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>DROP PLAYER</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const savedRoster = (() => {
    try {
      const s = localStorage.getItem("blitz_roster");
      if (s) {
        const parsed = JSON.parse(s);
        // Only restore name, pos, news — never restore proj/floor/ceiling from cache
        // so they always reload fresh from the backend
        return parsed.map(p => ({
          ...defaultPlayer(p.name, p.pos),
          news: p.news ?? "hold",
        }));
      }
      return SEED_ROSTER.map(p => defaultPlayer(p.name, p.pos));
    } catch { return SEED_ROSTER.map(p => defaultPlayer(p.name, p.pos)); }
  })();

  const isMobile = useIsMobile();
  const [started, setStarted] = useState(false);
  const [roster, setRoster] = useState(savedRoster);
  const [selected, setSelected] = useState(savedRoster[0]);
  const [tab, setTab] = useState("roster");
  const [showDetail, setShowDetail] = useState(false); // mobile: toggle between list and detail

  const [playerNews, setPlayerNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropConfirm, setDropConfirm] = useState(null);
  const searchTimeout = useRef(null);

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hey! I'm Blitz, your Fantasy AI. Ask me to analyze players, optimize your lineup, or evaluate trades." }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("blitz_roster", JSON.stringify(roster)); } catch {}
  }, [roster]);

  // Fetch projections for roster players that are missing data (runs when roster names change)
  const _rosterKey = roster.map(p => p.name).join("|");
  useEffect(() => {
    roster.forEach(async (p) => {
      if (p.proj !== null) return; // already has fresh data
      try {
        const res = await fetch(`${API}/player/${encodeURIComponent(p.name)}`);
        const data = await res.json();
        if (data.found) {
          const update = {
            proj: data.projected_points,
            sampleWeeks: data.sample_weeks,
            trend: data.trend ?? 0,
            confidence: data.confidence,
            confidenceColor: data.confidence_color ?? "#22c55e",
            factors: data.factors ?? [],
            injury: data.injury_status ?? "—",
            floor: data.floor ?? null,
            ceiling: data.ceiling ?? null,
          };
          setRoster(prev => prev.map(r => r.name === p.name ? { ...r, ...update } : r));
          setSelected(prev => prev.name === p.name ? { ...prev, ...update } : prev);
        }
      } catch {}
    });
  }, [_rosterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch news + derive injury status dynamically
  useEffect(() => {
    setPlayerNews([]);
    setNewsLoading(true);
    fetch(`${API}/news/${encodeURIComponent(selected.name)}`)
      .then(r => r.json())
      .then(data => {
        const articles = Array.isArray(data) ? data : [];
        setPlayerNews(articles);
        setNewsLoading(false);
        // Derive news signal from live articles
        const signals = articles.map(a => a.signal);
        const news = signals.includes("sell") ? "sell" : signals.includes("buy") ? "buy" : "hold";
        setRoster(prev => prev.map(r => r.name === selected.name ? { ...r, news } : r));
        setSelected(prev => prev.name === selected.name ? { ...prev, news } : prev);
      })
      .catch(() => { setPlayerNews([]); setNewsLoading(false); });
  }, [selected.name]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        const rosterNames = roster.map(p => p.name.toLowerCase());
        setSearchResults(data.filter(p => !rosterNames.includes(p.player.toLowerCase())));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  }, [searchQuery, roster]);

  const handleAddPlayer = (player) => { setAddingPlayer(player); setDropTarget(null); };

  const confirmAdd = () => {
    if (!addingPlayer) return;
    const newPlayer = {
      ...defaultPlayer(addingPlayer.player, addingPlayer.position || "WR"),
      proj: addingPlayer.projected_points ?? null,
      floor: addingPlayer.floor ?? null,
      ceiling: addingPlayer.ceiling ?? null,
      trend: addingPlayer.trend ?? 0,
      confidence: addingPlayer.confidence ?? null,
      confidenceColor: addingPlayer.confidence_color ?? "#22c55e",
      factors: addingPlayer.factors ?? [],
      injury: addingPlayer.injury_status ?? "—",
      sampleWeeks: addingPlayer.sample_weeks ?? null,
    };
    if (dropTarget) {
      setRoster(r => r.map(p => p.name === dropTarget.name ? newPlayer : p));
    } else {
      setRoster(r => [...r, newPlayer]);
    }
    setSelected(newPlayer);
    setAddingPlayer(null);
    setDropTarget(null);
    setSearchQuery("");
    setSearchResults([]);
    setTab("roster");
  };

  const handleDropConfirm = () => {
    if (!dropConfirm) return;
    const remaining = roster.filter(p => p.name !== dropConfirm.name);
    setRoster(remaining);
    if (selected.name === dropConfirm.name) setSelected(remaining[0] || defaultPlayer("", ""));
    setDropConfirm(null);
  };

  const apiHistoryRef = useRef([]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setLoading(true);
    const fullMsg = `My current roster: ${roster.map(p => `${p.name} (${p.pos}, proj: ${p.proj ?? "loading"}pts)`).join(", ")}\n\nUser question: ${userMsg}`;
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: fullMsg, history: apiHistoryRef.current }),
      });
      const data = await res.json();
      apiHistoryRef.current = [
        ...apiHistoryRef.current,
        { role: "user", content: fullMsg },
        { role: "assistant", content: data.response },
      ];
      setMessages(m => [...m, { role: "ai", text: data.response }]);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "⚠️ Could not reach backend." }]);
    }
    setLoading(false);
  };

  if (!started) return <WelcomePage onStart={() => setStarted(true)} />;

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#0a0f1e", height: "100vh", width: "100vw", color: "#e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; }
        @media (max-width: 767px) {
          html, body, #root { height: 100dvh; }
        }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0f1e; } ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
        .glow { box-shadow: 0 0 20px rgba(56,189,248,0.15); }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .slide-in { animation: slideIn 0.2s ease; }
        .player-row:hover { background: #0d1e35 !important; }
        .search-result:hover { background: #0f1f38 !important; }
        input:focus { outline: none; border-color: #38bdf8 !important; }
      `}</style>

      {dropConfirm && <DropModal player={dropConfirm} onConfirm={handleDropConfirm} onCancel={() => setDropConfirm(null)} />}

      {addingPlayer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 12, padding: 28, width: "min(440px, 95vw)" }} className="slide-in">
            <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", letterSpacing: 2, marginBottom: 4 }}>ADD PLAYER</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{addingPlayer.player}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 20 }}>
              {addingPlayer.position} · {addingPlayer.team} · {addingPlayer.projected_points} proj pts
            </div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>SELECT A PLAYER TO DROP (OPTIONAL)</div>
            <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 20 }}>
              {roster.map(p => (
                <div key={p.name} onClick={() => setDropTarget(dropTarget?.name === p.name ? null : p)} className="search-result"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 6, cursor: "pointer", marginBottom: 4, background: dropTarget?.name === p.name ? "#1a2f4a" : "transparent", border: `1px solid ${dropTarget?.name === p.name ? "#0ea5e9" : "transparent"}`, transition: "all 0.15s" }}>
                  <div style={{ background: "#0f1f38", border: "1px solid #1e3a5f", borderRadius: 3, padding: "2px 7px", fontSize: 10, color: "#38bdf8", minWidth: 28, textAlign: "center" }}>{p.pos}</div>
                  <div style={{ flex: 1, fontSize: 12, color: "#e2e8f0" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#fbbf24" }}>{p.proj ?? "—"} pts</div>
                  {dropTarget?.name === p.name && <div style={{ fontSize: 10, color: "#ef4444" }}>DROP</div>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setAddingPlayer(null); setDropTarget(null); }} style={{ flex: 1, background: "transparent", border: "1px solid #1e3a5f", color: "#94a3b8", padding: "10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>CANCEL</button>
              <button onClick={confirmAdd} style={{ flex: 2, background: "#0ea5e9", border: "none", color: "#fff", padding: "10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>
                {dropTarget ? `ADD & DROP ${dropTarget.name.split(" ")[1] || dropTarget.name}` : "ADD TO ROSTER"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e3a5f", padding: isMobile ? "10px 14px" : "14px 24px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, background: "#050b18", flexShrink: 0 }}>
        <button onClick={() => setStarted(false)} title="Back to home" style={{ background: "transparent", border: "1px solid #1e3a5f", borderRadius: 4, color: "#64748b", cursor: "pointer", fontSize: 11, padding: "4px 8px", fontFamily: "inherit", letterSpacing: 1, flexShrink: 0 }}>← HOME</button>
        <div style={{ fontSize: isMobile ? 18 : 22 }}>🏈</div>
        {!isMobile && <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#38bdf8" }}>BLITZ</div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>FANTASY FOOTBALL OPTIMIZER</div>
        </div>}
        {isMobile && <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: "#38bdf8" }}>BLITZ</div>}
        <div style={{ marginLeft: "auto", display: "flex", gap: isMobile ? 4 : 8 }}>
          {["roster", "waiver", "lineup", "chat"].map(t => (
            <button key={t} onClick={() => { setTab(t); setShowDetail(false); }} style={{ background: tab === t ? "#0ea5e9" : "transparent", border: `1px solid ${tab === t ? "#0ea5e9" : "#1e3a5f"}`, color: tab === t ? "#fff" : "#64748b", padding: isMobile ? "6px 10px" : "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: isMobile ? 10 : 11, letterSpacing: 1, fontFamily: "inherit", textTransform: "uppercase" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROSTER TAB ── */}
      {tab === "roster" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "320px 1fr", height: "calc(100dvh - 57px)", overflow: "hidden" }}>
          <div style={{ borderRight: "1px solid #1e3a5f", overflowY: "auto", background: "#050b18", display: isMobile && showDetail ? "none" : "block" }}>
            <div style={{ padding: "12px 16px", fontSize: 10, letterSpacing: 2, color: "#475569", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>ROSTER — {roster.length} PLAYERS</span>
              <button onClick={() => setTab("waiver")} style={{ background: "#0ea5e9", border: "none", color: "#fff", padding: "4px 10px", borderRadius: 3, cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 1 }}>+ ADD</button>
            </div>
            {roster.map(p => (
              <div key={p.name} onClick={() => { setSelected(p); if (isMobile) setShowDetail(true); }} className="player-row"
                style={{ padding: "14px 16px", borderBottom: "1px solid #0f1f38", cursor: "pointer", background: selected.name === p.name ? "#0f1f38" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "#0f1f38", border: "1px solid #1e3a5f", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#38bdf8", minWidth: 32, textAlign: "center" }}>{p.pos}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: selected.name === p.name ? "#e2e8f0" : "#94a3b8" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                    Proj: <span style={{ color: "#fbbf24" }}>{p.proj ?? "..."}</span>
                    <span style={{ color: p.trend >= 0 ? "#22c55e" : "#ef4444", marginLeft: 8 }}>{p.trend >= 0 ? "+" : ""}{p.trend}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: injuryColor(p.injury) }} className={p.injury && p.injury !== "Healthy" && p.injury !== "—" ? "pulse" : ""} />
                  <button onClick={e => { e.stopPropagation(); setDropConfirm(p); }}
                    style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#475569", padding: "2px 7px", borderRadius: 3, cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 1 }}>DROP</button>
                </div>
              </div>
            ))}
          </div>

          {/* Player detail */}
          <div style={{ padding: isMobile ? 16 : 28, overflowY: "auto", display: isMobile && !showDetail ? "none" : "block" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 28 }}>
              <div style={{ flex: 1 }}>
                {isMobile && <button onClick={() => setShowDetail(false)} style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: 11, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1, marginBottom: 12, padding: 0 }}>← BACK TO ROSTER</button>}
                <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: "#f1f5f9", letterSpacing: -1 }}>{selected.name}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ background: "#0f1f38", border: "1px solid #1e3a5f", color: "#38bdf8", padding: "3px 10px", borderRadius: 3, fontSize: 11 }}>{selected.pos}</span>
                  {selected.injury && selected.injury !== "—" && (
                    <span style={{ background: "#0f1f38", border: `1px solid ${injuryColor(selected.injury)}`, color: injuryColor(selected.injury), padding: "3px 10px", borderRadius: 3, fontSize: 11 }}>{selected.injury}</span>
                  )}
                  <span style={{ background: "#0f1f38", border: `1px solid ${newsColors[selected.news || "hold"]}`, color: newsColors[selected.news || "hold"], padding: "3px 10px", borderRadius: 3, fontSize: 11 }}>{newsLabels[selected.news || "hold"]}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: isMobile ? 32 : 42, fontWeight: 700, color: "#38bdf8", letterSpacing: -2 }}>{selected.proj ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1 }}>PROJECTED PTS</div>
                {selected.proj && (
                  <div style={{ fontSize: 12, color: selected.trend >= 0 ? "#22c55e" : "#ef4444", marginTop: 4 }}>
                    {selected.trend >= 0 ? "▲" : "▼"} {Math.abs(selected.trend)} vs season avg
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24 }}>
              {[
                { label: "BASED ON", value: selected.sampleWeeks || "Loading...", color: "#94a3b8" },
                { label: "CONFIDENCE", value: selected.confidence || "—", color: selected.confidenceColor || "#94a3b8" },
                { label: "FLOOR", value: selected.floor != null ? selected.floor : "—", color: "#94a3b8" },
                { label: "CEILING", value: selected.ceiling != null ? selected.ceiling : "—", color: "#94a3b8" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16 }} className="glow">
                  <div style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 6 }}>{stat.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {(selected.factors || []).length > 0 && (
              <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 16 }}>PROJECTION FACTORS</div>
                {(selected.factors || []).map(s => {
                  const maxImpact = Math.max(...(selected.factors || []).map(f => Math.abs(f.impact)), 1);
                  return (
                    <div key={s.factor} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", width: isMobile ? 120 : 180, flexShrink: 0 }}>{s.factor}</div>
                      <div style={{ flex: 1, height: 6, background: "#1e3a5f", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.abs(s.impact) / maxImpact * 100}%`, background: s.impact >= 0 ? "#22c55e" : "#ef4444", borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 11, color: s.impact >= 0 ? "#22c55e" : "#ef4444", width: 44, textAlign: "right" }}>{s.impact >= 0 ? "+" : ""}{s.impact}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 16 }}>RECENT NEWS & SIGNALS</div>
              {newsLoading && <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1 }}>Loading news...</div>}
              {!newsLoading && playerNews.length === 0 && (
                <div style={{ fontSize: 11, color: "#475569" }}>No recent news found for {selected.name}.</div>
              )}
              {!newsLoading && playerNews.map((n, i) => {
                const timeAgo = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                return (
                  <div key={i} style={{ borderLeft: `2px solid ${newsColors[n.signal]}`, paddingLeft: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "#38bdf8", fontWeight: 600 }}>{n.source}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{timeAgo}</span>
                      <span style={{ fontSize: 10, color: newsColors[n.signal], marginLeft: "auto" }}>{newsLabels[n.signal]}</span>
                    </div>
                    <a href={n.url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4, textDecoration: "none", display: "block" }}
                      onMouseOver={e => e.currentTarget.style.color = "#e2e8f0"}
                      onMouseOut={e => e.currentTarget.style.color = "#94a3b8"}>
                      {n.title}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── WAIVER WIRE TAB ── */}
      {tab === "waiver" && (
        <div style={{ padding: isMobile ? 14 : 28, maxWidth: 800, margin: "0 auto", overflowY: "auto", height: "calc(100dvh - 57px)" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 20 }}>WAIVER WIRE — SEARCH & ADD PLAYERS</div>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#475569" }}>🔍</div>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for any NFL player (e.g. Jaylen Waddle, Davante Adams...)"
              style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "14px 16px 14px 46px", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit" }}
              autoFocus />
            {searching && <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#38bdf8", letterSpacing: 1 }}>SEARCHING...</div>}
          </div>
          {searchResults.length > 0 && (
            <div className="slide-in">
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>{searchResults.length} PLAYERS FOUND</div>
              <div style={{ display: "grid", gap: 8 }}>
                {searchResults.map((p, i) => (
                  <div key={i} className="search-result"
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, transition: "background 0.15s" }}>
                    <div style={{ background: "#0f1f38", border: "1px solid #1e3a5f", borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#38bdf8", minWidth: 36, textAlign: "center" }}>{p.position}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{p.player}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                        {p.team} · Floor: {p.floor} · Ceiling: {p.ceiling} · {p.games_sampled} games
                      </div>
                    </div>
                    <div style={{ textAlign: "right", marginRight: isMobile ? 0 : 16 }}>
                      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: "#fbbf24" }}>{p.projected_points}</div>
                      <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>PROJ PTS</div>
                    </div>
                    <button onClick={() => handleAddPlayer(p)}
                      style={{ background: "#0ea5e9", border: "none", color: "#fff", padding: isMobile ? "8px 12px" : "8px 18px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>
                      + ADD
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#475569", fontSize: 12 }}>No players found for "{searchQuery}".</div>
          )}
          {!searchQuery && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏈</div>
              <div style={{ fontSize: 12, color: "#475569" }}>Type a player name to search the waiver wire</div>
              <div style={{ fontSize: 10, color: "#2d4a6a", marginTop: 8 }}>Powered by real 2024-2025 NFL stats</div>
            </div>
          )}
        </div>
      )}

      {/* ── LINEUP TAB ── */}
      {tab === "lineup" && (
        <div style={{ padding: isMobile ? 14 : 28, maxWidth: 700, margin: "0 auto", overflowY: "auto", height: "calc(100dvh - 57px)" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 24 }}>OPTIMAL LINEUP — HALF PPR</div>
          {roster.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>Add players to your roster to see lineup suggestions.</div>
          ) : (
            <>
              {roster.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, marginBottom: 8 }}>
                  <div style={{ width: 44, fontSize: 10, color: "#475569", letterSpacing: 1 }}>{p.pos}</div>
                  <div style={{ flex: 1, fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8" }}>{p.proj ?? "—"}</div>
                  <div style={{ fontSize: 14, color: p.trend >= 0 ? "#22c55e" : "#ef4444" }}>{p.trend >= 0 ? "↑" : "↓"}</div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: "16px 20px", background: "#0f1f38", border: "1px solid #0ea5e9", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>TOTAL PROJECTED</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#38bdf8" }}>
                  {roster.reduce((sum, p) => sum + (p.proj ?? 0), 0).toFixed(1)} pts
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 57px)" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: isMobile ? "88%" : "72%", background: m.role === "user" ? "#0ea5e9" : "#0a1628", border: `1px solid ${m.role === "user" ? "#0ea5e9" : "#1e3a5f"}`, borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: "12px 16px", fontSize: 12, lineHeight: 1.6, color: m.role === "user" ? "#fff" : "#cbd5e1" }}>
                  {m.role === "ai" && <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: 2, marginBottom: 6 }}>BLITZ</div>}
                  {m.role === "ai" ? <SimpleMarkdown text={m.text} /> : m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 4, padding: 16 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", animation: `pulse 1s ${i * 0.2}s infinite` }} />)}
              </div>
            )}
          </div>
          <div style={{ borderTop: "1px solid #1e3a5f", padding: isMobile ? "10px 12px" : 16, display: "flex", gap: 10, background: "#050b18" }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Ask about a player, trade, or lineup..."
              style={{ flex: 1, background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, padding: "10px 14px", color: "#e2e8f0", fontSize: 12, fontFamily: "inherit" }} />
            <button onClick={sendMessage} disabled={loading}
              style={{ background: "#0ea5e9", border: "none", borderRadius: 6, padding: "10px 20px", color: "#fff", fontSize: 11, fontFamily: "inherit", letterSpacing: 1, cursor: "pointer", fontWeight: 600 }}>SEND</button>
          </div>
        </div>
      )}
    </div>
  );
}