import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import "../styles/animePlayer.css";

const PROXY = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";

function genRoomId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function AnimePlayer() {
    const { id, gateId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);

    const [streamUrl, setStreamUrl]     = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [animeName, setAnimeName]     = useState("");
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setStreamUrl(null);
        setDownloadUrl(null);

        fetch(`${PROXY}/watch?id=${encodeURIComponent(gateId)}`)
            .then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json();
            })
            .then(data => {
                if (!data.videoUrl) throw new Error("No video URL found");
                setStreamUrl(`${PROXY}/stream?url=${encodeURIComponent(data.videoUrl)}`);
                const rawDl = data.videoUrl.replace(/&d$/, "") + "&d";
                setDownloadUrl(`${PROXY}/stream?url=${encodeURIComponent(rawDl)}`);
            })
            .catch(err => setError("Could not load episode. " + err.message))
            .finally(() => setLoading(false));
    }, [gateId]);

    function handleWatchTogether() {
        const roomId = genRoomId();
        const params = new URLSearchParams({
            animeId: id,
            gateId,
            name: animeName || "Watch Together",
        });
        navigate(`/watch/${roomId}?${params.toString()}`);
    }

    return (
        <div className="player-page">
            {/* Top bar */}
            <div className="player-topbar">
                <Link to={`/anime/${id}`} className="player-back">
                    ← Back
                </Link>
                <div className="player-topbar-actions">
                    {streamUrl && (
                        <button
                            className="player-watch-together"
                            onClick={handleWatchTogether}
                            title="Watch with a friend"
                        >
                            👥 Watch Together
                        </button>
                    )}
                    {downloadUrl && (
                        <a
                            className="player-download"
                            href={downloadUrl}
                            download
                            title="Download episode"
                        >
                            ↓ Download
                        </a>
                    )}
                </div>
            </div>

            <div className="player-wrap">
                {loading && (
                    <div className="player-state">
                        <div className="player-spinner" />
                        <p>Loading episode...</p>
                    </div>
                )}

                {error && (
                    <div className="player-state player-state-error">
                        <p>{error}</p>
                        <button className="player-retry" onClick={() => navigate(0)}>
                            Retry
                        </button>
                    </div>
                )}

                {streamUrl && !error && (
                    <video
                        ref={videoRef}
                        className="player-video"
                        src={streamUrl}
                        controls
                        autoPlay
                        playsInline
                        onError={() => setError("Video failed to load. The episode may be unavailable.")}
                    >
                        Your browser does not support the video element.
                    </video>
                )}
            </div>
        </div>
    );
}
