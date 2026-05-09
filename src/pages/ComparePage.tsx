import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/marketDataService";
import type { AnalyticsSummary, Asset } from "../types/domain";

type CompareWinner = "FIRST" | "SECOND" | "DRAW";

type CompareMetric = {
    label: string;
    firstValue: string;
    secondValue: string;
    winner: CompareWinner;
};

export function ComparePage() {
    const assets = useMemo(() => getAssets(), []);
    const defaultFirstTicker = assets[0]?.ticker ?? "SBER";
    const defaultSecondTicker = assets[1]?.ticker ?? "BTCUSDT";

    const [firstTicker, setFirstTicker] = useState(defaultFirstTicker);
    const [secondTicker, setSecondTicker] = useState(defaultSecondTicker);

    const [firstItem, setFirstItem] = useState<AnalyticsSummary | null>(null);
    const [secondItem, setSecondItem] = useState<AnalyticsSummary | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleCompare(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const normalizedFirstTicker = firstTicker.trim().toUpperCase();
        const normalizedSecondTicker = secondTicker.trim().toUpperCase();

        if (!normalizedFirstTicker || !normalizedSecondTicker) {
            setError("Выберите два тикера для сравнения");
            return;
        }

        if (normalizedFirstTicker === normalizedSecondTicker) {
            setError("Выберите два разных актива");
            return;
        }

        try {
            setError("");
            setIsLoading(true);

            const [loadedFirstItem, loadedSecondItem] = await Promise.all([
                getAnalyticsSummary(normalizedFirstTicker),
                getAnalyticsSummary(normalizedSecondTicker)
            ]);

            setFirstItem(loadedFirstItem);
            setSecondItem(loadedSecondItem);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "Ошибка сравнения");
        } finally {
            setIsLoading(false);
        }
    }

    const firstAsset = useMemo(() => {
        return assets.find((asset) => asset.ticker === firstItem?.ticker) ?? null;
    }, [assets, firstItem?.ticker]);

    const secondAsset = useMemo(() => {
        return assets.find((asset) => asset.ticker === secondItem?.ticker) ?? null;
    }, [assets, secondItem?.ticker]);

    const metrics = useMemo(() => {
        if (!firstItem || !secondItem) {
            return [];
        }

        return buildCompareMetrics(firstItem, secondItem);
    }, [firstItem, secondItem]);

    const firstWins = metrics.filter((metric) => metric.winner === "FIRST").length;
    const secondWins = metrics.filter((metric) => metric.winner === "SECOND").length;
    const drawCount = metrics.filter((metric) => metric.winner === "DRAW").length;

    return (
        <section className="page compare-page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Сравнение</p>
                    <h1>Два актива рядом</h1>
                </div>
            </div>

            {error && <div className="error-block">{error}</div>}

            <article className="panel compare-control-panel">
                <form className="compare-form compare-form-rich" onSubmit={handleCompare}>
                    <label>
                        Первый актив
                        <select
                            value={firstTicker}
                            onChange={(event) => setFirstTicker(event.target.value)}
                        >
                            {assets.map((asset) => (
                                <option key={asset.id} value={asset.ticker}>
                                    {asset.ticker} — {asset.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Второй актив
                        <select
                            value={secondTicker}
                            onChange={(event) => setSecondTicker(event.target.value)}
                        >
                            {assets.map((asset) => (
                                <option key={asset.id} value={asset.ticker}>
                                    {asset.ticker} — {asset.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <button type="submit" className="primary-button" disabled={isLoading}>
                        {isLoading ? "Сравниваем..." : "Сравнить"}
                    </button>
                </form>
            </article>

            {!firstItem || !secondItem ? (
                <article className="compare-empty-state">
                    <div>
                        <p className="eyebrow">Быстрый старт</p>
                        <h2>{firstTicker} против {secondTicker}</h2>
                    </div>
                </article>
            ) : (
                <>
                    <div className="compare-hero-grid">
                        <CompareAssetCard
                            item={firstItem}
                            asset={firstAsset}
                            side="FIRST"
                            wins={firstWins}
                        />

                        <div className="compare-versus">
                            <span>VS</span>
                            <strong>
                                {firstWins} : {secondWins}
                            </strong>
                            <em>{drawCount} ничьих</em>
                        </div>

                        <CompareAssetCard
                            item={secondItem}
                            asset={secondAsset}
                            side="SECOND"
                            wins={secondWins}
                        />
                    </div>

                    <article className="panel">
                        <div className="panel-header">
                            <div>
                                <h2>Победители по категориям</h2>
                            </div>
                        </div>

                        <div className="compare-metric-list">
                            {metrics.map((metric) => (
                                <CompareMetricRow
                                    key={metric.label}
                                    metric={metric}
                                    firstTicker={firstItem.ticker}
                                    secondTicker={secondItem.ticker}
                                />
                            ))}
                        </div>
                    </article>
                </>
            )}
        </section>
    );
}

type CompareAssetCardProps = {
    item: AnalyticsSummary;
    asset: Asset | null;
    side: "FIRST" | "SECOND";
    wins: number;
};

function CompareAssetCard({ item, asset, side, wins }: CompareAssetCardProps) {
    const isPositive = item.priceChangePercent >= 0;

    return (
        <article className={`compare-asset-card compare-asset-card-${side.toLowerCase()}`}>
            <div className="compare-asset-top">
                <div>
                    <span className="eyebrow">{asset?.exchange ?? item.source}</span>
                    <h2>{item.ticker}</h2>
                    <p>{item.name}</p>
                </div>

                <span className={`source-pill source-${item.source.toLowerCase()}`}>
                    {item.source}
                </span>
            </div>

            <div className="compare-price-block">
                <span>Текущая цена</span>
                <strong>{formatMoney(item.currentPrice, asset?.currency ?? "USD")}</strong>
                <em className={isPositive ? "positive-value" : "negative-value"}>
                    {isPositive ? "+" : ""}
                    {formatPercent(item.priceChangePercent)}
                </em>
            </div>

            <div className="compare-card-metrics">
                <MiniMetric label="Побед" value={String(wins)} />
                <MiniMetric label="Риск" value={`${item.riskScore}/100`} />
                <MiniMetric label="Волатильность" value={formatPercent(item.volatilityPercent)} />
                <MiniMetric label="Объём" value={formatCompactNumber(item.averageVolume)} />
            </div>

            <div className="compare-card-actions">
                <Link to={`/assets/${item.ticker}`} className="primary-button">
                    Открыть
                </Link>

                <Link to="/portfolio" className="ghost-button">
                    Купить
                </Link>
            </div>
        </article>
    );
}

type MiniMetricProps = {
    label: string;
    value: string;
};

function MiniMetric({ label, value }: MiniMetricProps) {
    return (
        <div className="compare-mini-metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

type CompareMetricRowProps = {
    metric: CompareMetric;
    firstTicker: string;
    secondTicker: string;
};

function CompareMetricRow({ metric, firstTicker, secondTicker }: CompareMetricRowProps) {
    return (
        <div className="compare-metric-row compare-metric-row-compact">
            <div>
                <span>{metric.label}</span>
            </div>

            <strong className={metric.winner === "FIRST" ? "compare-winner" : ""}>
                {metric.firstValue}
            </strong>

            <strong className={metric.winner === "SECOND" ? "compare-winner" : ""}>
                {metric.secondValue}
            </strong>

            <em>
                {metric.winner === "FIRST" && firstTicker}
                {metric.winner === "SECOND" && secondTicker}
                {metric.winner === "DRAW" && "Ничья"}
            </em>
        </div>
    );
}

function buildCompareMetrics(
    first: AnalyticsSummary,
    second: AnalyticsSummary
): CompareMetric[] {
    return [
        {
            label: "Рост",
            firstValue: formatPercent(first.priceChangePercent),
            secondValue: formatPercent(second.priceChangePercent),
            winner: compareHigherIsBetter(first.priceChangePercent, second.priceChangePercent)
        },
        {
            label: "Риск",
            firstValue: `${first.riskScore}/100`,
            secondValue: `${second.riskScore}/100`,
            winner: compareLowerIsBetter(first.riskScore, second.riskScore)
        },
        {
            label: "Волатильность",
            firstValue: formatPercent(first.volatilityPercent),
            secondValue: formatPercent(second.volatilityPercent),
            winner: compareLowerIsBetter(first.volatilityPercent, second.volatilityPercent)
        },
        {
            label: "Объём",
            firstValue: formatCompactNumber(first.averageVolume),
            secondValue: formatCompactNumber(second.averageVolume),
            winner: compareHigherIsBetter(first.averageVolume, second.averageVolume)
        },
        {
            label: "Цена",
            firstValue: formatNumber(first.currentPrice),
            secondValue: formatNumber(second.currentPrice),
            winner: compareHigherIsBetter(first.currentPrice, second.currentPrice)
        }
    ];
}

function compareHigherIsBetter(firstValue: number, secondValue: number): CompareWinner {
    if (almostEqual(firstValue, secondValue)) {
        return "DRAW";
    }

    return firstValue > secondValue ? "FIRST" : "SECOND";
}

function compareLowerIsBetter(firstValue: number, secondValue: number): CompareWinner {
    if (almostEqual(firstValue, secondValue)) {
        return "DRAW";
    }

    return firstValue < secondValue ? "FIRST" : "SECOND";
}

function almostEqual(firstValue: number, secondValue: number): boolean {
    return Math.abs(firstValue - secondValue) < 0.0001;
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