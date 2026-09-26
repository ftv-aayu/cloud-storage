import { useEffect, useRef, useState, useCallback } from "react";
import SimplePeer from "simple-peer";
import {
    collection, doc, onSnapshot, addDoc, deleteDoc, query, where, getDocs
} from "firebase/firestore";
import db from "../config/firebase";

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
};

export function useWebRTC(roomId, myId) {
    const [localStream, setLocalStream]    = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({}); // peerId → MediaStream
    const [voiceOn, setVoiceOn]            = useState(false);
    const [cameraOn, setCameraOn]          = useState(false);
    const [error, setError]                = useState(null);

    const peersRef   = useRef({});   // peerId → SimplePeer instance
    const streamRef  = useRef(null); // current local MediaStream
    const signalRef  = collection(db, "rooms", roomId, "signals");

    // ── Destroy all peer connections ──────────────────────────────────────────
    const destroyAllPeers = useCallback(() => {
        Object.values(peersRef.current).forEach(p => {
            try { p.destroy(); } catch {}
        });
        peersRef.current = {};
    }, []);

    // ── Create a single peer connection ───────────────────────────────────────
    const createPeer = useCallback((peerId, initiator, stream) => {
        // Destroy existing connection to this peer first
        if (peersRef.current[peerId]) {
            try { peersRef.current[peerId].destroy(); } catch {}
            delete peersRef.current[peerId];
        }

        const peer = new SimplePeer({
            initiator,
            stream: stream || undefined,
            trickle: true,
            config: ICE_SERVERS,
        });

        peer.on("signal", async (data) => {
            await addDoc(signalRef, {
                from: myId,
                to: peerId,
                data: JSON.stringify(data),
                ts: Date.now(),
            });
        });

        peer.on("stream", (remoteStream) => {
            setRemoteStreams(prev => ({ ...prev, [peerId]: remoteStream }));
        });

        peer.on("close", () => {
            setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[peerId];
                return next;
            });
            delete peersRef.current[peerId];
        });

        peer.on("error", (err) => {
            console.warn("Peer error:", peerId, err.message);
        });

        peersRef.current[peerId] = peer;
        return peer;
    }, [myId, signalRef]);

    // ── Reconnect all peers with the new stream ───────────────────────────────
    const reconnectAll = useCallback((stream) => {
        const peerIds = Object.keys(peersRef.current);
        destroyAllPeers();
        // Small delay so remote side can detect the close before we reconnect
        setTimeout(() => {
            peerIds.forEach(peerId => {
                const initiate = myId < peerId;
                createPeer(peerId, initiate, stream);
            });
        }, 500);
    }, [myId, destroyAllPeers, createPeer]);

    // ── Get local media ───────────────────────────────────────────────────────
    const startMedia = useCallback(async ({ audio = true, video = false } = {}) => {
        try {
            // Stop existing tracks first
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
            streamRef.current = stream;
            setLocalStream(stream);
            setVoiceOn(audio);
            setCameraOn(video);

            // Reconnect all peers with new stream so they see our camera/mic
            reconnectAll(stream);

            return stream;
        } catch (err) {
            setError("Media access denied: " + err.message);
            return null;
        }
    }, [reconnectAll]);

    const stopMedia = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setLocalStream(null);
        setVoiceOn(false);
        setCameraOn(false);
        // Reconnect without stream so peers lose our video/audio
        reconnectAll(null);
    }, [reconnectAll]);

    const toggleMic = useCallback(async () => {
        if (voiceOn && !cameraOn) {
            stopMedia();
        } else if (voiceOn && cameraOn) {
            await startMedia({ audio: false, video: true });
        } else {
            await startMedia({ audio: true, video: cameraOn });
        }
    }, [voiceOn, cameraOn, startMedia, stopMedia]);

    const toggleCamera = useCallback(async () => {
        if (cameraOn && !voiceOn) {
            stopMedia();
        } else if (cameraOn && voiceOn) {
            await startMedia({ audio: true, video: false });
        } else {
            await startMedia({ audio: voiceOn, video: true });
        }
    }, [voiceOn, cameraOn, startMedia, stopMedia]);

    // ── Listen for incoming signals ───────────────────────────────────────────
    useEffect(() => {
        const q = query(signalRef, where("to", "==", myId));
        const unsub = onSnapshot(q, (snap) => {
            snap.docChanges().forEach(change => {
                if (change.type !== "added") return;
                const { from, data } = change.doc.data();
                const signal = JSON.parse(data);

                let peer = peersRef.current[from];
                if (!peer) {
                    // Incoming connection from someone — create non-initiator peer
                    peer = createPeer(from, false, streamRef.current);
                }
                try { peer.signal(signal); } catch (e) {
                    console.warn("Signal error:", e.message);
                }

                // Clean up processed signal
                deleteDoc(change.doc.ref).catch(() => {});
            });
        });
        return unsub;
    }, [myId, roomId, createPeer, signalRef]);

    // ── Watch for new peers joining and connect to them ───────────────────────
    useEffect(() => {
        const peersColRef = collection(db, "rooms", roomId, "peers");
        const unsub = onSnapshot(peersColRef, (snap) => {
            snap.docs.forEach(d => {
                const peerId = d.id;
                if (peerId === myId) return;
                if (d.data().left) return;
                if (peersRef.current[peerId]) return;
                // Initiate if my ID is lexicographically smaller
                const initiate = myId < peerId;
                createPeer(peerId, initiate, streamRef.current);
            });
        });
        return unsub;
    }, [roomId, myId, createPeer]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            destroyAllPeers();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, [destroyAllPeers]);

    return {
        localStream,
        remoteStreams,
        voiceOn,
        cameraOn,
        error,
        toggleMic,
        toggleCamera,
        startMedia,
        stopMedia,
    };
}
