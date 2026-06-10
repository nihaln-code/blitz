import { useState, useEffect, useRef } from "react";
import { auth, onAuthStateChanged, signInAnonymously, saveRoster, loadRoster } from "./firebase";

function getAPI() {
  if (window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  if (window.location.port === "7860") {
    return `${window.location.protocol}//${window.location.hostname}:7860/api`;
  }
  if (window.location.hostname.includes("huggingface.co")) {
    return "https://nihalnimmagadda-blitz.hf.space/api";
  }
  return `${window.location.protocol}//${window.location.hostname}/api`;
}
const API = getAPI();

// 3-level surface system, 3-level text system
const C = {
  bg:      "#07100e",   // deepest: page, header bar
  surface: "#0d1a16",   // sidebar, panel backgrounds
  raised:  "#142620",   // cards, stat boxes, selected rows
  hover:   "#1a3028",
  border:  "#1e3028",
  accent:  "#10b981",   // emerald primary
  green:   "#34c97a",   // buy signal (lighter warm green - distinct from primary)
  red:     "#ef4444",
  amber:   "#fbbf24",
  t1:      "#f0faf6",   // primary text (subtle green-white)
  t2:      "#8aaa9e",   // secondary: names, values, body
  t3:      "#4e7068",   // dim: labels, metadata, section headers
};

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
          return <div key={i} style={{ color: C.accent, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginTop: 10, marginBottom: 4 }}>{line.slice(4)}</div>;
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4)
          return <div key={i} style={{ color: C.t1, fontWeight: 700, marginBottom: 2 }}>{line.slice(2, -2)}</div>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
              <span style={{ color: C.accent, flexShrink: 0 }}>·</span>
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
      ? <strong key={i} style={{ color: C.t1 }}>{part.slice(2, -2)}</strong>
      : part
  );
}

function TypewriterMessage({ text }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const speed = Math.max(4, Math.min(18, Math.floor(4000 / text.length)));
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return <SimpleMarkdown text={displayed} />;
}

function BoltIcon({ size = 24, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  );
}

function WarningIcon({ size = 24, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function SearchIcon({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function WelcomePage({ onStart }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: C.bg, height: "100dvh", width: "100vw", color: C.t1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 24px", overflow: "hidden", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .blitz-font { font-family: 'Barlow Condensed', sans-serif; }
        .welcome-btn:hover { background: #059669 !important; transform: translateY(-1px); }
        .welcome-btn:active { transform: translateY(1px); }
      `}</style>

      {/* Noise/grain texture */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.045, pointerEvents: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px 256px" }} />

      {/* Logo */}
      <div style={{ animation: "fadeUp 0.5s ease both", textAlign: "center", marginBottom: 10 }}>
        <div style={{ marginBottom: 8 }}><BoltIcon size={36} color={C.accent} /></div>
        <div className="blitz-font" style={{ fontSize: 42, fontWeight: 700, letterSpacing: 10, color: C.accent }}>BLITZ</div>
        <div style={{ fontSize: 11, letterSpacing: 4, color: C.t3, marginTop: 6 }}>FANTASY FOOTBALL ASSISTANT</div>
      </div>

      {/* Staggered feature cards */}
      <div style={{ width: "100%", maxWidth: 460, marginBottom: 24 }}>
        {[
          { title: "Projections",     desc: "See the exact reasoning behind each number.",                                                                     accent: C.accent, delay: "0.18s" },
          { title: "Floor & Ceiling", desc: "10th and 90th percentile outcomes so you know the realistic range, not just the average.",                        accent: C.green,  delay: "0.26s" },
          { title: "Players",         desc: "Search any player and get their projection, floor and ceiling.",                                                  accent: C.accent, delay: "0.34s" },
          { title: "AI Co-Manager",   desc: "Ask about a trade or lineup decision. It uses your actual roster and real projections to answer.",                 accent: C.green,  delay: "0.42s" },
        ].map((f, i) => (
          <div key={f.title} style={{
            borderLeft: `2px solid ${f.accent}`,
            padding: "8px 14px",
            marginBottom: 4,
            marginLeft: i % 2 === 1 ? 28 : 0,
            marginRight: i % 2 === 0 ? 28 : 0,
            animation: `fadeUp 0.5s ${f.delay} ease both`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: f.accent, letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>{f.title}</div>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ animation: "fadeUp 0.5s 0.52s ease both", textAlign: "center" }}>
        <button onClick={onStart} className="welcome-btn blitz-font" style={{ background: C.accent, border: "none", color: "#fff", padding: "10px 28px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 700, letterSpacing: 3, transition: "all 0.2s" }}>
          GET STARTED →
        </button>
      </div>
    </div>
  );
}

// Minimal seed roster - only name and position, everything else loads from backend
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
    news: "hold",
  };
}

const newsColors = { buy: "#34c97a", hold: "#fbbf24", sell: "#ef4444" };
const newsLabels = { buy: "↑ Buy", hold: "→ Hold", sell: "↓ Sell" };

function getNewsSig(articles) {
  const counts = { buy: 0, hold: 0, sell: 0 };
  articles.forEach(a => { if (counts[a.signal] !== undefined) counts[a.signal]++; });
  if (counts.sell > counts.buy) return "sell";
  if (counts.buy > 0) return "buy";
  return "hold";
}

function combineSignal(newsSig, trend) {
  const trendSig = trend >= 2.5 ? "buy" : trend <= -2.5 ? "sell" : "hold";
  if (newsSig === "sell") return "sell";
  if (newsSig === "buy" && trendSig === "sell") return "hold";
  if (newsSig === "buy" || trendSig === "buy") return "buy";
  if (trendSig === "sell") return "sell";
  return "hold";
}

// Position badge colors - consistent across roster tab and league tab
const POS_COLORS = {
  QB: "#10b981",   // emerald (matches accent)
  RB: "#34c97a",   // warm green
  WR: "#60a5fa",   // blue
  TE: "#fbbf24",   // amber
  K:  "#4e7068",   // dim
  DEF:"#4e7068",
};

function LeagueTab({ isMobile, onClaimRoster }) {
  // Persist the league ID so the user doesn't have to re-enter it on every visit
  const [inputVal, setInputVal]     = useState(() => localStorage.getItem("sleeperLeagueId") || "");
  const [leagueData, setLeagueData] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const fetchLeague = async (id) => {
    const trimmed = id.trim();
    if (!trimmed || trimmed.length < 5) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/sleeper/league/${trimmed}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLeagueData(null);
      } else {
        setLeagueData(data);
        localStorage.setItem("sleeperLeagueId", trimmed);
      }
    } catch {
      setError("Could not reach the backend. Is it running?");
    }
    setLoading(false);
  };

  // Auto-load the saved league ID on first render.
  // setTimeout defers the call so setState isn't invoked synchronously inside the effect.
  useEffect(() => {
    const saved = localStorage.getItem("sleeperLeagueId");
    if (!saved) return;
    const id = setTimeout(() => fetchLeague(saved), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{ padding: isMobile ? 14 : 28, overflowY: "auto", height: "calc(100dvh - 57px)" }}>

      {/* ── League ID input ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 600, margin: "0 auto 32px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: C.t3, marginBottom: 12, textTransform: "uppercase" }}>
          Sleeper League
        </div>
        <div style={{ fontSize: 13, color: C.t2, marginBottom: 6, lineHeight: 1.6 }}>
          Paste your Sleeper league ID to view all rosters.
        </div>
        {/* Tell users exactly where to find their league ID */}
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 18, lineHeight: 1.6 }}>
          Find it in your Sleeper app URL:{" "}
          <span style={{ color: C.accent, fontFamily: "monospace" }}>
            sleeper.com/leagues/<strong>1234567890123456789</strong>/…
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchLeague(inputVal)}
            placeholder="e.g. 1048399999814123520"
            style={{ flex: 1, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", color: C.t1, fontSize: 13, fontFamily: "inherit" }}
          />
          <button
            onClick={() => fetchLeague(inputVal)}
            disabled={loading}
            style={{ background: C.accent, border: "none", color: "#fff", padding: "12px 22px", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ marginTop: 12, fontSize: 13, color: C.red, padding: "10px 14px", background: "#2a1414", border: `1px solid ${C.red}44`, borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Tip: tell users they can paste the league ID into chat for AI analysis */}
        {leagueData && (
          <div style={{ marginTop: 16, fontSize: 12, color: C.t3, padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, lineHeight: 1.6 }}>
            <span style={{ color: C.accent, fontWeight: 600 }}>Tip:</span> Paste your league ID into the Chat tab and ask the AI to analyze a trade - it will fetch these rosters automatically.
          </div>
        )}
      </div>

      {/* ── Roster grid ─────────────────────────────────────────────────── */}
      {leagueData && (
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* League header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div className="blitz-font" style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: C.t1, letterSpacing: -0.5 }}>
              {leagueData.league_name}
            </div>
            <div style={{ fontSize: 12, color: C.t3 }}>
              {leagueData.season} · {leagueData.teams.length} teams
            </div>
            {/* Refresh button - re-fetches in case rosters changed */}
            <button
              onClick={() => fetchLeague(inputVal)}
              style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${C.border}`, color: C.t3, padding: "5px 14px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 1 }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Responsive grid: 1 col on mobile, auto-fill ~280px cards on desktop */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {leagueData.teams.map(team => (
              <TeamCard key={team.roster_id} team={team} onClaimRoster={onClaimRoster} />
            ))}
          </div>

          {/* Legend explaining the starter dot */}
          <div style={{ marginTop: 18, fontSize: 11, color: C.t3 }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.accent, marginRight: 6, verticalAlign: "middle" }} />
            Active in Sleeper lineup this week
          </div>
        </div>
      )}

      {/* Empty state - no league loaded yet */}
      {!leagueData && !loading && !error && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.t3 }}>
          <BoltIcon size={32} color={C.accent} />
          <div style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>No league loaded</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Enter your Sleeper league ID above to see all rosters</div>
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, onClaimRoster }) {
  const [claimed, setClaimed] = useState(false);

  // Split players into starters and bench for visual grouping
  const starters = team.players.filter(p => p.is_starter);
  const bench    = team.players.filter(p => !p.is_starter);

  const handleClaim = () => {
    onClaimRoster(team.players);
    // Brief visual confirmation before the tab switches to roster
    setClaimed(true);
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${claimed ? C.accent : C.border}`, borderRadius: 10, overflow: "hidden", transition: "border-color 0.2s" }}>
      {/* Team header - contains name and the Claim button */}
      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border}`, background: C.raised, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {team.team_name}
          </div>
          {/* Show @username only if it differs from the team name */}
          {team.display_name && team.display_name !== team.team_name && (
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>@{team.display_name}</div>
          )}
        </div>
        {/* Claim button - copies this roster into the user's active lineup */}
        <button
          onClick={handleClaim}
          style={{ background: claimed ? C.accent : "transparent", border: `1px solid ${claimed ? C.accent : C.border}`, color: claimed ? "#fff" : C.t3, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: claimed ? 700 : 400, letterSpacing: 1, flexShrink: 0, transition: "all 0.2s" }}
        >
          {claimed ? "✓ Claimed" : "Use Roster"}
        </button>
      </div>

      {/* Starters section */}
      {starters.length > 0 && (
        <div style={{ padding: "6px 0" }}>
          {starters.map((p, i) => (
            <PlayerRow key={i} player={p} />
          ))}
        </div>
      )}

      {/* Bench section - slightly dimmed to distinguish from starters */}
      {bench.length > 0 && (
        <>
          <div style={{ fontSize: 10, letterSpacing: 1, color: C.t3, padding: "4px 14px 2px", textTransform: "uppercase", borderTop: starters.length > 0 ? `1px solid ${C.border}` : "none", opacity: 0.7 }}>
            Bench
          </div>
          <div style={{ padding: "0 0 6px", opacity: 0.65 }}>
            {bench.map((p, i) => (
              <PlayerRow key={i} player={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PlayerRow({ player }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 14px" }}>
      {/* Position badge */}
      <div style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[player.position] || C.t3, minWidth: 28 }}>
        {player.position}
      </div>
      {/* Player name - truncated if too long */}
      <div style={{ flex: 1, fontSize: 12, color: C.t2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {player.name}
      </div>
      {/* NFL team abbreviation */}
      <div style={{ fontSize: 10, color: C.t3, flexShrink: 0 }}>{player.team}</div>
      {/* Green dot for active starters */}
      {player.is_starter && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
      )}
    </div>
  );
}

function DropModal({ player, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.raised, border: `1px solid ${C.red}`, borderRadius: 12, padding: 28, width: "min(340px, 90vw)", textAlign: "center" }}>
        <div style={{ marginBottom: 12 }}><WarningIcon size={28} color={C.red} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 8 }}>Drop {player.name}?</div>
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 24 }}>This will remove them from your roster permanently.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.t2, padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Cancel</button>
          <button onClick={onConfirm} style={{ background: C.red, border: "none", color: "#fff", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>Drop Player</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [started, setStarted] = useState(false);
  const [userId, setUserId] = useState(null);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [roster, setRoster] = useState([]);
  const [selected, setSelected] = useState(defaultPlayer("", "QB"));
  const [tab, setTab] = useState("roster");
  const [showDetail, setShowDetail] = useState(false);

  const [playerNews, setPlayerNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const [lineupSettings, setLineupSettings] = useState({ QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 0 });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropConfirm, setDropConfirm] = useState(null);
  const searchTimeout = useRef(null);

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", text: "What do you need? I can break down a trade, check a player's projection, or tell you who to start." }
  ]);
  const [loading, setLoading] = useState(false);
  const [streamingIdx, setStreamingIdx] = useState(null);

  const _saveTimer = useRef(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const u = user || (await signInAnonymously(auth)).user;
        setUserId(u.uid);
        const saved = await loadRoster(u.uid);
        if (saved && saved.length > 0) {
          const loaded = saved.map(p => ({ ...defaultPlayer(p.name, p.pos), news: p.news ?? "hold" }));
          setRoster(loaded);
          setSelected(loaded[0]);
        } else {
          const seed = SEED_ROSTER.map(p => defaultPlayer(p.name, p.pos));
          setRoster(seed);
          setSelected(seed[0]);
        }
      } catch {
        const seed = SEED_ROSTER.map(p => defaultPlayer(p.name, p.pos));
        setRoster(seed);
        setSelected(seed[0]);
      }
      setRosterLoaded(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId || !rosterLoaded || roster.length === 0) return;
    if (_saveTimer.current) clearTimeout(_saveTimer.current);
    _saveTimer.current = setTimeout(() => {
      saveRoster(userId, roster).catch(() => {});
    }, 1500);
  }, [roster, userId, rosterLoaded]);

  const _rosterKey = roster.map(p => p.name).join("|");
  useEffect(() => {
    roster.forEach(async (p) => {
      if (p.proj !== null && p.depthChart !== undefined) return;
      try {
        const res = await fetch(`${API}/player/${encodeURIComponent(p.name)}`);
        const data = await res.json();
        if (data.found) {
          const update = {
            proj: data.projected_points,
            sampleWeeks: data.sample_weeks,
            trend: data.trend ?? 0,
            confidence: data.confidence,
            confidenceColor: data.confidence_color ?? C.green,
            factors: data.factors ?? [],
            floor: data.floor ?? null,
            ceiling: data.ceiling ?? null,
            depthChart: data.depth_chart ?? "",
            depthOrder: data.depth_order ?? null,
          };
          setRoster(prev => prev.map(r => r.name === p.name ? { ...r, ...update } : r));
          setSelected(prev => prev.name === p.name ? { ...prev, ...update } : prev);
        }
      } catch { /* projection fetch failed silently */ }
    });
  // _rosterKey is derived from roster names - adding roster directly causes infinite re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_rosterKey]);

  useEffect(() => {
    if (!selected?.name) return;
    setNewsLoading(true);
    fetch(`${API}/news/${encodeURIComponent(selected.name)}`)
      .then(r => r.json())
      .then(data => {
        const articles = Array.isArray(data) ? data : (data.articles ?? []);
        const aiSignal = data.overall_signal ?? null;
        const aiReason = data.signal_reason ?? "";
        setPlayerNews(articles);
        setNewsLoading(false);
        setRoster(prev => prev.map(r => {
          if (r.name !== selected.name) return r;
          const news = aiSignal ?? combineSignal(getNewsSig(articles), r.trend ?? 0);
          return { ...r, news, signalReason: aiReason };
        }));
        setSelected(prev => {
          if (prev.name !== selected.name) return prev;
          const news = aiSignal ?? combineSignal(getNewsSig(articles), prev.trend ?? 0);
          return { ...prev, news, signalReason: aiReason };
        });
      })
      .catch(() => { setPlayerNews([]); setNewsLoading(false); });
  }, [selected.name]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        const rosterNames = roster.map(p => p.name.toLowerCase());
        setSearchResults(data.filter(p => !rosterNames.includes(p.player.toLowerCase())));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, searchQuery.length < 2 ? 0 : 400);
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
      confidenceColor: addingPlayer.confidence_color ?? C.green,
      factors: addingPlayer.factors ?? [],
      sampleWeeks: addingPlayer.sample_weeks ?? null,
      depthChart: addingPlayer.depth_chart ?? "",
      depthOrder: addingPlayer.depth_order ?? null,
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
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setLoading(true);
    // Prepend the Sleeper league ID when available so the AI can call get_sleeper_rosters
    const sleeperLeagueId = localStorage.getItem("sleeperLeagueId");
    const leagueContext = sleeperLeagueId
      ? `My Sleeper league ID is ${sleeperLeagueId}. `
      : "";
    const fullMsg = `${leagueContext}My current roster: ${roster.map(p => `${p.name} (${p.pos}, proj: ${p.proj ?? "loading"}pts)`).join(", ")}\n\nUser question: ${userMsg}`;
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
      setMessages(m => { const next = [...m, { role: "ai", text: data.response }]; setStreamingIdx(next.length - 1); return next; });
    } catch {
      setMessages(m => { const next = [...m, { role: "ai", text: "Could not reach backend." }]; setStreamingIdx(next.length - 1); return next; });
    }
    setLoading(false);
  };

  // Convert a Sleeper team's player list into the app's roster format and switch to the roster tab.
  // DEF players are skipped since the rest of the app only handles offensive positions + K.
  const handleClaimRoster = (sleeperPlayers) => {
    const newRoster = sleeperPlayers
      .filter(p => ["QB", "RB", "WR", "TE", "K"].includes(p.position))
      .map(p => defaultPlayer(p.name, p.position));
    setRoster(newRoster);
    setSelected(newRoster[0] || defaultPlayer("", "QB"));
    setTab("roster");
  };

  if (!started) return <WelcomePage onStart={() => setStarted(true)} />;

  if (!rosterLoaded) return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: C.bg, height: "100dvh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
      <BoltIcon size={28} color={C.accent} />
      <div style={{ fontSize: 11, color: C.accent, letterSpacing: 3 }}>LOADING YOUR ROSTER...</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, animation: `pulse 1s ${i * 0.2}s infinite` }} />)}
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: C.bg, height: "100vh", width: "100vw", color: C.t1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; }
        @media (max-width: 767px) { html, body, #root { height: 100dvh; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        .blitz-font { font-family: 'Barlow Condensed', sans-serif; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .slide-in { animation: slideIn 0.2s ease; }
        .player-row:hover { background: ${C.hover} !important; }
        .search-result:hover { background: ${C.hover} !important; }
        input:focus { outline: none; border-color: ${C.accent} !important; }
        button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
        a:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; border-radius: 2px; }
        .chat-chip:hover { border-color: ${C.accent} !important; color: ${C.accent} !important; }
      `}</style>

      {dropConfirm && <DropModal player={dropConfirm} onConfirm={handleDropConfirm} onCancel={() => setDropConfirm(null)} />}

      {addingPlayer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, width: "min(440px, 95vw)" }} className="slide-in">
            <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>Add Player</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{addingPlayer.player}</div>
            <div style={{ fontSize: 12, color: C.t3, marginBottom: 20 }}>
              {addingPlayer.position} · {addingPlayer.team} · {addingPlayer.projected_points} proj pts
            </div>
            <div style={{ fontSize: 11, letterSpacing: 1, color: C.t3, marginBottom: 12, textTransform: "uppercase" }}>Drop a player (optional)</div>
            <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 20 }}>
              {roster.map(p => (
                <div key={p.name} onClick={() => setDropTarget(dropTarget?.name === p.name ? null : p)} className="search-result"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 6, cursor: "pointer", marginBottom: 4, background: dropTarget?.name === p.name ? "#1a3a28" : "transparent", border: `1px solid ${dropTarget?.name === p.name ? C.accent : "transparent"}`, transition: "all 0.15s" }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 3, padding: "2px 7px", fontSize: 11, color: C.accent, minWidth: 28, textAlign: "center" }}>{p.pos}</div>
                  <div style={{ flex: 1, fontSize: 13, color: C.t2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.amber }}>{p.proj ?? "-"} pts</div>
                  {dropTarget?.name === p.name && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>Drop</div>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setAddingPlayer(null); setDropTarget(null); }} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.t2, padding: "10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Cancel</button>
              <button onClick={confirmAdd} style={{ flex: 2, background: C.accent, border: "none", color: "#fff", padding: "10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                {dropTarget ? `Add & Drop ${dropTarget.name.split(" ")[1] || dropTarget.name}` : "Add to Roster"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: isMobile ? "10px 14px" : "14px 24px", display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, background: C.bg, flexShrink: 0 }}>
        <button onClick={() => setStarted(false)} title="Back to home" style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.t3, cursor: "pointer", fontSize: 11, padding: "8px 14px", fontFamily: "inherit", letterSpacing: 1, flexShrink: 0, minHeight: 36 }}>← Home</button>
        <BoltIcon size={isMobile ? 18 : 22} color={C.accent} />
        {!isMobile && <div>
          <div className="blitz-font" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, color: C.accent }}>BLITZ</div>
          <div style={{ fontSize: 11, color: C.t3, letterSpacing: 2 }}>FANTASY FOOTBALL ASSISTANT</div>
        </div>}
        {isMobile && <div className="blitz-font" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: C.accent }}>BLITZ</div>}
        <div style={{ marginLeft: "auto", display: "flex", gap: isMobile ? 4 : 8 }}>
          {["roster", "players", "lineup", "league", "chat"].map(t => (
            <button key={t} onClick={() => { setTab(t); setShowDetail(false); }} className="blitz-font" style={{ background: tab === t ? C.accent : "transparent", border: `1px solid ${tab === t ? C.accent : C.border}`, color: tab === t ? "#fff" : C.t3, padding: isMobile ? "6px 10px" : "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: isMobile ? 10 : 11, letterSpacing: 1, textTransform: "uppercase", transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── ROSTER TAB ── */}
      {tab === "roster" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "320px 1fr", height: "calc(100dvh - 57px)", overflow: "hidden" }}>
          <div style={{ borderRight: `1px solid ${C.border}`, overflowY: "auto", background: C.surface, display: isMobile && showDetail ? "none" : "block" }}>
            <div style={{ padding: "12px 16px", fontSize: 11, letterSpacing: 2, color: C.t3, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", textTransform: "uppercase" }}>
              <span>Roster - {roster.length} Players</span>
              <button onClick={() => setTab("players")} style={{ background: C.accent, border: "none", color: "#fff", padding: "4px 10px", borderRadius: 3, cursor: "pointer", fontSize: 11, fontFamily: "inherit", letterSpacing: 1 }}>+ Add</button>
            </div>
            {roster.map(p => (
              <div key={p.name} onClick={() => { setSelected(p); if (isMobile) setShowDetail(true); }} className="player-row"
                style={{ padding: "14px 16px", borderBottom: `1px solid ${C.surface}`, cursor: "pointer", background: selected.name === p.name ? C.raised : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: C.accent, minWidth: 32, textAlign: "center" }}>{p.pos}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: selected.name === p.name ? C.t1 : C.t2 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                    Proj: <span style={{ color: C.amber }}>{p.proj ?? "..."}</span>
                    <span style={{ color: p.trend >= 0 ? C.green : C.red, marginLeft: 8 }}>{p.trend >= 0 ? "+" : ""}{p.trend}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: newsColors[p.news || "hold"], fontWeight: 600 }}>{newsLabels[p.news || "hold"]}</span>
                  <button onClick={e => { e.stopPropagation(); setDropConfirm(p); }}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.t3, padding: "6px 10px", borderRadius: 3, cursor: "pointer", fontSize: 11, fontFamily: "inherit", minHeight: isMobile ? 44 : 30 }}>Drop</button>
                </div>
              </div>
            ))}
          </div>

          {/* Player detail */}
          <div style={{ padding: isMobile ? 16 : 28, overflowY: "auto", display: isMobile && !showDetail ? "none" : "block" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 36 }}>
              <div style={{ flex: 1 }}>
                {isMobile && <button onClick={() => setShowDetail(false)} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 12, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1, marginBottom: 12, padding: "8px 0", minHeight: 44, display: "block" }}>← Back to Roster</button>}
                <div className="blitz-font" style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: C.t1, letterSpacing: -1 }}>{selected.name}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.accent, padding: "3px 10px", borderRadius: 3, fontSize: 12 }}>{selected.pos}</span>
                  {selected.depthChart && (
                    <span style={{ background: C.raised, border: `1px solid ${C.border}`, color: selected.depthOrder === 1 ? C.green : selected.depthOrder === 2 ? C.amber : C.t3, padding: "3px 10px", borderRadius: 3, fontSize: 12 }}>{selected.depthChart}</span>
                  )}
                  <span style={{ background: C.raised, border: `1px solid ${newsColors[selected.news || "hold"]}`, color: newsColors[selected.news || "hold"], padding: "3px 10px", borderRadius: 3, fontSize: 12 }}>{newsLabels[selected.news || "hold"]}</span>
                </div>
                {selected.signalReason && (
                  <div style={{ fontSize: 13, color: C.t2, marginTop: 6, lineHeight: 1.5 }}>{selected.signalReason}</div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {selected.proj != null
                  ? <div className="blitz-font" style={{ fontSize: isMobile ? 32 : 42, fontWeight: 700, color: C.accent, letterSpacing: -2 }}>{selected.proj}</div>
                  : <div style={{ height: isMobile ? 38 : 50, width: 80, background: C.raised, borderRadius: 6, animation: "pulse 1.5s infinite", marginLeft: "auto" }} />
                }
                <div style={{ fontSize: 11, color: C.t3, letterSpacing: 1, textTransform: "uppercase" }}>Projected pts</div>
                {selected.proj && (
                  <div style={{ fontSize: 12, color: selected.trend >= 0 ? C.green : C.red, marginTop: 4 }}>
                    {selected.trend >= 0 ? "▲" : "▼"} {Math.abs(selected.trend)} vs season avg
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 20 : 32 }}>
              {[
                { label: "Based on",   value: selected.sampleWeeks,                              color: C.t2 },
                { label: "Confidence", value: selected.confidence,                               color: selected.confidenceColor || C.t2 },
                { label: "Floor",      value: selected.floor != null ? selected.floor : null,    color: C.t2 },
                { label: "Ceiling",    value: selected.ceiling != null ? selected.ceiling : null, color: C.t2 },
              ].map(stat => (
                <div key={stat.label} style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px" }}>
                  <div style={{ fontSize: 11, color: C.t3, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{stat.label}</div>
                  {stat.value != null
                    ? <div className="blitz-font" style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    : <div style={{ height: 28, width: "60%", background: C.border, borderRadius: 4, animation: "pulse 1.5s infinite" }} />
                  }
                </div>
              ))}
            </div>

            {(selected.factors || []).length > 0 && (
              <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 20px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: C.t3, marginBottom: 18, textTransform: "uppercase" }}>Projection Factors</div>
                {(selected.factors || []).map(s => {
                  const maxImpact = Math.max(...(selected.factors || []).map(f => Math.abs(f.impact)), 1);
                  return (
                    <div key={s.factor} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: C.t2, width: isMobile ? 120 : 180, flexShrink: 0 }}>{s.factor}</div>
                      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.abs(s.impact) / maxImpact * 100}%`, background: s.impact >= 0 ? C.green : C.red, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 12, color: s.impact >= 0 ? C.green : C.red, width: 44, textAlign: "right" }}>{s.impact >= 0 ? "+" : ""}{s.impact}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 20px 28px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: C.t3, marginBottom: 20, textTransform: "uppercase" }}>Recent News & Signals</div>
              {newsLoading && <div style={{ fontSize: 12, color: C.t3, letterSpacing: 1 }}>Loading news...</div>}
              {!newsLoading && playerNews.length === 0 && (
                <div style={{ fontSize: 12, color: C.t3 }}>No recent news found for {selected.name}.</div>
              )}
              {!newsLoading && playerNews.map((n, i) => {
                const timeAgo = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                return (
                  <div key={i} style={{ borderLeft: `2px solid ${newsColors[n.signal]}`, paddingLeft: 14, marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{n.source}</span>
                      <span style={{ fontSize: 11, color: C.t3 }}>{timeAgo}</span>
                      <span style={{ fontSize: 11, color: newsColors[n.signal], marginLeft: "auto" }}>{newsLabels[n.signal]}</span>
                    </div>
                    <a href={n.url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: C.t2, lineHeight: 1.5, textDecoration: "none", display: "block" }}
                      onMouseOver={e => e.currentTarget.style.color = C.t1}
                      onMouseOut={e => e.currentTarget.style.color = C.t2}>
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
      {tab === "players" && (
        <div style={{ padding: isMobile ? 14 : 28, maxWidth: 800, margin: "0 auto", overflowY: "auto", height: "calc(100dvh - 57px)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: C.t3, marginBottom: 20, textTransform: "uppercase" }}>Players - Search & Add</div>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", lineHeight: 0 }}><SearchIcon size={16} color={C.t3} /></div>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for any NFL player (e.g. Jaylen Waddle, Davante Adams...)"
              style={{ width: "100%", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px 14px 46px", color: C.t1, fontSize: 13, fontFamily: "inherit" }}
              autoFocus />
            {searching && <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.accent, letterSpacing: 1 }}>Searching...</div>}
          </div>
          {searchResults.length > 0 && (
            <div className="slide-in">
              <div style={{ fontSize: 11, letterSpacing: 1, color: C.t3, marginBottom: 12 }}>{searchResults.length} players found</div>
              <div style={{ display: "grid", gap: 8 }}>
                {searchResults.map((p, i) => (
                  <div key={i} className="search-result"
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: C.raised, border: `1px solid ${C.border}`, borderRadius: 8, transition: "background 0.15s" }}>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: C.accent, minWidth: 36, textAlign: "center" }}>{p.position}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{p.player}</div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>
                        {p.team} · Floor: {p.floor} · Ceiling: {p.ceiling} · {p.games_sampled} games
                      </div>
                    </div>
                    <div style={{ textAlign: "right", marginRight: isMobile ? 0 : 16 }}>
                      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: C.amber }}>{p.projected_points}</div>
                      <div style={{ fontSize: 11, color: C.t3, letterSpacing: 1 }}>proj pts</div>
                    </div>
                    <button onClick={() => handleAddPlayer(p)}
                      style={{ background: C.accent, border: "none", color: "#fff", padding: isMobile ? "8px 12px" : "8px 18px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>No players found for "{searchQuery}".</div>
          )}
          {!searchQuery && (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ marginBottom: 12 }}><BoltIcon size={32} color={C.accent} /></div>
              <div style={{ fontSize: 13, color: C.t3 }}>Type a name to search</div>
              <div style={{ fontSize: 11, color: C.t3, opacity: 0.5, marginTop: 8 }}>2022–2025 NFL data</div>
            </div>
          )}
        </div>
      )}

      {/* ── LINEUP TAB ── */}
      {tab === "lineup" && (() => {
        const SLOT_CONFIG = [
          { key: "QB",   label: "QB",   min: 1, max: 2 },
          { key: "RB",   label: "RB",   min: 1, max: 4 },
          { key: "WR",   label: "WR",   min: 1, max: 5 },
          { key: "TE",   label: "TE",   min: 0, max: 2 },
          { key: "FLEX", label: "FLEX", min: 0, max: 3 },
          { key: "K",    label: "K",    min: 0, max: 1 },
        ];

        const buildLineup = () => {
          const byPos = {};
          roster.forEach(p => {
            if (!byPos[p.pos]) byPos[p.pos] = [];
            byPos[p.pos].push(p);
          });
          Object.keys(byPos).forEach(pos => byPos[pos].sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0)));

          const starters = [];
          const used = new Set();

          const fill = (pos, count, slotKey) => {
            const avail = (byPos[pos] || []).filter(p => !used.has(p.name));
            for (let i = 0; i < count; i++) {
              const slot = count === 1 ? slotKey : `${slotKey}${i + 1}`;
              if (i < avail.length) { starters.push({ player: avail[i], slot }); used.add(avail[i].name); }
              else starters.push({ player: null, slot });
            }
          };

          fill("QB",  lineupSettings.QB,  "QB");
          fill("RB",  lineupSettings.RB,  "RB");
          fill("WR",  lineupSettings.WR,  "WR");
          fill("TE",  lineupSettings.TE,  "TE");

          const flexEligible = roster
            .filter(p => ["RB","WR","TE"].includes(p.pos) && !used.has(p.name))
            .sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));
          for (let i = 0; i < lineupSettings.FLEX; i++) {
            const slot = lineupSettings.FLEX === 1 ? "FLEX" : `FLEX${i + 1}`;
            if (i < flexEligible.length) { starters.push({ player: flexEligible[i], slot }); used.add(flexEligible[i].name); }
            else starters.push({ player: null, slot });
          }

          fill("K",   lineupSettings.K,   "K");

          const bench = roster.filter(p => !used.has(p.name));
          return { starters, bench };
        };

        const { starters, bench } = buildLineup();
        const totalProj = starters.reduce((s, { player }) => s + (player?.proj ?? 0), 0);

        return (
          <div style={{ padding: isMobile ? 14 : 28, maxWidth: 700, margin: "0 auto", overflowY: "auto", height: "calc(100dvh - 57px)" }}>
            {/* League format settings */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: C.t3, marginBottom: 14, textTransform: "uppercase" }}>League Format</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 12 }}>
                {SLOT_CONFIG.map(({ key, label, min, max }) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
                    <div style={{ fontSize: 10, color: C.t3, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
                    <select
                      value={lineupSettings[key]}
                      onChange={e => setLineupSettings(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                      style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.t1, padding: "6px 0", borderRadius: 4, fontSize: 14, fontFamily: "inherit", cursor: "pointer", width: 52, textAlign: "center" }}
                    >
                      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {roster.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: C.t3 }}>Add players to your roster to build a lineup.</div>
            ) : (
              <>
                {starters.map(({ player, slot }, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 20px", background: player ? C.raised : C.surface, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 6, opacity: player ? 1 : 0.45 }}>
                    <div className="blitz-font" style={{ width: 52, fontSize: 11, color: C.accent, letterSpacing: 1 }}>{slot}</div>
                    {player ? (
                      <>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.t1, fontWeight: 500 }}>{player.name}</div>
                          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{player.pos}</div>
                        </div>
                        <div style={{ fontSize: 12, color: player.trend >= 0 ? C.green : C.red, marginRight: 8 }}>{player.trend >= 0 ? "▲" : "▼"} {Math.abs(player.trend)}</div>
                        <div className="blitz-font" style={{ fontSize: 20, fontWeight: 700, color: C.accent, minWidth: 36, textAlign: "right" }}>{player.proj ?? "-"}</div>
                      </>
                    ) : (
                      <div style={{ flex: 1, fontSize: 13, color: C.t3 }}>Empty - add a {slot.replace(/\d/g, "").trim()} to your roster</div>
                    )}
                  </div>
                ))}

                <div style={{ margin: "16px 0 28px", padding: "14px 20px", background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: C.t3, letterSpacing: 1, textTransform: "uppercase" }}>Total Projected</span>
                  <span className="blitz-font" style={{ fontSize: 28, fontWeight: 700, color: C.accent }}>{totalProj.toFixed(1)} pts</span>
                </div>

                {bench.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: C.t3, marginBottom: 10, textTransform: "uppercase" }}>Bench</div>
                    {bench.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 20px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 6 }}>
                        <div style={{ width: 52, fontSize: 11, color: C.t3, letterSpacing: 1 }}>{p.pos}</div>
                        <div style={{ flex: 1, fontSize: 13, color: C.t2 }}>{p.name}</div>
                        <div className="blitz-font" style={{ fontSize: 16, fontWeight: 600, color: C.t3 }}>{p.proj ?? "-"}</div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ── LEAGUE TAB ── */}
      {tab === "league" && <LeagueTab isMobile={isMobile} onClaimRoster={handleClaimRoster} />}

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 57px)" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: isMobile ? "88%" : "72%", background: m.role === "user" ? C.accent : C.raised, border: `1px solid ${m.role === "user" ? C.accent : C.border}`, borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, color: m.role === "user" ? "#fff" : C.t2 }}>
                  {m.role === "ai" && <div className="blitz-font" style={{ fontSize: 11, color: C.accent, letterSpacing: 2, marginBottom: 6 }}>BLITZ</div>}
                  {m.role === "ai"
                    ? (i === streamingIdx ? <TypewriterMessage text={m.text} /> : <SimpleMarkdown text={m.text} />)
                    : m.text}
                </div>
              </div>
            ))}
            {messages.length === 1 && !loading && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
                {[
                  "Who should I start this week?",
                  "Analyze a trade for me",
                  "Who should I pick up on waivers?",
                  "What's my team's projected score?",
                ].map(chip => (
                  <button key={chip} onClick={() => { setChatInput(chip); }}
                    className="chat-chip"
                    style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 20, padding: "7px 14px", color: C.t3, fontSize: 13, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                    {chip}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px" }}>
                <BoltIcon size={14} color={C.accent} />
                <span style={{ fontSize: 11, color: C.accent, letterSpacing: 2 }} className="pulse">BLITZ IS THINKING...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: isMobile ? "10px 12px" : 16, display: "flex", gap: 10, background: C.bg }}>
            <button
              onClick={() => { setMessages([{ role: "ai", text: "What do you need? I can break down a trade, check a player's projection, or tell you who to start." }]); apiHistoryRef.current = []; }}
              disabled={loading}
              style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", color: C.t3, fontSize: 12, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer", flexShrink: 0, opacity: loading ? 0.4 : 1, transition: "opacity 0.2s", whiteSpace: "nowrap" }}>
              Clear Chat
            </button>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && sendMessage()}
              placeholder="Ask about a player, trade, or lineup..."
              disabled={loading}
              style={{ flex: 1, background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", color: C.t1, fontSize: 13, fontFamily: "inherit", opacity: loading ? 0.6 : 1 }} />
            <button onClick={sendMessage} disabled={loading}
              style={{ background: C.accent, border: "none", borderRadius: 6, padding: "10px 20px", color: "#fff", fontSize: 12, fontFamily: "inherit", letterSpacing: 1, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
