import { useEffect, useMemo, useState } from "react";
import { LoadingBlock } from "../components/LoadingBlock";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/marketDataService";
import type { AnalyticsSummary } from "../types/domain";

type CompareMetric = {
    key: string;
    label: string;
    leftValue: string;
    rightValue: string;
    leftScore: number;
    rightScore: number;
    higherIsBetter: boolean;
};

export function ComparePage() {
    const assets = useMemo(() => getAssets(), []);
    const [leftTicker, setLeftTicker] = useState(assets[0]?.ticker ?? "");
    const [rightTicker, setRightTicker] = useState(assets[1]?.ticker ?? assets[0]?.ticker ?? "");

    const [leftAnalytics, setLeftAnalytics] = useState<AnalyticsSummary | null>(null);
    const [rightAnalytics, setRightAnalytics] = useState<AnalyticsSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const leftAsset = useMemo(
        () => assets.find((asset) => asset.ticker === leftTicker) ?? null,
        [assets, leftTicker]
    );

    const rightAsset = useMemo(
        () => assets.find((asset) => asset.ticker === rightTicker) ?? null,
        [assets, rightTicker]
    );

    useEffect(() => {
        async function load() {
            if (!leftTicker || !rightTicker) {
                return;
            }

            setIsLoading(true);

            try {
                const [left, right] = await Promise.all([
                    getAnalyticsSummary(leftTicker),
                    getAnalyticsSummary(rightTicker)
                ]);

                setLeftAnalytics(left);
                setRightAnalytics(right);
            } finally {
                setIsLoading(false);
            }
        }

        load();
    }, [leftTicker, rightTicker]);

    const metrics = useMemo<CompareMetric[]>(() => {
        if (!leftAnalytics || !rightAnalytics) {
            return [];
        }

        return [
            {
                key: "price",
                label: "Цена",
                leftValue: formatMoney(leftAnalytics.currentPrice, leftAsset?.currency ?? ""),
                rightValue: formatMoney(rightAnalytics.currentPrice, rightAsset?.currency ?? ""),
                leftScore: leftAnalytics.currentPrice,
                rightScore: rightAnalytics.currentPrice,
                higherIsBetter: true
            },
            {
                key: "change",
                label: "Изменение",
                leftValue: formatPercentWithSign(leftAnalytics.priceChangePercent),
                rightValue: formatPercentWithSign(rightAnalytics.priceChangePercent),
                leftScore: leftAnalytics.priceChangePercent,
                rightScore: rightAnalytics.priceChangePercent,
                higherIsBetter: true
            },
            {
                key: "risk",
                label: "Риск",
                leftValue: `${leftAnalytics.riskScore}/100`,
                rightValue: `${rightAnalytics.riskScore}/100`,
                leftScore: leftAnalytics.riskScore,
                rightScore: rightAnalytics.riskScore,
                higherIsBetter: false
            },
            {
                key: "volatility",
                label: "Волатильность",
                leftValue: formatPercent(leftAnalytics.volatilityPercent),
                rightValue: formatPercent(rightAnalytics.volatilityPercent),
                leftScore: leftAnalytics.volatilityPercent,
                rightScore: rightAnalytics.volatilityPercent,
                higherIsBetter: false
            },
            {
                key: "volume",
                label: "Объём",
                leftValue: formatCompactNumber(leftAnalytics.averageVolume),
                rightValue: formatCompactNumber(rightAnalytics.averageVolume),
                leftScore: leftAnalytics.averageVolume,
                rightScore: rightAnalytics.averageVolume,
                higherIsBetter: true
            }
        ];
    }, [leftAnalytics, rightAnalytics, leftAsset?.currency, rightAsset?.currency]);

    const score = useMemo(() => {
        return metrics.reduce(
            (current, metric) => {
                if (metric.leftScore === metric.rightScore) {
                    return current;
                }

                const leftBetter = metric.higherIsBetter
                    ? metric.leftScore > metric.rightScore
                    : metric.leftScore < metric.rightScore;

                return {
                    left: current.left + (leftBetter ? 1 : 0),
                    right: current.right + (leftBetter ? 0 : 1)
                };
            },
            {
                left: 0,
                right: 0
            }
        );
    }, [metrics]);

    if (isLoading) {
        return <LoadingBlock text="Сравниваем активы..." />;
    }

    return (
        <section className="page compare-vs-page">
            <select
                value={leftTicker}
                onChange={(event) => setLeftTicker(event.target.value)}
                className="compare-vs-select"
            >
                {assets.map((asset) => (
                    <option key={asset.id} value={asset.ticker}>
                        {asset.ticker} — {asset.name}
                    </option>
                ))}
            </select>

            <article className="compare-vs-middle">
                <div className="compare-vs-title-row">
                    <strong>{leftTicker}</strong>

                    <div className="compare-vs-center">
                        <span>{score.left}</span>
                        <div className="compare-vs-badge">VS</div>
                        <span>{score.right}</span>
                    </div>

                    <strong>{rightTicker}</strong>
                </div>

                <div className="compare-vs-metrics">
                    {metrics.map((metric) => {
                        const leftClass = resolveMetricClass(
                            metric.leftScore,
                            metric.rightScore,
                            metric.higherIsBetter,
                            true
                        );

                        const rightClass = resolveMetricClass(
                            metric.leftScore,
                            metric.rightScore,
                            metric.higherIsBetter,
                            false
                        );

                        return (
                            <div className="compare-vs-row" key={metric.key}>
                                <div className={`compare-vs-value compare-vs-left ${leftClass}`}>
                                    {metric.leftValue}
                                </div>

                                <div className="compare-vs-label">{metric.label}</div>

                                <div className={`compare-vs-value compare-vs-right ${rightClass}`}>
                                    {metric.rightValue}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <select
                    value={rightTicker}
                    onChange={(event) => setRightTicker(event.target.value)}
                    className="compare-vs-select compare-vs-select-bottom"
                >
                    {assets.map((asset) => (
                        <option key={asset.id} value={asset.ticker}>
                            {asset.ticker} — {asset.name}
                        </option>
                    ))}
                </select>
            </article>
        </section>
    );
}

function resolveMetricClass(
    leftScore: number,
    rightScore: number,
    higherIsBetter: boolean,
    isLeft: boolean
): string {
    if (leftScore === rightScore) {
        return "";
    }

    const leftBetter = higherIsBetter ? leftScore > rightScore : leftScore < rightScore;
    const isBetter = isLeft ? leftBetter : !leftBetter;

    return isBetter ? "metric-better" : "metric-worse";
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

function formatPercentWithSign(value: number): string {
    return `${value >= 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        notation: "compact",
        maximumFractionDigits: 2
    }).format(value);
}