import { useState, useMemo, createContext, useContext, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, setAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Star, Swords, Sparkles, Users, SlidersHorizontal,
  Moon, Sun, TrendingUp, CheckCircle2, X, Flame, Zap, Search,
  Shuffle, ArrowLeft, ChevronDown, ChevronUp, Globe, Plus, Loader2,
  LogIn, LogOut, UserPlus, PenLine, BarChart2, Tag, Wand2, Compass, RefreshCw,
  Headphones, Rss, Download, ExternalLink, Library
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CommunityRating {
  avg: number;
  count: number;
  raters: { username: string; rating: number }[];
}
interface BookData {
  id: number;
  title: string;
  author: string;
  genre: string;
  subgenres: string[];
  description: string;
  martialArtsScore: number;
  magicScore: number;
  characterScore: number;
  seriesName: string | null;
  seriesBook: number | null;
  coverColor: string;
  coverAccent: string;
  publishYear: number | null;
  tags: string[];
  userRating: { id: number; bookId: number; userId: number; rating: number; notes: string | null } | null;
  communityRating: CommunityRating | null;
  score?: number;
}

// ─── Auth Context ─────────────────────────────────────────────────────────────
interface AuthUser { userId: number; username: string; token: string; }
interface AuthCtx { user: AuthUser | null; login: (u: AuthUser) => void; logout: () => void; }
const AuthContext = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const login = (u: AuthUser) => { setAuthToken(u.token); setUser(u); queryClient.invalidateQueries(); };
  const logout = () => { setAuthToken(null); setUser(null); queryClient.invalidateQueries(); };

  // Restore session from cookie on mount — read cookie directly, no dynamic import
  useEffect(() => {
    // Read the token directly from the cookie (same logic as queryClient.ts)
    const match = document.cookie.match(/(?:^|;\s*)bap_token=([^;]*)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    if (!token) return;
    // Validate against server — if token is good, restore the session silently
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.userId) {
          setAuthToken(token); // ensure in-memory token matches
          setUser({ userId: data.userId, username: data.username, token });
          queryClient.invalidateQueries();
        }
      })
      .catch(() => {});
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CORE_GENRES = ["wuxia", "cultivation", "litrpg", "urban", "high_fantasy", "progression"];

const GENRE_LABELS: Record<string, string> = {
  wuxia: "Wuxia", cultivation: "Cultivation", litrpg: "LitRPG",
  urban: "Urban Fantasy", urban_fantasy: "Urban Fantasy",
  high_fantasy: "High Fantasy", progression: "Progression",
};
function getGenreLabel(g: string) {
  return GENRE_LABELS[g] || g.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function genreClass(g: string) {
  const map: Record<string, string> = {
    wuxia: "genre-wuxia", cultivation: "genre-cultivation", litrpg: "genre-litrpg",
    urban: "genre-urban", urban_fantasy: "genre-urban", high_fantasy: "genre-high_fantasy",
    progression: "genre-progression",
  };
  return map[g] || "border-border/50 text-muted-foreground bg-muted/20";
}

const SORT_OPTIONS = [
  { key: "default", label: "Default" }, { key: "title", label: "A→Z" },
  { key: "community", label: "Community Rating" }, { key: "rating", label: "My Rating" },
  { key: "martial", label: "Combat" }, { key: "magic", label: "Magic" },
  { key: "character", label: "Character" }, { key: "year", label: "Year" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inferGenreFromTags(tags: string[], genre?: string): string {
  if (genre) return genre.toLowerCase().replace(/ /g, "_");
  const s = tags.join(" ").toLowerCase();
  if (s.includes("wuxia") || s.includes("martial arts") || s.includes("kung fu")) return "wuxia";
  if (s.includes("litrpg") || s.includes("game") || s.includes("dungeon")) return "litrpg";
  if (s.includes("urban") || s.includes("contemporary")) return "urban";
  if (s.includes("cultivation") || s.includes("xianxia") || s.includes("immortal")) return "cultivation";
  if (s.includes("progression")) return "progression";
  return "high_fantasy";
}
function pickCoverColors(genre: string) {
  const map: Record<string, [string, string]> = {
    wuxia: ["#0f2027", "#c94b4b"], cultivation: ["#0d1b2a", "#56a0d3"],
    litrpg: ["#0a1628", "#7c3aed"], urban: ["#1a1a2e", "#e94560"],
    urban_fantasy: ["#1a1a2e", "#e94560"], progression: ["#0f1b0f", "#22c55e"],
    high_fantasy: ["#1e1433", "#c8973a"],
  };
  const [c, a] = map[genre] || ["#1a1a2e", "#c8973a"];
  return { coverColor: c, coverAccent: a };
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const base = ("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__");
      const res = await fetch(base + "/api/auth/signin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      login({ userId: data.userId, username: data.username, token: data.token });
      toast({ title: `Welcome, ${data.username}!`, description: "You're signed in — your token is saved permanently." });
      onClose();
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setEmail(""); setError(""); } }}>
      <DialogContent className="max-w-sm bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn size={16} className="text-primary" />
            Sign In
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Enter your email — we'll remember you permanently. No password needed.
        </p>
        <div className="space-y-3 mt-1">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Email address</label>
            <Input
              data-testid="auth-email"
              autoFocus
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-9 text-sm"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button data-testid="auth-submit" className="w-full gap-2" onClick={submit} disabled={loading || !email.trim()}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            Continue
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            New here? Just enter your email — your account is created automatically.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual Add Book Modal ────────────────────────────────────────────────────
function AddBookModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const blank = {
    title: "", author: "", genre: "", description: "", tagsRaw: "",
    martialArtsScore: 3, magicScore: 3, characterScore: 3,
    seriesName: "", publishYear: "",
  };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof blank, v: any) => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!f.title.trim() || !f.author.trim()) {
      toast({ title: "Title and author are required.", variant: "destructive" }); return;
    }
    setSaving(true);
    const tagsArr = f.tagsRaw.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const genreKey = inferGenreFromTags(tagsArr, f.genre.trim() || undefined);
    const colors = pickCoverColors(genreKey);
    const payload = {
      title: f.title.trim(), author: f.author.trim(),
      genre: genreKey, subgenres: JSON.stringify([genreKey]),
      description: f.description.trim() || "Added manually.",
      martialArtsScore: f.martialArtsScore, magicScore: f.magicScore, characterScore: f.characterScore,
      seriesName: f.seriesName.trim() || null, seriesBook: null,
      coverColor: colors.coverColor, coverAccent: colors.coverAccent,
      publishYear: f.publishYear ? parseInt(f.publishYear) : null,
      tags: JSON.stringify(tagsArr.length ? tagsArr : [genreKey]),
    };
    try {
      await apiRequest("POST", "/api/books", payload);
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/free-books"] });
      toast({ title: "Book added!", description: `"${f.title}" is now in the library.` });
      setF(blank);
      onClose();
    } catch (e: any) {
      toast({ title: "Failed to add book", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const ScoreRow = ({ label, icon, k, color }: { label: string; icon: React.ReactNode; k: "martialArtsScore" | "magicScore" | "characterScore"; color: string }) => (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-28 flex-shrink-0">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => set(k, n)}
            className="w-6 h-6 rounded-full transition-all border"
            style={{ background: n <= f[k] ? color : "transparent", borderColor: n <= f[k] ? color : "hsl(var(--border))" }} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground font-mono ml-1">{f[k]}/5</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border/60 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine size={16} className="text-primary" /> Add a Book
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Manually add any book. Genre and tags drive the recommendation engine — be descriptive.</p>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Title *</label>
              <Input data-testid="add-title" value={f.title} onChange={e => set("title", e.target.value)} className="h-9 text-sm" placeholder="Book title" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Author *</label>
              <Input data-testid="add-author" value={f.author} onChange={e => set("author", e.target.value)} className="h-9 text-sm" placeholder="Author name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1">
                <Wand2 size={11} /> Genre <span className="text-muted-foreground font-normal">(auto-detected if blank)</span>
              </label>
              <Input data-testid="add-genre" value={f.genre} onChange={e => set("genre", e.target.value)}
                className="h-9 text-sm" placeholder="e.g. slice of life, romance, sci-fi" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Series Name</label>
              <Input value={f.seriesName} onChange={e => set("seriesName", e.target.value)} className="h-9 text-sm" placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1">
              <Tag size={11} /> Tags <span className="text-muted-foreground font-normal">(comma-separated — these power recommendations)</span>
            </label>
            <Input data-testid="add-tags" value={f.tagsRaw} onChange={e => set("tagsRaw", e.target.value)}
              className="h-9 text-sm" placeholder="e.g. martial arts, character dev, slice of life, slow burn, found family" />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Description</label>
            <Textarea value={f.description} onChange={e => set("description", e.target.value)}
              className="text-sm resize-none" rows={3} placeholder="Short description of the book..." />
          </div>

          <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-xs font-medium text-foreground">Rate the key attributes (influences recommendations)</p>
            <ScoreRow label="Combat / Martial" icon={<Swords size={12} className="text-red-400" />} k="martialArtsScore" color="#f87171" />
            <ScoreRow label="Magic Depth" icon={<Sparkles size={12} className="text-purple-400" />} k="magicScore" color="#c084fc" />
            <ScoreRow label="Character Dev" icon={<Users size={12} className="text-blue-400" />} k="characterScore" color="#60a5fa" />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Publish Year</label>
            <Input value={f.publishYear} onChange={e => set("publishYear", e.target.value)} className="h-9 text-sm w-32" placeholder="e.g. 2022" type="number" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button data-testid="add-book-save" className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add to Library
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Book Cover ───────────────────────────────────────────────────────────────
function BookCover({ book, size = "md" }: { book: BookData; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "w-28 h-40" : size === "md" ? "w-20 h-28" : "w-12 h-16";
  return (
    <div className={`${dims} rounded-md flex-shrink-0 relative overflow-hidden book-cover`}
      style={{ background: `linear-gradient(135deg, ${book.coverColor} 0%, ${book.coverAccent}55 100%)`,
        boxShadow: `0 4px 16px ${book.coverAccent}33` }}>
      <div className="absolute left-2 top-0 bottom-0 w-px opacity-30" style={{ background: book.coverAccent }} />
      {size !== "sm" && (
        <div className="absolute inset-0 flex flex-col justify-end p-1.5">
          <p className={`${size === "lg" ? "text-xs" : "text-[9px]"} font-bold leading-tight text-white/90 line-clamp-3`}
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{book.title}</p>
        </div>
      )}
      <div className="absolute inset-0 opacity-10" style={{ background: `linear-gradient(135deg, transparent 30%, ${book.coverAccent} 50%, transparent 70%)` }} />
    </div>
  );
}

// ─── Score Dots ───────────────────────────────────────────────────────────────
function ScoreDots({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-2 h-2 rounded-full transition-all"
          style={{ background: i < score ? color : "hsl(var(--border))" }} />
      ))}
    </div>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false, size: starSize = 18 }: { value: number; onChange?: (v: number) => void; readonly?: boolean; size?: number }) {
  const [hovered, setHovered] = useState(0);
  const display = readonly ? value : (hovered || value);
  const gapClass = starSize >= 28 ? "gap-0" : "gap-0.5";
  return (
    <div className={`flex ${gapClass} w-full`} onMouseLeave={() => !readonly && setHovered(0)}>
      {Array.from({ length: 10 }).map((_, i) => (
        <button key={i} data-testid={`star-${i + 1}`} disabled={readonly}
          className={`transition-all flex items-center justify-center ${starSize >= 28 ? "flex-1" : ""} ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
          onMouseEnter={() => !readonly && setHovered(i + 1)}
          onClick={() => onChange?.(i + 1)}>
          <Star size={starSize} className={i < display ? "text-yellow-400" : "text-muted-foreground/30"} fill={i < display ? "currentColor" : "none"} />
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-xs text-muted-foreground font-mono">{value}/10</span>}
    </div>
  );
}

// ─── Community Raters Chip ────────────────────────────────────────────────────
function CommunityBadge({ cr, onClick }: { cr: CommunityRating; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all">
      <BarChart2 size={10} />
      <span className="text-[10px] font-semibold">{cr.avg.toFixed(1)}</span>
      <span className="text-[9px] text-yellow-400/60">({cr.count})</span>
    </button>
  );
}

// ─── Mini Book Row (sidebar) ──────────────────────────────────────────────────
function MiniBookRow({ book, onRate, onSimilar }: { book: BookData; onRate: (b: BookData) => void; onSimilar?: (b: BookData) => void }) {
  return (
    <div data-testid={`mini-book-${book.id}`}
      className="flex gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-all cursor-pointer group"
      onClick={() => onRate(book)}>
      <BookCover book={book} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">{book.title}</p>
        <p className="text-[10px] text-muted-foreground">{book.author}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${genreClass(book.genre)}`}>
            {getGenreLabel(book.genre)}
          </span>
          {book.communityRating && (
            <span className="text-[9px] text-yellow-400 font-semibold flex items-center gap-0.5">
              <Star size={8} fill="currentColor" /> {book.communityRating.avg.toFixed(1)}
            </span>
          )}
          {onSimilar && (
            <button data-testid={`find-similar-mini-${book.id}`}
              onClick={(e) => { e.stopPropagation(); onSimilar(book); }}
              className="text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
              <Shuffle size={9} /> similar
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-1">
          <div className="flex items-center gap-0.5"><Swords size={9} className="text-red-400" /><ScoreDots score={book.martialArtsScore} color="#f87171" /></div>
          <div className="flex items-center gap-0.5"><Users size={9} className="text-blue-400" /><ScoreDots score={book.characterScore} color="#60a5fa" /></div>
        </div>
        {book.userRating && <StarRating value={book.userRating.rating} readonly />}
      </div>
    </div>
  );
}

// ─── Book Card ────────────────────────────────────────────────────────────────
function BookCard({ book, onRate, onQuickRate, onSimilar, onCommunity, forYou }: {
  book: BookData; onRate: (b: BookData) => void;
  onQuickRate: (bookId: number, rating: number) => void;
  onSimilar: (b: BookData) => void; onCommunity: (b: BookData) => void;
  forYou?: boolean;
}) {
  const isRead = !!book.userRating;
  const [expanded, setExpanded] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);
  const [saving, setSaving] = useState(false);

  return (
    <div data-testid={`book-card-${book.id}`}
      onClick={() => onRate(book)}
      className={`relative rounded-xl border p-4 flex gap-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md cursor-pointer group ${isRead ? "read-overlay" : "bg-card border-border/50"} ${forYou ? "ring-1 ring-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]" : ""}`}>
      {forYou && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-900/40 border border-cyan-600/30">
          <Compass size={10} className="text-cyan-400" />
          <span className="text-[9px] font-semibold text-cyan-300">For You</span>
        </div>
      )}
      {isRead && <div className="absolute top-3 right-3 z-10"><CheckCircle2 size={16} className="text-primary" /></div>}

      <div className="flex-shrink-0">
        <BookCover book={book} size="md" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div>
          <h3 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors pr-5">{book.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>
          {book.seriesName && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
              {book.seriesName}{book.seriesBook ? ` #${book.seriesBook}` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${genreClass(book.genre)}`}>
            {getGenreLabel(book.genre)}
          </span>
          {book.subgenres.filter(s => s !== book.genre).slice(0, 1).map(s => (
            <span key={s} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border opacity-60 ${genreClass(s)}`}>
              {getGenreLabel(s)}
            </span>
          ))}
          {book.communityRating && (
            <CommunityBadge cr={book.communityRating} onClick={() => onCommunity(book)} />
          )}
        </div>

        <div>
          <p className={`text-xs text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {book.description}
          </p>
          {book.description.length > 120 && (
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-[10px] text-primary/60 hover:text-primary mt-0.5 flex items-center gap-0.5">
              {expanded ? <><ChevronUp size={10} /> less</> : <><ChevronDown size={10} /> more</>}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5"><Swords size={11} className="text-red-400 flex-shrink-0" /><ScoreDots score={book.martialArtsScore} color="#f87171" /></div>
          <div className="flex items-center gap-1.5"><Sparkles size={11} className="text-purple-400 flex-shrink-0" /><ScoreDots score={book.magicScore} color="#c084fc" /></div>
          <div className="flex items-center gap-1.5"><Users size={11} className="text-blue-400 flex-shrink-0" /><ScoreDots score={book.characterScore} color="#60a5fa" /></div>
        </div>

        {/* Stars — tap to quick-save rating instantly, no modal needed */}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <div className="flex flex-1 min-w-0" onMouseLeave={() => setHoverStar(0)}>
            {Array.from({ length: 10 }).map((_, i) => {
              const activeRating = hoverStar > 0 ? hoverStar : (isRead && book.userRating ? book.userRating.rating : 0);
              const filled = i < activeRating;
              return (
                <button
                  key={i}
                  disabled={saving}
                  className="flex-1 min-w-0 p-0 border-0 bg-transparent cursor-pointer disabled:opacity-50"
                  onMouseEnter={() => setHoverStar(i + 1)}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSaving(true);
                    await onQuickRate(book.id, i + 1);
                    setSaving(false);
                  }}
                  aria-label={`Rate ${i + 1} stars`}
                >
                  <svg viewBox="0 0 24 24"
                    className={`w-full h-auto transition-colors ${
                      filled
                        ? hoverStar > 0 ? "text-yellow-300" : "text-yellow-400"
                        : "text-muted-foreground/25"
                    }`}
                    fill={filled ? "currentColor" : "none"}
                    stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                  </svg>
                </button>
              );
            })}
          </div>
          {/* Rating label or tap hint */}
          {isRead && book.userRating
            ? <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{book.userRating.rating}/10</span>
            : <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors flex-shrink-0">tap</span>
          }
          {/* Similar button */}
          <button data-testid={`find-similar-${book.id}`}
            onClick={(e) => { e.stopPropagation(); onSimilar(book); }}
            className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10">
            <Shuffle size={10} /> Similar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Free Books Tab ───────────────────────────────────────────────────────────
interface FreeBookEntry {
  id: number; title: string; author: string; genre: string;
  coverColor: string; coverAccent: string; seriesName: string | null;
  ebookUrl: string | null; borrowUrl: string | null; iaUrl: string | null;
  audioUrl: string | null; standardEbookUrl: string | null; webSerialUrl: string | null;
  buyUrl: string; goodreadsUrl: string;
}

const FREE_SOURCE_DEFS: { key: keyof FreeBookEntry; label: string; color: string; icon: React.ReactNode }[] = [
  { key: "ebookUrl",         label: "Read Free",        color: "text-emerald-300 bg-emerald-900/30 border-emerald-600/50",   icon: <BookOpen size={11} /> },
  { key: "standardEbookUrl", label: "Standard Ebooks",  color: "text-emerald-300 bg-emerald-900/30 border-emerald-600/50",   icon: <Download size={11} /> },
  { key: "borrowUrl",        label: "Borrow Free",      color: "text-emerald-300 bg-emerald-900/30 border-emerald-600/50",   icon: <BookOpen size={11} /> },
  { key: "iaUrl",            label: "Archive.org",      color: "text-emerald-300 bg-emerald-900/30 border-emerald-600/50",   icon: <Globe size={11} /> },
  { key: "audioUrl",         label: "Free Audiobook",   color: "text-emerald-300 bg-emerald-900/30 border-emerald-600/50",   icon: <Headphones size={11} /> },
  { key: "webSerialUrl",     label: "Read Web Serial",  color: "text-emerald-300 bg-emerald-900/30 border-emerald-600/50",   icon: <Rss size={11} /> },
];

const FREE_FILTER_OPTIONS = [
  { key: "all",    label: "All" },
  { key: "ebook",  label: "Ebooks" },
  { key: "audio",  label: "Audiobooks" },
  { key: "serial", label: "Web Serials" },
];

function hasFreeLinks(b: FreeBookEntry) {
  return !!(b.ebookUrl || b.standardEbookUrl || b.borrowUrl || b.iaUrl || b.audioUrl || b.webSerialUrl);
}

function FreeBooksTab({ onRate }: { onRate: (b: BookData) => void }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data: allEntries, isLoading, refetch, isFetching } = useQuery<FreeBookEntry[]>({
    queryKey: ["/api/free-books"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/free-books"); return r.json(); },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  // Always filter to only books that have at least one free link
  const filtered = useMemo(() => {
    if (!allEntries) return [];
    let list = allEntries.filter(hasFreeLinks);
    if (filter === "ebook")  list = list.filter(b => b.ebookUrl || b.standardEbookUrl || b.borrowUrl || b.iaUrl);
    if (filter === "audio")  list = list.filter(b => !!b.audioUrl);
    if (filter === "serial") list = list.filter(b => !!b.webSerialUrl);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }
    return list;
  }, [allEntries, filter, search]);

  if (isLoading || isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm font-medium">Scanning all books for free copies…</p>
        <p className="text-xs opacity-60">Checking Open Library, LibriVox, Standard Ebooks & Royal Road</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      {allEntries && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-900/15 border border-emerald-700/25">
          <Download size={16} className="text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-300">
            <strong>{filtered.length}</strong> free {filter === "audio" ? "audiobook" : filter === "serial" ? "web serial" : "book"}{filtered.length !== 1 ? "s" : ""} available
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {FREE_FILTER_OPTIONS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[160px] max-w-xs relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search titles or authors…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/40 border-border/50" />
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/40 ml-auto">
          <RefreshCw size={12} /> Re-scan
        </button>
      </div>

      {/* Book list — only books with free links, no buy buttons */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Library size={36} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-foreground">No free copies found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different filter or hit Re-scan to check again</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(book => {
            const freeLinks = FREE_SOURCE_DEFS
              .map(s => ({ ...s, url: book[s.key] as string | null }))
              .filter(l => l.url);

            return (
              <div key={book.id}
                className="flex gap-3 rounded-xl border border-emerald-700/35 bg-card p-3 hover:border-emerald-500/55 hover:shadow-[0_0_14px_rgba(52,211,153,0.08)] transition-all">

                {/* Cover */}
                <div className="flex-shrink-0 w-14 h-20 rounded-md flex items-center justify-center text-[9px] font-bold text-center leading-tight px-1"
                  style={{ background: `linear-gradient(135deg, ${book.coverColor}, ${book.coverAccent})` }}>
                  <span className="text-white/90 drop-shadow line-clamp-4">{book.title}</span>
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground leading-tight">{book.title}</h3>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                      {book.seriesName && <p className="text-[10px] text-muted-foreground/60 italic">{book.seriesName}</p>}
                    </div>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${genreClass(book.genre)}`}>
                      {getGenreLabel(book.genre)}
                    </span>
                  </div>

                  {/* Free links only */}
                  <div className="flex flex-wrap gap-1.5">
                    {freeLinks.map(({ key, label, icon, url }) => (
                      <a key={key} href={url!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border text-emerald-300 bg-emerald-900/30 border-emerald-600/50 hover:bg-emerald-900/50 transition-colors"
                        onClick={e => e.stopPropagation()}>
                        {icon} {label} <ExternalLink size={9} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Rating Modal ─────────────────────────────────────────────────────────────
function RatingModal({ book, onClose, requireAuth, allBooks }: { book: BookData | null; onClose: () => void; requireAuth: () => void; allBooks: BookData[] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(book?.userRating?.rating || 5);

  // Fetch free ebook / audiobook links for this book
  const { data: freeLinks, isLoading: linksLoading } = useQuery<{
    ebookUrl: string | null; borrowUrl: string | null; audioUrl: string | null;
    iaUrl?: string | null; standardEbookUrl?: string | null;
    buyUrl: string; goodreadsUrl: string;
  }>({
    queryKey: ["/api/books", book?.id, "free-links"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/books/${book!.id}/free-links`);
      return res.json();
    },
    enabled: !!book,
    staleTime: 1000 * 60 * 60, // cache for 1 hour
  });

  const [applyToSeries, setApplyToSeries] = useState(false);

  // Books in the same series (excluding this one)
  const seriesSiblings = useMemo(() => {
    if (!book?.seriesName) return [];
    return allBooks.filter(b => b.id !== book.id && b.seriesName === book.seriesName);
  }, [book, allBooks]);

  const rateMutation = useMutation({
    mutationFn: async (data: { bookId: number; rating: number; read: number }) => {
      await apiRequest("POST", "/api/ratings", data);
      // Apply to series siblings if checkbox is ticked
      if (applyToSeries && book?.seriesName) {
        await Promise.all(
          seriesSiblings.map(b => apiRequest("POST", "/api/ratings", { bookId: b.id, rating: data.rating, read: 1 }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      const seriesMsg = applyToSeries && seriesSiblings.length > 0
        ? ` + ${seriesSiblings.length} other${seriesSiblings.length > 1 ? "s" : ""} in series`
        : "";
      toast({ title: "Rating saved!", description: `"${book?.title}"${seriesMsg} — ${rating}/10` });
      onClose();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (bookId: number) => apiRequest("DELETE", `/api/ratings/${bookId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      toast({ title: "Removed from read list" });
      onClose();
    },
  });

  if (!book) return null;
  if (!user) { requireAuth(); onClose(); return null; }

  return (
    <Dialog open={!!book} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {book.userRating ? "Update Rating" : "Mark as Read & Rate"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mt-2">
          <BookCover book={book} size="lg" />
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="font-bold text-foreground leading-tight">{book.title}</h3>
              <p className="text-sm text-muted-foreground">{book.author}</p>
              {book.seriesName && <p className="text-xs text-muted-foreground/70 italic">{book.seriesName}{book.seriesBook ? ` #${book.seriesBook}` : ""}</p>}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${genreClass(book.genre)}`}>{getGenreLabel(book.genre)}</span>
            <p className="text-xs text-muted-foreground leading-relaxed">{book.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40 border border-border/30">
          {[
            { icon: <Swords size={14} className="text-red-400" />, score: book.martialArtsScore, color: "#f87171", label: "Combat" },
            { icon: <Sparkles size={14} className="text-purple-400" />, score: book.magicScore, color: "#c084fc", label: "Magic" },
            { icon: <Users size={14} className="text-blue-400" />, score: book.characterScore, color: "#60a5fa", label: "Character" },
          ].map(({ icon, score, color, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              {icon}<ScoreDots score={score} color={color} /><span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Community ratings breakdown */}
        {book.communityRating && book.communityRating.count > 0 && (
          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BarChart2 size={12} className="text-yellow-400" /> Community Ratings
              </p>
              <span className="text-sm font-bold text-yellow-400">{book.communityRating.avg.toFixed(1)}<span className="text-xs text-muted-foreground font-normal">/10</span></span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {book.communityRating.raters.map((r) => (
                <div key={r.username} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/40">
                  <span className="text-[10px] font-medium text-foreground">{r.username}</span>
                  <span className="text-[10px] text-yellow-400 font-semibold">{r.rating}/10</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Your Rating</span>
            <span className="text-2xl font-bold text-primary font-mono">{rating}<span className="text-sm text-muted-foreground font-normal">/10</span></span>
          </div>
          <Slider data-testid="rating-slider" min={1} max={10} step={1} value={[rating]} onValueChange={([v]) => setRating(v)} className="w-full" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1 — Pass</span><span>5 — Decent</span><span>10 — Masterpiece</span>
          </div>
          <StarRating value={rating} onChange={setRating} size={20} />

          {/* Apply to whole series */}
          {seriesSiblings.length > 0 && (
            <button
              onClick={() => setApplyToSeries(v => !v)}
              className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border transition-all ${
                applyToSeries
                  ? "bg-primary/15 border-primary/50 text-primary"
                  : "bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}>
              <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-all ${
                applyToSeries ? "bg-primary border-primary" : "border-muted-foreground/40"
              }`}>
                {applyToSeries && <CheckCircle2 size={10} className="text-primary-foreground" />}
              </div>
              <div className="text-xs leading-tight">
                <span className="font-medium">Apply to whole series</span>
                <span className="ml-1 text-[10px] opacity-70">({seriesSiblings.length} other book{seriesSiblings.length > 1 ? "s" : ""} in {book?.seriesName})</span>
              </div>
            </button>
          )}
        </div>

        {/* Free + Buy links */}
        {linksLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 size={12} className="animate-spin" /> Checking for free copies…
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-3">
            {/* FREE section — only shown if something is available */}
            {(freeLinks?.ebookUrl || freeLinks?.borrowUrl || freeLinks?.iaUrl || freeLinks?.standardEbookUrl || freeLinks?.audioUrl) && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">Free</p>
                <div className="flex flex-wrap gap-1.5">
                  {freeLinks?.ebookUrl && (
                    <a href={freeLinks.ebookUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-600/50 text-emerald-300 hover:opacity-90 transition-colors">
                      <BookOpen size={11} /> Read Free <ExternalLink size={9} />
                    </a>
                  )}
                  {freeLinks?.standardEbookUrl && (
                    <a href={freeLinks.standardEbookUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-600/50 text-emerald-300 hover:opacity-90 transition-colors">
                      <Download size={11} /> Standard Ebooks <ExternalLink size={9} />
                    </a>
                  )}
                  {freeLinks?.borrowUrl && !freeLinks?.ebookUrl && (
                    <a href={freeLinks.borrowUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-600/50 text-emerald-300 hover:opacity-90 transition-colors">
                      <BookOpen size={11} /> Borrow Free <ExternalLink size={9} />
                    </a>
                  )}
                  {freeLinks?.iaUrl && !freeLinks?.ebookUrl && (
                    <a href={freeLinks.iaUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-600/50 text-emerald-300 hover:opacity-90 transition-colors">
                      <Globe size={11} /> Archive.org <ExternalLink size={9} />
                    </a>
                  )}
                  {freeLinks?.audioUrl && (
                    <a href={freeLinks.audioUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-600/50 text-emerald-300 hover:opacity-90 transition-colors">
                      <Headphones size={11} /> Free Audiobook <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            )}
            {/* BUY section — always shown */}
            {freeLinks && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400">Buy</p>
                <div className="flex flex-wrap gap-1.5">
                  <a href={freeLinks.buyUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-orange-900/20 border border-orange-700/40 text-orange-300 hover:opacity-90 transition-colors">
                    <ExternalLink size={11} /> Amazon
                  </a>
                  <a href={freeLinks.goodreadsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-orange-900/20 border border-orange-700/40 text-orange-300 hover:opacity-90 transition-colors">
                    <ExternalLink size={11} /> Goodreads
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button data-testid="save-rating" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => rateMutation.mutate({ bookId: book.id, rating, read: 1 })}
            disabled={rateMutation.isPending}>
            {rateMutation.isPending ? "Saving…" : book.userRating ? "Update Rating" : "Save Rating"}
          </Button>
          {book.userRating && (
            <Button data-testid="remove-rating" variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => removeMutation.mutate(book.id)} disabled={removeMutation.isPending}>
              <X size={14} />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Community Detail Modal ───────────────────────────────────────────────────
function CommunityModal({ book, onClose }: { book: BookData | null; onClose: () => void }) {
  if (!book || !book.communityRating) return null;
  const cr = book.communityRating;
  return (
    <Dialog open={!!book} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 size={16} className="text-yellow-400" /> Community Ratings
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 mb-1">
          <BookCover book={book} size="sm" />
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{book.title}</p>
            <p className="text-xs text-muted-foreground">{book.author}</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{cr.avg.toFixed(1)}<span className="text-xs text-muted-foreground font-normal">/10</span>
              <span className="text-xs text-muted-foreground font-normal ml-1">from {cr.count} {cr.count === 1 ? "reader" : "readers"}</span>
            </p>
          </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {cr.raters.sort((a, b) => b.rating - a.rating).map((r) => (
            <div key={r.username} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  {r.username[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-foreground">{r.username}</span>
              </div>
              <div className="flex items-center gap-1">
                <StarRating value={r.rating} readonly />
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Open Library Search Modal ────────────────────────────────────────────────
interface OLResult {
  title: string; author: string; publishYear: number | null;
  subjects: string[]; coverUrl: string | null; openLibraryKey: string | null;
}

function SearchOnlineModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OLResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setResults([]);
    try {
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}`);
      setResults(await res.json());
    } catch { toast({ title: "Search failed", variant: "destructive" }); }
    finally { setSearching(false); }
  };

  const handleAdd = async (r: OLResult) => {
    const key = r.openLibraryKey || r.title;
    setAddingKey(key);
    const tags = r.subjects.slice(0, 6).map(s => s.toLowerCase());
    const genre = inferGenreFromTags(tags);
    const colors = pickCoverColors(genre);
    try {
      await apiRequest("POST", "/api/books", {
        title: r.title, author: r.author, genre,
        subgenres: JSON.stringify([genre]),
        description: r.subjects.slice(0, 5).join(", ") || "Discovered via Open Library.",
        martialArtsScore: 3, magicScore: 3, characterScore: 3,
        seriesName: null, seriesBook: null,
        coverColor: colors.coverColor, coverAccent: colors.coverAccent,
        publishYear: r.publishYear || null,
        tags: JSON.stringify(tags),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/free-books"] });
      setAddedKeys(prev => new Set(prev).add(key));
      toast({ title: "Book added!", description: `"${r.title}" is in your library.` });
    } catch { toast({ title: "Failed to add", variant: "destructive" }); }
    finally { setAddingKey(null); }
  };

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Globe size={16} className="text-primary" /> Search Open Library
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Search 20M+ books. Add any — genres expand automatically from your tags.</p>
        </DialogHeader>
        <div className="px-6 py-4 flex gap-2 border-b border-border/30 flex-shrink-0">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus placeholder="e.g. wuxia cultivation, slice of life, litrpg dungeon…"
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="pl-8 h-9 text-sm bg-muted/30" />
          </div>
          <Button onClick={handleSearch} disabled={searching} size="sm" className="gap-1.5">
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {searching && (
            <div className="flex flex-col items-center py-12">
              <Loader2 size={28} className="animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Searching Open Library…</p>
            </div>
          )}
          {!searching && results.length === 0 && !query && (
            <div className="flex flex-col items-center py-10 gap-2 text-center">
              <Globe size={32} className="text-muted-foreground/20 mb-1" />
              <p className="text-sm font-medium text-muted-foreground">Discover books beyond the library</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">Any genre works — slice of life, romance, sci-fi. The system learns from whatever you add and rate.</p>
              <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                {["wuxia martial", "litrpg dungeon", "slice of life", "dark fantasy", "progression fantasy", "cultivation immortal"].map(s => (
                  <button key={s} onClick={() => setQuery(s)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all">{s}</button>
                ))}
              </div>
            </div>
          )}
          {results.map((r, i) => {
            const key = r.openLibraryKey || r.title;
            const added = addedKeys.has(key);
            const isAdding = addingKey === key;
            const genre = inferGenreFromTags(r.subjects.map(s => s.toLowerCase()));
            const colors = pickCoverColors(genre);
            return (
              <div key={i} className="flex gap-3 p-3 rounded-lg border border-border/40 bg-card hover:border-border/70 transition-all">
                {r.coverUrl
                  ? <img src={r.coverUrl} alt={r.title} className="w-12 h-16 rounded object-cover flex-shrink-0 opacity-90" />
                  : <div className="w-12 h-16 rounded flex-shrink-0 flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${colors.coverColor}, ${colors.coverAccent}55)` }}>
                      <BookOpen size={16} className="text-white/50" />
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight line-clamp-1">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.author}{r.publishYear ? ` · ${r.publishYear}` : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.subjects.slice(0, 4).map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/50 text-muted-foreground">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <Button size="sm" variant={added ? "outline" : "default"} disabled={added || isAdding}
                    onClick={() => handleAdd(r)} className="gap-1 text-xs h-8 px-3">
                    {isAdding ? <Loader2 size={12} className="animate-spin" /> : added ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                    {added ? "Added" : isAdding ? "Adding" : "Add"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ recommendations, similarBooks, similarSource, onRate, onSimilar, onClearSimilar, discoveries, onDiscover, isDiscovering }:
  { recommendations: BookData[]; similarBooks: BookData[]; similarSource: BookData | null;
    onRate: (b: BookData) => void; onSimilar: (b: BookData) => void; onClearSimilar: () => void;
    discoveries: BookData[]; onDiscover: () => void; isDiscovering: boolean; }) {
  const showing = similarSource ? "similar" : "recommendations";
  return (
    <div className="sticky top-24 space-y-4">
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className={`p-4 border-b border-border/30 ${showing === "similar" ? "bg-gradient-to-r from-accent/10 to-purple/10" : "bg-gradient-to-r from-primary/10 to-accent/10"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showing === "similar" ? <Shuffle size={15} className="text-accent" /> : <TrendingUp size={15} className="text-primary" />}
              <h3 className="font-semibold text-sm text-foreground">
                {showing === "similar" ? "Similar Books" : "Recommended For You"}
              </h3>
            </div>
            {showing === "similar" && (
              <button onClick={onClearSimilar} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <ArrowLeft size={10} /> Back
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {showing === "similar"
              ? `Books like "${similarSource?.title}"`
              : recommendations.length > 0
                ? "Based on everyone's ratings — any genre"
                : "Rate books to unlock community picks"}
          </p>
        </div>

        {showing === "similar" ? (
          similarBooks.length === 0
            ? <div className="p-6 text-center"><Shuffle size={28} className="text-muted-foreground/30 mx-auto mb-3" /><p className="text-xs text-muted-foreground">No similar books found.</p></div>
            : <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto">
                {similarBooks.map(b => <MiniBookRow key={b.id} book={b} onRate={onRate} onSimilar={onSimilar} />)}
              </div>
        ) : recommendations.length === 0
          ? <div className="p-6 text-center">
              <Zap size={28} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Rate books and we'll match you with similar titles — including books outside the listed genres.</p>
            </div>
          : <div className="p-2 space-y-1 max-h-[520px] overflow-y-auto">
              {recommendations.map(b => <MiniBookRow key={b.id} book={b} onRate={onRate} onSimilar={onSimilar} />)}
            </div>
        }
      </div>

      {/* ── Auto-Discovery Panel ── */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="p-4 border-b border-border/30 bg-gradient-to-r from-emerald-900/20 to-teal-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass size={15} className="text-emerald-400" />
              <h3 className="font-semibold text-sm text-foreground">New Discoveries</h3>
            </div>
            <button
              onClick={onDiscover}
              disabled={isDiscovering}
              data-testid="discover-button"
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 hover:bg-emerald-800/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDiscovering ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              {isDiscovering ? "Searching…" : "Find Books"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {discoveries.length > 0
              ? `${discoveries.length} books added from Open Library based on your taste profile`
              : "Auto-finds books matching the community's taste profile"}
          </p>
        </div>
        {discoveries.length === 0 ? (
          <div className="p-6 text-center">
            <Compass size={28} className="text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">Rate 3+ books, then tap Find Books to discover new titles automatically added to the library.</p>
          </div>
        ) : (
          <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
            {discoveries.map(b => (
              <div key={b.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/5 transition-colors">
                <div className="w-7 h-9 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${b.coverColor}, ${b.coverAccent})` }}>
                  ✦
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{b.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{b.author}</p>
                  <span className="inline-block text-[9px] px-1 py-px rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 mt-0.5">✦ Group Pick</span>
                </div>
                <button
                  onClick={() => onRate(b)}
                  className="flex-shrink-0 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <Star size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-foreground">Score Legend</h3>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {[
            { icon: <Swords size={12} className="text-red-400 flex-shrink-0" />, label: "Combat / Martial Arts" },
            { icon: <Sparkles size={12} className="text-purple-400 flex-shrink-0" />, label: "Magic system depth" },
            { icon: <Users size={12} className="text-blue-400 flex-shrink-0" />, label: "Character development" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2">{icon}<span>{label}</span></div>
          ))}
        </div>
        <div className="pt-2 border-t border-border/30 space-y-1 text-[10px] text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Genres auto-expand as books are added</p>
          {CORE_GENRES.map(g => (
            <div key={g} className="flex items-center gap-1.5">
              <span className={`inline-block text-[9px] px-1.5 py-px rounded-full border font-medium ${genreClass(g)}`}>{getGenreLabel(g)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function DashboardInner() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [ratingModal, setRatingModal] = useState<BookData | null>(null);
  const [communityModal, setCommunityModal] = useState<BookData | null>(null);
  const [showOnlyRead, setShowOnlyRead] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [similarSource, setSimilarSource] = useState<BookData | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showSearchOnline, setShowSearchOnline] = useState(false);
  const [discoveries, setDiscoveries] = useState<BookData[]>([]);
  const [forYouIds, setForYouIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"library" | "free">("library");
  const autoDiscoveredRef = useRef(false);

  const { data: books = [], isLoading } = useQuery<BookData[]>({ queryKey: ["/api/books"] });
  const { data: recommendations = [] } = useQuery<BookData[]>({ queryKey: ["/api/recommendations"] });

  // Group discovery — finds books for the whole community
  const discoverMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/discover/group"),
    onSuccess: (data: any) => {
      if (data.added && data.added.length > 0) {
        setDiscoveries(prev => {
          const existingIds = new Set(prev.map((b: BookData) => b.id));
          const newBooks = data.added.filter((b: BookData) => !existingIds.has(b.id));
          return [...newBooks, ...prev];
        });
        queryClient.invalidateQueries({ queryKey: ["/api/books"] });
        queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/free-books"] });
        toast({ title: `✦ ${data.added.length} new group pick${data.added.length > 1 ? 's' : ''} discovered!`, description: `Added from Open Library based on the community's taste.` });
      }
    },
    onError: () => {},
  });

  // Personal discovery — finds books tailored to YOU, highlights them in the grid
  const personalDiscoverMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/discover/personal"),
    onSuccess: (data: any) => {
      if (data.forYouIds && data.forYouIds.length > 0) {
        setForYouIds(new Set(data.forYouIds));
      }
      if (data.added && data.added.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/books"] });
        queryClient.invalidateQueries({ queryKey: ["/api/free-books"] });
        toast({ title: `✦ ${data.added.length} personal pick${data.added.length > 1 ? 's' : ''} found!`, description: `Books matched to your individual taste.` });
      }
    },
    onError: () => {},
  });

  // Auto-discover once per session when the app loads
  useEffect(() => {
    if (autoDiscoveredRef.current) return;
    autoDiscoveredRef.current = true;
    // Small delay to let the initial data load first
    const timer = setTimeout(() => {
      discoverMutation.mutate();
      if (user) personalDiscoverMutation.mutate();
    }, 2000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run personal discovery when user logs in
  const prevUserRef = useRef<number | null>(null);
  useEffect(() => {
    if (user && user.userId !== prevUserRef.current) {
      prevUserRef.current = user.userId;
      personalDiscoverMutation.mutate();
    } else if (!user) {
      prevUserRef.current = null;
      setForYouIds(new Set());
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: similarBooks = [] } = useQuery<BookData[]>({
    queryKey: ["/api/similar", similarSource?.id],
    enabled: !!similarSource,
  });

  // Dynamic genres: core genres + any custom genre with 2+ books
  const dynamicGenres = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of books) {
      counts[b.genre] = (counts[b.genre] || 0) + 1;
    }
    const extras = Object.keys(counts)
      .filter(g => !CORE_GENRES.includes(g) && counts[g] >= 2)
      .sort((a, b) => counts[b] - counts[a]);
    return [
      { key: "all", label: "All Genres" },
      ...CORE_GENRES.map(g => ({ key: g, label: getGenreLabel(g) })),
      ...extras.map(g => ({ key: g, label: `✦ ${getGenreLabel(g)}` })),
    ];
  }, [books]);

  const readCount = useMemo(() => books.filter(b => b.userRating).length, [books]);
  const avgRating = useMemo(() => {
    const rated = books.filter(b => b.userRating);
    if (!rated.length) return 0;
    return (rated.reduce((s, b) => s + b.userRating!.rating, 0) / rated.length).toFixed(1);
  }, [books]);

  const filtered = useMemo(() => {
    let list = [...books];
    if (selectedGenre !== "all") list = list.filter(b => b.genre === selectedGenre || b.subgenres.includes(selectedGenre));
    if (showOnlyRead) list = list.filter(b => b.userRating);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) ||
        b.tags.some(t => t.toLowerCase().includes(q)) || b.description.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case "title": list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "community": list.sort((a, b) => (b.communityRating?.avg || 0) - (a.communityRating?.avg || 0)); break;
      case "rating": list.sort((a, b) => (b.userRating?.rating || 0) - (a.userRating?.rating || 0)); break;
      case "martial": list.sort((a, b) => b.martialArtsScore - a.martialArtsScore); break;
      case "magic": list.sort((a, b) => b.magicScore - a.magicScore); break;
      case "character": list.sort((a, b) => b.characterScore - a.characterScore); break;
      case "year": list.sort((a, b) => (b.publishYear || 0) - (a.publishYear || 0)); break;
    }
    return list;
  }, [books, selectedGenre, sortBy, showOnlyRead, searchQuery]);

  const handleSimilar = (book: BookData) => {
    setSimilarSource(book);
    queryClient.invalidateQueries({ queryKey: ["/api/similar", book.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <svg viewBox="0 0 32 32" className="w-8 h-8" aria-label="Blade & Page logo">
              <circle cx="16" cy="16" r="15" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              <path d="M16 4 L19 20 L16 28 L13 20 Z" fill="hsl(var(--primary))" opacity="0.9" />
              <path d="M10 10 L22 10" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M11 14 L21 14" stroke="hsl(var(--primary))" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
            </svg>
            <div>
              <h1 className="font-bold text-base text-foreground leading-none">Blade & Page</h1>
              <p className="text-[10px] text-muted-foreground">Community Fantasy Tracker</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="search-input" placeholder="Search titles, authors, tags…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs bg-muted/40 border-border/50" />
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-4 text-xs flex-shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BookOpen size={13} />
              <span><strong className="text-foreground">{readCount}</strong> / {books.length} read</span>
            </div>
            {readCount > 0 && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Star size={13} className="text-yellow-400" fill="currentColor" />
                <span>avg <strong className="text-foreground">{avgRating}</strong>/10</span>
              </div>
            )}
            {recommendations.length > 0 && (
              <div className="flex items-center gap-1.5 text-primary">
                <Flame size={13} /><span><strong>{recommendations.length}</strong> picks</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button data-testid="add-book-btn" variant="outline" size="sm"
              className="gap-1.5 text-xs border-border/60"
              onClick={() => setShowAddBook(true)}>
              <PenLine size={13} /><span className="hidden sm:inline">Add Book</span>
            </Button>
            <Button data-testid="search-online-btn" variant="outline" size="sm"
              className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => setShowSearchOnline(true)}>
              <Globe size={13} /><span className="hidden sm:inline">Search Online</span>
            </Button>
            <Button data-testid="toggle-filters" variant="outline" size="sm"
              className={`gap-1.5 text-xs border-border/60 ${showFilters ? "bg-primary/10 border-primary/40" : ""}`}
              onClick={() => setShowFilters(f => !f)}>
              <SlidersHorizontal size={13} /><span className="hidden sm:inline">Filters</span>
            </Button>
            {user ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:block text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg bg-muted/40">
                  {user.username}
                </span>
                <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-btn" className="w-8 h-8 p-0" title="Sign out">
                  <LogOut size={14} />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAuthModal(true)} data-testid="login-btn" className="gap-1.5 text-xs">
                <LogIn size={14} /><span className="hidden sm:inline">Sign In</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={toggle} data-testid="theme-toggle" className="w-8 h-8 p-0">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="border-t border-border/30 bg-background/95 px-4 py-3">
            <div className="max-w-7xl mx-auto space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">Sort:</span>
                {SORT_OPTIONS.map(s => (
                  <button key={s.key} data-testid={`sort-${s.key}`} onClick={() => setSortBy(s.key)}
                    className={`px-2 py-0.5 rounded text-xs transition-all ${sortBy === s.key ? "bg-primary/20 text-primary font-medium" : "hover:text-foreground"}`}>
                    {s.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-border/50" />
                <button data-testid="toggle-read-only" onClick={() => setShowOnlyRead(r => !r)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${showOnlyRead ? "bg-primary/15 text-primary border-primary/40" : "border-border/50 hover:border-primary/30"}`}>
                  <CheckCircle2 size={11} /> Read only
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Tab bar ── */}
      <div className="border-b border-border/40 bg-background/80 sticky top-[57px] z-30">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-0">
          <button
            onClick={() => setActiveTab("library")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === "library"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}>
            <BookOpen size={14} /> Library
          </button>
          <button
            onClick={() => setActiveTab("free")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === "free"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}>
            <Download size={14} /> Free Books
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/30 font-semibold">FREE</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Free Books tab — full width */}
        {activeTab === "free" && (
          <main className="flex-1 min-w-0">
            <FreeBooksTab onRate={b => { if (!user) setShowAuthModal(true); else setRatingModal(b as any); }} />
          </main>
        )}

        {/* Library tab */}
        {activeTab === "library" && <>
        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Genre pills — dynamic */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {dynamicGenres.map(g => (
              <button key={g.key} onClick={() => setSelectedGenre(g.key)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${selectedGenre === g.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                {g.label}
              </button>
            ))}
          </div>

          {/* Count bar */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {isLoading ? "Loading…" : `${filtered.length} of ${books.length} books`}
              {selectedGenre !== "all" ? ` · ${getGenreLabel(selectedGenre)}` : ""}
              {searchQuery ? ` · "${searchQuery}"` : ""}
            </h2>
            {!user && !isLoading && (
              <button onClick={() => setShowAuthModal(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
                <LogIn size={11} /> Sign in to rate
              </button>
            )}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/50 p-4 flex gap-4 h-40">
                  <div className="skeleton w-20 h-28 rounded-md" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/2" />
                    <div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BookOpen size={40} className="text-muted-foreground/30 mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-2">No books found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {showOnlyRead ? "No rated books match this filter." : "Try a different filter or search."}
              </p>
              <Button variant="outline" className="mt-4 text-xs"
                onClick={() => { setSelectedGenre("all"); setShowOnlyRead(false); setSearchQuery(""); }}>
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map(book => (
                <BookCard key={book.id} book={book}
                  onRate={b => { if (!user) { setShowAuthModal(true); } else { setRatingModal(b); } }}
                  onQuickRate={async (bookId, rating) => {
                    if (!user) { setShowAuthModal(true); return; }
                    await apiRequest("POST", "/api/ratings", { bookId, rating, read: 1 });
                    queryClient.invalidateQueries({ queryKey: ["/api/books"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
                  }}
                  onSimilar={handleSimilar}
                  onCommunity={setCommunityModal}
                  forYou={forYouIds.has(book.id)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="hidden xl:block w-72 flex-shrink-0">
          <Sidebar recommendations={recommendations} similarBooks={similarBooks}
            similarSource={similarSource} onRate={b => { if (!user) setShowAuthModal(true); else setRatingModal(b); }}
            onSimilar={handleSimilar} onClearSimilar={() => setSimilarSource(null)}
            discoveries={discoveries}
            onDiscover={() => discoverMutation.mutate()}
            isDiscovering={discoverMutation.isPending} />
        </aside>
        </>}
      </div>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <AddBookModal open={showAddBook} onClose={() => setShowAddBook(false)} />
      <SearchOnlineModal open={showSearchOnline} onClose={() => setShowSearchOnline(false)} />
      <RatingModal book={ratingModal} onClose={() => setRatingModal(null)} requireAuth={() => setShowAuthModal(true)} allBooks={books} />
      <CommunityModal book={communityModal} onClose={() => setCommunityModal(null)} />
    </div>
  );
}

// ─── Export with AuthProvider wrapper ────────────────────────────────────────
export default function Dashboard() {
  return (
    <AuthProvider>
      <DashboardInner />
    </AuthProvider>
  );
}
