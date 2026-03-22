import { useState, useEffect, useRef } from "react";
const API = window.location.port === "5173"
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : `${window.location.protocol}//${window.location.hostname}/api`;
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

const DEFAULT_PLAYERS = [
  { name: "Josh Allen", pos: "QB", proj: 0, trend: 0, injury: "Healthy", matchup: "A", news: "buy", salary: 8200 },
  { name: "CeeDee Lamb", pos: "WR", proj: 0, trend: 0, injury: "Healthy", matchup: "A+", news: "buy", salary: 8000 },
  { name: "Christian McCaffrey", pos: "RB", proj: 0, trend: 0, injury: "Questionable", matchup: "B+", news: "hold", salary: 9200 },
  { name: "Amon-Ra St. Brown", pos: "WR", proj: 0, trend: 0, injury: "Healthy", matchup: "B", news: "buy", salary: 7100 },
  { name: "Travis Kelce", pos: "TE", proj: 0, trend: 0, injury: "Healthy", matchup: "A-", news: "hold", salary: 6900 },
  { name: "Tyreek Hill", pos: "WR", proj: 0, trend: 0, injury: "Limited", matchup: "C+", news: "sell", salary: 7400 },
  { name: "Breece Hall", pos: "RB", proj: 0, trend: 0, injury: "Healthy", matchup: "B+", news: "buy", salary: 7000 },
  { name: "Sam LaPorta", pos: "TE", proj: 0, trend: 0, injury: "Healthy", matchup: "B-", news: "hold", salary: 5200 },
];

const matchupColors = { "A+": "#22c55e", "A": "#4ade80", "A-": "#86efac", "B+": "#fbbf24", "B": "#fcd34d", "B-": "#fde68a", "C+": "#f97316", "C": "#fb923c" };
const newsColors = { buy: "#22c55e", hold: "#fbbf24", sell: "#ef4444" };
const newsLabels = { buy: "↑ Buy", hold: "→ Hold", sell: "↓ Sell" };



function DropModal({ player, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#0a1628", border: "1px solid #ef4444", borderRadius: 12, padding: 28, width: 340, textAlign: "center" }}>
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
      return s ? JSON.parse(s) : DEFAULT_PLAYERS;
    } catch { return DEFAULT_PLAYERS; }
  })();

  const [roster, setRoster] = useState(savedRoster);
  const [selected, setSelected] = useState(savedRoster[0] || DEFAULT_PLAYERS[0]);
  const [tab, setTab] = useState("roster");

  // News state
  const [playerNews, setPlayerNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // Waiver wire state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropConfirm, setDropConfirm] = useState(null);
  const searchTimeout = useRef(null);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hey! I'm Blitz, your Fantasy AI. Ask me to analyze players, optimize your lineup, or evaluate trades." }
  ]);
  const [loading, setLoading] = useState(false);

  // Persist roster to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem("blitz_roster", JSON.stringify(roster)); } catch {}
  }, [roster]);

  // Fetch real projections from backend on load
  useEffect(() => {
    roster.forEach(async (p) => {
      try {
        const res = await fetch(`${API}/player/${encodeURIComponent(p.name)}`);
        const data = await res.json();
        if (data.found) {
          setRoster(prev => prev.map(r =>
            r.name === p.name ? {
              ...r,
              proj: data.projected_points,
              sampleWeeks: data.sample_weeks,
              trend: data.trend ?? r.trend,
              confidence: data.confidence ?? r.confidence,
              confidenceColor: data.confidence_color ?? "#22c55e",
              factors: data.factors ?? r.factors,
            } : r
          ));
          setSelected(prev =>
            prev.name === p.name ? {
              ...prev,
              proj: data.projected_points,
              sampleWeeks: data.sample_weeks,
              trend: data.trend ?? prev.trend,
              confidence: data.confidence ?? prev.confidence,
              confidenceColor: data.confidence_color ?? "#22c55e",
              factors: data.factors ?? prev.factors,
            } : prev
          );
        }
      } catch {}
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch real news when selected player changes
  useEffect(() => {
    setPlayerNews([]);
    setNewsLoading(true);
    fetch(`${API}/news/${encodeURIComponent(selected.name)}`)
      .then(r => r.json())
      .then(data => { setPlayerNews(Array.isArray(data) ? data : []); setNewsLoading(false); })
      .catch(() => { setPlayerNews([]); setNewsLoading(false); });
  }, [selected.name]);

  // Search players via backend
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
      name: addingPlayer.player,
      pos: addingPlayer.position || "WR",
      proj: addingPlayer.projected_points || 10,
      trend: 0,
      injury: "Healthy",
      matchup: "B",
      news: "hold",
      salary: 5000,
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
    if (selected.name === dropConfirm.name) setSelected(remaining[0] || DEFAULT_PLAYERS[0]);
    setDropConfirm(null);
  };

  const apiHistoryRef = useRef([]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setLoading(true);

    const fullMsg = `My current roster: ${roster.map(p => `${p.name} (${p.pos}, proj: ${p.proj}pts)`).join(", ")}\n\nUser question: ${userMsg}`;

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: fullMsg,
          history: apiHistoryRef.current,
        }),
      });
      const data = await res.json();
      // Update API history with the clean user message and AI response
      apiHistoryRef.current = [
        ...apiHistoryRef.current,
        { role: "user", content: fullMsg },
        { role: "assistant", content: data.response },
      ];
      setMessages(m => [...m, { role: "ai", text: data.response }]);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "⚠️ Could not reach backend. Make sure uvicorn is running on port 8000." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#0a0f1e", height: "100vh", width: "100vw", color: "#e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; }
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
          <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 12, padding: 28, width: 440 }} className="slide-in">
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
                  <div style={{ fontSize: 11, color: "#fbbf24" }}>{p.proj} pts</div>
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
      <div style={{ borderBottom: "1px solid #1e3a5f", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, background: "#050b18" }}>
        <div style={{ fontSize: 22 }}>🏈</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: "#38bdf8" }}>BLITZ</div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>FANTASY FOOTBALL OPTIMIZER</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["roster", "waiver", "lineup", "chat"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? "#0ea5e9" : "transparent", border: `1px solid ${tab === t ? "#0ea5e9" : "#1e3a5f"}`, color: tab === t ? "#fff" : "#64748b", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 11, letterSpacing: 1, fontFamily: "inherit", textTransform: "uppercase" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROSTER TAB ── */}
      {tab === "roster" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "calc(100vh - 57px)" }}>
          <div style={{ borderRight: "1px solid #1e3a5f", overflowY: "auto", background: "#050b18" }}>
            <div style={{ padding: "12px 16px", fontSize: 10, letterSpacing: 2, color: "#475569", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>ROSTER — {roster.length} PLAYERS</span>
              <button onClick={() => setTab("waiver")} style={{ background: "#0ea5e9", border: "none", color: "#fff", padding: "4px 10px", borderRadius: 3, cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 1 }}>+ ADD</button>
            </div>
            {roster.map(p => (
              <div key={p.name} onClick={() => setSelected(p)} className="player-row"
                style={{ padding: "14px 16px", borderBottom: "1px solid #0f1f38", cursor: "pointer", background: selected.name === p.name ? "#0f1f38" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "#0f1f38", border: "1px solid #1e3a5f", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#38bdf8", minWidth: 32, textAlign: "center" }}>{p.pos}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: selected.name === p.name ? "#e2e8f0" : "#94a3b8" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                    Proj: <span style={{ color: "#fbbf24" }}>{p.proj}</span>
                    <span style={{ color: p.trend >= 0 ? "#22c55e" : "#ef4444", marginLeft: 8 }}>{p.trend >= 0 ? "+" : ""}{p.trend}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.injury === "Healthy" ? "#22c55e" : p.injury === "Limited" ? "#fbbf24" : "#ef4444" }} className={p.injury !== "Healthy" ? "pulse" : ""} />
                  <button onClick={e => { e.stopPropagation(); setDropConfirm(p); }}
                    style={{ background: "transparent", border: "1px solid #1e3a5f", color: "#475569", padding: "2px 7px", borderRadius: 3, cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 1 }}>DROP</button>
                </div>
              </div>
            ))}
          </div>

          {/* Player detail */}
          <div style={{ padding: 28, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9", letterSpacing: -1 }}>{selected.name}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <span style={{ background: "#0f1f38", border: "1px solid #1e3a5f", color: "#38bdf8", padding: "3px 10px", borderRadius: 3, fontSize: 11 }}>{selected.pos}</span>
                  <span style={{ background: "#0f1f38", border: `1px solid ${selected.injury === "Healthy" ? "#22c55e" : "#fbbf24"}`, color: selected.injury === "Healthy" ? "#22c55e" : "#fbbf24", padding: "3px 10px", borderRadius: 3, fontSize: 11 }}>{selected.injury}</span>
                  <span style={{ background: "#0f1f38", border: `1px solid ${newsColors[selected.news]}`, color: newsColors[selected.news], padding: "3px 10px", borderRadius: 3, fontSize: 11 }}>{newsLabels[selected.news]}</span>
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 42, fontWeight: 700, color: "#38bdf8", letterSpacing: -2 }}>{selected.proj}</div>
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1 }}>PROJECTED PTS</div>
                <div style={{ fontSize: 12, color: selected.trend >= 0 ? "#22c55e" : "#ef4444", marginTop: 4 }}>
                  {selected.trend >= 0 ? "▲" : "▼"} {Math.abs(selected.trend)} vs season avg
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {[
                { label: "BASED ON", value: selected.sampleWeeks || "2025 season", color: "#94a3b8" },
                { label: "DFS SALARY", value: `$${selected.salary?.toLocaleString() || "N/A"}`, color: "#e2e8f0" },
                { label: "CONFIDENCE", value: selected.confidence || "—", color: selected.confidenceColor || "#94a3b8" },
                { label: "FLOOR / CEILING", value: `${(selected.proj - 5).toFixed(1)} / ${(selected.proj + 9).toFixed(1)}`, color: "#94a3b8" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 16 }} className="glow">
                  <div style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 6 }}>{stat.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 16 }}>PROJECTION FACTORS</div>
              {(selected.factors || []).length === 0 && (
                <div style={{ fontSize: 11, color: "#475569" }}>Loading factors...</div>
              )}
              {(selected.factors || []).map(s => {
                const maxImpact = Math.max(...(selected.factors || []).map(f => Math.abs(f.impact)), 1);
                return (
                  <div key={s.factor} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", width: 180, flexShrink: 0 }}>{s.factor}</div>
                    <div style={{ flex: 1, height: 6, background: "#1e3a5f", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.abs(s.impact) / maxImpact * 100}%`, background: s.impact >= 0 ? "#22c55e" : "#ef4444", borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 11, color: s.impact >= 0 ? "#22c55e" : "#ef4444", width: 44, textAlign: "right" }}>{s.impact >= 0 ? "+" : ""}{s.impact}</div>
                  </div>
                );
              })}
            </div>

            {/* Real news section */}
            <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 16 }}>RECENT NEWS & SIGNALS</div>
              {newsLoading && (
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1 }}>Loading news...</div>
              )}
              {!newsLoading && playerNews.length === 0 && (
                <div style={{ fontSize: 11, color: "#475569" }}>No recent news found for {selected.name}.</div>
              )}
              {!newsLoading && playerNews.map((n, i) => {
                const hoursAgo = n.publishedAt
                  ? Math.round((Date.now() - new Date(n.publishedAt)) / 3600000)
                  : null;
                const timeAgo = hoursAgo !== null
                  ? hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`
                  : "";
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
        <div style={{ padding: 28, maxWidth: 800, margin: "0 auto" }}>
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
                    <div style={{ textAlign: "right", marginRight: 16 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#fbbf24" }}>{p.projected_points}</div>
                      <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>PROJ PTS</div>
                    </div>
                    <button onClick={() => handleAddPlayer(p)}
                      style={{ background: "#0ea5e9", border: "none", color: "#fff", padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>
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
              <div style={{ fontSize: 10, color: "#2d4a6a", marginTop: 8 }}>Powered by real 2023-2024 NFL stats</div>
            </div>
          )}
        </div>
      )}

      {/* ── LINEUP TAB ── */}
      {tab === "lineup" && (
        <div style={{ padding: 28, maxWidth: 700, margin: "0 auto" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", marginBottom: 24 }}>OPTIMAL LINEUP — WEEK 11 — HALF PPR</div>
          {[
            { slot: "QB", player: "Josh Allen", pts: 28.4, trend: "↑" },
            { slot: "RB1", player: "Breece Hall", pts: 17.8, trend: "↑" },
            { slot: "RB2", player: "Christian McCaffrey", pts: 23.5, trend: "→", note: "⚠️ Monitor" },
            { slot: "WR1", player: "CeeDee Lamb", pts: 22.1, trend: "↑" },
            { slot: "WR2", player: "Amon-Ra St. Brown", pts: 18.6, trend: "↑" },
            { slot: "TE", player: "Travis Kelce", pts: 16.2, trend: "→" },
            { slot: "FLEX", player: "Breece Hall", pts: 17.8, trend: "↑" },
            { slot: "K", player: "Harrison Butker", pts: 8.2, trend: "→" },
            { slot: "DST", player: "San Francisco 49ers", pts: 9.4, trend: "↑" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, marginBottom: 8 }}>
              <div style={{ width: 44, fontSize: 10, color: "#475569", letterSpacing: 1 }}>{row.slot}</div>
              <div style={{ flex: 1, fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{row.player}</div>
              {row.note && <div style={{ fontSize: 10, color: "#fbbf24" }}>{row.note}</div>}
              <div style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8" }}>{row.pts}</div>
              <div style={{ fontSize: 14, color: row.trend === "↑" ? "#22c55e" : row.trend === "↓" ? "#ef4444" : "#fbbf24" }}>{row.trend}</div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: "16px 20px", background: "#0f1f38", border: "1px solid #0ea5e9", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>TOTAL PROJECTED</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#38bdf8" }}>162.0 pts</span>
          </div>
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 57px)" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "72%", background: m.role === "user" ? "#0ea5e9" : "#0a1628", border: `1px solid ${m.role === "user" ? "#0ea5e9" : "#1e3a5f"}`, borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: "12px 16px", fontSize: 12, lineHeight: 1.6, color: m.role === "user" ? "#fff" : "#cbd5e1" }}>
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
          <div style={{ borderTop: "1px solid #1e3a5f", padding: 16, display: "flex", gap: 10, background: "#050b18" }}>
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