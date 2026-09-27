import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "../components/Navbar";
import Home from "../pages/Home";
import FolderPage from "../pages/FolderPage";
import Upload from "../pages/Upload";
import Auth from "../pages/Auth";
import Anime from "../pages/Anime";
import AnimeDetail from "../pages/AnimeDetail";
import AnimePlayer from "../pages/AnimePlayer";
import WatchRoom from "../pages/WatchRoom";
import AnimeDetailAP from "../pages/AnimeDetailAP";
import AnimePlayerAP from "../pages/AnimePlayerAP";

function Router() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route
                    path="/"
                    element={<Home />}
                />
                <Route
                    path="/folder/:folderId/:fileId?"
                    element={<FolderPage />}
                />
                <Route
                    path="/upload"
                    element={<Upload />}
                />
                <Route
                    path="/auth"
                    element={<Auth />}
                />
                <Route
                    path="/anime"
                    element={<Anime />}
                />
                <Route
                    path="/anime/:id"
                    element={<AnimeDetail />}
                />
                <Route
                    path="/anime/:id/ep/:gateId"
                    element={<AnimePlayer />}
                />
                <Route
                    path="/watch/:roomId"
                    element={<WatchRoom />}
                />
                <Route
                    path="/animep/:link"
                    element={<AnimeDetailAP />}
                />
                <Route
                    path="/animep/:link/ep/:uid"
                    element={<AnimePlayerAP />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default Router;
