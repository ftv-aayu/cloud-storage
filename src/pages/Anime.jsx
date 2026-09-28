import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/anime.css";

const PROXY    = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";
const IMG_BASE = "https://cx.animeheaven.me";

// ── AnimeHeaven search ────────────────────────────────────────────────────────
async function searchAH(query) {
    try {
        const res = await fetch(`${PROXY}/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return [];
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        return [...doc.querySelectorAll("a.ac")].map((a) => {
            const href = a.getAttribute("href") ?? "";
            const id   = href.split("?")[1] ?? "";
            return {
                id,
                name:   a.querySelector(".fastname")?.textContent.trim() ?? "Unknown",
                imgSrc: IMG_BASE + (a.querySelector("img")?.getAttribute("src") ?? ""),
                source: "ah",  // AnimeHeaven
            };
        });
    } catch {
        return [];
    }
}

// ── Anikoto search ────────────────────────────────────────────────────────────
async function searchAK(query) {
    try {
        const res = await fetch(`${PROXY}/ak/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return [];
        const data = await res.json();
        const html = data?.result?.html ?? "";
        const doc = new DOMParser().parseFromString(html, "text/html");
        return [...doc.querySelectorAll("a.item")].map(a => {
            const href = a.getAttribute("href") ?? "";
            // href = https://anikototv.to/watch/bleach-sennen-...
            const slug = href.split("/watch/")[1]?.split("?")[0] ?? "";
            const name = a.querySelector(".name")?.textContent.trim() ?? "Unknown";
            const img  = a.querySelector("img")?.getAttribute("src") ?? "";
            return { id: slug, name, imgSrc: img, source: "ak" };
        });
    } catch {
        return [];
    }
}

// ── Merge: AH primary, AK fills gaps ─────────────────────────────────────────
function mergeResults(ahResults, akResults) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const ahNames = new Set(ahResults.map(r => norm(r.name)));
    const akOnly = akResults.filter(r => !ahNames.has(norm(r.name)));
    return [...ahResults, ...akOnly];
}

// ── Cards ─────────────────────────────────────────────────────────────────────
function AnimeCard({ id, name, imgSrc, source }) {
    const to = source === "ah" ? `/anime/${id}` : `/animek/${id}`;
    return (
        <Link className="anime-card" to={to} title={name}>
            <div className="anime-card-thumb">
                <img src={imgSrc} alt={name} loading="lazy"
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.parentElement.classList.add("anime-card-no-img-bg");
                    }}
                />
                {source === "ak" && <span className="anime-card-badge">AK</span>}
            </div>
            <p className="anime-card-title">{name}</p>
        </Link>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function Anime() {
    const [query,    setQuery]    = useState("");
    const [results,  setResults]  = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState(null);
    const [searched, setSearched] = useState(false);

    async function handleSearch(e) {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;
        setLoading(true);
        setError(null);
        setResults([]);
        setSearched(true);

        try {
            // Both sources in parallel — AH primary, AP fills gaps
            const [ahResults, akResults] = await Promise.all([
                searchAH(q),
                searchAK(q),
            ]);
            const merged = mergeResults(ahResults, akResults);

            if (merged.length === 0) {
                setError(null); // show empty state below
            }
            setResults(merged);
        } catch (err) {
            setError("Search failed. Try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page">
            <div className="anime-header">
                <h1 className="anime-title">Anime Search</h1>
                <p className="anime-subtitle">Search across multiple sources</p>
            </div>

            <form className="anime-search-form" onSubmit={handleSearch}>
                <div className="anime-search-wrap">
                    <input
                        className="anime-search-input"
                        type="text"
                        placeholder="Search anime..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    <button className="anime-search-btn" type="submit" disabled={loading}>
                        {loading ? (
                            <span className="anime-spinner" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        )}
                        Search
                    </button>
                </div>
            </form>

            {error && <p className="anime-error">{error}</p>}

            {!loading && searched && results.length === 0 && !error && (
                <p className="anime-empty">No results found for "{query}"</p>
            )}

            {results.length > 0 && (
                <div className="anime-grid">
                    {results.map((item) => (
                        <AnimeCard key={`${item.source}-${item.id}`} {...item} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Anime;
