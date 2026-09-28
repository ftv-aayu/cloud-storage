import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import useUploader from "../hooks/useUploader";
import UploadProgress from "../components/UploadProgress";
import "../styles/upload.css";
import storageService from "../services/storageService";
import folderService from "../services/folderService";

// Recursively fetch all folders and return a flat list with indent depth
async function loadAllFolders(parentId = null, depth = 0, result = []) {
    const folders = await folderService.getFolders(parentId);
    for (const f of folders) {
        result.push({ ...f, depth });
        await loadAllFolders(f.id, depth + 1, result);
    }
    return result;
}

function Upload() {
    const resumeInput = useRef();
    const [searchParams] = useSearchParams();
    const urlFolderId = searchParams.get("folder");

    // Selected destination folder (null = root)
    const [selectedFolderId, setSelectedFolderId] = useState(urlFolderId ?? null);
    const [allFolders, setAllFolders]             = useState([]);
    const [foldersLoading, setFoldersLoading]     = useState(true);

    const [resumeSession, setResumeSession] = useState(null);
    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        loadSessions();
        // Load full folder tree for the dropdown
        loadAllFolders().then(list => {
            setAllFolders(list);
            setFoldersLoading(false);
        });
    }, []);

    const loadSessions = async () => {

        const data =

            await storageService.getUploadSessions();

        setSessions(data);

    };

    const fileInput = useRef();
    const {
        queue,
        addToQueue,
        startUpload,
        removeFromQueue,
        cancelUpload,
        retryUpload
    } = useUploader();

    const handleFiles = (files) => {
        const fileArray = Array.from(files);
        if (fileArray.length > 0) {
            addToQueue(fileArray, selectedFolderId);
        }
    };
    const chooseFiles = (e) => {
        const selectedFiles = e.target.files;

        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }
        handleFiles(selectedFiles);
        setTimeout(() => {
            e.target.value = "";
        }, 100);
    };
    const dropFiles = (e) => {
        e.preventDefault();
        handleFiles(
            e.dataTransfer.files
        );
    };

    return (
        <div className="page">
            <h1>Upload Files</h1>
            <input ref={resumeInput}
                hidden
                type="file"
                onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (
                        file.name !== resumeSession.name ||
                        file.size !== resumeSession.size ||
                        file.lastModified !== resumeSession.lastModified
                    ) {
                        alert("Wrong file selected.");
                        return;
                    }
                    addToQueue(
                        [file],
                        resumeSession.folderId,
                        resumeSession
                    );
                }}
            />
            {
                sessions.length > 0 &&
                <div className="resumeBox">
                    <h2>Incomplete Uploads</h2>
                    {
                        sessions.map(session => (
                            <div
                                key={session.sessionId}
                                className="resumeCard"
                            >
                                <div>
                                    <b>
                                        {session.name}
                                    </b>
                                    <br />
                                    {
                                        session.multipart ?
                                            Math.round(
                                                session.nextChunk /
                                                session.totalChunks * 100
                                            )
                                            + "%" : "Single File"
                                    }
                                </div>
                                <div>
                                    <button
                                        onClick={() => {
                                            setResumeSession(session);
                                            resumeInput.current.click();
                                        }}
                                    >Resume
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await storageService.deleteUploadSession(
                                                session.sessionId
                                            );
                                            loadSessions();
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    }
                </div>
            }
            {/* Folder destination selector */}
            <div className="upload-folder-selector">
                <label className="upload-folder-label" htmlFor="upload-folder-select">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    Upload destination
                </label>
                <select
                    id="upload-folder-select"
                    className="upload-folder-select"
                    value={selectedFolderId ?? ""}
                    onChange={e => setSelectedFolderId(e.target.value || null)}
                    disabled={foldersLoading}
                >
                    <option value="">/ Root</option>
                    {allFolders.map(f => (
                        <option key={f.id} value={f.id}>
                            {"\u00A0\u00A0\u00A0\u00A0".repeat(f.depth)}└ {f.name}
                        </option>
                    ))}
                </select>
            </div>

            <div
                className="dropZone"
                onDragOver={e => e.preventDefault()}
                onDrop={dropFiles}
                onClick={() => fileInput.current.click()}
            >
                <h2>Drag & Drop Files</h2>
                <p>or click to select</p>
            </div>
            <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={chooseFiles}
            />
            <div className="queue">
                {
                    queue.map(item => (
                        <UploadProgress
                            key={item.id}
                            data={{
                                ...item,
                                onCancel: () => cancelUpload(item.id),
                                onRetry: () => retryUpload(item.id)
                            }}
                            onRemove={() =>
                                removeFromQueue(item.id)
                            }
                        />
                    ))
                }
            </div>
            {
                queue.length > 0 &&
                <button
                    className="uploadBtn"
                    onClick={startUpload}
                >Upload All
                </button>
            }
        </div>
    );
}
export default Upload;