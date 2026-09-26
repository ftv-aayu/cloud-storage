import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/anime.css";

const PROXY = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";
const IMG_BASE = "https://cx.animeheaven.me";

async function searchAnime(query) {
    const res = await fetch(`${PROXY}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("a.ac")].map((a) => {
        const href = a.getAttribute("href") ?? "";
        const id = href.split("?")[1] ?? "";
        return {
            id,
            name: a.querySelector(".fastname")?.textContent.trim() ?? "Unknown",
            imgSrc: IMG_BASE + (a.querySelector("img")?.getAttribute("src") ?? ""),
        };
    });
}

function AnimeCard({ id, name, imgSrc }) {
    return (
        <Link
            className="anime-card"
            to={`/anime/${id}`}
            title={name}
        >
            <div className="anime-card-thumb">
                <img
                    src={imgSrc}
                    alt={name}
                    loading="lazy"
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.parentElement.classList.add("anime-card-no-img-bg");
                    }}
                />
            </div>
            <p className="anime-card-title">{name}</p>
        </Link>
    );
}

function Anime() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
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
            const data = await searchAnime(q);
            setResults(data);
        } catch (err) {
            setError("Failed to fetch results. Try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page">
            <div className="anime-header">
                <h1 className="anime-title">Anime Search</h1>
                <p className="anime-subtitle">Search anime from AnimeHeaven</p>
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
                    <button
                        className="anime-search-btn"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="anime-spinner" />
                        ) : (
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
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
                        <AnimeCard key={item.id} {...item} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Anime;
