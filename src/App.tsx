import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { AssetsPage } from "./pages/AssetsPage";
import { AssetDetailsPage } from "./pages/AssetDetailsPage";
import { ComparePage } from "./pages/ComparePage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <span>IN</span>
                    <div>
                        <strong>Invest Navigator</strong>
                        <small>Static Demo</small>
                    </div>
                </div>

                <nav className="nav">
                    <NavLink to="/">Дашборд</NavLink>
                    <NavLink to="/assets">Активы</NavLink>
                    <NavLink to="/compare">Сравнение</NavLink>
                    <NavLink to="/portfolio">Портфель</NavLink>
                    <NavLink to="/settings">Диагностика</NavLink>
                </nav>
            </aside>

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/assets" element={<AssetsPage />} />
                    <Route path="/assets/:ticker" element={<AssetDetailsPage />} />
                    <Route path="/compare" element={<ComparePage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </main>
        </div>
    );
}
