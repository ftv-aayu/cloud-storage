import { useEffect, useRef, useState, useCallback } from "react";
import {
    doc, setDoc, onSnapshot, collection,
    addDoc, query, orderBy, limit, serverTimestamp, updateDoc,
    getDocs, deleteDoc, where, Timestamp
} from "firebase/firestore";
import db from "../config/firebase";

const SYNC_THRESHOLD = 2; // seconds — don't seek if within this range
const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Delete all docs in a collection ref
async function deleteCollection(colRef) {
    const snap = await getDocs(colRef);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// Clean up rooms older than TTL — runs once on first join
async function pruneOldRooms() {
    try {
        const cutoff = Date.now() - ROOM_TTL_MS;
        const roomsSnap = await getDocs(collection(db, "rooms"));
        for (const roomDoc of roomsSnap.docs) {
            const data = roomDoc.data();
            if (data.createdAt && data.createdAt < cutoff) {
                // Delete subcollections then the room doc
                await deleteCollection(collection(db, "rooms", roomDoc.id, "messages"));
                await deleteCollection(collection(db, "rooms", roomDoc.id, "peers"));
                await deleteCollection(collection(db, "rooms", roomDoc.id, "signals"));
                await deleteCollection(collection(db, "rooms", roomDoc.id, "meta"));
                await deleteDoc(roomDoc.ref);
            }
        }
    } catch (e) {
        // Silently ignore — cleanup is best-effort
    }
}

export function useWatchRoom(roomId, videoRef) {
    const [messages, setMessages]   = useState([]);
    const [roomState, setRoomState] = useState(null); // { isPlaying, currentTime, animeId, gateId, updatedBy }
    const [peers, setPeers]         = useState([]);   // peer list for WebRTC
    const myId = useRef(Math.random().toString(36).slice(2));
    const isSyncing = useRef(false); // prevent feedback loop

    const roomRef    = doc(db, "rooms", roomId);
    const stateRef   = doc(db, "rooms", roomId, "meta", "state");
    const messagesRef = collection(db, "rooms", roomId, "messages");
    const peersRef    = collection(db, "rooms", roomId, "peers");

    // ── Init room ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const myPeerDoc = doc(db, "rooms", roomId, "peers", myId.current);

        // Register self
        setDoc(myPeerDoc, { joined: Date.now(), id: myId.current }, { merge: true });

        // Stamp room creation time
        setDoc(doc(db, "rooms", roomId), { createdAt: Date.now() }, { merge: true });

        pruneOldRooms();

        // Remove self on page close/refresh (sync via navigator.sendBeacon isn't
        // available for Firestore, so we use deleteDoc which is fast)
        const cleanup = () => deleteDoc(myPeerDoc).catch(() => {});

        // beforeunload fires on tab close / navigation — best effort
        window.addEventListener("beforeunload", cleanup);

        return () => {
            window.removeEventListener("beforeunload", cleanup);
            cleanup();
        };
    }, [roomId]);

    // ── Listen to play state ───────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onSnapshot(stateRef, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            setRoomState(data);

            // Don't apply our own updates back
            if (data.updatedBy === myId.current) return;
            if (!videoRef.current) return;

            isSyncing.current = true;
            const video = videoRef.current;

            if (Math.abs(video.currentTime - data.currentTime) > SYNC_THRESHOLD) {
                video.currentTime = data.currentTime;
            }

            if (data.isPlaying && video.paused) {
                video.play().catch(() => {});
            } else if (!data.isPlaying && !video.paused) {
                video.pause();
            }

            setTimeout(() => { isSyncing.current = false; }, 300);
        });
        return unsub;
    }, [roomId, videoRef]);

    // ── Listen to peers ────────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onSnapshot(peersRef, (snap) => {
            // Docs are deleted when a peer leaves, so just count all docs
            setPeers(snap.docs.map(d => d.data()));
        });
        return unsub;
    }, [roomId]);

    // ── Listen to messages ─────────────────────────────────────────────────────
    useEffect(() => {
        const q = query(messagesRef, orderBy("ts", "asc"), limit(100));
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, [roomId]);

    // ── Push play state ────────────────────────────────────────────────────────
    const pushState = useCallback((isPlaying, currentTime) => {
        if (isSyncing.current) return;
        setDoc(stateRef, {
            isPlaying,
            currentTime,
            updatedBy: myId.current,
            updatedAt: Date.now(),
        }, { merge: true });
    }, [stateRef]);

    // ── Send message ───────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (content, type = "text") => {
        // type: "text" | "emoji" | "sticker"
        await addDoc(messagesRef, {
            content,
            type,
            sender: myId.current,
            ts: serverTimestamp(),
        });
    }, [messagesRef]);

    // ── Init room with anime info ──────────────────────────────────────────────
    const initRoom = useCallback(async (animeId, gateId, animeName) => {
        await setDoc(stateRef, {
            isPlaying: false,
            currentTime: 0,
            animeId,
            gateId,
            animeName: animeName || "",
            updatedBy: myId.current,
            updatedAt: Date.now(),
        }, { merge: true });
    }, [stateRef]);

    return {
        myId: myId.current,
        messages,
        roomState,
        peers,
        pushState,
        sendMessage,
        initRoom,
        isSyncing,
    };
}
