import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import "./styles/index.css";
import "./styles/app.css";
import "./styles/dashboard.css";
import "./styles/asset-details.css";
import "./styles/compare.css";
import "./styles/portfolio.css";
import "./styles/ai-report.css";
import "./styles/data.css";
import "./styles/responsive.css";
import "./styles/compact-layout.css";
import "./styles/final-mobile-polish.css";
import "./styles/final-graph-compare-fix.css";
import "./styles/final-last-mobile-fixes.css";
import "./styles/final-colors-and-history.css";
import "./styles/final-trading-polish.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Root element not found");
}

createRoot(rootElement).render(
    <StrictMode>
        <HashRouter>
            <App />
        </HashRouter>
    </StrictMode>
);