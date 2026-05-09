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
    PortfolioSimulator,
    PortfolioTransaction
} from "../types/domain";
import { LoadingBlock } from "../components/LoadingBlock";

type ProviderStats = {
    moex: number;
    binance: number;
    demo: number;
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

    const averageRisk = useMemo(() => {
        if (analytics.length === 0) return 0;

        return analytics.reduce((sum, item) => sum + item.riskScore, 0) / analytics.length;
    }, [analytics]);

    const providerStats = useMemo<ProviderStats>(() => {
        return analytics.reduce<ProviderStats>(
            (acc, item) => {
                if (item.source === "MOEX") {
                    acc.moex += 1;
                } else if (item.source === "BINANCE") {
                    acc.binance += 1;
                } else {
                    acc.demo += 1;
                }

                return acc;
            },
            {
                moex: 0,
                binance: 0,
                demo: 0
            }
        );
    }, [analytics]);

    const topRisk = useMemo(() => {
        return [...analytics].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);
    }, [analytics]);

    const topGrowth = useMemo(() => {
        return [...analytics].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 3);
    }, [analytics]);

    const topFall = useMemo(() => {
        return [...analytics].sort((a, b) => a.priceChangePercent - b.priceChangePercent).slice(0, 3);
    }, [analytics]);

    const topExpensive = useMemo(() => {
        return [...analytics].sort((a, b) => b.currentPrice - a.currentPrice).slice(0, 3);
    }, [analytics]);

    const topCheap = useMemo(() => {
        return [...analytics].sort((a, b) => a.currentPrice - b.currentPrice).slice(0, 3);
    }, [analytics]);

    const recentTransactions = useMemo(() => {
        return portfolio?.transactions.slice(0, 5) ?? [];
    }, [portfolio]);

    const bestTrade = useMemo(() => {
        if (closedTrades.length === 0) {
            return null;
        }

        return [...closedTrades].sort((first, second) => {
            return second.realizedProfitLossPercent - first.realizedProfitLossPercent;
        })[0];
    }, [closedTrades]);

    const worstTrade = useMemo(() => {
        if (closedTrades.length === 0) {
            return null;
        }

        return [...closedTrades].sort((first, second) => {
            return first.realizedProfitLossPercent - second.realizedProfitLossPercent;
        })[0];
    }, [closedTrades]);

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

    if (isLoading || !portfolio) {
        return <LoadingBlock text="Собираем дашборд..." />;
    }

    return (
        <section className="page dashboard-page">
            <div className="dashboard-hero">
                <div>
                    <p className="eyebrow">Dashboard</p>
                    <h1>Invest Navigator AI</h1>

                    <div className="dashboard-hero-actions">
                        <Link to="/assets" className="primary-button">
                            Активы
                        </Link>

                        <Link to="/portfolio" className="ghost-button">
                            Портфель
                        </Link>
                    </div>
                </div>

                <div className="dashboard-orb">
                    <strong>{Math.round(averageRisk)}</strong>
                    <span>Risk</span>
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

            <div className="dashboard-grid dashboard-grid-main">
                <DashboardRanking title="Топ риска" items={topRisk} mode="risk" />
                <DashboardRanking title="Лучший рост" items={topGrowth} mode="percent" />
                <DashboardRanking title="Падение" items={topFall} mode="percent" />
                <DashboardRanking title="Самые дорогие" items={topExpensive} mode="price" />
                <DashboardRanking title="Самые дешёвые" items={topCheap} mode="price" />

                <article className="panel dashboard-provider-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Источники</h2>
                        </div>
                    </div>

                    <div className="dashboard-provider-grid">
                        <ProviderCard label="MOEX" value={String(providerStats.moex)} />
                        <ProviderCard label="BINANCE" value={String(providerStats.binance)} />
                        <ProviderCard label="DEMO" value={String(providerStats.demo)} />
                    </div>
                </article>
            </div>

            <div className="dashboard-grid dashboard-grid-bottom">
                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>Последние операции</h2>
                        </div>

                        <Link to="/portfolio" className="ghost-button">
                            Открыть
                        </Link>
                    </div>

                    {recentTransactions.length === 0 ? (
                        <div className="empty-state">Операций нет</div>
                    ) : (
                        <div className="dashboard-transaction-list">
                            {recentTransactions.map((transaction) => (
                                <TransactionRow key={transaction.id} transaction={transaction} />
                            ))}
                        </div>
                    )}
                </article>

                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>Лучший / худший трейд</h2>
                        </div>
                    </div>

                    <div className="dashboard-trade-grid">
                        <TradeCard title="Лучший" trade={bestTrade} />
                        <TradeCard title="Худший" trade={worstTrade} />
                    </div>
                </article>
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

type ProviderCardProps = {
    label: string;
    value: string;
};

function ProviderCard({ label, value }: ProviderCardProps) {
    return (
        <div className="dashboard-provider-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

type DashboardRankingProps = {
    title: string;
    items: AnalyticsSummary[];
    mode: "risk" | "percent" | "price";
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
                        <em className={item.priceChangePercent >= 0 ? "positive-value" : "negative-value"}>
                            {formatRankingValue(item, mode)}
                        </em>
                    </Link>
                ))}
            </div>
        </article>
    );
}

type TransactionRowProps = {
    transaction: PortfolioTransaction;
};

function TransactionRow({ transaction }: TransactionRowProps) {
    return (
        <div className="dashboard-transaction-row">
            <span className={transaction.transactionType === "BUY" ? "transaction-buy portfolio-transaction-type" : "transaction-sell portfolio-transaction-type"}>
                {transaction.transactionType === "BUY" ? "BUY" : "SELL"}
            </span>

            <strong>{transaction.ticker}</strong>
            <em>{formatNumber(transaction.quantity)}</em>
            <em>{formatMoney(transaction.totalAmount, transaction.currency)}</em>
            <small>{formatDate(transaction.executedAt)}</small>
        </div>
    );
}

type TradeCardProps = {
    title: string;
    trade: ClosedTrade | null;
};

function TradeCard({ title, trade }: TradeCardProps) {
    if (!trade) {
        return (
            <div className="dashboard-trade-card">
                <span>{title}</span>
                <strong>—</strong>
            </div>
        );
    }

    return (
        <div className="dashboard-trade-card">
            <span>{title}</span>
            <strong>{trade.ticker}</strong>
            <em className={trade.realizedProfitLoss >= 0 ? "positive-value" : "negative-value"}>
                {formatMoney(trade.realizedProfitLoss, trade.currency)} · {formatPercent(trade.realizedProfitLossPercent)}
            </em>
        </div>
    );
}

function formatRankingValue(item: AnalyticsSummary, mode: "risk" | "percent" | "price"): string {
    if (mode === "risk") {
        return `${item.riskScore}/100`;
    }

    if (mode === "price") {
        return formatNumber(item.currentPrice);
    }

    return formatPercent(item.priceChangePercent);
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 4
    }).format(value)} ${currency}`;
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 8
    }).format(value);
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("ru-RU");
}