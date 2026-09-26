import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import "../styles/animeDetail.css";

const PROXY = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";
const IMG_BASE = "https://cx.animeheaven.me";
const AH_BASE = "https://animeheaven.me";

// ── Parse the raw HTML from /anime?id= ────────────────────────────────────────

function parseAnimeDetail(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Info
    const title   = doc.querySelector(".infotitle")?.textContent.trim() ?? "";
    const titleJp = doc.querySelector(".infotitlejp")?.textContent.trim() ?? "";
    const desc    = doc.querySelector(".infodes")?.textContent.trim() ?? "";
    const poster  = doc.querySelector(".posterimg")?.getAttribute("src") ?? "";
    // poster may be absolute or relative
    const posterUrl = poster.startsWith("http") ? poster : AH_BASE + "/" + poster;

    // inline values: ep count, year, score (order in page)
    const inlines = [...doc.querySelectorAll(".inline")].map(el => el.textContent.trim());
    const [epCount, year, score] = inlines;

    // Tags
    const tags = [...doc.querySelectorAll(".infotags .boxitem")]
        .map(el => el.textContent.trim());

    // Episodes — anchors with onclick="gatea(...)" containing .watch2
    const episodes = [...doc.querySelectorAll("a.c[id]")]
        .filter(a => a.querySelector(".trackep0"))
        .map(a => ({
            epNum: a.querySelector(".watch2")?.textContent.trim() ?? "?",
            gateId: a.id,
            ago: a.querySelectorAll(".watch1")[1]?.textContent.trim() ?? "",
        }))
        .sort((a, b) => Number(a.epNum) - Number(b.epNum));

    // Related & Similar shows
    const relatedShows  = parseShowBlocks(doc, "Related Shows");
    const similarShows  = parseShowBlocks(doc, "Similar Shows");

    return { title, titleJp, desc, posterUrl, epCount, year, score, tags, episodes, relatedShows, similarShows };
}

function parseShowBlocks(doc, sectionTitle) {
    // Find the linetitle div whose text matches sectionTitle
    const linetitles = [...doc.querySelectorAll(".linetitle")];
    const header = linetitles.find(el => el.textContent.trim() === sectionTitle);
    if (!header) return [];

    const container = header.nextElementSibling;
    if (!container) return [];

    return [...container.querySelectorAll(".similarimg")].map(block => {
        const a = block.querySelector("a");
        const href = a?.getAttribute("href") ?? "";
        // extract id from "anime.php?XXXX"
        const id = href.split("?")[1] ?? "";
        const name = block.querySelector(".similarname")?.textContent.trim() ?? "";
        const imgSrc = block.querySelector("img")?.getAttribute("src") ?? "";
        const imgUrl = imgSrc.startsWith("http") ? imgSrc : IMG_BASE + "/" + imgSrc;
        return { id, name, imgUrl };
    });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoTab({ data }) {
    return (
        <div className="detail-info">
            <div className="detail-poster-wrap">
                <img
                    className="detail-poster"
                    src={data.posterUrl}
                    alt={data.title}
                    onError={e => e.currentTarget.style.display = "none"}
                />
            </div>
            <div className="detail-meta">
                <h1 className="detail-title">{data.title}</h1>
                {data.titleJp && <p className="detail-title-jp">{data.titleJp}</p>}

                <div className="detail-stats">
                    {data.epCount && <span className="detail-badge">{data.epCount} eps</span>}
                    {data.year     && <span className="detail-badge">{data.year}</span>}
                    {data.score    && <span className="detail-badge detail-badge-score">⭐ {data.score}</span>}
                </div>

                {data.desc && <p className="detail-desc">{data.desc}</p>}

                {data.tags.length > 0 && (
                    <div className="detail-tags">
                        {data.tags.map(tag => (
                            <span key={tag} className="detail-tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function EpisodesTab({ episodes, animeId }) {
    if (episodes.length === 0) return <p className="detail-empty">No episodes found.</p>;
    return (
        <div className="detail-ep-grid">
            {episodes.map(ep => (
                <Link
                    key={ep.gateId}
                    className="detail-ep-card"
                    to={`/anime/${animeId}/ep/${ep.gateId}`}
                    title={`Episode ${ep.epNum}`}
                >
                    <span className="detail-ep-num">Ep {ep.epNum}</span>
                    {ep.ago && <span className="detail-ep-ago">{ep.ago}</span>}
                </Link>
            ))}
        </div>
    );
}

function ShowGrid({ shows }) {
    if (shows.length === 0) return <p className="detail-empty">None found.</p>;
    return (
        <div className="detail-show-grid">
            {shows.map(show => (
                <Link key={show.id} to={`/anime/${show.id}`} className="detail-show-card">
                    <div className="detail-show-thumb">
                        <img
                            src={show.imgUrl}
                            alt={show.name}
                            loading="lazy"
                            onError={e => e.currentTarget.style.display = "none"}
                        />
                    </div>
                    <p className="detail-show-name">{show.name}</p>
                </Link>
            ))}
        </div>
    );
}

function RelatedTab({ relatedShows, similarShows }) {
    return (
        <div className="detail-related">
            {relatedShows.length > 0 && (
                <>
                    <h3 className="detail-section-title">Related Shows</h3>
                    <ShowGrid shows={relatedShows} />
                </>
            )}
            {similarShows.length > 0 && (
                <>
                    <h3 className="detail-section-title">Similar Shows</h3>
                    <ShowGrid shows={similarShows} />
                </>
            )}
            {relatedShows.length === 0 && similarShows.length === 0 && (
                <p className="detail-empty">No related shows found.</p>
            )}
        </div>
    );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TABS = ["Info", "Episodes", "Related"];

export default function AnimeDetail() {
    const { id } = useParams();
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const [tab, setTab]         = useState("Info");

    useEffect(() => {
        setLoading(true);
        setError(null);
        setData(null);

        fetch(`${PROXY}/anime?id=${encodeURIComponent(id)}`)
            .then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.text();
            })
            .then(html => setData(parseAnimeDetail(html)))
            .catch(err => setError("Failed to load anime details."))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div className="page detail-loading">
            <div className="detail-spinner" />
            <p>Loading...</p>
        </div>
    );

    if (error) return (
        <div className="page detail-error">
            <p>{error}</p>
            <Link to="/anime" className="detail-back">← Back to search</Link>
        </div>
    );

    return (
        <div className="page">
            <Link to="/anime" className="detail-back">← Back to search</Link>

            {/* Tab bar */}
            <div className="detail-tabs">
                {TABS.map(t => (
                    <button
                        key={t}
                        className={`detail-tab-btn${tab === t ? " detail-tab-active" : ""}`}
                        onClick={() => setTab(t)}
                    >
                        {t}
                        {t === "Episodes" && data?.episodes.length > 0 && (
                            <span className="detail-tab-count">{data.episodes.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="detail-content">
                {tab === "Info"     && data && <InfoTab data={data} />}
                {tab === "Episodes" && data && <EpisodesTab episodes={data.episodes} animeId={id} />}
                {tab === "Related"  && data && <RelatedTab relatedShows={data.relatedShows} similarShows={data.similarShows} />}
            </div>
        </div>
    );
}
