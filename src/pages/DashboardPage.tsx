import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/marketDataService";
import type { AnalyticsSummary } from "../types/domain";

type MarketCardData = {
    label: string;
    value: string;
    ticker?: string;
    className?: string;
};

export function DashboardPage() {
    const [analytics, setAnalytics] = useState<AnalyticsSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setIsLoading(true);

            const assets = getAssets();
            const loadedAnalytics = await Promise.all(
                assets.map(async (asset) => {
                    try {
                        return await getAnalyticsSummary(asset.ticker);
                    } catch {
                        return null;
                    }
                })
            );

            setAnalytics(
                loadedAnalytics.filter((item): item is AnalyticsSummary => Boolean(item))
            );
            setIsLoading(false);
        }

        load();
    }, []);

    const market = useMemo(() => {
        const byGrowth = [...analytics].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
        const byFall = [...analytics].sort((a, b) => a.priceChangePercent - b.priceChangePercent);
        const byVolatility = [...analytics].sort((a, b) => b.volatilityPercent - a.volatilityPercent);
        const byRisk = [...analytics].sort((a, b) => b.riskScore - a.riskScore);
        const byVolume = [...analytics].sort((a, b) => b.averageVolume - a.averageVolume);
        const byPriceDesc = [...analytics].sort((a, b) => b.currentPrice - a.currentPrice);
        const byPriceAsc = [...analytics].sort((a, b) => a.currentPrice - b.currentPrice);

        const gainers = analytics.filter((item) => item.priceChangePercent > 0).length;
        const losers = analytics.filter((item) => item.priceChangePercent < 0).length;
        const neutral = analytics.length - gainers - losers;

        const averageGrowth = average(analytics.map((item) => item.priceChangePercent));
        const averageVolatility = average(analytics.map((item) => item.volatilityPercent));
        const averageRisk = average(analytics.map((item) => item.riskScore));
        const riskPressure = analytics.filter((item) => item.riskScore >= 60).length;

        const growthLeader = byGrowth[0] ?? null;
        const fallLeader = byFall[0] ?? null;
        const volatilityLeader = byVolatility[0] ?? null;
        const riskLeader = byRisk[0] ?? null;
        const volumeLeader = byVolume[0] ?? null;
        const expensiveLeader = byPriceDesc[0] ?? null;
        const cheapLeader = byPriceAsc[0] ?? null;

        const marketSpread =
            growthLeader && fallLeader
                ? growthLeader.priceChangePercent - fallLeader.priceChangePercent
                : 0;

        return {
            byGrowth,
            byFall,
            byVolatility,
            byRisk,
            byVolume,
            byPriceDesc,
            byPriceAsc,
            gainers,
            losers,
            neutral,
            averageGrowth,
            averageVolatility,
            averageRisk,
            riskPressure,
            marketSpread,
            growthLeader,
            fallLeader,
            volatilityLeader,
            riskLeader,
            volumeLeader,
            expensiveLeader,
            cheapLeader
        };
    }, [analytics]);

    const marketCards = useMemo<MarketCardData[]>(() => {
        return [
            {
                label: "Рост",
                ticker: market.growthLeader?.ticker,
                value: market.growthLeader ? formatPercentWithSign(market.growthLeader.priceChangePercent) : "—",
                className: "positive-value"
            },
            {
                label: "Падение",
                ticker: market.fallLeader?.ticker,
                value: market.fallLeader ? formatPercentWithSign(market.fallLeader.priceChangePercent) : "—",
                className: "negative-value"
            },
            {
                label: "Волатильность",
                ticker: market.volatilityLeader?.ticker,
                value: market.volatilityLeader ? formatPercent(market.volatilityLeader.volatilityPercent) : "—"
            },
            {
                label: "Риск",
                ticker: market.riskLeader?.ticker,
                value: market.riskLeader ? `${market.riskLeader.riskScore}/100` : "—"
            },
            {
                label: "Объём",
                ticker: market.volumeLeader?.ticker,
                value: market.volumeLeader ? formatCompactNumber(market.volumeLeader.averageVolume) : "—"
            },
            {
                label: "Дорогой",
                ticker: market.expensiveLeader?.ticker,
                value: market.expensiveLeader ? formatNumber(market.expensiveLeader.currentPrice) : "—"
            },
            {
                label: "Дешёвый",
                ticker: market.cheapLeader?.ticker,
                value: market.cheapLeader ? formatNumber(market.cheapLeader.currentPrice) : "—"
            },
            {
                label: "Разрыв",
                value: formatPercentWithSign(market.marketSpread)
            }
        ];
    }, [market]);

    if (isLoading) {
        return <LoadingBlock text="Собираем дашборд..." />;
    }

    return (
        <section className="page dashboard-page dashboard-page-ultra-compact">
            <div className="dashboard-hero dashboard-hero-clean compact-hero">
                <div>
                    <p className="eyebrow">Dashboard</p>
                    <h1>Invest Navigator AI</h1>
                </div>
            </div>

            <details className="panel compact-disclosure compact-disclosure-dashboard" open>
                <summary className="compact-disclosure-summary">
                    <div>
                        <h2>Топы рынка</h2>
                        <span>
                            {market.growthLeader?.ticker ?? "—"} {market.growthLeader ? formatPercentWithSign(market.growthLeader.priceChangePercent) : ""}
                        </span>
                    </div>
                </summary>

                <div className="compact-disclosure-body">
                    <div className="dashboard-market-grid compact-market-grid">
                        {marketCards.map((card) => (
                            <MarketCard key={card.label} card={card} />
                        ))}
                    </div>
                </div>
            </details>

            <details className="panel compact-disclosure compact-disclosure-dashboard">
                <summary className="compact-disclosure-summary">
                    <div>
                        <h2>Рыночная ширина</h2>
                        <span>
                            ↑ {market.gainers} · ↓ {market.losers} · = {market.neutral} · риск {Math.round(market.averageRisk)}/100
                        </span>
                    </div>
                </summary>

                <div className="compact-disclosure-body">
                    <div className="dashboard-pulse-grid compact-pulse-grid">
                        <PulseCard label="Растут" value={String(market.gainers)} className="positive-value" />
                        <PulseCard label="Падают" value={String(market.losers)} className="negative-value" />
                        <PulseCard label="Нейтрально" value={String(market.neutral)} />
                        <PulseCard label="Средний рост" value={formatPercentWithSign(market.averageGrowth)} />
                        <PulseCard label="Средняя волатильность" value={formatPercent(market.averageVolatility)} />
                        <PulseCard label="Средний риск" value={`${Math.round(market.averageRisk)}/100`} />
                        <PulseCard label="Риск-давление" value={`${market.riskPressure}`} />
                        <PulseCard label="Разрыв" value={formatPercentWithSign(market.marketSpread)} />
                    </div>
                </div>
            </details>

            <details className="panel compact-disclosure compact-disclosure-dashboard">
                <summary className="compact-disclosure-summary">
                    <div>
                        <h2>Сигналы рынка</h2>
                        <span>
                            Лидер: {market.growthLeader?.ticker ?? "—"} · Просадка: {market.fallLeader?.ticker ?? "—"}
                        </span>
                    </div>
                </summary>

                <div className="compact-disclosure-body">
                    <div className="dashboard-signal-grid compact-signal-grid">
                        <SignalCard
                            label="Импульс"
                            item={market.growthLeader}
                            value={market.growthLeader ? formatPercentWithSign(market.growthLeader.priceChangePercent) : "—"}
                            className="positive-value"
                        />

                        <SignalCard
                            label="Просадка"
                            item={market.fallLeader}
                            value={market.fallLeader ? formatPercentWithSign(market.fallLeader.priceChangePercent) : "—"}
                            className="negative-value"
                        />

                        <SignalCard
                            label="Нерв рынка"
                            item={market.volatilityLeader}
                            value={market.volatilityLeader ? formatPercent(market.volatilityLeader.volatilityPercent) : "—"}
                        />

                        <SignalCard
                            label="Опасная зона"
                            item={market.riskLeader}
                            value={market.riskLeader ? `${market.riskLeader.riskScore}/100` : "—"}
                        />
                    </div>
                </div>
            </details>
        </section>
    );
}

type MarketCardProps = {
    card: MarketCardData;
};

function MarketCard({ card }: MarketCardProps) {
    const content = (
        <>
            <span>{card.label}</span>
            {card.ticker && <em>{card.ticker}</em>}
            <strong className={card.className}>{card.value}</strong>
        </>
    );

    if (!card.ticker) {
        return <div className="dashboard-market-card compact-market-card">{content}</div>;
    }

    return (
        <Link to={`/assets/${card.ticker}`} className="dashboard-market-card compact-market-card">
            {content}
        </Link>
    );
}

type PulseCardProps = {
    label: string;
    value: string;
    className?: string;
};

function PulseCard({ label, value, className }: PulseCardProps) {
    return (
        <div className="dashboard-pulse-card compact-mini-card">
            <span>{label}</span>
            <strong className={className}>{value}</strong>
        </div>
    );
}

type SignalCardProps = {
    label: string;
    item: AnalyticsSummary | null;
    value: string;
    className?: string;
};

function SignalCard({ label, item, value, className }: SignalCardProps) {
    if (!item) {
        return (
            <div className="dashboard-signal-card compact-mini-card">
                <span>{label}</span>
                <strong>—</strong>
                <em>—</em>
            </div>
        );
    }

    return (
        <Link to={`/assets/${item.ticker}`} className="dashboard-signal-card compact-mini-card">
            <span>{label}</span>
            <strong>{item.ticker}</strong>
            <em className={className}>{value}</em>
        </Link>
    );
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 8
    }).format(value);
}

function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        notation: "compact",
        maximumFractionDigits: 2
    }).format(value);
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}

function formatPercentWithSign(value: number): string {
    return `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
}