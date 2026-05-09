import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/browserMarketDataService";
import { getSimulator } from "../services/browserPortfolioService";
import type { AnalyticsSummary, PortfolioSimulator } from "../types/domain";
import { LoadingBlock } from "../components/LoadingBlock";

export function DashboardPage() {
    const [analytics, setAnalytics] = useState<AnalyticsSummary[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioSimulator | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setIsLoading(true);

            const assets = getAssets();
            const [loadedPortfolio, loadedAnalytics] = await Promise.all([
                getSimulator(),
                Promise.all(assets.map((asset) => getAnalyticsSummary(asset.ticker)))
            ]);

            setPortfolio(loadedPortfolio);
            setAnalytics(loadedAnalytics);
            setIsLoading(false);
        }

        load();
    }, []);

    const averageRisk = useMemo(() => {
        if (analytics.length === 0) return 0;

        return analytics.reduce((sum, item) => sum + item.riskScore, 0) / analytics.length;
    }, [analytics]);

    const topRisk = useMemo(() => {
        return [...analytics].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);
    }, [analytics]);

    const topGrowth = useMemo(() => {
        return [...analytics].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 3);
    }, [analytics]);

    if (isLoading) {
        return <LoadingBlock text="Собираем дашборд..." />;
    }

    return (
        <section className="page dashboard-page">
            <div className="dashboard-hero">
                <div>
                    <p className="eyebrow">GitHub Pages Demo</p>
                    <h1>Invest Navigator AI</h1>
                </div>

                <div className="dashboard-orb">
                    <strong>{Math.round(averageRisk)}</strong>
                    <span>средний риск</span>
                </div>
            </div>

            <div className="dashboard-grid">
                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>Симулятор</h2>
                            <p>Счёт, лоты и сделки хранятся в localStorage.</p>
                        </div>
                        <Link to="/portfolio" className="primary-button">Открыть</Link>
                    </div>

                    {portfolio && (
                        <div className="summary-grid">
                            <Summary label="Активов" value={String(portfolio.assetsCount)} />
                            <Summary label="Лотов" value={String(portfolio.lotsCount)} />
                            <Summary label="RUB PnL" value={formatMoney(portfolio.totalRubProfitLoss, "RUB")} />
                            <Summary label="USD PnL" value={formatMoney(portfolio.totalUsdProfitLoss, "USD")} />
                        </div>
                    )}
                </article>

                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>Топ риска</h2>
                            <p>По браузерной аналитике.</p>
                        </div>
                    </div>

                    <div className="ranking-list">
                        {topRisk.map((item, index) => (
                            <Link to={`/assets/${item.ticker}`} className="ranking-row" key={item.ticker}>
                                <span>#{index + 1}</span>
                                <strong>{item.ticker}</strong>
                                <em>{item.riskScore}/100</em>
                            </Link>
                        ))}
                    </div>
                </article>
            </div>

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Лучший рост</h2>
                    </div>
                </div>

                <div className="ranking-list ranking-list-wide">
                    {topGrowth.map((item, index) => (
                        <Link to={`/assets/${item.ticker}`} className="ranking-row" key={item.ticker}>
                            <span>#{index + 1}</span>
                            <strong>{item.ticker}</strong>
                            <em>{formatPercent(item.priceChangePercent)}</em>
                        </Link>
                    ))}
                </div>
            </article>
        </section>
    );
}

type SummaryProps = {
    label: string;
    value: string;
};

function Summary({ label, value }: SummaryProps) {
    return (
        <div className="summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)}%`;
}
