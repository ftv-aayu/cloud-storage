import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import Hls from "hls.js";
import "../styles/animePlayer.css";

const PROXY = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";

function genRoomId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Simple VTT parser → [{start, end, text}]
function parseVTT(vttText) {
    const cues = [];
    const blocks = vttText.replace(/\r\n/g, "\n").split(/\n\n+/);
    const timeRe = /(\d+):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d+):(\d{2}):(\d{2})[.,](\d{3})/;
    for (const block of blocks) {
        const lines = block.trim().split("\n");
        let ti = -1;
        for (let i = 0; i < lines.length; i++) { if (timeRe.test(lines[i])) { ti = i; break; } }
        if (ti < 0) continue;
        const m = lines[ti].match(timeRe);
        const toSec = (h, mn, s, ms) => +h * 3600 + +mn * 60 + +s + +ms / 1000;
        const text = lines.slice(ti + 1).join("\n").trim();
        if (text) cues.push({ start: toSec(m[1],m[2],m[3],m[4]), end: toSec(m[5],m[6],m[7],m[8]), text });
    }
    return cues;
}

// Fetch streamLink directly from browser using animeparadise.moe next-action
// Browser sends its own cookies → token is valid for that browser session/IP
async function fetchStreamLinkFromBrowser(uid, origin) {
    // 1. Get the current next-action hash from our proxy
    const hashRes = await fetch(`${PROXY}/ap/action-hash`);
    const { watchHash } = await hashRes.json();

    // 2. POST directly to animeparadise.moe (browser sends cookies automatically)
    const res = await fetch(
        `https://www.animeparadise.moe/watch/${uid}?origin=${origin}`,
        {
            method: "POST",
            credentials: "include",
            headers: {
                "Accept": "text/x-component",
                "Content-Type": "text/plain;charset=UTF-8",
                "next-action": watchHash,
            },
            body: JSON.stringify([uid, origin]),
        }
    );

    if (!res.ok) throw new Error(`Watch action failed: ${res.status}`);

    const text = await res.text();
    for (const line of text.split("\n")) {
        if (line.startsWith("1:")) {
            const data = JSON.parse(line.slice(2));
            return {
                streamLink: data?.episode?.streamLink || null,
                subData: data?.episode?.subData || [],
            };
        }
    }
    throw new Error("No streamLink in response");
}

export default function AnimePlayerAP() {
    const { link, uid }  = useParams();
    const [searchParams] = useSearchParams();
    const origin         = searchParams.get("origin") ?? "";
    const navigate       = useNavigate();
    const videoRef       = useRef(null);
    const hlsRef         = useRef(null);

    const [streamLink,   setStreamLink]   = useState(null);
    const [subData,      setSubData]      = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [levels,       setLevels]       = useState([]);
    const [currentLevel, setCurrentLevel] = useState(-1);

    // ── Fetch stream link directly from browser ───────────────────────────────
    useEffect(() => {
        setLoading(true);
        setError(null);
        setStreamLink(null);
        setSubData([]);
        setLevels([]);
        setCurrentLevel(-1);

        fetchStreamLinkFromBrowser(uid, origin)
            .then(data => {
                if (!data.streamLink) throw new Error("No stream link");
                setStreamLink(data.streamLink);
                // VTT subs from stream.animeparadise.moe — browser can fetch directly
                const vtts = data.subData.filter(s => s.type === "vtt" && s.src.startsWith("http"));
                setSubData(vtts);
            })
            .catch(err => setError("Could not load episode. " + err.message))
            .finally(() => setLoading(false));
    }, [uid, origin]);

    // ── Attach HLS.js — point directly at stream.animeparadise.moe ───────────
    useEffect(() => {
        if (!streamLink || !videoRef.current) return;

        // Browser fetches m3u8 directly — it has the right IP and session context
        const m3u8Url = `https://stream.animeparadise.moe/m3u8?url=${encodeURIComponent(streamLink)}`;

        if (hlsRef.current) hlsRef.current.destroy();

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                xhrSetup: (xhr) => {
                    // Spoof Referer for segment requests
                    // (can't set Referer via XHR, but CDN is lenient once manifest loads)
                },
            });
            hls.loadSource(m3u8Url);
            hls.attachMedia(videoRef.current);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current?.play().catch(() => {});
                const lvls = hls.levels.map((lvl, i) => ({
                    index: i,
                    label: lvl.height ? `${lvl.height}p` : `Level ${i + 1}`,
                }));
                setLevels(lvls);

                // Add VTT subtitle tracks via DOM TextTrack API
                subData.forEach((s, i) => {
                    try {
                        const track = videoRef.current.addTextTrack(
                            "subtitles", s.label,
                            s.label?.toLowerCase().slice(0, 2) || "en"
                        );
                        track.mode = i === 0 ? "showing" : "hidden";
                        fetch(s.src)
                            .then(r => r.text())
                            .then(vtt => {
                                parseVTT(vtt).forEach(c => {
                                    try { track.addCue(new VTTCue(c.start, c.end, c.text)); } catch {}
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

    function handleQualityChange(val) {
        const idx = Number(val);
        setCurrentLevel(idx);
        if (hlsRef.current) hlsRef.current.currentLevel = idx;
    }

    function handleWatchTogether() {
        const roomId = genRoomId();
        const params = new URLSearchParams({
            animeId: link, gateId: uid,
            name: "Watch Together", source: "ap", origin,
        });
        navigate(`/watch/${roomId}?${params.toString()}`);
    }

    return (
        <div className="player-page">
            <div className="player-topbar">
                <Link to={`/animep/${link}`} className="player-back">← Back</Link>
                <div className="player-topbar-actions">
                    {levels.length > 0 && (
                        <select className="quality-select" value={currentLevel}
                            onChange={e => handleQualityChange(e.target.value)} title="Video quality">
                            <option value={-1}>Auto</option>
                            {[...levels].reverse().map(lvl => (
                                <option key={lvl.index} value={lvl.index}>{lvl.label}</option>
                            ))}
                        </select>
                    )}
                    {streamLink && (
                        <button className="player-watch-together" onClick={handleWatchTogether}
                            title="Watch with a friend">
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
                />
            </div>
        </div>
    );
}
