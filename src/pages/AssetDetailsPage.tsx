import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import { getAsset } from "../services/assetsService";
import { generateAssetReport, type AiReport } from "../services/browserAiService";
import {
    getAnalyticsSummary,
    getCandles,
    getMarketPrice
} from "../services/marketDataService";
import type {
    AnalyticsSummary,
    Asset,
    Candle,
    MarketPrice
} from "../types/domain";

export function AssetDetailsPage() {
    const { ticker = "" } = useParams();
    const asset = useMemo(() => getAsset(ticker), [ticker]);

    const [price, setPrice] = useState<MarketPrice | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [candles, setCandles] = useState<Candle[]>([]);
    const [report, setReport] = useState<AiReport | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        loadAssetData(asset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asset?.ticker]);

    async function loadAssetData(currentAsset: Asset | null) {
        if (!currentAsset) {
            setIsLoading(false);
            return;
        }

        try {
            setError("");
            setIsLoading(true);

            const [loadedPrice, loadedAnalytics, loadedCandles] = await Promise.all([
                getMarketPrice(currentAsset.ticker),
                getAnalyticsSummary(currentAsset.ticker),
                getCandles(currentAsset.ticker)
            ]);

            setPrice(loadedPrice);
            setAnalytics(loadedAnalytics);
            setCandles(loadedCandles);
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Не удалось загрузить данные актива"
            );
        } finally {
            setIsLoading(false);
        }
    }

    async function handleRefresh() {
        if (!asset) {
            return;
        }

        try {
            setIsRefreshing(true);
            await loadAssetData(asset);
        } finally {
            setIsRefreshing(false);
        }
    }

    async function handleGenerateReport() {
        if (!analytics) {
            return;
        }

        try {
            setIsGeneratingReport(true);
            const nextReport = await generateAssetReport(analytics);
            setReport(nextReport);
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
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

    const latestCandles = useMemo(() => {
        return sortedCandles.slice(-10);
    }, [sortedCandles]);

    const candleBounds = useMemo(() => {
        if (latestCandles.length === 0) {
            return {
                minLow: 0,
                maxHigh: 1
            };
        }

        return {
            minLow: Math.min(...latestCandles.map((candle) => candle.low)),
            maxHigh: Math.max(...latestCandles.map((candle) => candle.high))
        };
    }, [latestCandles]);

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

    const changePercent = analytics?.priceChangePercent ?? 0;
    const isPositive = changePercent >= 0;
    const source = price?.source ?? analytics?.source ?? "DEMO";
    const riskScore = analytics?.riskScore ?? 0;

    return (
        <section className="page asset-details-page">
            <article className="asset-details-hero">
                <div className="asset-details-hero-main">
                    <p className="eyebrow">{asset.exchange}</p>
                    <h1>{asset.ticker}</h1>
                    <p>{asset.name}</p>

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
                        {price
                            ? formatMoney(price.price, asset.currency)
                            : "—"}
                    </strong>

                    {analytics && (
                        <em className={isPositive ? "positive-value" : "negative-value"}>
                            {isPositive ? "+" : ""}
                            {formatPercent(analytics.priceChangePercent)}
                        </em>
                    )}

                    <small>
                        Обновлено: {price ? formatDateTime(price.timestamp) : "—"}
                    </small>

                    <div className="hero-actions">
                        <button
                            type="button"
                            className="ghost-button"
                            disabled={isRefreshing}
                            onClick={handleRefresh}
                        >
                            {isRefreshing ? "Обновляем..." : "Обновить"}
                        </button>

                        <button
                            type="button"
                            className="primary-button"
                            disabled={isGeneratingReport}
                            onClick={handleGenerateReport}
                        >
                            {isGeneratingReport ? "Генерируем..." : "AI-отчёт"}
                        </button>

                        <Link to="/portfolio" className="ghost-button">
                            Купить
                        </Link>
                    </div>
                </div>
            </article>

            {error && <div className="error-block">{error}</div>}

            <div className="summary-grid">
                <SummaryCard
                    label="Риск"
                    value={analytics ? `${analytics.riskScore}/100` : "—"}
                    hint={analytics ? translateRiskLevel(analytics.riskLevel) : "—"}
                />

                <SummaryCard
                    label="Волатильность"
                    value={analytics ? formatPercent(analytics.volatilityPercent) : "—"}
                    hint="Среднее дневное движение"
                />

                <SummaryCard
                    label="Средний объём"
                    value={analytics ? formatCompactNumber(analytics.averageVolume) : "—"}
                    hint="По последним свечам"
                />

                <SummaryCard
                    label="Точек данных"
                    value={analytics ? String(analytics.dataPoints) : "—"}
                    hint="Свечи для аналитики"
                />
            </div>

            <div className="asset-details-grid">
                <article className="panel asset-chart-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Динамика цены</h2>
                            <p>Последние свечи из браузерного market data provider.</p>
                        </div>
                    </div>

                    {latestCandles.length === 0 ? (
                        <div className="empty-state">Свечи пока не загружены</div>
                    ) : (
                        <>
                            <div className="asset-candle-strip">
                                {latestCandles.map((candle) => (
                                    <CandleBar
                                        key={candle.timestamp}
                                        candle={candle}
                                        minLow={candleBounds.minLow}
                                        maxHigh={candleBounds.maxHigh}
                                    />
                                ))}
                            </div>

                            <div className="asset-candle-table">
                                <div className="asset-candle-table-head">
                                    <span>Дата</span>
                                    <span>Open</span>
                                    <span>High</span>
                                    <span>Low</span>
                                    <span>Close</span>
                                    <span>Source</span>
                                </div>

                                {latestCandles.slice().reverse().map((candle) => (
                                    <div className="asset-candle-table-row" key={candle.timestamp}>
                                        <span>{formatDate(candle.timestamp)}</span>
                                        <strong>{formatNumber(candle.open)}</strong>
                                        <strong>{formatNumber(candle.high)}</strong>
                                        <strong>{formatNumber(candle.low)}</strong>
                                        <strong>{formatNumber(candle.close)}</strong>
                                        <em>{candle.source}</em>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </article>

                <article className="panel asset-risk-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Профиль риска</h2>
                            <p>Упрощённая оценка на основе движения цены и волатильности.</p>
                        </div>
                    </div>

                    <div className="asset-risk-score">
                        <div className="asset-risk-orb">
                            <strong>{riskScore}</strong>
                            <span>из 100</span>
                        </div>

                        <div>
                            <h3>{analytics ? translateRiskLevel(analytics.riskLevel) : "Нет данных"}</h3>
                            <p>{getRiskDescription(riskScore)}</p>
                        </div>
                    </div>

                    <div className="asset-risk-meter">
                        <div style={{ width: `${riskScore}%` }} />
                    </div>

                    <div className="asset-risk-factors">
                        <RiskFactor
                            label="Движение"
                            value={analytics ? formatPercent(Math.abs(analytics.priceChangePercent)) : "—"}
                            text="Сильное движение повышает краткосрочный риск."
                        />

                        <RiskFactor
                            label="Волатильность"
                            value={analytics ? formatPercent(analytics.volatilityPercent) : "—"}
                            text="Чем выше волатильность, тем сложнее точка входа."
                        />

                        <RiskFactor
                            label="Источник"
                            value={source}
                            text="Реальный источник лучше demo fallback."
                        />
                    </div>
                </article>
            </div>

            {report && (
                <article className="panel asset-ai-panel">
                    <div className="panel-header">
                        <div>
                            <h2>AI-анализ</h2>
                            <p>
                                Провайдер: <strong>{report.provider}</strong> · риск:{" "}
                                <strong>{report.riskScore}/100</strong>
                            </p>
                        </div>
                    </div>

                    <div className="asset-ai-summary">
                        <p>{report.summary}</p>
                    </div>

                    <div className="asset-ai-grid">
                        <div>
                            <h3>Позитивные факторы</h3>
                            <ul>
                                {report.positiveFactors.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h3>Негативные факторы</h3>
                            <ul>
                                {report.negativeFactors.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <small>{report.disclaimer}</small>
                </article>
            )}
        </section>
    );
}

type SummaryCardProps = {
    label: string;
    value: string;
    hint: string;
};

function SummaryCard({ label, value, hint }: SummaryCardProps) {
    return (
        <div className="summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
        </div>
    );
}

type CandleBarProps = {
    candle: Candle;
    minLow: number;
    maxHigh: number;
};

function CandleBar({ candle, minLow, maxHigh }: CandleBarProps) {
    const totalRange = Math.max(maxHigh - minLow, 1);
    const candleTop = ((maxHigh - candle.high) / totalRange) * 100;
    const candleHeight = Math.max(((candle.high - candle.low) / totalRange) * 100, 4);
    const bodyTop = ((maxHigh - Math.max(candle.open, candle.close)) / totalRange) * 100;
    const bodyHeight = Math.max((Math.abs(candle.close - candle.open) / totalRange) * 100, 4);
    const isPositive = candle.close >= candle.open;

    return (
        <div className="asset-candle-bar">
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
        </div>
    );
}

type RiskFactorProps = {
    label: string;
    value: string;
    text: string;
};

function RiskFactor({ label, value, text }: RiskFactorProps) {
    return (
        <div className="asset-risk-factor">
            <span>{label}</span>
            <strong>{value}</strong>
            <p>{text}</p>
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

function getRiskDescription(score: number): string {
    if (score >= 80) {
        return "Актив выглядит резко движущимся. Для демо это сигнал внимательно смотреть волатильность и точку входа.";
    }

    if (score >= 60) {
        return "Риск повышенный: цена двигается активно, а итоговая оценка требует осторожного сравнения с другими активами.";
    }

    if (score >= 35) {
        return "Риск средний: движение есть, но без критического перекоса по текущей модели.";
    }

    return "Риск низкий по текущей браузерной модели, но это не отменяет рыночную неопределённость.";
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

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("ru-RU");
}

function formatShortDate(value: string): string {
    return new Date(value).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit"
    });
}