import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import Hls from "hls.js";
import "../styles/animePlayer.css";

const PROXY      = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";
const STREAM_CDN = "https://stream.animeparadise.moe";

function genRoomId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Simple VTT parser → array of {start, end, text}
function parseVTT(vttText) {
    const cues = [];
    const blocks = vttText.replace(/\r\n/g, "\n").split(/\n\n+/);
    const timeRe = /(\d+):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d+):(\d{2}):(\d{2})[.,](\d{3})/;
    for (const block of blocks) {
        const lines = block.trim().split("\n");
        let timeLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (timeRe.test(lines[i])) { timeLine = i; break; }
        }
        if (timeLine < 0) continue;
        const m = lines[timeLine].match(timeRe);
        const toSec = (h, min, s, ms) => Number(h)*3600 + Number(min)*60 + Number(s) + Number(ms)/1000;
        const start = toSec(m[1], m[2], m[3], m[4]);
        const end   = toSec(m[5], m[6], m[7], m[8]);
        const text  = lines.slice(timeLine + 1).join("\n").trim();
        if (text) cues.push({ start, end, text });
    }
    return cues;
}

export default function AnimePlayerAP() {
    const { link, uid }  = useParams();
    const [searchParams] = useSearchParams();
    const origin         = searchParams.get("origin") ?? "";
    const navigate       = useNavigate();
    const videoRef       = useRef(null);
    const hlsRef         = useRef(null);

    const [streamLink,   setStreamLink]   = useState(null);
    const [subData,      setSubData]      = useState([]); // subtitle tracks
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [levels,       setLevels]       = useState([]);
    const [currentLevel, setCurrentLevel] = useState(-1);

    // ── Fetch stream link ─────────────────────────────────────────────────────
    useEffect(() => {
        setLoading(true);
        setError(null);
        setStreamLink(null);
        setSubData([]);
        setLevels([]);
        setCurrentLevel(-1);

        fetch(`${PROXY}/ap/stream?uid=${encodeURIComponent(uid)}&origin=${encodeURIComponent(origin)}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                if (!data.streamLink) throw new Error("No stream link");
                setStreamLink(data.streamLink);
                // Only keep VTT subs — they work natively in <track>
                const vtts = (data.subData || []).filter(s => s.type === "vtt" && s.src.startsWith("http"));
                setSubData(vtts);
            })
            .catch(err => setError("Could not load episode. " + err))
            .finally(() => setLoading(false));
    }, [uid, origin]);

    // ── Attach HLS.js ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!streamLink || !videoRef.current) return;

        const m3u8Url = `${STREAM_CDN}/m3u8?url=${encodeURIComponent(streamLink)}`;

        if (hlsRef.current) hlsRef.current.destroy();

        if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(m3u8Url);
            hls.attachMedia(videoRef.current);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current?.play().catch(() => {});
                const lvls = hls.levels.map((lvl, i) => ({
                    index: i,
                    label: lvl.height ? `${lvl.height}p` : `Level ${i + 1}`,
                }));
                setLevels(lvls);

                // Add subtitle tracks via DOM TextTrack API
                // (HLS.js doesn't use native <track> elements)
                subData.forEach((s, i) => {
                    try {
                        const track = videoRef.current.addTextTrack(
                            "subtitles",
                            s.label,
                            s.label?.toLowerCase().slice(0, 2) || "en"
                        );
                        track.mode = i === 0 ? "showing" : "hidden";

                        // Fetch VTT and parse cues manually
                        fetch(s.src)
                            .then(r => r.text())
                            .then(vttText => {
                                const cues = parseVTT(vttText);
                                cues.forEach(cue => {
                                    try {
                                        track.addCue(new VTTCue(cue.start, cue.end, cue.text));
                                    } catch {}
                                });
                            })
                            .catch(() => {});
                    } catch {}
                });
            });

            hls.on(Hls.Events.ERROR, (_e, data) => {
                if (data.fatal) setError("Video stream error. Try again.");
            });

            hlsRef.current = hls;
        } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
            videoRef.current.src = m3u8Url;
            videoRef.current.play().catch(() => {});
        } else {
            setError("Your browser does not support HLS streaming.");
        }

        return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
    }, [streamLink, subData]);

    // ── Quality change ────────────────────────────────────────────────────────
    function handleQualityChange(val) {
        const idx = Number(val);
        setCurrentLevel(idx);
        if (hlsRef.current) hlsRef.current.currentLevel = idx;
    }

    // ── Watch Together ────────────────────────────────────────────────────────
    function handleWatchTogether() {
        const roomId = genRoomId();
        const params = new URLSearchParams({
            animeId: link,
            gateId:  uid,
            name:    "Watch Together",
            source:  "ap",
            origin,
        });
        navigate(`/watch/${roomId}?${params.toString()}`);
    }

    return (
        <div className="player-page">
            <div className="player-topbar">
                <Link to={`/animep/${link}`} className="player-back">← Back</Link>

                <div className="player-topbar-actions">
                    {/* Quality selector */}
                    {levels.length > 0 && (
                        <select
                            className="quality-select"
                            value={currentLevel}
                            onChange={e => handleQualityChange(e.target.value)}
                            title="Video quality"
                        >
                            <option value={-1}>Auto</option>
                            {[...levels].reverse().map(lvl => (
                                <option key={lvl.index} value={lvl.index}>
                                    {lvl.label}
                                </option>
                            ))}
                        </select>
                    )}

                    {streamLink && (
                        <button
                            className="player-watch-together"
                            onClick={handleWatchTogether}
                            title="Watch with a friend"
                        >
                            👥 Watch Together
                        </button>
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
                        <button className="player-retry" onClick={() => navigate(0)}>Retry</button>
                    </div>
                )}
                <video
                    ref={videoRef}
                    className="player-video"
                    controls
                    playsInline
                    style={{ display: streamLink && !error ? "block" : "none" }}
                    onError={() => setError("Video failed to load.")}
                >
                    {subData.map((s, i) => (
                        <track
                            key={s.src}
                            kind="subtitles"
                            src={s.src}
                            label={s.label}
                            srcLang={s.label?.toLowerCase().slice(0, 2) || "en"}
                            default={i === 0}
                        />
                    ))}
                </video>
            </div>
        </div>
    );
}
