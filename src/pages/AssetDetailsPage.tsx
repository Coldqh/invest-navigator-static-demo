import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import { getAsset } from "../services/assetsService";
import { generateAssetReport, type AiReport } from "../services/browserAiService";
import { getAnalyticsSummary, getMarketPrice } from "../services/browserMarketDataService";
import type { AnalyticsSummary, MarketPrice } from "../types/domain";

export function AssetDetailsPage() {
    const { ticker = "" } = useParams();
    const asset = getAsset(ticker);
    const [price, setPrice] = useState<MarketPrice | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [report, setReport] = useState<AiReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            if (!asset) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            const [loadedPrice, loadedAnalytics] = await Promise.all([
                getMarketPrice(asset.ticker),
                getAnalyticsSummary(asset.ticker)
            ]);

            setPrice(loadedPrice);
            setAnalytics(loadedAnalytics);
            setIsLoading(false);
        }

        load();
    }, [asset?.ticker]);

    async function handleGenerateReport() {
        if (!analytics) return;

        const nextReport = await generateAssetReport(analytics);
        setReport(nextReport);
    }

    if (!asset) {
        return (
            <section className="page">
                <div className="empty-state">Актив не найден</div>
            </section>
        );
    }

    if (isLoading) {
        return <LoadingBlock text="Загружаем актив..." />;
    }

    return (
        <section className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">{asset.exchange}</p>
                    <h1>{asset.ticker}</h1>
                    <p>{asset.name}</p>
                </div>

                <div className="hero-actions">
                    <Link to="/portfolio" className="primary-button">Купить в портфеле</Link>
                    <button type="button" className="ghost-button" onClick={handleGenerateReport}>
                        AI-отчёт
                    </button>
                </div>
            </div>

            <div className="summary-grid">
                <Summary label="Цена" value={price ? formatMoney(price.price, asset.currency) : "—"} />
                <Summary label="Источник" value={price?.source ?? "—"} />
                <Summary label="Изменение" value={analytics ? formatPercent(analytics.priceChangePercent) : "—"} />
                <Summary label="Риск" value={analytics ? `${analytics.riskScore}/100` : "—"} />
            </div>

            {report && (
                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>AI-отчёт</h2>
                            <p>Провайдер: {report.provider}</p>
                        </div>
                    </div>

                    <p>{report.summary}</p>

                    <div className="dashboard-grid">
                        <div>
                            <h3>Плюсы</h3>
                            <ul>{report.positiveFactors.map((item) => <li key={item}>{item}</li>)}</ul>
                        </div>
                        <div>
                            <h3>Минусы</h3>
                            <ul>{report.negativeFactors.map((item) => <li key={item}>{item}</li>)}</ul>
                        </div>
                    </div>

                    <small>{report.disclaimer}</small>
                </article>
            )}
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
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 }).format(value)} ${currency}`;
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)}%`;
}
