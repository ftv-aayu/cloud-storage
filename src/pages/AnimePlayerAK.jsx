import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import "../styles/animePlayer.css";
import "../styles/iframePlayer.css";

const PROXY = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";

function genRoomId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Pick preferred server index — prefer "Vidstream-1 beta", fallback to 0
function preferredIndex(servers) {
    const idx = servers.findIndex(s =>
        s.label.toLowerCase().includes("vidstream-1")
    );
    return idx >= 0 ? idx : 0;
}

export default function AnimePlayerAK() {
    const { slug }       = useParams();
    const [searchParams] = useSearchParams();
    const dataIds        = searchParams.get("ids")  ?? "";
    const epNum          = searchParams.get("num")  ?? "";
    const navigate       = useNavigate();

    const [embedUrl, setEmbedUrl] = useState(null);
    const [servers,  setServers]  = useState([]);
    const [active,   setActive]   = useState(0);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);

    useEffect(() => {
        if (!dataIds) { setError("No episode data."); setLoading(false); return; }
        setLoading(true);
        setError(null);
        setEmbedUrl(null);

        fetch(`${PROXY}/ak/servers?ids=${encodeURIComponent(dataIds)}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                const html  = data?.result ?? "";
                const doc   = new DOMParser().parseFromString(html, "text/html");
                const items = [...doc.querySelectorAll("li[data-link-id]")].map(li => ({
                    svId:   li.getAttribute("data-sv-id")   ?? "",
                    linkId: li.getAttribute("data-link-id") ?? "",
                    label:  li.textContent.trim()            || "Server",
                }));
                if (!items.length) throw new Error("No servers found");
                setServers(items);

                // Default to Vidstream-1 beta if available
                const preferred = preferredIndex(items);
                setActive(preferred);
                return loadServer(items[preferred].linkId);
            })
            .then(url => setEmbedUrl(url))
            .catch(() => setError("Could not load episode."))
            .finally(() => setLoading(false));
    }, [dataIds]);

    async function loadServer(linkId) {
        const res  = await fetch(`${PROXY}/ak/source?linkId=${encodeURIComponent(linkId)}`);
        if (!res.ok) throw new Error("Source fetch failed");
        const data = await res.json();
        const url  = data?.result?.url;
        if (!url) throw new Error("No URL");
        return url;
    }

    async function switchServer(idx) {
        if (idx === active || loading) return;
        setLoading(true);
        setError(null);
        try {
            const url = await loadServer(servers[idx].linkId);
            setEmbedUrl(url);
            setActive(idx);
        } catch {
            setError("Server failed. Try another.");
        } finally {
            setLoading(false);
        }
    }

    // Watch Together — WatchRoom detects source="ak" and uses embedUrl directly
    function handleWatchTogether() {
        const roomId = genRoomId();
        const params = new URLSearchParams({
            animeId:  slug,
            gateId:   dataIds,
            name:     `Episode ${epNum}`,
            source:   "ak",
            embedUrl: embedUrl ?? "",
        });
        navigate(`/watch/${roomId}?${params.toString()}`);
    }

    return (
        <div className="player-page">
            {/* Top bar */}
            <div className="player-topbar">
                <Link to={`/animek/${slug}`} className="player-back">← Back</Link>

                <div className="player-topbar-actions">
                    {/* Server switcher */}
                    {servers.map((sv, i) => (
                        <button
                            key={sv.svId || i}
                            className={`server-btn${i === active ? " server-btn-active" : ""}`}
                            onClick={() => switchServer(i)}
                        >
                            {sv.label}
                        </button>
                    ))}

                    {embedUrl && (
                        <button
                            className="player-watch-together"
                            onClick={handleWatchTogether}
                        >
                            👥 Watch Together
                        </button>
                    )}
                </div>
            </div>

            {/* Player area */}
            <div className="player-wrap">
                {loading && (
                    <div className="player-state">
                        <div className="player-spinner" />
                        <p>Loading...</p>
                    </div>
                )}
                {error && (
                    <div className="player-state player-state-error">
                        <p>{error}</p>
                        <button className="player-retry" onClick={() => navigate(0)}>Retry</button>
                    </div>
                )}
                {embedUrl && !error && (
                    <iframe
                        className="iframe-player"
                        src={embedUrl}
                        allowFullScreen
                        allow="autoplay; fullscreen"
                        referrerPolicy="no-referrer"
                        title={`Episode ${epNum}`}
                    />
                )}
            </div>
        </div>
    );
}
