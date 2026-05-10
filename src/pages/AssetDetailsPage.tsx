import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import { AiReportPanel } from "../components/AiReportPanel";
import { getAsset } from "../services/assetsService";
import { generateAssetReport, type AiReport } from "../services/browserAiService";
import {
    getAnalyticsSummary,
    getCandles,
    getMarketPrice,
    type ChartPeriod
} from "../services/marketDataService";
import type {
    AnalyticsSummary,
    Asset,
    Candle,
    MarketPrice
} from "../types/domain";

type ChartViewMode = "LINE" | "CANDLES";

type LineChartDot = {
    candle: Candle;
    x: number;
    y: number;
};

export function AssetDetailsPage() {
    const { ticker = "" } = useParams();
    const asset = useMemo(() => getAsset(ticker), [ticker]);

    const [price, setPrice] = useState<MarketPrice | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [candles, setCandles] = useState<Candle[]>([]);
    const [report, setReport] = useState<AiReport | null>(null);
    const [activeChartCandle, setActiveChartCandle] = useState<Candle | null>(null);

    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("MONTH");
    const [chartViewMode, setChartViewMode] = useState<ChartViewMode>("LINE");

    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isChartLoading, setIsChartLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        loadAssetOverview(asset, chartPeriod);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asset?.ticker]);

    useEffect(() => {
        if (!asset || isInitialLoading) {
            return;
        }

        setActiveChartCandle(null);
        loadChartOnly(asset, chartPeriod);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartPeriod]);

    async function loadAssetOverview(currentAsset: Asset | null, period: ChartPeriod) {
        if (!currentAsset) {
            setIsInitialLoading(false);
            return;
        }

        try {
            setError("");
            setIsInitialLoading(true);
            setReport(null);
            setActiveChartCandle(null);

            const [loadedPrice, loadedAnalytics, loadedCandles] = await Promise.all([
                getMarketPrice(currentAsset.ticker),
                getAnalyticsSummary(currentAsset.ticker),
                getCandles(currentAsset.ticker, period)
            ]);

            setPrice(loadedPrice);
            setAnalytics(loadedAnalytics);
            setCandles(loadedCandles);
        } catch (nextError: unknown) {
            setError(
                nextError instanceof Error
                    ? nextError.message
                    : "Не удалось загрузить данные актива"
            );
        } finally {
            setIsInitialLoading(false);
        }
    }

    async function loadChartOnly(currentAsset: Asset, period: ChartPeriod) {
        try {
            setError("");
            setIsChartLoading(true);

            const loadedCandles = await getCandles(currentAsset.ticker, period);
            setCandles(loadedCandles);
        } catch (nextError: unknown) {
            setError(
                nextError instanceof Error
                    ? nextError.message
                    : "Не удалось загрузить график"
            );
        } finally {
            setIsChartLoading(false);
        }
    }

    async function handleRefresh() {
        if (!asset) {
            return;
        }

        try {
            setIsRefreshing(true);
            await loadAssetOverview(asset, chartPeriod);
        } finally {
            setIsRefreshing(false);
        }
    }

    async function handleGenerateReport() {
        if (!analytics) {
            return;
        }

        try {
            setError("");
            setIsGeneratingReport(true);
            const nextReport = await generateAssetReport(analytics);
            setReport(nextReport);
        } catch (nextError: unknown) {
            setError(
                nextError instanceof Error
                    ? nextError.message
                    : "Не удалось создать AI-отчёт"
            );
        } finally {
            setIsGeneratingReport(false);
        }
    }

    const sortedCandles = useMemo(() => {
        return [...candles].sort((first, second) => {
            return new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime();
        });
    }, [candles]);

    const visibleCandles = useMemo(() => {
        if (chartPeriod === "DAY") {
            return sortedCandles.slice(-24);
        }

        if (chartPeriod === "WEEK") {
            return sortedCandles.slice(-42);
        }

        return sortedCandles.slice(-30);
    }, [chartPeriod, sortedCandles]);

    const chartBounds = useMemo(() => {
        if (visibleCandles.length === 0) {
            return {
                minLow: 0,
                maxHigh: 1
            };
        }

        return {
            minLow: Math.min(...visibleCandles.map((candle) => candle.low)),
            maxHigh: Math.max(...visibleCandles.map((candle) => candle.high))
        };
    }, [visibleCandles]);

    const isChartPositive = useMemo(() => {
        if (visibleCandles.length < 2) {
            return true;
        }

        return visibleCandles[visibleCandles.length - 1].close >= visibleCandles[0].close;
    }, [visibleCandles]);

    const lineChartDots = useMemo<LineChartDot[]>(() => {
        if (visibleCandles.length === 0) {
            return [];
        }

        const min = chartBounds.minLow;
        const max = chartBounds.maxHigh;
        const range = Math.max(max - min, 1);

        return visibleCandles.map((candle, index) => {
            const x = visibleCandles.length === 1
                ? 500
                : (index / (visibleCandles.length - 1)) * 1000;

            const y = 260 - ((candle.close - min) / range) * 220;

            return {
                candle,
                x,
                y
            };
        });
    }, [chartBounds.maxHigh, chartBounds.minLow, visibleCandles]);

    const lineChartPoints = useMemo(() => {
        return lineChartDots.map((dot) => `${dot.x},${dot.y}`).join(" ");
    }, [lineChartDots]);

    if (!asset) {
        return (
            <section className="page">
                <div className="empty-state">Актив не найден</div>
            </section>
        );
    }

    if (isInitialLoading) {
        return <LoadingBlock text="Загружаем актив..." />;
    }

    const changePercent = analytics?.priceChangePercent ?? 0;
    const isPositive = changePercent >= 0;
    const source = price?.source ?? analytics?.source ?? "DEMO";
    const riskScore = analytics?.riskScore ?? 0;
    const chartColorClass = isChartPositive ? "chart-up" : "chart-down";
    const chartGradientId = isChartPositive ? "lineChartGradientUp" : "lineChartGradientDown";

    return (
        <section className="page asset-details-page">
            <article className="asset-details-hero">
                <div className="asset-details-hero-main">
                    <p className="eyebrow">{asset.exchange}</p>
                    <h1>{asset.ticker}</h1>

                    <div className="asset-details-badges">
                        <span>{translateAssetType(asset.assetType)}</span>
                        <span>{asset.currency}</span>
                        <span>{asset.isin || "NO ISIN"}</span>
                        <span className={`source-pill source-${source.toLowerCase()}`}>
                            {source}
                        </span>
                    </div>
                </div>

                <div className="asset-details-price-card">
                    <span>Текущая цена</span>
                    <strong>
                        {price ? formatMoney(price.price, asset.currency) : "—"}
                    </strong>

                    {analytics && (
                        <em className={isPositive ? "positive-value" : "negative-value"}>
                            {isPositive ? "+" : ""}
                            {formatPercent(analytics.priceChangePercent)}
                        </em>
                    )}

                    <small>{price ? formatDateTime(price.timestamp) : "—"}</small>

                    <div className="hero-actions">
                        <button
                            type="button"
                            className="ghost-button color-button-blue"
                            disabled={isRefreshing}
                            onClick={handleRefresh}
                        >
                            {isRefreshing ? "Обновляем..." : "Обновить"}
                        </button>

                        <button
                            type="button"
                            className="primary-button color-button-purple"
                            disabled={isGeneratingReport}
                            onClick={handleGenerateReport}
                        >
                            {isGeneratingReport ? "Генерируем..." : "AI-отчёт"}
                        </button>

                        <Link to="/portfolio" className="ghost-button color-button-green">
                            Купить
                        </Link>
                    </div>
                </div>
            </article>

            {error && <div className="error-block">{error}</div>}

            <div className="summary-grid asset-summary-grid">
                <SummaryCard
                    label="Риск"
                    value={analytics ? `${analytics.riskScore}/100` : "—"}
                />

                <SummaryCard
                    label="Волатильность"
                    value={analytics ? formatPercent(analytics.volatilityPercent) : "—"}
                />

                <SummaryCard
                    label="Средний объём"
                    value={analytics ? formatCompactNumber(analytics.averageVolume) : "—"}
                />

                <SummaryCard
                    label="Изменение"
                    value={
                        analytics
                            ? `${isPositive ? "+" : ""}${formatPercent(analytics.priceChangePercent)}`
                            : "—"
                    }
                    valueClassName={isPositive ? "positive-value" : "negative-value"}
                />
            </div>

            <article className="panel asset-chart-panel">
                <div className="asset-chart-header">
                    <div>
                        <h2>График</h2>
                    </div>

                    <div className="asset-chart-controls">
                        <div className="asset-chart-segment">
                            <button
                                type="button"
                                className={chartPeriod === "DAY" ? "active" : ""}
                                onClick={() => setChartPeriod("DAY")}
                            >
                                День
                            </button>

                            <button
                                type="button"
                                className={chartPeriod === "WEEK" ? "active" : ""}
                                onClick={() => setChartPeriod("WEEK")}
                            >
                                Неделя
                            </button>

                            <button
                                type="button"
                                className={chartPeriod === "MONTH" ? "active" : ""}
                                onClick={() => setChartPeriod("MONTH")}
                            >
                                Месяц
                            </button>
                        </div>

                        <div className="asset-chart-segment">
                            <button
                                type="button"
                                className={chartViewMode === "LINE" ? "active" : ""}
                                onClick={() => {
                                    setChartViewMode("LINE");
                                    setActiveChartCandle(null);
                                }}
                            >
                                Линия
                            </button>

                            <button
                                type="button"
                                className={chartViewMode === "CANDLES" ? "active" : ""}
                                onClick={() => {
                                    setChartViewMode("CANDLES");
                                    setActiveChartCandle(null);
                                }}
                            >
                                Свечи
                            </button>
                        </div>
                    </div>
                </div>

                {visibleCandles.length === 0 ? (
                    <div className="empty-state">Свечи пока не загружены</div>
                ) : (
                    <div className={isChartLoading ? "asset-chart-body chart-loading" : "asset-chart-body"}>
                        {chartViewMode === "LINE" ? (
                            <div className={`asset-line-chart ${chartColorClass}`}>
                                <svg viewBox="0 0 1000 300" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="lineChartGradientUp" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.42)" />
                                            <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
                                        </linearGradient>

                                        <linearGradient id="lineChartGradientDown" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(239, 68, 68, 0.42)" />
                                            <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                                        </linearGradient>
                                    </defs>

                                    <polygon
                                        points={`0,280 ${lineChartPoints} 1000,280`}
                                        className="asset-line-chart-area"
                                        fill={`url(#${chartGradientId})`}
                                    />

                                    <polyline
                                        points={lineChartPoints}
                                        className="asset-line-chart-line"
                                    />

                                    {lineChartDots.map((dot) => (
                                        <circle
                                            key={dot.candle.timestamp}
                                            className="asset-line-chart-dot"
                                            cx={dot.x}
                                            cy={dot.y}
                                            r="7.6"
                                            onClick={() => setActiveChartCandle(dot.candle)}
                                        />
                                    ))}
                                </svg>

                                <div className="asset-line-chart-labels">
                                    <span>{formatNumber(chartBounds.maxHigh)}</span>
                                    <span>{formatNumber(chartBounds.minLow)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="asset-candle-strip asset-candle-strip-large">
                                {visibleCandles.map((candle) => (
                                    <CandleBar
                                        key={candle.timestamp}
                                        candle={candle}
                                        minLow={chartBounds.minLow}
                                        maxHigh={chartBounds.maxHigh}
                                        onSelect={setActiveChartCandle}
                                    />
                                ))}
                            </div>
                        )}

                        {activeChartCandle && (
                            <ChartTooltip
                                candle={activeChartCandle}
                                onClose={() => setActiveChartCandle(null)}
                            />
                        )}

                        {isChartLoading && (
                            <div className="asset-chart-loader">
                                Обновляем график...
                            </div>
                        )}
                    </div>
                )}
            </article>

            <div className="asset-details-grid">
                <article className="panel asset-risk-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Профиль риска</h2>
                        </div>
                    </div>

                    <div className="asset-risk-score">
                        <div className="asset-risk-orb">
                            <strong>{riskScore}</strong>
                            <span>из 100</span>
                        </div>

                        <div>
                            <h3>{analytics ? translateRiskLevel(analytics.riskLevel) : "Нет данных"}</h3>
                        </div>
                    </div>

                    <div className="asset-risk-meter">
                        <div style={{ width: `${riskScore}%` }} />
                    </div>

                    <div className="asset-risk-factors">
                        <RiskFactor
                            label="Движение"
                            value={analytics ? formatPercent(Math.abs(analytics.priceChangePercent)) : "—"}
                        />

                        <RiskFactor
                            label="Волатильность"
                            value={analytics ? formatPercent(analytics.volatilityPercent) : "—"}
                        />

                        <RiskFactor
                            label="Источник"
                            value={source}
                        />
                    </div>
                </article>

                {report && (
                    <AiReportPanel
                        title="AI-анализ"
                        report={report}
                    />
                )}
            </div>
        </section>
    );
}

type SummaryCardProps = {
    label: string;
    value: string;
    valueClassName?: string;
};

function SummaryCard({ label, value, valueClassName }: SummaryCardProps) {
    return (
        <div className="summary-card">
            <span>{label}</span>
            <strong className={valueClassName}>{value}</strong>
        </div>
    );
}

type CandleBarProps = {
    candle: Candle;
    minLow: number;
    maxHigh: number;
    onSelect: (candle: Candle) => void;
};

function CandleBar({ candle, minLow, maxHigh, onSelect }: CandleBarProps) {
    const totalRange = Math.max(maxHigh - minLow, 1);
    const candleTop = ((maxHigh - candle.high) / totalRange) * 100;
    const candleHeight = Math.max(((candle.high - candle.low) / totalRange) * 100, 4);
    const bodyTop = ((maxHigh - Math.max(candle.open, candle.close)) / totalRange) * 100;
    const bodyHeight = Math.max((Math.abs(candle.close - candle.open) / totalRange) * 100, 4);
    const isPositive = candle.close >= candle.open;

    return (
        <button
            type="button"
            className="asset-candle-bar"
            onClick={() => onSelect(candle)}
            aria-label={`Показать свечу ${formatDateTime(candle.timestamp)}`}
        >
            <div
                className="asset-candle-wick"
                style={{
                    top: `${candleTop}%`,
                    height: `${candleHeight}%`
                }}
            />

            <div
                className={`asset-candle-body ${isPositive ? "candle-up" : "candle-down"}`}
                style={{
                    top: `${bodyTop}%`,
                    height: `${bodyHeight}%`
                }}
            />

            <span>{formatShortDate(candle.timestamp)}</span>
        </button>
    );
}

type ChartTooltipProps = {
    candle: Candle;
    onClose: () => void;
};

function ChartTooltip({ candle, onClose }: ChartTooltipProps) {
    return (
        <div className="asset-chart-fixed-tooltip">
            <button type="button" onClick={onClose} aria-label="Закрыть подсказку">
                ×
            </button>

            <strong>{formatDateTime(candle.timestamp)}</strong>
            <span>Open: {formatNumber(candle.open)}</span>
            <span>High: {formatNumber(candle.high)}</span>
            <span>Low: {formatNumber(candle.low)}</span>
            <span>Close: {formatNumber(candle.close)}</span>
            <em>{candle.source}</em>
        </div>
    );
}

type RiskFactorProps = {
    label: string;
    value: string;
};

function RiskFactor({ label, value }: RiskFactorProps) {
    return (
        <div className="asset-risk-factor">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
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

function translateRiskLevel(riskLevel: string): string {
    if (riskLevel === "LOW") return "Низкий риск";
    if (riskLevel === "MEDIUM") return "Средний риск";
    if (riskLevel === "HIGH") return "Высокий риск";
    if (riskLevel === "CRITICAL") return "Критический риск";

    return riskLevel;
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: currency === "USD" ? 4 : 2
    }).format(value)} ${currency}`;
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 4
    }).format(value);
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

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString("ru-RU");
}

function formatShortDate(value: string): string {
    return new Date(value).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit"
    });
}