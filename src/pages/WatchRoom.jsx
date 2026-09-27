import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import Hls from "hls.js";
import { useWatchRoom } from "../hooks/useWatchRoom";
import { useWebRTC } from "../hooks/useWebRTC";
import { STICKER_GROUPS, GENSHIN_STICKERS } from "../utils/genshinStickers";
import "../styles/watchRoom.css";

const PROXY = import.meta.env.VITE_ANIME_PROXY || "http://localhost:3001";

// ── helpers ───────────────────────────────────────────────────────────────────

function genRoomId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function shortId(id) {
    return id.slice(0, 6);
}

function formatTime(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Remote video tile ─────────────────────────────────────────────────────────

function RemoteTile({ stream, peerId }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && stream) ref.current.srcObject = stream;
    }, [stream]);
    return (
        <div className="wr-tile">
            <video ref={ref} autoPlay playsInline muted={false} className="wr-tile-video" />
            <span className="wr-tile-label">{shortId(peerId)}</span>
        </div>
    );
}

// ── Local video tile ──────────────────────────────────────────────────────────

function LocalTile({ stream }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && stream) ref.current.srcObject = stream;
    }, [stream]);
    return (
        <div className="wr-tile wr-tile-local">
            <video ref={ref} autoPlay playsInline muted className="wr-tile-video" />
            <span className="wr-tile-label">You</span>
        </div>
    );
}

// ── Chat message ──────────────────────────────────────────────────────────────

function ChatMessage({ msg, myId }) {
    const isMe = msg.sender === myId;
    return (
        <div className={`wr-msg ${isMe ? "wr-msg-me" : "wr-msg-other"}`}>
            {!isMe && <span className="wr-msg-sender">{shortId(msg.sender)}</span>}
            {msg.type === "sticker" ? (
                <img src={msg.content} alt="sticker" className="wr-msg-sticker" />
            ) : msg.type === "emoji" ? (
                <span className="wr-msg-emoji">{msg.content}</span>
            ) : (
                <span className="wr-msg-bubble">{msg.content}</span>
            )}
            <span className="wr-msg-time">{formatTime(msg.ts)}</span>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WatchRoom() {
    const { roomId } = useParams();
    const [searchParams] = useSearchParams();
    const animeId   = searchParams.get("animeId");
    const gateId    = searchParams.get("gateId");
    const animeName = searchParams.get("name") || "Anime";
    const source    = searchParams.get("source") || "ah"; // "ah" or "ap"
    const origin    = searchParams.get("origin") || "";

    const videoRef = useRef(null);
    const hlsRef   = useRef(null);

    const {
        myId, messages, roomState, peers,
        pushState, sendMessage, initRoom, isSyncing,
    } = useWatchRoom(roomId, videoRef);

    const {
        localStream, remoteStreams,
        voiceOn, cameraOn,
        toggleMic, toggleCamera,
    } = useWebRTC(roomId, myId);

    // Video state
    const [streamUrl, setStreamUrl]     = useState(null);
    const [videoLoading, setVideoLoading] = useState(true);
    const [videoError, setVideoError]   = useState(null);

    // Chat UI state
    const [text, setText]               = useState("");
    const [showEmoji, setShowEmoji]     = useState(false);
    const [showStickers, setShowStickers] = useState(false);
    const [stickerChar, setStickerChar] = useState(STICKER_GROUPS[0]?.character ?? "");
    const [chatOpen, setChatOpen]       = useState(true);
    const [copied, setCopied]           = useState(false);
    const messagesEndRef                = useRef(null);

    // ── Load video ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!gateId) return;
        setVideoLoading(true);
        setVideoError(null);

        const loadVideo = async () => {
            try {
                if (source === "ap") {
                    // AnimParadise: get streamLink → HLS
                    const data = await fetch(
                        `${PROXY}/ap/stream?uid=${encodeURIComponent(gateId)}&origin=${encodeURIComponent(origin)}`
                    ).then(r => r.ok ? r.json() : Promise.reject(r.status));

                    if (!data.streamLink) throw new Error("No stream link");

                    const m3u8Url = `https://stream.animeparadise.moe/m3u8?url=${encodeURIComponent(data.streamLink)}`;

                    // Attach HLS.js
                    if (hlsRef.current) hlsRef.current.destroy();
                    if (Hls.isSupported()) {
                        const hls = new Hls({ enableWorker: true });
                        hls.loadSource(m3u8Url);
                        hls.attachMedia(videoRef.current);
                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                            videoRef.current?.play().catch(() => {});
                        });
                        hls.on(Hls.Events.ERROR, (_e, d) => {
                            if (d.fatal) setVideoError("Stream error.");
                        });
                        hlsRef.current = hls;
                    } else if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
                        videoRef.current.src = m3u8Url;
                    }
                    setStreamUrl(m3u8Url); // for sync tracking
                } else {
                    // AnimeHeaven: mp4 via proxy stream
                    const data = await fetch(
                        `${PROXY}/watch?id=${encodeURIComponent(gateId)}`
                    ).then(r => r.ok ? r.json() : Promise.reject(r.status));

                    if (!data.videoUrl) throw new Error("No URL");
                    const url = `${PROXY}/stream?url=${encodeURIComponent(data.videoUrl)}`;
                    setStreamUrl(url);
                    if (videoRef.current) videoRef.current.src = url;
                }
                initRoom(animeId, gateId, animeName);
            } catch (e) {
                setVideoError("Failed to load video.");
            } finally {
                setVideoLoading(false);
            }
        };

        loadVideo();

        return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
    }, [gateId, source, origin]);

    // ── Sync video events → Firestore ─────────────────────────────────────────
    const onPlay = useCallback(() => {
        if (isSyncing.current) return;
        pushState(true, videoRef.current?.currentTime ?? 0);
    }, [pushState, isSyncing]);

    const onPause = useCallback(() => {
        if (isSyncing.current) return;
        pushState(false, videoRef.current?.currentTime ?? 0);
    }, [pushState, isSyncing]);

    const onSeeked = useCallback(() => {
        if (isSyncing.current) return;
        pushState(!videoRef.current?.paused, videoRef.current?.currentTime ?? 0);
    }, [pushState, isSyncing]);

    // ── Scroll chat to bottom ─────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ── Send message ──────────────────────────────────────────────────────────
    function handleSend(e) {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        sendMessage(t, "text");
        setText("");
        setShowEmoji(false);
    }

    function handleEmojiSelect(emoji) {
        sendMessage(emoji.native, "emoji");
        setShowEmoji(false);
    }

    // ── Copy room link ────────────────────────────────────────────────────────
    function copyLink() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    const peerCount = peers.filter(p => !p.left).length;

    return (
        <div className="wr-root">
            {/* ── Top bar ── */}
            <div className="wr-topbar">
                <Link to={animeId ? `/anime/${animeId}` : "/anime"} className="wr-back">← Back</Link>
                <div className="wr-topbar-center">
                    <span className="wr-room-name">{animeName}</span>
                    <span className="wr-peer-count">{peerCount} watching</span>
                </div>
                <button className="wr-copy-btn" onClick={copyLink}>
                    {copied ? "✓ Copied!" : "🔗 Invite"}
                </button>
            </div>

            <div className="wr-body">
                {/* ── Video column ── */}
                <div className="wr-video-col">
                    {/* Video tiles (voice/camera participants) */}
                    {(localStream || Object.keys(remoteStreams).length > 0) && (
                        <div className="wr-tiles">
                            {localStream && <LocalTile stream={localStream} />}
                            {Object.entries(remoteStreams).map(([pid, stream]) => (
                                <RemoteTile key={pid} peerId={pid} stream={stream} />
                            ))}
                        </div>
                    )}

                    {/* Main video */}
                    <div className="wr-video-wrap">
                        {videoLoading && (
                            <div className="wr-video-state">
                                <div className="wr-spinner" />
                                <p>Loading...</p>
                            </div>
                        )}
                        {videoError && (
                            <div className="wr-video-state wr-video-error">
                                <p>{videoError}</p>
                            </div>
                        )}
                        {streamUrl && (
                            <video
                                ref={videoRef}
                                className="wr-video"
                                src={source === "ah" ? streamUrl : undefined}
                                controls
                                playsInline
                                onPlay={onPlay}
                                onPause={onPause}
                                onSeeked={onSeeked}
                                onError={() => setVideoError("Video failed to play.")}
                            />
                        )}
                    </div>

                    {/* ── Voice / camera controls ── */}
                    <div className="wr-media-bar">
                        <button
                            className={`wr-media-btn ${voiceOn ? "wr-media-on" : ""}`}
                            onClick={toggleMic}
                            title={voiceOn ? "Mute mic" : "Unmute mic"}
                        >
                            {voiceOn ? "🎙️ Mic On" : "🎤 Mic Off"}
                        </button>
                        <button
                            className={`wr-media-btn ${cameraOn ? "wr-media-on" : ""}`}
                            onClick={toggleCamera}
                            title={cameraOn ? "Turn off camera" : "Turn on camera"}
                        >
                            {cameraOn ? "📷 Cam On" : "📷 Cam Off"}
                        </button>
                        <button
                            className="wr-media-btn wr-chat-toggle"
                            onClick={() => setChatOpen(o => !o)}
                        >
                            💬 {chatOpen ? "Hide Chat" : "Show Chat"}
                        </button>
                    </div>
                </div>

                {/* ── Chat panel ── */}
                {chatOpen && (
                    <div className="wr-chat">
                        {/* Chat header with close button — always visible */}
                        <div className="wr-chat-header">
                            <span>💬 Chat</span>
                            <button className="wr-chat-close" onClick={() => setChatOpen(false)}>✕</button>
                        </div>
                        <div className="wr-chat-messages">
                            {messages.length === 0 && (
                                <p className="wr-chat-empty">No messages yet. Say hi! 👋</p>
                            )}
                            {messages.map(msg => (
                                <ChatMessage key={msg.id} msg={msg} myId={myId} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Emoji picker */}
                        {showEmoji && (
                            <div className="wr-emoji-picker">
                                <Picker
                                    data={data}
                                    onEmojiSelect={handleEmojiSelect}
                                    theme="dark"
                                    previewPosition="none"
                                    skinTonePosition="none"
                                />
                            </div>
                        )}

                        {/* Sticker picker */}
                        {showStickers && (
                            <div className="wr-sticker-picker">
                                {/* Character tabs */}
                                <div className="wr-sticker-tabs">
                                    {STICKER_GROUPS.map(g => (
                                        <button
                                            key={g.character}
                                            className={`wr-sticker-tab${stickerChar === g.character ? " wr-sticker-tab-active" : ""}`}
                                            onClick={() => setStickerChar(g.character)}
                                        >
                                            {g.character}
                                        </button>
                                    ))}
                                </div>
                                {/* Sticker grid */}
                                <div className="wr-sticker-grid">
                                    {GENSHIN_STICKERS
                                        .filter(s => s.character === stickerChar)
                                        .map(s => (
                                            <img
                                                key={s.id}
                                                src={s.url}
                                                alt={s.label}
                                                title={s.label}
                                                className="wr-sticker-img"
                                                onClick={() => {
                                                    sendMessage(s.url, "sticker");
                                                    setShowStickers(false);
                                                }}
                                            />
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Input bar */}
                        <form className="wr-chat-form" onSubmit={handleSend}>
                            <button
                                type="button"
                                className="wr-emoji-btn"
                                onClick={() => { setShowEmoji(o => !o); setShowStickers(false); }}
                                title="Emoji"
                            >
                                😊
                            </button>
                            <button
                                type="button"
                                className="wr-emoji-btn"
                                onClick={() => { setShowStickers(o => !o); setShowEmoji(false); }}
                                title="Genshin stickers"
                            >
                                ✨
                            </button>
                            <input
                                className="wr-chat-input"
                                value={text}
                                onChange={e => setText(e.target.value)}
                                placeholder="Type a message..."
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                className="wr-send-btn"
                                disabled={!text.trim()}
                            >
                                ➤
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Floating chat button — visible when chat is closed, especially useful in mobile landscape */}
            {!chatOpen && (
                <button className="wr-fab-chat" onClick={() => setChatOpen(true)}>
                    💬
                    {messages.length > 0 && <span className="wr-fab-badge">{messages.length > 9 ? "9+" : messages.length}</span>}
                </button>
            )}
        </div>
    );
}
