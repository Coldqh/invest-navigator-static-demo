import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/marketDataService";
import {
    getClosedTrades,
    getSimulator,
    type ClosedTrade
} from "../services/browserPortfolioService";
import type {
    AnalyticsSummary,
    PortfolioHoldingView,
    PortfolioSimulator
} from "../types/domain";
import { LoadingBlock } from "../components/LoadingBlock";

type PositionAccent = {
    label: string;
    ticker: string;
    value: string;
    className?: string;
};

export function DashboardPage() {
    const [analytics, setAnalytics] = useState<AnalyticsSummary[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioSimulator | null>(null);
    const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
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
            setClosedTrades(getClosedTrades());
            setAnalytics(loadedAnalytics);
            setIsLoading(false);
        }

        load();
    }, []);

    const analyticsByTicker = useMemo(() => {
        return analytics.reduce<Record<string, AnalyticsSummary>>((acc, item) => {
            acc[item.ticker] = item;
            return acc;
        }, {});
    }, [analytics]);

    const realizedRub = useMemo(() => {
        return closedTrades
            .filter((trade) => trade.currency === "RUB")
            .reduce((sum, trade) => sum + trade.realizedProfitLoss, 0);
    }, [closedTrades]);

    const realizedUsd = useMemo(() => {
        return closedTrades
            .filter((trade) => trade.currency === "USD")
            .reduce((sum, trade) => sum + trade.realizedProfitLoss, 0);
    }, [closedTrades]);

    const portfolioRisk = useMemo(() => {
        if (!portfolio) {
            return 0;
        }

        return calculatePortfolioRisk(portfolio, analyticsByTicker);
    }, [analyticsByTicker, portfolio]);

    const topGrowth = useMemo(() => {
        return [...analytics].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 3);
    }, [analytics]);

    const topFall = useMemo(() => {
        return [...analytics].sort((a, b) => a.priceChangePercent - b.priceChangePercent).slice(0, 3);
    }, [analytics]);

    const topRisk = useMemo(() => {
        return [...analytics].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);
    }, [analytics]);

    const positionAccents = useMemo<PositionAccent[]>(() => {
        if (!portfolio || portfolio.holdings.length === 0) {
            return [];
        }

        const largestPosition = [...portfolio.holdings]
            .sort((first, second) => second.currentValue - first.currentValue)[0];

        const bestOpenPosition = [...portfolio.holdings]
            .sort((first, second) => second.profitLossPercent - first.profitLossPercent)[0];

        const worstOpenPosition = [...portfolio.holdings]
            .sort((first, second) => first.profitLossPercent - second.profitLossPercent)[0];

        const riskiestPosition = [...portfolio.holdings]
            .sort((first, second) => {
                const firstRisk = analyticsByTicker[first.ticker]?.riskScore ?? 0;
                const secondRisk = analyticsByTicker[second.ticker]?.riskScore ?? 0;

                return secondRisk - firstRisk;
            })[0];

        return [
            {
                label: "Крупнейшая позиция",
                ticker: largestPosition.ticker,
                value: formatMoney(largestPosition.currentValue, largestPosition.currency)
            },
            {
                label: "Лучший открытый PnL",
                ticker: bestOpenPosition.ticker,
                value: formatPercentWithSign(bestOpenPosition.profitLossPercent),
                className: bestOpenPosition.profitLoss >= 0 ? "positive-value" : "negative-value"
            },
            {
                label: "Худший открытый PnL",
                ticker: worstOpenPosition.ticker,
                value: formatPercentWithSign(worstOpenPosition.profitLossPercent),
                className: worstOpenPosition.profitLoss >= 0 ? "positive-value" : "negative-value"
            },
            {
                label: "Самая рисковая позиция",
                ticker: riskiestPosition.ticker,
                value: `${analyticsByTicker[riskiestPosition.ticker]?.riskScore ?? 0}/100`
            }
        ];
    }, [analyticsByTicker, portfolio]);

    if (isLoading || !portfolio) {
        return <LoadingBlock text="Собираем дашборд..." />;
    }

    return (
        <section className="page dashboard-page">
            <div className="dashboard-hero dashboard-hero-clean">
                <div>
                    <p className="eyebrow">Dashboard</p>
                    <h1>Invest Navigator AI</h1>
                </div>
            </div>

            <div className="dashboard-summary-grid">
                <DashboardStat label="Активов" value={String(portfolio.assetsCount)} />
                <DashboardStat label="Лотов" value={String(portfolio.lotsCount)} />
                <DashboardStat label="RUB баланс" value={formatMoney(portfolio.account.rubBalance, "RUB")} />
                <DashboardStat label="USD баланс" value={formatMoney(portfolio.account.usdBalance, "USD")} />
                <DashboardStat
                    label="RUB Unrealized"
                    value={formatMoney(portfolio.totalRubProfitLoss, "RUB")}
                    className={portfolio.totalRubProfitLoss >= 0 ? "positive-value" : "negative-value"}
                />
                <DashboardStat
                    label="USD Unrealized"
                    value={formatMoney(portfolio.totalUsdProfitLoss, "USD")}
                    className={portfolio.totalUsdProfitLoss >= 0 ? "positive-value" : "negative-value"}
                />
                <DashboardStat
                    label="RUB Realized"
                    value={formatMoney(realizedRub, "RUB")}
                    className={realizedRub >= 0 ? "positive-value" : "negative-value"}
                />
                <DashboardStat
                    label="USD Realized"
                    value={formatMoney(realizedUsd, "USD")}
                    className={realizedUsd >= 0 ? "positive-value" : "negative-value"}
                />
            </div>

            <div className="dashboard-grid dashboard-grid-pulse">
                <article className="panel dashboard-pulse-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Портфельный пульс</h2>
                        </div>
                    </div>

                    <div className="dashboard-pulse-grid">
                        <PulseCard label="Риск портфеля" value={`${portfolioRisk}/100`} />
                        <PulseCard label="RUB стоимость" value={formatMoney(portfolio.totalRubCurrentValue, "RUB")} />
                        <PulseCard label="USD стоимость" value={formatMoney(portfolio.totalUsdCurrentValue, "USD")} />
                        <PulseCard
                            label="RUB PnL"
                            value={`${formatMoney(portfolio.totalRubProfitLoss, "RUB")} · ${formatPercentWithSign(calculatePnlPercent(portfolio.totalRubProfitLoss, portfolio.totalRubInvested))}`}
                            className={portfolio.totalRubProfitLoss >= 0 ? "positive-value" : "negative-value"}
                        />
                        <PulseCard
                            label="USD PnL"
                            value={`${formatMoney(portfolio.totalUsdProfitLoss, "USD")} · ${formatPercentWithSign(calculatePnlPercent(portfolio.totalUsdProfitLoss, portfolio.totalUsdInvested))}`}
                            className={portfolio.totalUsdProfitLoss >= 0 ? "positive-value" : "negative-value"}
                        />
                    </div>
                </article>

                <article className="panel dashboard-position-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Позиции-акценты</h2>
                        </div>
                    </div>

                    {positionAccents.length === 0 ? (
                        <div className="empty-state">Открытых позиций нет</div>
                    ) : (
                        <div className="dashboard-position-grid">
                            {positionAccents.map((accent) => (
                                <Link
                                    to={`/assets/${accent.ticker}`}
                                    className="dashboard-position-card"
                                    key={`${accent.label}-${accent.ticker}`}
                                >
                                    <span>{accent.label}</span>
                                    <strong>{accent.ticker}</strong>
                                    <em className={accent.className}>{accent.value}</em>
                                </Link>
                            ))}
                        </div>
                    )}
                </article>
            </div>

            <div className="dashboard-grid dashboard-grid-main">
                <DashboardRanking title="Лучший рост" items={topGrowth} mode="percent" />
                <DashboardRanking title="Падение" items={topFall} mode="percent" />
                <DashboardRanking title="Топ риска" items={topRisk} mode="risk" />
            </div>
        </section>
    );
}

type DashboardStatProps = {
    label: string;
    value: string;
    className?: string;
};

function DashboardStat({ label, value, className }: DashboardStatProps) {
    return (
        <div className="dashboard-stat-card">
            <span>{label}</span>
            <strong className={className}>{value}</strong>
        </div>
    );
}

type PulseCardProps = {
    label: string;
    value: string;
    className?: string;
};

function PulseCard({ label, value, className }: PulseCardProps) {
    return (
        <div className="dashboard-pulse-card">
            <span>{label}</span>
            <strong className={className}>{value}</strong>
        </div>
    );
}

type DashboardRankingProps = {
    title: string;
    items: AnalyticsSummary[];
    mode: "risk" | "percent";
};

function DashboardRanking({ title, items, mode }: DashboardRankingProps) {
    return (
        <article className="panel dashboard-ranking-panel">
            <div className="panel-header">
                <div>
                    <h2>{title}</h2>
                </div>
            </div>

            <div className="ranking-list">
                {items.map((item, index) => (
                    <Link to={`/assets/${item.ticker}`} className="ranking-row" key={item.ticker}>
                        <span>#{index + 1}</span>
                        <strong>{item.ticker}</strong>
                        <em className={mode === "percent" && item.priceChangePercent >= 0 ? "positive-value" : mode === "percent" ? "negative-value" : ""}>
                            {formatRankingValue(item, mode)}
                        </em>
                    </Link>
                ))}
            </div>
        </article>
    );
}

function calculatePortfolioRisk(
    portfolio: PortfolioSimulator,
    analyticsByTicker: Record<string, AnalyticsSummary>
): number {
    if (portfolio.holdings.length === 0) {
        return 0;
    }

    const totalValue = portfolio.holdings.reduce((sum, holding) => {
        return sum + Math.max(holding.currentValue, 0);
    }, 0);

    if (totalValue <= 0) {
        return 0;
    }

    const weightedMarketRisk = portfolio.holdings.reduce((sum, holding) => {
        const analyticsRisk = analyticsByTicker[holding.ticker]?.riskScore ?? estimateHoldingRisk(holding);
        const weight = holding.currentValue / totalValue;

        return sum + analyticsRisk * weight;
    }, 0);

    const largestShare = Math.max(
        ...portfolio.holdings.map((holding) => holding.currentValue / totalValue)
    );

    const averagePnlPressure =
        portfolio.holdings.reduce((sum, holding) => {
            return sum + Math.min(Math.abs(holding.profitLossPercent), 60);
        }, 0) / portfolio.holdings.length;

    const concentrationRisk = largestShare * 28;
    const pnlRisk = averagePnlPressure * 0.45;
    const complexityRisk = Math.min(18, portfolio.lotsCount * 1.8);

    return clamp(Math.round(weightedMarketRisk * 0.55 + concentrationRisk + pnlRisk + complexityRisk), 0, 100);
}

function estimateHoldingRisk(holding: PortfolioHoldingView): number {
    return clamp(Math.round(25 + Math.abs(holding.profitLossPercent) * 1.6), 0, 100);
}

function calculatePnlPercent(profitLoss: number, invested: number): number {
    if (invested === 0) {
        return 0;
    }

    return (profitLoss / invested) * 100;
}

function formatRankingValue(item: AnalyticsSummary, mode: "risk" | "percent"): string {
    if (mode === "risk") {
        return `${item.riskScore}/100`;
    }

    return formatPercentWithSign(item.priceChangePercent);
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 4
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

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}