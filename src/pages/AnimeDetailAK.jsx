import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import "../styles/animeDetail.css";

const PROXY = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";

export default function AnimeDetailAK() {
    const { slug } = useParams();

    const [animeId,  setAnimeId]  = useState(null);
    const [episodes, setEpisodes] = useState([]); // [{num, dataIds, dataId}]
    const [meta,     setMeta]     = useState(null); // {name, img, ...}
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        // Fetch the anikoto watch page HTML through the AH proxy generic fetch
        // Actually we proxy via animeheaven proxy — but anikoto uses same-origin
        // So we need to fetch it through our proxy with a /ak/page endpoint
        // OR just use the search result to get the data-id
        // Best: fetch the page HTML via a generic proxy call
        fetch(`${PROXY}/ak/page?slug=${encodeURIComponent(slug)}`)
            .then(r => r.ok ? r.text() : Promise.reject(r.status))
            .then(html => {
                const doc = new DOMParser().parseFromString(html, "text/html");
                // Get anime data-id from watch-main div
                const watchMain = doc.querySelector("[data-id]");
                const id = watchMain?.getAttribute("data-id");
                if (!id) throw new Error("Could not find anime ID");
                setAnimeId(id);

                // Get meta from page
                const name = doc.querySelector("h2.film-name, .film-name, h1")?.textContent.trim() || slug;
                const img  = doc.querySelector(".film-poster img, .poster img")?.getAttribute("src") || "";
                const desc = doc.querySelector(".film-description, .description")?.textContent.trim() || "";
                setMeta({ name, img, desc });

                // Fetch episode list
                return fetch(`${PROXY}/ak/episodes?id=${id}`);
            })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                const html = data?.result ?? "";
                const doc  = new DOMParser().parseFromString(html, "text/html");
                const eps  = [...doc.querySelectorAll("li a")].map(a => ({
                    num:     a.getAttribute("data-num") || a.querySelector("b")?.textContent || "?",
                    dataIds: a.getAttribute("data-ids") || "",
                    dataId:  a.getAttribute("data-id")  || "",
                    title:   a.getAttribute("title")    || "",
                })).filter(e => e.dataIds);
                setEpisodes(eps);
            })
            .catch(err => setError("Failed to load anime."))
            .finally(() => setLoading(false));
    }, [slug]);

    if (loading) return (
        <div className="page detail-loading">
            <div className="detail-spinner" /><p>Loading...</p>
        </div>
    );
    if (error) return (
        <div className="page detail-error">
            <p>{error}</p>
            <Link to="/anime" className="detail-back">← Back</Link>
        </div>
    );

    return (
        <div className="page">
            <Link to="/anime" className="detail-back">← Back to search</Link>

            {meta && (
                <div className="detail-info" style={{ marginTop: 16 }}>
                    {meta.img && (
                        <div className="detail-poster-wrap">
                            <img className="detail-poster" src={meta.img} alt={meta.name}
                                onError={e => e.currentTarget.style.display = "none"} />
                        </div>
                    )}
                    <div className="detail-meta">
                        <h1 className="detail-title">{meta.name}</h1>
                        {meta.desc && <p className="detail-desc">{meta.desc}</p>}
                    </div>
                </div>
            )}

            <h3 className="detail-section-title" style={{ marginTop: 24 }}>
                Episodes {episodes.length > 0 && <span className="detail-tab-count">{episodes.length}</span>}
            </h3>

            {episodes.length === 0 ? (
                <p className="detail-empty">No episodes found.</p>
            ) : (
                <div className="detail-ep-grid">
                    {episodes.map(ep => (
                        <Link
                            key={ep.dataIds}
                            className="detail-ep-card"
                            to={`/animek/${slug}/ep?ids=${encodeURIComponent(ep.dataIds)}&num=${ep.num}`}
                            title={ep.title || `Episode ${ep.num}`}
                        >
                            <span className="detail-ep-num">Ep {ep.num}</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
