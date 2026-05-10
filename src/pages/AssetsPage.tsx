import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/marketDataService";
import type { AnalyticsSummary, Asset } from "../types/domain";

type AssetTypeFilter = "ALL" | string;
type ExchangeFilter = "ALL" | string;

export function AssetsPage() {
    const assets = useMemo(() => getAssets(), []);
    const [analyticsMap, setAnalyticsMap] = useState<Record<string, AnalyticsSummary>>({});
    const [isLoading, setIsLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [assetTypeFilter, setAssetTypeFilter] = useState<AssetTypeFilter>("ALL");
    const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("ALL");

    useEffect(() => {
        async function load() {
            setIsLoading(true);

            const loadedAnalytics = await Promise.all(
                assets.map(async (asset) => {
                    try {
                        return await getAnalyticsSummary(asset.ticker);
                    } catch {
                        return null;
                    }
                })
            );

            const nextMap: Record<string, AnalyticsSummary> = {};

            loadedAnalytics.forEach((item) => {
                if (item) {
                    nextMap[item.ticker] = item;
                }
            });

            setAnalyticsMap(nextMap);
            setIsLoading(false);
        }

        load();
    }, [assets]);

    const filteredAssets = useMemo(() => {
        return assets.filter((asset) => {
            const query = search.trim().toLowerCase();
            const matchesSearch =
                query.length === 0 ||
                asset.ticker.toLowerCase().includes(query) ||
                asset.name.toLowerCase().includes(query);

            const matchesType =
                assetTypeFilter === "ALL" ||
                asset.assetType === assetTypeFilter;

            const matchesExchange =
                exchangeFilter === "ALL" ||
                asset.exchange === exchangeFilter;

            return matchesSearch && matchesType && matchesExchange;
        });
    }, [assetTypeFilter, assets, exchangeFilter, search]);

    const summary = useMemo(() => {
        const analytics = Object.values(analyticsMap);

        return {
            totalAssets: assets.length,
            stocks: assets.filter((asset) => asset.assetType === "STOCK").length,
            crypto: assets.filter((asset) => asset.assetType === "CRYPTO").length,
            averageRisk:
                analytics.length === 0
                    ? 0
                    : Math.round(
                        analytics.reduce((sum, item) => sum + item.riskScore, 0) / analytics.length
                    )
        };
    }, [analyticsMap, assets]);

    const assetTypeOptions = useMemo(() => {
        return ["ALL", ...Array.from(new Set(assets.map((asset) => asset.assetType)))];
    }, [assets]);

    const exchangeOptions = useMemo(() => {
        return ["ALL", ...Array.from(new Set(assets.map((asset) => asset.exchange)))];
    }, [assets]);

    if (isLoading) {
        return <LoadingBlock text="Загружаем активы..." />;
    }

    return (
        <section className="page assets-page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Активы</p>
                    <h1>Список активов</h1>
                </div>
            </div>

            <div className="assets-overview-grid assets-overview-grid-compact">
                <CompactStatCard label="Всего" value={String(summary.totalAssets)} />
                <CompactStatCard label="Акции" value={String(summary.stocks)} />
                <CompactStatCard label="Крипта" value={String(summary.crypto)} />
                <CompactStatCard label="Средний риск" value={`${summary.averageRisk}/100`} />
            </div>

            <details className="panel compact-disclosure">
                <summary className="compact-disclosure-summary">
                    <div>
                        <h2>Фильтры</h2>
                        <span>
                            {filteredAssets.length} активов
                            {search.trim() ? ` · поиск: ${search.trim()}` : ""}
                        </span>
                    </div>
                </summary>

                <div className="compact-disclosure-body">
                    <div className="assets-controls compact-assets-controls">
                        <label>
                            <span>Поиск</span>
                            <input
                                value={search}
                                placeholder="SBER, BTCUSDT, Аэрофлот..."
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </label>

                        <label>
                            <span>Тип</span>
                            <select
                                value={assetTypeFilter}
                                onChange={(event) => setAssetTypeFilter(event.target.value)}
                            >
                                {assetTypeOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option === "ALL" ? "Все типы" : translateAssetType(option)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            <span>Биржа</span>
                            <select
                                value={exchangeFilter}
                                onChange={(event) => setExchangeFilter(event.target.value)}
                            >
                                {exchangeOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option === "ALL" ? "Все биржи" : option}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>
            </details>

            <article className="panel compact-list-panel">
                <div className="panel-header compact-panel-header">
                    <div>
                        <h2>Активы</h2>
                    </div>
                </div>

                {filteredAssets.length === 0 ? (
                    <div className="empty-state">Ничего не найдено</div>
                ) : (
                    <div className="asset-compact-list">
                        {filteredAssets.map((asset) => (
                            <AssetCompactRow
                                key={asset.id}
                                asset={asset}
                                analytics={analyticsMap[asset.ticker] ?? null}
                            />
                        ))}
                    </div>
                )}
            </article>
        </section>
    );
}

type CompactStatCardProps = {
    label: string;
    value: string;
};

function CompactStatCard({ label, value }: CompactStatCardProps) {
    return (
        <div className="assets-overview-card compact-stat-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

type AssetCompactRowProps = {
    asset: Asset;
    analytics: AnalyticsSummary | null;
};

function AssetCompactRow({ asset, analytics }: AssetCompactRowProps) {
    const change = analytics?.priceChangePercent ?? 0;
    const isPositive = change >= 0;

    return (
        <Link to={`/assets/${asset.ticker}`} className="asset-compact-row">
            <div className="asset-compact-main">
                <strong>{asset.ticker}</strong>
                <span>{asset.name}</span>
            </div>

            <div className="asset-compact-side">
                <em className={`asset-compact-source asset-compact-source-${asset.exchange.toLowerCase()}`}>
                    {asset.exchange}
                </em>

                <div className="asset-compact-price">
                    <strong>
                        {analytics
                            ? `${formatNumber(analytics.currentPrice)} ${asset.currency}`
                            : `— ${asset.currency}`}
                    </strong>

                    <span className={isPositive ? "positive-value" : "negative-value"}>
                        {analytics ? formatPercentWithSign(change) : "—"}
                    </span>
                </div>
            </div>
        </Link>
    );
}

function translateAssetType(assetType: string): string {
    if (assetType === "STOCK") return "Акция";
    if (assetType === "CRYPTO") return "Крипта";
    if (assetType === "ETF") return "ETF";
    if (assetType === "BOND") return "Облигация";
    if (assetType === "INDEX") return "Индекс";
    if (assetType === "CURRENCY") return "Валюта";

    return assetType;
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 8
    }).format(value);
}

function formatPercentWithSign(value: number): string {
    return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}