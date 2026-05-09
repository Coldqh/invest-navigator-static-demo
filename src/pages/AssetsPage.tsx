import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/marketDataService";
import type { AnalyticsSummary, Asset, AssetType, MarketDataSource } from "../types/domain";

type TypeFilter = "ALL" | AssetType;
type ExchangeFilter = "ALL" | "MOEX" | "BINANCE";
type SourceFilter = "ALL" | MarketDataSource;
type SortMode =
    | "TICKER_ASC"
    | "PRICE_DESC"
    | "GROWTH_DESC"
    | "RISK_DESC"
    | "VOLUME_DESC"
    | "VOLATILITY_DESC";

export function AssetsPage() {
    const assets = useMemo(() => getAssets(), []);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
    const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("ALL");
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
    const [sortMode, setSortMode] = useState<SortMode>("TICKER_ASC");

    const [analyticsByTicker, setAnalyticsByTicker] = useState<Record<string, AnalyticsSummary>>({});
    const [loadingTickers, setLoadingTickers] = useState<Record<string, boolean>>({});
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        loadAnalytics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadAnalytics() {
        setIsRefreshing(true);

        const nextLoading = assets.reduce<Record<string, boolean>>((acc, asset) => {
            acc[asset.ticker] = true;
            return acc;
        }, {});

        setLoadingTickers(nextLoading);

        const loadedEntries = await Promise.all(
            assets.map(async (asset) => {
                try {
                    const summary = await getAnalyticsSummary(asset.ticker);
                    return [asset.ticker, summary] as const;
                } catch {
                    return null;
                }
            })
        );

        const nextAnalytics = loadedEntries.reduce<Record<string, AnalyticsSummary>>((acc, entry) => {
            if (entry) {
                const [ticker, summary] = entry;
                acc[ticker] = summary;
            }

            return acc;
        }, {});

        setAnalyticsByTicker(nextAnalytics);
        setLoadingTickers({});
        setIsRefreshing(false);
    }

    const filteredAssets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return assets
            .filter((asset) => {
                const matchesQuery =
                    !normalizedQuery ||
                    asset.ticker.toLowerCase().includes(normalizedQuery) ||
                    asset.name.toLowerCase().includes(normalizedQuery) ||
                    asset.exchange.toLowerCase().includes(normalizedQuery);

                const matchesType = typeFilter === "ALL" || asset.assetType === typeFilter;
                const matchesExchange = exchangeFilter === "ALL" || asset.exchange === exchangeFilter;

                const summary = analyticsByTicker[asset.ticker];
                const matchesSource =
                    sourceFilter === "ALL" ||
                    (summary && summary.source === sourceFilter);

                return matchesQuery && matchesType && matchesExchange && matchesSource;
            })
            .sort((firstAsset, secondAsset) => {
                const firstSummary = analyticsByTicker[firstAsset.ticker];
                const secondSummary = analyticsByTicker[secondAsset.ticker];

                if (sortMode === "PRICE_DESC") {
                    return (secondSummary?.currentPrice ?? 0) - (firstSummary?.currentPrice ?? 0);
                }

                if (sortMode === "GROWTH_DESC") {
                    return (secondSummary?.priceChangePercent ?? -Infinity) - (firstSummary?.priceChangePercent ?? -Infinity);
                }

                if (sortMode === "RISK_DESC") {
                    return (secondSummary?.riskScore ?? 0) - (firstSummary?.riskScore ?? 0);
                }

                if (sortMode === "VOLUME_DESC") {
                    return (secondSummary?.averageVolume ?? 0) - (firstSummary?.averageVolume ?? 0);
                }

                if (sortMode === "VOLATILITY_DESC") {
                    return (secondSummary?.volatilityPercent ?? 0) - (firstSummary?.volatilityPercent ?? 0);
                }

                return firstAsset.ticker.localeCompare(secondAsset.ticker);
            });
    }, [analyticsByTicker, assets, exchangeFilter, query, sortMode, sourceFilter, typeFilter]);

    const pageStats = useMemo(() => {
        const summaries = Object.values(analyticsByTicker);
        const realDataCount = summaries.filter((summary) => summary.source !== "DEMO").length;
        const averageRisk = summaries.length === 0
            ? 0
            : summaries.reduce((sum, summary) => sum + summary.riskScore, 0) / summaries.length;

        return {
            totalAssets: assets.length,
            stockAssets: assets.filter((asset) => asset.assetType === "STOCK").length,
            cryptoAssets: assets.filter((asset) => asset.assetType === "CRYPTO").length,
            realDataCount,
            averageRisk
        };
    }, [analyticsByTicker, assets]);

    return (
        <section className="page assets-page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Активы</p>
                    <h1>Рыночный список</h1>
                </div>

                <div className="hero-actions">
                    <button
                        type="button"
                        className="primary-button"
                        disabled={isRefreshing}
                        onClick={loadAnalytics}
                    >
                        {isRefreshing ? "Обновляем..." : "Обновить цены"}
                    </button>
                </div>
            </div>

            <div className="assets-overview-grid">
                <OverviewCard label="Всего активов" value={String(pageStats.totalAssets)} />
                <OverviewCard label="Акции" value={String(pageStats.stockAssets)} />
                <OverviewCard label="Крипта" value={String(pageStats.cryptoAssets)} />
                <OverviewCard label="Реальные источники" value={String(pageStats.realDataCount)} />
                <OverviewCard label="Средний риск" value={`${Math.round(pageStats.averageRisk)}/100`} />
            </div>

            <article className="panel assets-control-panel">
                <div className="assets-controls">
                    <label className="assets-control">
                        <span>Поиск</span>
                        <input
                            value={query}
                            placeholder="SBER, BTCUSDT, Газпром..."
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>

                    <label className="assets-control">
                        <span>Тип</span>
                        <select
                            value={typeFilter}
                            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                        >
                            <option value="ALL">Все типы</option>
                            <option value="STOCK">Акции</option>
                            <option value="CRYPTO">Крипта</option>
                            <option value="ETF">ETF</option>
                            <option value="BOND">Облигации</option>
                            <option value="INDEX">Индексы</option>
                            <option value="CURRENCY">Валюты</option>
                        </select>
                    </label>

                    <label className="assets-control">
                        <span>Биржа</span>
                        <select
                            value={exchangeFilter}
                            onChange={(event) => setExchangeFilter(event.target.value as ExchangeFilter)}
                        >
                            <option value="ALL">Все биржи</option>
                            <option value="MOEX">MOEX</option>
                            <option value="BINANCE">BINANCE</option>
                        </select>
                    </label>

                    <label className="assets-control">
                        <span>Источник</span>
                        <select
                            value={sourceFilter}
                            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
                        >
                            <option value="ALL">Любой</option>
                            <option value="MOEX">MOEX</option>
                            <option value="BINANCE">BINANCE</option>
                            <option value="DEMO">DEMO fallback</option>
                        </select>
                    </label>

                    <label className="assets-control">
                        <span>Сортировка</span>
                        <select
                            value={sortMode}
                            onChange={(event) => setSortMode(event.target.value as SortMode)}
                        >
                            <option value="TICKER_ASC">По тикеру</option>
                            <option value="PRICE_DESC">Самые дорогие</option>
                            <option value="GROWTH_DESC">Лучший рост</option>
                            <option value="RISK_DESC">Самый высокий риск</option>
                            <option value="VOLUME_DESC">Самый высокий объём</option>
                            <option value="VOLATILITY_DESC">Самая высокая волатильность</option>
                        </select>
                    </label>
                </div>
            </article>

            {filteredAssets.length === 0 ? (
                <div className="empty-state">
                    Ничего не найдено
                </div>
            ) : (
                <div className="asset-grid asset-grid-rich">
                    {filteredAssets.map((asset) => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            summary={analyticsByTicker[asset.ticker]}
                            isLoading={Boolean(loadingTickers[asset.ticker])}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

type OverviewCardProps = {
    label: string;
    value: string;
};

function OverviewCard({ label, value }: OverviewCardProps) {
    return (
        <div className="assets-overview-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

type AssetCardProps = {
    asset: Asset;
    summary?: AnalyticsSummary;
    isLoading: boolean;
};

function AssetCard({ asset, summary, isLoading }: AssetCardProps) {
    const source = summary?.source ?? "DEMO";
    const isPositive = (summary?.priceChangePercent ?? 0) >= 0;

    return (
        <article className="asset-card asset-card-rich">
            <div className="asset-card-top">
                <div>
                    <div className="asset-card-title-row">
                        <strong>{asset.ticker}</strong>
                        <span className={`source-pill source-${source.toLowerCase()}`}>
                            {isLoading ? "LOADING" : source}
                        </span>
                    </div>

                    <span>{asset.name}</span>
                </div>
            </div>

            <div className="asset-price-block">
                <span>Текущая цена</span>
                <strong>
                    {summary
                        ? formatMoney(summary.currentPrice, asset.currency)
                        : isLoading
                            ? "Загрузка..."
                            : "—"}
                </strong>

                {summary && (
                    <small className={isPositive ? "positive-value" : "negative-value"}>
                        {isPositive ? "+" : ""}
                        {formatPercent(summary.priceChangePercent)}
                    </small>
                )}
            </div>

            <div className="asset-card-metrics">
                <Metric label="Тип" value={translateAssetType(asset.assetType)} />
                <Metric label="Риск" value={summary ? `${summary.riskScore}/100` : "—"} />
                <Metric label="Волатильность" value={summary ? formatPercent(summary.volatilityPercent) : "—"} />
                <Metric label="Объём" value={summary ? formatCompactNumber(summary.averageVolume) : "—"} />
            </div>

            <div className="asset-card-actions">
                <Link to={`/assets/${asset.ticker}`} className="primary-button">
                    Открыть
                </Link>

                <Link to="/portfolio" className="ghost-button">
                    Купить
                </Link>
            </div>
        </article>
    );
}

type MetricProps = {
    label: string;
    value: string;
};

function Metric({ label, value }: MetricProps) {
    return (
        <div className="asset-mini-metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function translateAssetType(assetType: AssetType): string {
    if (assetType === "STOCK") return "Акция";
    if (assetType === "CRYPTO") return "Крипта";
    if (assetType === "ETF") return "ETF";
    if (assetType === "BOND") return "Облигация";
    if (assetType === "INDEX") return "Индекс";
    if (assetType === "CURRENCY") return "Валюта";

    return assetType;
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: currency === "USD" ? 4 : 2
    }).format(value)} ${currency}`;
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}

function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        notation: "compact",
        maximumFractionDigits: 2
    }).format(value);
}