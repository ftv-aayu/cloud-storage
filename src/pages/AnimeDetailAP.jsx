import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import "../styles/animeDetail.css";

// AP uses open CORS on api.animeparadise.moe — no proxy needed for detail/episodes
const AP_API = "https://api.animeparadise.moe";

const TABS = ["Info", "Episodes"];

export default function AnimeDetailAP() {
    const { link } = useParams();

    const [detail,   setDetail]   = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);
    const [tab,      setTab]      = useState("Info");

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Fetch detail and episodes in parallel
        Promise.all([
            fetch(`${AP_API}/anime/${link}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
        ])
            .then(([detailRes]) => {
                const data = detailRes?.data;
                if (!data) throw new Error("No data");
                setDetail(data);

                // Episodes are at /anime/<_id>/episode
                return fetch(`${AP_API}/anime/${data._id}/episode`);
            })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(epRes => {
                const eps = epRes?.data ?? [];
                setEpisodes(eps.sort((a, b) => Number(a.number) - Number(b.number)));
            })
            .catch(err => setError("Failed to load anime details."))
            .finally(() => setLoading(false));
    }, [link]);

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

            {/* Source badge */}
            <span style={{ marginLeft: 12, background: "#7c3aed", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>
                ✨ HD
            </span>

            {/* Tab bar */}
            <div className="detail-tabs" style={{ marginTop: 16 }}>
                {TABS.map(t => (
                    <button
                        key={t}
                        className={`detail-tab-btn${tab === t ? " detail-tab-active" : ""}`}
                        onClick={() => setTab(t)}
                    >
                        {t}
                        {t === "Episodes" && episodes.length > 0 && (
                            <span className="detail-tab-count">{episodes.length}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="detail-content">
                {tab === "Info"     && detail   && <InfoTabAP data={detail} />}
                {tab === "Episodes" && episodes  && <EpisodesTabAP episodes={episodes} link={link} animeId={detail?._id} />}
            </div>
        </div>
    );
}

// ── Info ──────────────────────────────────────────────────────────────────────

function InfoTabAP({ data }) {
    const poster = data.posterImage?.large || data.posterImage?.medium || "";
    const title  = data.alternativeTitle?.english || data.title || "";
    const titleJp = data.alternativeTitle?.romaji || data.alternativeTitle?.native || "";
    const desc   = data.synopsys || "";
    const year   = data.animeSeason?.year;
    const season = data.animeSeason?.season;
    const tags   = data.genres ?? [];

    return (
        <div className="detail-info">
            <div className="detail-poster-wrap">
                {poster && (
                    <img className="detail-poster" src={poster} alt={title}
                        onError={e => e.currentTarget.style.display = "none"} />
                )}
            </div>
            <div className="detail-meta">
                <h1 className="detail-title">{title}</h1>
                {titleJp && <p className="detail-title-jp">{titleJp}</p>}

                <div className="detail-stats">
                    {season && year && <span className="detail-badge">{season} {year}</span>}
                    {data.rate && <span className="detail-badge detail-badge-score">⭐ {data.rate}</span>}
                    {data.type && <span className="detail-badge">{data.type}</span>}
                </div>

                {desc && <p className="detail-desc">{desc}</p>}

                {tags.length > 0 && (
                    <div className="detail-tags">
                        {tags.map(tag => (
                            <span key={tag} className="detail-tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Episodes ──────────────────────────────────────────────────────────────────

function EpisodesTabAP({ episodes, link, animeId }) {
    if (episodes.length === 0) return <p className="detail-empty">No episodes found.</p>;
    return (
        <div className="detail-ep-grid">
            {episodes.map(ep => (
                <Link
                    key={ep.uid}
                    className="detail-ep-card"
                    to={`/animep/${link}/ep/${ep.uid}?origin=${animeId}`}
                    title={ep.title || `Episode ${ep.number}`}
                >
                    <span className="detail-ep-num">Ep {ep.number}</span>
                    {ep.title && <span className="detail-ep-ago" style={{ fontSize: 10 }}>{ep.title}</span>}
                </Link>
            ))}
        </div>
    );
}
