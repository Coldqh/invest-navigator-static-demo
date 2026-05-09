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
    description: string;
};

export function ComparePage() {
    const assets = useMemo(() => getAssets(), []);

    const [firstTicker, setFirstTicker] = useState("SBER");
    const [secondTicker, setSecondTicker] = useState("BTCUSDT");

    const [firstItem, setFirstItem] = useState<AnalyticsSummary | null>(null);
    const [secondItem, setSecondItem] = useState<AnalyticsSummary | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleCompare(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const normalizedFirstTicker = firstTicker.trim().toUpperCase();
        const normalizedSecondTicker = secondTicker.trim().toUpperCase();

        if (!normalizedFirstTicker || !normalizedSecondTicker) {
            setError("Введите два тикера для сравнения");
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

    const compareSummary = useMemo(() => {
        if (!firstItem || !secondItem) {
            return null;
        }

        return buildCompareSummary(firstItem, secondItem, metrics);
    }, [firstItem, metrics, secondItem]);

    const firstWins = metrics.filter((metric) => metric.winner === "FIRST").length;
    const secondWins = metrics.filter((metric) => metric.winner === "SECOND").length;
    const drawCount = metrics.filter((metric) => metric.winner === "DRAW").length;

    return (
        <section className="page compare-page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Сравнение</p>
                    <h1>Два актива рядом</h1>
                    <p>
                        Сравниваем цену, рост, риск, волатильность, объём и источник данных прямо в браузере.
                    </p>
                </div>
            </div>

            {error && <div className="error-block">{error}</div>}

            <article className="panel compare-control-panel">
                <form className="compare-form compare-form-rich" onSubmit={handleCompare}>
                    <label>
                        Первый актив
                        <input
                            value={firstTicker}
                            list="compare-assets"
                            placeholder="SBER"
                            onChange={(event) => setFirstTicker(event.target.value)}
                        />
                    </label>

                    <label>
                        Второй актив
                        <input
                            value={secondTicker}
                            list="compare-assets"
                            placeholder="BTCUSDT"
                            onChange={(event) => setSecondTicker(event.target.value)}
                        />
                    </label>

                    <datalist id="compare-assets">
                        {assets.map((asset) => (
                            <option key={asset.id} value={asset.ticker}>
                                {asset.ticker} — {asset.name}
                            </option>
                        ))}
                    </datalist>

                    <button type="submit" className="primary-button" disabled={isLoading}>
                        {isLoading ? "Сравниваем..." : "Сравнить"}
                    </button>
                </form>
            </article>

            {!firstItem || !secondItem ? (
                <article className="compare-empty-state">
                    <div>
                        <p className="eyebrow">Быстрый старт</p>
                        <h2>SBER против BTCUSDT</h2>
                        <p>
                            Нажми “Сравнить”, чтобы получить карточки активов, победителей по метрикам и общий вывод.
                        </p>
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
                                <p>Часть метрик трактуется по-разному: рост — выше лучше, риск и волатильность — ниже лучше.</p>
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

                    {compareSummary && (
                        <article className="panel compare-summary-panel">
                            <div className="panel-header">
                                <div>
                                    <h2>Итог сравнения</h2>
                                    <p>Браузерная аналитика без базы данных и backend.</p>
                                </div>
                            </div>

                            <div className="compare-summary-grid">
                                <div className="compare-summary-main">
                                    <h3>{compareSummary.title}</h3>
                                    <p>{compareSummary.text}</p>
                                </div>

                                <div className="compare-summary-points">
                                    {compareSummary.points.map((point) => (
                                        <div key={point.label}>
                                            <span>{point.label}</span>
                                            <strong>{point.value}</strong>
                                            <p>{point.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </article>
                    )}
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
        <div className="compare-metric-row">
            <div>
                <span>{metric.label}</span>
                <p>{metric.description}</p>
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
            winner: compareHigherIsBetter(first.priceChangePercent, second.priceChangePercent),
            description: "Показывает, какой актив сильнее вырос на доступном окне данных."
        },
        {
            label: "Риск",
            firstValue: `${first.riskScore}/100`,
            secondValue: `${second.riskScore}/100`,
            winner: compareLowerIsBetter(first.riskScore, second.riskScore),
            description: "Ниже риск — спокойнее профиль по текущей модели."
        },
        {
            label: "Волатильность",
            firstValue: formatPercent(first.volatilityPercent),
            secondValue: formatPercent(second.volatilityPercent),
            winner: compareLowerIsBetter(first.volatilityPercent, second.volatilityPercent),
            description: "Ниже волатильность — меньше среднее дневное движение."
        },
        {
            label: "Объём",
            firstValue: formatCompactNumber(first.averageVolume),
            secondValue: formatCompactNumber(second.averageVolume),
            winner: compareHigherIsBetter(first.averageVolume, second.averageVolume),
            description: "Более высокий объём обычно означает больше рыночной активности."
        },
        {
            label: "Цена",
            firstValue: formatNumber(first.currentPrice),
            secondValue: formatNumber(second.currentPrice),
            winner: compareHigherIsBetter(first.currentPrice, second.currentPrice),
            description: "Не показатель качества, но полезно для общего масштаба инструмента."
        },
        {
            label: "Точек данных",
            firstValue: String(first.dataPoints),
            secondValue: String(second.dataPoints),
            winner: compareHigherIsBetter(first.dataPoints, second.dataPoints),
            description: "Больше точек данных — устойчивее расчёт браузерной аналитики."
        }
    ];
}

function buildCompareSummary(
    first: AnalyticsSummary,
    second: AnalyticsSummary,
    metrics: CompareMetric[]
) {
    const firstWins = metrics.filter((metric) => metric.winner === "FIRST").length;
    const secondWins = metrics.filter((metric) => metric.winner === "SECOND").length;

    const leader =
        firstWins > secondWins
            ? first
            : secondWins > firstWins
                ? second
                : null;

    const calmer =
        first.riskScore <= second.riskScore
            ? first
            : second;

    const strongerGrowth =
        first.priceChangePercent >= second.priceChangePercent
            ? first
            : second;

    const title = leader
        ? `${leader.ticker} выглядит сильнее по сумме метрик`
        : "Активы идут почти ровно";

    const text = leader
        ? `${leader.ticker} забирает больше категорий в текущем сравнении. При этом итог не означает рекомендацию к покупке: здесь учитываются только доступные браузерные данные, риск, волатильность и движение цены.`
        : "По сумме категорий явного лидера нет. В такой ситуации лучше смотреть не только общий счёт, но и конкретную цель: рост, спокойствие, объём или риск.";

    return {
        title,
        text,
        points: [
            {
                label: "Спокойнее",
                value: calmer.ticker,
                text: `${calmer.ticker} имеет более низкий риск по текущей модели.`
            },
            {
                label: "Сильнее рост",
                value: strongerGrowth.ticker,
                text: `${strongerGrowth.ticker} показывает лучший процент изменения.`
            },
            {
                label: "Счёт",
                value: `${firstWins} : ${secondWins}`,
                text: `${first.ticker} против ${second.ticker} по основным категориям.`
            }
        ]
    };
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